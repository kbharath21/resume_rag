from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from models import UserRole
from datetime import datetime
from database import get_db
from models import User, UserRole, RefreshToken, UserPreferences
from enum import Enum  
from redis_client import redis_client
from rate_limiter import rate_limit_by_email
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM, set_user_otp, send_otp_email, validate_password_strength, verify_otp
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from enum import Enum

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    role: UserRole = UserRole.candidate

class VerifyOTPRequest(BaseModel):  
    email: EmailStr
    code: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://127.0.0.1:4000", "https://resume-rag-xyxs.vercel.app"], 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],  
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Length"],
    max_age=600,  
)

class UpdateProfileRequest(BaseModel):
    name: str
    phone: str
    notice_period: str | None = None  # New field
    location: str | None = None  # New field
    current_password: str | None = None
    new_password: str | None = None

class TableName(str, Enum):
    search_results = "search_results"
    saved_candidates = "saved_candidates"
    job_postings = "job_postings"
    my_applications = "my_applications"

class SortDirection(str, Enum):
    asc = "asc"
    desc = "desc"

class UpdateTablePreferenceRequest(BaseModel):
    table: TableName
    sort_by: str
    sort_direction: SortDirection
    filters: dict
    items_per_page: int
    current_page: int

class UpdateGlobalPreferenceRequest(BaseModel):
    theme: str | None = None
    date_format: str | None = None
    timezone: str | None = None


http_bearer = HTTPBearer()

# Test endpoint to verify CORS
@app.get("/")
def root():
    return {"message": "Auth API is running", "cors": "enabled"}

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer)
) -> dict:
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


@app.post("/register")
@rate_limit_by_email(max_requests=3, window_seconds=3600)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    is_valid, message = validate_password_strength(payload.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    hashed_password = hash_password(payload.password)

    new_user = User(
        email=payload.email,
        password=hashed_password,
        role=payload.role,
        name=payload.name,
        phone=payload.phone,
        is_verified=False
    )

    db.add(new_user)
    otp = set_user_otp(new_user, db) 
    send_otp_email(new_user.email, otp)
    # db.commit()
    # db.refresh(new_user)

    return {
        "status": "verification_required", 
        "message": "User registered. Check your inbox for the verification code."
    }

@app.post("/verify-account")
@rate_limit_by_email(max_requests=5, window_seconds=300)
def verify_account(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_otp(user.otp_code, payload.code, user.otp_expires_at):
        raise HTTPException(status_code=401, detail="Invalid or expired code")
    
    user.is_verified = True
    user.otp_code = None 

    user_preferences = UserPreferences(user_id=user.id)
    db.add(user_preferences)

    db.commit()
    
    return {"status": "success", "message": "Account verified. You may now login."}

@app.post("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "role": user["role"]}

@app.get("/profile")
def get_profile(user: dict= Depends(get_current_user), db: Session= Depends(get_db)):
    db_user= db.query(User).filter(User.id == user["user_id"]).first()
    if not db_user:
        raise HTTPException(status_code = 404, detail="user not found")

    return {
        "user_id": db_user.id,
        "email": db_user.email,
        "name": db_user.name,
        "phone": db_user.phone,
        "role": db_user.role,
        "is_verified": db_user.is_verified,
        "notice_period": db_user.notice_period,
        "location": db_user.location
    }

@app.put("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user["user_id"]).first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.name  = payload.name
    db_user.phone = payload.phone
    
    # Update new fields
    if payload.notice_period:
        db_user.notice_period = payload.notice_period
    if payload.location:
        db_user.location = payload.location

    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="Current password is required to change password")
        
        if not verify_password(payload.current_password, db_user.password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        is_valid, message = validate_password_strength(payload.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)
        
        db_user.password = hash_password(payload.new_password)
    
    db.commit()
    db.refresh(db_user)

    return {
        "message": "Profile updated successfully",
        "user": {
            "user_id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "phone": db_user.phone,
            "role": db_user.role,
            "notice_period": db_user.notice_period,
            "location": db_user.location
        }
    }


@app.post("/logout")
def logout(refresh_token: str, credentials: HTTPAuthorizationCredentials = Depends(http_bearer), db: Session = Depends(get_db)):
    access_token = credentials.credentials
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = payload.get("exp")
        current_time = int(datetime.utcnow().timestamp())
        ttl = exp - current_time
        if ttl > 0:
            redis_client.setex(f"blacklist:{access_token}", ttl, "blacklisted")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.is_revoked == False
    ).first()

    if db_token:
        db_token.is_revoked = True
        db.commit()

    return {"message": "Logged out successfully"}

@app.post("/login")
@rate_limit_by_email(max_requests=5, window_seconds=300)
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.email).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid Credentials")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not verified. Please verify your email first.")

    otp = set_user_otp(user, db)
    send_otp_email(user.email, otp)
    
    return {
        "status": "2fa_required", 
        "email": user.email,
        "message": "2FA code sent to your registered email."
    }

@app.post("/verify-2fa-login")
@rate_limit_by_email(max_requests=5, window_seconds=300)
def verify_2fa_login(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_otp(user.otp_code, payload.code, user.otp_expires_at):
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA code")

    user.otp_code = None
    
    access_token = create_access_token({"user_id": user.id, "role": user.role})
    family_id = str(uuid.uuid4())
    refresh_token = create_refresh_token({"user_id": user.id, "role": user.role, "family_id": family_id})

    db_refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=7),
        family_id=family_id
    )

    db.add(db_refresh_token)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@app.post("/refresh")
def refresh(refresh_token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("user_id")
        role = payload.get("role")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.is_revoked == False
    ).first()

    if not db_token:
        family_id_from_payload = payload.get("family_id")
        if family_id_from_payload:
            family_tokens = db.query(RefreshToken).filter(
                RefreshToken.family_id == family_id_from_payload
            ).all()
            for t in family_tokens:
                t.is_revoked = True
            db.commit()
        raise HTTPException(status_code=401, detail="Token reuse detected - all sessions revoked")

    db_token.is_revoked = True
    db.commit()

    new_access_token = create_access_token({"user_id": user_id, "role": role})
    new_refresh_token = create_refresh_token({"user_id": user_id, "role": role, "family_id": db_token.family_id})

    new_db_token = RefreshToken(
        user_id=user_id,
        token=new_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=7),
        family_id=db_token.family_id
    )
    db.add(new_db_token)
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

#refresh

@app.get("/preferences")
def get_preferences(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_pref = db.query(UserPreferences).filter_by(user_id=user["user_id"]).first()
        
    if not user_pref:
        # Auto-create preferences if they don't exist (for existing users)
        user_pref = UserPreferences(user_id=user["user_id"])
        db.add(user_pref)
        db.commit()
        db.refresh(user_pref)
    
    return user_pref

@app.patch("/preferences/table")
def update_table_preferences(
    payload: UpdateTablePreferenceRequest,
    user: dict = Depends(get_current_user),
    db: Session= Depends(get_db)
):
    pref = db.query(UserPreferences).filter(UserPreferences.user_id == user["user_id"]).first()

    if not pref:
        # Auto-create preferences if they don't exist (for existing users)
        pref = UserPreferences(user_id=user["user_id"])
        db.add(pref)
        db.commit()
        db.refresh(pref)

    table_prefs  = pref.table_preferences.copy()
    table_prefs[payload.table] = {
        "sort_by": payload.sort_by,
        "sort_direction": payload.sort_direction,
        "filters": payload.filters,
        "items_per_page": payload.items_per_page,
        "current_page": payload.current_page
    }

    pref.table_preferences = table_prefs
    db.commit()
    db.refresh(pref)

    return {
        "message": f"Preferences updated for {payload.table}",
        "table_preferences": pref.table_preferences[payload.table]
    }

@app.patch("/preferences/global")
def update_global_preferences(
    payload: UpdateGlobalPreferenceRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreferences).filter(UserPreferences.user_id == user["user_id"]).first()

    if not pref:
        # Auto-create preferences if they don't exist (for existing users)
        pref = UserPreferences(user_id=user["user_id"])
        db.add(pref)
        db.commit()
        db.refresh(pref)

    if payload.theme is not None:
        pref.theme = payload.theme
    if payload.date_format is not None:
        pref.date_format = payload.date_format
    if payload.timezone is not None:
        pref.timezone = payload.timezone

    db.commit()
    db.refresh(pref)

    return {
        "message": "Global preferences updated",
        "theme": pref.theme,
        "date_format": pref.date_format,
        "timezone": pref.timezone
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
