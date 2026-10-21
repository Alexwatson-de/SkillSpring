# SkillSpring

**A little of what you know. A world of what you could.**

A TypeScript skill-exchange application with a complete persisted journey: register, onboard, discover a complementary member, exchange a request, talk privately, agree on sessions, complete the exchange together, and leave eligible feedback.

## Current delivery status

- Original cream/forest/sage design system, responsive layouts, restrained CSS perspective, Motion interactions, reduced-motion support, native keyboard-accessible dialogs, and visible focus states.
- Next.js 16 / React 19 / TypeScript. One trusted Node API, Firebase Authentication and Firestore. No parallel mock backend.
- **Real configured services verified:** Firebase project `forum-d1133`, a dedicated server identity, and the already-authorized Cloudinary account.
- **Executed:** 92 unit/API/rule/transport tests, 12 end-to-end browser journeys, four automated WCAG A/AA page scans, an optimized production build, TypeScript, ESLint, and a clean production dependency audit. A separate real-service smoke run passed 25 assertions and removed its synthetic accounts, profiles, exchange, reviews and uploaded image afterward.
- The initial SkillSpring owner is `dhruv.bansal@softage.ai`. A new identity was created without a default password; Firebase accepted the password-setup email request. Inbox delivery has not been observed. Set a password, sign in, verify the email when prompted, and complete onboarding. The role is stored only in SkillSpring's private account record.
- No billing was enabled and no hosting plan was upgraded.
- **Hosting is not yet deployed.** The existing Vercel session was successfully refreshed; its workspace uses Hobby. Confirm that this application is personal/non-commercial before deploying there. Do not treat localhost or emulator URLs as production deployment.

See [implementation log](IMPLEMENTATION.md), [architecture and security](docs/ARCHITECTURE.md), and [operations](docs/OPERATIONS.md).

## Run with configured real services

Requirements: Node.js 22 or 24 and npm. Java 21 is needed only for Firebase emulators.

```sh
npm ci
cp .env.example .env.local
# Configure public Firebase variables and protected server credentials.
npm run dev
```

The default local address is `http://localhost:3010`. The working directory must be the SkillSpring repository. Do not reuse a privileged identity from another application. The server needs the same Firebase project as the browser.

Required environment variable **names**:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` **or** `GOOGLE_APPLICATION_CREDENTIALS`
- `NEXT_PUBLIC_SITE_URL`

Optional image configuration, server-only:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The Firebase browser API key identifies the project; it does **not** grant database access. Service-account keys and Cloudinary secrets must never be browser variables or Git files. All local secrets and credential files are ignored. Hosting exclusions also exclude tests, emulator caches and local credentials.

## Isolated demonstration environment

This uses real Firebase emulators and persisted emulator records, not localStorage as a database. It refuses to seed a real project.

```sh
# Terminal 1, with Java 21 on PATH
npm run emulators

# Terminal 2
npm run local -- seed
npm run local -- dev
```

Demo address: `http://localhost:3011`. Demo login: `demo-alex@example.test` (owner) or `demo-jamie@example.test` (member). Emulator-only password: `Demo-Only-SkillSpring-29`. These credentials never exist in the real project. Demo users are explicitly labelled; demonstration stories on the landing page are illustrative, not real testimonials.

Local mode overrides the project, Auth endpoint, Firestore endpoint and image credentials. It uses a separate `.next-demo` build directory so browser configuration cannot leak between real and emulator builds.

## Main routes

- `/`: public landing, categories, real recently updated members, workflow explanation, illustrative exchange and FAQ.
- `/signup`, `/login`, `/reset-password`: email/password Auth, verification and reset emails, persistent sessions.
- `/onboarding`: five saved steps; `/profile/edit`: the same editable personal/professional/skill/preferences form.
- `/people/{username}`: unique profile, skills, portfolio, real reviews, private-history controls, save/share/report/block actions.
- `/discover`: token-prefix search, skill/category/name/description matching, combined filters, query-string URLs and pagination.
- `/matches`: best/learning/teaching/reciprocal candidates with defined points and readable explanations.
- `/exchanges`, `/exchanges/{id}`: request lifecycle, conversation, scheduling, shared notes/resources, completion and reviews.
- `/messages`, `/sessions`, `/saved`, `/notifications`: personal collections and actionable updates.
- `/dashboard`: data-derived recent activity, pending decisions, active exchanges, next sessions, profile progress and recommendations.
- `/settings`: privacy/preferences navigation, password reset, blocking and account erasure.
- `/admin`: private account roles, suspensions, taxonomy, custom-skill moderation/merging, reports, evidence, review moderation, branding, settings and audit history.

## Testing

```sh
npm run typecheck
npm run lint
npm run test                  # unit tests; emulator suites explicitly skip without emulator config
npm run local -- test         # full unit + API + rules suite; start emulators first
npm run local -- seed         # ensure browser fixtures exist
npm run test:e2e              # full journeys and automated accessibility checks
npm run build
npm audit --omit=dev
```

Browser tests exercise actual screens with two independent browser contexts. Session time is advanced **only in a named synthetic emulator fixture** so completion can be tested without waiting. Direct client Firestore reads/writes are tested as anonymous, member and forged-admin identities. The backend separately verifies authorized reads and writes against the same emulator.

For an optimized emulator-backed browser run, stop the development process on 3011, then run `npm run local -- build` and `npm run local -- start`; Playwright reuses that server.

The controlled live test is `scripts/live-smoke.ts`, guarded by `CONFIRM_PROJECT`. It uses the authorized Firebase CLI operator only for synthetic-auth verification/cleanup; the running app uses its own limited server identity. It must not be used against an unapproved project or with someone else's credentials.

## Deliberate boundaries and launch checklist

1. **Shared Firebase Auth:** SkillSpring suspensions and roles do not change other applications. Account deletion removes/anonymizes SkillSpring records but preserves the shared authentication identity. Firebase password changes necessarily affect that shared sign-in.
2. **Baseline search, not a search engine:** indexed prefix search selects at most 48 candidates per page; extra filters and sorting apply to that page. Counts explicitly describe the displayed page, not a fabricated global count. Match ranking is among retrieved candidates, not a guarantee of a global best match. Add an optional dedicated search service only if needed and approved.
3. **Bounded summaries:** dashboard exchange counts cover 30 recent records and next-session cards cover 12 entries; workspaces show the latest 50 sessions and initially 50 messages. Messages and main collections have continuation controls. Full historical session pagination is a future extension.
4. **Messaging polls while the page is active:** conversations refresh every 12 seconds; subscriptions/timers are cancelled on unmount. There are no push notifications, offline background reminders, calendar sync, payment processing or built-in video calls. Meeting links work without those integrations.
5. **Legal/operator setup:** publish the intended support email in Admin, review terms/privacy/guidelines and retention requirements for the target jurisdiction, and confirm hosting-plan eligibility before a general public launch. The built-in legal pages are clearly marked operational drafts, not legal advice.
6. **Privacy maintenance:** small erasures run immediately. Interrupted work remains in a resumable queue. The owner can retry privacy/catalog maintenance from Admin; run an approved scheduled worker at higher scale. No paid cron service is enabled.
7. **No fake reputation:** ratings require a completed exchange and one review per reviewer. Demonstration data is emulator-only unless an operator explicitly chooses otherwise.
8. The automated accessibility scans cover four representative pages; they are useful checks, **not** a claim of a comprehensive manual accessibility certification.

## Repository structure

- `src/app`: Next.js routes, styles and protected API handlers.
- `src/components`: reusable interface, complete screens and session/data lifecycle.
- `src/lib`: shared validation, public types and transparent matching.
- `src/server`: verified identities, query authorization, transactions and maintenance.
- `tests`: unit, emulator API/rules, browser journeys and accessibility checks.
- `scripts`: guarded local/demo and operator utilities.
- `docs`: security, setup, deployment and operational limitations.
- `artifacts/web`: inspected interface screenshots, not substitute data or tests.
