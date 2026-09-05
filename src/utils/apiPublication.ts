import { API_BASE_URL, fetch, getHeaders } from './apiClient';

export async function apiPublicationCommandCenter(assetId: string): Promise<any | null> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/assets/${encodeURIComponent(assetId)}/command-center`, { headers: getHeaders() });
  if (res.ok) return res.json();
  if (res.status === 404) return null;
  throw new Error(`Publication command center failed (${res.status})`);
}

export async function apiCreateManuscriptVersion(assetId: string, articleType: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/assets/${encodeURIComponent(assetId)}/versions`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ article_type: articleType, dependencies: [] })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiListPublicationJournals(): Promise<Array<{ id: string; title: string; issn?: string; publisher?: string }>> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/journals`, { headers: getHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function apiShortlistPublicationJournal(assetId: string, journalId: string, position = 'PRIMARY'): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/assets/${encodeURIComponent(assetId)}/shortlist`, {
    method: 'PUT', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ journal_id: journalId, position })
  });
  return res.ok;
}

export async function apiGetManuscriptAuthorship(assetId: string, versionId: string): Promise<any | null> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/assets/${encodeURIComponent(assetId)}/versions/${encodeURIComponent(versionId)}/authorship`, { headers: getHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function apiAddManuscriptAuthor(assetId: string, versionId: string, payload: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/assets/${encodeURIComponent(assetId)}/versions/${encodeURIComponent(versionId)}/authorship`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return res.ok;
}

export async function apiCreatePublicationSubmission(assetId: string, payload: { journal_id: string; manuscript_version_id: string }): Promise<any | null> {
  const res = await fetch(`${API_BASE_URL}/publication-intelligence/assets/${encodeURIComponent(assetId)}/submissions`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...payload, package_snapshot: {} })
  });
  if (!res.ok) return null;
  return res.json();
}
