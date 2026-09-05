import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ShieldCheck, ListChecks, FileText } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { ROUTES } from '../../router/routes';
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
  apiRegisterThesisForProject,
  apiAssignThesisSupervisor,
  apiVerifyThesisCorrection,
  apiCreateThesisMeeting,
  apiSubmitThesisChapterVersion,
  apiApproveThesisChapter,
  apiListThesisFeedback,
  apiAddThesisFeedback,
  apiResolveThesisFeedback,
  apiListMembers,
} from '../../utils/api';
import { EmptyActiveProject } from '../../components/EmptyActiveProject';

const fieldClass = 'mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]';

export const ThesisOperationsCenter: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language, user } = useProject();
  const ar = language === 'ar';
  const [thesisId, setThesisId] = useState('');
  const [center, setCenter] = useState<any>(null);
  const [committee, setCommittee] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'supervision' | 'committee' | 'meetings' | 'feedback' | 'corrections' | 'final'>('overview');
  const [error, setError] = useState('');
  const [missingThesis, setMissingThesis] = useState(false);
  const [degreeType, setDegreeType] = useState<'MASTERS' | 'DOCTORATE'>('MASTERS');
  const [programName, setProgramName] = useState('');
  const [researchType, setResearchType] = useState<'EMPIRICAL' | 'SYSTEMATIC_REVIEW' | 'CONCEPTUAL'>('EMPIRICAL');
  const [registerError, setRegisterError] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('EXTERNAL_EXAMINER');
  const [correctionText, setCorrectionText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [chapterSummaries, setChapterSummaries] = useState<Record<string, string>>({});
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackChapterId, setFeedbackChapterId] = useState('');
  const [members, setMembers] = useState<Array<{ user_id: string; username?: string; email?: string }>>([]);
  const [supervisorUserId, setSupervisorUserId] = useState('');
  const [supervisorError, setSupervisorError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async (id: string) => {
    const c = await apiThesisCommandCenter(id);
    const [m, k, f] = await Promise.all([
      apiThesisCommittee(id).catch(() => []),
      apiThesisCorrections(id).catch(() => []),
      apiListThesisFeedback(id).catch(() => []),
    ]);
    setCenter(c);
    setCommittee(Array.isArray(m) ? m : []);
    setCorrections(Array.isArray(k) ? k : []);
    setFeedback(Array.isArray(f) ? f : []);
  };

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    setError('');
    setMissingThesis(false);
    setRegisterError('');
    setCenter(null);
    setThesisId('');
    setProgramName(activeProject.titleAr || activeProject.titleEn || '');
    apiThesisForProject(activeProject.id).then(row => {
      if (cancelled) return;
      if (!row) { setMissingThesis(true); return; }
      setThesisId(row.id);
      return reload(row.id);
    }).catch(() => { if (!cancelled) setError(ar ? 'تعذر تحميل مساحة تشغيل الرسالة.' : 'Could not load thesis operations.'); });
    return () => { cancelled = true; };
  }, [activeProject?.id, ar]);

  useEffect(() => {
    if (!thesisId) return;
    apiListMembers().then(rows => setMembers(Array.isArray(rows) ? rows : []));
  }, [thesisId]);

  if (!activeProject) return (
    <EmptyActiveProject
      language={language}
      description={ar ? 'أنشئ مشروعًا من اختيار المسار لفتح تشغيل الرسالة العلمية.' : 'Create a project from path selection to open thesis operations.'}
    />
  );
  if (error) return <EmptyState illustration={<GraduationCap size={40} />} title={ar ? 'مساحة الرسالة غير متاحة' : 'Thesis workspace unavailable'} description={error} />;
  if (missingThesis) {
    return (
      <section className="mx-auto max-w-[720px] min-w-0 space-y-5 overflow-x-clip pb-16" aria-labelledby="thesis-register-title">
        <PathPanel accent="var(--ds-path-research)">
          <p className="text-caption m-0 font-black text-[var(--ds-primary)]">BASEERAH · THESIS OPERATIONS</p>
          <h2 id="thesis-register-title" className="text-h2 m-0 mt-2">{ar ? 'تسجيل الرسالة العلمية' : 'Register the thesis'}</h2>
          <p className="text-body-sm mt-2 font-bold">{ar ? activeProject.titleAr : activeProject.titleEn}</p>
          <p className="text-body-sm mt-1 text-[var(--ds-text-secondary)]">{ar ? 'لا توجد رسالة مرتبطة بهذا المشروع بعد. سجّلها لفتح الفصول والاجتماعات والملاحظات.' : 'No thesis is linked to this project yet. Register it to open chapters, meetings, and feedback.'}</p>
        </PathPanel>
        <Card>
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            const program = programName.trim();
            if (program.length < 2) return;
            setBusy(true);
            setRegisterError('');
            apiRegisterThesisForProject(activeProject.id, { degree_type: degreeType, program_name: program, research_type: researchType })
              .then(async created => {
                setThesisId(created.id);
                await reload(created.id);
                setMissingThesis(false);
              })
              .catch(() => setRegisterError(ar ? 'تعذر تسجيل الرسالة. تحقق من صلاحيتك ثم أعد المحاولة.' : 'Could not register the thesis. Check your permission and try again.'))
              .finally(() => setBusy(false));
          }}>
            <label className="block text-sm font-bold">{ar ? 'الدرجة العلمية' : 'Degree'}
              <select className={fieldClass} value={degreeType} onChange={e => setDegreeType(e.target.value as 'MASTERS' | 'DOCTORATE')}>
                <option value="MASTERS">{ar ? 'ماجستير' : 'Master’s'}</option>
                <option value="DOCTORATE">{ar ? 'دكتوراه' : 'Doctorate'}</option>
              </select>
            </label>
            <label className="block text-sm font-bold">{ar ? 'اسم البرنامج' : 'Program name'}
              <input className={fieldClass} value={programName} onChange={e => setProgramName(e.target.value)} required minLength={2} />
            </label>
            <label className="block text-sm font-bold">{ar ? 'نوع البحث' : 'Research type'}
              <select className={fieldClass} value={researchType} onChange={e => setResearchType(e.target.value as 'EMPIRICAL' | 'SYSTEMATIC_REVIEW' | 'CONCEPTUAL')}>
                <option value="EMPIRICAL">{ar ? 'تجريبي / تطبيقي' : 'Empirical'}</option>
                <option value="SYSTEMATIC_REVIEW">{ar ? 'مراجعة منهجية' : 'Systematic review'}</option>
                <option value="CONCEPTUAL">{ar ? 'مفهومي' : 'Conceptual'}</option>
              </select>
            </label>
            {registerError ? <p role="alert" className="text-body-sm m-0 font-bold text-[var(--ds-danger)]">{registerError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || programName.trim().length < 2}>{ar ? 'تسجيل الرسالة' : 'Register thesis'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(ROUTES.PATHS)}>{ar ? 'تغيير المسار' : 'Change path'}</Button>
            </div>
          </form>
        </Card>
      </section>
    );
  }
  if (!center) return <div role="status" className="p-8 text-sm font-bold text-[var(--ds-text-muted)]">{ar ? 'جاري التحميل…' : 'Loading…'}</div>;

  const tabs = [
    ['overview', ar ? 'القيادة' : 'Command'],
    ['supervision', ar ? 'الإشراف' : 'Supervision'],
    ['committee', ar ? 'اللجنة' : 'Committee'],
    ['meetings', ar ? 'الاجتماعات' : 'Meetings'],
    ['feedback', ar ? 'ملاحظات الفصول' : 'Chapter feedback'],
    ['corrections', ar ? 'التصحيحات' : 'Corrections'],
    ['final', ar ? 'الاعتماد النهائي' : 'Final approval'],
  ] as const;
  const decidedRound = (center.examinations || []).find((item: any) => item.decision);
  const latestChapter = center.chapters?.slice().reverse().find((chapter: any) => chapter.approved_version_id) || center.chapters?.[0];

  return (
    <section className="mx-auto max-w-[1440px] min-w-0 space-y-5 overflow-x-clip pb-16" aria-labelledby="thesis-ops-title">
      <PathPanel accent="var(--ds-path-research)">
        <p className="text-caption m-0 font-black text-[var(--ds-primary)]">BASEERAH · THESIS OPERATIONS</p>
        <h2 id="thesis-ops-title" className="text-h2 m-0 mt-2">{ar ? 'تشغيل الرسالة العلمية' : 'Thesis operations'}</h2>
        <p className="text-body-sm mt-2 font-bold">{center.thesis.title_ar} · {center.thesis.title_en}</p>
        <p className="text-body-sm mt-1 text-[var(--ds-text-secondary)]">{center.thesis.degree_type} · {center.thesis.current_stage} · {center.thesis.status}</p>
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
      {tab === 'supervision' && (
        <Card>
          <h3 className="text-h3 mt-0">{ar ? 'لجنة الإشراف' : 'Supervision'}</h3>
          {(center.supervisors || []).length === 0 ? (
            <EmptyState bare title={ar ? 'لا مشرف معيّن بعد' : 'No supervisor assigned'} description={ar ? 'عيّن مشرفًا من أعضاء المؤسسة لفتح اعتماد الفصول والاجتماعات.' : 'Assign a supervisor from the organization to unlock chapter approval and meetings.'} />
          ) : (center.supervisors || []).map((item: any) => (
            <article key={item.id} className="mb-3 rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
              <p className="m-0 font-bold">{item.role} · {members.find(member => member.user_id === item.user_id)?.username || item.user_id}</p>
              <p className="mt-1 text-[var(--ds-text-secondary)]">{item.can_final_recommend ? (ar ? 'يملك التوصية النهائية' : 'Can make the final recommendation') : (ar ? 'بدون توصية نهائية' : 'No final recommendation')}</p>
            </article>
          ))}
          <form className="mt-4 space-y-3" onSubmit={event => {
            event.preventDefault();
            if (!supervisorUserId) return;
            setBusy(true);
            setSupervisorError('');
            apiAssignThesisSupervisor(thesisId, { user_id: supervisorUserId, role: 'SUPERVISOR', can_final_recommend: true })
              .then(() => { setSupervisorUserId(''); return reload(thesisId); })
              .catch(() => setSupervisorError(ar ? 'تعذر تعيين المشرف. اختر عضوًا آخر في المؤسسة.' : 'Could not assign the supervisor. Choose another organization member.'))
              .finally(() => setBusy(false));
          }}>
            <label className="block text-sm font-bold">{ar ? 'عضو المؤسسة' : 'Organization member'}
              <select className={fieldClass} value={supervisorUserId} onChange={e => setSupervisorUserId(e.target.value)} required>
                <option value="">{ar ? 'اختر مشرفًا' : 'Select a supervisor'}</option>
                {members.filter(member => member.user_id && member.user_id !== (center.thesis.student_user_id || user?.id) && !(center.supervisors || []).some((item: any) => item.user_id === member.user_id)).map(member => (
                  <option key={member.user_id} value={member.user_id}>{member.username || member.email || member.user_id}</option>
                ))}
              </select>
            </label>
            {supervisorError ? <p role="alert" className="text-body-sm m-0 font-bold text-[var(--ds-danger)]">{supervisorError}</p> : null}
            <Button type="submit" disabled={busy || !supervisorUserId}>{ar ? 'تعيين مشرف' : 'Assign supervisor'}</Button>
          </form>
        </Card>
      )}
      {tab === 'overview' && (
        <Card>
          <h3 className="text-h3 mt-0">{ar ? 'الفصول' : 'Chapters'}</h3>
          {(center.chapters || []).length === 0 ? (
            <EmptyState bare title={ar ? 'لا فصول بعد' : 'No chapters yet'} description={ar ? 'ستظهر فصول الرسالة هنا بعد إنشاء السجل الأكاديمي.' : 'Thesis chapters appear here after the academic record is created.'} />
          ) : (center.chapters || []).map((chapter: any) => {
            const pendingVersionId = chapter.latest_version_id && chapter.latest_version_id !== chapter.approved_version_id ? chapter.latest_version_id : '';
            return (
              <article key={chapter.id} className="mb-3 rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
                <p className="m-0 font-bold">{chapter.title} · v{chapter.version} · {chapter.status}</p>
                <form className="mt-3 space-y-2" onSubmit={event => {
                  event.preventDefault();
                  const summary = (chapterSummaries[chapter.id] || '').trim();
                  if (!summary) return;
                  setBusy(true);
                  apiSubmitThesisChapterVersion(thesisId, chapter.id, { content: { note: summary }, change_summary: summary })
                    .then(() => { setChapterSummaries(current => ({ ...current, [chapter.id]: '' })); return reload(thesisId); })
                    .finally(() => setBusy(false));
                }}>
                  <label className="block text-sm font-bold">{ar ? 'ملخص النسخة' : 'Version summary'}
                    <input className={fieldClass} value={chapterSummaries[chapter.id] || ''} onChange={e => setChapterSummaries(current => ({ ...current, [chapter.id]: e.target.value }))} required />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={busy}>{ar ? 'تسليم نسخة' : 'Submit version'}</Button>
                    {pendingVersionId ? (
                      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => {
                        setBusy(true);
                        apiApproveThesisChapter(thesisId, chapter.id, pendingVersionId).then(() => reload(thesisId)).finally(() => setBusy(false));
                      }}>{ar ? 'اعتماد النسخة' : 'Approve version'}</Button>
                    ) : null}
                  </div>
                </form>
              </article>
            );
          })}
        </Card>
      )}
      {tab === 'committee' && (
        <Card>
          <div className="mb-3 flex items-center gap-2"><ShieldCheck size={18} /><h3 className="text-h3 m-0">{ar ? 'لجنة المناقشة' : 'Examination committee'}</h3></div>
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
      {tab === 'meetings' && (
        <Card>
          <h3 className="text-h3 mt-0">{ar ? 'اجتماعات الإشراف' : 'Supervision meetings'}</h3>
          {(center.meetings || []).length === 0 ? <EmptyState bare title={ar ? 'لا اجتماعات مسجّلة' : 'No meetings recorded'} description={ar ? 'سجّل اجتماع إشراف بموعد وجدول أعمال.' : 'Record a supervision meeting with a time and agenda.'} /> : (center.meetings || []).map((meeting: any) => (
            <article key={meeting.id} className="mb-3 rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
              <p className="m-0 font-bold">{meeting.scheduled_at} · {meeting.status}</p>
            </article>
          ))}
          <form className="mt-4 space-y-3" onSubmit={event => {
            event.preventDefault();
            if (!meetingAt) return;
            setBusy(true);
            apiCreateThesisMeeting(thesisId, {
              scheduled_at: new Date(meetingAt).toISOString(),
              status: 'SCHEDULED',
              agenda: meetingAgenda ? [meetingAgenda] : [],
            }).then(() => { setMeetingAgenda(''); return reload(thesisId); }).finally(() => setBusy(false));
          }}>
            <label className="block text-sm font-bold">{ar ? 'موعد الاجتماع' : 'Meeting time'}<input type="datetime-local" className={fieldClass} value={meetingAt} onChange={e => setMeetingAt(e.target.value)} required /></label>
            <label className="block text-sm font-bold">{ar ? 'جدول الأعمال' : 'Agenda'}<input className={fieldClass} value={meetingAgenda} onChange={e => setMeetingAgenda(e.target.value)} /></label>
            <Button type="submit" disabled={busy}>{ar ? 'تسجيل اجتماع' : 'Record meeting'}</Button>
          </form>
        </Card>
      )}
      {tab === 'feedback' && (
        <Card>
          <h3 className="text-h3 mt-0">{ar ? 'ملاحظات المشرف على الفصول' : 'Supervisor chapter feedback'}</h3>
          {feedback.length === 0 ? <EmptyState bare title={ar ? 'لا ملاحظات بعد' : 'No feedback yet'} description={ar ? 'أضف ملاحظة على أحدث نسخة فصل لمراجعة علمية محددة.' : 'Add a note on the latest chapter version for a specific academic review.'} /> : feedback.map((item: any) => (
            <article key={item.id} className="mb-3 rounded-xl bg-[var(--ds-surface-secondary)] p-3 text-sm">
              <p className="m-0 font-bold">{item.category} · {item.severity} · {item.resolution_status}</p>
              <p className="mt-1">{item.comment_text}</p>
              {item.resolution_status === 'OPEN' ? (
                <Button className="mt-3" size="sm" disabled={busy} onClick={() => { setBusy(true); apiResolveThesisFeedback(thesisId, item.id, 'RESOLVED').then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'تعليم كمُعالَج' : 'Mark resolved'}</Button>
              ) : null}
            </article>
          ))}
          <form className="mt-4 space-y-3" onSubmit={event => {
            event.preventDefault();
            const chapter = (center.chapters || []).find((item: any) => item.id === feedbackChapterId) || (center.chapters || [])[0];
            if (!chapter?.latest_version_id || !feedbackText.trim()) return;
            setBusy(true);
            apiAddThesisFeedback(thesisId, {
              chapter_version_id: chapter.latest_version_id,
              category: 'SCIENTIFIC_CONTENT',
              severity: 'MAJOR',
              comment_text: feedbackText.trim(),
            }).then(() => { setFeedbackText(''); return reload(thesisId); }).finally(() => setBusy(false));
          }}>
            <label className="block text-sm font-bold">{ar ? 'الفصل' : 'Chapter'}
              <select className={fieldClass} value={feedbackChapterId} onChange={e => setFeedbackChapterId(e.target.value)}>
                {(center.chapters || []).map((chapter: any) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">{ar ? 'الملاحظة' : 'Feedback'}<textarea className={fieldClass} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} required rows={3} /></label>
            <Button type="submit" disabled={busy || !(center.chapters || []).some((chapter: any) => chapter.latest_version_id)}>{ar ? 'إضافة ملاحظة' : 'Add feedback'}</Button>
          </form>
        </Card>
      )}
      {tab === 'corrections' && (
        <Card>
          <div className="mb-3 flex items-center gap-2"><ListChecks size={18} /><h3 className="text-h3 m-0">{ar ? 'استوديو التصحيحات' : 'Corrections studio'}</h3></div>
          {corrections.length === 0 ? <EmptyState bare title={ar ? 'لا توجد تصحيحات' : 'No corrections'} description={ar ? 'ستظهر التصحيحات بعد قرار المناقشة ولا تُغلق ذاتيًا للتصحيحات الكبرى.' : 'Corrections appear after a defense decision. Major items cannot be self-resolved.'} /> : corrections.map(item => (
            <article key={item.id} className="mb-3 rounded-xl border border-[var(--ds-border-subtle)] p-4">
              <p className="text-body-sm m-0 font-bold">{item.correction_type} · {item.status}{item.due_at ? ` · ${item.due_at}` : ''}</p>
              <p className="text-body-sm mt-2">{item.description}</p>
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
          <div className="mb-3 flex items-center gap-2"><FileText size={18} /><h3 className="text-h3 m-0">{ar ? 'النسخة النهائية والاعتماد' : 'Final version and approval'}</h3></div>
          <p className="text-body-sm text-[var(--ds-text-secondary)]">{ar ? 'الاعتماد النهائي منفصل عن قرار المناقشة. النسخة المعتمدة مجمّدة ولا تُستبدل بصامت.' : 'Final approval is separate from the defense decision. The approved version is frozen and is never silently replaced.'}</p>
          <p className="text-body-sm font-bold">{ar ? 'معرف النسخة النهائية:' : 'Final version id:'} {center.thesis.final_version_id || (ar ? 'غير مجمّدة بعد' : 'Not frozen yet')}</p>
          {decidedRound && !center.thesis.final_version_id && <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); apiFreezeThesisFinal(thesisId, decidedRound.id, { frozen: true }).then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'تجميد النسخة النهائية' : 'Freeze final approved version'}</Button>}
          {center.thesis.final_version_id && <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); apiApproveThesisFinal(thesisId, center.thesis.final_version_id).then(() => reload(thesisId)).finally(() => setBusy(false)); }}>{ar ? 'اعتماد الدراسات العليا' : 'Graduate Studies final approval'}</Button>}
        </Card>
      )}
    </section>
  );
};

export default ThesisOperationsCenter;
