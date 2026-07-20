export interface SeminarProposalStep {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export const SEMINAR_PROPOSAL_STEPS: SeminarProposalStep[] = [
  {
    id: 'analyzer',
    titleAr: 'تحليل جودة العنوان',
    titleEn: 'Title Quality Analysis',
    descriptionAr: 'تدقيق اصطفاف العنوان مع المنهجية والمتغيرات.',
    descriptionEn: 'Verify title alignment with methodology and variables.',
  },
  {
    id: 'consistency',
    titleAr: 'اختبار الاتساق المنهجي',
    titleEn: 'Methodological Consistency Check',
    descriptionAr: 'مطابقة الفروض والأسئلة مع المتغيرات المستقلة والتابعة.',
    descriptionEn: 'Match hypotheses and questions with independent and dependent variables.',
  },
  {
    id: 'modelBuilder',
    titleAr: 'بناء النموذج المفاهيمي',
    titleEn: 'Conceptual Model Builder',
    descriptionAr: 'رسم بياني يوضح العلاقات المباشرة والتفاعلية للمتغيرات.',
    descriptionEn: 'Visual diagram illustrating direct and interactive relationships between variables.',
  },
  {
    id: 'preReg',
    titleAr: 'التسجيل المسبق وتثبيت الخطة',
    titleEn: 'Pre-registration & Lock',
    descriptionAr: 'تجميد مسودة خطة البحث لتوليد ختم زمني وبصمة لا تتغير.',
    descriptionEn: 'Freeze the research plan draft to generate an immutable timestamp and hash.',
  }
];
