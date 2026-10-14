# Gig reviews

Only completed gigs expose Rate User to the business owner and assigned freelancer. Each party rates the other. The modal shows the recipient name, photo and profile link, requires 1?5 whole stars and accepts an optional comment of up to 1000 characters.

Reviews live at `users/{reviewedUserId}/reviews/{gigId}_{reviewerId}`. Each document stores `gigId`, `reviewerId`, `reviewedUserId`, `reviewerRole`, `rating`, `comment`, `createdAt`, plus `authorId` and `authorName` for compatibility with existing profile reviews. The transaction and Firestore rules enforce completion, participants, no self-review, valid stars and one immutable review per gig/reviewer.

Own and public profiles subscribe to all received reviews, calculate the average as total rating points divided by review count, and display reviewer name/profile link, role, stars, comment and date. Existing reviews remain visible. Summary values are derived live; cached rating fields on user documents are not updated by this flow.

Deploy `firestore.rules` before using the expanded review payload in production. Run `node --test tests/gig-review.test.cjs` for service checks. With the Firestore emulator running, run `node --test tests/gig-review.rules.test.cjs` for authorization checks.
