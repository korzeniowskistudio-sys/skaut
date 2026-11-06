# SKAUT approved design and implementation boundaries

The user selected displayed concept 3 and approved its revision using the supplied monochrome photograph, then instructed: “make subdomein and go on”. The selected visual is `../../../design/archive/exec-4b54dbb5-1968-4e57-9362-363b9c7104c4.png`.

Public site: Polish, navy shield identity, plain navy navigation, monochrome cinematic hero at approximately 62% width and white training finder at 38%, editorial Aktualności preview. Preserve the design on desktop and recompose photo above finder on mobile. Provide news archive/detail, training and event list, club information and member entry. Reduced-motion and keyboard operation required.

Member panel: authenticated account with progress, schedule/bookings, conversations and event basket. Persist all operational state in SQL. Staff can manage events, news and member achievements. Orders/reservations are transactional, capacity checked on server, prices derived on server, and external payment remains explicitly unconfigured until a provider is connected. Do not collect card details. Confirmed reservations require staff approval in this initial manual-payment workflow.

No verified source content has been imported; keep illustrative fixtures clearly labelled and isolate demonstration mode. Never publish generated facts as club facts. Credentials are never hardcoded. The application must not expose its database, config, source or uploaded untrusted HTML.

Approaches considered: custom application, WordPress plugins, hosted club service. Proceed with custom application under the user's instruction. Node 24 with built-in SQLite is confirmed locally; IQHost runtime support and final production SQL engine are unverified, so current choice is a local runnable implementation, not a claim of compatibility with the hosting plan. Remote DNS, HTTPS and database provisioning need the unavailable IQHost account connection.
