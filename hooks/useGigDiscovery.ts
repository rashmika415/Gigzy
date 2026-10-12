import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrowsePage } from '../services/gigService';
import type { BrowsePage } from '../services/gigService';
import type { Gig, GigFilterOptions } from '../types/gig';

export function useGigDiscovery(options: GigFilterOptions, enabled: boolean) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const page = useRef<BrowsePage | null>(null);
  const active = useRef<AbortController | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'more') => {
    if (!enabled || (mode === 'more' && (busy.current || !page.current?.hasMore))) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    busy.current = true;
    setError('');
    setLoading(mode === 'initial');
    setRefreshing(mode === 'refresh');
    setLoadingMore(mode === 'more');
    if (mode === 'initial') { setGigs([]); page.current = null; setHasMore(false); }
    try {
      const result = await getBrowsePage(options, mode === 'more' ? page.current?.cursor : null, controller.signal);
      if (controller.signal.aborted) return;
      page.current = result;
      setHasMore(result.hasMore);
      setGigs(previous => {
        const rows = mode === 'more' ? [...previous, ...result.gigs] : result.gigs;
        return [...new Map(rows.map(gig => [gig.id, gig])).values()];
      });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load gigs.');
    } finally {
      if (!controller.signal.aborted) {
        busy.current = false;
        setLoading(false); setRefreshing(false); setLoadingMore(false);
      }
    }
  }, [enabled, options]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (enabled) void load('initial');
      else { setGigs([]); setLoading(false); page.current = null; setHasMore(false); }
    });
    return () => { cancelled = true; active.current?.abort(); busy.current = false; };
  }, [enabled, load]);

  return { gigs, loading, refreshing, loadingMore, error, hasMore,
    refresh: () => void load('refresh'), loadMore: () => void load('more') };
}
