const BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';

export async function fetchCoordinates() {
  const res = await fetch(`${BASE}/api/coordinates`);
  if (!res.ok) throw new Error(`Failed to load coordinates: ${res.status}`);
  return res.json();
}

export async function saveCoordinates(coordinates, adminPin) {
  const res = await fetch(`${BASE}/api/coordinates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin },
    body: JSON.stringify(coordinates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data;
}

export async function fetchFields() {
  const res = await fetch(`${BASE}/api/fields`);
  if (!res.ok) throw new Error(`Failed to load fields: ${res.status}`);
  return res.json();
}

export async function saveFields(fields, adminPin) {
  const res = await fetch(`${BASE}/api/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data;
}

export async function fetchTemplate() {
  const res = await fetch(`${BASE}/api/template`);
  if (!res.ok) throw new Error(`Failed to load template: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
