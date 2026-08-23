import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { Download, Cloud, Database, RefreshCw, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../design-system/components/Button';
import { apiGetPrismaFlow, apiSavePrismaFlow, apiResetPrismaFlow } from '../utils/api';
import { researchStorage } from '../utils/researchStorage';

export const PrismaBuilder: React.FC = () => {
  const { activeProject, language, isSecureMode } = useProject();

  const [identified, setIdentified] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [excludedScreening, setExcludedScreening] = useState(0);
  const [excludedEligibility, setExcludedEligibility] = useState(0);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeProjectIdRef = useRef<string | undefined>(activeProject?.id);
  const saveSequenceRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  const projectId = activeProject?.id;

  useEffect(() => {
    activeProjectIdRef.current = projectId;
  }, [projectId]);

  const screened = Math.max(0, identified - duplicates);
  const eligible = Math.max(0, screened - excludedScreening);
  const included = Math.max(0, eligible - excludedEligibility);

  useEffect(() => {
    setDuplicates(current => Math.min(current, identified));
  }, [identified]);

  useEffect(() => {
    setExcludedScreening(current => Math.min(current, screened));
  }, [screened]);

  useEffect(() => {
    setExcludedEligibility(current => Math.min(current, eligible));
  }, [eligible]);

  const inputClass = 'bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 font-bold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]';
  const chartColors = {
    primary: 'var(--ds-primary)',
    primarySoft: 'var(--ds-primary-soft)',
    warning: 'var(--ds-warning)',
    warningSoft: 'var(--ds-warning-soft)',
    danger: 'var(--ds-danger)',
    dangerSoft: 'var(--ds-danger-soft)',
    success: 'var(--ds-success)',
    successSoft: 'var(--ds-success-soft)',
    text: 'var(--ds-text-primary)'
  };

  const handleDownloadSVG = () => {
    const svgElement = document.getElementById('prisma-svg');
    if (!svgElement) return;
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = 'prisma_flow_chart.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const parseNonNegativeInteger = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  };

  const loadPrismaData = useCallback(async (pId: string) => {
    const seq = ++saveSequenceRef.current;
    isInitialLoadRef.current = true;
    const storageKey = `rb_prisma_counts_${pId}`;
    let localCounts = { identified: 0, duplicates: 0, excludedScreening: 0, excludedEligibility: 0 };
    try {
      const stored: unknown = JSON.parse(researchStorage.getItem(storageKey) ?? 'null');
      if (stored && typeof stored === 'object') {
        const candidate = stored as Record<string, unknown>;
        const isManual = candidate.source === 'manual';
        if (isManual) {
          const nextIdentified = typeof candidate.identified === 'number' && Number.isFinite(candidate.identified) ? Math.max(0, Math.floor(candidate.identified)) : 0;
          const nextDuplicates = typeof candidate.duplicates === 'number' && Number.isFinite(candidate.duplicates) ? Math.min(nextIdentified, Math.max(0, Math.floor(candidate.duplicates))) : 0;
          const nextScreened = nextIdentified - nextDuplicates;
          const nextExcludedScreening = typeof candidate.excludedScreening === 'number' && Number.isFinite(candidate.excludedScreening) ? Math.min(nextScreened, Math.max(0, Math.floor(candidate.excludedScreening))) : 0;
          const nextEligible = nextScreened - nextExcludedScreening;
          const nextExcludedEligibility = typeof candidate.excludedEligibility === 'number' && Number.isFinite(candidate.excludedEligibility) ? Math.min(nextEligible, Math.max(0, Math.floor(candidate.excludedEligibility))) : 0;
          localCounts = {
            identified: nextIdentified,
            duplicates: nextDuplicates,
            excludedScreening: nextExcludedScreening,
            excludedEligibility: nextExcludedEligibility
          };
        }
      }
    } catch {
      // ignore
    }

    if (isSecureMode) {
      setIsSyncing(true);
      setSyncStatus('idle');
      try {
        const remote = await apiGetPrismaFlow(pId);
        if (activeProjectIdRef.current !== pId || saveSequenceRef.current !== seq) return;

        if (remote) {
          if (remote.identified === 0 && localCounts.identified > 0) {
            // Auto-migrate legacy local counts to server
            const saved = await apiSavePrismaFlow(pId, {
              identified: localCounts.identified,
              duplicates: localCounts.duplicates,
              excludedScreening: localCounts.excludedScreening,
              excludedEligibility: localCounts.excludedEligibility
            });
            if (activeProjectIdRef.current !== pId || saveSequenceRef.current !== seq) return;
            if (saved) {
              setIdentified(saved.identified);
              setDuplicates(saved.duplicates);
              setExcludedScreening(saved.excludedScreening);
              setExcludedEligibility(saved.excludedEligibility);
              setSyncStatus('success');
              setLoadedProjectId(pId);
              isInitialLoadRef.current = false;
              setIsSyncing(false);
              return;
            }
          }

          setIdentified(remote.identified);
          setDuplicates(remote.duplicates);
          setExcludedScreening(remote.excludedScreening);
          setExcludedEligibility(remote.excludedEligibility);
          setSyncStatus('success');
        } else {
          setIdentified(localCounts.identified);
          setDuplicates(localCounts.duplicates);
          setExcludedScreening(localCounts.excludedScreening);
          setExcludedEligibility(localCounts.excludedEligibility);
          setSyncStatus('error');
        }
      } catch (err) {
        console.error('Failed to load PRISMA flow from server', err);
        if (activeProjectIdRef.current === pId && saveSequenceRef.current === seq) {
          setIdentified(localCounts.identified);
          setDuplicates(localCounts.duplicates);
          setExcludedScreening(localCounts.excludedScreening);
          setExcludedEligibility(localCounts.excludedEligibility);
          setSyncStatus('error');
        }
      } finally {
        if (activeProjectIdRef.current === pId && saveSequenceRef.current === seq) {
          setIsSyncing(false);
          isInitialLoadRef.current = false;
        }
      }
    } else {
      setIdentified(localCounts.identified);
      setDuplicates(localCounts.duplicates);
      setExcludedScreening(localCounts.excludedScreening);
      setExcludedEligibility(localCounts.excludedEligibility);
      setSyncStatus('idle');
      isInitialLoadRef.current = false;
    }
    setLoadedProjectId(pId);
  }, [isSecureMode]);

  useEffect(() => {
    if (!projectId) return;
    loadPrismaData(projectId);
  }, [projectId, loadPrismaData]);

  // Save to localStorage and debounce save to server
  useEffect(() => {
    if (!projectId || loadedProjectId !== projectId || isInitialLoadRef.current) return;
    const payload = {
      identified,
      duplicates,
      excludedScreening,
      excludedEligibility,
      source: 'manual'
    };
    researchStorage.setItem(`rb_prisma_counts_${projectId}`, JSON.stringify(payload));

    if (isSecureMode) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        const seq = ++saveSequenceRef.current;
        setIsSyncing(true);
        try {
          const res = await apiSavePrismaFlow(projectId, payload);
          if (activeProjectIdRef.current !== projectId || saveSequenceRef.current !== seq) return;
          if (res) {
            setSyncStatus('success');
          } else {
            setSyncStatus('error');
          }
        } catch (e) {
          console.error('Failed to auto-save PRISMA to server', e);
          if (activeProjectIdRef.current === projectId && saveSequenceRef.current === seq) {
            setSyncStatus('error');
          }
        } finally {
          if (activeProjectIdRef.current === projectId && saveSequenceRef.current === seq) {
            setIsSyncing(false);
          }
        }
      }, 750);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectId, duplicates, excludedEligibility, excludedScreening, identified, loadedProjectId, isSecureMode]);

  const handleReset = async () => {
    setIdentified(0);
    setDuplicates(0);
    setExcludedScreening(0);
    setExcludedEligibility(0);
    if (projectId) {
      researchStorage.removeItem(`rb_prisma_counts_${projectId}`);
      if (isSecureMode) {
        setIsSyncing(true);
        try {
          const ok = await apiResetPrismaFlow(projectId);
          if (activeProjectIdRef.current !== projectId) return;
          if (ok) {
            setSyncStatus('success');
          } else {
            setSyncStatus('error');
          }
        } catch (e) {
          console.error('Failed to reset PRISMA on server', e);
          if (activeProjectIdRef.current === projectId) {
            setSyncStatus('error');
          }
        } finally {
          if (activeProjectIdRef.current === projectId) {
            setIsSyncing(false);
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Persistence Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          {isSecureMode ? (
            <>
              <Cloud size={16} className="text-[var(--ds-primary)]" />
              <span className="font-semibold text-[var(--ds-text-primary)]">
                {language === 'ar' ? 'نمط البحث المؤمّن (حفظ PRISMA بقاعدة البيانات)' : 'Secure Research Mode (PRISMA Database Persistence)'}
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
              <RefreshCw size={13} className="animate-spin" />
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
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-[var(--ds-danger)] hover:underline ml-2 cursor-pointer"
          >
            <RotateCcw size={11} />
            {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Numeric inputs */}
        <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-md font-bold text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
            {language === 'ar' ? 'بيانات مخطط PRISMA' : 'PRISMA Diagram Counts'}
          </h3>

          <div className="space-y-3 text-xs font-semibold text-[var(--ds-text-secondary)]">
            <div className="flex flex-col gap-1">
              <label>{language === 'ar' ? 'عدد الدراسات المكتشفة بالبحث (Identified)' : 'Records Identified'}</label>
              <input
                type="number"
                value={identified}
                onChange={(e) => {
                  const val = parseNonNegativeInteger(e.target.value);
                  setIdentified(val);
                  setDuplicates(current => Math.min(current, val));
                }}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>{language === 'ar' ? 'الدراسات المكررة المستبعدة (Duplicates)' : 'Duplicates Removed'}</label>
              <input
                type="number"
                value={duplicates}
                onChange={(e) => {
                  const val = Math.min(parseNonNegativeInteger(e.target.value), identified);
                  setDuplicates(val);
                  setExcludedScreening(current => Math.min(current, identified - val));
                }}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>{language === 'ar' ? 'الدراسات المستبعدة بعد فحص العنوان والملخص' : 'Records Excluded (Title/Abstract)'}</label>
              <input
                type="number"
                value={excludedScreening}
                onChange={(e) => {
                  const val = Math.min(parseNonNegativeInteger(e.target.value), screened);
                  setExcludedScreening(val);
                  setExcludedEligibility(current => Math.min(current, screened - val));
                }}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>{language === 'ar' ? 'الدراسات المستبعدة بعد فحص النص الكامل' : 'Reports Excluded (Full Text)'}</label>
              <input
                type="number"
                value={excludedEligibility}
                onChange={(e) => {
                  const val = Math.min(parseNonNegativeInteger(e.target.value), eligible);
                  setExcludedEligibility(val);
                }}
                className={inputClass}
              />
            </div>
          </div>

          <Button
            onClick={handleDownloadSVG}
            disabled={identified === 0}
            variant="primary"
            size="sm"
            className="w-full"
            iconBefore={<Download size={14} />}
          >
            <span>{language === 'ar' ? 'تحميل كصورة SVG' : 'Download as SVG'}</span>
          </Button>
        </div>

        {/* Right Side: SVG Diagram */}
        <div className="lg:col-span-2 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--ds-border-subtle)]">
            <h4 className="text-sm font-bold text-[var(--ds-text-primary)] m-0">
              {language === 'ar' ? 'مخطط التدفق PRISMA 2020 Flow Diagram' : 'PRISMA 2020 Flow Diagram'}
            </h4>
          </div>

          {identified === 0 && <p className="m-0 text-xs text-[var(--ds-text-muted)]">{language === 'ar' ? 'أدخل أعداد البحث والفحص الفعلية لإنشاء مخطط تدفق موثق.' : 'Enter actual search and screening counts to create a documented flow diagram.'}</p>}

          {/* SVG Diagram Canvas */}
          <div className="w-full h-[450px] bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 flex items-center justify-center overflow-x-auto">
            <svg id="prisma-svg" width="460" height="420" viewBox="0 0 460 420" className="max-w-full">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={chartColors.primary} />
                </marker>
              </defs>

              {/* Box 1: Identification */}
              <rect x="30" y="20" width="160" height="60" rx="8" fill={chartColors.primarySoft} stroke={chartColors.primary} strokeWidth={1.5} />
              <text x="110" y="42" fill={chartColors.primary} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'الدراسات المكتشفة' : 'Identified Records'}
              </text>
              <text x="110" y="65" fill={chartColors.text} fontSize="16" fontWeight="black" textAnchor="middle">
                N = {identified}
              </text>

              {/* Arrow Down from Identified */}
              <line x1="110" y1="80" x2="110" y2="120" stroke={chartColors.primary} strokeWidth={2} markerEnd="url(#arrow)" />

              {/* Side Box: Duplicates removed */}
              <rect x="260" y="65" width="160" height="50" rx="8" fill={chartColors.warningSoft} stroke={chartColors.warning} strokeWidth={1.5} />
              <text x="340" y="85" fill={chartColors.warning} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'الدراسات المكررة المستبعدة' : 'Duplicates Removed'}
              </text>
              <text x="340" y="105" fill={chartColors.text} fontSize="12" fontWeight="bold" textAnchor="middle">
                N = {duplicates}
              </text>

              {/* Arrow from Identified down-line to Duplicates box */}
              <path d="M 110 100 L 260 100" stroke={chartColors.warning} strokeWidth={1.5} markerEnd="url(#arrow)" strokeDasharray="3,3" />

              {/* Box 2: Screened */}
              <rect x="30" y="120" width="160" height="60" rx="8" fill={chartColors.primarySoft} stroke={chartColors.primary} strokeWidth={1.5} />
              <text x="110" y="142" fill={chartColors.primary} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'الدراسات المفحوصة' : 'Records Screened'}
              </text>
              <text x="110" y="165" fill={chartColors.text} fontSize="16" fontWeight="black" textAnchor="middle">
                N = {screened}
              </text>

              {/* Arrow Down from Screened */}
              <line x1="110" y1="180" x2="110" y2="220" stroke={chartColors.primary} strokeWidth={2} markerEnd="url(#arrow)" />

              {/* Side Box: Excluded Screening */}
              <rect x="260" y="165" width="160" height="50" rx="8" fill={chartColors.dangerSoft} stroke={chartColors.danger} strokeWidth={1.5} />
              <text x="340" y="185" fill={chartColors.danger} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'الدراسات المستبعدة' : 'Records Excluded'}
              </text>
              <text x="340" y="205" fill={chartColors.text} fontSize="12" fontWeight="bold" textAnchor="middle">
                N = {excludedScreening}
              </text>

              {/* Arrow from Screened down-line to Excluded box */}
              <path d="M 110 200 L 260 200" stroke={chartColors.danger} strokeWidth={1.5} markerEnd="url(#arrow)" strokeDasharray="3,3" />

              {/* Box 3: Eligibility */}
              <rect x="30" y="220" width="160" height="60" rx="8" fill={chartColors.primarySoft} stroke={chartColors.primary} strokeWidth={1.5} />
              <text x="110" y="242" fill={chartColors.primary} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'المؤهلة للتقييم' : 'Reports Sought for Eligibility'}
              </text>
              <text x="110" y="265" fill={chartColors.text} fontSize="16" fontWeight="black" textAnchor="middle">
                N = {eligible}
              </text>

              {/* Arrow Down from Eligibility */}
              <line x1="110" y1="280" x2="110" y2="320" stroke={chartColors.primary} strokeWidth={2} markerEnd="url(#arrow)" />

              {/* Side Box: Excluded Eligibility */}
              <rect x="260" y="265" width="160" height="50" rx="8" fill={chartColors.dangerSoft} stroke={chartColors.danger} strokeWidth={1.5} />
              <text x="340" y="285" fill={chartColors.danger} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'مستبعدة بعد فحص النص' : 'Reports Excluded'}
              </text>
              <text x="340" y="305" fill={chartColors.text} fontSize="12" fontWeight="bold" textAnchor="middle">
                N = {excludedEligibility}
              </text>

              {/* Arrow from Eligibility down-line to Excluded box */}
              <path d="M 110 300 L 260 300" stroke={chartColors.danger} strokeWidth={1.5} markerEnd="url(#arrow)" strokeDasharray="3,3" />

              {/* Box 4: Included */}
              <rect x="30" y="320" width="160" height="60" rx="8" fill={chartColors.successSoft} stroke={chartColors.success} strokeWidth={1.5} />
              <text x="110" y="342" fill={chartColors.success} fontSize="8" fontWeight="bold" textAnchor="middle">
                {language === 'ar' ? 'الدراسات المدرجة بالتحليل' : 'Studies Included in Synthesis'}
              </text>
              <text x="110" y="365" fill={chartColors.text} fontSize="16" fontWeight="black" textAnchor="middle">
                N = {included}
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
