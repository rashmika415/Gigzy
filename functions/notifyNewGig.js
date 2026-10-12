// In-app announcements for all active youth users, independent of push/match preferences.
async function notifyNewGig(db, gigId, gig, { documentId, createdAt }) {
  if (gig.status !== 'open' || !gig.title || !gig.postedBy?.uid) return;
  const base = db.collection('users').where('role', '==', 'freelancer')
    .orderBy(documentId).limit(100);
  let cursor;
  while (true) {
    const page = await (cursor ? base.startAfter(cursor) : base).get();
    if (page.empty) break;
    // Settle every write before returning or throwing so a retry is safe.
    const results = await Promise.allSettled(page.docs.map(async (user) => {
      if (user.id === gig.postedBy.uid || user.data().suspended === true) return;
      try {
        await user.ref.collection('notifications').doc(`gig-posted-${gigId}`).create({
          userId: user.id,
          type: 'gig_posted',
          title: 'New gig posted',
          body: `${gig.title}${gig.location ? ` · ${gig.location}` : ''}`,
          read: false,
          route: `/(app)/gig/${encodeURIComponent(gigId)}`,
          entityId: gigId,
          createdAt,
        });
      } catch (error) {
        // Events can be delivered repeatedly. Never overwrite an existing read state.
        if (error.code !== 6 && error.code !== 'already-exists') throw error;
      }
    }));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    cursor = page.docs[page.docs.length - 1];
  }
}

module.exports = { notifyNewGig };
