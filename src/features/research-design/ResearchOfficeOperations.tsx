import React, { useCallback, useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BarChart3, Building2, Eye, FlaskConical, Layers, ListChecks, Lock } from 'lucide-react';
import { PathPanel } from '../../design-system/components/Navigation';

import { apiResearchOfficeOperations } from '../../utils/api';

interface OfficeData {
  organization_id: string;
  scope?: string;
  counts?: Record<string, number>;
  readiness_distribution?: Record<string, number>;
  research_type_distribution?: Record<string, number>;
  blocker_distribution?: Record<string, number>;
  projects?: Array<Record<string, unknown>>;
  aggregate_only?: boolean;
  raw_content_excluded?: boolean;
}

interface ResearchOfficeOperationsProps {
  language?: 'ar' | 'en';
}

export const ResearchOfficeOperations: React.FC<ResearchOfficeOperationsProps> = () => {
  const { language } = useProject();
  const isAr = language === 'ar';
  const [data, setData] = useState<OfficeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiResearchOfficeOperations();
      if (res === null) {
        setError(isAr ? 'لا تملك صلاحية عرض عمليات مكتب البحث.' : 'You are not authorized to view research office operations.');
      } else {
        setData(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = (ar: string, en: string) => (isAr ? ar : en);

  if (loading) {
    return <div className="p-8 text-[var(--ds-text-secondary)]" data-testid="office-loading">{t('جاري التحميل…', 'Loading…')}</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-[var(--ds-warning)] border border-[var(--ds-warning)] bg-[var(--ds-warning-soft)] rounded-xl flex items-start gap-2" role="alert" data-testid="office-denied">
        <Eye size={18} className="mt-0.5 shrink-0" /> {error}
      </div>
    );
  }

  if (!data) return null;

  const counts = data.counts ?? {};
  const readiness = data.readiness_distribution ?? {};
  const types = data.research_type_distribution ?? {};
  const blockers = data.blocker_distribution ?? {};

  const statCards = [
    { label: t('مشاريع نشطة', 'Active projects'), value: counts.active_projects ?? 0, icon: Layers },
    { label: t('جاهزة للتنفيذ', 'Ready for execution'), value: counts.designs_ready_for_execution ?? 0, icon: BarChart3 },
    { label: t('بها عوائق حاسمة', 'With blocking issues'), value: counts.projects_with_blocking_issues ?? 0, icon: ListChecks },
    { label: t('بروتوكولات بانتظار مراجعة', 'Protocols awaiting review'), value: counts.protocols_awaiting_review ?? 0, icon: FlaskConical },
    { label: t('بروتوكولات قديمة', 'Stale protocols'), value: counts.stale_protocols ?? 0, icon: ListChecks },
  ];

  return (
    <div className="space-y-6" data-testid="research-office">
      <PathPanel accent="var(--ds-path-research)">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]"><Building2 size={24} /></div>
          <div>
            <p className="m-0 text-xs font-black text-[var(--ds-primary)]">BASEERAH · RESEARCH OFFICE</p>
            <h2 className="text-base font-bold text-[var(--ds-text-primary)] m-0 mt-1">{t('عمليات مكتب البحث', 'Research Office Operations')}</h2>
            <p className="text-xs text-[var(--ds-text-secondary)] mt-1">
              {t('نظرة تجميعية أولاً — لا يعرض هذا العرض محتوى بحثي خام.', 'Aggregate-first view — raw research content is never shown here.')}
            </p>
          </div>
        </div>
      </PathPanel>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" data-testid="office-stats">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--ds-text-primary)]">{card.label}</span>
                <Icon size={14} className="text-[var(--ds-primary)]" />
              </div>
              <p className="text-2xl font-black text-[var(--ds-text-primary)]" data-testid={`office-stat-${i}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-2" data-testid="office-readiness">
          <h3 className="text-xs font-bold text-[var(--ds-text-secondary)] uppercase tracking-wider">{t('توزيع الجاهزية', 'Readiness distribution')}</h3>
          {Object.keys(readiness).length === 0 ? (
            <p className="text-xs text-[var(--ds-text-secondary)]">{t('لا بيانات', 'No data')}</p>
          ) : (
            Object.entries(readiness).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--ds-text-primary)]">{k}</span>
                <span className="font-black text-[var(--ds-text-primary)]">{v}</span>
              </div>
            ))
          )}
        </div>

        <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-2" data-testid="office-types">
          <h3 className="text-xs font-bold text-[var(--ds-text-secondary)] uppercase tracking-wider">{t('توزيع أنواع الأبحاث', 'Research-type distribution')}</h3>
          {Object.entries(types).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--ds-text-primary)]">{k}</span>
              <span className="font-black text-[var(--ds-text-primary)]">{v}</span>
            </div>
          ))}
        </div>

        <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-2" data-testid="office-blockers">
          <h3 className="text-xs font-bold text-[var(--ds-text-secondary)] uppercase tracking-wider">{t('توزيع العوائق', 'Blocker distribution')}</h3>
          {Object.entries(blockers).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--ds-text-primary)]">{k} {t('عوائق', 'blocker(s)')}</span>
              <span className="font-black text-[var(--ds-text-primary)]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4" data-testid="office-project-list">
        <h3 className="text-xs font-bold text-[var(--ds-text-secondary)] uppercase tracking-wider mb-2">{t('ملخص المشاريع (بدون محتوى خام)', 'Project summary (no raw content)')}</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left border-b border-[var(--ds-border-subtle)]">
              <th className="py-2 font-bold text-[var(--ds-text-primary)]">{t('المشروع', 'Project')}</th>
              <th className="py-2 font-bold text-[var(--ds-text-primary)]">{t('الجاهزية', 'Readiness')}</th>
              <th className="py-2 font-bold text-[var(--ds-text-primary)]">{t('العوائق', 'Blockers')}</th>
              <th className="py-2 font-bold text-[var(--ds-text-primary)]">{t('البروتوكول', 'Protocol')}</th>
            </tr>
          </thead>
          <tbody>
            {(data.projects ?? []).map((p, i) => (
              <tr key={i} className="border-b border-[var(--ds-border-subtle)]" data-testid={`office-project-${i}`}>
                <td className="py-2 font-semibold text-[var(--ds-text-primary)]">{String(p.title_en ?? p.title_ar ?? p.id ?? '')}</td>
                <td className="py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${String(p.readiness_status) === 'READY' ? 'bg-[var(--ds-surface-secondary)] text-[var(--ds-success)]' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-danger)]'}`}>{String(p.readiness_status ?? '')}</span> {String(p.readiness_score ?? '')}%</td>
                <td className="py-2 text-[var(--ds-text-primary)]">{String(p.blocker_count ?? 0)}</td>
                <td className="py-2 text-[var(--ds-text-primary)]">{String(p.protocol_status ?? 'NO_PROTOCOL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[var(--ds-text-secondary)]">
        <Lock size={12} /> {t('تجميعي فقط — المحتوى الخام والملاحظات الخاصة والمراجعات السرية لا تظهر هنا.', 'Aggregate only — raw content, private notes and confidential reviews are never exposed here.')}
      </div>
    </div>
  );
};

export default ResearchOfficeOperations;
