"""
Research Design Intelligence — deterministic engines.

Domain ownership: ResearchProject (models.ResearchProject) plus the structured
research design state (models.ResearchDesignState). These engines are pure
determinism: they never delegate methodological decisions, readiness verdicts,
protocol approval, or calculation to an LLM.

Concerns handled here:
  * Research Idea canvas + maturity
  * Problem intelligence + rules
  * Research Gap evidence map + gap lineage (Literature studies)
  * Objectives, Questions, Hypotheses checks
  * Conceptual variable registry + operational definitions
  * Conceptual / Theoretical frameworks
  * Methodology recommendation & validation (deterministic)
  * Design conflict detection + causal claim warning
  * Sampling design studio
  * Measurement planning + coverage
  * Data collection procedure
  * Analysis alignment intelligence
  * Research Protocol build / versioning / staleness
  * Research Coherence Engine
  * Research Readiness Engine (score + blocking gates per template)
  * Next Best Research Action engine
  * Project-scoped collaboration helpers (PI / co-researcher / assistant / reviewer)
  * Methodology Review exact-version binding
"""
from __future__ import annotations

import datetime
import hashlib
import json
import re
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models
from .research_lifecycle import resolve_template

# ── constants ─────────────────────────────────────────────────────────────────

SEVERITY_WEIGHTS = {"BLOCKING": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "ADVISORY": 0.5}
RULE_WEIGHTS: dict[str, float] = {}

GAP_TYPES = [
    "KNOWLEDGE_GAP", "EVIDENCE_GAP", "METHODOLOGICAL_GAP", "POPULATION_GAP",
    "CONTEXTUAL_GAP", "THEORETICAL_GAP", "PRACTICE_GAP", "CONTRADICTORY_EVIDENCE",
]
GAP_STRENGTHS = ["STRONG", "MODERATE", "WEAK", "UNSUBSTANTIATED"]
IDEA_MATURITY = ["EARLY_IDEA", "DEVELOPING", "RESEARCHABLE", "READY_FOR_DESIGN"]
OBJECTIVE_KINDS = ["PRIMARY", "SECONDARY", "EXPLORATORY"]
QUESTION_TYPES = [
    "DESCRIPTIVE", "COMPARATIVE", "RELATIONAL", "PREDICTIVE",
    "EXPLANATORY", "EXPLORATORY", "QUALITATIVE",
]
ANALYSIS_INTENTS = ["DESCRIBE", "COMPARE", "ASSOCIATE", "PREDICT", "EXPLORE", "EXPLAIN", "INTERPRET"]
VARIABLE_ROLES = [
    "INDEPENDENT", "DEPENDENT", "PREDICTOR", "OUTCOME", "MEDIATOR",
    "MODERATOR", "CONTROL", "COVARIATE", "DEMOGRAPHIC", "QUALITATIVE_CONCEPT",
]
MEMBER_RELATIONSHIPS = ["PI", "CO_RESEARCHER", "RESEARCH_ASSISTANT", "METHODOLOGY_REVIEWER", "DATA_ANALYST"]
REVIEW_RECOMMENDATIONS = ["READY", "REVISIONS_REQUIRED", "MAJOR_CONCERNS"]

# Deterministic keyword signals (Arabic + English)
PAT_CHANGE = re.compile(r"change|changes?|trend|over time|longitudinal|بمرور الوقت|تغير|تطور|مستقبلي", re.I)
PAT_COMPARE = re.compile(r"compar|differen|مقارن|الفرق بين|تختلف", re.I)
PAT_RELATE = re.compile(r"relation|associat|correlat|علاقة|ارتباط|يرتبط", re.I)
PAT_PREDICT = re.compile(r"predict|impact of|effect of|influenc|تنبؤ|تأثير|أثر", re.I)
PAT_CAUSAL = re.compile(r"cause[sd]?|leads? to|result[sd]? in|because of|يسبب|يؤدي إلى|بسبب|ينتج عن", re.I)
PAT_EXPLAIN = re.compile(r"explain|why|reason|تفسير|لماذا|سبب", re.I)
PAT_EXPLORE = re.compile(r"explor|استكشاف|استطلاع", re.I)
PAT_QUAL = re.compile(r"experience|perception|meaning|lived|phenomenolog|تصور|تجربة|معنى|ظاهرة|نوعي", re.I)
PAT_DESCRIBE = re.compile(r"what is|what are|describe|level|prevalence|frequency|ما هو|ما هي|وصف|مستوى|انتشار|توزيع", re.I)


# ── helpers ───────────────────────────────────────────────────────────────────

def utc_now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16]}"


def _canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def fingerprint(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_json(payload).encode()).hexdigest()


def _j(value: Any, default: Any = None) -> Any:
    if value is None:
        return default
    return value


def as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.values())
    return []


def research_family(project: models.ResearchProject) -> str:
    return resolve_template(project)


def _question_type(text: str) -> str:
    t = text or ""
    if PAT_CHANGE.search(t):
        return "COMPARATIVE" if PAT_COMPARE.search(t) else "RELATIONAL"
    if PAT_COMPARE.search(t):
        return "COMPARATIVE"
    if PAT_RELATE.search(t):
        return "RELATIONAL"
    if PAT_PREDICT.search(t):
        return "PREDICTIVE"
    if PAT_CAUSAL.search(t) or PAT_EXPLAIN.search(t):
        return "EXPLANATORY"
    if PAT_EXPLORE.search(t):
        return "EXPLORATORY"
    if PAT_QUAL.search(t) and not PAT_DESCRIBE.search(t):
        return "QUALITATIVE"
    return "DESCRIPTIVE"


def _analysis_family_for_intent(intent: str) -> str:
    return {
        "DESCRIBE": "DESCRIPTIVE_STATISTICS",
        "COMPARE": "GROUP_COMPARISON",
        "ASSOCIATE": "CORRELATION",
        "PREDICT": "REGRESSION",
        "EXPLORE": "THEMATIC_ANALYSIS",
        "EXPLAIN": "EXPLANATORY_MODEL",
        "INTERPRET": "QUALITATIVE_INTERPRETATION",
    }.get(intent, "DESCRIPTIVE_STATISTICS")


def get_or_create_design_state(db: Session, project: models.ResearchProject, user_id: str | None) -> models.ResearchDesignState:
    state = db.query(models.ResearchDesignState).filter(
        models.ResearchDesignState.organization_id == project.organizationId,
        models.ResearchDesignState.project_id == project.id,
    ).first()
    if state:
        return state
    state = models.ResearchDesignState(
        id=new_id("dstate"), organization_id=project.organizationId, project_id=project.id,
        updated_by=user_id, updated_at=utc_now(),
    )
    db.add(state)
    db.flush()
    return state


def save_design_section(db: Session, project: models.ResearchProject, section: str, payload: dict[str, Any], user_id: str) -> models.ResearchDesignState:
    allowed = {
        "idea", "problem", "gap", "objectives", "question_ext", "hypothesis_ext",
        "variable_registry", "conceptual_framework", "theoretical_framework",
        "methodology", "sampling", "measurement", "procedure", "analysis",
    }
    if section not in allowed:
        raise HTTPException(422, "Unsupported design section")
    state = get_or_create_design_state(db, project, user_id)
    setattr(state, f"{section}_json", payload)
    state.updated_by = user_id
    state.updated_at = utc_now()
    db.flush()
    return state


def _primary_questions(db: Session, project: models.ResearchProject) -> list[models.ResearchQuestion]:
    return db.query(models.ResearchQuestion).filter(models.ResearchQuestion.projectId == project.id).all()


def _primary_hypotheses(db: Session, project: models.ResearchProject) -> list[models.Hypothesis]:
    return db.query(models.Hypothesis).filter(models.Hypothesis.projectId == project.id).all()


def _primary_variables(db: Session, project: models.ResearchProject) -> list[models.ResearchVariable]:
    return db.query(models.ResearchVariable).filter(models.ResearchVariable.projectId == project.id).all()


def _literature_studies(db: Session, project: models.ResearchProject) -> list[models.LiteratureStudy]:
    return db.query(models.LiteratureStudy).filter(models.LiteratureStudy.projectId == project.id).all()


def _registry_map(state: models.ResearchDesignState) -> dict[str, dict[str, Any]]:
    reg = _j(getattr(state, "variable_registry_json", None), {})
    if isinstance(reg, dict) and "variables" in reg:
        return reg["variables"] or {}
    return reg or {}


def _measurement_instruments(state: models.ResearchDesignState) -> list[dict[str, Any]]:
    meas = _j(getattr(state, "measurement_json", None), {})
    if isinstance(meas, dict):
        return as_list(meas.get("instruments"))
    return []


def _objectives(state: models.ResearchDesignState) -> list[dict[str, Any]]:
    obj = _j(getattr(state, "objectives_json", None), {})
    return as_list(obj.get("objectives")) if isinstance(obj, dict) else []


def _analysis_plans(state: models.ResearchDesignState) -> dict[str, dict[str, Any]]:
    ana = _j(getattr(state, "analysis_json", None), {})
    if isinstance(ana, dict) and "plans" in ana:
        return ana["plans"] or {}
    return ana or {}


def _sampling(state: models.ResearchDesignState) -> dict[str, Any]:
    return _j(getattr(state, "sampling_json", None), {}) or {}


def _methodology(state: models.ResearchDesignState) -> dict[str, Any]:
    return _j(getattr(state, "methodology_json", None), {}) or {}


def _gap_map(state: models.ResearchDesignState) -> dict[str, Any]:
    return _j(getattr(state, "gap_json", None), {}) or {}


# ── Research Design Map (signature view) ─────────────────────────────────────

def compute_design_map(db: Session, project: models.ResearchProject, state: models.ResearchDesignState | None) -> dict[str, Any]:
    if state is None:
        state = get_or_create_design_state(db, project, None)
    questions = _primary_questions(db, project)
    hypotheses = _primary_hypotheses(db, project)
    variables = _primary_variables(db, project)
    objectives = _objectives(state)
    instruments = _measurement_instruments(state)
    analyses = _analysis_plans(state)
    registry = _registry_map(state)

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    unmapped: list[dict[str, Any]] = []

    def add_node(nid: str, ntype: str, title: str, sub: str = "") -> None:
        nodes.append({"id": nid, "type": ntype, "title": title, "sub": sub, "status": "MAPPED"})

    def add_edge(src: str, dst: str, rel: str) -> None:
        edges.append({"from": src, "to": dst, "relationship": rel})

    # Problem node
    problem_present = bool(project.problemStatementAr or project.problemStatementEn)
    problem_id = "problem"
    if problem_present:
        add_node(problem_id, "PROBLEM", project.problemStatementEn or project.problemStatementAr or "")
    else:
        nodes.append({"id": problem_id, "type": "PROBLEM", "title": "Research Problem", "sub": "", "status": "UNMAPPED"})
        unmapped.append({"type": "PROBLEM", "title": "Research Problem"})

    # Objectives
    for i, obj in enumerate(objectives):
        oid = f"objective-{i}"
        add_node(oid, "OBJECTIVE", obj.get("text_en") or obj.get("text_ar") or f"Objective {i + 1}", obj.get("kind", "SECONDARY"))
        if problem_present:
            add_edge(problem_id, oid, "DRIVES")

    # Questions
    question_by_id: dict[str, str] = {}
    for q in questions:
        nid = f"question-{q.id}"
        question_by_id[q.id] = nid
        add_node(nid, "QUESTION", q.textEn or q.textAr, q.id)
        ext = (_j(state.question_ext_json, {}) or {}).get(q.id, {})
        linked_obj = ext.get("objective_id")
        if linked_obj:
            add_edge(f"objective-{linked_obj}", nid, "ADDRESSES")
        elif objectives:
            unmapped.append({"type": "QUESTION_OBJECTIVE_LINK", "title": q.id})
        for vid in as_list(q.associatedVariables):
            add_edge(nid, f"variable-{vid}", "USES")

    # Hypotheses
    for h in hypotheses:
        nid = f"hypothesis-{h.id}"
        add_node(nid, "HYPOTHESIS", h.textEn or h.textAr, h.type)
        if h.questionId and h.questionId in question_by_id:
            add_edge(question_by_id[h.questionId], nid, "OPERATIONALIZES")
        else:
            unmapped.append({"type": "HYPOTHESIS_QUESTION_LINK", "title": h.id})
        if h.independentVarId:
            add_edge(nid, f"variable-{h.independentVarId}", "INDEPENDENT")
        if h.dependentVarId:
            add_edge(nid, f"variable-{h.dependentVarId}", "DEPENDENT")

    # Variables
    variable_by_id: dict[str, str] = {}
    for v in variables:
        nid = f"variable-{v.id}"
        variable_by_id[v.id] = nid
        reg = registry.get(v.id, {})
        add_node(nid, "VARIABLE", v.nameEn or v.nameAr, reg.get("role", v.type))
        if not reg.get("operational_definition"):
            unmapped.append({"type": "OPERATIONAL_DEFINITION", "title": v.id})
        if not reg.get("measurement_strategy"):
            unmapped.append({"type": "MEASUREMENT_STRATEGY", "title": v.id})

    # Instruments
    instrument_by_id: dict[str, str] = {}
    for i, inst in enumerate(instruments):
        iid = inst.get("id") or f"instrument-{i}"
        nid = f"instrument-{iid}"
        instrument_by_id[iid] = nid
        add_node(nid, "INSTRUMENT", inst.get("name", f"Instrument {i + 1}"), inst.get("construct", ""))
        for vid in as_list(inst.get("linked_variables")):
            if vid in variable_by_id:
                add_edge(variable_by_id[vid], nid, "MEASURED_BY")

    # Analysis intent
    for q in questions:
        nid = f"analysis-{q.id}"
        plan = analyses.get(q.id, {})
        intent = plan.get("intent") or _analysis_intent(q.textAr + " " + q.textEn)
        add_node(nid, "ANALYSIS_INTENT", intent, plan.get("analysis_family") or _analysis_family_for_intent(intent))
        if q.id in question_by_id:
            add_edge(question_by_id[q.id], nid, "PLANS")

    return {"project_id": project.id, "nodes": nodes, "edges": edges, "unmapped": unmapped}


# ── Methodology recommendation (deterministic) ───────────────────────────────

def _analysis_intent(text: str) -> str:
    t = text or ""
    if PAT_QUAL.search(t) or PAT_EXPLORE.search(t):
        return "EXPLORE" if PAT_EXPLORE.search(t) else "INTERPRET"
    if PAT_CHANGE.search(t) or PAT_COMPARE.search(t):
        return "COMPARE"
    if PAT_RELATE.search(t):
        return "ASSOCIATE"
    if PAT_PREDICT.search(t) or PAT_CAUSAL.search(t):
        return "PREDICT" if PAT_PREDICT.search(t) else "EXPLAIN"
    if PAT_EXPLAIN.search(t):
        return "EXPLAIN"
    return "DESCRIBE"


def _detect_design_conflicts(project: models.ResearchProject, state: models.ResearchDesignState) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    design = (project.studyDesign or "").casefold()
    questions = _j(state.question_ext_json, {}) or {}
    for qid, ext in questions.items():
        qtype = ext.get("question_type") or _question_type(ext.get("text") or "")
        if qtype == "RELATIONAL" and any(token in design for token in ("cross_sectional", "cross-sectional")):
            conflicts.append({
                "rule": "DESIGN_QUESTION_CONFLICT",
                "severity": "HIGH",
                "source": f"question-{qid}",
                "target": "study_design",
                "evidence": f"Question typed {qtype} but design is {project.studyDesign}",
                "rationale": "A relationship/change question cannot be answered by a single cross-sectional snapshot.",
                "suggested_resolution": "Adopt a longitudinal or repeated-measures design, or re-scope the question to current status.",
            })
        if qtype == "PREDICTIVE" and any(token in design for token in ("cross_sectional", "descriptive", "correlational")):
            conflicts.append({
                "rule": "DESIGN_QUESTION_CONFLICT",
                "severity": "MEDIUM",
                "source": f"question-{qid}",
                "target": "study_design",
                "evidence": f"Predictive question paired with {project.studyDesign}",
                "rationale": "Prediction of future states is limited by a single time point.",
                "suggested_resolution": "Use a cohort/longitudinal design or present the prediction as associational.",
            })
    return conflicts


def _detect_causal_claims(project: models.ResearchProject, state: models.ResearchDesignState) -> list[dict[str, Any]]:
    warnings: list[dict[str, Any]] = []
    design = (project.studyDesign or "").casefold()
    causal = any(token in design for token in ("experimental", "quasi_experimental", "randomized", "intervention", "longitudinal"))
    claims: list[tuple[str, str]] = []
    for qid, q in (_j(state.question_ext_json, {}) or {}).items():
        text = q.get("text") or ""
        for m in PAT_CAUSAL.finditer(text):
            claims.append((qid, m.group(0)))
            break
    if claims and not causal:
        warnings.append({
            "rule": "CAUSAL_LANGUAGE_WARNING",
            "severity": "MEDIUM",
            "source": "question_ext",
            "target": "study_design",
            "evidence": f"Found causal language: {[c[1] for c in claims][:3]} while design is {project.studyDesign}",
            "rationale": "Non-experimental designs cannot support causal inference from causal wording alone.",
            "suggested_resolution": "Reword to associational language or adopt an experimental/quasi-experimental design.",
        })
    return warnings


def recommend_methodology(db: Session, project: models.ResearchProject, state: models.ResearchDesignState) -> dict[str, Any]:
    questions = _primary_questions(db, project)
    intents = [_analysis_intent(q.textAr + " " + q.textEn) for q in questions]
    has_qual = bool(_j(state.methodology_json, {}).get("data_nature") == "QUALITATIVE")
    design = (project.studyDesign or "").casefold()

    if any(token in design for token in ("systematic", "prisma", "meta_analysis", "review")):
        family = "SYSTEMATIC_REVIEW"
        designs = ["systematic_review", "meta_analysis"]
    elif any(token in design for token in ("conceptual", "theoretical", "نظري", "مفاهيمي")):
        family = "CONCEPTUAL_THEORETICAL"
        designs = ["conceptual_theoretical"]
    elif any(token in design for token in ("mixed", "مختلط")):
        family = "MIXED_METHODS"
        designs = ["mixed_methods"]
    elif any(token in design for token in ("qualitative", "نوعي", "case_study", "phenomenolog")):
        family = "QUALITATIVE"
        designs = ["qualitative_generic", "case_study", "phenomenology", "grounded_theory"]
    elif has_qual and intents and any(i in {"EXPLORE", "INTERPRET"} for i in intents):
        family = "QUALITATIVE"
        designs = ["qualitative_generic", "case_study", "phenomenology"]
    else:
        family = "EMPIRICAL_QUANTITATIVE"
        designs = ["experimental", "quasi_experimental", "descriptive", "correlational", "survey", "cross_sectional", "longitudinal"]

    conflicts = _detect_design_conflicts(project, state)
    causal_warnings = _detect_causal_claims(project, state)
    return {
        "research_family": family,
        "candidate_designs": designs,
        "suggested_by": "DETERMINISTIC_METHODOLOGY_ENGINE",
        "requires_researcher_confirmation": True,
        "conflicts": conflicts,
        "causal_claim_warnings": causal_warnings,
        "mixed_methods": {
            "status": "AVAILABLE",
            "note": "Mixed methods uses the qualitative lab for coding and the quantitative tools for measurement and analysis. Both strands remain researcher-confirmed.",
        } if family == "MIXED_METHODS" else None,
    }


# ── Coherence Engine ──────────────────────────────────────────────────────────

def _coherence_finding(rule: str, severity: str, source: str, target: str, evidence: str, rationale: str, suggested: str) -> dict[str, Any]:
    return {
        "rule": rule, "severity": severity, "source": source, "target": target,
        "evidence": evidence, "rationale": rationale, "suggested_resolution": suggested,
    }


def compute_coherence(db: Session, project: models.ResearchProject, state: models.ResearchDesignState | None) -> dict[str, Any]:
    if state is None:
        state = get_or_create_design_state(db, project, None)
    questions = _primary_questions(db, project)
    hypotheses = _primary_hypotheses(db, project)
    variables = _primary_variables(db, project)
    objectives = _objectives(state)
    instruments = _measurement_instruments(state)
    registry = _registry_map(state)
    analyses = _analysis_plans(state)
    gap_map = _gap_map(state)
    family = research_family(project)

    findings: list[dict[str, Any]] = []
    applicable: list[dict[str, Any]] = []
    satisfied = 0.0

    problem_present = bool(project.problemStatementAr or project.problemStatementEn)

    def apply(rule: str, ok: bool, severity: str, source: str, target: str, evidence: str, rationale: str, suggested: str, weight: float = 1.0) -> None:
        nonlocal satisfied
        applicable.append({"rule": rule, "weight": weight})
        if ok:
            satisfied += weight
        else:
            findings.append(_coherence_finding(rule, severity, source, target, evidence, rationale, suggested))

    # Problem → Gap
    gap_present = bool(as_list(gap_map.get("gaps")))
    apply(
        "PROBLEM_TO_GAP",
        problem_present and gap_present,
        "MEDIUM", "problem", "gap",
        "Problem statement present" if problem_present else "No problem statement",
        "The gap must be tied to the stated problem to justify research.",
        "Record the research gap and attach evidence from literature studies.",
    )

    # Problem → Objectives
    apply(
        "PROBLEM_TO_OBJECTIVES",
        not problem_present or bool(objectives),
        "HIGH", "problem", "objectives",
        f"{len(objectives)} objective(s) recorded",
        "Objectives translate the problem into researchable aims.",
        "Add at least one primary objective derived from the problem.",
    )

    # Objectives → Questions coverage
    q_by_objective: dict[str, list] = {}
    for qid, ext in (_j(state.question_ext_json, {}) or {}).items():
        oid = ext.get("objective_id")
        if oid:
            q_by_objective.setdefault(oid, []).append(qid)
    for i, obj in enumerate(objectives):
        oid = str(i)
        covered = bool(q_by_objective.get(oid) or obj.get("linked_question_ids"))
        if obj.get("kind") == "PRIMARY":
            apply(
                "OBJECTIVES_TO_QUESTIONS", covered,
                "HIGH", f"objective-{oid}", "questions",
                f"Objective '{obj.get('text_en') or obj.get('text_ar')}' covered={covered}",
                "Each primary objective should be answered by at least one research question.",
                "Link one or more research questions to this objective.",
            )
        else:
            apply("OBJECTIVES_TO_QUESTIONS", True, "ADVISORY", f"objective-{oid}", "questions",
                  "Non-primary objective coverage is advisory", "Secondary/exploratory objectives may be exploratory.", "")

    # Orphan questions
    if objectives:
        for q in questions:
            ext = (_j(state.question_ext_json, {}) or {}).get(q.id, {})
            apply(
                "ORPHAN_QUESTION", bool(ext.get("objective_id")),
                "LOW", f"question-{q.id}", "objectives",
                "Question is not linked to any objective", "Orphan questions weaken the logical chain.",
                "Link the question to the objective it serves or remove it.",
            )

    # Questions → Hypotheses (quantitative families only)
    needs_hypotheses = family in {"EMPIRICAL_QUANTITATIVE", "SYSTEMATIC_REVIEW"}
    if needs_hypotheses:
        h_question_ids = {h.questionId for h in hypotheses if h.questionId}
        for q in questions:
            qtype = (_j(state.question_ext_json, {}) or {}).get(q.id, {}).get("question_type") or _question_type(q.textAr + " " + q.textEn)
            if qtype in {"COMPARATIVE", "RELATIONAL", "PREDICTIVE", "EXPLANATORY"}:
                apply(
                    "QUESTIONS_TO_HYPOTHESES", q.id in h_question_ids,
                    "MEDIUM", f"question-{q.id}", "hypotheses",
                    f"{qtype} question has no linked hypothesis",
                    "Quantitative inferential questions require a testable hypothesis.",
                    "Add a directional or non-directional hypothesis linked to the question.",
                )
        for h in hypotheses:
            if not h.questionId:
                apply(
                    "ORPHAN_HYPOTHESIS", False,
                    "LOW", f"hypothesis-{h.id}", "questions",
                    "Hypothesis is not linked to any question",
                    "Every hypothesis should serve a research question.",
                    "Link the hypothesis to its research question.",
                )
    else:
        # Qualitative / conceptual: hypotheses must not be forced.
        apply("QUESTIONS_TO_HYPOTHESES", True, "ADVISORY", "questions", "hypotheses",
              "Hypotheses not required for this research family",
              "Qualitative studies do not require hypotheses.", "")

    # Questions → Variables
    for q in questions:
        linked = as_list(q.associatedVariables)
        if needs_hypotheses:
            apply(
                "QUESTIONS_TO_VARIABLES", bool(linked),
                "HIGH", f"question-{q.id}", "variables",
                "Question does not reference any variable",
                "Measurable questions must reference the concepts being studied.",
                "Attach the conceptual variables involved.",
            )

    # Variables → Operational definitions
    if family == "EMPIRICAL_QUANTITATIVE":
        for v in variables:
            reg = registry.get(v.id, {})
            apply(
                "VARIABLES_TO_OPERATIONALIZATION", bool(reg.get("operational_definition")),
                "HIGH", f"variable-{v.id}", "variable_registry",
                "Variable has no operational definition",
                "Measurable variables need an operational definition to be measured.",
                "Define how the variable will be measured in practice.",
            )

    # Variables → Measurement (primary measurable outcome)
    if family == "EMPIRICAL_QUANTITATIVE":
        dependent_ids = {v.id for v in variables if v.type in {"dependent", "outcome", "Dependent", "Outcome"}}
        for v in variables:
            if v.id in dependent_ids:
                reg = registry.get(v.id, {})
                has_instrument = any(v.id in as_list(i.get("linked_variables")) for i in instruments)
                apply(
                    "VARIABLES_TO_MEASUREMENT", bool(reg.get("measurement_strategy")) or has_instrument,
                    "BLOCKING", f"variable-{v.id}", "measurement",
                    "Primary outcome variable has no measurement strategy or instrument",
                    "The design cannot be executed if the primary outcome cannot be measured.",
                    "Define a measurement strategy or link an instrument to this variable.",
                )

    # Questions → Methodology conflict
    for conflict in _detect_design_conflicts(project, state):
        apply(
            conflict["rule"], False, conflict["severity"], conflict["source"], conflict["target"],
            conflict["evidence"], conflict["rationale"], conflict["suggested_resolution"],
        )

    # Causal claim warning
    for warn in _detect_causal_claims(project, state):
        apply(
            warn["rule"], False, warn["severity"], warn["source"], warn["target"],
            warn["evidence"], warn["rationale"], warn["suggested_resolution"],
        )

    # Methodology → Sampling
    if family == "EMPIRICAL_QUANTITATIVE":
        sampling = _sampling(state)
        apply(
            "METHODOLOGY_TO_SAMPLING",
            bool(sampling.get("technique") and sampling.get("planned_n")),
            "MEDIUM", "methodology", "sampling",
            f"technique={sampling.get('technique')}; planned_n={sampling.get('planned_n')}",
            "The sampling strategy must support the design.",
            "Complete the sampling design studio with technique and planned sample size.",
        )

    # Questions → Analysis
    for q in questions:
        plan = analyses.get(q.id)
        qtype = (_j(state.question_ext_json, {}) or {}).get(q.id, {}).get("question_type") or _question_type(q.textAr + " " + q.textEn)
        if plan is None:
            apply(
                "QUESTIONS_TO_ANALYSIS", False,
                "HIGH", f"question-{q.id}", "analysis",
                "No analysis plan is linked to the question",
                "Every required research question must have a planned analysis approach.",
                "Record the analysis intent and expected analysis family for this question.",
            )
        elif _analysis_mismatch(qtype, plan, q.textAr + " " + q.textEn):
            apply(
                "QUESTION_ANALYSIS_MISMATCH", False,
                "BLOCKING", f"question-{q.id}", "analysis",
                f"{qtype} question planned as {plan.get('analysis_family') or plan.get('expected_test')}",
                "Planned analysis cannot answer the stated research question.",
                "Choose an analysis that matches the comparison/relationship being tested.",
            )
        else:
            apply(
                "QUESTIONS_TO_ANALYSIS", True,
                "ADVISORY", f"question-{q.id}", "analysis",
                "Analysis plan is linked to the question", "The planned analysis aligns with the question.", "",
            )

    score = round(satisfied / max(1.0, sum(r["weight"] for r in applicable)) * 100) if applicable else 100
    findings.sort(key=lambda f: SEVERITY_WEIGHTS.get(f["severity"], 0), reverse=True)
    return {
        "score": score,
        "status": "COHERENT" if not any(f["severity"] == "BLOCKING" for f in findings) else "INCOHERENT",
        "findings": findings,
        "checked_rules": len(applicable),
        "computed_by": "DETERMINISTIC_COHERENCE_ENGINE",
    }


def _group_count_from_text(text: str) -> int | None:
    """Best-effort extraction of an explicitly stated group count."""
    if not text:
        return None
    words = {
        "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "ثلاث": 3, "ثلاثة": 3, "أربع": 4, "اربعة": 4, "خمس": 5, "خمسة": 5, "ست": 6, "ستة": 6,
        "سبع": 7, "سبعة": 7, "ثمان": 8, "ثمانية": 8, "تسع": 9, "تسعة": 9, "عشر": 10, "عشرة": 10,
    }
    lowered = text.casefold()
    for word, count in words.items():
        if word in lowered:
            return count
    import re as _re
    m = _re.search(r"\b([2-9]|10)\b", lowered)
    if m:
        return int(m.group(1))
    return None


def _analysis_mismatch(qtype: str, plan: dict[str, Any], question_text: str = "") -> bool:
    family = (plan.get("analysis_family") or plan.get("expected_test") or "").upper()
    groups = int(plan.get("group_count") or 0)
    q_groups = _group_count_from_text(question_text)
    if qtype == "COMPARATIVE":
        implied_groups = q_groups or groups or 0
        if implied_groups > 2:
            two_group_tests = {"T_TEST", "MANN_WHITNEY", "WELCH_T_TEST", "PAIRED_T_TEST", "INDEPENDENT_T_TEST"}
            if any(token in family for token in two_group_tests):
                return True
        if not family:
            return False
        return False
    return False


# ── Readiness Engine ──────────────────────────────────────────────────────────

def _gate(code: str, title: str, ok: bool, severity: str, evidence: str, suggested: str) -> dict[str, Any]:
    return {"code": code, "title": title, "ok": ok, "severity": severity, "evidence": evidence, "suggested_resolution": suggested}


def compute_readiness(db: Session, project: models.ResearchProject, state: models.ResearchDesignState | None, coherence: dict[str, Any] | None = None) -> dict[str, Any]:
    if state is None:
        state = get_or_create_design_state(db, project, None)
    if coherence is None:
        coherence = compute_coherence(db, project, state)
    family = research_family(project)
    variables = _primary_variables(db, project)
    questions = _primary_questions(db, project)
    instruments = _measurement_instruments(state)
    registry = _registry_map(state)
    analyses = _analysis_plans(state)
    sampling = _sampling(state)
    gap_map = _gap_map(state)
    prisma = db.query(models.PrismaFlow).filter(
        models.PrismaFlow.organizationId == project.organizationId,
        models.PrismaFlow.projectId == project.id,
    ).first()
    literature_count = db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.projectId == project.id,
    ).count()

    gates: list[dict[str, Any]] = []
    blocking_failures = 0

    def add_gate(code: str, title: str, ok: bool, severity: str, evidence: str, suggested: str) -> None:
        nonlocal blocking_failures
        gates.append(_gate(code, title, ok, severity, evidence, suggested))
        if not ok and severity == "BLOCKING":
            blocking_failures += 1

    has_iv = any(v.type in {"independent", "Independent", "predictor", "Predictor"} for v in variables)
    has_dv = any(v.type in {"dependent", "Dependent", "outcome", "Outcome"} for v in variables)

    if family == "EMPIRICAL_QUANTITATIVE":
        add_gate("Q_VARIABLES", "Independent and dependent variables defined",
                 has_iv and has_dv, "BLOCKING",
                 f"independent={has_iv}; dependent={has_dv}",
                 "Define at least one independent and one dependent variable.")
        for v in variables:
            if not registry.get(v.id, {}).get("operational_definition"):
                add_gate("Q_OPERATIONALIZATION", "Operational definitions for all variables",
                         False, "HIGH", f"variable {v.id} missing operational definition",
                         "Add an operational definition to each conceptual variable.")
                break
        if not instruments and not any(registry.get(v.id, {}).get("measurement_strategy") for v in variables):
            add_gate("Q_MEASUREMENT", "Measurement strategy or instrument for primary outcome",
                     False, "BLOCKING", "No instrument or measurement strategy linked to variables",
                     "Link an instrument or define a measurement strategy for each primary variable.")
        add_gate("Q_SAMPLING", "Sampling technique and planned sample size",
                 bool(sampling.get("technique") and sampling.get("planned_n")), "BLOCKING",
                 f"technique={sampling.get('technique')}; planned_n={sampling.get('planned_n')}",
                 "Complete the sampling design studio.")
        missing_analysis = [q.id for q in questions if q.id not in analyses]
        add_gate("Q_ANALYSIS_ALIGNMENT", "Every required question has a planned analysis",
                 not missing_analysis, "BLOCKING",
                 f"missing analysis for {len(missing_analysis)} question(s)",
                 "Add an analysis intent for every required question.")
    elif family == "QUALITATIVE":
        method = _methodology(state)
        add_gate("QUAL_PHENOMENON", "Phenomenon / focus of inquiry stated",
                 bool(method.get("phenomenon") or project.problemStatementAr), "BLOCKING",
                 "Phenomenon not recorded", "Describe the phenomenon under study.")
        add_gate("QUAL_PARTICIPANTS", "Participants and context described",
                 bool(sampling.get("target_population")), "BLOCKING",
                 "Participants not described", "Describe the participant population and context.")
        add_gate("QUAL_SAMPLING", "Purposive sampling strategy defined",
                 bool(sampling.get("technique")), "BLOCKING",
                 f"technique={sampling.get('technique')}",
                 "Select a qualitative sampling strategy (e.g. purposive, snowball).")
        add_gate("QUAL_DATA_SOURCES", "Data sources defined",
                 bool(as_list(_j(state.procedure_json, {}).get("data_sources"))), "HIGH",
                 "No data sources listed", "List the data sources (interviews, observations, documents).")
        add_gate("QUAL_ANALYTIC_APPROACH", "Analytic approach defined",
                 bool(_methodology(state).get("analytic_approach")), "BLOCKING",
                 "No analytic approach", "State the analytic approach (thematic, grounded, etc.).")
    elif family == "SYSTEMATIC_REVIEW":
        add_gate("SR_QUESTION", "Research question specified",
                 bool(questions), "BLOCKING", f"{len(questions)} question(s)",
                 "Define the review question.")
        add_gate("SR_SEARCH_STRATEGY", "Search strategy recorded",
                 bool(literature_count or _j(state.procedure_json, {}).get("search_strategy")), "BLOCKING",
                 f"{literature_count} study record(s)", "Record the search strategy and databases.")
        add_gate("SR_ELIGIBILITY", "Eligibility criteria defined",
                 bool(as_list(gap_map.get("eligibility_criteria")) or _j(state.sampling_json, {}).get("inclusion_criteria")), "HIGH",
                 "Eligibility not defined", "Define inclusion and exclusion criteria.")
        add_gate("SR_PRISMA", "PRISMA flow completed",
                 bool(prisma), "HIGH", "PRISMA not created", "Complete the PRISMA flow chart.")
        add_gate("SR_SYNTHESIS", "Synthesis plan defined",
                 bool(as_list(_j(state.analysis_json, {}).get("synthesis_plan"))), "MEDIUM",
                 "No synthesis plan", "State the synthesis approach (narrative, meta-analysis).")
    elif family == "CONCEPTUAL_THEORETICAL":
        theory = _j(state.theoretical_framework_json, {})
        add_gate("CT_THEORY", "Theory / model identified",
                 bool(theory.get("theory") or theory.get("model")), "HIGH",
                 "No theory recorded", "Identify the guiding theory or model.")
        add_gate("CT_CONSTRUCTS", "Core constructs defined",
                 bool(theory.get("core_constructs")), "HIGH",
                 "No constructs", "List the core constructs of the framework.")
        add_gate("CT_RELEVANCE", "Research relevance explained",
                 bool(theory.get("research_relevance")), "MEDIUM",
                 "Relevance not stated", "Explain why the theory is relevant to the study.")
    else:
        add_gate("GEN_DESIGN", "Research design chosen", bool(project.studyDesign), "BLOCKING",
                 f"design={project.studyDesign}", "Select a research design.")

    # Blocking coherence findings must block readiness
    coherence_blockers = [f for f in coherence["findings"] if f["severity"] == "BLOCKING"]
    if coherence_blockers:
        gates.append(_gate("COHERENCE_BLOCKERS", "No blocking coherence findings",
                           False, "BLOCKING",
                           f"{len(coherence_blockers)} blocking finding(s): " + "; ".join(f["rule"] for f in coherence_blockers[:3]),
                           "Resolve the blocking coherence findings first."))
        blocking_failures += 1

    passed = sum(1 for g in gates if g["ok"])
    score = round(passed / max(1, len(gates)) * 100)
    status = "READY" if blocking_failures == 0 else "NOT_READY"
    return {
        "score": score,
        "status": status,
        "template": family,
        "gates": gates,
        "blocking_failures": blocking_failures,
        "computed_by": "DETERMINISTIC_READINESS_ENGINE",
    }


# ── Next Best Research Action ─────────────────────────────────────────────────

def compute_next_action(db: Session, project: models.ResearchProject, state: models.ResearchDesignState | None, coherence: dict[str, Any] | None = None, readiness: dict[str, Any] | None = None) -> dict[str, Any]:
    if state is None:
        state = get_or_create_design_state(db, project, None)
    if coherence is None:
        coherence = compute_coherence(db, project, state)
    if readiness is None:
        readiness = compute_readiness(db, project, state, coherence)

    blocking_coherence = [f for f in coherence["findings"] if f["severity"] == "BLOCKING"]
    if blocking_coherence:
        f = blocking_coherence[0]
        return {
            "action": f.get("suggested_resolution") or f.get("rationale") or "Resolve the blocking finding",
            "reason": f"Coherence finding {f['rule']}: {f.get('evidence')}",
            "priority": "BLOCKING",
            "source_entity": {"type": f.get("source"), "id": f.get("target")},
            "computed_by": "DETERMINISTIC_NEXT_ACTION_ENGINE",
        }

    failed_gates = [g for g in readiness["gates"] if not g["ok"]]
    if failed_gates:
        failed_gates.sort(key=lambda g: (g["severity"] == "BLOCKING",), reverse=True)
        g = failed_gates[0]
        return {
            "action": g["suggested_resolution"],
            "reason": f"Readiness gate {g['code']}: {g['evidence']}",
            "priority": "BLOCKING" if g["severity"] == "BLOCKING" else "HIGH",
            "source_entity": {"type": "readiness_gate", "id": g["code"]},
            "computed_by": "DETERMINISTIC_NEXT_ACTION_ENGINE",
        }

    if state.protocol_status == "NO_PROTOCOL":
        return {
            "action": "Create the research protocol",
            "reason": "Design is coherent and ready; no protocol version exists.",
            "priority": "HIGH",
            "source_entity": {"type": "protocol", "id": "create"},
            "computed_by": "DETERMINISTIC_NEXT_ACTION_ENGINE",
        }
    if state.protocol_status == "DRAFT":
        return {
            "action": "Submit the protocol for methodology review",
            "reason": "A protocol draft exists but has not been submitted.",
            "priority": "HIGH",
            "source_entity": {"type": "protocol", "id": state.current_protocol_id},
            "computed_by": "DETERMINISTIC_NEXT_ACTION_ENGINE",
        }
    if state.protocol_review_due:
        return {
            "action": "Protocol needs review after a major design change",
            "reason": "Approved protocol fingerprint no longer matches the current design.",
            "priority": "HIGH",
            "source_entity": {"type": "protocol", "id": state.current_protocol_id},
            "computed_by": "DETERMINISTIC_NEXT_ACTION_ENGINE",
        }
    return {
        "action": "Proceed to the next lifecycle stage",
        "reason": "No blocking design issues; the protocol is current and approved.",
        "priority": "LOW",
        "source_entity": {"type": "lifecycle", "id": project.id},
        "computed_by": "DETERMINISTIC_NEXT_ACTION_ENGINE",
    }


# ── Protocol build / versioning / staleness ──────────────────────────────────

def protocol_snapshot(db: Session, project: models.ResearchProject, state: models.ResearchDesignState) -> dict[str, Any]:
    return {
        "title_ar": project.titleAr, "title_en": project.titleEn,
        "problem_statement_ar": project.problemStatementAr, "problem_statement_en": project.problemStatementEn,
        "study_design": project.studyDesign,
        "objectives": _objectives(state),
        "questions": [
            {"id": q.id, "text_ar": q.textAr, "text_en": q.textEn, "associated_variables": q.associatedVariables}
            for q in _primary_questions(db, project)
        ],
        "hypotheses": [
            {"id": h.id, "text_ar": h.textAr, "text_en": h.textEn, "type": h.type,
             "independent_var_id": h.independentVarId, "dependent_var_id": h.dependentVarId}
            for h in _primary_hypotheses(db, project)
        ],
        "variables": [
            {"id": v.id, "name_ar": v.nameAr, "name_en": v.nameEn, "type": v.type, "scale": v.scale}
            for v in _primary_variables(db, project)
        ],
        "variable_registry": _registry_map(state),
        "conceptual_framework": _j(state.conceptual_framework_json, {}),
        "theoretical_framework": _j(state.theoretical_framework_json, {}),
        "methodology": _methodology(state),
        "sampling": _sampling(state),
        "measurement": _j(state.measurement_json, {}),
        "procedure": _j(state.procedure_json, {}),
        "analysis": _j(state.analysis_json, {}),
        "gap": _gap_map(state),
    }


def create_protocol(db: Session, project: models.ResearchProject, user_id: str | None) -> models.ResearchProtocol:
    state = get_or_create_design_state(db, project, user_id)
    snapshot = protocol_snapshot(db, project, state)
    fp = fingerprint(snapshot)
    last = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == project.organizationId,
    ).order_by(models.ResearchProtocol.version_number.desc()).first()
    version = (last.version_number + 1) if last else 1
    item = models.ResearchProtocol(
        id=new_id("proto"), organization_id=project.organizationId, project_id=project.id,
        version_number=version, fingerprint=fp, snapshot_json=snapshot,
        status="DRAFT", created_by=user_id, created_at=utc_now(),
    )
    db.add(item)
    db.flush()
    state.current_protocol_id = item.id
    state.protocol_status = "DRAFT"
    state.protocol_review_due = False
    state.updated_at = utc_now()
    db.flush()
    return item


def check_protocol_staleness(db: Session, project: models.ResearchProject, state: models.ResearchDesignState) -> bool:
    """Returns True when the approved protocol fingerprint diverges from the current design."""
    if not state.current_protocol_id or state.protocol_status != "APPROVED":
        return False
    protocol = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.id == state.current_protocol_id,
        models.ResearchProtocol.project_id == project.id,
    ).first()
    if not protocol:
        return False
    current = protocol_snapshot(db, project, state)
    current_fp = fingerprint(current)
    stale = current_fp != protocol.fingerprint
    if stale and not state.protocol_review_due:
        state.protocol_review_due = True
        state.updated_at = utc_now()
        db.flush()
    return stale


# ── Project-scoped collaboration ──────────────────────────────────────────────

def add_project_member(db: Session, project: models.ResearchProject, user_id: str, relationship: str,
                       invited_by: str, assigned_sections: list[str] | None = None, status: str = "ACTIVE") -> models.ResearchProjectMember:
    relationship = relationship.upper()
    if relationship not in MEMBER_RELATIONSHIPS:
        raise HTTPException(422, f"Unsupported project relationship: {relationship}")
    existing = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == user_id,
        models.ResearchProjectMember.relationship == relationship,
        models.ResearchProjectMember.status.in_(["ACTIVE", "INVITED"]),
    ).first()
    if existing:
        return existing
    item = models.ResearchProjectMember(
        id=new_id("pmem"), organization_id=project.organizationId, project_id=project.id,
        user_id=user_id, relationship=relationship, status=status,
        assigned_sections=assigned_sections or [], invited_by=invited_by, created_at=utc_now(),
    )
    db.add(item)
    db.flush()
    return item


def remove_project_member(db: Session, project: models.ResearchProject, user_id: str, relationship: str) -> bool:
    relationship = relationship.upper()
    item = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == user_id,
        models.ResearchProjectMember.relationship == relationship,
        models.ResearchProjectMember.status.in_(["ACTIVE", "INVITED"]),
    ).first()
    if not item:
        return False
    item.status = "REMOVED"
    item.ended_at = utc_now()
    db.flush()
    return True


def list_project_members(db: Session, project: models.ResearchProject) -> list[dict[str, Any]]:
    items = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.organization_id == project.organizationId,
        models.ResearchProjectMember.status.in_(["ACTIVE", "INVITED"]),
    ).order_by(models.ResearchProjectMember.created_at.asc()).all()
    result = []
    for m in items:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        result.append({
            "id": m.id, "project_id": m.project_id, "user_id": m.user_id,
            "username": user.username if user else None,
            "relationship": m.relationship, "status": m.status,
            "assigned_sections": m.assigned_sections, "invited_by": m.invited_by,
            "created_at": m.created_at, "ended_at": m.ended_at,
        })
    return result


def project_access(db: Session, project_id: str, context) -> models.ResearchProject | None:
    project = db.query(models.ResearchProject).filter(
        models.ResearchProject.id == project_id,
        models.ResearchProject.organizationId == context.organization.id,
    ).first()
    if not project:
        return None
    if context.is_global_admin or project.userId == context.user.id:
        return project
    member = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == context.user.id,
        models.ResearchProjectMember.status == "ACTIVE",
    ).first()
    return project if member else None


def member_relationship(db: Session, project: models.ResearchProject, user_id: str) -> str | None:
    if project.userId == user_id:
        return "OWNER"
    item = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == user_id,
        models.ResearchProjectMember.status == "ACTIVE",
    ).first()
    return item.relationship if item else None


def can_edit_section(db: Session, project: models.ResearchProject, context, section: str | None) -> bool:
    if context.is_global_admin or project.userId == context.user.id:
        return True
    rel = member_relationship(db, project, context.user.id)
    if rel in {"PI", "CO_RESEARCHER", "DATA_ANALYST"}:
        return True
    if rel == "RESEARCH_ASSISTANT":
        if not section:
            return False
        member = db.query(models.ResearchProjectMember).filter(
            models.ResearchProjectMember.project_id == project.id,
            models.ResearchProjectMember.user_id == context.user.id,
            models.ResearchProjectMember.status == "ACTIVE",
            models.ResearchProjectMember.relationship == "RESEARCH_ASSISTANT",
        ).first()
        assigned = member.assigned_sections or []
        return section in assigned
    if rel == "METHODOLOGY_REVIEWER":
        return False  # reviewers never edit researcher content silently
    return False
