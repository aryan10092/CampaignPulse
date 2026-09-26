# Bulk Email Campaign Manager

A high-throughput, distributed email campaign processing system designed to handle large-scale email blasts reliably without blocking the main server thread.

```
backend/   Node.js API, BullMQ worker, Redis, Postgres
frontend/  Next.js dashboard
```

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Queue & Worker**: BullMQ, Redis
- **Database**: Serverless PostgreSQL (NeonDB)
- **Frontend**: Next.js, Tailwind CSS

## Architecture

```
User uploads CSV (e.g. 1,000 customers)
       ↓
Stream Parsing (csv-parser)
       ↓
Batch Insert to NeonDB (UNNEST) & addBulk to BullMQ
       ↓
Redis Pipeline
       ↓
BullMQ Worker (Concurrency: 10, Rate-limited: 50/sec)
       ↓
Simulate Send / SMTP Provider
       ↓
Atomic DB Counter Updates & Throttled Socket.IO Broadcasts
       ↓
Live Real-time Next.js Dashboard
```

## Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
DATABASE_URL=postgresql://[user]:[password]@[neon_hostname]/neondb?sslmode=require
REDIS_URL=redis://127.0.0.1:6379
PORT=5000
JWT_SECRET=replace-with-a-long-random-string
ENCRYPTION_KEY=
WORKER_CONCURRENCY=5
```

Frontend talks to the API at `http://localhost:5000` unless you set `NEXT_PUBLIC_API_URL`.

## Quick Start

1. **Backend**
   ```bash
   cd backend
   npm install
   npm run db:init
   npm start
   ```

2. **Frontend** (new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open the Next.js app (usually `http://localhost:3000` or `http://localhost:3001`).

Optional sample CSV:

```bash
cd backend
npm run generate:csv
```

## API Endpoints

- `POST /api/auth/register` / `POST /api/auth/login`
- `POST /api/campaigns/upload`: Upload CSV and launch campaign
- `GET /api/campaigns/:id`: Get campaign progress & live stats
- `GET /api/campaigns`: List all campaigns
- `GET /api/settings`: Per-user email delivery settings
- `GET /health`: Health check
