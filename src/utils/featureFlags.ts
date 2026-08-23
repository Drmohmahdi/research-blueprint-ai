// Feature Flags Configuration for Basseera Platform

export const DEFAULT_FEATURE_FLAGS = {
  DESIGN_SYSTEM_V2: true, // Set to true to activate Basseera V2 system showcase. False to completely hide/disable.
  NEW_APP_SHELL: true,
  NEW_NAVIGATION: true,
  PATH_SELECTOR: true,
  RESEARCH_LIFECYCLE_BAR: true,
  DYNAMIC_DASHBOARD: false,
  RESEARCH_WIZARD_V2: false,
  DESIGN_SYSTEM_V2_REDESIGN: false,
  NEW_STUDY_DESIGN_PATH_V2: true,
  PATH_WORKSPACE_V2: true,
  GUIDED_RESEARCH_MODE: true,
  EXPERT_RESEARCH_MODE: true,
  PREDICTION_INSIGHTS_IN_PATH: true,
  SUPERVISOR_COMMENTS_IN_PATH: true,
  PATH_REPORT_EXPORT: true
};

export const FEATURE_FLAGS: Record<string, boolean> = { ...DEFAULT_FEATURE_FLAGS };

export type FeatureFlagName = keyof typeof DEFAULT_FEATURE_FLAGS;

// ── Runtime overrides (applied from the Admin Center via the backend) ─────────
let runtimeOverrides: Record<string, boolean> = {};

export function applyFeatureFlagOverrides(flags: Record<string, boolean>): void {
  runtimeOverrides = { ...flags };
  for (const key of Object.keys(FEATURE_FLAGS)) {
    if (key in runtimeOverrides) {
      FEATURE_FLAGS[key] = !!runtimeOverrides[key];
    }
  }
}

export function getRuntimeFeatureFlags(): Record<string, boolean> {
  return { ...runtimeOverrides };
}

export function isFeatureEnabled(flag: FeatureFlagName, userRole?: string): boolean {
  // If design system flag is true, or user is developer/admin, allow it
  if (flag === 'DESIGN_SYSTEM_V2') {
    if (FEATURE_FLAGS.DESIGN_SYSTEM_V2) return true;
    return userRole === 'Developer' || userRole === 'SystemAdmin';
  }
  return FEATURE_FLAGS[flag] || false;
}
