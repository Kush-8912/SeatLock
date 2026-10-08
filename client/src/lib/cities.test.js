import { describe, it, expect } from 'vitest';
import { findCity, nearestCity } from './cities';
import { MAP_HEIGHT, MAP_WIDTH, project } from './indiaMap';

describe('cities', () => {
  it('finds cities by name, ignoring case', () => {
    expect(findCity(' mumbai ')?.name).toBe('Mumbai');
    expect(findCity('Atlantis')).toBe(null);
  });

  it('suggests the nearest city with shows when one is close enough', () => {
    const thane = { lat: 19.2183, lon: 72.9781 };
    expect(nearestCity(thane).city.name).toBe('Mumbai');
    // Navi Mumbai is closer, but only Pune has shows and it's within reach.
    expect(nearestCity(thane, new Set(['Pune'])).city.name).toBe('Pune');
    // Nothing with shows nearby: fall back to the nearest city.
    expect(nearestCity(thane, new Set(['Delhi'])).city.name).toBe('Mumbai');
  });

  it('places cities inside the map', () => {
    for (const [lat, lon] of [[34.15, 77.58], [8.52, 76.94], [26.14, 91.74]]) {
      const { x, y } = project(lat, lon);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(MAP_WIDTH);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(MAP_HEIGHT);
    }
  });
});
