import WebSocket from "ws";
import { generateSystemPrompt, getAvailableFunctions } from "./utils.js";
import { getCurrentDateTime, getShortTimestamp } from "./dateUtils.js";
import { validateConfig } from "./config.js";

/**
 * Simple Voice Agent for Read Buddy
 * Simplified version without Twilio - direct WebSocket connection to Deepgram
 */

// Get configuration
const config = validateConfig();

/**
 * Initialize Deepgram Voice Agent connection
 * @param {Object} sessionConfig - Session configuration object
 * @returns {Promise<WebSocket>} - Connected Deepgram WebSocket
 */
export async function initializeVoiceAgent(sessionConfig = {}) {
  return new Promise((resolve, reject) => {
    const deepgramWs = new WebSocket(
      "wss://agent.deepgram.com/v1/agent/converse",
      ["token", config.deepgram.apiKey]
    );

    deepgramWs.on("open", () => {
      console.log("✅ Deepgram WebSocket connected successfully");
      console.log("Connection readyState:", deepgramWs.readyState);
    });

    // Wait for Welcome message before sending configuration
    const initMessageHandler = async (message) => {
      try {
        const timestamp = getShortTimestamp();
        const data = JSON.parse(message.toString());
        
        console.log(`[${timestamp}] 📨 Deepgram message:`, data.type);

        if (data.type === "Welcome") {
          console.log(`[${timestamp}] ✅ WELCOME: Received - sending agent configuration...`);

          // Generate system prompt for reading assistance
          const systemPrompt = generateSystemPrompt(sessionConfig);
          
          // Get available functions for reading assistance
          const functionsArray = getAvailableFunctions();
          
          const agentConfig = {
            type: "Settings",
            audio: {
              input: {
                encoding: "linear16",
                sample_rate: 16000,
              },
              output: {
                encoding: "linear16",
                sample_rate: 16000,
                container: "none",
              },
            },
            agent: {
              language: "en",
              listen: {
                provider: {
                  type: "deepgram",
                  model: "nova-3",
                },
              },
              think: {
                provider: {
                  type: "open_ai",
                  model: "gpt-4o-mini",
                },
                prompt: systemPrompt,
                functions: functionsArray || [],
              },
              speak: {
                provider: {
                  type: "deepgram",
                  model: "aura-asteria-en",
                },
              },
              greeting: "Hi there! I'm Read Buddy, your AI reading companion. What would you like to read today?",
            },
          };

          console.log(`[${timestamp}] 📤 SENDING: Configuration to Deepgram...`);
          
          try {
            deepgramWs.send(JSON.stringify(agentConfig));
            console.log(`[${timestamp}] ✅ SENT: Configuration sent successfully`);
          } catch (configError) {
            console.error(`[${timestamp}] ❌ ERROR: Sending configuration:`, configError);
            reject(configError);
            return;
          }

        } else if (data.type === "SettingsApplied") {
          console.log(`[${timestamp}] ✅ SETTINGS_APPLIED: Agent ready!`);
          
          // Remove the initialization message handler
          deepgramWs.removeListener("message", initMessageHandler);
          
          // Resolve with the connected WebSocket
          resolve(deepgramWs);
          
        } else {
          console.log(`[${timestamp}] 📨 OTHER: Message type:`, data.type);
        }
      } catch (error) {
        console.error(`[${timestamp}] ❌ INIT_ERROR:`, error);
        reject(error);
      }
    };

    // Register the initialization message handler
    deepgramWs.on("message", initMessageHandler);

    deepgramWs.on("error", (error) => {
      console.error("Deepgram WebSocket error:", error);
      reject(error);
    });

    deepgramWs.on("close", (code, reason) => {
      console.log(`Deepgram WebSocket closed. Code: ${code}, Reason: ${reason}`);
      if (code !== 1000) {
        reject(new Error(`WebSocket closed with code ${code}: ${reason}`));
      }
    });

    // Set a timeout for connection establishment
    setTimeout(() => {
      if (deepgramWs.readyState !== WebSocket.OPEN) {
        reject(new Error("Deepgram connection timeout"));
      }
    }, 10000);
  });
}

/**
 * Handle voice agent messages
 * @param {Buffer|string} message - Message from Deepgram
 * @param {WebSocket} deepgramWs - Deepgram WebSocket connection
 */
export function handleVoiceAgentMessage(message, deepgramWs) {
  try {
    const timestamp = getShortTimestamp();
    const data = JSON.parse(message.toString());
    
    console.log(`[${timestamp}] 📨 Voice Agent Message:`, data.type);
    
    switch (data.type) {
      case "ConversationText":
        console.log(`[${timestamp}] 💬 Conversation:`, data.text);
        break;
        
      case "TtsAudio":
        console.log(`[${timestamp}] 🔊 Audio received:`, data.audio ? "Yes" : "No");
        // Handle audio playback here
        break;
        
      case "UserStartedSpeaking":
        console.log(`[${timestamp}] 🎤 User started speaking`);
        break;
        
      case "UserStoppedSpeaking":
        console.log(`[${timestamp}] 🎤 User stopped speaking`);
        break;
        
      case "FunctionCallRequest":
        console.log(`[${timestamp}] 🔧 Function call:`, data.function_name);
        // Handle function calls here
        break;
        
      default:
        console.log(`[${timestamp}] 📦 Other message:`, data.type);
    }
  } catch (error) {
    console.error("Error handling voice agent message:", error);
  }
}

/**
 * Close voice agent connection
 * @param {WebSocket} deepgramWs - Deepgram WebSocket connection
 */
export function closeVoiceAgent(deepgramWs) {
  console.log("🔌 Closing voice agent connection");
  
  if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
    deepgramWs.close(1000, "Session ended");
    console.log("✅ Voice agent connection closed");
  }
}