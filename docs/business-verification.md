# Business verification

Businesses request verification from Profile > Business verification. A complete business name, email, phone, address and description are required, plus 5-2000 characters of supporting registration details. This flow accepts text details and does not upload documents.

Submission atomically creates or replaces `businessVerificationRequests/{businessId}` with status `PENDING` and updates `users/{businessId}.verificationStatus` to `PENDING`. The private request stores a snapshot of contact and business information. Only the business and active admins can read it.

Admin dashboard > Business verification shows pending requests. Approve updates request/profile to `VERIFIED`; Reject updates them to `REJECTED` and requires a 5-500 character reason. Decisions record admin ID and server timestamp. Rejected businesses can correct their profile and resubmit. Duplicate pending requests and repeat decisions are blocked.

The badge uses the live user profile and appears only for `role == client` and `verificationStatus == VERIFIED`. It appears on public and own profiles, Home, My Gigs, Browse, saved gig cards, map gig cards and gig details. The legacy `isVerified` field is synchronized on admin decisions but does not independently grant a badge. Existing legacy verified businesses need a trusted status migration or this approval flow.

Deploy the updated `firestore.rules` before using this feature. They deny public account creation with a verification status, direct self-approval, isolated request/profile status changes, and non-admin decisions. Rules require both writes to commit together.

Service checks: `node --test tests/business-verification.test.cjs`.
Permission checks with Firebase emulator: `firebase emulators:exec --only firestore --project demo-gigzy-verification --config firebase.test.json "node --test tests/business-verification.rules.test.cjs tests/admin-dashboard.rules.test.cjs"`.
