import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  Button,
  IconButton,
  Card,
  MetricCard,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Badge,
  Alert,
  Tooltip,
  Progress,
  Skeleton,
  EmptyState,
  Modal,
  Drawer,
  Table,
  Tabs,
  Stepper,
  PageHeader,
  SectionHeader,
  ResearchIcon,
  StudyDesignIllustration,
  SimulationIllustration,
  PredictionIllustration,
  DataAnalysisIllustration,
  ScientificPublishingIllustration,
  SimulationDisclaimer
} from '../design-system';
import { 
  Sparkles, 
  HelpCircle, 
  Eye, 
  Settings, 
  BookOpen, 
  Activity, 
  Database,
  ArrowRight
} from 'lucide-react';

export const DesignSystemShowcase: React.FC = () => {
  const { 
    language, 
    setLanguage, 
    theme, 
    toggleTheme 
  } = useProject();

  // Showcase state options
  const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [reducedMotion, setReducedMotion] = useState(false);
  
  // Component demo state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tab-1');
  const [activeStep, setActiveStep] = useState('step-1');
  
  // Form input states
  const [inputVal, setInputVal] = useState('نص تجريبي للتحقق');
  const [selectVal, setSelectVal] = useState('opt-1');
  const [switchVal, setSwitchVal] = useState(true);
  const [checkVal, setCheckVal] = useState(false);
  const [radioVal, setRadioVal] = useState('r-1');

  // Stepper steps definition
  const stepperSteps = [
    { id: 'step-1', label: language === 'ar' ? 'تصميم الدراسة' : 'Study Design', status: 'completed' as const },
    { id: 'step-2', label: language === 'ar' ? 'حساب القوة والعينة' : 'Power & Sample', status: 'current' as const },
    { id: 'step-3', label: language === 'ar' ? 'التسجيل المسبق' : 'Pre-Registration', status: 'available' as const },
    { id: 'step-4', label: language === 'ar' ? 'التنبؤ المتقدم' : 'Advanced Forecast', status: 'locked' as const }
  ];

  const handleDeviceChange = (device: 'desktop' | 'tablet' | 'mobile') => {
    setDevicePreview(device);
  };

  return (
    <div className={`space-y-8 p-4 ${reducedMotion ? 'motion-reduce' : ''}`}>
      {/* 1. Page Header */}
      <PageHeader
        title={language === 'ar' ? 'نظام التصميم بصيرة V2' : 'Basseera Design System V2'}
        description={language === 'ar' 
          ? 'استعراض شامل لمكونات وتوكينات نظام التصميم المطور بصيرة V2، والمبني بجوار النظام القديم دون إخلال ببيانات المشروع.'
          : 'Interactive showcase for Basseera Design System V2 components, styled alongside baseline theme.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Lang switch */}
            <Button variant="secondary" size="sm" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
            {/* Theme switch */}
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>
            {/* Reduced motion toggle */}
            <Button variant="secondary" size="sm" onClick={() => setReducedMotion(!reducedMotion)}>
              {reducedMotion ? (language === 'ar' ? 'تم تعطيل الحركة' : 'Motion Disabled') : (language === 'ar' ? 'تمكين تقليل الحركة' : 'Reduce Motion')}
            </Button>
          </div>
        }
      />

      {/* 2. Device preview constraints */}
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--ds-border-subtle)] overflow-x-auto no-scrollbar">
        <span className="text-xs text-[var(--ds-text-secondary)] font-bold">
          {language === 'ar' ? 'معاينة المقاسات:' : 'Responsive Preview:'}
        </span>
        <Button 
          variant={devicePreview === 'desktop' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => handleDeviceChange('desktop')}
        >
          {language === 'ar' ? 'شاشة حاسب (100%)' : 'Desktop (100%)'}
        </Button>
        <Button 
          variant={devicePreview === 'tablet' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => handleDeviceChange('tablet')}
        >
          {language === 'ar' ? 'جهاز لوحي (768px)' : 'Tablet (768px)'}
        </Button>
        <Button 
          variant={devicePreview === 'mobile' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => handleDeviceChange('mobile')}
        >
          {language === 'ar' ? 'هاتف محمول (375px)' : 'Mobile (375px)'}
        </Button>
      </div>

      {/* Constraints wrapper */}
      <div className="mx-auto transition-all duration-300 bg-[var(--ds-background-canvas)]" style={{
        maxWidth: devicePreview === 'desktop' ? '100%' : devicePreview === 'tablet' ? '768px' : '375px',
        border: devicePreview !== 'desktop' ? '4px solid var(--ds-border-strong)' : 'none',
        borderRadius: devicePreview !== 'desktop' ? '24px' : '0',
        padding: devicePreview !== 'desktop' ? '16px' : '0',
      }}>

        <div className="space-y-12">
          {/* A. colors & Tokens */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '1. لوحة الألوان والتوكينات (Semantic Colors)' : '1. Semantic Colors & Tokens'} />
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-background-canvas)] text-center space-y-1">
                <div className="h-8 w-full rounded bg-[var(--ds-background-canvas)] border border-[var(--ds-border-subtle)]" />
                <span className="text-[10px] font-bold block">Background Canvas</span>
              </div>
              <div className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-center space-y-1">
                <div className="h-8 w-full rounded bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)]" />
                <span className="text-[10px] font-bold block">Surface Primary</span>
              </div>
              <div className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-center space-y-1">
                <div className="h-8 w-full rounded bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)]" />
                <span className="text-[10px] font-bold block">Surface Secondary</span>
              </div>
              <div className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-tertiary)] text-center space-y-1">
                <div className="h-8 w-full rounded bg-[var(--ds-surface-tertiary)] border border-[var(--ds-border-subtle)]" />
                <span className="text-[10px] font-bold block">Surface Tertiary</span>
              </div>
              <div className="p-3 rounded-xl border border-[var(--ds-border-subtle)] text-center bg-[var(--ds-surface-primary)] space-y-1">
                <div className="h-8 w-full rounded bg-[var(--ds-primary)]" />
                <span className="text-[10px] font-bold block text-[var(--ds-primary)]">Primary Accent</span>
              </div>
              <div className="p-3 rounded-xl border border-[var(--ds-border-subtle)] text-center bg-[var(--ds-surface-primary)] space-y-1">
                <div className="h-8 w-full rounded bg-[var(--ds-research-blue)]" />
                <span className="text-[10px] font-bold block text-[var(--ds-research-blue)]">Research Blue</span>
              </div>
            </div>
          </section>

          {/* B. Typography */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '2. مقاييس الطباعة والخطوط (Typography)' : '2. Typography Scale'} />
            <div className="space-y-3 p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)]">
              <div>
                <span className="text-[9px] text-[var(--ds-text-muted)] uppercase block font-bold">display-xl (800)</span>
                <h1 className="text-3xl md:text-4xl font-extrabold m-0 text-[var(--ds-text-primary)]">بصيرة للبحث العلمي</h1>
              </div>
              <div className="pt-2 border-t border-[var(--ds-border-subtle)]">
                <span className="text-[9px] text-[var(--ds-text-muted)] uppercase block font-bold">section-title (600)</span>
                <h3 className="text-lg md:text-xl font-bold m-0 text-[var(--ds-text-primary)]">مختبر تصميم ومحاكاة البحوث العلمية</h3>
              </div>
              <div className="pt-2 border-t border-[var(--ds-border-subtle)]">
                <span className="text-[9px] text-[var(--ds-text-muted)] uppercase block font-bold">body (400)</span>
                <p className="text-xs text-[var(--ds-text-secondary)] leading-relaxed m-0">
                  يهدف هذا النظام البصري إلى حماية سلامة المنصة الأكاديمية وتقديم واجهات مستخدم متميزة ذات دقة تفاعلية ممتازة، تدعم التصفح باللغتين العربية والإنجليزية.
                </p>
              </div>
            </div>
          </section>

          {/* C. Buttons */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '3. الأزرار (Buttons & Icon Buttons)' : '3. Buttons & Controls'} />
            <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">{language === 'ar' ? 'إجراء ذكي رئيسي' : 'Primary Action'}</Button>
                <Button variant="secondary">{language === 'ar' ? 'إجراء ثانوي' : 'Secondary Action'}</Button>
                <Button variant="outline">{language === 'ar' ? 'مخطط خارجي' : 'Outline Action'}</Button>
                <Button variant="ghost">{language === 'ar' ? 'إجراء باهت' : 'Ghost Action'}</Button>
                <Button variant="danger">{language === 'ar' ? 'حذف / خطر' : 'Danger Action'}</Button>
                <Button variant="success">{language === 'ar' ? 'حفظ / نجاح' : 'Success Action'}</Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm" iconBefore={<Sparkles size={13} />}>
                  {language === 'ar' ? 'صغير مع أيقونة' : 'Small w/ Icon'}
                </Button>
                <Button variant="secondary" size="md" iconAfter={<ArrowRight size={14} />}>
                  {language === 'ar' ? 'متوسط مع سهم' : 'Medium w/ Arrow'}
                </Button>
                <Button variant="outline" size="lg" loading={true}>
                  {language === 'ar' ? 'جاري التحميل' : 'Loading State'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--ds-border-subtle)] pt-4">
                <IconButton variant="primary" icon={<Settings size={18} />} ariaLabel="Settings Icon" />
                <IconButton variant="outline" icon={<BookOpen size={18} />} ariaLabel="Readings Icon" />
                <IconButton variant="ghost" icon={<Activity size={18} />} ariaLabel="Diagnostics Icon" />
              </div>
            </div>
          </section>

          {/* D. Form Controls */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '4. عناصر الإدخال والنماذج (Form Controls)' : '4. Form Controls'} />
            <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  label={language === 'ar' ? 'عنوان البحث المقترح' : 'Research Title'}
                  requiredIndicator={true}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  helperText={language === 'ar' ? 'اكتب عنواناً معبراً يضم المتغيرات الأساسية.' : 'Provide study title.'}
                />
                
                <Select
                  label={language === 'ar' ? 'نوع التصميم المنهجي' : 'Research Design Type'}
                  value={selectVal}
                  onChange={(e) => setSelectVal(e.target.value)}
                  options={[
                    { value: 'opt-1', label: language === 'ar' ? 'شبه تجريبي (قبلي/بعدي)' : 'Quasi-Experimental (Pre/Post)' },
                    { value: 'opt-2', label: language === 'ar' ? 'تجريبي كامل (RCT)' : 'Randomized Controlled Trial (RCT)' },
                    { value: 'opt-3', label: language === 'ar' ? 'ارتباطي وصفي' : 'Descriptive Correlational' }
                  ]}
                />

                <Textarea
                  label={language === 'ar' ? 'صياغة مشكلة البحث' : 'Problem Statement'}
                  rows={3}
                  placeholder={language === 'ar' ? 'اكتب بالتفصيل الفجوة العلمية التي يعالجها بحثك...' : 'Describe the scientific gap...'}
                />
              </div>

              <div className="space-y-6 pt-2">
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-[var(--ds-text-secondary)] block">{language === 'ar' ? 'الخيارات الفرعية المنهجية:' : 'Methodological Options:'}</span>
                  <Checkbox 
                    label={language === 'ar' ? 'الموافقة على ميثاق الأمان والسرية الأكاديمية' : 'Consent to ethical research protocols'} 
                    checked={checkVal}
                    onChange={(e) => setCheckVal(e.target.checked)}
                  />
                  <Checkbox 
                    label={language === 'ar' ? 'تفعيل الحفظ السحابي التلقائي للمسودة' : 'Enable auto-save cloud replication'} 
                    checked={true}
                    disabled={true}
                  />
                </div>

                <div className="space-y-3 border-t border-[var(--ds-border-subtle)] pt-4">
                  <span className="text-[11px] font-bold text-[var(--ds-text-secondary)] block">{language === 'ar' ? 'طريقة قياس حجم الأثر:' : 'Effect Size Metric:'}</span>
                  <div className="flex gap-4">
                    <Radio 
                      label="Cohen's d" 
                      name="metric-group" 
                      checked={radioVal === 'r-1'} 
                      onChange={() => setRadioVal('r-1')} 
                    />
                    <Radio 
                      label="Eta-Squared (η²)" 
                      name="metric-group" 
                      checked={radioVal === 'r-2'} 
                      onChange={() => setRadioVal('r-2')} 
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-[var(--ds-border-subtle)] pt-4">
                  <Switch 
                    label={language === 'ar' ? 'تفعيل الوضع البحثي الآمن للمشروع' : 'Enable Secure Research Mode'} 
                    checked={switchVal} 
                    onToggle={setSwitchVal} 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* E. Cards & Metric Cards */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '5. البطاقات وإحصاءات القياس (Cards & Metric Cards)' : '5. Cards & Metrics'} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card variant="default" className="space-y-2">
                <Badge variant="simulated">SIMULATED</Badge>
                <h4 className="text-xs font-extrabold m-0 mt-2">{language === 'ar' ? 'بطاقة محاكاة إرشادية' : 'Interactive Simulation Card'}</h4>
                <p className="text-[11px] text-[var(--ds-text-secondary)] leading-relaxed m-0">
                  توضح هذه البطاقة النموذجية البيانات المولدة عشوائياً للسيناريوهات المنهجية.
                </p>
              </Card>

              <Card variant="ai-accent" className="space-y-2">
                <Badge variant="predicted">PREDICTED</Badge>
                <h4 className="text-xs font-extrabold m-0 mt-2">{language === 'ar' ? 'توصيات الذكاء الاصطناعي' : 'AI Recommendation Context'}</h4>
                <p className="text-[11px] text-[var(--ds-text-secondary)] leading-relaxed m-0">
                  يقدر نموذج الإنتاج نسبة نجاح الفرض بمقدار 81% بالنظر إلى المعطيات السابقة.
                </p>
              </Card>

              <MetricCard
                label={language === 'ar' ? 'حجم العينة المطلوب (N)' : 'Sample Size Required (N)'}
                metric={128}
                description={language === 'ar' ? 'محسوب عند مستوى دلالة 0.05' : 'Calculated at alpha = 0.05'}
                trend="up"
                trendLabel="+15%"
                tooltipText={language === 'ar' ? 'الحد الأدنى لحجم عينة القياس المطلوبة لتحقيق قوة إحصائية 80%.' : 'Min sample size to hit 80% power.'}
                icon={<Database size={16} />}
              />
            </div>
          </section>

          {/* F. Badges & Alerts */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '6. التنبيهات والأوسمة (Alerts & Badges)' : '6. Alerts & Status Badges'} />
            <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] space-y-6">
              <div className="flex flex-wrap gap-2.5">
                <Badge variant="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</Badge>
                <Badge variant="active">{language === 'ar' ? 'نشط' : 'Active'}</Badge>
                <Badge variant="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</Badge>
                <Badge variant="needs-review">{language === 'ar' ? 'يحتاج تدقيق' : 'Needs Review'}</Badge>
                <Badge variant="warning">{language === 'ar' ? 'تحذير' : 'Warning'}</Badge>
                <Badge variant="critical">{language === 'ar' ? 'حرج' : 'Critical'}</Badge>
                <Badge variant="simulated">SIMULATED_DATA</Badge>
                <Badge variant="predicted">PREDICTED_DATA</Badge>
                <Badge variant="observed">OBSERVED_DATA</Badge>
              </div>

              <div className="space-y-3 border-t border-[var(--ds-border-subtle)] pt-4">
                <Alert variant="info" title="توجيه منهجي">
                  {language === 'ar' ? 'تم استيراد الفروض بنجاح، يرجى فحص مدقق الاتساق للتأكيد.' : 'Hypotheses imported. Run check to verify.'}
                </Alert>
                
                <Alert variant="warning" title="تنبيه جودة القياس">
                  {language === 'ar' ? 'يوجد تفاوت كبير في تباين المجموعات، قد يؤثر ذلك على دقة اختبار t.' : 'Group variance disparity is high. May distort t-test power.'}
                </Alert>

                <SimulationDisclaimer />
              </div>
            </div>
          </section>

          {/* G. Navigation, Stepper, Tables */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '7. عناصر التنقل والجداول (Stepper & Tabs & Tables)' : '7. Navigation & Stepper'} />
            <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] space-y-6">
              <Stepper 
                steps={stepperSteps} 
                currentStepId={activeStep} 
                onStepClick={setActiveStep} 
              />
              
              <Tabs
                items={[
                  { id: 'tab-1', label: language === 'ar' ? 'الدرجات القبلية' : 'Pre-test Scores', icon: <Database size={13} /> },
                  { id: 'tab-2', label: language === 'ar' ? 'سيناريوهات ماذا لو' : 'What-If Scenarios', icon: <HelpCircle size={13} /> },
                  { id: 'tab-3', label: language === 'ar' ? 'التحليل البصري' : 'Visual Charts', icon: <Eye size={13} /> }
                ]}
                activeId={activeTab}
                onChange={setActiveTab}
              />

              <Table headers={language === 'ar' ? ['رقم الطالب', 'المجموعة', 'درجة القبلية', 'درجة البعدية'] : ['Student ID', 'Group', 'Pre Score', 'Post Score']}>
                <tr className="hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)]">
                  <td className="p-3 font-semibold">TR-01</td>
                  <td className="p-3"><Badge variant="completed">Experimental</Badge></td>
                  <td className="p-3 font-bold text-indigo-600">35.0</td>
                  <td className="p-3 font-bold text-emerald-600">45.0</td>
                </tr>
                <tr className="hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)]">
                  <td className="p-3 font-semibold">CON-01</td>
                  <td className="p-3"><Badge variant="draft">Control</Badge></td>
                  <td className="p-3 font-bold text-indigo-600">34.0</td>
                  <td className="p-3 font-bold text-emerald-600">36.0</td>
                </tr>
              </Table>
            </div>
          </section>

          {/* H. Overlay Modals & Drawers */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '8. النوافذ المنبثقة والجانبية (Modals & Drawers)' : '8. Overlays & Modals'} />
            <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] flex gap-4">
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                {language === 'ar' ? 'فتح نافذة منبثقة (Modal)' : 'Open Modal'}
              </Button>
              <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
                {language === 'ar' ? 'فتح لوحة جانبية (Drawer)' : 'Open Drawer'}
              </Button>

              <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={language === 'ar' ? 'تفاصيل المنهج العلمي المعتمد' : 'Scientific Methodology Protocol'}
                footerActions={
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
                      {language === 'ar' ? 'إغلاق' : 'Close'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
                      {language === 'ar' ? 'موافق' : 'Acknowledge'}
                    </Button>
                  </>
                }
              >
                <p className="m-0 leading-relaxed">
                  يتعين على الباحثين مراجعة ميثاق لجنة الأخلاقيات (IRB) قبل حفظ دراسات الطلاب وتصدير تحليلات الـ SPSS.
                </p>
              </Modal>

              <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={language === 'ar' ? 'إعدادات القياس الفنية' : 'Advanced Diagnostic Settings'}
                footerActions={
                  <Button variant="primary" size="sm" onClick={() => setIsDrawerOpen(false)}>
                    {language === 'ar' ? 'حفظ التفضيلات' : 'Save Preferences'}
                  </Button>
                }
              >
                <div className="space-y-4">
                  <Input label="Server Port" value="8000" disabled={true} />
                  <Input label="Seed Number" value="42" />
                </div>
              </Drawer>
            </div>
          </section>

          {/* I. Illustrations & Empty States */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '9. الرسوم واللوحات التوضيحية (Academic Illustrations)' : '9. Illustrations & Empty States'} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] flex flex-wrap justify-center gap-6">
                <StudyDesignIllustration size={90} className="text-purple-600" />
                <SimulationIllustration size={90} className="text-emerald-500" />
                <PredictionIllustration size={90} className="text-indigo-600" />
                <DataAnalysisIllustration size={90} className="text-cyan-500" />
                <ScientificPublishingIllustration size={90} className="text-rose-500" />
              </div>

              <EmptyState
                title={language === 'ar' ? 'لا توجد بيانات محاكاة بعد' : 'No Simulated Dataset Found'}
                description={language === 'ar' 
                  ? 'يرجى الانتقال لمختبر المحاكاة وتحديد متوسطات الدرجات لتوليد العينات التجريبية.'
                  : 'Configure baseline scores in the simulation lab to yield simulated matrices.'}
                illustration={<SimulationIllustration size={100} className="text-[var(--ds-text-disabled)]" />}
                actionButton={
                  <Button variant="primary" size="sm">
                    {language === 'ar' ? 'توليد العينات الإحصائية' : 'Generate Dataset'}
                  </Button>
                }
              />
            </div>
          </section>

          {/* J. Feedback Utilities & Icons */}
          <section className="space-y-4">
            <SectionHeader title={language === 'ar' ? '10. أدوات التقييم والرموز (Feedback Utilities & Icons)' : '10. Feedback Utilities & Icons'} />
            <div className="p-6 border border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)] grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tooltip & Icon showcase */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-[var(--ds-text-secondary)] block">
                  {language === 'ar' ? 'تلميحات الأدوات والأيقونات الموحدة:' : 'Tooltips & ResearchIcons:'}
                </span>
                <div className="flex gap-4 items-center">
                  <Tooltip content={language === 'ar' ? 'تلميح أمني للوضع البحثي' : 'Secure protocol tooltip'}>
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 flex items-center gap-1.5 cursor-help">
                      <ResearchIcon name="ShieldAlert" size={16} />
                      <span className="text-[10px] font-bold">{language === 'ar' ? 'مؤمن' : 'Secure'}</span>
                    </div>
                  </Tooltip>

                  <Tooltip content={language === 'ar' ? 'مؤشر اتجاه RTL معكوس' : 'RTL inverted arrow indicator'}>
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 flex items-center gap-1.5 cursor-help">
                      <ResearchIcon name="ArrowRight" size={16} flipInRtl={true} />
                      <span className="text-[10px] font-bold">{language === 'ar' ? 'سهم ديناميكي' : 'Dynamic Arrow'}</span>
                    </div>
                  </Tooltip>
                </div>
              </div>

              {/* Progress bars showcase */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-[var(--ds-text-secondary)] block">
                  {language === 'ar' ? 'أشرطة تقدم التحميل:' : 'Progress Indicators:'}
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>{language === 'ar' ? 'إنجاز خطة البحث' : 'Research Plan progress'}</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} variant="primary" />

                  <div className="flex justify-between text-[10px] font-bold">
                    <span>{language === 'ar' ? 'جودة البيانات' : 'Data Integrity'}</span>
                    <span>90%</span>
                  </div>
                  <Progress value={90} variant="success" />
                </div>
              </div>

              {/* Skeleton showcase */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-[var(--ds-text-secondary)] block">
                  {language === 'ar' ? 'هياكل التحميل المؤقتة (Skeletons):' : 'Loading Skeletons:'}
                </span>
                <div className="space-y-2.5">
                  <Skeleton variant="text" className="w-1/2" />
                  <Skeleton variant="rect" className="h-10 w-full" />
                </div>
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};
export default DesignSystemShowcase;
