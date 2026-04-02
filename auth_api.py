from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from models import UserRole
from datetime import datetime
from database import get_db
from models import User, UserRole, RefreshToken
from redis_client import redis_client
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel

class LoginRequest(BaseModel):
    email: str
    password: str

app = FastAPI()
http_bearer = HTTPBearer()

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
def register(email: str, password: str, role: UserRole = UserRole.candidate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == email ).first()

    if existing_user:
        raise HTTPException(status_code=400,detail = "user already exists")

    hashed_password = hash_password(password)
    
    new_user= User(
    email = email,
       password = hashed_password,
       role = role
    )    


    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return ({"message":"User Registered"})

@app.post("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "role": user["role"]}

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
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.email).first()
    if not user:
        raise HTTPException(status_code=400, detail = "Invalid Credentials")

    if not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail = "Invalid CREDS")

    access_token= create_access_token({"user_id":user.id, "role":user.role})
    family_id= str(uuid.uuid4())
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


    