import type { ResearchProject } from '../types/research';

export const getProtocolPayload = (project: ResearchProject): Record<string, unknown> => ({
  id: project.id,
  titleAr: project.titleAr,
  titleEn: project.titleEn,
  descriptionAr: project.descriptionAr,
  descriptionEn: project.descriptionEn,
  problemStatementAr: project.problemStatementAr,
  problemStatementEn: project.problemStatementEn,
  studyDesign: project.studyDesign,
  variables: project.variables,
  questions: project.questions,
  hypotheses: project.hypotheses,
  sampleSettings: project.sampleSettings,
  objectives: project.objectives,
  timeline: project.timeline,
  ethics: project.ethics,
  ethicsFeasibilityPlan: project.ethicsFeasibilityPlan,
  measurementInstruments: project.measurementInstruments,
  hypothesisAnalysisPlans: project.hypothesisAnalysisPlans
});

export const calculateProtocolHash = async (project: ResearchProject) => {
  const encodedPayload = new TextEncoder().encode(JSON.stringify(getProtocolPayload(project)));
  const digest = await crypto.subtle.digest('SHA-256', encodedPayload);
  return `sha256-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
};