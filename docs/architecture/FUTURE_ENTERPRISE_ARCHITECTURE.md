# SPECKULA — Future Enterprise Architecture & Target Operating System

## 1. Vision & Target Architecture

The future SPECKULA Enterprise Operating System expands SPECKULA from a single-user / basic workspace product tool into a **multi-tenant, permission-aware Enterprise Product & Engineering OS**.

```text
                                [ Organization ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
          [ Workspace A ]                               [ Workspace B ]
                │                                             │
      ┌─────────┴─────────┐                         ┌─────────┴─────────┐
      ▼                   ▼                         ▼                   ▼
[ Department A ]    [ Department B ]          [ Department C ]    [ Department D ]
      │                   │                         │                   │
      ▼                   ▼                         ▼                   ▼
  [ Team 1 ]          [ Team 2 ]                [ Team 3 ]          [ Team 4 ]
      │                   │                         │                   │
      ▼                   ▼                         ▼                   ▼
 [ Project A ]       [ Project B ]             [ Project C ]       [ Project D ]
      │                   │                         │                   │
      └─────────┬─────────┘                         └─────────┬─────────┘
                ▼                                             ▼
      [ Resource & RBAC ]                           [ Resource & RBAC ]
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                       [ Permission-Aware AI Engine ]
                       - Filtered RAG Vector Search
                       - User-Scoped Agent Execution
                       - Auditable Audit Trail Logging
```

---

## 2. Target Multi-Tenant Hierarchy

1. **Organization**: Top-level billing, SSO/SAML, security policies, and domain verification boundary.
2. **Workspace**: Product unit or business unit scope within an organization.
3. **Department**: Functional unit (e.g., Product Management, Mobile Engineering, Growth).
4. **Team**: Agile team or pod responsible for specific services or epics.
5. **Project**: Epics, features, or product initiatives scoped to teams.
6. **Resource**: Individual PRDs, Decisions, Notes, Signals, Tasks, and RAG Memory Nodes.

---

## 3. Unified RBAC & ABAC Permission Engine

The target architecture replaces flat roles with a fine-grained **Role-Based & Attribute-Based Access Control System**:

### System & Custom Roles:
- `OrgOwner`: Full administrative, security, and billing control.
- `OrgAdmin`: Member management, workspace provisioning, integration config.
- `ProductLeader`: Read/write across all product decisions, PRDs, roadmaps; publish rights.
- `ProductManager`: Read/write within assigned workspaces/departments/teams.
- `Engineer`: Read product specs/roadmaps, write/update assigned execution tasks.
- `Viewer`: Read-only access to published cases and approved PRDs.

### Permission Checks Matrix:
Every API endpoint and AI retrieval query will evaluate:
$$\text{Access Granted} \iff \text{UserHasRole(Resource, Action)} \land \text{IsTenantMatch(User, Resource)}$$

---

## 4. Permission-Aware Product Brain (Secure RAG)

In the enterprise model, vector search MUST NOT return memory entries that the requesting user lacks permission to view.

Target Vector Search SQL:
```sql
SELECT se."entryId", (se."embedding" <=> $vectorLiteral::vector) AS distance
FROM "SemanticEmbedding" se
JOIN "ProductBrainEntry" pbe ON pbe."id" = se."entryId"
JOIN "ResourcePermission" rp ON rp."resourceId" = pbe."id"
WHERE pbe."organizationId" = $userOrgId
  AND (
    rp."userId" = $userId OR
    rp."teamId" IN (SELECT "teamId" FROM "TeamMember" WHERE "userId" = $userId) OR
    rp."isPublicToOrg" = true
  )
ORDER BY distance ASC
LIMIT $limit;
```

---

## 5. Target Module Boundaries

```text
speckula-enterprise/
├── core/
│   ├── identity/            # SSO, SAML, User Profiles
│   ├── organization/        # Tenant isolation & org settings
│   ├── workspace/           # Multi-workspace scoping
│   ├── teams/               # Department & Team hierarchies
│   ├── authorization/       # RBAC / ABAC enforcement engine
│   └── audit/               # Enterprise Audit Trail
├── product/
│   ├── research/            # TipTap editor & signal notes
│   ├── decisions/           # Scored decision engine
│   ├── prds/                # Requirement specs
│   ├── roadmaps/            # Quarter planning
│   └── experiments/         # A/B growth testing
├── engineering/
│   ├── projects/            # Engineering project cases
│   └── tasks/               # Task management & Kanban
├── knowledge/
│   ├── memory/              # Product Brain knowledge graph
│   └── retrieval/           # Permission-aware RAG vector search
├── ai/
│   ├── agents/              # Autonomous Agent Execution Engine
│   └── reasoning/           # LLM prompt orchestration
└── integrations/
    ├── github/              # Code & PR sync
    ├── slack/               # Signal ingestion & notification
    └── jira/                # Issue sync
```
