import { API_BASE_URL, fetch, getHeaders } from './apiClient';

// ── Research Design Intelligence ─────────────────────────────────────────────

export async function apiResearchDesignCommandCenter(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/command-center`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Research design command center failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignCoherence(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/coherence`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Coherence failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignReadiness(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/readiness`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Readiness failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignNextAction(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/next-action`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Next action failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignDesignMap(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/design-map`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Design map failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignSection(projectId: string, section: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(section)}`, { headers: getHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Section fetch failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignSaveSection(projectId: string, section: string, data: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(section)}`, {
    method: 'PUT', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ data })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiResearchDesignCreateProtocol(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/protocols`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiResearchDesignProtocols(projectId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/protocols`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Protocols failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignTeam(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/team`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Team failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignAddMember(projectId: string, user_id: string, relationship: string, assigned_sections?: string[]): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/team`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user_id, relationship, assigned_sections: assigned_sections ?? [] })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiResearchDesignReviews(projectId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/reviews`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Reviews failed (${res.status})`);
  return res.json();
}

export async function apiResearchOfficeOperations(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/organization/operations`, { headers: getHeaders() });
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Research office operations failed (${res.status})`);
  return res.json();
}

export async function apiResearchDesignMethodology(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/research-design/projects/${encodeURIComponent(projectId)}/methodology-recommendation`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Methodology recommendation failed (${res.status})`);
  return res.json();
}
