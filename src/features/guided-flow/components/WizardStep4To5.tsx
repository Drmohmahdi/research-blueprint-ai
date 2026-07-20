import React from 'react';
import type { useProjectWizardState } from '../useProjectWizardState';
import { Input, Select, SectionHeader } from '../../../design-system';

interface WizardStep4To5Props {
  engine: ReturnType<typeof useProjectWizardState>;
}

export const WizardStep4To5: React.FC<WizardStep4To5Props> = ({ engine }) => {
  const {
    step,
    formData,
    language,
    handleInputChange,
    handleSampleSettingChange
  } = engine;

  if (step === 4) {
    return (
      <div className="space-y-4">
        <SectionHeader title={language === 'ar' ? 'منهج وتصميم الدراسة' : 'Study Design & Methodology'} />

        <Select
          label={language === 'ar' ? 'المنهج الأساسي' : 'Primary Methodology'}
          name="studyDesign"
          value={formData.studyDesign}
          onChange={handleInputChange}
          options={[
            { value: 'experimental_rct', label: language === 'ar' ? 'تجريبي عشوائي (RCT)' : 'Randomized Experimental (RCT)' },
            { value: 'quasi_experimental_pre_post', label: language === 'ar' ? 'شبه تجريبي (قبلي/بعدي بمجموعتين)' : 'Quasi-Experimental (Pre/Post with 2 Groups)' },
            { value: 'single_group_pre_post', label: language === 'ar' ? 'شبه تجريبي (مجموعة واحدة قبلي/بعدي)' : 'Single Group Pre/Post' },
            { value: 'descriptive', label: language === 'ar' ? 'وصفي مسحي' : 'Descriptive Survey' },
            { value: 'correlational', label: language === 'ar' ? 'ارتباطي' : 'Correlational' },
            { value: 'predictive', label: language === 'ar' ? 'تنبؤي' : 'Predictive' },
          ]}
        />
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="space-y-4">
        <SectionHeader title={language === 'ar' ? 'تحديد المجتمع والعينة' : 'Population and Sample Settings'} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={language === 'ar' ? 'حجم المجتمع المتاح (تقريبي)' : 'Available Population Size'}
            type="number"
            value={formData.sampleSettings.populationSize || ''}
            onChange={(e) => handleSampleSettingChange('populationSize', parseInt(e.target.value) || 0)}
          />

          <Input
            label={language === 'ar' ? 'عدد المجموعات' : 'Number of Groups'}
            type="number"
            value={formData.sampleSettings.groupsCount}
            onChange={(e) => handleSampleSettingChange('groupsCount', parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
    );
  }

  return null;
};

