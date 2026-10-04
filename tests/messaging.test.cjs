const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

function setup() {
  const records = new Map();
  const subcollections = new Map(); // key: path to collection, value: Map of docId -> data
  const writes = [];
  let failure;
  let conversationSubscription;
  let messageSubscription;

  const firestore = {
    doc: (_db, ...parts) => parts.join('/'),
    collection: (_db, ...parts) => parts.join('/'),
    serverTimestamp: () => 'SERVER_TIME',
    increment: (n) => ({ __increment: n }),
    getDoc: async (path) => ({
      exists: () => records.has(path),
      id: path.split('/').pop(),
      data: () => records.get(path),
    }),
    setDoc: async (path, value) => {
      if (failure) throw failure;
      writes.push({ type: 'set', path, value });
      records.set(path, value);
    },
    updateDoc: async (path, updates) => {
      if (failure) throw failure;
      writes.push({ type: 'update', path, updates });
      const current = records.get(path) || {};
      for (const [k, v] of Object.entries(updates)) {
        if (k.includes('.')) {
          const [parent, child] = k.split('.');
          current[parent] = current[parent] || {};
          if (v && v.__increment) {
            current[parent][child] = (current[parent][child] || 0) + v.__increment;
          } else {
            current[parent][child] = v;
          }
        } else {
          current[k] = v;
        }
      }
      records.set(path, current);
    },
    addDoc: async (colPath, data) => {
      if (failure) throw failure;
      const id = 'msg-' + Math.random().toString(36).substring(2, 9);
      const fullPath = `${colPath}/${id}`;
      if (!subcollections.has(colPath)) subcollections.set(colPath, new Map());
      subcollections.get(colPath).set(id, { id, ...data });
      writes.push({ type: 'add', path: fullPath, data });
      return { id };
    },
    getDocs: async (q) => {
      const colPath = typeof q === 'string' ? q : q.colPath;
      const col = subcollections.get(colPath) || new Map();
      const docs = Array.from(col.entries()).map(([id, d]) => ({
        id,
        ref: `${colPath}/${id}`,
        data: () => d,
      }));
      return {
        empty: docs.length === 0,
        docs,
      };
    },
    query: (colPath, ...conditions) => ({ colPath, conditions }),
    where: (field, op, val) => ({ field, op, val }),
    orderBy: (field, direction) => ({ field, direction }),
    onSnapshot: (q, onNext, onError) => {
      if (q.colPath && q.colPath.includes('messages')) {
        messageSubscription = { q, onNext, onError, stopped: false };
        return () => { messageSubscription.stopped = true; };
      }
      conversationSubscription = { q, onNext, onError, stopped: false };
      return () => { conversationSubscription.stopped = true; };
    },
    writeBatch: (_db) => {
      const batchOps = [];
      return {
        update: (ref, data) => {
          batchOps.push({ ref, data });
        },
        commit: async () => {
          for (const op of batchOps) {
            const parts = op.ref.split('/');
            const docId = parts.pop();
            const col = parts.join('/');
            if (subcollections.has(col) && subcollections.get(col).has(docId)) {
              Object.assign(subcollections.get(col).get(docId), op.data);
            }
          }
        },
      };
    },
  };

  const convService = load('../services/messaging/conversationService.ts', {
    'firebase/firestore': firestore,
    '../../FirebaseConfig': { db: {} },
  });

  const msgService = load('../services/messaging/messageService.ts', {
    'firebase/firestore': firestore,
    '../../FirebaseConfig': { db: {} },
  });

  return {
    convService,
    msgService,
    records,
    subcollections,
    writes,
    fail: (e) => { failure = e; },
    getConversationSub: () => conversationSubscription,
    getMessageSub: () => messageSubscription,
  };
}

test('createConversation creates a conversation tied to applicationId and participants', async () => {
  const { convService, records } = setup();

  const conv = await convService.createConversation({
    applicationId: 'app-101',
    gigId: 'gig-202',
    youthId: 'youth-001',
    businessId: 'biz-001',
    gigTitle: 'Graphic Designer',
    gigPay: 25,
    gigPayType: 'hourly',
    youthName: 'Sethmi',
    businessName: 'ABC Design',
  });

  assert.equal(conv.id, 'conv_app-101');
  assert.equal(conv.applicationId, 'app-101');
  assert.equal(conv.youthId, 'youth-001');
  assert.equal(conv.businessId, 'biz-001');
  assert.deepStrictEqual([...conv.participants], ['youth-001', 'biz-001']);

  const stored = records.get('conversations/conv_app-101');
  assert.ok(stored);
  assert.equal(stored.applicationId, 'app-101');
  assert.equal(stored.gigTitle, 'Graphic Designer');
});

test('multiple applications between the same youth and business produce distinct conversations', async () => {
  const { convService } = setup();

  const convA = await convService.createConversation({
    applicationId: 'app-designer-1',
    gigId: 'gig-designer',
    youthId: 'youth-001',
    businessId: 'biz-001',
    gigTitle: 'Graphic Designer',
  });

  const convB = await convService.createConversation({
    applicationId: 'app-social-2',
    gigId: 'gig-social',
    youthId: 'youth-001',
    businessId: 'biz-001',
    gigTitle: 'Social Media Assistant',
  });

  assert.notEqual(convA.id, convB.id);
  assert.equal(convA.id, 'conv_app-designer-1');
  assert.equal(convB.id, 'conv_app-social-2');
  assert.equal(convA.gigTitle, 'Graphic Designer');
  assert.equal(convB.gigTitle, 'Social Media Assistant');
});

test('sendMessage writes message with read: false and updates conversation metadata and unreadCount', async () => {
  const { convService, msgService, records, subcollections } = setup();

  await convService.createConversation({
    applicationId: 'app-101',
    youthId: 'youth-001',
    businessId: 'biz-001',
  });

  const msgId = await msgService.sendMessage({
    conversationId: 'conv_app-101',
    senderId: 'youth-001',
    receiverId: 'biz-001',
    text: 'Hello, are you available tomorrow at 10 AM?',
  });

  assert.ok(msgId);

  // Check message document in subcollection
  const messagesCol = subcollections.get('conversations/conv_app-101/messages');
  assert.ok(messagesCol);
  const msgDoc = messagesCol.get(msgId);
  assert.equal(msgDoc.text, 'Hello, are you available tomorrow at 10 AM?');
  assert.equal(msgDoc.senderId, 'youth-001');
  assert.equal(msgDoc.receiverId, 'biz-001');
  assert.equal(msgDoc.read, false);

  // Check parent conversation metadata update
  const convDoc = records.get('conversations/conv_app-101');
  assert.equal(convDoc.lastMessage, 'Hello, are you available tomorrow at 10 AM?');
  assert.equal(convDoc.unreadCount['biz-001'], 1);
});

test('empty messages cannot be sent', async () => {
  const { msgService } = setup();
  await assert.rejects(
    msgService.sendMessage({
      conversationId: 'conv_app-101',
      senderId: 'youth-001',
      receiverId: 'biz-001',
      text: '   ',
    }),
    /cannot be empty/
  );
});

test('markMessagesAsRead updates unread messages to read: true and clears unread counter', async () => {
  const { convService, msgService, records, subcollections } = setup();

  await convService.createConversation({
    applicationId: 'app-101',
    youthId: 'youth-001',
    businessId: 'biz-001',
  });

  const msgId = await msgService.sendMessage({
    conversationId: 'conv_app-101',
    senderId: 'biz-001',
    receiverId: 'youth-001',
    text: 'Great, see you tomorrow.',
  });

  const messagesCol = subcollections.get('conversations/conv_app-101/messages');
  assert.equal(messagesCol.get(msgId).read, false);
  assert.equal(records.get('conversations/conv_app-101').unreadCount['youth-001'], 1);

  // Youth marks messages as read
  await msgService.markMessagesAsRead('conv_app-101', 'youth-001');

  assert.equal(messagesCol.get(msgId).read, true);
  assert.equal(records.get('conversations/conv_app-101').unreadCount['youth-001'], 0);
});

test('listenToMessages and listenToConversations set up snapshot subscriptions and cleanup', () => {
  const { convService, msgService, getConversationSub, getMessageSub } = setup();

  let convs;
  const stopConv = convService.listenToConversations('youth-001', (c) => { convs = c; });
  const convSub = getConversationSub();
  assert.ok(convSub);
  assert.equal(convSub.q.colPath, 'conversations');

  let msgs;
  const stopMsg = msgService.listenToMessages('conv_app-101', (m) => { msgs = m; });
  const msgSub = getMessageSub();
  assert.ok(msgSub);
  assert.equal(msgSub.q.colPath, 'conversations/conv_app-101/messages');

  stopConv();
  stopMsg();
  assert.equal(convSub.stopped, true);
  assert.equal(msgSub.stopped, true);
});
