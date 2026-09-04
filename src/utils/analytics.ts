type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/** Named conversion events. dataLayer always receives them; gtag loads only with VITE_GA_MEASUREMENT_ID. */
export const FUNNEL_EVENTS = {
  pageView: 'page_view',
  viewPricing: 'view_pricing',
  generateLead: 'generate_lead',
  beginRegistration: 'begin_registration',
  createFirstProject: 'create_first_project',
  planLimitReached: 'plan_limit_reached',
  ctaSignup: 'cta_signup',
} as const;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, props: AnalyticsProps = {}): void {
  if (typeof window === 'undefined') return;
  const payload = { event, ...props, ts: Date.now() };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, props);
  }
}

export function installAnalyticsIfConfigured(): void {
  if (typeof document === 'undefined') return;
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!measurementId || document.getElementById('baseerah-ga')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args as unknown as Record<string, unknown>);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { anonymize_ip: true });

  const script = document.createElement('script');
  script.id = 'baseerah-ga';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}
