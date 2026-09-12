// Lightweight onboarding copy. No app-wide i18n existed — keep EN/FR here.

export type Locale = "en" | "fr";

const EN = {
  "welcome.kicker": "Welcome to NEXUS",
  "welcome.title": "Set up your workspace.",
  "welcome.body": "Add a project and a first task, and NEXUS starts reading your work.",
  "welcome.start": "Get started",
  "welcome.explore": "Skip the guide",
  "guide.kicker": "NEXUS Guide",
  "guide.skip": "Skip for now",
  "guide.continue": "Continue",
  "guide.fallback": "That control isn’t on this screen. Continue when you’re ready.",
  "guide.actionHint": "This step finishes when the work exists, not when you click next.",
  "guide.skipStep": "Skip this step",
  "guide.retry": "Retry",
  "guide.welcome.title": "Welcome to NEXUS.",
  "guide.welcome.body":
    "A few real steps: a project, a task, and one question to NEXUS.",
  "guide.welcome.action": "Get started",
  "guide.navigate_projects.title": "First, create your first project.",
  "guide.navigate_projects.body":
    "Projects are where you organize a major piece of work. Open Projects in the sidebar.",
  "guide.navigate_projects.action": "Open Projects",
  "guide.create_project.title": "You’re in Projects.",
  "guide.create_project.body":
    "Create your first project. Give it a name and save it. NEXUS can only read projects that exist.",
  "guide.create_project.action": "New project",
  "guide.navigate_tasks.title": "Your first project is ready.",
  "guide.navigate_tasks.body":
    "Now give that project something to work on. Open Tasks.",
  "guide.navigate_tasks.action": "Open Tasks",
  "guide.create_task.title": "Create your first task.",
  "guide.create_task.body":
    "Tasks turn projects into executable work. Add a real task to continue.",
  "guide.create_task.action": "New task",
  "guide.navigate_intelligence.title": "Next, the intelligence layer.",
  "guide.navigate_intelligence.body":
    "NEXUS Intelligence reads your workspace and answers questions about it. Open Intelligence.",
  "guide.navigate_intelligence.action": "Open Intelligence",
  "guide.interact_intelligence.title": "Ask NEXUS about your workspace.",
  "guide.interact_intelligence.body":
    "Try “What should I work on first?” Sending the question is what counts.",
  "guide.interact_intelligence.action": "Ask NEXUS",
  "activated.title": "You’re ready.",
  "activated.body": "You’ve completed the essentials. The workspace is yours.",
  "checklist.title": "Get started",
  "checklist.progress": "Workspace progress",
  "checklist.project": "Create your first project",
  "checklist.task": "Create your first task",
  "checklist.intelligence": "Try NEXUS Intelligence",
  "checklist.goal": "Create your first goal",
  "checklist.restart": "Restart the guide",
  "tip.projects.title": "Projects",
  "tip.projects.body": "Projects are where your major work lives.",
  "tip.tasks.title": "Tasks",
  "tip.tasks.body": "Tasks turn projects into executable work.",
  "tip.goals.title": "Goals",
  "tip.goals.body": "Goals help you keep your work aligned with outcomes.",
  "tip.intelligence.title": "Intelligence",
  "tip.intelligence.body": "Intelligence reads your workspace and points to what needs attention.",
  "tip.settings.title": "Settings",
  "tip.settings.body": "Manage your workspace and preferences here.",
  "tip.gotIt": "Got it",
  "help.title": "Help",
  "help.continue": "Continue setup",
  "help.replay": "Replay product tour",
  "help.shortcuts": "Shortcuts: ⌘K search · C create · Esc close",
  "ask.placeholder": "What should I work on first?",
  "ask.send": "Ask",
  "ask.empty": "Write a short question about this workspace.",
} as const;

const FR: Record<keyof typeof EN, string> = {
  "welcome.kicker": "Bienvenue dans NEXUS",
  "welcome.title": "Configurez votre espace.",
  "welcome.body":
    "Ajoutez un projet et une première tâche, et NEXUS commence à lire votre travail.",
  "welcome.start": "Commencer",
  "welcome.explore": "Passer le guide",
  "guide.kicker": "Guide NEXUS",
  "guide.skip": "Passer pour l’instant",
  "guide.continue": "Continuer",
  "guide.fallback":
    "Cet élément n’est pas sur cet écran. Continuez quand vous êtes prêt.",
  "guide.actionHint":
    "Cette étape se termine lorsque le travail existe, pas au clic suivant.",
  "guide.skipStep": "Passer cette étape",
  "guide.retry": "Réessayer",
  "guide.welcome.title": "Bienvenue dans NEXUS.",
  "guide.welcome.body":
    "Quelques étapes réelles : un projet, une tâche, une question à NEXUS.",
  "guide.welcome.action": "Commencer",
  "guide.navigate_projects.title": "D’abord, créez votre premier projet.",
  "guide.navigate_projects.body":
    "Les projets organisent un ensemble de travail. Ouvrez Projets dans la barre latérale.",
  "guide.navigate_projects.action": "Ouvrir Projets",
  "guide.create_project.title": "Vous êtes dans Projets.",
  "guide.create_project.body":
    "Créez votre premier projet. Donnez-lui un nom et enregistrez-le. NEXUS ne lit que les projets qui existent.",
  "guide.create_project.action": "Nouveau projet",
  "guide.navigate_tasks.title": "Votre premier projet est prêt.",
  "guide.navigate_tasks.body":
    "Donnez maintenant du travail à ce projet. Ouvrez Tâches.",
  "guide.navigate_tasks.action": "Ouvrir Tâches",
  "guide.create_task.title": "Créez votre première tâche.",
  "guide.create_task.body":
    "Les tâches rendent les projets exécutables. Ajoutez une vraie tâche pour continuer.",
  "guide.create_task.action": "Nouvelle tâche",
  "guide.navigate_intelligence.title": "La couche Intelligence.",
  "guide.navigate_intelligence.body":
    "NEXUS Intelligence lit votre espace et répond à vos questions. Ouvrez Intelligence.",
  "guide.navigate_intelligence.action": "Ouvrir Intelligence",
  "guide.interact_intelligence.title": "Interrogez NEXUS sur votre espace.",
  "guide.interact_intelligence.body":
    "Essayez « Sur quoi dois-je travailler d’abord ? ». Envoyer la question, c’est ce qui compte.",
  "guide.interact_intelligence.action": "Demander à NEXUS",
  "activated.title": "Vous êtes prêt.",
  "activated.body":
    "L’essentiel est en place. L’espace vous appartient.",
  "checklist.title": "Pour commencer",
  "checklist.progress": "Avancement de l’espace",
  "checklist.project": "Créer votre premier projet",
  "checklist.task": "Créer votre première tâche",
  "checklist.intelligence": "Essayer NEXUS Intelligence",
  "checklist.goal": "Créer votre premier objectif",
  "checklist.restart": "Relancer le guide",
  "tip.projects.title": "Projets",
  "tip.projects.body": "Les projets accueillent votre travail majeur.",
  "tip.tasks.title": "Tâches",
  "tip.tasks.body": "Les tâches rendent les projets exécutables.",
  "tip.goals.title": "Objectifs",
  "tip.goals.body": "Les objectifs alignent le travail sur les résultats.",
  "tip.intelligence.title": "Intelligence",
  "tip.intelligence.body":
    "Intelligence lit votre espace et signale ce qui mérite attention.",
  "tip.settings.title": "Réglages",
  "tip.settings.body": "Gérez ici l’espace et vos préférences.",
  "tip.gotIt": "Compris",
  "help.title": "Aide",
  "help.continue": "Continuer la configuration",
  "help.replay": "Rejouer le parcours",
  "help.shortcuts": "Raccourcis : ⌘K recherche · C créer · Échap fermer",
  "ask.placeholder": "Sur quoi dois-je travailler d’abord ?",
  "ask.send": "Demander",
  "ask.empty": "Écrivez une courte question sur cet espace.",
};

export type CopyKey = keyof typeof EN;

export function detectLocale(input?: string | null): Locale {
  const raw = (input ?? "").toLowerCase();
  if (raw.startsWith("fr")) return "fr";
  return "en";
}

export function t(key: CopyKey, locale: Locale = "en"): string {
  if (locale === "fr") return FR[key];
  return EN[key];
}

export function browserLocale(): Locale {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return detectLocale(document.documentElement.lang);
  }
  if (typeof navigator !== "undefined") {
    return detectLocale(navigator.language);
  }
  return "en";
}
