# Shared-account authentication

Stage 3 implements the established login screen with exactly two shared usernames: `user` (member) and `admin` (administrator). There is no registration, personal account database, or visible demo-credential panel. The current shop/order/admin surfaces are authenticated shells; their merchandise and order features arrive in later stages.

## Operator configuration

Store `MEMBER_PASSWORD_HASH`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` in private runtime configuration. No real password or deployment secret is committed. To generate a password hash on the Mac with Node 24, enter the shared password through standard input:

```sh
cd web
read -rs sfbb_password
printf '%s' "$sfbb_password" | node scripts/hash-password.mjs
unset sfbb_password
```

Run it once for each account and copy each result into its private hash variable. The tool generates a new 16-byte random salt and a 64-byte Node scrypt derivation (`N=16384`, `r=8`, `p=1`), producing `scrypt:<salt hex>:<derived hex>`. It accepts 1–1024 characters and rejects newline-containing input. It never accepts the password as a command-line argument.

Generate a separate random session secret (64 characters):

```sh
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(48).toString('base64url'))"
```

The default lifetime is 43200 seconds (12 hours). Login does not silently renew it. Updating runtime configuration requires an application restart. When changing shared passwords, also rotate `SESSION_SECRET` to invalidate existing sessions; changing only a password hash prevents new sign-ins with that password but does not revoke existing session tokens.

Prepare the private SQLite directory and run migrations before starting the application, as described in [DATABASE.md](DATABASE.md). Development can use a private `web/.env.local` with the documented variables; production should supply the Pi's private environment file. The committed `.env.example` contains invalid placeholders, not usable credentials.

## Session and mutation contract

Each successful login generates a 32-byte random opaque token. The database stores a purpose-separated HMAC-SHA256 of that token, role, expiry, and a CSRF-token hash. Raw session tokens are returned only in an HttpOnly cookie; no role posted by a browser is authoritative.

For an HTTPS public origin, the cookie is `__Host-sfbb_session`, Secure, HttpOnly, SameSite=Lax, path `/`, with no Domain attribute. Explicit local HTTP development uses `sfbb_session` without Secure. Every lookup checks server time and database state. Logout deletes the session and expires the cookie; the old token cannot be reused. Rotating the session secret also invalidates all stored token hashes.

The per-session CSRF token is a purpose-separated HMAC derived from the opaque token and session secret; only its SHA-256 hash is stored. The authenticated session endpoint and server-rendered page context provide the CSRF token to the same-origin UI. Mutations must present it as `X-CSRF-Token`, with `Origin` exactly matching configured `PUBLIC_ORIGIN`. Missing/foreign origins and cross-site fetch metadata are rejected. Login has no established session yet, so it instead requires the same-origin check and bounded JSON input.

All APIs return `{ data }` or `{ error: { code, message, fields? } }` with `Cache-Control: no-store`. Authentication endpoints are:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/login` | Validate bounded username/password JSON; set a new session cookie; return role, CSRF token, and fixed destination |
| GET | `/api/auth/session` | Return verified actor and CSRF token; 401 without a live session |
| POST | `/api/auth/logout` | Require live session, origin, and CSRF; revoke session and expire cookie |
| GET | `/api/admin/session` | Return verified admin actor; 401 unauthenticated, 403 member |

Future admin APIs must call `requireActor(request, 'admin')`; authenticated mutations must also call `authorizeMutation(request, context)`. Context roles/session IDs/time come from the server. Services must still enforce their resource ownership, window, and version rules. Do not use viewport width, request body roles, or forwarded role headers as authorization.

## Login throttling and trusted addresses

SQLite persists five failed attempts per normalized shared username and trusted client address within fifteen minutes. The sixth attempt is refused (including a correct password) until that window expires; success before the limit clears failures. Unknown usernames share an `unknown` namespace. Failures are committed before the credential error is raised, and concurrent requests use the database write coordinator so they cannot bypass the counter. Incorrect credentials always produce the same message.

Next route handlers do not expose the TCP peer. Arbitrary `X-Forwarded-For`, `CF-Connecting-IP`, posted addresses, or unauthenticated custom headers are ignored. With no configured proxy secret, all direct requests use the conservative `untrusted` address bucket.

For the final Caddy/tunnel integration, optionally configure a separate random `TRUSTED_PROXY_SECRET` of at least 64 characters. Caddy must overwrite incoming `X-SFBB-Proxy-Secret` with that value and overwrite `X-SFBB-Client-IP` with a validated numeric client IP. The application accepts that address only when the secret matches. Caddy must establish that forwarded Cloudflare addresses came through the trusted tunnel ingress; it must not blindly forward a client-supplied Cloudflare/IP header. The Stage 11 [deployment runbook](DEPLOYMENT.md) requires inspection of existing routing before applying this configuration; release scripts never edit Caddy or the tunnel. No Caddy or Cloudflare setting has been changed in this stage.

## Member state and responsive behavior

Member login lands on `/shop`; desktop admin login lands on `/admin` with Orders. An admin on a mobile viewport sees the member surface and navigation; server admin authority remains independent of that display choice. The header has a single Admin link on desktop and no redundant badge.

Sign out revokes the server session before discarding browser state and performing a full navigation to login. It clears the reserved member-state keys `sfbb:cart` and `sfbb:editing-order`, emits `sfbb:signout`, and still navigates when storage is unavailable. Stage 8 must use these keys/events and scope persisted state to the verified session ID, so a new shared-account session never adopts an old bag. Restored browser pages check the session again; server guards remain the authority for every request.

## Verification

Backend tests cover both roles, spoofed roles/time, generic credential errors, cookie flags, expiry, revocation, CSRF/origin rejection, bounded inputs, secret rotation, proxy trust, persisted and concurrent throttling, and the hashing tool. Playwright runs isolated test-only credentials/storage on port 3100, never reuses the user's mockup or production database, and checks desktop/mobile login, Show/Hide, admin gating, errors, and logout, including disabled storage and native form submission without JavaScript. The form explicitly uses POST so credentials never become URL parameters; the no-script state asks users to enable JavaScript. Test credentials are not production defaults and are not copied into the web runtime image.
