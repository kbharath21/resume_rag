from jose import jwt
from datetime import datetime, timedelta
import os
import secrets
import hashlib
import re
import bcrypt
import resend

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is not set. Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\"")

ALGORITHM ="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 330
REFRESH_TOKEN_EXPIRE_DAYS=7

def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least 1 uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least 1 lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least 1 number"
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least 1 special character"
    
    common_passwords = ["password", "12345678", "qwerty", "abc123", "password123"]
    if password.lower() in common_passwords:
        return False, "Password is too common"
    
    return True, "Password is strong"

def hash_password(password: str):
    password_hash = hashlib.sha256(password.encode('utf-8')).digest()
    return bcrypt.hashpw(password_hash, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str):
    password_hash = hashlib.sha256(plain_password.encode('utf-8')).digest()
    return bcrypt.checkpw(password_hash, hashed_password.encode('utf-8'))
    
def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() +timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})


    return jwt.encode(to_encode, SECRET_KEY, algorithm =  ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"}) 
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def set_user_otp(user, db):
    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    return otp

def verify_otp(stored_otp: str | None, provided_otp: str, expires_at: datetime) -> bool:
    if not stored_otp:
        return False
    if datetime.utcnow() > expires_at:
        return False
    return secrets.compare_digest(stored_otp, provided_otp)

def send_otp_email(receiver_email: str, otp: str):
    resend.api_key = os.getenv("RESEND_API_KEY")
    
    if not resend.api_key:
        print("ERROR: RESEND_API_KEY missing from .env")
        return
    
    try:
        resend.Emails.send({
            "from": "Resume AI <noreply@kanugulabharathkumar.me>",
            "to": receiver_email,
            "subject": "Resume AI - Your Verification Code",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Resume AI Verification</h2>
                <p>Your verification code is:</p>
                <h1 style="background: #f4f4f4; padding: 20px; text-align: center; letter-spacing: 5px;">{otp}</h1>
                <p>This code will expire in 10 minutes.</p>
                <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
            """
        })
        print(f"SUCCESS: OTP sent to {receiver_email}")
    except Exception as e:
        print(f"FAILED to send email: {str(e)}")


