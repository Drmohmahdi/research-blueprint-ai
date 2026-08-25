import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, FileText, Library, Send, ShieldCheck } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { PathPanel } from '../../design-system/components/Navigation';
import { EmptyState } from '../../design-system/components/Feedback';
import { apiCreateManuscriptVersion, apiListScholarlyAssets, apiPublicationCommandCenter } from '../../utils/api';

type Center = {
  asset: { id: string; title_ar?: string; title_en?: string; lifecycle_status: string };
  version: { id: string; number: number; article_type: string; fingerprint: string } | null;
  manuscript_readiness: { score: number; status: string; blocking: Array<Record<string, string>>; sections: Array<{ key: string; status: string }> };
  reporting_compliance: { status: string; score: number | null };
  journal_match: { shortlisted: number; status: string };
  submission_readiness: { status: string };
  next_best_action: Record<string, string>;
};

export const PublicationCommandCenter: React.FC = () => {
  const { language } = useProject();
  const ar = language === 'ar';
  const [assets, setAssets] = useState<any[]>([]);
  const [assetId, setAssetId] = useState('');
  const [center, setCenter] = useState<Center | null>(null);
  const [busy, setBusy] = useState(false);
  const manuscripts = useMemo(() => assets.filter(a => a.asset_type === 'MANUSCRIPT'), [assets]);

  useEffect(() => { apiListScholarlyAssets().then(items => { const list = items ?? []; setAssets(list); const first = list.find(a => a.asset_type === 'MANUSCRIPT'); if (first) setAssetId(first.id); }); }, []);
  useEffect(() => { if (assetId) apiPublicationCommandCenter(assetId).then(setCenter); }, [assetId]);
  const createVersion = async () => { if (!assetId) return; setBusy(true); try { await apiCreateManuscriptVersion(assetId, 'ORIGINAL_RESEARCH'); setCenter(await apiPublicationCommandCenter(assetId)); } finally { setBusy(false); } };
  const cards = center ? [
    { label: ar ? 'جاهزية المخطوطة' : 'Manuscript readiness', value: `${center.manuscript_readiness.score}%`, icon: FileText },
    { label: ar ? 'امتثال الإبلاغ' : 'Reporting compliance', value: center.reporting_compliance.score == null ? (ar ? 'تأكيد بشري' : 'Human review') : `${center.reporting_compliance.score}%`, icon: ShieldCheck },
    { label: ar ? 'ملاءمة المجلات' : 'Journal match', value: `${center.journal_match.shortlisted}`, icon: Library },
    { label: ar ? 'جاهزية التقديم' : 'Submission readiness', value: center.submission_readiness.status, icon: Send },
  ] : [];

  return <section dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl min-w-0 space-y-5" aria-labelledby="publication-title">
    <PathPanel accent="var(--ds-path-publication)">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="mb-2 text-xs font-black text-path-publication">BASEERAH · PUBLICATION INTELLIGENCE</p><h2 id="publication-title" className="m-0 text-2xl font-black text-ink sm:text-3xl">{ar ? 'مركز ذكاء النشر العلمي' : 'Publication Intelligence Command Center'}</h2><p className="mt-2 max-w-3xl text-sm text-secondary">{ar ? 'جاهزية المخطوطة وامتثال الإبلاغ وملاءمة المجلات ومسار التقديم—كل مقياس مستقل وقابل للتفسير.' : 'Manuscript readiness, reporting compliance, journal suitability, and submission workflow—kept separate and explainable.'}</p></div>
        <BookOpen className="h-11 w-11 text-path-publication" aria-hidden="true" />
      </div>
      <label className="mt-5 block max-w-xl text-sm font-bold">{ar ? 'المخطوطة' : 'Manuscript'}<select value={assetId} onChange={e => setAssetId(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"><option value="">{ar ? 'اختر مخطوطة' : 'Select a manuscript'}</option>{manuscripts.map(a => <option key={a.id} value={a.id}>{ar ? a.title_ar || a.title_en : a.title_en || a.title_ar}</option>)}</select></label>
    </PathPanel>
    {!assetId && <EmptyState illustration={<FileText size={40} />} title={ar ? 'لا توجد مخطوطة محددة' : 'No manuscript selected'} description={ar ? 'أنشئ مخطوطة من مشروع بحثي أولًا.' : 'Create a manuscript from a research project first.'} />}
    {center && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={ar ? 'مؤشرات النشر' : 'Publication indicators'}>{cards.map(({label,value,icon:Icon}) => <article key={label} className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-5"><Icon className="mb-3 h-5 w-5 text-secondary"/><p className="text-xs font-bold text-[var(--ds-text-muted)]">{label}</p><p className="mt-1 text-xl font-black text-ink ds-numeric">{value}</p></article>)}</section>
      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <article className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5"><div className="flex items-center justify-between"><h2 className="font-black">{ar ? 'بنية المخطوطة' : 'Manuscript outline'}</h2>{!center.version && <button disabled={busy} onClick={createVersion} className="rounded-xl bg-action px-4 py-2 text-sm font-bold text-on-action">{ar ? 'إنشاء النسخة الأولى' : 'Create first version'}</button>}</div>{center.version && <p className="mt-1 text-xs text-[var(--ds-text-muted)]">v{center.version.number} · {center.version.article_type}</p>}<div className="mt-4 grid gap-2 sm:grid-cols-2">{center.manuscript_readiness.sections.map(section => <div key={section.key} className="flex items-center justify-between rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm"><span>{section.key.replaceAll('_',' ')}</span><span className="flex items-center gap-1 text-xs font-bold">{section.status === 'READY' ? <CheckCircle2 className="h-4 w-4 text-success"/> : section.status === 'STALE' ? <AlertTriangle className="h-4 w-4 text-warning"/> : <AlertTriangle className="h-4 w-4 text-[var(--ds-information)]"/>}{section.status === 'STALE' ? (ar ? 'قديم' : 'Stale') : section.status}</span></div>)}</div></article>
        <aside className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5"><h2 className="font-black">{ar ? 'الإجراء التالي' : 'Next best action'}</h2><p className="mt-4 rounded-xl bg-warning/10 p-4 text-sm font-bold"><span className="mb-1 block text-xs text-warning">{center.next_best_action.priority}</span>{String(center.next_best_action.code || '')}</p><p className="mt-4 text-xs leading-6 text-[var(--ds-text-muted)]">{ar ? 'اختيار المجلة والتقديم والنشر قرارات بشرية. درجة الملاءمة لا تمثل احتمال القبول.' : 'Journal selection, submission, and publication remain human decisions. Match never represents acceptance probability.'}</p><button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--ds-border-default)] p-3 text-sm font-bold">{ar ? 'فتح تفاصيل المتطلبات' : 'Open requirement details'}<ChevronLeft className="h-4 w-4"/></button></aside>
      </section>
    </>}
  </section>;
};

export default PublicationCommandCenter;
