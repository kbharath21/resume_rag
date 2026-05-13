import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymilvus import Collection
from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy.orm import Session
import main
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from redis_client import redis_client
from database import get_db
from models import JobPosting
import resend
from datetime import datetime
from models import JobPosting, SavedCandidate, OutreachEmail, User, UserPreferences
from sentence_transformers import CrossEncoder


http_bearer = HTTPBearer()
load_dotenv()
main.initialize_connections()

reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
print("✅ Reranker model loaded")

reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

app= FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://127.0.0.1:4000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],  
    allow_headers=["Content-Type", "Authorization"], 
    expose_headers=["Content-Length"],
    max_age=600, 
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

class SearchRequest(BaseModel):
    query: str
    limit: int = 10

class JobPostingCreate(BaseModel):
    company_name: str
    role_title: str
    department: Optional[str] = None
    description: str
    location: Optional[str] = None
    salary_range: Optional[str] = None
    apply_link: Optional[str] = None

class SaveCandidateRequest(BaseModel):
    candidate_user_id: int
    job_posting_id: Optional[int] = None
    note: Optional[str] = None

class OutreachRequest(BaseModel):
    candidate_ids: List[int]
    job_posting_id: int



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer)
) -> dict:
    token = credentials.credentials

    if redis_client.get(f"blacklist:{token}"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been invalidated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload missing user_id"
            )
        role = payload.get("role")
        return {"user_id": user_id, "role": role}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired"
        )
        
RATE_LIMIT = 5      
RATE_WINDOW = 60 

def check_rate_limit(user_id: int):
    key = f"rate:{user_id}"
    count = redis_client.get(key)
    if count and int(count) >= RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT} requests per {RATE_WINDOW} seconds"
        )
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, RATE_WINDOW)
    pipe.execute()


@app.post("/search_candidates")
async def search_candidates(request: SearchRequest, user: dict = Depends(get_current_user)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR can search candidates")
    check_rate_limit(user["user_id"])    
    try:
        collection_name = os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006")

        print(f"searching for: {request.query}")
        response= client.embeddings.create(
            model = "text-embedding-ada-002",
            input= request.query
        )  

        query_vector = response.data[0].embedding

        collection = Collection(collection_name)
        collection.load()

        results = collection.search(
            data = [query_vector],
            anns_field= "embedding",
            param={
                "metric_type":"COSINE",
                "params":{"nprobe":10}
            },
            # limit = request.limit,
            limit = 20,
            expr= "is_active == 1",
            output_fields=["user_id", "name", "email", "phone", "summary"]
        )
        
        candidates = []
        for hits in results:
            for hit in hits:
                candidates.append({
                    "user_id": hit.entity.get("user_id"),
                    "name": hit.entity.get("name"),
                    "email": hit.entity.get("email"),
                    "phone": hit.entity.get("phone"),
                    "summary": hit.entity.get("summary"),
                    "cosine_score": round(hit.score, 4)
                })
        
        summaries = [c["summary"] for c in candidates]
        pairs = [[request.query, summary] for summary in summaries]
        reranker_scores = reranker.predict(pairs)
        
        candidates_with_scores = [
            {
                **candidate,
                "reranker_score": float(reranker_scores[i])
            }
            for i, candidate in enumerate(candidates)
        ]
        
        candidates_with_scores.sort(key=lambda x: x["reranker_score"], reverse=True)
        top_5 = candidates_with_scores[:5]
        
        return {
            "status": "success",
            "query": request.query,
            "total": len(top_5),
            "candidates": top_5
        }
    except Exception:
        return {"status":"error", "reason":"Search failed"}    


      
@app.get("/get_candidate/{user_id}")
async def get_candidate(user_id: int, user: dict = Depends(get_current_user)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR can view candidates")
    
    if not isinstance(user_id, int) or user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    
    try:
        collection_name = os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006")
        
        collection = Collection(collection_name)
        collection.load()


        results = collection.query(
            expr=f"user_id == {user_id}",
            output_fields=["user_id", "name", "email", "phone", "summary", "full_resume_text"]
        )

        if not results:
            return {"status": "not_found", "user_id": user_id}

        return {
            "status": "success",
            "user_id": user_id,
            "name": results[0]["name"],
            "email": results[0]["email"],
            "phone": results[0]["phone"],
            "summary": results[0]["summary"],
            "full_resume_text": results[0]["full_resume_text"]
        }

    except Exception:
        return {"status": "error", "reason": "Candidate retrieval failed"}

@app.get("/my_resume")
async def get_my_resume(user: dict = Depends(get_current_user)):
    if user["role"] != "candidate":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can view their own resume")
    
    user_id = user['user_id']
    if not isinstance(user_id, int) or user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user_id in token")
    
    try:
        collection_name = os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006")
        
        collection = Collection(collection_name)
        collection.load()

        results = collection.query(
            expr=f"user_id == {user['user_id']}",
            output_fields=["user_id", "name", "email", "phone", "summary", "full_resume_text"]
        )

        if not results:
            return {"status": "not_found", "user_id": user["user_id"]}

        return {
            "status": "success",
            "user_id": user["user_id"],
            "name": results[0]["name"],
            "email": results[0]["email"],
            "phone": results[0]["phone"],
            "summary": results[0]["summary"],
            "full_resume_text": results[0]["full_resume_text"]
        }

    except Exception:
        return {"status": "error", "reason": "Resume retrieval failed"}

@app.post("/job_postings")
def create_job_posting(payload: JobPostingCreate, user: dict= Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "hr":
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail = "Only HR can create job postings")
    posting = JobPosting(
        hr_id=user["user_id"],
        company_name=payload.company_name,
        role_title=payload.role_title,
        department=payload.department,
        description=payload.description,
        location=payload.location,
        salary_range=payload.salary_range,
        apply_link=payload.apply_link,
    )


    db.add(posting)
    db.commit()
    db.refresh(posting)

    return {
        "status": "success",
        "job_posting_id": posting.id
    }

@app.post("/get_job_postings")
def get_job_postings(user: dict= Depends(get_current_user), db: Session = Depends(get_db)):    
    user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user["user_id"]).first()
    table_prefs = user_prefs.table_preferences.get("job_postings") if user_prefs else {}
    sort_by = table_prefs.get("sort_by", "created_at")
    sort_direction = table_prefs.get("sort_direction", "desc")
    filters = table_prefs.get("filters", {})
    items_per_page = table_prefs.get("items_per_page", 10)
    current_page = table_prefs.get("current_page", 1)
    if user["role"] == "hr":
        query = db.query(JobPosting).filter(JobPosting.hr_id == user["user_id"])
    elif user["role"] == "candidate":
        query = db.query(JobPosting).filter(JobPosting.is_active == True)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to view jobs")
    if filters.get("is_active") is not None:
        query = query.filter(JobPosting.is_active == filters["is_active"])
    if filters.get("location"):
        query = query.filter(JobPosting.location == filters["location"])
    
    sort_map = {
        "created_at": JobPosting.created_at,
        "company_name": JobPosting.company_name,
        "role_title": JobPosting.role_title,
        "location": JobPosting.location,
        "salary_range": JobPosting.salary_range,
        "is_active": JobPosting.is_active
    }
    
    column = sort_map.get(sort_by)
    if column is not None:
        query = query.order_by(column.desc() if sort_direction == "desc" else column.asc())
    
    total = query.count()
    offset = (current_page - 1) * items_per_page
    job_postings = query.offset(offset).limit(items_per_page).all()
    return {
            "status": "success",
            "job_postings": [
                {
                    "id": job_posting.id,
                    "company_name": job_posting.company_name,
                    "role_title": job_posting.role_title,
                    "department": job_posting.department,
                    "description": job_posting.description,
                    "location": job_posting.location,
                    "salary_range": job_posting.salary_range,
                    "apply_link": job_posting.apply_link,
                    "is_active": job_posting.is_active,
                    "created_at": job_posting.created_at
                }
            for job_posting in job_postings
        ],
        "total": total,
        "page": current_page,
        "pages": (total + items_per_page - 1) // items_per_page
    }

@app.get("/job_postings/{job_id}")
def get_job_posting(job_id: int , user: dict= Depends(get_current_user), db: Session = Depends(get_db)):
    posting = db.query(JobPosting).filter(JobPosting.id==job_id).first()
    if not posting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")
    return {
        "status": "success",
        "id": posting.id,
        "company_name": posting.company_name,
        "role_title": posting.role_title,
        "department": posting.department,
        "description": posting.description,
        "location": posting.location,
        "salary_range": posting.salary_range,
        "apply_link": posting.apply_link,
        "is_active": posting.is_active,
        "created_at": posting.created_at,
    }


@app.get("/my_applications")
def get_my_applications(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "candidate":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can view their applications")
    user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user["user_id"]).first()
    table_prefs = user_prefs.table_preferences.get("my_applications") if user_prefs else {}
    sort_by = table_prefs.get("sort_by", "sent_at")
    sort_direction = table_prefs.get("sort_direction", "desc")
    items_per_page = table_prefs.get("items_per_page", 10)
    current_page = table_prefs.get("current_page", 1)
    query = db.query(OutreachEmail).filter(OutreachEmail.candidate_user_id == user["user_id"])
    if sort_by == "sent_at":
        query = query.order_by(OutreachEmail.sent_at.desc() if sort_direction == "desc" else OutreachEmail.sent_at.asc())
    total = query.count()
    offset = (current_page - 1) * items_per_page
    outreach_records = query.offset(offset).limit(items_per_page).all()
    applications = []
    for record in outreach_records:
        job = db.query(JobPosting).filter(JobPosting.id == record.job_posting_id).first()
        if job:
            hr_user = db.query(User).filter(User.id == job.hr_id).first()
            applications.append({
                "id": record.id,
                "job_posting_id": job.id,
                "company_name": job.company_name,
                "role_title": job.role_title,
                "department": job.department,
                "location": job.location,
                "salary_range": job.salary_range,
                "apply_link": job.apply_link,
                "description": job.description[:200] + "..." if len(job.description) > 200 else job.description,
                "contacted_at": record.sent_at,
                "opened_at": record.opened_at,
                "hr_email": hr_user.email if hr_user else None,
                "hr_name": hr_user.name if hr_user else None
            })
    return {
        "status": "success",
        "total": total,
        "page": current_page,
        "pages": (total + items_per_page - 1) // items_per_page,
        "applications": applications
    }



#save candidates

@app.post("/save_candidates")
def save_candidates(payload: SaveCandidateRequest, user: dict= Depends(get_current_user), db: Session= Depends(get_db)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail= "only hr can save candidates")

    existing = db.query(SavedCandidate).filter(SavedCandidate.hr_id==user["user_id"], SavedCandidate.candidate_user_id == payload.candidate_user_id
    ).first()
    if existing:
        return {"status": "already_saved", "id": existing.id}
    saved = SavedCandidate(
        hr_id=user["user_id"],
        candidate_user_id=payload.candidate_user_id,
        job_posting_id=payload.job_posting_id,
        note=payload.note,
        status="pending"
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return {"status": "success", "id": saved.id}



@app.get("/saved_candidates")
def get_saved_candidates(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR can view saved candidates")
    user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user["user_id"]).first()
    table_prefs = user_prefs.table_preferences.get("saved_candidates") if user_prefs else {}
    sort_by = table_prefs.get("sort_by", "saved_at")
    sort_direction = table_prefs.get("sort_direction", "desc")
    filters = table_prefs.get("filters", {})
    items_per_page = table_prefs.get("items_per_page", 10)
    current_page = table_prefs.get("current_page", 1)
    query = db.query(SavedCandidate).filter(SavedCandidate.hr_id == user["user_id"])
    
    needs_user_join = sort_by in ["candidate_name", "email", "location", "notice_period"] or filters.get("location")
    if needs_user_join:
        query = query.join(User, SavedCandidate.candidate_user_id == User.id)
    
    if filters.get("status"):
        query = query.filter(SavedCandidate.status == filters["status"])
    if filters.get("location"):
        query = query.filter(User.location == filters["location"])
    
    sort_map = {
        "saved_at": SavedCandidate.saved_at,
        "candidate_name": User.name,
        "email": User.email,
        "location": User.location,
        "notice_period": User.notice_period,
        "status": SavedCandidate.status
    }
    
    column = sort_map.get(sort_by)
    if column is not None:
        query = query.order_by(column.desc() if sort_direction == "desc" else column.asc())
    
    total = query.count()
    offset = (current_page - 1) * items_per_page
    saved = query.offset(offset).limit(items_per_page).all()
    result = []
    for s in saved:
        candidate = db.query(User).filter(User.id == s.candidate_user_id).first()
        job_posting = None
        if s.job_posting_id:
            job_posting = db.query(JobPosting).filter(JobPosting.id == s.job_posting_id).first()
        
        result.append({
            "id": s.id,
            "candidate_user_id": s.candidate_user_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else None,
            "candidate_phone": candidate.phone if candidate else None,
            "candidate_location": candidate.location if candidate else None,
            "candidate_notice_period": candidate.notice_period if candidate else None,
            "job_posting_id": s.job_posting_id,
            "job_title": job_posting.role_title if job_posting else None,
            "company_name": job_posting.company_name if job_posting else None,
            "note": s.note,
            "status": s.status,
            "saved_at": s.saved_at,
        })
    
    return {
        "status": "success",
        "candidates": result,
        "total": total,
        "page": current_page,
        "pages": (total + items_per_page - 1) // items_per_page
    }

#outreach emails


def send_outreach_email(to_email: str, to_name: str, job: JobPosting, hr_name: str):
    body = f"""Hi {to_name},

We came across your profile and kept it on file — your background stood out to us.

We have just opened a {job.role_title} position at {job.company_name} and immediately thought of you.

Role     : {job.role_title}
Company  : {job.company_name}
Location : {job.location or "Not specified"}
{"Salary  : " + job.salary_range if job.salary_range else ""}

{job.description[:300]}...

View the full posting and express your interest here:
{job.apply_link or "Link coming soon"}

This is a personal note — we are reaching out to a small number of candidates we specifically saved.

{hr_name}
{job.company_name}
"""
    
    resend.api_key = os.getenv("RESEND_API_KEY")
    params = {
        "from": "noreply@kanugulabharathkumar.me",
        "to": [to_email],
        "subject": f"{job.company_name} — {job.role_title} opening we think you'd be great for",
        "text": body,
    }
    resend.Emails.send(params)
    
    # SMTP (commented out - DigitalOcean blocks SMTP ports)
    # msg = MIMEMultipart("alternative")
    # msg["Subject"] = f"{job.company_name} — {job.role_title} opening we think you'd be great for"
    # msg["From"] = os.getenv("SMTP_FROM")
    # msg["To"] = to_email
    # msg.attach(MIMEText(body, "plain"))
    # with smtplib.SMTP_SSL(os.getenv("SMTP_HOST"), 465) as server:
    #     server.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS"))
    #     server.sendmail(os.getenv("SMTP_FROM"), to_email, msg.as_string())


@app.post("/send_outreach")
def send_outreach(payload: OutreachRequest, user: dict= Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR can send outreach")
    job = db.query(JobPosting).filter(JobPosting.id == payload.job_posting_id).first()
    if not job:
        raise HTTPException(status_code = 404, detail = "Job posting not found")
    hr_user= db.query(User).filter(User.id == user["user_id"]).first()
    hr_name = hr_user.email

    results = {"sent": [], "failed": [], "skipped": []}

    collection = Collection(os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006"))
    collection.load()

    for candidate_id in payload.candidate_ids:

        already = db.query(OutreachEmail).filter(
            OutreachEmail.job_posting_id == payload.job_posting_id,
            OutreachEmail.candidate_user_id == candidate_id
        ).first()

        if already:
            results["skipped"].append(candidate_id)
            continue

        # milvus_result = collection.query(
        #     expr = f"user_id == {candidate_id}",
        #     output_fields = ["name", "email"]

        # )    
        # if not milvus_result:
        #     results["failed"].append(candidate_id)
        #     continue

        # to_name = milvus_result[0]["name"]
        # to_email = milvus_result[0]["email"]   

        candidate = db.query(User).filter(User.id == candidate_id).first()
        if not candidate:
            results["failed"].append(candidate_id)
            continue
        to_name = candidate.name or candidate.email
        to_email = candidate.email 


        try:
            send_outreach_email(to_email, to_name, job, hr_name)
            record = OutreachEmail(
                job_posting_id=payload.job_posting_id,
                candidate_user_id=candidate_id,
                status="sent",
                sent_at=datetime.utcnow()
            )
            db.add(record)       

            saved = db.query(SavedCandidate).filter(
                SavedCandidate.hr_id == user["user_id"],
                SavedCandidate.candidate_user_id == candidate_id
            ).first()

            if saved:
                saved.status = "emailed"
            db.commit()
            results["sent"].append(candidate_id)
        except Exception as e:
            print("❌ EMAIL ERROR:", str(e))
            results["failed"].append(candidate_id)
            record = OutreachEmail(
                job_posting_id=payload.job_posting_id,
                candidate_user_id=candidate_id,
                status="failed",
                sent_at=datetime.utcnow()
            )
            db.add(record)
            db.commit()
            results["failed"].append(candidate_id)    
    
    return {"status": "done", "results": results}


@app.get("/outreach_status/{job_posting_id}")
def outreach_status(job_posting_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR can view outreach status")
    records = db.query(OutreachEmail).filter(OutreachEmail.job_posting_id == job_posting_id).all()
    return {
        "status": "success",
        "job_posting_id": job_posting_id,
        "total": len(records),
        "outreach": [
            {
                "candidate_user_id": r.candidate_user_id,
                "status": r.status,
                "sent_at": r.sent_at,
                "opened_at": r.opened_at,
            }
            for r in records
        ]
    }        
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port=3001)
        


