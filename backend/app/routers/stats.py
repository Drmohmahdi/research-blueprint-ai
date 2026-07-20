import datetime
import secrets
import math
from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..db import get_db, SessionLocal
from .. import models, schemas
from ..services.stats_service import run_python_monte_carlo, inspect_uploaded_csv, SeededRandom, run_independent_t_test
from .auth import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])

@router.post("/simulate-scores", response_model=schemas.SimulationResponse)
def simulate_scores_endpoint(params: schemas.SimulationParamsSchema, sampleSize: int, current_user: models.User = Depends(get_current_user)):
    result = run_python_monte_carlo(sampleSize, params)
    return result

@router.post("/inspect-data", response_model=schemas.DataInspectionResponse)
async def inspect_data_endpoint(file: UploadFile = File(...), lang: str = "ar", current_user: models.User = Depends(get_current_user)):
    contents = await file.read()
    csv_text = contents.decode("utf-8")
    result = inspect_uploaded_csv(csv_text, is_arabic=(lang == "ar"))
    return result

# Async Monte Carlo Job Background Runner
def run_simulation_job_task(job_id: str):
    db = SessionLocal()
    try:
        job = db.query(models.SimulationJob).filter(models.SimulationJob.id == job_id).first()
        if not job or job.status == "CANCELLED":
            return
        
        job.status = "RUNNING"
        job.progress = 5
        db.commit()

        # Parse parameters
        params = schemas.SimulationParamsSchema(**job.params)
        sample_size = job.sampleSize
        
        total_runs = params.iterations
        chunk_size = max(1, total_runs // 10)
        successful_runs = 0
        final_dataset = []

        rng = SeededRandom(params.seed)
        size_per_group = math.ceil(sample_size / 2)
        clip = lambda x: max(0.0, min(params.maxScore, x))

        for chunk_idx in range(10):
            # Check for cancellation
            db.refresh(job)
            if job.status == "CANCELLED":
                return
            
            chunk_runs = chunk_size if chunk_idx < 9 else (total_runs - chunk_size * 9)
            for _ in range(chunk_runs):
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
                        else:
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

                if len(final_dataset) == 0:
                    final_dataset = current_dataset

            # Update progress
            job.progress = int((chunk_idx + 1) * 10)
            db.commit()

        # Compute final results
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

        result_payload = {
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

        job.status = "COMPLETED"
        job.progress = 100
        job.result = result_payload
        db.commit()
    except Exception as e:
        import traceback
        error_msg = f"{e}\n{traceback.format_exc()}"
        try:
            job.status = "FAILED"
            job.error = error_msg
            db.commit()
        except:
            pass
    finally:
        db.close()


@router.post("/jobs", response_model=schemas.SimulationJobResponse)
def schedule_simulation_job(
    params: schemas.SimulationParamsSchema,
    sampleSize: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job_id = f"job-{secrets.token_hex(6)}"
    db_job = models.SimulationJob(
        id=job_id,
        userId=current_user.id,
        status="PENDING",
        progress=0,
        sampleSize=sampleSize,
        params=params.model_dump(),
        createdAt=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)

    # Launch in BackgroundTasks
    background_tasks.add_task(run_simulation_job_task, job_id)

    return db_job


@router.get("/jobs/{job_id}", response_model=schemas.SimulationJobResponse)
def get_simulation_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.SimulationJob).filter(
        models.SimulationJob.id == job_id,
        models.SimulationJob.userId == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")
    return job


@router.post("/jobs/{job_id}/cancel")
def cancel_simulation_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.SimulationJob).filter(
        models.SimulationJob.id == job_id,
        models.SimulationJob.userId == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")
    
    if job.status in ["PENDING", "RUNNING"]:
        job.status = "CANCELLED"
        db.commit()
        return {"message": "Job cancelled successfully"}
    else:
        return {"message": f"Cannot cancel job in state {job.status}"}


