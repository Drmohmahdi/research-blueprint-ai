import React from 'react';
import { Plus, Trash, HelpCircle, FlaskConical } from 'lucide-react';
import type { useProjectWizardState } from '../useProjectWizardState';
import { Card, Button, IconButton, Input, Textarea, Select, SectionHeader, EmptyState, Checkbox } from '../../../design-system';

interface WizardStep1To3Props {
  engine: ReturnType<typeof useProjectWizardState>;
}

export const WizardStep1To3: React.FC<WizardStep1To3Props> = ({ engine }) => {
  const {
    step,
    formData,
    setFormData,
    language,
    handleInputChange,
    stepErrors,
    requestDelete
  } = engine;

  const toggleQuestionVariable = (idx: number, varId: string) => {
    const copy = [...formData.questions];
    const current = copy[idx].associatedVariables;
    copy[idx] = {
      ...copy[idx],
      associatedVariables: current.includes(varId)
        ? current.filter(id => id !== varId)
        : [...current, varId]
    };
    setFormData(prev => ({ ...prev, questions: copy }));
  };

  if (step === 1) {
    return (
      <div className="space-y-4">
        <SectionHeader title={language === 'ar' ? 'البيانات الأساسية للبحث' : 'Research Basic Information'} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={language === 'ar' ? 'عنوان البحث بالعربية' : 'Arabic Research Title'}
            requiredIndicator
            error={stepErrors.titleAr}
            type="text"
            name="titleAr"
            value={formData.titleAr}
            onChange={handleInputChange}
            placeholder={language === 'ar' ? 'أدخل العنوان بالكامل...' : 'Arabic title...'}
          />
          <Input
            label={language === 'ar' ? 'عنوان البحث بالإنجليزية' : 'English Research Title'}
            requiredIndicator
            error={stepErrors.titleEn}
            type="text"
            name="titleEn"
            value={formData.titleEn}
            onChange={handleInputChange}
            placeholder="English title..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={language === 'ar' ? 'المؤسسة/الجامعة بالعربية' : 'Institution (AR)'}
            type="text"
            name="institutionAr"
            value={formData.institutionAr || ''}
            onChange={handleInputChange}
          />
          <Input
            label={language === 'ar' ? 'المؤسسة/الجامعة بالإنجليزية' : 'Institution (EN)'}
            type="text"
            name="institutionEn"
            value={formData.institutionEn || ''}
            onChange={handleInputChange}
          />
        </div>

        <Textarea
          label={language === 'ar' ? 'وصف مختصر للفكرة' : 'Abstract/Short Description'}
          name={language === 'ar' ? 'descriptionAr' : 'descriptionEn'}
          value={(language === 'ar' ? formData.descriptionAr : formData.descriptionEn) || ''}
          onChange={handleInputChange}
          rows={4}
        />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <SectionHeader title={language === 'ar' ? 'مشكلة وفجوة البحث' : 'Research Problem & Gap'} />

        <Textarea
          label={language === 'ar' ? 'وصف المشكلة بالتفصيل' : 'Problem Statement in Detail'}
          requiredIndicator
          error={stepErrors.problemStatement}
          name={language === 'ar' ? 'problemStatementAr' : 'problemStatementEn'}
          value={(language === 'ar' ? formData.problemStatementAr : formData.problemStatementEn) || ''}
          onChange={handleInputChange}
          rows={6}
          placeholder={language === 'ar' ? 'صف الملاحظة، والمشكلة العلمية المكتشفة، والفجوة المعرفية...' : 'Describe the gap, scientific observations...'}
        />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <SectionHeader
            title={language === 'ar' ? 'أسئلة الدراسة' : 'Research Questions'}
            actions={
              <Button
                type="button"
                variant="primary"
                size="sm"
                iconBefore={<Plus size={14} />}
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    questions: [...prev.questions, {
                      id: `q-${Date.now()}`,
                      textAr: '',
                      textEn: '',
                      associatedVariables: []
                    }]
                  }));
                }}
              >
                {language === 'ar' ? 'أضف سؤالاً' : 'Add Question'}
              </Button>
            }
          />

          {formData.questions.map((q, idx) => (
            <Card key={q.id} variant="default" padding="sm" className="relative bg-[var(--ds-surface-secondary)]">
              <div className="absolute top-4 left-4">
                <IconButton
                  ariaLabel={language === 'ar' ? 'حذف السؤال' : 'Delete question'}
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={16} className="text-[var(--ds-danger)]" />}
                  onClick={() => requestDelete('question', idx)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 pt-8">
                <Input
                  type="text"
                  placeholder={language === 'ar' ? 'السؤال بالعربية' : 'Question text...'}
                  value={language === 'ar' ? q.textAr : q.textEn}
                  onChange={(e) => {
                    const copy = [...formData.questions];
                    copy[idx][language === 'ar' ? 'textAr' : 'textEn'] = e.target.value;
                    setFormData(prev => ({ ...prev, questions: copy }));
                  }}
                />

                {formData.variables.length > 0 ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 border-t border-[var(--ds-border-subtle)] mt-1">
                    <span className="text-[10px] font-bold text-[var(--ds-text-secondary)] w-full pt-2">
                      {language === 'ar' ? 'المتغيرات المرتبطة بهذا السؤال:' : 'Variables linked to this question:'}
                    </span>
                    {formData.variables.map(v => (
                      <Checkbox
                        key={v.id}
                        label={language === 'ar' ? (v.nameAr || v.nameEn || v.id) : (v.nameEn || v.nameAr || v.id)}
                        checked={q.associatedVariables.includes(v.id)}
                        onChange={() => toggleQuestionVariable(idx, v.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--ds-text-muted)] pt-1 m-0">
                    {language === 'ar'
                      ? 'أضف متغيرات في خطوة "المتغيرات والقياس" لتتمكن من ربطها بهذا السؤال.'
                      : 'Add variables in the "Measurement" step to link them to this question.'}
                  </p>
                )}
              </div>
            </Card>
          ))}
          {formData.questions.length === 0 && (
            <EmptyState
              illustration={<HelpCircle size={32} />}
              title={language === 'ar' ? 'لا توجد أسئلة دراسة بعد' : 'No research questions yet'}
              description={language === 'ar' ? 'أضف سؤالاً واحداً على الأقل لصياغة أسئلة الدراسة العلمية.' : 'Add at least one question to define your research questions.'}
            />
          )}
        </div>

        <div className="space-y-4">
          <SectionHeader
            title={language === 'ar' ? 'فروض الدراسة' : 'Hypotheses'}
            actions={
              <Button
                type="button"
                variant="primary"
                size="sm"
                iconBefore={<Plus size={14} />}
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    hypotheses: [...prev.hypotheses, {
                      id: `h-${Date.now()}`,
                      questionId: '',
                      textAr: '',
                      textEn: '',
                      type: 'directional',
                      independentVarId: '',
                      dependentVarId: ''
                    }]
                  }));
                }}
              >
                {language === 'ar' ? 'أضف فرضاً' : 'Add Hypothesis'}
              </Button>
            }
          />

          {formData.hypotheses.map((h, idx) => (
            <Card key={h.id} variant="default" padding="sm" className="relative bg-[var(--ds-surface-secondary)]">
              <div className="absolute top-4 left-4">
                <IconButton
                  ariaLabel={language === 'ar' ? 'حذف الفرض' : 'Delete hypothesis'}
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={16} className="text-[var(--ds-danger)]" />}
                  onClick={() => requestDelete('hypothesis', idx)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-8">
                <Input
                  type="text"
                  placeholder={language === 'ar' ? 'الفرض بالعربية' : 'Hypothesis text...'}
                  value={language === 'ar' ? h.textAr : h.textEn}
                  onChange={(e) => {
                    const copy = [...formData.hypotheses];
                    copy[idx][language === 'ar' ? 'textAr' : 'textEn'] = e.target.value;
                    setFormData(prev => ({ ...prev, hypotheses: copy }));
                  }}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    label={language === 'ar' ? 'السؤال المرتبط' : 'Related Question'}
                    value={h.questionId}
                    onChange={(e) => {
                      const copy = [...formData.hypotheses];
                      copy[idx].questionId = e.target.value;
                      setFormData(prev => ({ ...prev, hypotheses: copy }));
                    }}
                    options={[
                      { value: '', label: language === 'ar' ? 'بدون ربط' : 'Not linked' },
                      ...formData.questions.map((q, i) => ({
                        value: q.id,
                        label: `${language === 'ar' ? 'سؤال' : 'Q'} ${i + 1}: ${(q.textAr || q.textEn || '').slice(0, 30) || '—'}`
                      }))
                    ]}
                  />
                  <Select
                    label={language === 'ar' ? 'المتغير المستقل' : 'Independent Variable'}
                    value={h.independentVarId}
                    onChange={(e) => {
                      const copy = [...formData.hypotheses];
                      copy[idx].independentVarId = e.target.value;
                      setFormData(prev => ({ ...prev, hypotheses: copy }));
                    }}
                    options={[
                      { value: '', label: language === 'ar' ? 'بدون تحديد' : 'Not set' },
                      ...formData.variables
                        .filter((v) => v.type === 'independent')
                        .map((v) => ({
                          value: v.id,
                          label: language === 'ar' ? (v.nameAr || v.nameEn || v.id) : (v.nameEn || v.nameAr || v.id)
                        }))
                    ]}
                  />
                  <Select
                    label={language === 'ar' ? 'المتغير التابع' : 'Dependent Variable'}
                    value={h.dependentVarId}
                    onChange={(e) => {
                      const copy = [...formData.hypotheses];
                      copy[idx].dependentVarId = e.target.value;
                      setFormData(prev => ({ ...prev, hypotheses: copy }));
                    }}
                    options={[
                      { value: '', label: language === 'ar' ? 'بدون تحديد' : 'Not set' },
                      ...formData.variables
                        .filter((v) => v.type === 'dependent')
                        .map((v) => ({
                          value: v.id,
                          label: language === 'ar' ? (v.nameAr || v.nameEn || v.id) : (v.nameEn || v.nameAr || v.id)
                        }))
                    ]}
                  />
                </div>
              </div>
            </Card>
          ))}
          {formData.hypotheses.length === 0 && (
            <EmptyState
              illustration={<FlaskConical size={32} />}
              title={language === 'ar' ? 'لا توجد فروض دراسة بعد' : 'No hypotheses yet'}
              description={language === 'ar' ? 'أضف فرضاً واحداً على الأقل واربطه بالسؤال والمتغيرات المناسبة.' : 'Add at least one hypothesis and link it to the relevant question and variables.'}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
};

