import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { AlertTriangle, Award, CheckCircle2, Clock, FileLock2, History } from 'lucide-react';
import { Button } from '../design-system/components/Button';
import type { PreRegistrationRevision, ResearchProject } from '../types/research';
import { calculateProtocolHash, getProtocolPayload } from '../utils/protocolIntegrity';

const getPreRegistrationHistory = (project: ResearchProject): PreRegistrationRevision[] => {
  if (project.preRegistrationHistory?.length) return project.preRegistrationHistory;
  if (!project.preRegistrationHash || !project.preRegistrationLockedAt) return [];
  return [{
    id: `legacy-${project.preRegistrationHash}`,
    protocolVersion: project.version,
    hash: project.preRegistrationHash,
    lockedAt: project.preRegistrationLockedAt,
    protocolSnapshot: getProtocolPayload(project)
  }];
};

export const PreRegistration: React.FC = () => {
  const { activeProject, updateProject, language } = useProject();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [integrity, setIntegrity] = useState<'checking' | 'verified' | 'mismatch' | 'unavailable' | null>(null);
  const lockedAtLabel = activeProject?.preRegistrationLockedAt
    ? new Date(activeProject.preRegistrationLockedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
    : '';
  const revisions = activeProject ? getPreRegistrationHistory(activeProject) : [];
  const missingRequirements = activeProject ? [
    !activeProject.titleAr.trim() && !activeProject.titleEn.trim() && (language === 'ar' ? 'عنوان الدراسة' : 'Study title'),
    !activeProject.studyDesign && (language === 'ar' ? 'تصميم الدراسة' : 'Study design'),
    activeProject.variables.length === 0 && (language === 'ar' ? 'متغير واحد على الأقل' : 'At least one variable'),
    activeProject.questions.length === 0 && (language === 'ar' ? 'سؤال بحثي واحد على الأقل' : 'At least one research question'),
    activeProject.hypotheses.length === 0 && (language === 'ar' ? 'فرضية واحدة على الأقل' : 'At least one hypothesis'),
    activeProject.variables.filter(variable => variable.type === 'dependent').some(variable => {
      const instrument = activeProject.measurementInstruments?.find(item => item.variableId === variable.id);
      return !instrument || !instrument.name.trim() || !instrument.scoringPlan.trim() || !instrument.validityPlan.trim();
    }) && (language === 'ar' ? 'خطة أداة قياس مكتملة لكل متغير تابع' : 'A complete instrument plan for each dependent variable'),
    activeProject.hypotheses.some(hypothesis => {
      const plan = activeProject.hypothesisAnalysisPlans?.find(item => item.hypothesisId === hypothesis.id);
      return !plan || plan.assumptionsPlan.trim().length < 10;
    }) && (language === 'ar' ? 'خطة تحليل مكتملة لكل فرض' : 'A complete analysis plan for each hypothesis'),
    (!activeProject.ethicsFeasibilityPlan || activeProject.ethicsFeasibilityPlan.consentPlan.trim().length < 10 || activeProject.ethicsFeasibilityPlan.privacyPlan.trim().length < 10 || activeProject.ethicsFeasibilityPlan.riskMitigationPlan.trim().length < 10) && (language === 'ar' ? 'خطة أخلاقيات وخصوصية وتخفيف مخاطر مكتملة' : 'A complete ethics, privacy, and risk-mitigation plan'),
    (!Number.isFinite(activeProject.sampleSettings.expectedPower) || !Number.isFinite(activeProject.sampleSettings.expectedEffectSize) || activeProject.sampleSettings.groupsCount < 1) && (language === 'ar' ? 'إعدادات عينة مكتملة' : 'Complete sample settings')
  ].filter((requirement): requirement is string => Boolean(requirement)) : [];

  useEffect(() => {
    let cancelled = false;
    if (!activeProject?.preRegistrationHash) {
      setIntegrity(null);
      return () => { cancelled = true; };
    }

    setIntegrity('checking');
    calculateProtocolHash(activeProject)
      .then(currentHash => {
        if (!cancelled) {
          setIntegrity(currentHash === activeProject.preRegistrationHash ? 'verified' : 'mismatch');
        }
      })
      .catch(() => {
        if (!cancelled) setIntegrity('unavailable');
      });

    return () => { cancelled = true; };
  }, [activeProject]);

  if (!activeProject) {
    return (
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-8 shadow-sm text-center">
        <p className="text-[var(--ds-text-secondary)] text-sm">{language === 'ar' ? 'الرجاء تحديد مشروع نشط أولاً.' : 'Please select an active project first.'}</p>
      </div>
    );
  }

  const handleLockPreReg = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const hashString = await calculateProtocolHash(activeProject);
      const lockedAt = new Date().toISOString();
      const revision: PreRegistrationRevision = {
        id: `${lockedAt}-${hashString}`,
        protocolVersion: activeProject.version + 1,
        hash: hashString,
        lockedAt,
        protocolSnapshot: getProtocolPayload(activeProject)
      };

      updateProject({
        ...activeProject,
        preRegistrationHash: hashString,
        preRegistrationLockedAt: lockedAt,
        preRegistrationHistory: [...revisions, revision]
      });
      setStatus({
        type: 'success',
        message: language === 'ar'
          ? `تم تسجيل مراجعة البروتوكول رقم ${revisions.length + 1} وتوليد بصمة SHA-256.`
          : `Protocol revision ${revisions.length + 1} was registered with a SHA-256 fingerprint.`
      });
    } catch {
      setStatus({
        type: 'error',
        message: language === 'ar'
          ? 'تعذر توليد البصمة الرقمية. لم يتم تثبيت الخطة.'
          : 'The digital fingerprint could not be generated. The protocol was not locked.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-start pb-3 border-b border-[var(--ds-border-subtle)]">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[var(--ds-text-primary)] m-0">
              {language === 'ar' ? 'التسجيل المسبق للبروتوكول البحثي (Preregistration)' : 'Study Preregistration'}
            </h3>
            <p className="text-xs text-[var(--ds-text-secondary)] m-0">
              {language === 'ar'
                ? 'وثّق فرضياتك وخطة التحليل إلكترونياً قبل البدء في جمع البيانات لمنع التحيز وحماية مصداقية البحث.'
                : 'Document hypotheses and analysis plans before data collection to prevent bias and ensure scientific credibility.'}
            </p>
          </div>
          <FileLock2 size={24} className="text-[var(--ds-primary)]" />
        </div>

        {/* Display Active registration state */}
        {activeProject.preRegistrationHash ? (
          <div className="p-4 bg-[var(--ds-success-soft)] border border-[var(--ds-success)]/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-success dark:text-success font-bold text-sm">
              <Award size={18} />
              <span>{language === 'ar' ? 'بروتوكول البحث مسجل ومثبت رقمياً' : 'Protocol Digitally Locked & Registered'}</span>
            </div>
            
            <div className="text-xs space-y-1.5 text-[var(--ds-text-secondary)] font-medium">
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'بصمة التحقق التشفيرية للملف (SHA-256):' : 'File integrity checksum (SHA-256):'}</span>
                <span className="font-mono bg-[var(--ds-surface-secondary)] px-1.5 py-0.5 rounded select-all">
                  {activeProject.preRegistrationHash}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'تاريخ التثبيت:' : 'Date Locked:'}</span>
                <span>{lockedAtLabel || activeProject.preRegistrationLockedAt}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'إصدار الخطة:' : 'Protocol Version:'}</span>
                <span>v{activeProject.version}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{language === 'ar' ? 'سلامة المحتوى بعد التثبيت:' : 'Post-lock content integrity:'}</span>
                <span className={integrity === 'verified' ? 'text-success dark:text-success' : integrity === 'mismatch' ? 'text-danger dark:text-danger' : 'text-[var(--ds-text-secondary)]'}>
                  {integrity === 'verified'
                    ? (language === 'ar' ? 'سليم ومطابق للبصمة' : 'Verified against fingerprint')
                    : integrity === 'mismatch'
                      ? (language === 'ar' ? 'تغيّر بعد التسجيل' : 'Changed after registration')
                      : integrity === 'checking'
                        ? (language === 'ar' ? 'جارٍ التحقق...' : 'Checking...')
                        : (language === 'ar' ? 'تعذر التحقق' : 'Could not verify')}
                </span>
              </div>
            </div>
            {integrity === 'mismatch' && (
              <div className="border-t border-[var(--ds-danger)]/20 pt-3 space-y-3">
                <p className="m-0 text-xs text-[var(--ds-text-secondary)]">
                  {language === 'ar' ? 'حُفظت التعديلات بعد آخر تسجيل. سجّل مراجعة جديدة للحفاظ على سجل البروتوكولات السابق.' : 'Changes were saved after the latest registration. Register a new revision to preserve the earlier protocol record.'}
                </p>
                <Button onClick={handleLockPreReg} disabled={loading || missingRequirements.length > 0} loading={loading} variant="primary" size="sm">
                  {language === 'ar' ? 'تسجيل مراجعة جديدة للبروتوكول' : 'Register Revised Protocol'}
                </Button>
                {missingRequirements.length > 0 && <p className="m-0 text-xs font-semibold text-[var(--ds-warning)]">{language === 'ar' ? 'لا يمكن تسجيل المراجعة حتى تكتمل المتطلبات الأساسية.' : 'Complete the core requirements before registering this revision.'}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-4 text-center">
            <p className="text-[var(--ds-text-secondary)] text-xs max-w-xl mx-auto leading-relaxed">
              {language === 'ar'
                ? 'سيقوم النظام بتجميع الأهداف، والفرضيات، والمتغيرات، وحجم العينة، وخطة التحليل المسجلة وتجميدها في نسخة غير قابلة للتعديل للحفظ والتوثيق الأكاديمي.'
                : 'The system will compile all hypotheses, variables, required sample size, and analysis tests into a locked, non-editable registry copy for academic archival.'}
            </p>
            <Button
              onClick={handleLockPreReg}
              disabled={loading || missingRequirements.length > 0}
              loading={loading}
              variant="primary"
              size="sm"
            >
              {language === 'ar' ? 'تسجيل وتجميد الخطة البحثية الآن' : 'Lock & Preregister Protocol Now'}
            </Button>
            {missingRequirements.length > 0 && (
              <div role="alert" className="text-start text-xs font-semibold text-warning bg-warning/10 border border-warning rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{language === 'ar' ? 'أكمل المتطلبات التالية قبل التثبيت:' : 'Complete these requirements before locking:'}</span>
                </div>
                <ul className="list-disc ps-5 space-y-1 m-0">
                  {missingRequirements.map(requirement => <li key={requirement}>{requirement}</li>)}
                </ul>
              </div>
            )}
            {missingRequirements.length === 0 && (
              <div className="flex items-center justify-center gap-2 text-xs text-success dark:text-success font-semibold">
                <CheckCircle2 size={15} />
                <span>{language === 'ar' ? 'المتطلبات الأساسية مكتملة للتسجيل' : 'Core preregistration requirements are complete'}</span>
              </div>
            )}
            {status && (
              <div
                role="alert"
                className={status.type === 'success'
                  ? 'text-xs font-semibold text-success bg-success/10 border border-success rounded-md p-3'
                  : 'text-xs font-semibold text-danger bg-danger/10 border border-danger rounded-md p-3'}
              >
                {status.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History log mockup */}
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)] flex items-center gap-1.5">
          <History size={16} className="text-[var(--ds-text-muted)]" />
          <span>{language === 'ar' ? 'سجل إصدارات الخطة والتدقيق' : 'Protocol Revision & Audit Trail'}</span>
        </h4>

        <div className="space-y-3">
          {revisions.length === 0 ? (
            <div className="p-3 bg-[var(--ds-surface-secondary)]/60 border border-[var(--ds-border-subtle)] rounded-lg text-xs flex items-center gap-2 text-[var(--ds-text-secondary)]"><Clock size={14} /><span>{language === 'ar' ? 'لا توجد مراجعة مسجلة للبروتوكول حتى الآن.' : 'No protocol revision has been registered yet.'}</span></div>
          ) : revisions.slice().reverse().map((revision, index) => (
            <div key={revision.id} className="p-3 bg-[var(--ds-success-soft)]/60 border border-[var(--ds-success)]/20 rounded-lg text-xs flex justify-between items-center gap-3 text-[var(--ds-text-secondary)]" data-testid="registered-revision">
              <div className="flex min-w-0 items-center gap-2"><Award size={14} className="shrink-0 text-[var(--ds-success)]" /><span className="font-semibold text-[var(--ds-text-primary)]">v{revision.protocolVersion}</span><span>{language === 'ar' ? `مراجعة بروتوكول ${revisions.length - index}` : `Protocol revision ${revisions.length - index}`}</span><span className="hidden sm:inline font-mono truncate">{revision.hash}</span></div>
              <time className="shrink-0" dateTime={revision.lockedAt}>{new Date(revision.lockedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
