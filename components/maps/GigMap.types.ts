import type { Gig } from '../../types/gig';
export interface GigMapProps {
  gigs: Gig[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
  onRefresh: () => void;
  onLoadMore: () => void;
  onShowList: () => void;
  onGigPress: (gig: Gig) => void;
}
