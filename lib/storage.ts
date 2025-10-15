export interface AssessmentResult {
  assessmentLevel: number;
  assessmentDate: string;
  completed: boolean;
}

export interface WordPractice {
  word: string;
  attempts: number;
  lastCorrect: boolean;
  lastAttemptDate: string;
}

export interface ReadingSession {
  date: string;
  accuracy: number;
  wordsRead: number;
  timeSpent: number; // in minutes
  level: number;
}

export interface UserProgress {
  currentLevel: number;
  wordsKnown: string[];
  wordsPracticed: WordPractice[];
  sessionsCompleted: ReadingSession[];
  strugglingWords: string[];
  totalWordsRead: number;
  totalTimeSpent: number; // in minutes
}

const STORAGE_KEYS = {
  ASSESSMENT: 'readbuddy_assessment',
  PROGRESS: 'readbuddy_progress'
} as const;

// Assessment functions
export function saveAssessmentResult(result: AssessmentResult): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENT, JSON.stringify(result));
  } catch (error) {
    console.error('Failed to save assessment result:', error);
  }
}

export function getAssessmentResult(): AssessmentResult | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ASSESSMENT);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to get assessment result:', error);
    return null;
  }
}

// Progress functions
export function getUserProgress(): UserProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to get user progress:', error);
  }
  
  // Return default progress if none exists
  return {
    currentLevel: 1,
    wordsKnown: [],
    wordsPracticed: [],
    sessionsCompleted: [],
    strugglingWords: [],
    totalWordsRead: 0,
    totalTimeSpent: 0
  };
}

export function saveUserProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save user progress:', error);
  }
}

// Word management functions
export function addKnownWord(word: string): void {
  const progress = getUserProgress();
  
  // Remove from struggling words if it exists there
  progress.strugglingWords = progress.strugglingWords.filter(w => w.toLowerCase() !== word.toLowerCase());
  
  // Add to known words if not already there
  if (!progress.wordsKnown.some(w => w.toLowerCase() === word.toLowerCase())) {
    progress.wordsKnown.push(word);
  }
  
  saveUserProgress(progress);
}

export function markWordForPractice(word: string, correct: boolean): void {
  const progress = getUserProgress();
  const existingIndex = progress.wordsPracticed.findIndex(
    w => w.word.toLowerCase() === word.toLowerCase()
  );
  
  if (existingIndex >= 0) {
    // Update existing word practice
    progress.wordsPracticed[existingIndex].attempts += 1;
    progress.wordsPracticed[existingIndex].lastCorrect = correct;
    progress.wordsPracticed[existingIndex].lastAttemptDate = new Date().toISOString();
  } else {
    // Add new word practice
    progress.wordsPracticed.push({
      word,
      attempts: 1,
      lastCorrect: correct,
      lastAttemptDate: new Date().toISOString()
    });
  }
  
  // Check if word should be moved to known or struggling
  const wordPractice = progress.wordsPracticed[existingIndex >= 0 ? existingIndex : progress.wordsPracticed.length - 1];
  
  if (correct && wordPractice.attempts >= 3) {
    // Word read correctly 3+ times, add to known words
    addKnownWord(word);
  } else if (!correct && wordPractice.attempts >= 2) {
    // Word failed 2+ times, add to struggling words
    if (!progress.strugglingWords.some(w => w.toLowerCase() === word.toLowerCase())) {
      progress.strugglingWords.push(word);
    }
  }
  
  saveUserProgress(progress);
}

export function addReadingSession(session: ReadingSession): void {
  const progress = getUserProgress();
  progress.sessionsCompleted.push(session);
  progress.totalWordsRead += session.wordsRead;
  progress.totalTimeSpent += session.timeSpent;
  
  // Update current level if assessment suggests advancement
  if (session.accuracy >= 0.8 && session.level >= progress.currentLevel) {
    progress.currentLevel = Math.min(5, session.level + 1);
  }
  
  saveUserProgress(progress);
}

export function getNextReadingSet(level: number, count: number = 5): string[] {
  const progress = getUserProgress();
  
  // Mix struggling words (30%) with new content (70%)
  const strugglingCount = Math.floor(count * 0.3);
  const newCount = count - strugglingCount;
  
  const strugglingWords = progress.strugglingWords
    .filter(word => {
      // Only include struggling words appropriate for the level
      const wordLevel = getWordLevel(word);
      return wordLevel <= level;
    })
    .slice(0, strugglingCount);
  
  // Note: getRandomContent will be imported where this function is used
  // to avoid circular dependencies
  return [...strugglingWords];
}

function getWordLevel(word: string): number {
  // Simple heuristic to determine word level based on length and complexity
  if (word.length <= 3) return 1;
  if (word.length <= 6 && !word.includes(' ')) return 2;
  if (word.includes('.') || word.includes('!') || word.includes('?')) return 3;
  if (word.split(' ').length > 3) return 4;
  return 5;
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ASSESSMENT);
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  } catch (error) {
    console.error('Failed to clear data:', error);
  }
}

export function hasCompletedAssessment(): boolean {
  const assessment = getAssessmentResult();
  return assessment?.completed === true;
}