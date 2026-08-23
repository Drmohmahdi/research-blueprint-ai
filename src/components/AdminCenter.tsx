import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { 
  Settings, Shield, Building2, CreditCard, Terminal,
  Activity, Database, Layers, ToggleLeft, ToggleRight,
  Sparkles, Server, Save, RefreshCw,
  FileText, Brain
} from 'lucide-react';
import { SuperAdminDashboard } from '../features/saas/SuperAdminDashboard';
import { BillingDashboard } from '../features/saas/BillingDashboard';
import { OrganizationSwitcher } from '../features/saas/OrganizationSwitcher';
import { SmokeTestDashboard } from './SmokeTestDashboard';
import { DEFAULT_FEATURE_FLAGS, applyFeatureFlagOverrides } from '../utils/featureFlags';
import { apiGetAdminSettings, apiUpdateAdminSettings, apiGetSystemStatus } from '../utils/api';
import type { SystemStatusResponse } from '../utils/api';

export const AdminCenter: React.FC = () => {
  const { language } = useProject();
  const [activeTab, setActiveTab] = useState<'config' | 'orgs' | 'billing' | 'audits' | 'diagnostics'>('config');

  // ── Real data from the API ──
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [, setSettings] = useState<Record<string, unknown>>({});
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Local editor state for platform settings
  const [platformTitleAr, setPlatformTitleAr] = useState('');
  const [platformTitleEn, setPlatformTitleEn] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash');
  const [announcementAr, setAnnouncementAr] = useState('');
  const [announcementEn, setAnnouncementEn] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statusData, settingsData] = await Promise.all([
        apiGetSystemStatus(),
        apiGetAdminSettings(),
      ]);
      if (statusData) setStatus(statusData);
      if (settingsData) {
        setSettings(settingsData.settings);
        setFeatureFlags(settingsData.feature_flags);
        applyFeatureFlagOverrides(settingsData.feature_flags);
        // Populate local editors
        const s = settingsData.settings;
        setPlatformTitleAr(String(s['platform.title_ar'] ?? ''));
        setPlatformTitleEn(String(s['platform.title_en'] ?? ''));
        setContactEmail(String(s['platform.contact_email'] ?? ''));
        setContactPhone(String(s['platform.contact_phone'] ?? ''));
        setAiModel(String(s['platform.ai_model'] ?? 'gemini-2.0-flash'));
        setAnnouncementAr(String(s['platform.announcement_ar'] ?? ''));
        setAnnouncementEn(String(s['platform.announcement_en'] ?? ''));
      }
    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    setSaveMessage('');
    const updates: Record<string, unknown> = {
      'platform.title_ar': platformTitleAr,
      'platform.title_en': platformTitleEn,
      'platform.contact_email': contactEmail,
      'platform.contact_phone': contactPhone,
      'platform.ai_model': aiModel,
      'platform.announcement_ar': announcementAr,
      'platform.announcement_en': announcementEn,
    };
    const result = await apiUpdateAdminSettings(updates);
    if (result) {
      setSettings(result.settings);
      setSaveMessage(language === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
    } else {
      setSaveMessage(language === 'ar' ? 'فشل حفظ الإعدادات' : 'Failed to save settings');
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const toggleFlag = async (flagName: string) => {
    const newVal = !featureFlags[flagName];
    const key = `feature_flag.${flagName}`;
    const result = await apiUpdateAdminSettings({ [key]: newVal });
    if (result) {
      setFeatureFlags(result.feature_flags);
      setSettings(result.settings);
      applyFeatureFlagOverrides(result.feature_flags);
    }
  };

  const tabConfig = [
    { id: 'config' as const, labelAr: 'إعدادات المنصة', labelEn: 'General Settings', icon: Settings },
    { id: 'orgs' as const, labelAr: 'المستأجرين والأعضاء', labelEn: 'Organizations & Users', icon: Building2 },
    { id: 'billing' as const, labelAr: 'الباقات والفوترة', labelEn: 'Plans & Billing', icon: CreditCard },
    { id: 'audits' as const, labelAr: 'سجل الأمان والرقابة', labelEn: 'Security Audit logs', icon: Shield },
    { id: 'diagnostics' as const, labelAr: 'الفحوصات والأعطال', labelEn: 'Smoke Diagnostics', icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 m-0">
            {language === 'ar' ? 'مركز التحكم وإدارة إعدادات المنصة' : 'Platform Administration & Settings Center'}
          </h2>
          <p className="text-xs text-[var(--ds-text-muted)] m-0 mt-1 font-bold">
            {language === 'ar' 
              ? 'التحكم الإداري الموحد في تهيئة النظام، سجلات الأمان، الفوترة وتراخيص المستأجرين وفحوصات الدخان.' 
              : 'Unified administrative controls over system configuration, security audit trail, client quotas, and system health.'}
          </p>
        </div>
      </div>

      {/* Real metrics ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${status?.database === 'ready' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
            <Database size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'قاعدة البيانات' : 'Database'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-[var(--ds-text-primary)]">{status?.counts?.organizations ?? '—'} {language === 'ar' ? 'جهة' : 'orgs'}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${status?.database === 'ready' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {status?.database === 'ready' ? (language === 'ar' ? 'نشط' : 'HEALTHY') : (language === 'ar' ? 'غير متصل' : 'DOWN')}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'المنصة' : 'Platform'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-[var(--ds-text-primary)]">v{status?.version ?? '—'}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">{status?.database === 'ready' ? (language === 'ar' ? 'متصل' : 'ONLINE') : (language === 'ar' ? 'غير متصل' : 'OFFLINE')}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <Brain size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'الذكاء الاصطناعي' : 'AI Provider'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black text-[var(--ds-text-primary)] truncate max-w-[120px]">{status?.ai_provider?.includes('LIVE') ? (language === 'ar' ? 'موفر مباشر' : 'Live') : (language === 'ar' ? 'محاكي' : 'Fake')}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${status?.ai_provider?.includes('LIVE') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {status?.ai_provider?.includes('LIVE') ? 'لive' : 'fake'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'الملفات والنداءات' : 'Files & AI'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-[var(--ds-text-primary)]">{status?.counts?.uploaded_files ?? 0} {language === 'ar' ? 'ملف' : 'files'}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">{status?.counts?.ai_runs ?? 0} {language === 'ar' ? 'تشغيل' : 'runs'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--ds-border-subtle)] gap-2 overflow-x-auto pb-px no-scrollbar">
        {tabConfig.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-black transition-all flex items-center gap-2 border-b-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5'
                  : 'border-transparent text-[var(--ds-text-secondary)] hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <TabIcon size={14} />
              <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {/* Tab 1: Real platform settings */}
        {activeTab === 'config' && (
          loading ? (
            <div className="p-12 text-center text-xs font-bold text-[var(--ds-text-muted)] animate-pulse">
              {language === 'ar' ? 'جاري تحميل إعدادات المنصة...' : 'Loading platform settings...'}
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-3xl space-y-4">
                <h3 className="text-sm font-black text-white m-0 flex items-center gap-2 border-b border-[var(--ds-border-subtle)] pb-3">
                  <Settings size={16} className="text-purple-500" />
                  <span>{language === 'ar' ? 'إعدادات المنصة الأساسية' : 'Primary Platform Configurations'}</span>
                </h3>

                {saveMessage && (
                  <div className={`px-3 py-2 rounded-xl text-xs font-bold ${saveMessage.includes('نجاح') || saveMessage.includes('success') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {saveMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-zinc-300">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'اسم المنصة بالعربية' : 'Arabic Platform Title'}</label>
                    <input type="text" value={platformTitleAr} onChange={e => setPlatformTitleAr(e.target.value)}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'اسم المنصة بالإنجليزية' : 'English Platform Title'}</label>
                    <input type="text" value={platformTitleEn} onChange={e => setPlatformTitleEn(e.target.value)}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'البريد الإلكتروني للتواصل' : 'Contact Email'}</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} dir="ltr"
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'رقم الجوال للتواصل' : 'Contact Phone'}</label>
                    <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} dir="ltr"
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'نموذج الذكاء الاصطناعي الافتراضي' : 'Default AI Model'}</label>
                    <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white">
                      <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'إعلان المنصة (عربي)' : 'Platform Announcement (Arabic)'}</label>
                  <textarea value={announcementAr} onChange={e => setAnnouncementAr(e.target.value)} rows={2}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'إعلان المنصة (إنجليزي)' : 'Platform Announcement (English)'}</label>
                  <textarea value={announcementEn} onChange={e => setAnnouncementEn(e.target.value)} rows={2}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white text-xs" />
                </div>

                <div className="flex justify-end pt-2 border-t border-[var(--ds-border-subtle)]">
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{saving ? (language === 'ar' ? 'حفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التغييرات' : 'Save Settings')}</span>
                  </button>
                </div>
              </Card>

              {/* Feature Flags card */}
              <Card className="p-6 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-3xl space-y-4">
                <div>
                  <h3 className="text-sm font-black text-white m-0 flex items-center gap-2">
                    <Layers size={16} className="text-purple-500" />
                    <span>{language === 'ar' ? 'مفاتيح الميزات (Feature Flags)' : 'Platform Feature Flags'}</span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold leading-normal mt-1 m-0">
                    {language === 'ar' ? 'تمكين أو تعطيل أجزاء من النظام بشكل فوري. التغييرات محفوظة على الخادم وتنعكس فورًا على جميع المستخدمين.' : 'Instantly toggle frontend routes and experimental features. Changes are persisted server-side and affect all users.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {Object.entries(DEFAULT_FEATURE_FLAGS).map(([key, defaultValue]) => {
                    const currentValue = key in featureFlags ? featureFlags[key] : defaultValue;
                    return (
                      <div key={key} className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]/50 flex justify-between items-center gap-4 hover:border-zinc-800 transition-all">
                        <div>
                          <div className="text-[11px] font-black text-white">{key}</div>
                          <div className="text-[9px] text-zinc-500 font-bold leading-none mt-1">
                            {language === 'ar' ? (currentValue ? 'مفعل' : 'معطل') : (currentValue ? 'Enabled' : 'Disabled')}
                          </div>
                        </div>
                        <button type="button" onClick={() => toggleFlag(key)}
                          className="text-[var(--ds-text-secondary)] hover:text-purple-500 transition-colors bg-transparent border-none cursor-pointer">
                          {currentValue ? <ToggleRight size={28} className="text-purple-600" /> : <ToggleLeft size={28} className="text-zinc-600" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Right side: System status */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 border-[var(--ds-border-subtle)] bg-zinc-950 rounded-3xl space-y-4 text-xs font-semibold text-zinc-400 leading-relaxed">
                <h4 className="text-xs font-black text-white m-0 uppercase tracking-wider flex items-center gap-1.5">
                  <Server size={14} className="text-purple-500" />
                  <span>{language === 'ar' ? 'حالة النظام' : 'System Status'}</span>
                </h4>
                <div className="space-y-2.5">
                  {[
                    { labelAr: 'إصدار المنصة', labelEn: 'App Version', value: `v${status?.version ?? '—'}`, color: 'text-purple-400' },
                    { labelAr: 'قاعدة البيانات', labelEn: 'Database', value: status?.database === 'ready' ? (language === 'ar' ? 'نشط' : 'Healthy') : (language === 'ar' ? 'غير متاح' : 'Unavailable'), color: status?.database === 'ready' ? 'text-emerald-500' : 'text-rose-500' },
                    { labelAr: 'التخزين', labelEn: 'Storage', value: status?.storage === 'ready' ? (language === 'ar' ? 'متاح' : 'Ready') : (language === 'ar' ? 'غير متاح' : 'Not Ready'), color: 'text-emerald-500' },
                    { labelAr: 'مزود الذكاء الاصطناعي', labelEn: 'AI Provider', value: status?.ai_provider?.includes('LIVE') ? (language === 'ar' ? 'موفر مباشر' : 'Live') : (language === 'ar' ? 'محاكي' : 'Fake'), color: status?.ai_provider?.includes('LIVE') ? 'text-emerald-500' : 'text-amber-500' },
                    { labelAr: 'الجهات (المستأجرين)', labelEn: 'Organizations', value: String(status?.counts?.organizations ?? 0), color: 'text-purple-400' },
                    { labelAr: 'المستخدمين', labelEn: 'Users', value: String(status?.counts?.users ?? 0), color: 'text-purple-400' },
                    { labelAr: 'المشاريع البحثية', labelEn: 'Projects', value: String(status?.counts?.projects ?? 0), color: 'text-purple-400' },
                    { labelAr: 'تشغيلات الذكاء الاصطناعي', labelEn: 'AI Runs', value: String(status?.counts?.ai_runs ?? 0), color: 'text-purple-400' },
                    { labelAr: 'المراجعات الأخيرة', labelEn: 'Recent Audit Events', value: String(status?.recent_audit_count ?? 0), color: 'text-purple-400' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span>{language === 'ar' ? item.labelAr : item.labelEn}</span>
                      <span className={`font-mono text-[10px] font-bold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 border-[var(--ds-border-subtle)] bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-zinc-950 rounded-3xl text-xs text-zinc-400 space-y-2">
                <div className="text-purple-400 font-black flex items-center gap-1">
                  <Sparkles size={14} />
                  <span>{language === 'ar' ? 'لوحة تحكم حية' : 'Live Dashboard'}</span>
                </div>
                <p className="leading-relaxed font-bold m-0 text-[11px]">
                  {language === 'ar'
                    ? 'يتم تحميل جميع الإعدادات والمؤشرات من الخادم مباشرة. يتم حفظ التغييرات فور النقر على "حفظ التغييرات".'
                    : 'All settings and metrics are loaded from the server in real time. Changes are saved when you click "Save Settings".'}
                </p>
                <button onClick={loadAll} className="flex items-center gap-1.5 text-[10px] font-black text-purple-400 hover:text-purple-300 transition-colors cursor-pointer">
                  <RefreshCw size={12} />
                  <span>{language === 'ar' ? 'تحديث البيانات' : 'Refresh data'}</span>
                </button>
              </Card>
            </div>
          </div>
          )
        )}

        {activeTab === 'orgs' && (
          <div className="animate-fade-in"><OrganizationSwitcher language={language} /></div>
        )}
        {activeTab === 'billing' && (
          <div className="animate-fade-in"><BillingDashboard language={language} /></div>
        )}
        {activeTab === 'audits' && (
          <div className="animate-fade-in"><SuperAdminDashboard language={language} /></div>
        )}
        {activeTab === 'diagnostics' && (
          <div className="animate-fade-in"><SmokeTestDashboard /></div>
        )}
      </div>
    </div>
  );
};
export default AdminCenter;