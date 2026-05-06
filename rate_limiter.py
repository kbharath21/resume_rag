from functools import wraps
from fastapi import HTTPException, Request
from redis_client import redis_client


def rate_limit(max_requests: int, window_seconds: int):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                request = kwargs.get('request')
            
            if not request:
                return await func(*args, **kwargs)
            
            client_ip = request.client.host
            endpoint = func.__name__
            key = f"rate_limit:{endpoint}:{client_ip}"
            count = redis_client.get(key)
            
            if count and int(count) >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Please try again in {window_seconds} seconds."
                )
            
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            pipe.execute()
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def rate_limit_by_email(max_requests: int, window_seconds: int, email_field: str = "email"):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            email = None
            for arg in args:
                if hasattr(arg, email_field):
                    email = getattr(arg, email_field)
                    break
            
            if not email:
                for key, value in kwargs.items():
                    if hasattr(value, email_field):
                        email = getattr(value, email_field)
                        break
            
            if not email:
                return await func(*args, **kwargs)
            
            endpoint = func.__name__
            key = f"rate_limit:{endpoint}:{email}"
            count = redis_client.get(key)
            
            if count and int(count) >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many attempts for this email. Please try again in {window_seconds} seconds."
                )
            
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            pipe.execute()
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator
