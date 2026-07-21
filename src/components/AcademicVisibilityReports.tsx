import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { apiGetMyProfile, apiListScholarlyAssets } from '../utils/api';
import { ROUTES } from '../router/routes';
import { Card } from '../design-system/components/Card';
import {
  FileBarChart,
  Printer,
  Copy,
  Loader2,
  ShieldAlert,
  Link as LinkIcon,
  Calendar,
  Globe
} from 'lucide-react';

const ASSET_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  JOURNAL_PAPER: { ar: 'ورقة علمية محكمة', en: 'Journal Paper' },
  RESEARCH_PROJECT: { ar: 'مشروع بحثي', en: 'Research Project' },
  BOOK: { ar: 'كتاب / مؤلف', en: 'Book / Monograph' },
  CONFERENCE_PAPER: { ar: 'ورقة مؤتمر', en: 'Conference Paper' },
  PATENT: { ar: 'براءة اختراع', en: 'Patent' },
  THESIS: { ar: 'رسالة علمية', en: 'Thesis / Dissertation' },
};

const CHANNEL_TYPES = ['ORCID', 'GOOGLE_SCHOLAR', 'SCOPUS', 'RESEARCHGATE', 'LINKEDIN', 'GITHUB'];

export const AcademicVisibilityReports: React.FC = () => {
  const { language } = useProject();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  const [profile, setProfile] = useState<any | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const [profileData, assetsData] = await Promise.all([
        apiGetMyProfile(),
        apiListScholarlyAssets(),
      ]);
      if (profileData) setProfile(profileData);
      if (assetsData) setAssets(assetsData);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[var(--ds-text-muted)]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-bold">{isAr ? 'جارِ إعداد التقرير...' : 'Preparing report...'}</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto text-center py-24 space-y-2">
        <ShieldAlert className="mx-auto text-rose-500" size={28} />
        <p className="text-sm font-bold text-[var(--ds-text-secondary)]">
          {isAr ? 'تعذّر تحميل بيانات التقرير. تأكد من تسجيل الدخول وحاول مجددًا.' : 'Could not load report data. Make sure you are signed in and try again.'}
        </p>
      </div>
    );
  }

  const identifiers: any[] = profile.identifiers || [];
  const linkedChannels = CHANNEL_TYPES.filter(type => identifiers.some(i => i.identifier_type === type && i.identifier_value));
  const missingChannels = CHANNEL_TYPES.filter(type => !linkedChannels.includes(type));

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let withDoi = 0;
  for (const a of assets) {
    byType[a.asset_type] = (byType[a.asset_type] || 0) + 1;
    byStatus[a.lifecycle_status] = (byStatus[a.lifecycle_status] || 0) + 1;
    if (a.doi) withDoi += 1;
  }

  const timeline = [...assets]
    .filter(a => a.publication_date)
    .sort((a, b) => (b.publication_date > a.publication_date ? 1 : -1));

  const displayName = isAr
    ? (profile.preferred_name_ar || profile.preferred_name_en || '—')
    : (profile.preferred_name_en || profile.preferred_name_ar || '—');

  const buildTextReport = () => {
    const lines: string[] = [];
    lines.push(isAr ? `تقرير الانتشار الأكاديمي — ${displayName}` : `Academic Visibility Report — ${displayName}`);
    lines.push(new Date().toLocaleDateString(isAr ? 'ar' : 'en'));
    lines.push('');
    lines.push(isAr ? `نسبة اكتمال الملف: ${profile.completeness_score ?? 0}%` : `Profile completeness: ${profile.completeness_score ?? 0}%`);
    lines.push(isAr
      ? `القنوات المرتبطة: ${linkedChannels.length} من ${CHANNEL_TYPES.length} (${linkedChannels.join('، ') || 'لا شيء'})`
      : `Linked channels: ${linkedChannels.length} of ${CHANNEL_TYPES.length} (${linkedChannels.join(', ') || 'none'})`);
    if (missingChannels.length > 0) {
      lines.push(isAr ? `القنوات الناقصة: ${missingChannels.join('، ')}` : `Missing channels: ${missingChannels.join(', ')}`);
    }
    lines.push('');
    lines.push(isAr ? `إجمالي الأصول العلمية: ${assets.length}` : `Total scholarly assets: ${assets.length}`);
    for (const [type, count] of Object.entries(byType)) {
      const label = ASSET_TYPE_LABELS[type] ? (isAr ? ASSET_TYPE_LABELS[type].ar : ASSET_TYPE_LABELS[type].en) : type;
      lines.push(`  - ${label}: ${count}`);
    }
    lines.push(isAr ? `تحمل معرّف DOI: ${withDoi} من ${assets.length}` : `With DOI: ${withDoi} of ${assets.length}`);
    if (timeline.length > 0) {
      lines.push('');
      lines.push(isAr ? 'أحدث المنشورات:' : 'Recent publications:');
      for (const a of timeline.slice(0, 10)) {
        const title = isAr ? (a.title_ar || a.title_en) : (a.title_en || a.title_ar);
        lines.push(`  - ${a.publication_date} — ${title}${a.doi ? ` (DOI: ${a.doi})` : ''}`);
      }
    }
    return lines.join('\n');
  };

  const copyReport = () => {
    navigator.clipboard.writeText(buildTextReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completenessScore = profile.completeness_score ?? 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-6 rounded-2xl shadow-sm print:shadow-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileBarChart size={20} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {isAr ? 'تقرير الانتشار الأكاديمي' : 'Academic Visibility Report'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">{displayName}</h2>
          <p className="text-xs text-[var(--ds-text-muted)] m-0">{new Date().toLocaleDateString(isAr ? 'ar' : 'en')}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={copyReport}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] px-3 py-2 rounded-xl cursor-pointer"
          >
            <Copy size={13} />
            <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ كنص' : 'Copy as text')}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-2 rounded-xl cursor-pointer"
          >
            <Printer size={13} />
            <span>{isAr ? 'طباعة / تصدير PDF' : 'Print / Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <span className="text-2xl font-black text-indigo-500 block">{completenessScore}%</span>
          <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase">{isAr ? 'اكتمال الملف' : 'Profile Completeness'}</span>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-2xl font-black text-indigo-500 block">{linkedChannels.length}/{CHANNEL_TYPES.length}</span>
          <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase">{isAr ? 'قنوات مرتبطة' : 'Linked Channels'}</span>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-2xl font-black text-indigo-500 block">{assets.length}</span>
          <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase">{isAr ? 'أصول علمية' : 'Scholarly Assets'}</span>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-2xl font-black text-indigo-500 block">{withDoi}</span>
          <span className="text-[10px] text-[var(--ds-text-muted)] font-bold uppercase">{isAr ? 'تحمل DOI' : 'With DOI'}</span>
        </Card>
      </div>

      {/* Note about citation data */}
      <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-600 dark:text-amber-400">
        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
        <span>
          {isAr
            ? 'أعداد الاستشهادات الفعلية غير متوفرة بعد في هذا التقرير — تحتاج ربطًا بمصدر خارجي (مثل Crossref) أو إدخالًا يدويًا. البيانات أعلاه من ملفك وسجلّاتك المضافة فقط.'
            : 'Real citation counts aren’t available in this report yet — that needs an external source (e.g. Crossref) or manual entry. The figures above come only from your profile and registered assets.'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Channels breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <Globe className="text-indigo-500" size={16} />
              <span>{isAr ? 'حالة قنوات الهوية' : 'Identity Channel Status'}</span>
            </h3>
            <div className="space-y-1.5">
              {CHANNEL_TYPES.map(type => {
                const linked = linkedChannels.includes(type);
                return (
                  <div key={type} className="flex items-center justify-between text-xs py-1">
                    <span className="font-bold text-[var(--ds-text-secondary)]">{type.replace('_', ' ')}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      linked
                        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                    }`}>
                      {linked ? (isAr ? 'مرتبط' : 'Linked') : (isAr ? 'مفقود' : 'Missing')}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => navigate(ROUTES.VISIBILITY)}
              className="text-[10px] font-black text-indigo-500 hover:underline cursor-pointer print:hidden"
            >
              {isAr ? 'إدارة القنوات في لوحة الانتشار ←' : '← Manage channels in the dashboard'}
            </button>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0">
              {isAr ? 'الأصول حسب النوع' : 'Assets by Type'}
            </h3>
            {Object.keys(byType).length === 0 ? (
              <p className="text-xs text-[var(--ds-text-muted)] m-0">{isAr ? 'لا توجد أصول علمية مسجّلة بعد.' : 'No scholarly assets registered yet.'}</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs py-1">
                    <span className="font-bold text-[var(--ds-text-secondary)]">
                      {ASSET_TYPE_LABELS[type] ? (isAr ? ASSET_TYPE_LABELS[type].ar : ASSET_TYPE_LABELS[type].en) : type}
                    </span>
                    <span className="font-black text-[var(--ds-text-primary)]">{count}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => navigate(ROUTES.ASSETS)}
              className="text-[10px] font-black text-indigo-500 hover:underline cursor-pointer print:hidden"
            >
              {isAr ? 'إدارة الأصول العلمية ←' : '← Manage scholarly assets'}
            </button>
          </Card>
        </div>

        {/* Publication timeline */}
        <div className="lg:col-span-7">
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <Calendar className="text-indigo-500" size={16} />
              <span>{isAr ? 'الجدول الزمني للمنشورات' : 'Publication Timeline'}</span>
            </h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-[var(--ds-text-muted)] m-0 py-4 text-center">
                {isAr ? 'لا توجد أصول علمية بتاريخ نشر مسجّل بعد.' : 'No scholarly assets with a recorded publication date yet.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {timeline.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 p-2.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--ds-text-primary)] m-0 truncate">
                        {isAr ? (a.title_ar || a.title_en) : (a.title_en || a.title_ar)}
                      </p>
                      <p className="text-[10px] text-[var(--ds-text-muted)] m-0 mt-0.5">
                        {a.publication_date} · {ASSET_TYPE_LABELS[a.asset_type] ? (isAr ? ASSET_TYPE_LABELS[a.asset_type].ar : ASSET_TYPE_LABELS[a.asset_type].en) : a.asset_type}
                        {a.journal_name ? ` · ${a.journal_name}` : ''}
                      </p>
                    </div>
                    {a.doi && (
                      <a
                        href={`https://doi.org/${a.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-sky-500 hover:text-sky-600"
                        title="DOI"
                      >
                        <LinkIcon size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
