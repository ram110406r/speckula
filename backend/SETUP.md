# Quick Setup Guide

## Step 1: Fix TypeScript Configuration ✅
- Updated `moduleResolution` from `"node"` to `"nodenext"` 
- Fixed Prisma schema typo: `prdss` → `prds`

## Step 2: Setup PostgreSQL Database

### Option A: Local PostgreSQL Installation
```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Windows
# Download and install from: https://www.postgresql.org/download/windows/

# Linux (Ubuntu/Debian)
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Option B: Docker PostgreSQL
```bash
docker run --name buildcase-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=buildcase \
  -p 5432:5432 \
  -d postgres:16
```

## Step 3: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# In psql shell:
CREATE DATABASE buildcase;
\q
```

## Step 4: Update .env File

Edit `backend/.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/buildcase"
```

## Step 5: Run Database Migrations

```bash
cd backend

# Install Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

## Step 6: Start Backend Server

```bash
npm run dev
```

Expected output:
```
✅ Server running on http://localhost:3001
📡 WebSocket server on ws://localhost:3001/ws
🌍 Environment: development
```

## Verify Setup

```bash
# Test health endpoint
curl http://localhost:3001/health

# Expected response:
# {"ok":true,"data":{"status":"ok"}}
```

## Troubleshooting

### "connect ECONNREFUSED"
- PostgreSQL is not running
- Check DATABASE_URL in .env
- Verify database exists: `psql -U postgres -l`

### "error: database "buildcase" does not exist"
```bash
# Create database
psql -U postgres -c "CREATE DATABASE buildcase;"
```

### "password authentication failed"
- Check PostgreSQL username/password in DATABASE_URL
- Default is `postgres:password` or `postgres:postgres`

### Prisma migration errors
```bash
# Reset database (DANGER - loses all data)
npm run prisma:reset

# Or manually:
psql -U postgres -c "DROP DATABASE buildcase;"
psql -U postgres -c "CREATE DATABASE buildcase;"
npm run prisma:migrate
```

---

**Next**: Connect your frontend to `http://localhost:3001`
