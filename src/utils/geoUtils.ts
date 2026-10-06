import { Cantiere, BadgeGPSLocation } from '../types';

/**
 * Calculates the great-circle distance between two GPS coordinates in meters using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface NearestCantiereResult {
  cantiere: Cantiere;
  distanceMeters: number;
  isWithinRadius: boolean;
}

/**
 * Finds the closest cantiere to the user's current GPS position among the provided cantieri.
 */
export function findNearestCantiere(
  location: BadgeGPSLocation,
  cantieri: Cantiere[],
  defaultRadiusMeters = 300
): NearestCantiereResult | null {
  if (!cantieri || cantieri.length === 0 || !location.latitude || !location.longitude) {
    return null;
  }

  const validCantieriWithCoords = cantieri.filter(
    (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number' && !isNaN(c.latitude) && !isNaN(c.longitude)
  );

  if (validCantieriWithCoords.length === 0) {
    return null;
  }

  let closest: NearestCantiereResult | null = null;

  for (const c of validCantieriWithCoords) {
    const dist = calculateDistanceMeters(
      location.latitude,
      location.longitude,
      c.latitude!,
      c.longitude!
    );
    const radius = c.radiusMeters || defaultRadiusMeters;

    if (!closest || dist < closest.distanceMeters) {
      closest = {
        cantiere: c,
        distanceMeters: dist,
        isWithinRadius: dist <= radius,
      };
    }
  }

  return closest;
}

/**
 * Geocodes an address string using OpenStreetMap Nominatim.
 * Falls back gracefully if offline or network fails.
 */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  if (!address || !address.trim()) return null;

  try {
    const query = encodeURIComponent(address.trim());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
      headers: {
        'Accept-Language': 'it',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      return {
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
        displayName: first.display_name,
      };
    }
    return null;
  } catch (err) {
    console.warn('Geocoding request failed:', err);
    return null;
  }
}
