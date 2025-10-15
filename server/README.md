# Read Buddy Voice Agent Server

A simplified Node.js server that provides voice agent functionality for the Read Buddy reading assistant app.

## Features

- Direct WebSocket connection to Deepgram for voice processing
- Real-time voice interaction without Twilio dependencies
- Reading-focused AI prompts and functions
- Simple HTTP API for session management
- WebSocket support for frontend integration

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   - `DEEPGRAM_API_KEY`: Get from [Deepgram Console](https://console.deepgram.com/)
   - `OPENAI_API_KEY`: Optional, get from [OpenAI Platform](https://platform.openai.com/api-keys)

3. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Voice Sessions
- `POST /api/voice/start` - Start a new voice session
- `POST /api/voice/stop/:sessionId` - Stop a voice session

### WebSocket
- `ws://localhost:3001` - WebSocket connection for real-time communication

## Usage

The server provides a simplified voice agent that:
1. Connects directly to Deepgram for voice processing
2. Uses reading-focused AI prompts
3. Handles voice input/output without phone system dependencies
4. Provides real-time feedback for reading assistance

## Configuration

Default configuration can be modified in `config.js`:
- Session duration
- Reading difficulty levels
- AI behavior settings
- Voice model preferences