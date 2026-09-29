# NEXUS — SLIDE LABEL (animated CTA text) — IMPLEMENTATION REPORT

**Source of the interaction:** KokonutUI *Slide Text Button* (MIT), used as a **motion reference only**.
Its visual styling (black/white pill, `dark:` branches, `md:min-w-56`, `text-md tracking-tighter`) and its
entrance animation (`initial={{ x: 200, opacity: 0 }}`) were **not** imported. Only the interaction principle
was extracted:

| Principle taken | Implementation |
|---|---|
| Current label moves upward | `transform: translateY(-100%)` on the label layer |
| Secondary label enters from below | second label parked at `translateY(100%)` |
| Clipped text container | `overflow: hidden` on the label box |
| ~200–300ms | `var(--duration-small)` = 200ms |
| Smooth ease-in-out | `var(--ease-standard)` = `cubic-bezier(0.2, 0, 0, 1)` |
| No exaggerated movement | one line box of travel, nothing else moves |
| — (rejected) button entrance | the button is stationary; only the label moves |

---

## 1. What was built (shared foundation first)

| Artifact | Role |
|---|---|
| `src/app/globals.css` → **SLIDE LABEL** block | The interaction contract: clipped box, grid cell (box = one line tall, as wide as the longer label), transform-only reveal, `:hover` + `:focus-visible`, reduced-motion fallback |
| `src/components/ui/slide-label.tsx` | `SlideLabel` — the presentation half. Server component, no state, no dependency, **no colour of its own** (which is why it works identically in both products) |
| `src/components/ui/button.tsx` | `variant="slide" \| "slide-ghost" \| "slide-intelligence"`, `SLIDE_VARIANTS`, `isSlideVariant()`, and the `hoverText` sugar |
| `scripts/test-slide-text.mjs` | 42 assertions pinning the contract (motion, trigger, reduced motion, a11y, token inheritance, adoption scope, cross-product coverage) |

**No second button system.** The slide variants are the canonical recipes plus one marker class:

```
slide              = primary      + group/slide
slide-ghost        = ghost        + group/slide
slide-intelligence = intelligence + group/slide
```

Colour, border, radius, focus ring, disabled and loading states all come from the variant that already existed —
this is asserted mechanically (`slide.replace("group/slide ","") === primary`), so the two can never drift.

**Why a *named* group.** The trigger is `.group\/slide:hover`, not `.group:hover`. A plain `group` on an ancestor
carried by a card or a section would otherwise fire the reveal from anywhere in that ancestor; the named marker
means only the control itself can trigger it.

### The three variants, and why only one is in use

`slide`, `slide-ghost` and `slide-intelligence` are all part of the API, because the interaction must be
available to any high-intent CTA regardless of which canonical recipe that CTA uses. Today only `slide` has
qualifying hosts: every other high-intent CTA on the audited screens is a white primary action, while

- `slide-ghost` would apply to secondary/tertiary CTAs — the product's secondary CTAs ("See how it works",
  "Sign in") are either in navigation chrome or deliberately kept still so the primary action keeps the contrast
  (one reveal per decision, not one per button pair),
- `slide-intelligence` would apply to actions NEXUS itself proposes — the canonical `intelligence` variant has no
  call sites yet (`variant="intelligence"` appears zero times in `src/`), so there is no host to convert.

Both are covered by the contract tests (`SLIDE-06`) and will be picked up the moment a host appears.

### Two call shapes, one implementation

```tsx
// 1 · plain string child (sugar — the string is wrapped in SlideLabel)
<ButtonLink href="/signup" variant="slide" hoverText="Start building">
  Get started
</ButtonLink>

// 2 · composed children (trailing icon, counter): pass SlideLabel where the
//     moving text belongs; everything else stays still
<ButtonLink href="/projects?create=1" variant="slide">
  <NexusIcon icon={IconLayoutKanban} />
  <SlideLabel text="Create your first project" hoverText="Open projects" />
</ButtonLink>
```

### Accessibility

- The incoming label is **`aria-hidden`**: the control keeps exactly one accessible name, it is never announced
  twice, and a screen reader never reads a label that exists only because a pointer is over the control.
- **Keyboard parity:** `:focus-visible` on the owner triggers the same reveal as hover — the interaction is not
  hover-only, and nothing about the control's function depends on it.
- Reduced motion: no travel, the resting label stays readable, the incoming label is not rendered. The button's
  colour/border hover and focus states are untouched.

---

## 2. Adoption audit — NEXUS (product)

Full sweep of every `Button` / `ButtonLink` / `IconButton` call site. "High-intent navigation or entry CTA" is
the only category that qualifies.

| Route / surface | Button | Current variant | New behaviour | Reason |
|---|---|---|---|---|
| `/` — hero | "Get started" → `/signup` | `primary lg` | **slide** → "Start building" | The landing's single decisive entry action |
| `/`, `/pricing` — closing CTA (shared `FinalCtaSection`) | "Get started" → `/signup` | `primary lg` | **slide** → "Start building" | Closing entry CTA, same primary destination, rendered wherever the shared section is used |
| `/how-it-works` — hero | "Get started" → `/signup` | `primary lg` | **slide** → "Start building" | Primary navigation CTA of the page |
| `/intelligence` — hero | "Get started" → `/signup` | `primary lg` | **slide** → "Start building" | Intelligence entry CTA (via `primaryCta.hoverLabel`) |
| `/intelligence` — closing | "Get started" → `/signup` | `primary lg` | **slide** → "Start building" | Primary navigation CTA, same pair as the hero |
| `/showcase` — hub cards ×5 | "Open screen" → screen | card link | **slide** → "Open *{screen}*" | Presentation CTAs: the second label names the destination exactly |
| `/dashboard` — dominant CTA | "Set up your profile" → `/settings` | `primary lg` | **slide** → "Open settings" | The screen's one decisive action |
| `/dashboard` — dominant CTA | "Create your first project" → `/projects?create=1` | `primary lg` | **slide** → "Open projects" | Same control, first-run branch |
| `/dashboard` — dominant CTA | "Create your first task" → `/tasks?create=1` | `primary lg` | **slide** → "Open tasks" | Same control, first-run branch |
| `/dashboard` — dominant CTA | "Ask NEXUS what matters" → `/app/intelligence?ask=1` | `primary lg` | **slide** → "Open Command Center" | Same control, established-workspace branch |

Four of those ten rows are the *same* control: the dashboard's single dominant CTA, which has one wording per
first-run branch. The reveal sits on one control per screen, two at the extreme (`/` and `/intelligence` hero + closing).

### Deliberately excluded (checked, not forgotten)

| Surface | Button | Why it keeps a still label |
|---|---|---|
| Sidebar, topbar, command palette rows | every nav item | Navigation chrome: motion must be reserved for state, and these already carry active states |
| Auth surfaces (`/login`, `/signup`, `/admin/*`) | submit buttons | Form submission — the label must not change under the pointer mid-submit |
| Settings, modals, confirmations | Save / Cancel / Archive / Delete / Confirm | Destructive or committing actions: the label is the safety signal |
| Tables, lists, pagination | "View all" ×3 on `/dashboard`, row links, Prev/Next | Table row utilities and dense repeated actions |
| Section headers on `/dashboard` | "View all" caption links | Three per screen in panel headers — repetition removes meaning |
| `mission-panel`, `proactive-signals-panel` | "Ouvrir", "Continue" | Labels come from the intelligence i18n layer (`src/lib/intelligence/i18n.ts`); a second label would need a second translation key — a localization change, not a motion change |
| `welcome-screen` (onboarding dialog) | "Start", "Explore" | Same i18n reason, and it is a dialog, not a navigation CTA |
| Icon-only controls | refresh, copy, password reveal, drawer trigger | No text to slide |
| `/showcase/intelligence` | "Execute resolution plan" (mock) | A simulated action on mock data; the hub cards already carry the interaction for the showcase category, and a second label for a fake action would be invented copy |

---

## 3. Adoption audit — NEXUS Admin

The console was audited with the same criteria. Its controls are operational: filters, pagination, refresh,
copy, form submits, row navigation, destructive confirmations.

| Route / surface | Button | Current variant | New behaviour | Reason |
|---|---|---|---|---|
| `/admin/overview` — "Needs attention" | "Inspect workspaces" / "Inspect accounts" / "Inspect subscriptions" / "Inspect instrumentation" / "Read the setup guide" | accent chip action | **slide** → "Open workspaces" / "Open accounts" / "Open subscriptions" / "Open activity" / "Open security" | The console's decisive navigation: it names the problem, then the destination. Bounded by the five real exception conditions, so it stays meaningful |

Nothing else in Admin takes the interaction:

| Surface | Why not |
|---|---|
| `/admin/overview` — Platform status rows (`health-list`) | Secondary action inside a dense status row. Converted to a client `Link` for navigation quality, deliberately still |
| `/admin/*` — list tables, sorts, pagination, "Open user / workspace" row affordances | Dense repeated actions and table utilities |
| `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` | Form submission and recovery |
| `/admin/*` — empty-state recovery ("Back to the first page"), unavailable actions | State recovery, not high-intent navigation |
| Admin shell — nav rows, drawer, ⌘K palette, refresh, sign-out | Navigation chrome and a committing action |
| `/admin/access-denied` — "Back to NEXUS" | A refusal surface: calm beats motion |

**Why Admin carries no slide code of its own.** The interaction is one stylesheet contract plus the token-free
`SlideLabel` component, so Admin consumes exactly the same implementation the product does (asserted: no
`components/admin/slide-label.tsx` exists and the console does not import the product `Button`). The owner
marker `group/slide` is applied to Admin's own accent chip recipe, which keeps its Admin tokens untouched.

Two Admin-side quality fixes came out of this pass, both navigation-only:
1. The "Needs attention" action was a raw `<a href>` — a full page reload. It is now `<Link>`, so client
   navigation (and the page entrance animation) works like everywhere else on internal routes.
2. The same was true for the Platform-status row action (`health-list.tsx`), which also gained the focus ring it
   was missing.

---

## 4. Motion, responsive and no-JS behaviour

| Aspect | Behaviour |
|---|---|
| Duration | 200ms — the *transition* stop of the motion scale (`--duration-small`) |
| Easing | `--ease-standard`, a symmetric ease-in-out — no bounce, no elastic, no overshoot, no scale |
| What animates | `transform` on one inner layer. During the reveal the button box, its width, its text colour and its icon do not move. The 1px `:active` press translate that every NEXUS button already carries on press is unchanged — that is press feedback, not motion on arrival |
| Layout stability | Both labels share one grid cell, so the box is one line tall and as wide as the longer label — no width jump at any point of the reveal |
| Reduced motion (`prefers-reduced-motion: reduce`) | travel cancelled, incoming label not rendered, resting label readable, hover/focus states intact |
| No JS | Pure CSS: works with JavaScript disabled, and the link/button is fully functional without any reveal |
| Touch | Nothing depends on hover; a tap activates the control with the resting label (unchanged behaviour) |
| Narrow screens | The label is `whitespace-nowrap` and the box sizes to the longer label, so 480px layouts cannot clip a word mid-reveal; the labels are 11.5–13px inside the existing control ladder (32/40/44px) |

---

## 5. Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (12 pre-existing warnings in test files + `tailwind.config.js`) |
| `npx next build` | succeeds (67/67 static pages) |
| `scripts/test-slide-text.mjs` | **42 passed, 0 failed** |
| `test:admin` (10 suites) | 58 / 117 / 51 / 114 / 109 / 55 / 116 / 139 / 19 / 20 — all 0 failed |
| `test-mobile-ux` · `test-typography` · `test-icons` · `test-landing-design` | 67 · 19 · 251 · 93 — all 0 failed |
| `test-p0-domains` · `test-project-creation` · `test-onboarding-guide` | 50 · 37 · 12 — all 0 failed |
| Rendered HTML — `/` | two slide anchors: `group/slide` + `slide-label` + `aria-hidden` incoming label, resting label intact |
| Rendered HTML — `/pricing` | same shared closing CTA pair (the component is reused across public pages, so the reveal follows it) |
| Rendered HTML — `/showcase` | pairs `Open screen → Open Overview Dashboard` · `→ Open Command Center (⌘K)` · `→ Open AI Intelligence Core` |
| Rendered HTML — `/intelligence`, `/how-it-works` | pair `Get started → Start building` present once (hero) / once (hero) |
| Compiled CSS | `.slide-label`, `.slide-label-inner`, `.slide-label-inner > *`, `.slide-label-hover`, `.group\/slide:hover`, `.group\/slide:focus-visible` and the reduced-motion block all emitted |

**Known limitation of this run:** the PGlite preview harness (`scripts/preview-admin.mjs`) cannot boot in this
sandbox — it fails on `relation "storage.buckets" does not exist` while replaying the storage migrations. It is a
developer preview tool, is not part of any test chain, and the failure is unrelated to this change; the Admin
side is therefore verified at source + contract level (SLIDE-08), not in a rendered browser.

---

## 6. Cross-product check (required by the standing rule)

| Area | Reviewed | Outcome |
|---|---|---|
| Shared primitive | ✅ | One CSS contract + one token-free component; no product-specific copy, no Admin-specific copy |
| NEXUS product | ✅ | 5 entry CTAs + the showcase presentation CTAs + the dashboard's dominant CTA |
| NEXUS Admin | ✅ | The Needs-attention navigation action; every other Admin control documented as intentionally still |
| Tokens | ✅ | No new colour/radius/shadow/focus token; variants are *equal to* the canonical recipes (asserted) |
| Typography | ✅ | Nothing added — both labels inherit the host button's `text-*` step |
| Responsive | ✅ | nowrap label, box sized to the longer label, control ladder unchanged |
| Accessibility | ✅ | One accessible name, hover↔focus parity, reduced-motion fallback, no hover-only dependency |
| Motion | ✅ | 200ms / ease-in-out / transform-only / one line of travel; no entrance animation from the reference |
| Duplication | ✅ | Zero duplicate implementations; the sugar prop is a wrapper over the same component |
| Divergence introduced | ✅ | None — the only Admin difference is *which* action takes the interaction, and it is justified above |

## 7. Remaining issues / next improvements

1. **`duration-150` (119 occurrences) is still off the motion scale** (90 / 120 / 160 / 200 / 240 / 280 / 340 / 400).
   It predates this work and is a mechanical sweep across ~40 files, deliberately not bundled into this change.
2. **Localized CTAs cannot take the interaction yet.** `welcome-screen` and `mission-panel` read labels from
   `src/lib/intelligence/i18n.ts` / `src/lib/onboarding/i18n.ts`; a slide there needs a second translated key.
   Recommended: add `*.action_hover` keys in the i18n pass, then adopt.
3. **Admin has no shared button recipe.** The accent action shape is re-typed in ~7 Admin files (login, recovery,
   empty-state recovery, access denied). A `admin/controls.tsx` exporting the recipe would let a future
   high-intent Admin CTA adopt the slide without touching markup; today the chip recipe lives in the page.
4. **The showcase hub cards** now slide on card hover (the whole card is the link). If the card is ever split into
   "card = open" plus a separate footer CTA, move the slide to that CTA.
