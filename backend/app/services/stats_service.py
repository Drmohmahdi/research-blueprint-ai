import math
import numpy as np
import scipy.stats as stats
from statsmodels.stats.power import TTestIndPower, TTestPower, FTestAnovaPower
from typing import List, Dict, Any
from ..schemas import SimulationParamsSchema

def normal_cdf(x: float) -> float:
    return float(stats.norm.cdf(x))

def normal_inverse(p: float) -> float:
    return float(stats.norm.ppf(p))

def calculate_power_sample_size(
    test_type: str,
    alpha: float,
    power: float,
    effect_size: float,
    groups_count: int = 2
) -> int:
    try:
        if test_type == "t_test_independent":
            analysis = TTestIndPower()
            n_per_group = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, ratio=1.0, alternative='two-sided')
            return int(math.ceil(n_per_group) * 2)
        elif test_type == "t_test_paired":
            analysis = TTestPower()
            n = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, alternative='two-sided')
            return int(math.ceil(n))
        elif test_type == "anova_one_way":
            analysis = FTestAnovaPower()
            n = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, k_groups=groups_count)
            return int(math.ceil(n))
        elif test_type == "correlation":
            z_alpha = stats.norm.ppf(1.0 - alpha / 2.0)
            z_beta = stats.norm.ppf(power)
            fishers_z = 0.5 * math.log((1.0 + effect_size) / (1.0 - effect_size))
            n_corr = ((z_alpha + z_beta) / fishers_z) ** 2 + 3
            return int(math.ceil(n_corr))
        else:
            z_alpha = stats.norm.ppf(1.0 - alpha / 2.0)
            z_beta = stats.norm.ppf(power)
            factor = (z_alpha + z_beta) ** 2
            return int(math.ceil(factor / (effect_size ** 2)))
    except Exception:
        z_alpha = stats.norm.ppf(1.0 - alpha / 2.0)
        z_beta = stats.norm.ppf(power)
        factor = (z_alpha + z_beta) ** 2
        if test_type == "t_test_independent":
            return int(math.ceil(2.0 * factor / (effect_size ** 2)) * 2)
        else:
            return int(math.ceil(factor / (effect_size ** 2)))

def run_independent_t_test(group_a: List[float], group_b: List[float]) -> Dict[str, float]:
    n_a, n_b = len(group_a), len(group_b)
    if n_a <= 1 or n_b <= 1:
        return {"tStatistic": 0.0, "pValue": 1.0, "cohensD": 0.0}

    mean_a = sum(group_a) / n_a
    mean_b = sum(group_b) / n_b

    var_a = sum((x - mean_a) ** 2 for x in group_a) / (n_a - 1)
    var_b = sum((x - mean_b) ** 2 for x in group_b) / (n_b - 1)

    pooled_var = ((n_a - 1) * var_a + (n_b - 1) * var_b) / (n_a + n_b - 2)
    pooled_sd = math.sqrt(pooled_var)

    res = stats.ttest_ind(group_a, group_b, equal_var=True)
    t = float(res.statistic)
    p = float(res.pvalue)
    d = (mean_a - mean_b) / pooled_sd if pooled_sd != 0 else 0.0

    return {
        "tStatistic": round(t, 4),
        "pValue": round(p, 4),
        "cohensD": round(d, 4)
    }

class SeededRandom:
    def __init__(self, seed: int):
        self.seed = seed

    def next_val(self) -> float:
        # LCG parameters
        self.seed = (self.seed * 1664525 + 1013904223) % 4294967296
        return self.seed / 4294967296

    def box_muller(self, mean: float = 0.0, std: float = 1.0) -> float:
        u1 = 1.0 - self.next_val()
        u2 = self.next_val()
        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return z * std + mean

def run_python_monte_carlo(
    sample_size: int,
    params: SimulationParamsSchema
) -> Dict[str, Any]:
    rng = SeededRandom(params.seed)
    size_per_group = math.ceil(sample_size / 2)
    
    successful_runs = 0
    total_runs = params.iterations
    final_dataset = []

    clip = lambda x: max(0.0, min(params.maxScore, x))

    for run in range(total_runs):
        current_dataset = []
        
        # Treatment
        for i in range(size_per_group):
            student_id = f"TR-{i+1}"
            pre_score = clip(rng.box_muller(params.preTestMean, params.preTestSd))
            engagement = params.interventionEngagement * (0.7 + rng.next_val() * 0.4)
            retained = rng.next_val() > params.attritionRate

            post_score = pre_score
            if retained:
                if params.gainType == "fixed":
                    gain = params.expectedGain * (0.8 + engagement * 0.4)
                    post_score = clip(pre_score + gain + rng.box_muller(0, params.errorSd))
                elif params.gainType == "relative":
                    rate = params.expectedGain * (0.7 + engagement * 0.5)
                    post_score = clip(pre_score + rate * (params.maxScore - pre_score) + rng.box_muller(0, params.errorSd))
                else: # regression
                    beta_pre = params.betaPre or 0.8
                    beta_treatment = params.betaTreatment or 10.0
                    beta_engagement = params.betaEngagement or 5.0
                    intercept = params.preTestMean * (1.0 - beta_pre) - 2.0
                    post_score = clip(intercept + beta_pre * pre_score + beta_treatment * 1.0 + beta_engagement * engagement + rng.box_muller(0, params.errorSd))

            current_dataset.append({
                "studentId": student_id,
                "group": "treatment",
                "preScore": round(pre_score, 1),
                "postScore": round(post_score, 1) if retained else 0.0,
                "engagement": round(min(1.0, engagement), 2),
                "retained": retained
            })

        # Control
        for i in range(size_per_group):
            student_id = f"CON-{i+1}"
            pre_score = clip(rng.box_muller(params.preTestMean, params.preTestSd))
            engagement = 0.2 * (0.5 + rng.next_val() * 0.5)
            retained = rng.next_val() > (params.attritionRate * 0.8)

            post_score = pre_score
            if retained:
                maturation = 0.05 * (params.maxScore - pre_score) if params.gainType == "relative" else params.expectedGain * 0.15
                post_score = clip(pre_score + maturation + rng.box_muller(0, params.errorSd * 1.1))

            current_dataset.append({
                "studentId": student_id,
                "group": "control",
                "preScore": round(pre_score, 1),
                "postScore": round(post_score, 1) if retained else 0.0,
                "engagement": round(engagement, 2),
                "retained": retained
            })

        # Evaluate significance
        active_tr = [row["postScore"] for row in current_dataset if row["group"] == "treatment" and row["retained"]]
        active_con = [row["postScore"] for row in current_dataset if row["group"] == "control" and row["retained"]]

        t_res = run_independent_t_test(active_tr, active_con)
        if t_res["pValue"] < 0.05 and t_res["cohensD"] > 0:
            successful_runs += 1

        if run == 0:
            final_dataset = current_dataset

    # Retained counts
    retained_tr = [row for row in final_dataset if row["group"] == "treatment" and row["retained"]]
    retained_con = [row for row in final_dataset if row["group"] == "control" and row["retained"]]

    pre_mean_tr = sum(row["preScore"] for row in retained_tr) / (len(retained_tr) or 1)
    pre_mean_con = sum(row["preScore"] for row in retained_con) / (len(retained_con) or 1)

    post_mean_tr = sum(row["postScore"] for row in retained_tr) / (len(retained_tr) or 1)
    post_mean_con = sum(row["postScore"] for row in retained_con) / (len(retained_con) or 1)

    t_res_final = run_independent_t_test(
        [row["postScore"] for row in retained_tr],
        [row["postScore"] for row in retained_con]
    )

    attrition_count = len([row for row in final_dataset if not row["retained"]])
    power_val = successful_runs / total_runs

    return {
        "observedActualData": final_dataset,
        "summary": {
            "treatmentSize": size_per_group,
            "controlSize": size_per_group,
            "preMeanTreatment": round(pre_mean_tr, 2),
            "preMeanControl": round(pre_mean_con, 2),
            "postMeanTreatment": round(post_mean_tr, 2),
            "postMeanControl": round(post_mean_con, 2),
            "meanGainTreatment": round(post_mean_tr - pre_mean_tr, 2),
            "meanGainControl": round(post_mean_con - pre_mean_con, 2),
            "cohensD": t_res_final["cohensD"],
            "pValue": t_res_final["pValue"],
            "statisticalPower": round(power_val, 3),
            "attritionCount": attrition_count,
            "successProbability": round(power_val, 2)
        }
    }


def inspect_uploaded_csv(csv_text: str, is_arabic: bool = True) -> Dict[str, Any]:
    import io
    import pandas as pd
    
    issues = []
    score = 100

    try:
        df = pd.read_csv(io.StringIO(csv_text))
    except Exception as e:
        return {
            "qualityScore": 0,
            "issues": [f"فشل قراءة الملف كـ CSV: {e}" if is_arabic else f"Failed to parse CSV file: {e}"]
        }

    # Verify column structures
    numeric_cols = df.select_dtypes(include=[np.number]).columns if 'np' in globals() else df.select_dtypes(include=['number']).columns
    
    # Check for missing values
    for col in df.columns:
        na_count = df[col].isna().sum()
        if na_count > 0:
            issues.append(
                f"تم العثور على {na_count} قيمة مفقودة في العمود '{col}'."
                if is_arabic else
                f"Found {na_count} missing values in column '{col}'."
            )
            score -= int(na_count * 10)

    # Check for outliers (Z-Score > 3)
    for col in numeric_cols:
        col_std = df[col].std()
        if col_std > 0:
            z_scores = (df[col] - df[col].mean()) / col_std
            outliers = df[abs(z_scores) > 3]
            if len(outliers) > 0:
                outlier_indices = outliers.index.tolist()
                issues.append(
                    f"تم اكتشاف قيم شاذة (Outliers) في العمود '{col}' في الأسطر: {outlier_indices}."
                    if is_arabic else
                    f"Detected outliers in column '{col}' at indices: {outlier_indices}."
                )
                score -= int(len(outliers) * 15)

    # Normality Check (Shapiro-Wilk)
    for col in numeric_cols:
        non_null_data = df[col].dropna()
        if len(non_null_data) >= 3:
            try:
                stat, p_val = stats.shapiro(non_null_data)
                if p_val < 0.05:
                    issues.append(
                        f"توزيع قيم العمود '{col}' غير اعتدالي (Shapiro-Wilk p = {p_val:.4f})."
                        if is_arabic else
                        f"Distribution of column '{col}' is non-normal (Shapiro-Wilk p = {p_val:.4f})."
                    )
                    score -= 10
            except Exception:
                pass

    if score == 100:
        issues.append(
            "تم فحص جودة البيانات بنجاح، ولم يتم رصد أي مشكلات في القيم المفقودة أو الشاذة."
            if is_arabic else
            "Data quality audit completed successfully, no missing values or outliers detected."
        )

    return {
        "qualityScore": max(0, min(100, score)),
        "issues": issues
    }
