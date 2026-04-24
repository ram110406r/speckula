# Database Setup Guide

## Prerequisites

Ensure PostgreSQL is installed and running:

```bash
# macOS (if using Homebrew)
brew services start postgresql

# Linux (Ubuntu/Debian)
sudo systemctl start postgresql

# Windows
# Start PostgreSQL from Services or pgAdmin
```

## Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE buildcase;

# Create user (optional, for security)
CREATE USER buildcase_user WITH PASSWORD 'secure_password';
ALTER ROLE buildcase_user SET client_encoding TO 'utf8';
ALTER ROLE buildcase_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE buildcase_user SET default_transaction_deferrable TO on;
ALTER ROLE buildcase_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE buildcase TO buildcase_user;

# Exit psql
\q
```

## Initialize Prisma

```bash
# Generate Prisma client
npx prisma generate

# Create and run migrations
npx prisma migrate dev --name init

# This will:
# 1. Create migration files
# 2. Apply migrations to database
# 3. Generate Prisma client
```

## Verify Setup

```bash
# Open Prisma Studio to view database
npx prisma studio

# This opens a web UI at http://localhost:5555
```

## Connection String Format

### PostgreSQL with default user
```
postgresql://postgres:password@localhost:5432/buildcase
```

### PostgreSQL with custom user
```
postgresql://buildcase_user:secure_password@localhost:5432/buildcase
```

### PostgreSQL on different host/port
```
postgresql://user:password@host:5432/buildcase
```

## Troubleshooting

### Connection refused
- Verify PostgreSQL is running
- Check DATABASE_URL in .env is correct
- Ensure database exists

### Permission denied
- Check user permissions
- Verify user exists and password is correct
- Try connecting with psql directly first

### Migration failed
- Check database is empty or migrations are applied in order
- Look at `prisma/migrations/` folder
- Run `npx prisma migrate resolve --rolled-back <migration_name>` if needed

## Resetting Database (Development Only)

```bash
# DANGER: This will drop all data
npx prisma migrate reset
```

## Seeding Database (Optional)

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: await hashPassword('password123'),
    },
  });

  console.log('Created user:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Then run:
```bash
npx prisma db seed
```

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

## Backup and Restore

### Backup
```bash
pg_dump buildcase > backup.sql
```

### Restore
```bash
psql buildcase < backup.sql
```

## Performance Optimization

After initial migration, add indexes if needed:

```prisma
@@index([userId])
@@index([projectId])
@@index([workspaceId])
```

These are already in the schema. Run:

```bash
npx prisma db execute --file scripts/add_indexes.sql
```

## Cloud Deployment

For production, use managed PostgreSQL:

- **AWS RDS**: Provide DATABASE_URL from RDS endpoint
- **Heroku Postgres**: Heroku provides DATABASE_URL automatically
- **Vercel Postgres**: Managed postgres solution
- **Supabase**: PostgreSQL with additional features
- **Railway.app**: Simple PostgreSQL hosting

Example with Heroku:
```bash
heroku config:set DATABASE_URL=postgresql://...
heroku run npx prisma migrate deploy
```
