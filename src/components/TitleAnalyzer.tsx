import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { apiAnalyzeTitle } from '../utils/api';
import type { ParsedTitle } from '../utils/ruleEngine';
import { getTranslation } from '../utils/translations';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { 
  Sparkles, 
  HelpCircle, 
  AlertTriangle, 
  Save, 
  CheckCircle2,
  Loader2
} from 'lucide-react';

const TITLE_PRESETS = [
  {
    ar: 'أثر استخدام الواقع المعزز في التحصيل الدراسي لدى طلاب المرحلة الابتدائية',
    en: 'The effect of using augmented reality on academic achievement among elementary school students',
    type: 'quasi_experimental_pre_post'
  },
  {
    ar: 'العلاقة بين الذكاء الانفعالي والرضا الوظيفي لدى معلمي التربية الخاصة',
    en: 'The relationship between emotional intelligence and job satisfaction among special education teachers',
    type: 'correlational'
  },
  {
    ar: 'واقع دمج أدوات الذكاء الاصطناعي في التدريس من وجهة نظر أعضاء هيئة التدريس',
    en: 'The reality of integrating AI tools in teaching from the perspective of faculty members',
    type: 'descriptive'
  }
];

export const TitleAnalyzer: React.FC = () => {
  const { activeProject, updateProject, language } = useProject();
  
  const [titleInput, setTitleInput] = useState(() => {
    if (activeProject) return language === 'ar' ? activeProject.titleAr : activeProject.titleEn;
    return '';
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedTitle | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Re-sync the input (and clear any stale analysis result) whenever the user
  // switches the active project, so analyzing/merging never mixes data across projects.
  useEffect(() => {
    if (activeProject) {
      setTitleInput(language === 'ar' ? activeProject.titleAr : activeProject.titleEn);
    } else {
      setTitleInput('');
    }
    setResult(null);
    setSuccessMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  const handleAnalyze = async () => {
    if (!titleInput.trim()) return;
    setLoading(true);
    setSuccessMessage('');
    try {
      const parsed = await apiAnalyzeTitle(titleInput);
      setResult(parsed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = async (presetTitle: string) => {
    setTitleInput(presetTitle);
    setLoading(true);
    setSuccessMessage('');
    try {
      const parsed = await apiAnalyzeTitle(presetTitle);
      setResult(parsed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToProject = () => {
    if (!activeProject || !result) return;

    const existingVariables = activeProject.variables || [];
    const newVars: typeof activeProject.variables = [];

    // Process independent variables
    result.independentVariables.forEach((v, i) => {
      const exists = existingVariables.some(
        ev => ev.nameAr.toLowerCase() === v.toLowerCase() || ev.nameEn.toLowerCase() === v.toLowerCase()
      );
      if (!exists) {
        newVars.push({
          id: `iv-${i}-${Date.now()}`,
          nameAr: v,
          nameEn: v,
          type: 'independent' as const,
          scale: 'nominal' as const
        });
      }
    });

    // Process dependent variables
    result.dependentVariables.forEach((v, i) => {
      const exists = existingVariables.some(
        ev => ev.nameAr.toLowerCase() === v.toLowerCase() || ev.nameEn.toLowerCase() === v.toLowerCase()
      );
      if (!exists) {
        newVars.push({
          id: `dv-${i}-${Date.now()}`,
          nameAr: v,
          nameEn: v,
          type: 'dependent' as const,
          scale: 'interval' as const,
          maxValue: 100,
          minValue: 0
        });
      }
    });

    const mergedVariables = [...existingVariables, ...newVars];

    updateProject({
      ...activeProject,
      titleAr: language === 'ar' ? titleInput : activeProject.titleAr,
      titleEn: language === 'en' ? titleInput : activeProject.titleEn,
      studyDesign: result.suggestedMethodology,
      variables: mergedVariables
    });

    setSuccessMessage(
      language === 'ar'
        ? `تم دمج ${newVars.length} متغيرات جديدة بنجاح وتحديث المنهج الدراسي!`
        : `Successfully merged ${newVars.length} new variables and updated the study design!`
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-[var(--ds-success-soft)] border border-success/20 text-success rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-success shrink-0" />
          <span className="text-xs font-bold">{successMessage}</span>
        </div>
      )}

      {/* Title Input Card */}
      <PathPanel accent="var(--ds-path-research)">
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ai/10 text-ai text-xs font-bold mb-1">
            <Sparkles size={12} />
            <span>{language === 'ar' ? 'أداة الاستكشاف المنهجي' : 'Methodological Analyzer'}</span>
          </div>
          <h3 className="text-lg font-black text-[var(--ds-text-primary)] m-0">
            {language === 'ar' ? 'محلل عنوان البحث العلمي الذكي' : 'Smart Title Analyzer'}
          </h3>
          <p className="text-xs text-[var(--ds-text-secondary)] m-0 leading-relaxed">
            {language === 'ar'
              ? 'أدخل عنوان بحثك المقترح ليقوم محلل بصيرة الذكي بتفكيكه واستخراج المنهج العلمي الملائم والمتغيرات المستقلة والتابعة.'
              : 'Enter your research title and let Baseerah parse the scientific methodology and variables.'}
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder={language === 'ar' ? 'مثال: أثر استخدام الواقع المعزز في التحصيل الدراسي لدى طلاب المرحلة الابتدائية' : 'e.g. The effect of augmented reality on achievement...'}
              className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-4 py-3 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-ink font-bold"
            />
            <Button
              onClick={handleAnalyze}
              disabled={loading || !titleInput.trim()}
              variant="primary"
              className="flex items-center justify-center gap-1.5 px-6 py-3 font-bold rounded-lg shrink-0 cursor-pointer text-xs"
            >
              {loading ? <Loader2 size={14} className="motion-safe:animate-spin" /> : <Sparkles size={14} />}
              <span>{loading ? getTranslation(language, 'analyzing') : getTranslation(language, 'analyzeBtn')}</span>
            </Button>
          </div>

          {/* Interactive Title Presets */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--ds-border-subtle)]">
            <span className="text-[10px] text-[var(--ds-text-muted)] font-black uppercase tracking-wider block">
              {language === 'ar' ? 'أمثلة وعناوين استرشادية جاهزة للتجربة:' : 'Sample Title Presets to Try:'}
            </span>
            <div className="flex flex-wrap gap-2">
              {TITLE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePresetClick(language === 'ar' ? preset.ar : preset.en)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-primary-soft)] hover:border-[var(--ds-primary)]/30 transition-all cursor-pointer text-right max-w-full truncate"
                >
                  {language === 'ar' ? preset.ar : preset.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      </PathPanel>

      {/* Analysis Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main variables breakdown */}
          <div className="lg:col-span-2 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-6 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-[var(--ds-border-subtle)] pb-3">
              <h4 className="text-sm font-black text-[var(--ds-text-primary)] m-0">
                {getTranslation(language, 'analysisResult')}
              </h4>
              <span className="text-xs text-ink font-black ds-numeric" dir="ltr">
                {getTranslation(language, 'confidenceScore')}: {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {result.isFallback && (
              <div className="p-3 bg-warning/5 border border-warning/10 rounded-lg flex items-center gap-2 text-warning text-xs font-bold">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {language === 'ar' 
                    ? 'إشعار: تم استخدام محرك القواعد المحلي لعدم توفر اتصال بالذكاء الاصطناعي.' 
                    : 'Notice: Fallback rules engine was used as the AI API is currently unavailable.'}
                </span>
              </div>
            )}

            <div className="space-y-4">
              {/* Methodology */}
              <div className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-1.5">
                <span className="text-[10px] font-black text-path-research uppercase tracking-wider block">
                  {getTranslation(language, 'suggestedMethodology')}
                </span>
                <span className="text-xs font-black text-[var(--ds-text-primary)]">
                  {result.suggestedMethodology === 'quasi_experimental_pre_post' 
                    ? (language === 'ar' ? 'منهج شبه تجريبي (مجموعتين قياس قبلي بعدي)' : 'Quasi-Experimental (2 Groups Pre/Post)') 
                    : (language === 'ar' ? 'منهج وصفي ارتباطي' : 'Descriptive Correlational')}
                </span>
              </div>

              {/* Variables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-2">
                  <span className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider block">
                    {getTranslation(language, 'independentVar')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.independentVariables.map((v, i) => (
                      <span key={i} className="text-[10px] font-bold bg-[var(--ds-surface-primary)] text-ink border border-[var(--ds-border-subtle)] px-2 py-1 rounded-md">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-2">
                  <span className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider block">
                    {getTranslation(language, 'dependentVar')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.dependentVariables.map((v, i) => (
                      <span key={i} className="text-[10px] font-bold bg-[var(--ds-surface-primary)] text-success border border-success/20 px-2 py-1 rounded-md">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Population & Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-1">
                  <span className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider block">
                    {getTranslation(language, 'targetPopulation')}
                  </span>
                  <span className="text-xs font-bold text-[var(--ds-text-primary)] block">
                    {result.population}
                  </span>
                </div>

                <div className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg space-y-1">
                  <span className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider block">
                    {getTranslation(language, 'studyContext')}
                  </span>
                  <span className="text-xs font-bold text-[var(--ds-text-primary)] block">
                    {result.context}
                  </span>
                </div>
              </div>
            </div>

            {/* Apply button */}
            {activeProject && (
              <div className="pt-4 border-t border-[var(--ds-border-subtle)] flex justify-end">
                <Button
                  onClick={handleApplyToProject}
                  variant="primary"
                  className="flex items-center gap-1.5 px-4 py-2 font-bold cursor-pointer text-xs"
                >
                  <Save size={14} />
                  <span>{language === 'ar' ? 'دمج المتغيرات مع مشروعي' : 'Merge Variables with Project'}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Right sidebar details: Warnings, Ambiguities & Follow-ups */}
          <div className="space-y-6">
            {/* Ambiguities */}
            {result.ambiguities.length > 0 && (
              <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-warning flex items-center gap-1.5 m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
                  <AlertTriangle size={14} />
                  <span>{getTranslation(language, 'ambiguityAlert')}</span>
                </h4>
                
                <div className="space-y-2">
                  {result.ambiguities.map((amb, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mt-1.5"></span>
                      <p className="text-[11px] text-[var(--ds-text-secondary)] m-0 leading-relaxed font-medium">{amb}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up Questions */}
            {result.followUpQuestions.length > 0 && (
              <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-ink flex items-center gap-1.5 m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
                  <HelpCircle size={14} />
                  <span>{getTranslation(language, 'followupQ')}</span>
                </h4>
                
                <div className="space-y-3.5">
                  {result.followUpQuestions.map((q, i) => (
                    <div key={i} className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg text-[11px] leading-relaxed text-[var(--ds-text-secondary)] font-medium">
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
