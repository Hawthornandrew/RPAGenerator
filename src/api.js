const BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'   // local API server for dev
  : '';                       // same origin in production

/** Fetch the saved coordinate map from the server */
export async function fetchCoordinates() {
  const res = await fetch(`${BASE}/api/coordinates`);
  if (!res.ok) throw new Error(`Failed to load coordinates: ${res.status}`);
  return res.json();
}

/** Save a new coordinate map to the server (admin only) */
export async function saveCoordinates(coordinates, adminPin) {
  const res = await fetch(`${BASE}/api/coordinates`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Admin-Pin':   adminPin,
    },
    body: JSON.stringify(coordinates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data;
}

/** Fetch the RPA template PDF as a Uint8Array */
export async function fetchTemplate() {
  const res = await fetch(`${BASE}/api/template`);
  if (!res.ok) throw new Error(`Failed to load template: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
