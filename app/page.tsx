'use client'

import { useState, useRef, useEffect } from 'react'
import { audioManager } from '@/lib/audio-manager'

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isListening, setIsListening] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [canUserSpeak, setCanUserSpeak] = useState(false)
  const [conversationState, setConversationState] = useState<'idle' | 'user_speaking' | 'ai_thinking' | 'ai_speaking'>('idle')
  const [messages, setMessages] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connectToVoiceAgent = async () => {
    setIsConnecting(true)
    setConnectionStatus('connecting')
    
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser')
      }

      // For PWA on Android, show explicit permission message
      const isAndroid = /Android/i.test(navigator.userAgent)
      const isPWA = window.matchMedia('(display-mode: standalone)').matches
      
      if (isAndroid && isPWA) {
        setMessages(prev => [...prev, '📱 PWA on Android detected'])
        setMessages(prev => [...prev, '🎤 Please allow microphone access in the next prompt'])
        setMessages(prev => [...prev, 'If no prompt appears, check your browser settings'])
      }

      // Request microphone access first with simple constraints for PWA compatibility
      setMessages(prev => [...prev, 'Requesting microphone access...'])
      
      let stream: MediaStream
      
      try {
        // Try with specific constraints first
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 24000,
            channelCount: 1
          }
        })
        console.log('✅ Got audio stream with specific constraints')
      } catch (constraintError) {
        console.warn('⚠️ Specific constraints failed, trying with basic audio:', constraintError)
        // Fallback to basic audio constraints
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true
        })
        console.log('✅ Got audio stream with basic constraints')
      }
      audioStreamRef.current = stream
      setMessages(prev => [...prev, '✅ Microphone access granted!'])

      // Small delay to ensure stream is properly initialized
      await new Promise(resolve => setTimeout(resolve, 100))

      // Connect to the voice agent WebSocket server
      const serverUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'wss://read-buddy.onrender.com'
      setMessages(prev => [...prev, `🔗 Connecting to: ${serverUrl}`])
      setMessages(prev => [...prev, `🌐 User Agent: ${navigator.userAgent.substring(0, 50)}...`])
      setMessages(prev => [...prev, `📱 Is PWA: ${window.matchMedia('(display-mode: standalone)').matches}`])
      setMessages(prev => [...prev, `🕐 Connection attempt at: ${new Date().toLocaleTimeString()}`])
      
      const ws = new WebSocket(serverUrl)
      wsRef.current = ws

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          setMessages(prev => [...prev, '⏰ Connection timeout - Server may be down'])
          ws.close()
        }
      }, 10000) // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout)
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
        try {
          const data = JSON.parse(event.data)
          console.log('Received message:', data)
          
          if (!data.type) {
            console.error('Received message without type field:', data)
            setMessages(prev => [...prev, '❌ Received invalid message from server'])
            return
          }
          
          switch (data.type) {
          case 'session_started':
            sessionIdRef.current = data.sessionId
            setIsConnected(true)
            setIsConnecting(false)
            setConnectionStatus('connected')
            setMessages(prev => [...prev, `Voice session started! Session ID: ${data.sessionId}`])
            // Enable user to speak after connection is established
            setCanUserSpeak(true)
            setConversationState('idle')
            setMessages(prev => [...prev, '🎤 Ready! You can start speaking now.'])
            
            // Start audio streaming
            startAudioStreaming(stream, ws)
            break
            
          case 'deepgram_message':
            handleDeepgramMessage(data.data)
            break
            
          case 'deepgram_audio':
            // Handle binary audio data from Deepgram using AudioManager
            if (data.data) {
              // Set AI speaking state and start timeout
              setIsAISpeaking(true)
              setConversationState('ai_speaking')
              setCanUserSpeak(false)
              
              // Clear any existing timeout
              if (audioTimeoutRef.current) {
                clearTimeout(audioTimeoutRef.current)
              }
              
              // Set timeout to automatically switch back to user turn if AgentAudioDone isn't received
              audioTimeoutRef.current = setTimeout(() => {
                console.log('⏰ Audio timeout - switching to user turn')
                setIsAISpeaking(false)
                setConversationState('idle')
                setCanUserSpeak(true)
                setMessages(prev => [...prev, '✅ Your turn to speak! (timeout)'])
              }, 3000) // 3 second timeout
              
              audioManager.playAudio(data.data).catch((error) => {
                console.error('Failed to play Deepgram audio:', error)
                setMessages(prev => [...prev, '⚠️ Audio playback failed'])
              })
            }
            break
            
          case 'session_error':
            setMessages(prev => [...prev, `Session error: ${data.error}`])
            setConnectionStatus('error')
            break
            
          case 'session_stopped':
            setMessages(prev => [...prev, 'Voice session stopped'])
            break
            
          case 'error':
            setMessages(prev => [...prev, `Error: ${data.message || data.error || 'Unknown error'}`])
            break
            
          default:
            setMessages(prev => [...prev, `Unknown message: ${JSON.stringify(data)}`])
        }
        } catch (error) {
          console.error('Error processing WebSocket message:', error)
          setMessages(prev => [...prev, '❌ Error processing message from server'])
        }
      }

      ws.onclose = (event) => {
        console.log('Disconnected from voice agent', event)
        setIsConnected(false)
        setIsListening(false)
        setConnectionStatus('disconnected')
        
        if (event.code === 1006) {
          setMessages(prev => [...prev, '❌ Connection failed - Server may be unreachable'])
          setMessages(prev => [...prev, '💡 This might be a temporary 502 error. Try the "Test Connection" button.'])
        } else if (event.code === 1000) {
          setMessages(prev => [...prev, '✅ Disconnected normally'])
        } else if (event.code === 1002) {
          setMessages(prev => [...prev, '❌ Protocol error - Check server status'])
        } else if (event.code === 1011) {
          setMessages(prev => [...prev, '❌ Server error (502) - Service temporarily unavailable'])
          setMessages(prev => [...prev, '🔄 Wait a moment and try again'])
        } else {
          setMessages(prev => [...prev, `❌ Disconnected (code: ${event.code}, reason: ${event.reason || 'Unknown'})`])
        }
        
        stopAudioStreaming()
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnecting(false)
        setConnectionStatus('error')
        setMessages(prev => [...prev, '❌ WebSocket connection error - Check network and server status'])
        setMessages(prev => [...prev, '💡 Try: 1) Check internet connection 2) Verify server is running on port 10000'])
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
    console.log('📨 Received message:', data.type, data)
    switch (data.type) {
      case 'ConversationText':
        if (data.role === 'user') {
          setMessages(prev => [...prev, `You: ${data.content}`])
          setConversationState('ai_thinking')
          setCanUserSpeak(false)
        } else if (data.role === 'assistant') {
          setMessages(prev => [...prev, `Read Buddy: ${data.content}`])
          setConversationState('ai_speaking')
          setIsAISpeaking(true)
          setCanUserSpeak(false)
        }
        break
        
      case 'UserStartedSpeaking':
        setIsListening(true)
        setConversationState('user_speaking')
        setCanUserSpeak(true)
        setMessages(prev => [...prev, '🎤 Listening...'])
        break
        
      case 'UserStoppedSpeaking':
        setIsListening(false)
        setConversationState('ai_thinking')
        setCanUserSpeak(false)
        setMessages(prev => [...prev, '🔇 Processing...'])
        break

      case 'AgentAudioDone':
        // AI finished speaking, user can now speak
        console.log('🎯 AgentAudioDone received - switching to user turn')
        
        // Clear the audio timeout since we received the proper signal
        if (audioTimeoutRef.current) {
          clearTimeout(audioTimeoutRef.current)
          audioTimeoutRef.current = null
        }
        
        setIsAISpeaking(false)
        setConversationState('idle')
        setCanUserSpeak(true)
        setMessages(prev => [...prev, '✅ Your turn to speak!'])
        break
        
      case 'TtsAudio':
        // Handle text-to-speech audio if needed
        console.log('Received TTS audio')
        break
        
      case 'SettingsApplied':
        console.log('✅ SettingsApplied received - Deepgram configuration confirmed')
        setMessages(prev => [...prev, '✅ Audio settings configured'])
        break
        
      default:
        console.log('Unhandled Deepgram message:', data.type, data)
    }
  }

  const startAudioStreaming = async (stream: MediaStream, ws: WebSocket) => {
    try {
      // Create AudioContext for raw PCM capture
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioContextClass({
        sampleRate: 24000
      })
      
      // Debug: Check actual sample rates
      console.log('🔊 AudioContext sample rate:', audioContext.sampleRate)
      console.log('🎤 Stream tracks:', stream.getAudioTracks().map(track => ({
        label: track.label,
        settings: track.getSettings(),
        constraints: track.getConstraints()
      })))
      
      // Check track status and constraints
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length > 0) {
        const track = audioTracks[0]
        console.log('🎤 Audio track enabled:', track.enabled)
        console.log('🎤 Audio track ready state:', track.readyState)
        console.log('🎤 Audio track settings:', track.getSettings())
        console.log('🎤 Audio track constraints:', track.getConstraints())
      } else {
        console.log('❌ No audio tracks found in stream!')
      }
      
      const source = audioContext.createMediaStreamSource(stream)
      console.log('🔗 MediaStreamSource created successfully')
      
      // Use AudioWorkletNode instead of deprecated ScriptProcessorNode
      try {
        // Load the audio worklet processor
        await audioContext.audioWorklet.addModule('/audio-processor.js')
        
        // Create AudioWorkletNode
        const processor = new AudioWorkletNode(audioContext, 'audio-processor')
        
        // Handle processed audio data
        processor.port.onmessage = (event) => {
          if (event.data.type === 'audioData') {
            console.log('📨 Received audio data from AudioWorklet processor')
            
            if (ws && ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
              const audioData = new Uint8Array(event.data.data)
              const base64Audio = btoa(String.fromCharCode(...audioData))
              
              console.log('📤 Sending PCM audio data:', audioData.length, 'bytes, base64 length:', base64Audio.length)
              
              ws.send(JSON.stringify({
                type: 'send_audio',
                sessionId: sessionIdRef.current,
                audio: base64Audio
              }))
            }
          }
        }
        
        source.connect(processor)
        // Note: We don't connect processor to destination since we're only processing audio data
        
        // Store references for cleanup
        mediaRecorderRef.current = { 
          stop: () => {
            processor.disconnect()
            source.disconnect()
            audioContext.close()
          },
          state: 'recording'
        } as MediaRecorder
        
        console.log('🎤 Started PCM audio streaming with AudioWorkletNode...')
        
        // Enable test audio after 5 seconds if no real audio is detected
        setTimeout(() => {
          console.log('🧪 Enabling test audio generation to debug audio pipeline...')
          processor.port.postMessage({ type: 'enableTestAudio', enabled: true })
        }, 5000)
        
      } catch (workletError) {
        console.warn('AudioWorklet not available, falling back to ScriptProcessorNode:', workletError)
        
        // Fallback to ScriptProcessorNode for compatibility
        const processor = audioContext.createScriptProcessor(8192, 1, 1)
        
        processor.onaudioprocess = (event) => {
          if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
            const inputBuffer = event.inputBuffer
            const inputData = inputBuffer.getChannelData(0) // Get mono channel
            
            // Check for silence to avoid sending empty audio (reduces AI processing load)
            const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length)
            const silenceThreshold = 0.01 // Adjust as needed
            
            if (rms < silenceThreshold) {
              console.log('🔇 Skipping silent audio chunk (RMS:', rms.toFixed(4), ')')
              return // Don't send silent audio
            }
            
            // Convert Float32 to Int16 PCM
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              // Clamp and convert to 16-bit signed integer
              const sample = Math.max(-1, Math.min(1, inputData[i]))
              pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
            }
            
            // Convert to base64
            const uint8Array = new Uint8Array(pcmData.buffer)
            const base64Audio = btoa(String.fromCharCode(...uint8Array))
            
            console.log('📤 Sending PCM audio data:', pcmData.length, 'samples, RMS:', rms.toFixed(4), 'base64 length:', base64Audio.length)
            
            ws.send(JSON.stringify({
              type: 'send_audio',
              sessionId: sessionIdRef.current,
              audio: base64Audio
            }))
          }
        }
        
        source.connect(processor)
         processor.connect(audioContext.destination)
         
         // Store references for cleanup
         mediaRecorderRef.current = { 
           stop: () => {
             processor.disconnect()
             source.disconnect()
             audioContext.close()
           },
           state: 'recording'
         } as MediaRecorder
         
         console.log('🎤 Started PCM audio streaming with ScriptProcessorNode (fallback)...')
      }
      
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
    
    // Clean up audio timeout
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current)
      audioTimeoutRef.current = null
    }
    
    stopAudioStreaming()
    setIsConnected(false)
    setIsListening(false)
    setIsAISpeaking(false)
    setCanUserSpeak(false)
    setConversationState('idle')
    setConnectionStatus('disconnected')
    sessionIdRef.current = null
  }

  const testWebSocketConnection = () => {
    setMessages(prev => [...prev, '🧪 Testing WebSocket connection (no microphone)...'])
    
    const serverUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'wss://read-buddy.onrender.com'
    setMessages(prev => [...prev, `🔗 Testing connection to: ${serverUrl}`])
    setMessages(prev => [...prev, `🕐 Test started at: ${new Date().toLocaleTimeString()}`])
    
    const testWs = new WebSocket(serverUrl)
    
    const testTimeout = setTimeout(() => {
      if (testWs.readyState === WebSocket.CONNECTING) {
        setMessages(prev => [...prev, '❌ Test connection timeout (5s)'])
        setMessages(prev => [...prev, '💡 Server might be experiencing 502 errors'])
        testWs.close()
      }
    }, 5000)
    
    testWs.onopen = () => {
      clearTimeout(testTimeout)
      setMessages(prev => [...prev, '✅ WebSocket connection test successful!'])
      setMessages(prev => [...prev, '🎉 Server is responding - try "Start Voice Chat" now'])
      testWs.close()
    }
    
    testWs.onclose = (event) => {
      if (event.code === 1006) {
        setMessages(prev => [...prev, `🔌 Test failed (code: ${event.code}) - Server unreachable`])
        setMessages(prev => [...prev, '💡 This indicates a 502 Bad Gateway error'])
      } else {
        setMessages(prev => [...prev, `🔌 Test connection closed (code: ${event.code})`])
      }
    }
    
    testWs.onerror = (error) => {
      setMessages(prev => [...prev, '❌ WebSocket test failed - Server unreachable'])
      setMessages(prev => [...prev, '🔍 Check: https://read-buddy.onrender.com for server status'])
    }
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      // Clean up audio resources
      audioManager.dispose()
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
            
            {isConnected && (
              <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                conversationState === 'user_speaking' 
                  ? 'bg-blue-100 text-blue-800' 
                  : conversationState === 'ai_thinking'
                  ? 'bg-yellow-100 text-yellow-800'
                  : conversationState === 'ai_speaking'
                  ? 'bg-purple-100 text-purple-800'
                  : canUserSpeak
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {conversationState === 'user_speaking' && (
                   <>
                     <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                     You&apos;re speaking
                   </>
                 )}
                {conversationState === 'ai_thinking' && (
                  <>
                    <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                    AI is thinking...
                  </>
                )}
                {conversationState === 'ai_speaking' && (
                  <>
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                    AI is speaking
                  </>
                )}
                {conversationState === 'idle' && canUserSpeak && (
                  <>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                    Your turn to speak!
                  </>
                )}
                {conversationState === 'idle' && !canUserSpeak && (
                  <>
                    <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    Waiting...
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            {!isConnected ? (
              <>
                <button
                  onClick={connectToVoiceAgent}
                  disabled={isConnecting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
                </button>
                <button
                  onClick={testWebSocketConnection}
                  className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium text-sm"
                >
                  Test Connection
                </button>
              </>
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
