import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { checkConsistency } from '../utils/ruleEngine';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import {
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  BookOpen,
  FlaskConical,
  BarChart3,
  Scale,
  FileSearch,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  Info,
  TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis 
} from 'recharts';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Decision = 'accepted' | 'minor_revision' | 'major_revision' | 'rejected';

interface DimensionResult {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
  score: number;        // 0–100
  weight: number;       // relative weight for overall index
  majorComments: { ar: string; en: string }[];
  minorComments: { ar: string; en: string }[];
}

interface ReviewResult {
  overallIndex: number;
  decision: Decision;
  dimensions: DimensionResult[];
}

// ─────────────────────────────────────────────
// Helper: decision from score
// ─────────────────────────────────────────────
const decisionFromScore = (score: number): Decision => {
  if (score >= 88) return 'accepted';
  if (score >= 72) return 'minor_revision';
  if (score >= 50) return 'major_revision';
  return 'rejected';
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const PublicationReadinessReviewer: React.FC = () => {
  const { activeProject, language } = useProject();
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // ── No project guard ──────────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-10 text-center shadow-sm">
        <FileSearch size={40} className="mx-auto mb-3 text-[var(--ds-text-disabled)]" />
        <p className="text-sm text-[var(--ds-text-secondary)]">
          {language === 'ar' ? 'الرجاء تحديد مشروع نشط أولاً.' : 'Please select an active project first.'}
        </p>
      </div>
    );
  }

  // ── Run assessment ────────────────────────────────────────────────────────
  const handleRunReview = () => {
    setRunning(true);

    setTimeout(() => {
      const audit = checkConsistency(activeProject);
      const criticalCount = audit.issues.filter(i => i.type === 'critical').length;
      const warningCount  = audit.issues.filter(i => i.type === 'warning').length;

      // ── Dimension 1: Methodological Design ───────────────────────────────
      let methScore = 100;
      methScore -= criticalCount * 18;
      methScore -= warningCount * 6;
      if (!activeProject.studyDesign) methScore -= 15;
      if (activeProject.variables.length < 2) methScore -= 12;
      methScore = Math.max(20, Math.min(98, methScore));

      const methMajor: { ar: string; en: string }[] = [];
      const methMinor: { ar: string; en: string }[] = [];

      if (criticalCount > 0) {
        methMajor.push({
          ar: 'توجد فجوة اتساق جوهرية بين عنوان البحث وتصميمه المنهجي. المراجعة الشاملة لهيكل التصميم مطلوبة قبل التقديم.',
          en: 'A substantial consistency gap exists between the title and the methodological design. A full design revision is required before submission.'
        });
      }
      if (activeProject.variables.length < 3) {
        methMajor.push({
          ar: 'عدد المتغيرات الضابطة والوسيطة غير كافٍ لعزل الأثر السببي بدقة علمية مقبولة.',
          en: 'The number of control and mediator variables is insufficient to isolate the causal effect with acceptable scientific precision.'
        });
      }
      if (!activeProject.studyDesign) {
        methMinor.push({
          ar: 'لم يتم تحديد التصميم البحثي صراحةً. يُنصح بتوثيق التصميم (تجريبي / شبه تجريبي / كمي وصفي).',
          en: 'No explicit study design was specified. Document your design type (experimental / quasi-experimental / descriptive quantitative).'
        });
      }

      // ── Dimension 2: Statistical Analysis ────────────────────────────────
      let statScore = 100;
      if (!activeProject.sampleSettings?.populationSize) statScore -= 20;
      if (!activeProject.sampleSettings?.marginOfError)  statScore -= 10;
      if (activeProject.hypotheses.length === 0) statScore -= 15;
      statScore = Math.max(25, Math.min(98, statScore));

      const statMajor: { ar: string; en: string }[] = [];
      const statMinor: { ar: string; en: string }[] = [];

      if (activeProject.hypotheses.length === 0) {
        statMajor.push({
          ar: 'لا توجد فرضيات إحصائية محددة. لا يمكن للمحكّم تقييم مناسبة الاختبار الإحصائي المقترح.',
          en: 'No statistical hypotheses are defined. Reviewers cannot evaluate the appropriateness of the proposed statistical test.'
        });
      }
      if (!activeProject.sampleSettings?.populationSize) {
        statMinor.push({
          ar: 'حجم المجتمع غير محدد. يُنصح باستخدام معادلة كوهن لحساب حجم العينة الكافي وتحقيق قوة إحصائية ≥ 0.80.',
          en: "Population size is unspecified. Use Cohen's formula to achieve a statistical power ≥ 0.80."
        });
      }

      // ── Dimension 3: Measurement Tools & Validity ────────────────────────
      let measScore = 100;
      if (activeProject.variables.length < 2) measScore -= 20;
      if (activeProject.questions.length < 3) measScore -= 15;
      measScore = Math.max(30, Math.min(98, measScore));

      const measMajor: { ar: string; en: string }[] = [];
      const measMinor: { ar: string; en: string }[] = [];

      if (activeProject.questions.length < 3) {
        measMajor.push({
          ar: 'أسئلة البحث أقل من الحد المطلوب. يتعذّر على المحكّم التحقق من تغطية الأداة لجميع أبعاد المتغير.',
          en: 'Research questions are below the required threshold. Reviewers cannot confirm that the instrument covers all variable dimensions.'
        });
      }
      measMinor.push({
        ar: 'يُنصح بتوضيح معاملات الثبات (كرونباخ ألفا) والصدق (صدق المحتوى وصدق البناء) لجميع أدوات القياس.',
        en: "Clarify reliability coefficients (Cronbach's α) and validity indices (content and construct) for all measurement instruments."
      });

      // ── Dimension 4: Literature Review & Theoretical Framework ───────────
      let litScore = 100;
      if (!activeProject.problemStatementAr && !activeProject.problemStatementEn) litScore -= 25;
      litScore = Math.max(30, Math.min(98, litScore));

      const litMajor: { ar: string; en: string }[] = [];
      const litMinor: { ar: string; en: string }[] = [];

      if (!activeProject.problemStatementAr && !activeProject.problemStatementEn) {
        litMajor.push({
          ar: 'غياب الإطار النظري وصياغة مشكلة البحث. دون هذا الركن لا يمكن تقييم ارتباط الدراسة بالفجوة البحثية.',
          en: 'The theoretical framework and problem statement are missing. Without this, reviewers cannot assess relevance to the research gap.'
        });
      }
      litMinor.push({
        ar: 'يُنصح بتضمين خريطة المراجعة المنهجية للأدبيات (PRISMA أو SCR) لإثبات شمولية البحث وعدم التكرار.',
        en: 'Include a systematic literature review map (PRISMA or SCR) to demonstrate comprehensiveness and originality.'
      });

      // ── Dimension 5: Research Ethics ──────────────────────────────────────
      const ethScore = activeProject.preRegistrationHash ? 88 : 62;
      const ethMajor: { ar: string; en: string }[] = [];
      const ethMinor: { ar: string; en: string }[] = [];

      if (!activeProject.preRegistrationHash) {
        ethMinor.push({
          ar: 'لا يوجد تسجيل مسبق (Pre-registration) موثق. يُنصح بالتسجيل في منصة OSF أو ClinicalTrials قبل بدء جمع البيانات.',
          en: 'No documented pre-registration found. Register on OSF or ClinicalTrials before data collection begins.'
        });
      }
      ethMinor.push({
        ar: 'تأكد من توثيق الموافقة الأخلاقية المؤسسية (IRB) وسرية بيانات المشاركين في متن الدراسة.',
        en: 'Ensure that IRB approval and participant data confidentiality protocols are documented within the study.'
      });

      // ── Aggregate ─────────────────────────────────────────────────────────
      const dims: DimensionResult[] = [
        { id: 'methodology', labelAr: 'التصميم المنهجي',       labelEn: 'Methodological Design',    icon: FlaskConical,  score: methScore, weight: 0.30, majorComments: methMajor, minorComments: methMinor },
        { id: 'statistics',  labelAr: 'التحليل الإحصائي',        labelEn: 'Statistical Analysis',     icon: BarChart3,     score: statScore, weight: 0.25, majorComments: statMajor, minorComments: statMinor },
        { id: 'measurement', labelAr: 'أدوات القياس والصدق',    labelEn: 'Measurement & Validity',   icon: Scale,         score: measScore, weight: 0.20, majorComments: measMajor, minorComments: measMinor },
        { id: 'literature',  labelAr: 'الإطار النظري والأدبيات', labelEn: 'Literature & Framework',   icon: BookOpen,      score: litScore,  weight: 0.15, majorComments: litMajor, minorComments: litMinor },
        { id: 'ethics',      labelAr: 'أخلاقيات البحث والنزاهة',  labelEn: 'Research Ethics',          icon: UserCheck,     score: ethScore,  weight: 0.10, majorComments: ethMajor, minorComments: ethMinor }
      ];

      const overallIndex = Math.round(
        dims.reduce((acc, d) => acc + d.score * d.weight, 0)
      );

      setReviewResult({
        overallIndex,
        decision: decisionFromScore(overallIndex),
        dimensions: dims
      });
      setRunning(false);
    }, 800);
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  const decisionStyles: Record<Decision, string> = {
    accepted:       'bg-action/10 text-success border-success/30 dark:bg-action/5',
    minor_revision: 'bg-info/10    text-path-publication    border-info/30    dark:bg-[var(--ds-path-publication)]/5',
    major_revision: 'bg-warning/10   text-warning   border-warning/30   dark:bg-warning/5',
    rejected:       'bg-danger/10    text-danger    border-danger/30    dark:bg-danger/5'
  };

  const decisionLabel = (d: Decision) => {
    const map: Record<Decision, { ar: string; en: string }> = {
      accepted:       { ar: 'جاهزية عالية — موصى بالنشر',   en: 'High Readiness — Submission Recommended' },
      minor_revision: { ar: 'مراجعة طفيفة قبل القبول',       en: 'Minor Revisions Required' },
      major_revision: { ar: 'مراجعة جوهرية وإعادة هيكلة',     en: 'Major Revisions Required' },
      rejected:       { ar: 'ملاحظات منهجية حرجة',          en: 'Critical Methodological Deficiencies' }
    };
    return language === 'ar' ? map[d].ar : map[d].en;
  };

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-success';
    if (score >= 70) return 'text-path-publication';
    if (score >= 50) return 'text-warning';
    return 'text-danger';
  };

  const scoreBg = (score: number) => {
    if (score >= 85) return 'bg-action';
    if (score >= 70) return 'bg-[var(--ds-path-publication)]';
    if (score >= 50) return 'bg-warning';
    return 'bg-danger';
  };

  // Radar Data calculation
  const radarData = reviewResult
    ? reviewResult.dimensions.map(dim => ({
        subject: language === 'ar' ? dim.labelAr : dim.labelEn,
        score: dim.score,
        fullMark: 100
      }))
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">

      <PathPanel accent="var(--ds-path-publication)">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck size={20} className="text-ai" />
            <span className="text-[10px] font-black text-ai uppercase tracking-widest">
              {language === 'ar' ? 'تحكيم متعدد الأبعاد' : 'Multi-Dimensional Peer Review'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">
            {language === 'ar' ? 'فاحص الجاهزية المنهجية للنشر' : 'Publication Readiness Reviewer'}
          </h2>
          <p className="text-sm text-[var(--ds-text-secondary)] max-w-2xl m-0 leading-relaxed">
            {language === 'ar'
              ? 'تقييم شامل يحاكي قرار المحكّمين عبر خمسة أبعاد منهجية: التصميم، الإحصاء، القياس، الأدبيات، والأخلاقيات.'
              : 'A comprehensive assessment simulating reviewer decisions across five methodological dimensions: design, statistics, measurement, literature, and ethics.'}
          </p>
        </div>

        <Button
          onClick={handleRunReview}
          disabled={running}
          variant="primary"
          className="flex items-center gap-2 px-6 py-3 font-bold cursor-pointer shrink-0 text-xs rounded-xl"
        >
          {running
            ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            : <Sparkles size={16} />
          }
          <span>
            {running
              ? (language === 'ar' ? 'جارٍ التقييم...' : 'Assessing...')
              : (language === 'ar' ? 'تشغيل التقييم الشامل' : 'Run Full Assessment')}
          </span>
        </Button>
      </div>
      </PathPanel>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5">
        <Info size={16} className="text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--ds-text-secondary)] leading-relaxed m-0">
          {language === 'ar'
            ? 'هذا التقييم استرشادي وتنبؤي، يستند إلى البيانات المدخلة في المنصة. لا يُغني عن التحكيم العلمي الرسمي من مجلة أو مؤتمر أكاديمي.'
            : 'This assessment is advisory and predictive, based on data entered in the platform. It does not replace formal peer review from a journal or academic conference.'}
        </p>
      </div>

      {/* Results Layout */}
      {reviewResult && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Grid splits: Left statistics & List, Right Radar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Readiness Gauge, Decision and Dimension overview (7/12 width) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Index gauge */}
                <Card className="p-6 flex flex-col items-center justify-center gap-4 text-center border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
                  <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                    {language === 'ar' ? 'مؤشر الجاهزية الإجمالي' : 'Overall Readiness Index'}
                  </span>
                  
                  {/* Circular gauge */}
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke="var(--ds-border-subtle)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke={reviewResult.overallIndex >= 85 ? 'var(--ds-chart-1)' : reviewResult.overallIndex >= 70 ? 'var(--ds-chart-3)' : reviewResult.overallIndex >= 50 ? 'var(--ds-chart-5)' : 'var(--ds-chart-6)'}
                        strokeWidth="3"
                        strokeDasharray={`${reviewResult.overallIndex} ${100 - reviewResult.overallIndex}`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-black ${scoreColor(reviewResult.overallIndex)}`}>
                        {reviewResult.overallIndex}
                      </span>
                      <span className="text-[9px] text-[var(--ds-text-muted)] font-bold">/100</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-[var(--ds-text-muted)] uppercase tracking-wider">
                    [ PREDICTED_DATA ]
                  </span>
                </Card>

                {/* Decision badge */}
                <Card className="p-6 flex flex-col items-center justify-center gap-3 text-center border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
                  <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                    {language === 'ar' ? 'قرار التحكيم المتوقع' : 'Predicted Review Decision'}
                  </span>
                  <div className={`px-4 py-2.5 rounded-xl border font-black text-xs ${decisionStyles[reviewResult.decision]}`}>
                    {decisionLabel(reviewResult.decision)}
                  </div>
                </Card>
              </div>

              {/* Dimension summary mini-bars */}
              <Card className="p-5 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] space-y-4">
                <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest block mb-1">
                  {language === 'ar' ? 'ملخص درجات الأبعاد المنهجية' : 'Dimension Summary'}
                </span>
                <div className="space-y-3.5">
                  {reviewResult.dimensions.map(dim => {
                    const Icon = dim.icon;
                    return (
                      <div key={dim.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <div className="flex items-center gap-1.5 text-[var(--ds-text-secondary)]">
                            <Icon size={12} className="text-ai" />
                            <span>{language === 'ar' ? dim.labelAr : dim.labelEn}</span>
                          </div>
                          <span className={`font-black ${scoreColor(dim.score)}`}>{dim.score}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--ds-surface-secondary)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${scoreBg(dim.score)}`}
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Right Column: Recharts Radar Chart (5/12 width) */}
            <div className="lg:col-span-5">
              <Card className="p-6 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] shadow-[var(--ds-shadow-layered)] space-y-4 sticky top-6">
                <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--ds-border-subtle)]">
                  <TrendingUp size={14} className="text-ai" />
                  <h4 className="text-[10px] font-black text-[var(--ds-text-secondary)] uppercase tracking-wider m-0">
                    {language === 'ar' ? 'بصمة الجاهزية خماسية الأبعاد' : '5D Readiness Assessment Web'}
                  </h4>
                </div>
                
                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="var(--ds-border-subtle)" />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fontSize: 8, fontWeight: 'bold', fill: 'var(--ds-text-secondary)' }}
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fontSize: 7, fill: 'var(--ds-text-muted)' }}
                      />
                      <Radar 
                        name="Readiness" 
                        dataKey="score" 
                        stroke="var(--ds-chart-4)"
                        fill="var(--ds-chart-4)"
                        fillOpacity={0.25} 
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="p-3 bg-ai/5 border border-ai/10 rounded-xl text-[10px] text-[var(--ds-text-muted)] leading-relaxed font-semibold">
                  {language === 'ar'
                    ? 'يمثل مخطط الرادار بصمة جودة بحثك. كلما اتسعت المساحة المظللة واقتربت من الأطراف، زادت احتمالية القبول الأكاديمي المباشر وتفادي الرفض المكتبي.'
                    : 'The radar chart represents your study quality footprint. A larger shaded area closer to the edges indicates higher peer review acceptance rates.'}
                </div>
              </Card>
            </div>
          </div>

          {/* Dimension Cards Accordion details */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-black text-[var(--ds-text-primary)] m-0">
              {language === 'ar' ? 'تقرير التحكيم التفصيلي حسب البُعد' : 'Detailed Peer Review Report by Dimension'}
            </h3>

            {reviewResult.dimensions.map(dim => {
              const Icon = dim.icon;
              const isExpanded = expandedDim === dim.id;
              const hasMajor = dim.majorComments.length > 0;

              return (
                <div
                  key={dim.id}
                  className={`bg-[var(--ds-surface-primary)] border rounded-2xl shadow-sm transition-all duration-200 ${
                    hasMajor ? 'border-danger/20' : 'border-[var(--ds-border-subtle)]'
                  }`}
                >
                  {/* Dimension header — clickable */}
                  <button
                    className="w-full flex items-center justify-between p-5 text-right gap-4 cursor-pointer"
                    onClick={() => setExpandedDim(isExpanded ? null : dim.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${hasMajor ? 'bg-danger/10 text-danger' : 'bg-ai/10 text-ai'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-[var(--ds-text-primary)]">
                          {language === 'ar' ? dim.labelAr : dim.labelEn}
                        </div>
                        <div className="text-[9px] text-[var(--ds-text-muted)] font-semibold mt-0.5">
                          {language === 'ar' ? `وزن البُعد: ${Math.round(dim.weight * 100)}%` : `Weight: ${Math.round(dim.weight * 100)}%`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Score pill */}
                      <div className={`text-sm font-black px-2.5 py-1 rounded-xl border ${decisionStyles[decisionFromScore(dim.score)]}`}>
                        {dim.score}
                      </div>
                      {/* Mini bar */}
                      <div className="hidden sm:block w-20 h-1.5 bg-[var(--ds-surface-secondary)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${scoreBg(dim.score)}`} style={{ width: `${dim.score}%` }} />
                      </div>
                      {hasMajor && <AlertTriangle size={14} className="text-danger " />}
                      {isExpanded
                        ? <ChevronUp size={16} className="text-[var(--ds-text-muted)]" />
                        : <ChevronDown size={16} className="text-[var(--ds-text-muted)]" />
                      }
                    </div>
                  </button>

                  {/* Expanded comments */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-[var(--ds-border-subtle)] pt-4">

                      {dim.majorComments.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-danger uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert size={13} />
                            {language === 'ar' ? 'ملاحظات جوهرية (Major Comments)' : 'Major Comments'}
                          </span>
                          {dim.majorComments.map((c, i) => (
                            <div key={i} className="p-3.5 bg-danger/5 border border-danger/15 rounded-xl text-xs text-[var(--ds-text-secondary)] font-bold leading-relaxed">
                              {language === 'ar' ? c.ar : c.en}
                            </div>
                          ))}
                        </div>
                      )}

                      {dim.minorComments.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-path-publication uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            {language === 'ar' ? 'توصيات تحسينية (Minor Comments)' : 'Minor / Improvement Comments'}
                          </span>
                          {dim.minorComments.map((c, i) => (
                            <div key={i} className="p-3.5 bg-[var(--ds-path-publication)]/5 border border-info/15 rounded-xl text-xs text-[var(--ds-text-secondary)] font-bold leading-relaxed">
                              {language === 'ar' ? c.ar : c.en}
                            </div>
                          ))}
                        </div>
                      )}

                      {dim.majorComments.length === 0 && dim.minorComments.length === 0 && (
                        <p className="text-xs text-[var(--ds-text-muted)] text-center py-2">
                          {language === 'ar' ? 'لا ملاحظات — البُعد ممتاز.' : 'No comments — this dimension is excellent.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
