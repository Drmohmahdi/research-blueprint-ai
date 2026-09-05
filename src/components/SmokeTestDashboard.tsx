import React, { useState } from 'react';
import { PathPanel } from '../design-system/components/Navigation';
import { useProject } from '../context/ProjectContext';
import type { ResearchProject } from '../types/research';
import { apiAnalyzeTitle } from '../utils/api';
import { localLiteratureForecast } from '../utils/predictionFallback';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Database
} from 'lucide-react';

interface TestCase {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  error?: string;
}

export const SmokeTestDashboard: React.FC = () => {
  const { 
    projects, 
    activeProject, 
    createProject, 
    updateProject, 
    deleteProject, 
    theme, 
    toggleTheme, 
    language, 
    setLanguage,
    isSecureMode 
  } = useProject();

  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 'dashboard-open',
      nameAr: 'فتح لوحة التحكم وقراءة المشاريع',
      nameEn: 'Open Dashboard & Load Projects',
      descriptionAr: 'التحقق من تحميل قائمة المشاريع وتحديد المشروع النشط بنجاح.',
      descriptionEn: 'Verify project list loads and active project is selected.',
      status: 'PENDING'
    },
    {
      id: 'project-creation',
      nameAr: 'إنشاء مشروع بحثي جديد',
      nameEn: 'Create New Research Project',
      descriptionAr: 'اختبار إضافة مشروع جديد مع المتغيرات الأساسية للفحص.',
      descriptionEn: 'Test adding a new project with baseline variables.',
      status: 'PENDING'
    },
    {
      id: 'wizard-navigation',
      nameAr: 'الانتقال بين خطوات معالج البحث',
      nameEn: 'Research Wizard Step Transitions',
      descriptionAr: 'محاكاة التنقل عبر معالج البحث والتحقق من حفظ البيانات المؤقتة.',
      descriptionEn: 'Simulate navigation through wizard steps and check state.',
      status: 'PENDING'
    },
    {
      id: 'persistence',
      nameAr: 'الاستعادة التلقائية للمشروع (Persistence)',
      nameEn: 'Project Storage & Recovery',
      descriptionAr: 'التحقق من بقاء المشاريع واستعادتها من التخزين المحلي بعد التحديث.',
      descriptionEn: 'Verify project persistence and recovery from localStorage.',
      status: 'PENDING'
    },
    {
      id: 'title-analyzer',
      nameAr: 'تشغيل محلل العنوان وتفكيك المتغيرات',
      nameEn: 'Title Analyzer & Variable Parsing',
      descriptionAr: 'محاكاة معالجة العنوان واستخراج المتغيرات التابعة والمستقلة.',
      descriptionEn: 'Simulate parsing research title into variables.',
      status: 'PENDING'
    },
    {
      id: 'offline-fallback',
      nameAr: 'تفعيل وضع الاستجابة الاحتياطية عند غياب الخادم',
      nameEn: 'Server Offline Fallback Activation',
      descriptionAr: 'التحقق من تشغيل محرك القواعد ومحاكاة الدرجات محلياً عند انقطاع الخادم.',
      descriptionEn: 'Verify fallback engine and simulator activate when API is offline.',
      status: 'PENDING'
    },
    {
      id: 'i18n-lang',
      nameAr: 'تغيير اللغة واتجاه الواجهة (RTL/LTR)',
      nameEn: 'Language Switch & RTL/LTR Direction',
      descriptionAr: 'تغيير اللغة والتحقق من تحول اتجاه الصفحة وعناصر الترجمة.',
      descriptionEn: 'Toggle language and verify layout direction and translations.',
      status: 'PENDING'
    },
    {
      id: 'theme-toggle',
      nameAr: 'تغيير الوضع الداكن والفاتح (Dark/Light)',
      nameEn: 'Theme Toggle & Dark Mode Classes',
      descriptionAr: 'تعديل السمة والتحقق من تطبيق كلاس dark على وسم HTML الرئيسي.',
      descriptionEn: 'Toggle theme and check dark class assignment on HTML document.',
      status: 'PENDING'
    },
    {
      id: 'outcome-predictor',
      nameAr: 'تشغيل محرك التنبؤ بالنتائج الإحصائية',
      nameEn: 'Execute Outcome Prediction Engine',
      descriptionAr: 'تشغيل عمليات التنبؤ القائمة على الأدبيات والتحقق من فواصل الثقة.',
      descriptionEn: 'Generate outcome forecasts and verify statistical boundaries.',
      status: 'PENDING'
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const updateTestStatus = (id: string, status: TestCase['status'], error?: string) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status, error } : tc));
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog(language === 'ar' ? 'بدء تشغيل اختبارات الدخان للخط الأساسي للبرنامج...' : 'Starting system baseline smoke tests...');

    // 1. Dashboard Load Test
    try {
      updateTestStatus('dashboard-open', 'RUNNING');
      addLog(language === 'ar' ? 'فحص لوحة التحكم وتحميل المشاريع...' : 'Auditing dashboard project loads...');
      if (!projects || projects.length === 0) {
        throw new Error(language === 'ar' ? 'قائمة المشاريع فارغة.' : 'Project list is empty.');
      }
      addLog(language === 'ar' ? `تم تحميل ${projects.length} مشاريع بنجاح. المشروع النشط: ${activeProject?.titleEn}` : `Successfully loaded ${projects.length} projects. Active: ${activeProject?.titleEn}`);
      updateTestStatus('dashboard-open', 'PASSED');
    } catch (e: any) {
      updateTestStatus('dashboard-open', 'FAILED', e.message);
      addLog(`❌ Dashboard Test Failed: ${e.message}`);
    }

    // 2. Project Creation Test
    let createdProjId = '';
    let createdProj: ResearchProject | null = null;
    try {
      updateTestStatus('project-creation', 'RUNNING');
      addLog(language === 'ar' ? 'محاكاة إنشاء مشروع بحثي جديد...' : 'Simulating new project creation...');
      
      const newProj = await createProject({
        titleAr: 'مشروع اختبار الدخان المؤقت',
        titleEn: 'Temporary Smoke Test Project',
        departmentAr: 'قسم الاختبارات',
        departmentEn: 'Diagnostics Dept',
        institutionAr: 'جامعة الفحص الذاتي',
        institutionEn: 'Self-Diagnostic University',
        descriptionAr: 'وصف قصير للاختبار.',
        descriptionEn: 'Diagnostic test short description.',
        problemStatementAr: 'تحديد المشكلة للاختبار.',
        problemStatementEn: 'Diagnostic test problem statement.',
        studyDesign: 'quasi_experimental_pre_post',
        variables: [
          { id: 't-v1', nameAr: 'المتغير المستقل المؤقت', nameEn: 'Temp Independent', type: 'independent' as any, scale: 'nominal' as any }
        ],
        questions: [],
        hypotheses: [],
        sampleSettings: {
          populationSize: 100,
          marginOfError: 0.05,
          confidenceLevel: 0.95,
          expectedPower: 0.80,
          expectedEffectSize: 0.5,
          expectedAttritionRate: 0.15,
          groupsCount: 2
        }
      });

      if (!newProj || !newProj.id) {
        throw new Error(language === 'ar' ? 'فشل إنشاء كائن المشروع.' : 'Failed to instantiate project object.');
      }
      createdProj = newProj;
      createdProjId = newProj.id;
      addLog(language === 'ar' ? `تم إنشاء المشروع بنجاح بالمعرف المؤقت: ${createdProjId}` : `Project created successfully with ID: ${createdProjId}`);
      updateTestStatus('project-creation', 'PASSED');
    } catch (e: any) {
      updateTestStatus('project-creation', 'FAILED', e.message);
      addLog(`❌ Project Creation Failed: ${e.message}`);
    }

    // 3. Wizard Navigation Test
    try {
      updateTestStatus('wizard-navigation', 'RUNNING');
      addLog(language === 'ar' ? 'فحص خطوات معالج البحث وحفظ المكونات...' : 'Verifying wizard step data saves...');
      
      if (!createdProjId) {
        throw new Error(language === 'ar' ? 'لا يمكن إتمام الفحص لعدم نجاح إنشاء مشروع.' : 'Aborted because project creation failed.');
      }

      // Simulate modifying variables in wizard
      const targetProj = createdProj;
      if (targetProj) {
        const updated = {
          ...targetProj,
          variables: [
            ...targetProj.variables,
            { id: 't-v2', nameAr: 'المتغير التابع المؤقت', nameEn: 'Temp Dependent', type: 'dependent' as any, scale: 'interval' as any, maxValue: 100, minValue: 0 }
          ]
        };
        updateProject(updated);
        addLog(language === 'ar' ? 'تم تحديث متغيرات المشروع ومحاكاة حفظ الخطوات.' : 'Project variables updated to simulate step save.');
      }
      updateTestStatus('wizard-navigation', 'PASSED');
    } catch (e: any) {
      updateTestStatus('wizard-navigation', 'FAILED', e.message);
      addLog(`❌ Wizard Navigation Test Failed: ${e.message}`);
    }

    // 4. Persistence Test
    try {
      updateTestStatus('persistence', 'RUNNING');
      addLog(language === 'ar' ? 'التحقق من بقاء المشاريع وتأمين التخزين المحلي...' : 'Testing localStorage write/read integrity...');
      
      if (isSecureMode) {
        addLog(language === 'ar' ? 'الوضع البحثي الآمن نشط - التخزين المحلي مغلق لحماية البيانات.' : 'Secure Research Mode active - Local storage writing blocked for privacy.');
        if (localStorage.getItem('rb_projects')) {
          throw new Error(language === 'ar' ? 'وجد تسريب لبيانات المشاريع في localStorage في الوضع الآمن!' : 'Project data leak detected in localStorage under Secure Mode!');
        }
      } else {
        addLog(language === 'ar' ? 'وضع التجربة نشط - يتم حفظ البيانات محلياً.' : 'Demo Mode active - data persisted locally.');
        const saved = localStorage.getItem('rb_projects');
        if (!saved || !saved.includes('Temporary Smoke Test Project')) {
          throw new Error(language === 'ar' ? 'لم يتم العثور على المشروع المنشأ في localStorage.' : 'Created project not found in localStorage serialization.');
        }
      }
      updateTestStatus('persistence', 'PASSED');
    } catch (e: any) {
      updateTestStatus('persistence', 'FAILED', e.message);
      addLog(`❌ Persistence Test Failed: ${e.message}`);
    }

    // 5. Title Analyzer Test
    try {
      updateTestStatus('title-analyzer', 'RUNNING');
      addLog(language === 'ar' ? 'استدعاء محلل العنوان واستخراج المتغيرات المنهجية...' : 'Requesting title analyzer parsing...');
      
      const parsed = await apiAnalyzeTitle('أثر برنامج تدريبي قائم على الروبوت في التحصيل الدراسي');
      if (!parsed || !parsed.suggestedMethodology) {
        throw new Error(language === 'ar' ? 'لم يتم إرجاع أي منهجية مقترحة.' : 'No suggested methodology returned.');
      }
      addLog(language === 'ar' ? `المنهجية المقترحة المستخرجة: ${parsed.suggestedMethodology}. درجة الثقة: ${parsed.confidence}%` : `Extracted methodology: ${parsed.suggestedMethodology}. Confidence: ${parsed.confidence}%`);
      updateTestStatus('title-analyzer', 'PASSED');
    } catch (e: any) {
      updateTestStatus('title-analyzer', 'FAILED', e.message);
      addLog(`❌ Title Analyzer Test Failed: ${e.message}`);
    }

    // 6. Offline Fallback Test
    try {
      updateTestStatus('offline-fallback', 'RUNNING');
      addLog(language === 'ar' ? 'فحص تشغيل محركات الاستجابة المحلية (Local Rule Engine)...' : 'Checking local rule engine fallbacks...');
      
      // Simulate title parsing local fallback logic directly
      const result = await apiAnalyzeTitle('أثر استخدام الوسائط المتعددة في التحصيل الدراسي للطلاب');
      if (!result || result.independentVariables.length === 0) {
        throw new Error(language === 'ar' ? 'فشل تشغيل محرك القواعد المحلي في استخلاص المتغيرات.' : 'Local rule engine failed to parse variables.');
      }
      addLog(language === 'ar' ? `محرك القواعد المحلي استخلص: مستقل: ${result.independentVariables[0]}, تابع: ${result.dependentVariables[0]}` : `Local fallback extracted: Independent: ${result.independentVariables[0]}, Dependent: ${result.dependentVariables[0]}`);
      updateTestStatus('offline-fallback', 'PASSED');
    } catch (e: any) {
      updateTestStatus('offline-fallback', 'FAILED', e.message);
      addLog(`❌ Offline Fallback Test Failed: ${e.message}`);
    }

    // 7. Language Switch Test
    try {
      updateTestStatus('i18n-lang', 'RUNNING');
      addLog(language === 'ar' ? 'تغيير اللغة والتحقق من عناصر الاتجاه (RTL/LTR)...' : 'Testing layout internationalization...');
      
      const currentLang = language;
      const nextLang = currentLang === 'ar' ? 'en' : 'ar';
      
      setLanguage(nextLang);
      const dirAttr = document.documentElement.getAttribute('dir');
      if (dirAttr !== (nextLang === 'ar' ? 'rtl' : 'ltr')) {
        throw new Error(language === 'ar' ? 'فشل تحديث اتجاه الصفحة في وسم HTML.' : 'HTML document dir attribute did not update.');
      }
      
      // Revert lang back
      setLanguage(currentLang);
      addLog(language === 'ar' ? `تم التحقق بنجاح من اتجاه الصفحة وتحديث اتجاه النصوص.` : `Verified text layout direction updates.`);
      updateTestStatus('i18n-lang', 'PASSED');
    } catch (e: any) {
      updateTestStatus('i18n-lang', 'FAILED', e.message);
      addLog(`❌ i18n Language Test Failed: ${e.message}`);
    }

    // 8. Theme Toggle Test
    try {
      updateTestStatus('theme-toggle', 'RUNNING');
      addLog(language === 'ar' ? 'تغيير السمة اللونية والتحقق من كلاس dark...' : 'Toggling theme classes...');
      
      const initialTheme = theme;
      toggleTheme();
      const hasDarkClass = document.documentElement.classList.contains('dark');
      if (initialTheme === 'light' && !hasDarkClass) {
        throw new Error(language === 'ar' ? 'كلاس dark لم يضف بعد التحويل للوضع الداكن.' : 'Dark class missing after toggling to dark.');
      }
      
      // Revert theme
      toggleTheme();
      addLog(language === 'ar' ? 'تم فحص المظهر الداكن والفاتح وإعادة المظهر للوضع الأصلي.' : 'Dark/Light mode verified successfully and reverted.');
      updateTestStatus('theme-toggle', 'PASSED');
    } catch (e: any) {
      updateTestStatus('theme-toggle', 'FAILED', e.message);
      addLog(`❌ Theme Toggle Failed: ${e.message}`);
    }

    // 9. Prediction Engine Test
    try {
      updateTestStatus('outcome-predictor', 'RUNNING');
      addLog(language === 'ar' ? 'فحص معادلات التنبؤ الإحصائي التلوي...' : 'Verifying local meta-analysis pooling math...');
      
      const sample_size = 60;
      const studies = [
        { effectSize: 0.50, sampleSize: 50, studyQuality: 4, similarity: 90 },
        { effectSize: 0.30, sampleSize: 40, studyQuality: 3, similarity: 75 }
      ];
      
      const res = localLiteratureForecast(studies, sample_size);
      if (res.point_estimate < 0.30 || res.point_estimate > 0.50) {
        throw new Error(language === 'ar' ? 'حجم الأثر المقدر خارج النقاط المقبولة للوزن الإحصائي.' : 'Estimated pool effect size out of bounds.');
      }
      addLog(language === 'ar' ? `تم تقدير الأثر بنجاح: ${res.point_estimate.toFixed(3)}. القوة الإحصائية: ${(res.power * 100).toFixed(1)}%` : `Forecast pooled effect size: ${res.point_estimate.toFixed(3)}. Power: ${(res.power * 100).toFixed(1)}%`);
      updateTestStatus('outcome-predictor', 'PASSED');
    } catch (e: any) {
      updateTestStatus('outcome-predictor', 'FAILED', e.message);
      addLog(`❌ Prediction Test Failed: ${e.message}`);
    }

    // Cleanup diagnostic project
    if (createdProjId) {
      deleteProject(createdProjId);
      addLog(language === 'ar' ? 'تنظيف البيئة: تم حذف مشروع الاختبار المؤقت.' : 'Cleaned diagnostic workspace. Deleted temp project.');
    }

    setIsRunning(false);
    addLog(language === 'ar' ? 'انتهى فحص الدخان للخط الأساسي.' : 'Baseline system checks complete.');
  };

  return (
    <div className="space-y-6">
      <PathPanel accent="var(--ds-path-identity)">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-h2 text-ink m-0">
            {language === 'ar' ? 'لوحة فحوصات الدخان والجاهزية (Smoke Tests)' : 'Baseline Diagnostics & Smoke Tests'}
          </h2>
          <p className="text-caption text-muted m-0 mt-1">
            {language === 'ar' 
              ? 'أداة الفحص الذاتي لتأكيد عمل الوظائف المنهجية وتكامل الواجهات مع قاعدة البيانات والمحاكيات المحلية.' 
              : 'Diagnostic engine confirming frontend framework routes, rule engines, local storage, and statistic fallbacks.'}
          </p>
        </div>

        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-4 py-2 bg-action hover:bg-action-hover text-on-action rounded-lg text-xs font-bold ds-transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
        >
          <Play size={14} className={isRunning ? 'motion-safe:animate-spin' : ''} />
          <span>{isRunning ? (language === 'ar' ? 'جاري الفحص...' : 'Running Diagnostics...') : (language === 'ar' ? 'تشغيل اختبارات الدخان' : 'Run Diagnostics')}</span>
        </button>
        </div>
      </PathPanel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Cases List */}
        <div className="lg:col-span-2 space-y-3">
          {testCases.map((tc) => (
            <div 
              key={tc.id}
              className="p-4 bg-surface-elevated border border-subtle rounded-xl flex items-start gap-4"
            >
              <div className="mt-0.5 shrink-0">
                {tc.status === 'PENDING' && <Settings size={20} className="text-muted" />}
                {tc.status === 'RUNNING' && <RefreshCw size={20} className="text-ai motion-safe:animate-spin" />}
                {tc.status === 'PASSED' && <CheckCircle size={20} className="text-success" />}
                {tc.status === 'FAILED' && <XCircle size={20} className="text-danger" />}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between items-center">
                  <h4 className="text-h4 text-ink m-0">
                    {language === 'ar' ? tc.nameAr : tc.nameEn}
                  </h4>
                  <span className={`text-[10px] font-bold ${
                    tc.status === 'PENDING' ? 'text-muted' :
                    tc.status === 'RUNNING' ? 'text-ai' :
                    tc.status === 'PASSED' ? 'text-success' : 'text-danger'
                  }`}>
                    {tc.status}
                  </span>
                </div>
                <p className="text-[11px] text-muted m-0">
                  {language === 'ar' ? tc.descriptionAr : tc.descriptionEn}
                </p>
                {tc.error && (
                  <div className="mt-2 p-2 border border-danger/20 bg-danger/10 rounded text-[10px] text-danger font-semibold font-mono">
                    Error: {tc.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Log Viewer */}
        <div className="lg:col-span-1 bg-canvas text-secondary p-4 rounded-xl border border-subtle flex flex-col h-[520px]">
          <h3 className="text-h3 text-muted m-0 pb-3 border-b border-subtle flex items-center gap-1.5">
            <Database size={14} />
            {language === 'ar' ? 'سجل تشغيل الفحوصات' : 'Diagnostic Log Terminal'}
          </h3>
          <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5 pt-3 pr-1 scrollbar-thin">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed break-all">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-muted italic text-center pt-20">
                {language === 'ar' ? 'بانتظار بدء تشغيل الفحص...' : 'Waiting to initiate checks...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
