import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { Coordinates } from '../types/gig';

function withTimeout<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out. Please try again.')), 15000);
    request.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function requestPermission() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location permission is denied. Enable it in Settings or browse without a distance filter.');
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
  await requestPermission();
  const result = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: result.coords.latitude, longitude: result.coords.longitude };
}

export async function coordinatesForAddress(address: string): Promise<Coordinates> {
  if (!address.trim()) throw new Error('Enter a gig address first.');
  if (Platform.OS === 'web') throw new Error('Address lookup is available on mobile. Enter coordinates manually on web.');
  await requestPermission();
  const results = await withTimeout(Location.geocodeAsync(address));
  if (!results.length) throw new Error('Address not found. Try a more specific address or enter coordinates.');
  return { latitude: results[0].latitude, longitude: results[0].longitude };
}
