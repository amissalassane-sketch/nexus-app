# NEXUS — UX writing rules

Preserve NEXUS identity: precise, calm, helpful. No theatrical claims of autonomy. UI currently predominantly English; onboarding offers EN/FR, regional format locales are not full UI translations.

## Evidence-led vocabulary
| Situation | Use | Do not use |
|---|---|---|
| Code exists | Implemented / available in code | Connected |
| Environment name/key exists | Configured, not verified | Healthy |
| OAuth consent completed | Connected; last sync unknown | Everything is synced |
| Sync completed with real counts | Last successful sync at [measured instant] | Always live |
| Request failed | Could not load. Retry. No change confirmed. | No records / success |
| AI proposal | Proposed change. Review and confirm. | Done |
| Mutation re-read | Saved and checked in this workspace | Guaranteed correct AI |
| Payment return URL | Payment not verified. Review billing. | Payment successful |
| Export memory | Download memory only (JSON) | Export all my data |
| Local disconnect | Disconnected locally. Revoke at provider too. | Access fully revoked |
| Missing cost | Not measured | $0 / Free |

Error pattern: **what failed → whether anything changed → safe next step**. Avoid raw SQL/error stacks or secrets. Retry is not safe after an uncertain charge without reconciliation. Success copy is emitted only after verified write response. No coercive upsell while controls are failing.

## Interaction rules
- One clear primary action; irreversible/high-impact action has scoped preview and explicit confirmation, not a timer or ambiguous “Continue”.
- Explain unavailable controls next to the action; don't replace missing functionality with a mock workflow.
- Dates: identify timezone; civil dates must not jump on travel. Numbers/currency from Intl; price currency is commercial, not automatic FX.
- Accessibility: labels, visible focus, error/status live regions, no colour-only meaning, reduced motion, adequate targets. Never claim WCAG2.2AA from axe alone.
- Settings: “Appearance” offers Dark / Light / System. Stored locally. Regional settings honestly state their current limited adoption.
- Legal placeholders must never look like verified identity or a working contact channel.
