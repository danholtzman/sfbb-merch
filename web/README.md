# SFBB production application

Stages 1–9 provide the framework, shared-account authentication, seasons, shirt styles/colors, paired artwork/uploads, order services, responsive member shopping/lookup, and admin order management/CSV exports. The root HTML mockups remain the design reference. Placement editing and release operations remain later stages; this is not a production release. Member UI behavior is documented in [MEMBER-ORDERING.md](../docs/MEMBER-ORDERING.md).

Use Node 24, npm 11.19.0, and the committed npm lockfile (the container supplies both runtime tools):

```sh
cd web
npx --yes npm@11.19.0 ci
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

`GET /api/health` returns `{ "data": { "status": "ok" } }` without reading credentials or opening a database. It checks process liveness, not storage readiness. Runtime services call `readConfig(process.env)` lazily; builds do not require secrets. `.env.example` documents the variables and intentionally contains invalid credential placeholders.

The Docker build context is `web/`, excluding the Mac's native modules and all environment/data files:

```sh
docker buildx build --platform linux/arm64 --load -t sfbb-merch:foundation web/
docker run --rm -p 127.0.0.1:3000:3000 sfbb-merch:foundation
```

The runtime uses UID/GID 10001. The deployment stage will mount private persistent data at `/data` and connect the loopback listener to the existing Caddy/Cloudflare tunnel. No service on the Pi has been changed.

Database setup, migration precautions, bootstrap handoff, and invariants are documented in [DATABASE.md](../docs/DATABASE.md).

Shared credentials, cookie/CSRF contracts, proxy trust, and development login setup are documented in [AUTHENTICATION.md](../docs/AUTHENTICATION.md). Browser acceptance runs use `npm run test:e2e` with a separate temporary database and test-only credentials on port 3100.

Admin order workflows and exact download contracts are documented in [ADMIN-ORDERS-REPORTS.md](../docs/ADMIN-ORDERS-REPORTS.md).
