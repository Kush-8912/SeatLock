// Indian cities the city picker can place on the map, with their coordinates.
// Cities with events but missing here still appear in the picker's list, just
// without a pin. Names match server/src/utils/cities.js, which normalises the
// city an organizer types ("Bangalore" -> "Bengaluru").

export const CITIES = [
  { name: 'Mumbai', lat: 19.076, lon: 72.8777, popular: true },
  { name: 'Delhi', lat: 28.6139, lon: 77.209, popular: true },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, popular: true },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867, popular: true },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, popular: true },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, popular: true },
  { name: 'Pune', lat: 18.5204, lon: 73.8567, popular: true },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, popular: true },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
  { name: 'Chandigarh', lat: 30.7333, lon: 76.7794 },
  { name: 'Kochi', lat: 9.9312, lon: 76.2673 },
  { name: 'Goa', lat: 15.4909, lon: 73.8278 },
  { name: 'Indore', lat: 22.7196, lon: 75.8577 },
  { name: 'Bhopal', lat: 23.2599, lon: 77.4126 },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882 },
  { name: 'Surat', lat: 21.1702, lon: 72.8311 },
  { name: 'Vadodara', lat: 22.3072, lon: 73.1812 },
  { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245 },
  { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
  { name: 'Shillong', lat: 25.5788, lon: 91.8933 },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185 },
  { name: 'Vijayawada', lat: 16.5062, lon: 80.648 },
  { name: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
  { name: 'Madurai', lat: 9.9252, lon: 78.1198 },
  { name: 'Thiruvananthapuram', lat: 8.5241, lon: 76.9366 },
  { name: 'Mysuru', lat: 12.2958, lon: 76.6394 },
  { name: 'Puducherry', lat: 11.9416, lon: 79.8083 },
  { name: 'Kanpur', lat: 26.4499, lon: 80.3319 },
  { name: 'Varanasi', lat: 25.3176, lon: 82.9739 },
  { name: 'Ranchi', lat: 23.3441, lon: 85.3096 },
  { name: 'Raipur', lat: 21.2514, lon: 81.6296 },
  { name: 'Udaipur', lat: 24.5854, lon: 73.7125 },
  { name: 'Jodhpur', lat: 26.2389, lon: 73.0243 },
  { name: 'Amritsar', lat: 31.634, lon: 74.8723 },
  { name: 'Dehradun', lat: 30.3165, lon: 78.0322 },
  { name: 'Shimla', lat: 31.1048, lon: 77.1734 },
  { name: 'Jammu', lat: 32.7266, lon: 74.857 },
  { name: 'Srinagar', lat: 34.0837, lon: 74.7973 },
  { name: 'Leh', lat: 34.1526, lon: 77.577 },
  { name: 'Noida', lat: 28.5355, lon: 77.391 },
  { name: 'Gurugram', lat: 28.4595, lon: 77.0266 },
  { name: 'Navi Mumbai', lat: 19.033, lon: 73.0297 },
];

const BY_NAME = new Map(CITIES.map((c) => [c.name.toLowerCase(), c]));
export const findCity = (name) => BY_NAME.get(String(name ?? '').trim().toLowerCase()) ?? null;

// Great-circle distance in km.
function km(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The city to suggest for a position: the nearest one that has events if it's
 * within `reach` km, otherwise the nearest city on the map.
 */
export function nearestCity({ lat, lon }, withEvents = new Set(), reach = 150) {
  const ranked = CITIES.map((c) => ({ city: c, km: km({ lat, lon }, c) })).sort((a, b) => a.km - b.km);
  const live = ranked.find((r) => withEvents.has(r.city.name) && r.km <= reach);
  return live ?? ranked[0];
}
