import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Circle, Clock3, GitBranch, Link2, ListChecks, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { Button } from '../../design-system/components/Button';
import { Card } from '../../design-system/components/Card';
import { EmptyState } from '../../design-system/components/Feedback';
import { PathPanel } from '../../design-system/components/Navigation';
import { ROUTES } from '../../router/routes';
import { apiAcceptAcademicHandoff, apiApproveAnalysisResult, apiCreateAcademicHandoff, apiGetResearchLifecycle, apiGetResearchLineage, apiGetResearchTimeline, apiListAcademicHandoffs, type AcademicHandoffSummary, type LifecycleStage, type ResearchLifecycleSummary } from '../../utils/api';

const STAGE_ROUTES: Record<string, string> = {
  RESEARCH_DESIGN: ROUTES.NEW_STUDY_DESIGN,
  DATA_COLLECTION: ROUTES.RESEARCH_DATA,
  DATA_PREPARATION: ROUTES.RESEARCH_DATA,
  ANALYSIS: ROUTES.RESEARCH_DATA,
  LITERATURE_SYNTHESIS: ROUTES.LIT_SYNTHESIZER,
  SEARCH_STRATEGY: ROUTES.LIT_SYNTHESIZER,
  SCREENING: ROUTES.LIT_SYNTHESIZER,
  PRISMA: ROUTES.PRISMA,
  SYNTHESIS: ROUTES.LIT_SYNTHESIZER,
  MANUSCRIPT: ROUTES.PUBLISHING,
  SUBMISSION: ROUTES.PEER_REVIEW,
  PEER_REVIEW: ROUTES.PEER_REVIEW,
  REVISION: ROUTES.PEER_REVIEW,
  ACCEPTED: ROUTES.ASSETS,
  PUBLISHED: ROUTES.ASSETS,
  DISSEMINATION: ROUTES.PROFILE,
  PROMOTION_EVIDENCE: ROUTES.PROMOTION,
};

const labels: Record<string, [string, string]> = {
  RESEARCH_DESIGN: ['تصميم البحث', 'Research design'], DATA_COLLECTION: ['جمع البيانات', 'Data collection'],
  DATA_PREPARATION: ['إعداد البيانات', 'Data preparation'], ANALYSIS: ['التحليل', 'Analysis'],
  LITERATURE_SYNTHESIS: ['تركيب الأدبيات', 'Literature synthesis'], SEARCH_STRATEGY: ['استراتيجية البحث', 'Search strategy'],
  SCREENING: ['فرز الدراسات', 'Screening'], PRISMA: ['مخطط PRISMA', 'PRISMA'], SYNTHESIS: ['تركيب الأدلة', 'Evidence synthesis'],
  QUALITATIVE_DATA: ['البيانات النوعية', 'Qualitative data'], QUALITATIVE_ANALYSIS: ['التحليل النوعي', 'Qualitative analysis'],
  MANUSCRIPT: ['المخطوطة', 'Manuscript'], SUBMISSION: ['التقديم', 'Submission'], PEER_REVIEW: ['التحكيم', 'Peer review'],
  REVISION: ['المراجعة', 'Revision'], ACCEPTED: ['القبول', 'Accepted'], PUBLISHED: ['النشر', 'Published'],
  DISSEMINATION: ['الأثر والانتشار', 'Dissemination'], PROMOTION_EVIDENCE: ['دليل الترقية', 'Promotion evidence'],
};

const statusLabels: Record<string, [string, string]> = {
  NOT_STARTED: ['لم تبدأ', 'Not started'], AVAILABLE: ['متاحة', 'Available'], IN_PROGRESS: ['قيد التنفيذ', 'In progress'],
  BLOCKED: ['متوقفة', 'Blocked'], READY_FOR_HANDOFF: ['جاهزة للتسليم', 'Ready for handoff'], HANDED_OFF: ['تم التسليم', 'Handed off'],
  COMPLETED: ['مكتملة', 'Completed'], STALE: ['تحتاج مراجعة', 'Stale'], NOT_REQUIRED: ['غير مطلوبة', 'Not required'],
  DEFERRED_CAPABILITY: ['قدرة مؤجلة', 'Deferred capability'],
};

function statusClass(status: string) {
  if (status === 'COMPLETED') return 'border-[var(--ds-success)]/35 bg-[var(--ds-success-soft)] text-[var(--ds-success)]';
  if (status === 'BLOCKED') return 'border-[var(--ds-danger)]/35 bg-[var(--ds-danger-soft)] text-[var(--ds-danger)]';
  if (status === 'STALE') return 'border-[var(--ds-warning)]/35 bg-[var(--ds-warning-soft)] text-[var(--ds-warning)]';
  if (status === 'IN_PROGRESS') return 'border-[var(--ds-primary)]/35 bg-[var(--ds-primary-soft)] text-ink';
  if (status === 'AVAILABLE') return 'border-[var(--ds-information)]/35 bg-[var(--ds-information-soft)] text-[var(--ds-information)]';
  return 'border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]';
}

function StageIcon({ stage }: { stage: LifecycleStage }) {
  if (stage.status === 'COMPLETED') return <Check size={16} aria-hidden="true" />;
  if (stage.status === 'BLOCKED') return <AlertTriangle size={16} aria-hidden="true" />;
  if (stage.status === 'STALE') return <RefreshCw size={16} aria-hidden="true" />;
  if (stage.status === 'IN_PROGRESS') return <Clock3 size={16} aria-hidden="true" />;
  return <Circle size={14} aria-hidden="true" />;
}

export const ResearchLifecycleCommandCenter: React.FC = () => {
  const { activeProject, language } = useProject();
  const ar = language === 'ar';
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ResearchLifecycleSummary | null>(null);
  const [timeline, setTimeline] = useState<Array<Record<string, string>>>([]);
  const [lineage, setLineage] = useState<Array<{ id: string; source: { type: string; id: string; version?: string }; relationship: string; target: { type: string; id: string; version?: string } }>>([]);
  const [handoffs, setHandoffs] = useState<AcademicHandoffSummary[]>([]);
  const [tab, setTab] = useState<'overview' | 'handoffs' | 'timeline' | 'lineage'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!activeProject) return;
    setLoading(true); setError('');
    const [lifecycle, timelineResult, lineageResult, handoffResult] = await Promise.all([
      apiGetResearchLifecycle(activeProject.id), apiGetResearchTimeline(activeProject.id), apiGetResearchLineage(activeProject.id), apiListAcademicHandoffs(activeProject.id),
    ]);
    if (!lifecycle) setError(ar ? 'تعذر تحميل دورة حياة المشروع.' : 'Could not load the project lifecycle.');
    setSummary(lifecycle); setTimeline(timelineResult?.events ?? []); setLineage(lineageResult?.edges ?? []); setHandoffs(handoffResult); setLoading(false);
  };

  useEffect(() => { void load(); }, [activeProject?.id, ar]); // eslint-disable-line react-hooks/exhaustive-deps
  const blockers = useMemo(() => summary?.stages.flatMap(stage => stage.blockers.map(text => ({ stage: stage.key, text }))) ?? [], [summary]);
  const analysisOutputs = summary?.stages.find(stage => stage.key === 'ANALYSIS')?.outputs ?? [];
  const manuscriptOutputs = summary?.stages.find(stage => stage.key === 'MANUSCRIPT')?.outputs ?? [];
  const stageLabel = (key: string) => labels[key]?.[ar ? 0 : 1] ?? key.replaceAll('_', ' ');
  const routeFor = (stage: string) => STAGE_ROUTES[stage]?.replace(':projectId', activeProject?.id ?? '');

  if (!activeProject) return <EmptyState title={ar ? 'لا يوجد مشروع نشط' : 'No active project'} description={ar ? 'اختر مشروعًا لعرض دورة حياته البحثية.' : 'Select a project to view its research lifecycle.'} />;
  if (loading) return <section className="mx-auto max-w-[1440px] space-y-4" aria-busy="true"><Card><div className="h-32 motion-safe:animate-pulse rounded-xl bg-[var(--ds-surface-secondary)]" /></Card></section>;

  return <section className="mx-auto max-w-[1440px] min-w-0 space-y-6 overflow-x-clip pb-16" aria-labelledby="lifecycle-title">
    <PathPanel accent="var(--ds-path-research)">
    <header>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div><span className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--ds-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--ds-primary)]"><GitBranch size={15}/>{ar ? 'منتج بحثي واحد' : 'One research product'}</span>
          <h2 id="lifecycle-title" className="m-0 text-2xl font-black md:text-4xl">{ar ? 'مركز قيادة المشروع البحثي' : 'Research Project Command Center'}</h2>
          <p className="mt-2 text-sm font-bold text-[var(--ds-text-primary)]">{ar ? activeProject.titleAr : activeProject.titleEn}</p>
          <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">{summary ? `${stageLabel(summary.current_stage)} · ${summary.template.replaceAll('_', ' ')}` : ''}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-80"><Card padding="sm"><span className="block text-xs text-[var(--ds-text-secondary)]">{ar ? 'تقدم دورة الحياة' : 'Lifecycle progress'}</span><strong className="text-3xl text-ink ds-numeric">{summary?.progress ?? 0}%</strong></Card><Card padding="sm"><span className="block text-xs text-[var(--ds-text-secondary)]">{ar ? 'جاهزية المرحلة' : 'Stage readiness'}</span><strong className="text-3xl text-ink ds-numeric">{summary?.current_stage_readiness ?? 0}%</strong></Card></div>
      </div>
    </header>
    </PathPanel>

    {error && <div role="alert" className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-soft)] p-4 font-bold">{error}</div>}

    <section aria-labelledby="rail-title"><div className="mb-3 flex items-center justify-between"><h2 id="rail-title" className="m-0 text-lg font-black">{ar ? 'مسار دورة الحياة' : 'Lifecycle rail'}</h2><Button variant="ghost" size="sm" iconBefore={<RefreshCw size={15}/>} onClick={load}>{ar ? 'تحديث' : 'Refresh'}</Button></div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-4" role="region" tabIndex={0} aria-label={ar ? 'مراحل دورة حياة المشروع' : 'Project lifecycle stages'}>
        <ol className="flex min-w-max items-start gap-2 p-0" aria-label={ar ? 'تسلسل المراحل' : 'Stage sequence'}>{summary?.stages.map((stage, index) => <li key={stage.key} className="flex items-center"><button onClick={() => document.getElementById(`stage-${stage.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`flex w-36 flex-col items-center gap-2 rounded-xl border p-3 text-center ${statusClass(stage.status)}`} aria-current={stage.key === summary.current_stage ? 'step' : undefined}><span className="grid h-8 w-8 place-items-center rounded-full border border-current"><StageIcon stage={stage}/></span><span className="text-xs font-black">{stageLabel(stage.key)}</span><span className="text-[10px]">{statusLabels[stage.status]?.[ar ? 0 : 1] ?? stage.status}</span></button>{index < summary.stages.length - 1 && <span className="mx-1 h-px w-6 bg-[var(--ds-border-strong)]" aria-hidden="true"/>}</li>)}</ol>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Card variant={summary?.next_action.priority === 'CRITICAL' ? 'warning' : 'ai-accent'}><div className="mb-3 flex items-center gap-2 text-[var(--ds-primary)]"><Sparkles size={20}/><h2 className="m-0 text-lg font-black">{ar ? 'الإجراء الأكاديمي التالي' : 'Next academic action'}</h2></div><span className="rounded-full bg-[var(--ds-surface-primary)] px-3 py-1 text-xs font-black">{summary?.next_action.priority}</span><h3 className="mt-5 text-xl">{summary?.next_action.title}</h3><p className="text-sm leading-7 text-[var(--ds-text-secondary)]">{summary?.next_action.rationale}</p><div className="mt-4 flex items-center gap-2 text-xs text-[var(--ds-text-secondary)]"><ShieldCheck size={16}/>{ar ? 'أولوية حتمية؛ الذكاء الاصطناعي لا يغيّر الحالة' : 'Deterministic priority; AI cannot change state'}</div></Card>
      <Card><div className="mb-3 flex items-center gap-2"><AlertTriangle size={19} className="text-[var(--ds-warning)]"/><h2 className="m-0 text-lg font-black">{ar ? 'العوائق' : 'Blockers'}</h2></div>{blockers.length ? <ul className="space-y-2 p-0">{blockers.slice(0, 5).map(item => <li key={`${item.stage}-${item.text}`} className="list-none rounded-lg bg-[var(--ds-surface-secondary)] p-3 text-sm"><b>{stageLabel(item.stage)}:</b> {item.text}</li>)}</ul> : <EmptyState bare className="py-4" title={ar ? 'لا توجد عوائق مسجلة' : 'No blockers recorded'} description={ar ? 'المرحلة الحالية بلا عوائق موثّقة.' : 'The current stage has no documented blockers.'}/>}</Card>
    </section>

    <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label={ar ? 'تفاصيل المشروع' : 'Project details'}>{(['overview','handoffs','timeline','lineage'] as const).map(key => <button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab===key?'border-[var(--ds-primary)] bg-[var(--ds-primary-soft)] text-[var(--ds-text-primary)]':'border-transparent bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'}`}>{key==='overview'?(ar?'المراحل':'Stages'):key==='handoffs'?(ar?'التسليمات':'Handoffs'):key==='timeline'?(ar?'سجل المشروع':'Timeline'):(ar?'ترابط البحث':'Lineage')}</button>)}</div>

    {tab === 'overview' && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={ar ? 'بطاقات المراحل' : 'Stage cards'}>{summary?.stages.map(stage => <Card key={stage.key} id={`stage-${stage.key}`}><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="m-0 text-base font-black">{stageLabel(stage.key)}</h2><span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass(stage.status)}`}><StageIcon stage={stage}/>{statusLabels[stage.status]?.[ar ? 0 : 1]}</span></div><strong className="text-xl text-ink ds-numeric">{stage.readiness}%</strong></div><div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--ds-surface-tertiary)]"><div className="h-full bg-[var(--ds-primary)]" style={{width:`${stage.readiness}%`}}/></div>{stage.blockers[0] && <p className="text-xs leading-6 text-[var(--ds-danger)]">{stage.blockers[0]}</p>}<p className="text-xs text-[var(--ds-text-secondary)]">{ar ? `المخرجات المرتبطة: ${stage.outputs.length}` : `Linked outputs: ${stage.outputs.length}`}</p>{routeFor(stage.key) && stage.status !== 'DEFERRED_CAPABILITY' && <Button variant="outline" size="sm" iconAfter={ar?<ArrowLeft size={14}/>:<ArrowRight size={14}/>} onClick={()=>navigate(routeFor(stage.key))}>{ar ? 'فتح مساحة العمل' : 'Open workspace'}</Button>}</Card>)}</section>}

    {tab === 'handoffs' && <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]" aria-label={ar ? 'مركز التسليم الأكاديمي' : 'Academic handoff center'}><Card><h2 className="mt-0 text-lg font-black">{ar ? 'إنشاء تسليم منضبط' : 'Create a controlled handoff'}</h2><p className="text-sm leading-7 text-[var(--ds-text-secondary)]">{ar?'ينقل المراجع واللقطات المعتمدة فقط، ولا ينسخ المشروع كاملًا.':'Transfers references and approved snapshots only; it never copies the whole project.'}</p><div className="space-y-3"><Button fullWidth variant="outline" onClick={async()=>{await apiCreateAcademicHandoff(activeProject.id,'RESEARCH_TO_DATA',activeProject.id);await load();}}>{ar?'تسليم التصميم إلى البيانات':'Send design to Data'}</Button>{analysisOutputs.map(output => <div key={output.id} className="rounded-xl border border-[var(--ds-border-subtle)] p-3"><b className="block text-sm">{output.title}</b><span className="text-xs text-[var(--ds-text-secondary)]">{output.approved?(ar?'معتمد':'Approved'):(ar?'ينتظر الاعتماد':'Awaiting approval')}</span><div className="mt-2 flex flex-wrap gap-2">{!output.approved&&output.status==='COMPLETED'&&<Button size="sm" variant="success" onClick={async()=>{await apiApproveAnalysisResult(activeProject.id,output.id);await load();}}>{ar?'اعتماد بشري':'Human approval'}</Button>}{output.approved&&manuscriptOutputs[0]&&<Button size="sm" onClick={async()=>{await apiCreateAcademicHandoff(activeProject.id,'DATA_TO_PUBLICATION',output.id,manuscriptOutputs[0].id);await load();}}>{ar?'إرسال للمخطوطة':'Send to manuscript'}</Button>}</div></div>)}</div></Card><Card><h2 className="mt-0 text-lg font-black">{ar ? 'سجل التسليمات' : 'Handoff register'}</h2>{handoffs.length?<ul className="space-y-3 p-0">{handoffs.map(handoff=><li key={handoff.id} className="list-none rounded-xl border border-[var(--ds-border-subtle)] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><b className="block text-sm">{handoff.handoff_type.replaceAll('_',' → ')}</b><span className="text-xs text-[var(--ds-text-secondary)]">v{handoff.source_version||'—'} · {handoff.target_domain}</span></div><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass(handoff.status)}`}>{handoff.status}</span></div>{handoff.status==='PENDING'&&<Button className="mt-3" size="sm" variant="outline" onClick={async()=>{await apiAcceptAcademicHandoff(activeProject.id,handoff.id);await load();}}>{ar?'قبول التسليم':'Accept handoff'}</Button>}</li>)}</ul>:<EmptyState bare className="py-4" title={ar?'لا توجد تسليمات بعد':'No handoffs yet'} description={ar?'ستظهر التسليمات هنا بعد إرسال التصميم أو النتائج المعتمدة.':'Handoffs appear here after sending design or approved results.'}/>}</Card></section>}

    {tab === 'timeline' && <Card><h2 className="mt-0 text-lg font-black">{ar ? 'سجل المشروع الموحد' : 'Unified project timeline'}</h2>{timeline.length ? <ol className="relative space-y-4 border-s border-[var(--ds-border-strong)] ps-5">{timeline.map(event => <li key={`${event.type}-${event.id}`}><span className="absolute -ms-[25px] mt-1 h-2.5 w-2.5 rounded-full bg-[var(--ds-primary)]"/><b className="block text-sm">{event.title || event.type}</b><span className="text-xs text-[var(--ds-text-secondary)]">{event.type} · {new Date(event.occurred_at).toLocaleDateString(ar?'ar-SA':'en-US')}</span></li>)}</ol>:<EmptyState bare className="py-4" title={ar?'لا توجد أحداث مرتبطة بعد':'No linked events yet'} description={ar?'سيُبنى السجل من خطوات التصميم والبيانات والنشر.':'The timeline is built from design, data, and publication steps.'}/>}</Card>}

    {tab === 'lineage' && <Card><div className="mb-4 flex items-center gap-2"><Link2 size={19}/><h2 className="m-0 text-lg font-black">{ar ? 'ترابط البحث ومصدر النتائج' : 'Research lineage and provenance'}</h2></div>{lineage.length ? <ol className="space-y-3 p-0">{lineage.map(edge => <li key={edge.id} className="grid list-none gap-2 rounded-xl border border-[var(--ds-border-subtle)] p-3 text-xs sm:grid-cols-[1fr_auto_1fr] sm:items-center"><span className="rounded-lg bg-[var(--ds-surface-secondary)] p-2 font-bold">{edge.source.type}<br/><span className="font-normal text-[var(--ds-text-muted)]">{edge.source.version ? `v${edge.source.version}` : edge.source.id}</span></span><span className="flex items-center justify-center gap-1 text-[var(--ds-primary)]"><ListChecks size={14}/>{edge.relationship}</span><span className="rounded-lg bg-[var(--ds-surface-secondary)] p-2 font-bold">{edge.target.type}<br/><span className="font-normal text-[var(--ds-text-muted)]">{edge.target.version ? `v${edge.target.version}` : edge.target.id}</span></span></li>)}</ol>:<EmptyState bare className="py-4" title={ar?'لا توجد علاقات بعد':'No relationships yet'} description={ar?'ستظهر العلاقات بعد ربط المتغيرات وإنشاء عمليات التسليم الأكاديمي.':'Relationships appear after variable mapping and academic handoffs.'}/>}</Card>}
  </section>;
};
