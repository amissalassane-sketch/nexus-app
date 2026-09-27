// ============================================================
// NEXUS INTELLIGENCE — TYPED I18N DICTIONARY
// ============================================================
// Centralizes all user-facing strings, evidence labels and
// panel messages for the Intelligence engine and components.
// Decouples UI rendering from test assertions and guarantees
// consistent bilingual (FR/EN) support.
// ============================================================

export type IntelligenceLocale = "fr" | "en";

export interface IntelligenceStrings {
  signals: {
    evidence: {
      overdue: string;
      priority: string;
      progress: string;
      project: string;
      blockedBy: string;
      inactiveFor: string;
      openTasks: string;
      due: string;
      linkedProjects: string;
    };
    staleProjectTitle: (projectName: string) => string;
    entityPrefix: string;
    offlineMessage: string;
    confirmAction: string;
    dismissAriaLabel: string;
  };
  mission: {
    nextBestAction: string;
    recommended: string;
    open: string;
    completedNotice: string;
    confirmPrompt: (label: string) => string;
    defaultMutationNotice: string;
    highRiskNotice: string;
    confirmAction: string;
    cancelAction: string;
    confirmCancelPrompt: (title: string) => string;
    cancelWarning: string;
    cancelMission: string;
    keepMission: string;
    seeWhy: string;
    hideContext: string;
    whyThisMission: string;
    offlineMessage: string;
    blockedBadge: string;
    completedBadge: string;
    objectiveEyebrow: string;
    stepsCounter: (completed: number, total: number) => string;
    progressLabel: string;
    unblockAction: string;
    continueAction: string;
  };
}

export const FR_INTELLIGENCE_STRINGS: IntelligenceStrings = {
  signals: {
    evidence: {
      overdue: "En retard de",
      priority: "Priorité",
      progress: "Progression",
      project: "Projet",
      blockedBy: "Bloqué par",
      inactiveFor: "Sans activité depuis",
      openTasks: "Tâches ouvertes",
      due: "Échéance",
      linkedProjects: "Projets liés",
    },
    staleProjectTitle: (name: string) => `"${name}" : activité faible`,
    entityPrefix: "Concerne :",
    offlineMessage: "Les signaux affichés restent disponibles.",
    confirmAction: "Confirmer et exécuter",
    dismissAriaLabel: "Ignorer ce signal",
  },
  mission: {
    nextBestAction: "Prochaine meilleure action",
    recommended: "Recommandé",
    open: "Ouvrir",
    completedNotice: "Mission terminée. Toutes les étapes sont vérifiées.",
    confirmPrompt: (label: string) => `Confirmer « ${label} » ?`,
    defaultMutationNotice: "Cette action modifiera votre workspace.",
    highRiskNotice: "Action destructive. Exécutée côté serveur puis vérifiée.",
    confirmAction: "Confirmer et exécuter",
    cancelAction: "Annuler",
    confirmCancelPrompt: (title: string) => `Annuler la mission « ${title} » ?`,
    cancelWarning: "La mission et ses étapes ne seront plus suggérées. Aucune tâche ni projet n'est supprimé.",
    cancelMission: "Annuler la mission",
    keepMission: "Conserver",
    seeWhy: "Voir pourquoi",
    hideContext: "Masquer le contexte",
    whyThisMission: "Voir pourquoi cette mission ?",
    offlineMessage: "Les dernières informations affichées restent disponibles.",
    blockedBadge: "Bloquée",
    completedBadge: "Terminée",
    objectiveEyebrow: "Objectif",
    stepsCounter: (c: number, t: number) => `${c}/${t} étapes`,
    progressLabel: "Progression",
    unblockAction: "Débloquer",
    continueAction: "Continuer",
  },
};

export const EN_INTELLIGENCE_STRINGS: IntelligenceStrings = {
  signals: {
    evidence: {
      overdue: "Overdue by",
      priority: "Priority",
      progress: "Progress",
      project: "Project",
      blockedBy: "Blocked by",
      inactiveFor: "Inactive for",
      openTasks: "Open tasks",
      due: "Due",
      linkedProjects: "Linked projects",
    },
    staleProjectTitle: (name: string) => `"${name}" has been inactive`,
    entityPrefix: "About:",
    offlineMessage: "Connection lost. The signals shown are still available.",
    confirmAction: "Confirm and run",
    dismissAriaLabel: "Dismiss this signal",
  },
  mission: {
    nextBestAction: "Next best action",
    recommended: "Recommended",
    open: "Open",
    completedNotice: "Mission completed. All steps are verified.",
    confirmPrompt: (label: string) => `Confirm "${label}"?`,
    defaultMutationNotice: "This action will modify your workspace.",
    highRiskNotice: "Destructive action. Executed server-side and then verified.",
    confirmAction: "Confirm and run",
    cancelAction: "Cancel",
    confirmCancelPrompt: (title: string) => `Cancel mission "${title}"?`,
    cancelWarning: "The mission and its steps will no longer be suggested. This does not delete any task or project.",
    cancelMission: "Cancel mission",
    keepMission: "Keep",
    seeWhy: "See why",
    hideContext: "Hide context",
    whyThisMission: "Why this mission?",
    offlineMessage: "Connection lost. The information shown is still available.",
    blockedBadge: "Blocked",
    completedBadge: "Completed",
    objectiveEyebrow: "Objective",
    stepsCounter: (c: number, t: number) => `${c}/${t} steps`,
    progressLabel: "Progress",
    unblockAction: "Unblock",
    continueAction: "Continue",
  },
};

/** Active default dictionary — canonical for the NEXUS interface. */
export const INTELLIGENCE_I18N = FR_INTELLIGENCE_STRINGS;
