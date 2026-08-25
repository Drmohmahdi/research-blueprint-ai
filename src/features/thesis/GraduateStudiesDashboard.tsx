import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { EmptyState } from '../../design-system/components/Feedback';
import { PathPanel } from '../../design-system/components/Navigation';
import { apiThesisGraduateOperations } from '../../utils/api';

export const GraduateStudiesDashboard: React.FC = () => {
  const { language } = useProject();
  const ar = language === 'ar';
  const [summary, setSummary] = useState<any>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    apiThesisGraduateOperations().then(row => { if (row == null) setDenied(true); else setSummary(row); }).catch(() => setDenied(true));
  }, []);

  if (denied) return <EmptyState illustration={<Building2 size={40} />} title={ar ? 'عمليات الدراسات العليا غير متاحة' : 'Graduate Studies operations unavailable'} description={ar ? 'هذه اللوحة تجميعية ولا تكشف الملاحظات السرية أو محتوى الفصول غير المنشور.' : 'This board is aggregate-first and never reveals confidential notes or unpublished chapters.'} />;
  if (!summary) return <div role="status" className="p-8 text-sm font-bold">{ar ? 'جاري التحميل…' : 'Loading…'}</div>;

  const metrics = [
    [ar ? 'رسائل نشطة' : 'Active theses', summary.active],
    [ar ? 'ماجستير' : "Master's", summary.masters],
    [ar ? 'دكتوراه' : 'Doctorates', summary.doctorates],
    [ar ? 'اعتمادات معلّقة' : 'Pending approvals', summary.pending_approvals],
    [ar ? 'معرّضة للخطر' : 'At risk', summary.at_risk],
    [ar ? 'معالم متأخرة' : 'Overdue milestones', summary.overdue_milestones],
    [ar ? 'مراجعات مشرف' : 'Supervisor reviews', summary.supervisor_reviews_pending],
    [ar ? 'مناقشات قادمة' : 'Upcoming defenses', summary.upcoming_defenses],
    [ar ? 'دعوات مناقشين' : 'Examiner invitations', summary.pending_examiner_invitations],
    [ar ? 'تقارير مستحقة' : 'Reports due', summary.examiner_reports_due],
    [ar ? 'تصحيحات مستحقة' : 'Corrections due', summary.corrections_due],
    [ar ? 'اعتماد نهائي' : 'Final approvals', summary.final_approvals_pending],
    [ar ? 'إيداع معلّق' : 'Deposits pending', summary.deposits_pending],
  ];

  return (
    <section className="mx-auto max-w-[1440px] min-w-0 space-y-5 pb-16" aria-labelledby="gs-title">
      <PathPanel accent="var(--ds-path-research)">
        <p className="m-0 text-xs font-black text-[var(--ds-primary)]">BASEERAH · GRADUATE STUDIES</p>
        <h2 id="gs-title" className="m-0 mt-2 text-2xl font-black md:text-4xl">{ar ? 'عمليات الدراسات العليا' : 'Graduate Studies operations'}</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ds-text-secondary)]">{ar ? 'لوحة تشغيلية تجميعية: لا ملاحظات مشرف خاصة، ولا تقارير مناقش سرية، ولا فصول غير منشورة.' : 'An operational aggregate board: no private supervisor notes, confidential examiner reports, or unpublished chapters.'}</p>
      </PathPanel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={String(label)} padding="sm"><span className="block text-xs text-[var(--ds-text-secondary)]">{label}</span><strong className="text-2xl ds-numeric text-ink">{value ?? 0}</strong></Card>
        ))}
      </div>
      <Card>
        <h3 className="mt-0 text-lg font-black">{ar ? 'توزيع المراحل' : 'Stage distribution'}</h3>
        <ul className="space-y-2 p-0">{Object.entries(summary.stage_distribution || {}).map(([stage, count]) => <li key={stage} className="list-none text-sm font-bold">{stage}: <span className="ds-numeric">{String(count)}</span></li>)}</ul>
      </Card>
    </section>
  );
};

export default GraduateStudiesDashboard;
