import { validCoordinates } from './discoveryFilters';
import type { Coordinates } from '../types/gig';

export function gigDirectionsUrl(address: string, coordinates?: Coordinates): string | undefined {
  const destination = validCoordinates(coordinates)
    ? `${coordinates.latitude},${coordinates.longitude}` : address.trim();
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : undefined;
}
