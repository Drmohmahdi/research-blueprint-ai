// Single source of truth for academic identity channel types.
// Shared by UnifiedProfileEditor, AcademicVisibilityDashboard, and
// AcademicVisibilityReports so an identifier saved in one page is
// recognized consistently everywhere else.

export interface AcademicChannelDef {
  type: string;
  label: string;
  priority: 'critical' | 'important' | 'optional';
  descAr: string;
  descEn: string;
  placeholder: string;
}

export const ACADEMIC_CHANNELS: AcademicChannelDef[] = [
  {
    type: 'ORCID',
    label: 'ORCID',
    priority: 'critical',
    descAr: 'المعرّف الدولي الموحد للباحثين.',
    descEn: 'Unified international researcher registry.',
    placeholder: '0000-0002-1825-0097',
  },
  {
    type: 'GOOGLE_SCHOLAR',
    label: 'Google Scholar',
    priority: 'critical',
    descAr: 'حساب الاستشهادات ومتابعة مؤشر h-index.',
    descEn: 'Citation index tracker and h-index calculator.',
    placeholder: 'citations?user=...',
  },
  {
    type: 'SCOPUS',
    label: 'Scopus Author ID',
    priority: 'critical',
    descAr: 'ملفك في قاعدة Elsevier للاستشهادات.',
    descEn: 'Elsevier citation database profile.',
    placeholder: '57200000000',
  },
  {
    type: 'RESEARCHGATE',
    label: 'ResearchGate',
    priority: 'important',
    descAr: 'شبكة التواصل الأكاديمية ونشر الأبحاث الكاملة.',
    descEn: 'Academic social network and full-text repository.',
    placeholder: 'profile/Your_Name',
  },
  {
    type: 'LINKEDIN',
    label: 'LinkedIn',
    priority: 'important',
    descAr: 'التواصل المهني وبناء السمعة خارج الأكاديميا.',
    descEn: 'Professional networking and industry reputation.',
    placeholder: 'in/your-name',
  },
  {
    type: 'RESEARCHER_ID',
    label: 'Web of Science / Researcher ID',
    priority: 'important',
    descAr: 'معرّف الباحث في قاعدة Web of Science.',
    descEn: 'Researcher identifier in the Web of Science database.',
    placeholder: 'A-1234-2026',
  },
  {
    type: 'GITHUB',
    label: 'GitHub',
    priority: 'optional',
    descAr: 'مستودع الكود البرمجي للمحاكاة والتحليل.',
    descEn: 'Code repository for simulations and statistical analyses.',
    placeholder: 'github.com/username',
  },
];

export const OTHER_CHANNEL_TYPE = 'OTHER';

export function getChannelDef(type: string): AcademicChannelDef | undefined {
  return ACADEMIC_CHANNELS.find(c => c.type === type);
}

export function getChannelLabel(type: string, isAr: boolean): string {
  const def = getChannelDef(type);
  if (def) return def.label;
  return isAr ? 'قناة أخرى' : 'Other channel';
}
