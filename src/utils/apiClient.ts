const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
export { API_BASE_URL };
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const browserFetch = globalThis.fetch.bind(globalThis);
export function fetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return browserFetch(input, { ...init, credentials: 'include' });
}

let activeOrgId: string | null = localStorage.getItem('rb_active_org_id');

export function setApiAuthToken(_token: string | null) {
  // Authentication is carried only by the server-issued HttpOnly cookie.
}

export function setApiActiveOrgId(orgId: string | null) {
  activeOrgId = orgId;
  if (orgId) {
    localStorage.setItem('rb_active_org_id', orgId);
  } else {
    localStorage.removeItem('rb_active_org_id');
  }
}

export function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (activeOrgId) {
    headers['X-Organization-ID'] = activeOrgId;
  }
  return headers;
}

export class ApiClientError extends Error {
  status: number;
  detail: string;
  code?: 'PLAN_LIMIT_REACHED' | 'FEATURE_NOT_INCLUDED';
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
    if (detail.includes('PLAN_LIMIT_REACHED') || detail.includes('الحد الأقصى')) {
      this.code = 'PLAN_LIMIT_REACHED';
    } else if (detail.includes('FEATURE_NOT_INCLUDED')) {
      this.code = 'FEATURE_NOT_INCLUDED';
    }
  }
}

export function isPlanLimitError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.code === 'PLAN_LIMIT_REACHED';
}

function sanitizeApiDetail(detail: string, fallback: string): string {
  const trimmed = detail.trim();
  if (!trimmed || trimmed.length > 240) return fallback;
  if (/<|>|traceback|exception|sqlalchemy|psycopg|stack\s+trace|at 0x/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export async function detailFromResponse(res: Response): Promise<string> {
  const fallback = res.statusText || `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return sanitizeApiDetail(body.detail, fallback);
    if (Array.isArray(body?.detail) && typeof body.detail[0]?.msg === 'string') {
      return sanitizeApiDetail(String(body.detail[0].msg), fallback);
    }
  } catch {
    /* ignore raw bodies — they can leak stack traces or HTML */
  }
  return fallback;
}
