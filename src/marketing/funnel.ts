export const INTENDED_PLAN_KEY = 'baseerah_intended_plan';

const PAID_PLAN_CODES = new Set(['STARTER', 'PROFESSIONAL', 'INSTITUTIONAL']);

export function rememberIntendedPlan(code: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const normalized = String(code || '').trim().toUpperCase();
  if (PAID_PLAN_CODES.has(normalized)) {
    sessionStorage.setItem(INTENDED_PLAN_KEY, normalized);
  }
}

export function readIntendedPlan(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(INTENDED_PLAN_KEY);
}

export function clearIntendedPlan(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(INTENDED_PLAN_KEY);
}
