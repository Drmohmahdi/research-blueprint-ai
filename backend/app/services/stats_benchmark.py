import math
import numpy as np
import scipy.stats as stats
from statsmodels.stats.power import TTestIndPower, TTestPower
from .stats_service import normal_cdf, normal_inverse, run_independent_t_test, calculate_power_sample_size

def run_benchmarks():
    report = []
    report.append("=== STATISTICAL EQUATIONS BENCHMARK REPORT ===\n")

    # 1. Normal CDF Comparison
    test_points = [-2.5, -1.0, 0.0, 1.0, 2.5]
    report.append("1. Normal CDF Verification:")
    for x in test_points:
        custom_val = normal_cdf(x)
        scipy_val = stats.norm.cdf(x)
        diff = abs(custom_val - scipy_val)
        report.append(f"  x={x:4.1f} | Custom: {custom_val:.7f} | SciPy: {scipy_val:.7f} | Diff: {diff:.2e} | {'OK' if diff < 1e-5 else 'FAIL'}")
    report.append("")

    # 2. Normal Inverse (PPF) Comparison
    probabilities = [0.01, 0.05, 0.5, 0.95, 0.99]
    report.append("2. Normal Inverse (PPF) Verification:")
    for p in probabilities:
        custom_val = normal_inverse(p)
        scipy_val = stats.norm.ppf(p)
        diff = abs(custom_val - scipy_val)
        report.append(f"  p={p:4.2f} | Custom: {custom_val:.7f} | SciPy: {scipy_val:.7f} | Diff: {diff:.2e} | {'OK' if diff < 1e-4 else 'FAIL'}")
    report.append("")

    # 3. Independent Samples T-Test Comparison
    # Seeded data for reproducibility
    np.random.seed(42)
    group_a = np.random.normal(55, 10, 30).tolist()
    group_b = np.random.normal(50, 10, 30).tolist()

    custom_t = run_independent_t_test(group_a, group_b)
    scipy_res = stats.ttest_ind(group_a, group_b, equal_var=True)
    
    # Calculate manual Cohen's d for verification
    mean_a, mean_b = np.mean(group_a), np.mean(group_b)
    var_a, var_b = np.var(group_a, ddof=1), np.var(group_b, ddof=1)
    pooled_sd = math.sqrt(((len(group_a) - 1) * var_a + (len(group_b) - 1) * var_b) / (len(group_a) + len(group_b) - 2))
    expected_d = (mean_a - mean_b) / pooled_sd

    t_diff = abs(custom_t["tStatistic"] - scipy_res.statistic)
    p_diff = abs(custom_t["pValue"] - scipy_res.pvalue)
    d_diff = abs(custom_t["cohensD"] - expected_d)

    report.append("3. Independent Samples T-Test:")
    report.append(f"  t-stat  | Custom: {custom_t['tStatistic']:.4f} | SciPy: {scipy_res.statistic:.4f} | Diff: {t_diff:.2e} | {'OK' if t_diff < 1e-3 else 'FAIL'}")
    report.append(f"  p-value | Custom: {custom_t['pValue']:.4f} | SciPy: {scipy_res.pvalue:.4f} | Diff: {p_diff:.2e} | {'OK' if p_diff < 1e-3 else 'FAIL'}")
    report.append(f"  Cohen's d| Custom: {custom_t['cohensD']:.4f} | Expected: {expected_d:.4f} | Diff: {d_diff:.2e} | {'OK' if d_diff < 1e-3 else 'FAIL'}")
    report.append("")

    # 4. Sample Size Power Verification
    # Target: independent t-test sample size calculation
    alpha = 0.05
    power = 0.80
    effect_size = 0.5
    
    custom_n = calculate_power_sample_size("t_test_independent", alpha, power, effect_size)
    
    # Using statsmodels solve_power for independent t-test (two-sample)
    # statsmodels power analysis: ratio=1.0, alternative='two-sided'
    analysis = TTestIndPower()
    statsmodels_n_per_group = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, ratio=1.0, alternative='two-sided')
    statsmodels_total_n = math.ceil(statsmodels_n_per_group) * 2

    n_diff = abs(custom_n - statsmodels_total_n)
    report.append("4. Power Sample Size Verification (t-test independent):")
    report.append(f"  Recommended N | Custom: {custom_n} | Statsmodels: {statsmodels_total_n} | Diff: {n_diff} | {'OK' if n_diff <= 2 else 'FAIL'}")
    report.append("")

    return "\n".join(report)

if __name__ == "__main__":
    print(run_benchmarks())
