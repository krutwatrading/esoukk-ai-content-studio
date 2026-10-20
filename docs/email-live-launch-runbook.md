# Controlled email launch

Customer delivery is disabled unless every launch control is explicitly configured.

## 1. Database

Apply `supabase/migrations/202610180002_email_scheduling_delivery.sql` in the Supabase SQL Editor.

## 2. Test-mode environment

Set these Production variables in Vercel and redeploy:

```text
EMAIL_UNSUBSCRIBE_SECRET=<at least 32 random characters>
EMAIL_LIVE_AUDIENCE_MODE=test
EMAIL_LIVE_TEST_RECIPIENTS=your-first-test@example.com,your-second-test@example.com
EMAIL_LIVE_RECIPIENT_LIMIT=5
EMAIL_BULK_SEND_ENABLED=true
NEXT_PUBLIC_APP_URL=https://ai.esoukk.ae
```

Only subscribed Shopify contacts whose normalized addresses appear in `EMAIL_LIVE_TEST_RECIPIENTS` can receive the controlled test.

## 3. Controlled test

1. Generate an email campaign and send the private account test.
2. Save it for approval, approve it and schedule it.
3. Click **Run scheduled test now** on that campaign. The protected worker receives that campaign ID and cannot sweep other queued campaigns while audience mode is `test`.
4. Confirm delivery in the Phase 11.6 dashboard.
5. Click the visible unsubscribe link, confirm the request and verify the suppression count increases.
6. Schedule another controlled test and verify the unsubscribed address is excluded.

## 4. Full audience

Only after the test and unsubscribe drill pass, set `EMAIL_LIVE_AUDIENCE_MODE=full`. The recipient limit applies only to allowlisted test mode; full mode intentionally targets every contact who remains subscribed and non-suppressed at delivery time.
