# SFBB production application

Stage 1 provides the framework, runtime configuration, process health endpoint, test tooling, and Linux ARM64 container. The root HTML mockups remain the design reference. Ordering, authentication, and database schema arrive in later stages; this foundation is not a production release.

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
