import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { EmptyState } from '../design-system/components/Feedback';
import { PathPanel } from '../design-system/components/Navigation';
import { 
  Briefcase, 
  CheckCircle2, 
  AlertTriangle, 
  FileCheck, 
  Plus, 
  BookOpen, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  Trash2, 
  AlertCircle, 
  Info
} from 'lucide-react';
import {
  apiGetPromotionPolicies,
  apiGetMyPromotionApplication,
  apiCreatePromotionApplication,
  apiGetScholarlyAssets,
  apiMapPromotionEvidence,
  apiRemovePromotionEvidence,
  apiEvaluatePromotionApplication,
  apiSubmitPromotionApplication,
  type PromotionPolicyData,
  type PromotionApplicationData,
  type PromotionEvaluationResultData,
  type ScholarlyAssetData
} from '../utils/api';

export const PromotionDashboard: React.FC = () => {
  const { language } = useProject();
  const isAr = language === 'ar';

  const [policies, setPolicies] = useState<PromotionPolicyData[]>([]);
  const [application, setApplication] = useState<PromotionApplicationData | null>(null);
  const [scholarlyAssets, setScholarlyAssets] = useState<ScholarlyAssetData[]>([]);
  const [evaluation, setEvaluation] = useState<PromotionEvaluationResultData | null>(null);
  
  const [targetRank, setTargetRank] = useState<string>('ASSOCIATE_PROFESSOR');
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedPolicies, fetchedApp, fetchedAssets] = await Promise.all([
        apiGetPromotionPolicies(),
        apiGetMyPromotionApplication(),
        apiGetScholarlyAssets()
      ]);

      setPolicies(fetchedPolicies);
      setScholarlyAssets(fetchedAssets);

      if (fetchedApp) {
        setApplication(fetchedApp);
        setTargetRank(fetchedApp.target_rank);
        if (fetchedApp.evaluation_summary_json) {
          setEvaluation(fetchedApp.evaluation_summary_json);
        } else {
          // Trigger evaluation
          const evalRes = await apiEvaluatePromotionApplication(fetchedApp.id);
          if (evalRes) setEvaluation(evalRes);
        }
      }
    } catch (e) {
      console.error('Failed to load promotion data', e);
      setStatusMessage({
        type: 'error',
        text: isAr ? 'تعذر تحميل بيانات لائحة الترقية من الخادم' : 'Failed to load promotion data from server'
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRankSwitch = async (newRank: string) => {
    setTargetRank(newRank);
    const matchingPolicy = policies.find(p => p.target_rank === newRank) || policies[0];
    if (matchingPolicy) {
      setIsLoading(true);
      const newApp = await apiCreatePromotionApplication({
        target_rank: newRank,
        policy_id: matchingPolicy.id,
        current_rank: newRank === 'FULL_PROFESSOR' ? 'ASSOCIATE_PROFESSOR' : 'ASSISTANT_PROFESSOR'
      });
      if (newApp) {
        setApplication(newApp);
        const evalRes = await apiEvaluatePromotionApplication(newApp.id);
        if (evalRes) setEvaluation(evalRes);
      }
      setIsLoading(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application || !selectedAssetId) return;

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const updatedApp = await apiMapPromotionEvidence(application.id, [selectedAssetId]);
      if (updatedApp) {
        setApplication(updatedApp);
        setSelectedAssetId('');
        const evalRes = await apiEvaluatePromotionApplication(updatedApp.id);
        if (evalRes) {
          setEvaluation(evalRes);
          setStatusMessage({
            type: 'success',
            text: isAr ? 'تم إدراج البحث في ملف الترقية وإعادة احتساب الجاهزية' : 'Evidence added to promotion dossier and readiness re-evaluated'
          });
        }
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: isAr ? 'فشل إضافة الدليل إلى ملف الترقية' : 'Failed to add evidence to promotion application'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveEvidence = async (assetId: string) => {
    if (!application) return;
    setIsLoading(true);
    try {
      const updatedApp = await apiRemovePromotionEvidence(application.id, assetId);
      if (updatedApp) {
        setApplication(updatedApp);
        const evalRes = await apiEvaluatePromotionApplication(updatedApp.id);
        if (evalRes) setEvaluation(evalRes);
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: isAr ? 'فشل حذف الدليل من الملف' : 'Failed to remove evidence from portfolio'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateNow = async () => {
    if (!application) return;
    setIsEvaluating(true);
    try {
      const res = await apiEvaluatePromotionApplication(application.id);
      if (res) {
        setEvaluation(res);
        setApplication(prev => prev ? {
          ...prev,
          readiness_percentage: res.readiness_percentage,
          total_calculated_points: res.total_calculated_points
        } : null);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!application) return;
    setIsSubmitting(true);
    try {
      const submitted = await apiSubmitPromotionApplication(application.id);
      if (submitted) {
        setApplication(submitted);
        setStatusMessage({
          type: 'success',
          text: isAr ? 'تم تقديم ملف الترقية بنجاح إلى اللجنة الأكاديمية المختصة' : 'Promotion portfolio submitted successfully to the academic committee'
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: isAr ? 'تعذر تقديم الطلب، تأكد من استيفاء البيانات المطلوبة' : 'Failed to submit application'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAssetIds = new Set(application?.evidence_selections.map(e => e.scholarly_asset_id) || []);
  const availableAssets = scholarlyAssets.filter(a => !selectedAssetIds.has(a.id));
  const activePolicy = policies.find(p => p.id === application?.policy_id) || policies[0];

  const readinessScore = evaluation?.readiness_percentage ?? application?.readiness_percentage ?? 0;
  const pointsEarned = evaluation?.total_calculated_points ?? application?.total_calculated_points ?? 0;
  const pointsRequired = evaluation?.total_required_points ?? 40;
  const pointsPercentage = pointsRequired > 0 ? Math.min(100, Math.round((pointsEarned / pointsRequired) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Persistence and Decision Support Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--ds-primary)]" />
          <span className="font-semibold text-[var(--ds-text-primary)]">
            {isAr ? 'منظومة دعم القرار للترقيات الأكاديمية (مبنية على اللائحة المؤسسية)' : 'Academic Promotion Decision Support System (Bylaws Rule-Based)'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-[var(--ds-primary)] font-medium">
              <RefreshCw size={13} className="motion-safe:animate-spin" />
              {isAr ? 'جارٍ التحديث...' : 'Updating...'}
            </span>
          )}
          {application?.status && (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              application.status === 'SUBMITTED' ? 'bg-[var(--ds-information-soft)] text-[var(--ds-information)] border border-info/20' :
              application.status === 'UNDER_REVIEW' ? 'bg-warning/10 text-warning border border-warning/20' :
              application.status === 'COMPLETED' ? 'bg-[var(--ds-success-soft)] text-success border border-success/20' :
              'bg-muted/10 text-secondary border border-muted/20'
            }`}>
              {application.status}
            </span>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 font-semibold ${
          statusMessage.type === 'success' ? 'bg-success/10 text-success border border-success' :
          statusMessage.type === 'error' ? 'bg-danger/10 text-danger border border-danger' :
          'bg-info/10 text-info border border-info'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <PathPanel accent="var(--ds-path-promotion)">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase size={20} className="text-warning" />
            <span className="text-[10px] font-black text-warning uppercase tracking-widest">
              {isAr ? 'الترقيات الأكاديمية لأعضاء هيئة التدريس' : 'Academic Faculty Promotion Hub'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[var(--ds-text-primary)] m-0">
            {isAr ? 'بصيرة للترقيات الأكاديمية' : 'Baseerah Academic Promotion Engine'}
          </h2>
          <p className="text-sm text-[var(--ds-text-secondary)] max-w-2xl m-0 leading-relaxed">
            {isAr
              ? `ملف الترقية خاضع لـ: ${activePolicy?.name_ar || 'اللائحة المعتمدة'} (الإصدار v${activePolicy?.version || 1})`
              : `Promotion Dossier evaluated under: ${activePolicy?.name_en || 'Active Bylaws'} (v${activePolicy?.version || 1})`}
          </p>
        </div>

        {/* Rank Selector buttons */}
        <div className="flex gap-2 bg-[var(--ds-surface-secondary)] p-1 rounded-xl border border-[var(--ds-border-subtle)] shrink-0">
          <button
            type="button"
            onClick={() => handleRankSwitch('ASSOCIATE_PROFESSOR')}
            className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer ds-transition ${
              targetRank === 'ASSOCIATE_PROFESSOR'
                ? 'bg-[var(--ds-primary-soft)] text-ink shadow-sm'
                : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]'
            }`}
          >
            {isAr ? 'أستاذ مشارك' : 'Associate Prof'}
          </button>
          <button
            type="button"
            onClick={() => handleRankSwitch('FULL_PROFESSOR')}
            className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer ds-transition ${
              targetRank === 'FULL_PROFESSOR'
                ? 'bg-[var(--ds-primary-soft)] text-ink shadow-sm'
                : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]'
            }`}
          >
            {isAr ? 'أستاذ دكتور (بروفيسور)' : 'Full Professor'}
          </button>
        </div>
      </div>
      </PathPanel>

      {!application && (
        <Card className="p-8 text-center space-y-4 border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
          <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
            <Briefcase size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[var(--ds-text-primary)] m-0">
              {isAr ? 'لم يتم فتح ملف ترقية أكاديمية بعد' : 'No Promotion Application Initialized Yet'}
            </h3>
            <p className="text-xs text-[var(--ds-text-secondary)] max-w-md mx-auto">
              {isAr
                ? 'ابدأ الآن بفتح ملف الترقية لرتبتك المستهدفة وربط أبحاثك المعتمدة لاحتساب الجاهزية والنقاط آلياً وفق اللائحة.'
                : 'Start your promotion dossier for your target rank and link verified research assets to evaluate readiness under active bylaws.'}
            </p>
          </div>
          <Button
            onClick={() => handleRankSwitch(targetRank)}
            variant="primary"
            className="font-bold text-xs"
          >
            {isAr ? 'بدء إعداد ملف الترقية الآن' : 'Initialize Promotion Portfolio'}
          </Button>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Stats & Checklist (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Readiness Gauge */}
            <Card className="p-6 flex flex-col items-center justify-center gap-4 text-center border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
              <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                {isAr ? 'جاهزية ملف التقديم' : 'Portfolio Readiness'}
              </span>
              
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke="var(--ds-border-subtle)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={readinessScore >= 100 ? 'var(--ds-success)' : 'var(--ds-warning)'}
                    strokeWidth="3"
                    strokeDasharray={`${readinessScore} ${100 - readinessScore}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-black ds-numeric ${readinessScore >= 100 ? 'text-success' : 'text-warning'}`}>
                    {readinessScore}%
                  </span>
                  <span className="text-[9px] text-[var(--ds-text-muted)] font-bold ds-numeric">
                    {evaluation?.criteria_results.filter(c => c.status === 'SATISFIED').length || 0} / {evaluation?.criteria_results.length || activePolicy?.criteria.length || 4}
                  </span>
                </div>
              </div>
            </Card>

            {/* Points Summary */}
            <Card className="p-6 flex flex-col items-center justify-center gap-4 text-center border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)]">
              <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest">
                {isAr ? 'نقاط الإنتاج العلمي' : 'Research Points Earned'}
              </span>
              
              <div className="space-y-1">
                <span className={`text-3xl font-black ds-numeric block ${pointsEarned >= pointsRequired ? 'text-success' : 'text-warning'}`}>
                  {pointsEarned.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--ds-text-secondary)] font-bold block">
                  {isAr ? `من أصل ${pointsRequired} مطلوبة باللائحة` : `out of ${pointsRequired} required`}
                </span>
              </div>
              
              <div className="w-full bg-[var(--ds-surface-secondary)] rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${pointsEarned >= pointsRequired ? 'bg-[var(--ds-success)]' : 'bg-warning'}`} style={{ width: `${pointsPercentage}%` }} />
              </div>
            </Card>
          </div>

          {/* Criteria Checklist from Rules Engine */}
          <Card className="p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--ds-border-subtle)] pb-2">
              <h3 className="text-xs font-black text-[var(--ds-text-primary)] m-0 flex items-center gap-2">
                <FileCheck className="text-warning" size={16} />
                <span>{isAr ? 'بنود ومعايير اللائحة المؤسسية' : 'Institutional Promotion Criteria'}</span>
              </h3>
              <button
                type="button"
                onClick={handleEvaluateNow}
                disabled={isEvaluating}
                className="flex items-center gap-1 text-[11px] text-action hover:underline cursor-pointer font-bold"
              >
                <RefreshCw size={12} className={isEvaluating ? 'motion-safe:animate-spin' : ''} />
                <span>{isAr ? 'إعادة التقييم' : 'Re-Evaluate'}</span>
              </button>
            </div>
            
            <div className="space-y-3">
              {evaluation?.criteria_results && evaluation.criteria_results.length > 0 ? (
                evaluation.criteria_results.map(item => (
                  <div 
                    key={item.criterion_id} 
                    className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--ds-text-primary)]">
                        {isAr ? item.title_ar : item.title_en}
                      </span>
                      {item.status === 'SATISFIED' ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-success bg-[var(--ds-success-soft)] border border-success/20 px-2 py-0.5 rounded-lg">
                          <CheckCircle2 size={13} className="text-success shrink-0" />
                          <span>{isAr ? 'مستوفى' : 'Satisfied'}</span>
                        </div>
                      ) : item.status === 'PARTIALLY_SATISFIED' ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-lg">
                          <AlertTriangle size={13} className="shrink-0 text-warning" />
                          <span>{isAr ? 'مستوفى جزئياً' : 'Partial'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-lg">
                          <AlertTriangle size={13} className="shrink-0 text-danger" />
                          <span>{isAr ? 'مستند أو شرط ناقص' : 'Missing Requirement'}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--ds-text-secondary)] m-0">
                      {isAr ? item.explanation_ar : item.explanation_en}
                    </p>
                  </div>
                ))
              ) : (
                activePolicy?.criteria.map(crit => (
                  <div key={crit.id} className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--ds-text-secondary)]">{isAr ? crit.title_ar : crit.title_en}</span>
                    <span className="text-[10px] text-[var(--ds-text-muted)] font-bold">{isAr ? 'قيد التقييم' : 'Evaluating'}</span>
                  </div>
                ))
              )}
            </div>

            {/* Recommendations & Gaps */}
            {evaluation?.recommendations_ar && evaluation.recommendations_ar.length > 0 && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl space-y-1 text-xs">
                <div className="font-bold text-warning dark:text-warning flex items-center gap-1.5">
                  <Info size={14} />
                  <span>{isAr ? 'توصيات استيفاء النواقص بالملف:' : 'Portfolio Gaps & Recommendations:'}</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[var(--ds-text-secondary)] m-0">
                  {(isAr ? evaluation.recommendations_ar : evaluation.recommendations_en).map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submission Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[10px] text-[var(--ds-text-muted)] m-0">
                {isAr
                  ? 'هذا التقييم استرشادي لدعم القرار؛ القرار النهائي معقود للجنة الأكاديمية.'
                  : 'Advisory readiness evaluation only; final determination is made by the academic committee.'}
              </p>

              {application?.status === 'DRAFT' && (
                <Button
                  onClick={handleSubmitApplication}
                  disabled={isSubmitting || (application?.evidence_selections.length || 0) === 0}
                  variant="primary"
                  size="sm"
                  className="shrink-0"
                  iconBefore={<Send size={13} />}
                >
                  <span>{isAr ? 'تقديم الملف للجنة الترقية' : 'Submit to Committee'}</span>
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Research Papers & Adding form (5/12) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Selected Evidence List */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-black text-[var(--ds-text-primary)] border-b border-[var(--ds-border-subtle)] pb-2 m-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="text-warning" size={16} />
                <span>{isAr ? 'الأبحاث المدرجة بملف الترقية' : 'Dossier Evidence Publications'}</span>
              </div>
              <span className="text-[10px] font-bold text-[var(--ds-text-muted)]">
                ({application?.evidence_selections.length || 0}) {isAr ? 'أبحاث' : 'papers'}
              </span>
            </h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {!application?.evidence_selections || application.evidence_selections.length === 0 ? (
                <EmptyState
                  bare
                  className="py-4"
                  illustration={<BookOpen size={28} />}
                  title={isAr ? 'لا توجد أوراق في الملف' : 'No papers in the dossier'}
                  description={isAr ? 'أدرج بحثًا موثَّقًا من أصولك العلمية لتقييم جاهزية الترقية.' : 'Attach a verified scholarly asset to evaluate promotion readiness.'}
                />
              ) : (
                application.evidence_selections.map(ev => {
                  const snap = ev.evidence_snapshot_json || {};
                  const title = snap.title_ar || snap.title_en || 'Scholarly Paper';
                  const journal = snap.journal_name || 'Academic Journal';
                  const rank = snap.metadata?.journal_rank || snap.metadata?.rank || 'Q3';
                  const role = snap.metadata?.author_role || snap.metadata?.role || 'Author';

                  return (
                    <div 
                      key={ev.id} 
                      className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-2 text-right"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold text-[var(--ds-text-primary)] truncate max-w-[200px]">
                          {title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-warning/10 text-warning dark:text-warning px-2 py-0.5 rounded-md border border-warning/20 text-[9px] font-bold">
                            +{ev.calculated_points.toFixed(1)} {isAr ? 'نقطة' : 'pts'}
                          </span>
                          {application.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEvidence(ev.scholarly_asset_id)}
                              className="text-danger hover:text-danger p-1 cursor-pointer"
                              title={isAr ? 'حذف من الملف' : 'Remove from dossier'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-[9px] text-[var(--ds-text-muted)] font-semibold">
                        <span>{journal} ({rank})</span>
                        <span className="uppercase">{role}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Link Scholarly Asset to Dossier */}
          {application?.status === 'DRAFT' && (
            <Card className="p-5 space-y-4">
              <h4 className="text-xs font-black text-[var(--ds-text-primary)] m-0">
                {isAr ? 'إدراج بحث من الإنتاج العلمي الموثق' : 'Select Paper from Scholarly Assets'}
              </h4>
              
              <form onSubmit={handleAddEvidence} className="space-y-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] text-[var(--ds-text-muted)] font-black uppercase">
                    {isAr ? 'اختر الورقة العلمية من رصيدك الأكاديمي:' : 'Choose Paper from Verified Profile:'}
                  </label>
                  
                  {availableAssets.length > 0 ? (
                    <select
                      value={selectedAssetId}
                      onChange={e => setSelectedAssetId(e.target.value)}
                      className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-2 text-xs font-bold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                    >
                      <option value="">{isAr ? '-- اختر ورقة علمية --' : '-- Select a Paper --'}</option>
                      {availableAssets.map(asset => (
                        <option key={asset.id} value={asset.id}>
                          {asset.title_ar || asset.title_en} ({asset.journal_name || 'Journal'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <EmptyState
                      bare
                      className="py-2"
                      title={isAr ? 'لا أوراق متاحة للإضافة' : 'No papers left to add'}
                      description={isAr ? 'جميع أبحاثك الموثقة مدرجة بالملف، أو لم تُسجَّل أبحاث بعد.' : 'All verified assets are already in the dossier, or none are registered yet.'}
                    />
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!selectedAssetId || isLoading}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl mt-2"
                >
                  <Plus size={14} />
                  <span>{isAr ? 'إدراج الورقة واحتساب النقاط' : 'Add Paper & Score Points'}</span>
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
