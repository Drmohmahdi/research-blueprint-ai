import type { ResearchProject } from '../types/research';

export interface GeneratedSyntax {
  spss: string;
  r: string;
  python: string;
}

export function generateStatisticalSyntax(project: ResearchProject): GeneratedSyntax {
  // Extract variables
  const iv = project.variables.find(v => v.type === 'independent');
  const dvs = project.variables.filter(v => v.type === 'dependent');
  const control = project.variables.find(v => v.type === 'control');

  const ivName = iv ? iv.nameEn.replace(/\s+/g, '_') : 'Independent_Variable';
  const dvName = dvs.length > 0 ? dvs[0].nameEn.replace(/\s+/g, '_') : 'Dependent_Variable';
  const controlName = control ? control.nameEn.replace(/\s+/g, '_') : 'Control_Variable';

  // 1. SPSS Syntax
  let spss = `* SPSS Syntax for Research Blueprint: ${project.titleEn.substring(0, 50)}...\n\n`;
  if (project.studyDesign.includes('quasi') || project.studyDesign === 'experimental_rct') {
    spss += `* Independent Samples T-Test.\n`;
    spss += `T-TEST GROUPS=${ivName}(1 2)\n  /VARIABLES=${dvName}\n  /CRITERIA=CI(.95).\n\n`;
    
    if (control) {
      spss += `* Analysis of Covariance (ANCOVA) with prior adjustment.\n`;
      spss += `UNIANOVA ${dvName} BY ${ivName} WITH ${controlName}\n  /METHOD=SSTYPE(3)\n  /INTERCEPT=INCLUDE\n  /EMMEANS=TABLES(${ivName}) WITH(${controlName}=MEAN) COMPARE ADJ(BONFERRONI)\n  /DESIGN=${controlName} ${ivName}.\n`;
    } else {
      spss += `* One-Way ANOVA.\n`;
      spss += `ONEWAY ${dvName} BY ${ivName}\n  /STATISTICS DESCRIPTIVES EFFECTS HOMOGENEITY\n  /MISSING ANALYSIS.\n`;
    }
  } else if (project.studyDesign === 'correlational') {
    spss += `* Pearson Correlation.\n`;
    spss += `CORRELATIONS\n  /VARIABLES=${ivName} ${dvName}\n  /PRINT=TWOTAIL NOSIG\n  /MISSING=PAIRWISE.\n`;
  } else {
    spss += `* Descriptive Statistics.\n`;
    spss += `DESCRIPTIVES VARIABLES=${dvName}\n  /STATISTICS=MEAN STDDEV MIN MAX.\n`;
  }

  // 2. R Script
  let r = `# R Script for Research Blueprint: ${project.titleEn.substring(0, 50)}...\n`;
  r += `# Load required libraries\nlibrary(car)\nlibrary(emmeans)\n\n`;
  
  if (project.studyDesign.includes('quasi') || project.studyDesign === 'experimental_rct') {
    r += `# Independent Samples T-Test\nt.test(${dvName} ~ ${ivName}, data = study_data, var.equal = TRUE)\n\n`;
    
    if (control) {
      r += `# Analysis of Covariance (ANCOVA)\n`;
      r += `ancova_model <- lm(${dvName} ~ ${ivName} + ${controlName}, data = study_data)\n`;
      r += `Anova(ancova_model, type = "III")\n\n`;
      r += `# Estimated Marginal Means (Adjusted Means)\n`;
      r += `emmeans(ancova_model, specs = pairwise ~ ${ivName})\n`;
    } else {
      r += `# One-Way ANOVA\n`;
      r += `anova_model <- aov(${dvName} ~ ${ivName}, data = study_data)\n`;
      r += `summary(anova_model)\n`;
    }
  } else if (project.studyDesign === 'correlational') {
    r += `# Correlation Analysis\n`;
    r += `cor.test(study_data$${ivName}, study_data$${dvName}, method = "pearson")\n`;
  } else {
    r += `# Descriptive Analysis\n`;
    r += `summary(study_data$${dvName})\n`;
  }

  // 3. Python Script
  let python = `# Python Script for Research Blueprint: ${project.titleEn.substring(0, 50)}...\n`;
  python += `import pandas as pd\nimport numpy as np\nimport scipy.stats as stats\nimport statsmodels.api as sm\nfrom statsmodels.formula.api import ols\n\n# load your data\n# df = pd.read_csv("study_data.csv")\n\n`;

  if (project.studyDesign.includes('quasi') || project.studyDesign === 'experimental_rct') {
    python += `# Independent Samples T-Test\n`;
    python += `group1 = df[df['${ivName}'] == 1]['${dvName}']\n`;
    python += `group2 = df[df['${ivName}'] == 2]['${dvName}']\n`;
    python += `t_stat, p_val = stats.ttest_ind(group1, group2, equal_var=True)\n`;
    python += `print(f"T-test: t={{t_stat:.4f}}, p={{p_val:.4f}}")\n\n`;

    if (control) {
      python += `# ANCOVA (using statsmodels)\n`;
      python += `model = ols('${dvName} ~ C(${ivName}) + ${controlName}', data=df).fit()\n`;
      python += `anova_table = sm.stats.anova_lm(model, typ=3)\n`;
      python += `print(anova_table)\n`;
    } else {
      python += `# One-Way ANOVA\n`;
      python += `model = ols('${dvName} ~ C(${ivName})', data=df).fit()\n`;
      python += `anova_table = sm.stats.anova_lm(model, typ=1)\n`;
      python += `print(anova_table)\n`;
    }
  } else if (project.studyDesign === 'correlational') {
    python += `# Pearson Correlation\n`;
    python += `r_coeff, p_val = stats.pearsonr(df['${ivName}'], df['${dvName}'])\n`;
    python += `print(f"Correlation: r={{r_coeff:.4f}}, p={{p_val:.4f}}")\n`;
  } else {
    python += `# Descriptives\n`;
    python += `print(df['${dvName}'].describe())\n`;
  }

  return { spss, r, python };
}
