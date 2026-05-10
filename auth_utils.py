from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import os
import smtplib
import secrets
import hashlib
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

pwd_context = CryptContext(schemes = ["bcrypt"], deprecated="auto" )

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
    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    return pwd_context.hash(password_hash)

def verify_password(plain_password: str, hashed_password: str):
    password_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    return pwd_context.verify(password_hash, hashed_password)
    
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
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    sender_email = os.getenv("SMTP_USER")
    sender_password = os.getenv("SMTP_PASS") 
    from_email = os.getenv("SMTP_FROM", sender_email)

    if not sender_email or not sender_password:
        print("ERROR: Gmail credentials missing from .env")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = "Resume AI - Your Verification Code"
    message["From"] = from_email
    message["To"] = receiver_email  

    text = f"""
    Hello,
    
    Your verification code for Resume AI is: {otp}
    
    This code will expire in 10 minutes. Please do not share it with anyone.
    """
    
    message.attach(MIMEText(text, "plain"))

    try:
        server = smtplib.SMTP(smtp_host, 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, receiver_email, message.as_string())
        
        print(f"SUCCESS: OTP sent to {receiver_email}")
        
    except Exception as e:
        print(f"FAILED to send email: {str(e)}")
        
    finally:
        try:
            server.quit()
        except:
            pass


