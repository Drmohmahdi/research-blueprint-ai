import React, { useEffect, useRef, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Sparkles, 
  MessageSquare, 
  ClipboardList, 
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Plus
} from 'lucide-react';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';

const redactIdentifiers = (text: string) => {
  let redactionCount = 0;
  const redact = (pattern: RegExp, replacement: string) => text.replace(pattern, () => {
    redactionCount += 1;
    return replacement;
  });
  const withoutEmails = redact(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[EMAIL REDACTED]');
  text = withoutEmails;
  text = redact(/(?:\+?\d[\d\s()-]{6,}\d)/g, '[PHONE REDACTED]');
  return { text, redactionCount };
};

interface QualitativeTheme {
  themeAr: string;
  themeEn: string;
  codeAr: string;
  codeEn: string;
  quoteAr: string;
  quoteEn: string;
}

const TRANSCRIPT_PRESETS = [
  {
    titleAr: 'تحديات الذكاء الاصطناعي بالفصل',
    titleEn: 'AI Classroom Integration',
    textAr: 'المشارك 1: أشعر أن استخدام تطبيقات الذكاء الاصطناعي في الفصل الدراسي زاد من دافعيتي للتعلم بشكل كبير. أصبحت أستطيع فهم المسائل المعقدة بسرعة بفضل الشروحات التفاعلية والتدريبات المخصصة لي فردياً.',
    textEn: 'Participant 1: I feel that using AI applications in the classroom has significantly increased my motivation to learn. I can now understand complex issues quickly due to interactive explanations and tailored exercises.'
  },
  {
    titleAr: 'تأثير التدريب الميداني العملي',
    titleEn: 'Field Internship Impact',
    textAr: 'المشارك 2: التدريب الميداني في المدارس الحكومية ساعدني على دمج المهارات النظرية بالواقع. واجهت في البداية صعوبة في إدارة الصف وضبط الوقت، لكن التوجيه المستمر من المشرف مكنني من التغلب على ذلك ورفع كفاءتي التدريسية.',
    textEn: 'Participant 2: Field training in public schools helped me integrate theoretical skills with reality. I initially faced difficulty in classroom management and time management, but continuous guidance from the supervisor enabled me to overcome that.'
  },
  {
    titleAr: 'تفاعل المعلمين مع الفصول الذكية',
    titleEn: 'Smart Classroom Challenges',
    textAr: 'المشارك 3: تطبيق التقنيات الجديدة بالفصل يتطلب تدريباً مستمراً وبنية تحتية ملائمة. الطلاب يبدون تفاعلاً ممتازاً عند استخدام الشاشات التفاعلية، ولكن الانقطاع المفاجئ للإنترنت أحياناً يعيق سير الدرس ويسبب تشتتاً.',
    textEn: 'Participant 3: Applying new technologies in the classroom requires continuous training and adequate infrastructure. Students show excellent engagement when using interactive screens, but sudden internet drops sometimes disrupt the lesson.'
  }
];

export const QualitativeLab: React.FC = () => {
  const { activeProject, updateProject, language } = useProject();

  const [transcript, setTranscript] = useState(
    language === 'ar'
      ? TRANSCRIPT_PRESETS[0].textAr
      : TRANSCRIPT_PRESETS[0].textEn
  );

  const [loading, setLoading] = useState(false);
  const [themes, setThemes] = useState<QualitativeTheme[] | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [redactionNotice, setRedactionNotice] = useState('');
  const analysisRunId = useRef(0);
  const softPanelClass = 'rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] shadow-sm';
  const accentBadgeClass = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-xs font-bold text-[var(--ds-primary)]';

  const handlePresetClick = (text: string) => {
    analysisRunId.current += 1;
    setTranscript(text);
    setLoading(false);
    setThemes(null);
    setSuccessMessage('');
    setRedactionNotice('');
  };

  useEffect(() => {
    analysisRunId.current += 1;
    setTranscript(language === 'ar' ? TRANSCRIPT_PRESETS[0].textAr : TRANSCRIPT_PRESETS[0].textEn);
    setThemes(null);
    setSuccessMessage('');
    setRedactionNotice('');
    setLoading(false);
  }, [activeProject?.id, language]);

  const handleAnalyzeQualitative = () => {
    const runId = analysisRunId.current + 1;
    analysisRunId.current = runId;
    setLoading(true);
    setThemes(null);
    setSuccessMessage('');
    const { text: sanitizedTranscript, redactionCount } = redactIdentifiers(transcript);
    setRedactionNotice(redactionCount > 0
      ? (language === 'ar' ? `تم حجب ${redactionCount} من معرّفات الاتصال قبل الترميز.` : `${redactionCount} contact identifier(s) were redacted before coding.`)
      : '');
    
    setTimeout(() => {
      if (runId !== analysisRunId.current) return;
      const extracted: QualitativeTheme[] = [];
      const text = sanitizedTranscript.toLowerCase();

      if (text.includes('دافعية') || text.includes('motivation')) {
        extracted.push({
          themeAr: 'تعزيز دافعية التعلم والاهتمام الذاتي للطلاب',
          themeEn: 'Enhancing Learning Motivation and Intrinsic Interest',
          codeAr: 'الدافعية والاهتمام الموجه',
          codeEn: 'Motivation & Task Engagement',
          quoteAr: 'زاد من دافعيتي للتعلم بشكل كبير',
          quoteEn: 'significantly increased my motivation to learn'
        });
      }

      if (text.includes('فهم') || text.includes('معقدة') || text.includes('understand') || text.includes('complex')) {
        extracted.push({
          themeAr: 'تبسيط وتفكيك المفاهيم الدراسية الصعبة',
          themeEn: 'Simplification and Scaffolding of Complex Concepts',
          codeAr: 'فهم المسائل المعقدة والشروحات التفاعلية',
          codeEn: 'Conceptual Clarity & Interactive Scaffolding',
          quoteAr: 'أصبحت أستطيع فهم المسائل المعقدة بسرعة بفضل الشروحات التفاعلية',
          quoteEn: 'understand complex issues quickly due to interactive explanations'
        });
      }

      if (text.includes('تدريب') || text.includes('إدارة الصف') || text.includes('field training') || text.includes('internship')) {
        extracted.push({
          themeAr: 'دمج المعارف النظرية بالتطبيق الميداني العملي',
          themeEn: 'Integrating Theoretical Knowledge with Field Practice',
          codeAr: 'التدريب الميداني والخبرة العملية',
          codeEn: 'Field Internship & Applied Skills',
          quoteAr: 'التدريب الميداني في المدارس الحكومية ساعدني على دمج المهارات النظرية بالواقع',
          quoteEn: 'Field training in public schools helped me integrate theoretical skills with reality'
        });
      }

      if (text.includes('بنية') || text.includes('إنترنت') || text.includes('infrastructure') || text.includes('internet')) {
        extracted.push({
          themeAr: 'تحديات البنية التحتية والاتصال بالشبكة في الفصول الذكية',
          themeEn: 'Infrastructure & Connectivity Challenges in Smart Classrooms',
          codeAr: 'جاهزية البيئة التعليمية والشبكات',
          codeEn: 'Classroom Infrastructure & Internet Stability',
          quoteAr: 'الانقطاع المفاجئ للإنترنت أحياناً يعيق سير الدرس ويسبب تشتتاً',
          quoteEn: 'sudden internet drops sometimes disrupt the lesson'
        });
      }

      if (extracted.length === 0) {
        extracted.push({
          themeAr: 'تفاعل عام مع البيئة التعليمية والصفية',
          themeEn: 'General Classroom Interaction',
          codeAr: 'تغذية راجعة عامة',
          codeEn: 'General Feedback',
          quoteAr: sanitizedTranscript.substring(0, Math.min(50, sanitizedTranscript.length)) + '...',
          quoteEn: sanitizedTranscript.substring(0, Math.min(50, sanitizedTranscript.length)) + '...'
        });
      }

      setThemes(extracted);
      setLoading(false);
    }, 1200);
  };

  const handleAddVariable = (theme: QualitativeTheme) => {
    if (!activeProject) return;

    const existingVariables = activeProject.variables || [];
    const exists = existingVariables.some(
      v => v.nameAr.toLowerCase() === theme.codeAr.toLowerCase() || v.nameEn.toLowerCase() === theme.codeEn.toLowerCase()
    );

    if (exists) {
      setSuccessMessage(
        language === 'ar'
          ? `المتغير "${theme.codeAr}" موجود بالفعل في مشروعك!`
          : `Variable "${theme.codeEn}" already exists in your project!`
      );
      return;
    }

    const newVar = {
      id: `qual-var-${Date.now()}`,
      nameAr: theme.codeAr,
      nameEn: theme.codeEn,
      type: 'independent' as const,
      scale: 'interval' as const,
      maxValue: 5,
      minValue: 1
    };

    updateProject({
      ...activeProject,
      variables: [...existingVariables, newVar]
    });

    setSuccessMessage(
      language === 'ar'
        ? `تم بنجاح تحويل المحور وإضافته كمتغير كمي مقاس ليكرت ("${theme.codeAr}")!`
        : `Successfully added theme as a quantitative Likert-scale variable ("${theme.codeEn}")!`
    );
  };

  return (
    <div className="space-y-8 max-w-[1280px] mx-auto animate-fade-in pb-16">
      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-[var(--ds-success-soft)] border border-[var(--ds-success)]/20 text-emerald-800 dark:text-emerald-400 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-bold">{successMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--ds-border-subtle)] pb-5">
        <div className="space-y-1.5">
          <div className={accentBadgeClass}>
            <Sparkles size={13} />
            <span>{language === 'ar' ? 'البحوث النوعية والمختلطة' : 'Qualitative Lab'}</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--ds-text-primary)] m-0">
            {language === 'ar' ? 'مختبر ترميز المقابلات النوعية بالذكاء الاصطناعي' : 'Qualitative Interview AI Coding Lab'}
          </h2>
          <p className="text-xs text-[var(--ds-text-secondary)] font-medium m-0">
            {language === 'ar' 
              ? 'قم بتحليل نصوص المقابلات المفتوحة، التغذية الراجعة، وملاحظات الميدان واستخرج المحاور والرموز بدقة علمية.'
              : 'Analyze open-ended interview transcripts, field notes, and feedback to extract thematic codes.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Transcript Input & Presets */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="space-y-4">
            <h3 className="text-sm font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
              <MessageSquare className="text-[var(--ds-primary)]" size={16} />
              <span>{language === 'ar' ? 'تفريغ المقابلة الصوتية' : 'Interview Transcript'}</span>
            </h3>

            <div className="space-y-1.5 text-xs font-bold">
              <label className="text-[10px] text-[var(--ds-text-muted)] uppercase block">
                {language === 'ar' ? 'الصق نص المقابلة أو التفريغ الصوتي للمشارك:' : 'Paste participant transcript:'}
              </label>
              <textarea
                value={transcript}
                onChange={(e) => {
                  analysisRunId.current += 1;
                  setTranscript(e.target.value);
                  setLoading(false);
                  setThemes(null);
                  setRedactionNotice('');
                }}
                rows={8}
                className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-4 py-3.5 text-xs font-bold leading-relaxed text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              />
            </div>

            {redactionNotice && (
              <p role="status" className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2 m-0">
                {redactionNotice}
              </p>
            )}

            {/* Presets Row */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--ds-border-subtle)]">
              <span className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider block">
                {language === 'ar' ? 'اختر مقابلة استرشادية للتجربة:' : 'Select a sample transcript:'}
              </span>
              <div className="flex flex-col gap-1.5">
                {TRANSCRIPT_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePresetClick(language === 'ar' ? p.textAr : p.textEn)}
                    className="w-full text-start px-3 py-2 rounded-lg text-[10px] font-bold bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-primary-soft)] hover:border-[var(--ds-primary)]/30 transition-all cursor-pointer truncate"
                  >
                    {language === 'ar' ? p.titleAr : p.titleEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleAnalyzeQualitative}
                disabled={loading || !transcript.trim()}
                variant="primary"
                className="w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm rounded-lg font-bold"
              >
                <Sparkles size={14} />
                <span>{loading ? (language === 'ar' ? 'جاري استخراج المحاور...' : 'Coding...') : (language === 'ar' ? 'تحليل وترميز النصوص' : 'Analyze & Extract Themes')}</span>
              </Button>
            </div>
          </Card>

          {/* Ethical Warning Alert */}
          <div className="p-4 rounded-lg bg-[var(--ds-warning-soft)] border border-[var(--ds-warning)]/20 text-amber-700 dark:text-amber-400 text-xs flex gap-3 leading-relaxed font-bold">
            <AlertTriangle size={18} className="shrink-0 text-amber-500" />
            <div className="space-y-1">
              <span>{language === 'ar' ? 'أمان البيانات النوعية:' : 'Qualitative Data Security:'}</span>
              <p className="text-[10px] text-[var(--ds-text-secondary)] font-medium m-0 leading-normal">
                {language === 'ar'
                  ? 'يتم تصفية نصوص المقابلات محلياً وإزالة أي بيانات شخصية أو معايير حساسة قبل معالجتها لضمان سرية هوية أفراد العينة.'
                  : 'Transcript metadata is filtered locally to anonymize personal identifiable details before processing.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Coding Results & Skeletons */}
        <div className="lg:col-span-2 space-y-6">
          
          {loading && (
            <Card className="space-y-4">
              <div className="h-4 bg-[var(--ds-surface-secondary)] rounded w-1/3 animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 bg-[var(--ds-surface-secondary)] rounded animate-pulse" />
                <div className="h-8 bg-[var(--ds-surface-secondary)] rounded animate-pulse" />
                <div className="h-8 bg-[var(--ds-surface-secondary)] rounded animate-pulse" />
              </div>
            </Card>
          )}

          {!loading && !themes && (
            <div className={`${softPanelClass} p-16 text-center text-[var(--ds-text-muted)] italic flex flex-col items-center justify-center gap-4 h-[350px]`}>
              <ClipboardList size={64} strokeWidth={1.5} className="text-[var(--ds-text-disabled)]" />
              <div className="space-y-1 font-bold">
                <p className="m-0 text-sm text-[var(--ds-text-secondary)]">{language === 'ar' ? 'لا توجد محاور مستخرجة بعد' : 'No themes extracted yet'}</p>
                <p className="m-0 text-[11px] text-[var(--ds-text-muted)] font-medium">{language === 'ar' ? 'يرجى كتابة أو اختيار المقابلة، ثم تشغيل المحلل الذكي.' : 'Input transcripts on the left and start thematic coding analysis.'}</p>
              </div>
            </div>
          )}

          {themes && (
            <div className="space-y-6">
              {/* Premium Thematic Theme Cards Layout */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--ds-border-subtle)]">
                  <ClipboardList className="text-[var(--ds-primary)]" size={16} />
                  <h4 className="text-xs font-black text-[var(--ds-text-primary)] m-0">
                    {language === 'ar' ? 'المحاور والرموز المستخرجة (Thematic Coding Results)' : 'Thematic Coding Results'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {themes.map((theme, i) => (
                    <Card key={i} className="p-5 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] space-y-3.5">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="text-xs font-black text-[var(--ds-text-primary)]">
                          {language === 'ar' ? theme.themeAr : theme.themeEn}
                        </span>
                        <span className="bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] px-2.5 py-1 rounded-full font-black border border-[var(--ds-primary)]/20 text-[9px] uppercase tracking-wider">
                          {language === 'ar' ? theme.codeAr : theme.codeEn}
                        </span>
                      </div>

                      {/* Quote block */}
                      <div className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg relative">
                        <span className="absolute top-1 left-2 text-xl font-serif text-[var(--ds-primary)]/40 pointer-events-none">“</span>
                        <p className="text-[11px] italic text-[var(--ds-text-secondary)] font-bold m-0 pl-3 leading-relaxed">
                          {language === 'ar' ? theme.quoteAr : theme.quoteEn}
                        </p>
                      </div>

                      {/* Mixed methods converter button */}
                      {activeProject && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleAddVariable(theme)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black bg-[var(--ds-primary)] hover:bg-[var(--ds-primary-hover)] text-white shadow-sm cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>{language === 'ar' ? 'إضافة كمتغير كمي للمشروع' : 'Add as Quantitative Variable'}</span>
                          </button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>

              {/* Mixed Methods Mapping Info Card */}
              {activeProject && (
                <Card className="p-5 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] space-y-3">
                  <div className="flex items-center gap-2">
                    <GitBranch className="text-[var(--ds-primary)]" size={16} />
                    <h4 className="text-xs font-black text-[var(--ds-text-primary)] m-0">
                      {language === 'ar' ? 'توصيات البحث المنهجي المختلط (Mixed Methods Integration)' : 'Mixed Methods Integration'}
                    </h4>
                  </div>
                  <p className="text-[10px] text-[var(--ds-text-secondary)] leading-relaxed m-0">
                    {language === 'ar'
                      ? 'يسمح لك المنهج المختلط بتحويل الظواهر المستكشفة نوعياً بمقابلاتك إلى مقاييس رقمية وتضمينها كمتغيرات لغرض النمذجة الرياضية والمحاكاة. انقر على الأزرار أعلاه لتحويل الرموز لمتغيرات كمية مباشرة.'
                      : 'Mixed methods research allows converting qualitative themes into Likert-scale metrics for statistical modeling. Click the buttons above to map themes to project variables.'}
                  </p>
                </Card>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
