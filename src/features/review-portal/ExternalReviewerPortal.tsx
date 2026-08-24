import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { 
  CheckCircle2, 
  Send, 
  AlertTriangle, 
  FileText, 
  ListChecks, 
  ShieldCheck,
  Clock,
  Save,
  MessageSquare,
  Lock,
  Download
} from 'lucide-react';
import { 
  apiGetExternalReviewPortal, 
  apiExternalAcceptReview, 
  apiExternalDeclineReview, 
  apiExternalSaveDraft, 
  apiExternalSubmitReview,
  apiDownloadExternalManuscriptUrl,
  type ExternalReviewerPortalData,
  type PeerReviewCriterion
} from '../../utils/api';

export const ExternalReviewerPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<ExternalReviewerPortalData | null>(null);

  const [conflictDeclared, setConflictDeclared] = useState<'NO_CONFLICT' | 'POTENTIAL_CONFLICT' | 'CONFLICT_DECLARED'>('NO_CONFLICT');
  const [conflictNotes, setConflictNotes] = useState('');

  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>({});
  const [generalComment, setGeneralComment] = useState('');
  const [confidentialComment, setConfidentialComment] = useState('');
  const [recommendation, setRecommendation] = useState<'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT'>('MINOR_REVISION');

  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    if (!token) {
      setError('رابط التحكيم غير صالح أو مفقود.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetExternalReviewPortal(token);
      if (!data) {
        setError('تعذر الوصول إلى جلسة التحكيم. قد يكون الرابط منتهي الصلاحية أو تم إلغاؤه.');
      } else {
        setPortalData(data);
        // Pre-populate if submission draft exists
        if (data.submission) {
          setRecommendation(data.submission.recommendation || 'MINOR_REVISION');
          const sc: Record<string, number> = {};
          const cm: Record<string, string> = {};
          data.submission.responses.forEach(r => {
            if (r.score_value !== undefined) sc[r.criterion_id] = r.score_value;
            if (r.comments) cm[r.criterion_id] = r.comments;
          });
          setScores(sc);
          setCriterionComments(cm);

          const gen = data.submission.comments.find(c => c.comment_type === 'AUTHOR_VISIBLE');
          if (gen) setGeneralComment(gen.comment_text);

          const conf = data.submission.comments.find(c => c.comment_type === 'CONFIDENTIAL_TO_EDITOR');
          if (conf) setConfidentialComment(conf.comment_text);
        }
      }
    } catch (e: any) {
      console.error('loadPortal error', e);
      setError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const handleAccept = async () => {
    if (!token) return;
    try {
      const res = await apiExternalAcceptReview(token, conflictDeclared, conflictNotes);
      if (res) {
        setPortalData(res);
        setActionSuccess('تم قبول مهمة التحكيم بنجاح. يمكنك الآن البدء في تقييم المخطوطة.');
      }
    } catch (e) {
      console.error('handleAccept error', e);
      setError('فشل قبول مهمة التحكيم.');
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      const res = await apiExternalDeclineReview(token, 'الاعتذار عن التحكيم لضيق الوقت');
      if (res) {
        setPortalData(res);
        setActionSuccess('تم تسجيل اعتذارك عن مهمة التحكيم. نشكرك على وقتك.');
      }
    } catch (e) {
      console.error('handleDecline error', e);
      setError('فشل تسجيل الاعتذار.');
    }
  };

  const handleSaveDraft = async () => {
    if (!token || !portalData?.rubric) return;
    setSavingDraft(true);
    setActionSuccess(null);
    try {
      const responses = portalData.rubric.criteria.map(c => ({
        criterion_id: c.id,
        score_value: scores[c.id] !== undefined ? scores[c.id] : 8,
        comments: criterionComments[c.id] || ''
      }));

      const comments = [];
      if (generalComment) {
        comments.push({ comment_type: 'AUTHOR_VISIBLE' as const, comment_text: generalComment });
      }
      if (confidentialComment) {
        comments.push({ comment_type: 'CONFIDENTIAL_TO_EDITOR' as const, comment_text: confidentialComment });
      }

      const res = await apiExternalSaveDraft(token, {
        recommendation,
        responses,
        comments
      });

      if (res) {
        setActionSuccess('تم حفظ مسودة التحكيم بنجاح.');
      }
    } catch (e) {
      console.error('handleSaveDraft error', e);
      setError('فشل حفظ المسودة.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!token || !portalData?.rubric) return;
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);
    try {
      const responses = portalData.rubric.criteria.map(c => ({
        criterion_id: c.id,
        score_value: scores[c.id] !== undefined ? scores[c.id] : 8,
        comments: criterionComments[c.id] || ''
      }));

      const comments = [];
      if (generalComment) {
        comments.push({ comment_type: 'AUTHOR_VISIBLE' as const, comment_text: generalComment });
      }
      if (confidentialComment) {
        comments.push({ comment_type: 'CONFIDENTIAL_TO_EDITOR' as const, comment_text: confidentialComment });
      }

      const res = await apiExternalSubmitReview(token, {
        recommendation,
        responses,
        comments
      });

      if (res) {
        await loadPortal();
        setActionSuccess('تم تسليم تقرير التحكيم العلمي بنجاح وبصورة نهائية. نشكركم على مساهمتكم الأكاديمية.');
      }
    } catch (e: any) {
      console.error('handleSubmitReview error', e);
      setError('تعذر تسليم التقرير. يرجى التأكد من استكمال كافة المعايير الإلزامية.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="dark min-h-screen bg-canvas flex items-center justify-center p-4">
        <div role="status" aria-live="polite" className="text-center text-secondary">
          <div aria-hidden="true" className="animate-spin rounded-full h-12 w-12 border-b-2 border-success mx-auto mb-4"></div>
          <h1 className="sr-only">بوابة التحكيم العلمي الخارجي</h1>
          <p className="text-lg">جارٍ التحقق من رابط التحكيم وتأمين الجلسة...</p>
        </div>
      </main>
    );
  }

  if (error || !portalData) {
    return (
      <main className="dark min-h-screen bg-canvas flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-surface border-danger/50">
          <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">تعذر الوصول إلى الجلسة</h1>
          <p className="text-muted mb-6">{error || 'الرابط غير صالح'}</p>
          <div className="text-xs text-muted">منصة بصيرة للبحث العلمي — بوابة التحكيم الخارجي الآمنة</div>
        </Card>
      </main>
    );
  }

  const isSubmitted = portalData.assignment_status === 'SUBMITTED';

  return (
    <main className="dark min-h-screen bg-canvas text-ink py-10 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-[var(--ds-navy)] p-6 rounded-2xl border border-subtle gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-action/10 border border-success/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-success" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">بوابة التحكيم العلمي الخارجي</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-success/20 text-success border border-success">جلسة مشفرة وآمنة</span>
              </div>
              <p className="text-sm text-muted">مرحباً د. {portalData.reviewer_name || 'المحكم العلمي'} — الجولة رقم {portalData.round_number}</p>
            </div>
          </div>
          {portalData.due_at && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-3 py-1.5 rounded-lg border border-warning/40">
              <Clock className="w-4 h-4" />
              <span>الموعد النهائي: {new Date(portalData.due_at).toLocaleDateString('ar-SA')}</span>
            </div>
          )}
        </div>

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-success/10 border border-success text-success text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Manuscript Overview Card */}
        <Card className="p-6 bg-[var(--ds-navy)] border-subtle space-y-4">
          <div className="flex items-center justify-between border-b border-subtle pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-path-identity" />
              <span>بيانات المخطوطة العلمية المحكمة</span>
            </h2>
            <span className="text-xs px-2.5 py-1 rounded bg-[var(--ds-path-identity)]/10 text-path-identity border border-[var(--ds-path-identity)]">
              {portalData.blind_type === 'DOUBLE_BLIND' ? 'تحكيم مزدوج التعمية (Double-Blind)' : 'تحكيم أحادي'}
            </span>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">عنوان البحث:</div>
            <div className="text-lg font-semibold text-success">{portalData.manuscript_title}</div>
          </div>
          {portalData.manuscript_abstract && (
            <div>
              <div className="text-xs text-muted mb-1">المستخلص الأكاديمي:</div>
              <p className="text-sm text-secondary bg-canvas/60 p-4 rounded-xl border border-subtle leading-relaxed">
                {portalData.manuscript_abstract}
              </p>
            </div>
          )}

          {token && portalData.assignment_status !== 'INVITED' && (
            <div className="pt-2">
              <a
                href={apiDownloadExternalManuscriptUrl(token)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--ds-path-identity)]/20 hover:bg-[var(--ds-path-identity)]/30 text-path-identity border border-[var(--ds-path-identity)]/40 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ملف المخطوطة الأصلي للتحكيم (نسخة محكمة آمنة)</span>
              </a>
            </div>
          )}
        </Card>

        {/* Invitation Acceptance / Conflict Declaration if still INVITED */}
        {portalData.assignment_status === 'INVITED' && (
          <Card className="p-6 bg-[var(--ds-navy)] border-warning/60 space-y-4">
            <h2 className="text-lg font-bold text-warning flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>تأكيد قبول التحكيم والإفصاح عن تضارب المصالح</span>
            </h2>
            <p className="text-sm text-secondary">
              يرجى الإقرار بعدم وجود تضارب في المصالح مع مؤلفي أو موضوع هذه المخطوطة العلمية قبل البدء بالتحكيم.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="coi" 
                  checked={conflictDeclared === 'NO_CONFLICT'} 
                  onChange={() => setConflictDeclared('NO_CONFLICT')}
                  className="text-success focus:ring-action"
                />
                <span>أقر بعدم وجود أي تضارب في المصالح مالي أو شخصي أو أكاديمي.</span>
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="coi" 
                  checked={conflictDeclared === 'POTENTIAL_CONFLICT'} 
                  onChange={() => setConflictDeclared('POTENTIAL_CONFLICT')}
                  className="text-success focus:ring-action"
                />
                <span>يوجد تضارب مصالح محتمل أو استيضاح يرجى مراجعته مع المحرر.</span>
              </label>
            </div>
            {conflictDeclared !== 'NO_CONFLICT' && (
              <textarea 
                value={conflictNotes}
                onChange={e => setConflictNotes(e.target.value)}
                placeholder="وضح طبيعة تضارب المصالح هنا..."
                className="w-full p-3 rounded-xl bg-canvas border border-subtle text-sm text-white"
                rows={3}
              />
            )}
            <div className="flex gap-4 pt-2">
              <Button onClick={handleAccept} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>قبول مهمة التحكيم والبدء</span>
              </Button>
              <Button onClick={handleDecline} variant="secondary" className="border-danger text-danger hover:bg-danger/10">
                <span>الاعتذار عن التحكيم</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Rubric Evaluation Form if ACCEPTED or IN_PROGRESS or SUBMITTED */}
        {portalData.assignment_status !== 'INVITED' && portalData.rubric && (
          <div className="space-y-6">
            <Card className="p-6 bg-[var(--ds-navy)] border-subtle space-y-6">
              <div className="flex items-center justify-between border-b border-subtle pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-success" />
                  <span>معايير نموذج التحكيم الأكاديمي ({portalData.rubric.name_ar})</span>
                </h2>
                {isSubmitted && (
                  <span className="text-xs px-3 py-1 rounded-full bg-success/10 text-success border border-success flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>تم تسليم التقرير ومقفول</span>
                  </span>
                )}
              </div>

              <div className="space-y-6">
                {portalData.rubric.criteria.map((criterion: PeerReviewCriterion, idx: number) => (
                  <div key={criterion.id} className="p-5 rounded-xl bg-canvas border border-subtle/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white text-base">
                        {idx + 1}. {criterion.title_ar}
                        {criterion.is_mandatory && <span className="text-danger text-xs mr-2">* إلزامي</span>}
                      </div>
                      <span className="text-xs text-muted bg-[var(--ds-navy)] px-2 py-1 rounded border border-subtle">
                        الوزن النسبي: {criterion.weight * 100}%
                      </span>
                    </div>
                    {criterion.desc_ar && <p className="text-xs text-muted leading-relaxed">{criterion.desc_ar}</p>}
                    
                    {/* Score Selector */}
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-xs text-muted ml-2">التقييم (من 10):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                          const currentVal = scores[criterion.id] !== undefined ? scores[criterion.id] : 8;
                          const isSelected = currentVal === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              disabled={isSubmitted}
                              onClick={() => setScores(prev => ({ ...prev, [criterion.id]: val }))}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-action text-ink ring-2 ring-action'
                                  : 'bg-[var(--ds-navy)] text-secondary hover:bg-surface border border-subtle'
                              } ${isSubmitted ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2">
                      <textarea
                        disabled={isSubmitted}
                        value={criterionComments[criterion.id] || ''}
                        onChange={e => setCriterionComments(prev => ({ ...prev, [criterion.id]: e.target.value }))}
                        placeholder="ملاحظات المحكم التفصيلية حول هذا المعيار..."
                        className="w-full p-3 rounded-lg bg-[var(--ds-navy)] border border-subtle text-xs text-secondary focus:ring-1 focus:ring-action"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* General Comments & Confidential Comments */}
              <div className="space-y-4 pt-4 border-t border-subtle">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-success" />
                    <span>ملاحظات عامة موجهة للباحث (مرئية للمؤلف):</span>
                  </label>
                  <textarea
                    disabled={isSubmitted}
                    value={generalComment}
                    onChange={e => setGeneralComment(e.target.value)}
                    placeholder="اكتب التقييم العام، نقاط القوة، والتعديلات المطلوبة من الباحث بالتفصيل..."
                    className="w-full p-4 rounded-xl bg-canvas border border-subtle text-sm text-secondary focus:ring-1 focus:ring-action leading-relaxed"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-warning" />
                    <span>ملاحظات سرية خاصة بهيئة التحرير ولجنة التحكيم (محجوبة عن المؤلف تماماً):</span>
                  </label>
                  <textarea
                    disabled={isSubmitted}
                    value={confidentialComment}
                    onChange={e => setConfidentialComment(e.target.value)}
                    placeholder="أي ملاحظات حساسة أو سرية تخص النزاهة الأكاديمية أو الأسباب الخاصة بالقرار..."
                    className="w-full p-4 rounded-xl bg-canvas border border-warning/40 text-sm text-secondary focus:ring-1 focus:ring-warning leading-relaxed"
                    rows={3}
                  />
                </div>
              </div>

              {/* Recommendation Picker */}
              <div className="space-y-3 pt-4 border-t border-subtle">
                <label className="block text-sm font-bold text-white">توصية المحكم النهائية (Recommendation):</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'ACCEPT', label: 'قبول النشر بدون تعديل', color: 'border-success text-success bg-success/10' },
                    { id: 'MINOR_REVISION', label: 'تعديلات طفيفة (Minor)', color: 'border-info text-path-publication bg-info/10' },
                    { id: 'MAJOR_REVISION', label: 'تعديلات جوهرية (Major)', color: 'border-warning text-warning bg-warning/10' },
                    { id: 'REJECT', label: 'رفض المخطوطة (Reject)', color: 'border-danger text-danger bg-danger/10' },
                  ].map(opt => {
                    const isSelected = recommendation === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => setRecommendation(opt.id as any)}
                        className={`p-3.5 rounded-xl border text-xs font-bold transition-all text-center ${
                          isSelected ? `${opt.color} ring-2 ring-action` : 'border-subtle bg-canvas text-muted hover:bg-[var(--ds-navy)]'
                        } ${isSubmitted ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              {!isSubmitted && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-subtle">
                  <Button
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting}
                    variant="secondary"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 border-default text-secondary hover:bg-surface"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingDraft ? 'جارٍ الحفظ...' : 'حفظ كمسودة والعودة لاحقاً'}</span>
                  </Button>

                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitting || savingDraft}
                    className="w-full sm:w-auto font-bold px-8 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'جارٍ تسليم التقرير...' : 'تسليم التقرير النهائي للمحرر'}</span>
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>
    </main>
  );
};
