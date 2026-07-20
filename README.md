# Research Blueprint AI

Research Blueprint AI is a bilingual academic research platform for study design, statistical planning, simulation, prediction, publication readiness, academic visibility, and SaaS-style organization management.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts
- Backend: FastAPI, SQLAlchemy, Alembic, Pydantic
- Database: SQLite for local development, PostgreSQL-compatible schema for production
- Tests: Pytest for backend services and API behavior

## Local Setup

Install frontend dependencies:

```bash
npm install
```

Create environment files from the examples:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

Install backend dependencies:

```bash
cd backend
python -m pip install -r requirements.txt
cd ..
```

## Running Locally

Start the backend:

```bash
npm run backend:dev
```

Start the frontend in another terminal:

```bash
npm run dev
```

The default frontend API endpoint is `http://localhost:8000/api`. Override it with:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Verification

Run the production frontend build:

```bash
npm run build
```

Run backend tests:

```bash
npm run backend:test
```

Run the full local check:

```bash
npm run check
```

Clean generated SQLite test databases and test logs:

```bash
npm run clean:test-artifacts
```

Apply database migrations:

```bash
npm run backend:migrate
```

Run the backend in production-style mode:

```bash
npm run backend:prod
```

Health endpoints:

- `GET /health`: process-level health check
- `GET /ready`: readiness check including database connectivity

The API also sends baseline security headers for content sniffing, framing, referrer policy, and browser permissions.

## Backend Environment

Important backend variables:

- `ENVIRONMENT`: `development` or `production`
- `DATABASE_URL`: SQLite locally, PostgreSQL in production
- `COOKIE_SECURE`: set `true` when served over HTTPS
- `SESSION_TTL_DAYS`: session lifetime in days
- `AUTO_CREATE_TABLES`: useful locally; prefer Alembic migrations in production
- `CORS_ORIGINS`: comma-separated frontend origins allowed to call the API
- `GEMINI_API_KEY`: optional AI provider key

## Production Notes

- Use Alembic migrations instead of automatic table creation.
- Set `ENVIRONMENT=production` and `COOKIE_SECURE=true`.
- Set `AUTO_CREATE_TABLES=false` and run `npm run backend:migrate` during deployment.
- Point `VITE_API_BASE_URL` to the deployed API.
- Keep generated databases, logs, virtual environments, and build artifacts out of source control.

## CI

The GitHub Actions workflow in `.github/workflows/ci.yml` installs frontend and backend dependencies, verifies Alembic migrations from a clean database, runs `npm run lint`, builds the frontend, and runs the backend test suite.
