import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, FileText, Library, Send, ShieldCheck, Users } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { ROUTES } from '../../router/routes';
import { PathPanel } from '../../design-system/components/Navigation';
import { EmptyState } from '../../design-system/components/Feedback';
import { Button } from '../../design-system/components/Button';
import {
  apiAddManuscriptAuthor,
  apiCreateManuscriptVersion,
  apiCreatePublicationSubmission,
  apiGetManuscriptAuthorship,
  apiListPublicationJournals,
  apiListScholarlyAssets,
  apiPublicationCommandCenter,
  apiShortlistPublicationJournal,
} from '../../utils/api';

type Center = {
  asset: { id: string; title_ar?: string; title_en?: string; lifecycle_status: string };
  version: { id: string; number: number; article_type: string; fingerprint: string } | null;
  manuscript_readiness: { score: number; status: string; blocking: Array<Record<string, string>>; sections: Array<{ key: string; status: string }> };
  reporting_compliance: { status: string; score: number | null };
  journal_match: { shortlisted: number; status: string };
  submission_readiness: { status: string };
  next_best_action: Record<string, string>;
  shortlist?: Array<{ journal_id: string; position: string; title: string }>;
  submissions?: Array<{ id: string; status: string; journal_id: string; journal_title?: string }>;
};

export const PublicationCommandCenter: React.FC = () => {
  const { language, user } = useProject();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const [assets, setAssets] = useState<any[]>([]);
  const [assetId, setAssetId] = useState('');
  const [center, setCenter] = useState<Center | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [tab, setTab] = useState<'outline' | 'journals' | 'authorship' | 'submissions'>('outline');
  const [journals, setJournals] = useState<Array<{ id: string; title: string; issn?: string }>>([]);
  const [selectedJournal, setSelectedJournal] = useState('');
  const [authorship, setAuthorship] = useState<any | null>(null);
  const [authorName, setAuthorName] = useState('');
  const manuscripts = useMemo(() => assets.filter(a => a.asset_type === 'MANUSCRIPT'), [assets]);

  const reloadCenter = async (id: string) => {
    const next = await apiPublicationCommandCenter(id);
    setCenter(next);
    if (next?.version?.id) {
      setAuthorship(await apiGetManuscriptAuthorship(id, next.version.id));
    } else {
      setAuthorship(null);
    }
  };

  useEffect(() => {
    apiListScholarlyAssets().then(items => {
      const list = items ?? [];
      setAssets(list);
      const first = list.find(a => a.asset_type === 'MANUSCRIPT');
      if (first) setAssetId(first.id);
    });
    apiListPublicationJournals().then(setJournals);
  }, []);
  useEffect(() => { if (assetId) void reloadCenter(assetId); }, [assetId]);

  const createVersion = async () => {
    if (!assetId) return;
    setBusy(true);
    try {
      await apiCreateManuscriptVersion(assetId, 'ORIGINAL_RESEARCH');
      await reloadCenter(assetId);
    } finally {
      setBusy(false);
    }
  };

  const shortlist = async () => {
    if (!assetId || !selectedJournal) return;
    setBusy(true);
    try {
      await apiShortlistPublicationJournal(assetId, selectedJournal);
      await reloadCenter(assetId);
    } finally {
      setBusy(false);
    }
  };

  const addAuthor = async () => {
    if (!assetId || !center?.version?.id || !user?.id || !authorName.trim()) return;
    setBusy(true);
    try {
      await apiAddManuscriptAuthor(assetId, center.version.id, {
        user_id: user.id,
        display_name: authorName.trim(),
        author_order: (authorship?.authors?.length || 0) + 1,
        is_corresponding_author: !(authorship?.authors?.length),
        credit_roles: ['Writing – Original Draft'],
      });
      setAuthorName('');
      await reloadCenter(assetId);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (journalId: string) => {
    if (!assetId || !center?.version?.id) return;
    setBusy(true);
    try {
      await apiCreatePublicationSubmission(assetId, { journal_id: journalId, manuscript_version_id: center.version.id });
      await reloadCenter(assetId);
    } finally {
      setBusy(false);
    }
  };

  const cards = center ? [
    { label: ar ? 'جاهزية المخطوطة' : 'Manuscript readiness', value: `${center.manuscript_readiness.score}%`, icon: FileText },
    { label: ar ? 'امتثال الإبلاغ' : 'Reporting compliance', value: center.reporting_compliance.score == null ? (ar ? 'تأكيد بشري' : 'Human review') : `${center.reporting_compliance.score}%`, icon: ShieldCheck },
    { label: ar ? 'ملاءمة المجلات' : 'Journal match', value: `${center.journal_match.shortlisted}`, icon: Library },
    { label: ar ? 'جاهزية التقديم' : 'Submission readiness', value: center.submission_readiness.status, icon: Send },
  ] : [];

  const tabs = [
    ['outline', ar ? 'المخطوطة' : 'Manuscript'],
    ['journals', ar ? 'المجلات' : 'Journals'],
    ['authorship', ar ? 'التأليف' : 'Authorship'],
    ['submissions', ar ? 'التقديم' : 'Submissions'],
  ] as const;

  return <section dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl min-w-0 space-y-5" aria-labelledby="publication-title">
    <PathPanel accent="var(--ds-path-publication)">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-caption mb-2 font-black text-path-publication">{ar ? 'بصيرة · ذكاء النشر' : 'Baseerah · Publication'}</p>
          <h2 id="publication-title" className="text-h2 m-0 text-ink">{ar ? 'مركز ذكاء النشر العلمي' : 'Publication Intelligence Command Center'}</h2>
          <p className="text-body-sm mt-2 max-w-3xl text-secondary">{ar ? 'جاهزية المخطوطة وامتثال الإبلاغ وملاءمة المجلات ومسار التقديم—كل مقياس مستقل وقابل للتفسير.' : 'Manuscript readiness, reporting compliance, journal suitability, and submission workflow—kept separate and explainable.'}</p>
        </div>
        <BookOpen className="h-11 w-11 text-path-publication" aria-hidden="true" />
      </div>
      <label className="mt-5 block max-w-xl text-sm font-bold">{ar ? 'المخطوطة' : 'Manuscript'}
        <select value={assetId} onChange={e => setAssetId(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]">
          <option value="">{ar ? 'اختر مخطوطة' : 'Select a manuscript'}</option>
          {manuscripts.map(a => <option key={a.id} value={a.id}>{ar ? a.title_ar || a.title_en : a.title_en || a.title_ar}</option>)}
        </select>
      </label>
    </PathPanel>
    {!assetId && (
      <EmptyState
        illustration={<FileText size={40} />}
        title={ar ? 'لا توجد مخطوطة محددة' : 'No manuscript selected'}
        description={ar ? 'أنشئ مخطوطة من مشروع بحثي أولًا، ثم عد إلى هذا المركز لفحص الجاهزية.' : 'Create a manuscript from a research project first, then return here to check readiness.'}
        actionButton={
          <Button type="button" size="sm" onClick={() => navigate(ROUTES.ASSETS)}>
            {ar ? 'سجل الأصول العلمية' : 'Open scholarly assets'}
          </Button>
        }
      />
    )}
    {center && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={ar ? 'مؤشرات النشر' : 'Publication indicators'}>{cards.map(({label,value,icon:Icon}) => <article key={label} className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-5"><Icon className="mb-3 h-5 w-5 text-secondary"/><p className="text-caption font-bold text-[var(--ds-text-muted)]">{label}</p><p className="mt-1 text-xl font-black text-ink ds-numeric">{value}</p></article>)}</section>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab === id ? 'border-[var(--ds-primary)] bg-[var(--ds-primary-soft)] text-ink' : 'border-transparent bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'}`}>{label}</button>
        ))}
      </div>
      {tab === 'outline' && (
      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <article className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-h2">{ar ? 'بنية المخطوطة' : 'Manuscript outline'}</h2>
            {!center.version && <button disabled={busy} onClick={createVersion} className="rounded-xl bg-action px-4 py-2 text-sm font-bold text-on-action">{ar ? 'إنشاء النسخة الأولى' : 'Create first version'}</button>}
          </div>
          {center.version && <p className="text-caption mt-1 text-[var(--ds-text-muted)]">v{center.version.number} · {center.version.article_type}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{center.manuscript_readiness.sections.map(section => <div key={section.key} className="flex items-center justify-between rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm"><span>{section.key.replaceAll('_',' ')}</span><span className="flex items-center gap-1 text-xs font-bold">{section.status === 'READY' ? <CheckCircle2 className="h-4 w-4 text-success"/> : section.status === 'STALE' ? <AlertTriangle className="h-4 w-4 text-warning"/> : <AlertTriangle className="h-4 w-4 text-[var(--ds-information)]"/>}{section.status === 'STALE' ? (ar ? 'قديم' : 'Stale') : section.status}</span></div>)}</div>
        </article>
        <aside className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5">
          <h2 className="text-h2">{ar ? 'الإجراء التالي' : 'Next best action'}</h2>
          <p className="text-body-sm mt-4 rounded-xl bg-warning/10 p-4 font-bold"><span className="mb-1 block text-xs text-warning">{center.next_best_action.priority}</span>{String(center.next_best_action.code || '')}</p>
          <p className="text-caption mt-4 text-[var(--ds-text-muted)]">{ar ? 'اختيار المجلة والتقديم والنشر قرارات بشرية. درجة الملاءمة لا تمثل احتمال القبول.' : 'Journal selection, submission, and publication remain human decisions. Match never represents acceptance probability.'}</p>
          <button type="button" onClick={() => setShowRequirements((open) => !open)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--ds-border-default)] p-3 text-sm font-bold">{showRequirements ? (ar ? 'إخفاء تفاصيل المتطلبات' : 'Hide requirement details') : (ar ? 'فتح تفاصيل المتطلبات' : 'Open requirement details')}<ChevronLeft className="h-4 w-4 rtl:rotate-180"/></button>
          {showRequirements && <ul className="mt-3 space-y-2 p-0">{(center.manuscript_readiness.blocking.length ? center.manuscript_readiness.blocking : [{ code: center.next_best_action.code || 'READY', detail: ar ? 'لا توجد عوائق موثّقة لهذه النسخة.' : 'No documented blockers for this version.' }]).map((item, index) => <li key={`${item.code || index}`} className="list-none rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-xs font-semibold">{String(item.code || item.detail || (ar ? 'تفاصيل غير متاحة — راجع المخطوطة.' : 'Details unavailable — review the manuscript.'))}</li>)}</ul>}
        </aside>
      </section>
      )}
      {tab === 'journals' && (
        <article className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5 space-y-4">
          <h2 className="text-h2 m-0">{ar ? 'القائمة المختصرة للمجلة' : 'Journal shortlist'}</h2>
          <p className="text-caption text-[var(--ds-text-muted)]">{ar ? 'الملاءمة دعم للقرار وليست احتمال قبول.' : 'Suitability is decision support, not acceptance probability.'}</p>
          {(center.shortlist || []).length === 0 ? <EmptyState bare title={ar ? 'لا مجلات مختارة' : 'No journals selected'} description={ar ? 'أضف مجلة من الكتالوج إلى القائمة المختصرة.' : 'Add a catalog journal to the shortlist.'} /> : (center.shortlist || []).map(item => (
            <div key={item.journal_id} className="flex items-center justify-between rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
              <span>{item.title}</span>
              <span className="text-xs font-bold">{item.position}</span>
            </div>
          ))}
          {journals.length === 0 ? <p className="text-caption text-[var(--ds-text-muted)]">{ar ? 'كتالوج المجلات فارغ حتى يضيفه مدير المؤسسة.' : 'The journal catalog is empty until an organization admin adds titles.'}</p> : (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={e => { e.preventDefault(); void shortlist(); }}>
              <label className="block flex-1 text-sm font-bold">{ar ? 'مجلة من الكتالوج' : 'Catalog journal'}
                <select value={selectedJournal} onChange={e => setSelectedJournal(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3">
                  <option value="">{ar ? 'اختر مجلة' : 'Select a journal'}</option>
                  {journals.map(j => <option key={j.id} value={j.id}>{j.title}{j.issn ? ` · ${j.issn}` : ''}</option>)}
                </select>
              </label>
              <Button type="submit" disabled={busy || !selectedJournal}>{ar ? 'إضافة إلى المختصر' : 'Add to shortlist'}</Button>
            </form>
          )}
        </article>
      )}
      {tab === 'authorship' && (
        <article className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5 space-y-4">
          <div className="flex items-center gap-2"><Users size={18} /><h2 className="text-h2 m-0">{ar ? 'التأليف وCRediT' : 'Authorship and CRediT'}</h2></div>
          {!center.version ? <EmptyState bare title={ar ? 'أنشئ نسخة أولًا' : 'Create a version first'} description={ar ? 'التأليف يُربط بنسخة المخطوطة.' : 'Authorship is attached to a manuscript version.'} /> : (
            <>
              {(authorship?.authors || []).map((author: any) => (
                <div key={author.id || author.user_id} className="rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
                  <p className="m-0 font-bold">{author.display_name || author.user_id}{author.is_corresponding_author ? (ar ? ' · المؤلف المراسل' : ' · corresponding') : ''}</p>
                  <p className="text-caption mt-1">{ar ? `الترتيب ${author.author_order}` : `Order ${author.author_order}`} · {(author.credit_roles || []).join(', ') || '—'}</p>
                </div>
              ))}
              <form className="space-y-3" onSubmit={e => { e.preventDefault(); void addAuthor(); }}>
                <label className="block text-sm font-bold">{ar ? 'اسم المؤلف (يسجَّل لحسابك الحالي)' : 'Author name (recorded for your account)'}
                  <input className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3" value={authorName} onChange={e => setAuthorName(e.target.value)} required />
                </label>
                <Button type="submit" disabled={busy || !authorName.trim()}>{ar ? 'إضافة مؤلف' : 'Add author'}</Button>
              </form>
            </>
          )}
        </article>
      )}
      {tab === 'submissions' && (
        <article className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-5 space-y-4">
          <h2 className="text-h2 m-0">{ar ? 'مسار التقديم' : 'Submission track'}</h2>
          {(center.submissions || []).length === 0 ? <EmptyState bare title={ar ? 'لا تقديمات بعد' : 'No submissions yet'} description={ar ? 'التقديم يتطلب جاهزية المخطوطة ومجلة في المختصر.' : 'Submission requires manuscript readiness and a shortlisted journal.'} /> : (center.submissions || []).map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
              <span>{item.journal_title || item.journal_id}</span>
              <span className="text-xs font-bold">{item.status}</span>
            </div>
          ))}
          {(center.shortlist || []).map(item => (
            <Button key={item.journal_id} disabled={busy || !center.version || center.submission_readiness.status !== 'READY'} onClick={() => void submit(item.journal_id)}>
              {ar ? `تجهيز تقديم إلى ${item.title}` : `Prepare submission to ${item.title}`}
            </Button>
          ))}
        </article>
      )}
    </>}
  </section>;
};

export default PublicationCommandCenter;
