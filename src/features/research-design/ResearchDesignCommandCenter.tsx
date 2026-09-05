import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BookOpen, Building2,
  CheckCircle2, ChevronRight, Circle, Eye, FlaskConical, Gauge, GitBranch,
  Lock, Map, Play, Shield, Target, Users, XCircle,
} from 'lucide-react';

import {
  apiResearchDesignCommandCenter,
  apiResearchDesignCreateProtocol,
} from '../../utils/api';

interface CommandCenterData {
  project_id: string;
  title_ar?: string | null;
  title_en?: string | null;
  study_design?: string | null;
  research_family?: string | null;
  current_relation?: string | null;
  indicators?: {
    completion?: { score: number; parts: Record<string, boolean> };
    coherence?: { score: number; status: string; findings: Array<Record<string, string>>; checked_rules?: number };
    readiness?: { score: number; status: string; template?: string; gates?: Array<Record<string, unknown>>; blocking_failures?: number };
    protocol_status?: string;
    protocol_review_due?: boolean;
    next_best_action?: { action: string; reason: string; priority: string; computed_by?: string };
    critical_blockers?: Array<Record<string, string>>;
  };
  design_map?: { nodes: Array<Record<string, string>>; edges: Array<Record<string, string>>; unmapped: Array<Record<string, string>> };
  methodology?: { research_family?: string; candidate_designs?: string[]; mixed_methods?: { status?: string; note?: string } | null };
  team?: Array<Record<string, unknown>>;
  protocols?: Array<Record<string, unknown>>;
  ai?: { use_cases?: string[]; authority?: string };
}

const severityColor: Record<string, string> = {
  BLOCKING: 'bg-[var(--ds-surface-secondary)] text-[var(--ds-danger)] border-[var(--ds-danger)]',
  HIGH: 'bg-[var(--ds-surface-secondary)] text-[var(--ds-warning)] border-[var(--ds-warning)]',
  MEDIUM: 'bg-[var(--ds-surface-secondary)] text-[var(--ds-warning)] border-[var(--ds-warning)]',
  LOW: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-primary)] border-[var(--ds-border-subtle)]',
  ADVISORY: 'bg-[var(--ds-surface-secondary)] text-[var(--ds-primary)] border-[var(--ds-primary)]',
};

// Deterministic mapping: coherence rule → design workspace step.
const findingToStep: Record<string, string> = {
  PROBLEM_TO_GAP: 'PROBLEM_AND_GAP',
  PROBLEM_TO_OBJECTIVES: 'OBJECTIVES',
  OBJECTIVES_TO_QUESTIONS: 'QUESTIONS_AND_HYPOTHESES',
  ORPHAN_QUESTION: 'QUESTIONS_AND_HYPOTHESES',
  QUESTIONS_TO_HYPOTHESES: 'QUESTIONS_AND_HYPOTHESES',
  ORPHAN_HYPOTHESIS: 'QUESTIONS_AND_HYPOTHESES',
  QUESTIONS_TO_VARIABLES: 'VARIABLES',
  VARIABLES_TO_OPERATIONALIZATION: 'VARIABLES',
  VARIABLES_TO_MEASUREMENT: 'MEASUREMENT_INSTRUMENTS',
  DESIGN_QUESTION_CONFLICT: 'METHODOLOGY_AND_DESIGN',
  CAUSAL_LANGUAGE_WARNING: 'METHODOLOGY_AND_DESIGN',
  METHODOLOGY_TO_SAMPLING: 'POPULATION_AND_SAMPLE',
  QUESTIONS_TO_ANALYSIS: 'ANALYSIS_PLAN',
  QUESTION_ANALYSIS_MISMATCH: 'ANALYSIS_PLAN',
};

interface ResearchDesignCommandCenterProps {
  projectId?: string;
}

export const ResearchDesignCommandCenter: React.FC<ResearchDesignCommandCenterProps> = ({ projectId: propProjectId }) => {
  const params = useParams<{ projectId: string }>();
  const projectId = propProjectId ?? params.projectId ?? '';
  const navigate = useNavigate();
  const { language } = useProject();
  const isAr = language === 'ar';
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'protocol' | 'team' | 'methodology'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiResearchDesignCommandCenter(projectId);
      setData(res);
    } catch {
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = (ar: string, en: string) => (isAr ? ar : en);

  const handleCreateProtocol = async () => {
    setCreating(true);
    try {
      await apiResearchDesignCreateProtocol(projectId);
      await load();
    } catch {
      setError('protocol');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-[var(--ds-text-secondary)]" aria-live="polite" data-testid="rdcc-loading">
        {t('جاري تحميل مركز قيادة البحث…', 'Loading research design command center…')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 space-y-3 text-[var(--ds-danger)]" role="alert" data-testid="rdcc-error">
        <p className="m-0">
          <AlertTriangle className="inline mr-2" size={18} />
          {error === 'protocol'
            ? t('تعذر إنشاء البروتوكول. أعد المحاولة بعد لحظات.', 'Could not create the protocol. Try again in a moment.')
            : t('تعذر تحميل ملخص التصميم. تحقق من الاتصال ثم أعد المحاولة.', 'Could not load the design summary. Check your connection and try again.')}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 rounded-lg bg-[var(--ds-primary)] text-white text-xs font-bold"
        >
          {t('إعادة المحاولة', 'Try again')}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const ind = data.indicators ?? {};
  const coherence = ind.coherence ?? { score: 0, status: '—', findings: [] };
  const readiness = ind.readiness ?? { score: 0, status: '—', gates: [], blocking_failures: 0 };
  const next = ind.next_best_action ?? { action: '—', reason: '', priority: '—' };
  const map = data.design_map ?? { nodes: [], edges: [], unmapped: [] };
  const blockers = ind.critical_blockers ?? [];
  const mixed = data.methodology?.mixed_methods;

  const tabs = [
    { key: 'overview' as const, label: t('نظرة عامة', 'Overview'), icon: Gauge },
    { key: 'map' as const, label: t('خريطة التصميم', 'Design Map'), icon: Map },
    { key: 'protocol' as const, label: t('البروتوكول', 'Protocol'), icon: BookOpen },
    { key: 'team' as const, label: t('الفريق', 'Team'), icon: Users },
    { key: 'methodology' as const, label: t('المنهجية', 'Methodology'), icon: FlaskConical },
  ];

  return (
    <div className="space-y-6" data-testid="rd-command-center">
      <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]">
            <Activity size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-h2 text-[var(--ds-text-primary)]" data-testid="rdcc-title">
              {isAr ? data.title_ar : data.title_en}
            </h2>
            <p className="text-body-sm text-[var(--ds-text-secondary)] m-0 mt-1.5">
              {t(
                'ملخص جاهزية التصميم والاتساق والبروتوكول. كل مؤشر مستقل، والقرار التالي يبقى بيد الباحث أو المشرف.',
                'A summary of design readiness, consistency, and protocol. Each indicator is independent; the next decision stays with the researcher or supervisor.',
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ds-text-secondary)] mt-1.5 font-medium">
              <span className="flex items-center gap-1"><Building2 size={14} /> {data.research_family ?? '—'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Target size={14} /> {t('التصميم', 'Design')}: {data.study_design ?? '—'}</span>
              {data.current_relation ? (
                <span className="flex items-center gap-1"><Eye size={14} /> {t('صلاحيتك', 'Your relation')}: {data.current_relation}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-2 border-b border-[var(--ds-border-subtle)] pb-2" aria-label={t('أقسام مركز القيادة', 'Command center sections')}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]'
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]'
              }`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="p-4 text-[var(--ds-danger)] text-sm border border-[var(--ds-danger)] bg-[var(--ds-danger-soft)] rounded-lg" role="alert">
          {error}
        </div>
      )}

      {activeTab === 'overview' && (
        <section aria-labelledby="rdcc-indicators" className="space-y-6">
          <h3 id="rdcc-indicators" className="text-h3 text-[var(--ds-text-secondary)] uppercase">
            {t('مؤشرات مستقلة', 'Independent Indicators')}
          </h3>

          {/* Independent indicator cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-1" data-testid="ind-completion">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ds-text-primary)]">{t('الاكتمال', 'Completion')}</span>
                <CheckCircle2 size={16} className="text-[var(--ds-primary)]" />
              </div>
              <p className="text-2xl font-black text-[var(--ds-text-primary)]">{ind.completion?.score ?? 0}%</p>
              <p className="text-caption text-[var(--ds-text-secondary)]">{t('نسبة الحقول المعبأة — ليست حكماً منهجياً.', 'Filled-fields ratio — not a methodological verdict.')}</p>
            </div>

            <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-1" data-testid="ind-coherence">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ds-text-primary)]">{t('الاتساق', 'Coherence')}</span>
                <GitBranch size={16} className="text-[var(--ds-primary)]" />
              </div>
              <p className="text-2xl font-black text-[var(--ds-text-primary)]">{coherence.score}%</p>
              <p className={`text-caption font-semibold ${coherence.status === 'COHERENT' ? 'text-[var(--ds-success)]' : 'text-[var(--ds-danger)]'}`}>
                {coherence.status === 'COHERENT' ? t('متسق', 'Coherent') : t('غير متسق', 'Incoherent')}
              </p>
            </div>

            <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-1" data-testid="ind-readiness">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ds-text-primary)]">{t('الجاهزية', 'Readiness')}</span>
                <BarChart3 size={16} className="text-[var(--ds-primary)]" />
              </div>
              <p className="text-2xl font-black text-[var(--ds-text-primary)]">{readiness.score}%</p>
              <p className={`text-caption font-semibold ${readiness.status === 'READY' ? 'text-[var(--ds-success)]' : 'text-[var(--ds-danger)]'}`}>
                {readiness.status === 'READY' ? t('جاهز للتنفيذ', 'READY') : t('غير جاهز', 'NOT READY')}
              </p>
              <p className="text-caption text-[var(--ds-text-secondary)]">
                {readiness.blocking_failures ?? 0} {t('بوابة حاسمة فاشلة', 'blocking gate failure(s)')}
              </p>
            </div>

            <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-1" data-testid="ind-protocol">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ds-text-primary)]">{t('البروتوكول', 'Protocol')}</span>
                <BookOpen size={16} className="text-[var(--ds-primary)]" />
              </div>
              <p className="text-body-lg font-black text-[var(--ds-text-primary)]" data-testid="ind-protocol-status">{ind.protocol_status ?? 'NO_PROTOCOL'}</p>
              {ind.protocol_review_due && (
                <p className="text-caption font-semibold text-[var(--ds-warning)]">{t('يتطلب مراجعة', 'REQUIRES REVIEW')}</p>
              )}
            </div>
          </div>

          {/* Next best action */}
          <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 flex items-start gap-3" data-testid="rdcc-next-action">
            <div className="p-2 rounded-lg bg-[var(--ds-success-soft)] text-[var(--ds-success)]"><Play size={18} /></div>
            <div className="flex-1">
              <p className="text-caption font-bold text-[var(--ds-text-secondary)]">{t('الإجراء التالي', 'Next Best Research Action')}</p>
              <p className="text-body-sm font-semibold text-[var(--ds-text-primary)]" data-testid="next-action-text">{next.action}</p>
              <p className="text-caption text-[var(--ds-text-secondary)] mt-1">{next.reason}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-caption font-bold ${
                next.priority === 'BLOCKING' ? 'bg-[var(--ds-surface-secondary)] text-[var(--ds-danger)]' : next.priority === 'HIGH' ? 'bg-[var(--ds-surface-secondary)] text-[var(--ds-warning)]' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-primary)]'
              }`} data-testid="next-action-priority">{next.priority}</span>
            </div>
          </div>

          {/* Critical blockers */}
          <div className="space-y-2" data-testid="rdcc-blockers">
            <h4 className="text-h4 text-[var(--ds-text-secondary)] uppercase">
              {t('العوائق الحرجة', 'Critical Blockers')} ({blockers.length})
            </h4>
            {blockers.length === 0 ? (
              <p className="text-caption text-[var(--ds-text-secondary)]">{t('لا توجد عوائق حاسمة. تابع الإجراء التالي أعلاه.', 'No critical blockers. Continue with the next action above.')}</p>
            ) : (
              blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2 border border-[var(--ds-danger)] bg-[var(--ds-danger-soft)] rounded-lg p-3" data-testid={`blocker-${i}`}>
                  <XCircle size={16} className="text-[var(--ds-danger)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-caption font-bold text-[var(--ds-danger)]">{b.rule ?? 'BLOCKER'}</p>
                    <p className="text-caption text-[var(--ds-danger)]">{b.evidence ?? b.rationale ?? ''}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Coherence findings */}
          <div className="space-y-2" data-testid="rdcc-findings">
            <h4 className="text-h4 text-[var(--ds-text-secondary)] uppercase">
              {t('نتائج الاتساق', 'Coherence Findings')} ({coherence.findings.length})
            </h4>
            {coherence.findings.length === 0 ? (
              <p className="text-caption text-[var(--ds-text-secondary)]">{t('لا توجد نتائج سلبية في فحص الاتساق حاليًا.', 'No negative consistency findings right now.')}</p>
            ) : (
              coherence.findings.map((f, i) => {
                const stepId = findingToStep[f.rule ?? ''] ?? null;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (stepId) navigate(`/app/research/projects/${encodeURIComponent(projectId)}/design/${stepId}`);
                    }}
                    className={`flex items-start gap-2 w-full text-left border border-[var(--ds-border-subtle)] rounded-lg p-3 bg-[var(--ds-surface-secondary)] ${stepId ? 'hover:border-[var(--ds-primary)] cursor-pointer' : ''}`}
                    data-testid={`finding-${i}`}
                    aria-label={`${f.rule ?? 'Finding'}: ${f.evidence ?? ''}${stepId ? ` — ${t('افتح المصدر', 'open source')}` : ''}`}
                  >
                    <span className={`px-2 py-0.5 rounded text-caption font-bold border shrink-0 ${severityColor[f.severity ?? 'ADVISORY'] ?? ''}`}>{f.severity}</span>
                    <div className="flex-1">
                      <p className="text-caption font-bold text-[var(--ds-text-primary)]">{f.rule}</p>
                      <p className="text-caption text-[var(--ds-text-secondary)]">{f.evidence}</p>
                      <p className="text-[11px] text-[var(--ds-text-secondary)] italic mt-1">{f.suggested_resolution ?? f.rationale}</p>
                    </div>
                    {stepId && <ArrowRight size={14} className="text-[var(--ds-primary)] self-center shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Readiness gates */}
          <div className="space-y-2" data-testid="rdcc-gates">
            <h4 className="text-h4 text-[var(--ds-text-secondary)] uppercase">
              {t('بوابات الجاهزية', 'Readiness Gates')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(readiness.gates ?? []).map((g, i) => (
                <div key={i} className="flex items-center gap-2 border border-[var(--ds-border-subtle)] rounded-lg px-3 py-2 bg-[var(--ds-surface-secondary)]">
                  {g.ok ? <CheckCircle2 size={14} className="text-[var(--ds-success)]" /> : <XCircle size={14} className="text-[var(--ds-danger)]" />}
                  <span className="text-[11px] font-semibold text-[var(--ds-text-primary)]">{String(g.title ?? g.code ?? '')}</span>
                  {g.severity === 'BLOCKING' && !g.ok ? <span className="text-caption text-[var(--ds-danger)] font-bold ml-auto">{t('حاسم', 'BLOCKING')}</span> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'map' && (
        <section aria-labelledby="rdcc-map" className="space-y-4" data-testid="rdcc-design-map">
          <h3 id="rdcc-map" className="text-h3 text-[var(--ds-text-secondary)] uppercase">
            {t('خريطة التصميم', 'Research Design Map')}
          </h3>
          <div className="flex flex-wrap gap-1.5 items-center text-xs text-[var(--ds-text-secondary)]" data-testid="design-map-flow">
            {['PROBLEM', 'OBJECTIVE', 'QUESTION', 'HYPOTHESIS', 'VARIABLE', 'INSTRUMENT', 'ANALYSIS_INTENT'].map((stage, i) => (
              <span key={stage} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} className="text-[var(--ds-text-secondary)]" />}
                <span className="px-2 py-1 rounded-md bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] font-semibold">{stage.replace(/_/g, ' ')}</span>
              </span>
            ))}
          </div>
          <ul className="space-y-1.5 list-none" data-testid="design-map-nodes">
            {(map.nodes ?? []).map((n, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]">
                <Circle size={10} className={n.status === 'UNMAPPED' ? 'text-[var(--ds-danger)]' : 'text-[var(--ds-success)]'} />
                <span className="text-caption font-bold text-[var(--ds-text-secondary)] uppercase w-28 shrink-0">{n.type}</span>
                <span className="text-xs font-semibold text-[var(--ds-text-primary)] truncate flex-1">{n.title}</span>
                <span className={`text-caption font-bold px-2 py-0.5 rounded ${n.status === 'UNMAPPED' ? 'bg-[var(--ds-surface-secondary)] text-[var(--ds-danger)]' : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-success)]'}`}>
                  {n.status === 'UNMAPPED' ? 'UNMAPPED' : 'MAPPED'}
                </span>
              </li>
            ))}
          </ul>
          {(map.unmapped ?? []).length > 0 && (
            <div className="border border-[var(--ds-warning)] bg-[var(--ds-warning-soft)] rounded-lg p-3" data-testid="design-map-unmapped">
              <p className="text-caption font-bold text-[var(--ds-warning)]">{t('عناصر غير مربوطة', 'Unmapped elements')}: {(map.unmapped ?? []).length}</p>
              {(map.unmapped ?? []).slice(0, 10).map((u, i) => (
                <p key={i} className="text-[11px] text-[var(--ds-warning)]">• {String(u.title ?? u.type ?? '')}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'protocol' && (
        <section aria-labelledby="rdcc-protocol" className="space-y-3" data-testid="rdcc-protocol">
          <div className="flex items-center justify-between">
            <h3 id="rdcc-protocol" className="text-h3 text-[var(--ds-text-secondary)] uppercase">
              {t('إصدارات البروتوكول', 'Protocol Versions')}
            </h3>
            <button
              type="button"
              onClick={() => void handleCreateProtocol()}
              disabled={creating}
              className="px-3 py-1.5 rounded-lg bg-[var(--ds-primary)] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
              data-testid="create-protocol-btn"
            >
              {creating ? t('جارٍ الإنشاء…', 'Creating…') : t('إنشاء بروتوكول جديد', 'Create protocol')}
            </button>
          </div>
          {(data.protocols ?? []).length === 0 ? (
            <p className="text-caption text-[var(--ds-text-secondary)]">{t('لا يوجد بروتوكول بعد. أنشئ بروتوكولًا لتوثيق قرارات التصميم قبل جمع البيانات.', 'No protocol yet. Create one to record design decisions before data collection.')}</p>
          ) : (
            <div className="space-y-2">
              {(data.protocols ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]" data-testid={`protocol-${i}`}>
                  <BookOpen size={16} className="text-[var(--ds-primary)]" />
                  <div className="flex-1">
                    <p className="text-caption font-bold text-[var(--ds-text-primary)]">
                      {t('الإصدار', 'Version')} v{String(p.version ?? i + 1)}
                    </p>
                    <p className="text-caption text-[var(--ds-text-secondary)] font-mono">{String(p.status ?? '')} • {String(p.fingerprint ?? '').slice(0, 12)}…</p>
                  </div>
                  {p.is_current ? (
                    <span className="text-caption font-bold px-2 py-0.5 rounded bg-[var(--ds-surface-secondary)] text-[var(--ds-success)]">{t('الحالي', 'CURRENT')}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'team' && (
        <section aria-labelledby="rdcc-team" className="space-y-3" data-testid="rdcc-team">
          <h3 id="rdcc-team" className="text-h3 text-[var(--ds-text-secondary)] uppercase">
            {t('فريق المشروع', 'Project Team')}
          </h3>
          {(data.team ?? []).length === 0 ? (
            <p className="text-caption text-[var(--ds-text-secondary)]">{t('لا يوجد أعضاء إضافيون.', 'No additional members.')}</p>
          ) : (
            <div className="space-y-2">
              {(data.team ?? []).map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]" data-testid={`team-member-${i}`}>
                  <Users size={16} className="text-[var(--ds-primary)]" />
                  <div className="flex-1">
                    <p className="text-caption font-bold text-[var(--ds-text-primary)]">{String(m.username ?? m.user_id ?? '')}</p>
                    <p className="text-caption text-[var(--ds-text-secondary)]">{String(m.relationship ?? '')}{m.status ? ` • ${String(m.status)}` : ''}</p>
                  </div>
                  {(m.assigned_sections as string[] | undefined)?.length ? (
                    <span className="text-caption text-[var(--ds-text-secondary)]">{t('أقسام مسندة', 'Assigned')}: {(m.assigned_sections as string[]).join(', ')}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'methodology' && (
        <section aria-labelledby="rdcc-methodology" className="space-y-3" data-testid="rdcc-methodology">
          <h3 id="rdcc-methodology" className="text-h3 text-[var(--ds-text-secondary)] uppercase">
            {t('استشارة المنهجية', 'Methodology Intelligence')}
          </h3>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]">
            <FlaskConical size={16} className="text-[var(--ds-primary)]" />
            <div>
              <p className="text-caption font-bold text-[var(--ds-text-primary)]">{data.methodology?.research_family ?? '—'}</p>
              <p className="text-caption text-[var(--ds-text-secondary)]">
                {t('مرشح:', 'Candidates:')} {(data.methodology?.candidate_designs ?? []).join(', ')}
              </p>
              <p className="text-caption text-[var(--ds-text-secondary)]">
                {t('المصدر: محرك منهجي حتمي — يحتاج تأكيد الباحث.', 'Source: deterministic methodology engine — requires researcher confirmation.')}
              </p>
            </div>
          </div>
          {mixed ? (
            <div className="border border-[var(--ds-information)] bg-[var(--ds-information-soft)] rounded-lg p-4" data-testid="mixed-methods-available">
              <p className="text-caption font-bold text-[var(--ds-information)]">{t('طرق مختلطة', 'Mixed Methods')}: {mixed.status}</p>
              <p className="text-caption text-[var(--ds-text-secondary)]">{mixed.note ?? ''}</p>
            </div>
          ) : null}

          <div className="border border-[var(--ds-border-subtle)] rounded-lg p-4 bg-[var(--ds-surface-secondary)]" data-testid="ai-authority-note">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[var(--ds-primary)]" />
              <p className="text-caption font-bold text-[var(--ds-text-primary)]">{t('مساعد الذكاء الاصطناعي', 'AI Assistant')}: {data.ai?.authority ?? 'ADVISORY_ONLY'}</p>
            </div>
            <p className="text-[11px] text-[var(--ds-text-secondary)] mt-1">
              {t('الذكاء الاصطناعي استشاري فقط: لا يوافق على البروتوكول، ولا يقر المنهجية، ولا يغير النتائج الحتمية.', 'AI is advisory only: it never approves protocols, certifies methodology, or alters deterministic findings.')}
            </p>
          </div>
        </section>
      )}

      <div className="border-t border-[var(--ds-border-subtle)] pt-3 flex items-center gap-2 text-[11px] text-[var(--ds-text-secondary)]">
        <Lock size={12} /> {t('تظل جميع القرارات الحتمية تحت سلطة الباحث.', 'All deterministic decisions remain under researcher authority.')}
      </div>
    </div>
  );
};

export default ResearchDesignCommandCenter;
