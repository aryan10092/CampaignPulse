# Bulk Email Campaign Manager

A high-throughput, distributed email campaign processing system designed to handle large-scale email blasts reliably without blocking the main server thread.

## 🚀 Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Queue & Worker**: BullMQ, Redis
- **Database**: Serverless PostgreSQL (NeonDB)
- **Frontend**: Next.js, Tailwind CSS

## 🏗️ Architecture

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

## ⚙️ Environment Variables (.env)

```env
DATABASE_URL=postgresql://[user]:[password]@[neon_hostname]/neondb?sslmode=require
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PORT=3000
WORKER_CONCURRENCY=10
```

## 🛠️ Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database Schema on NeonDB**:
   ```bash
   npm run db:init
   ```

3. **Generate Sample CSV (1,000 customers)**:
   ```bash
   npm run generate:csv
   ```

4. **Start the Backend Server**:
   ```bash
   npm start
   ```

## 📡 API Endpoints

- `POST /api/campaigns/upload`: Upload CSV and launch campaign
- `GET /api/campaigns/:id`: Get campaign progress & live stats
- `GET /api/campaigns`: List all campaigns
- `GET /health`: Health check
