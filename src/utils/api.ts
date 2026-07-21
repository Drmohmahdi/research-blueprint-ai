import type { ResearchProject, SimulationParameters, SimulationResult } from '../types/research';
import { analyzeTitle as localAnalyzeTitle } from './ruleEngine';
import type { ParsedTitle } from './ruleEngine';
import { runMonteCarloSimulation as localSimulateScores } from './simulation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');

let authToken: string | null = null;
let activeOrgId: string | null = localStorage.getItem('rb_active_org_id');

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

export function setApiActiveOrgId(orgId: string | null) {
  activeOrgId = orgId;
  if (orgId) {
    localStorage.setItem('rb_active_org_id', orgId);
  } else {
    localStorage.removeItem('rb_active_org_id');
  }
}

function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (activeOrgId) {
    headers['X-Organization-ID'] = activeOrgId;
  }
  return headers;
}

// Helper to check if backend is running
export async function checkBackendAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${API_ROOT_URL}/`, { method: 'GET', signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiListProjects(): Promise<ResearchProject[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch  {
    console.warn('Backend offline, using localStorage fallback');
  }
  return null;
}

export async function apiCreateProject(project: Omit<ResearchProject, 'id' | 'version'>): Promise<ResearchProject | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(project)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to create project on backend', e);
  }
  return null;
}

export async function apiUpdateProject(project: ResearchProject): Promise<ResearchProject | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(project)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to update project on backend', e);
  }
  return null;
}

export async function apiDeleteProject(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('Failed to delete project on backend', e);
  }
  return false;
}

export async function apiAnalyzeTitle(title: string): Promise<ParsedTitle> {
  try {
    const res = await fetch(`${API_BASE_URL}/analyzer/analyze-title`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        independentVariables: data.independentVariables || [],
        dependentVariables: data.dependentVariables || [],
        mediators: data.mediators || [],
        moderators: data.moderators || [],
        controls: data.controls || [],
        population: data.population,
        context: data.context,
        suggestedMethodology: data.suggestedMethodology,
        confidence: data.confidence,
        ambiguities: data.ambiguities,
        followUpQuestions: data.followUpQuestions,
        isFallback: data.isFallback
      };
    }
  } catch  {
    console.warn('Backend analyzer offline, falling back to rule engine');
  }
  return localAnalyzeTitle(title);
}

export async function apiSimulateScores(sampleSize: number, params: SimulationParameters): Promise<SimulationResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats/simulate-scores?sampleSize=${sampleSize}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    if (res.ok) return await res.json();
  } catch  {
    console.warn('Backend stats service offline, falling back to client-side Monte Carlo');
  }
  return localSimulateScores(sampleSize, params);
}

export async function apiInspectData(file: File, language: 'ar' | 'en'): Promise<{ qualityScore: number; issues: string[] } | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/stats/inspect-data?lang=${language}`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Backend stats service inspect offline', e);
  }
  return null;
}

export async function apiLogin(username: string, password: string): Promise<{ token: string; username: string; role: string; userId?: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      setApiAuthToken(data.token);
      return data;
    }
  } catch (e) {
    console.error('Auth login failed', e);
  }
  return null;
}

export async function apiRegister(username: string, password: string, email: string, role: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, role })
    });
    return res.ok;
  } catch (e) {
    console.error('Auth registration failed', e);
  }
  return false;
}

export async function apiValidateReadiness(projectId: string): Promise<{ readinessScore: number; isReady: boolean; recommendations: string[] } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/validate-readiness`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Readiness validation failed', e);
  }
  return null;
}

export async function apiRunLiteratureForecast(projectId: string, studies: any[], alpha?: number): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/literature-forecast`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ studies, alpha })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Literature forecast failed', e);
  }
  return null;
}

export async function apiRunPilotForecast(
  projectId: string,
  priorMean: number,
  priorVariance: number,
  treatmentScores: number[],
  controlScores: number[],
  alpha?: number
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/pilot-forecast`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ priorMean, priorVariance, treatmentScores, controlScores, alpha })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Pilot forecast failed', e);
  }
  return null;
}

export async function apiRunDynamicForecast(projectId: string, cohort: any[]): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/dynamic-forecast`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ cohort })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Dynamic forecast failed', e);
  }
  return null;
}

export async function apiGetPredictionModels(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/prediction/models`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Fetch prediction models failed', e);
  }
  return null;
}

export async function apiTrainPredictionModel(projectId: string, modelName: string, version: string, features: string[]): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/train`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ modelName, version, features })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Train model failed', e);
  }
  return null;
}

export async function apiRunPredictionRun(projectId: string, body: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/run`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Run prediction run failed', e);
  }
  return null;
}

export async function apiListPredictionRuns(projectId: string): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/runs`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List prediction runs failed', e);
  }
  return null;
}

export async function apiGetPredictionRunDetails(projectId: string, runId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/runs/${runId}`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Get prediction run details failed', e);
  }
  return null;
}

export async function apiCompareObservedOutcome(projectId: string, runId: string, comparison: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prediction/runs/${runId}/compare-observed`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(comparison)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Compare observed outcome failed', e);
  }
  return null;
}

export async function apiUpdateProjectWorkflowProfile(
  projectId: string,
  payload: { activePathId?: string; completedSteps?: string[]; intelligenceProfile?: any }
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/workflow-profile`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to update workflow profile on backend', e);
  }
  return null;
}

// ── SaaS Organization API Helpers ───────────────────────────────────────────
export async function apiListOrganizations(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List organizations failed', e);
  }
  return null;
}

export async function apiGetActiveOrganization(): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/active`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Get active organization failed', e);
  }
  return null;
}

export async function apiCreateOrganization(name: string, parentId?: string | null): Promise<any | null> {
  const slug = name.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '') // remove non-alphanumeric except spaces and hyphens
    .replace(/[\s_]+/g, '-') // convert spaces and underscores to hyphens
    .replace(/^-+|-+$/g, '') // trim hyphens
    + '-' + Math.random().toString(36).substring(2, 6);

  try {
    const res = await fetch(`${API_BASE_URL}/organizations`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, slug, parent_id: parentId })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Create organization failed', e);
  }
  return null;
}

export async function apiListMembers(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/members`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List members failed', e);
  }
  return null;
}

export async function apiInviteMember(email: string, role: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/members/invite`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, role })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Invite member failed', e);
  }
  return null;
}

export async function apiListInvitations(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/invitations`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List invitations failed', e);
  }
  return null;
}

export async function apiAcceptInvitation(inviteId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/invitations/${inviteId}/accept`, {
      method: 'POST',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('Accept invitation failed', e);
  }
  return false;
}

export async function apiGetBilling(): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/billing`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Get billing failed', e);
  }
  return null;
}

export async function apiSubscribe(planCode: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/billing/subscribe?plan_code=${planCode}`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Subscribe failed', e);
  }
  return null;
}

export async function apiListAuditLogs(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/audit-logs`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List audit logs failed', e);
  }
  return null;
}

export async function apiListPlans(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/plans`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List plans failed', e);
  }
  return null;
}

// ── Cloud Storage File Operations ───────────────────────────────────────────
export async function apiUploadFile(projectId: string, file: File): Promise<any | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    const res = await fetch(`${API_BASE_URL}/storage/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Upload file failed', e);
  }
  return null;
}

export async function apiListFiles(projectId: string): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/storage/list?project_id=${projectId}`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List files failed', e);
  }
  return null;
}

export function apiGetDownloadUrl(fileId: string): string {
  const activeOrg = localStorage.getItem('rb_active_org_id') || 'personal';
  return `${API_BASE_URL}/storage/download/${activeOrg}/${fileId}`;
}

export async function apiGetPublicProfile(username: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/public/${encodeURIComponent(username)}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to fetch public profile', e);
  }
  return null;
}

export async function apiGetMyProfile(): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/profile/me`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to fetch profile', e);
  }
  return null;
}

export async function apiUpsertProfile(profile: any): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/profile/upsert`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(profile)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to upsert profile', e);
  }
  return null;
}

export async function apiListScholarlyAssets(): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/scholarly-assets`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to list assets', e);
  }
  return null;
}

export async function apiCreateScholarlyAsset(asset: any): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/scholarly-assets`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(asset)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to create asset', e);
  }
  return null;
}

export async function apiUpdateScholarlyAsset(assetId: string, asset: any): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/scholarly-assets/${assetId}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(asset)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to update asset', e);
  }
  return null;
}

export async function apiDeleteScholarlyAsset(assetId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/scholarly-assets/${assetId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('Failed to delete asset', e);
  }
  return false;
}


export async function apiListProjectComments(projectId: string, step?: string): Promise<any[] | null> {
  try {
    let url = `${API_BASE_URL}/comments/project/${projectId}`;
    if (step) {
      url += `?step=${step}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List comments failed', e);
  }
  return null;
}

export async function apiCreateProjectComment(body: { projectId: string; contentAr: string; step?: string; priority?: string }): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/comments/`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Create comment failed', e);
  }
  return null;
}

export async function apiResolveProjectComment(commentId: string, resolved: boolean): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/comments/${commentId}/resolve`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resolved })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Resolve comment failed', e);
  }
  return null;
}



