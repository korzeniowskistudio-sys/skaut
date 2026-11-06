# SKAUT design QA

Source visual truth: `design/archive/exec-4b54dbb5-1968-4e57-9362-363b9c7104c4.png` (user-approved revision of displayed concept 3).

Implementation: `design/validation/home-viewport.png`, `design/validation/home-desktop.png`, `design/validation/home-mobile.png`, `design/validation/member-desktop.png`.

Viewport: desktop 1487×1058 CSS pixels, deviceScaleFactor 1; mobile 390×844, deviceScaleFactor 1. Source is 1487×1058 raster pixels. Same light UI theme, public homepage, logged-out state. Demo news is illustrative and intentionally differs from the mockup's illustrative story; an explicit demo notice is added. Additional below-fold sections were requested in the broader website brief.

## Comparison evidence

- Full view: `design/validation/comparison-before.png` and `design/validation/comparison-final.png` put source and implementation together at the same density (source left, implementation right).
- Focus: `design/validation/finder-comparison.png` compares the same 565×725 training-finder region. Navigation, photo crop and news preview were also inspected in the full comparison.
- Real Chromium screenshots and functional checks were executed through Playwright because this environment exposes no connected browser UI tool. The site has not been opened in a user-facing cloud browser or deployed to a remote preview.

## Findings and fixes

- [P2, fixed] Initial display and navigation text too small; finder vertically centred rather than aligned to the top of the white panel. Adjusted type scale, navigation spacing, finder alignment and news layout.
- [P2, fixed] Increasing finder type caused the heading to wrap to three lines and expand the hero. Restored the two-line heading, prevented grid min-content expansion, and matched the source's 62/38 split and 726px hero height at the comparison viewport. Final evidence: `comparison-final.png`.
- [P3] The supplied photograph is recreated as a separate generated asset because the original attachment is not exposed as a local file. The crop and face placement are close but not pixel-identical. Use the original master before final publication if exact matching is required.
- [P3] The navigation emblem is a generated reconstruction; exact original logo master remains a production asset dependency.
- [P3] Native browser select/date controls, licensed font substitutions and readable navigation sizes differ slightly from the generated mockup. These preserve usable real controls and the approved hierarchy.

## Fidelity surfaces

- **Typography:** self-hosted Barlow Condensed display and Manrope text with Polish glyph subsets. Main hero, finder and news hierarchy retained; finder headline remains two lines at desktop and readable at mobile.
- **Spacing:** navy 104px desktop navigation; left photographic hero at 62%; right white finder at 38%; flat editorial news preview below. Mobile recomposes photo above the finder without horizontal overflow.
- **Colours:** navy/white/neutral-grey UI and monochrome imagery. No external tracking, decorative neon, glass panels or gradient typography. Only a neutral photographic scrim supports hero readability.
- **Images:** standalone WebP campaign assets, preserved monochrome grain and depth. Header logo remains navy/white/grey. Standard icons use the licensed Phosphor library.
- **Copy:** approved hero and finder copy retained in Polish. News, dates, prices and achievements are expressly labelled illustrative in demo mode; unverified club facts are not presented as migrated content.

## Interaction verification

Member browser check: desktop hero; discipline filter; basket; demo login; real SQL-backed pending reservation; cancellation; sending member message; news search and article; club route; 390px layout and mobile navigation. Zero browser page errors.

Staff browser check, separate in-memory database: staff login; read member message; reply; create/edit/cancel event; save/edit news draft; publish; article appears in public archive. Zero browser page errors.

API/domain checks: authenticated ownership, CSRF, password verification, trusted proxy handling, staff authorisation, authoritative prices, checkout idempotency, final-place capacity, atomic multi-event rollback, cancellation, expiry and news draft visibility.

## Remaining external launch dependencies

IQHost authentication and DirectAdmin subdomain/app setup, source-site migration, original logo, payment/email integration, account recovery and club legal/contact/eligibility details. These are not asserted complete by this design review.

final result: passed
