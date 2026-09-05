import React from 'react';
import { Card } from '../../../design-system/components/Card';
import { AlertTriangle } from 'lucide-react';
import type { useWorkspaceState } from '../useWorkspaceState';

type WorkspaceState = ReturnType<typeof useWorkspaceState>;

interface WorkspaceRiskPanelProps {
  engine: WorkspaceState;
}

export const WorkspaceRiskPanel: React.FC<WorkspaceRiskPanelProps> = ({ engine }) => {
  const { activeProject, language } = engine;

  if (!activeProject) return null;

  // Methodological warnings derived dynamically from project
  const warnings: string[] = [];
  if ((activeProject.variables?.length || 0) === 0) {
    warnings.push(
      language === 'ar' 
        ? 'تفتقر الدراسة لتعريف واضح للمتغير المستقل أو التابع في مصفوفة النموذج.' 
        : 'Study lacks independent or dependent variable parameters.'
    );
  }
  if ((activeProject.sampleSettings?.populationSize || 0) < 30) {
    warnings.push(
      language === 'ar' 
        ? 'حجم العينة صغير جداً (N < 30)، مما يعرض النتائج للتحيز الإحصائي.' 
        : 'Sample size too small (N < 30), risking low statistical power.'
    );
  }
  if (!activeProject.problemStatementAr) {
    warnings.push(
      language === 'ar' 
        ? 'لم يتم صياغة المشكلة البحثية أو تحديد الفجوة العلمية بدقة.' 
        : 'Research problem gap has not been formulated.'
    );
  }

  return (
    <Card className="p-5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl space-y-3 shadow-sm">
      <h5 className="text-xs font-black text-warning uppercase tracking-widest flex items-center gap-1.5 m-0">
        <AlertTriangle size={15} />
        <span>{language === 'ar' ? 'مؤشرات الأخطار والعيوب' : 'Methodology Risks'}</span>
      </h5>
      {warnings.length === 0 ? (
        <div className="text-caption text-muted font-bold">
          {language === 'ar' ? 'لا توجد تحذيرات منهجية حالياً. التصميم متسق ✓' : 'No methodological risks detected. Design aligned ✓'}
        </div>
      ) : (
        <div className="space-y-2">
          {warnings.map((warn, i) => (
            <div key={i} className="p-2.5 bg-warning/10 border border-warning/20 text-warning rounded-xl text-caption font-bold leading-relaxed">
              {warn}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
