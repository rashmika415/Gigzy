# Admin login

Use the normal sign-in screen with the administrator's Firebase email and password. The live Firestore user profile determines navigation: active accounts with `users/{uid}.role == "admin"` go to the admin dashboard; youth and business accounts go to the regular app. Suspended accounts cannot enter the admin dashboard.

## Create the first administrator

1. Create an email/password account in Firebase Console → Authentication → Users (or register a regular account in the app).
2. Copy the account's UID. In Firestore, create or edit `users/{uid}` with `uid`, `email`, `fullName`, `role: "admin"` and `suspended: false`.
3. Sign in using that account's email and password on the normal sign-in screen.

Use the Firebase Console for this trusted setup. Public registration only creates youth or business accounts, and ordinary users cannot change their role through Firestore rules. No admin credentials are stored in source code.

The protected dashboard has Overview, Users and Gigs panels, server aggregate counts, and user/gig lists loaded in pages of 25. Search and filters apply to loaded records; Load more extends the search. Refresh fetches current data. Wide screens use a sidebar and smaller screens use tabs.

Admins can suspend and reinstate youth/business accounts. Suspension requires a 5–500 character reason. The service and rules prevent suspending administrator accounts or changing roles through these actions. Gig removal closes a gig, records a reason, administrator UID and server timestamps, and blocks the business from reopening or deleting it. The gig and its applications remain stored for history. Removed gigs are excluded from discovery and their detail screen shows an unavailable message.

Direct navigation checks the live profile; role removal or suspension revokes access to the screen. Suspended admins cannot use the `isAdmin` rule permission. Statistics use an admin permission to count the applications collection. Reports and report-resolution workflows remain a separate moderation feature.

Firebase compiled and deployed the dashboard rules to `local-workers-74bdd` on 12 October 2026. Admin authentication, user/gig pages and all three collection totals were verified with the provisioned admin account against the live project using read-only API calls. TypeScript, lint and web export passed. The unit suite passed 84 tests with seven emulator-dependent tests skipped. Tests cover pagination, reason validation, suspension restrictions, removal writes and discovery exclusion. Run `npm run test:rules:admin` to test permissions with the Firestore emulator. The emulator download was unavailable in this session, so these permission behavior tests remain unverified. Interactive device testing remains necessary.

The Applications panel provides a paginated view of applications across the platform, including gig, applicant, business, message, availability confirmation, submission date and status. Search applies to loaded records; use Load more to include additional pages. Hiring decisions remain with the business owner.
