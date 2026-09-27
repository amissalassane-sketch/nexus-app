# NEXUS Platform — API Contract & Interface Specification

> **Standard Compliance**: Implements [`api-and-interface-design`](../../.agents/skills/api-and-interface-design/SKILL.md) and [`security-and-hardening`](../../.agents/skills/security-and-hardening/SKILL.md).

---

## 1. Interface Design Philosophy

NEXUS API endpoints adhere to strict interface contracts governed by three core tenets:
1. **Contract-First & Type-Safe**: Payloads and query parameters must validate against explicit schemas (`Zod` or deterministic validation predicates) at the server boundary before any execution.
2. **Hyrum's Law Protection**: Observable behavior, error payload shapes, and status codes are formal commitments. Internal database exceptions, stack traces, and low-level ORM errors are never returned to clients.
3. **Idempotency & Re-entrancy**: Destructive and mutating endpoints (billing upgrades, intelligence tool execution, task capture) are resilient against network retries and duplicate submissions.

---

## 2. Standardized Response Envelope

All API endpoints return JSON conforming to the canonical envelope defined in [`src/lib/api/response.ts`](file:///src/lib/api/response.ts):

### 2.1 Success Response (`200 OK`, `201 Created`)
```json
{
  "ok": true,
  "data": { ... },
  "...additionalTopLevelFields": "preserved for backward compatibility"
}
```

### 2.2 Error Response (`400-503`)
```json
{
  "ok": false,
  "error": "Short human-readable summary for legacy consumers",
  "code": "MACHINE_READABLE_ENUM_CODE",
  "message": "Human-readable explanation of failure",
  "details": {
    "field": "Optional validation failure details or structured context"
  }
}
```

### 2.3 Status Code Taxonomy
| HTTP Status | Error Code Default | Condition |
|:---|:---|:---|
| `400 Bad Request` | `BAD_REQUEST` | Malformed JSON, missing required fields, text too long |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing or invalid auth session cookie / JWT |
| `402 Payment Required` | `PLAN_LIMIT_EXCEEDED` | Workspace tier quota exceeded (tasks, storage, AI ops) |
| `403 Forbidden` | `FORBIDDEN` | Authenticated user lacks RBAC permissions (e.g. non-admin) |
| `404 Not Found` | `NOT_FOUND` | Target resource or integration provider does not exist |
| `409 Conflict` | `CONFLICT` | Concurrent mutation or conflicting state |
| `422 Unprocessable` | `UNPROCESSABLE_ENTITY` | Validation schema failed |
| `429 Too Many Req` | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| `501 Not Implemented`| `NOT_IMPLEMENTED` | Provider gateway not yet active |
| `503 Service Unavail`| `SERVICE_UNAVAILABLE` | Database unconfigured or remote upstream down |

---

## 3. Public & Application Endpoints Catalog

### 3.1 Health & Diagnostics
#### `GET /api/health`
- **Authentication**: None (Public Liveness Probe)
- **Response**:
  ```json
  {
    "ok": true,
    "service": "nexus",
    "time": "2026-09-27T10:00:00.000Z",
    "deployment": { "commit": "...", "environment": "production" },
    "configuration": { "supabaseConfigured": true, "supabaseHost": "...", "siteOrigin": "https://..." }
  }
  ```

---

### 3.2 Instant Capture Engine
#### `POST /api/capture`
- **Authentication**: Session Cookie (Bearer Token in RLS)
- **Request Body**:
  ```json
  {
    "text": "Call the team friday at 3pm #urgent"
  }
  ```
- **Constraints**: Max 500 characters, deterministic parser (`src/lib/capture.ts`).
- **Response `200 OK`**:
  ```json
  {
    "ok": true,
    "task": {
      "id": "uuid",
      "title": "Call the team",
      "due_at": "2026-10-02T15:00:00.000Z",
      "priority": "urgent"
    },
    "understood": "Call the team · Friday Oct 2 · Urgent",
    "dueExpression": "friday at 3pm",
    "priority": "urgent"
  }
  ```

---

### 3.3 Intelligence Action Execution
#### `POST /api/intelligence/action`
- **Authentication**: Session Cookie (Requires active workspace membership)
- **Description**: Secure tool-call execution boundary for LLM agents. Re-verifies user permissions and active workspace isolation before performing any mutation.
- **Request Body**:
  ```json
  {
    "action": "create_task" | "update_task" | "delete_task" | "complete_task" | "create_project" | "create_goal",
    "payload": { ... },
    "missionId": "optional-uuid"
  }
  ```
- **Security Check**:
  - Validates `riskForIntelligenceAction(action)`.
  - Requires explicit confirmation if destructive (`delete_*`).
  - Reads resource back from Supabase before reporting success.

---

### 3.4 Billing & Subscription
#### `POST /api/billing/upgrade`
- **Authentication**: Session Cookie (Requires `owner` or `admin` role)
- **Request Body**:
  ```json
  {
    "targetPlan": "PRO" | "ENTERPRISE"
  }
  ```
- **Response `501 Not Implemented` (Hermetic/Pending Gateway)**:
  ```json
  {
    "ok": false,
    "code": "PAYMENT_PROVIDER_NOT_CONFIGURED",
    "message": "Payment provider is not yet active",
    "provider": null,
    "targetPlan": "PRO",
    "workspaceId": "uuid"
  }
  ```

---

### 3.5 Third-Party Integrations
- `GET /api/integrations`: Lists active workspace connections (sanitized, zero secrets leaked).
- `GET /api/integrations/[providerId]/connect`: Initiates OAuth 2.0 flow with CSRF state sealed in `httpOnly` cookie.
- `GET /api/integrations/callback/[providerId]`: Exchanges authorization code, seals tokens with AES-256-GCM.
- `POST /api/integrations/[providerId]/sync`: Initiates read-only sync job for provider calendar/issues.
