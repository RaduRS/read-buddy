/**
 * Utility functions for Read Buddy Voice Agent
 */

/**
 * Generate system prompt for the reading assistant
 * @param {Object} sessionConfig - Session configuration
 * @returns {string} - System prompt
 */
export function generateSystemPrompt(sessionConfig = {}) {
  const childName = sessionConfig.childName || "friend";
  const readingLevel = sessionConfig.readingLevel || "beginner";
  
  return `You are Read Buddy, a friendly and encouraging AI reading companion for children. Your role is to help children learn to read in a fun and supportive way.

PERSONALITY:
- Be warm, patient, and encouraging
- Use simple, age-appropriate language
- Celebrate every success, no matter how small
- Be understanding when children struggle
- Make reading feel like a fun game, not a test

CURRENT SESSION:
- Child's name: ${childName}
- Reading level: ${readingLevel}
- Session goal: Help with reading practice and comprehension

READING ASSISTANCE GUIDELINES:
1. Start with simple words appropriate for the child's level
2. If they read correctly, give enthusiastic praise
3. If they struggle, offer gentle hints or break words into syllables
4. Ask simple comprehension questions about what they read
5. Suggest fun reading games or activities
6. Keep sessions short and engaging (5-10 minutes)

CONVERSATION STYLE:
- Use encouraging phrases like "Great job!", "You're doing amazing!", "Let's try together!"
- Ask questions like "What do you think this word says?" or "Can you tell me what happened in the story?"
- Offer choices: "Would you like to read about animals or adventures today?"

Remember: Your goal is to make reading enjoyable and build confidence. Every child learns at their own pace, and that's perfectly okay!`;
}

/**
 * Get available functions for the reading assistant
 * @returns {Array} - Array of function definitions
 */
export function getAvailableFunctions() {
  return [
    {
      name: "present_word",
      description: "Present a word for the child to read aloud",
      parameters: {
        type: "object",
        properties: {
          word: {
            type: "string",
            description: "The word to present to the child"
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
            description: "Difficulty level of the word"
          },
          hint: {
            type: "string",
            description: "Optional hint to help with the word"
          }
        },
        required: ["word", "difficulty"]
      }
    },
    {
      name: "provide_feedback",
      description: "Provide feedback on the child's reading attempt",
      parameters: {
        type: "object",
        properties: {
          feedback_type: {
            type: "string",
            enum: ["correct", "incorrect", "close", "encouraging"],
            description: "Type of feedback to give"
          },
          message: {
            type: "string",
            description: "Feedback message for the child"
          },
          next_action: {
            type: "string",
            description: "Suggested next action (try again, move on, etc.)"
          }
        },
        required: ["feedback_type", "message"]
      }
    },
    {
      name: "ask_comprehension_question",
      description: "Ask a simple comprehension question about what was read",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The comprehension question to ask"
          },
          context: {
            type: "string",
            description: "The text or story context for the question"
          }
        },
        required: ["question"]
      }
    },
    {
      name: "suggest_reading_activity",
      description: "Suggest a fun reading-related activity or game",
      parameters: {
        type: "object",
        properties: {
          activity_name: {
            type: "string",
            description: "Name of the suggested activity"
          },
          description: {
            type: "string",
            description: "How to do the activity"
          },
          materials_needed: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Any materials needed for the activity"
          }
        },
        required: ["activity_name", "description"]
      }
    },
    {
      name: "track_progress",
      description: "Track the child's reading progress and achievements",
      parameters: {
        type: "object",
        properties: {
          words_attempted: {
            type: "number",
            description: "Number of words attempted in this session"
          },
          words_correct: {
            type: "number",
            description: "Number of words read correctly"
          },
          reading_level: {
            type: "string",
            description: "Current assessed reading level"
          },
          achievements: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Achievements unlocked in this session"
          }
        },
        required: ["words_attempted", "words_correct"]
      }
    }
  ];
}