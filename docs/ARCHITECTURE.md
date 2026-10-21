# Architecture and security

## Trust boundaries

The browser uses Firebase Authentication only. All application data goes through `/api/data` or `/api/upload`, using a Firebase ID token in the Authorization header. The server verifies signature/project, expiry, revocation and the current SkillSpring account state. Client-supplied actor IDs, roles, status, timestamps and aggregates are not accepted as authority.

Firestore's existing deny-all client rules remain unchanged. Admin SDK credentials bypass those rules, so the trusted API is the application authorization boundary. Application suspension is checked on requests, and exchange mutations re-read account state within their transaction. Roles are private database records, not user-editable profile fields or client custom claims.

The dedicated server identity has `roles/datastore.user` and `roles/firebaseauth.viewer`, not project owner/editor or authentication writer. **Firestore IAM is database-scoped, not collection-scoped**: the dedicated key can technically access the shared database. Application code constrains all references to the SkillSpring namespace. For stronger infrastructure isolation, move to a separate Firebase project with explicit authorization; do not claim that path conventions are an IAM security boundary.

## Data model

All application collections live under `skillspring/main/`:

- `accounts/{uid}`: private email, membership state and role (`member`, `admin`, `owner`). Roles and suspension are trusted only.
- `people/{uid}`: validated profile, embedded bounded offered/wanted skill arrays (15 each), privacy preferences, search tokens and derived rating statistics. Public responses redact exact availability, accessibility notes, private location and hidden history.
- `handles/{username}`: unique generated public username → UID mapping.
- `skills/{normalized-name-hash}`: approved, pending, rejected or merged taxonomy entry. `settings/public` contains categories, supported languages, session suggestions, branding, FAQ, guideline text and optional reviewed policy links.
- `exchanges/{id}`: participants, request terms, arrangement, status, duplicate-lock ID, completion votes and bounded shared notes/resources. A request and its workspace share an identity; no disconnected shadow workspace.
- `exchanges/{id}/messages/{messageId}`: one message per document. Author and time are server-derived. Participant-only history; reporting references the exact message and exchange. Messages are never one growing array.
- `exchanges/{id}/sessions/{sessionId}`: proposed/confirmed/past/cancelled sessions. Stores UTC milliseconds, source IANA time zone, length, link/location and notes.
- `agenda/{sessionId}`: confirmed upcoming-session projection with participant IDs. Atomic writes keep it aligned with the session; cancellation removes it.
- `requestLocks/{hash}`: transactionally prevents duplicate active requests in either reciprocal direction.
- `reviews/{exchangeId}_{reviewerUid}`: exactly one eligible review per participant; only completed exchanges. Rating, target and author are validated/server-derived.
- `notifications/{id}`: private recipient, title, application link, read flag and server creation time.
- `saved/{uid-target-skill-hash}`: private bookmarks. Mutations verify ownership.
- `blocks/{pairHash}`: symmetric contact restriction with independent blocker UIDs. Unblocking removes only the caller's blocker entry.
- `reports/{id}`: private submission and documented moderation status/rationale. Evidence access and moderation changes are audited.
- `audit/{id}`: append-only trusted administrative activity. No client API can edit audit records.
- `limits/{hash}`: transactional per-user/per-action minute bucket; stale entries removed by maintenance.
- `deletions/{uid}`: resumable data-erasure job. `assetCleanup` stores failed old-avatar deletion tasks.

Main query indexes are declared in the repository. The guarded deployment helper **only creates missing indexes** and never deletes an existing project's indexes or replaces rules. Queries paginate or enforce explicit bounds; there is no unrestricted browser collection dump.

## Exchange state machine

- Sender: draft → pending, or draft/pending/discussion → withdrawn.
- Either participant: pending → discussion.
- Recipient only: pending/discussion → accepted or declined.
- Accepted work: accepting a proposed session moves the exchange to scheduled; completing an elapsed confirmed session moves it to in progress.
- Either participant: accepted/scheduled/in-progress → cancelled. Pending sessions and agenda entries close atomically.
- Completion: at least one completed session, no outstanding proposed/confirmed sessions, and one explicit vote from **each** participant. Only then is the exchange completed and reviews enabled.
- A closed exchange releases the duplicate lock. A previous review never permits a duplicate review.

The sender cannot self-accept. A proposer cannot self-confirm their time. Sessions cannot be marked completed before their end time. A request is not accepted merely because a message is sent.

## Time zones

Luxon converts `datetime-local` plus an explicit IANA zone into UTC. Nonexistent spring-forward times and repeated fall-back times are rejected rather than silently assigned to the wrong offset. Browser controls preserve supported IANA aliases (including Asia/Kolkata). Display uses the viewer's saved zone. A shared day in matching is only a compatibility hint, never proof that actual availability overlaps.

## Matching and search

The ranking is a visible defined point system, not a success probability. Weights live in `src/lib/matching.ts`: teach/learn overlap 30 each, target level and shared language 10 each, compatible format/common day/goal overlap/experience 5 each. Reciprocal matches require both skill directions. Partial one-way opportunities remain valid.

Firestore token-prefix queries bound the candidate pool to 48 records. Combined filters, name/rating sorting and ranking run over that bounded page. The UI labels scope and supports continuation. This is a functional baseline, not global fuzzy full-text search or an unbounded similarity engine.

## Privacy and abuse controls

- Email verification gates requests, messaging, custom-skill proposals and photo uploads.
- Same-origin checks apply to state-changing web requests; bearer authorization, rather than ambient cookies, prevents ordinary cross-site form forgery.
- Zod strict schemas reject privilege fields and invalid values. JSON reads have a streamed 64 KB ceiling, including chunked requests without Content-Length.
- Plain text is rendered through React escaping. User links require HTTPS and new windows use noopener/noreferrer. There is no arbitrary HTML renderer.
- Per-user sensitive-action limits are stored in Firestore transactions. Firebase handles sign-in throttling. Host-level public API abuse protection remains recommended for a broad launch; this is not a claim of bot-proof public access.
- Uploads require a verified account and a server-side Cloudinary credential. The API reads actual bytes, rejects unsupported/animated images, enforces 4 MB and 16-million-pixel ceilings, strips metadata, rotates and encodes a 512 px JPEG before a signed server upload. No unrestricted unsigned upload endpoint exists.
- Profile replacement commits its new reference before attempting to delete the previous user-owned asset. A failed old-asset deletion is queued; another user's Cloudinary path cannot be supplied for deletion.
- Account deletion removes public access immediately, erases author messages, removes private collections, anonymizes shared history and deletes the profile avatar. The shared Firebase identity is intentionally preserved. Interrupted cleanup can be retried by the owner; audit/moderation records remain for safety review.

## Optional services

No optional provider is required for the exchange journey. Firebase sends account verification/reset mail. There is no transactional-email provider, payment service, push delivery, search vendor, calendar sync or video hosting configured. The application does not promise scheduled background reminders without a worker.
