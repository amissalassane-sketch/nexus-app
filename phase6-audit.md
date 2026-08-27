# NEXUS PHASE 6 — Mobile Experience & Intelligence Surface

## Audit Initial (Baseline)

### Current Structure
- **App Shell** (`src/components/layout/app-shell.tsx`): Desktop layout with sidebar (248px) + top bar, becomes drawer < lg
- **Bottom Navigation** (`MOBILE_NAV`): Home, Intelligence, Projects, Tasks + "More" button → drawer
- **Mobile Header**: Menu button (hamburger), page title, search, notifications, help, avatar
- **Intelligence View** (`intelligence-view.tsx`): Grid layout with panels, signals, canvas
- **Mission Panel** (`mission-panel.tsx`): Vertical steps with progress, next best action
- **Signals** (`intelligence-signals.tsx`): Grid of 6 signal types
- **Ask/Chat** (`intelligence-ask.tsx`): Multi-line textarea with agent trace

### Mobile Breakpoints Currently Used
- `lg` (1024px): Sidebar visible, top bar full width
- Below `lg`: Drawer, bottom nav, compact header

### Specified Breakpoints for Phase 6
- 320px, 360px, 375px, 390px, 414px, 430px, 768px

---

## Problems Identified (vs Phase 6 Spec)

### 1. Mobile Home Hierarchy (Rule #5)
**Current**: Bottom nav + drawer + header with title
**Required**: Clear hierarchy:
- HEADER: workspace, profile/settings, sync status
- ATTENTION: critical signals, risks, deadlines
- MISSION ACTIVE: title, objective, progression, current step, next best action
- NEXT ACTION: primary action, confirmation-gated
- RECENT CONTEXT: useful activity, last action, last result
- CHAT/ASK: obvious access to NEXUS intelligence

**Missing**: Dedicated mobile home page with this specific hierarchy

### 2. Intelligence as Interface Primary (Rule #6)
**Current**: "What do I do now?" requires user to navigate to Intelligence section
**Required**: NEXUS should display NEXT BEST ACTION immediately on mobile home, with reason, context, impact, action

### 3. Mission Panel Mobile (Rule #7)
**Current**: Already decent vertical layout, steps with status/title/order/blocking reason
**Required**: 
- "Préparer ma présentation" with 72% progression
- "Étape actuelle: Finaliser les slides"
- "Pourquoi elle bloque: Cette tâche dépend de..."
- "Prochaine action: [Débloquer]"
- Étapes compactes with status, titre, ordre, dépendances, raison du blocage, action disponible
- No silent mutations - confirmation gated

### 4. Signals Mobile (Rule #8)
**Current**: 6 signal types in grid, each with icon, state badge, title, body
**Required**: Each signal must display:
- Niveau
- Problème  
- Pourquoi NEXUS le détecte
- Entité concernée
- Impact
- Action disponible
- Never just show "GOAL_AT_RISK" - codes are not UX

### 5. Chat/Mobile Ask (Rule #9)
**Current**: Multi-line textarea already implemented in Phase 5
**Required**: 
- Mobile keyboard considerations
- Safe-area awareness
- Always accessible field
- Large enough send button
- Adaptive textarea
- No content hidden by keyboard
- Automatic scroll
- Readable history
- Long replies properly structured
- Integrated actions in responses
- Natural language phrases: "la deuxième", "celle-ci", "reporte-la", "pourquoi ?", "et maintenant ?", "débloque-la"

### 6. Navigation Mobile (Rule #10)
**Current**: Bottom nav 4 items + "More" → drawer
**Required**: 1-2 gestures maximum for important actions
- Quick access: Home, Missions, Attention/Signals, Ask, Workspace/Settings
- May need dedicated mobile navigation

### 7. Responsive (Rule #11)
**Current**: Tests at lg breakpoint mainly
**Required**: Test at 320, 360, 375, 390, 414, 430, 768px
- No horizontal overflow
- No truncated text
- Accessible buttons
- Modals/sheets within viewport
- Keyboard doesn't hide controls

### 8. Touch UX (Rule #12)
**Current**: Button sizes vary (h-9 = 36px, h-14 = 56px)
**Required**: Minimum 44×44px for all interactive controls
- Pressed states
- Visual feedback
- Proper touch targets
- Sufficient spacing
- No hover-dependence

### 9. Performance (Rule #13)
**Current**: No heavy dependencies added in Phase 5
**Required**: Audit JS sent, heavy components, images, re-renders, API calls, loading states

### 10. Accessibility (Rule #14)
**Current**: Focus visible, aria labels, reduced motion
**Required**: Check contrast, focus, labels, aria, keyboard nav, screen readers, text sizes, accessible buttons, readable errors

### 11. Offline/Resilience (Rule #15)
**Current**: Some memory caching exists
**Required**: Network errors should be comprehensible:
- "Connexion perdue. Les dernières informations affichées restent disponibles."
- Not: "Failed to fetch."

### 12. Desktop Non-Regression (Rule #16)
**Current**: Changes behind sm/lg breakpoints
**Required**: Desktop must remain functional
- Don't destroy desktop layouts for mobile
- Mobile-first when pertinent, explicit breakpoints, reusable components

---

## Files to Create/Modify

### Create:
1. `src/components/mobile-home/` — Mobile home component following Phase 6 spec
2. `src/app/mobile/` — Mobile home route or redesign of existing home
3. Mobile-optimized components as needed

### Modify:
1. `src/components/layout/app-shell.tsx` — Enhance mobile header, ensure drawer works well
2. `src/components/intelligence/mission-panel.tsx` — Optimize for mobile compact steps
3. `src/components/intelligence/intelligence-signals.tsx` — Display signals with required fields
4. `src/components/intelligence/intelligence-ask.tsx` — Ensure mobile keyboard/accessibility
5. `src/components/layout/nav-config.ts` — May need mobile nav group
6. `src/app/(app)/page.tsx` or create `src/app/mobile/page.tsx`
7. `src/globals.css` — Any additional tokens needed

