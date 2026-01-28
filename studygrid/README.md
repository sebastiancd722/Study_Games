# StudyGrid

A gamified flashcard generator + grid/learn modes powered by Gemini.

## Local development (recommended)

This project uses a Vercel Serverless Function (`/api/ai`) to keep the Gemini API key off the client.

1. Install dependencies  
   `npm install`

2. Install Vercel CLI (one-time)  
   `npm i -g vercel`

3. Create a local env file for Vercel (do **not** commit it)  
   `cp .env.example .env` and set `GEMINI_API_KEY=...`

4. Run with Vercel (serves the Vite frontend + `/api` functions)  
   `vercel dev`

## Deploy to Vercel

1. Import the repo into Vercel
2. Set environment variable `GEMINI_API_KEY`
3. Deploy

## Notes

- The browser never sees your API key.
- The `/api/ai` route includes basic rate limiting + request size guards.
