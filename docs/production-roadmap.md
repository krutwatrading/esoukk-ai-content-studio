# Production Roadmap

1. Supabase authentication and campaign database.
2. Private Shopify app with minimum read-only product permissions.
3. Product-created and product-updated webhooks.
4. Brand-template editor and Arabic RTL templates.
5. Meta OAuth, Instagram/Facebook publishing and scheduler.
6. Pinterest OAuth and Pin publishing.
7. Approval roles, audit log, retries and token revocation.
8. Performance analytics and creative recommendations.
9. Automated video rendering and approved voiceovers.
10. Production safety and reliability: private health checks, legal pages, Supabase-backed rate limiting, audit monitoring and a verified backup-restore runbook.
11. Consent-safe email automation: Shopify email audiences, permanent suppressions, provider connection, approval, scheduling and delivery reporting.

## Current completion

- Phases 1–10: implemented.
- Phase 11.1–11.3: audience safety, Resend delivery, CTA tests and KAVIA/eSoukk sender identities implemented.
- Phase 11.4: persistent email review drafts and role-gated approval implemented. Approval does not send.
- Phase 11.5: scheduling, send-time consent revalidation, protected batch delivery and duplicate prevention implemented. Live delivery remains disabled by default.
- Phase 11.6: privacy-safe campaign delivery dashboard for sent, delivered, delayed, bounced, complained and failed events implemented.
- Phase 11.7: signed one-click unsubscribe, permanent suppression, allowlisted test mode and capped production launch controls implemented. The operational launch drill remains intentionally manual.
- Phase 11.8: authenticated, campaign-targeted controlled test release implemented. Test mode can release only the explicitly selected scheduled campaign to subscribed, non-suppressed recipients on the allowlist; full customer delivery remains a separate manual launch decision.

Production must include encrypted tokens, rate limiting, moderation, claim validation, privacy/terms pages, monitoring and backups.
