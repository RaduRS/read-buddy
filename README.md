## Project Overview

Build a Progressive Web App (PWA) using Next.js that helps children learn to read through real-time voice interaction with Deepgram AI. The app assesses reading levels (1-5), generates dynamic reading cards, provides real-time feedback, and tracks progress using localStorage. Designed for Chrome on Android tablets with a playful, encouraging interface.[https://nextjs.org/docs/app/guides/progressive-web-apps](https://nextjs.org/docs/app/guides/progressive-web-apps)​

## Tech Stack Setup

**Framework & UI**

Next.js (already installed) with App Router. Install shadcn/ui for accessible, customizable components: `npx shadcn@latest init`. Add specific shadcn components: `npx shadcn@latest add button card progress badge dialog`. Install next-pwa package: `npm install next-pwa`.[https://www.getfishtank.com/insights/creating-a-progressive-web-app-using-nextjs](https://www.getfishtank.com/insights/creating-a-progressive-web-app-using-nextjs)​

**PWA Configuration**

Create/update `next.config.ts` with PWA settings:[https://www.getfishtank.com/insights/creating-a-progressive-web-app-using-nextjs](https://www.getfishtank.com/insights/creating-a-progressive-web-app-using-nextjs)​

typescript

`import withPWA from 'next-pwa';

export default withPWA({  dest: "public",  disable: process.env.NODE_ENV === "development",  register: true,  skipWaiting: true, })`

Create `public/manifest.json` with app metadata, icons (512x512, 192x192), display mode "standalone", and orientation "landscape" for tablets.[https://gist.github.com/cdnkr/25d3746bdb35767d66c7ae6d26c2ed98](https://gist.github.com/cdnkr/25d3746bdb35767d66c7ae6d26c2ed98)​

**Environment Variables**

Create `.env.local` with Deepgram API key and any other configuration needed.[https://www.getfishtank.com/insights/creating-a-progressive-web-app-using-nextjs](https://www.getfishtank.com/insights/creating-a-progressive-web-app-using-nextjs)​

## Core Features & File Structure

**1. Initial Reading Assessment (`/app/assessment/page.tsx`)**

Display 5 progressively harder reading cards (Level 1: simple 3-letter words like "cat", "dog"; Level 5: complex sentences). Use Deepgram streaming to listen as child reads each card. Compare spoken words against expected text with fuzzy matching for accuracy scoring. Determine starting level based on which cards they read correctly (80%+ accuracy = that level). Store assessment results in localStorage: `{assessmentLevel: number, assessmentDate: string}`.[https://www.readabilitytutor.com/app-for-tracking-books-read/](https://www.readabilitytutor.com/app-for-tracking-books-read/)​

**2. Dynamic Reading Card Generator (`/app/read/page.tsx`)**

Generate age-appropriate reading content based on stored level using simple arrays of words/phrases (no database needed). Display one card at a time with large, readable text using shadcn Card component. Show visual feedback: highlight words green when read correctly, yellow when struggling, red for errors. Include encouraging animations/sounds for correct reading using CSS animations or Lottie files.[https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)​

**3. Real-Time Voice Processing (`/lib/deepgram.ts`)**

Set up WebSocket connection to Deepgram for continuous audio streaming. Implement word-by-word comparison between expected text and transcription. Track metrics: accuracy percentage, words per minute, hesitation points. Provide real-time audio feedback when child makes mistakes (gentle correction voice).[https://the-learning-agency.com/the-cutting-ed/article/teaching-kids-to-read-with-speech-recognition-technology/](https://the-learning-agency.com/the-cutting-ed/article/teaching-kids-to-read-with-speech-recognition-technology/)​

**4. Progress Tracking with localStorage (`/lib/storage.ts`)**

Store comprehensive reading data in localStorage:[https://www.readabilitytutor.com/app-for-tracking-books-read/](https://www.readabilitytutor.com/app-for-tracking-books-read/)​

typescript

`{  currentLevel: number,  wordsKnown: string[],  wordsPracticed: {word: string, attempts: number, lastCorrect: boolean}[],  sessionsCompleted: {date: string, accuracy: number, wordsRead: number}[],  strugglingWords: string[] }`

Create helper functions: `addKnownWord()`, `markWordForPractice()`, `getNextReadingSet()`. Implement adaptive algorithm: if child reads word correctly 3 times, add to `wordsKnown`; if wrong 2+ times, add to `strugglingWords` for focused practice.[https://www.readabilitytutor.com/app-for-tracking-books-read/](https://www.readabilitytutor.com/app-for-tracking-books-read/)​

**5. Parent Dashboard (`/app/dashboard/page.tsx`)**

Display progress charts using shadcn Progress components showing level advancement, words mastered, session history. Show list of known words vs. words needing practice from localStorage. Include session statistics: total reading time, accuracy trends, reading speed improvements.[https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)​

## UI/UX Design Guidelines

**Playful Elements**

Use bright, primary colors (blues, greens, yellows) with high contrast for readability on tablets. Include animated character mascot that cheers when child reads correctly (can use CSS animations or SVG). Add sound effects for correct/incorrect attempts using Web Audio API. Show visual progress bars and achievement badges after each session using shadcn Badge component.[https://play.google.com/store/apps/details?id=com.readability.androidapp&hl=en_GB](https://play.google.com/store/apps/details?id=com.readability.androidapp&hl=en_GB)​

**Tablet Optimization**

Set viewport to landscape mode in manifest.json for better reading experience. Use large touch targets (minimum 48px) for all interactive elements. Implement swipe gestures for moving between cards using touch events. Test on Chrome Android with responsive design tools targeting 10-inch tablet screens.[https://www.imaginarycloud.com/blog/designing-apps-for-kids-a-reading-app-user-experience](https://www.imaginarycloud.com/blog/designing-apps-for-kids-a-reading-app-user-experience)​

## Reading Content Strategy

**Level-Based Content Arrays**

Create static content arrays in `/lib/reading-content.ts`:[https://www.readabilitytutor.com/app-for-tracking-books-read/](https://www.readabilitytutor.com/app-for-tracking-books-read/)​

typescript

`export const readingContent = {  level1: ["cat", "dog", "run", "big", "red"],  level2: ["the cat", "big dog", "run fast"],  level3: ["The cat runs.", "A big red ball."],  level4: ["The brown dog runs quickly.", "She likes to read books."],  level5: ["The playful puppy chased the colorful butterfly.", "Reading helps us learn new things."] }`

Randomly select content from appropriate level based on stored progress. Mix in struggling words from localStorage for targeted practice (30% familiar, 70% new).[https://www.readabilitytutor.com/app-for-tracking-books-read/](https://www.readabilitytutor.com/app-for-tracking-books-read/)​

## Implementation Phases

**Phase 1: PWA & Basic UI**

Configure Next.js PWA with manifest and service worker. Build assessment page with 5 static reading cards using shadcn components. Implement localStorage functions for saving assessment results. Test PWA installation on Android Chrome tablet.[https://nextjs.org/docs/app/guides/progressive-web-apps](https://nextjs.org/docs/app/guides/progressive-web-apps)​

**Phase 2: Deepgram Integration**

Set up Deepgram WebSocket streaming for real-time transcription. Build audio capture from device microphone using `navigator.mediaDevices.getUserMedia()`. Implement word comparison logic and accuracy calculation. Add visual feedback (color highlighting) when words are spoken.[https://the-learning-agency.com/the-cutting-ed/article/teaching-kids-to-read-with-speech-recognition-technology/](https://the-learning-agency.com/the-cutting-ed/article/teaching-kids-to-read-with-speech-recognition-technology/)​

**Phase 3: Progress & Adaptation**

Expand localStorage schema to track known words and practice history. Build adaptive content selection algorithm using stored data. Create progress dashboard with charts and statistics. Add encouraging feedback system with animations and sounds.[https://www.imaginarycloud.com/blog/designing-apps-for-kids-a-reading-app-user-experience](https://www.imaginarycloud.com/blog/designing-apps-for-kids-a-reading-app-user-experience)​

**Phase 4: Polish & Testing**

Optimize for tablet touch interactions and landscape orientation. Add offline support for reading previously loaded content. Implement parent controls and settings page. Conduct user testing with children on Android tablets