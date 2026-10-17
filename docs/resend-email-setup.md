# Resend email delivery setup

Phase 11.2 deliberately enables only a private test message to the signed-in account. Bulk campaign release remains locked.

## 1. Verify a sending subdomain

In Resend, add `updates.esoukk.ae` as a domain and add the DNS records Resend supplies. A dedicated subdomain protects the main storefront domain's reputation. Wait until Resend reports the domain as **Verified**.

## 2. Configure Vercel

Add these Production environment variables to the `esoukk-ai-content-studio` project and redeploy:

- `RESEND_API_KEY`: a Resend sending API key
- `RESEND_FROM_EMAIL`: `KAVIA <updates@updates.esoukk.ae>`
- `RESEND_WEBHOOK_SECRET`: the signing secret from the webhook created in step 3

Never place these values in source control or expose them through a `NEXT_PUBLIC_` variable.

## 3. Create the signed webhook

Create a Resend webhook at `https://ai.esoukk.ae/api/email/webhook`.

Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, `contact.updated`, and `suppression.added`. Copy its signing secret into Vercel as `RESEND_WEBHOOK_SECRET`, then redeploy.

## 4. Validate safely

Open the studio's Email Automation panel. All three setup checks must show a tick. Click **Send test to my account**. Confirm that the message arrives and that Resend shows a successful signed webhook delivery.

Bounce, complaint, provider suppression, and unsubscribe events are hashed and added to `email_suppressions`; those addresses are excluded from every future eligible audience.
