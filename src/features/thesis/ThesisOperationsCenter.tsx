import React, { useEffect, useState } from 'react';
import { GraduationCap, ShieldCheck, ListChecks, FileText } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { EmptyState } from '../../design-system/components/Feedback';
import { PathPanel } from '../../design-system/components/Navigation';
import {
  apiAddThesisCommitteeMember,
  apiAddThesisCorrection,
  apiApproveThesisFinal,
  apiFreezeThesisFinal,
  apiRespondThesisCorrection,
  apiThesisCoiDecision,
  apiThesisCommandCenter,
  apiThesisCommittee,
  apiThesisCorrections,
  apiThesisForProject,
  apiVerifyThesisCorrection,
} from '../../utils/api';

const fieldClass = 'mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]';

export const ThesisOperationsCenter: React.FC = () => {
  const { activeProject, language } = useProject();
  const ar = language === 'ar';
  const [thesisId, setThesisId] = useState('');
  const [center, setCenter] = useState<any>(null);
  const [committee, setCommittee] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'committee' | 'corrections' | 'final'>('overview');
  const [error, setError] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('EXTERNAL_EXAMINER');
  const [correctionText, setCorrectionText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = (id: string) => Promise.all([apiThesisCommandCenter(id), apiThesisCommittee(id), apiThesisCorrections(id)]).then(([c, m, k]) => { setCenter(c); setCommittee(m); setCorrections(k); });

  useEffect(() => {
    if (!activeProject) return;
    apiThesisForProject(activeProject.id).then(row => {
      if (!row) { setError(ar ? 'لا توجد رسالة مرتبطة بهذا المشروع.' : 'No thesis is linked to this project.'); return; }
      setThesisId(row.id);
      return reload(row.id);
    }).catch(() => setError(ar ? 'تعذر تحميل مساحة تشغيل الرسالة.' : 'Could not load thesis operations.'));
  }, [activeProject, ar]);

  if (!activeProject) return <EmptyState title={ar ? 'لا يوجد مشروع نشط' : 'No active project'} description={ar ? 'اختر مشروعًا لفتح تشغيل الرسالة العلمية.' : 'Select a project to open thesis operations.'} />;
  if (error) return <EmptyState illustration={<GraduationCap size={40} />} title={ar ? 'مساحة الرسالة غير متاحة' : 'Thesis workspace unavailable'} description={error} />;
  if (!center) return <div role="status" className="p-8 text-sm font-bold text-[var(--ds-text-muted)]">{ar ? 'جاري التحميل…' : 'Loading…'}</div>;

  const tabs = [
    ['overview', ar ? 'القيادة' : 'Command'],
    ['committee', ar ? 'اللجنة' : 'Committee'],
    ['corrections', ar ? 'التصحيحات' : 'Corrections'],
    ['final', ar ? 'الاعتماد النهائي' : 'Final approval'],
  ] as const;
  const decidedRound = (center.examinations || []).find((item: any) => item.decision);
  const latestChapter = center.chapters?.slice().reverse().find((chapter: any) => chapter.approved_version_id) || center.chapters?.[0];

  return (
    <section className="mx-auto max-w-[1440px] min-w-0 space-y-5 overflow-x-clip pb-16" aria-labelledby="thesis-ops-title">
      <PathPanel accent="var(--ds-path-research)">
        <p className="m-0 text-xs font-black text-[var(--ds-primary)]">BASEERAH · THESIS OPERATIONS</p>
        <h2 id="thesis-ops-title" className="m-0 mt-2 text-2xl font-black md:text-4xl">{ar ? 'تشغيل الرسالة العلمية' : 'Thesis operations'}</h2>
        <p className="mt-2 text-sm font-bold">{center.thesis.title_ar} · {center.thesis.title_en}</p>
        <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">{center.thesis.degree_type} · {center.thesis.current_stage} · {center.thesis.status}</p>
      </PathPanel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card padding="sm"><span className="block text-xs text-[var(--ds-text-secondary)]">{ar ? 'جاهزية المناقشة' : 'Defense readiness'}</span><strong className="text-2xl ds-numeric text-ink">{center.defense_readiness.score}%</strong></Card>
        <Card padding="sm"><span className="block text-xs text-[var(--ds-text-secondary)]">{ar ? 'الإجراء التالي' : 'Next action'}</span><strong className="text-sm">{center.next_best_action.action}</strong></Card>
        <Card padding="sm"><span className="block text-xs text-[var(--ds-text-secondary)]">{ar ? 'تصحيحات مفتوحة' : 'Open corrections'}</span><strong className="text-2xl ds-numeric text-ink">{center.corrections_due}</strong></Card>
      </div>
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label={ar ? 'أقسام تشغيل الرسالة' : 'Thesis operation sections'}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab === id ? 'border-[var(--ds-primary)] bg-[var(--ds-primary-soft)] text-ink' : 'border-transparent bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'}`}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && (
        <Card>
          <h3 className="mt-0 text-lg font-black">{ar ? 'الفصول' : 'Chapters'}</h3>
          <ul className="space-y-2 p-0">{center.chapters.map((chapter: any) => <li key={chapter.id} className="list-none rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm"><b>{chapter.title}</b> · v{chapter.version} · {chapter.status}</li>)}</ul>
        </Card>
      )}
      {tab === 'committee' && (
        <Card>
          <div className="mb-3 flex items-center gap-2"><ShieldCheck size={18} /><h3 className="m-0 text-lg font-black">{ar ? 'لجنة المناقشة' : 'Examination committee'}</h3></div>
          {committee.length === 0 ? <EmptyState bare title={ar ? 'لا أعضاء بعد' : 'No members yet'} description={ar ? 'عيّن الأعضاء وفق سياسة المؤسسة ثم أكمل الإفصاح ومراجعة تضارب المصالح بشريًا.' : 'Appoint members according to policy, then complete disclosure and a human COI review.'} /> : committee.map(member => (
            <article key={member.id} className="mb-3 rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
              <p className="m-0 font-bold">{member.role} · {member.external_name || member.user_id}</p>
              <p className="mt-1">{member.eligibility_status} · {member.appointment_status}</p>
              {member.appointment_status !== 'APPROVED' && <Button className="mt-3" size="sm" disabled={busy} onClick={() => { setBusy(true); apiThesisCoiDecision(thesisId, member.id, 'CLEARED', 'Human COI review recorded').then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'تأكيد خلوّ تضارب المصالح' : 'Record human COI clearance'}</Button>}
            </article>
          ))}
          <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); setBusy(true); apiAddThesisCommitteeMember(thesisId, { external_name: memberName, role: memberRole, evidence: { disclosure: true, eligibility_confirmed_by: 'workspace' } }).then(() => { setMemberName(''); return reload(thesisId); }).finally(() => setBusy(false)); }}>
            <label className="block text-sm font-bold">{ar ? 'اسم العضو' : 'Member name'}<input className={fieldClass} value={memberName} onChange={e => setMemberName(e.target.value)} required /></label>
            <label className="block text-sm font-bold">{ar ? 'الدور' : 'Role'}
              <select className={fieldClass} value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                <option value="CHAIR">CHAIR</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="CO_SUPERVISOR">CO_SUPERVISOR</option>
                <option value="INTERNAL_EXAMINER">INTERNAL_EXAMINER</option>
                <option value="EXTERNAL_EXAMINER">EXTERNAL_EXAMINER</option>
                <option value="MEMBER">MEMBER</option>
              </select>
            </label>
            <Button type="submit" disabled={busy || !memberName.trim()}>{ar ? 'إضافة عضو لجنة' : 'Add committee member'}</Button>
          </form>
        </Card>
      )}
      {tab === 'corrections' && (
        <Card>
          <div className="mb-3 flex items-center gap-2"><ListChecks size={18} /><h3 className="m-0 text-lg font-black">{ar ? 'استوديو التصحيحات' : 'Corrections studio'}</h3></div>
          {corrections.length === 0 ? <EmptyState bare title={ar ? 'لا توجد تصحيحات' : 'No corrections'} description={ar ? 'ستظهر التصحيحات بعد قرار المناقشة ولا تُغلق ذاتيًا للتصحيحات الكبرى.' : 'Corrections appear after a defense decision. Major items cannot be self-resolved.'} /> : corrections.map(item => (
            <article key={item.id} className="mb-3 rounded-xl border border-[var(--ds-border-subtle)] p-4">
              <p className="m-0 text-sm font-bold">{item.correction_type} · {item.status}{item.due_at ? ` · ${item.due_at}` : ''}</p>
              <p className="mt-2 text-sm">{item.description}</p>
              {item.status === 'OPEN' && (
                <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); if (!latestChapter?.approved_version_id) return; setBusy(true); apiRespondThesisCorrection(thesisId, item.id, { response_text: responseText, evidence_version_id: latestChapter.approved_version_id }).then(() => reload(thesisId)).finally(() => setBusy(false)); }}>
                  <label className="block text-sm font-bold">{ar ? 'رد الطالب مع وصف التغيير' : 'Student response and change description'}<textarea className={fieldClass} value={responseText} onChange={e => setResponseText(e.target.value)} required rows={3} /></label>
                  <Button type="submit" size="sm" disabled={busy}>{ar ? 'ربط النسخة الجديدة' : 'Link revised version'}</Button>
                </form>
              )}
              {item.status === 'SUBMITTED_FOR_VERIFICATION' && <Button className="mt-3" size="sm" disabled={busy} onClick={() => { setBusy(true); apiVerifyThesisCorrection(thesisId, item.id).then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'تحقق بشري' : 'Human verify'}</Button>}
            </article>
          ))}
          {decidedRound && (
            <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); setBusy(true); apiAddThesisCorrection(thesisId, { examination_round_id: decidedRound.id, correction_type: 'MAJOR', description: correctionText, source: 'COMMITTEE', required: true }).then(() => { setCorrectionText(''); return reload(thesisId); }).finally(() => setBusy(false)); }}>
              <label className="block text-sm font-bold">{ar ? 'تصحيح مطلوب' : 'Required correction'}<textarea className={fieldClass} value={correctionText} onChange={e => setCorrectionText(e.target.value)} required rows={3} /></label>
              <Button type="submit" disabled={busy || !correctionText.trim()}>{ar ? 'تسجيل تصحيح' : 'Record correction'}</Button>
            </form>
          )}
        </Card>
      )}
      {tab === 'final' && (
        <Card>
          <div className="mb-3 flex items-center gap-2"><FileText size={18} /><h3 className="m-0 text-lg font-black">{ar ? 'النسخة النهائية والاعتماد' : 'Final version and approval'}</h3></div>
          <p className="text-sm leading-7 text-[var(--ds-text-secondary)]">{ar ? 'الاعتماد النهائي منفصل عن قرار المناقشة. النسخة المعتمدة مجمّدة ولا تُستبدل بصامت.' : 'Final approval is separate from the defense decision. The approved version is frozen and is never silently replaced.'}</p>
          <p className="text-sm font-bold">{ar ? 'معرف النسخة النهائية:' : 'Final version id:'} {center.thesis.final_version_id || (ar ? 'غير مجمّدة بعد' : 'Not frozen yet')}</p>
          {decidedRound && !center.thesis.final_version_id && <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); apiFreezeThesisFinal(thesisId, decidedRound.id, { frozen: true }).then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'تجميد النسخة النهائية' : 'Freeze final approved version'}</Button>}
          {center.thesis.final_version_id && <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); apiApproveThesisFinal(thesisId, center.thesis.final_version_id).then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'اعتماد الدراسات العليا' : 'Graduate Studies final approval'}</Button>}
        </Card>
      )}
    </section>
  );
};

export default ThesisOperationsCenter;
