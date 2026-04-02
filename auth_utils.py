from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes = ["bcrypt"], deprecated="auto" )

SECRET_KEY= "Km3rf[]][olwf[wefklknjbg/,mdfnn,mfgkknslgdgnlknlksfnsf\];;;sd;lfmassld;lsdndfskdfsfn3p423424jeg]]"
ALGORITHM ="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 330
REFRESH_TOKEN_EXPIRE_DAYS=7

def hash_password(password: str):
    return pwd_context.hash(password.encode("utf-8")[:72]) 

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password.encode("utf-8")[:72], hashed_password)
    
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