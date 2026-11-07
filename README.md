# SKAUT

Responsive Polish club website based on the user-selected monochrome photo + booking layout. Includes public news, event finder, basket, SQL-persisted member accounts, progress, schedule, messages and staff management.

**Live:** https://skaut.korzeniowski.net/ · [deployment and remaining operations work](docs/deployment-2026-11-07.md).

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
python3 tests/calendar-browser.py
python3 tests/training-browser.py
python3 tests/navigation-browser.py
```

Browser checks need Python Playwright and Chromium at `/usr/bin/chromium` (or set `CHROMIUM_PATH` to your local executable). The member browser check requires a running demo server on port 4173 and exercises training search → basket → login → reservation → cancellation, member messaging, news search/detail and mobile navigation. It modifies the dedicated demo account, never the production database. The staff check starts its own isolated in-memory server and exercises the staff inbox, event create/edit/cancel, and news draft/edit/publish workflows.

The calendar, training and navigation checks target the running local site (or `SKAUT_GALLERY_ORIGIN`). They verify illustrative events/real-event replacement, filter/date links, and keyboard/touch/header behavior. The latest local suite passes 17 Node and 8 Python tests; browser acceptance for the follow-up release is recorded below.

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

Migrated 327 published posts, 10 pages, 25 historical events and 332 club documents from ksskaut.pl. Six linked documents were already missing at source. Historical dates and source attribution are preserved; demo fixtures remain isolated from production. See `content/source-manifest.json`. Downloadable originals are excluded from normal Git clones: run `python3 scripts/restore-documents.py` to restore and hash-verify them.

The gallery contains 15 albums and 1,082 image records: all 975 WordPress images plus 107 photographs from a public Drive album linked by a source post. These records represent 926 distinct original SHA-256 hashes. Original files remain unchanged; retained originals occupy 1,930,845,400 bytes (about 1.93 GB). The complete archive also includes posters and other club graphics. Metadata lives in `public/gallery-manifest.json` and `content/gallery-source-manifest.json`; image binaries under `public/assets/gallery/` are ignored by Git. With **Pillow** installed in your Python environment, restore the recorded originals and regenerate derivatives with:

```sh
python3 scripts/migrate-gallery.py --restore
```

The gallery, motion and mobile release is published. Live gallery and motion acceptance passed in real Chrome with zero page errors. Transitions move text, photographs and content blocks; sound is silent by default and optionally synthesizes quiet slide, latch and spring mechanics through Web Audio without gunfire recordings or external audio. Reduced-motion preferences disable page movement. Photo delivery uses 180px thumbnails, responsive 360/720/1100px wall images and 1800/2400px viewer images; original downloads require the explicit original-image link. All 1,082 original hashes were checked. Re-encoding the 1100px previews reduced their combined size from 125,395,942 to 100,998,050 bytes (19.5%). Final live image-transfer checks including the album-cover rail measured 87.22% fewer bytes on desktop, 81.51% on mobile and 71.81% on Retina against corresponding source originals; these are image-phase measurements, not whole-page or elapsed-time savings.

The mobile shell in `public/mobile.js` and `public/mobile.css` adds five bottom tabs (Start, Treningi, Kalendarz, Galeria, Konto), a compact sticky header, safe-area spacing, 44–52px touch targets and 16px form controls. Seven mobile profiles passed locally and live, including 844px/932px coarse-pointer landscape. The approved desktop composition is preserved. The latest local suite passes 8 Python and 17 Node tests plus member/staff journeys in real Chrome. Native Back navigation through both SPA and archive pages retained no animation poses; reduced-motion checks observed no animation calls.

Campaign imagery is generated, not documentary evidence of actual staff/facilities. `public/assets/skaut-logo.png` is the original shield-with-white-outline artwork from the user's SKAUT identity archive. Barlow Condensed and Manrope font licences are included in assets; Phosphor Icons are MIT-licensed (`THIRD_PARTY.md`).

`python3 scripts/optimize-site-images.py` (Pillow required) regenerates 11 campaign/crest/icon derivatives under `public/assets/optimized/` and records source hashes in its manifest. Source campaign images and crest remain unchanged. See the deployment report for measured individual file sizes and outstanding release checks.

The release also publishes 57 responsive WebP derivatives (360/720/1100px) from 19 user-supplied campaign PNGs to reduce image repetition. `content/campaign-image-sources.json` records 34,922,551 source bytes and 1,306,464 derivative bytes in total. The 1100px set totals 813,098 bytes, 97.67% less than the source PNGs; this is a file-size comparison. Source hashes and embedded ICC profiles are preserved; there is no cropping, retouching or upscaling. Regenerate using Pillow and `python3 scripts/import-campaign-images.py --source-dir /path/to/supplied-PNGs`. Fifteen newest source-news IDs receive distinct, stable artwork; four dedicated images serve the homepage featured story/CTA, club and account pages. The approved homepage hero remains unique and unchanged. All 57 published files are byte-verified; live campaign checks confirmed all 19 images, 15 distinct news illustrations and four primary placements at 1440px/390px with zero page errors.

Fifteen named square album covers appear before collection tabs, with small WebP previews, swipe/scroll snapping, selected state and shareable album/Back history. Three cover choices received deliberate visual review. The controls preserve the default 112-image album, complete archive and original downloads. The rail is published and its combined live acceptance passes.

The calendar/training update adds month/week views, date agenda, activity icons/type filters and ten clearly labelled frontend-only examples in demo mode when the published events API is empty. Treningi shares those examples, with type/date filters and date-specific calendar links. Examples contain no prices/capacities or usable booking/cart IDs and cause no SQL writes. Any real published event replaces the samples globally, including when filters find no matches. Calendar date keys use Europe/Warsaw. Local and live calendar/training acceptance passes, including nine training checks and all 11 final live calendar outcomes with zero page errors. These examples do not create bookable club offers. The published compact heading/context keeps the day strip and agenda heading above the bottom navigation at 320×760, with 58px day targets.

The PL/EN homepage, Training and Calendar use a local snapshot of Zbrojownia's public schedule. The event archive and club shop expose original descriptions, photos, published options and prices, and informational pages on SKAUT routes. The snapshot contains public content only. It carries no accounts, orders, payment configuration or shared booking inventory. To refresh it, install `beautifulsoup4`, `lxml` and `Pillow` in a Python environment and run `python scripts/migrate-zbrojownia.py` from a fresh source cache. Review the report under `.local/zbrojownia/` and publish the generated files under `public/zbrojownia/` and `public/assets/zbrojownia/`.

The bolder top navigation in `public/navigation.js`/`public/navigation.css` retains the crest, colors and native link labels. Condensed uppercase links use clear white/navy active and focus blocks; the compact menu becomes a roomy, scrollable panel with 44px-plus targets. Covered page content becomes temporarily inert, Escape returns focus to the menu button, and native bottom tabs remain available. Five real-Chrome profiles passed locally and live at 320/390px, 844px touch landscape, 1024px and 1440px, without header movement or overflow. Implementation commit [`634534e`](https://github.com/korzeniowskistudio-sys/skaut/commit/634534e) was pushed to `codex/skaut-iqhost-deployment` after live verification.

## Deployment

Deployed independently on IQHost at **https://skaut.korzeniowski.net/** with Node 24, verified HTTPS and private SQLite persistence. See [the current deployment report](docs/deployment-2026-11-07.md) for protected paths, verification, rollback, backups and remaining payments/email/account-recovery/club-operations work.
