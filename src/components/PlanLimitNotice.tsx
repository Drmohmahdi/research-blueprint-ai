import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design-system/components/Button';
import { ROUTES } from '../router/routes';
import { FUNNEL_EVENTS, track } from '../utils/analytics';

export const PlanLimitNotice: React.FC<{ language: string; className?: string }> = ({ language, className = '' }) => {
  const navigate = useNavigate();
  const ar = language === 'ar';
  useEffect(() => {
    track(FUNNEL_EVENTS.planLimitReached);
  }, []);
  return (
    <div role="alert" className={`rounded-2xl border border-[var(--ds-accent-gold)]/35 bg-[var(--ds-accent-gold-soft)] p-4 space-y-3 ${className}`}>
      <p className="text-body-sm m-0 font-bold text-[var(--ds-text-primary)]">
        {ar
          ? 'وصلت إلى حد باقتك الحالية. يمكنك المتابعة بعد الترقية من الفوترة.'
          : 'You reached your current plan limit. Upgrade from billing to continue.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => navigate(ROUTES.BILLING)}>
          {ar ? 'فتح الفوترة' : 'Open billing'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => navigate('/pricing')}>
          {ar ? 'مقارنة الباقات' : 'Compare plans'}
        </Button>
      </div>
    </div>
  );
};
