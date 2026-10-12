# Member 3 implementation — 12 October 2026

- Gig details now open the existing application form for active youth accounts. Application status is subscribed in real time, existing applications link to My Applications, and closed gigs cannot receive new applications. The service and rules enforce a 500-character message limit.
- All seven local discovery composite indexes were found in the deployed `local-workers-74bdd` project. The app's environment uses that same project. No index changes were needed.
- English, Sinhala and Tamil cover the added UI labels, map controls, application screens, referral flow, alerts and sharing text. A coverage test checks literal translation keys, and existing tests check dictionary parity, interpolation and language persistence. User-written content is displayed in its original language.
- Profile includes an Invite friends card with a stable code, native sharing and successful-signup count. Signup accepts an optional code and commits the profile and attribution together. Rules prevent code replacement, self-referrals, forged attribution and attribution after profile creation. Referral rewards are not part of this implementation.

## Firebase deployment

`firebase deploy --only firestore:rules --project local-workers-74bdd` completed successfully on 12 October 2026. Firebase compiled and released the local application and referral rules. The compiler reported warnings about existing unused notification validation helpers.

## Verification

- TypeScript and `npm run lint` passed.
- The unit suite passed 80 tests; six emulator-dependent tests were skipped.
- Translation coverage and locale formatting tests passed after the final text edits.
- Web export succeeded with 53 routes.
- Interactive device/browser acceptance testing was not available in this session.
- Emulator behavior tests remain unverified: repeated downloads of the official Firestore emulator failed or stalled. Cloud rule compilation is not a substitute for those tests.

Run `npm run test:rules:member3` with Java and network access to execute the application/referral, saved-gig and close-gig rule tests. This uses a demo project and does not write test accounts or gigs to production.

## Manual acceptance checks

1. As youth, open an open gig, apply with availability confirmed, and check that the action changes to View my application. Reopen it and confirm a second submission is blocked. Check a closed gig too.
2. Copy a code from Profile, sign out and register a new account using it. The inviter's successful-signup count should increase once. An invalid code should keep registration on the form.
3. Switch between English, Sinhala and Tamil; check discovery, map preview, directions, gig details, application form and referral card, then restart to verify persistence.
