import React, { useState, useEffect, useCallback } from 'react';
import { apiGetBilling, apiSubscribe, apiListPlans, apiGetDownloadUrl } from '../../utils/api';
import { CreditCard, Check, ArrowUpCircle, Download, Activity, HardDrive } from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { PathPanel } from '../../design-system/components/Navigation';
import { useProject } from '../../context/ProjectContext';

interface BillingDashboardProps {
  language: 'ar' | 'en';
}

export const BillingDashboard: React.FC<BillingDashboardProps> = ({ language }) => {
  const { user } = useProject();
  const canManageBilling = Boolean(user?.permissions?.includes('billing.manage'));
  const [billing, setBilling] = useState<any | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bill = await apiGetBilling();
      const list = await apiListPlans();
      if (!bill && !list) {
        setError(language === 'ar' ? 'تعذر تحميل بيانات الاشتراك.' : 'Could not load billing data.');
      }
      if (bill) setBilling(bill);
      if (list) setPlans(list);
    } catch {
      setError(language === 'ar' ? 'تعذر تحميل بيانات الاشتراك.' : 'Could not load billing data.');
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpgrade = async (planCode: string) => {
    if (upgrading) return;
    setMessage('');
    setError('');
    setUpgrading(planCode);
    try {
      const sub = await apiSubscribe(planCode);
      if (sub) {
        setMessage(language === 'ar' ? 'تم تحديث اشتراكك بنجاح!' : 'Subscription upgraded successfully!');
        await loadData();
      } else {
        setError(language === 'ar' ? 'لا يمكن ترقية الخطة المدفوعة دون عملية دفع موثّقة.' : 'Paid upgrades require a verified checkout session.');
      }
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-bold text-[var(--ds-text-muted)] motion-safe:animate-pulse">
        {language === 'ar' ? 'جاري تحميل تفاصيل الفوترة والاشتراكات...' : 'Loading subscription and billing details...'}
      </div>
    );
  }

  const quota = billing?.quota || {};
  const usage = billing?.usage || {};
  const activePlan = plans.find((plan) => plan.code === quota.plan_code) || null;
  const activeSub = {
    status: quota.subscription_status,
    current_period_end: quota.current_period_end,
  };
  const invoices = billing?.invoices || [];
  const limits = {
    max_projects: quota.max_projects ?? activePlan?.limits_json?.max_projects ?? 2,
    max_storage_mb: quota.max_storage_mb ?? activePlan?.limits_json?.max_storage_mb ?? 50,
  };
  const projectCount = usage.projects ?? usage.projects_count ?? 0;
  const storageMb = Number(usage.storage_mb ?? 0);
  const projectPct = Math.min((projectCount / Math.max(limits.max_projects, 1)) * 100, 100);
  const storagePct = Math.min((storageMb / Math.max(limits.max_storage_mb, 1)) * 100, 100);

  return (
    <div className="space-y-8">
      <PathPanel accent="var(--ds-path-identity)">
        <div className="space-y-1">
          <h2 className="text-h2 text-ink m-0">
            {language === 'ar' ? 'الاشتراك والفوترة' : 'Subscription & Billing'}
          </h2>
          <p className="text-caption text-secondary m-0">
            {language === 'ar'
              ? 'راجع الخطة الحالية والاستخدام والفواتير دون مغادرة مساحة العمل.'
              : 'Review the current plan, usage, and invoices without leaving the workspace.'}
          </p>
        </div>
      </PathPanel>
      {/* Messages */}
      {message && (
        <div className="p-3.5 border border-success/20 bg-action/5 text-success rounded-2xl text-xs font-bold">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="p-3.5 border border-danger/20 bg-danger/5 text-danger rounded-2xl text-xs font-bold">
          {error}
        </div>
      )}

      <div role="status" className="rounded-2xl border border-[var(--ds-information)]/25 bg-[var(--ds-information-soft)] p-3.5 text-xs font-semibold text-[var(--ds-text-primary)]">
        {language === 'ar'
          ? 'بيئة الدفع الحالية تجريبية؛ لا تُحصّل أي مبالغ حقيقية من هذه الشاشة ما لم ينقلك الخادم صراحةً إلى بوابة دفع حية.'
          : 'The current payment environment is sandboxed. No real charge is collected from this screen unless the server explicitly redirects you to a live payment gateway.'}
      </div>

      {/* Subscription and Usage Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active subscription card */}
        <Card className="lg:col-span-1 p-6 border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] relative">
          <div className="space-y-4">
            <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest block">
              {language === 'ar' ? 'الاشتراك الحالي' : 'Current Subscription'}
            </span>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] flex items-center justify-center">
                <CreditCard size={20} />
              </div>
              <div>
                <h4 className="text-h4 m-0">{activePlan ? activePlan.name : (quota.plan_name || 'Free Plan')}</h4>
                <div className="text-[10px] text-[var(--ds-text-muted)] font-semibold mt-0.5">
                  {activeSub?.status === 'ACTIVE' 
                    ? (language === 'ar' ? 'استحقاقات الخطة نشطة' : 'Plan entitlements active') 
                    : (language === 'ar' ? 'منتهي أو ملغي' : 'Expired / Cancelled')}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--ds-border-subtle)] pt-4 space-y-2 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-[var(--ds-text-muted)]">{language === 'ar' ? 'دورة الفوترة:' : 'Billing Interval:'}</span>
                <span>{activePlan?.billing_interval || 'MONTHLY'}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-[var(--ds-text-muted)]">{language === 'ar' ? 'تاريخ التجديد:' : 'Renewal Date:'}</span>
                <span>{activeSub?.current_period_end ? new Date(activeSub.current_period_end).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-[var(--ds-text-muted)]">{language === 'ar' ? 'القيمة:' : 'Price:'}</span>
                <span className="text-ink ds-numeric">{activePlan?.price} {activePlan?.currency}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Usage meters card */}
        <Card className="lg:col-span-2 p-6 border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)]">
          <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest block mb-4">
            {language === 'ar' ? 'استهلاك الحصص والحدود' : 'Entitlements & Usage Limits'}
          </span>
          <div className="space-y-6">
            {/* Projects meter */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--ds-text-secondary)]">
                  <Activity size={14} className="text-[var(--ds-primary)]" />
                  <span>{language === 'ar' ? 'عدد المشاريع البحثية' : 'Research Projects'}</span>
                </span>
                <span>{projectCount} / {limits.max_projects}</span>
              </div>
              <div className="h-2.5 w-full bg-[var(--ds-surface-secondary)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--ds-primary)] rounded-full ds-transition"
                  style={{ width: `${projectPct}%` }}
                />
              </div>
            </div>

            {/* Storage meter */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--ds-text-secondary)]">
                  <HardDrive size={14} className="text-[var(--ds-primary)]" />
                  <span>{language === 'ar' ? 'مساحة ملفات المستندات' : 'Document File Storage'}</span>
                </span>
                <span>{storageMb.toFixed(2)} MB / {limits.max_storage_mb} MB</span>
              </div>
              <div className="h-2.5 w-full bg-[var(--ds-surface-secondary)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--ds-primary)] rounded-full ds-transition"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Available Subscriptions Tier Matrix */}
      <div>
        <h3 className="text-h3 mb-6 uppercase text-[var(--ds-text-muted)]">
          {language === 'ar' ? 'خطط وباقات الاستخدام المتاحة' : 'Available Subscription Tiers'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map(plan => {
            const isCurrent = (activePlan?.code || quota.plan_code) === plan.code;
            const pLimits = plan.limits_json || {};
            const pFeatures = plan.features_json || {};

            return (
              <Card 
                key={plan.id} 
                className={`p-6 border-[var(--ds-border-subtle)] rounded-2xl flex flex-col justify-between relative overflow-hidden transition-all duration-180 hover:shadow-lg ${
                  isCurrent 
                    ? 'ring-2 ring-action bg-[var(--ds-primary-soft)]/40 border-[var(--ds-primary)]/30'
                    : 'bg-[var(--ds-surface-primary)]'
                }`}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 left-0 h-1.5 bg-[var(--ds-primary)]" />
                )}

                <div className="space-y-5">
                  <div>
                    <h4 className="text-h4 m-0">{plan.name}</h4>
                    <p className="text-[10px] text-[var(--ds-text-muted)] font-semibold mt-1 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-ink ds-numeric">{plan.price}</span>
                    <span className="text-xs font-bold text-[var(--ds-text-muted)]">{plan.currency} / {plan.billing_interval}</span>
                  </div>

                  {/* Limit specifics */}
                  <div className="space-y-2.5 border-t border-[var(--ds-border-subtle)] pt-4 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-success shrink-0" />
                      <span>{pLimits.max_projects} {language === 'ar' ? 'مشاريع كحد أقصى' : 'Projects Max'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-success shrink-0" />
                      <span>{pLimits.max_storage_mb} MB {language === 'ar' ? 'مساحة ملفات' : 'File Storage'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-success shrink-0" />
                      <span>{pFeatures.can_export ? (language === 'ar' ? 'دعم تصدير التقارير كاملة' : 'Full Blueprint Export') : (language === 'ar' ? 'لا يوجد تصدير ملفات' : 'No Blueprint Export')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <Button variant="secondary" disabled className="w-full justify-center py-2 text-xs font-black rounded-xl">
                      {language === 'ar' ? 'الخطة الحالية' : 'Current Plan'}
                    </Button>
                  ) : canManageBilling ? (
                    <Button 
                      variant="primary" 
                      loading={upgrading === plan.code}
                      disabled={Boolean(upgrading)}
                      onClick={() => handleUpgrade(plan.code)}
                      className="w-full justify-center py-2 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5"
                    >
                      <ArrowUpCircle size={14} />
                      <span>{language === 'ar' ? 'ترقية / اختيار' : 'Upgrade Plan'}</span>
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled className="w-full justify-center py-2 text-xs font-black rounded-xl">
                      {language === 'ar' ? 'يتطلب مالك مساحة العمل' : 'Owner only'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoice Billing History Table */}
      {invoices.length > 0 && (
        <div>
          <h3 className="text-h3 mb-4 uppercase text-[var(--ds-text-muted)]">
            {language === 'ar' ? 'سجل الفواتير والمدفوعات' : 'Billing & Invoice History'}
          </h3>
          <Card className="border-[var(--ds-border-subtle)] rounded-2xl overflow-hidden bg-[var(--ds-surface-primary)]">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs font-bold">
                <thead>
                  <tr className="bg-[var(--ds-surface-secondary)] border-b border-[var(--ds-border-subtle)] text-[var(--ds-text-muted)]">
                    <th className="px-6 py-3.5">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice ID'}</th>
                    <th className="px-6 py-3.5">{language === 'ar' ? 'تاريخ الفاتورة' : 'Invoice Date'}</th>
                    <th className="px-6 py-3.5">{language === 'ar' ? 'المبلغ والعملة' : 'Amount'}</th>
                    <th className="px-6 py-3.5">{language === 'ar' ? 'حالة الدفع' : 'Status'}</th>
                    <th className="px-6 py-3.5 text-center">{language === 'ar' ? 'تحميل PDF' : 'Download'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-subtle)]">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-[var(--ds-surface-secondary)] transition-colors">
                      <td className="px-6 py-4 font-black">{inv.id}</td>
                      <td className="px-6 py-4">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-ink ds-numeric">{inv.amount} {inv.currency}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--ds-success-soft)] text-success border border-success/20 text-[10px] font-extrabold">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <a 
                          href={apiGetDownloadUrl(inv.id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-action hover:underline cursor-pointer"
                        >
                          <Download size={14} />
                          <span>PDF</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
