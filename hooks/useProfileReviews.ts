import { useEffect, useState } from 'react';
import { subscribeToProfileReviews } from '../services/profileService';
import { calculateReviewStats } from '../services/reviewStats';
import type { ProfileReview } from '../types/profile';

export function useProfileReviews(userId?: string) {
  const [state, setState] = useState<{ userId?: string; reviews: ProfileReview[]; loading: boolean; error: string }>({ reviews: [], loading: true, error: '' });
  useEffect(() => {
    if (!userId) return;
    return subscribeToProfileReviews(userId,
      reviews => setState({ userId, reviews, loading: false, error: '' }),
      error => setState({ userId, reviews: [], loading: false, error: error.message }));
  }, [userId]);
  const current = state.userId === userId ? state : { reviews: [], loading: true, error: '' };
  return { ...current, ...calculateReviewStats(current.reviews) };
}
