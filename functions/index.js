const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { notifyNewGig } = require('./notifyNewGig');

initializeApp();

exports.notifyOnGigPosted = onDocumentCreated({
  document: 'gigs/{gigId}',
  retry: true,
  timeoutSeconds: 540,
  maxInstances: 5,
}, async (event) => {
  if (!event.data) return;
  await notifyNewGig(getFirestore(), event.params.gigId, event.data.data(), {
    documentId: FieldPath.documentId(),
    createdAt: FieldValue.serverTimestamp(),
  });
});
