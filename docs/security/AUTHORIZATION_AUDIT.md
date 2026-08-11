# SPECKULA — Authorization Audit & Permission Model

## 1. Current Access Control Architecture

SPECKULA currently implements access control across two distinct layers:

```text
[ Incoming Request ]
         │
         ▼
[ Firebase ID Token Verification ] ──> Attaches req.userId
         │
         ├── Case 1: Workspace-Scoped Routes (/workspaces/*)
         │           └─> Calls requireWorkspaceRole(req, reply, workspaceId, minRole)
         │               - Checks WorkspaceMember(workspaceId, userId)
         │               - Evaluates role rank (owner: 4, admin: 3, editor: 2, viewer: 1)
         │
         └── Case 2: Direct User-Scoped Routes (/product-brain/*, /ai/*, /agents/*)
                     └─> Calls requireUserId(req, reply)
                         - Queries PostgreSQL / Firestore where userId = req.userId
```

---

## 2. Detailed Authorization Audit by Route Group

| Route Group | Enforcement Function | Current Authorization Mechanism | Audit Evaluation / Vulnerability |
|---|---|---|---|
| `/workspaces/*` | `requireWorkspaceRole` | Hierarchy-based role check (`owner`, `admin`, `editor`, `viewer`) | **SECURE**: Verifies membership and minRole correctly. |
| `/product-brain/*` | `requireUserId` | Filters records by `userId = req.userId` | **NEEDS WORKSPACE SCOPING**: A user in Workspace A can query entries by `userId` even if they belong to Workspace B unless `workspaceId` filter is explicitly passed. |
| `/ai/*` | `requireUserId` | Requires valid `userId` from token | **SECURE FOR USER SCOPE**: AI jobs and prompt logs are tagged to caller `userId`. |
| `/extension/*` | `requireUserId` + `requireWorkspaceRole` | Enforces `userId` and checks `workspaceId` if supplied | **SECURE**: Ensures user has viewer role before enqueuing analysis in a workspace. |
| `/agents/*` | `requireUserId` | Seeds and queries per-user `Agent` rows | **SECURE FOR INDIVIDUAL SCOPE**: Custom agents isolated per user. |
| `/outcomes/*` | `requireUserId` | Queries `Outcome` where `userId = req.userId` | **SECURE**: Prevents cross-user outcome manipulation. |
| `/roadmaps/*` | `requireUserId` | Queries `RoadmapItem` by `userId` | **NEEDS WORKSPACE RBAC**: Lacks team-level edit permissions. |
| `/experiments/*` | `requireUserId` | Queries `Experiment` by `userId` | **NEEDS WORKSPACE RBAC**: Lacks collaborator edit checks. |

---

## 3. Dangerous Authorization Patterns Identified

1. **Explicit `userId` Isolation Without Resource Ownership Check**:
   In endpoints like `GET /product-brain/entries/:id`, the query checks `entry.userId !== userId`. While this prevents User A from seeing User B's private entry, it fails when User A and User B are collaborators in the SAME workspace and should share access to workspace entries.

2. **Frontend-Only Role Checks**:
   In components like `DecisionView.tsx` and `SettingsView.tsx`, UI buttons for "Delete Decision" or "Manage Workspace Members" are hidden based on local client state, but must always be backed by server-side `requireWorkspaceRole` checks.

---

## 4. Target Enterprise Permission Model (RBAC / ABAC)

To support Enterprise requirements, the authorization system will transition to an **Attribute-Based & Role-Based Access Control System**:

```prisma
model Role {
  id          String           @id @default(uuid())
  orgId       String
  name        String           // e.g., "Product Manager", "Lead Designer"
  permissions RolePermission[]
}

model RolePermission {
  id         String @id @default(uuid())
  roleId     String
  resource   String // e.g., "prd", "decision", "roadmap"
  action     String // e.g., "create", "read", "update", "delete", "publish"
}
```
