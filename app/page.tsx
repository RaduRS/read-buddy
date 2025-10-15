'use client'

import { useState, useRef, useEffect } from 'react'

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isListening, setIsListening] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)



  const connectToVoiceAgent = async () => {
    setIsConnecting(true)
    setConnectionStatus('connecting')
    
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser')
      }

      // Request microphone access first with simple constraints for PWA compatibility
      setMessages(prev => [...prev, 'Requesting microphone access...'])
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true
      })
      audioStreamRef.current = stream
      setMessages(prev => [...prev, 'Microphone access granted!'])

      // Small delay to ensure stream is properly initialized
      await new Promise(resolve => setTimeout(resolve, 100))

      // Connect to the voice agent WebSocket server
      const serverUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'wss://read-buddy.onrender.com'
      const ws = new WebSocket(serverUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('Connected to voice agent server')
        setMessages(prev => [...prev, 'Connected to voice server!'])
        
        // Start a voice session
        ws.send(JSON.stringify({
          type: 'start_session',
          config: {
            // Add any session configuration here
            language: 'en',
            model: 'nova-3'
          }
        }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('Received message:', data)
        
        switch (data.type) {
          case 'session_started':
            sessionIdRef.current = data.sessionId
            setIsConnected(true)
            setIsConnecting(false)
            setConnectionStatus('connected')
            setMessages(prev => [...prev, `Voice session started! Session ID: ${data.sessionId}`])
            
            // Start audio streaming
            startAudioStreaming(stream, ws)
            break
            
          case 'deepgram_message':
            handleDeepgramMessage(data.data)
            break
            
          case 'session_error':
            setMessages(prev => [...prev, `Session error: ${data.error}`])
            setConnectionStatus('error')
            break
            
          case 'session_stopped':
            setMessages(prev => [...prev, 'Voice session stopped'])
            break
            
          case 'error':
            setMessages(prev => [...prev, `Error: ${data.error}`])
            break
            
          default:
            setMessages(prev => [...prev, `Unknown message: ${JSON.stringify(data)}`])
        }
      }

      ws.onclose = () => {
        console.log('Disconnected from voice agent')
        setIsConnected(false)
        setIsListening(false)
        setConnectionStatus('disconnected')
        setMessages(prev => [...prev, 'Disconnected from voice agent'])
        stopAudioStreaming()
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnecting(false)
        setConnectionStatus('error')
        setMessages(prev => [...prev, 'Error connecting to voice agent. Make sure the server is running.'])
        stopAudioStreaming()
      }

    } catch (error) {
      console.error('Failed to connect:', error)
      setIsConnecting(false)
      setConnectionStatus('error')
      
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            setMessages(prev => [...prev, 'Microphone access denied. Please:'])
            setMessages(prev => [...prev, '1. Click the microphone icon in your browser address bar'])
            setMessages(prev => [...prev, '2. Select "Allow" for microphone access'])
            setMessages(prev => [...prev, '3. Refresh the page and try again'])
            break
          case 'NotFoundError':
            setMessages(prev => [...prev, 'No microphone found. Please connect a microphone and try again.'])
            break
          case 'NotReadableError':
            setMessages(prev => [...prev, 'Microphone is being used by another application. Please close other apps using the microphone.'])
            break
          case 'OverconstrainedError':
            setMessages(prev => [...prev, 'Microphone constraints not supported. Please try again.'])
            break
          default:
            setMessages(prev => [...prev, `Error: ${error.message}`])
        }
      } else {
        setMessages(prev => [...prev, 'Failed to connect to voice agent'])
      }
    }
  }

  const handleDeepgramMessage = (data: { type: string; role?: string; content?: string; [key: string]: unknown }) => {
    switch (data.type) {
      case 'ConversationText':
        if (data.role === 'user') {
          setMessages(prev => [...prev, `You: ${data.content}`])
        } else if (data.role === 'assistant') {
          setMessages(prev => [...prev, `Read Buddy: ${data.content}`])
        }
        break
        
      case 'UserStartedSpeaking':
        setIsListening(true)
        setMessages(prev => [...prev, '🎤 Listening...'])
        break
        
      case 'UserStoppedSpeaking':
        setIsListening(false)
        setMessages(prev => [...prev, '🔇 Processing...'])
        break
        
      case 'TtsAudio':
        // Handle text-to-speech audio if needed
        console.log('Received TTS audio')
        break
        
      default:
        console.log('Unhandled Deepgram message:', data.type, data)
    }
  }

  const startAudioStreaming = (stream: MediaStream, ws: WebSocket) => {
    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
          // Convert blob to base64 and send to server
          const reader = new FileReader()
          reader.onload = () => {
            const base64Audio = (reader.result as string).split(',')[1]
            ws.send(JSON.stringify({
              type: 'send_audio',
              sessionId: sessionIdRef.current,
              audio: base64Audio
            }))
          }
          reader.readAsDataURL(event.data)
        }
      }
      
      mediaRecorder.start(100) // Send audio chunks every 100ms
      setMessages(prev => [...prev, 'Started audio streaming...'])
    } catch (error) {
      console.error('Failed to start audio streaming:', error)
      setMessages(prev => [...prev, 'Failed to start audio recording'])
    }
  }

  const stopAudioStreaming = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    setIsListening(false)
  }



  const disconnectFromVoiceAgent = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setConnectionStatus('disconnected')
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📚 Read Buddy
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            A reading companion that helps children learn to read through voice interaction
          </p>
          
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : connectionStatus === 'connecting'
                ? 'bg-yellow-100 text-yellow-800'
                : connectionStatus === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              Status: {connectionStatus}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            {!isConnected ? (
              <button
                onClick={connectToVoiceAgent}
                disabled={isConnecting}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
              </button>
            ) : (
              <button
                onClick={disconnectFromVoiceAgent}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Log</h2>
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500 italic">No messages yet. Connect to start chatting!</p>
            ) : (
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
                    <span className="ml-2">{message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Voice chat is active!</strong> You can now speak to Read Buddy. 
                  The voice agent will help you with reading practice and answer your questions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
