import React, { useEffect, useState } from 'react';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { apiListMarketingLeads, apiUpdateMarketingLead, type MarketingLead } from '../utils/api';

const STATUSES = ['NEW', 'CONTACTED', 'DEMO', 'CLOSED'] as const;

const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  NEW: { ar: 'جديد', en: 'New' },
  CONTACTED: { ar: 'تم التواصل', en: 'Contacted' },
  DEMO: { ar: 'عرض', en: 'Demo' },
  CLOSED: { ar: 'أُغلق', en: 'Closed' },
};

function followUpMailto(lead: MarketingLead, isAr: boolean): string {
  const brief = `${window.location.origin}/institutional`;
  const subject = isAr
    ? `متابعة طلب بصيرة — ${lead.organization || lead.name}`
    : `Baseerah follow-up — ${lead.organization || lead.name}`;
  const body = isAr
    ? [
        `السلام عليكم ${lead.name}،`,
        '',
        `شكرًا لتواصلكم مع بصيرة${lead.organization ? ` بشأن ${lead.organization}` : ''}.`,
        'بصيرة منصة تشغيل أكاديمي (ليست مولّد أوراق): تصميم الدراسة، التحكيم مزدوج التعمية، الترقيات، ومسارات الرسائل داخل عزل مؤسسي.',
        '',
        'الخطوة التالية: مكالمة قصيرة ثم حساب تجريبي بمؤسسة معزولة وبيانات حقيقية خاصة بجهتكم.',
        `موجز العرض للطباعة: ${brief}`,
        'باقة المؤسسات: 999 ر.س شهريًا أو 9990 سنويًا، عبر طلب عرض لا بطاقة.',
        '',
        'وتفضلوا بقبول فائق التحية.',
      ].join('\n')
    : [
        `Dear ${lead.name},`,
        '',
        `Thank you for contacting Baseerah${lead.organization ? ` regarding ${lead.organization}` : ''}.`,
        'Baseerah is an academic operations platform (not a paper generator): study design, double-blind review, promotions, and thesis paths inside tenant isolation.',
        '',
        'Next step: a short call, then a trial in a separate organization with your institution’s own data.',
        `Printable brief: ${brief}`,
        'Institutional plan: 999 SAR monthly or 9,990 SAR yearly, via a demo request — not card checkout.',
        '',
        'Kind regards,',
      ].join('\n');
  return `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const MarketingLeadsPanel: React.FC<{ language: string }> = ({ language }) => {
  const isAr = language === 'ar';
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const rows = await apiListMarketingLeads();
    setLeads(rows || []);
    setDraftNotes(Object.fromEntries((rows || []).map((row) => [row.id, row.notes || ''])));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const updateLead = async (id: string, status: string, notes?: string) => {
    setSavingId(id);
    const updated = await apiUpdateMarketingLead(id, { status, notes });
    if (updated) {
      setLeads((current) => current.map((row) => (row.id === id ? updated : row)));
      setDraftNotes((current) => ({ ...current, [id]: updated.notes || '' }));
    }
    setSavingId(null);
  };

  if (loading) {
    return <p className="text-xs font-bold text-[var(--ds-text-muted)]">{isAr ? 'جارِ تحميل الطلبات...' : 'Loading leads...'}</p>;
  }

  if (leads.length === 0) {
    return (
      <Card className="p-6">
        <p className="m-0 text-sm font-bold text-[var(--ds-text-secondary)]">
          {isAr ? 'لا توجد طلبات تواصل بعد. ستظهر هنا بعد إرسال نموذج الموقع.' : 'No inquiries yet. They appear here after the marketing form is submitted.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="m-0 text-[11px] font-semibold text-[var(--ds-text-muted)]">
        {isAr
          ? 'تابع الطلب يدويًا: غيّر الحالة، أضف ملاحظة، وأرسل قالب الرد. الموجز المؤسسي للطباعة من رابط الجامعات.'
          : 'Work each inquiry by hand: change status, add a note, and send the reply template. The printable brief is on the universities page.'}
      </p>
      {leads.map((lead) => (
        <Card key={lead.id} className="p-4 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-black">{lead.name}</p>
              <p className="m-0 mt-1 text-xs font-bold text-[var(--ds-text-muted)]" dir="ltr">{lead.email}</p>
              {lead.organization && <p className="m-0 text-xs text-[var(--ds-text-secondary)]">{lead.organization}</p>}
            </div>
            <select
              className="text-xs font-bold rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] px-3 py-2"
              value={lead.status}
              disabled={savingId === lead.id}
              onChange={(event) => void updateLead(lead.id, event.target.value, draftNotes[lead.id])}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>{isAr ? STATUS_LABEL[status].ar : STATUS_LABEL[status].en}</option>
              ))}
            </select>
          </div>
          <p className="m-0 text-[11px] font-semibold text-[var(--ds-text-muted)]">
            {lead.intent} · {lead.source_path || '—'} · {new Date(lead.created_at).toLocaleString(isAr ? 'ar-SA' : 'en-GB')}
          </p>
          {lead.message && <p className="m-0 text-xs leading-relaxed text-[var(--ds-text-secondary)]">{lead.message}</p>}
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[var(--ds-text-muted)]">{isAr ? 'ملاحظة المتابعة' : 'Follow-up note'}</span>
            <textarea
              className="w-full min-h-[72px] text-xs rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] px-3 py-2"
              value={draftNotes[lead.id] ?? ''}
              disabled={savingId === lead.id}
              onChange={(event) => setDraftNotes((current) => ({ ...current, [lead.id]: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingId === lead.id}
              onClick={() => void updateLead(lead.id, lead.status, draftNotes[lead.id])}
            >
              {isAr ? 'حفظ الملاحظة' : 'Save note'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { window.location.href = followUpMailto(lead, isAr); }}>
              {isAr ? 'فتح قالب الرد' : 'Open reply template'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => window.open('/institutional', '_blank', 'noopener')}>
              {isAr ? 'الموجز المؤسسي' : 'Institutional brief'}
            </Button>
          </div>
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
        {isAr ? 'تحديث القائمة' : 'Refresh'}
      </Button>
    </div>
  );
};
