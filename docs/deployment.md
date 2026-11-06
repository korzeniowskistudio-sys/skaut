# IQHost deployment — pending account evidence

Target requested by the user: `skaut.korzeniowski.net`. Provider: IQHost. The user supplied the **expelos-iqhost** skill inline later in the session. It identifies explicit verified FTPS at `host92093.iqhs.pl:21`, user `codex@host92093.iqhs.pl`, and private configuration at `~/.config/iqhost/ftps.json` or `IQHOST_CONFIG`. Presence-only checks confirmed that the file is absent and the variable unset in this cloud machine. The skill's `scripts/connection.py` and existing Expelos repository are not present here. No login was attempted without credentials.

The supplied skill also identifies Node 24 at `/opt/alt/alt-nodejs24/root/usr/bin/node` for the existing **Expelos** application. That verifies an existing application's documented runtime, not automatic provisioning for SKAUT. The Expelos app `/expelos-app`, public roots `/expelos-app/public` and `/domains/expelos.eu/public_html`, private state `/expelos-private`, mail and cron are OUT OF SCOPE: never upload SKAUT there or restart Expelos for this task.

The normal panel route is `https://iqhost.pl/login` → `https://iqhost.pl/services/15763` → “Otwórz panel”, ending at `https://host92093.iqhs.pl:2222/evo/`. Interactive account authentication belongs to the user. FTPS does not supply panel or shell credentials. The current cloud TCP access policy has no grants; authenticated FTPS also needs a supported network route. Proxy-injected HTTPS secret placeholders are not raw FTP passwords and must not be used as such.

## Provisioning sequence

1. Enable the intended IQHost account connection/skill and inspect its instructions. Discover the actual panel hostname, hosting plan, document-root/app settings, Node support, SQL engines and SSH/API capabilities read-only.
2. Determine whether this Node 24 application can run on the plan. A PHP-only shared plan cannot run it directly; choose supported Node hosting/VPS or explicitly adapt to the verified PHP/MySQL stack. SQLite is the current local SQL database, not a claim that an IQHost remote database has been created.
3. Inspect the current DNS zone and any existing `skaut` record before adding anything. Create `skaut.korzeniowski.net` as an additional site/application. Preserve existing parent-domain records and websites.
4. Set an A/AAAA or CNAME according to the actual application destination and provider guidance; never guess an IP. Provision and verify HTTPS.
5. Deploy application and public assets, install frozen dependencies with `npm ci`, select Node 24+, create a private database directory outside the web root, and set process environment below. A single Node process with SQLite is the supported local architecture; do not share a WAL-mode SQLite file over a network filesystem.
6. Create the first staff account through `scripts/admin.mjs` using securely supplied environment variables. No production default password exists.
7. Import only reviewed source content and authorised member data, replace reconstructed logo with original master, enter correct club contact/legal details and cancellation/payment terms, and connect transactional email/payment providers before claiming those integrations work.
8. Configure a supervised process, backups and restore procedure, then verify HTTPS, session cookies, login, staff permissions, a real authorised reservation and its cancellation, and production database persistence. Verify again after process restart.

## Production process environment

```text
NODE_ENV=production
DEMO_MODE=0
APP_ORIGIN=https://skaut.korzeniowski.net
HOST=127.0.0.1
PORT=<provider-assigned application port>
DATABASE_PATH=<private persistent directory>/skaut.sqlite
TRUSTED_PROXY_IPS=<exact verified proxy IPs, comma-separated; empty for direct access>
```

Secrets belong in host settings, not this file. HTTPS terminates at the provider's reverse proxy. Only configure proxy IPs that actually belong to the trusted edge; forwarded headers from other peers are ignored. Configure edge rate limits as appropriate for the hosting topology.

## Backup and restore

`DATABASE_PATH=<live path> npm run backup` uses SQLite's online backup API, not an unsafe copy of a live WAL file. Copy backups to an authorised encrypted external destination with a retention policy. For a restore test, stop the application, preserve the current database plus its WAL/SHM sidecars, restore the snapshot to a **new path**, run `PRAGMA integrity_check`, set `DATABASE_PATH` to the new file and restart. Never overwrite a live database. Verify login and reservation counts after restoration.

## Launch blockers

- IQHost account access, runtime compatibility, subdomain/DNS, HTTPS and remote production SQL are unverified and not provisioned.
- Source crawl, full nested-page/document inventory and redirects remain blocked by network access.
- Payment processor, outbound email and account recovery are not integrated.
- Club legal/contact data, membership/eligibility rules, data retention and cancellation terms need verified club input.
- Original uploaded logo master must replace its generated reconstruction.

The current application is a local working implementation, not a published production club service.
