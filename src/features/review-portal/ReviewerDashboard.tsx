import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { 
  CheckCircle2, 
  Send, 
  AlertTriangle, 
  FileText, 
  ListChecks, 
  Clock,
  Save,
  MessageSquare,
  Lock,
  Plus,
  RefreshCw,
  Award,
  Layers
} from 'lucide-react';
import { 
  apiGetMyReviewerAssignments, 
  apiListPeerReviewCases,
  apiGetPeerReviewCase,
  apiCreatePeerReviewCase,
  apiAcceptReviewAssignment,
  apiDeclineReviewAssignment,
  apiSaveReviewDraft,
  apiSubmitCompletedReview,
  apiRecordEditorialDecision,
  type ReviewerAssignmentData,
  type PeerReviewCaseData,
  type PeerReviewCriterion
} from '../../utils/api';

export const ReviewerDashboard: React.FC = () => {
  const { activeProject, language } = useProject();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'my_reviews' | 'editorial_cases' | 'instrument_referee'>('my_reviews');

  // ── State for My Assignments ───────────────────────────────────────────────
  const [assignments, setAssignments] = useState<ReviewerAssignmentData[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<ReviewerAssignmentData | null>(null);
  const [activeCaseDetails, setActiveCaseDetails] = useState<PeerReviewCaseData | null>(null);

  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>({});
  const [generalComment, setGeneralComment] = useState('');
  const [confidentialComment, setConfidentialComment] = useState('');
  const [recommendation, setRecommendation] = useState<'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT'>('MINOR_REVISION');
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // ── State for Editorial Cases ──────────────────────────────────────────────
  const [editorialCases, setEditorialCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseTitleAr, setNewCaseTitleAr] = useState('');
  const [newCaseTitleEn, setNewCaseTitleEn] = useState('');
  const [newCaseAbstractAr, setNewCaseAbstractAr] = useState('');
  const [newCaseBlindType, setNewCaseBlindType] = useState('DOUBLE_BLIND');

  // Editorial Decision Modal
  const [decisionCaseId, setDecisionCaseId] = useState<string | null>(null);
  const [editorialDecision, setEditorialDecision] = useState<'ACCEPTED' | 'REVISION_REQUIRED' | 'REJECTED'>('ACCEPTED');
  const [editorialNotes, setEditorialNotes] = useState('');

  // ── Load My Review Assignments ─────────────────────────────────────────────
  const loadMyAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const data = await apiGetMyReviewerAssignments();
      if (data) {
        setAssignments(data);
        if (data.length > 0 && !selectedAssignment) {
          selectAssignment(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load assignments', e);
    } finally {
      setLoadingAssignments(false);
    }
  }, [selectedAssignment]);

  const loadEditorialCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const data = await apiListPeerReviewCases();
      if (data) setEditorialCases(data);
    } catch (e) {
      console.error('Failed to load editorial cases', e);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    loadMyAssignments();
    loadEditorialCases();
  }, [loadMyAssignments, loadEditorialCases]);

  const selectAssignment = async (asg: ReviewerAssignmentData) => {
    setSelectedAssignment(asg);
    setLoadingCase(true);
    setActionMessage(null);
    try {
      const caseData = await apiGetPeerReviewCase(asg.case_id);
      if (caseData) {
        setActiveCaseDetails(caseData);
      }
      // Populate review submission if draft/submitted
      if (asg.submission) {
        setRecommendation(asg.submission.recommendation || 'MINOR_REVISION');
        const sc: Record<string, number> = {};
        const cm: Record<string, string> = {};
        asg.submission.responses.forEach(r => {
          if (r.score_value !== undefined) sc[r.criterion_id] = r.score_value;
          if (r.comments) cm[r.criterion_id] = r.comments;
        });
        setScores(sc);
        setCriterionComments(cm);

        const gen = asg.submission.comments.find(c => c.comment_type === 'AUTHOR_VISIBLE');
        if (gen) setGeneralComment(gen.comment_text);

        const conf = asg.submission.comments.find(c => c.comment_type === 'CONFIDENTIAL_TO_EDITOR');
        if (conf) setConfidentialComment(conf.comment_text);
      } else {
        setScores({});
        setCriterionComments({});
        setGeneralComment('');
        setConfidentialComment('');
      }
    } catch (e) {
      console.error('Failed to load case details', e);
    } finally {
      setLoadingCase(false);
    }
  };

  const handleAcceptAssignment = async () => {
    if (!selectedAssignment) return;
    try {
      const updated = await apiAcceptReviewAssignment(selectedAssignment.id, 'NO_CONFLICT');
      if (updated) {
        setSelectedAssignment(updated);
        await loadMyAssignments();
        setActionMessage({ type: 'success', text: isAr ? 'تم قبول مهمة التحكيم بنجاح.' : 'Review assignment accepted.' });
      }
    } catch (e) {
      console.error('handleAcceptAssignment error', e);
      setActionMessage({ type: 'error', text: isAr ? 'فشل قبول مهمة التحكيم.' : 'Failed to accept assignment.' });
    }
  };

  const handleDeclineAssignment = async () => {
    if (!selectedAssignment) return;
    try {
      const updated = await apiDeclineReviewAssignment(selectedAssignment.id, 'الاعتذار عن التحكيم لضيق الوقت');
      if (updated) {
        setSelectedAssignment(updated);
        await loadMyAssignments();
        setActionMessage({ type: 'success', text: isAr ? 'تم الاعتذار عن مهمة التحكيم.' : 'Assignment declined.' });
      }
    } catch (e) {
      console.error('handleDeclineAssignment error', e);
      setActionMessage({ type: 'error', text: isAr ? 'فشل تسجيل الاعتذار.' : 'Failed to decline assignment.' });
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedAssignment || !activeCaseDetails) return;
    const currentRound = activeCaseDetails.rounds.find(r => r.id === selectedAssignment.round_id);
    const rubricCriteria = currentRound?.rubric?.criteria || [];

    setSavingDraft(true);
    setActionMessage(null);
    try {
      const responses = rubricCriteria.map(c => ({
        criterion_id: c.id,
        score_value: scores[c.id] !== undefined ? scores[c.id] : 8,
        comments: criterionComments[c.id] || ''
      }));

      const comments = [];
      if (generalComment) comments.push({ comment_type: 'AUTHOR_VISIBLE' as const, comment_text: generalComment });
      if (confidentialComment) comments.push({ comment_type: 'CONFIDENTIAL_TO_EDITOR' as const, comment_text: confidentialComment });

      const res = await apiSaveReviewDraft(selectedAssignment.id, {
        recommendation,
        responses,
        comments
      });

      if (res) {
        setActionMessage({ type: 'success', text: isAr ? 'تم حفظ مسودة التحكيم بنجاح.' : 'Draft saved successfully.' });
        await loadMyAssignments();
      }
    } catch (e) {
      console.error('handleSaveDraft error', e);
      setActionMessage({ type: 'error', text: isAr ? 'فشل حفظ المسودة.' : 'Failed to save draft.' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedAssignment || !activeCaseDetails) return;
    const currentRound = activeCaseDetails.rounds.find(r => r.id === selectedAssignment.round_id);
    const rubricCriteria = currentRound?.rubric?.criteria || [];

    setSubmittingReview(true);
    setActionMessage(null);
    try {
      const responses = rubricCriteria.map(c => ({
        criterion_id: c.id,
        score_value: scores[c.id] !== undefined ? scores[c.id] : 8,
        comments: criterionComments[c.id] || ''
      }));

      const comments = [];
      if (generalComment) comments.push({ comment_type: 'AUTHOR_VISIBLE' as const, comment_text: generalComment });
      if (confidentialComment) comments.push({ comment_type: 'CONFIDENTIAL_TO_EDITOR' as const, comment_text: confidentialComment });

      const res = await apiSubmitCompletedReview(selectedAssignment.id, {
        recommendation,
        responses,
        comments
      });

      if (res) {
        setActionMessage({ type: 'success', text: isAr ? 'تم تسليم تقرير التحكيم بنجاح وبصورة نهائية.' : 'Review submitted successfully.' });
        await loadMyAssignments();
        if (selectedAssignment) {
          selectAssignment({ ...selectedAssignment, status: 'SUBMITTED' });
        }
      }
    } catch (e: any) {
      console.error('handleSubmitReview error', e);
      setActionMessage({ type: 'error', text: isAr ? 'تعذر تسليم التقرير. يرجى استكمال كافة المعايير الإلزامية.' : 'Failed to submit review.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCreateNewCase = async () => {
    if (!newCaseTitleAr) return;
    try {
      const res = await apiCreatePeerReviewCase({
        title_ar: newCaseTitleAr,
        title_en: newCaseTitleEn || newCaseTitleAr,
        abstract_ar: newCaseAbstractAr,
        blind_type: newCaseBlindType,
        project_id: activeProject?.id
      });
      if (res) {
        setShowNewCaseModal(false);
        setNewCaseTitleAr('');
        setNewCaseTitleEn('');
        setNewCaseAbstractAr('');
        await loadEditorialCases();
        setActionMessage({ type: 'success', text: isAr ? 'تم إنشاء ملف التحكيم وبدء الجولة الأولى بنجاح.' : 'Review case created.' });
      }
    } catch (e) {
      console.error('handleCreateNewCase error', e);
      setActionMessage({ type: 'error', text: isAr ? 'فشل إنشاء ملف التحكيم.' : 'Failed to create case.' });
    }
  };

  const handleRecordEditorialDecision = async () => {
    if (!decisionCaseId || !editorialNotes) return;
    try {
      const res = await apiRecordEditorialDecision(decisionCaseId, editorialDecision, editorialNotes);
      if (res) {
        setDecisionCaseId(null);
        setEditorialNotes('');
        await loadEditorialCases();
        setActionMessage({ type: 'success', text: isAr ? 'تم تسجيل القرار الأكاديمي النهائي بنجاح.' : 'Editorial decision recorded.' });
      }
    } catch (e) {
      console.error('handleRecordEditorialDecision error', e);
      setActionMessage({ type: 'error', text: isAr ? 'فشل تسجيل القرار.' : 'Failed to record decision.' });
    }
  };

  const currentRound = activeCaseDetails?.rounds.find(r => r.id === selectedAssignment?.round_id);
  const rubric = currentRound?.rubric;
  const isSubmitted = selectedAssignment?.status === 'SUBMITTED';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--ds-surface-card)] p-6 rounded-2xl border border-[var(--ds-border-subtle)] shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-[var(--ds-text-primary)]">
              {isAr ? 'منظومة التحكيم العلمي ومراجعة الأقران' : 'Academic Peer Review System'}
            </h2>
            <span className="text-xs px-3 py-1 rounded-full bg-action/10 text-success font-semibold border border-success/20">
              {isAr ? 'إصدار مؤسسي معتمد' : 'Enterprise Verified'}
            </span>
          </div>
          <p className="text-sm text-[var(--ds-text-muted)] mt-1">
            {isAr 
              ? 'إدارة لجان التحكيم، مراجعة المخطوطات العلمية، وضمان معايير النزاهة الأكاديمية والتعمية المزدوجة' 
              : 'Manage peer review rounds, referee academic manuscripts, and ensure double-blind integrity'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[var(--ds-surface-sunken)] p-1 rounded-xl border border-[var(--ds-border-subtle)]">
          <button
            onClick={() => setActiveTab('my_reviews')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'my_reviews'
                ? 'bg-[var(--ds-surface-card)] text-success shadow-sm'
                : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]'
            }`}
          >
            {isAr ? 'مهام التحكيم المسندة إليّ' : 'My Review Assignments'}
          </button>
          <button
            onClick={() => setActiveTab('editorial_cases')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'editorial_cases'
                ? 'bg-[var(--ds-surface-card)] text-success shadow-sm'
                : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]'
            }`}
          >
            {isAr ? 'متابعة ملفات التحكيم (هيئة التحرير)' : 'Editorial Review Cases'}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${
          actionMessage.type === 'success'
            ? 'bg-action/10 text-success border-success/20'
            : 'bg-danger/10 text-danger border-danger/20'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* ── TAB 1: MY REVIEW ASSIGNMENTS ──────────────────────────────────────── */}
      {activeTab === 'my_reviews' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Sidebar: Assignments List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-success" />
                <span>{isAr ? 'قائمة المهام المسندة' : 'Assigned Manuscripts'}</span>
              </h2>
              <button 
                onClick={loadMyAssignments}
                className="text-xs text-[var(--ds-text-muted)] hover:text-success flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>

            {loadingAssignments ? (
              <div className="p-8 text-center text-sm text-[var(--ds-text-muted)]">
                {isAr ? 'جارٍ تحميل المهام...' : 'Loading assignments...'}
              </div>
            ) : assignments.length === 0 ? (
              <Card className="p-6 text-center text-[var(--ds-text-muted)] text-sm">
                <FileText className="w-10 h-10 mx-auto mb-2 text-muted opacity-50" />
                <p>{isAr ? 'لا توجد مهام تحكيم مسندة إليك حالياً.' : 'No review assignments found.'}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {assignments.map(asg => {
                  const isSelected = selectedAssignment?.id === asg.id;
                  return (
                    <div
                      key={asg.id}
                      onClick={() => selectAssignment(asg)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[var(--ds-surface-card)] border-success ring-1 ring-action'
                          : 'bg-[var(--ds-surface-sunken)] border-[var(--ds-border-subtle)] hover:border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          asg.status === 'SUBMITTED' ? 'bg-action/10 text-success border border-success/20' :
                          asg.status === 'ACCEPTED' ? 'bg-info/10 text-path-publication border border-info/20' :
                          asg.status === 'DECLINED' ? 'bg-danger/10 text-danger border border-danger/20' :
                          'bg-warning/10 text-warning border border-warning/20'
                        }`}>
                          {asg.status}
                        </span>
                        {asg.due_at && (
                          <span className="text-xs text-[var(--ds-text-muted)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(asg.due_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-[var(--ds-text-primary)] line-clamp-2">
                        {asg.case_id}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Area: Active Review Form & Manuscript */}
          <div className="lg:col-span-8 space-y-6">
            {loadingCase ? (
              <div className="p-12 text-center text-sm text-[var(--ds-text-muted)]">
                {isAr ? 'جارٍ تحميل تفاصيل المخطوطة والنموذج...' : 'Loading manuscript details...'}
              </div>
            ) : !selectedAssignment || !activeCaseDetails ? (
              <Card className="p-12 text-center text-[var(--ds-text-muted)] text-sm">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{isAr ? 'اختر مهمة تحكيم من القائمة للبدء بالتقييم' : 'Select a review assignment to begin evaluation'}</p>
              </Card>
            ) : (
              <div className="space-y-6">
                
                {/* Manuscript Card */}
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-3">
                    <h3 className="text-base font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
                      <FileText className="w-5 h-5 text-success" />
                      <span>{activeCaseDetails.title_ar}</span>
                    </h3>
                    <span className="text-xs px-2.5 py-1 rounded bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] border border-[var(--ds-border-subtle)]">
                      {activeCaseDetails.blind_type}
                    </span>
                  </div>
                  {activeCaseDetails.abstract_ar && (
                    <p className="text-sm text-[var(--ds-text-secondary)] bg-[var(--ds-surface-sunken)] p-4 rounded-xl leading-relaxed">
                      {activeCaseDetails.abstract_ar}
                    </p>
                  )}
                </Card>

                {/* Invitation Action if INVITED */}
                {selectedAssignment.status === 'INVITED' && (
                  <Card className="p-6 bg-warning/5 border-warning/20 space-y-4">
                    <h3 className="text-base font-bold text-warning flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span>{isAr ? 'دعوة تحكيم جديدة — يرجى تأكيد القبول أو الاعتذار' : 'New Review Invitation'}</span>
                    </h3>
                    <p className="text-sm text-[var(--ds-text-secondary)]">
                      {isAr ? 'يرجى مراجعة ملخص البحث أعلاه وتأكيد خلو التحكيم من أي تضارب للمصالح قبل البدء.' : 'Please confirm acceptance and absence of conflict of interest.'}
                    </p>
                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleAcceptAssignment} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isAr ? 'قبول التحكيم والبدء' : 'Accept Assignment'}</span>
                      </Button>
                      <Button onClick={handleDeclineAssignment} variant="secondary" className="border-danger text-danger hover:bg-danger/10">
                        <span>{isAr ? 'الاعتذار' : 'Decline'}</span>
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Rubric Review Form if ACCEPTED or IN_PROGRESS or SUBMITTED */}
                {selectedAssignment.status !== 'INVITED' && rubric && (
                  <Card className="p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-3">
                      <h3 className="text-base font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-success" />
                        <span>{rubric.name_ar}</span>
                      </h3>
                      {isSubmitted && (
                        <span className="text-xs px-3 py-1 rounded-full bg-action/10 text-success border border-success/20 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{isAr ? 'تم تسليم التقرير بنجاح' : 'Submitted'}</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-6">
                      {rubric.criteria.map((criterion: PeerReviewCriterion, idx: number) => (
                        <div key={criterion.id} className="p-4 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border-subtle)] space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-[var(--ds-text-primary)]">
                              {idx + 1}. {criterion.title_ar}
                              {criterion.is_mandatory && <span className="text-danger text-xs mr-2">*</span>}
                            </div>
                            <span className="text-xs text-[var(--ds-text-muted)] bg-[var(--ds-surface-card)] px-2 py-0.5 rounded border border-[var(--ds-border-subtle)]">
                              {criterion.weight * 100}%
                            </span>
                          </div>
                          {criterion.desc_ar && <p className="text-xs text-[var(--ds-text-muted)]">{criterion.desc_ar}</p>}

                          {/* Score Selector */}
                          <div className="flex items-center gap-2 pt-2">
                            <span className="text-xs text-[var(--ds-text-muted)] ml-2">{isAr ? 'الدرجة (من 10):' : 'Score (1-10):'}</span>
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
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                      isSelected
                                        ? 'bg-action text-on-action ring-2 ring-[var(--ds-action-fill)]'
                                        : 'bg-[var(--ds-surface-card)] text-[var(--ds-text-secondary)] hover:bg-surface-subtle border border-[var(--ds-border-subtle)]'
                                    } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                              placeholder={isAr ? 'ملاحظات المحكم التفصيلية حول هذا المعيار...' : 'Criterion specific comments...'}
                              className="w-full p-2.5 rounded-lg bg-[var(--ds-surface-card)] border border-[var(--ds-border-subtle)] text-xs text-[var(--ds-text-primary)] focus:ring-1 focus:ring-action"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* General and Confidential Comments */}
                    <div className="space-y-4 pt-4 border-t border-[var(--ds-border-subtle)]">
                      <div>
                        <label className="block text-xs font-bold text-[var(--ds-text-primary)] mb-1.5 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-success" />
                          <span>{isAr ? 'ملاحظات عامة موجهة للمؤلف (مرئية للباحث):' : 'Comments to Author:'}</span>
                        </label>
                        <textarea
                          disabled={isSubmitted}
                          value={generalComment}
                          onChange={e => setGeneralComment(e.target.value)}
                          placeholder={isAr ? 'اكتب الملاحظات والتعديلات المطلوبة من الباحث بالتفصيل...' : 'Write detailed feedback for the author...'}
                          className="w-full p-3 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border-subtle)] text-xs text-[var(--ds-text-primary)] focus:ring-1 focus:ring-action leading-relaxed"
                          rows={4}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-warning mb-1.5 flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          <span>{isAr ? 'ملاحظات سرية لهيئة التحرير (محجوبة تماماً عن المؤلف):' : 'Confidential Comments to Editor:'}</span>
                        </label>
                        <textarea
                          disabled={isSubmitted}
                          value={confidentialComment}
                          onChange={e => setConfidentialComment(e.target.value)}
                          placeholder={isAr ? 'ملاحظات خاصة بهيئة التحرير ولجنة التحكيم...' : 'Confidential editorial notes...'}
                          className="w-full p-3 rounded-xl bg-[var(--ds-surface-sunken)] border border-warning/20 text-xs text-[var(--ds-text-primary)] focus:ring-1 focus:ring-warning leading-relaxed"
                          rows={2}
                        />
                      </div>
                    </div>

                    {/* Recommendation Picker */}
                    <div className="space-y-3 pt-4 border-t border-[var(--ds-border-subtle)]">
                      <label className="block text-xs font-bold text-[var(--ds-text-primary)]">
                        {isAr ? 'توصية المحكم الأكاديمية (Recommendation):' : 'Reviewer Recommendation:'}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { id: 'ACCEPT', label: isAr ? 'قبول النشر' : 'Accept', color: 'border-success text-success bg-action/10' },
                          { id: 'MINOR_REVISION', label: isAr ? 'تعديلات طفيفة' : 'Minor Revision', color: 'border-info text-path-publication bg-info/10' },
                          { id: 'MAJOR_REVISION', label: isAr ? 'تعديلات جوهرية' : 'Major Revision', color: 'border-warning text-warning bg-warning/10' },
                          { id: 'REJECT', label: isAr ? 'رفض المخطوطة' : 'Reject', color: 'border-danger text-danger bg-danger/10' },
                        ].map(opt => {
                          const isSelected = recommendation === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isSubmitted}
                              onClick={() => setRecommendation(opt.id as any)}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                                isSelected ? `${opt.color} ring-2 ring-action` : 'border-[var(--ds-border-subtle)] bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-card)]'
                              } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    {!isSubmitted && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--ds-border-subtle)]">
                        <Button
                          onClick={handleSaveDraft}
                          disabled={savingDraft || submittingReview}
                          variant="secondary"
                          className="w-full sm:w-auto flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          <span>{savingDraft ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ كمسودة' : 'Save Draft')}</span>
                        </Button>

                        <Button
                          onClick={handleSubmitReview}
                          disabled={submittingReview || savingDraft}
                          className="w-full sm:w-auto font-bold px-8 flex items-center justify-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>{submittingReview ? (isAr ? 'جارٍ التسليم...' : 'Submitting...') : (isAr ? 'تسليم التقرير النهائي' : 'Submit Review')}</span>
                        </Button>
                      </div>
                    )}
                  </Card>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: EDITORIAL REVIEW CASES OVERSIGHT ───────────────────────────── */}
      {activeTab === 'editorial_cases' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
                <Layers className="w-5 h-5 text-success" />
                <span>{isAr ? 'ملفات التحكيم العلمي والمخطوطات قيد المراجعة' : 'Editorial Peer Review Cases'}</span>
              </h2>
              <p className="text-xs text-[var(--ds-text-muted)] mt-0.5">
                {isAr ? 'متابعة جولات التحكيم، توزيع المحكمين، وتسجيل القرارات الأكاديمية النهائية' : 'Oversee rounds, reviewer assignments, and record human decisions'}
              </p>
            </div>
            <Button
              onClick={() => setShowNewCaseModal(true)}
              className="flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'فتح ملف تحكيم جديد' : 'New Review Case'}</span>
            </Button>
          </div>

          {loadingCases ? (
            <div className="p-12 text-center text-sm text-[var(--ds-text-muted)]">
              {isAr ? 'جارٍ تحميل ملفات التحكيم...' : 'Loading cases...'}
            </div>
          ) : editorialCases.length === 0 ? (
            <Card className="p-12 text-center text-[var(--ds-text-muted)] text-sm">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{isAr ? 'لا توجد ملفات تحكيم مسجلة حالياً.' : 'No peer review cases found.'}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editorialCases.map(c => (
                <Card key={c.id} className="p-6 space-y-4 hover:border-success/50 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono text-[var(--ds-text-muted)]">{c.id}</span>
                      <h3 className="text-base font-bold text-[var(--ds-text-primary)] mt-1">{c.title_ar}</h3>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      c.status === 'DECIDED' ? 'bg-action/10 text-success border border-success/20' :
                      c.status === 'REVISION_REQUESTED' ? 'bg-warning/10 text-warning border border-warning/20' :
                      'bg-info/10 text-path-publication border border-info/20'
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--ds-text-muted)] bg-[var(--ds-surface-sunken)] p-3 rounded-xl">
                    <span>{isAr ? `الجولة الحالية: ${c.current_round_number}` : `Round: ${c.current_round_number}`}</span>
                    <span>{isAr ? `المحكمون النشطون: ${c.active_assignments_count}` : `Active: ${c.active_assignments_count}`}</span>
                    <span>{isAr ? `المراجعات المكتملة: ${c.completed_reviews_count}` : `Completed: ${c.completed_reviews_count}`}</span>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[var(--ds-border-subtle)]">
                    <Button
                      onClick={() => setDecisionCaseId(c.id)}
                      variant="secondary"
                      className="w-full text-xs flex items-center justify-center gap-1.5 border-success/30 text-success hover:bg-action/10"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تسجيل قرار هيئة التحرير' : 'Record Final Decision'}</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEW CASE MODAL ────────────────────────────────────────────────────── */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-[var(--ds-surface-overlay)] z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 space-y-4 bg-[var(--ds-surface-card)]">
            <h3 className="text-lg font-bold text-[var(--ds-text-primary)]">
              {isAr ? 'إنشاء ملف تحكيم علمي جديد' : 'Create New Peer Review Case'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)] mb-1">
                  {isAr ? 'عنوان البحث / المخطوطة (بالعربية):' : 'Title (Arabic):'}
                </label>
                <input
                  type="text"
                  value={newCaseTitleAr}
                  onChange={e => setNewCaseTitleAr(e.target.value)}
                  placeholder={isAr ? 'مثال: أثر الذكاء الاصطناعي على مهارات البحث...' : 'Title in Arabic...'}
                  className="w-full p-3 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border-subtle)] text-sm text-[var(--ds-text-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)] mb-1">
                  {isAr ? 'نوع التعمية والخصوصية:' : 'Blind Review Mode:'}
                </label>
                <select
                  value={newCaseBlindType}
                  onChange={e => setNewCaseBlindType(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border-subtle)] text-sm text-[var(--ds-text-primary)]"
                >
                  <option value="DOUBLE_BLIND">{isAr ? 'تحكيم مزدوج التعمية (Double-Blind) — موصى به' : 'Double-Blind'}</option>
                  <option value="SINGLE_BLIND">{isAr ? 'تحكيم أحادي التعمية (Single-Blind)' : 'Single-Blind'}</option>
                  <option value="OPEN">{isAr ? 'تحكيم مفتوح (Open Review)' : 'Open Review'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)] mb-1">
                  {isAr ? 'المستخلص الأكاديمي (اختياري):' : 'Abstract (Optional):'}
                </label>
                <textarea
                  value={newCaseAbstractAr}
                  onChange={e => setNewCaseAbstractAr(e.target.value)}
                  placeholder={isAr ? 'المستخلص البحثي...' : 'Abstract...'}
                  className="w-full p-3 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border-subtle)] text-sm text-[var(--ds-text-primary)]"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--ds-border-subtle)]">
              <Button onClick={() => setShowNewCaseModal(false)} variant="secondary">
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleCreateNewCase}>
                {isAr ? 'إنشاء وبدء الجولة 1' : 'Create Case'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── EDITORIAL DECISION MODAL ─────────────────────────────────────────── */}
      {decisionCaseId && (
        <div className="fixed inset-0 bg-[var(--ds-surface-overlay)] z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 space-y-4 bg-[var(--ds-surface-card)]">
            <h3 className="text-lg font-bold text-[var(--ds-text-primary)] flex items-center gap-2">
              <Award className="w-5 h-5 text-success" />
              <span>{isAr ? 'تسجيل قرار هيئة التحرير / اللجنة الأكاديمية' : 'Record Editorial Decision'}</span>
            </h3>
            <p className="text-xs text-[var(--ds-text-muted)]">
              {isAr ? 'وفقاً لمبدأ الحوكمة الأكاديمية (Human-in-the-Loop)، هذا القرار يصدر حصرياً من قبل عضو اللجنة البشري.' : 'Human-in-the-loop editorial decision.'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)] mb-1">
                  {isAr ? 'القرار النهائي:' : 'Final Decision:'}
                </label>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2">
                  {[
                    { id: 'ACCEPTED', label: isAr ? 'قبول للنشر' : 'Accepted', color: 'border-success text-success bg-action/10' },
                    { id: 'REVISION_REQUIRED', label: isAr ? 'طلب تعديل' : 'Revision Req.', color: 'border-warning text-warning bg-warning/10' },
                    { id: 'REJECTED', label: isAr ? 'رفض' : 'Rejected', color: 'border-danger text-danger bg-danger/10' }
                  ].map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setEditorialDecision(d.id as any)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        editorialDecision === d.id ? `${d.color} ring-2 ring-action` : 'border-[var(--ds-border-subtle)] bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)] mb-1">
                  {isAr ? 'حيثيات ومبررات القرار الأكاديمي:' : 'Decision Rationale / Notes:'}
                </label>
                <textarea
                  value={editorialNotes}
                  onChange={e => setEditorialNotes(e.target.value)}
                  placeholder={isAr ? 'بيان أسباب القرار وملاحظات اللجنة للباحث...' : 'Detailed rationale...'}
                  className="w-full p-3 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border-subtle)] text-sm text-[var(--ds-text-primary)]"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--ds-border-subtle)]">
              <Button onClick={() => setDecisionCaseId(null)} variant="secondary">
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleRecordEditorialDecision}>
                {isAr ? 'اعتماد وتسجيل القرار' : 'Confirm Decision'}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};
