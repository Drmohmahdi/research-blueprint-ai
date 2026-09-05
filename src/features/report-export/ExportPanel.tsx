import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { EmptyActiveProject } from '../../components/EmptyActiveProject';
import { PathPanel } from '../../design-system/components/Navigation';
import { FileText, Download, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiExportAcademicReport, apiVerifyReport, type ReportVerificationResult } from '../../utils/api';

export const ExportPanel: React.FC = () => {
  const { activeProject, language } = useProject();
  const isAr = language === 'ar';

  const [reportType, setReportType] = useState<'RESEARCH_PROJECT' | 'LITERATURE_SYNTHESIS' | 'PRISMA_FLOW' | 'PROMOTION_READINESS' | 'PEER_REVIEW' | 'ACADEMIC_PROFILE'>('RESEARCH_PROJECT');
  const [format, setFormat] = useState<'PDF' | 'DOCX' | 'JSON'>('PDF');
  const [reportLang, setReportLang] = useState<'ar' | 'en' | 'bilingual'>('ar');
  const [audience, setAudience] = useState<'RESEARCHER' | 'AUTHOR' | 'SUPERVISOR' | 'COMMITTEE' | 'ADMIN'>('RESEARCHER');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<{ filename: string; integrityHash?: string } | null>(null);

  // Verification state
  const [verifCode, setVerifCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifResult, setVerifResult] = useState<ReportVerificationResult | null>(null);

  if (!activeProject) {
    return (
      <EmptyActiveProject
        language={language}
        illustration={<FileText size={40} />}
        description={isAr ? 'أنشئ مشروعًا من اختيار المسار لعرض مصدّر التقارير الأكاديمية.' : 'Create a project from path selection to open the academic report compiler.'}
      />
    );
  }

  const handleExport = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setLastGenerated(null);

    try {
      const res = await apiExportAcademicReport({
        report_type: reportType,
        source_id: activeProject.id,
        format,
        language: reportLang,
        audience,
        template_version: 'academic-standard-v1'
      });

      if (!res) {
        setErrorMsg(isAr ? 'فشل توليد التقرير من الخادم. يرجى التحقق من الصلاحيات والاتصال.' : 'Failed to generate report from server. Please verify permissions and connection.');
        return;
      }

      // Trigger browser download
      const url = window.URL.createObjectURL(res.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setLastGenerated({
        filename: res.filename,
        integrityHash: res.integrityHash
      });
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ أثناء تنزيل الملف' : 'An error occurred during file download');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifCode.trim()) return;
    setIsVerifying(true);
    setVerifResult(null);

    try {
      const res = await apiVerifyReport(verifCode.trim());
      setVerifResult(res);
    } catch {
      setVerifResult({
        valid: false,
        verification_code: verifCode,
        message: isAr ? 'تعذر الاتصال بخادم التحقق' : 'Unable to connect to verification server'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PathPanel accent="var(--ds-path-publication)">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-[var(--ds-path-publication)]/10 text-path-publication">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-h2 text-ink m-0">
              {isAr ? 'محرك التقارير والتصدير الأكاديمي المؤسسي' : 'Institutional Academic Export & Reporting Engine'}
            </h2>
            <p className="text-caption text-secondary m-0 mt-1">
              {isAr
                ? 'تصدير وثائق وتقارير أكاديمية محكمة بصيغ (PDF, DOCX, JSON) مع الحفاظ على النزاهة الرقمية والخصوصية وعزل المؤسسات'
                : 'Generate verified academic reports in PDF, DOCX, and JSON with digital integrity, role-based redaction, and multi-tenant isolation'}
            </p>
          </div>
        </div>
      </PathPanel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Export Configuration */}
        <Card className="p-6 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl space-y-5 lg:col-span-2">
          <h3 className="text-h3 text-[var(--ds-text-primary)] m-0 pb-3 border-b border-[var(--ds-border-subtle)] flex items-center justify-between">
            <span>{isAr ? 'إعدادات وثيقة التقرير' : 'Report Document Configuration'}</span>
            <span className="text-caption px-2 py-0.5 rounded-full bg-[var(--ds-surface-secondary)] text-secondary font-mono">
              Phase 05 Engine
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Report Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ds-text-secondary)]">
                {isAr ? 'نوع التقرير الأكاديمي' : 'Report Type'}
              </label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              >
                <option value="RESEARCH_PROJECT">{isAr ? 'مخطط البحث العلمي (Research Blueprint)' : 'Research Blueprint'}</option>
                <option value="LITERATURE_SYNTHESIS">{isAr ? 'توليف الأدبيات والتحليل البعدي (Meta-Analysis)' : 'Literature Synthesis & Meta-Analysis'}</option>
                <option value="PRISMA_FLOW">{isAr ? 'مخطط تدفق المراجعة المنهجية (PRISMA 2020)' : 'PRISMA 2020 Flow Diagram'}</option>
                <option value="PROMOTION_READINESS">{isAr ? 'تقرير الجاهزية للترقية الأكاديمية (Promotion Readiness)' : 'Promotion Readiness'}</option>
                <option value="PEER_REVIEW">{isAr ? 'ملف التحكيم العلمي ومراجعة الأقران (Peer Review)' : 'Peer Review Evaluation'}</option>
                <option value="ACADEMIC_PROFILE">{isAr ? 'السجل الأكاديمي الموحد (Academic Profile)' : 'Academic Profile'}</option>
              </select>
            </div>

            {/* Output Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ds-text-secondary)]">
                {isAr ? 'صيغة التصدير المستهدفة' : 'Output Format'}
              </label>
              <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2">
                {[
                  { id: 'PDF', label: 'PDF (Vector/RTL)' },
                  { id: 'DOCX', label: 'DOCX (Word)' },
                  { id: 'JSON', label: 'JSON (Canonical)' },
                ].map(fmt => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id as any)}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      format === fmt.id
                        ? 'bg-[var(--ds-primary-soft)] border-[var(--ds-primary)]/20 text-ink shadow-sm'
                        : 'bg-[var(--ds-surface-secondary)] border-[var(--ds-border-subtle)] text-[var(--ds-text-muted)] hover:border-[var(--ds-border-default)]'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ds-text-secondary)]">
                {isAr ? 'لغة المستند' : 'Document Language'}
              </label>
              <select
                value={reportLang}
                onChange={e => setReportLang(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              >
                <option value="ar">{isAr ? 'العربية (RTL كامل)' : 'Arabic (Full RTL)'}</option>
                <option value="en">{isAr ? 'الإنجليزية (LTR)' : 'English (LTR)'}</option>
                <option value="bilingual">{isAr ? 'ثنائي اللغة (Bilingual AR/EN)' : 'Bilingual (AR/EN)'}</option>
              </select>
            </div>

            {/* Audience / Redaction Scope */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ds-text-secondary)]">
                {isAr ? 'الجمهور المستهدف ومستوى الحجب' : 'Audience & Redaction Scope'}
              </label>
              <select
                value={audience}
                onChange={e => setAudience(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              >
                <option value="RESEARCHER">{isAr ? 'الباحث الرئيسي (Researcher Standard)' : 'Principal Researcher'}</option>
                <option value="AUTHOR">{isAr ? 'المؤلف (مع حجب هوية المحكمين والملاحظات السرية)' : 'Author (Double-Blind Redacted)'}</option>
                <option value="COMMITTEE">{isAr ? 'اللجنة الأكاديمية وهيئة التحرير (Full Committee Access)' : 'Academic / Editorial Committee'}</option>
                <option value="SUPERVISOR">{isAr ? 'المشرف الأكاديمي (Supervisor View)' : 'Supervisor View'}</option>
                <option value="ADMIN">{isAr ? 'مدير المؤسسة الأكاديمية (Institutional Admin)' : 'Institutional Admin'}</option>
              </select>
            </div>
          </div>

          {/* Project Details Snapshot */}
          <div className="p-4 rounded-2xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-xs space-y-1.5">
            <div className="font-bold text-[var(--ds-text-primary)]">
              {isAr ? 'المصدر الأكاديمي المرتبط:' : 'Linked Academic Source:'}
            </div>
            <div className="text-[var(--ds-text-secondary)] truncate">
              {isAr ? activeProject.titleAr : activeProject.titleEn}
            </div>
            <div className="text-caption text-[var(--ds-text-muted)] flex gap-4 pt-1">
              <span>ID: <code className="font-mono">{activeProject.id}</code></span>
              <span>Design: {activeProject.studyDesign}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={handleExport}
              disabled={isGenerating}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-action hover:bg-action-hover text-on-action font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ds-transition"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="motion-safe:animate-spin" />
                  <span>{isAr ? 'جارٍ توليد الوثيقة وحساب النزاهة...' : 'Generating & Computing Hash...'}</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>{isAr ? `تصدير المستند بصيغة ${format}` : `Export Document as ${format}`}</span>
                </>
              )}
            </button>

            {lastGenerated && (
              <div className="flex items-center gap-2 text-success text-xs font-semibold">
                <CheckCircle2 size={16} />
                <span>{isAr ? 'تم تنزيل المستند بنجاح' : 'Document exported successfully'}</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {lastGenerated?.integrityHash && (
            <div className="p-3 rounded-xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-caption text-ink font-mono flex items-center gap-2 break-all">
              <ShieldCheck size={14} className="shrink-0 text-secondary" />
              <span>SHA-256 Integrity: {lastGenerated.integrityHash}</span>
            </div>
          )}
        </Card>

        {/* Right Panel: Academic Verification & Document Integrity */}
        <Card className="p-6 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--ds-border-subtle)]">
            <ShieldCheck size={18} className="text-path-publication" />
            <h3 className="text-h3 text-[var(--ds-text-primary)] m-0">
              {isAr ? 'التحقق من نزاهة الوثائق' : 'Document Verification'}
            </h3>
          </div>

          <p className="text-caption text-[var(--ds-text-secondary)]">
            {isAr
              ? 'تتيح هذه الأداة التحقق من صحة ومطابقة أي وثيقة أكاديمية صادرة عبر رمز التحقق المشفر المرفق بالتقرير.'
              : 'Verify the authenticity and integrity of any issued academic document using its verification code.'}
          </p>

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--ds-text-secondary)] block mb-1">
                {isAr ? 'رمز التحقق (Verification Code)' : 'Verification Code'}
              </label>
              <input
                type="text"
                placeholder="e.g. BSR-A1B2-C3D4"
                value={verifCode}
                onChange={e => setVerifCode(e.target.value)}
                className="w-full text-xs font-mono p-2.5 rounded-xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || !verifCode.trim()}
              className="w-full py-2.5 rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] text-ink text-xs font-bold ds-transition cursor-pointer disabled:opacity-40"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 size={14} className="motion-safe:animate-spin" />
                  {isAr ? 'جارٍ التحقق...' : 'Verifying...'}
                </span>
              ) : (
                <span>{isAr ? 'فحص السجل الأكاديمي' : 'Verify Authenticity'}</span>
              )}
            </button>
          </form>

          {verifResult && (
            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              verifResult.valid
                ? 'bg-[var(--ds-success-soft)] border-success/20 text-success'
                : 'bg-danger/10 border-danger/20 text-danger'
            }`}>
              <div className="font-bold flex items-center gap-1.5">
                {verifResult.valid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{verifResult.message}</span>
              </div>
              {verifResult.valid && (
                <div className="space-y-1 text-[11px] opacity-90 pt-1 border-t border-success/20">
                  <div><strong>{isAr ? 'الجهة:' : 'Issuer:'}</strong> {verifResult.organization_name}</div>
                  <div><strong>{isAr ? 'نوع التقرير:' : 'Type:'}</strong> {verifResult.report_type}</div>
                  <div><strong>{isAr ? 'تاريخ الإصدار:' : 'Issued:'}</strong> {verifResult.generated_at?.slice(0, 10)}</div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
