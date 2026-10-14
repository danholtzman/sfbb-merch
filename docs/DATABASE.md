# Database foundation

Stage 2 adds Prisma 7.10 models and a checked SQLite migration. There are no production sample orders, credentials, or uploaded files in source control. All integration tests use temporary files that are removed when the test finishes.

## Preparing storage

Use one application process against one private SQLite file. Its parent directory must already exist and be writable by the operator/app user (UID/GID 10001 in Docker). Configure an absolute URL:

```sh
cd web
DATABASE_URL=file:/absolute/private/path/sfbb.sqlite npm run db:migrate
```

This is an operator command: stop the application before running migrations. The entry point opens/closes SQLite to create a missing empty file without truncating existing data, then executes `prisma migrate deploy`. Applying it a second time reports no pending migrations and preserves existing records. It does not start a public listener or initialize a season.

Client generation runs automatically before tests, type checking, development, and production builds. Generation uses an explicit unused placeholder URL and never opens a real database; runtime credentials are not required during builds. Generated files stay ignored and are regenerated from the committed schema. The generator uses explicit `.ts` imports for direct Node 24 tooling as well as Next.js bundling.

## Startup and transactions

`src/server/db.ts` exports a lazy `db` client, an explicit `createDatabase(url)` factory, and `withTransaction(work, client?)`. Every adapter connection enables foreign keys, WAL, and a 5000 ms busy timeout before queries. Write services must use the transaction helper and pass its `tx` to nested helpers rather than opening another transaction inside a transaction.

Interactive writes are queued by resolved database-file identity within the process. This also coordinates two clients opened for that file. The queue is not a distributed lock: multiple application processes/workers are outside the supported architecture. Failed operations roll back all their writes and do not prevent subsequent queued operations.

Editable parent records carry a version. Services must filter writes on `id` and the expected version, increment the version atomically, and pass the affected row count to `assertVersionWrite`; an unmatched write raises `STALE_VERSION` (HTTP 409). Services and authenticated routes arrive in later stages; this helper alone does not authorize a mutation.

After migrations, startup must explicitly call `initializeDatabase(client, serverNow)` before offering the first season. That function transactionally creates `First season` as an empty draft, with opening/closing dates equal to the current Los Angeles date and one `Season artwork` set with empty front/back slots. It creates no styles/orders and never publishes. A durable initialization marker prevents repeats; an existing or restored catalog is preserved. The deployment startup integration is still a later stage. Public process health checks remain independent of storage/bootstrap.

## Invariants and historical data

All entity identities are UUIDs. Order codes are unique six-character uppercase alphanumeric strings. Orders store cancellation separately from progress (`OPEN`, `DELIVERED_UNPAID`, `COMPLETE`). Foreign keys protect order seasons and ordered style/set/color/size references, including cancelled orders.

Order lines retain their ordered unit-price cents, style/set names, color name/hex, and size label. Catalog changes never rewrite those fields automatically. Unit prices are nonnegative 32-bit integer cents; helpers reject excess precision and overflow. Formatted aggregate amounts may use any nonnegative safe-integer cent total. Later order services must enforce total arithmetic limits.

Normalized Unicode/case/whitespace names are unique within their relevant season/style. Display positions keep stable ordering. Shared placement/photo scope uses the non-null key `all`; color-specific scope uses its stable color ID. SQL checks enforce the nullable color/scope agreement, and unique keys prevent duplicate shared rows despite SQLite's nullable-unique semantics.

The migration includes custom `CHECK` constraints for workflow states, dates, quantities, prices, placement geometry, scope, and metadata. Prisma's schema does not express these checks: preserve them explicitly in future migrations that rebuild a table. Integration tests exercise the checked database, not a schema created with `db push`.

The schema also provides session-token/CSRF hashes, expiring idempotency records, and persistent rate-limit buckets for the authentication/order stages. Asset metadata holds a durable storage key and content hash; references prevent deletion of still-used assets. File upload/storage and report rendering are later stages. Cross-season/style association checks and minimum color/size/set requirements remain service responsibilities, as specified in the plan.

## ARM64 containers

The `migration` Docker target holds the CLI, schema, SQL migrations, and generated client; its default command is the migration entry point. The web target holds runtime dependencies and generated client, without CLI/test/lint tooling. Both run as UID/GID 10001 and are built from the same commit/base digest. Packaging must export the matching pair as one release and record both image identities. Stage 11 will wire the pair into Compose and the manual Mac-to-Pi release bundle.
