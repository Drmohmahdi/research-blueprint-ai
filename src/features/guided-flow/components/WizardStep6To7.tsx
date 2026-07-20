import React from 'react';
import { Plus, Trash, Clipboard, Database } from 'lucide-react';
import { generateStatisticalSyntax } from '../../../utils/syntaxGenerator';
import type { useProjectWizardState } from '../useProjectWizardState';
import { Card, Button, IconButton, Input, Textarea, Select, SectionHeader, Alert, EmptyState } from '../../../design-system';

interface WizardStep6To7Props {
  engine: ReturnType<typeof useProjectWizardState>;
}

export const WizardStep6To7: React.FC<WizardStep6To7Props> = ({ engine }) => {
  const {
    step,
    syntaxTab,
    setSyntaxTab,
    formData,
    language,
    handleSampleSettingChange,
    addVariable,
    updateVariable,
    requestDelete,
    showToast
  } = engine;

  if (step === 6) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title={language === 'ar' ? 'متغيرات وأدوات الدراسة' : 'Study Variables & Tools'}
          actions={
            <Button
              type="button"
              variant="primary"
              size="sm"
              iconBefore={<Plus size={14} />}
              onClick={addVariable}
            >
              {language === 'ar' ? 'أضف متغيراً' : 'Add Variable'}
            </Button>
          }
        />

        <div className="space-y-4">
          {formData.variables.map((v, idx) => (
            <Card key={v.id} variant="default" padding="sm" className="relative bg-[var(--ds-surface-secondary)]">
              <div className="absolute top-4 left-4">
                <IconButton
                  ariaLabel={language === 'ar' ? 'حذف المتغير' : 'Delete variable'}
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={16} className="text-[var(--ds-danger)]" />}
                  onClick={() => requestDelete('variable', idx)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8">
                <Input
                  label={language === 'ar' ? 'اسم المتغير (عربي)' : 'Variable Name (AR)'}
                  type="text"
                  value={v.nameAr}
                  onChange={(e) => updateVariable(idx, 'nameAr', e.target.value)}
                />
                <Input
                  label={language === 'ar' ? 'اسم المتغير (إنجليزي)' : 'Variable Name (EN)'}
                  type="text"
                  value={v.nameEn}
                  onChange={(e) => updateVariable(idx, 'nameEn', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={language === 'ar' ? 'نوع المتغير' : 'Variable Type'}
                  value={v.type}
                  onChange={(e) => updateVariable(idx, 'type', e.target.value)}
                  options={[
                    { value: 'independent', label: language === 'ar' ? 'مستقل' : 'Independent' },
                    { value: 'dependent', label: language === 'ar' ? 'تابع' : 'Dependent' },
                    { value: 'mediator', label: language === 'ar' ? 'وسيط' : 'Mediator' },
                    { value: 'moderator', label: language === 'ar' ? 'معدل' : 'Moderator' },
                    { value: 'control', label: language === 'ar' ? 'ضابط' : 'Control' },
                  ]}
                />
                <Select
                  label={language === 'ar' ? 'مستوى القياس' : 'Scale of Measurement'}
                  value={v.scale}
                  onChange={(e) => updateVariable(idx, 'scale', e.target.value)}
                  options={[
                    { value: 'nominal', label: language === 'ar' ? 'اسمي' : 'Nominal' },
                    { value: 'ordinal', label: language === 'ar' ? 'رتبي' : 'Ordinal' },
                    { value: 'interval', label: language === 'ar' ? 'فتراتي' : 'Interval' },
                    { value: 'ratio', label: language === 'ar' ? 'نسبي' : 'Ratio' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={language === 'ar' ? 'الحد الأدنى' : 'Min Value'}
                  type="number"
                  value={v.minValue ?? ''}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    if (Number.isFinite(value)) updateVariable(idx, 'minValue', value);
                  }}
                />
                <Input
                  label={language === 'ar' ? 'الحد الأقصى' : 'Max Value'}
                  type="number"
                  value={v.maxValue ?? ''}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    if (Number.isFinite(value)) updateVariable(idx, 'maxValue', value);
                  }}
                />
              </div>

              <Textarea
                label={language === 'ar' ? 'وصف المتغير وأداة القياس' : 'Variable & Measurement Tool Description'}
                rows={2}
                value={(language === 'ar' ? v.descriptionAr : v.descriptionEn) || ''}
                onChange={(e) => updateVariable(idx, language === 'ar' ? 'descriptionAr' : 'descriptionEn', e.target.value)}
              />
            </Card>
          ))}
          {formData.variables.length === 0 && (
            <EmptyState
              illustration={<Database size={32} />}
              title={language === 'ar' ? 'لا توجد متغيرات دراسة بعد' : 'No study variables yet'}
              description={language === 'ar' ? 'أضف المتغيرات المستقلة والتابعة لتفعيل خطة التحليل الإحصائي.' : 'Add independent and dependent variables to enable the statistical analysis plan.'}
            />
          )}
        </div>
      </div>
    );
  }

  if (step === 7) {
    const syntax = generateStatisticalSyntax(formData);
    const codeText = syntax[syntaxTab] || '';

    const handleCopy = () => {
      navigator.clipboard.writeText(codeText);
      showToast('success', language === 'ar' ? 'تم نسخ الكود إلى الحافظة!' : 'Code copied to clipboard!');
    };

    return (
      <div className="space-y-4">
        <SectionHeader title={language === 'ar' ? 'خطة التحليل الإحصائي' : 'Statistical Analysis Plan'} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label={language === 'ar' ? 'مستوى الدلالة (α)' : 'Significance Level (α)'}
            type="number"
            step="0.01"
            value={formData.sampleSettings.marginOfError}
            onChange={(e) => handleSampleSettingChange('marginOfError', parseFloat(e.target.value) || 0.05)}
          />

          <Input
            label={language === 'ar' ? 'القوة الإحصائية المستهدفة' : 'Target Power (1-β)'}
            type="number"
            step="0.05"
            value={formData.sampleSettings.expectedPower}
            onChange={(e) => handleSampleSettingChange('expectedPower', parseFloat(e.target.value) || 0.8)}
          />

          <Input
            label={language === 'ar' ? 'حجم الأثر المتوقع (d)' : 'Expected Effect Size (d)'}
            type="number"
            step="0.1"
            value={formData.sampleSettings.expectedEffectSize}
            onChange={(e) => handleSampleSettingChange('expectedEffectSize', parseFloat(e.target.value) || 0.5)}
          />
        </div>

        <Alert variant="info" title={language === 'ar' ? 'توصية التحليل التلقائية' : 'Automatic Analysis Recommendation'}>
          {formData.studyDesign.includes('quasi')
            ? (language === 'ar'
              ? 'لضبط درجات الفروق القبلية، يوصى بشدة باستخدام تحليل التباين المصاحب (ANCOVA) كاختبار أساسي واختبار الفروض.'
              : 'To control for pre-test variance, we highly recommend using Analysis of Covariance (ANCOVA) as your primary hypothesis test.')
            : (language === 'ar'
              ? 'بناءً على التصميم المختار، يمكنك استخدام اختبار تاء للمجموعات المستقلة أو تحليل التباين أحادي الاتجاه (ANOVA).'
              : 'Based on the chosen design, you can use independent t-test or one-way ANOVA.')}
        </Alert>

        {/* Generated Syntax Section */}
        <Card variant="default" padding="sm" className="space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--ds-border-subtle)]">
            <span className="text-xs font-bold text-[var(--ds-text-primary)]">
              {language === 'ar' ? 'أكواد التحليل الإحصائي الجاهزة' : 'Generated Statistical Syntax'}
            </span>

            {/* Syntax Tabs */}
            <div className="flex gap-1.5">
              {(['spss', 'r', 'python'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSyntaxTab(tab)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer border-none ${
                    syntaxTab === tab
                      ? 'bg-[var(--ds-primary)] text-white'
                      : 'text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-tertiary)] bg-transparent'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <pre className="bg-[var(--ds-background-subtle)] p-3 rounded-lg text-[10px] font-mono text-[var(--ds-text-secondary)] overflow-x-auto whitespace-pre-wrap leading-normal border border-[var(--ds-border-subtle)] max-h-48 overflow-y-auto">
              {codeText}
            </pre>
            <IconButton
              ariaLabel={language === 'ar' ? 'نسخ الكود' : 'Copy code'}
              variant="secondary"
              size="sm"
              icon={<Clipboard size={14} />}
              onClick={handleCopy}
              className="absolute top-2 left-2"
            />
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

