# Free-plan gig notifications

No Cloud Functions or billing upgrade is required. The youth app listens to the
20 most recently created gigs and creates announcements for open gigs in its own
users/{uid}/notifications collection. Recent existing gigs are included for the demo.
Businesses and suspended users do not run this listener. Transactions preserve
read state across restarts and multiple devices. Rules validate recipient, gig,
text and destination.

These are general in-app announcements, independent of notifyOnMatch (reserved
for personalized matching). The existing list, bell badge and gig navigation work.
Announcements are created while the app is open or on the next login. No background
phone push is sent. Gigs outside the latest 20 are not backfilled. Firestore reads
and writes count toward free quotas.

## Demo

1. Deploy: `firebase.cmd deploy --only firestore:rules --project local-workers-74bdd`.
2. Restart the app and sign in as youth. Recent open gigs appear in the bell.
3. Use another session as a business and post a gig.
4. Watch the youth badge/list update and tap to open the gig.
5. Mark it read, restart and confirm it remains read.

The earlier functions/ implementation is unused and excluded from firebase.json.
Do not deploy it for this free-plan demo.
