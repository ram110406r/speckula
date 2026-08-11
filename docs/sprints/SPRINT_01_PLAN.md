# SPECKULA — Sprint 1 Implementation Plan

## Goal: Organization & Tenant Foundation

Sprint 1 lays the multi-tenant architectural foundation for SPECKULA Enterprise without breaking existing single-workspace users or disrupting the live frontend experience.

---

## 1. Scope & Key Deliverables

1. **Database Migration**:
   - Create `Organization` and `OrganizationMember` models in `backend/prisma/schema.prisma`.
   - Add `organizationId` foreign key to `Workspace` model.
   - Run Prisma migration (`npx prisma migrate dev --name add_organization_tenancy`).
2. **Automated Backfill Script**:
   - Write idempotent migration script (`backend/src/scripts/backfillOrganizations.ts`).
   - Auto-create a default `Organization` for every existing `Workspace` owner and link `workspace.organizationId`.
3. **Backend Organization Service & Routes**:
   - Implement `organizationService.ts` for Org CRUD and member management.
   - Create `organizationRoutes.ts` registered under `/organizations`.
   - Update `workspaceAuth.ts` to support Organization-level role checks (`requireOrgRole`).
4. **Tenant-Aware Context Header**:
   - Update Fastify request context to parse `x-organization-id` header.
   - Inject tenant context into activity logs and AI prompt telemetry.
5. **Frontend Tenant Context Integration**:
   - Add Organization state store (`useOrganizationStore.ts`).
   - Add Organization / Tenant switcher in navigation sidebar.
6. **Automated Test Suite Expansion**:
   - Unit tests for Organization CRUD and backfill script in `organizationRoutes.test.ts`.
   - Authorization test cases ensuring User A in Org 1 cannot access Workspaces in Org 2.

---

## 2. Target Prisma Schema Additions (Sprint 1)

```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  ownerId     String
  logoUrl     String?
  metadata    String?  // JSON: domain verification, SSO config
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  members     OrganizationMember[]
  workspaces  Workspace[]

  @@index([ownerId])
  @@index([slug])
}

model OrganizationMember {
  id             String       @id @default(uuid())
  organizationId String
  userId         String
  role           String       @default("member") // owner | admin | member
  joinedAt       DateTime     @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
}
```

---

## 3. Step-by-Step Task Execution Order

```text
Task 1: Add Organization & OrganizationMember to backend/prisma/schema.prisma
   │
   ▼
Task 2: Generate & verify Prisma migration
   │
   ▼
Task 3: Implement organizationService.ts & backfill script
   │
   ▼
Task 4: Implement organizationRoutes.ts & add requireOrgRole middleware
   │
   ▼
Task 5: Update workspaceRoutes.ts to enforce Organization boundary
   │
   ▼
Task 6: Add frontend useOrganizationStore.ts & sidebar switcher
   │
   ▼
Task 7: Run backend & frontend test suites to verify zero regressions
```

---

## 4. Rollback & Contingency Plan

- **Database Fallback**: The `organizationId` field on `Workspace` is nullable during Sprint 1. If any issue arises, API queries fall back to `workspace.ownerId` isolation.
- **Feature Flag Control**: Wrap Org routes with `process.env.ENABLE_ORGANIZATIONS === 'true'`.
