/**
 * Configuration validation for Read Buddy Voice Agent
 */

/**
 * Validate and return configuration
 * @returns {Object} - Validated configuration object
 */
export function validateConfig() {
  const config = {
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    },
    server: {
      port: process.env.PORT || 3001,
      host: process.env.HOST || 'localhost'
    }
  };

  // Validate required environment variables
  if (!config.deepgram.apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required');
  }

  if (!config.openai.apiKey) {
    console.warn('OPENAI_API_KEY not found - some features may be limited');
  }

  console.log('✅ Configuration validated successfully');
  return config;
}

/**
 * Get default session configuration
 * @returns {Object} - Default session configuration
 */
export function getDefaultSessionConfig() {
  return {
    childName: null,
    readingLevel: 'beginner',
    sessionDuration: 10, // minutes
    maxWords: 5,
    enableEncouragement: true,
    enableHints: true
  };
}