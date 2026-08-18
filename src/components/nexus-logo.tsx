"use client";

export function NexusLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  /**
   * NEXUS Logo — Convergence Cut
   *
   * Direction: N construit en espace négatif par découpe à 14°
   * Grille: 32px conceptuelle
   * Découpe: ~5px
   * Lisible: 16px+
   * Couleur: Adaptative (hérite de la couleur de texte ou se définit en prop)
   */

  const viewBox = `0 0 32 32`;
  const strokeWidth = Math.max(1.5, size / 20); // Scales with size

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NEXUS"
    >
      {/* Carré avec coins arrondis — forme extérieure */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="7"
        ry="7"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />

      {/* N construit en espace négatif par découpe géométrique à 14° */}
      {/* Trait diagonal principal (de haut-gauche à bas-droite) */}
      <line
        x1="10"
        y1="8"
        x2="22"
        y2="24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Trait vertical gauche du N */}
      <line
        x1="10"
        y1="8"
        x2="10"
        y2="24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Trait vertical droit du N */}
      <line
        x1="22"
        y1="8"
        x2="22"
        y2="24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
