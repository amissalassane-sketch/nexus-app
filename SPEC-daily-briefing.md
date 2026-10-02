# Spec: daily-briefing

Module ID: **`daily-briefing`**  
Initiative: **Intelligence Engine 2.0**  
Status: **Draft for Review**  
Author: Antigravity & User  
Date: 2026-10-02  

---

## 1. Objective
Enable NEXUS workspaces to generate and consume an instant, actionable **Daily Briefing** (*Brief Quotidien*) for any given workspace day.
The briefing answers: *"What matters most today and what requires immediate attention?"*

The Daily Briefing provides:
1. **Headline & Date Context**: Civil date, formatted greeting and workspace health indicator.
2. **Top 3 Recommended Focus Items**: Algorithmic selection of highest leverage tasks/goals for the current day.
3. **Critical Attention Alerts**: Immediate alerts for overdue tasks, at-risk goals, or high-severity signals.
4. **Schedule & Time Distribution**: Synchronized events for the day (if calendar connected) or allocated focus blocks.
5. **Deterministic Baseline + Optional LLM Polish**: 100% functional without an LLM; seamlessly enriched with a crisp 2-sentence executive summary when an AI provider is available.
6. **Hermetic & Cached**: Computed deterministically from the workspace context snapshot and cached per `(workspace_id, civil_date)` to avoid redundant computations.

---

## 2. Tech Stack
- **Language**: TypeScript 5.8+ (Strict mode, no `any`)
- **Framework**: Next.js 16.3.8 (App Router, Turbopack, React 19)
- **Database / Isolation**: Supabase Postgres with RLS and Workspace isolation
- **Test Runner**: Node.js built-in test runner (`node --import tsx --test`)

---

## 3. Commands
- **Lint**: `npm run lint`
- **Type Check**: `npm run type-check`
- **Unit & Contract Tests**: `node --import tsx --test supabase/tests/intelligence-daily-briefing.test.mjs`
- **Full Test Matrix**: `npm test`
- **Production Build**: `npm run build`

---

## 4. Project Structure
```
src/
├── lib/intelligence/
│   ├── types.ts                     → Briefing interfaces (DailyBriefing, BriefingFocusItem, etc.)
│   ├── daily-briefing.ts            → Briefing calculation, focus selection & LLM enrichment
│   └── index.ts (or direct exports) → Module exports
├── app/api/intelligence/
│   └── briefing/
│       └── route.ts                 → GET / POST endpoints for fetching / refreshing daily briefing
supabase/
└── tests/
    └── intelligence-daily-briefing.test.mjs → Unit, edge-case, and security isolation tests
```

---

## 5. Type Contract & API Design

```typescript
export interface BriefingFocusItem {
  id: string;
  type: "task" | "goal" | "signal";
  title: string;
  priority: "urgent" | "high" | "medium";
  reason: string;
  dueToday: boolean;
  isOverdue: boolean;
}

export interface DailyBriefingMetrics {
  totalTasksDueToday: number;
  totalOverdueTasks: number;
  unresolvedUrgentSignals: number;
  completedTasksYesterday: number;
}

export interface DailyBriefing {
  workspaceId: string;
  date: string; // ISO civil date YYYY-MM-DD
  generatedAt: string; // ISO UTC timestamp
  headline: string;
  summary: string;
  focusItems: BriefingFocusItem[]; // Clamped to 3 items
  metrics: DailyBriefingMetrics;
  attentionAlerts: Array<{
    id: string;
    level: "critical" | "warning" | "info";
    message: string;
  }>;
  scheduleSummary?: {
    totalEvents: number;
    nextEventTitle?: string;
    nextEventTime?: string;
  };
  deterministicOnly: boolean;
}
```

---

## 6. Code Style & Rules
- Strictly adhere to `api-and-interface-design` principles: interfaces first, explicit error codes.
- No `any` or untyped casts.
- Input clamping: `focusItems` capped at 3, `attentionAlerts` capped at 5.
- Locale awareness: Support French (default) and English via `src/lib/intelligence/i18n.ts`.

---

## 7. Testing Strategy
- **Hermetic test suite**: `supabase/tests/intelligence-daily-briefing.test.mjs`.
- **Test coverage**:
  - Deterministic computation without network / LLM.
  - Priority ordering: overdue tasks and urgent deadlines always outrank medium tasks.
  - Timezone / civil date boundary testing (e.g. edge of midnight).
  - Empty workspace fallback (honest zero-state without crashes or fake data).
  - Cross-workspace isolation (workspace A context cannot leak into workspace B briefing).
  - API endpoint authentication and CSRF / origin protection (`401` on unauthorized, `403` on cross-workspace).

---

## 8. Boundaries
- **Always**:
  - Validate workspace membership prior to reading context.
  - Keep briefing generation purely read-only (zero data mutations).
  - Handle absence of calendar integration gracefully.
- **Ask First**:
  - Creating new Postgres tables for briefing caching (initial version can use memory/snapshot cache or existing kv store).
- **Never**:
  - Expose raw errors or internal stack traces to the client.
  - Rely on LLM for mathematical counts (overdue tasks count must come from raw database snapshot).

---

## 9. Success Criteria
- [ ] `generateDailyBriefing()` returns valid `DailyBriefing` contract for any workspace state.
- [ ] 0 external API calls required for the deterministic baseline.
- [ ] `supabase/tests/intelligence-daily-briefing.test.mjs` passes with 100% assertions.
- [ ] `npm run lint`, `npm run type-check`, and `npm test` exit with code 0.
- [ ] `GET /api/intelligence/briefing` returns HTTP 200 with structured JSON for authenticated users.

---

## 10. Open Questions
1. **Cache Strategy** : Faut-il stocker les briefings générés dans une table Supabase dédiée (`workspace_briefings`) ou commencer par un calcul à la demande avec mémoïsation en mémoire / session ?  
   *(Recommandation : Commencer en mémoire / on-the-fly, puis ajouter une migration si la persistance inter-sessions est demandée).*
