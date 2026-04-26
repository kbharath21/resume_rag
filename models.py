from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean, ForeignKey, Text, UniqueConstraint

class UserRole(str, enum.Enum):
    candidate = "candidate"
    hr = "hr"

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.candidate)
    is_shadow = Column(Boolean, default=False)
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    refresh_tokens = relationship("RefreshToken", back_populates="user") 
    is_verified = Column(Boolean, default=False)
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    
    # Candidate profile fields for HR filtering
    notice_period = Column(String(50), nullable=True)  # "immediate", "1_month", "2_months", "3_months", "negotiable"
    location = Column(String(255), nullable=True)  # City/region



class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    family_id = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="refresh_tokens")

class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    hr_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_name = Column(String(255), nullable=False)
    role_title = Column(String(255), nullable=False)
    department = Column(String(255))
    description = Column(Text, nullable=False)
    location = Column(String(255))
    salary_range = Column(String(100))
    apply_link = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hr = relationship("User", foreign_keys=[hr_id])
    saved_candidates = relationship("SavedCandidate", back_populates="job_posting")
    outreach_emails = relationship("OutreachEmail", back_populates="job_posting")


class SavedCandidate(Base):
    __tablename__ = "saved_candidates"

    id = Column(Integer, primary_key=True, index=True)
    hr_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    candidate_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text)
    status = Column(String(50), default="pending")
    saved_at = Column(DateTime, default=datetime.utcnow)

    hr = relationship("User", foreign_keys=[hr_id])
    candidate = relationship("User", foreign_keys=[candidate_user_id])
    job_posting = relationship("JobPosting", back_populates="saved_candidates")

    __table_args__ = (
        UniqueConstraint("hr_id", "candidate_user_id", name="uq_hr_candidate"),
    )


class OutreachEmail(Base):
    __tablename__ = "outreach_emails"

    id = Column(Integer, primary_key=True, index=True)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    candidate_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="sent")
    opened_at = Column(DateTime, nullable=True)

    job_posting = relationship("JobPosting", back_populates="outreach_emails")
    candidate = relationship("User", foreign_keys=[candidate_user_id])   