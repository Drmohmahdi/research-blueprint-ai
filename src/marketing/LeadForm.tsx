import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../design-system/components/Button';
import { Input, Textarea } from '../design-system/components/FormControls';
import { apiCaptureLead } from '../utils/api';
import { FUNNEL_EVENTS, track } from '../utils/analytics';

export const LeadForm: React.FC<{ isAr: boolean; defaultIntent?: string; compact?: boolean }> = ({
  isAr,
  defaultIntent = 'demo',
  compact = false,
}) => {
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [intent, setIntent] = useState(defaultIntent);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultIntent) setIntent(defaultIntent);
  }, [defaultIntent]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    const result = await apiCaptureLead({
      name,
      email,
      organization,
      intent,
      message,
      source_path: location.pathname,
    });
    if (result?.ok) {
      setStatus('ok');
      track(FUNNEL_EVENTS.generateLead, { intent, source_path: location.pathname });
      setName('');
      setEmail('');
      setOrganization('');
      setMessage('');
      return;
    }
    setStatus('error');
    setError(
      isAr
        ? 'تعذر الإرسال. راسلنا مباشرة على البريد أدناه أو أعد المحاولة.'
        : 'Could not send. Email us directly below, or try again.',
    );
  };

  if (status === 'ok') {
    return (
      <div className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-primary-soft)] p-5 text-sm font-semibold text-[var(--ds-text-primary)]">
        {isAr
          ? 'وصل طلبك. سنتواصل معك عبر البريد. يمكنك إنشاء حساب مجاني الآن إن رغبت في التجربة فورًا.'
          : 'Request received. We will follow up by email. You can also create a free account now.'}
        <div className="mt-3">
          <Link to="/login?mode=register" className="text-[var(--ds-primary-bright)] font-black">
            {isAr ? 'إنشاء حساب مجاني' : 'Create a free account'}
          </Link>
          <span className="text-[var(--ds-text-muted)]"> · </span>
          <Link to="/institutional" className="text-[var(--ds-primary-bright)] font-black">
            {isAr ? 'موجز العرض للجامعة' : 'University brief'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-start">
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
        <Input
          label={isAr ? 'الاسم' : 'Name'}
          requiredIndicator
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={120}
        />
        <Input
          label={isAr ? 'البريد' : 'Email'}
          type="email"
          requiredIndicator
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          dir="ltr"
          maxLength={254}
        />
      </div>
      <Input
        label={isAr ? 'الجهة (اختياري)' : 'Organization (optional)'}
        value={organization}
        onChange={(e) => setOrganization(e.target.value)}
        maxLength={200}
      />
      <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--ds-text-secondary)]">
        {isAr ? 'الغرض' : 'Intent'}
        <select
          className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--ds-text-primary)]"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        >
          <option value="demo">{isAr ? 'طلب عرض / تجربة مؤسسية' : 'Demo / institutional trial'}</option>
          <option value="institutional">{isAr ? 'باقة الجامعات' : 'University plan'}</option>
          <option value="trial">{isAr ? 'البدء كباحث' : 'Start as a researcher'}</option>
          <option value="support">{isAr ? 'دعم أو استفسار' : 'Support'}</option>
        </select>
      </label>
      <Textarea
        label={isAr ? 'الرسالة' : 'Message'}
        rows={compact ? 3 : 5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
      />
      {error && <p role="alert" className="text-caption font-semibold text-[var(--ds-danger)] m-0">{error}</p>}
      <Button type="submit" loading={status === 'loading'} fullWidth>
        {isAr ? 'إرسال الطلب' : 'Send request'}
      </Button>
      <p className="text-caption text-[var(--ds-text-muted)] font-medium m-0">
        {isAr
          ? 'لن نبيع بياناتك. نستخدمها للرد على طلبك وتجهيز العرض المناسب لجهتك.'
          : 'We will not sell your data. It is used to reply and prepare the right conversation for your institution.'}
      </p>
    </form>
  );
};
