'use client'

import { useState, useRef, useEffect } from 'react'

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [messages, setMessages] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  const connectToVoiceAgent = async () => {
    setIsConnecting(true)
    setConnectionStatus('connecting')
    
    try {
      // Connect to the voice agent WebSocket
      const serverUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'wss://read-buddy.onrender.com'
      const ws = new WebSocket(serverUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('Connected to voice agent')
        setIsConnected(true)
        setIsConnecting(false)
        setConnectionStatus('connected')
        setMessages(prev => [...prev, 'Connected to Read Buddy voice agent!'])
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('Received message:', data)
        setMessages(prev => [...prev, `Voice Agent: ${data.message || JSON.stringify(data)}`])
      }

      ws.onclose = () => {
        console.log('Disconnected from voice agent')
        setIsConnected(false)
        setConnectionStatus('disconnected')
        setMessages(prev => [...prev, 'Disconnected from voice agent'])
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnecting(false)
        setConnectionStatus('error')
        setMessages(prev => [...prev, 'Error connecting to voice agent. Make sure the server is running.'])
      }

    } catch (error) {
      console.error('Failed to connect:', error)
      setIsConnecting(false)
      setConnectionStatus('error')
      setMessages(prev => [...prev, 'Failed to connect to voice agent'])
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-4xl w-full">
        <h1 className="text-6xl font-bold text-gray-800 mb-6">
          Read Buddy
        </h1>
        
        <p className="text-xl text-gray-600 mb-8">
          Your AI-powered reading companion. Start a voice conversation to practice reading together!
        </p>
        
        <div className="mb-8">
          <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium mb-4 ${
            connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
            connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
            connectionStatus === 'error' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            Status: {connectionStatus}
          </div>
        </div>
        
        <div className="space-x-4 mb-8">
          {!isConnected ? (
            <button
              onClick={connectToVoiceAgent}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200"
            >
              {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
            </button>
          ) : (
            <button
              onClick={disconnectFromVoiceAgent}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200"
            >
              Disconnect
            </button>
          )}
        </div>

        {messages.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4">Connection Log</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.map((message, index) => (
                <div key={index} className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-gray-500">
          <p>Voice agent server deployed on Render</p>
          <p>For local development: <code className="bg-gray-200 px-2 py-1 rounded">npm run server:dev</code></p>
        </div>
      </div>
    </div>
  )
}
