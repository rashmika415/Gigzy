import { validCoordinates } from './discoveryFilters';
import type { Coordinates } from '../types/gig';

export interface AddressResult { label: string; coordinates: Coordinates }

export async function searchAddresses(address: string, apiKey: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<AddressResult[]> {
  if (address.trim().length < 3) throw new Error('Enter at least 3 characters of the address.');
  if (!apiKey.trim()) throw new Error('Address search is unavailable. Choose a point on the map or use your current location.');
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address.trim())}&format=json&limit=5&apiKey=${encodeURIComponent(apiKey.trim())}`;
  const response = await request(url, { signal });
  if (!response.ok) throw new Error(response.status === 429 ? 'Address search is busy. Try again shortly or choose a map point.' : 'Unable to search addresses. Try again or choose a point on the map.');
  const data = await response.json();
  return (Array.isArray(data.results) ? data.results : []).flatMap((item: { lat?: number; lon?: number; formatted?: string }) => {
    if (typeof item.lat !== 'number' || typeof item.lon !== 'number') return [];
    const coordinates = { latitude: item.lat, longitude: item.lon };
    return validCoordinates(coordinates) && typeof item.formatted === 'string' ? [{ label: item.formatted, coordinates }] : [];
  });
}
