# Resend email delivery setup

Phase 11.3 enables private KAVIA and eSoukk test messages to the signed-in account. Bulk campaign release remains locked.

## 1. Verify a sending subdomain

In Resend, add `updates.shopkavia.com` and `updates.esoukk.ae`, then add the DNS records Resend supplies for each domain. Dedicated subdomains protect the main storefront domains' reputations. Wait until Resend reports both domains as **Verified**.

## 2. Configure Vercel

Add these Production environment variables to the `esoukk-ai-content-studio` project and redeploy:

- `RESEND_API_KEY`: a Resend sending API key
- `RESEND_WEBHOOK_SECRET`: the signing secret from the webhook created in step 3
- `RESEND_KAVIA_FROM_EMAIL`: `KAVIA <hello@updates.shopkavia.com>`
- `RESEND_KAVIA_REPLY_TO`: a monitored inbox such as `support@shopkavia.com`
- `RESEND_ESOUKK_FROM_EMAIL`: `eSoukk <hello@updates.esoukk.ae>`
- `RESEND_ESOUKK_REPLY_TO`: a monitored inbox such as `support@esoukk.ae`

`RESEND_FROM_EMAIL` remains a backward-compatible fallback for KAVIA only.

Never place these values in source control or expose them through a `NEXT_PUBLIC_` variable.

## 3. Create the signed webhook

Create a Resend webhook at `https://ai.esoukk.ae/api/email/webhook`.

Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, `contact.updated`, and `suppression.added`. Copy its signing secret into Vercel as `RESEND_WEBHOOK_SECRET`, then redeploy.

## 4. Validate safely

Open the studio's Email Automation panel. Select KAVIA and send a test, then select eSoukk and repeat. Confirm both messages arrive, replies address the correct monitored inbox, and Resend shows successful signed webhook deliveries tagged with the selected brand.

Bounce, complaint, provider suppression, and unsubscribe events are hashed and added to `email_suppressions`; those addresses are excluded from every future eligible audience.
