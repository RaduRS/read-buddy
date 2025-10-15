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
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
      const data = JSON.parse(message.toString());
      console.log(`[${getShortTimestamp()}] 📨 Frontend message:`, data.type);
      
      switch (data.type) {
        case 'start_session':
          try {
            const sessionConfig = { ...getDefaultSessionConfig(), ...data.config };
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const deepgramWs = await initializeVoiceAgent(sessionConfig);
            
            // Store connection with frontend WebSocket reference
            activeConnections.set(sessionId, {
              deepgramWs,
              sessionConfig,
              frontendWs: ws,
              startTime: new Date()
            });
            
            // Set up message forwarding from Deepgram to frontend
            deepgramWs.on('message', (deepgramMessage) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                  type: 'deepgram_message',
                  data: JSON.parse(deepgramMessage.toString())
                }));
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
          // Forward audio to appropriate Deepgram connection
          const sessionId = data.sessionId;
          const connection = activeConnections.get(sessionId);
          if (connection && connection.deepgramWs.readyState === connection.deepgramWs.OPEN) {
            connection.deepgramWs.send(data.audio);
          }
          break;
          
        case 'stop_session':
          const stopSessionId = data.sessionId;
          const stopConnection = activeConnections.get(stopSessionId);
          if (stopConnection) {
            closeVoiceAgent(stopConnection.deepgramWs);
            activeConnections.delete(stopSessionId);
            ws.send(JSON.stringify({
              type: 'session_stopped',
              sessionId: stopSessionId
            }));
          }
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