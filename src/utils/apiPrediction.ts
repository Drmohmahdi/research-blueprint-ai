import { API_BASE_URL, fetch, getHeaders } from './apiClient';

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
