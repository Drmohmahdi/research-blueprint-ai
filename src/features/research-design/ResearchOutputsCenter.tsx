import React, { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import type { ResearchProject } from '../../types/research';


interface ResearchOutputsCenterProps {
  project: ResearchProject | null;
  language: 'ar' | 'en';
}

interface ReportMetadata {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

const REPORT_TYPES: ReportMetadata[] = [
  { id: 'idea_brief', nameAr: 'ملخص الفكرة البحثية', nameEn: 'Research Idea Brief', descriptionAr: 'المجال العام، المشكلة وسياق الدراسة الأولي.', descriptionEn: 'Core research domain, context, and initial idea statement.' },
  { id: 'title_analysis', nameAr: 'تقرير تحليل وتفكيك العنوان', nameEn: 'Title Analysis Report', descriptionAr: 'مؤشرات جودة العنوان والمتغيرات المستخرجة.', descriptionEn: 'Proposed title quality, structure, and variable parsing.' },
  { id: 'problem_gap', nameAr: 'صياغة المشكلة والفجوة المعرفية', nameEn: 'Problem & Research Gap Report', descriptionAr: 'الفجوة العلمية ومبررات الدراسة والأدلة.', descriptionEn: 'Detailed problem statement and literature gap rationale.' },
  { id: 'objectives_matrix', nameAr: 'مصفوفة الأهداف الإجرائية', nameEn: 'Objectives Matrix', descriptionAr: 'الأهداف العامة والخاصة للدراسة وصياغتها.', descriptionEn: 'Structured general and specific operational objectives.' },
  { id: 'questions_hypotheses', nameAr: 'مصفوفة الأسئلة والفرضيات', nameEn: 'Questions & Hypotheses Matrix', descriptionAr: 'مقارنة الأسئلة بالفرضيات وطبيعتها الإحصائية.', descriptionEn: 'Comprehensive list of research questions mapped to hypotheses.' },
  { id: 'variables_matrix', nameAr: 'جدول المتغيرات ومستويات القياس', nameEn: 'Variables & Measurement Matrix', descriptionAr: 'تصنيف المتغيرات وقيمها وتعريفها الإجرائي.', descriptionEn: 'Classification of variables, scales, and definitions.' },
  { id: 'conceptual_model', nameAr: 'هيكل النموذج المفاهيمي والعلاقات', nameEn: 'Conceptual Model & Relationships', descriptionAr: 'شبكة العلاقات المفترضة ومسارات الربط.', descriptionEn: 'Visual / tabular paths of hypothesized variables.' },
  { id: 'methodology_report', nameAr: 'منهج وتصميم الدراسة العلمي', nameEn: 'Methodology & Design Report', descriptionAr: 'تصميم التجربة والتحكم في مهددات الصدق.', descriptionEn: 'Selected research methodology and internal validity control.' },
  { id: 'sample_size', nameAr: 'حساب حجم العينة والقوة الإحصائية', nameEn: 'Sample Size & Power Report', descriptionAr: 'العينة الدنيا وهوامش الخطأ وحجم الأثر.', descriptionEn: 'Computed sample minimums and effect sizes.' },
  { id: 'measurement_plan', nameAr: 'خطة أدوات القياس والاختبارات', nameEn: 'Measurement Plan', descriptionAr: 'خطة التحقق من صدق وثبات المقاييس.', descriptionEn: 'Selected instruments and verification criteria.' },
  { id: 'analysis_plan', nameAr: 'خطة التحليل الإحصائي المقترحة', nameEn: 'Statistical Analysis Plan (SAP)', descriptionAr: 'توزيع الاختبارات الإحصائية على الفروض.', descriptionEn: 'Mapped statistical tests, error controls, and assumptions.' },
  { id: 'literature_evidence', nameAr: 'ملخص الأدلة وحجم أثر الأدبيات', nameEn: 'Literature Evidence Summary', descriptionAr: 'الدراسات المرجعية وتقديرات حجم الأثر.', descriptionEn: 'Prior literature summaries and pooled effects.' },
  { id: 'simulation_report', nameAr: 'محاكاة البيانات الاصطناعية (Monte Carlo)', nameEn: 'Simulation Lab Report', descriptionAr: 'نتائج محاكاة الاستجابات الإحصائية تحت شروط العينة.', descriptionEn: 'Simulated statistical behaviors and power curve reports.' },
  { id: 'prediction_report', nameAr: 'تقرير التنبؤ العلمي والتوقع الإحصائي', nameEn: 'Scientific Prediction Report', descriptionAr: 'التنبؤ باحتمال دعم الفرضيات في الدراسة الحقيقية.', descriptionEn: 'Bayesian support forecasts and post-test values.' },
  { id: 'consistency_report', nameAr: 'تقرير الاتساق المنهجي والمنطقي', nameEn: 'Consistency Audit Report', descriptionAr: 'فحص الاتساق الداخلي والتعارضات بالمسار.', descriptionEn: 'System integrity audit and mismatch check results.' },
  { id: 'ethics_feasibility', nameAr: 'الأخلاقيات والجدوى الإجرائية والزمنية', nameEn: 'Ethics & Feasibility Report', descriptionAr: 'موافقة IRB، ميزانية الدراسة والمخاطر.', descriptionEn: 'IRB safety checklist, timeline Gantt, and risk mitigation.' },
  { id: 'prereg_draft', nameAr: 'مسودة التسجيل المسبق والهاش الرقمي', nameEn: 'Pre-Registration Draft', descriptionAr: 'الخطة المجمدة الموقعة رقمياً.', descriptionEn: 'Preregistration specifications with cryptographic checksum.' },
  { id: 'final_research_plan', nameAr: 'خطة البحث النهائية المتكاملة', nameEn: 'Final Research Plan (Blueprint)', descriptionAr: 'الوثيقة النهائية الشاملة الجاهزة للاعتماد.', descriptionEn: 'Consolidated final exportable research blueprint.' }
];

export const ResearchOutputsCenter: React.FC<ResearchOutputsCenterProps> = ({ project, language }) => {
  const isAr = language === 'ar';
  const [selectedReportId, setSelectedReportId] = useState<string>('final_research_plan');
  const [previewFormat, setPreviewFormat] = useState<'HTML' | 'MARKDOWN' | 'JSON'>('HTML');

  if (!project) return null;

  const activeReport = REPORT_TYPES.find(r => r.id === selectedReportId) || REPORT_TYPES[17];

  const generateReportContent = (_reportId: string, format: 'HTML' | 'MARKDOWN' | 'JSON') => {

    const data = {
      project_title: isAr ? project.titleAr : project.titleEn,
      institution: isAr ? project.institutionAr : project.institutionEn,
      department: isAr ? project.departmentAr : project.departmentEn,
      study_design: project.studyDesign,
      variables: project.variables || [],
      questions: project.questions || [],
      hypotheses: project.hypotheses || [],
      generated_at: new Date().toISOString(),
      watermark: 'SIMULATED_SYNTHETIC_DATA_WATERMARK'
    };

    if (format === 'JSON') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'MARKDOWN') {
      return `# ${activeReport.nameAr}
**المشروع:** ${data.project_title}
**المؤسسة:** ${data.institution}

## تفاصيل التقرير
- **المنهجية:** ${data.study_design}
- **المتغيرات:** ${data.variables.length} متغيرات موثقة
- **الأسئلة البحثية:** ${data.questions.length} أسئلة
- **الفرضيات:** ${data.hypotheses.length} فرضيات مفصلة
- **الهاش الرقمي لتجميد الخطة:** ${project.preRegistrationHash || 'لم يتم بعد'}

*تم توليد هذا التقرير عبر منصة بصيرة للذكاء الأكاديمي*`;
    }

    // HTML format
    return `<div style="font-family: system-ui, sans-serif; direction: ${isAr ? 'rtl' : 'ltr'}; padding: 16px; color: var(--ds-text-primary);">
      <h2 style="color: #8b5cf6; border-bottom: 2px solid var(--ds-border-subtle); padding-bottom: 8px;">${isAr ? activeReport.nameAr : activeReport.nameEn}</h2>
      <p><strong>${isAr ? 'المشروع الأكاديمي:' : 'Academic Project:'}</strong> ${data.project_title}</p>
      <p><strong>${isAr ? 'المؤسسة/القسم:' : 'Institution/Dept:'}</strong> ${data.institution} - ${data.department}</p>
      <hr style="border: 0; border-top: 1px solid var(--ds-border-subtle); margin: 16px 0;" />
      <h3>${isAr ? 'العناصر الهيكلية للدراسة:' : 'Study Structural Elements:'}</h3>
      <ul>
        <li>${isAr ? 'المنهج المعتمد:' : 'Selected Design:'} ${data.study_design}</li>
        <li>${isAr ? 'المتغيرات:' : 'Variables:'} ${data.variables.length} (${isAr ? 'مستقل، تابع، وسيط' : 'IV, DV, Mediator'})</li>
        <li>${isAr ? 'الأسئلة والفروض:' : 'Questions & Hypotheses:'} ${data.questions.length} / ${data.hypotheses.length}</li>
      </ul>
    </div>`;
  };

  return (
    <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--ds-primary)] font-bold text-xs">
          <FileText size={16} />
          <span>{isAr ? 'مركز المخرجات والتقارير النهائي' : 'Outputs & Reports Center'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reports List Selector */}
        <div className="space-y-1 max-h-80 overflow-y-auto pr-2 border-r border-[var(--ds-border-subtle)]">
          {REPORT_TYPES.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
              className={`w-full text-start p-2 rounded-lg text-xs font-semibold transition-all border border-transparent cursor-pointer ${
                selectedReportId === report.id
                  ? 'bg-[var(--ds-primary)] text-white shadow-sm'
                  : 'bg-transparent text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-primary)]'
              }`}
            >
              {isAr ? report.nameAr : report.nameEn}
            </button>
          ))}
        </div>

        {/* Report Preview & Formatting Panel */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--ds-border-subtle)] pb-2">
            <div>
              <h4 className="text-xs font-bold text-[var(--ds-text-primary)]">
                {isAr ? activeReport.nameAr : activeReport.nameEn}
              </h4>
              <p className="text-[10px] text-[var(--ds-text-secondary)] mt-0.5">
                {isAr ? activeReport.descriptionAr : reportDescriptionEn(activeReport)}
              </p>
            </div>
            {/* Format Toggles */}
            <div className="flex bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded p-0.5 text-[10px] font-bold">
              {['HTML', 'MARKDOWN', 'JSON'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setPreviewFormat(fmt as any)}
                  className={`px-2 py-1 rounded transition-all border-none cursor-pointer ${
                    previewFormat === fmt
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-[var(--ds-text-secondary)] bg-transparent'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Window */}
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] text-[var(--ds-text-secondary)]">
            {previewFormat === 'HTML' ? (
              <div dangerouslySetInnerHTML={{ __html: generateReportContent(selectedReportId, 'HTML') }} />
            ) : (
              <pre className="whitespace-pre-wrap">{generateReportContent(selectedReportId, previewFormat)}</pre>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 text-xs">
            <button
              onClick={() => {
                const text = generateReportContent(selectedReportId, previewFormat);
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedReportId}_report.${previewFormat.toLowerCase()}`;
                a.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] hover:bg-[var(--ds-surface-tertiary)] cursor-pointer"
            >
              <Download size={14} />
              <span>{isAr ? 'تحميل الملف' : 'Download File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function reportDescriptionEn(r: ReportMetadata) {
    return r.descriptionEn;
  }
};
export default ResearchOutputsCenter;
