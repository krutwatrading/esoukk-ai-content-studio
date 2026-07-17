# eSoukk AI Content Studio

A working MVP that converts a public Shopify product link into AI-written captions, Story copy, Pinterest copy, Reel guidance, email copy, SEO copy and downloadable branded PNG creatives.

## Included
- Public Shopify product import
- English, Arabic or bilingual campaign instructions
- Instagram portrait, square and Story templates
- Pinterest Pin template
- Optional AI lifestyle background
- Mock mode without an API key
- Approval-first workflow

## Run locally
1. Install Node.js 20+
2. Extract the project
3. In the project folder run:
```bash
npm install
cp .env.example .env.local
npm run dev
```
4. Open http://localhost:3000

Add your OpenAI API key to `.env.local` for live AI generation. Never share or commit the key.

## Deploy
Push the folder to a private GitHub repository, import it into Vercel, and add the environment variables under Project Settings.

## Next phase
Add Supabase persistence, a private Shopify app with minimal read-only scopes and product webhooks, Meta/Pinterest OAuth, scheduling, approval roles and analytics.
