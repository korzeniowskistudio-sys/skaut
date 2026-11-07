# SKAUT handoff — 7 November 2026

Latest status: [live deployment on 7 November 2026](deployment-2026-11-07.md). SKAUT is live independently at https://skaut.korzeniowski.net/. Migrated 327 posts, 10 pages, 25 historical events and 332 documents; six source documents remain unavailable. The approved design is preserved and the original logo restored. Private SQL, live login/reservations/permissions and process-restart persistence are verified. Expelos was not modified. Treat older cloud-access blockers below as historical; use the current deployment report for operational paths and remaining work.

## User request and approved direction

Rebuild https://ksskaut.pl/ with modern, cinematic action-film energy while keeping the SKAUT identity. Preserve all verified existing public content and nested pages, replace decorative graphics, add a dedicated Aktualności section, and implement Mój SKAUT (progress, schedules, messages), event reservations and basket. Target: **skaut.korzeniowski.net** on IQHost.

Selected visual: third homepage concept, then the approved black-and-white photo revision. See [design/README.md](../design/README.md) for the complete generated visual archive and selected reference.

## What exists

- Local runnable Node 24 application with native SQLite; optimised assets, licensed fonts/icons and responsive Polish frontend.
- Homepage, club information route, event/training search, calendar, news archive/search/article, account registration/login, persistent member progress/schedules/messages/orders, basket and pending reservation checkout.
- Staff inbox/replies, event creation/editing/cancellation, achievement verification, news drafting/editing/scheduled publication/pinning/unpublishing, and reservation confirmation.
- Transactions enforce capacity and server-calculated prices; idempotency keys prevent duplicate checkout. Partial cancellations recalculate totals. Pending holds expire after 48 hours.
- Secure session cookies, password hashing, CSRF validation, explicit proxy trust, staff/member permissions and private data isolation.
- Database schema, safe first-staff-account CLI, SQLite online backup CLI, startup/deployment documentation and design QA.

## Verification completed

- `npm ci`: reproducible installation passed.
- `npm test`: 10 domain/API tests passed on the tree being saved.
- `python3 tests/browser.py`: member journey passed in Chromium, including filtering, basket, login, reservation/cancellation, messages, news and mobile navigation; no browser page errors.
- `node tests/staff-browser.mjs`: staff inbox, reply, event create/edit/cancel, news draft/edit/publish and public article passed in an isolated in-memory server; no browser page errors.
- SQLite online backup exercised against the isolated demo database; `PRAGMA integrity_check` returned `ok`.
- Fresh independent code review found staff workflow and accounting/proxy issues; fixes and regression checks are complete.

## Run locally

```sh
npm ci
npm test
DEMO_MODE=1 npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

The demo uses `data/demo.sqlite` and explicit sample-data notices. Production-data mode omits DEMO_MODE and defaults to `data/skaut.sqlite`. No databases, backups, session values or login credentials are saved in this repository. Persistent processes do not survive environment replacement.

## Historical cloud deployment blocker (superseded)

The paragraphs in this section record the earlier cloud-only state. Deployment was completed locally on 7 November; see the current report above.

The user supplied an `expelos-iqhost` skill inline after the initial skill search. Relevant instructions are preserved without passwords in [deployment.md](deployment.md). FTPS uses verified explicit TLS at host92093.iqhs.pl:21, with private config in ~/.config/iqhost/ftps.json or IQHOST_CONFIG; those were absent in this cloud machine. FTPS and DirectAdmin credentials are separate.

Last observed running environment remained on spec revision 1 with restricted network access, despite a saved draft containing required hosts. A real request to https://iqhost.pl/login returned proxy CONNECT 403, before authentication. Restarting Codex reattached the same original environment and did not apply the draft. Use a task created from the updated published environment, verify actual network policy, and retry before diagnosing credentials. Never bypass the proxy or weaken TLS.

Secret requirements named IQHOST_PANEL_USERNAME and IQHOST_PANEL_PASSWORD were declared in the environment draft, but values were not entered through the available tools. Never copy chat-provided passwords into this repository, scripts or handoff notes.

The runtime/install instructions and domain allowlist were saved in the environment configuration draft. Draft saving is not runtime application or publication. The draft is outside Git and must be reviewed/saved/published separately.

## Scope protections and remaining work

- Never deploy SKAUT into the existing Expelos application or its public roots. Preserve `/expelos-app`, `/domains/expelos.eu/public_html`, `/expelos-private`, email and cron. Use a separate SKAUT app/domain/database.
- Verify actual IQHost plan/application settings and production Node/database support, provision the subdomain and HTTPS through supported controls, then deploy and verify persistence and live behavior.
- Source-site crawling, full nested-page/document inventory, content import and redirects are still pending network access. No migration completeness claim is justified.
- Online payments, outbound email and account recovery remain unconfigured. Current flow is explicitly pending/manual staff confirmation, not an automatic payment system.
- Obtain the original logo master and verified club contact/legal, eligibility, retention and cancellation details before public launch.
- Original user credentials are not saved to Git and must be supplied through a secure connection mechanism.

## GitHub

Repository: `korzeniowskistudio-sys/skaut`. The remote was empty before this save. Read access works through platform Git authentication; do not infer missing access merely because GH_TOKEN/GITHUB_TOKEN variables are absent. The user's explicit request authorises committing and pushing all project progress. No credentials or private runtime data are included.
