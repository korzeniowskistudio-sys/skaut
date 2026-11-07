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

The source calendar currently offers no future events. Historical events remain archival and cannot be booked. No capacity, upcoming dates or prices were invented. Decorative graphics were replaced with the approved campaign images; historical gallery photographs remain linked to their original source.

Static archive copies preserve full text, links, tables and local document downloads without copying WordPress scripts, forms, tracking or theme code. Static copies are explicitly dated historical records; editing an Aktualności article does not rewrite its immutable source archive. Source posts are imported idempotently and later staff changes are retained.

Six source documents returned 404 and were not fabricated: `190915-PP2.pdf`, `Karabin.pdf`, `Trap.pdf`, `Handgun.pdf`, `Mini-Rifle.pdf`, `Shotgun.pdf`. Their original links and failure evidence remain in `content/source-manifest.json`. External third-party documents retain their original URLs.

Legacy path and ID-query redirects apply on **the new SKAUT domain**. The original ksskaut.pl server was not modified. `deployment/legacy-queries.htaccess` routes WordPress ID queries through the allowlisted application redirect map before LiteSpeed can serve static index.html. Provider-managed Passenger configuration was preserved.

The 526 MB of document originals are published on IQHost and cached locally but excluded from normal Git clones. Restore exactly the recorded files with `python3 scripts/restore-documents.py`; each file must match its recorded SHA-256. To review a fresh source crawl, run `python3 scripts/fetch-source.py` then `python3 scripts/migrate-content.py`. Review changes before publishing a new snapshot.

## Verification and operations

- Fresh `npm ci`; 16 automated domain/API/deployment tests pass. Regressions cover migration idempotency, retained legacy values, immutable archive links, Unicode redirects and UTF-8 request chunks.
- Local member and staff browser journeys pass. The staff check uses a temporary in-memory store. Member checks use an isolated demo database, never production.
- Live acceptance verified owner staff login, two independent member accounts, authorisation/isolation, CSRF, authoritative pricing, checkout idempotency, final-place capacity, cancellation and message persistence. The temporary event was cancelled. Two clearly labelled QA members and one cancelled QA event/order/booking remain as acceptance records; none represent a real club reservation.
- A real Passenger process restart produced a different PID, `PRAGMA integrity_check=ok`, and retained 3 members (owner plus two QA accounts), 1 cancelled test event/order/booking, 1 test message, 0 achievements and 327 news articles. Fresh logins and full member/news comparisons passed after restart.
- All 1,830 live URL checks passed: 362 migrated content records, 332 document downloads with expected sizes, and 1,136 path/query/document redirects. Live 390px mobile layout, navigation, archive links and desktop composition passed with no browser page errors. Verification summaries and the guest homepage screenshot are saved in `docs/verification/2026-11-07/`.
- The original owner account was provisioned using a hash-only file in the SKAUT private directory; the file was consumed. The random login password is saved only in the owner's private local `~/.config/iqhost/skaut/owner-login.json`.
- Each production startup creates a consistent SQLite online snapshot once per UTC date in the SKAUT private backups directory. An initial snapshot was downloaded outside Git and opened independently; integrity and 327 source-news records passed. Manual online backup remains available with `npm run backup`.
- Restart SKAUT only by updating `/skaut-app/tmp/restart.txt` (documented Passenger mechanism) or selecting its own entry in the Node selector. Never run the Expelos restart command for this site.
- Publication used explicit SKAUT file allowlists, asset-first ordering, temporary uploads, byte verification and private backups of changed remote code. No directory mirroring or deletion was used.

## Remaining work before normal club operations

The club must publish actual bookable events/capacity/prices and approve the new service's current membership, cancellation, eligibility and data-retention terms. Migrated historical legal text is a source record, not approval of the new account service's terms. Online payments, transactional email and account recovery are not integrated. Recurring offsite backups/retention are not configured; startup snapshots are not a scheduled offsite backup. No changes were made to existing hosting cron entries.
