export interface ThesisDefenseStep {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export const THESIS_DEFENSE_STEPS: ThesisDefenseStep[] = [
  {
    id: 'outcomePredictor',
    titleAr: 'التنبؤ بفرص النجاح والدعم',
    titleEn: 'Outcome & Support Predictor',
    descriptionAr: 'محاكاة رياضية لنسبة دعم الفروض ومستوى المخاطر المنهجية.',
    descriptionEn: 'Mathematical simulation of hypothesis support probability and methodological risk level.',
  },
  {
    id: 'reviewSim',
    titleAr: 'محاكاة النقد والمراجعة',
    titleEn: 'Critique & Review Simulation',
    descriptionAr: 'توقع انتقادات لجنة المناقشة وتحضير الدفاعات المناسبة.',
    descriptionEn: 'Anticipate defense committee critiques and prepare appropriate defenses.',
  },
  {
    id: 'export',
    titleAr: 'تصدير التقارير النهائية',
    titleEn: 'Final Reports Export',
    descriptionAr: 'توليد ملفات ومرفقات المناقشة النهائية.',
    descriptionEn: 'Generate final defense files and appendices.',
  }
];
