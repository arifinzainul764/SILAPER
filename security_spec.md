# Security Specification — SIMLAPPD Firestore Rules

## 1. Data Invariants
1. **Strict Ownership Isolation**: A `UserProfile` (`/users/{userId}`) and all nested `TravelReport` documents (`/users/{userId}/reports/{reportId}`) belong exclusively to the verified user whose `request.auth.uid == userId`.
2. **Parent Existence (Master Gate)**: A `TravelReport` cannot be created or updated unless its parent `/users/{userId}` document exists.
3. **Immutable Ownership & Creation Time**: `ownerId` and `createdAt` can never change after creation, and `createdAt` / `updatedAt` must equal `request.time`.
4. **Strict Photo Array Bounds**: `photos` is strictly bounded to at most 4 items (`size() <= 4`), with validated map keys and size limits.
5. **Terminal State Locking**: When a `TravelReport` has `status == 'final'`, content fields cannot be edited unless the owner explicitly transitions `status` back to `'draft'`.
6. **Verified Email Requirement**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing (Profile)**: Authenticated user `uidA` attempts to create `/users/uidB` with `uid: "uidB"`. -> `PERMISSION_DENIED`.
2. **UID Mismatch in Payload**: Authenticated user `uidA` attempts to create `/users/uidA` with `uid: "uidB"`. -> `PERMISSION_DENIED`.
3. **Unverified Email Bypass**: User `uidA` with `email_verified: false` attempts to write `/users/uidA`. -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: User `uidA` creates `/users/uidA/reports/rep1` including ghost field `isAdmin: true`. -> `PERMISSION_DENIED`.
5. **Orphaned Subcollection Write**: User `uidA` attempts to create `/users/uidA/reports/rep1` before `/users/uidA` exists. -> `PERMISSION_DENIED`.
6. **Cross-Tenant Report Read/List**: User `uidB` attempts `get` or `list` on `/users/uidA/reports`. -> `PERMISSION_DENIED`.
7. **ID Poisoning**: User `uidA` attempts to create `/users/uidA/reports/invalid$id!withSpaces` or 200-char ID. -> `PERMISSION_DENIED`.
8. **Array Overflow (>4 Photos)**: User `uidA` submits `photos` array with 5 elements. -> `PERMISSION_DENIED`.
9. **Value Poisoning in Photos**: User `uidA` submits `photos: [123]` instead of valid photo maps. -> `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: User `uidA` submits `createdAt` set to a past timestamp instead of `request.time`. -> `PERMISSION_DENIED`.
11. **Immutable Owner Mutation**: User `uidA` updates `/users/uidA/reports/rep1` trying to change `ownerId` to `uidB`. -> `PERMISSION_DENIED`.
12. **Finalized Report Silent Tampering**: User `uidA` attempts to modify `nomorSpt` while existing `status == 'final'` without reopening to `'draft'`. -> `PERMISSION_DENIED`.
