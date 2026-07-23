"""
Seed script to generate 300+ meaningful records per table
with proper foreign key relationships for SQL practice
"""

import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import random
import string

# Sample data without faker dependency
first_names = ['Raj', 'Priya', 'Amit', 'Neha', 'Arjun', 'Divya', 'Rohan', 'Ananya', 'Vikram', 'Shreya',
               'Aditya', 'Pooja', 'Nikhil', 'Isha', 'Sanjay', 'Kavya', 'Rahul', 'Anjali', 'Karan', 'Zara']
last_names = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Reddy', 'Nair', 'Iyer', 'Bhat',
              'Desai', 'Joshi', 'Rao', 'Menon', 'Chopra', 'Malhotra', 'Saxena', 'Trivedi', 'Pandey', 'Mishra']
domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'mail.com']
companies = ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant', 'HCL', 'Tech Mahindra', 
             'Razorpay', 'Cred', 'Meesho', 'Flipkart', 'Swiggy', 'Zomato', 'OYO', 'Unacademy']
roles = ['Backend Engineer', 'Frontend Engineer', 'Full Stack Developer', 'Data Scientist', 
         'DevOps Engineer', 'ML Engineer', 'Senior Developer', 'Tech Lead', 'Product Manager']
locations = ['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Pune', 'Chennai', 'Kolkata', 'Remote']

def fake_name():
    return f"{random.choice(first_names)} {random.choice(last_names)}"

def fake_email():
    return f"{random.choice(first_names).lower()}.{random.choice(last_names).lower()}{random.randint(1, 9999)}@{random.choice(domains)}"

def fake_phone():
    return f"+91{random.randint(6000000000, 9999999999)}"

# Database connection
conn = psycopg2.connect(
    host="localhost",
    database="resume_rag",
    user="postgres",
    password="SecurePass2024",
    port="5434"
)
cursor = conn.cursor()

print("🌱 Starting seed data generation...")

# ============================================================================
# 1. USERS TABLE (300 records: 200 candidates + 100 HRs)
# ============================================================================
print("\n📝 Generating USERS (300 records)...")

users_data = []
user_ids = []

# 200 Candidates
for i in range(200):
    user_id = i + 1
    user_ids.append(user_id)
    email = fake_email()
    name = fake_name()
    phone = fake_phone()
    location = random.choice(locations)
    notice_period = random.choice(['immediate', '1_month', '2_months', '3_months', None])
    is_verified = random.choice([True, False])
    
    users_data.append((
        user_id, email, 'hashed_password', datetime.now(), 'candidate',
        False, name, phone, is_verified, None, None, notice_period, location
    ))

# 100 HRs
for i in range(100):
    user_id = 201 + i
    user_ids.append(user_id)
    email = fake_email()
    name = fake_name()
    phone = fake_phone()
    location = random.choice(['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Pune'])
    is_verified = True  # HRs are always verified
    
    users_data.append((
        user_id, email, 'hashed_password', datetime.now(), 'hr',
        False, name, phone, is_verified, None, None, None, location
    ))

insert_query = """
INSERT INTO users (id, email, password, created_at, role, is_shadow, name, phone, is_verified, otp_code, otp_expires_at, notice_period, location)
VALUES %s
"""
execute_values(cursor, insert_query, users_data)
conn.commit()
print(f"✅ Inserted {len(users_data)} users")

# ============================================================================
# 2. JOB_POSTINGS TABLE (300 records)
# ============================================================================
print("\n📝 Generating JOB_POSTINGS (300 records)...")

hr_ids = user_ids[200:]  # HR user IDs (201-300)
job_postings_data = []
job_posting_ids = []

companies = ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant', 'HCL', 'Tech Mahindra', 
             'Razorpay', 'Cred', 'Meesho', 'Flipkart', 'Swiggy', 'Zomato', 'OYO', 'Unacademy']
roles = ['Backend Engineer', 'Frontend Engineer', 'Full Stack Developer', 'Data Scientist', 
         'DevOps Engineer', 'ML Engineer', 'Senior Developer', 'Tech Lead', 'Product Manager']
departments = ['Engineering', 'Data', 'DevOps', 'Product', 'Research', None]

for i in range(300):
    job_id = i + 1
    job_posting_ids.append(job_id)
    hr_id = random.choice(hr_ids)
    company = random.choice(companies)
    role = random.choice(roles)
    department = random.choice(departments)
    description = f"We are looking for a {role} to join our {company} team. Experience required: 2-5 years."
    location = random.choice(['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Pune', 'Remote'])
    salary_range = f"{random.randint(8, 25)}L - {random.randint(25, 50)}L"
    is_active = random.choice([True, True, True, False])  # 75% active
    created_at = datetime.now() - timedelta(days=random.randint(0, 90))
    
    job_postings_data.append((
        job_id, hr_id, company, role, department, description, location, salary_range, None, is_active, created_at
    ))

insert_query = """
INSERT INTO job_postings (id, hr_id, company_name, role_title, department, description, location, salary_range, apply_link, is_active, created_at)
VALUES %s
"""
execute_values(cursor, insert_query, job_postings_data)
conn.commit()
print(f"✅ Inserted {len(job_postings_data)} job postings")

# ============================================================================
# 3. SAVED_CANDIDATES TABLE (300 records)
# ============================================================================
print("\n📝 Generating SAVED_CANDIDATES (300 records)...")

candidate_ids = user_ids[:200]  # Candidate user IDs (1-200)
saved_candidates_data = []
saved_candidate_ids = []
used_combinations = set()  # Track (hr_id, candidate_id) to avoid duplicates

statuses = ['pending', 'shortlisted', 'rejected', 'hired', 'removed']

for i in range(300):
    saved_id = i + 1
    saved_candidate_ids.append(saved_id)
    
    # Keep trying until we get a unique (hr_id, candidate_id) combination
    max_attempts = 100
    for attempt in range(max_attempts):
        hr_id = random.choice(hr_ids)
        candidate_id = random.choice(candidate_ids)
        
        if (hr_id, candidate_id) not in used_combinations:
            used_combinations.add((hr_id, candidate_id))
            break
    
    job_id = random.choice(job_posting_ids)
    note = random.choice([f"Good fit for {random.choice(roles)}", "Strong profile", "Needs interview", None])
    status = random.choice(statuses)
    saved_at = datetime.now() - timedelta(days=random.randint(0, 60))
    
    saved_candidates_data.append((
        saved_id, hr_id, candidate_id, job_id, note, status, saved_at
    ))

insert_query = """
INSERT INTO saved_candidates (id, hr_id, candidate_user_id, job_posting_id, note, status, saved_at)
VALUES %s
"""
execute_values(cursor, insert_query, saved_candidates_data)
conn.commit()
print(f"✅ Inserted {len(saved_candidates_data)} saved candidates")

# ============================================================================
# 4. OUTREACH_EMAILS TABLE (300 records)
# ============================================================================
print("\n📝 Generating OUTREACH_EMAILS (300 records)...")

outreach_data = []

for i in range(300):
    job_id = random.choice(job_posting_ids)
    candidate_id = random.choice(candidate_ids)
    sent_at = datetime.now() - timedelta(days=random.randint(0, 30))
    status = 'sent'
    opened_at = None
    
    # 40% of emails are opened
    if random.random() < 0.4:
        opened_at = sent_at + timedelta(hours=random.randint(1, 72))
    
    outreach_data.append((
        job_id, candidate_id, sent_at, status, opened_at
    ))

insert_query = """
INSERT INTO outreach_emails (job_posting_id, candidate_user_id, sent_at, status, opened_at)
VALUES %s
"""
execute_values(cursor, insert_query, outreach_data)
conn.commit()
print(f"✅ Inserted {len(outreach_data)} outreach emails")

# ============================================================================
# 5. REFRESH_TOKENS TABLE (300 records)
# ============================================================================
print("\n📝 Generating REFRESH_TOKENS (300 records)...")

refresh_tokens_data = []

for i in range(300):
    user_id = random.choice(user_ids)
    token = ''.join(random.choices(string.ascii_letters + string.digits, k=64))
    expires_at = datetime.now() + timedelta(days=random.randint(1, 30))
    is_revoked = random.choice([True, False, False, False])  # 25% revoked
    family_id = f"family_{random.randint(1, 100)}"
    created_at = datetime.now() - timedelta(days=random.randint(0, 10))
    
    refresh_tokens_data.append((
        user_id, token, expires_at, is_revoked, family_id, created_at
    ))

insert_query = """
INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked, family_id, created_at)
VALUES %s
"""
execute_values(cursor, insert_query, refresh_tokens_data)
conn.commit()
print(f"✅ Inserted {len(refresh_tokens_data)} refresh tokens")

# ============================================================================
# 6. USER_PREFERENCES TABLE (300 records)
# ============================================================================
print("\n📝 Generating USER_PREFERENCES (300 records)...")

user_prefs_data = []
themes = ['light', 'dark']
date_formats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']
timezones = ['UTC', 'IST', 'EST', 'PST', 'GMT']

import json

for user_id in user_ids[:300]:  # First 300 users have preferences
    theme = random.choice(themes)
    date_format = random.choice(date_formats)
    timezone = random.choice(timezones)
    table_prefs = {
        "search_results": {"sort_by": random.choice(["score", "date", "relevance"])},
        "notifications": {"email": random.choice([True, False])}
    }
    created_at = datetime.now()
    updated_at = datetime.now()
    
    user_prefs_data.append((
        user_id, theme, date_format, timezone, json.dumps(table_prefs), created_at, updated_at
    ))

insert_query = """
INSERT INTO user_preferences (user_id, theme, date_format, timezone, table_preferences, created_at, updated_at)
VALUES %s
"""
execute_values(cursor, insert_query, user_prefs_data)
conn.commit()
print(f"✅ Inserted {len(user_prefs_data)} user preferences")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "="*60)
print("✅ SEED DATA GENERATION COMPLETE!")
print("="*60)
print(f"📊 Summary:")
print(f"   • Users: 300 (200 candidates + 100 HRs)")
print(f"   • Job Postings: 300")
print(f"   • Saved Candidates: 300")
print(f"   • Outreach Emails: 300")
print(f"   • Refresh Tokens: 300")
print(f"   • User Preferences: 300")
print(f"\n🎯 Ready for SQL practice in pgAdmin!")
print("="*60)

cursor.close()
conn.close()
