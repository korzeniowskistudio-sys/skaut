# SKAUT

Responsive Polish club website based on the user-selected monochrome photo + booking layout. Includes public news, event finder, basket, SQL-persisted member accounts, progress, schedule, messages and staff management.

**Resume here:** [current handoff and deployment blockers](docs/HANDOFF.md). [Approved design and visual archive](design/README.md).

## Run

Requires **Node 24+** (native `node:sqlite`). No external database service is needed for the local version. Font and icon assets are already bundled.

```sh
npm ci
npm run dev
```

Default: port 4173, loopback only, `data/skaut.sqlite`, **no sample news or events**.

For a labelled demonstration with a separate database:

```sh
DEMO_MODE=1 npm run dev -- --host 0.0.0.0 --port 4173
```

Use “Otwórz konto demonstracyjne” on Mój SKAUT. Demo data is explicitly illustrative and not the club's actual offer. Demo mode is forbidden with `NODE_ENV=production`.

Environment settings can be loaded with `node --env-file=.env server/start.mjs`; copy `.env.example` without committing actual secrets. Process environment takes precedence.

## Checks

```sh
npm test
python3 tests/browser.py
node tests/staff-browser.mjs
```

Browser checks need Python Playwright and Chromium at `/usr/bin/chromium` (or set `CHROMIUM_PATH` to your local executable). The member browser check requires a running demo server on port 4173 and exercises training search → basket → login → reservation → cancellation, member messaging, news search/detail and mobile navigation. It modifies the dedicated demo account, never the production database. The staff check starts its own isolated in-memory server and exercises the staff inbox, event create/edit/cancel, and news draft/edit/publish workflows.

## First staff account

Supply `SKAUT_ADMIN_EMAIL`, `SKAUT_ADMIN_NAME`, and a password of at least 12 characters in the process environment, then `npm run admin`. Do not put the password in shell history or committed files. Use the same `DATABASE_PATH` as the server. No default staff credentials exist. Log in through Mój SKAUT, then enter `/admin`.

Staff can create/edit/cancel events; read and answer member conversations; create/edit/schedule/pin/publish/unpublish news; verify achievement progress; confirm pending reservations.

## Reservation semantics

- One basket item = one place for the signed-in account. Maximum 10 distinct events.
- SQL transactions enforce capacity; checkout keys prevent accidental repeat orders; totals come exclusively from server prices.
- Reservation starts as pending with a 48-hour hold. Staff confirmation is required. Expiration releases capacity.
- Members can cancel pending bookings. Confirmed bookings need staff contact.
- Cancelling an event cancels its reservations, adjusts order totals, and creates member messages. External payments/refunds require staff reconciliation; this application never claims to refund money automatically.
- Online payment integration is **not configured** and card data is never collected.
- Account registration does not itself establish official club membership. Club achievement markers are distinct from official qualifications.

## Data and assets

No content from ksskaut.pl has been migrated yet: source access returned proxy CONNECT 403. Old-site page inventory, document migration and redirects remain pending authorised access. Do not publish the illustrative demo as factual club content.

Campaign imagery is generated, not documentary evidence of actual staff/facilities. `public/assets/skaut-logo.png` is a generated reconstruction and must be replaced with the user's original logo master for exact brand fidelity before production. Barlow Condensed and Manrope font licences are included in assets; Phosphor Icons are MIT-licensed (`THIRD_PARTY.md`).

## Deployment

See [docs/deployment.md](docs/deployment.md). Target: **skaut.korzeniowski.net**, provider identified by user: **IQHost**. Remote access, DNS, TLS, production SQL, email and the provider's runtime capabilities have not been verified. No remote deployment has been performed.
