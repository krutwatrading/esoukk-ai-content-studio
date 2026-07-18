# V2.1.1 Build Fix

This package fixes the missing ShopifyProductPicker and CreativeAgentStudio imports in ContentStudio.tsx.

# eSoukk AI Commerce Studio V2.1 — Shopify + Creative Agent

## Included in this build

- Secure Shopify Admin product catalogue
- Search by product title or SKU
- High-converting hook generator
- Platform-specific creative specifications
- Instagram, Facebook, TikTok, YouTube Shorts, Pinterest and Snapchat plans
- UGC scripts
- Ad creative video storyboards
- Shot lists, overlays and voiceovers
- High-resolution image-generation prompts
- Existing downloadable branded product creatives
- Read-only Shopify access

## Important limitation

This build automatically creates the complete creative production pack, but it does not automatically render:

- Photorealistic AI lifestyle images
- Finished UGC videos with AI actors
- Finished ad videos

Those outputs require paid image/video generation providers or uploaded product footage. The app is provider-ready, but no paid provider is enabled by default.

This limitation prevents unexpected charges and avoids misleading users about free AI rendering.

## Required Shopify environment variables

```text
SHOPIFY_SHOP=12dafb
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_API_VERSION=2026-07
```

Never commit real secrets.

## Deployment

Copy this package over the current project, then run:

```cmd
npm install
npm run build
git add .
git commit -m "Add V2 creative agent"
git push
```

Vercel deploys automatically.

Do not run `npm audit fix --force`.

## Supabase Phase 1 foundation

The application supports current Supabase publishable/secret keys and legacy
anon/service-role keys. Prefer the current key format:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

The secret key is server-only and must never use a `NEXT_PUBLIC_` prefix.

Apply `supabase/migrations/202607180001_phase1_foundation.sql` once through the
Supabase SQL Editor or with `supabase db push`. The migration creates the
multi-tenant campaign foundation, approval history, audit log, helper functions,
indexes, and Row Level Security policies.

After applying it, verify the private server connection at:

```text
GET /api/supabase/status
```

Healthy response:

```json
{"configured":true,"database":true,"message":"Supabase connection and Phase 1 schema are healthy."}
```
