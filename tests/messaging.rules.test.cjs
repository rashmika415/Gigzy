/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, serverTimestamp } = require('firebase/firestore');

test('messaging firestore rules enforce participant-only access and validation', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async (t) => {
  const environment = await initializeTestEnvironment({
    projectId: 'demo-gigzy-messaging',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
  });

  try {
    await environment.clearFirestore();

    // Seed users with security rules disabled
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'youth-001'), { uid: 'youth-001', role: 'freelancer' });
      await setDoc(doc(db, 'users', 'youth-002'), { uid: 'youth-002', role: 'freelancer' });
      await setDoc(doc(db, 'users', 'biz-001'), { uid: 'biz-001', role: 'client' });
      await setDoc(doc(db, 'users', 'stranger'), { uid: 'stranger', role: 'freelancer' });
    });

    const db = (uid) => environment.authenticatedContext(uid).firestore();

    const convData = {
      conversationId: 'conv_app-001',
      applicationId: 'app-001',
      youthId: 'youth-001',
      businessId: 'biz-001',
      participants: ['youth-001', 'biz-001'],
      lastMessage: 'Application accepted',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    await t.test('participants can create and read their conversation', async () => {
      const youth = db('youth-001');
      await assertSucceeds(setDoc(doc(youth, 'conversations', 'conv_app-001'), convData));
      await assertSucceeds(getDoc(doc(youth, 'conversations', 'conv_app-001')));

      const biz = db('biz-001');
      await assertSucceeds(getDoc(doc(biz, 'conversations', 'conv_app-001')));
    });

    await t.test('unauthorized users cannot read another pair\'s conversation', async () => {
      const stranger = db('stranger');
      await assertFails(getDoc(doc(stranger, 'conversations', 'conv_app-001')));
    });

    await t.test('participants can send messages with senderId matching their uid', async () => {
      const youth = db('youth-001');
      await assertSucceeds(
        setDoc(doc(youth, 'conversations', 'conv_app-001', 'messages', 'msg-1'), {
          conversationId: 'conv_app-001',
          senderId: 'youth-001',
          receiverId: 'biz-001',
          text: 'Hi, are you available tomorrow?',
          read: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    await t.test('users cannot forge message senderId or message in conversations they are not in', async () => {
      const stranger = db('stranger');
      await assertFails(
        setDoc(doc(stranger, 'conversations', 'conv_app-001', 'messages', 'msg-hack'), {
          conversationId: 'conv_app-001',
          senderId: 'stranger',
          receiverId: 'biz-001',
          text: 'Intrusion attempt',
          read: false,
          createdAt: serverTimestamp(),
        })
      );

      // Youth forging business's sender ID
      const youth = db('youth-001');
      await assertFails(
        setDoc(doc(youth, 'conversations', 'conv_app-001', 'messages', 'msg-forged'), {
          conversationId: 'conv_app-001',
          senderId: 'biz-001',
          receiverId: 'youth-001',
          text: 'Impersonating business',
          read: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    await t.test('recipient can mark received message as read', async () => {
      const biz = db('biz-001');
      await assertSucceeds(
        updateDoc(doc(biz, 'conversations', 'conv_app-001', 'messages', 'msg-1'), {
          read: true,
          readAt: serverTimestamp(),
        })
      );
    });
  } finally {
    await environment.cleanup();
  }
});
