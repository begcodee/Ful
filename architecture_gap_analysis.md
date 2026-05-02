# Updated Frontend + Backend Architecture Gap Analysis (actual runnable app in `workspace/`)

## Corrected scope
- **Frontend analyzed:** `workspace/frontend` (React + Vite).
- **Backend analyzed:** `workspace/backend` (Express).
- The previous assumption that frontend had only static assets was incorrect for this repo.

---

## Layer 1 — Identity (NIA Gate)

### What already exists
- Frontend Ghana Card flow exists: capture/upload, validation, and pending/manual review UX in `frontend/src/components/GhanaCardVerification.tsx`.
- Backend pre-screen simulation exists: `POST /api/verify/ghana-card` with Protocol A/B and structured `smartlandProtocols` reporting in `backend/src/routes/verify.js`.
- NIA officer queue + decision endpoints exist: `GET /api/nia/users` and `POST /api/nia/users/:id/decision` in `backend/src/routes/nia.js`.

### Gaps vs SSI/biometric-grade target
- No first-class identity enrollment domain model (sessions, artifacts, immutable audit trail, typed reviewer decisions).
- Biometric checks are still demo/prescreen heuristics, not a production-grade matching pipeline.
- No SSI issuance/presentation flow (DIDs, VCs, verifiable presentations).

### Security correction
- Passwords are not plaintext in this codebase; authentication uses `bcrypt` in `backend/src/routes/auth.js`.

---

## Layer 2 — Legal Asset (Lands Commission Gate)

### What already exists
- Parcel routes include verification/clearance concepts in `backend/src/routes/parcels.js`.
- Frontend mapping aligns parcel states via `frontend/src/lib/parcelMapper.ts`.
- Review flow logic exists across `frontend/src/components/RegistrationReview.tsx` and `backend/src/services/dashboardRules.js`.

### Gaps
- Documents are still mostly attached blob/JSON style; missing formal provenance subsystem with:
  - per-document hash,
  - signer/source,
  - reviewer identity,
  - timestamps and reason codes.
- Missing explicit per-document and per-parcel workflow states suitable for legal audit.
- Missing registry cross-check audit trail (what was checked, authoritative source, reviewer, outcome).

---

## Layer 3 — Communication & Audit (Secure Chat)

### What already exists
- Conversation/message APIs are present in `backend/src/routes/conversations.js` under `/api/conversations/*`.
- Rule logic already blocks chat when parcels are pending/flagged/disputed.

### Gaps
- No realtime websocket channel.
- No voice-note capture/storage pipeline.
- No STT transcription and transcript immutability policy.
- No append-only evidence vault linking negotiation artifacts to settlement/arbitration by cryptographic hashes.

---

## Layer 4 — Settlement (Chain + Payments)

### What already exists
- Payments flow exists in `backend/src/routes/payments.js`.
- Frontend has blocked-settlement/conflict UX in `frontend/src/pages/PaymentCallback.tsx`.
- Architecture already models “protocol gates” that can influence settlement decisions.

### Gaps
If target is **Polygon Amoy + SSI-anchored evidence**, still needed:
- explicit on-chain anchoring schema for evidence hashes (identity, docs, transcripts),
- signer/key custody abstraction and hardening,
- richer settlement state machine (escrow/conditional sale/arbitration hooks).

---

## Layer 5 — Governance & Dispute (Arbitrator)

### What already exists
- Arbitration APIs exist in `backend/src/routes/arbitration.js` (`/api/arbitration/*`).
- Arbitrator UI exists in `frontend/src/pages/ArbitratorDashboard.tsx` and `frontend/src/components/ArbitrationCaseManager.tsx`.

### Gaps
- No deterministic unified evidence cockpit composing:
  - identity enrollment + decisions,
  - asset/document provenance + commission review,
  - comms transcript hashes + negotiation metadata,
  - settlement/payment references.
- No tamper-evident append-only decision journal.

---

## Practical next steps (aligned to SSI + tamper-proof + blockchain goals)
1. **Identity:** add `identity_enrollments`, `identity_artifacts`, `identity_reviews`; persist protocol outputs/media hashes; add immutable event log.
2. **Assets:** normalize into `land_documents` + `asset_verifications` with per-doc digest and reviewer metadata.
3. **Comms:** add `voice_artifacts`, `transcripts`, and append-only evidence hashing (audio hash + transcript hash + correction deltas).
4. **Settlement:** anchor evidence hash bundles on-chain; implement explicit sale states and arbitration stop/continue hooks.
5. **Governance:** add deterministic case projection endpoint/view and strict evidence read controls.
