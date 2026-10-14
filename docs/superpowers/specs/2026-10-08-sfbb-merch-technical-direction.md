# SFBB Merchandise Ordering — Approved Technical Direction

## Purpose

Build a self-hosted web application for San Francisco Brass Band members to
order season-specific merchandise. The first release centers on t-shirts while
keeping the catalog flexible enough for other merchandise later.

## Constraints and decisions

- Host at `sfbb.holtzman.io` on a Raspberry Pi behind a Cloudflare Tunnel and
  Caddy.
- Use no paid or externally required services.
- Do not require member accounts or payment processing.
- Gate the storefront with one shared member Basic Auth credential and the
  admin area with a separate shared admin Basic Auth credential.
- Do not collect an email address or send order confirmations in the first
  release. Checkout displays a secure order code instead.
- Members can look up, edit, restore, or cancel their orders only while the
  season's ordering window is open.
- Administrators can search by order code or member name.

## Selected architecture

Use a single Dockerized **Next.js + TypeScript** application with **SQLite**
and **Prisma**.

The application owns the public storefront, cart and checkout, admin console,
merchandise preview rendering, CSV exports, and database. Docker volumes hold
the SQLite database, uploaded product/design images, and generated preview
assets; those volumes are backed up from the Raspberry Pi. Caddy terminates
HTTPS and applies the two Basic Auth gates, while the Cloudflare Tunnel safely
exposes the site.

## Why this approach

This keeps operation and backup simple for a small seasonal workflow while
keeping all code in one maintainable TypeScript project. SQLite avoids running
and maintaining a separate database service, and the catalog/data model can
later support other merchandise without replacing the core system.

## Alternatives considered

1. Next.js with PostgreSQL: adds database capacity not justified by the scale,
   plus another service and backup process.
2. Django with SQLite: viable, but the custom cart, checkout, and product
   preview would still require substantial bespoke work.

