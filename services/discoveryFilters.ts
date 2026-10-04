import { GIG_CATEGORIES } from '../types/gig';
import type { Coordinates, Gig, GigFilterOptions } from '../types/gig';

export function validCoordinates(value: Coordinates | undefined): value is Coordinates {
  return !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude))
    * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function categoryId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return GIG_CATEGORIES.find(c => c.id === normalized || c.name.toLowerCase() === normalized)?.id ?? normalized;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

export function matchesDiscoveryFilters(gig: Gig, options: GigFilterOptions): boolean {
  if (options.status && options.status !== 'all' && gig.status !== options.status) return false;
  if (options.category && options.category !== 'all' && categoryId(gig.category) !== categoryId(options.category)) return false;
  const words = options.searchQuery?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const text = [gig.title, gig.description, gig.category, gig.location, ...(gig.skills ?? [])].join(' ').toLowerCase();
  if (!words.every(word => text.includes(word))) return false;
  if (options.locationType && options.locationType !== 'all' && gig.locationType !== options.locationType) return false;
  if (options.payType && options.payType !== 'all' && gig.payType !== options.payType) return false;
  if (options.minPay !== undefined && gig.pay < options.minPay) return false;
  if (options.maxPay !== undefined && gig.pay > options.maxPay) return false;
  if ((options.dateFrom || options.dateTo || options.weekendsOnly) && !validDate(gig.date)) return false;
  if (options.dateFrom && gig.date < options.dateFrom) return false;
  if (options.dateTo && gig.date > options.dateTo) return false;
  if (options.weekendsOnly) {
    const [year, month, day] = gig.date.split('-').map(Number);
    if (![0, 6].includes(new Date(year, month - 1, day).getDay())) return false;
  }
  if ((options.timeFrom || options.timeTo) && (!gig.time || !validTime(gig.time))) return false;
  if (options.timeFrom && gig.time! < options.timeFrom) return false;
  if (options.timeTo && gig.time! > options.timeTo) return false;
  if (options.radiusKm !== undefined) {
    // Remote gigs have no travel distance and remain available at any radius.
    if (gig.locationType === 'remote') return true;
    if (!validCoordinates(options.origin) || !validCoordinates(gig.coordinates)) return false;
    if (distanceKm(options.origin, gig.coordinates) > options.radiusKm) return false;
  }
  return true;
}
