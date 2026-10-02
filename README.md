# Resume RAG

Resume RAG is a microservice-based hiring platform where candidates upload resumes and HR teams search for matching profiles using natural-language queries. Resumes are parsed, embedded, and stored in Milvus, then ranked search results are returned with confidence scores.

## Services and how they work

### 1) Auth service (`auth_api.py`, port `3002`)
- Handles registration, login, OTP verification, JWT access/refresh tokens, logout, and profile/preferences updates.
- Uses PostgreSQL for users/tokens/preferences and Redis for token blacklist + rate-limiting counters.
- Exposes REST endpoints consumed by the frontend.

### 2) Storing service (`storing_api.py`, port `3000`)
- Ingests resumes (URL or file), extracts text, generates summary + embedding, and inserts records into Milvus.
- Supports OCR fallback and candidate shadow mode (active/inactive visibility in search).
- Uses REST for ingestion endpoints and writes vectors to Milvus.

### 3) Search service (`search_api.py`, port `3001`)
- Handles HR search, candidate retrieval, job posting, saved candidates, and outreach workflows.
- Reads vectors from Milvus, reranks results, and stores relational workflows in PostgreSQL.
- Uses Redis-backed request throttling for search and REST endpoints for frontend calls.

## How services communicate

- **Frontend → services**: REST calls to Auth/Search/Storing APIs.
- **Auth/Search/Storing** share:
  - **PostgreSQL** (users, tokens, preferences, jobs, outreach metadata)
  - **Redis** (blacklisted tokens, rate-limit counters)
  - **JWT secret** (token validation across services)
- **Storing → Milvus** writes resume vectors; **Search → Milvus** reads vectors for retrieval.

## Search flow

1. Resume is parsed (PyMuPDF / docx parser, with OCR fallback when needed).
2. Resume summary is generated.
3. Summary is embedded with `text-embedding-ada-002` (1536 dimensions).
4. Milvus stores: `user_id`, `name`, `email`, `phone`, `embedding`, `full_resume_text`, `summary`, `is_active`.
5. HR query is processed by one of 3 retrieval modes:
   - **Model 1: Dense Retrieval** (semantic embedding search + reranker)
   - **Model 2: Hybrid RAG** (dense + keyword/BM25-style score fusion + reranker)
   - **Model 3: HyDE** (LLM-enhanced query, then semantic retrieval + reranker)

### LLM usage vs pure semantic
- **LLM is involved** for resume summarization and HyDE query enhancement.
- Dense and Hybrid retrieval are primarily embedding/vector-based retrieval pipelines (plus reranking/keyword fusion), without query-generation LLM steps.

### Chunking/parsing note
- Current pipeline stores one embedding per resume summary (not multi-chunk vectorization per document section).

## Features beyond basics

- Email OTP verification for account activation.
- 2FA-style OTP verification on login.
- Rate limiting:
  - Auth endpoints: per-email limits via Redis.
  - Search endpoint: per-user limits via Redis.
- Multi-RAG model selection (`rag_model` = 1/2/3) with stored user preference.
- User preferences (theme/date/timezone/table settings + preferred RAG model).
- Candidate shadow mode to hide/show profiles from search without deleting data.

## Run locally (after cloning)

### 1) Backend setup

```bash
cd /home/runner/work/resume_rag/resume_rag
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Environment variables

```bash
cp .env.example .env
```

Required keys/settings in `.env`:
- `OPENAI_API_KEY` (required for embeddings and HyDE/summarization)
- `SECRET_KEY` (shared JWT signing/verification key)
- `DATABASE_URL` and Postgres connection fields
- `MILVUS_HOST`, `MILVUS_PORT`, `MILVUS_COLLECTION_NAME`
- `REDIS_HOST`, `REDIS_PORT`
- `RESEND_API_KEY` (needed for OTP email delivery)
- Optional: `SENTRY_DSN`

### 3) Start infrastructure (Milvus + Postgres + Redis)

```bash
docker-compose up -d
```

### 4) Create database tables (and optional migration)

```bash
python create_tables.py
python add_rag_model_preference_column.py
```

### 5) Start APIs (3 terminals)

```bash
python storing_api.py
python search_api.py
python auth_api.py
```

### 6) Start frontend

```bash
cd /home/runner/work/resume_rag/resume_rag/frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:4000`.

Optional frontend env overrides:
- `NEXT_PUBLIC_AUTH_API_URL` (default expects auth API)
- `NEXT_PUBLIC_SEARCH_API_URL`
- `NEXT_PUBLIC_STORING_API_URL`

## Quick API ports

- Storing API: `http://localhost:3000`
- Search API: `http://localhost:3001`
- Auth API: `http://localhost:3002`
