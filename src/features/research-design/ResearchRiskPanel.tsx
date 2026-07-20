import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ResearchProject } from '../../types/research';

interface ResearchRiskPanelProps {
  project: ResearchProject | null;
  language: 'ar' | 'en';
}

export const ResearchRiskPanel: React.FC<ResearchRiskPanelProps> = ({ project, language }) => {
  const isAr = language === 'ar';

  if (!project) return null;

  const risks: string[] = [];

  // Rules-based risks evaluation
  const variables = project.variables || [];
  const hypotheses = project.hypotheses || [];
  const questions = project.questions || [];

  if (variables.length < 2) {
    risks.push(isAr ? 'قلة عدد المتغيرات المسجلة قد تعيق النموذج المفهومي.' : 'Low variable count may compromise model structure.');
  }

  const hasIndependent = variables.some(v => v.type === 'independent');
  const hasDependent = variables.some(v => v.type === 'dependent');

  if (variables.length > 0 && (!hasIndependent || !hasDependent)) {
    risks.push(isAr ? 'يجب صياغة متغير مستقل ومتغير تابع واحد على الأقل.' : 'At least one independent and one dependent variable are required.');
  }

  if (questions.length > 0 && hypotheses.length === 0) {
    risks.push(isAr ? 'الدراسة التجريبية تتطلب عادةً صياغة فرضيات إحصائية مقابلة لأسئلة البحث.' : 'Quantitative studies typically require hypothesis formulations.');
  }

  // Check if study design has matching variables
  if (project.studyDesign === 'quasi_experimental_pre_post' && variables.length > 0) {
    const hasMedOrMod = variables.some(v => v.type === 'mediator' || v.type === 'moderator');
    if (hasMedOrMod && hypotheses.length === 0) {
      risks.push(isAr ? 'تم تحديد متغيرات وسيطة/معدلة دون تحديد مسارات الفرضيات المقابلة.' : 'Mediator/moderator variables detected without hypothesis paths.');
    }
  }

  return (
    <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
        <ShieldAlert size={16} />
        <span>{isAr ? 'فحص المخاطر والصدق المنهجي' : 'Risk & Validity Audit'}</span>
      </div>

      {risks.length > 0 ? (
        <div className="space-y-2">
          {risks.map((risk, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/25">
              <AlertTriangle className="shrink-0 mt-0.5" size={14} />
              <span>{risk}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20">
          <CheckCircle2 size={16} />
          <span>{isAr ? 'لا توجد مخاطر منهجية حرجة تم رصدها حالياً.' : 'No major methodological risks detected.'}</span>
        </div>
      )}
    </div>
  );
};
export default ResearchRiskPanel;
