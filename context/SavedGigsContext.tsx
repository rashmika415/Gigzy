import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { removeSavedGig, saveGig, subscribeToSavedGigs, type SavedGig } from '../services/savedGigService';

interface SavedGigsState {
  items: SavedGig[];
  savedIds: Set<string>;
  pendingIds: Set<string>;
  enabled: boolean;
  loading: boolean;
  error: string;
  retry: () => void;
  toggle: (gigId: string) => Promise<void>;
}
const SavedGigsContext = createContext<SavedGigsState | null>(null);

function AccountSavedGigsProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [items, setItems] = useState<SavedGig[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState(new Set<string>());
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  const savedIds = useMemo(() => new Set(items.map(item => item.gigId)), [items]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const unsubscribe = subscribeToSavedGigs(userId, rows => {
      if (active) { setItems(rows); setLoading(false); setError(''); }
    }, failure => {
      if (active) { setLoading(false); setError(failure.message); }
    });
    return () => { active = false; unsubscribe(); };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setLoading(true); setError(''); setAttempt(value => value + 1);
  }, []);

  const toggle = useCallback(async (gigId: string) => {
    if (!userId || loading || error) throw new Error('Saved gigs are unavailable. Open Saved and retry.');
    if (pending.current.has(gigId)) return;
    pending.current.add(gigId); setPendingIds(new Set(pending.current));
    try {
      if (savedIds.has(gigId)) await removeSavedGig(userId, gigId);
      else await saveGig(userId, gigId);
    } finally {
      pending.current.delete(gigId);
      if (mounted.current) setPendingIds(new Set(pending.current));
    }
  }, [userId, loading, error, savedIds]);

  return <SavedGigsContext.Provider value={{ items, savedIds, pendingIds, enabled: !!userId, loading, error, retry, toggle }}>{children}</SavedGigsContext.Provider>;
}

export function SavedGigsProvider({ children }: { children: ReactNode }) {
  const { user, userData } = useAuth();
  const userId = user && userData?.role === 'freelancer' && !userData.suspended ? user.uid : null;
  // Remount on account/role changes so the previous user's private data disappears immediately.
  return <AccountSavedGigsProvider key={userId ?? 'disabled'} userId={userId}>{children}</AccountSavedGigsProvider>;
}

export function useSavedGigs() {
  const context = useContext(SavedGigsContext);
  if (!context) throw new Error('useSavedGigs must be used inside SavedGigsProvider');
  return context;
}
