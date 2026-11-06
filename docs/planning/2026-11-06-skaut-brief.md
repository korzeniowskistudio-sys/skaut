# SKAUT redesign — working brief

Status: visual exploration, not an approved implementation specification.

## Confirmed requirements

- Redesign https://ksskaut.pl/ for a modern, entertaining Polish sport shooting club experience with the energy of an action-film trailer.
- Preserve all verified existing public content, including nested pages, archives and informative downloads; replace existing decorative graphics.
- Retain the identity of the supplied navy/white/grey SKAUT shield. Explore only conservative logo refinements.
- Use the user-approved cinematic photography direction developed in this conversation. Generated campaign photography must not be presented as documentary evidence of actual club personnel or facilities.
- Mój SKAUT: achievements/progress, training schedule, messages, event reservations and basket.
- Dedicated Aktualności section, added explicitly by the user on 2026-11-06.
- Target domain: skaut.korzeniowski.net. Hosting/DNS provider identified by user: iqhost.pl.
- SQL database required. Existing member/booking-system integration remains unanswered.
- User authorises visual concepts now, with verified content migration later.

## Aktualności requirements proposed for design

- Dedicated navigation destination and homepage preview.
- Searchable paginated archive; proposed categories: Aktualności klubu, Zawody i wyniki, Treningi, Relacje, Komunikaty.
- Article detail with title, summary, publication date, author attribution where available, body, related articles and relevant event link.
- Staff can save drafts, preview, publish, schedule, edit and pin announcements; retain revisions.
- Public articles remain distinct from private member messages.
- Preserve source URLs, dates, categories and article content during migration; maintain old-to-new redirect mapping.
- No fabricated live news, event dates, prices, achievements, statistics or membership counts. Mockups use clearly identified illustrative content.

## Technical decisions still to verify

- Actual IQHost plan, control-panel access, supported application runtime, database engines, SSH/deployment capability, cron/background jobs, transactional email and backups.
- Choose stack after inspecting account capabilities: a Node-capable plan can support a custom Node application; PHP hosting may favour Laravel with MySQL/MariaDB. Neither is a confirmed hosting capability.
- Payment provider, membership eligibility, cancellation/refund rules and authority for verifying achievements.
- Existing member database or booking system requiring import/integration.

## Current evidence and blockers

- Workspace checkout /workspace/skaut is available and had no product files at inspection.
- Full cloud skill catalogue and local skill locations were searched. No IQHost skill, connector, or hosting credential binding is exposed in this session.
- Read-only HTTPS requests to ksskaut.pl and iqhost.pl on 2026-11-06 returned proxy CONNECT 403. These are network access failures, not evidence about the websites themselves.
- No live-page screenshot audit or exhaustive content inventory has been performed.
- Source-site domains were saved in the environment draft earlier. Runtime enforcement has not been verified after applying that draft.
- No subdomain, remote database, application, payment integration or production deployment has been created.

## Next deliverables

1. Three independent homepage visual concepts using the supplied logo and photographic direction, with a dedicated Aktualności navigation item.
2. User selects a visual target before UI implementation.
3. Restore authorised source-site access, enumerate all public URLs and attachments, save a content manifest and map redirects.
4. Verify hosting capabilities and access; write the implementation specification and database/deployment plan against actual evidence.

## Visual concepts delivered, in displayed order

These are generated design references, not implemented pages. The user has not yet selected a target.

1. Cinematic Premiere — `../../design/archive/exec-70c93d11-f6f8-4c26-a2c0-49c5c0abb0b9.png`
2. Sport Editorial — `../../design/archive/exec-0eac1f52-3728-4e34-9623-2156c80e8987.png`
3. Your Next Session — `../../design/archive/exec-72114ecd-8886-4ce7-8828-f019fad8e80f.png`

All three include the original shield identity, Aktualności, member-panel access and basket. Sample news content is marked illustrative.

Network draft update: iqhost.pl and www.iqhost.pl added while preserving ksskaut.pl and www.ksskaut.pl and existing presets. Save succeeded with requires_publish=true; no runtime access or hosting access established by this save.
