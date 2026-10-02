# Resume RAG (Recruiter Match)

A microservice-based hiring platform. Candidates upload resumes, and HR teams search for matching profiles using natural-language queries. Resumes are parsed, summarized, embedded and stored in Milvus, and ranked results are returned with confidence scores.

**Tech stack:** FastAPI, Next.js, PostgreSQL, Milvus, Redis, OpenAI (embeddings + LLM), Docker

## Architecture

```
                    ┌────────────────┐
                    │ Next.js        │
                    │ frontend :4000 │
                    └───────┬────────┘
                            │ REST
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 │ Auth :3002  │     │ Search :3001│     │ Storing :3000│
 └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
        │                   │                   │
        └────── PostgreSQL ─┴──── Redis ────────┘
                            │                   │
                            └──── Milvus ◄──────┘
                          (Search reads, Storing writes)
```

## Services

### Auth service (`auth_api.py`, port 3002)
- Registration, login, email OTP verification, JWT access/refresh tokens, logout, profile and preference updates.
- PostgreSQL for users, tokens and preferences; Redis for the token blacklist and rate-limit counters.

### Storing service (`storing_api.py`, port 3000)
- Ingests resumes (URL or file), extracts text, generates a summary and embedding, and inserts records into Milvus.
- OCR fallback for scanned resumes.
- Candidate shadow mode: show or hide a profile in search without deleting data.

### Search service (`search_api.py`, port 3001)
- HR search, candidate retrieval, job postings, saved candidates and outreach workflows.
- Reads vectors from Milvus, reranks results, and stores relational data in PostgreSQL.
- Redis-backed request throttling on search.

### How the services share state
- **PostgreSQL:** users, tokens, preferences, jobs, outreach metadata
- **Redis:** blacklisted tokens, rate-limit counters
- **JWT secret:** shared signing key, so tokens are validated across services
- **Milvus:** Storing writes resume vectors, Search reads them

## Search flow

1. A resume is parsed (PyMuPDF / docx parser, OCR fallback).
2. A summary is generated with an LLM.
3. The summary is embedded with `text-embedding-ada-002` (1536 dimensions).
4. Milvus stores `user_id`, `name`, `email`, `phone`, `embedding`, `full_resume_text`, `summary` and `is_active`.
5. An HR query runs through one of three retrieval modes:

| Mode | Name | How it works |
|------|------|--------------|
| 1 | Dense retrieval | Semantic embedding search, then reranker |
| 2 | Hybrid RAG | Dense + keyword score fusion, then reranker |
| 3 | HyDE | LLM-enhanced query, then semantic retrieval and reranker |

Users choose a mode (`rag_model` = 1, 2 or 3) and the preference is stored per user.

**Notes**
- The LLM is used for resume summarization and for HyDE query enhancement. Dense and hybrid modes do not use a query-generation LLM step.
- The pipeline stores one embedding per resume summary, not multi-chunk vectors per section.

## Features

- Email OTP verification for account activation, and OTP verification on login
- JWT auth with refresh tokens
- Rate limiting: per-email on auth endpoints, per-user on search (Redis)
- Three selectable retrieval modes
- User preferences (theme, date, timezone, table settings, preferred RAG mode)
- Candidate shadow mode

## Run locally

### 1. Clone and set up the backend
```bash
git clone https://github.com/kbharath21/resume_rag.git
cd resume_rag
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Environment variables
```bash
cp .env.example .env
```
Set these in `.env`:
- `OPENAI_API_KEY` (embeddings, summarization, HyDE)
- `SECRET_KEY` (shared JWT key)
- `DATABASE_URL` and Postgres connection fields
- `MILVUS_HOST`, `MILVUS_PORT`, `MILVUS_COLLECTION_NAME`
- `REDIS_HOST`, `REDIS_PORT`
- `RESEND_API_KEY` (OTP email delivery)
- Optional: `SENTRY_DSN`

### 3. Start infrastructure (Milvus, Postgres, Redis)
```bash
docker-compose up -d
```

### 4. Create database tables
```bash
python create_tables.py
python add_rag_model_preference_column.py
```

### 5. Start the APIs (three terminals)
```bash
python storing_api.py
python search_api.py
python auth_api.py
```

### 6. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend runs on http://localhost:4000. Optional overrides: `NEXT_PUBLIC_AUTH_API_URL`, `NEXT_PUBLIC_SEARCH_API_URL`, `NEXT_PUBLIC_STORING_API_URL`.

## API ports

| Service | URL |
|---------|-----|
| Storing | http://localhost:3000 |
| Search | http://localhost:3001 |
| Auth | http://localhost:3002 |

## Deployment

A deployment script (`deploy_production.sh`) and `docker-compose.yml` are included for running the stack with Docker.
