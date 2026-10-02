# Capability Map: Intelligence Engine 2.0

Initiative: **Autonomous Intelligence, Daily Orchestration & Proactive Automation**  
Status: **Approved**  
Review Date: 2026-10-02

| Module ID | Responsibility | Depends on |
|---|---|---|
| `daily-briefing` | Automated Daily Briefing generation (top priorities, due today, blockers, urgent signals, schedule synthesis) with daily deterministic cache. | `context-builder`, `signals` |
| `proactive-automation` | Proactive bulk action proposals (stale task cleanup, overdue re-scheduling, conflict resolution) with preview and Human-in-the-Loop confirmation gate. | `daily-briefing`, `tools` |
| `autonomous-missions` | Multi-step autonomous mission orchestrator with step dependency resolution (`blockedBy`), state persistence, and verifiable execution checkpoints. | `mission.ts`, `proactive-automation` |
| `intelligence-ui-hub` | Interactive UI surfaces (Daily Briefing card, actionable drawers, mission step progression) across Desktop (`/app/intelligence`, `/dashboard`) and Mobile (`MobileHome`). | `daily-briefing`, `autonomous-missions` |

**Build order:** `daily-briefing` → `proactive-automation` → `autonomous-missions` → `intelligence-ui-hub`
