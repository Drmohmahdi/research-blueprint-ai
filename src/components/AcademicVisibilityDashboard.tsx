import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { apiGetMyProfile, apiUpsertProfile, apiGetDownloadUrl } from '../utils/api';
import { ROUTES } from '../router/routes';
import { ACADEMIC_CHANNELS } from '../config/academicChannels';
import { Card } from '../design-system/components/Card';
import { EmptyState } from '../design-system/components/Feedback';
import { PathPanel } from '../design-system/components/Navigation';
import {
  Sparkles,
  ExternalLink,
  Copy,
  Globe,
  ShieldAlert,
  User,
  Activity,
  CheckSquare,
  Plus,
  Loader2,
  Check,
  X,
  School,
  Award,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const emptyProfileLists = {
  name_variants_json: [] as string[],
  research_interests_json: [] as string[],
  keywords_ar_json: [] as string[],
  keywords_en_json: [] as string[],
  identifiers: [] as any[],
  affiliations: [] as any[],
};

const normalizeProfile = (data: any) => ({
  ...data,
  name_variants_json: data.name_variants_json || [],
  research_interests_json: data.research_interests_json || [],
  keywords_ar_json: data.keywords_ar_json || [],
  keywords_en_json: data.keywords_en_json || [],
  identifiers: data.identifiers || [],
  affiliations: data.affiliations || [],
});

export const AcademicVisibilityDashboard: React.FC = () => {
  const { language, user } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const isAr = language === 'ar';

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState({ ar: '', en: '', variants: '' });

  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [channelDraft, setChannelDraft] = useState({ value: '', url: '' });

  const [addingCustomChannel, setAddingCustomChannel] = useState(false);
  const [customChannelDraft, setCustomChannelDraft] = useState({ type: '', value: '', url: '' });

  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const showMsg = (text: string, kind: 'success' | 'error') => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 4000);
  };

  useEffect(() => {
    (async () => {
      const data = await apiGetMyProfile();
      if (data) {
        const normalized = normalizeProfile(data);
        setProfile(normalized);
        setNameDraft({
          ar: normalized.preferred_name_ar || '',
          en: normalized.preferred_name_en || '',
          variants: (normalized.name_variants_json || []).join('؛ '),
        });
      } else {
        setLoadError(true);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    const target = location.pathname.includes('/audit')
      ? 'visibility-audit'
      : location.pathname.includes('/plan')
        ? 'visibility-plan'
        : null;
    if (!target) return;
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.pathname]);

  const persist = async (updated: any) => {
    setSaving(true);
    const saved = await apiUpsertProfile(updated);
    if (saved) {
      setProfile(normalizeProfile(saved));
    } else {
      showMsg(isAr ? 'فشل الحفظ. تحقق من الاتصال بالخادم.' : 'Save failed. Check your connection.', 'error');
    }
    setSaving(false);
    return saved;
  };

  const saveName = async () => {
    if (!profile) return;
    const variantsArr = nameDraft.variants
      .split(/[؛;]/)
      .map(v => v.trim())
      .filter(Boolean);
    const saved = await persist({
      ...profile,
      preferred_name_ar: nameDraft.ar,
      preferred_name_en: nameDraft.en,
      name_variants_json: variantsArr,
    });
    if (saved) {
      setEditingName(false);
      showMsg(isAr ? 'تم حفظ الاسم بنجاح' : 'Name saved successfully', 'success');
    }
  };

  const startEditChannel = (type: string, currentValue = '', currentUrl = '') => {
    setEditingChannel(type);
    setChannelDraft({ value: currentValue, url: currentUrl });
  };

  const saveChannel = async (type: string) => {
    if (!profile || !channelDraft.value.trim()) return;
    const rest = profile.identifiers.filter((i: any) => i.identifier_type !== type);
    const updatedIdentifiers = [
      ...rest,
      { identifier_type: type, identifier_value: channelDraft.value.trim(), profile_url: channelDraft.url.trim() || null, status: 'UNVERIFIED' },
    ];
    const saved = await persist({ ...profile, identifiers: updatedIdentifiers });
    if (saved) {
      setEditingChannel(null);
      setChannelDraft({ value: '', url: '' });
      showMsg(isAr ? 'تم حفظ القناة بنجاح' : 'Channel saved successfully', 'success');
    }
  };

  const saveCustomChannel = async () => {
    if (!profile || !customChannelDraft.type.trim() || !customChannelDraft.value.trim()) return;
    const updatedIdentifiers = [
      ...profile.identifiers,
      { identifier_type: customChannelDraft.type.trim(), identifier_value: customChannelDraft.value.trim(), profile_url: customChannelDraft.url.trim() || null, status: 'UNVERIFIED' },
    ];
    const saved = await persist({ ...profile, identifiers: updatedIdentifiers });
    if (saved) {
      setAddingCustomChannel(false);
      setCustomChannelDraft({ type: '', value: '', url: '' });
      showMsg(isAr ? 'تم إضافة القناة بنجاح' : 'Channel added successfully', 'success');
    }
  };

  const removeCustomChannel = async (identifierType: string) => {
    if (!profile) return;
    const updatedIdentifiers = profile.identifiers.filter((i: any) => i.identifier_type !== identifierType);
    const saved = await persist({ ...profile, identifiers: updatedIdentifiers });
    if (saved) showMsg(isAr ? 'تم حذف القناة' : 'Channel removed', 'success');
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[var(--ds-text-muted)]">
        <Loader2 size={18} className="motion-safe:animate-spin" />
        <span className="text-sm font-bold">{isAr ? 'جارِ تحميل ملفك الأكاديمي...' : 'Loading your academic profile...'}</span>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <EmptyState
        illustration={<ShieldAlert size={32} />}
        title={isAr ? 'تعذّر تحميل الملف الأكاديمي' : 'Could not load academic profile'}
        description={isAr ? 'تأكد من تسجيل الدخول وحاول مجددًا.' : 'Make sure you are signed in and try again.'}
      />
    );
  }

  const displayNameAr = profile.preferred_name_ar || (isAr ? 'اسمك الأكاديمي (عربي)' : '');
  const displayNameEn = profile.preferred_name_en || (isAr ? '' : 'Your academic name (English)');
  const headerName = isAr ? (displayNameAr || displayNameEn || 'باحث بصيرة') : (displayNameEn || displayNameAr || 'Baseerah Researcher');

  const channels = ACADEMIC_CHANNELS.map(def => {
    const found = profile.identifiers.find((i: any) => i.identifier_type === def.type);
    return {
      ...def,
      linked: !!(found && found.identifier_value),
      value: found?.identifier_value || '',
      url: found?.profile_url || '',
    };
  });

  const knownTypes = ACADEMIC_CHANNELS.map(c => c.type);
  const customChannels = profile.identifiers.filter((i: any) => !knownTypes.includes(i.identifier_type) && i.identifier_value);

  const visibilityScore = profile.completeness_score ?? 0;

  const affiliations: any[] = profile.affiliations || [];
  const hasInstitutionInfo = !!(profile.university || profile.college || profile.department || profile.academic_title || profile.current_rank);

  const keywordsAr = (profile.keywords_ar_json || (emptyProfileLists.keywords_ar_json)).join('، ');
  const keywordsEn = (profile.keywords_en_json || (emptyProfileLists.keywords_en_json)).join(', ');
  const hasShortBio = !!(profile.short_bio_ar || profile.short_bio_en);
  const hasFullBio = !!(profile.full_bio_ar || profile.full_bio_en);
  const hasKeywords = !!(keywordsAr || keywordsEn);

  type Task = { key: string; done: boolean; impact: 'High' | 'Medium' | 'Low'; textAr: string; textEn: string; action: () => void };

  const tasks: Task[] = [
    ...channels.filter(c => c.priority === 'critical').map(c => ({
      key: `channel-${c.type}`,
      done: c.linked,
      impact: 'High' as const,
      textAr: `اربط حساب ${c.label} بملفك الأكاديمي.`,
      textEn: `Link your ${c.label} account to your academic profile.`,
      action: () => startEditChannel(c.type, c.value, c.url),
    })),
    {
      key: 'short-bio',
      done: hasShortBio,
      impact: 'Medium',
      textAr: 'اكتب نبذة مختصرة عن نفسك (لـ ORCID / Twitter).',
      textEn: 'Write a short biography (for ORCID / Twitter).',
      action: () => navigate(ROUTES.PROFILE),
    },
    {
      key: 'full-bio',
      done: hasFullBio,
      impact: 'Medium',
      textAr: 'اكتب سيرة أكاديمية كاملة (لـ ResearchGate / LinkedIn).',
      textEn: 'Write a full academic biography (for ResearchGate / LinkedIn).',
      action: () => navigate(ROUTES.PROFILE),
    },
    ...channels.filter(c => c.priority === 'important').map(c => ({
      key: `channel-${c.type}`,
      done: c.linked,
      impact: 'Low' as const,
      textAr: `اربط حساب ${c.label} بملفك الأكاديمي.`,
      textEn: `Link your ${c.label} account to your academic profile.`,
      action: () => startEditChannel(c.type, c.value, c.url),
    })),
    {
      key: 'affiliation',
      done: (profile.affiliations || []).length > 0,
      impact: 'Low',
      textAr: 'أضف انتماءً أكاديميًا واحدًا على الأقل.',
      textEn: 'Add at least one academic affiliation.',
      action: () => navigate(ROUTES.PROFILE_AFFILIATIONS),
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">

      {/* Save feedback toast */}
      {msg && (
        <div className={`fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none`}>
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold pointer-events-auto ${
            msg.kind === 'success'
              ? 'bg-action/15 border border-success/30 text-success'
              : 'bg-danger/15 border border-danger/30 text-danger'
          }`}>
            {msg.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span>{msg.text}</span>
          </div>
        </div>
      )}

      <PathPanel accent="var(--ds-path-identity)">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] flex items-center justify-center shrink-0">
            {profile.profile_photo_file_id ? (
              <img src={apiGetDownloadUrl(profile.profile_photo_file_id)} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-[var(--ds-text-muted)]" />
            )}
          </div>
          <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={20} className="text-path-identity" />
            <span className="text-[10px] font-black text-path-identity uppercase tracking-widest">
              {isAr ? 'الهوية الرقمية والانتشار الأكاديمي للباحثين' : 'Academic Identity & Visibility Suite'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">
            {headerName}
          </h2>
          <p className="text-sm text-[var(--ds-text-secondary)] max-w-2xl m-0 leading-relaxed">
            {isAr
              ? 'ابنِ حضورك الرقمي المتسق، ووحد صياغة اسمك العلمي، وراجع اتساق ملفاتك على Scopus و Google Scholar لتعظيم الاستشهادات.'
              : 'Build a consistent digital footprint, unify your academic name formats, and audit profiles on Scopus and Google Scholar to optimize citation tracking.'}
          </p>

          {user?.username && (
            profile.visibility_status === 'PUBLIC' ? (
              <button
                onClick={() => copyToClipboard(`${window.location.origin}/researcher/${user.username}`, 'public-link')}
                className="inline-flex items-center gap-1.5 text-[11px] font-black text-action hover:underline cursor-pointer"
              >
                <ExternalLink size={12} />
                <span>{copiedKey === 'public-link' ? (isAr ? 'تم نسخ الرابط!' : 'Link copied!') : (isAr ? 'نسخ رابط ملفك العام' : 'Copy your public profile link')}</span>
              </button>
            ) : (
              <button
                onClick={() => navigate(ROUTES.PROFILE)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-warning hover:underline cursor-pointer"
              >
                <ShieldAlert size={12} />
                <span>{isAr ? 'ملفك غير عام حاليًا — فعّل الظهور العام من الملف الكامل' : 'Your profile is private — enable public visibility in the full profile'}</span>
              </button>
            )
          )}
          </div>
        </div>

        {/* Real visibility score, from server-computed profile completeness */}
        <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[9px] text-[var(--ds-text-muted)] font-black block uppercase">{isAr ? 'مؤشر اكتمال الملف' : 'Profile Completeness'}</span>
            <span className="text-2xl font-black text-ink ds-numeric block">{visibilityScore}%</span>
          </div>
          <div className="h-10 w-[1px] bg-[var(--ds-border-subtle)]" />
          <Activity size={24} className="text-path-identity" />
        </div>
      </div>
      </PathPanel>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column: Name audit + Bio (7/12) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Identity audit */}
          <Card id="visibility-audit" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-2">
              <h3 className="text-xs font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
                <User className="text-path-identity" size={16} />
                <span>{isAr ? 'تدقيق الاتساق والاسم الأكاديمي' : 'Academic Name Consistency Audit'}</span>
              </h3>
              {!editingName && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-[10px] font-black text-action hover:underline cursor-pointer"
                >
                  {isAr ? 'تعديل' : 'Edit'}
                </button>
              )}
            </div>

            {editingName ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">{isAr ? 'الاسم المفضّل (عربي):' : 'Preferred Name (Arabic):'}</label>
                    <input
                      type="text"
                      value={nameDraft.ar}
                      onChange={e => setNameDraft(d => ({ ...d, ar: e.target.value }))}
                      className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                    />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">{isAr ? 'الاسم المفضل (إنجليزي):' : 'Preferred Name (English):'}</label>
                    <input
                      type="text"
                      value={nameDraft.en}
                      onChange={e => setNameDraft(d => ({ ...d, en: e.target.value }))}
                      className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                    />
                  </div>
                  <div className="flex flex-col space-y-1 sm:col-span-2">
                    <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                      {isAr ? 'الصيغ البديلة لاسمك في المجلات (افصل بفاصلة منقوطة):' : 'Name variants found in journals (semicolon-separated):'}
                    </label>
                    <input
                      type="text"
                      value={nameDraft.variants}
                      onChange={e => setNameDraft(d => ({ ...d, variants: e.target.value }))}
                      className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveName}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-[10px] font-black text-on-action bg-action hover:bg-action-hover disabled:opacity-60 px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    {saving ? <Loader2 size={12} className="motion-safe:animate-spin" /> : <Check size={12} />}
                    <span>{isAr ? 'حفظ' : 'Save'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft({
                        ar: profile.preferred_name_ar || '',
                        en: profile.preferred_name_en || '',
                        variants: (profile.name_variants_json || []).join('؛ '),
                      });
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tertiary)] px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    <X size={12} />
                    <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase block mb-1">{isAr ? 'الاسم المفضّل (عربي)' : 'Preferred Name (Arabic)'}</span>
                  <p className="text-xs font-bold text-[var(--ds-text-primary)] m-0">{profile.preferred_name_ar || '—'}</p>
                </div>
                <div>
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase block mb-1">{isAr ? 'الاسم المفضل (إنجليزي)' : 'Preferred Name (English)'}</span>
                  <p className="text-xs font-bold text-[var(--ds-text-primary)] m-0">{profile.preferred_name_en || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">{isAr ? 'الصيغ البديلة المكتشفة' : 'Identified Name Variants'}</span>
                    {profile.name_variants_json.length > 0 && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-xl shrink-0">
                        <ShieldAlert size={11} className="shrink-0" />
                        <span>{isAr ? 'خطر تشتت الاستشهاد' : 'Citation Split Risk'}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[var(--ds-text-primary)] m-0">
                    {profile.name_variants_json.length > 0 ? profile.name_variants_json.join('، ') : (isAr ? 'لا توجد صيغ مسجّلة بعد.' : 'No variants recorded yet.')}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Institution & affiliations, read-only summary from the unified profile */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-2">
              <h3 className="text-xs font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
                <School className="text-path-identity" size={16} />
                <span>{isAr ? 'المؤسسة والانتماء الأكاديمي' : 'Institution & Affiliation'}</span>
              </h3>
              <button
                onClick={() => navigate(ROUTES.PROFILE_AFFILIATIONS)}
                className="text-[10px] font-black text-action hover:underline cursor-pointer"
              >
                {isAr ? 'إدارة الانتماءات' : 'Manage affiliations'}
              </button>
            </div>

            {!hasInstitutionInfo && affiliations.length === 0 ? (
              <EmptyState
                bare
                className="py-4"
                title={isAr ? 'لا توجد بيانات مؤسسية' : 'No institutional details'}
                description={isAr ? 'أضفها من الملف الكامل ليظهر انتماؤك بوضوح لزوار ملفك.' : 'Add them in the full profile so your affiliation is clear to visitors.'}
              />
            ) : (
              <div className="space-y-3">
                {hasInstitutionInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(profile.academic_title || profile.current_rank) && (
                      <div className="flex items-center gap-2">
                        <Award size={13} className="text-path-identity shrink-0" />
                        <span className="text-xs font-bold text-[var(--ds-text-primary)]">
                          {[profile.academic_title, profile.current_rank].filter(Boolean).join(' — ') || '—'}
                        </span>
                      </div>
                    )}
                    {(profile.university || profile.college || profile.department) && (
                      <div className="flex items-center gap-2">
                        <School size={13} className="text-path-identity shrink-0" />
                        <span className="text-xs font-bold text-[var(--ds-text-primary)]">
                          {[profile.university, profile.college, profile.department].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {affiliations.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {affiliations.slice(0, 3).map((aff: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg">
                        <span className="font-bold text-[var(--ds-text-secondary)]">
                          {aff.organization_name}{aff.position_title ? ` — ${aff.position_title}` : ''}
                        </span>
                        {aff.is_current && (
                          <span className="text-[8px] font-bold text-success bg-[var(--ds-success-soft)] border border-success/20 px-1.5 py-0.5 rounded shrink-0">
                            {isAr ? 'حالي' : 'Current'}
                          </span>
                        )}
                      </div>
                    ))}
                    {affiliations.length > 3 && (
                      <p className="text-[10px] text-[var(--ds-text-muted)] m-0">
                        {isAr ? `و${affiliations.length - 3} انتماءات أخرى...` : `+${affiliations.length - 3} more...`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Real bio & keywords, sourced from the unified profile */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-2">
              <h3 className="text-xs font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
                <Sparkles className="text-path-identity" size={16} />
                <span>{isAr ? 'السيرة والكلمات المفتاحية للنشر' : 'Publishing Bio & Keywords'}</span>
              </h3>
              <button
                onClick={() => navigate(ROUTES.PROFILE)}
                className="text-[10px] font-black text-action hover:underline cursor-pointer"
              >
                {isAr ? 'تعديل في الملف الكامل' : 'Edit in full profile'}
              </button>
            </div>

            {!hasShortBio && !hasFullBio && !hasKeywords ? (
              <EmptyState
                bare
                className="py-4"
                title={isAr ? 'لا توجد سيرة بعد' : 'No bio yet'}
                description={isAr ? 'أضف سيرة وكلمات مفتاحية من صفحة الملف الأكاديمي لتظهر هنا جاهزة للنسخ.' : 'Add a bio and keywords from your academic profile to copy them here.'}
              />
            ) : (
              <div className="space-y-4">
                {hasShortBio && (
                  <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                        {isAr ? 'النبذة المختصرة (لـ ORCID / Twitter):' : 'Short Biography (for ORCID / Twitter):'}
                      </span>
                      <button
                        onClick={() => copyToClipboard(isAr ? (profile.short_bio_ar || profile.short_bio_en) : (profile.short_bio_en || profile.short_bio_ar), 'short')}
                        className="p-1 rounded hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                      >
                        <Copy size={11} />
                        <span>{copiedKey === 'short' ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}</span>
                      </button>
                    </div>
                    <p className="text-xs font-bold text-[var(--ds-text-secondary)] m-0 leading-relaxed">{isAr ? (profile.short_bio_ar || profile.short_bio_en) : (profile.short_bio_en || profile.short_bio_ar)}</p>
                  </div>
                )}

                {hasFullBio && (
                  <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                        {isAr ? 'السيرة الكاملة (لـ ResearchGate / LinkedIn):' : 'Full Biography (for ResearchGate / LinkedIn):'}
                      </span>
                      <button
                        onClick={() => copyToClipboard(isAr ? (profile.full_bio_ar || profile.full_bio_en) : (profile.full_bio_en || profile.full_bio_ar), 'full')}
                        className="p-1 rounded hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                      >
                        <Copy size={11} />
                        <span>{copiedKey === 'full' ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}</span>
                      </button>
                    </div>
                    <p className="text-xs font-bold text-[var(--ds-text-secondary)] m-0 leading-relaxed">{isAr ? (profile.full_bio_ar || profile.full_bio_en) : (profile.full_bio_en || profile.full_bio_ar)}</p>
                  </div>
                )}

                {hasKeywords && (
                  <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                        {isAr ? 'الكلمات المفتاحية:' : 'Keywords & Tags:'}
                      </span>
                      <button
                        onClick={() => copyToClipboard(isAr ? (keywordsAr || keywordsEn) : (keywordsEn || keywordsAr), 'kw')}
                        className="p-1 rounded hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                      >
                        <Copy size={11} />
                        <span>{copiedKey === 'kw' ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}</span>
                      </button>
                    </div>
                    <p className="text-xs font-bold text-[var(--ds-text-secondary)] m-0 leading-relaxed font-mono">{isAr ? (keywordsAr || keywordsEn) : (keywordsEn || keywordsAr)}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Channels + Reputation Plan (5/12) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Channel list, backed by real AcademicIdentifier rows */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <Globe className="text-path-identity" size={16} />
              <span>{isAr ? 'قنوات وملفات الهوية العلمية' : 'Academic Identity Channels'}</span>
            </h3>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {channels.map((chan) => (
                <div
                  key={chan.type}
                  className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[var(--ds-text-primary)]">{chan.label}</span>
                      {chan.linked ? (
                        <span className="text-[8px] font-bold text-success bg-[var(--ds-success-soft)] border border-success/20 px-1.5 py-0.5 rounded">
                          {isAr ? 'مرتبط' : 'Linked'}
                        </span>
                      ) : (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                          chan.priority === 'critical'
                            ? 'text-danger bg-danger/10 border-danger/20'
                            : 'text-[var(--ds-text-muted)] bg-[var(--ds-surface-tertiary)] border-[var(--ds-border-subtle)]'
                        }`}>
                          {isAr ? 'مفقود' : 'Missing'}
                        </span>
                      )}
                    </div>
                    {chan.linked ? (
                      <div className="flex items-center gap-2">
                        {chan.url && (
                          <a
                            href={chan.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] font-black text-action hover:underline flex items-center gap-0.5"
                          >
                            <span>{isAr ? 'زيارة' : 'Visit'}</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                        <button
                          onClick={() => startEditChannel(chan.type, chan.value, chan.url)}
                          className="text-[9px] font-black text-[var(--ds-text-muted)] hover:text-action cursor-pointer"
                        >
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditChannel(chan.type)}
                        className="text-[9px] font-black text-action hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>{isAr ? 'إضافة' : 'Add'}</span>
                      </button>
                    )}
                  </div>

                  {editingChannel === chan.type ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        placeholder={isAr ? 'المعرّف أو اسم المستخدم' : 'Identifier or username'}
                        value={channelDraft.value}
                        onChange={e => setChannelDraft(d => ({ ...d, value: e.target.value }))}
                        className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                      />
                      <input
                        type="text"
                        placeholder={isAr ? 'رابط الملف الشخصي (اختياري)' : 'Profile URL (optional)'}
                        value={channelDraft.url}
                        onChange={e => setChannelDraft(d => ({ ...d, url: e.target.value }))}
                        className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveChannel(chan.type)}
                          disabled={saving || !channelDraft.value.trim()}
                          className="flex items-center gap-1 text-[9px] font-black text-on-action bg-action hover:bg-action-hover disabled:opacity-50 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          {saving ? <Loader2 size={11} className="motion-safe:animate-spin" /> : <Check size={11} />}
                          <span>{isAr ? 'حفظ' : 'Save'}</span>
                        </button>
                        <button
                          onClick={() => { setEditingChannel(null); setChannelDraft({ value: '', url: '' }); }}
                          className="flex items-center gap-1 text-[9px] font-black text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tertiary)] px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          <X size={11} />
                          <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[var(--ds-text-muted)] font-medium leading-relaxed m-0">
                      {isAr ? chan.descAr : chan.descEn}
                    </p>
                  )}
                </div>
              ))}

              {customChannels.map((chan: any) => (
                <div
                  key={chan.identifier_type}
                  className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[var(--ds-text-primary)]">{chan.identifier_type}</span>
                      <span className="text-[8px] font-bold text-success bg-[var(--ds-success-soft)] border border-success/20 px-1.5 py-0.5 rounded">
                        {isAr ? 'مرتبط' : 'Linked'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {chan.profile_url && (
                        <a href={chan.profile_url} target="_blank" rel="noreferrer" className="text-[9px] font-black text-action hover:underline flex items-center gap-0.5">
                          <span>{isAr ? 'زيارة' : 'Visit'}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                      <button
                        onClick={() => removeCustomChannel(chan.identifier_type)}
                        className="text-[var(--ds-text-muted)] hover:text-danger cursor-pointer"
                        title={isAr ? 'حذف' : 'Remove'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--ds-text-muted)] font-medium m-0">{chan.identifier_value}</p>
                </div>
              ))}
            </div>

            {addingCustomChannel ? (
              <div className="space-y-2 pt-1 border-t border-[var(--ds-border-subtle)]">
                <input
                  type="text"
                  placeholder={isAr ? 'اسم المنصة (مثال: Academia.edu)' : 'Platform name (e.g. Academia.edu)'}
                  value={customChannelDraft.type}
                  onChange={e => setCustomChannelDraft(d => ({ ...d, type: e.target.value }))}
                  className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
                <input
                  type="text"
                  placeholder={isAr ? 'المعرّف أو اسم المستخدم' : 'Identifier or username'}
                  value={customChannelDraft.value}
                  onChange={e => setCustomChannelDraft(d => ({ ...d, value: e.target.value }))}
                  className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
                <input
                  type="text"
                  placeholder={isAr ? 'رابط الملف الشخصي (اختياري)' : 'Profile URL (optional)'}
                  value={customChannelDraft.url}
                  onChange={e => setCustomChannelDraft(d => ({ ...d, url: e.target.value }))}
                  className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveCustomChannel}
                    disabled={saving || !customChannelDraft.type.trim() || !customChannelDraft.value.trim()}
                    className="flex items-center gap-1 text-[9px] font-black text-on-action bg-action hover:bg-action-hover disabled:opacity-50 px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    {saving ? <Loader2 size={11} className="motion-safe:animate-spin" /> : <Check size={11} />}
                    <span>{isAr ? 'حفظ' : 'Save'}</span>
                  </button>
                  <button
                    onClick={() => { setAddingCustomChannel(false); setCustomChannelDraft({ type: '', value: '', url: '' }); }}
                    className="flex items-center gap-1 text-[9px] font-black text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tertiary)] px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    <X size={11} />
                    <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCustomChannel(true)}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black text-action border border-dashed border-[var(--ds-primary)]/30 hover:bg-[var(--ds-primary-soft)] py-2 rounded-xl cursor-pointer"
              >
                <Plus size={12} />
                <span>{isAr ? 'إضافة قناة أخرى (مثل Academia.edu أو موقعك الشخصي)' : 'Add another channel (e.g. Academia.edu or personal site)'}</span>
              </button>
            )}
          </Card>

          {/* Reputation plan, computed live from real profile completeness */}
          <Card id="visibility-plan" className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center gap-2">
              <CheckSquare className="text-path-identity" size={16} />
              <span>{isAr ? 'خطة بناء السمعة الأكاديمية' : 'Academic Reputation Plan'}</span>
            </h3>

            <div className="space-y-3">
              {tasks.filter(t => !t.done).length === 0 ? (
                <p className="text-xs font-bold text-success m-0 text-center py-3">
                  {isAr ? 'ملفك مكتمل — لا مهام متبقية حاليًا.' : 'Your profile is complete — no tasks remaining.'}
                </p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.key}
                    onClick={() => !task.done && task.action()}
                    className={`p-3 border rounded-xl flex items-start gap-2.5 transition-all ${
                      task.done
                        ? 'bg-action/5 border-success/20 text-[var(--ds-text-muted)] line-through cursor-default'
                        : 'bg-[var(--ds-surface-secondary)] border-[var(--ds-border-subtle)] text-[var(--ds-text-secondary)] hover:border-[var(--ds-path-identity)]/40 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      readOnly
                      aria-label={`${isAr ? task.textAr : task.textEn} — ${task.done ? (isAr ? 'مكتملة' : 'Completed') : (isAr ? 'غير مكتملة' : 'Not completed')}`}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--ds-border-default)] text-[var(--ds-primary)] focus:ring-[var(--ds-primary)] cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-bold leading-normal m-0">
                        {isAr ? task.textAr : task.textEn}
                      </p>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border inline-block ${
                        task.impact === 'High'
                          ? 'bg-danger/10 text-danger border-danger/20'
                          : task.impact === 'Medium'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-muted/10 text-muted border-muted/20'
                      }`}>
                        {task.impact} Impact
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};
