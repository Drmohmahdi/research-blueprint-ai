import { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import type { ResearchProject, ResearchVariable } from '../../types/research';

export type ToastMessage = { type: 'success' | 'error'; message: string } | null;
export type DeleteKind = 'question' | 'hypothesis' | 'variable';
export type PendingDelete = { kind: DeleteKind; index: number } | null;

const WIZARD_STEPS = [1, 2, 3, 4, 5, 6, 7];

export const useProjectWizardState = () => {
  const { activeProject, updateProject, createProject, language } = useProject();

  const [step, setStep] = useState(1);
  const [syntaxTab, setSyntaxTab] = useState<'spss' | 'r' | 'python'>('spss');
  const [formData, setFormData] = useState<ResearchProject>({
    id: '',
    titleAr: '',
    titleEn: '',
    departmentAr: '',
    departmentEn: '',
    institutionAr: '',
    institutionEn: '',
    descriptionAr: '',
    descriptionEn: '',
    problemStatementAr: '',
    problemStatementEn: '',
    studyDesign: 'quasi_experimental_pre_post',
    variables: [],
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
    },
    version: 1
  });

  // Tracks the last successfully saved snapshot, used to detect unsaved changes
  const [lastSavedData, setLastSavedData] = useState<ResearchProject>(formData);
  const [toast, setToast] = useState<ToastMessage>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const isFirstStepRender = useRef(true);

  // Sync formData with activeProject when it changes
  useEffect(() => {
    if (activeProject) {
      setFormData({ ...activeProject });
      setLastSavedData({ ...activeProject });
    }
  }, [activeProject]);

  const isDirty = JSON.stringify(formData) !== JSON.stringify(lastSavedData);

  // Warn the user before closing/refreshing the tab if there are unsaved changes,
  // since navigating away otherwise silently discards them.
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const validateSampleSettings = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const settings = formData.sampleSettings;
    const populationSize = settings.populationSize;
    if (typeof populationSize !== 'number' || !Number.isInteger(populationSize) || populationSize <= 0) {
      errors.populationSize = language === 'ar' ? 'أدخل حجم مجتمع صحيحاً أكبر من صفر' : 'Enter a whole population size greater than zero';
    }
    if (!Number.isInteger(settings.groupsCount) || settings.groupsCount < 1) {
      errors.groupsCount = language === 'ar' ? 'أدخل مجموعة واحدة على الأقل' : 'Enter at least one group';
    }
    if (!Number.isFinite(settings.marginOfError) || settings.marginOfError <= 0 || settings.marginOfError > 0.5) {
      errors.marginOfError = language === 'ar' ? 'يجب أن يكون مستوى الدلالة بين 0 و0.5' : 'Significance level must be between 0 and 0.5';
    }
    if (!Number.isFinite(settings.expectedPower) || settings.expectedPower <= 0 || settings.expectedPower > 1) {
      errors.expectedPower = language === 'ar' ? 'يجب أن تكون القوة الإحصائية بين 0 و1' : 'Statistical power must be between 0 and 1';
    }
    if (!Number.isFinite(settings.expectedEffectSize) || settings.expectedEffectSize <= 0) {
      errors.expectedEffectSize = language === 'ar' ? 'أدخل حجم أثر موجباً' : 'Enter a positive effect size';
    }
    return errors;
  }, [formData.sampleSettings, language]);

  const validateVariables = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const variables = formData.variables;
    if (variables.length === 0) {
      errors.variables = language === 'ar' ? 'أضف متغيراً واحداً على الأقل' : 'Add at least one variable';
      return errors;
    }

    if (variables.some(variable => !variable.nameAr.trim() || !variable.nameEn.trim())) {
      errors.variables = language === 'ar' ? 'أدخل اسماً عربياً وإنجليزياً لكل متغير' : 'Enter Arabic and English names for every variable';
      return errors;
    }

    const hasInvalidRange = variables.some(variable => {
      if (variable.scale !== 'interval' && variable.scale !== 'ratio') return false;
      return !Number.isFinite(variable.minValue)
        || !Number.isFinite(variable.maxValue)
        || (variable.minValue as number) >= (variable.maxValue as number);
    });
    if (hasInvalidRange) {
      errors.variables = language === 'ar'
        ? 'يجب أن يكون الحد الأدنى أقل من الحد الأقصى للمتغيرات الكمية'
        : 'Quantitative variables must have a minimum value below their maximum value';
    }
    return errors;
  }, [formData.variables, language]);

  const validateResearchStatements = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (formData.questions.length === 0) {
      errors.questions = language === 'ar' ? 'أضف سؤالاً واحداً على الأقل' : 'Add at least one question';
    } else if (formData.questions.some(question => !question.textAr.trim() && !question.textEn.trim())) {
      errors.questions = language === 'ar' ? 'أدخل نصاً لكل سؤال دراسة' : 'Enter text for every research question';
    }

    if (formData.hypotheses.length === 0) {
      errors.hypotheses = language === 'ar' ? 'أضف فرضاً واحداً على الأقل' : 'Add at least one hypothesis';
    } else if (formData.hypotheses.some(hypothesis => !hypothesis.textAr.trim() && !hypothesis.textEn.trim())) {
      errors.hypotheses = language === 'ar' ? 'أدخل نصاً لكل فرض دراسة' : 'Enter text for every hypothesis';
    }
    return errors;
  }, [formData.questions, formData.hypotheses, language]);

  const validateResearchRelationships = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const variableIds = new Set(formData.variables.map(variable => variable.id));
    const questionIds = new Set(formData.questions.map(question => question.id));

    if (formData.questions.some(question => question.associatedVariables.some(variableId => !variableIds.has(variableId)))) {
      errors.relationships = language === 'ar'
        ? 'حدّث ارتباطات الأسئلة بعد حذف أو تعديل المتغيرات'
        : 'Update question links after deleting or changing variables';
      return errors;
    }

    const hasInvalidHypothesis = formData.hypotheses.some(hypothesis => {
      const independentVariable = formData.variables.find(variable => variable.id === hypothesis.independentVarId);
      const dependentVariable = formData.variables.find(variable => variable.id === hypothesis.dependentVarId);
      return !questionIds.has(hypothesis.questionId)
        || independentVariable?.type !== 'independent'
        || dependentVariable?.type !== 'dependent';
    });
    if (hasInvalidHypothesis) {
      errors.relationships = language === 'ar'
        ? 'اربط كل فرض بسؤال قائم ومتغير مستقل وآخر تابع'
        : 'Link every hypothesis to an existing question, independent variable, and dependent variable';
    }
    return errors;
  }, [formData.questions, formData.hypotheses, formData.variables, language]);

  const validateCoreDetails = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const fieldRequiredMessage = language === 'ar' ? 'هذا الحقل مطلوب' : 'This field is required';
    if (!formData.titleAr.trim()) errors.titleAr = fieldRequiredMessage;
    if (!formData.titleEn.trim()) errors.titleEn = fieldRequiredMessage;
    const problemStatement = language === 'ar' ? formData.problemStatementAr : formData.problemStatementEn;
    if (!problemStatement.trim()) {
      errors.problemStatement = fieldRequiredMessage;
    }
    return errors;
  }, [formData.titleAr, formData.titleEn, formData.problemStatementAr, formData.problemStatementEn, language]);

  const handleSave = useCallback((silent = false) => {
    const saveErrors = {
      ...validateCoreDetails(),
      ...validateSampleSettings(),
      ...validateVariables(),
      ...validateResearchStatements(),
      ...validateResearchRelationships()
    };
    if (Object.keys(saveErrors).length > 0) {
      if (!silent) showToast('error', Object.values(saveErrors)[0]);
      return false;
    }
    if (formData.id) {
      updateProject(formData);
    } else {
      createProject(formData);
    }
    setLastSavedData(formData);
    if (!silent) {
      showToast('success', language === 'ar' ? 'تم حفظ التعديلات بنجاح!' : 'Changes saved successfully!');
    }
    return true;
  }, [formData, updateProject, createProject, language, showToast, validateCoreDetails, validateSampleSettings, validateVariables, validateResearchStatements, validateResearchRelationships]);

  // Silent autosave whenever the user moves between steps, if there are unsaved changes
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    if (isDirty && formData.titleAr.trim()) {
      handleSave(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const validateStep = useCallback((s: number): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (s === 1) {
      Object.assign(errors, validateCoreDetails());
    }
    if (s === 2) {
      Object.assign(errors, validateCoreDetails());
      delete errors.titleAr;
      delete errors.titleEn;
    }
    if (s === 3) {
      Object.assign(errors, validateResearchStatements());
    }
    if (s === 6) {
      Object.assign(errors, validateVariables());
    }
    if (s === 5) {
      Object.assign(errors, validateSampleSettings());
      delete errors.marginOfError;
      delete errors.expectedPower;
      delete errors.expectedEffectSize;
    }
    if (s === 7) {
      Object.assign(errors, validateSampleSettings());
      Object.assign(errors, validateResearchRelationships());
      delete errors.populationSize;
      delete errors.groupsCount;
    }
    return errors;
  }, [formData, language, validateCoreDetails, validateSampleSettings, validateVariables, validateResearchStatements, validateResearchRelationships]);

  const isStepValid = useCallback((s: number) => Object.keys(validateStep(s)).length === 0, [validateStep]);

  const stepErrors = validateStep(step);
  const completionPercent = Math.round(
    (WIZARD_STEPS.filter((s) => isStepValid(s)).length / WIZARD_STEPS.length) * 100
  );

  const requestDelete = (kind: DeleteKind, index: number) => {
    setPendingDelete({ kind, index });
  };

  const cancelDelete = () => setPendingDelete(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { kind, index } = pendingDelete;
    if (kind === 'question') {
      setFormData(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }));
    } else if (kind === 'hypothesis') {
      setFormData(prev => ({ ...prev, hypotheses: prev.hypotheses.filter((_, i) => i !== index) }));
    } else if (kind === 'variable') {
      setFormData(prev => ({ ...prev, variables: prev.variables.filter((_, i) => i !== index) }));
    }
    setPendingDelete(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSampleSettingChange = (name: string, value: number) => {
    if (!Number.isFinite(value)) return;
    setFormData(prev => ({
      ...prev,
      sampleSettings: {
        ...prev.sampleSettings,
        [name]: value
      }
    }));
  };

  const addVariable = () => {
    const newVar: ResearchVariable = {
      id: `v-${Date.now()}`,
      nameAr: '',
      nameEn: '',
      type: 'dependent',
      scale: 'interval',
      maxValue: 100,
      minValue: 0,
      descriptionAr: '',
      descriptionEn: ''
    };
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
    }));
  };

  const updateVariable = (idx: number, field: keyof ResearchVariable, value: any) => {
    if ((field === 'minValue' || field === 'maxValue') && (typeof value !== 'number' || !Number.isFinite(value))) {
      return;
    }
    setFormData(prev => {
      const copy = [...prev.variables];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, variables: copy };
    });
  };

  return {
    step,
    setStep,
    syntaxTab,
    setSyntaxTab,
    formData,
    setFormData,
    language,
    handleSave,
    handleInputChange,
    handleSampleSettingChange,
    addVariable,
    updateVariable,
    isDirty,
    toast,
    showToast,
    stepErrors,
    isStepValid,
    completionPercent,
    pendingDelete,
    requestDelete,
    cancelDelete,
    confirmDelete
  };
};
