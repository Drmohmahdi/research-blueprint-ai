// Feature Flags Configuration for Basseera Platform

import { useEffect, useState } from 'react';

export const DEFAULT_FEATURE_FLAGS = {
  DESIGN_SYSTEM_V2: true, // Set to true to activate Basseera V2 system showcase. False to completely hide/disable.
  NEW_APP_SHELL: true,
  NEW_NAVIGATION: true,
  PATH_SELECTOR: true,
  RESEARCH_LIFECYCLE_BAR: true,
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
const flagListeners = new Set<() => void>();

export function applyFeatureFlagOverrides(flags: Record<string, boolean>): void {
  runtimeOverrides = { ...flags };
  (Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagName[]).forEach((key) => {
    FEATURE_FLAGS[key] = key in runtimeOverrides
      ? !!runtimeOverrides[key]
      : DEFAULT_FEATURE_FLAGS[key];
  });
  flagListeners.forEach((listener) => listener());
}

export function subscribeFeatureFlags(listener: () => void): () => void {
  flagListeners.add(listener);
  return () => {
    flagListeners.delete(listener);
  };
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

/** Re-renders when Admin Center or /admin/feature-flags applies overrides. */
export function useFeatureFlag(flag: FeatureFlagName, userRole?: string): boolean {
  const [, setTick] = useState(0);
  useEffect(() => subscribeFeatureFlags(() => setTick((tick) => tick + 1)), []);
  return isFeatureEnabled(flag, userRole);
}
