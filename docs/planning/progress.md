# Execution ledger — docs/superpowers/plans/2026-11-06-skaut-site.md

User explicitly authorised continuing implementation after selecting and refining the third design. Proceed inline in the existing isolated cloud checkout; no additional worktree or repeated permission request.

Ruling: Native Node 24/SQLite implementation for current workspace because that runtime is verified. IQHost compatibility and remote SQL provisioning remain unverified; adapt deployment only after account evidence.

Pre-flight: store interfaces feed API; API routes feed frontend; tests will pin totals, ownership, capacity and replay behavior. Source migration is separately blocked by proxy CONNECT 403 and must not be presented as completed.

Task 1: complete — SQL transactional domain, five initial tests and later partial-cancellation regression.
Task 2: complete — sessions, password hashing, CSRF, ownership, news/events APIs and staff routes; ten domain/API tests pass.
Task 3: complete locally — responsive public site, member panel, basket, messages and staff CMS. Member Chromium journey and independent in-memory staff Chromium journey pass with no page errors.
Final fresh review: code_review agent found missing staff inbox, draft/event editing, stale partial-cancellation totals and proxy rate-limit handling. All were addressed in one fix pass, with regression tests and browser verification.
Test-harness correction: repeated member browser runs accumulated cancelled bookings and identical test messages; use expected count increments and unique message IDs so persistence does not create ambiguous selectors. No product assertions were removed.
Task 4: partially complete — deployment docs, secure first-staff CLI, SQLite online backup, visual QA and runtime instructions. IQHost config absent and DirectAdmin connection unavailable; no remote site/DNS/database changes performed.
User supplied expelos-iqhost instructions inline. The skill identifies host92093.iqhs.pl and existing Expelos Node 24 runtime. Do not modify Expelos production, private state, mail, cron or public roots. Presence-only check: ~/.config/iqhost/ftps.json absent; IQHOST_CONFIG unset; no secret bindings. Hosting authentication remains an external prerequisite.
GitHub read access to korzeniowskistudio-sys/skaut verified, remote advertises zero refs. No push performed or write access claimed.
