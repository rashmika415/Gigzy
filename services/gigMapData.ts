import { validCoordinates } from './discoveryFilters';
import type { Coordinates, Gig } from '../types/gig';

export interface GigMapPin { key: string; coordinates: Coordinates; gigs: Gig[] }

export function getGigMapData(gigs: Gig[]) {
  const groups = new Map<string, GigMapPin>();
  let remoteCount = 0;
  let missingLocationCount = 0;
  for (const gig of gigs) {
    if (gig.status !== 'open') continue;
    if (gig.locationType === 'remote') { remoteCount++; continue; }
    if (!validCoordinates(gig.coordinates)) { missingLocationCount++; continue; }
    const key = `${gig.coordinates.latitude},${gig.coordinates.longitude}`;
    const group = groups.get(key);
    if (group) group.gigs.push(gig);
    else groups.set(key, { key, coordinates: gig.coordinates, gigs: [gig] });
  }
  return { pins: [...groups.values()], remoteCount, missingLocationCount,
    mappedCount: [...groups.values()].reduce((count, pin) => count + pin.gigs.length, 0) };
}
