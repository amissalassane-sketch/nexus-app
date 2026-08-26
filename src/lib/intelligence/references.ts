// ============================================================
// NEXUS INTELLIGENCE — REFERENCE RESOLVER (Phase 2)
// ============================================================
// Resolves natural-language references against the structured
// working memory and the real workspace snapshot:
//
//   - ordinals      : "la deuxième", "la première", "the last one",
//                     "les deux premières"
//   - pronouns      : "celle-ci", "celle-là", "cette tâche(-là)",
//                     "ce projet", "celui dont on parlait"
//   - previous      : "le projet précédent", "la tâche précédente"
//   - verb suffixes : "reporte-la", "supprime-la", "mets-la en
//                     urgente", "passe-les"
//   - repeat        : "pareil", "fais la même chose"
//   - why           : "pourquoi ?" → the subject just discussed
//   - by date       : "celui de vendredi"
//
// RULES:
//   - Memory is used FIRST; the snapshot is only consulted to verify
//     that a referenced id still exists (never to invent one).
//   - If the reference is ambiguous → kind "ambiguous" with a short
//     clarification question. NEVER guess.
//   - If the referenced entity was deleted → kind "deleted".
// ============================================================

import type { WorkspaceSnapshot } from "./engine";
import type {
  IntelligenceMemoryState,
  IntelligenceTarget,
  MemoryEntityRef,
  ReferenceResolution,
} from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------
// Ordinal parsing
// ------------------------------------------------------------

const ORDINAL_INDEX: Record<string, number> = {
  premier: 0,
  premiere: 0,
  first: 0,
  second: 1,
  seconde: 1,
  deuxieme: 1,
  deuxième: 1,
  third: 2,
  troisieme: 2,
  quatrieme: 3,
  fourth: 3,
  cinquieme: 4,
  fifth: 4,
};

interface ParsedOrdinal {
  index: number;
  isLast: boolean;
  count?: number; // for "les deux premières" → slice(0, 2)
  entityType?: MemoryEntityRef["type"] | null;
}

/** "la deuxième" / "the second one" / "les deux premières" / "le dernier" */
function parseOrdinal(normalized: string): ParsedOrdinal | null {
  const words = normalized.split(" ").filter(Boolean);

  // "le dernier" / "la dernière" / "the last one" (alone or at the end
  // of the sentence: "et le dernier ?"). Never when followed by a noun
  // ("le dernier rapport" is an adjective).
  if (
    (/(?:^|\s)(?:le|la)\s+(?:dernier|derniere)\s*$/.test(normalized) ||
      /(?:^|\s)the\s+last(?:\s+one)?\s*$/.test(normalized)) &&
    !words.includes("chose") &&
    !words.includes("time")
  ) {
    return { index: -1, isLast: true };
  }

  // "le premier" / "la première" / "the first one"
  for (const key of ["premier", "premiere", "first", "second", "seconde", "deuxieme", "troisieme", "third", "quatrieme", "fourth", "cinquieme", "fifth"]) {
    if (
      normalized.includes(` ${key} `) ||
      normalized.startsWith(`${key} `) ||
      normalized.endsWith(` ${key}`) ||
      normalized === key
    ) {
      // Exclude "première chose à faire", "first thing"
      if (words.some((w, i) => (w === key || w === `${key}`) && (words[i + 1] === "chose" || words[i + 1] === "thing"))) {
        continue;
      }
      const index = ORDINAL_INDEX[key];
      if (index !== undefined) {
        const entityType = ordinalEntityType(normalized);
        return { index, isLast: false, entityType };
      }
    }
  }

  // "les deux premières" / "the first two" / "les deux"
  const twoFirst = normalized.match(/(?:les|the)\s+(?:deux|two)\s+(?:premieres|premières|first)/);
  if (twoFirst) return { index: 0, isLast: false, count: 2 };
  if (normalized === "les deux" || normalized === "the two" || normalized === "les deux premieres" || normalized === "the first two") {
    return { index: 0, isLast: false, count: 2 };
  }

  return null;
}

/** "la deuxième tâche" → task ; "le deuxième projet" → project */
function ordinalEntityType(normalized: string): MemoryEntityRef["type"] | null {
  if (normalized.includes("tache") || normalized.includes("task")) return "task";
  if (normalized.includes("projet") || normalized.includes("project")) return "project";
  if (normalized.includes("objectif") || normalized.includes("goal")) return "goal";
  return null;
}

// ------------------------------------------------------------
// Pronoun / demonstrative patterns
// ------------------------------------------------------------

const PRONOUN_PATTERNS = [
  "celle-ci",
  "celle ci",
  "celle-la",
  "celle la",
  "celui-ci",
  "celui ci",
  "celui-la",
  "celui la",
  "celle dont on parlait",
  "celui dont on parlait",
  "cette tache-la",
  "cette tache la",
  "cette tache",
  "cette action",
  "ce projet-la",
  "ce projet la",
  "ce projet",
  "cet objectif",
  "cet objectif-la",
  "this task",
  "that task",
  "this project",
  "that project",
  "this goal",
  "that goal",
  "la tache precedente",
  "le projet precedent",
  "la precedente",
  "le precedent",
  "the previous",
  "the task",
  "the project",
];

/**
 * Pronominal verb suffixes: "reporte-la", "supprime-les", "mets la en
 * urgente", "supprime le" (end of sentence). The pronoun must be a
 * real pronoun — followed by end-of-sentence, a preposition/adverb, or
 * attached with a hyphen. "supprime les doublons" does NOT match
 * ("les doublons" is an object, not a reference).
 */
const VERB_SUFFIX_RE =
  /(?:^|\b)(reporte|reportes|supprime|supprimes|mets|met|passe|passes|termine|terminer|finis|annule|annules|decale|décale|modifie|marque|renvoie|ouvre|complete|completes|valide)(?:-(la|le|les)|\s+(la|le|les)\s+(?:a|au|aux|pour|de|du|en|sur|avec|à|maintenant|aujourd|demain|vite|tout)\b|\s+(la|le|les)$)/;

/** Standalone action verbs with an implicit target ("Finalement
 *  annule", "Supprime."). Only short phrases — an explicit object
 *  ("Supprime les doublons") must never hijack the last target. */
const VERB_ALONE_RE = /(?:^|\b)(annule|supprime|termine|finis|complete|confirme)\s*$/;

const REPEAT_PATTERNS = ["pareil", "fais la meme chose", "faire la meme chose", "la meme chose", "do the same", "the same thing", "same thing"];

const WHY_PATTERNS = ["pourquoi", "why"];

// ------------------------------------------------------------
// Date matching ("celui de vendredi")
// ------------------------------------------------------------

const DAY_WORDS: Record<string, number> = {
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
  dimanche: 0,
  sunday: 0,
};

function dayFromQuery(normalized: string): number | null {
  for (const [word, day] of Object.entries(DAY_WORDS)) {
    if (normalized.includes(word)) return day;
  }
  if (normalized.includes("demain") || normalized.includes("tomorrow")) return (new Date().getDay() + 1) % 7;
  if (normalized.includes("aujourd") || normalized.includes("today")) return new Date().getDay();
  return null;
}

function matchesDay(dueDate: string | null | undefined, day: number): boolean {
  if (!dueDate) return false;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;
  // The requested weekday must match the entity's own weekday
  // ("celui de vendredi" → a task due on a Friday).
  return date.getDay() === day;
}

// ------------------------------------------------------------
// Snapshot name lookup (explicit references, never invented)
// ------------------------------------------------------------

function findNamedInSnapshot(
  snapshot: WorkspaceSnapshot,
  normalized: string
): { entity: MemoryEntityRef; target: IntelligenceTarget } | null {
  const q = normalized;

  const byTitle = snapshot.tasks.find(
    (task) => task.title.length >= 3 && q.includes(task.title.toLowerCase())
  );
  if (byTitle) {
    const projectName = byTitle.project_id
      ? snapshot.projects.find((p) => p.id === byTitle.project_id)?.name ?? null
      : null;
    const entity: MemoryEntityRef = {
      id: byTitle.id,
      title: byTitle.title,
      type: "task",
      dueDate: byTitle.due_at ?? null,
      projectName,
    };
    return { entity, target: { type: "task", id: byTitle.id, label: byTitle.title } };
  }

  const byName = snapshot.projects.find(
    (project) => project.name.length >= 3 && q.includes(project.name.toLowerCase())
  );
  if (byName) {
    const entity: MemoryEntityRef = {
      id: byName.id,
      title: byName.name,
      type: "project",
      dueDate: byName.due_date ?? null,
      projectName: null,
    };
    return { entity, target: { type: "project", id: byName.id, label: byName.name } };
  }

  const byGoal = snapshot.goals.find(
    (goal) => goal.title.length >= 3 && q.includes(goal.title.toLowerCase())
  );
  if (byGoal) {
    const entity: MemoryEntityRef = {
      id: byGoal.id,
      title: byGoal.title,
      type: "goal",
      dueDate: byGoal.target_date ?? null,
      projectName: null,
    };
    return { entity, target: { type: "goal", id: byGoal.id, label: byGoal.title } };
  }

  return null;
}

// ------------------------------------------------------------
// Candidate helpers
// ------------------------------------------------------------

function pickCandidates(memory: IntelligenceMemoryState): MemoryEntityRef[] {
  const seen = new Set<string>();
  const candidates: MemoryEntityRef[] = [];
  if (memory.lastTarget?.id) {
    const match = memory.lastItems.find((item) => item.id === memory.lastTarget?.id);
    if (match) {
      candidates.push(match);
      seen.add(match.id);
    }
  }
  for (const item of memory.lastItems) {
    if (seen.has(item.id)) continue;
    candidates.push(item);
    seen.add(item.id);
    if (candidates.length >= 3) break;
  }
  return candidates;
}

function clarificationFor(candidates: MemoryEntityRef[]): string {
  if (candidates.length === 0) {
    return "De quel élément parlez-vous ? Nommez la tâche ou le projet, ou listez d'abord vos éléments.";
  }
  if (candidates.length === 1) {
    return `Tu parles de « ${candidates[0].title} » ?`;
  }
  const names = candidates.map((c) => `« ${c.title} »`).join(", ");
  return `Tu parles de ${names} ?`;
}

function ambiguous(
  memory: IntelligenceMemoryState,
  reason: string
): ReferenceResolution {
  return {
    kind: "ambiguous",
    candidates: pickCandidates(memory),
    question: clarificationFor(pickCandidates(memory)),
    reason,
  };
}

// ------------------------------------------------------------
// Main resolver
// ------------------------------------------------------------

export function resolveReference(
  query: string,
  memory: IntelligenceMemoryState | undefined,
  snapshot: WorkspaceSnapshot,
  options?: { verify?: boolean }
): ReferenceResolution {
  const normalized = normalize(query);
  if (!normalized) return { kind: "none", reason: "requête vide" };

  /** Guards a concrete resolution:
   *  1. The memory itself knows the id was deleted (invalidation) —
   *     always reported as "deleted", never re-used.
   *  2. When verify is true (server side, fresh snapshot) an id that no
   *     longer exists in the workspace is also reported as "deleted".
   */
  const guard = (resolution: ReferenceResolution): ReferenceResolution => {
    if (!resolution.entity?.id) return resolution;
    const { id, type } = resolution.entity;
    const deletedInMemory = memory?.deletedEntityIds?.includes(id);
    if (deletedInMemory) {
      return {
        kind: "deleted",
        entity: resolution.entity,
        target: resolution.target,
        reason: `l'entité « ${resolution.entity.title} » a été supprimée (mémoire invalidée)`,
      };
    }
    if (options?.verify) {
      const exists =
        type === "task"
          ? snapshot.tasks.some((t) => t.id === id)
          : type === "project"
            ? snapshot.projects.some((p) => p.id === id)
            : snapshot.goals.some((g) => g.id === id);
      if (!exists) {
        return {
          kind: "deleted",
          entity: resolution.entity,
          target: resolution.target,
          reason: `l'entité « ${resolution.entity.title} » n'existe plus dans le workspace`,
        };
      }
    }
    return resolution;
  };

  // 1. Explicit name in the snapshot wins (the user named the entity).
  const named = findNamedInSnapshot(snapshot, normalized);
  if (named) {
    return guard({
      kind: "explicit",
      target: named.target,
      entity: named.entity,
      reason: "entité nommée trouvée dans le snapshot",
    });
  }

  if (!memory || (memory.lastItems.length === 0 && !memory.lastTarget?.id)) {
    // Referential request but no context at all → clarify, never guess.
    if (isClearlyReferential(normalized)) {
      return ambiguous(memory ?? emptyForClarification(), "référence sans contexte mémoire");
    }
    return { kind: "none", reason: "aucune mémoire et requête non référentielle" };
  }

  // The last discussed target — even when it was deleted (so a
  // follow-up reference is honestly reported as "n'existe plus"
  // instead of silently re-targeting another item).
  const lastTarget: MemoryEntityRef | undefined = memory.lastTarget?.id
    ? memory.lastItems.find((item) => item.id === memory.lastTarget?.id) ??
      {
        id: memory.lastTarget.id,
        title: memory.lastTarget.label ?? "Item",
        type: memory.lastTarget.type === "project" ? "project" : memory.lastTarget.type === "goal" ? "goal" : "task",
      }
    : memory.lastItems[0];

  // 2. Ordinals: "la deuxième" indexes into the last displayed list.
  const ordinal = parseOrdinal(normalized);
  if (ordinal) {
    let pool = memory.lastItems;
    if (ordinal.entityType) pool = pool.filter((item) => item.type === ordinal.entityType);
    if (pool.length === 0) {
      return ambiguous(memory, "ordinal mais aucun item du type demandé");
    }
    let target: MemoryEntityRef | undefined;
    let index: number | null = null;
    if (ordinal.isLast) {
      target = pool[pool.length - 1];
      index = pool.length - 1;
    } else if (ordinal.count !== undefined) {
      target = pool[0];
      index = 0;
      // "les deux premières" → reference the first one (plural handled by caller)
    } else {
      index = ordinal.index;
      target = pool[index];
    }
    if (!target) {
      return ambiguous(memory, `index ordinal ${ordinal.index} hors bornes (${pool.length} éléments)`);
    }
    return guard({
      kind: "ordinal",
      target: { type: target.type, id: target.id, label: target.title },
      entity: target,
      index,
      reason: `ordinal résolu dans la liste affichée (${pool.length} éléments)`,
    });
  }

  // 3. "celui/celle de vendredi" → match by due date among last items,
  //    then among real snapshot rows.
  const day = dayFromQuery(normalized);
  if (day !== null && (normalized.includes("celui") || normalized.includes("celle") || normalized.includes("celui de") || normalized.includes("the one"))) {
    const byDate = memory.lastItems.find((item) => matchesDay(item.dueDate, day));
    if (byDate) {
      return guard({
        kind: "explicit",
        target: { type: byDate.type, id: byDate.id, label: byDate.title },
        entity: byDate,
        reason: "référence par jour de la semaine (mémoire)",
      });
    }
    const taskByDate = snapshot.tasks.find((t) => matchesDay(t.due_at, day));
    if (taskByDate) {
      const projectName = taskByDate.project_id
        ? snapshot.projects.find((p) => p.id === taskByDate.project_id)?.name ?? null
        : null;
      const entity: MemoryEntityRef = { id: taskByDate.id, title: taskByDate.title, type: "task", dueDate: taskByDate.due_at ?? null, projectName };
      return guard({
        kind: "explicit",
        target: { type: "task", id: taskByDate.id, label: taskByDate.title },
        entity,
        reason: "référence par jour de la semaine (snapshot)",
      });
    }
    return { kind: "none", reason: "aucun élément ne correspond à ce jour" };
  }

  // 4. Verb suffixes: "reporte-la", "supprime-la", "mets-la en urgente".
  const verbSuffix = normalized.match(VERB_SUFFIX_RE);
  if (verbSuffix) {
    if (!lastTarget) {
      return ambiguous(memory, "suffixe pronominal sans cible mémorisée");
    }
    return guard({
      kind: "verb-suffix",
      target: { type: lastTarget.type, id: lastTarget.id, label: lastTarget.title },
      entity: lastTarget,
      reason: `suffixe pronominal "${verbSuffix[0]}" résolu sur la dernière cible`,
    });
  }

  // 5. Repeat: "pareil", "fais la même chose".
  if (REPEAT_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    if (!lastTarget) {
      return ambiguous(memory, "« pareil » sans cible mémorisée");
    }
    return guard({
      kind: "repeat",
      target: { type: lastTarget.type, id: lastTarget.id, label: lastTarget.title },
      entity: lastTarget,
      reason: "répétition de la dernière action sur la dernière cible",
    });
  }

  // 6. "pourquoi ?" → the subject just discussed.
  if (WHY_PATTERNS.some((pattern) => normalized.startsWith(pattern) || normalized === pattern)) {
    if (!lastTarget) {
      return { kind: "none", reason: "« pourquoi » sans sujet mémorisé" };
    }
    return guard({
      kind: "why",
      target: { type: lastTarget.type, id: lastTarget.id, label: lastTarget.title },
      entity: lastTarget,
      reason: "« pourquoi » rattaché au dernier sujet discuté",
    });
  }

  // 7. Pronouns / demonstratives / "previous".
  const pronounMatch = PRONOUN_PATTERNS.find((pattern) => normalized.includes(pattern));
  if (pronounMatch) {
    if (!lastTarget) {
      return ambiguous(memory, "pronom démonstratif sans cible mémorisée");
    }
    const kind = pronounMatch.includes("precedent") || pronounMatch.includes("previous")
      ? "previous"
      : "pronoun";
    return guard({
      kind,
      target: { type: lastTarget.type, id: lastTarget.id, label: lastTarget.title },
      entity: lastTarget,
      reason: `référence « ${pronounMatch} » résolue sur la dernière cible`,
    });
  }

  // 8. Standalone action verb, short phrase ("Finalement annule").
  // An explicit object ("Supprime les doublons") is never hijacked.
  if (normalized.length <= 24 && VERB_ALONE_RE.test(normalized)) {
    if (!lastTarget) {
      return ambiguous(memory, "verbe d'action isolé sans cible mémorisée");
    }
    return guard({
      kind: "verb-suffix",
      target: { type: lastTarget.type, id: lastTarget.id, label: lastTarget.title },
      entity: lastTarget,
      reason: `verbe d'action isolé (« ${normalized} ») résolu sur la dernière cible`,
    });
  }

  return { kind: "none", reason: "aucune référence détectée" };
}

function isClearlyReferential(normalized: string): boolean {
  return (
    parseOrdinal(normalized) !== null ||
    PRONOUN_PATTERNS.some((pattern) => normalized.includes(pattern)) ||
    VERB_SUFFIX_RE.test(normalized) ||
    REPEAT_PATTERNS.some((pattern) => normalized.includes(pattern)) ||
    normalized === "pourquoi" ||
    normalized.startsWith("pourquoi ")
  );
}

function emptyForClarification(): IntelligenceMemoryState {
  return {
    conversationId: "none",
    lastItems: [],
    deletedEntityIds: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Converts a resolution into a target when concrete. */
export function resolutionToTarget(
  resolution: ReferenceResolution
): IntelligenceTarget | undefined {
  return resolution.kind === "explicit" ||
    resolution.kind === "ordinal" ||
    resolution.kind === "pronoun" ||
    resolution.kind === "previous" ||
    resolution.kind === "verb-suffix" ||
    resolution.kind === "repeat" ||
    resolution.kind === "why"
    ? resolution.target
    : undefined;
}
