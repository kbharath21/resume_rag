import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
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

http_bearer = HTTPBearer()
load_dotenv()
print("SECRET_KEY loaded:", os.getenv("SECRET_KEY"))
print("ALGORITHM loaded:", os.getenv("ALGORITHM"))
main.initialize_connections()

app= FastAPI()
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
    key = f"rate: {user_id}"
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
            limit = request.limit,
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
                    "score": round(hit.score, 4)
                })
                print(f"Found {len(candidates)} candidates")
        return {
            "status": "success",
            "query": request.query,
            "total": len(candidates),
            "candidates": candidates
        }
    except Exception as e:
        return {"status":"error", "reason":str(e)}    


      
@app.get("/get_candidate/{user_id}")
async def get_candidate(user_id: int, user: dict = Depends(get_current_user)):
    if user["role"] != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR can view candidates")
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

    except Exception as e:
        return {"status": "error", "reason": str(e)}

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
    if user["role"] != "hr":
        raise HTTPException(status= status.HTTP_403_FORBIDDEN, detail= "Only HR can get job postings")
    job_postings= db.query(JobPosting).filter(JobPosting.hr_id ==user["user_id"]).all()

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
        ]
    }

@app.get("/job_postings/{job_id}")
def get_job_posting(job_id: int , user: dict= Depends(get_current_user), db: Session = Depends(get_db)):
    posting = db.query(JobPosting).filter(JobPosting.id==job_id).first()
    if not posting:
        raise HTTPException(status = status.HTTP_404_NOT_FOUND, detail = "Job posting not found")
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

#save candidates



#outreach emails


    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port=3001)
        


