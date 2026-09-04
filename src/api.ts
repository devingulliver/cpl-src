export type Item = {
  id: string;
  title: string;
  sourceDate: string;
  archiveDate: string;
  author: string;
  description: string;
  collection: string;
  sport: string;
  team: string;
  format: string;
  year: number | null;
  image: string;
  audio: string;
  transcript: string;
  transcriptUrl: string;
  filesize: number | null;
};

const apiBase = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchItems() {
  return request<Item[]>('/api/items').then((items) => items.map((item) => ({
    ...item,
    transcriptUrl: item.transcriptUrl ? `${apiBase}${item.transcriptUrl}` : '',
  })));
}

export function saveItem(item: Item) {
  return request<{ saved: boolean }>(`/api/items/${encodeURIComponent(item.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
}

export function createItem(item: Item) {
  return request<Item>('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
}

export function deleteItem(id: string) {
  return request<{ deleted: boolean }>(`/api/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
