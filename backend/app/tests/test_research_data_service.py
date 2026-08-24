import math
import pandas as pd
import pytest
import io
import zipfile
from scipy import stats

from app.services.research_data import decide_test, fingerprint, quality_scan, run_analysis, safe_csv_value, load_tabular

def test_decision_engine_is_deterministic():
    assert decide_test("comparison", "ratio", 2, False, True)["test"] == "INDEPENDENT_T_TEST"
    assert decide_test("comparison", "ordinal", 2, False, False)["test"] == "MANN_WHITNEY"
    assert decide_test("association", "nominal", 2, False, True)["test"] == "CHI_SQUARE"

def test_quality_scan_golden_counts():
    frame = pd.DataFrame({"group":["a","a","b","b"], "score":[1,1,None,100]})
    summary, issues = quality_scan(frame)
    assert summary["missing_values"] == 1
    assert summary["duplicates"] == 1
    assert any(i["issue_type"] == "MISSING_VALUES" for i in issues)

def test_independent_t_test_matches_scipy_and_includes_effect_ci():
    records = [{"group":"control","score":x} for x in [10,11,9,12,8]] + [{"group":"treatment","score":x} for x in [14,15,13,16,12]]
    result = run_analysis(records,"INDEPENDENT_T_TEST",{"outcome":"score","group":"group","alpha":.05})
    reference = stats.ttest_ind([10,11,9,12,8],[14,15,13,16,12],equal_var=False)
    assert result["p_value"] == pytest.approx(reference.pvalue, abs=1e-12)
    assert math.isfinite(result["effect_size"]["value"])
    assert result["confidence_interval"][0] < result["mean_difference"] < result["confidence_interval"][1]

def test_invalid_t_test_is_blocked():
    with pytest.raises(ValueError, match="exactly two groups"):
        run_analysis([{"group":"a","score":1},{"group":"a","score":2}],"INDEPENDENT_T_TEST",{"outcome":"score","group":"group"})

def test_fingerprint_is_stable_and_changes_with_data():
    assert fingerprint([{"x":1}]) == fingerprint([{"x":1}])
    assert fingerprint([{"x":1}]) != fingerprint([{"x":2}])

def test_chi_square_matches_reference():
    records = [{"a":a,"b":b} for a,b in [("x","yes"),("x","yes"),("x","no"),("y","no"),("y","no"),("y","yes")]]
    result = run_analysis(records,"CHI_SQUARE",{"x":"a","y":"b"})
    reference = stats.chi2_contingency([[1,2],[2,1]])
    assert result["statistic"] == pytest.approx(reference.statistic, abs=1e-12)
    assert 0 <= result["effect_size"]["value"] <= 1

@pytest.mark.parametrize("value", ["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK('x')"])
def test_csv_formula_injection_is_neutralized(value):
    assert safe_csv_value(value).startswith("'")

def test_normal_csv_text_is_unchanged():
    assert safe_csv_value("research result") == "research result"

def test_descriptive_statistics_golden_dataset():
    result=run_analysis([{"x":1},{"x":2},{"x":3},{"x":None}],"DESCRIPTIVES",{"variables":["x"]})["estimates"]["x"]
    assert result=={"n":3,"missing":1,"mean":2.0,"sd":pytest.approx(1.0),"variance":pytest.approx(1.0),"median":2.0,"min":1.0,"max":3.0}

def test_welch_t_df_cohens_d_and_ci_match_reference():
    a=[2,4,5,7,9];b=[1,2,2,3,4,8]
    records=[{"g":"a","y":x} for x in a]+[{"g":"b","y":x} for x in b]
    result=run_analysis(records,"INDEPENDENT_T_TEST",{"outcome":"y","group":"g","alpha":.05})
    av,bv=pd.Series(a),pd.Series(b);se=math.sqrt(av.var(ddof=1)/len(a)+bv.var(ddof=1)/len(b));df=(av.var(ddof=1)/len(a)+bv.var(ddof=1)/len(b))**2/((av.var(ddof=1)/len(a))**2/(len(a)-1)+(bv.var(ddof=1)/len(b))**2/(len(b)-1));diff=av.mean()-bv.mean();critical=stats.t.ppf(.975,df);pooled=math.sqrt(((len(a)-1)*av.var(ddof=1)+(len(b)-1)*bv.var(ddof=1))/(len(a)+len(b)-2))
    assert result["df"]==pytest.approx(df,rel=1e-12);assert result["mean_difference"]==pytest.approx(diff,abs=1e-12)
    assert result["confidence_interval"]==pytest.approx([diff-critical*se,diff+critical*se],rel=1e-12)
    assert result["effect_size"]["value"]==pytest.approx(diff/pooled,rel=1e-12)
    import json
    assert json.loads(json.dumps(result))["analysis"]=="INDEPENDENT_T_TEST"

def test_pearson_matches_reference_with_missing_pairs():
    records=[{"x":1,"y":2},{"x":2,"y":4},{"x":3,"y":5},{"x":4,"y":None},{"x":5,"y":9}]
    result=run_analysis(records,"PEARSON",{"x":"x","y":"y"});reference=stats.pearsonr([1,2,3,5],[2,4,5,9])
    assert result["n"]==4;assert result["statistic"]==pytest.approx(reference.statistic,rel=1e-12);assert result["p_value"]==pytest.approx(reference.pvalue,rel=1e-12)

def test_spearman_matches_reference_with_ties():
    x=[1,2,2,4,5,5];y=[6,5,5,2,2,1];records=[{"x":a,"y":b} for a,b in zip(x,y)]
    result=run_analysis(records,"SPEARMAN",{"x":"x","y":"y"});reference=stats.spearmanr(x,y)
    assert result["statistic"]==pytest.approx(reference.statistic,rel=1e-12);assert result["p_value"]==pytest.approx(reference.pvalue,rel=1e-12)

def test_chi_square_and_cramers_v_match_reference_for_3x2_table():
    table=[[10,20],[20,15],[12,18]];records=[]
    for row,label in zip(table,["a","b","c"]):
        records += [{"x":label,"y":"yes"}]*row[0]+[{"x":label,"y":"no"}]*row[1]
    # pandas crosstab orders the y categories as ["no", "yes"].
    reference_table=[[row[1],row[0]] for row in table]
    result=run_analysis(records,"CHI_SQUARE",{"x":"x","y":"y"});chi,p,df,expected=stats.chi2_contingency(reference_table);n=sum(map(sum,table))
    assert result["statistic"]==pytest.approx(chi,rel=1e-12);assert result["df"]==df;assert result["p_value"]==pytest.approx(p,rel=1e-12)
    assert [v for row in result["expected_frequencies"] for v in row]==pytest.approx(expected.flatten().tolist(),rel=1e-12);assert result["effect_size"]["value"]==pytest.approx(math.sqrt(chi/(n*(min(3,2)-1))),rel=1e-12)

@pytest.mark.parametrize("kind,records,config",[
    ("DESCRIPTIVES",[{"x":None}],{"variables":["x"]}),
    ("PEARSON",[{"x":1,"y":2},{"x":1,"y":3},{"x":1,"y":4}],{"x":"x","y":"y"}),
    ("SPEARMAN",[{"x":1,"y":2},{"x":2,"y":2}],{"x":"x","y":"y"}),
    ("INDEPENDENT_T_TEST",[{"g":"a","y":1},{"g":"a","y":1},{"g":"b","y":1},{"g":"b","y":1}],{"group":"g","outcome":"y"}),
])
def test_invalid_statistical_inputs_are_rejected_without_nan(kind,records,config):
    with pytest.raises(ValueError): run_analysis(records,kind,config)

def test_xlsx_import_runtime_and_limits():
    buffer=io.BytesIO();pd.DataFrame({"x":[1,2]}).to_excel(buffer,index=False)
    assert load_tabular(buffer.getvalue(),"study.xlsx")["x"].tolist()==[1,2]

def test_xlsx_unsafe_zip_path_is_rejected():
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,"w") as archive: archive.writestr("../escape.xml","x")
    with pytest.raises(ValueError,match="unsafe ZIP path"): load_tabular(buffer.getvalue(),"study.xlsx")
