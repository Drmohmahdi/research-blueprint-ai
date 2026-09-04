import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { ROUTES } from '../router/routes';
import { BookOpen, Cloud, Database, RefreshCw, Trash2, CheckCircle2, AlertCircle, RotateCcw, Search } from 'lucide-react';
import { Button, IconButton } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { EmptyState } from '../design-system/components/Feedback';
import {
  apiGetLiteratureSynthesis,
  apiAddLiteratureStudy,
  apiUpdateLiteratureStudy,
  apiDeleteLiteratureStudy,
  apiSyncLiteratureStudies,
  apiImportLiteratureStudies,
  type LiteratureStudyItem
} from '../utils/api';
import { researchStorage } from '../utils/researchStorage';

export interface ExtractedStudy {
  id: string;
  author: string;
  year: number;
  sampleSize: number;
  effectSize: number; // Cohen's d
  ciLower: number;
  ciUpper: number;
  source: 'manual' | 'crossref' | 'pubmed';
  doi?: string;
  notes?: string;
}

const asStudySource = (value: unknown): ExtractedStudy['source'] => (
  value === 'crossref' || value === 'pubmed' ? value : 'manual'
);

const mapRemoteStudy = (s: LiteratureStudyItem): ExtractedStudy => ({
  id: s.id,
  author: s.author,
  year: s.year,
  sampleSize: s.sampleSize,
  effectSize: s.effectSize,
  ciLower: s.ciLower,
  ciUpper: s.ciUpper,
  source: asStudySource(s.source),
  doi: s.doi,
  notes: s.notes
});

const getLiteratureStorageKey = (projectId: string) => `rb_literature_studies_${projectId}`;

const loadLocalStudies = (projectId: string): ExtractedStudy[] => {
  try {
    const stored = researchStorage.getItem(getLiteratureStorageKey(projectId));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const validStudies = parsed.filter((study): study is ExtractedStudy => {
      if (!study || typeof study !== 'object') return false;
      const candidate = study as Partial<ExtractedStudy>;
      const sampleSize = candidate.sampleSize;
      const ciLower = candidate.ciLower;
      const ciUpper = candidate.ciUpper;
      return typeof candidate.id === 'string'
        && typeof candidate.author === 'string'
        && (candidate.source === 'manual' || candidate.source === 'crossref' || candidate.source === 'pubmed')
        && Number.isInteger(candidate.year)
        && typeof sampleSize === 'number'
        && Number.isInteger(sampleSize)
        && sampleSize > 0
        && Number.isFinite(candidate.effectSize)
        && typeof ciLower === 'number'
        && typeof ciUpper === 'number'
        && Number.isFinite(ciLower)
        && Number.isFinite(ciUpper)
        && ciLower <= ciUpper;
    });
    return validStudies;
  } catch {
    return [];
  }
};

const saveLocalStudies = (projectId: string, studies: ExtractedStudy[]) => {
  try {
    researchStorage.setItem(getLiteratureStorageKey(projectId), JSON.stringify(studies));
  } catch (e) {
    console.warn('Failed to save studies to localStorage', e);
  }
};

export const LiteratureSynthesizer: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language, isSecureMode, user } = useProject();
  
  const [studies, setStudies] = useState<ExtractedStudy[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [studyDraft, setStudyDraft] = useState({ author: '', year: '', sampleSize: '', effectSize: '', ciLower: '', ciUpper: '' });
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, { sampleSize: string; effectSize: string; ciLower: string; ciUpper: string }>>({});
  const [importQuery, setImportQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const projectId = activeProject?.id;
  const activeProjectIdRef = useRef<string | undefined>(projectId);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    activeProjectIdRef.current = projectId;
  }, [projectId]);

  const fetchProjectStudies = useCallback(async (pId: string) => {
    const currentSeq = ++requestSequenceRef.current;
    if (isSecureMode) {
      setIsSyncing(true);
      setSyncStatus('idle');
      try {
        const remoteData = await apiGetLiteratureSynthesis(pId);
        // Discard if project switched or a newer request started
        if (activeProjectIdRef.current !== pId || requestSequenceRef.current !== currentSeq) {
          return;
        }

        if (remoteData && remoteData.studies) {
          const mappedStudies: ExtractedStudy[] = remoteData.studies.map(mapRemoteStudy);

          if (mappedStudies.length === 0) {
            // Check if legacy local data exists and auto-migrate safely
            const localStudies = loadLocalStudies(pId);
            if (localStudies.length > 0) {
              const syncResult = await apiSyncLiteratureStudies(pId, localStudies as LiteratureStudyItem[]);
              if (activeProjectIdRef.current !== pId || requestSequenceRef.current !== currentSeq) return;
              if (syncResult && syncResult.studies) {
                setStudies(syncResult.studies.map(mapRemoteStudy));
                saveLocalStudies(pId, localStudies);
                setSyncStatus('success');
                setIsSyncing(false);
                return;
              }
            }
          }

          setStudies(mappedStudies);
          saveLocalStudies(pId, mappedStudies);
          setSyncStatus('success');
        } else {
          // Fallback to local
          const local = loadLocalStudies(pId);
          setStudies(local);
          setSyncStatus('error');
        }
      } catch (err) {
        console.error('Failed to load studies from server', err);
        if (activeProjectIdRef.current === pId && requestSequenceRef.current === currentSeq) {
          setStudies(loadLocalStudies(pId));
          setSyncStatus('error');
        }
      } finally {
        if (activeProjectIdRef.current === pId && requestSequenceRef.current === currentSeq) {
          setIsSyncing(false);
        }
      }
    } else {
      // Demo Mode: Local Storage
      setStudies(loadLocalStudies(pId));
      setSyncStatus('idle');
    }
  }, [isSecureMode]);

  useEffect(() => {
    if (!projectId) {
      setStudies([]);
      return;
    }
    fetchProjectStudies(projectId);
    setStudyDraft({ author: '', year: '', sampleSize: '', effectSize: '', ciLower: '', ciUpper: '' });
    setImportQuery('');
    setSelectedFile(null);
    setFileError(null);
  }, [projectId, fetchProjectStudies]);

  if (!activeProject) {
    return (
      <EmptyState
        illustration={<BookOpen size={40} />}
        title={language === 'ar' ? 'لا يوجد مشروع نشط' : 'No active project'}
        description={language === 'ar' ? 'أنشئ مشروعًا من اختيار المسار لتوليف الدراسات وحفظ الاستيراد على الخادم.' : 'Create a project from path selection to synthesize literature and save imports on the server.'}
        actionButton={<Button type="button" variant="primary" size="sm" onClick={() => navigate(ROUTES.PATHS)}>{language === 'ar' ? 'اختيار مسار البحث' : 'Choose a research path'}</Button>}
      />
    );
  }

  // Pool effects using inverse-variance weights derived from each study's CI.
  const validStudies = studies.filter(study => Number.isFinite(study.sampleSize) && study.sampleSize > 0 && Number.isFinite(study.effectSize) && Number.isFinite(study.ciLower) && Number.isFinite(study.ciUpper) && study.ciUpper > study.ciLower);
  const totalN = validStudies.reduce((sum, s) => sum + s.sampleSize, 0);
  const weightedStudies = validStudies.map(study => {
    const standardError = (study.ciUpper - study.ciLower) / (2 * 1.96);
    return { study, weight: standardError > 0 ? 1 / (standardError * standardError) : 0 };
  }).filter(item => item.weight > 0);
  const totalWeight = weightedStudies.reduce((sum, item) => sum + item.weight, 0);
  const pooledES = totalWeight > 0
    ? parseFloat((weightedStudies.reduce((sum, item) => sum + item.study.effectSize * item.weight, 0) / totalWeight).toFixed(2))
    : 0;
  const pooledCI = totalWeight > 0 ? 1.96 / Math.sqrt(totalWeight) : 0;
  const pooledLower = parseFloat((pooledES - pooledCI).toFixed(2));
  const pooledUpper = parseFloat((pooledES + pooledCI).toFixed(2));
  const heterogeneityQ = totalWeight > 0
    ? weightedStudies.reduce((sum, item) => sum + item.weight * (item.study.effectSize - pooledES) ** 2, 0)
    : 0;
  const heterogeneityI2 = weightedStudies.length > 1
    ? Math.max(0, Math.min(100, ((heterogeneityQ - (weightedStudies.length - 1)) / heterogeneityQ) * 100 || 0))
    : 0;
  const chartColor = {
    primary: 'var(--ds-primary)',
    success: 'var(--ds-success)',
    muted: 'var(--ds-text-muted)',
    secondary: 'var(--ds-text-secondary)',
    border: 'var(--ds-border-default)'
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(null);
    setFileError(null);
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const maxFileSize = 20 * 1024 * 1024;
    if (!isPdf) {
      setFileError(language === 'ar' ? 'صيغة الملف غير مدعومة. اختر ملف PDF.' : 'Unsupported file format. Choose a PDF file.');
      return;
    }
    if (file.size === 0 || file.size > maxFileSize) {
      setFileError(language === 'ar' ? 'يجب أن يكون ملف PDF غير فارغ وألا يتجاوز 20 ميجابايت.' : 'The PDF must be non-empty and no larger than 20 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleRemoveStudy = async (studyId: string) => {
    const pId = activeProject.id;
    const nextStudies = studies.filter(study => study.id !== studyId);
    setStudies(nextStudies);
    saveLocalStudies(pId, nextStudies);

    if (isSecureMode) {
      setIsSyncing(true);
      try {
        const ok = await apiDeleteLiteratureStudy(pId, studyId);
        if (activeProjectIdRef.current !== pId) return;
        if (ok) {
          setSyncStatus('success');
        } else {
          setSyncStatus('error');
        }
      } catch (err) {
        console.error('Failed to delete study on server', err);
        if (activeProjectIdRef.current === pId) {
          setSyncStatus('error');
        }
      } finally {
        if (activeProjectIdRef.current === pId) {
          setIsSyncing(false);
        }
      }
    }
  };

  const isBibliographicOnly = (study: ExtractedStudy) =>
    study.ciUpper <= study.ciLower || (study.sampleSize <= 1 && study.effectSize === 0);

  const handleCompleteEvidence = async (study: ExtractedStudy) => {
    const pId = activeProject.id;
    const draft = evidenceDrafts[study.id] || { sampleSize: '', effectSize: '', ciLower: '', ciUpper: '' };
    const sampleSize = Number(draft.sampleSize);
    const effectSize = Number(draft.effectSize);
    const ciLower = Number(draft.ciLower);
    const ciUpper = Number(draft.ciUpper);
    if (!Number.isInteger(sampleSize) || sampleSize <= 1 || !Number.isFinite(effectSize) || !Number.isFinite(ciLower) || !Number.isFinite(ciUpper) || ciLower > effectSize || effectSize > ciUpper || ciLower >= ciUpper) {
      setFileError(language === 'ar' ? 'أدخل حجم عينة أكبر من 1 وحجم أثر داخل فاصل ثقة صالح لدخول التحليل التلوي.' : 'Enter a sample size greater than 1 and an effect size inside a valid confidence interval to enter the meta-analysis.');
      return;
    }
    const nextStudy: ExtractedStudy = { ...study, sampleSize, effectSize, ciLower, ciUpper };
    const nextStudies = studies.map(item => item.id === study.id ? nextStudy : item);
    setStudies(nextStudies);
    saveLocalStudies(pId, nextStudies);
    setEvidenceDrafts(current => {
      const next = { ...current };
      delete next[study.id];
      return next;
    });
    setFileError(null);
    if (!isSecureMode) return;
    setIsSyncing(true);
    try {
      const updated = await apiUpdateLiteratureStudy(pId, study.id, { sampleSize, effectSize, ciLower, ciUpper });
      if (activeProjectIdRef.current !== pId) return;
      if (updated) {
        setStudies(current => current.map(item => item.id === study.id ? mapRemoteStudy(updated) : item));
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Failed to update study evidence on server', err);
      if (activeProjectIdRef.current === pId) setSyncStatus('error');
    } finally {
      if (activeProjectIdRef.current === pId) setIsSyncing(false);
    }
  };

  const handleAddStudy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pId = activeProject.id;
    const year = Number(studyDraft.year);
    const sampleSize = Number(studyDraft.sampleSize);
    const effectSize = Number(studyDraft.effectSize);
    const ciLower = Number(studyDraft.ciLower);
    const ciUpper = Number(studyDraft.ciUpper);
    if (!studyDraft.author.trim() || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() || !Number.isInteger(sampleSize) || sampleSize <= 0 || !Number.isFinite(effectSize) || !Number.isFinite(ciLower) || !Number.isFinite(ciUpper) || ciLower > effectSize || effectSize > ciUpper) {
      setFileError(language === 'ar' ? 'أدخل مرجع الدراسة والسنة وحجم عينة صحيحين وحجم أثر داخل فاصل الثقة.' : 'Enter a reference, valid year and sample size, and an effect size inside its confidence interval.');
      return;
    }

    const newStudyId = `study-${Date.now()}`;
    const newStudy: ExtractedStudy = {
      id: newStudyId,
      author: studyDraft.author.trim(),
      year,
      sampleSize,
      effectSize,
      ciLower,
      ciUpper,
      source: 'manual' as const
    };

    const nextStudies = [...studies, newStudy];
    setStudies(nextStudies);
    saveLocalStudies(pId, nextStudies);
    setStudyDraft({ author: '', year: '', sampleSize: '', effectSize: '', ciLower: '', ciUpper: '' });
    setFileError(null);

    if (isSecureMode) {
      setIsSyncing(true);
      try {
        const saved = await apiAddLiteratureStudy(pId, {
          id: newStudyId,
          author: newStudy.author,
          year: newStudy.year,
          sampleSize: newStudy.sampleSize,
          effectSize: newStudy.effectSize,
          ciLower: newStudy.ciLower,
          ciUpper: newStudy.ciUpper,
          source: 'manual'
        });
        if (activeProjectIdRef.current !== pId) return;
        if (saved) {
          setSyncStatus('success');
        } else {
          setSyncStatus('error');
        }
      } catch (err) {
        console.error('Failed to save study on server', err);
        if (activeProjectIdRef.current === pId) {
          setSyncStatus('error');
        }
      } finally {
        if (activeProjectIdRef.current === pId) {
          setIsSyncing(false);
        }
      }
    }
  };

  const handleImportStudies = async (source: 'crossref' | 'pubmed') => {
    const pId = activeProject.id;
    const query = importQuery.trim();
    if (query.length < 3) {
      setFileError(language === 'ar' ? 'أدخل عبارة بحث من ثلاثة أحرف على الأقل.' : 'Enter a search query of at least three characters.');
      return;
    }
    if (!isSecureMode || !user) {
      setFileError(language === 'ar' ? 'استيراد القواعد الخارجية يتطلب تسجيل الدخول ووضع البحث المؤمّن.' : 'External catalogue import requires sign-in and secure research mode.');
      return;
    }
    if (pId === 'demo-1') {
      setFileError(language === 'ar' ? 'اختر مشروعًا محفوظًا على الخادم، أو أنشئ مشروعًا جديدًا من اختيار المسار. المشروع التجريبي لا يقبل الاستيراد.' : 'Choose a server-saved project, or create one from path selection. The demo project cannot import catalogues.');
      return;
    }
    setIsImporting(true);
    setFileError(null);
    try {
      const result = await apiImportLiteratureStudies(pId, query, source);
      if (activeProjectIdRef.current !== pId) return;
      if (!result) {
        setSyncStatus('error');
        setFileError(language === 'ar' ? 'تعذر الاستيراد من القاعدة الخارجية.' : 'Could not import from the external catalogue.');
        return;
      }
      await fetchProjectStudies(pId);
      setSyncStatus('success');
      if (result.imported === 0) {
        setFileError(language === 'ar'
          ? (result.skipped ? 'المراجع موجودة مسبقًا أو لم تُرجع القاعدة نتائج جديدة.' : 'لم تُرجع القاعدة أي مراجع لهذه العبارة.')
          : (result.skipped ? 'References already exist or the catalogue returned no new rows.' : 'The catalogue returned no references for this query.'));
      }
    } catch (err) {
      console.error('Failed to import literature', err);
      if (activeProjectIdRef.current === pId) {
        setSyncStatus('error');
        setFileError(language === 'ar' ? 'تعذر الاستيراد من القاعدة الخارجية.' : 'Could not import from the external catalogue.');
      }
    } finally {
      if (activeProjectIdRef.current === pId) setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PathPanel accent="var(--ds-path-publication)">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-ink m-0">
            {language === 'ar' ? 'تحليل ومكاملة الأدبيات والدراسات السابقة' : 'Literature Synthesis & Meta-Analysis'}
          </h2>
          <p className="text-xs text-secondary m-0">
            {language === 'ar'
              ? 'أدخل أحجام الأثر يدويًا، أو استورد البيانات الببليوغرافية من Crossref وPubMed ثم أكمل العينة والأثر قبل التحليل البعدي.'
              : 'Enter effect sizes by hand, or import bibliographic records from Crossref and PubMed, then complete sample and effect fields before meta-analysis.'}
          </p>
        </div>
      </PathPanel>
      {/* Persistence Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          {isSecureMode ? (
            <>
              <Cloud size={16} className="text-[var(--ds-primary)]" />
              <span className="font-semibold text-[var(--ds-text-primary)]">
                {language === 'ar' ? 'نمط البحث المؤمّن (حفظ قاعدة البيانات السحابية)' : 'Secure Research Mode (Database Persistence)'}
              </span>
            </>
          ) : (
            <>
              <Database size={16} className="text-[var(--ds-warning)]" />
              <span className="font-semibold text-[var(--ds-text-secondary)]">
                {language === 'ar' ? 'النمط التجريبي (تخزين محلي بالمتصفح)' : 'Demo Mode (Browser Local Storage)'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSyncing && (
            <span className="flex items-center gap-1.5 text-[var(--ds-primary)] font-medium">
              <RefreshCw size={13} className="motion-safe:animate-spin" />
              {language === 'ar' ? 'جارٍ المزامنة...' : 'Syncing...'}
            </span>
          )}
          {syncStatus === 'success' && !isSyncing && (
            <span className="flex items-center gap-1 text-[var(--ds-success)] font-medium">
              <CheckCircle2 size={13} />
              {language === 'ar' ? 'متزامن مع الخادم' : 'Server Synced'}
            </span>
          )}
          {syncStatus === 'error' && !isSyncing && (
            <span className="flex items-center gap-1 text-[var(--ds-danger)] font-medium">
              <AlertCircle size={13} />
              {language === 'ar' ? 'تعذر المزامنة مع الخادم (حفظ مؤقت)' : 'Server sync failed (scratch cache)'}
            </span>
          )}
          {isSecureMode && syncStatus === 'error' && !isSyncing && (
            <button
              type="button"
              onClick={() => projectId && fetchProjectStudies(projectId)}
              className="flex items-center gap-1 text-[11px] text-action hover:underline ml-2 cursor-pointer"
            >
              <RotateCcw size={11} />
              {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-6 shadow-sm text-center space-y-4">
        <BookOpen size={40} className="text-[var(--ds-primary)] mx-auto" />
        <div>
          <h3 className="text-md font-bold text-[var(--ds-text-primary)] m-0">
            {language === 'ar' ? 'رفع ملف دراسة PDF' : 'Upload a PDF study file'}
          </h3>
          <p className="text-xs text-[var(--ds-text-secondary)] mt-1 max-w-lg mx-auto">
            {language === 'ar'
              ? 'يُحفظ الملف كمرجع للمراجعة؛ أدخل بيانات الدراسة يدوياً إلى أن تتوفر خدمة استخراج فعلية.'
              : 'The file is kept as a review reference; enter study data until extraction is available.'}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            aria-label={language === 'ar' ? 'اختيار ملف دراسة PDF' : 'Choose a PDF study file'}
            className="text-xs text-[var(--ds-text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--ds-primary-soft)] file:text-[var(--ds-primary)] cursor-pointer"
          />
          {selectedFile && (
            <p className="text-xs text-[var(--ds-text-secondary)] m-0" data-testid="selected-literature-file">
              {language === 'ar' ? 'الملف المحدد:' : 'Selected file:'} {selectedFile.name}
            </p>
          )}
          {fileError && <div role="alert" className="text-xs font-semibold text-danger bg-danger/10 border border-danger rounded-md p-2">{fileError}</div>}
          <p className="text-[10px] text-[var(--ds-text-muted)] m-0">
            {language === 'ar' ? 'اختيار PDF مرجع للمراجعة؛ أدخل بيانات الدراسة يدوياً إلى أن تتوفر خدمة استخراج فعلية.' : 'The PDF is retained as a review reference; enter study data manually until extraction is available.'}
          </p>
        </div>
      </div>

      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-2">
          <Search size={16} className="text-[var(--ds-primary)] mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-[var(--ds-text-primary)] m-0">{language === 'ar' ? 'استيراد مراجع من Crossref أو PubMed' : 'Import references from Crossref or PubMed'}</h4>
            <p className="text-xs text-[var(--ds-text-secondary)] m-0 mt-1">
              {language === 'ar'
                ? 'يُحفظ العنوان والمؤلف والسنة ومعرّف DOI فقط. أدخل حجم العينة والأثر لاحقًا؛ المراجع المستوردة لا تدخل التحليل البعدي حتى يكتمل فاصل الثقة.'
                : 'Only title, authors, year, and DOI are stored. Enter sample size and effect later; imported rows stay out of meta-analysis until the confidence interval is complete.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={importQuery}
            onChange={event => setImportQuery(event.target.value)}
            placeholder={language === 'ar' ? 'عبارة البحث أو العنوان أو DOI' : 'Query, title, or DOI'}
            aria-label={language === 'ar' ? 'عبارة استيراد الأدبيات' : 'Literature import query'}
            className="flex-1 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={isImporting} onClick={() => void handleImportStudies('crossref')}>
              {isImporting ? (language === 'ar' ? 'جارٍ الاستيراد...' : 'Importing...') : 'Crossref'}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={isImporting} onClick={() => void handleImportStudies('pubmed')}>
              PubMed
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddStudy} noValidate className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-[var(--ds-text-primary)] m-0">{language === 'ar' ? 'إضافة دليل دراسة' : 'Add Study Evidence'}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input value={studyDraft.author} onChange={event => setStudyDraft(current => ({ ...current, author: event.target.value }))} placeholder={language === 'ar' ? 'المرجع أو المؤلفون' : 'Reference or authors'} aria-label={language === 'ar' ? 'المرجع أو المؤلفون' : 'Reference or authors'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
          <input type="number" value={studyDraft.year} onChange={event => setStudyDraft(current => ({ ...current, year: event.target.value }))} placeholder={language === 'ar' ? 'سنة النشر' : 'Publication year'} aria-label={language === 'ar' ? 'سنة النشر' : 'Publication year'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
          <input type="number" min="1" step="1" value={studyDraft.sampleSize} onChange={event => setStudyDraft(current => ({ ...current, sampleSize: event.target.value }))} placeholder={language === 'ar' ? 'حجم العينة' : 'Sample size'} aria-label={language === 'ar' ? 'حجم العينة' : 'Sample size'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
          <input type="number" step="any" value={studyDraft.effectSize} onChange={event => setStudyDraft(current => ({ ...current, effectSize: event.target.value }))} placeholder={language === 'ar' ? 'حجم الأثر d' : 'Effect size d'} aria-label={language === 'ar' ? 'حجم الأثر d' : 'Effect size d'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
          <input type="number" step="any" value={studyDraft.ciLower} onChange={event => setStudyDraft(current => ({ ...current, ciLower: event.target.value }))} placeholder={language === 'ar' ? 'الحد الأدنى لـ95% CI' : '95% CI lower'} aria-label={language === 'ar' ? 'الحد الأدنى لفاصل الثقة' : 'Confidence interval lower'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
          <input type="number" step="any" value={studyDraft.ciUpper} onChange={event => setStudyDraft(current => ({ ...current, ciUpper: event.target.value }))} placeholder={language === 'ar' ? 'الحد الأعلى لـ95% CI' : '95% CI upper'} aria-label={language === 'ar' ? 'الحد الأعلى لفاصل الثقة' : 'Confidence interval upper'} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-3 py-2 text-xs text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
        </div>
        <Button type="submit" variant="primary" size="sm">{language === 'ar' ? 'إضافة الدراسة' : 'Add study'}</Button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: language === 'ar' ? 'الدراسات' : 'Studies', value: studies.length },
          { label: language === 'ar' ? 'إجمالي العينة' : 'Total N', value: totalN },
          { label: language === 'ar' ? 'الأثر المجمع' : 'Pooled d', value: validStudies.length > 0 ? pooledES : '—' },
          { label: language === 'ar' ? 'فاصل الثقة' : '95% CI', value: validStudies.length > 0 ? `[${pooledLower}, ${pooledUpper}]` : '—' },
          { label: language === 'ar' ? 'عدم التجانس I²' : 'Heterogeneity I²', value: validStudies.length > 1 ? `${heterogeneityI2.toFixed(0)}%` : '—' }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-4 text-center shadow-sm">
            <div className="text-[10px] font-bold text-[var(--ds-text-muted)]">{item.label}</div>
            <div className="mt-1 text-lg font-black text-ink ds-numeric">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Grid: Extracted studies table vs Forest Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Studies Table */}
        <div className="lg:col-span-1 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[var(--ds-text-muted)] uppercase tracking-wider m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
            {language === 'ar' ? 'الأدلة والـ Effect Sizes المستخرجة' : 'Extracted Literature Evidence'}
          </h4>

          <div className="space-y-3">
            {studies.length === 0 ? (
              <EmptyState
                bare
                className="p-4"
                illustration={<BookOpen size={32} />}
                title={language === 'ar' ? 'لا توجد دراسات مسجلة بعد' : 'No studies recorded yet'}
                description={language === 'ar' ? 'أضف دليل دراسة يدوياً لبدء المكاملة.' : 'Add a study evidence row to begin the synthesis.'}
              />
            ) : studies.map(study => (
              <div key={study.id} className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between items-start gap-2 font-bold text-[var(--ds-text-primary)]">
                  <span>{study.author} ({study.year})</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {study.source !== 'manual' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">{study.source}</span>
                    )}
                    {isBibliographicOnly(study) ? (
                      <span className="text-[10px] font-semibold text-[var(--ds-warning)]">{language === 'ar' ? 'ببليوغرافي فقط' : 'Bibliographic only'}</span>
                    ) : (
                      <span>d = {study.effectSize}</span>
                    )}
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      ariaLabel={language === 'ar' ? `حذف دراسة ${study.author}` : `Remove ${study.author}`}
                      onClick={() => handleRemoveStudy(study.id)}
                    />
                  </div>
                </div>
                {isBibliographicOnly(study) ? (
                  <form className="grid grid-cols-2 gap-2 pt-1" onSubmit={event => { event.preventDefault(); void handleCompleteEvidence(study); }}>
                    <p className="col-span-2 m-0 text-[10px] text-[var(--ds-text-muted)]">
                      {language === 'ar' ? 'أدخل حجم العينة والأثر وفاصل الثقة لإدراج المرجع في مخطط الغابة.' : 'Enter sample size, effect, and confidence interval to include this reference in the forest plot.'}
                    </p>
                    <input type="number" min="2" step="1" required placeholder="N" aria-label={language === 'ar' ? 'حجم العينة' : 'Sample size'} value={evidenceDrafts[study.id]?.sampleSize ?? ''} onChange={event => setEvidenceDrafts(current => ({ ...current, [study.id]: { sampleSize: event.target.value, effectSize: current[study.id]?.effectSize ?? '', ciLower: current[study.id]?.ciLower ?? '', ciUpper: current[study.id]?.ciUpper ?? '' } }))} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-2 py-1.5 text-xs" />
                    <input type="number" step="any" required placeholder="d" aria-label={language === 'ar' ? 'حجم الأثر' : 'Effect size'} value={evidenceDrafts[study.id]?.effectSize ?? ''} onChange={event => setEvidenceDrafts(current => ({ ...current, [study.id]: { sampleSize: current[study.id]?.sampleSize ?? '', effectSize: event.target.value, ciLower: current[study.id]?.ciLower ?? '', ciUpper: current[study.id]?.ciUpper ?? '' } }))} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-2 py-1.5 text-xs" />
                    <input type="number" step="any" required placeholder="CI −" aria-label={language === 'ar' ? 'الحد الأدنى لفاصل الثقة' : 'CI lower'} value={evidenceDrafts[study.id]?.ciLower ?? ''} onChange={event => setEvidenceDrafts(current => ({ ...current, [study.id]: { sampleSize: current[study.id]?.sampleSize ?? '', effectSize: current[study.id]?.effectSize ?? '', ciLower: event.target.value, ciUpper: current[study.id]?.ciUpper ?? '' } }))} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-2 py-1.5 text-xs" />
                    <input type="number" step="any" required placeholder="CI +" aria-label={language === 'ar' ? 'الحد الأعلى لفاصل الثقة' : 'CI upper'} value={evidenceDrafts[study.id]?.ciUpper ?? ''} onChange={event => setEvidenceDrafts(current => ({ ...current, [study.id]: { sampleSize: current[study.id]?.sampleSize ?? '', effectSize: current[study.id]?.effectSize ?? '', ciLower: current[study.id]?.ciLower ?? '', ciUpper: event.target.value } }))} className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] px-2 py-1.5 text-xs" />
                    <Button type="submit" variant="secondary" size="sm" className="col-span-2">{language === 'ar' ? 'إدخال في التحليل التلوي' : 'Include in meta-analysis'}</Button>
                  </form>
                ) : (
                  <div className="flex justify-between text-[var(--ds-text-muted)] text-[10px]">
                    <span>N = {study.sampleSize}</span>
                    <span>95% CI: [{study.ciLower}, {study.ciUpper}]</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Forest Plot Chart */}
        <div className="lg:col-span-2 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[var(--ds-text-muted)] uppercase tracking-wider m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
            {language === 'ar' ? 'مخطط الغابة التلوي (Meta-Analysis Forest Plot)' : 'Forest Plot Synthesis'}
          </h4>

          {validStudies.length === 0 ? (
            <div className="w-full h-56 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg flex items-center justify-center px-6 text-center text-xs text-[var(--ds-text-muted)]">
              {language === 'ar' ? 'أضف دراسة واحدة على الأقل ذات حجم أثر وفاصل ثقة لإنتاج مخطط تجميعي.' : 'Add at least one study with an effect size and confidence interval to generate a synthesis plot.'}
            </div>
          ) : (
          <div className="w-full h-56 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 400 180">
              {/* Zero Line (no effect) */}
              <line x1="160" y1="10" x2="160" y2="150" stroke={chartColor.border} strokeWidth={1} strokeDasharray="3,3" />
              
              {/* Axes labels */}
              <text x="60" y="170" fill={chartColor.muted} fontSize="8" textAnchor="middle">{language === 'ar' ? 'صالح الضابطة' : 'Favors Control'}</text>
              <text x="160" y="170" fill={chartColor.muted} fontSize="8" textAnchor="middle">0.0</text>
              <text x="260" y="170" fill={chartColor.muted} fontSize="8" textAnchor="middle">{language === 'ar' ? 'صالح التجريبية' : 'Favors Treatment'}</text>

              {/* Map values to X coordinates: ES range from -1.0 to 1.5. X range 60 to 360 (160 is 0.0) */}
              {validStudies.map((study, idx) => {
                const y = 30 + idx * 25;
                const cx = 160 + study.effectSize * 100;
                const x1 = 160 + study.ciLower * 100;
                const x2 = 160 + study.ciUpper * 100;

                return (
                  <g key={study.id}>
                    {/* Author Label */}
                    <text x="10" y={y + 3} fill={chartColor.secondary} fontSize="8" fontWeight="bold">{study.author}</text>
                    
                    {/* CI line */}
                    <line x1={x1} y1={y} x2={x2} y2={y} stroke={chartColor.muted} strokeWidth={1.5} />
                    
                    {/* Effect Size box (size proportional to sample size) */}
                    <rect
                      x={cx - 3}
                      y={y - 3}
                      width={6}
                      height={6}
                      fill={chartColor.primary}
                    />
                  </g>
                );
              })}

              {/* Pooled Diamond */}
              {(() => {
                const y = 35 + validStudies.length * 25;
                const dx = 160 + pooledES * 100;
                const lx = 160 + pooledLower * 100;
                const rx = 160 + pooledUpper * 100;
                
                // Diamond coordinates path: Top, Right, Bottom, Left
                const pathPoints = `M ${dx} ${y - 5} L ${rx} ${y} L ${dx} ${y + 5} L ${lx} ${y} Z`;

                return (
                  <g>
                    {/* Label */}
                    <text x="10" y={y + 3} fill={chartColor.secondary} fontSize="8" fontWeight="black">Pooled Effect</text>
                    
                    {/* Diamond path */}
                    <path d={pathPoints} fill={chartColor.success} />
                    
                    {/* Numeric print */}
                    <text x="390" y={y + 3} fill={chartColor.success} fontSize="8" fontWeight="bold" textAnchor="end">
                      {pooledES} [{pooledLower}, {pooledUpper}]
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
          )}
        </div>
      </div>
      {validStudies.length > 0 && <p className="text-[10px] text-[var(--ds-text-muted)] text-center m-0">
        {language === 'ar'
          ? 'الأثر المجمع محسوب بأوزان عكس التباين من فواصل الدراسات؛ يظل تقديراً أولياً ويتطلب مراجعة نموذج التأثيرات قبل اعتماده.'
          : 'The pooled effect uses inverse-variance weights from study CIs; it is preliminary and requires model review before adoption.'}
      </p>}
    </div>
  );
};
