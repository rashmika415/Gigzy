import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export interface VerificationRequest {
  id: string; businessId: string; status: VerificationStatus;
  businessName: string; fullName: string; email: string; phone: string; address: string;
  businessCategory: string; businessDetails: string; details: string;
  rejectionReason?: string; reviewedBy?: string; submittedAt?: { toDate?: () => Date };
}
export function isBusinessVerified(profile?: { role?: string; verificationStatus?: string } | null) {
  return profile?.role === 'client' && profile.verificationStatus === 'VERIFIED';
}
export function subscribeToVerificationRequest(uid: string, onData: (value: VerificationRequest | null) => void, onError?: (error: Error) => void) {
  return onSnapshot(doc(db, 'businessVerificationRequests', uid), snap => onData(snap.exists() ? { ...snap.data(), id: snap.id } as VerificationRequest : null), onError);
}
export function subscribeToPendingVerifications(onData: (rows: VerificationRequest[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'businessVerificationRequests'), where('status', '==', 'PENDING')),
    snap => onData(snap.docs.map(item => ({ ...item.data(), id: item.id }) as VerificationRequest)), onError);
}
export async function submitBusinessVerification(details: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in again.');
  const clean = details.trim();
  if (clean.length < 5 || clean.length > 2000) throw new Error('Enter verification details between 5 and 2000 characters.');
  await runTransaction(db, async transaction => {
    const userRef = doc(db, 'users', uid); const requestRef = doc(db, 'businessVerificationRequests', uid);
    const profile = await transaction.get(userRef); const existing = await transaction.get(requestRef);
    const data = profile.data();
    if (!profile.exists() || data?.role !== 'client' || data.suspended) throw new Error('Business access required.');
    if (data.verificationStatus === 'VERIFIED' || data.verificationStatus === 'PENDING' || (existing.exists() && existing.data().status !== 'REJECTED')) throw new Error('A verification request is already pending or approved.');
    if (![data.businessName, data.email, data.phone, data.address, data.businessDetails].every(value => typeof value === 'string' && value.trim())) throw new Error('Complete your business name, email, phone, address and business description before submitting.');
    transaction.set(requestRef, {
      businessId: uid, status: 'PENDING', businessName: data.businessName, fullName: data.fullName || '',
      email: data.email, phone: data.phone, address: data.address,
      businessCategory: data.businessCategory || '', businessDetails: data.businessDetails,
      details: clean, submittedAt: serverTimestamp(),
    });
    transaction.update(userRef, { verificationStatus: 'PENDING', updatedAt: serverTimestamp() });
  });
}
export async function decideBusinessVerification(businessId: string, status: 'VERIFIED' | 'REJECTED', reason = '') {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in again.');
  if (status !== 'VERIFIED' && status !== 'REJECTED') throw new Error('Invalid verification decision.');
  const clean = reason.trim();
  if (status === 'REJECTED' && (clean.length < 5 || clean.length > 500)) throw new Error('Enter a reason between 5 and 500 characters.');
  await runTransaction(db, async transaction => {
    const admin = await transaction.get(doc(db, 'users', uid));
    const userRef = doc(db, 'users', businessId); const requestRef = doc(db, 'businessVerificationRequests', businessId);
    const profile = await transaction.get(userRef); const request = await transaction.get(requestRef);
    if (admin.data()?.role !== 'admin' || admin.data()?.suspended) throw new Error('Administrator access required.');
    if (!profile.exists() || profile.data().role !== 'client' || profile.data().verificationStatus !== 'PENDING' || !request.exists() || request.data().status !== 'PENDING') throw new Error('This request is no longer pending.');
    transaction.update(requestRef, { status, rejectionReason: status === 'REJECTED' ? clean : '', reviewedBy: uid, reviewedAt: serverTimestamp() });
    transaction.update(userRef, { verificationStatus: status, isVerified: status === 'VERIFIED', updatedAt: serverTimestamp() });
  });
}
