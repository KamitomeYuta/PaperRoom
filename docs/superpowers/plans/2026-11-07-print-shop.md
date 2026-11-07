# Print shop implementation plan

Use superpowers:executing-plans for native execution.

Goal: demonstrate checkout and inventory management in one browser session.
Architecture: Next.js client storefront and admin views call one Node route handler backed by SQLite transactions.
Stack: Next.js, React, TypeScript, node:sqlite.
Spec: ../specs/2026-11-07-print-shop-design.md

## Global constraints
Thai UI, THB prices, six artworks, A4/A3 variants, local persistence, session-scoped inventory and orders.

## Review focus
Duplicate submissions, insufficient stock on a later line, invalid quantities, separate sessions and browser refresh.

## Tasks
- [x] Test persistence, isolation, atomic checkout and stock edits in tests/shop.test.ts. Implement lib/shop.ts and app/api/shop/route.ts.
- [x] Build responsive catalog, artwork previews, cart, confirmation and inventory/order views in app. Supply six original locally rendered artworks.
- [x] Document setup and walkthrough. Run database tests, production build and browser checkout/admin smoke checks.
