import type { ResearchProject, StudyDesignType } from '../types/research';

export interface ParsedTitle {
  independentVariables: string[];
  dependentVariables: string[];
  mediators: string[];
  moderators: string[];
  controls: string[];
  population: string;
  context: string;
  suggestedMethodology: StudyDesignType;
  confidence: number;
  ambiguities: string[];
  followUpQuestions: string[];
  isFallback?: boolean;
}

export interface AuditIssue {
  id: string;
  type: 'critical' | 'warning' | 'improvement';
  textAr: string;
  textEn: string;
  section: string;
}

export interface AuditResult {
  score: number;
  issues: AuditIssue[];
}

/**
 * Parses research titles using heuristic rules for Arabic and English
 */
export function analyzeTitle(title: string): ParsedTitle {
  const t = title.trim();
  
  // Default values
  let independentVariables: string[] = [];
  let dependentVariables: string[] = [];
  let population = '';
  let suggestedMethodology: StudyDesignType = 'descriptive';
  let confidence = 0.7;
  let ambiguities: string[] = [];
  let followUpQuestions: string[] = [];

  const isArabic = /[\u0600-\u06FF]/.test(t);

  if (isArabic) {
    // Look for experimental indicators: "أثر", "فاعلية", "برنامج مقترح", "تأثير", "استخدام"
    if (t.includes('أثر') || t.includes('فاعلية') || t.includes('تأثير') || t.includes('برنامج')) {
      suggestedMethodology = 'quasi_experimental_pre_post';
      confidence = 0.85;
      
      // Heuristic extraction for "أثر [المستقل] في [التابع] لدى [العينة]" or "أثر [المستقل] على [التابع] لدى [العينة]"
      const matchEff = t.match(/(?:أثر|فاعلية|تأثير)\s+(.*?)\s+(?:في|على|في تحسين|في تنمية)\s+(.*?)(?:\s+(?:لدى|عند|على طلاب)\s+(.*))?$/);
      if (matchEff) {
        independentVariables = [matchEff[1].trim()];
        
        let dvPart = matchEff[2].trim();
        // If there's a population marker inside the DV part
        const popMarkerIndex = dvPart.indexOf(' لدى');
        const popMarkerIndex2 = dvPart.indexOf(' عند');
        if (popMarkerIndex !== -1) {
          population = dvPart.substring(popMarkerIndex + 4).trim();
          dvPart = dvPart.substring(0, popMarkerIndex).trim();
        } else if (popMarkerIndex2 !== -1) {
          population = dvPart.substring(popMarkerIndex2 + 4).trim();
          dvPart = dvPart.substring(0, popMarkerIndex2).trim();
        } else if (matchEff[3]) {
          population = matchEff[3].trim();
        }
        
        dependentVariables = [dvPart];
      }
    } else if (t.includes('علاقة') || t.includes('الارتباطية') || t.includes('ارتباط')) {
      suggestedMethodology = 'correlational';
      confidence = 0.9;
      const matchCorr = t.match(/علاقة\s+(.*?)\s+بـ\s+(.*?)(?:\s+(?:لدى|عند)\s+(.*))?$/) || t.match(/العلاقة\s+بين\s+(.*?)\s+و\s+(.*?)(?:\s+(?:لدى|عند)\s+(.*))?$/);
      if (matchCorr) {
        independentVariables = [matchCorr[1].trim()];
        dependentVariables = [matchCorr[2].trim()];
        if (matchCorr[3]) population = matchCorr[3].trim();
      }
    } else if (t.includes('تنبؤ') || t.includes('التنبؤية') || t.includes('إمكانية التنبؤ')) {
      suggestedMethodology = 'predictive';
      confidence = 0.88;
    } else if (t.includes('واقع') || t.includes('تقويم') || t.includes('معوقات') || t.includes('اتجاهات') || t.includes('مستوى')) {
      suggestedMethodology = 'descriptive';
      confidence = 0.8;
      // Heuristic for population
      const popMatch = t.match(/(?:لدى|عند|من وجهة نظر)\s+(.*)$/);
      if (popMatch) {
        population = popMatch[1].trim();
      }
    }
  } else {
    // English rules
    const lowerTitle = t.toLowerCase();
    if (lowerTitle.includes('effect of') || lowerTitle.includes('impact of') || lowerTitle.includes('effectiveness of')) {
      suggestedMethodology = 'quasi_experimental_pre_post';
      confidence = 0.88;
      
      const matchEff = t.match(/(?:Effect|Impact|Effectiveness)\s+of\s+(.*?)\s+on\s+(.*?)\s+among\s+(.*)/i) ||
                       t.match(/(?:Effect|Impact|Effectiveness)\s+of\s+(.*?)\s+on\s+(.*)/i);
      if (matchEff) {
        independentVariables = [matchEff[1].trim()];
        if (matchEff[3]) {
          dependentVariables = [matchEff[2].trim()];
          population = matchEff[3].trim();
        } else {
          let dvPart = matchEff[2].trim();
          const amongIdx = dvPart.toLowerCase().indexOf(' among');
          if (amongIdx !== -1) {
            population = dvPart.substring(amongIdx + 7).trim();
            dvPart = dvPart.substring(0, amongIdx).trim();
          }
          dependentVariables = [dvPart];
        }
      }
    } else if (lowerTitle.includes('relationship between') || lowerTitle.includes('correlation between')) {
      suggestedMethodology = 'correlational';
      confidence = 0.9;
      const matchCorr = t.match(/(?:Relationship|Correlation)\s+between\s+(.*?)\s+and\s+(.*?)\s+among\s+(.*)/i) ||
                        t.match(/(?:Relationship|Correlation)\s+between\s+(.*?)\s+and\s+(.*)/i);
      if (matchCorr) {
        independentVariables = [matchCorr[1].trim()];
        if (matchCorr[3]) {
          dependentVariables = [matchCorr[2].trim()];
          population = matchCorr[3].trim();
        } else {
          let dvPart = matchCorr[2].trim();
          const amongIdx = dvPart.toLowerCase().indexOf(' among');
          if (amongIdx !== -1) {
            population = dvPart.substring(amongIdx + 7).trim();
            dvPart = dvPart.substring(0, amongIdx).trim();
          }
          dependentVariables = [dvPart];
        }
      }
    } else if (lowerTitle.includes('predict') || lowerTitle.includes('prediction')) {
      suggestedMethodology = 'predictive';
      confidence = 0.85;
    }
  }

  // Handle defaults if matches fail
  if (independentVariables.length === 0) {
    independentVariables = [isArabic ? 'المتغير المستقل المقترح' : 'Proposed Independent Variable'];
  }
  if (dependentVariables.length === 0) {
    dependentVariables = [isArabic ? 'المتغير التابع المقترح' : 'Proposed Dependent Variable'];
  }
  if (!population) {
    population = isArabic ? 'عينة الدراسة (مثال: الطلاب)' : 'Study Population (e.g. Students)';
  }

  // General scientific rules warnings
  if (title.length < 15) {
    ambiguities.push(isArabic ? 'عنوان البحث قصير جداً وقد يفتقد الدقة.' : 'The title is very short and might lack specificity.');
  }
  if (isArabic && !title.includes('في') && !title.includes('على') && !title.includes('لدى')) {
    ambiguities.push('يفتقر العنوان إلى روابط واضحة توضح العلاقة أو مجتمع الدراسة.');
  }

  // Generate follow-up questions
  if ((suggestedMethodology as string) === 'quasi_experimental_pre_post' || (suggestedMethodology as string) === 'experimental_rct') {
    followUpQuestions.push(isArabic ? 'هل توجد مجموعة ضابطة لمقارنتها بالمجموعة التجريبية؟' : 'Is there a control group to compare with the treatment group?');
    followUpQuestions.push(isArabic ? 'ما هي مدة تطبيق التدخل أو البرنامج المقترح؟' : 'What is the duration of the proposed intervention or program?');
  } else if ((suggestedMethodology as string) === 'correlational') {
    followUpQuestions.push(isArabic ? 'هل تتوقع علاقة خطية موجبة أم سالبة بين المتغيرات؟' : 'Do you expect a positive or negative linear relationship between the variables?');
  }

  return {
    independentVariables,
    dependentVariables,
    mediators: [],
    moderators: [],
    controls: [],
    population,
    context: isArabic ? 'البيئة التعليمية / الميدانية' : 'Educational / Field Context',
    suggestedMethodology,
    confidence,
    ambiguities,
    followUpQuestions,
    isFallback: true
  };
}

/**
 * Checks project alignment and logs consistency errors, warnings, and score
 */
export function checkConsistency(project: ResearchProject): AuditResult {
  const issues: AuditIssue[] = [];
  let score = 100;

  // Rule 1: Title & Variables alignment
  const title = (project.titleAr + ' ' + project.titleEn).toLowerCase();
  
  project.variables.forEach(v => {
    const vNameAr = v.nameAr.toLowerCase();
    const vNameEn = v.nameEn.toLowerCase();
    
    // Check if variables are mentioned in title/description (if not, add warning)
    const inTitle = title.includes(vNameAr) || title.includes(vNameEn);
    if (!inTitle && v.type !== 'control') {
      issues.push({
        id: `var_not_in_title_${v.id}`,
        type: 'warning',
        textAr: `المتغير "${v.nameAr}" لم يذكر في عنوان البحث.`,
        textEn: `Variable "${v.nameEn}" is not mentioned in the research title.`,
        section: 'variables'
      });
      score -= 5;
    }
  });

  // Rule 2: Causal verbs check in non-experimental design
  const causalKeywords = ['أثر', 'فاعلية', 'تأثير', 'effect', 'impact', 'effectiveness'];
  const hasCausalWord = causalKeywords.some(w => title.includes(w));
  const isExperimental = project.studyDesign === 'experimental_rct' || project.studyDesign === 'quasi_experimental_pre_post' || project.studyDesign === 'single_group_pre_post';
  
  if (hasCausalWord && !isExperimental) {
    issues.push({
      id: 'causal_in_non_exp',
      type: 'critical',
      textAr: 'العنوان يوحي بعلاقة سببية (أثر/فاعلية) بينما المنهج المختار غير تجريبي.',
      textEn: 'Title implies a causal relationship (effect/impact) but the chosen methodology is non-experimental.',
      section: 'methodology'
    });
    score -= 20;
  }

  // Rule 3: Questions matching variables
  project.questions.forEach(q => {
    if (q.associatedVariables.length === 0) {
      issues.push({
        id: `question_no_vars_${q.id}`,
        type: 'critical',
        textAr: `سؤال البحث "${q.textAr.substring(0, 30)}..." لا يرتبط بأي متغير.`,
        textEn: `Research question starting with "${q.textEn.substring(0, 30)}..." is not mapped to any variables.`,
        section: 'questions'
      });
      score -= 10;
    }
  });

  // Rule 4: Hypotheses vs Questions
  if (project.questions.length > 0 && project.hypotheses.length === 0 && isExperimental) {
    issues.push({
      id: 'no_hypotheses_experimental',
      type: 'warning',
      textAr: 'الدراسة تجريبية ولكن لم يتم صياغة أي فروض إحصائية.',
      textEn: 'The study is experimental but no statistical hypotheses have been formulated.',
      section: 'hypotheses'
    });
    score -= 10;
  }

  // Rule 5: Hypotheses matching variables
  project.hypotheses.forEach(h => {
    const ivExists = project.variables.some(v => v.id === h.independentVarId);
    const dvExists = project.variables.some(v => v.id === h.dependentVarId);
    if (!ivExists || !dvExists) {
      issues.push({
        id: `hypothesis_missing_vars_${h.id}`,
        type: 'critical',
        textAr: `الفرض "${h.textAr.substring(0, 30)}..." يرتبط بمتغيرات غير موجودة بقائمة متغيرات الدراسة.`,
        textEn: `Hypothesis starting with "${h.textEn.substring(0, 30)}..." references variables not in the project variables list.`,
        section: 'hypotheses'
      });
      score -= 15;
      return;
    }

    const independentVariable = project.variables.find(v => v.id === h.independentVarId);
    const dependentVariable = project.variables.find(v => v.id === h.dependentVarId);
    if (independentVariable?.type !== 'independent' || dependentVariable?.type !== 'dependent') {
      issues.push({
        id: `hypothesis_incorrect_variable_roles_${h.id}`,
        type: 'critical',
        textAr: `الفرض "${h.textAr.substring(0, 30)}..." لا يربط المتغير المستقل والتابع بأنواعهما الصحيحة.`,
        textEn: `Hypothesis starting with "${h.textEn.substring(0, 30)}..." does not link variables with the correct independent/dependent roles.`,
        section: 'hypotheses'
      });
      score -= 15;
    }
  });

  // Rule 6: Group count vs Design
  if (project.studyDesign === 'experimental_rct' || project.studyDesign === 'quasi_experimental_pre_post') {
    if (project.sampleSettings.groupsCount < 2) {
      issues.push({
        id: 'experimental_insufficient_groups',
        type: 'critical',
        textAr: 'التصميم التجريبي يتطلب وجود مجموعتين على الأقل (تجريبية وضابطة).',
        textEn: 'Experimental/Quasi-experimental designs require at least 2 groups (Treatment & Control).',
        section: 'sample'
      });
      score -= 15;
    }
  }

  // Rule 7: Measurement plans for dependent variables
  project.variables.filter(variable => variable.type === 'dependent').forEach(variable => {
    const instrument = project.measurementInstruments?.find(item => item.variableId === variable.id);
    if (!instrument || !instrument.name.trim() || !instrument.scoringPlan.trim() || !instrument.validityPlan.trim()) {
      issues.push({
        id: `measurement_plan_missing_${variable.id}`,
        type: 'warning',
        textAr: `لا توجد خطة أداة قياس مكتملة للمتغير التابع "${variable.nameAr}".`,
        textEn: `No complete measurement-instrument plan exists for the dependent variable "${variable.nameEn}".`,
        section: 'measurement'
      });
      score -= 5;
      return;
    }

    if (instrument.reliabilityValue !== undefined && (!Number.isFinite(instrument.reliabilityValue) || instrument.reliabilityValue < 0 || instrument.reliabilityValue > 1)) {
      issues.push({
        id: `measurement_reliability_invalid_${variable.id}`,
        type: 'critical',
        textAr: `قيمة الثبات المسجلة لأداة "${variable.nameAr}" يجب أن تكون بين 0 و1.`,
        textEn: `The recorded reliability value for "${variable.nameEn}" must be between 0 and 1.`,
        section: 'measurement'
      });
      score -= 15;
    }
  });

  // Rule 8: Statistical analysis plans for hypotheses
  project.hypotheses.forEach(hypothesis => {
    const plan = project.hypothesisAnalysisPlans?.find(item => item.hypothesisId === hypothesis.id);
    if (!plan || !plan.assumptionsPlan.trim()) {
      issues.push({
        id: `analysis_plan_missing_${hypothesis.id}`,
        type: 'warning',
        textAr: `لا توجد خطة تحليل مكتملة للفرض "${hypothesis.textAr.substring(0, 40)}...".`,
        textEn: `No complete analysis plan exists for hypothesis "${hypothesis.textEn.substring(0, 40)}...".`,
        section: 'analysis'
      });
      score -= 5;
    }
  });

  // Rule 9: Ethics, privacy, and participant-risk planning
  const ethicsPlan = project.ethicsFeasibilityPlan;
  if (!ethicsPlan || !ethicsPlan.consentPlan.trim() || !ethicsPlan.privacyPlan.trim() || !ethicsPlan.riskMitigationPlan.trim()) {
    issues.push({
      id: 'ethics_plan_missing',
      type: 'warning',
      textAr: 'خطة الأخلاقيات والموافقة والخصوصية وتخفيف المخاطر غير مكتملة.',
      textEn: 'The ethics, consent, privacy, and risk-mitigation plan is incomplete.',
      section: 'ethics'
    });
    score -= 5;
  }

  // Rule 10: Suggest a control variable to strengthen internal validity (improvement, non-penalizing)
  if (isExperimental && !project.variables.some(v => v.type === 'control')) {
    issues.push({
      id: 'no_control_variable_suggestion',
      type: 'improvement',
      textAr: 'يُقترح إضافة متغير ضابط (Control) لتعزيز الصحة الداخلية للتصميم التجريبي.',
      textEn: 'Consider adding a control variable to strengthen the internal validity of the experimental design.',
      section: 'variables'
    });
  }

  // Ensure score is at least 0 and max 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues
  };
}
