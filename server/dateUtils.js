/**
 * Date utility functions for Read Buddy Voice Agent
 */

/**
 * Get current date and time
 * @returns {Date} - Current date and time
 */
export function getCurrentDateTime() {
  return new Date();
}

/**
 * Get short timestamp for logging
 * @returns {string} - Short timestamp string
 */
export function getShortTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format date for session tracking
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatSessionDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Get session duration in minutes
 * @param {Date} startTime - Session start time
 * @param {Date} endTime - Session end time (defaults to now)
 * @returns {number} - Duration in minutes
 */
export function getSessionDuration(startTime, endTime = new Date()) {
  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.round(durationMs / (1000 * 60));
}