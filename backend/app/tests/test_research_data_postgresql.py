import datetime
import threading
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app import models
from app.db import SessionLocal, engine
from app.routers.research_data import AnalysisRequest, CleaningRequest, VariableUpdate, clean_dataset, create_analysis, export_dataset, get_analysis, get_dataset, list_versions, require_dataset_write, update_variable
from app.services.research_data import fingerprint

pytestmark = pytest.mark.skipif(engine.dialect.name != "postgresql", reason="PostgreSQL-only research-data closure gate")
PREFIX="pg-rd-closure"

def stamp(): return datetime.datetime.now(datetime.UTC).isoformat()
def context(user,org,role="RESEARCHER"): return SimpleNamespace(user=user,organization=org,role=role,is_global_admin=False)

@pytest.fixture(scope="module")
def domain():
    with SessionLocal() as db:
        user=models.User(id=f"{PREFIX}-user",username=f"{PREFIX}-user",email=f"{PREFIX}@example.invalid",hashed_password="unused",role="Researcher",created_at=stamp())
        org=models.Organization(id=f"{PREFIX}-org",name="PostgreSQL closure org",slug=f"{PREFIX}-org",organization_type="PERSONAL",status="ACTIVE",owner_user_id=user.id,created_at=stamp())
        project=models.ResearchProject(id=f"{PREFIX}-project",userId=user.id,organizationId=org.id,titleAr="اختبار",titleEn="Closure",studyDesign="quantitative",sampleSettings={})
        dataset=models.ResearchDataset(id=f"{PREFIX}-dataset",organization_id=org.id,project_id=project.id,owner_id=user.id,name="Closure data",source_type="TEST",sensitivity="INTERNAL",status="READY",current_version_id=f"{PREFIX}-v1",created_at=stamp(),updated_at=stamp())
        records=[{"participant":"SECRET_PARTICIPANT_VALUE","group":"a","score":1,"note":"  alpha  "},{"participant":"hidden","group":"b","score":2,"note":" beta "}]
        version=models.DatasetVersion(id=f"{PREFIX}-v1",organization_id=org.id,dataset_id=dataset.id,version_number="1.0",kind="RAW",fingerprint=fingerprint(records),row_count=2,column_count=4,data_json=records,change_summary="raw",created_by=user.id,created_at=stamp())
        variables=[models.DatasetVariable(id=f"{PREFIX}-var-{i}",organization_id=org.id,dataset_id=dataset.id,name=name,data_type=typ,measurement_level=level,role=role,sensitive=sensitive,identifier=sensitive) for i,(name,typ,level,role,sensitive) in enumerate([("participant","STRING","FREE_TEXT","IDENTIFIER",True),("group","CATEGORY","NOMINAL","GROUPING",False),("score","INTEGER","RATIO","DEPENDENT",False),("note","STRING","FREE_TEXT","OTHER",False)])]
        db.add(user); db.commit()
        db.add(org); db.commit()
        db.add(project); db.commit()
        db.add(dataset); db.commit()
        db.add(version); db.commit()
        db.add_all(variables); db.commit()
        yield {"user_id":user.id,"org_id":org.id,"project_id":project.id,"dataset_id":dataset.id,"v1":version.id,"raw":records}
    with SessionLocal() as db:
        project=db.get(models.ResearchProject,f"{PREFIX}-project")
        if project: db.delete(project); db.commit()
        org=db.get(models.Organization,f"{PREFIX}-org")
        if org: db.delete(org); db.commit()
        user=db.get(models.User,f"{PREFIX}-user")
        if user: db.delete(user); db.commit()

def test_postgresql_dataset_persistence_dictionary_and_sensitive_preview(domain):
    with SessionLocal() as db:
        user=db.get(models.User,domain["user_id"]); org=db.get(models.Organization,domain["org_id"])
        result=get_dataset(domain["dataset_id"],db,context(user,org))
        assert result["rows"]==2 and len(result["dictionary"])==4
        assert all("participant" not in row for row in result["preview"])
        assert "SECRET_PARTICIPANT_VALUE" not in str(result)

def test_postgresql_dataset_version_fk_integrity(domain):
    with SessionLocal() as db:
        bad=models.ResearchAnalysis(id=f"{PREFIX}-bad",organization_id=domain["org_id"],project_id=domain["project_id"],dataset_id=domain["dataset_id"],dataset_version_id="missing-version",analysis_type="DESCRIPTIVES",configuration={},result={},engine_version="test",created_by=domain["user_id"],created_at=stamp())
        db.add(bad)
        with pytest.raises(IntegrityError): db.commit()
        db.rollback()

def test_postgresql_cross_tenant_dataset_and_analysis_idor_are_blocked(domain):
    with SessionLocal() as db:
        other_user=models.User(id=f"{PREFIX}-other-user",username=f"{PREFIX}-other",email=f"{PREFIX}-other@example.invalid",hashed_password="unused",role="Researcher",created_at=stamp())
        other_org=models.Organization(id=f"{PREFIX}-other-org",name="Other",slug=f"{PREFIX}-other",organization_type="PERSONAL",status="ACTIVE",owner_user_id=other_user.id,created_at=stamp())
        analysis=models.ResearchAnalysis(id=f"{PREFIX}-analysis",organization_id=domain["org_id"],project_id=domain["project_id"],dataset_id=domain["dataset_id"],dataset_version_id=domain["v1"],analysis_type="DESCRIPTIVES",configuration={"variables":["score"]},result={"p_value":0.021},engine_version="baseerah-stats-1.0",created_by=domain["user_id"],created_at=stamp())
        db.add_all([other_user,other_org,analysis]);db.commit()
        with pytest.raises(HTTPException) as dataset_error: get_dataset(domain["dataset_id"],db,context(other_user,other_org))
        assert dataset_error.value.status_code==404
        with pytest.raises(HTTPException) as analysis_error: get_analysis(analysis.id,db,context(other_user,other_org))
        assert analysis_error.value.status_code==404
        protected_calls=[
            lambda:list_versions(domain["dataset_id"],db,context(other_user,other_org)),
            lambda:update_variable(domain["dataset_id"],f"{PREFIX}-var-2",VariableUpdate(role="DEPENDENT"),db,context(other_user,other_org)),
            lambda:create_analysis(domain["dataset_id"],AnalysisRequest(dataset_version_id=domain["v1"],analysis_type="DESCRIPTIVES",configuration={"variables":["score"]}),db,context(other_user,other_org)),
            lambda:export_dataset(domain["dataset_id"],db,context(other_user,other_org)),
        ]
        for call in protected_calls:
            with pytest.raises(HTTPException) as error: call()
            assert error.value.status_code==404
        db.delete(analysis);db.delete(other_org);db.delete(other_user);db.commit()

def test_same_tenant_viewer_cannot_modify_dataset(domain):
    with SessionLocal() as db:
        user=db.get(models.User,domain["user_id"]);org=db.get(models.Organization,domain["org_id"])
        with pytest.raises(HTTPException) as error: require_dataset_write(context(user,org,"VIEWER"))
        assert error.value.status_code==403

def test_postgresql_concurrent_cleaning_allocates_successive_versions_and_preserves_raw(domain):
    barrier=threading.Barrier(2); results=[]; errors=[]
    def worker(label):
        db=SessionLocal()
        try:
            user=db.get(models.User,domain["user_id"]);org=db.get(models.Organization,domain["org_id"]);barrier.wait(timeout=5)
            result=clean_dataset(domain["dataset_id"],CleaningRequest(operation="TRIM_TEXT",variable="note",parameters={},change_summary=f"concurrent {label}"),db,context(user,org));results.append(result["version"])
        except Exception as exc: errors.append(exc)
        finally: db.close()
    threads=[threading.Thread(target=worker,args=(label,)) for label in ("A","B")]
    [thread.start() for thread in threads];[thread.join(timeout=15) for thread in threads]
    assert errors==[] and sorted(results)==["1.1","1.2"]
    with SessionLocal() as db:
        raw=db.get(models.DatasetVersion,domain["v1"]);dataset=db.get(models.ResearchDataset,domain["dataset_id"]);current=db.get(models.DatasetVersion,dataset.current_version_id)
        assert raw.data_json==domain["raw"]
        assert current.data_json[0]["note"]=="alpha"

def test_postgresql_historical_analysis_becomes_stale_without_overwrite(domain):
    with SessionLocal() as db:
        user=db.get(models.User,domain["user_id"]);org=db.get(models.Organization,domain["org_id"])
        analysis=models.ResearchAnalysis(id=f"{PREFIX}-historical",organization_id=domain["org_id"],project_id=domain["project_id"],dataset_id=domain["dataset_id"],dataset_version_id=domain["v1"],analysis_type="DESCRIPTIVES",configuration={},result={"mean":1.5},engine_version="baseerah-stats-1.0",created_by=user.id,created_at=stamp())
        db.add(analysis);db.commit();result=get_analysis(analysis.id,db,context(user,org))
        assert result["stale"] is True and result["dataset_version_id"]==domain["v1"] and result["result"]=={"mean":1.5}
