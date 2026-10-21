# Operations, deployment and troubleshooting

## Firebase setup

The authorized real project is `forum-d1133`. Email/password login was already enabled, the default Firestore database was in `nam5`, and client rules already denied all access. These settings were inspected before implementation.

1. Enable Email/Password in Firebase Authentication if using a new project. Do not replace the existing project without approval.
2. Copy only variable names from the environment example and configure the browser web-app fields.
3. Give a dedicated server identity `datastore.user` and `firebaseauth.viewer`. Locally use an ignored credential file. On a host, store `FIREBASE_SERVICE_ACCOUNT_JSON` as an encrypted runtime secret; do not upload the local key file.
4. Keep the deny-all rules. All application writes are behind the token-verified backend.
5. Provision the declared composite indexes. For the shared project use `CONFIRM_PROJECT=forum-d1133 node scripts/deploy-indexes.mjs`; it is additive and preserves unrelated indexes. Wait for READY status, then exercise real queries.
6. Run the guarded initializer only as the authorized operator. It creates catalog/settings only when absent and assigns the operator's SkillSpring owner role. It never sets a known production password or modifies another application's role records.
7. Add only the actual verified deployment domain to Firebase Auth's authorized domains. Preserve existing localhost and Firebase domains. Email action links use Firebase's supported action handler.

## Initial owner

The authorized Firebase CLI account `dhruv.bansal@softage.ai` was provisioned as SkillSpring owner. There was no existing user with that email in this Firebase project. A new user was created without a password and Firebase accepted the password-reset/setup request. The app requires email verification for administrative mutations, so the owner must set their password and verify their address. Do not impersonate the owner or mark their address verified for convenience.

## Cloudinary

The existing authorized account's server credentials are reused, without copying secrets into Git. No new image service or paid plan was introduced. Uploads are authenticated server-to-server binary uploads, not unrestricted public direct uploads. Normal use requires no custom unsigned preset. The 4 MB input cap fits under Vercel's 4.5 MB request limit; encoded output is a bounded 512 px JPEG. Real image upload and delivery were tested and the synthetic asset deleted.

## Hosting gate

A valid Vercel login is available after CLI token refresh. The existing team `dhruv-820e` is on **Hobby**. Before using that hosting plan, the operator must confirm SkillSpring is personal/non-commercial and eligible for the plan. Do not infer eligibility from prior authorization for another project, and do not upgrade or enable billing automatically.

No production URL is claimed until an actual deployed application passes hosted checks. GitHub source can be delivered independently of this gate.

## Deploy when authorized

Use a new project linked to `Alexwatson-de/SkillSpring`, not the existing RoomSync, Workpulse or STILLVEIN hosting projects.

- Framework: Next.js; root directory: repository root.
- Install: `npm ci`; build: `npm run build`; Node 22 or 24.
- Add the required environment-variable names listed in the root README to the host's protected settings. Remove emulator variables completely.
- `NEXT_PUBLIC_SITE_URL` must be the actual HTTPS URL. Public Firebase fields are build-time inputs; changing them requires a new build.
- Server-only values must never have `NEXT_PUBLIC_` or `VITE_` prefixes.
- Do not deploy `.env.local`, `.secrets`, emulator exports, browser traces or test data.
- Add the final domain to Firebase Auth's allowlist, retaining all existing domains.
- Verify public pages, actual signup/login, persisted onboarding, private exchange access, real signed image upload, and denial of non-admin operations on the deployed host.
- Run the controlled smoke script with `TEST_BASE_URL` set to the real deployment and explicit project confirmation. It removes only its uniquely named synthetic fixtures.
- Verify that old uploads remain accessible, and inspect hosting logs for server credential or index errors without printing secrets.

## Local review addresses

- Development with real Firebase/Cloudinary: `npm run dev`, port 3010.
- Optimized real-service build: `npm run build`, then `npx next start --port 3012`.
- Isolated emulator demo: `npm run local -- seed`, then `npm run local -- dev`, port 3011.

Do not run dev and production builds into the same Next output directory at once. Emulator builds use `.next-demo`, real builds use `.next`.

## Moderation policy and maintenance

Reports move through New → Under Review → Action Taken → Resolved. Moderators inspect only relevant evidence, record a rationale, and use proportionate actions. Review removal recalculates the rating aggregate. Owner-only role management cannot demote the owner or grant a new owner from the UI. Ownership transfer requires a trusted audited operator procedure.

The owner can run **Retry privacy cleanup & catalog maintenance** in Admin. This resumes queued erasure and normalizes merged skill aliases. For larger volumes, run the same server maintenance function from an approved worker. No automatic paid scheduler or background-delivery promise has been added.

Before general launch, publish the support channel, document appeal handling and jurisdiction-appropriate retention, and replace operational policy drafts with reviewed terms. Do not imply that automated moderation is implemented.

## Troubleshooting

- **Firebase server configuration missing:** check `FIREBASE_PROJECT_ID` and one server credential mechanism. A web API key is not an Admin credential.
- **Your session expired:** reauthenticate; compare frontend and backend project IDs; check revocation/state. Never fix this by weakening rules.
- **FAILED_PRECONDITION / missing index:** deploy the additive indexes, wait for READY, retry. Some indexes take several minutes to build even in an empty database.
- **No search results:** filters apply to a bounded indexed page. Clear filters or continue; private/incomplete/suspended/blocked profiles are excluded.
- **Account verification email:** check spam, use Resend, then “I've verified.” Setup-email request success does not prove inbox delivery.
- **Owner cannot enter Admin:** finish onboarding and verify email. The private SkillSpring account must have owner/admin role; client claims cannot grant it.
- **Java version error:** Firebase emulator tooling needs Java 21+. Set JAVA_HOME/PATH for the emulator process rather than changing other applications' Java installation.
- **3010/3011 in use:** inspect the process and stop only the SkillSpring process you started. Do not kill unrelated project servers.
- **Photo rejected:** use a real non-animated JPEG/PNG/WebP under 4 MB and 16 MP. Filename/MIME alone is not accepted as proof.
- **Vercel 403:** use the existing CLI's authenticated refresh flow (`vercel whoami`). Do not print or copy refresh tokens into logs.
- **Interrupted deletion:** public access remains removed and account state stays deleting; retry the scoped maintenance action. The shared Firebase identity is deliberately retained.

## Release checklist

- [ ] Confirm eligible hosting use; deploy and verify final URL.
- [ ] Operator completes password setup and email verification.
- [ ] Publish support contact and review policies/retention.
- [ ] Confirm all required indexes are READY.
- [ ] Run final full test suite, build, audit and hosted smoke.
- [ ] Preserve a verified secret-free Git commit and record deployment revision.
