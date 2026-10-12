import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../FirebaseConfig';

export function normalizeReferralCode(value: string) { return value.trim().toUpperCase(); }

export async function lookupReferral(value: string): Promise<{ code: string; ownerId: string } | null> {
  const code = normalizeReferralCode(value);
  if (!code) return null;
  if (!/^[A-Z0-9]{10}$/.test(code)) throw new Error('Enter a valid 10-character referral code.');
  const snapshot = await getDoc(doc(db, 'referralCodes', code));
  if (!snapshot.exists()) throw new Error('Referral code not found. Check it or leave this field empty.');
  return { code, ownerId: snapshot.data().ownerId };
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const userRef = doc(db, 'users', userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = doc(collection(db, 'referralCodes')).id.slice(0, 10).toUpperCase();
    const result = await runTransaction(db, async transaction => {
      const user = await transaction.get(userRef);
      if (!user.exists()) throw new Error('Complete your profile before inviting friends.');
      if (user.data().referralCode) return String(user.data().referralCode);
      const codeRef = doc(db, 'referralCodes', code);
      if ((await transaction.get(codeRef)).exists()) return null;
      transaction.set(codeRef, { ownerId: userId, createdAt: serverTimestamp() });
      transaction.update(userRef, { referralCode: code });
      return code;
    });
    if (result) return result;
  }
  throw new Error('Could not create your referral code. Please retry.');
}

// Profile and referral attribution are committed together; retries never create a second referral.
export async function createRegisteredProfile(userId: string, profile: Record<string, unknown>, referral: { code: string; ownerId: string } | null) {
  if (referral?.ownerId === userId) throw new Error('You cannot use your own referral code.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId), { ...profile, uid: userId, createdAt: serverTimestamp() });
  if (referral) batch.set(doc(db, 'referrals', userId), {
    referrerId: referral.ownerId, referralCode: referral.code, createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export function subscribeToReferralCount(userId: string, onCount: (count: number) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'referrals'), where('referrerId', '==', userId)),
    snapshot => onCount(snapshot.size), onError);
}
