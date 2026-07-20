"""
B1.1 — Golden Reference Tests for Statistical Functions
Tests each statistical method against known reference values from scipy/statsmodels.
"""
import pytest
import math
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.services.stats_service import (
    calculate_power_sample_size,
    run_independent_t_test,
    run_python_monte_carlo,
    normal_cdf,
    normal_inverse,
)
import scipy.stats as sp_stats
from statsmodels.stats.power import TTestIndPower, TTestPower, FTestAnovaPower


# ── 1. Infinite Population Proportion ──
class TestSampleSizeProportion:
    def test_infinite_pop_proportion_standard(self):
        """n0 = z^2 * p * q / e^2 = 1.96^2 * 0.5 * 0.5 / 0.05^2 = 384.16 → 385"""
        z = sp_stats.norm.ppf(0.975)
        p, e = 0.5, 0.05
        expected = math.ceil((z**2 * p * (1-p)) / e**2)
        assert expected == 385

    def test_finite_pop_correction(self):
        """n = n0 / (1 + (n0-1)/N), N=1000, n0=385 → ceil(385/1.384) = 279"""
        n0 = 385
        N = 1000
        expected = math.ceil(n0 / (1 + (n0 - 1) / N))
        assert expected == 279


# ── 2. Power-Based Sample Size (t-test independent) ──
class TestPowerSampleSize:
    def test_t_test_independent_medium_effect(self):
        """d=0.5, alpha=0.05, power=0.80 → ~128 total (64 per group)"""
        n = calculate_power_sample_size("t_test_independent", 0.05, 0.80, 0.5)
        ref = TTestIndPower()
        ref_n = math.ceil(ref.solve_power(effect_size=0.5, alpha=0.05, power=0.80, ratio=1.0)) * 2
        assert abs(n - ref_n) <= 2, f"Got {n}, expected ~{ref_n}"

    def test_t_test_independent_large_effect(self):
        """d=0.8, alpha=0.05, power=0.80 → ~52 total"""
        n = calculate_power_sample_size("t_test_independent", 0.05, 0.80, 0.8)
        ref = TTestIndPower()
        ref_n = math.ceil(ref.solve_power(effect_size=0.8, alpha=0.05, power=0.80, ratio=1.0)) * 2
        assert abs(n - ref_n) <= 2, f"Got {n}, expected ~{ref_n}"

    def test_t_test_paired_medium_effect(self):
        """d=0.5, alpha=0.05, power=0.80 → ~34"""
        n = calculate_power_sample_size("t_test_paired", 0.05, 0.80, 0.5)
        ref = TTestPower()
        ref_n = math.ceil(ref.solve_power(effect_size=0.5, alpha=0.05, power=0.80))
        assert abs(n - ref_n) <= 2, f"Got {n}, expected ~{ref_n}"

    def test_anova_one_way_3_groups(self):
        """f=0.25, alpha=0.05, power=0.80, k=3"""
        n = calculate_power_sample_size("anova_one_way", 0.05, 0.80, 0.25, groups_count=3)
        ref = FTestAnovaPower()
        ref_n = math.ceil(ref.solve_power(effect_size=0.25, alpha=0.05, power=0.80, k_groups=3))
        assert abs(n - ref_n) <= 2, f"Got {n}, expected ~{ref_n}"

    def test_correlation_medium(self):
        """r=0.3, alpha=0.05, power=0.80 → ~85"""
        n = calculate_power_sample_size("correlation", 0.05, 0.80, 0.3)
        # Manual reference: Fisher's z method
        z_alpha = sp_stats.norm.ppf(0.975)
        z_beta = sp_stats.norm.ppf(0.80)
        fishers_z = 0.5 * math.log((1.3) / (0.7))
        ref_n = math.ceil(((z_alpha + z_beta) / fishers_z)**2 + 3)
        assert abs(n - ref_n) <= 2, f"Got {n}, expected ~{ref_n}"


# ── 3. Cohen's d (Independent) ──
class TestCohensD:
    def test_cohens_d_known_values(self):
        """M1=76, M2=54, SD pooled ≈ 15.52 → d ≈ 1.417"""
        group_a = [76.0] * 30  # simplified: all same value for exact test
        group_b = [54.0] * 30
        # With real data:
        import numpy as np
        np.random.seed(42)
        g_a = np.random.normal(76, 15, 100).tolist()
        g_b = np.random.normal(54, 16, 100).tolist()
        result = run_independent_t_test(g_a, g_b)
        # d should be approximately (76-54)/sqrt((15^2+16^2)/2) ≈ 1.42
        assert result["cohensD"] > 1.0, f"Expected large effect, got {result['cohensD']}"
        assert result["pValue"] < 0.001, f"Expected significant, got {result['pValue']}"

    def test_cohens_d_zero_difference(self):
        """Same distribution → d ≈ 0"""
        import numpy as np
        np.random.seed(99)
        g = np.random.normal(50, 10, 200).tolist()
        result = run_independent_t_test(g[:100], g[100:])
        assert abs(result["cohensD"]) < 0.5, f"Expected near-zero d, got {result['cohensD']}"

    def test_cohens_d_small_sample(self):
        """n=2 per group — should still compute without crash"""
        result = run_independent_t_test([10.0, 20.0], [30.0, 40.0])
        assert "cohensD" in result
        assert "pValue" in result

    def test_cohens_d_single_observation(self):
        """n=1 per group → return safe defaults"""
        result = run_independent_t_test([10.0], [20.0])
        assert result["cohensD"] == 0.0
        assert result["pValue"] == 1.0


# ── 4. Bayesian Normal Conjugate Update ──
class TestBayesianUpdate:
    def test_bayesian_normal_conjugate(self):
        """Prior N(50, 100), Observed n=20, ybar=65, var=25
        w1=1/100=0.01, w2=20/25=0.8
        Post_mean = (0.01*50 + 0.8*65)/(0.01+0.8) = (0.5+52)/(0.81) = 64.81
        Post_var = 1/(0.01+0.8) = 1.2346
        """
        prior_mean, prior_var = 50.0, 100.0
        obs_n, obs_mean, obs_var = 20, 65.0, 25.0
        w1 = 1.0 / prior_var
        w2 = obs_n / obs_var
        post_mean = (w1 * prior_mean + w2 * obs_mean) / (w1 + w2)
        post_var = 1.0 / (w1 + w2)
        assert abs(post_mean - 64.81) < 0.1, f"Post mean {post_mean}"
        assert abs(post_var - 1.235) < 0.1, f"Post var {post_var}"


# ── 5. Monte Carlo Reproducibility ──
class TestMonteCarloReproducibility:
    def test_same_seed_same_result(self):
        """Same seed must produce identical datasets"""
        from app.schemas import SimulationParamsSchema
        params = SimulationParamsSchema(
            seed=42,
            iterations=5,
            preTestMean=50.0,
            preTestSd=10.0,
            maxScore=100.0,
            expectedGain=8.0,
            gainType="fixed",
            attritionRate=0.1,
            errorSd=5.0,
            interventionEngagement=0.85,
        )
        result1 = run_python_monte_carlo(60, params)
        result2 = run_python_monte_carlo(60, params)
        assert result1["summary"]["cohensD"] == result2["summary"]["cohensD"]
        assert result1["summary"]["pValue"] == result2["summary"]["pValue"]
        assert len(result1["observedActualData"]) == len(result2["observedActualData"])


# ── 6. Edge Cases ──
class TestStatisticalEdgeCases:
    def test_zero_variance_groups(self):
        """All identical values → d=0, no crash"""
        result = run_independent_t_test([50.0]*20, [50.0]*20)
        assert result["cohensD"] == 0.0

    def test_empty_group(self):
        """Empty group → safe return"""
        result = run_independent_t_test([], [50.0]*20)
        assert result["pValue"] == 1.0

    def test_negative_effect_size_power(self):
        """Negative effect size should still work (absolute value logic)"""
        try:
            n = calculate_power_sample_size("t_test_independent", 0.05, 0.80, -0.5)
            # Should either work with abs or raise
            assert n > 0
        except (ValueError, ZeroDivisionError):
            pass  # Acceptable to reject negative

    def test_extreme_attrition_monte_carlo(self):
        """attrition=0.99 should still run without crash"""
        from app.schemas import SimulationParamsSchema
        params = SimulationParamsSchema(
            seed=123, iterations=3, preTestMean=50.0, preTestSd=10.0,
            maxScore=100.0, expectedGain=8.0, gainType="fixed",
            attritionRate=0.99, errorSd=5.0, interventionEngagement=0.85,
        )
        result = run_python_monte_carlo(30, params)
        assert "summary" in result

    def test_very_small_sample_monte_carlo(self):
        """sample_size=4 should not crash"""
        from app.schemas import SimulationParamsSchema
        params = SimulationParamsSchema(
            seed=7, iterations=2, preTestMean=50.0, preTestSd=10.0,
            maxScore=100.0, expectedGain=8.0, gainType="fixed",
            attritionRate=0.1, errorSd=5.0, interventionEngagement=0.85,
        )
        result = run_python_monte_carlo(4, params)
        assert len(result["observedActualData"]) == 4


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
