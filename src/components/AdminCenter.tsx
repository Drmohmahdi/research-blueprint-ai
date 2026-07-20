import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { 
  Settings, 
  Shield, 
  Building2, 
  CreditCard, 
  Terminal, 
  Activity, 
  Database, 
  Cpu, 
  Layers, 
  ToggleLeft, 
  ToggleRight, 
  CheckCircle,
  Sparkles,
  Server
} from 'lucide-react';

// Subcomponents
import { SuperAdminDashboard } from '../features/saas/SuperAdminDashboard';
import { BillingDashboard } from '../features/saas/BillingDashboard';
import { OrganizationSwitcher } from '../features/saas/OrganizationSwitcher';
import { SmokeTestDashboard } from './SmokeTestDashboard';

// Feature Flags baseline
import { FEATURE_FLAGS } from '../utils/featureFlags';

export const AdminCenter: React.FC = () => {
  const { language, projects } = useProject();
  const [activeTab, setActiveTab] = useState<'config' | 'orgs' | 'billing' | 'audits' | 'diagnostics'>('config');

  // Simulated live metrics
  const [latency, setLatency] = useState(24);
  const [activeAiModel, setActiveAiModel] = useState('gemini-2.0-flash');
  
  // Local state for interactive settings demo
  const [platformTitleAr, setPlatformTitleAr] = useState('منصة بصيرة للبحث العلمي');
  const [platformTitleEn, setPlatformTitleEn] = useState('Baseerah Research Platform');
  const [flags, setFlags] = useState({ ...FEATURE_FLAGS });

  // Simulate network jitter for latency meter
  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        const next = prev + delta;
        return next > 45 ? 40 : next < 12 ? 15 : next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const toggleFlag = (flagName: keyof typeof FEATURE_FLAGS) => {
    setFlags(prev => ({
      ...prev,
      [flagName]: !prev[flagName]
    }));
  };

  // Tabs translation config
  const tabConfig = [
    { id: 'config' as const, labelAr: 'إعدادات المنصة', labelEn: 'General Settings', icon: Settings },
    { id: 'orgs' as const, labelAr: 'المستأجرين والأعضاء', labelEn: 'Organizations & Users', icon: Building2 },
    { id: 'billing' as const, labelAr: 'الباقات والفوترة', labelEn: 'Plans & Billing', icon: CreditCard },
    { id: 'audits' as const, labelAr: 'سجل الأمان والرقابة', labelEn: 'Security Audit logs', icon: Shield },
    { id: 'diagnostics' as const, labelAr: 'الفحوصات والأعطال', labelEn: 'Smoke Diagnostics', icon: Terminal }
  ];

  return (
    <div className="space-y-6">
      
      {/* ── Header ── */}
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

      {/* ── Top Metrics Ribbon ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Latency card */}
        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'زمن الاستجابة' : 'API Latency'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-black text-[var(--ds-text-primary)]">{latency}ms</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">
                {language === 'ar' ? 'ممتاز' : 'EXCELLENT'}
              </span>
            </div>
          </div>
        </Card>

        {/* Database Status card */}
        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Database size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'قاعدة البيانات' : 'AI Database'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-black text-[var(--ds-text-primary)]">AlloyDB Omni</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">
                {language === 'ar' ? 'نشط' : 'HEALTHY'}
              </span>
            </div>
          </div>
        </Card>

        {/* Active Studies card */}
        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'الأبحاث النشطة' : 'Active Studies'}
            </div>
            <div className="mt-0.5">
              <span className="text-sm font-black text-[var(--ds-text-primary)]">{projects.length} {language === 'ar' ? 'خطط بحثية' : 'Protocols'}</span>
            </div>
          </div>
        </Card>

        {/* Active AI model card */}
        <Card className="p-4 flex items-center gap-3.5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="h-9 w-9 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Cpu size={18} />
          </div>
          <div>
            <div className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider">
              {language === 'ar' ? 'نموذج التوليد' : 'AI Gen Engine'}
            </div>
            <div className="mt-0.5">
              <span className="text-[11px] font-black text-[var(--ds-text-primary)]">{activeAiModel}</span>
            </div>
          </div>
        </Card>

      </div>

      {/* ── Navigation Tabs Bar ── */}
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

      {/* ── Active Tab Display Content ── */}
      <div className="space-y-4">
        
        {/* Tab 1: General configurations & Feature flags */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side settings */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-3xl space-y-4">
                <h3 className="text-sm font-black text-white m-0 flex items-center gap-2 border-b border-[var(--ds-border-subtle)] pb-3">
                  <Settings size={16} className="text-purple-500" />
                  <span>{language === 'ar' ? 'إعدادات المنصة الأساسية' : 'Primary Platform Configurations'}</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-zinc-300">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'اسم المنصة بالعربية' : 'Arabic Platform Title'}</label>
                    <input
                      type="text"
                      value={platformTitleAr}
                      onChange={(e) => setPlatformTitleAr(e.target.value)}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'اسم المنصة بالإنجليزية' : 'English Platform Title'}</label>
                    <input
                      type="text"
                      value={platformTitleEn}
                      onChange={(e) => setPlatformTitleEn(e.target.value)}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'الموديل الافتراضي للذكاء الاصطناعي' : 'Default Generative AI Model'}</label>
                    <select
                      value={activeAiModel}
                      onChange={(e) => setActiveAiModel(e.target.value)}
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3.5 py-2.5 text-white"
                    >
                      <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[var(--ds-border-subtle)]">
                  <button
                    onClick={() => alert(language === 'ar' ? 'تم حفظ التغييرات بنجاح!' : 'Settings updated successfully!')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
                  >
                    {language === 'ar' ? 'حفظ التغييرات' : 'Save Settings'}
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
                    {language === 'ar' ? 'تمكين أو تعطيل أجزاء ومسارات من النظام بشكل فوري للمستخدمين.' : 'Instantly toggle frontend routes and experimental features on/off.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {Object.entries(flags).map(([key, value]) => (
                    <div 
                      key={key} 
                      className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]/50 flex justify-between items-center gap-4 hover:border-zinc-800 transition-all"
                    >
                      <div>
                        <div className="text-[11px] font-black text-white">{key}</div>
                        <div className="text-[9px] text-zinc-500 font-bold leading-none mt-1">
                          {key === 'DESIGN_SYSTEM_V2' ? (language === 'ar' ? 'تفعيل نظام التصميم V2' : 'Enable Design System V2') : (language === 'ar' ? 'ميزة نشطة فورا' : 'Active system flag')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFlag(key as any)}
                        className="text-[var(--ds-text-secondary)] hover:text-purple-500 transition-colors bg-transparent border-none cursor-pointer"
                      >
                        {value ? (
                          <ToggleRight size={28} className="text-purple-600" />
                        ) : (
                          <ToggleLeft size={28} className="text-zinc-600" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>

            </div>

            {/* Right side helper info */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 border-[var(--ds-border-subtle)] bg-zinc-950 rounded-3xl space-y-4 text-xs font-semibold text-zinc-400 leading-relaxed">
                <h4 className="text-xs font-black text-white m-0 uppercase tracking-wider flex items-center gap-1.5">
                  <Server size={14} className="text-purple-500" />
                  <span>{language === 'ar' ? 'عن خادم المنصة' : 'Server Metadata'}</span>
                </h4>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span>{language === 'ar' ? 'إصدار المنصة' : 'App Version'}</span>
                    <span className="font-mono text-[10px] text-purple-400 font-bold">2.0.0</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span>{language === 'ar' ? 'نواة الخادم' : 'Backend Engine'}</span>
                    <span className="font-mono text-[10px] text-purple-400 font-bold">FastAPI 0.111</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span>{language === 'ar' ? 'مستوى الاتصال بالذكاء' : 'Gemini AI connection'}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                      <CheckCircle size={10} />
                      <span>{language === 'ar' ? 'متصل' : 'Connected'}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-1">
                    <span>{language === 'ar' ? 'مستوى الأمان (SSL)' : 'SSL Security'}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                      <CheckCircle size={10} />
                      <span>{language === 'ar' ? 'مفعل' : 'Active'}</span>
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-[var(--ds-border-subtle)] bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-zinc-950 rounded-3xl text-xs text-zinc-400 space-y-2">
                <div className="text-purple-400 font-black flex items-center gap-1">
                  <Sparkles size={14} />
                  <span>{language === 'ar' ? 'ملاحظة الفحص التلقائي' : 'Diagnostics Note'}</span>
                </div>
                <p className="leading-relaxed font-bold m-0 text-[11px]">
                  {language === 'ar'
                    ? 'يتم تشخيص أجزاء المنصة (التحقق من صحة القواعد، محركات التحليل، ومصفوفة الالتزام) دورياً وبشكل تلقائي وتظهر في التبويب الخامس.'
                    : 'System tests validating framework integration and local pooling algorithms run in real-time in the 5th diagnostics tab.'}
                </p>
              </Card>
            </div>

          </div>
        )}

        {/* Tab 2: Organizations & workspaces */}
        {activeTab === 'orgs' && (
          <div className="animate-fade-in">
            <OrganizationSwitcher language={language} />
          </div>
        )}

        {/* Tab 3: Plans & billing */}
        {activeTab === 'billing' && (
          <div className="animate-fade-in">
            <BillingDashboard language={language} />
          </div>
        )}

        {/* Tab 4: Security logs */}
        {activeTab === 'audits' && (
          <div className="animate-fade-in">
            <SuperAdminDashboard language={language} />
          </div>
        )}

        {/* Tab 5: Automated diagnostics smoke tests */}
        {activeTab === 'diagnostics' && (
          <div className="animate-fade-in">
            <SmokeTestDashboard />
          </div>
        )}

      </div>

    </div>
  );
};
export default AdminCenter;
