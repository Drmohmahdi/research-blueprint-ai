import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { apiGetMyProfile, apiUpsertProfile } from '../utils/api';
import { 
  User, 
  School, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Globe, 
  Award,
  Sparkles
} from 'lucide-react';

export const UnifiedProfileEditor: React.FC = () => {
  const { language } = useProject();
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'identifiers' | 'affiliations'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load profile
  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGetMyProfile();
        if (data) {
          // Initialize empty lists if null
          setProfile({
            ...data,
            name_variants_json: data.name_variants_json || [],
            research_interests_json: data.research_interests_json || [],
            keywords_ar_json: data.keywords_ar_json || [],
            keywords_en_json: data.keywords_en_json || [],
            identifiers: data.identifiers || [],
            affiliations: data.affiliations || []
          });
        }
      } catch (e) {
        console.error("Failed to load profile", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await apiUpsertProfile(profile);
      if (saved) {
        setProfile({
          ...saved,
          name_variants_json: saved.name_variants_json || [],
          research_interests_json: saved.research_interests_json || [],
          keywords_ar_json: saved.keywords_ar_json || [],
          keywords_en_json: saved.keywords_en_json || [],
          identifiers: saved.identifiers || [],
          affiliations: saved.affiliations || []
        });
        showMsg(
          language === 'ar' ? 'تم حفظ الملف الأكاديمي الموحد بنجاح' : 'Unified academic profile saved successfully',
          'success'
        );
      } else {
        showMsg(language === 'ar' ? 'فشل الحفظ. تحقق من الاتصال بالخادم.' : 'Save failed. Check server connection.', 'error');
      }
    } catch  {
      showMsg(language === 'ar' ? 'خطأ غير متوقع أثناء الحفظ' : 'Unexpected error during save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Add new Identifier row
  const addIdentifier = () => {
    if (!profile) return;
    const newIdent = {
      identifier_type: 'ORCID',
      identifier_value: '',
      profile_url: '',
      status: 'UNVERIFIED',
      verification_method: 'MANUAL',
      metadata_json: {}
    };
    setProfile({
      ...profile,
      identifiers: [...profile.identifiers, newIdent]
    });
  };

  // Remove Identifier row
  const removeIdentifier = (index: number) => {
    if (!profile) return;
    const updated = [...profile.identifiers];
    updated.splice(index, 1);
    setProfile({
      ...profile,
      identifiers: updated
    });
  };

  const updateIdentifier = (index: number, field: string, val: string) => {
    if (!profile) return;
    const updated = [...profile.identifiers];
    updated[index] = { ...updated[index], [field]: val };
    setProfile({
      ...profile,
      identifiers: updated
    });
  };

  // Add Affiliation row
  const addAffiliation = () => {
    if (!profile) return;
    const newAff = {
      organization_name: '',
      college: '',
      department: '',
      position_title: '',
      academic_rank: '',
      start_date: '',
      end_date: '',
      is_current: false,
      country: '',
      verification_status: 'UNVERIFIED'
    };
    setProfile({
      ...profile,
      affiliations: [...profile.affiliations, newAff]
    });
  };

  // Remove Affiliation row
  const removeAffiliation = (index: number) => {
    if (!profile) return;
    const updated = [...profile.affiliations];
    updated.splice(index, 1);
    setProfile({
      ...profile,
      affiliations: updated
    });
  };

  const updateAffiliation = (index: number, field: string, val: any) => {
    if (!profile) return;
    const updated = [...profile.affiliations];
    updated[index] = { ...updated[index], [field]: val };
    setProfile({
      ...profile,
      affiliations: updated
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
        <p className="text-[var(--ds-text-secondary)] text-sm font-semibold">
          {language === 'ar' ? 'جاري تحميل الملف الأكاديمي الموحد...' : 'Loading Unified Academic Profile...'}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-red-500">
        {language === 'ar' ? 'فشل تحميل البيانات.' : 'Failed to load profile data.'}
      </div>
    );
  }

  // Completeness score color mapping
  const score = profile.completeness_score || 0;
  const scoreColor = score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-purple-500';
  const scoreBg = score >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-purple-500/10 border-purple-500/20';

  const t = {
    title: language === 'ar' ? 'الملف الأكاديمي الموحد' : 'Unified Academic Profile',
    desc: language === 'ar' ? 'إرساء الأساس الأكاديمي المشترك ومنع تكرار بيانات الباحثين عبر المنظومة' : 'Establish common academic foundation and prevent data duplication across modules',
    general: language === 'ar' ? 'المعلومات العامة' : 'General Info',
    identifiers: language === 'ar' ? 'معرفات وقنوات النشر' : 'Academic Identifiers',
    affiliations: language === 'ar' ? 'الانتماءات الوظيفية' : 'Affiliations',
    save: language === 'ar' ? 'حفظ التعديلات' : 'Save Changes',
    saving: language === 'ar' ? 'جاري الحفظ...' : 'Saving...',
    prefNameAr: language === 'ar' ? 'الاسم المفضل (بالعربية)' : 'Preferred Name (Arabic)',
    prefNameEn: language === 'ar' ? 'الاسم المفضل (بالإنجليزية)' : 'Preferred Name (English)',
    rank: language === 'ar' ? 'الدرجة العلمية الحالية' : 'Current Rank',
    targetRank: language === 'ar' ? 'الدرجة المستهدفة للترقية' : 'Target Rank',
    discipline: language === 'ar' ? 'التخصص العام (القديم)' : 'General Discipline (Legacy)',
    generalSpec: language === 'ar' ? 'التخصص العام المحدث' : 'General Specialization',
    specificSpec: language === 'ar' ? 'التخصص الدقيق' : 'Specific Specialization',
    instEmail: language === 'ar' ? 'البريد الإلكتروني المؤسسي' : 'Institutional Email',
    pubEmail: language === 'ar' ? 'البريد الإلكتروني العام' : 'Public Email',
    phone: language === 'ar' ? 'رقم الجوال' : 'Phone Number',
    shortBioAr: language === 'ar' ? 'السيرة الذاتية المختصرة (بالعربية)' : 'Short Bio (Arabic)',
    shortBioEn: language === 'ar' ? 'السيرة الذاتية المختصرة (بالإنجليزية)' : 'Short Bio (English)',
    fullBioAr: language === 'ar' ? 'السيرة الذاتية الكاملة (بالعربية)' : 'Full Bio (Arabic)',
    fullBioEn: language === 'ar' ? 'السيرة الذاتية الكاملة (بالإنجليزية)' : 'Full Bio (English)',
    visibility: language === 'ar' ? 'حالة الظهور للملف' : 'Visibility Status',
    completeness: language === 'ar' ? 'مؤشر اكتمال الملف' : 'Profile Completeness',
    addIdent: language === 'ar' ? 'إضافة قناة / معرف جديد' : 'Add New Identifier',
    addAff: language === 'ar' ? 'إضافة انتماء أكاديمي جديد' : 'Add New Affiliation',
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 dir-auto" style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-7 h-7 text-purple-500" />
            <span>{t.title}</span>
          </h1>
          <p className="text-xs text-[var(--ds-text-secondary)] mt-1">{t.desc}</p>
        </div>
        
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="w-full md:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
        >
          {saving ? t.saving : t.save}
        </button>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl border flex items-center gap-2 text-sm ${
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Grid Layout: Left sidebar (completeness index), Right workspace (form fields) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Profile Completeness card & Navigation */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Completeness Card */}
          <div className={`border p-6 rounded-2xl ${scoreBg} transition-all`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ds-text-secondary)] mb-4 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>{t.completeness}</span>
            </h3>
            
            <div className="flex items-center gap-6">
              {/* Circular score display */}
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[var(--ds-border-subtle)]"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={scoreColor}
                    strokeWidth="3.5"
                    strokeDasharray={`${score}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-black ${scoreColor}`}>{score}%</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {language === 'ar' ? 'نقاط القوة الأكاديمية للملف' : 'Academic profile strength points'}
                </span>
                <p className="text-xs text-[var(--ds-text-secondary)] mt-1.5 leading-relaxed">
                  {score >= 80 
                    ? (language === 'ar' ? 'ملفك الأكاديمي جاهز بنسبة ممتازة ويدعم النشر والترقيات بفعالية.' : 'Your academic profile is ready and supports promotions & publishing effectively.') 
                    : (language === 'ar' ? 'أكمل المعرفات المهنية مثل ORCID والانتماءات لزيادة نقاط اكتمال الملف.' : 'Complete professional identifiers like ORCID and affiliations to boost completion points.')
                  }
                </p>
              </div>
            </div>

            {/* Logical breakdown of score rules */}
            <div className="mt-5 pt-4 border-t border-[var(--ds-border-subtle)] space-y-2 text-[11px] text-[var(--ds-text-secondary)] font-medium">
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'الاسم والبيانات الأساسية' : 'Name and basic details'}</span>
                <span className="text-purple-400 font-bold">+20%</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'البريد الأكاديمي المعتمد' : 'Verified Academic Email'}</span>
                <span className="text-purple-400 font-bold">+10%</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'التخصص الدقيق والعام' : 'General & Specific Fields'}</span>
                <span className="text-purple-400 font-bold">+20%</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'السيرة الذاتية المختصرة والكاملة' : 'Short & Full Biography'}</span>
                <span className="text-purple-400 font-bold">+30%</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'المعرفات الأكاديمية (ORCID)' : 'Identifiers (ORCID, Scholar)'}</span>
                <span className="text-purple-400 font-bold">+10%</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'الانتماءات الوظيفية والشهادات' : 'Academic Affiliations'}</span>
                <span className="text-purple-400 font-bold">+10%</span>
              </div>
            </div>
          </div>

          {/* Navigation Tab Menu */}
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-2 flex flex-col gap-1 shadow-sm">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full px-4 py-3 rounded-xl text-xs font-bold text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>{t.general}</span>
            </button>

            <button
              onClick={() => setActiveTab('identifiers')}
              className={`w-full px-4 py-3 rounded-xl text-xs font-bold text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'identifiers'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>{t.identifiers}</span>
            </button>

            <button
              onClick={() => setActiveTab('affiliations')}
              className={`w-full px-4 py-3 rounded-xl text-xs font-bold text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'affiliations'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]'
              }`}
            >
              <School className="w-4 h-4 shrink-0" />
              <span>{t.affiliations}</span>
            </button>
          </div>
        </div>

        {/* Form area */}
        <div className="lg:col-span-8 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-6 rounded-2xl shadow-sm">
          
          <form onSubmit={handleSave} className="space-y-6">
            
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold border-b border-[var(--ds-border-subtle)] pb-2 text-purple-400">
                  {language === 'ar' ? 'البيانات الشخصية والمهنية العامة' : 'General Personal & Professional Data'}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.prefNameAr}</label>
                    <input
                      type="text"
                      value={profile.preferred_name_ar || ''}
                      onChange={(e) => setProfile({ ...profile, preferred_name_ar: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.prefNameEn}</label>
                    <input
                      type="text"
                      value={profile.preferred_name_en || ''}
                      onChange={(e) => setProfile({ ...profile, preferred_name_en: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.rank}</label>
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'أستاذ مشارك، أستاذ مساعد، إلخ' : 'Assistant Professor, Associate Professor'}
                      value={profile.current_rank || ''}
                      onChange={(e) => setProfile({ ...profile, current_rank: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.targetRank}</label>
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'أستاذ بروفيسور، أستاذ مشارك، إلخ' : 'Professor, Associate Professor'}
                      value={profile.target_rank || ''}
                      onChange={(e) => setProfile({ ...profile, target_rank: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.discipline}</label>
                    <input
                      type="text"
                      value={profile.discipline || ''}
                      onChange={(e) => setProfile({ ...profile, discipline: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.generalSpec}</label>
                    <input
                      type="text"
                      value={profile.general_specialization || ''}
                      onChange={(e) => setProfile({ ...profile, general_specialization: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.specificSpec}</label>
                    <input
                      type="text"
                      value={profile.specific_specialization || ''}
                      onChange={(e) => setProfile({ ...profile, specific_specialization: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.instEmail}</label>
                    <input
                      type="email"
                      value={profile.institutional_email || ''}
                      onChange={(e) => setProfile({ ...profile, institutional_email: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.pubEmail}</label>
                    <input
                      type="email"
                      value={profile.public_email || ''}
                      onChange={(e) => setProfile({ ...profile, public_email: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.phone}</label>
                    <input
                      type="text"
                      value={profile.phone || ''}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.shortBioAr}</label>
                    <textarea
                      rows={3}
                      value={profile.short_bio_ar || ''}
                      onChange={(e) => setProfile({ ...profile, short_bio_ar: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.shortBioEn}</label>
                    <textarea
                      rows={3}
                      value={profile.short_bio_en || ''}
                      onChange={(e) => setProfile({ ...profile, short_bio_en: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.visibility}</label>
                  <select
                    value={profile.visibility_status || 'PUBLIC'}
                    onChange={(e) => setProfile({ ...profile, visibility_status: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="PUBLIC">{language === 'ar' ? 'عام (متاح للجميع)' : 'Public (Visible to everyone)'}</option>
                    <option value="INSTITUTIONAL">{language === 'ar' ? 'مؤسسي (منسوبي الجامعة فقط)' : 'Institutional (My university only)'}</option>
                    <option value="PRIVATE">{language === 'ar' ? 'خاص (لي فقط)' : 'Private (Only me)'}</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'identifiers' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--ds-border-subtle)] pb-2">
                  <h2 className="text-sm font-bold text-purple-400">
                    {language === 'ar' ? 'المعرفات والقنوات الأكاديمية' : 'Academic Identifiers & Channels'}
                  </h2>
                  <button
                    type="button"
                    onClick={addIdentifier}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addIdent}</span>
                  </button>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex gap-2.5 text-xs text-amber-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="font-bold">{language === 'ar' ? 'ملاحظة حول موثوقية المعرفات' : 'Note on Identifier Authenticity'}</span>
                    <p className="mt-1 leading-relaxed text-[11px] text-amber-300/80">
                      {language === 'ar' 
                        ? 'تخضع كافة قنوات النشر المضافة لتدقيق يدوي ومراجعة موثوقية من قِبل اللجنة الأكاديمية، ولا يتم منح شارة التحقق التلقائي بدون مطابقة البصمة الأكاديمية.'
                        : 'All added academic identifiers are subject to manual verification and authority checks by the academic committee. Auto-verification is not granted without authority alignment.'
                      }
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {profile.identifiers.length === 0 ? (
                    <p className="text-xs text-[var(--ds-text-secondary)] text-center py-6">
                      {language === 'ar' ? 'لا توجد قنوات أو معرفات نفاذ مضافة بعد.' : 'No academic channels or identifiers added yet.'}
                    </p>
                  ) : (
                    profile.identifiers.map((ident: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <div className="w-full md:w-1/4">
                          <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                            {language === 'ar' ? 'نوع المنصة / المعرف' : 'Channel / Platform Type'}
                          </label>
                          <select
                            value={ident.identifier_type}
                            onChange={(e) => updateIdentifier(idx, 'identifier_type', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                          >
                            <option value="ORCID">ORCID</option>
                            <option value="GoogleScholar">Google Scholar</option>
                            <option value="ScopusID">Scopus ID</option>
                            <option value="ResearcherID">Researcher ID</option>
                            <option value="ResearchGate">ResearchGate</option>
                          </select>
                        </div>

                        <div className="w-full md:w-1/4">
                          <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                            {language === 'ar' ? 'قيمة المعرف الرقمي' : 'Identifier ID / Value'}
                          </label>
                          <input
                            type="text"
                            placeholder="0000-0002-1825-0097"
                            value={ident.identifier_value}
                            onChange={(e) => updateIdentifier(idx, 'identifier_value', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:outline-none"
                          />
                        </div>

                        <div className="w-full md:w-1/3">
                          <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                            {language === 'ar' ? 'رابط الملف الأكاديمي' : 'Profile Page URL'}
                          </label>
                          <input
                            type="url"
                            placeholder="https://orcid.org/..."
                            value={ident.profile_url}
                            onChange={(e) => updateIdentifier(idx, 'profile_url', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:outline-none"
                          />
                        </div>

                        <div className="flex gap-2 items-center self-end md:self-auto mt-2 md:mt-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-semibold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'حالة التحقق' : 'Status'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 ${
                              ident.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {ident.status === 'VERIFIED' 
                                ? (language === 'ar' ? 'مؤكد' : 'Verified') 
                                : (language === 'ar' ? 'تدقيق يدوي' : 'Manual Audit')
                              }
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeIdentifier(idx)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all mt-3 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'affiliations' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--ds-border-subtle)] pb-2">
                  <h2 className="text-sm font-bold text-purple-400">
                    {language === 'ar' ? 'تاريخ الانتماءات الأكاديمية والشهادات' : 'Academic Affiliations & Degrees'}
                  </h2>
                  <button
                    type="button"
                    onClick={addAffiliation}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addAff}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {profile.affiliations.length === 0 ? (
                    <p className="text-xs text-[var(--ds-text-secondary)] text-center py-6">
                      {language === 'ar' ? 'لم تقم بإضافة أي انتماءات أكاديمية بعد.' : 'No academic affiliations added yet.'}
                    </p>
                  ) : (
                    profile.affiliations.map((aff: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-purple-400">
                            {language === 'ar' ? `الانتماء الأكاديمي #${idx + 1}` : `Academic Affiliation #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAffiliation(idx)}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'الجامعة / المؤسسة' : 'University / Institution'}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder={language === 'ar' ? 'مثال: جامعة الملك سعود' : 'e.g. King Saud University'}
                              value={aff.organization_name}
                              onChange={(e) => updateAffiliation(idx, 'organization_name', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'الكلية' : 'College'}
                            </label>
                            <input
                              type="text"
                              placeholder={language === 'ar' ? 'مثال: كلية علوم الحاسب والمعلومات' : 'e.g. College of Computer Science'}
                              value={aff.college || ''}
                              onChange={(e) => updateAffiliation(idx, 'college', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'القسم الأكاديمي' : 'Department'}
                            </label>
                            <input
                              type="text"
                              placeholder={language === 'ar' ? 'قسم تقنية المعلومات' : 'e.g. IT Department'}
                              value={aff.department || ''}
                              onChange={(e) => updateAffiliation(idx, 'department', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'المسمى الوظيفي' : 'Position Title'}
                            </label>
                            <input
                              type="text"
                              placeholder={language === 'ar' ? 'أستاذ مشارك' : 'Associate Professor'}
                              value={aff.position_title || ''}
                              onChange={(e) => updateAffiliation(idx, 'position_title', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'الرتبة الأكاديمية' : 'Academic Rank'}
                            </label>
                            <input
                              type="text"
                              value={aff.academic_rank || ''}
                              onChange={(e) => updateAffiliation(idx, 'academic_rank', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'تاريخ البدء' : 'Start Date'}
                            </label>
                            <input
                              type="date"
                              value={aff.start_date || ''}
                              onChange={(e) => updateAffiliation(idx, 'start_date', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">
                              {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                            </label>
                            <input
                              type="date"
                              disabled={aff.is_current}
                              value={aff.is_current ? '' : (aff.end_date || '')}
                              onChange={(e) => updateAffiliation(idx, 'end_date', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs disabled:opacity-40"
                            />
                          </div>

                          <div className="flex items-center gap-2 mt-4 md:mt-6">
                            <input
                              type="checkbox"
                              id={`is-current-${idx}`}
                              checked={aff.is_current || false}
                              onChange={(e) => updateAffiliation(idx, 'is_current', e.target.checked)}
                              className="rounded border-[var(--ds-border-subtle)] text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor={`is-current-${idx}`} className="text-xs font-semibold text-[var(--ds-text-secondary)] cursor-pointer">
                              {language === 'ar' ? 'انتماء وظيفي حالي' : 'Current affiliation'}
                            </label>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--ds-text-secondary)]">
                              {language === 'ar' ? 'مستند الإثبات / المرفق:' : 'Evidence Attachment:'}
                            </span>
                            <span className="text-[10px] text-purple-400 font-medium">
                              {aff.evidence_file_id 
                                ? (language === 'ar' ? 'تم الرفع بنجاح' : 'Uploaded successfully') 
                                : (language === 'ar' ? 'لا يوجد ملف إثبات مرفق' : 'No evidence document attached')
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-semibold text-[var(--ds-text-secondary)]">{language === 'ar' ? 'التحقق من الانتماء' : 'Verification'}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                              aff.verification_status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {aff.verification_status === 'VERIFIED' 
                                ? (language === 'ar' ? 'تم التحقق' : 'Verified') 
                                : (language === 'ar' ? 'مستند معلق' : 'Manual verification')
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
          </form>

        </div>
      </div>
      
    </div>
  );
};
