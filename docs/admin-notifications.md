# Admin notification management

Administrators can open **Notifications** in the admin dashboard and send an in-app announcement to all active members, youth accounts, business accounts, or one user ID. The panel shows the newest 30 jobs with their queued, processing, sent, or failed state and delivered-recipient count.

This implementation is compatible with Firebase's Spark plan and does not use Cloud Functions. The authenticated administrator client creates a validated document in `announcements`, pages through users in batches of 400, skips suspended and administrator accounts, and writes a deterministic `system` notification under each recipient's `users/{uid}/notifications` collection. Each page commits its notifications and progress atomically. Keep the admin screen open until the job reaches `sent` or `failed`.

Deploy the Firestore rules before using the feature against a Firebase project:

```sh
firebase deploy --only firestore:rules --project local-workers-74bdd
```

The implementation creates in-app notifications. It does not send FCM push messages; that remains a separate push-notification feature.
