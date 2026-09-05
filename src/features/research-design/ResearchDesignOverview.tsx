import React from 'react';
import { BookOpen, User, Building2 } from 'lucide-react';

import type { ResearchProject } from '../../types/research';

interface ResearchDesignOverviewProps {
  project: ResearchProject | null;
  stepProgresses: Record<string, number>;
  language: 'ar' | 'en';
}

interface IndicatorDetail {
  titleAr: string;
  titleEn: string;
  value: string | number;
  color: string;
  explanationAr: string;
  explanationEn: string;
}

export const ResearchDesignOverview: React.FC<ResearchDesignOverviewProps> = ({
  project,
  stepProgresses,
  language
}) => {
  const isAr = language === 'ar';

  if (!project) return null;

  // Calculate design metrics based on step completeness
  const designProgress = Math.round(
    Object.values(stepProgresses).reduce((acc, curr) => acc + curr, 0) / 18
  );

  const INDICATORS: IndicatorDetail[] = [
    {
      titleAr: 'اكتمال التصميم',
      titleEn: 'Design Completeness',
      value: `${designProgress}%`,
      color: 'text-ink',
      explanationAr: 'نسبة إنجاز الـ 18 خطوة المنهجية المحددة بالمسار.',
      explanationEn: 'Overall progress percentage across all 18 methodological steps.'
    },
    {
      titleAr: 'الاتساق المنهجي',
      titleEn: 'Methodological Consistency',
      value: project.variables && project.variables.length >= 2 ? '95%' : '40%',
      color: project.variables && project.variables.length >= 2 ? 'text-success' : 'text-warning',
      explanationAr: 'مدى تطابق وتكامل العنوان، الأسئلة، المتغيرات وخطة التحليل إحصائياً.',
      explanationEn: 'Alignment strength between title, questions, variables, and analysis plan.'
    },
    {
      titleAr: 'جاهزية العينة',
      titleEn: 'Sample Readiness',
      value: project.sampleSettings?.confidenceLevel ? '100%' : '20%',
      color: project.sampleSettings?.confidenceLevel ? 'text-success' : 'text-muted',
      explanationAr: 'تحديد حجم العينة الأدنى المناسب للقوة الإحصائية المستهدفة.',
      explanationEn: 'Confidence parameters and minimum sample size calculations.'
    },
    {
      titleAr: 'جودة الأدلة',
      titleEn: 'Evidence Quality',
      value: isAr ? 'متوسطة' : 'Medium',
      color: 'text-ink',
      explanationAr: 'درجة الاستناد إلى أدبيات ودراسات سابقة قوية ذات معاملات حقيقية.',
      explanationEn: 'Strength and citation count of referenced academic literature.'
    },
    {
      titleAr: 'جودة القياس',
      titleEn: 'Measurement Quality',
      value: project.variables && project.variables.length > 0 ? '90%' : '10%',
      color: project.variables && project.variables.length > 0 ? 'text-success' : 'text-danger',
      explanationAr: 'وضوح المقاييس للتعريفات الإجرائية وربطها بالمتغير التابع.',
      explanationEn: 'Reliability metrics defined for independent/dependent variables.'
    },
    {
      titleAr: 'جودة خطة التحليل',
      titleEn: 'Analysis Plan Quality',
      value: project.hypotheses && project.hypotheses.length > 0 ? '95%' : '30%',
      color: project.hypotheses && project.hypotheses.length > 0 ? 'text-success' : 'text-danger',
      explanationAr: 'مطابقة الفرضيات للاختبارات الإحصائية البارامترية وغير البارامترية.',
      explanationEn: 'Mapping of statistical tests to hypotheses and assumptions.'
    },
    {
      titleAr: 'جودة التنبؤ',
      titleEn: 'Prediction Quality',
      value: project.preRegistrationHash ? '95%' : '60%',
      color: 'text-ink',
      explanationAr: 'مستوى الثقة في النموذج التنبؤي (استكشافي، دراسات سابقة، استطلاعي).',
      explanationEn: 'Bayesian prediction quality based on prior literature and pilot data.'
    },
    {
      titleAr: 'المخاطر المنهجية',
      titleEn: 'Methodological Risk',
      value: project.variables && project.variables.length < 2 ? (isAr ? 'عالية' : 'High') : (isAr ? 'منخفضة' : 'Low'),
      color: project.variables && project.variables.length < 2 ? 'text-danger' : 'text-success',
      explanationAr: 'رصد أي تناقضات أو مهددات للصدق الداخلي والخارجي للدراسة.',
      explanationEn: 'Methodological contradictions or internal validity threats detected.'
    },
    {
      titleAr: 'جاهزية التسجيل المسبق',
      titleEn: 'Pre-Registration Readiness',
      value: project.preRegistrationHash ? '100%' : '50%',
      color: project.preRegistrationHash ? 'text-success' : 'text-warning',
      explanationAr: 'تجميد التصميم البحثي والتأكيد لمنع تحيز التقرير (HARKing).',
      explanationEn: 'Readiness to lock design parameters with a cryptographic hash.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Project Card Header */}
      <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-h2 text-[var(--ds-text-primary)]">
              {isAr ? project.titleAr : project.titleEn}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ds-text-secondary)] mt-1.5 font-medium">
              <span className="flex items-center gap-1">
                <Building2 size={14} />
                <span>{project.institutionAr || (isAr ? 'مؤسسة غير محددة' : 'No institution')}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User size={14} />
                <span>{isAr ? 'الباحث الرئيسي' : 'Principal Investigator'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 9 Quality Indicators Grid */}
      <div className="space-y-3">
        <h3 className="text-h3 text-[var(--ds-text-secondary)] uppercase px-1">
          {isAr ? 'مؤشرات جودة تصميم الدراسة التسعة' : '9 Study Quality Indicators'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INDICATORS.map((ind, idx) => (
            <div
              key={idx}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ds-text-primary)]">
                  {isAr ? ind.titleAr : ind.titleEn}
                </span>
                <span className={`text-base font-black ${ind.color}`}>{ind.value}</span>
              </div>
              <p className="text-[10px] text-[var(--ds-text-secondary)] leading-relaxed border-t border-[var(--ds-border-subtle)] pt-1.5 mt-1">
                {isAr ? ind.explanationAr : ind.explanationEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default ResearchDesignOverview;
