import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { checkConsistency } from '../utils/ruleEngine';
import { getTranslation } from '../utils/translations';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { EmptyActiveProject } from './EmptyActiveProject';
import { ROUTES } from '../router/routes';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  SearchCheck,
  Sparkles,
} from 'lucide-react';

const SECTION_REDIRECTS: Record<string, string> = {
  variables: ROUTES.MODEL_BUILDER,
  methodology: ROUTES.WIZARD,
  questions: ROUTES.WIZARD,
  hypotheses: ROUTES.WIZARD,
  sample: ROUTES.SAMPLE_CALC,
  measurement: ROUTES.MEASUREMENT,
  analysis: ROUTES.ANALYSIS_PLAN,
  ethics: ROUTES.PLANNING,
};

export const ConsistencyChecker: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language } = useProject();
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  if (!activeProject) {
    return (
      <EmptyActiveProject
        language={language}
        illustration={<SearchCheck size={40} />}
        description={language === 'ar' ? 'أنشئ مشروعًا من اختيار المسار لفحص اتساق التصميم البحثي.' : 'Create a project from path selection to check research-design consistency.'}
      />
    );
  }

  const audit = checkConsistency(activeProject);
  const criticalIssues = audit.issues.filter((i) => i.type === 'critical');
  const warningIssues = audit.issues.filter((i) => i.type === 'warning');
  const improvementIssues = audit.issues.filter((i) => i.type === 'improvement');

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * audit.score) / 100;

  const getScoreTone = (score: number) => {
    if (score >= 80) return { stroke: 'stroke-[var(--ds-success)]', text: 'text-[var(--ds-success)]' };
    if (score >= 50) return { stroke: 'stroke-[var(--ds-warning)]', text: 'text-[var(--ds-warning)]' };
    return { stroke: 'stroke-[var(--ds-danger)]', text: 'text-[var(--ds-danger)]' };
  };

  const handleFixIssue = (section: string) => {
    navigate(SECTION_REDIRECTS[section] || '/');
  };

  const renderIssueGroup = (
    issues: typeof audit.issues,
    tone: 'danger' | 'warning' | 'info',
    icon: React.ReactNode,
    title: string,
    actionLabel: string,
  ) => {
    if (issues.length === 0) return null;

    const toneClass = {
      danger: {
        panel: 'bg-[var(--ds-danger-soft)] border-[var(--ds-danger)]/20',
        heading: 'text-[var(--ds-danger)] border-[var(--ds-danger)]/20',
      },
      warning: {
        panel: 'bg-[var(--ds-warning-soft)] border-[var(--ds-warning)]/20',
        heading: 'text-[var(--ds-warning)] border-[var(--ds-warning)]/20',
      },
      info: {
        panel: 'bg-[var(--ds-information-soft)] border-[var(--ds-information)]/20',
        heading: 'text-[var(--ds-information)] border-[var(--ds-information)]/20',
      },
    }[tone];

    return (
      <div className={`${toneClass.panel} border rounded-lg p-5 shadow-sm space-y-3`}>
        <h4 className={`${toneClass.heading} text-xs font-black flex items-center gap-1.5 m-0 pb-2 border-b`}>
          {icon}
          <span>{title}</span>
        </h4>
        <div className="space-y-3">
          {issues.map((issue) => (
            <div key={issue.id} className="p-3 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg flex items-center justify-between gap-4">
              <span className="text-xs leading-relaxed text-[var(--ds-text-secondary)] font-medium">
                {language === 'ar' ? issue.textAr : issue.textEn}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleFixIssue(issue.section)}
                className="text-[10px] font-bold py-1 px-3 shrink-0 cursor-pointer"
              >
                <span>{actionLabel}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const scoreTone = getScoreTone(audit.score);
  const dependentVariable = activeProject.variables.find((v) => v.type === 'dependent');

  const getHypothesisRecommendation = (): { ar: string; en: string } => {
    if (activeProject.studyDesign.includes('quasi') || activeProject.studyDesign === 'experimental_rct') {
      return {
        ar: 'بما أن التصميم تجريبي أو شبه تجريبي، نقترح صياغة الفرضية الصفرية بوضوح حول عدم وجود فروق ذات دلالة إحصائية بين متوسطات المجموعة التجريبية والضابطة عند مستوى دلالة 0.05.',
        en: 'Since the design is experimental or quasi-experimental, we propose the null hypothesis: there are no statistically significant differences at the 0.05 level between experimental and control group means.',
      };
    }
    if (activeProject.studyDesign === 'correlational' || activeProject.studyDesign === 'predictive') {
      return {
        ar: 'بما أن التصميم ارتباطي/تنبؤي، نقترح صياغة الفرضية حول وجود علاقة ارتباطية ذات دلالة إحصائية بين المتغيرات عند مستوى دلالة 0.05، دون افتراض وجود مجموعات تجريبية وضابطة.',
        en: 'Since the design is correlational/predictive, we propose formulating the hypothesis around a statistically significant relationship between the variables at the 0.05 level, without assuming experimental/control groups.',
      };
    }
    return {
      ar: 'بما أن التصميم وصفي أو نوعي، نقترح صياغة أسئلة بحثية أو فرضيات وصفية واضحة حول مستوى/واقع المتغيرات المدروسة دون الحاجة لاختبار فروق بين مجموعات.',
      en: 'Since the design is descriptive or qualitative, we propose formulating clear descriptive research questions or hypotheses about the level/state of the studied variables, without testing for differences between groups.',
    };
  };
  const hypothesisRecommendation = getHypothesisRecommendation();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <PathPanel accent="var(--ds-path-research)">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-start flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] text-xs font-bold mb-1">
            <SearchCheck size={12} />
            <span>{language === 'ar' ? 'فحص الاتساق المنهجي' : 'Methodological Alignment'}</span>
          </div>
          <h3 className="text-h3 text-[var(--ds-text-primary)] m-0">
            {getTranslation(language, 'consistency')}
          </h3>
          <p className="text-caption text-[var(--ds-text-secondary)] m-0 max-w-xl">
            {language === 'ar'
              ? 'مؤشر سلامة وتكامل دراسة البحث من الناحية المنهجية والإحصائية، ويضمن التوافق بين العنوان، الفروض، العينات، والتحليل.'
              : 'Index of research study integrity and methodological alignment. Ensures title, design, and samples align.'}
          </p>
        </div>

        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle cx="48" cy="48" r={radius} className="stroke-[var(--ds-border-subtle)] fill-none" strokeWidth="6" />
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={`fill-none ${reduceMotion ? '' : 'transition-all duration-1000 ease-out'} ${scoreTone.stroke}`}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`text-2xl font-black leading-none ds-numeric ${scoreTone.text}`}>{audit.score}</span>
            <span className="text-[8px] text-[var(--ds-text-muted)] font-extrabold mt-0.5 tracking-wider">/ 100</span>
          </div>
        </div>
      </div>
      </PathPanel>

      {audit.issues.length === 0 ? (
        <div className="bg-[var(--ds-success-soft)] border border-[var(--ds-success)]/25 text-[var(--ds-success)] rounded-lg p-6 flex items-center gap-4 shadow-sm">
          <CheckCircle2 size={32} className="shrink-0" />
          <div>
            <h4 className="text-h4 m-0 mb-1">{getTranslation(language, 'auditPassed')}</h4>
            <p className="text-caption md:text-sm m-0">
              {language === 'ar'
                ? 'تم فحص جميع معايير الاتساق ولم يتم العثور على أي خلل منهجي.'
                : 'All consistency checks passed! The alignment between title, variables, design, and analysis is solid.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {renderIssueGroup(
            criticalIssues,
            'danger',
            <AlertCircle size={14} />,
            getTranslation(language, 'criticalErrors'),
            language === 'ar' ? 'إصلاح الخلل' : 'Fix Now',
          )}
          {renderIssueGroup(
            warningIssues,
            'warning',
            <AlertTriangle size={14} />,
            getTranslation(language, 'warnings'),
            language === 'ar' ? 'تصحيح' : 'Adjust',
          )}
          {renderIssueGroup(
            improvementIssues,
            'info',
            <Lightbulb size={14} />,
            getTranslation(language, 'improvements'),
            language === 'ar' ? 'تحسين' : 'Optimize',
          )}
        </div>
      )}

      <Card className="p-6 border border-[var(--ds-primary)]/20 bg-[var(--ds-surface-primary)] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[var(--ds-primary)]" size={20} />
          <h4 className="text-h4 text-[var(--ds-text-primary)] m-0">
            {language === 'ar' ? 'مستشار بصيرة للاتساق المنهجي الذكي' : 'Baseerah Methodological AI Consultant'}
          </h4>
        </div>
        <p className="text-caption text-[var(--ds-text-secondary)] m-0">
          {language === 'ar'
            ? 'بناءً على المعايير الإحصائية والعلمية للعنوان والمتغيرات المدخلة، يقدم مستشار بصيرة توصيات عملية لضمان قوة البحث المنهجية.'
            : 'Based on the scientific criteria of your title and variables, Baseerah recommends the following actions to ensure robustness:'}
        </p>

        <div className="space-y-3.5 pt-2">
          <div className="flex items-start gap-3 p-3 bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/15 rounded-lg">
            <Lightbulb size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[11px] font-black text-[var(--ds-text-primary)]">
                {language === 'ar' ? 'مواءمة صياغة الفرضيات إحصائياً' : 'Statistical Hypothesis Realignment'}
              </span>
              <p className="text-[10px] text-[var(--ds-text-secondary)] m-0 leading-relaxed">
                {language === 'ar' ? hypothesisRecommendation.ar : hypothesisRecommendation.en}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/15 rounded-lg">
            <CheckCircle2 size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[11px] font-black text-[var(--ds-text-primary)]">
                {language === 'ar' ? 'ضبط أدوات القياس مع المتغيرات' : 'Align Measurement Instruments'}
              </span>
              <p className="text-[10px] text-[var(--ds-text-secondary)] m-0 leading-relaxed">
                {language === 'ar'
                  ? `يرجى التأكد من أن أداة القياس تغطي بدقة أبعاد المتغير التابع: "${dependentVariable?.nameAr || 'المتغير التابع'}" لتفادي تحيز القياس.`
                  : `Ensure that your measurement instrument covers all dimensions of the dependent variable: "${dependentVariable?.nameEn || 'Dependent Variable'}" to avoid measurement bias.`}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
