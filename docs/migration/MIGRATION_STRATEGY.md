# SPECKULA — Enterprise Migration Strategy

## 1. Zero-Downtime Migration Principles

Transforming SPECKULA into an AI-native Enterprise OS requires evolving schema structures and multi-tenant hierarchies without breaking current users, invalidating existing Product Brain entries, or causing service downtime.

Core Guidelines:
1. **Never Drop Columns or Tables In-Place**: Add new nullable columns or shadow tables alongside existing models.
2. **Dual-Writing Phase**: Update application routes to write to both legacy and enterprise entities during transition.
3. **Idempotent Asynchronous Backfills**: Run background worker scripts to populate missing enterprise fields (`orgId`, `teamId`, `departmentId`).
4. **Feature Flag Gating**: Gate new enterprise capabilities behind workspace-level feature flags.
5. **Decoupled Client Deployment**: Ensure old frontend builds continue functioning seamlessly during backend API migrations.

---

## 2. Phased Migration Execution Timeline

```text
[ Current State ]
       │
       ▼
[ Phase 1: Organization & Tenant Foundation ] ──> (Sprint 1)
       │ - Add Organization & OrganizationMember models
       │ - Add orgId to Workspace
       │ - Backfill single-owner Orgs for all existing Workspaces
       │
       ▼
[ Phase 2: Relational Decision Shadowing ] ─────> (Sprint 2)
       │ - Provision PostgreSQL Decision shadow table
       │ - Sync Firestore decision writes to PostgreSQL
       │ - Backfill legacy Firestore decisions
       │
       ▼
[ Phase 3: Fine-Grained Enterprise RBAC ] ─────> (Sprint 3)
       │ - Add Role, RolePermission, Team, Department models
       │ - Migrate WorkspaceMember.role to RBAC engine
       │
       ▼
[ Phase 4: Permission-Aware Product Brain ] ───> (Sprint 4)
       │ - Update pgvector search queries with RBAC resource filtering
       │ - Re-index embeddings with tenant security context
       │
       ▼
[ Enterprise OS Live ]
```

---

## 3. Data Backfill & Synchronization Protocols

### 1. Workspace to Organization Backfill
Every standalone `Workspace` created prior to Enterprise migration will automatically seed a default `Organization`:
```typescript
// Backfill Logic (Run in low-traffic window)
const legacyWorkspaces = await db.workspace.findMany({ where: { organizationId: null } });

for (const ws of legacyWorkspaces) {
  const org = await db.organization.create({
    data: {
      name: `${ws.name} Organization`,
      slug: `${ws.slug}-org`,
      ownerId: ws.ownerId,
    },
  });
  await db.workspace.update({
    where: { id: ws.id },
    data: { organizationId: org.id },
  });
}
```

### 2. Firestore to PostgreSQL Decision Sync
To resolve the dual-database fragmentation, a sync endpoint (`POST /decisions/sync`) and backfill script will ensure all Firestore decisions maintain indexed shadow records in PostgreSQL.
