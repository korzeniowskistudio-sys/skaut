# Resume verification — 7 November 2026

Recovered the existing GitHub `main` commit `e23e41d681dbccdbc1038422de44000c163a45ff` into the empty local checkout. Read README.md, docs/HANDOFF.md, docs/deployment.md and design-qa.md before installation. No application, design, dependency or lockfile changes were needed.

## Local checks

- Node v24.22.1.
- Initial `npm ci` failed because the default `/home/agent/.npm/_cacache` could not be created. `npm ci --cache /tmp/skaut-npm-cache` passed with the existing lockfile (3 packages).
- `npm test`: all 10 tests passed, including registration, CSRF, ownership, staff permissions, prices, capacity, rollback, idempotency and cancellation accounting.
- `python3 tests/browser.py`: passed desktop, training filtering, basket, demo login, SQL reservation/cancellation, messages, news and club pages, mobile layout and navigation. No page errors.
- `node tests/staff-browser.mjs`: passed staff login, inbox/reply, event creation/edit/cancellation and news draft/edit/publication. No page errors.
- Browser member checks used an isolated `/tmp/skaut-verification.sqlite` demo database. Staff checks used an in-memory database. No production account or reservation was created.
- After gracefully stopping and restarting the local demo process, counts remained unchanged: 2 members, 2 bookings, 2 messages, 2 orders. SQLite `PRAGMA integrity_check` returned `ok`; restarted homepage returned HTTP 200. This verifies local persistence only.
- Screenshots are generated under ignored `artifacts/`; the approved visual archive is unchanged.

## Actual external access and blockers

Unauthenticated HTTPS HEAD requests to `https://iqhost.pl/login` and `https://ksskaut.pl/` both failed at the environment proxy: `CONNECT tunnel failed, response 403`. Neither reached the destination login/site. No authentication was attempted.

The running environment reported current observations, enforced restricted policy, no custom allowed hosts, no configured secrets/runtime variables/outbound identities, and no TCP grants. The documented FTPS config file was absent and `IQHOST_CONFIG` unset. GitHub read access worked using existing platform Git authentication.

A network-only environment draft was saved successfully for `iqhost.pl`, `www.iqhost.pl`, `host92093.iqhs.pl`, `ksskaut.pl`, `www.ksskaut.pl` and `skaut.korzeniowski.net`. The configuration tool returned `requires_publish: true`: saving does not apply or publish it. No credential requirements or credential values were added. The draft needs review/save/publication through environment settings and a runtime with those settings before retrying access. FTPS still needs a supported TCP route and secure credentials; HTTPS access alone is insufficient.

No IQHost hosting capabilities, DNS destination, separate application, remote SQL database or HTTPS certificate could be verified or provisioned. No remote files, Expelos applications/databases/private state, email or cron were accessed or modified.

No old-site content was fetched or migrated; nested-page/document inventory and redirects remain pending. Existing illustrative fixtures remain labelled demo data. Original logo and verified club/legal information remain launch dependencies.

Payments, outbound email and account recovery remain unconfigured. Live login, reservations, member permissions, persistence and mobile layout cannot be claimed verified until deployment is possible.
