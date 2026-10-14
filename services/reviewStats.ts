import type { ProfileReview } from '../types/profile';

export function calculateReviewStats(reviews: Pick<ProfileReview, 'rating'>[]) {
  const valid = reviews.filter(review => Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5);
  const count = valid.length;
  return { count, average: count ? valid.reduce((total, review) => total + review.rating, 0) / count : 0 };
}
