# Member 3: saved gigs

Youth accounts can bookmark gigs in Browse and on the gig detail screen, then open the Saved tab to view or remove them. The tab is restricted to the `freelancer` role. Buttons expose their saved and loading states to assistive technology, stop card navigation when pressed, and report write failures.

Bookmarks are private documents at `users/{uid}/savedGigs/{gigId}` with `{ gigId, savedAt }`. They do not change the parent user document or gig document. Saves use a transaction and the gig ID as the document ID to avoid duplicates or overwriting the original save time. Saving requires a connection; Firestore reports transaction failures when offline.

One account-scoped subscription synchronizes the bookmark state across Browse, details and Saved. Account changes, role changes and suspension clear that state. The saved list shows newest bookmarks first and loads live gig details in groups of 20. Filled, closed and completed gigs retain their current status. Deleted gigs have an unavailable row with a remove action; they are not silently discarded. Pull to refresh retries both bookmark and gig subscriptions.

## Firebase integration

The rules allow only the bookmark owner to read or delete it. Creation also requires an active youth account, an existing gig, the correct gig ID, a server timestamp and the exact bookmark fields. Updates are denied. Existing user profile rules remain unchanged. No new composite index is required for the single-field saved-time ordering.

Review and deploy the updated rules to the team's intended Firebase project before testing bookmarks against live Firebase:

```sh
firebase deploy --only firestore:rules --project local-workers-74bdd
```

The implementation does not deploy rules or modify production data. Member 1 should retain the `savedGigs` subcollection rules when editing the shared users rules.

## Verification

```sh
npm test
npm run test:rules
npx tsc --noEmit
npx expo export --platform web
```

The rules command uses the demo project `demo-gigzy-saved` and a local Firestore emulator on port 8085; Java is required. It does not contact production Firestore. Ordinary service tests skip the emulator-only test when `FIRESTORE_EMULATOR_HOST` is absent. The rules suite checks ownership, anonymous access, role and suspension restrictions, schema validation, duplicate saves, and removal after a gig is deleted.

Implementation validation: all 20 service tests, changed-file lint, TypeScript, web export and browser checks pass. The rules suite could not execute in this session because the official emulator download stalled; run `npm run test:rules` before deploying. No live Firebase test has been performed.

Browser checks use an isolated preview with local fixtures under the ignored `.expo/app-ui/preview` directory. At 320px, 390px and 1440px they cover saving without opening the card, navigation to Saved, removal, empty and unavailable rows, current completed status, detail bookmarks, failed writes, subscription errors, the business role guard, horizontal overflow and runtime exceptions. Screenshots are in `.expo/app-ui/saved-*.png`. Test native device behavior and real account switching after deploying rules.
