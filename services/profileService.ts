import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../FirebaseConfig';
import { UserData } from '../context/AuthContext';
import { ProfileReview } from '../types/profile';

export function subscribeToProfile(
  userId: string,
  onData: (profile: UserData | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => onData(snapshot.exists() ? (snapshot.data() as UserData) : null),
    onError,
  );
}

export function subscribeToProfileReviews(
  userId: string,
  onData: (reviews: ProfileReview[]) => void,
  onError?: (error: Error) => void,
) {
  const reviewsQuery = query(
    collection(db, 'users', userId, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(25),
  );

  return onSnapshot(
    reviewsQuery,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ProfileReview)),
    onError,
  );
}
