# SKAUT deployment — 7 November 2026

Live website: https://skaut.korzeniowski.net/. This is an independent SKAUT application on IQHost. The approved monochrome third layout, typography, photographs, finder, member area and basket were preserved. The reconstructed emblem was replaced with the supplied original `logo_skaut/Przeróbki/logo z otokiem.png`, which includes the white shield needed on navy.

## Hosting and protected scope

- Explicit FTPS with verified TLS to the existing IQHost account. Private connection and owner login are outside Git in owner-only local configuration.
- Node 24.22.2, Production mode, Passenger app `/home/host92093/skaut-app`.
- Domain document root `/home/host92093/domains/skaut.korzeniowski.net/public_html`.
- Passenger accelerates static assets from AppRoot/public independently of Node. That path is a symlink to the domain document root, so both surfaces always serve the same verified release. The initial directory was preserved under the SKAUT app for rollback.
- SQL `/home/host92093/skaut-private/skaut.sqlite`; directory 0700, database/WAL/SHM 0600. No database or credential is stored in this repository.
- Environment: `NODE_ENV=production`, `APP_ORIGIN=https://skaut.korzeniowski.net`, `DATABASE_PATH=/home/host92093/skaut-private/skaut.sqlite`. No sample fixtures. Proxy trust remains empty rather than trusting unverified headers.
- Authoritative DNS points to the existing hosting address; public DNS resolves and HTTPS certificate validation succeeds. HTTP redirects to HTTPS. Session cookies are Secure, HttpOnly and SameSite=Lax.
- Expelos application, domain files, database, private state, mail and cron were not modified or restarted. No parent-domain DNS record was replaced.

## Content migration

The public WordPress REST APIs were read from ksskaut.pl. Source manifests retain IDs, source URLs and original dates.

| Content | Migrated |
|---|---:|
| Published posts, imported into Aktualności | 327 |
| Information/nested pages | 10 |
| Historical calendar events | 25 |
| Downloadable club documents | 332 |
| Category archives | 7 |
| Tag archives | 39 |

The source calendar currently offers no future events. Historical events remain archival and cannot be booked. No capacity, upcoming dates or prices were invented. Decorative graphics were replaced with the approved campaign images. A subsequent gallery update mirrors the source photographs locally, as described below.

Static archive copies preserve full text, links, tables and local document downloads without copying WordPress scripts, forms, tracking or theme code. Static copies are explicitly dated historical records; editing an Aktualności article does not rewrite its immutable source archive. Source posts are imported idempotently and later staff changes are retained.

Six source documents returned 404 and were not fabricated: `190915-PP2.pdf`, `Karabin.pdf`, `Trap.pdf`, `Handgun.pdf`, `Mini-Rifle.pdf`, `Shotgun.pdf`. Their original links and failure evidence remain in `content/source-manifest.json`. External third-party documents retain their original URLs.

Legacy path and ID-query redirects apply on **the new SKAUT domain**. The original ksskaut.pl server was not modified. `deployment/legacy-queries.htaccess` routes WordPress ID queries through the allowlisted application redirect map before LiteSpeed can serve static index.html. Provider-managed Passenger configuration was preserved.

The 526 MB of document originals are published on IQHost and cached locally but excluded from normal Git clones. Restore exactly the recorded files with `python3 scripts/restore-documents.py`; each file must match its recorded SHA-256. To review a fresh source crawl, run `python3 scripts/fetch-source.py` then `python3 scripts/migrate-content.py`. Review changes before publishing a new snapshot.

## Gallery, motion, photo delivery and mobile update

This follow-up release is published and verified on the SKAUT domain. All 6,724 gallery files match the final FTPS publication manifests and current local SHA-256 hashes. The publisher also verified shared assets, re-encoded images, main app/index/styles, archive/runtime and final 19-image campaign/frontend updates. Batch counts overlap between revisions and must not be added as a unique-file total. A final HTTPS check matched 70 live files byte for byte, including all 57 campaign derivatives and the current application code. Gallery, motion, seven-profile mobile and campaign acceptance passed live. Final campaign checks covered all 19 supplied images, 15 distinct news illustrations and four primary placements at 1440px/390px, with zero page errors.

- The gallery inventory contains 1,082 image records: all 975 WordPress image attachments and 107 photographs from a public Drive album linked in an original club post. There are 15 named albums with 420 image memberships and 926 distinct original SHA-256 hashes.
- All 1,082 original records passed SHA-256 verification. The per-record original files occupy 1,930,845,400 bytes (about 1.93 GB); repeated source assets retain their own source records. Originals remain unchanged. The wider archive includes posters and club graphics as well as event photographs.
- `public/gallery-manifest.json` supplies the gallery; `content/gallery-source-manifest.json` records source URLs, album order and original hashes. Binary originals and generated derivatives under `public/assets/gallery/` are excluded from Git. Restore with `python3 scripts/migrate-gallery.py --restore`, using a Python environment with Pillow installed. Original hashes must match the recorded source manifest; originals must not be replaced with resized files.
- `/galeria` uses progressive loading, album selection, year filtering for the complete archive and a modal viewer with keyboard, touch and focus handling. Matched archive image links point to local copies; the old gallery route redirects to `/galeria`. All media is served by SKAUT.
- Page motion adds bounded directional departures and arrivals for text, photographs and blocks while preserving the approved homepage composition and identity. Reduced-motion preferences suppress page movement. A header control opts into quiet synthesized slide, latch and spring sounds through Web Audio; the default is silent. There are no gunfire samples, downloaded audio or autoplaying slideshows.
- Photo delivery uses 180px navigation thumbnails, 360/720/1100px responsive wall images and 1800/2400px viewer images. Ordinary wall/viewer use must load derivatives; only the explicit original-image link downloads an original. The 1100px preview encoding changed from WebP quality 83 to 77 and the 2400px viewer encoding from 86 to 81; the 180/360/720/1800px responsive encodings are unchanged. Preview files total 100,998,050 bytes, down from 125,395,942 bytes: 24,397,892 bytes (19.5%) less on disk.
- `scripts/optimize-site-images.py` generates 11 local campaign/crest/icon derivatives and a source-hash manifest in `public/assets/optimized/`, without changing the source files. It requires Pillow. Optimized campaign photographs retain the approved composition; the original crest remains available.
- The mobile shell in `public/mobile.js` and `public/mobile.css` provides five bottom tabs—Start, Treningi, Kalendarz, Galeria, Konto—plus safe-area spacing, a compact sticky header, 44–52px touch targets and 16px form controls. `tests/mobile-browser.py` passed seven profiles locally and live, including 844px and 932px coarse-pointer landscape, while retaining the approved desktop layout.
- Final local checks pass: 8 Python tests, 17 Node tests, and member/staff journeys in real Chrome. Live gallery, motion and campaign checks passed with zero page errors. Native browser Back acceptance passed for both SPA and archive navigation with no residual animation poses; reduced-motion checks observed zero animation calls. The final live image-transfer results below supersede earlier local measurements.

Measured local file sizes, before final network acceptance:

| Asset | Previous source/file bytes | Optimized bytes | Reduction |
|---|---:|---:|---:|
| All 1100px gallery previews | 125,395,942 | 100,998,050 | 19.5% |
| Campaign hero, 1100px | 183,386 | 34,084 | 81.4% |
| Campaign hero, 720px | 183,386 | 17,760 | 90.3% |
| Crest, 144px derivative | 223,374 | 29,484 | 86.8% |
| Favicon, 64px derivative | — | 8,958 | — |

Final live browser-transfer acceptance including the album-cover rail:

| Profile | Corresponding original-image baseline bytes | Optimized image-body bytes | Reduction |
|---|---:|---:|---:|
| Desktop | 4,448,724 | 568,664 | 87.22% |
| Mobile | 2,216,740 | 409,912 | 81.51% |
| Retina | 2,216,740 | 624,868 | 71.81% |

Each comparison covers the same cover-rail/wall-and-opened-viewer phase. Optimized totals count unique actual image response-body bytes; the baseline counts each corresponding source-original ID once. HTML, fonts and metadata are excluded. Cover photographs change the selected baseline IDs compared with the earlier layout, so these final rail-inclusive results supersede the previous percentages. Lazy loading and native profiles can also select different IDs between runs. These are measured live image-phase byte savings, not whole-page or elapsed-time savings. The compressed gallery metadata response was 96,284 bytes separately. The earlier test-readiness correction involved no product failure.

The latest user request supplies 19 campaign PNGs to avoid repeating the same photographs. `scripts/import-campaign-images.py` generated and published 57 WebP derivatives at 360/720/1100px. `content/campaign-image-sources.json` is the sole required source/derivative metadata manifest; the frontend uses allowlisted paths and stable source-ID assignments directly. The manifest records 34,922,551 source bytes, 1,306,464 total derivative bytes and 813,098 bytes for the complete 1100px set, 97.67% less than the source PNGs. All 57 published derivative files matched their local bytes over HTTPS. All source SHA-256 hashes remain unchanged. Encoding is WebP quality 78/method 6 without cropping, retouching or upscaling, preserving aspect ratios and embedded ICC profiles. These totals are file-size measurements, not browser-transfer measurements. Regenerate with Pillow and `python3 scripts/import-campaign-images.py --source-dir /path/to/supplied-PNGs`; source PNGs remain untouched in the supplied directory.

Placements use all 19 supplied images: 01 for the homepage featured story, 06 for its CTA, 09 for the club page and 10 for the account/login page; the newest 15 source-news IDs map stably to distinct images 02/03/04/05/07/08/11/12/13/14/15/16/17/18/19. Older articles using known legacy placeholder images retain their text, body and links without a repeated campaign image. Staff-customized image URLs outside those known placeholders are respected. The approved homepage hero remains unique and unchanged. `tests/campaign-browser.py` passed live at 1440px and 390px, confirming all 19 supplied images, 15 unique news illustrations and the four primary placements with zero page errors.

The source-content limitation remains six pre-existing 404 document links listed above; no missing document was invented or silently substituted. Both the old gallery pretty path and `?page_id=5577` redirect with HTTP 301 to `/galeria`. The design detector reported zero findings; the intentional archive blockquote exception is unchanged.

### Album-navigation follow-up — verified live

The horizontal rail of 15 native album-cover buttons is published directly after the introduction and before collection tabs, replacing the primary dropdown. Each button presents a small 180/360px square WebP cover, title, year, count and selected pressed state. Swipe/scroll snapping supports touch use; selection opens the corresponding wall below and pushes the album query into browser history for sharing and Back navigation. The default 112-image album, secondary archive/year controls, viewer and original downloads remain available. Combined local/live cover-rail acceptance passes, including query/history/Back behavior, small-image delivery and album membership; three deliberate cover choices were visually audited.

### Calendar and Treningi examples — verified

The user explicitly authorized sample activities and a clearer calendar/training experience. `public/calendar.js` and `public/calendar.css` add month/week views, a selected-date agenda, activity icons and type filters. A shared set of ten frontend-only examples is shown in both Kalendarz and Treningi only when the complete published-events API result is empty. Treningi retains its type/date filtering and links each example to the corresponding calendar date. Any globally available real published event replaces the examples on both pages; a real list that becomes empty after filtering does not trigger examples.

Examples are labelled illustrative and non-bookable. They contain no prices or capacities, no usable cart/booking IDs and perform no SQL writes. Date keys use Europe/Warsaw. Homepage copy distinguishes missing real bookable dates from the illustrative calendar. Combined local/live calendar acceptance and nine training checks pass, including type/date links, sample guard and replacement by actual API events. The Node suite has 17 passing tests, including the sample guard; 8 Python tests pass. The final compact heading “Kalendarz.” and two-line sample context (“Przykładowy kalendarz” / “Terminy ilustracyjne · bez zapisów.”) expose the day strip in the first phone viewport without changing data behavior. At 320×760, the day strip bottom is 571.2px and agenda-heading bottom 690.7px, above the 692px bottom-navigation edge; day targets are 58px and checks show no overflow. The final calendar/app cache version is `20261107-final`. Its four-file publication was FTPS byte-verified; calendar JS/CSS and app/index match live bytes, and 11 current-code HTTPS comparisons also pass. All 11 final live calendar-browser outcomes passed with zero page errors after that cache update.

### Bolder top navigation — verified live

`public/navigation.js` and `public/navigation.css` preserve the original crest/header geometry, navy-white identity and native link labels while using stronger condensed uppercase type, flat active/hover blocks and Phosphor arrows. Desktop links fit at 1024px and 1440px. The compact panel uses large type, scrolling between the safe-area header and bottom tabs, and 44px-plus targets. Covered main/footer/demo content becomes inert temporarily; header controls and bottom tabs remain active. Escape returns focus to the toggle, prior inert state is restored on close/resize/dispose, and the speaker remains legible on white/hover/pressed surfaces.

`tests/navigation-browser.py` passed five local/live real-Chrome profiles (320px, 390px, 844px touch landscape, 1024px and 1440px) with exact accessible link names, keyboard/focus/Escape checks, selected state, unchanged header height, no utility/brand overlap and zero page errors or horizontal overflow. `tests/calendar-browser.py` and `tests/training-browser.py` passed live, along with the updated gallery rail, seven-profile mobile checks and motion checks. Full member/staff local journeys pass after the latest integration. Publication byte-verified nine component assets, two app/index files and the 410-file archive/content batch (409 regenerated archive pages plus the news source file). Archive source content and the six pre-existing missing-document links are unchanged; regenerated pages receive the current navigation header/CSS. No SQL/runtime changes or backend restart were needed for this stage. Implementation commit [`634534e`](https://github.com/korzeniowskistudio-sys/skaut/commit/634534e) was pushed to `codex/skaut-iqhost-deployment` after live verification.

## Verification and operations

- Fresh `npm ci`; the latest suite has 17 passing domain/API/deployment tests and 8 passing Python tests. Regressions cover migration idempotency, retained legacy values, immutable archive links, Unicode redirects, UTF-8 request chunks and guarded illustrative events.
- Local member and staff browser journeys pass. The staff check uses a temporary in-memory store. Member checks use an isolated demo database, never production.
- Live acceptance verified owner staff login, two independent member accounts, authorisation/isolation, CSRF, authoritative pricing, checkout idempotency, final-place capacity, cancellation and message persistence. The temporary event was cancelled. Two clearly labelled QA members and one cancelled QA event/order/booking remain as acceptance records; none represent a real club reservation.
- The final SKAUT-only Passenger restart at 01:10:04 UTC returned `PRAGMA integrity_check=ok` with unchanged counts: 3 members (owner plus two QA accounts), 1 cancelled test event, 1 order, 1 booking, 1 test message, 0 achievements and 327 news articles. The earlier persistence acceptance also verified a changed process PID, fresh logins and full member/news comparisons after restart. Expelos was not restarted.
- All 1,830 live URL checks passed: 362 migrated content records, 332 document downloads with expected sizes, and 1,136 path/query/document redirects. Live 390px mobile layout, navigation, archive links and desktop composition passed with no browser page errors. Verification summaries and the guest homepage screenshot are saved in `docs/verification/2026-11-07/`.
- The original owner account was provisioned using a hash-only file in the SKAUT private directory; the file was consumed. The random login password is saved only in the owner's private local `~/.config/iqhost/skaut/owner-login.json`.
- Each production startup creates a consistent SQLite online snapshot once per UTC date in the SKAUT private backups directory. An initial snapshot was downloaded outside Git and opened independently; integrity and 327 source-news records passed. Manual online backup remains available with `npm run backup`.
- Restart SKAUT only by updating `/skaut-app/tmp/restart.txt` (documented Passenger mechanism) or selecting its own entry in the Node selector. Never run the Expelos restart command for this site.
- Publication used explicit SKAUT file allowlists, asset-first ordering, temporary uploads, byte verification and private backups of changed remote code. No directory mirroring or deletion was used.

## Remaining work before normal club operations

The club must publish actual bookable events/capacity/prices and approve the new service's current membership, cancellation, eligibility and data-retention terms. Migrated historical legal text is a source record, not approval of the new account service's terms. Online payments, transactional email and account recovery are not integrated. Recurring offsite backups/retention are not configured; startup snapshots are not a scheduled offsite backup. No changes were made to existing hosting cron entries.
