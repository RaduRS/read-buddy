import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { initializeVoiceAgent, handleVoiceAgentMessage, closeVoiceAgent } from './voice-agent.js';
import { validateConfig, getDefaultSessionConfig } from './config.js';
import { getShortTimestamp } from './dateUtils.js';

// Validate configuration on startup
const config = validateConfig();

// Create Express app
const app = express();
const server = createServer(app);

// Enable CORS for frontend communication
const allowedOrigins = [
  'http://localhost:3000',
  'https://read-buddy-iota.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store active voice agent connections
const activeConnections = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size
  });
});

// Start voice session endpoint
app.post('/api/voice/start', async (req, res) => {
  try {
    const sessionConfig = { ...getDefaultSessionConfig(), ...req.body };
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[${getShortTimestamp()}] 🎯 Starting voice session:`, sessionId);
    
    // Initialize voice agent
    const deepgramWs = await initializeVoiceAgent(sessionConfig);
    
    // Store the connection
    activeConnections.set(sessionId, {
      deepgramWs,
      sessionConfig,
      startTime: new Date()
    });
    
    res.json({
      success: true,
      sessionId,
      message: 'Voice session started successfully'
    });
    
  } catch (error) {
    console.error('Error starting voice session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop voice session endpoint
app.post('/api/voice/stop/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const connection = activeConnections.get(sessionId);
  if (connection) {
    closeVoiceAgent(connection.deepgramWs);
    activeConnections.delete(sessionId);
    
    console.log(`[${getShortTimestamp()}] 🛑 Voice session stopped:`, sessionId);
    
    res.json({
      success: true,
      message: 'Voice session stopped successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
});

// WebSocket connection handler for frontend
wss.on('connection', (ws, req) => {
  console.log(`[${getShortTimestamp()}] 🔌 Frontend WebSocket connected`);
  
  ws.on('message', async (message) => {
    try {
      const messageStr = message.toString();
      
      // Check for empty messages
      if (!messageStr || messageStr.trim() === '') {
        console.log(`[${getShortTimestamp()}] 📨 Frontend: Empty message received, skipping`);
        return;
      }
      
      // Parse JSON with error handling
      let data;
      try {
        data = JSON.parse(messageStr);
      } catch (jsonError) {
        console.error(`[${getShortTimestamp()}] ❌ Frontend: Invalid JSON received:`, jsonError.message);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON format'
        }));
        return;
      }
      
      // Validate message structure
      if (!data.type) {
        console.error(`[${getShortTimestamp()}] ❌ Frontend: Message missing type field`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Message must have a type field'
        }));
        return;
      }
      
      console.log(`[${getShortTimestamp()}] 📨 Frontend message:`, data.type);
      
      switch (data.type) {
        case 'start_session':
          try {
            const sessionConfig = { ...getDefaultSessionConfig(), ...data.config };
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`[${getShortTimestamp()}] 🆕 Creating new session: ${sessionId}`);
            const deepgramWs = await initializeVoiceAgent(sessionConfig);
            console.log(`[${getShortTimestamp()}] 🔗 Deepgram WebSocket created for session: ${sessionId}`);
            
            // Store connection with frontend WebSocket reference
            // Note: deepgramReady is set to true because SettingsApplied was already received during initialization
            activeConnections.set(sessionId, {
              deepgramWs,
              sessionConfig,
              frontendWs: ws,
              startTime: new Date(),
              deepgramReady: true  // Set to true since SettingsApplied was received during initializeVoiceAgent
            });
            
            console.log(`[${getShortTimestamp()}] 💾 Session ${sessionId} stored in activeConnections with deepgramReady: true`);
            
            // Set up message forwarding from Deepgram to frontend
            deepgramWs.on('message', (deepgramMessage) => {
              if (ws.readyState === ws.OPEN) {
                try {
                  const messageStr = deepgramMessage.toString();
                  
                  // Skip empty messages
                  if (!messageStr || messageStr.trim() === '') {
                    console.log(`[${getShortTimestamp()}] 📨 Deepgram: Empty message received, skipping`);
                    return;
                  }
                  
                  // Try to parse as JSON
                  let parsedData;
                  try {
                    parsedData = JSON.parse(messageStr);
                  } catch (jsonError) {
                    // If it's not JSON, it might be binary audio data
                    // If we're receiving audio from Deepgram, it's ready to receive audio
                    // Find the sessionId by looking for the connection with this Deepgram WebSocket
                    let foundSessionId = null;
                    let foundConnection = null;
                    
                    for (const [sid, conn] of activeConnections.entries()) {
                      if (conn.deepgramWs === deepgramWs) {
                        foundSessionId = sid;
                        foundConnection = conn;
                        break;
                      }
                    }
                    
                    if (foundConnection && !foundConnection.deepgramReady && foundSessionId) {
                      console.log(`[${getShortTimestamp()}] 🎉 Deepgram is sending audio - marking as ready for session ${foundSessionId}!`);
                      foundConnection.deepgramReady = true;
                    }
                    
                    // Forward binary data as base64 for audio
                    ws.send(JSON.stringify({
                      type: 'deepgram_audio',
                      data: deepgramMessage.toString('base64')
                    }));
                    return;
                  }
                  
                  // Note: SettingsApplied is handled during initialization in voice-agent.js
                  // and deepgramReady is set to true when the session is stored
                  
                  // Forward JSON messages
                  ws.send(JSON.stringify({
                    type: 'deepgram_message',
                    data: parsedData
                  }));
                  
                } catch (error) {
                  console.error(`[${getShortTimestamp()}] ❌ Error processing Deepgram message:`, error);
                }
              }
            });
            
            ws.send(JSON.stringify({
              type: 'session_started',
              sessionId,
              success: true
            }));
            
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'session_error',
              error: error.message
            }));
          }
          break;
          
        case 'send_audio':
          // Validate required fields
          if (!data.sessionId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'send_audio requires sessionId'
            }));
            break;
          }
          
          if (!data.audio) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'send_audio requires audio data'
            }));
            break;
          }
          
          // Forward audio to appropriate Deepgram connection
          const sessionId = data.sessionId;
          const connection = activeConnections.get(sessionId);
          
          if (!connection) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Session ${sessionId} not found`
            }));
            break;
          }
          
          if (connection.deepgramWs.readyState === connection.deepgramWs.OPEN && connection.deepgramReady) {
            try {
              // Convert base64 audio data to binary buffer for Deepgram
              const audioBuffer = Buffer.from(data.audio, 'base64');
              console.log(`[${getShortTimestamp()}] 🎵 Sending binary audio to Deepgram: ${audioBuffer.length} bytes`);
              connection.deepgramWs.send(audioBuffer);
            } catch (audioError) {
              console.error(`[${getShortTimestamp()}] ❌ Error sending audio to Deepgram:`, audioError);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to send audio to Deepgram'
              }));
            }
          } else {
            // Debug: Check which condition is failing
            const wsState = connection.deepgramWs.readyState;
            const wsOpen = wsState === connection.deepgramWs.OPEN;
            const deepgramReady = connection.deepgramReady;
            
            console.log(`[${getShortTimestamp()}] ⚠️ Cannot send audio: WebSocket state: ${wsState} (OPEN=${connection.deepgramWs.OPEN}), wsOpen: ${wsOpen}, deepgramReady: ${deepgramReady}, session: ${sessionId}`);
          }
          break;
          
        case 'stop_session':
          // Validate required fields
          if (!data.sessionId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'stop_session requires sessionId'
            }));
            break;
          }
          
          const stopSessionId = data.sessionId;
          const stopConnection = activeConnections.get(stopSessionId);
          
          if (stopConnection) {
            try {
              closeVoiceAgent(stopConnection.deepgramWs);
              activeConnections.delete(stopSessionId);
              console.log(`[${getShortTimestamp()}] 🛑 Session ${stopSessionId} stopped successfully`);
              ws.send(JSON.stringify({
                type: 'session_stopped',
                sessionId: stopSessionId
              }));
            } catch (stopError) {
              console.error(`[${getShortTimestamp()}] ❌ Error stopping session:`, stopError);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to stop session'
              }));
            }
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Session ${stopSessionId} not found`
            }));
          }
          break;
          
        default:
          console.log(`[${getShortTimestamp()}] ❓ Unknown message type:`, data.type);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`
          }));
          break;
      }
    } catch (error) {
      console.error('Error handling frontend message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log(`[${getShortTimestamp()}] 🔌 Frontend WebSocket disconnected`);
    
    // Clean up any sessions associated with this WebSocket
    for (const [sessionId, connection] of activeConnections.entries()) {
      if (connection.frontendWs === ws) {
        closeVoiceAgent(connection.deepgramWs);
        activeConnections.delete(sessionId);
        console.log(`[${getShortTimestamp()}] 🧹 Cleaned up session:`, sessionId);
      }
    }
  });
});

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

server.listen(PORT, HOST, () => {
  console.log(`🚀 Read Buddy Voice Agent Server running on http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🎤 Deepgram integration: ${config.deepgram.apiKey ? 'Ready' : 'Not configured'}`);
  console.log(`🌐 Server bound to host: ${HOST} (${HOST === '0.0.0.0' ? 'accessible from internet' : 'localhost only'})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  
  // Close all active voice agent connections
  for (const [sessionId, connection] of activeConnections.entries()) {
    closeVoiceAgent(connection.deepgramWs);
  }
  
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});