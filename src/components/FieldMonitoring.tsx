import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, ClipboardCheck, Plus, Users } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button } from '../design-system/components/Button';
import { EmptyActiveProject } from './EmptyActiveProject';
import { PathPanel } from '../design-system/components/Navigation';
import { ROUTES } from '../router/routes';
import { calculateProtocolHash } from '../utils/protocolIntegrity';
import { researchStorage } from '../utils/researchStorage';

type SessionRow = {
  sessionAr: string;
  sessionEn: string;
  date: string;
  attendance: number;
  compliance: number;
  statusAr: string;
  statusEn: string;
  tone: 'success' | 'warning';
  protocolHash?: string;
};

const getMonitoringStorageKey = (projectId: string) => `rb_monitoring_sessions_${projectId}`;
const getEnrollmentStorageKey = (projectId: string) => `rb_monitoring_enrolled_${projectId}`;

const parseSessionRows = (value: unknown): SessionRow[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is SessionRow => {
    if (!row || typeof row !== 'object') return false;
    const candidate = row as Partial<SessionRow>;
    const attendanceValue = candidate.attendance;
    const complianceValue = candidate.compliance;
    return typeof candidate.sessionAr === 'string'
      && typeof candidate.sessionEn === 'string'
      && typeof candidate.date === 'string'
      && typeof attendanceValue === 'number'
      && typeof complianceValue === 'number'
      && Number.isFinite(attendanceValue)
      && Number.isFinite(complianceValue)
      && attendanceValue >= 0
      && attendanceValue <= 100
      && complianceValue >= 0
      && complianceValue <= 100
      && (candidate.tone === 'success' || candidate.tone === 'warning');
  });
};

const loadSessionRows = (projectId: string): SessionRow[] => {
  try {
    const stored = researchStorage.getItem(getMonitoringStorageKey(projectId));
    if (!stored) return [];
    return parseSessionRows(JSON.parse(stored));
  } catch {
    return [];
  }
};

const loadEnrolledCount = (projectId: string, target: number, protocolHash?: string) => {
  try {
    const stored = researchStorage.getItem(getEnrollmentStorageKey(projectId));
    if (!stored) return 0;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return 0;
    const record = parsed as { count?: unknown; protocolHash?: unknown };
    return record.protocolHash === protocolHash
      && typeof record.count === 'number'
      && Number.isInteger(record.count)
      && record.count >= 0
      && record.count <= target
      ? record.count
      : 0;
  } catch {
    return 0;
  }
};

export const FieldMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language, isSecureMode, updateProjectWorkflowProfile } = useProject();
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [enrolled, setEnrolled] = useState(0);
  const [enrolledDraft, setEnrolledDraft] = useState('0');
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [attendance, setAttendance] = useState('');
  const [compliance, setCompliance] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [protocolStatus, setProtocolStatus] = useState<'checking' | 'verified' | 'missing' | 'mismatch' | 'unavailable'>('checking');

  const projectId = activeProject?.id;
  const populationTarget = activeProject?.sampleSettings.populationSize || 60;
  const preregHash = activeProject?.preRegistrationHash;

  useEffect(() => {
    if (!projectId || !activeProject) {
      setSessionRows([]);
      setEnrolled(0);
      setEnrolledDraft('0');
      return;
    }
    const server = activeProject.intelligenceProfile?.fieldMonitoring as { sessions?: unknown; enrolled?: unknown; protocolHash?: unknown } | undefined;
    const serverSessions = parseSessionRows(server?.sessions);
    const localSessions = loadSessionRows(projectId);
    const nextRows = serverSessions.length > 0 ? serverSessions : localSessions;
    const serverEnrolled = typeof server?.enrolled === 'number' && Number.isInteger(server.enrolled) && server.protocolHash === preregHash
      ? Math.max(0, Math.min(populationTarget, server.enrolled))
      : null;
    const loadedEnrolled = serverEnrolled ?? loadEnrolledCount(projectId, populationTarget, preregHash);
    setSessionRows(nextRows);
    setEnrolled(loadedEnrolled);
    setEnrolledDraft(String(loadedEnrolled));
    setSessionName('');
    setSessionDate('');
    setAttendance('');
    setCompliance('');
    setFormError(null);
    setEnrollmentError(null);
    if (isSecureMode && serverSessions.length === 0 && localSessions.length > 0) {
      void updateProjectWorkflowProfile(projectId, {
        intelligenceProfile: {
          ...(activeProject.intelligenceProfile || {}),
          fieldMonitoring: {
            sessions: localSessions,
            enrolled: loadedEnrolled,
            protocolHash: preregHash
          }
        }
      });
    }
  }, [projectId, populationTarget, preregHash, isSecureMode]);

  useEffect(() => {
    let cancelled = false;
    if (!preregHash || !activeProject) {
      setProtocolStatus('missing');
      return () => { cancelled = true; };
    }

    setProtocolStatus('checking');
    calculateProtocolHash(activeProject)
      .then(hash => {
        if (!cancelled) setProtocolStatus(hash === preregHash ? 'verified' : 'mismatch');
      })
      .catch(() => {
        if (!cancelled) setProtocolStatus('unavailable');
      });
    return () => { cancelled = true; };
  }, [activeProject, preregHash]);

  const target = activeProject?.sampleSettings.populationSize || 60;
  const progressPercent = Math.min(100, Math.round((enrolled / target) * 100));
  const currentProtocolRows = sessionRows.filter(row => row.protocolHash === activeProject?.preRegistrationHash);
  const fidelityScore = currentProtocolRows.length > 0
    ? Math.round(currentProtocolRows.reduce((sum, row) => sum + row.compliance, 0) / currentProtocolRows.length)
    : 0;
  const attritionRate = activeProject?.sampleSettings.expectedAttritionRate
    ? activeProject.sampleSettings.expectedAttritionRate * 100
    : 0;
  const latestSession = currentProtocolRows[currentProtocolRows.length - 1];
  const latestNeedsFollowUp = latestSession && (latestSession.attendance < 90 || latestSession.compliance < 90);
  const hasCurrentProtocolSessions = currentProtocolRows.length > 0;
  const canRecordFieldData = protocolStatus === 'verified';

  const persistFieldMonitoring = (nextRows: SessionRow[], nextEnrolled: number) => {
    if (!activeProject) return;
    researchStorage.setItem(getMonitoringStorageKey(activeProject.id), JSON.stringify(nextRows));
    researchStorage.setItem(getEnrollmentStorageKey(activeProject.id), JSON.stringify({ count: nextEnrolled, protocolHash: activeProject.preRegistrationHash }));
    if (isSecureMode) {
      void updateProjectWorkflowProfile(activeProject.id, {
        intelligenceProfile: {
          ...(activeProject.intelligenceProfile || {}),
          fieldMonitoring: {
            sessions: nextRows,
            enrolled: nextEnrolled,
            protocolHash: activeProject.preRegistrationHash
          }
        }
      });
    }
  };

  const cardClass = 'bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-3';
  const labelClass = 'text-xs font-semibold text-[var(--ds-text-muted)] uppercase tracking-wider';

  const handleAddSession = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!activeProject) return;
    if (!canRecordFieldData) {
      setFormError(language === 'ar' ? 'تحقق من تسجيل البروتوكول ومطابقته قبل إضافة جلسة تنفيذية.' : 'Verify preregistration and protocol integrity before adding a field session.');
      return;
    }
    const parsedAttendance = Number(attendance);
    const parsedCompliance = Number(compliance);
    if (!sessionName.trim() || !sessionDate || !Number.isFinite(parsedAttendance) || !Number.isFinite(parsedCompliance) || parsedAttendance < 0 || parsedAttendance > 100 || parsedCompliance < 0 || parsedCompliance > 100) {
      setFormError(language === 'ar'
        ? 'أدخل اسم الجلسة وتاريخها ونسباً بين 0 و100.'
        : 'Enter a session name, date, and percentages between 0 and 100.');
      return;
    }

    const needsFollowUp = parsedAttendance < 90 || parsedCompliance < 90;
    const nextRows: SessionRow[] = [...sessionRows, {
      sessionAr: sessionName.trim(),
      sessionEn: sessionName.trim(),
      date: sessionDate,
      attendance: parsedAttendance,
      compliance: parsedCompliance,
      statusAr: needsFollowUp ? 'بحاجة لمتابعة' : 'مطابق ومكتمل',
      statusEn: needsFollowUp ? 'Needs follow-up' : 'Complied',
      tone: needsFollowUp ? 'warning' as const : 'success' as const,
      protocolHash: activeProject.preRegistrationHash
    }];
    setSessionRows(nextRows);
    persistFieldMonitoring(nextRows, enrolled);
    setSessionName('');
    setSessionDate('');
    setAttendance('');
    setCompliance('');
  };

  const handleUpdateEnrollment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnrollmentError(null);
    if (!activeProject) return;
    if (!canRecordFieldData) {
      setEnrollmentError(language === 'ar' ? 'تحقق من تسجيل البروتوكول ومطابقته قبل تحديث التجنيد.' : 'Verify preregistration and protocol integrity before updating enrollment.');
      return;
    }
    const parsedEnrolled = Number(enrolledDraft);
    if (!Number.isInteger(parsedEnrolled) || parsedEnrolled < 0 || parsedEnrolled > target) {
      setEnrollmentError(language === 'ar'
        ? `أدخل عدداً صحيحاً بين 0 و${target}.`
        : `Enter a whole number between 0 and ${target}.`);
      return;
    }
    setEnrolled(parsedEnrolled);
    persistFieldMonitoring(sessionRows, parsedEnrolled);
  };

  if (!activeProject) {
    return (
      <EmptyActiveProject
        language={language}
        illustration={<Activity size={40} />}
        description={language === 'ar' ? 'أنشئ مشروعًا من اختيار المسار لتوثيق التنفيذ الميداني.' : 'Create a project from path selection to document field implementation.'}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PathPanel accent="var(--ds-path-data)">
        <div className="space-y-1">
          <h2 className="text-h2 text-ink m-0">
            {language === 'ar' ? 'المتابعة الميدانية وجمع البيانات' : 'Field Monitoring & Data Collection'}
          </h2>
          <p className="text-caption text-secondary m-0">
            {language === 'ar'
              ? 'وثّق التجنيد والجلسات والامتثال للبروتوكول المسجل قبل التحليل.'
              : 'Record enrollment, sessions, and protocol compliance before analysis.'}
          </p>
        </div>
      </PathPanel>
      {protocolStatus !== 'verified' ? (
        <div role="alert" className="bg-[var(--ds-warning-soft)] border border-[var(--ds-warning)]/25 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3"><AlertTriangle size={18} className="shrink-0 text-[var(--ds-warning)] mt-0.5" /><div><h3 className="text-h3 m-0 text-[var(--ds-text-primary)]">{language === 'ar' ? 'التنفيذ الميداني متوقف حتى التحقق من البروتوكول' : 'Field recording paused pending protocol verification'}</h3><p className="text-caption m-0 mt-1 text-[var(--ds-text-secondary)]">{protocolStatus === 'missing' ? (language === 'ar' ? 'سجّل البروتوكول مسبقاً قبل توثيق التجنيد أو جلسات التنفيذ.' : 'Preregister the protocol before recording enrollment or field sessions.') : protocolStatus === 'mismatch' ? (language === 'ar' ? 'تغيرت الخطة بعد آخر تسجيل؛ سجّل مراجعة بروتوكول جديدة قبل متابعة التنفيذ.' : 'The plan changed after the latest registration; register a revised protocol before continuing execution.') : (language === 'ar' ? 'جارٍ التحقق من سلامة البروتوكول. ستُتاح الكتابة عند اكتمال التحقق.' : 'Protocol integrity is being verified. Recording will be enabled when verification completes.')}</p></div></div>
          {protocolStatus !== 'checking' && <Button type="button" variant="outline" size="sm" onClick={() => navigate(ROUTES.PRE_REGISTRATION)}>{language === 'ar' ? 'فتح التسجيل المسبق' : 'Open Preregistration'}</Button>}
        </div>
      ) : (
        <div className="bg-[var(--ds-success-soft)] border border-[var(--ds-success)]/25 rounded-lg px-4 py-3 flex items-center gap-2 text-xs font-semibold text-[var(--ds-success)]"><CheckCircle2 size={16} />{language === 'ar' ? 'البروتوكول المسجل مطابق للبصمة الحالية؛ يمكن توثيق التنفيذ الميداني.' : 'The registered protocol matches the current fingerprint; field execution can be recorded.'}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cardClass}>
          <div className={`flex justify-between items-center ${labelClass}`}>
            <span>{language === 'ar' ? 'تقدم جمع البيانات' : 'Recruitment Progress'}</span>
            <Users size={16} className="text-[var(--ds-primary)]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-h3 text-ink ds-numeric m-0">
              {enrolled} / {target}
            </h3>
            <div className="w-full bg-[var(--ds-surface-secondary)] h-2 rounded-full mt-2">
              <div className="bg-[var(--ds-primary)] h-2 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
              <span className="text-[10px] text-[var(--ds-text-muted)] font-bold block mt-1 ds-numeric">
              {progressPercent}% {language === 'ar' ? 'مكتمل' : 'Complete'}
            </span>
            <form onSubmit={handleUpdateEnrollment} noValidate className="flex items-center gap-2 pt-2">
              <label htmlFor="enrolled-count" className="text-[10px] text-[var(--ds-text-muted)] whitespace-nowrap">
                {language === 'ar' ? 'العدد الحالي' : 'Current count'}
              </label>
              <input id="enrolled-count" type="number" min="0" max={target} step="1" value={enrolledDraft} onChange={event => setEnrolledDraft(event.target.value)} className="w-20 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-2 py-1 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
              <Button type="submit" variant="ghost" size="sm">
                {language === 'ar' ? 'حفظ' : 'Save'}
              </Button>
            </form>
            {enrollmentError && <p role="alert" className="text-[10px] font-semibold text-danger m-0">{enrollmentError}</p>}
          </div>
        </div>

        <div className={cardClass}>
          <div className={`flex justify-between items-center ${labelClass}`}>
            <span>{language === 'ar' ? 'مؤشر سلامة التطبيق' : 'Intervention Fidelity Index'}</span>
            <ClipboardCheck size={16} className="text-[var(--ds-success)]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-h3 text-[var(--ds-success)] ds-numeric m-0">{fidelityScore}%</h3>
            <span className="text-[10px] text-[var(--ds-text-muted)] font-medium block">
              {language === 'ar' ? 'قياس مدى الالتزام ببروتوكول التجربة' : 'Measurement of experimental adherence'}
            </span>
          </div>
        </div>

        <div className={cardClass}>
          <div className={`flex justify-between items-center ${labelClass}`}>
            <span>{language === 'ar' ? 'مخاطر التسرب (Attrition)' : 'Attrition Risk'}</span>
            <Activity size={16} className="text-[var(--ds-warning)]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-h3 text-[var(--ds-warning)] ds-numeric m-0">{attritionRate.toFixed(0)}%</h3>
            <span className="text-[10px] text-[var(--ds-text-muted)] font-medium block">
              {language === 'ar' ? 'النسبة المعتمدة في الخطة' : 'Adherence rate in plan'}
            </span>
          </div>
        </div>
      </div>

      <div className={`${!hasCurrentProtocolSessions || latestNeedsFollowUp ? 'bg-[var(--ds-warning-soft)] border-[var(--ds-warning)]/25' : 'bg-[var(--ds-success-soft)] border-[var(--ds-success)]/25'} rounded-lg p-4 flex items-start gap-3`}>
        {!hasCurrentProtocolSessions || latestNeedsFollowUp ? <AlertTriangle size={18} className="text-[var(--ds-warning)] mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="text-[var(--ds-success)] mt-0.5 shrink-0" />}
        <div className="space-y-1">
          <h4 className="text-h4 m-0 text-[var(--ds-text-primary)]">
            {!hasCurrentProtocolSessions
              ? (language === 'ar' ? 'بانتظار توثيق التنفيذ' : 'Awaiting documented execution')
              : latestNeedsFollowUp
              ? (language === 'ar' ? 'إجراء ميداني مقترح' : 'Suggested Field Action')
              : (language === 'ar' ? 'حالة التنفيذ مستقرة' : 'Implementation is on track')}
          </h4>
          <p className="text-caption m-0 text-[var(--ds-text-secondary)]">
            {!latestSession
              ? (language === 'ar' ? 'لا توجد جلسات تنفيذ موثقة تحت بصمة البروتوكول الحالية بعد.' : 'No field sessions have been documented under the current protocol fingerprint yet.')
              : latestNeedsFollowUp
              ? (language === 'ar'
                ? `راجع ${latestSession?.sessionAr} مع الفريق الميداني لأنها أقل من عتبة الالتزام المستهدفة، ثم وثق سبب الانخفاض قبل الجولة التالية.`
                : `Review ${latestSession?.sessionEn} with the field team because it is below the target adherence threshold, then document the cause before the next round.`)
              : (language === 'ar' ? 'آخر جلسة مسجلة ضمن عتبة الالتزام المستهدفة.' : 'The latest recorded session is within the target adherence threshold.')}
          </p>
        </div>
      </div>

      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
        <h4 className="text-h4 text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
          {language === 'ar' ? 'سجل متابعة تطبيق الجلسات التدريبية' : 'Session Fidelity Log Sheets'}
        </h4>

        <div className="border border-[var(--ds-border-subtle)] rounded-lg overflow-hidden text-xs">
          <table className="w-full text-start border-collapse">
            <thead className="bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] font-bold">
              <tr>
                <th className="p-3">{language === 'ar' ? 'رقم الجلسة' : 'Session No.'}</th>
                <th className="p-3">{language === 'ar' ? 'تاريخ التطبيق' : 'Date'}</th>
                <th className="p-3">{language === 'ar' ? 'معدل الحضور' : 'Attendance Rate'}</th>
                <th className="p-3">{language === 'ar' ? 'مطابقة المدرب للخطوات' : 'Trainer Compliance'}</th>
                <th className="p-3">{language === 'ar' ? 'توثيق البروتوكول' : 'Protocol record'}</th>
                <th className="p-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-subtle)] text-[var(--ds-text-secondary)]">
              {sessionRows.map((row, index) => {
                const isWarning = row.tone === 'warning';
                return (
                  <tr key={`${row.sessionEn}-${row.date}-${index}`} className="hover:bg-[var(--ds-surface-secondary)] transition-colors">
                    <td className="p-3 font-semibold text-[var(--ds-text-primary)]">{language === 'ar' ? row.sessionAr : row.sessionEn}</td>
                    <td className="p-3 font-mono">{row.date}</td>
                    <td className="p-3 ds-numeric text-ink">{row.attendance}%</td>
                    <td className="p-3 ds-numeric text-ink">{row.compliance}%</td>
                    <td className="p-3">
                      <span className={row.protocolHash === activeProject.preRegistrationHash ? 'text-[var(--ds-success)] font-semibold' : 'text-[var(--ds-warning)] font-semibold'}>
                        {row.protocolHash === activeProject.preRegistrationHash
                          ? (language === 'ar' ? 'مطابق' : 'Matched')
                          : (language === 'ar' ? 'غير موثق' : 'Unverified')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          isWarning
                            ? 'bg-[var(--ds-warning-soft)] text-[var(--ds-warning)]'
                            : 'bg-[var(--ds-success-soft)] text-[var(--ds-success)]'
                        }`}
                      >
                        {language === 'ar' ? row.statusAr : row.statusEn}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleAddSession} noValidate className="border-t border-[var(--ds-border-subtle)] pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--ds-text-primary)]">
            <Plus size={16} className="text-[var(--ds-primary)]" />
            <span>{language === 'ar' ? 'تسجيل جلسة جديدة' : 'Record a new session'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input value={sessionName} onChange={event => setSessionName(event.target.value)} placeholder={language === 'ar' ? 'اسم الجلسة' : 'Session name'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
            <input type="date" value={sessionDate} onChange={event => setSessionDate(event.target.value)} aria-label={language === 'ar' ? 'تاريخ الجلسة' : 'Session date'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
            <input type="number" min="0" max="100" step="1" value={attendance} onChange={event => setAttendance(event.target.value)} placeholder={language === 'ar' ? 'الحضور %' : 'Attendance %'} aria-label={language === 'ar' ? 'نسبة الحضور' : 'Attendance percentage'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
            <input type="number" min="0" max="100" step="1" value={compliance} onChange={event => setCompliance(event.target.value)} placeholder={language === 'ar' ? 'مطابقة المدرب %' : 'Trainer compliance %'} aria-label={language === 'ar' ? 'نسبة مطابقة المدرب' : 'Trainer compliance percentage'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
          </div>
          <Button type="submit" variant="secondary" size="sm" iconBefore={<Plus size={14} />}>
            {language === 'ar' ? 'إضافة إلى سجل التنفيذ' : 'Add to monitoring log'}
          </Button>
          {formError && <p role="alert" className="text-caption font-semibold text-danger bg-danger/10 border border-danger rounded-md p-2 m-0">{formError}</p>}
        </form>
      </div>
    </div>
  );
};
