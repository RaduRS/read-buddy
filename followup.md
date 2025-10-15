Foundational
Android/Chrome version: Chrome 100+ on Android 10+​
Language: English-only for MVP​
Orientation: Landscape primary, allow portrait with responsive fallback​
Accessibility: Follow WCAG AA defaults, minimum 18px font, high contrast​
Session length: No cap, allow for longer sessions if needed​

Voice & AI
Deepgram connection: Proxy via Next.js API route (/api/deepgram) to protect API key​
Deepgram settings: Use Nova-3 model, enable interim results for real-time feedback, punctuation off for easier matching​
Correction voice: Use Web Speech API TTS (simple, no extra costs)​ - not sure we need this since we use the agent voice
Word matching: Medium strictness - allow common mispronunciations using Levenshtein distance ≤2, ignore filler words like "um", "uh"​
Audio recording: Real-time processing only, no storage (privacy + simplicity)​

Content & Scoring
Level content: Fixed for MVP, use the arrays I provided earlier​
Fuzzy matching: Levenshtein distance with threshold of 2 characters difference for acceptance​
Accuracy threshold: Keep 80% across all levels for consistency​
Punctuation/capitalization: Ignore both - convert everything to lowercase for matching​
Words-per-minute: Count only successfully read words, exclude repeated attempts and hesitations​

Persistence & Privacy
Storage: localStorage only for MVP, no cloud sync​
Retention: Keep data indefinitely with manual clear option in parent dashboard​
Parent controls: Simple "tap and hold for 3 seconds" unlock pattern, no PIN needed for MVP​
Offline support: Cache entire reading set per level in service worker​
Compliance: Add simple "This app is for educational use" disclaimer, skip COPPA compliance for MVP (not collecting personal data)​

UX & PWA
Icons: Generate simple placeholders with app initials for now, I'll provide assets later​
Assets loading: Preload core animations and sounds in service worker for instant feedback​
Gestures: Swipe right for next card, tap word to hear pronunciation, tap "Start Reading" button to begin voice capture​
Mascot: Only on success screens and session summary, keep reading screen clean​
Brand colors: Use bright primary palette - blue (#3B82F6), green (#10B981), yellow (#F59E0B) with white backgrounds​

Roadmap & Process
Start with: Phase 1 - PWA setup + /app/assessment page with static cards and localStorage​
Testing: I will run this locally  so we probably will need an app and maybe a server where we will run the deepgram voice and logic not sure maybe not. But after i run thi slocally i will share that link and connect external tablet there. if we need a node server separatly create a new filder which i wil ldeploy separatly to render. 
Unit tests: Skip for MVP, manual testing only​
Analytics: Skip for MVP​
Deadline: No hard deadline, prioritize working prototype in 2 weeks​

Start by scaffolding the assessment page with 5 cards and basic localStorage functions to save the level. Then we'll add Deepgram integration in Phase 2.

ALWAYS Keep in mind this is critical for the user experience, keep all component DRY and separation of concerns following the best coding practice. 