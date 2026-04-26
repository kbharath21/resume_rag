from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests, os
from pymilvus import connections, Collection
from jose import jwt, JWTError
from models import User
from redis_client import redis_client
import resume_processesors
from openai import OpenAI
from dotenv import load_dotenv
import r
from urllib.parse import urlparse
import main
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sqlalchemy.orm import Session
from database import get_db
load_dotenv()
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN", ""),
    integrations=[
        StarletteIntegration(),
        FastApiIntegration(),
    ],
    traces_sample_rate=1.0,
)

main.initialize_connections()

class ShadowToggle(BaseModel):
    enable_shadow: bool

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
http_bearer = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> dict:
    token = credentials.credentials
    if redis_client.get(f"blacklist:{token}"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been invalidated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        role = payload.get("role")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"user_id": user_id, "role": role}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

app = FastAPI()

# Add CORS middleware to allow frontend on port 4000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://127.0.0.1:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ResumeInput(BaseModel):
    name: str
    email: str
    phone: str
    resume_url: str

class DeleteRequest(BaseModel):
    id: int

class ResumeUpdateInput(BaseModel):
    resume_url: str

@app.post("/ingest_resume")
async def ingest_resume(payload: ResumeInput, user: dict = Depends(get_current_user)):
    if user["role"] != "candidate":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can upload resumes")

    INVALID_RESUMES_LOG_PATH = os.getenv("INVALID_RESUMES_LOG_PATH", "invalid_resumes_log.txt")
    INVALID_CONTENT_MARKER = os.getenv("INVALID_CONTENT_MARKER", "Invalid.")
    INSUFFICIENT_RESUME_MESSAGE = "The provided text does not contain sufficient resume information to generate a resume summary."

    user_id = user["user_id"]

    if not payload.resume_url:
        return {"status": "error", "reason": "Missing resume URL"}

    try:
        parsed = urlparse(payload.resume_url)
        if not all([parsed.scheme, parsed.netloc]):
            return {"status": "error", "reason": "Invalid URL format"}
    except Exception:
        return {"status": "error", "reason": "Invalid URL format"}

    try:
        is_success, extracted, raw_text = await resume_processesors.process_resume_with_ocr_fallback(payload.resume_url)
        print("primary extraction success:", is_success)

        use_ocr = False

        if not is_success:
            use_ocr = True
        elif extracted and INVALID_CONTENT_MARKER in extracted:
            use_ocr = True
        elif not extracted or INSUFFICIENT_RESUME_MESSAGE in extracted.strip():
            use_ocr = True

        if use_ocr:
            print("Switching to OCR fallback")
            try:
                ocr_success, ocr_extracted, ocr_raw = await r.process_resume_from_url(payload.resume_url)
                print("ocr success:", ocr_success)

                ocr_valid = (
                    ocr_success and
                    ocr_extracted and
                    INVALID_CONTENT_MARKER not in ocr_extracted and
                    INSUFFICIENT_RESUME_MESSAGE not in ocr_extracted.strip()
                )

                if ocr_valid:
                    extracted = ocr_extracted
                    raw_text = ocr_raw
                    is_success = True
                else:
                    try:
                        with open(INVALID_RESUMES_LOG_PATH, "a", encoding="utf-8") as f:
                            f.write(f"user_id={user_id} url={payload.resume_url}\n")
                    except Exception:
                        pass
                    return {"status": "skipped", "reason": "Both extractors failed"}

            except Exception:
                try:
                    with open(INVALID_RESUMES_LOG_PATH, "a", encoding="utf-8") as f:
                        f.write(f"user_id={user_id} url={payload.resume_url}\n")
                except Exception:
                    pass
                return {"status": "skipped", "reason": "OCR fallback failed"}

        if is_success and extracted:
            try:
                await resume_processesors.store_into_milvus(
                    summary=extracted,
                    full_resume_text=raw_text,
                    user_id=user_id,
                    name=payload.name,
                    email=payload.email,
                    phone=payload.phone,
                )
                return {"status": "success", "user_id": user_id}

            except Exception as e:
                return {"status": "error", "reason": f"Storage failed: {str(e)}"}
        else:
            try:
                with open(INVALID_RESUMES_LOG_PATH, "a", encoding="utf-8") as f:
                    f.write(f"user_id={user_id} url={payload.resume_url}\n")
            except Exception:
                pass
            return {"status": "failed", "user_id": user_id}

    except Exception as e:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("user_id", user_id)
            scope.set_extra("resume_url", payload.resume_url)
            sentry_sdk.capture_exception(e)
        return {"status": "error", "reason": str(e)}


@app.post("/ingest_resume_file")
async def ingest_resume_file(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    if user["role"] != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can upload resumes")

    user_id = user["user_id"]

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        return {"status": "error", "reason": "Empty file"}

    if len(file_bytes) > 5 * 1024 * 1024:
        return {"status": "error", "reason": "File too large. Max 5MB"}

    INVALID_RESUMES_LOG_PATH = os.getenv("INVALID_RESUMES_LOG_PATH", "invalid_resumes_log.txt")
    INVALID_CONTENT_MARKER = os.getenv("INVALID_CONTENT_MARKER", "Invalid.")
    INSUFFICIENT_RESUME_MESSAGE = "The provided text does not contain sufficient resume information to generate a resume summary."

    try:
        is_success, extracted, raw_text = await resume_processesors.process_resume_from_bytes(file_bytes)

        if not is_success or not extracted or INVALID_CONTENT_MARKER in extracted or INSUFFICIENT_RESUME_MESSAGE in extracted.strip():
            try:
                with open(INVALID_RESUMES_LOG_PATH, "a", encoding="utf-8") as f:
                    f.write(f"user_id={user_id} filename={file.filename}\n")
            except Exception:
                pass

            return {"status": "skipped", "reason": "Could not extract resume information"}

        await resume_processesors.store_into_milvus(
            summary=extracted,
            full_resume_text=raw_text,
            user_id=user_id,
            name=name,
            email=email,
            phone=phone,
        )

        return {"status": "success", "user_id": user_id}

    except Exception as e:
        return {"status": "error", "reason": str(e)}

@app.post("/delete_resume")
async def delete_resume(item: DeleteRequest, user: dict = Depends(get_current_user)):
    if user["role"] != "candidate":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can delete resumes")
    try:
        collection = Collection(os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006"))
        collection.load()

        results = collection.query(
            expr=f"id == {item.id}",
            output_fields=["id"]
        )

        if not results:
            return {"status": "not_found", "message": f"No entry found with id {item.id}"}

        collection.delete(expr=f"id == {item.id}")
        return {"status": "success", "message": f"Deleted record with id {item.id}"}

    except Exception as e:
        return {"status": "error", "reason": str(e)}


@app.post("/update_resume")
async def update_resume(item: ResumeUpdateInput, user: dict = Depends(get_current_user)):
    if user["role"] != "candidate":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can update resumes")
    body = {
        "resume_url": item.resume_url,
        "name": "",
        "email": "",
        "phone": ""
    }
    api_url = "http://127.0.0.1:3000/ingest_resume"
    response = requests.post(api_url, json=body)
    print(f"update_resume response: {response.status_code} {response.text}")

@app.post("/shadow_mode")
async def toggle_shadow(payload: ShadowToggle, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] != "candidate":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can toggle shadow mode")

    db_user= db.query(User).filter(User.id == user["user_id"]).first()
    db_user.is_shadow = payload.enable_shadow
    db.commit()

    collection = Collection(os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006"))
    collection.load()

    existing = collection.query(
        expr=f"user_id == {user['user_id']}",
        output_fields=["user_id", "name", "email", "phone", "embedding", "full_resume_text", "summary"]
    )

    if not existing:
        return {"status": "success", "shadow_mode": payload.enable_shadow, "note": "No resume found in Milvus"}

    record = existing[0]

    collection.delete(expr=f"user_id == {user['user_id']}")
    collection.flush()

    is_active = 0 if payload.enable_shadow else 1

    data = [
        [record["user_id"]],
        [record["name"]],
        [record["email"]],
        [record["phone"]],
        [record["embedding"]],
        [record["full_resume_text"]],
        [record["summary"]],
        [is_active],
    ]

    collection.insert(data)
    collection.flush()

    return {
        "status": "success",
        "shadow_mode": payload.enable_shadow,
        "is_active": is_active
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port=3000)