# Documents, budgets IA et observabilité — état technique

## Documents
Existant : UI `files-manager`, limite 10 MiB, extension/MIME déclaratif, upload bucket privé, métadonnées workspace/uploaded_by, suppression et compensation objet si insertion metadata refusée, plans file-count.

**NOT_IMPLEMENTED :** chaîne complète PDF/DOCX/TXT/MD/CSV/XLSX/images. Aucun parseur OCR, antivirus/magic-byte, job extraction, structure, chunker, embedding index, retrieve avec ACL par chunk, citations page/section, qualité OCR, rescan ou purge dérivés n'a été livré dans cette mission. Ne pas assimiler le téléchargement d'un PDF à son analyse.

Architecture de prochaine tranche, pas code livré :
1. Enregistrement ownership + workspace + MIME réel + hash + taille + état/quarantine.
2. Job idempotent avec limites temps/mémoire/pages/archives, annulation et erreur explicite.
3. Extracteur par type préservant pages/paragraphes/cellules ; images OCR sandboxé.
4. Chunks versionnés portant document/version/page/section, ACL courantes et hash.
5. Index par workspace, exclusion suppression/revocation ; filtre RLS avant retrieval et avant envoi.
6. Envoi IA du strict sous-ensemble nécessaire et budget tokens, données sensibles expurgées selon politique validée.
7. Réponse citée, zéro source si aucune preuve, export données+provenance, suppression Storage+index+dérivés avec reprise.

## Observabilité
Implémenté auparavant : logs requêtes provider/status/duration partiels, UI admin sépare clés et mesures, erreurs publiques normalisées, sync runs + telemetry ajoutée sans inventer des compteurs. Nouveau job purge ne journalise que compte/statut. Tests signature SDK ne créent aucune métrique réelle.

Manquant : contrat uniforme requestId/correlationId/provider/operation/durationMs/status/retryCount/errorCode à travers routes/jobs/provider ; logs traces liés sans contenu sensible ; métriques tokens/coût depuis usage réel, modèle/prix effectif, lastSuccess/lastError ; alarmes SLO/worker heartbeat/backlog/DB/storage/connection freshness testées ; autorité non modifiable par membre. Coût null ≠ coût 0.

Budgets user + workspace + plan + provider : réserver avant requête dans une transaction, limites requêtes/tokens/coût/période UTC, réconcilier usage réel et retry, bornes timeout/output, alerter plutôt que dépasser silencieusement, ne pas faire payer deux fois les retries. **Ce système complet n'est pas implémenté**. Entitlement facade `billing/entitlements` est fail-closed pour fonctionnalités futures sans politique approuvée ; ce n'est pas une activation commerciale de nouvelles capacités.
