from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc, asc, or_, select, update
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Set, Union, Union
import logging

from app.database import get_async_db
from app.models import User  # Core model
from app.domains.mental_health.models import Survey, SurveyQuestion, SurveyAnswer, SurveyResponse
from app.dependencies import get_current_active_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/surveys",
    tags=["Admin - Surveys"],
    dependencies=[Depends(get_admin_user)]
)


def _normalize_options(question_type: str, raw: Optional[Any]) -> Optional[dict]:
    """Ensure options are stored as JSON-compatible dicts."""
    if question_type == 'rating':
        payload = raw or {}
        scale = payload.get('scale', {}) if isinstance(payload, dict) else {}
        min_v = scale.get('min', 1)
        max_v = scale.get('max', 5)
        if not isinstance(min_v, int) or not isinstance(max_v, int) or min_v >= max_v:
            min_v, max_v = 1, 5
        return {"scale": {"min": int(min_v), "max": int(max_v)}}

    if question_type == 'multiple-choice':
        if isinstance(raw, dict) and 'choices' in raw:
            choices = raw.get('choices')
        else:
            choices = raw
        if isinstance(choices, list):
            cleaned = [str(choice) for choice in choices]
        else:
            cleaned = []
        return {"choices": cleaned} if cleaned else None

    if isinstance(raw, dict):
        return raw

    return None


class SurveyQuestionCreate(BaseModel):
    question_text: str
    question_type: str
    options: Optional[Union[List[str], Dict[str, Any]]] = None

class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    questions: List[SurveyQuestionCreate]

class SurveyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class SurveyQuestionUpsert(BaseModel):
    id: Optional[int] = None
    question_text: str
    question_type: str
    options: Optional[Union[List[str], Dict[str, Any]]] = None

class SurveyQuestionResponse(BaseModel):
    id: int
    question_text: str
    question_type: str
    options: Optional[Union[List[str], Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class SurveyResponseModel(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    questions: List[SurveyQuestionResponse]

    class Config:
        from_attributes = True

@router.get("", response_model=List[SurveyResponseModel])
async def get_surveys(db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Survey).options(selectinload(Survey.questions)).order_by(desc(Survey.created_at)))
    surveys = result.scalars().all()
    return surveys

@router.post("", response_model=SurveyResponseModel, status_code=status.HTTP_201_CREATED)
async def create_survey(survey_data: SurveyCreate, db: AsyncSession = Depends(get_async_db)):
    db_survey = Survey(title=survey_data.title, description=survey_data.description, category=survey_data.category)
    db.add(db_survey)
    await db.commit()
    await db.refresh(db_survey)

    for question_data in survey_data.questions:
        payload = question_data.dict()
        options = _normalize_options(payload["question_type"], payload.get("options"))
        db_question = SurveyQuestion(
            survey_id=db_survey.id,
            question_text=payload["question_text"],
            question_type=payload["question_type"],
            options=options,
        )
        db.add(db_question)

    await db.commit()
    # Re-fetch with questions eagerly loaded to avoid async lazy-load during serialization
    result = await db.execute(
        select(Survey)
        .options(selectinload(Survey.questions))
        .filter(Survey.id == db_survey.id)
    )
    survey_with_questions = result.scalar_one()
    return survey_with_questions

@router.get("/{survey_id}", response_model=SurveyResponseModel)
async def get_survey(survey_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Survey).options(selectinload(Survey.questions)).filter(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey

@router.put("/{survey_id}", response_model=SurveyResponseModel)
async def update_survey(survey_id: int, survey_data: SurveyUpdate, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Survey).options(selectinload(Survey.questions)).filter(Survey.id == survey_id))
    db_survey = result.scalar_one_or_none()
    if not db_survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    update_data = survey_data.dict(exclude_unset=True)
    # Enforce only one active survey at a time
    if 'is_active' in update_data and update_data['is_active'] is True:
        try:
            await db.execute(
                update(Survey)
                .where(Survey.id != survey_id)
                .values(is_active=False)
            )
        except Exception as e:
            logger.error(f"Error deactivating other surveys while activating {survey_id}: {e}")
    for key, value in update_data.items():
        setattr(db_survey, key, value)
    
    db.add(db_survey)
    await db.commit()
    # Return a reloaded instance with questions eagerly loaded to prevent async lazy loads
    result = await db.execute(
        select(Survey)
        .options(selectinload(Survey.questions))
        .filter(Survey.id == survey_id)
    )
    survey_with_questions = result.scalar_one()
    return survey_with_questions

@router.delete("/{survey_id}", status_code=status.HTTP_200_OK)
async def delete_survey(survey_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Survey).options(selectinload(Survey.questions)).filter(Survey.id == survey_id))
    db_survey = result.scalar_one_or_none()
    if not db_survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    await db.delete(db_survey)
    await db.commit()
    return {"detail": "deleted"}

class SurveyAnswerResponse(BaseModel):
    id: int
    question_text: str
    answer_text: str

    class Config:
        from_attributes = True

class SurveySubmissionResponse(BaseModel):
    id: int
    user_id: int
    created_at: datetime
    answers: List[SurveyAnswerResponse]

    class Config:
        from_attributes = True

@router.get("/{survey_id}/responses", response_model=List[SurveySubmissionResponse])
async def get_survey_responses(survey_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(
        select(SurveyResponse)
        .filter(SurveyResponse.survey_id == survey_id)
        .order_by(desc(SurveyResponse.created_at))
    )
    responses = result.scalars().all()
    
    response_models = []
    for response in responses:
        result = await db.execute(
            select(SurveyAnswer.id, SurveyQuestion.question_text, SurveyAnswer.answer_text)
            .join(SurveyQuestion)
            .filter(SurveyAnswer.response_id == response.id)
        )
        answers = result.all()
        response_models.append(
            SurveySubmissionResponse(
                id=response.id,
                user_id=response.user_id,
                created_at=response.created_at,
                answers=[
                    SurveyAnswerResponse(id=a.id, question_text=a.question_text, answer_text=a.answer_text) for a in answers
                ]
            )
        )
    return response_models

user_router = APIRouter(
    prefix="/api/v1/surveys",
    tags=["Surveys"],
    dependencies=[Depends(get_current_active_user)]
)

@user_router.get("/active", response_model=SurveyResponseModel)
async def get_active_survey(db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Survey).options(selectinload(Survey.questions)).filter(Survey.is_active == True).order_by(desc(Survey.created_at)))
    survey = result.scalars().first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active survey found")
    return survey

class SurveyAnswerCreate(BaseModel):
    question_id: int
    answer_text: str

class SurveyResponseCreate(BaseModel):
    answers: List[SurveyAnswerCreate]

@user_router.post("/{survey_id}/responses", status_code=status.HTTP_201_CREATED)
async def submit_survey_response(
    survey_id: int,
    response_data: SurveyResponseCreate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_active_user)
):
    db_response = SurveyResponse(survey_id=survey_id, user_id=user.id)
    db.add(db_response)
    await db.commit()
    await db.refresh(db_response)

    for answer_data in response_data.answers:
        db_answer = SurveyAnswer(
            response_id=db_response.id,
            **answer_data.dict()
        )
        db.add(db_answer)
    
    await db.commit()

@router.put("/{survey_id}/questions/bulk", response_model=SurveyResponseModel)
async def upsert_survey_questions(
    survey_id: int,
    questions: List[SurveyQuestionUpsert],
    db: AsyncSession = Depends(get_async_db)
):
    """Replace survey questions with provided set (create/update/delete missing)."""
    # Ensure survey exists
    result = await db.execute(select(Survey).filter(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Fetch existing questions
    result = await db.execute(select(SurveyQuestion).filter(SurveyQuestion.survey_id == survey_id))
    existing_list: List[SurveyQuestion] = list(result.scalars().all())
    existing_by_id: Dict[int, SurveyQuestion] = {q.id: q for q in existing_list if q.id is not None}

    incoming_ids: Set[int] = set(q.id for q in questions if q.id is not None)  # type: ignore

    # Delete questions not present in payload
    for q in existing_list:
        if q.id not in incoming_ids:
            await db.delete(q)

    # Upsert incoming
    for item in questions:
        normalized_options = _normalize_options(item.question_type, item.options)
        if item.id and item.id in existing_by_id:
            db_q = existing_by_id[item.id]
            db_q.question_text = item.question_text
            db_q.question_type = item.question_type
            db_q.options = normalized_options
            db.add(db_q)
        else:
            db_q = SurveyQuestion(
                survey_id=survey_id,
                question_text=item.question_text,
                question_type=item.question_type,
                options=normalized_options,
            )
            db.add(db_q)

    await db.commit()

    # Return updated survey with questions
    result = await db.execute(select(Survey).options(selectinload(Survey.questions)).filter(Survey.id == survey_id))
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found after update")
    return updated

@router.get("/{survey_id}/analytics")
async def get_survey_analytics(
    survey_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    """Return simple analytics summary for a survey."""
    # Total responses
    total_res_q = await db.execute(select(func.count(SurveyResponse.id)).filter(SurveyResponse.survey_id == survey_id))
    total_responses = int(total_res_q.scalar() or 0)

    # Load questions
    qres = await db.execute(select(SurveyQuestion).filter(SurveyQuestion.survey_id == survey_id))
    questions: List[SurveyQuestion] = list(qres.scalars().all())

    per_question: List[Dict[str, Any]] = []
    for q in questions:
        # Fetch answers for this question
        ares = await db.execute(
            select(SurveyAnswer.answer_text)
            .join(SurveyResponse, SurveyAnswer.response_id == SurveyResponse.id)
            .filter(SurveyResponse.survey_id == survey_id, SurveyAnswer.question_id == q.id)
        )
        answers = [row[0] for row in ares.all()]

        summary: Dict[str, Any] = {"question_id": q.id, "question_text": q.question_text, "question_type": q.question_type}
        if q.question_type == "multiple-choice":
            counts: Dict[str, int] = {}
            for a in answers:
                if a is None:
                    continue
                counts[a] = counts.get(a, 0) + 1
            summary["counts"] = counts
        elif q.question_type == "rating":
            # Expect integer-like answers, compute histogram and average
            values: List[int] = []
            for a in answers:
                try:
                    values.append(int(str(a).strip()))
                except Exception:
                    continue
            hist: Dict[str, int] = {}
            for v in values:
                key = str(v)
                hist[key] = hist.get(key, 0) + 1
            avg = (sum(values) / len(values)) if values else None
            summary["histogram"] = hist
            summary["average"] = avg
        else:
            summary["responses"] = len(answers)
        per_question.append(summary)

    return {"survey_id": survey_id, "total_responses": total_responses, "questions": per_question}

@router.get("/{survey_id}/responses/export")
async def export_survey_responses_csv(
    survey_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    """Export responses as CSV: response_id,user_id,created_at,question_id,question_text,answer_text"""
    # Validate survey exists
    sres = await db.execute(select(Survey).filter(Survey.id == survey_id))
    if not sres.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    rows = await db.execute(
        select(
            SurveyResponse.id, SurveyResponse.user_id, SurveyResponse.created_at,
            SurveyAnswer.question_id, SurveyQuestion.question_text, SurveyAnswer.answer_text
        )
        .join(SurveyAnswer, SurveyAnswer.response_id == SurveyResponse.id)
        .join(SurveyQuestion, SurveyAnswer.question_id == SurveyQuestion.id)
        .filter(SurveyResponse.survey_id == survey_id)
        .order_by(SurveyResponse.created_at.desc())
    )
    data = rows.all()

    # Build CSV text
    import csv
    from io import StringIO
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["response_id", "user_id", "created_at", "question_id", "question_text", "answer_text"])
    for r in data:
        writer.writerow([r[0], r[1], r[2].isoformat() if r[2] else "", r[3], r[4], r[5]])
    csv_text = buf.getvalue()
    headers = {
        "Content-Disposition": f"attachment; filename=survey_{survey_id}_responses.csv"
    }
    return Response(content=csv_text, media_type="text/csv", headers=headers)




