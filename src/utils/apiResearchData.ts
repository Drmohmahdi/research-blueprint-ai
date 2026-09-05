import { API_BASE_URL, fetch, getHeaders } from './apiClient';

export type LifecycleStage = {
  key: string;
  status: 'NOT_STARTED' | 'AVAILABLE' | 'IN_PROGRESS' | 'BLOCKED' | 'READY_FOR_HANDOFF' | 'HANDED_OFF' | 'COMPLETED' | 'STALE' | 'NOT_REQUIRED' | 'DEFERRED_CAPABILITY';
  readiness: number;
  blockers: string[];
  outputs: Array<{ type: string; id: string; title?: string; status?: string; approved?: boolean }>;
  next_action?: string | null;
};

export type ResearchLifecycleSummary = {
  lifecycle_id: string;
  project_id: string;
  template: string;
  template_version: number;
  progress: number;
  current_stage: string;
  current_stage_readiness: number;
  next_action: { priority: string; stage: string; title: string; rationale: string; computed_by: string };
  stages: LifecycleStage[];
  project: { id: string; title_ar: string; title_en: string; research_type: string; lead_researcher_id: string; organization_id: string };
};

export async function apiGetResearchLifecycle(projectId: string): Promise<ResearchLifecycleSummary | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Failed to load research lifecycle', error);
  }
  return null;
}

export async function apiGetResearchTimeline(projectId: string): Promise<{ events: Array<Record<string, string>> } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}/timeline`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Failed to load research timeline', error);
  }
  return null;
}

export async function apiGetResearchLineage(projectId: string): Promise<{ edges: Array<{ id: string; source: { type: string; id: string; version?: string }; relationship: string; target: { type: string; id: string; version?: string }; created_at: string }> } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}/lineage`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Failed to load research lineage', error);
  }
  return null;
}

export type AcademicHandoffSummary = {
  id: string; project_id: string; handoff_type: string; source_entity_type: string;
  source_entity_id: string; source_version?: string; target_domain: string;
  target_entity_type?: string; target_entity_id?: string; schema_version: number;
  status: string; created_at: string; accepted_at?: string; stale_at?: string;
};

export async function apiListAcademicHandoffs(projectId: string): Promise<AcademicHandoffSummary[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}/handoffs`, { headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Failed to list academic handoffs', error);
  }
  return [];
}

export async function apiCreateAcademicHandoff(projectId: string, handoffType: string, sourceId: string, targetId?: string): Promise<AcademicHandoffSummary | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}/handoffs`, {
      method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ handoff_type: handoffType, source_id: sourceId, target_id: targetId }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Failed to create academic handoff', error);
  }
  return null;
}

export async function apiAcceptAcademicHandoff(projectId: string, handoffId: string): Promise<AcademicHandoffSummary | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}/handoffs/${handoffId}/accept`, { method: 'POST', headers: getHeaders() });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Failed to accept academic handoff', error);
  }
  return null;
}

export async function apiApproveAnalysisResult(projectId: string, analysisId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/research-lifecycle/projects/${projectId}/analyses/${analysisId}/approve`, { method: 'POST', headers: getHeaders() });
    return res.ok;
  } catch (error) {
    console.error('Failed to approve analysis result', error);
  }
  return false;
}

export async function apiUploadResearchDatasetFile(file: File, projectId: string): Promise<{id:string}|null> {
  const form = new FormData(); form.append('file', file); form.append('projectId', projectId); form.append('category', 'RESEARCH_ATTACHMENT'); form.append('classification', 'CONFIDENTIAL_RESEARCH');
  const res = await fetch(`${API_BASE_URL}/storage/upload`, { method:'POST', headers:getHeaders(), body:form });
  if (!res.ok) return null; return await res.json();
}

export async function apiImportResearchDataset(payload: {project_id:string;uploaded_file_id:string;name:string;source_type:string;sensitivity:string}) {
  const res = await fetch(`${API_BASE_URL}/research-data/datasets`, {method:'POST',headers:getHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)});
  if (!res.ok) throw new Error('Dataset import failed'); return await res.json();
}

export async function apiGetResearchDataCommandCenter(projectId:string) {
  const res = await fetch(`${API_BASE_URL}/research-data/projects/${encodeURIComponent(projectId)}/command-center`, {headers:getHeaders()});
  if (!res.ok) return null; return await res.json();
}

async function researchDataJson(path:string, init:RequestInit = {}) {
  const res=await fetch(`${API_BASE_URL}/research-data${path}`,{...init,headers:getHeaders({'Content-Type':'application/json',...((init.headers as Record<string,string>)||{})})});
  if(!res.ok) throw new Error(`Research data request failed: ${res.status}`); return await res.json();
}
export const apiGetResearchDataset=(id:string)=>researchDataJson(`/datasets/${encodeURIComponent(id)}`);
export const apiGetDatasetVersions=(id:string)=>researchDataJson(`/datasets/${encodeURIComponent(id)}/versions`);
export const apiGetDatasetIssues=(id:string)=>researchDataJson(`/datasets/${encodeURIComponent(id)}/issues`);
export const apiGetDatasetAnalyses=(id:string)=>researchDataJson(`/datasets/${encodeURIComponent(id)}/analyses`);
export const apiUpdateDatasetVariable=(datasetId:string,variableId:string,payload:Record<string,unknown>)=>researchDataJson(`/datasets/${encodeURIComponent(datasetId)}/variables/${encodeURIComponent(variableId)}`,{method:'PATCH',body:JSON.stringify(payload)});
export const apiResolveDatasetIssue=(datasetId:string,issueId:string,payload:{status:string;resolution:string})=>researchDataJson(`/datasets/${encodeURIComponent(datasetId)}/issues/${encodeURIComponent(issueId)}`,{method:'PATCH',body:JSON.stringify(payload)});
export const apiCleanResearchDataset=(datasetId:string,payload:Record<string,unknown>)=>researchDataJson(`/datasets/${encodeURIComponent(datasetId)}/clean`,{method:'POST',body:JSON.stringify(payload)});
export const apiRunResearchAnalysis=(datasetId:string,payload:Record<string,unknown>)=>researchDataJson(`/datasets/${encodeURIComponent(datasetId)}/analyses`,{method:'POST',body:JSON.stringify(payload)});
export const apiReviewResearchAnalysis=(analysisId:string,payload:{recommendation:string;notes?:string})=>researchDataJson(`/analyses/${encodeURIComponent(analysisId)}/review`,{method:'POST',body:JSON.stringify(payload)});
export const apiRecommendStatisticalTest=(payload:Record<string,unknown>)=>researchDataJson('/decision',{method:'POST',body:JSON.stringify(payload)});
export function researchDatasetExportUrl(datasetId:string){return `${API_BASE_URL}/research-data/datasets/${encodeURIComponent(datasetId)}/export.csv`;}
