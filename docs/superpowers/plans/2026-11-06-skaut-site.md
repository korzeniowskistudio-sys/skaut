# SKAUT Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the approved Polish SKAUT site with SQL-backed member and reservation workflows, and prepare the requested subdomain deployment.

**Architecture:** A same-origin Node HTTP application serves accessible ES-module frontend and JSON API. SQLite provides transactions and persisted accounts, news, events, member progress, conversations and reservations; demo fixtures are opt-in and labelled. IQHost provisioning is an external dependency.

**Tech Stack:** Node 24, native SQLite, HTML/CSS/JavaScript, bundled fonts/icons, Node test runner, Playwright browser checks.

**Spec:** `docs/superpowers/specs/2026-11-06-skaut-site-design.md`

## Global Constraints

- Approved reference: exec-4b54dbb5-1968-4e57-9362-363b9c7104c4.png.
- Polish language, navy/white/grey identity and monochrome campaign imagery.
- No invented club facts; opt-in demo mode, no default production credentials.
- No production/deployment success claim without remote verification.

## Review Focus

- Concurrent requests for the final event place must not oversell.
- Changing a client price cannot change the order total.
- One member cannot read another member's bookings or messages.
- Replayed checkout cannot duplicate bookings or charges.
- Missing database/event/payment configuration must produce honest empty or pending states.

### Task 1: SQL domain and reservation correctness

Files: `server/store.mjs`, `server/schema.sql`, `tests/store.test.mjs`.
Interfaces: `createStore(path)`, `createMember`, `createEvent`, `checkout(memberId,eventIds,key)`, `cancelBooking`, `memberOverview`.
- [ ] Write and run failing domain tests for capacity, server totals, idempotency, cancellation and member isolation.
- [ ] Implement SQL constraints and transactional operations.
- [ ] Run `node --test tests/store.test.mjs` and verify all assertions pass.

### Task 2: Authentication and API

Files: `server/app.mjs`, `server/security.mjs`, `server/seed.mjs`, `tests/api.test.mjs`.
Interfaces: `createApp({store, demoMode, publicDir})` returns an HTTP server; JSON API under `/api` uses sessions and CSRF validation.
- [ ] Write and run failing integration tests for login, access restrictions, CSRF, checkout and private-data isolation.
- [ ] Implement password hashing, expiring sessions, rate limits, validated inputs, staff endpoints and opt-in demonstration fixtures.
- [ ] Run the complete Node test suite.

### Task 3: Approved responsive public site and member workflows

Files: `public/index.html`, `public/styles.css`, `public/app.js`, `public/ui.js`, `public/assets/*`, `tests/browser.py`.
- [ ] Implement public navigation, training finder, news archive/article, event basket, authentication, member panel and staff forms.
- [ ] Use original/derived campaign images as individual assets; bundle licensed fonts and icons.
- [ ] Verify desktop/mobile screenshots and meaningful booking, login, search, panel and keyboard interactions in Chromium.

### Task 4: Deployment and handoff

Files: `README.md`, `.env.example`, `scripts/admin.mjs`, `scripts/backup.mjs`, `docs/deployment.md`, `design-qa.md`.
- [ ] Document exact local startup, database backup/restore, first staff account and production configuration.
- [ ] Create target-domain deployment checklist without inventing DNS destination or IQHost capability.
- [ ] Run full tests and final review; fix important findings.
- [ ] If authorised IQHost access becomes available, inspect plan, provision subdomain/database using supported controls, deploy and verify HTTPS. Otherwise record exact external blocker.
