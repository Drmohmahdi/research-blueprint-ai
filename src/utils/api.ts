import type { ResearchProject, SimulationParameters, SimulationResult } from '../types/research';
import { analyzeTitle as localAnalyzeTitle } from './ruleEngine';
import type { ParsedTitle } from './ruleEngine';
import { runMonteCarloSimulation as localSimulateScores } from './simulation';
import { API_BASE_URL, API_ROOT_URL, fetch, getHeaders, ApiClientError, detailFromResponse, setApiAuthToken } from './apiClient';

export { setApiAuthToken, setApiActiveOrgId, ApiClientError, isPlanLimitError } from './apiClient';
export * from './apiThesis';
export * from './apiPublication';
export * from './apiResearchDesign';
export * from './apiResearchData';
export * from './apiPrediction';

export async function checkBackendAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${API_ROOT_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
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
    console.warn('Backend unavailable; server-authoritative project data could not be loaded');
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
    const detail = await detailFromResponse(res);
    const error = new ApiClientError(res.status, detail);
    if (error.code) throw error;
    console.error('Failed to create project on backend', res.status, detail);
  } catch (e) {
    if (e instanceof ApiClientError) throw e;
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

export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
  } catch (e) {
    console.error('Auth logout failed', e);
  }
}

export async function apiRegister(username: string, password: string, email: string, role: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, role })
    });
    if (!res.ok) return false;
    return true;
  } catch (e) {
    console.error('Auth registration failed', e);
  }
  return false;
}

export async function apiCaptureLead(payload: {
  name: string;
  email: string;
  organization?: string;
  intent?: string;
  message?: string;
  source_path?: string;
}): Promise<{ ok: boolean; intent?: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/marketing/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error('Marketing lead capture failed', e);
    return null;
  }
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
    const invite = await fetch(`${API_BASE_URL}/organizations/members/invite`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, role })
    });
    if (invite.ok) return await invite.json();
    const detail = await detailFromResponse(invite);
    const error = new ApiClientError(invite.status, detail);
    if (error.code) throw error;
  } catch (e) {
    if (e instanceof ApiClientError) throw e;
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

export async function apiAcceptInvitation(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/organizations/invitations/accept`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token }),
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
    const res = await fetch(`${API_BASE_URL}/organizations/billing/subscribe`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ plan_code: planCode }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Subscribe failed', e);
  }
  return null;
}

export async function apiGetMe(): Promise<{
  id: string;
  username: string;
  email: string;
  role: string;
  account_status?: string;
  is_global_admin?: boolean;
  org_id?: string | null;
  org_role?: string | null;
  permissions?: string[];
  email_verified?: boolean;
} | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Get current user failed', e);
  }
  return null;
}

export async function apiVerifyEmail(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch (e) {
    console.error('Verify email failed', e);
    return false;
  }
}

export async function apiResendVerification(): Promise<{ ok: boolean; email_verified?: boolean; verification_token?: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Resend verification failed', e);
  }
  return null;
}

export type MarketingLead = {
  id: string;
  name: string;
  email: string;
  organization?: string | null;
  intent: string;
  message?: string | null;
  source_path?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export async function apiListMarketingLeads(): Promise<MarketingLead[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/leads`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('List marketing leads failed', e);
  }
  return null;
}

export async function apiUpdateMarketingLead(id: string, payload: { status: string; notes?: string }): Promise<MarketingLead | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Update marketing lead failed', e);
  }
  return null;
}

export async function apiForgotPassword(email: string): Promise<{ ok: boolean; reset_token?: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Forgot password failed', e);
  }
  return null;
}

export async function apiResetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return res.ok;
  } catch (e) {
    console.error('Reset password failed', e);
  }
  return false;
}

export async function apiDeleteProjectComment(commentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.ok;
  } catch (e) {
    console.error('Delete comment failed', e);
  }
  return false;
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

// ── Phase Admin: Platform Settings & System Status ───────────────────────────

export interface PlatformSettingsResponse {
  settings: Record<string, unknown>;
  settings_meta: Record<string, {
    key: string;
    value: unknown;
    value_type: string;
    description_ar?: string | null;
    description_en?: string | null;
    updated_at?: string | null;
  }>;
  feature_flags: Record<string, boolean>;
}

export interface SystemStatusResponse {
  version: string;
  database: string;
  storage: string;
  ai_provider: string;
  payment_provider: string;
  counts: Record<string, number>;
  recent_audit_count: number;
}

export async function apiGetFeatureFlags(): Promise<Record<string, boolean> | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/feature-flags`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json() as { feature_flags?: Record<string, boolean> };
      return data.feature_flags ?? {};
    }
  } catch (e) {
    console.error('Get feature flags failed', e);
  }
  return null;
}

export async function apiGetAdminSettings(): Promise<PlatformSettingsResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/settings`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Get admin settings failed', e);
  }
  return null;
}

export async function apiUpdateAdminSettings(settings: Record<string, unknown>): Promise<PlatformSettingsResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/settings`, {
      method: 'PUT',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Update admin settings failed', e);
  }
  return null;
}

export async function apiGetSystemStatus(): Promise<SystemStatusResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/status`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Get system status failed', e);
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

export async function apiGetPublicProfile(username: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/public/${encodeURIComponent(username)}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to fetch public profile', e);
  }
  return null;
}

export function apiGetPublicPhotoUrl(username: string): string {
  return `${API_BASE_URL}/academic-foundation/public/${encodeURIComponent(username)}/photo`;
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


// ── Literature Synthesis & PRISMA Flow Persistence API ─────────────────────

export interface LiteratureStudyItem {
  id: string;
  author: string;
  year: number;
  sampleSize: number;
  effectSize: number;
  ciLower: number;
  ciUpper: number;
  source?: 'manual' | string;
  doi?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiteratureSynthesisData {
  projectId: string;
  studies: LiteratureStudyItem[];
  totalStudies: number;
  totalSampleCount: number;
  pooledEffectSize: number;
  pooledLower: number;
  pooledUpper: number;
  heterogeneityQ: number;
  heterogeneityI2: number;
}

export interface PrismaFlowData {
  id?: string;
  projectId?: string;
  organizationId?: string;
  identified: number;
  duplicates: number;
  excludedScreening: number;
  excludedEligibility: number;
  screened?: number;
  eligible?: number;
  included?: number;
  source?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function apiGetLiteratureSynthesis(projectId: string): Promise<LiteratureSynthesisData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('apiGetLiteratureSynthesis failed', e);
  }
  return null;
}

export async function apiAddLiteratureStudy(
  projectId: string,
  study: Omit<LiteratureStudyItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<LiteratureStudyItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis/studies`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(study)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiAddLiteratureStudy failed', e);
  }
  return null;
}

export async function apiUpdateLiteratureStudy(
  projectId: string,
  studyId: string,
  payload: { sampleSize?: number; effectSize?: number; ciLower?: number; ciUpper?: number; notes?: string }
): Promise<LiteratureStudyItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis/studies/${encodeURIComponent(studyId)}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiUpdateLiteratureStudy failed', e);
  }
  return null;
}

export async function apiImportLiteratureStudies(
  projectId: string,
  query: string,
  source: 'crossref' | 'pubmed' = 'crossref'
): Promise<{ query: string; source: string; imported: number; skipped: number; studies: LiteratureStudyItem[] } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis/import`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query, source })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiImportLiteratureStudies failed', e);
  }
  return null;
}

export async function apiDeleteLiteratureStudy(projectId: string, studyId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis/studies/${studyId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('apiDeleteLiteratureStudy failed', e);
  }
  return false;
}

export async function apiSyncLiteratureStudies(
  projectId: string,
  studies: LiteratureStudyItem[]
): Promise<LiteratureSynthesisData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis/sync`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ studies })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiSyncLiteratureStudies failed', e);
  }
  return null;
}

export async function apiClearLiteratureSynthesis(projectId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/literature-synthesis`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('apiClearLiteratureSynthesis failed', e);
  }
  return false;
}

export async function apiGetPrismaFlow(projectId: string): Promise<PrismaFlowData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prisma-flow`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('apiGetPrismaFlow failed', e);
  }
  return null;
}

export async function apiSavePrismaFlow(projectId: string, flow: PrismaFlowData): Promise<PrismaFlowData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prisma-flow`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        identified: flow.identified,
        duplicates: flow.duplicates,
        excludedScreening: flow.excludedScreening,
        excludedEligibility: flow.excludedEligibility,
        source: flow.source || 'manual',
        notes: flow.notes
      })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiSavePrismaFlow failed', e);
  }
  return null;
}

export async function apiResetPrismaFlow(projectId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/prisma-flow`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('apiResetPrismaFlow failed', e);
  }
  return false;
}

// ── Academic Foundation / Scholarly Assets ───────────────────────────────────

export interface ScholarlyAssetData {
  id: string;
  organization_id?: string;
  owner_user_id: string;
  title_ar?: string;
  title_en?: string;
  abstract_ar?: string;
  abstract_en?: string;
  asset_type: string;
  journal_name?: string;
  publication_date?: string;
  doi?: string;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export async function apiGetScholarlyAssets(): Promise<ScholarlyAssetData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/academic-foundation/scholarly-assets`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('apiGetScholarlyAssets failed', e);
  }
  return [];
}

// ── Academic Promotion API ──────────────────────────────────────────────────


export interface PromotionCriterionData {
  id: string;
  policy_id: string;
  organization_id: string;
  code: string;
  title_ar: string;
  title_en: string;
  criterion_type: string;
  required_points: number;
  min_asset_count: number;
  rule_definition_json: Record<string, any>;
  weight: number;
  is_mandatory: boolean;
  sort_order: number;
}

export interface PromotionPolicyData {
  id: string;
  organization_id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  target_rank: string;
  version: number;
  status: string;
  is_default: boolean;
  rules_json?: Record<string, any>;
  criteria: PromotionCriterionData[];
}

export interface PromotionEvidenceItemData {
  id: string;
  promotion_application_id: string;
  scholarly_asset_id: string;
  criterion_id?: string;
  eligibility_status: string;
  calculated_points: number;
  evidence_status: string;
  evidence_snapshot_json?: Record<string, any>;
  verification_status: string;
  notes?: string;
}

export interface CriterionEvaluationResultData {
  criterion_id: string;
  code: string;
  title_ar: string;
  title_en: string;
  criterion_type: string;
  is_mandatory: boolean;
  status: 'SATISFIED' | 'PARTIALLY_SATISFIED' | 'NOT_SATISFIED' | 'MISSING_EVIDENCE';
  required_value: number;
  actual_value: number;
  required_count: number;
  actual_count: number;
  points_earned: number;
  evidence_asset_ids: string[];
  explanation_ar: string;
  explanation_en: string;
  missing_items: string[];
}

export interface PromotionEvaluationResultData {
  application_id: string;
  policy_id: string;
  policy_name_ar: string;
  policy_name_en: string;
  policy_version: number;
  target_rank: string;
  readiness_percentage: number;
  is_fully_ready: boolean;
  total_calculated_points: number;
  total_required_points: number;
  total_evidence_count: number;
  mandatory_criteria_satisfied: boolean;
  criteria_results: CriterionEvaluationResultData[];
  recommendations_ar: string[];
  recommendations_en: string[];
  evaluated_at: string;
  is_stale: boolean;
  evaluation_fingerprint: string;
  disclaimer_ar: string;
  disclaimer_en: string;
}

export interface PromotionApplicationData {
  id: string;
  organization_id: string;
  user_id: string;
  policy_id: string;
  policy_version: number;
  current_rank?: string;
  target_rank: string;
  status: string;
  readiness_percentage: number;
  total_calculated_points: number;
  evaluation_summary_json?: PromotionEvaluationResultData;
  evaluation_fingerprint?: string;
  human_review_decision?: string;
  human_review_notes?: string;
  reviewer_user_id?: string;
  reviewed_at?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  evidence_selections: PromotionEvidenceItemData[];
  committee_assignments?: Array<{ id: string; user_id: string; status: string }>;
  is_committee_member?: boolean;
  policy?: PromotionPolicyData;
}

export async function apiGetPromotionPolicies(): Promise<PromotionPolicyData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/policies`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('apiGetPromotionPolicies failed', e);
  }
  return [];
}

export async function apiGetMyPromotionApplication(): Promise<PromotionApplicationData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/my`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('apiGetMyPromotionApplication failed', e);
  }
  return null;
}

export async function apiCreatePromotionApplication(payload: {
  target_rank: string;
  policy_id?: string;
  current_rank?: string;
}): Promise<PromotionApplicationData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiCreatePromotionApplication failed', e);
  }
  return null;
}

export async function apiMapPromotionEvidence(
  applicationId: string,
  scholarlyAssetIds: string[],
  criterionId?: string
): Promise<PromotionApplicationData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/${applicationId}/evidence`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        scholarly_asset_ids: scholarlyAssetIds,
        criterion_id: criterionId
      })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiMapPromotionEvidence failed', e);
  }
  return null;
}

export async function apiRemovePromotionEvidence(
  applicationId: string,
  scholarlyAssetId: string
): Promise<PromotionApplicationData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/${applicationId}/evidence/${scholarlyAssetId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiRemovePromotionEvidence failed', e);
  }
  return null;
}

export async function apiEvaluatePromotionApplication(
  applicationId: string
): Promise<PromotionEvaluationResultData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/${applicationId}/evaluate`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiEvaluatePromotionApplication failed', e);
  }
  return null;
}

export async function apiSubmitPromotionApplication(
  applicationId: string
): Promise<PromotionApplicationData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/${applicationId}/submit`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiSubmitPromotionApplication failed', e);
  }
  return null;
}

export async function apiAssignPromotionCommittee(applicationId: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/${applicationId}/committee`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_id: userId })
    });
    return res.ok;
  } catch (e) {
    console.error('apiAssignPromotionCommittee failed', e);
  }
  return false;
}

export async function apiReviewPromotionApplication(applicationId: string, decision: string, notes: string): Promise<PromotionApplicationData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/${applicationId}/review`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ decision, notes })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiReviewPromotionApplication failed', e);
  }
  return null;
}

export async function apiListCommitteePromotionQueue(): Promise<PromotionApplicationData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/promotions/applications/committee-queue`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiListCommitteePromotionQueue failed', e);
  }
  return [];
}


// ── Peer Review Workflow & External Portal APIs ───────────────────────────────

export interface PeerReviewCriterion {
  id: string;
  rubric_id?: string;
  code: string;
  title_ar: string;
  title_en: string;
  desc_ar?: string;
  desc_en?: string;
  response_type: 'SCORE' | 'YES_NO' | 'TEXT' | 'CHOICE';
  weight: number;
  is_mandatory: boolean;
  sort_order: number;
  options_json?: any;
}

export interface PeerReviewRubric {
  id: string;
  name_ar: string;
  name_en: string;
  rubric_type: string;
  version: number;
  is_default: boolean;
  criteria: PeerReviewCriterion[];
}

export interface ReviewCommentData {
  id?: string;
  submission_id?: string;
  case_id?: string;
  round_id?: string;
  section_key?: string;
  comment_type: 'AUTHOR_VISIBLE' | 'CONFIDENTIAL_TO_EDITOR';
  comment_text: string;
  author_response_text?: string;
  is_resolved?: boolean;
}

export interface ReviewCriterionResponseData {
  criterion_id: string;
  score_value?: number;
  text_value?: string;
  choice_value?: string;
  comments?: string;
}

export interface ReviewSubmissionData {
  id?: string;
  assignment_id: string;
  round_id: string;
  case_id: string;
  status: 'DRAFT' | 'SUBMITTED';
  recommendation: 'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT';
  summary_evaluation_ar?: string;
  summary_evaluation_en?: string;
  total_weighted_score: number;
  is_confidential_to_editor: boolean;
  submitted_at?: string;
  responses: ReviewCriterionResponseData[];
  comments: ReviewCommentData[];
}

export interface ReviewerAssignmentData {
  id: string;
  case_id: string;
  round_id: string;
  reviewer_type: 'INTERNAL_REVIEWER' | 'EXTERNAL_REVIEWER';
  reviewer_user_id?: string;
  external_email?: string;
  external_name?: string;
  status: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'REVOKED';
  conflict_status: 'NO_CONFLICT' | 'POTENTIAL_CONFLICT' | 'CONFLICT_DECLARED';
  conflict_notes?: string;
  decline_reason?: string;
  due_at?: string;
  invited_at: string;
  accepted_at?: string;
  submitted_at?: string;
  submission?: ReviewSubmissionData;
  magic_link_url?: string;
}

export interface PeerReviewRoundData {
  id: string;
  case_id: string;
  round_number: number;
  manuscript_version: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  manuscript_snapshot_json?: any;
  rubric_id?: string;
  rubric_snapshot_json?: any;
  decision: 'PENDING' | 'ACCEPTED' | 'REVISION_REQUIRED' | 'REJECTED';
  decision_notes?: string;
  decision_by_user_id?: string;
  decision_at?: string;
  created_at: string;
  rubric?: PeerReviewRubric;
  assignments: ReviewerAssignmentData[];
}

export interface PeerReviewCaseData {
  id: string;
  organization_id: string;
  owner_user_id?: string;
  author_name?: string;
  editor_user_id?: string;
  /** Server-computed: does the CURRENT caller hold editorial authority over
   * this case? Always use this to gate editor-only controls — never infer
   * it from organization role, which does not imply editorial authority. */
  is_editor: boolean;
  project_id?: string;
  scholarly_asset_id?: string;
  manuscript_version_id?: string;
  manuscript_fingerprint?: string;
  publication_submission_id?: string;
  title_ar: string;
  title_en: string;
  abstract_ar?: string;
  abstract_en?: string;
  discipline?: string;
  case_type: string;
  blind_type: 'SINGLE_BLIND' | 'DOUBLE_BLIND' | 'OPEN';
  status: 'DRAFT' | 'IN_REVIEW' | 'REVISION_REQUESTED' | 'DECIDED' | 'WITHDRAWN';
  current_round_number: number;
  created_at: string;
  updated_at: string;
  rounds: PeerReviewRoundData[];
  revisions: any[];
}

export interface PeerReviewCaseSummaryData {
  id: string;
  organization_id: string;
  title_ar: string;
  title_en: string;
  case_type: string;
  blind_type: 'SINGLE_BLIND' | 'DOUBLE_BLIND' | 'OPEN';
  status: 'DRAFT' | 'IN_REVIEW' | 'REVISION_REQUESTED' | 'DECIDED' | 'WITHDRAWN';
  current_round_number: number;
  /** Server-computed — see PeerReviewCaseData.is_editor. */
  is_editor: boolean;
  active_assignments_count: number;
  completed_reviews_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExternalReviewerPortalData {
  assignment_id: string;
  case_id: string;
  round_id: string;
  round_number: number;
  manuscript_version: number;
  manuscript_title: string;
  manuscript_abstract?: string;
  case_type: string;
  blind_type: string;
  due_at?: string;
  assignment_status: string;
  conflict_status: string;
  reviewer_name?: string;
  rubric?: PeerReviewRubric;
  submission?: ReviewSubmissionData;
}

// ── Internal Peer Review API Calls ──────────────────────────────────────────

export async function apiListPeerReviewCases(): Promise<PeerReviewCaseSummaryData[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/cases`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiListPeerReviewCases failed', e);
  }
  return null;
}

export async function apiGetPeerReviewCase(caseId: string): Promise<PeerReviewCaseData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/cases/${caseId}`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiGetPeerReviewCase failed', e);
  }
  return null;
}

export async function apiCreatePeerReviewCase(payload: {
  title_ar: string;
  title_en: string;
  abstract_ar?: string;
  abstract_en?: string;
  case_type?: string;
  blind_type?: string;
  project_id?: string;
}): Promise<PeerReviewCaseData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/cases`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiCreatePeerReviewCase failed', e);
  }
  return null;
}

export async function apiGetMyReviewerAssignments(): Promise<ReviewerAssignmentData[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/assignments/my`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiGetMyReviewerAssignments failed', e);
  }
  return null;
}

export async function apiAcceptReviewAssignment(
  assignmentId: string,
  conflictStatus: string = 'NO_CONFLICT',
  conflictNotes?: string
): Promise<ReviewerAssignmentData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/assignments/${assignmentId}/accept`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ conflict_status: conflictStatus, conflict_notes: conflictNotes })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiAcceptReviewAssignment failed', e);
  }
  return null;
}

export async function apiDeclineReviewAssignment(
  assignmentId: string,
  reason?: string
): Promise<ReviewerAssignmentData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/assignments/${assignmentId}/decline`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ decline_reason: reason })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiDeclineReviewAssignment failed', e);
  }
  return null;
}

export async function apiSaveReviewDraft(
  assignmentId: string,
  payload: {
    recommendation?: string;
    summary_evaluation_ar?: string;
    summary_evaluation_en?: string;
    is_confidential_to_editor?: boolean;
    responses: ReviewCriterionResponseData[];
    comments: ReviewCommentData[];
  }
): Promise<ReviewSubmissionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/assignments/${assignmentId}/draft`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiSaveReviewDraft failed', e);
  }
  return null;
}

export async function apiSubmitCompletedReview(
  assignmentId: string,
  payload: {
    recommendation: string;
    summary_evaluation_ar?: string;
    summary_evaluation_en?: string;
    is_confidential_to_editor?: boolean;
    responses: ReviewCriterionResponseData[];
    comments: ReviewCommentData[];
  }
): Promise<ReviewSubmissionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiSubmitCompletedReview failed', e);
  }
  return null;
}

export async function apiAssignReviewerToRound(
  roundId: string,
  payload: {
    reviewer_type: 'INTERNAL_REVIEWER' | 'EXTERNAL_REVIEWER';
    reviewer_user_id?: string;
    external_email?: string;
    external_name?: string;
    due_at?: string;
  }
): Promise<ReviewerAssignmentData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/rounds/${roundId}/assignments`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiAssignReviewerToRound failed', e);
  }
  return null;
}

export async function apiRecordEditorialDecision(
  caseId: string,
  decision: 'ACCEPTED' | 'REVISION_REQUIRED' | 'REJECTED',
  notes: string
): Promise<PeerReviewCaseData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/cases/${caseId}/decision`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ decision, decision_notes: notes })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiRecordEditorialDecision failed', e);
  }
  return null;
}

export async function apiStartPeerReviewRound(caseId: string): Promise<PeerReviewRoundData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/cases/${caseId}/rounds`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiStartPeerReviewRound failed', e);
  }
  return null;
}

export async function apiUploadManuscriptRevision(caseId: string, payload: {
  title_ar: string;
  title_en: string;
  abstract_ar?: string;
  abstract_en?: string;
  response_to_reviewers?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/peer-reviews/cases/${caseId}/revisions`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (e) {
    console.error('apiUploadManuscriptRevision failed', e);
  }
  return false;
}

// ── External Reviewer Portal API Calls ──────────────────────────────────────

export async function apiGetExternalReviewPortal(token: string): Promise<ExternalReviewerPortalData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/external-reviews/portal/${token}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiGetExternalReviewPortal failed', e);
  }
  return null;
}

export async function apiExternalAcceptReview(
  token: string,
  conflictStatus: string = 'NO_CONFLICT',
  conflictNotes?: string
): Promise<ExternalReviewerPortalData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/external-reviews/portal/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflict_status: conflictStatus, conflict_notes: conflictNotes })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiExternalAcceptReview failed', e);
  }
  return null;
}

export async function apiExternalDeclineReview(token: string, reason?: string): Promise<ExternalReviewerPortalData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/external-reviews/portal/${token}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decline_reason: reason })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiExternalDeclineReview failed', e);
  }
  return null;
}

export async function apiExternalSaveDraft(
  token: string,
  payload: {
    recommendation?: string;
    summary_evaluation_ar?: string;
    summary_evaluation_en?: string;
    is_confidential_to_editor?: boolean;
    responses: ReviewCriterionResponseData[];
    comments: ReviewCommentData[];
  }
): Promise<ReviewSubmissionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/external-reviews/portal/${token}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiExternalSaveDraft failed', e);
  }
  return null;
}

export async function apiExternalSubmitReview(
  token: string,
  payload: {
    recommendation: string;
    summary_evaluation_ar?: string;
    summary_evaluation_en?: string;
    is_confidential_to_editor?: boolean;
    responses: ReviewCriterionResponseData[];
    comments: ReviewCommentData[];
  }
): Promise<ReviewSubmissionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/external-reviews/portal/${token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiExternalSubmitReview failed', e);
  }
  return null;
}

// ── Phase 05: Academic Reporting & Export Engine API ────────────────────────

export interface ReportExportRequestPayload {
  report_type: 'RESEARCH_PROJECT' | 'LITERATURE_SYNTHESIS' | 'PRISMA_FLOW' | 'PROMOTION_READINESS' | 'PEER_REVIEW' | 'ACADEMIC_PROFILE';
  source_id: string;
  format: 'PDF' | 'DOCX' | 'JSON';
  language?: 'ar' | 'en' | 'bilingual';
  audience?: 'RESEARCHER' | 'AUTHOR' | 'SUPERVISOR' | 'COMMITTEE' | 'ADMIN' | 'PUBLIC';
  template_version?: string;
}

export interface ReportVerificationResult {
  valid: boolean;
  verification_code: string;
  report_type?: string;
  organization_name?: string;
  generated_at?: string;
  document_hash?: string;
  message: string;
}

export async function apiExportAcademicReport(
  payload: ReportExportRequestPayload
): Promise<{ blob: Blob; filename: string; integrityHash?: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/export`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('apiExportAcademicReport failed:', res.status, res.statusText);
      return null;
    }

    const disposition = res.headers.get('Content-Disposition') || '';
    let filename = `baseerah-${payload.report_type.toLowerCase()}.${payload.format.toLowerCase()}`;
    const filenameMatch = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
    if (filenameMatch && filenameMatch[1]) {
      filename = decodeURIComponent(filenameMatch[1]);
    }

    const integrityHash = res.headers.get('X-Report-Integrity-Hash') || undefined;
    const blob = await res.blob();
    return { blob, filename, integrityHash };
  } catch (e) {
    console.error('apiExportAcademicReport network error:', e);
    return null;
  }
}

export async function apiGetCanonicalReportContext(
  payload: ReportExportRequestPayload
): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/context`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiGetCanonicalReportContext failed:', e);
  }
  return null;
}

export async function apiVerifyReport(
  code: string
): Promise<ReportVerificationResult | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/verify/${encodeURIComponent(code)}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiVerifyReport failed:', e);
  }
  return null;
}

// ── Phase 06: Academic Workflow Events & Notifications API ──────────────────

export interface InAppNotification {
  id: string;
  organization_id: string;
  recipient_user_id: string;
  category: 'PROMOTION' | 'PEER_REVIEW' | 'RESEARCH_WORKFLOW' | 'SYSTEM' | string;
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  target_type?: string | null;
  target_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResult {
  items: InAppNotification[];
  total: number;
  unread_count: number;
  page: number;
  limit: number;
}

export interface NotificationPreferenceItem {
  category: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  updated_at?: string | null;
}

export async function apiListNotifications(
  page: number = 1,
  limit: number = 20,
  unreadOnly: boolean = false,
  category?: string
): Promise<NotificationListResult | null> {
  try {
    let url = `${API_BASE_URL}/notifications?page=${page}&limit=${limit}`;
    if (unreadOnly) url += '&unread_only=true';
    if (category) url += `&category=${encodeURIComponent(category)}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiListNotifications failed:', e);
  }
  return null;
}

export async function apiGetUnreadNotificationCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      return data.unread_count || 0;
    }
  } catch (e) {
    console.error('apiGetUnreadNotificationCount failed:', e);
  }
  return 0;
}

export async function apiMarkNotificationRead(id: string): Promise<InAppNotification | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiMarkNotificationRead failed:', e);
  }
  return null;
}

export async function apiMarkNotificationUnread(id: string): Promise<InAppNotification | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/unread`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('apiMarkNotificationUnread failed:', e);
  }
  return null;
}

export async function apiMarkAllNotificationsRead(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('apiMarkAllNotificationsRead failed:', e);
  }
  return false;
}

export async function apiGetNotificationPreferences(): Promise<NotificationPreferenceItem[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/preferences`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      return data.preferences || [];
    }
  } catch (e) {
    console.error('apiGetNotificationPreferences failed:', e);
  }
  return null;
}

export async function apiUpdateNotificationPreferences(
  preferences: NotificationPreferenceItem[]
): Promise<NotificationPreferenceItem[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ preferences })
    });
    if (res.ok) {
      const data = await res.json();
      return data.preferences || [];
    }
  } catch (e) {
    console.error('apiUpdateNotificationPreferences failed:', e);
  }
  return null;
}

// ── Phase 08: Secure Files & Storage Operations API ─────────────────────────

export interface UploadedFileResponse {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  classification: string;
  created_at: string;
}

export async function apiUploadFile(
  fileOrProjectId?: File | string,
  maybeFile?: File,
  classification: string = 'INTERNAL',
  category: string = 'RESEARCH_ATTACHMENT'
): Promise<UploadedFileResponse | null> {
  try {
    let file: File | undefined;
    let projectId: string | undefined;

    if (fileOrProjectId instanceof File) {
      file = fileOrProjectId;
      projectId = undefined;
    } else {
      projectId = typeof fileOrProjectId === 'string' ? fileOrProjectId : undefined;
      file = maybeFile;
    }

    if (!file) {
      console.error('apiUploadFile: No file provided');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);
    formData.append('classification', classification);
    formData.append('category', category);

    const headers = getHeaders();
    delete (headers as any)['Content-Type'];

    const res = await fetch(`${API_BASE_URL}/storage/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('apiUploadFile failed:', e);
  }
  return null;
}

export async function apiListFiles(projectId?: string): Promise<UploadedFileResponse[] | null> {
  try {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const res = await fetch(`${API_BASE_URL}/storage/files${query}`, { headers: getHeaders() });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('apiListFiles failed:', e);
  }
  return null;
}

export async function apiGetFileMetadata(fileId: string): Promise<UploadedFileResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/storage/files/${fileId}`, { headers: getHeaders() });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('apiGetFileMetadata failed:', e);
  }
  return null;
}

export async function apiDeleteFile(fileId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/storage/files/${fileId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error('apiDeleteFile failed:', e);
  }
  return false;
}

export function apiDownloadFileUrl(fileId: string): string {
  return `${API_BASE_URL}/storage/files/${encodeURIComponent(fileId)}/download`;
}

export function apiGetDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/storage/files/${encodeURIComponent(fileId)}/download`;
}

export function apiDownloadExternalManuscriptUrl(token: string): string {
  return `${API_BASE_URL}/external-reviews/portal/${encodeURIComponent(token)}/manuscript`;
}

// ── Phase 09: Unified Search & Academic Discovery ────────────────────────────

export interface SearchResultItem {
  domain: string;
  entity_id: string;
  title: string;
  subtitle?: string | null;
  snippet?: string | null;
  status?: string | null;
  updated_at?: string | null;
  target?: string | null;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  domains: string[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  results: SearchResultItem[];
  domain_counts: Record<string, number>;
  hidden_domains: string[];
}

export const SEARCH_DOMAINS = [
  'PROJECT', 'LITERATURE', 'ASSET', 'PROFILE', 'PROMOTION', 'PEER_REVIEW', 'FILE', 'THESIS'
] as const;

export type SearchSort = 'relevance' | 'newest' | 'oldest' | 'title' | 'year';

export interface SearchParams {
  q?: string;
  domains?: string[];
  filters?: Record<string, unknown>;
  sort?: SearchSort;
  page?: number;
  limit?: number;
}

export async function apiSearch(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse | null> {
  try {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.domains?.length) query.set('domains', params.domains.join(','));
    if (params.filters && Object.keys(params.filters).length > 0) {
      query.set('filters', JSON.stringify(params.filters));
    }
    query.set('sort', params.sort ?? 'relevance');
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 20));
    const res = await fetch(`${API_BASE_URL}/search?${query.toString()}`, {
      headers: getHeaders(),
      signal
    });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    console.error('apiSearch failed:', e);
    return null;
  }
}

// ── Phase 10: Governed Academic AI ───────────────────────────────────────────

export interface AISourceRef {
  type: string;
  source_id: string;
  title?: string | null;
}

export interface AIUsageSummary {
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_tokens?: number | null;
}

export interface AIAssistResponse {
  use_case: string;
  prompt_version: number;
  provider: string;
  model?: string | null;
  text: string;
  structured?: Record<string, unknown> | null;
  sources: AISourceRef[];
  grounded: boolean;
  requires_verification: boolean;
  human_authority: boolean;
  ai_generated: boolean;
  usage?: AIUsageSummary | null;
}

export const AI_USE_CASES = [
  'RESEARCH_QUESTION_ASSIST',
  'LITERATURE_SYNTHESIS_ASSIST',
  'METHODOLOGY_EXPLANATION',
  'ABSTRACT_DRAFT',
  'REVIEW_SUMMARY',
  'REVISION_CHECKLIST',
  'PROMOTION_EVIDENCE_SUMMARY',
  'ACADEMIC_WRITING_ASSIST',
] as const;

export type AIUseCaseName = (typeof AI_USE_CASES)[number];

export interface AIAssistParams {
  use_case: AIUseCaseName;
  question?: string;
  text?: string;
  project_id?: string;
  study_ids?: string[];
  case_id?: string;
  application_id?: string;
}

export async function apiAIAssist(
  params: AIAssistParams,
  signal?: AbortSignal
): Promise<AIAssistResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ai/assist`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal
    });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    console.error('apiAIAssist failed:', e);
    return null;
  }
}
