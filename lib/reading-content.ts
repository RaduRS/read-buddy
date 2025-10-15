export interface ReadingContent {
  level1: string[];
  level2: string[];
  level3: string[];
  level4: string[];
  level5: string[];
}

export const readingContent: ReadingContent = {
  level1: [
    "cat", "dog", "run", "big", "red", "sun", "hat", "bat", "cup", "top",
    "sit", "hop", "fun", "yes", "mom", "dad", "car", "bus", "box", "fox"
  ],
  level2: [
    "the cat", "big dog", "run fast", "red hat", "my mom", "his dad",
    "blue car", "old bus", "small box", "quick fox", "hot sun", "wet dog",
    "happy cat", "funny hat", "green cup", "tall tree", "soft bed", "new toy"
  ],
  level3: [
    "The cat runs.", "A big red ball.", "I like dogs.", "We can play.",
    "The sun is hot.", "My hat is blue.", "Dad has a car.", "Mom likes tea.",
    "The dog can jump.", "I see a bird.", "We go to school.", "The book is good."
  ],
  level4: [
    "The brown dog runs quickly.", "She likes to read books.", "We played in the park today.",
    "The children are very happy.", "My favorite color is green.", "The teacher reads us stories.",
    "I can ride my bicycle fast.", "The flowers smell very nice.", "We eat lunch at school.",
    "The cat sleeps on the bed.", "I help my mom cook dinner.", "The birds sing in the morning."
  ],
  level5: [
    "The playful puppy chased the colorful butterfly.", "Reading helps us learn new things every day.",
    "The children discovered a beautiful garden behind the school.", "My grandmother tells wonderful stories about her childhood.",
    "The library has thousands of interesting books to explore.", "We learned about different animals in science class today.",
    "The rainbow appeared after the thunderstorm ended.", "Cooking together is a fun family activity on weekends.",
    "The musician played a beautiful melody on her violin.", "Adventure stories take us to exciting places around the world."
  ]
};

// Assessment content - one card per level for initial assessment
export const assessmentContent = {
  level1: "cat",
  level2: "the cat",
  level3: "The cat runs.",
  level4: "The brown dog runs quickly.",
  level5: "The playful puppy chased the colorful butterfly."
};

export function getRandomContent(level: number, count: number = 1): string[] {
  const levelKey = `level${level}` as keyof ReadingContent;
  const content = readingContent[levelKey];
  
  if (!content || content.length === 0) {
    return [];
  }
  
  // Shuffle and return requested count
  const shuffled = [...content].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getAssessmentContent(level: number): string {
  const levelKey = `level${level}` as keyof typeof assessmentContent;
  return assessmentContent[levelKey] || "";
}