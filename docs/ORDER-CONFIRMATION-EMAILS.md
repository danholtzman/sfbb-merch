# Optional order confirmations with Resend

Order confirmation email is an opt-in feature added after the initial release scope. It is disabled by default; ordering still works without an email provider or email address. The on-screen six-character order code remains the primary confirmation.

## Configuration

Set these server-only variables in `web/.env.local` for development, or the private `/srv/sfbb-merch/.env` used by Compose for deployment:

```dotenv
ORDER_CONFIRMATION_EMAILS_ENABLED=true
RESEND_API_KEY=re_REPLACE_WITH_YOUR_PRIVATE_SENDING_KEY
RESEND_FROM_EMAIL=orders@your-verified-domain.example
```

All three are required to offer the field. Only the literal `true` enables it. Missing credentials or an invalid sender disable email without preventing startup or checkout. Set the flag to `false` to turn email off. Restart the application after changing configuration; for Compose, recreate the app container so it receives the new environment. Compose already loads the private environment file. Do not add `NEXT_PUBLIC_` prefixes or commit real credentials.

The sender accepts one bare mailbox or a display name plus one mailbox (`SFBB Merch <orders@example.com>`). The deployed Compose environment file uses `format: raw`: do not wrap its values in quotes, since those quotes would become part of the sender. Multiple sender addresses and line breaks are refused. Use a Resend key with sending access, restricted to the intended domain where available.

## Sender and domain verification

1. Add a domain you control in the Resend dashboard. A dedicated sending subdomain is useful for keeping this configuration separate from other mail.
2. Add the DNS records Resend supplies for sending authentication (SPF and DKIM), then wait until Resend reports the domain as verified. Use the exact hostnames and values shown in your dashboard. Do not replace existing unrelated mail records. For Cloudflare, mail authentication records must be DNS-only where applicable.
3. Set `RESEND_FROM_EMAIL` to an address on that verified domain. The example domains above are placeholders. The `onboarding@resend.dev` test sender is restricted to testing and cannot deliver freely to members.
4. Enable the flag, restart, and place a disposable test order with an inbox you control. Verify that its code, items, and total match the on-screen confirmation. Check the Resend dashboard for acceptance/delivery; API acceptance alone does not guarantee inbox delivery.

See [Resend sending API](https://resend.com/docs/api-reference/emails/send-email), [domain verification](https://resend.com/docs/dashboard/domains/introduction), and [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Behavior and failure handling

- When configured, new-order checkout offers an optional email address. Leaving it empty preserves the existing checkout flow. Filling it in requests one plain-text confirmation; it does not subscribe the member to marketing.
- Emails include the committed order code, season, items, server-calculated total, edit deadline, and separate-payment instructions. No payment is collected. Member notes are omitted.
- The order and its checkout retry record commit before the network request starts. Email never runs in the database transaction. A request, including reading its response, has a three-second timeout; checkout may wait up to that limit but still succeeds on failure.
- Identical retries, including concurrent requests and retries after a lost response, return the saved order without another email attempt. The normalized email participates in the checkout fingerprint; changing it while reusing the same key is a conflict. No-email fingerprints remain compatible with pre-feature requests.
- The Resend request also uses a stable `order-confirmation/<order-id>` idempotency key. Resend keeps these keys for 24 hours. Application replay suppression remains the primary duplicate guard.
- This is best-effort delivery, with no outbox, resend endpoint, automatic retry, or delivery-status UI. A process crash after the order commits can lose the email attempt. Edits, progress changes, cancellation, and restoration do not send emails. Members should save their code regardless of email delivery.
- Recipient addresses are used for this request only and are not stored in order rows, responses, browser bag storage, reports, or logs. The checkout record stores only a hash of the normalized submission and the existing order response. Resend receives the address and message; its account retention policies apply.
- Network, timeout, malformed response, and provider errors produce only a generic server warning: `Order confirmation email failed; the order remains saved.` Provider bodies, recipients, names, order codes, and API keys are not logged. Check Resend's dashboard privately for delivery diagnostics.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` from `web/` using Node 24. Service tests use a disposable SQLite database and replace only the external HTTP boundary. They cover disabled/missing configuration, blank and invalid recipients, committed-order content, concurrent duplicate submissions, recipient privacy, and HTTP/network/timeout failures. Member browser tests cover submitting the optional field and the existing no-email flow. The browser test server explicitly disables Resend, and its enabled-form test exposes only the availability flag in the intercepted catalog response; no external emails are sent.
