import { API_BASE_URL, fetch, getHeaders } from './apiClient';

export async function apiThesisForProject(projectId: string): Promise<{ id: string } | null> {
  const res = await fetch(`${API_BASE_URL}/theses/projects/${encodeURIComponent(projectId)}`, { headers: getHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Thesis lookup failed (${res.status})`);
  return res.json();
}

export async function apiRegisterThesisForProject(
  projectId: string,
  payload: {
    degree_type: 'MASTERS' | 'DOCTORATE';
    program_name: string;
    research_type: 'EMPIRICAL' | 'SYSTEMATIC_REVIEW' | 'CONCEPTUAL';
  },
): Promise<{ id: string; project_id: string; degree_type: string; current_stage: string }> {
  const res = await fetch(`${API_BASE_URL}/theses/projects/${encodeURIComponent(projectId)}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiAssignThesisSupervisor(
  thesisId: string,
  payload: { user_id: string; role: 'SUPERVISOR' | 'CO_SUPERVISOR'; can_final_recommend?: boolean },
): Promise<{ id: string; role: string; can_final_recommend: boolean }> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/assignments`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiThesisCommandCenter(thesisId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/command-center`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Thesis command center failed (${res.status})`);
  return res.json();
}

export async function apiExternalThesisPortal(token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/external-thesis-examiners/portal/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.status === 401 ? 'EXPIRED_OR_REVOKED' : 'INVALID_INVITATION');
  return res.json();
}

export async function apiExternalThesisRespond(token: string, accept: boolean, coiDisclosure: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/external-thesis-examiners/portal/${encodeURIComponent(token)}/respond`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accept,coi_disclosure:coiDisclosure}) });
  if (!res.ok) throw new Error(await res.text()); return res.json();
}

export async function apiExternalThesisReport(token: string, payload: Record<string, unknown>): Promise<any> {
  const base=`${API_BASE_URL}/external-thesis-examiners/portal/${encodeURIComponent(token)}/report`;
  const saved=await fetch(base,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!saved.ok) throw new Error(await saved.text());
  const submitted=await fetch(`${base}/submit`,{method:'POST'}); if(!submitted.ok) throw new Error(await submitted.text()); return submitted.json();
}

export async function apiThesisCommittee(thesisId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/committee`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Committee lookup failed (${res.status})`);
  return res.json();
}

export async function apiThesisCorrections(thesisId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/corrections`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Corrections lookup failed (${res.status})`);
  return res.json();
}

export async function apiListThesisFeedback(thesisId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/feedback`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Feedback lookup failed (${res.status})`);
  return res.json();
}

export async function apiAddThesisFeedback(thesisId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/feedback`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiResolveThesisFeedback(thesisId: string, feedbackId: string, resolutionStatus: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/feedback/${encodeURIComponent(feedbackId)}/resolve`, {
    method: 'PATCH', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ resolution_status: resolutionStatus })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiRespondThesisCorrection(thesisId: string, correctionId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/corrections/${encodeURIComponent(correctionId)}/respond`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiVerifyThesisCorrection(thesisId: string, correctionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/corrections/${encodeURIComponent(correctionId)}/verify`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiThesisGraduateOperations(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/operations/summary`, { headers: getHeaders() });
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Graduate operations failed (${res.status})`);
  return res.json();
}

export async function apiApproveThesisFinal(thesisId: string, finalVersionId: string, rationale?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/final-approval`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ final_version_id: finalVersionId, rationale }) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiAddThesisCommitteeMember(thesisId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/committee`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiThesisCoiDecision(thesisId: string, memberId: string, decision: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/committee/${encodeURIComponent(memberId)}/coi-decision`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ decision, reason }) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiAddThesisCorrection(thesisId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/corrections`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiCreateThesisMeeting(thesisId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/meetings`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiSubmitThesisChapterVersion(thesisId: string, chapterId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/chapters/${encodeURIComponent(chapterId)}/versions`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiApproveThesisChapter(thesisId: string, chapterId: string, versionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/chapters/${encodeURIComponent(chapterId)}/approve`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ version_id: versionId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiFreezeThesisFinal(thesisId: string, examinationRoundId: string, content: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/final-version`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ examination_round_id: examinationRoundId, content }) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiAddThesisDeposit(thesisId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/deposit`, { method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiUpdateThesisDepositClearance(thesisId: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/theses/${encodeURIComponent(thesisId)}/deposit/clearance`, { method: 'PATCH', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
