import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { apiInspectData } from '../utils/api';
import { Button } from '../design-system/components/Button';

export const DataInspector: React.FC = () => {
  const { activeProject, language } = useProject();

  const [analyzed, setAnalyzed] = useState(false);
  const [qualityScore, setQualityScore] = useState(100);
  const [issues, setIssues] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSampleFile = selectedFile?.name.includes('_sample_data_with_validation_issues.csv') ?? false;
  const qualityTone = qualityScore > 80
    ? 'var(--ds-success)'
    : qualityScore >= 60
      ? 'var(--ds-warning)'
      : 'var(--ds-danger)';
  const qualityLabel = qualityScore > 80
    ? (language === 'ar' ? 'جاهز مبدئياً للتحليل' : 'Provisionally ready for analysis')
    : qualityScore >= 60
      ? (language === 'ar' ? 'يحتاج مراجعة قبل التحليل' : 'Review before analysis')
      : (language === 'ar' ? 'غير جاهز للتحليل' : 'Not ready for analysis');

  useEffect(() => {
    setAnalyzed(false);
    setQualityScore(100);
    setIssues([]);
    setSelectedFile(null);
    setError(null);
  }, [activeProject?.id]);

  if (!activeProject) {
    return (
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-8 shadow-sm text-center">
        <p className="text-[var(--ds-text-secondary)] text-sm">{language === 'ar' ? 'الرجاء تحديد مشروع نشط أولاً.' : 'Please select an active project first.'}</p>
      </div>
    );
  }

  const handleDownloadSampleCSV = () => {
    const csvContent = 
      "StudentId,Group,PreTest,PostTest,Motivation,Engagement,Retained\n" +
      "TR-1,treatment,58.0,78.2,4.5,0.88,true\n" +
      "TR-2,treatment,62.0,85.0,,0.90,true\n" + // Missing Motivation value
      "TR-3,treatment,44.5,105.0,3.8,0.75,true\n" + // Outlier PostTest 105
      "TR-4,treatment,51.0,71.5,4.0,0.82,true\n" +
      "CON-1,control,56.2,58.0,3.2,0.20,true\n" +
      "CON-2,control,60.0,61.5,3.5,0.24,true\n" +
      "CON-3,control,48.0,49.2,3.0,0.15,true\n" +
      "CON-4,control,52.5,53.0,3.1,0.18,true\n";
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeProject.titleEn.substring(0, 10)}_sample_data_with_validation_issues.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInspectUploadedData = async () => {
    setError(null);
    if (!selectedFile) {
      setAnalyzed(false);
      setIssues([]);
      setError(language === 'ar'
        ? 'اختر ملف بيانات قبل بدء الفحص.'
        : 'Select a data file before starting the inspection.');
      return;
    }

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const acceptedExtensions = ['csv', 'xlsx', 'xls'];
    const maxFileSize = 10 * 1024 * 1024;
    if (!extension || !acceptedExtensions.includes(extension)) {
      setAnalyzed(false);
      setIssues([]);
      setError(language === 'ar'
        ? 'صيغة الملف غير مدعومة. ارفع ملف CSV أو XLSX أو XLS.'
        : 'Unsupported file format. Upload a CSV, XLSX, or XLS file.');
      return;
    }
    if (selectedFile.size === 0 || selectedFile.size > maxFileSize) {
      setAnalyzed(false);
      setIssues([]);
      setError(language === 'ar'
        ? 'حجم الملف غير صالح. يجب أن يكون أكبر من صفر وألا يتجاوز 10 ميجابايت.'
        : 'Invalid file size. The file must be non-empty and no larger than 10 MB.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiInspectData(selectedFile, language);
      const safeScore = res && Number.isFinite(res.qualityScore)
        ? Math.max(0, Math.min(100, res.qualityScore))
        : null;
      const safeIssues = res && Array.isArray(res.issues)
        ? res.issues.filter((issue): issue is string => typeof issue === 'string' && issue.trim().length > 0)
        : null;

      if (safeScore !== null && safeIssues !== null) {
        setQualityScore(safeScore);
        setIssues(safeIssues);
        setAnalyzed(true);
      } else {
        setAnalyzed(false);
        setIssues([]);
        setError(language === 'ar'
          ? 'تعذر فحص الملف حالياً. تحقق من اتصال الخادم ثم أعد المحاولة.'
          : 'The file could not be inspected. Check the server connection and try again.');
      }
    } catch {
      setAnalyzed(false);
      setIssues([]);
      setError(language === 'ar'
        ? 'حدث خطأ أثناء فحص الملف. أعد المحاولة.'
        : 'An error occurred while inspecting the file. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Upload zone mockup */}
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-6 shadow-sm space-y-4 text-center">
        <Database size={40} className="text-[var(--ds-primary)] mx-auto" />
        <div>
          <h3 className="text-md font-bold text-[var(--ds-text-primary)] m-0">
            {language === 'ar' ? 'مدقق وفاحص جودة البيانات الميدانية' : 'Field Data Quality Inspector'}
          </h3>
          <p className="text-xs text-[var(--ds-text-secondary)] mt-1 max-w-lg mx-auto">
            {language === 'ar'
              ? 'ارفع ملف درجات الطلاب أو الاستبانة (CSV/XLSX) لفحص القيم المفقودة، المتطرفة، وسلامة الفروض الإحصائية قبل البدء في التحليل الفعلي.'
              : 'Upload student scores or survey files (CSV/XLSX) to inspect for missing data, outliers, and test assumptions.'}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setSelectedFile(file);
              setAnalyzed(false);
              setIssues([]);
              setError(null);
            }}
            className="text-xs text-[var(--ds-text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--ds-primary-soft)] file:text-[var(--ds-primary)] hover:file:opacity-90 cursor-pointer"
          />

          <div className="flex justify-center gap-3 mt-2">
            <Button
              onClick={handleDownloadSampleCSV}
              variant="outline"
              size="sm"
            >
              {language === 'ar' ? 'تحميل ملف بيانات تجريبي' : 'Download Sample CSV'}
            </Button>
            
            <Button
              onClick={handleInspectUploadedData}
              disabled={loading}
              loading={loading}
              variant="primary"
              size="sm"
            >
              {language === 'ar' ? 'فحص ومعاينة ملف البيانات المرفوع' : 'Inspect Uploaded Data File'}
            </Button>
          </div>
        </div>

        {selectedFile && (
          <p className="text-xs text-[var(--ds-text-secondary)] m-0" data-testid="selected-data-file">
            {language === 'ar' ? 'الملف المحدد:' : 'Selected file:'} {selectedFile.name}
          </p>
        )}
        {error && (
          <div role="alert" className="text-xs font-semibold text-danger bg-danger/10 border border-danger rounded-md p-3 text-start">
            {error}
          </div>
        )}
      </div>

      {/* Analysis Output */}
      {analyzed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quality Rating */}
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4 flex flex-col items-center justify-center">
            <h4 className="text-xs font-bold text-[var(--ds-text-muted)] uppercase tracking-wider block text-center">
              {language === 'ar' ? 'مؤشر جودة البيانات الفعلي' : 'Actual Data Quality Score'}
            </h4>
            <div className="w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center" style={{ borderColor: `${qualityTone}33` }}>
              <span className="text-2xl font-black" style={{ color: qualityTone }}>
                {qualityScore}
              </span>
              <span className="text-[8px] text-[var(--ds-text-muted)] font-bold uppercase tracking-wider">/ 100</span>
            </div>
            <span className="text-xs text-[var(--ds-text-muted)] font-bold text-center">
              {isSampleFile
                ? '[ التصنيف: SAMPLE_DATA ]'
                : (language === 'ar' ? '[ التصنيف: ملف مرفوع ]' : '[ Classification: uploaded file ]')}
            </span>
            <span className="text-xs font-bold text-center" style={{ color: qualityTone }} data-testid="quality-readiness">
              {isSampleFile
                ? (language === 'ar' ? 'نتيجة فحص للملف التجريبي' : 'Sample file inspection result')
                : qualityLabel}
            </span>
            <p className="text-[10px] text-[var(--ds-text-muted)] text-center m-0 leading-relaxed">
              {language === 'ar'
                ? 'مؤشر أولي يعتمد على الفحوص المنفذة، ولا يغني عن المراجعة المنهجية.'
                : 'An initial indicator based on completed checks; it does not replace methodological review.'}
            </p>
          </div>

          {/* Detailed Checks */}
          <div className="lg:col-span-2 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
              {language === 'ar' ? 'تقرير الفحص المنهجي للبيانات' : 'Data Integrity Audit Report'}
            </h4>

            <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
              {issues.map((iss, i) => (
                <div key={i} className="flex gap-2.5 items-start p-3 rounded-lg bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-xs">
                  {/(confirmed|success|successful|confirmed|تأكيد|نجاح|سليم)/i.test(iss) ? (
                    <CheckCircle2 size={16} className="text-[var(--ds-success)] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                  )}
                  <p className="text-[var(--ds-text-secondary)] m-0 leading-relaxed font-semibold">
                    {iss}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
