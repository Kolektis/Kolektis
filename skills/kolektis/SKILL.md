---
name: kolektis
description: |
  Kolektis — traitement automatique de documents PDF (OCR + extraction + structuration).
  Utilise cette skill quand l'utilisateur mentionne Kolektis, veut traiter/analyser des PDFs,
  extraire des données depuis des documents (courriers, factures, SDC, sinistres, contrats, relevés),
  ou poser des questions sur des résultats Kolektis déjà extraits.
  Trigger keywords: kolektis, extraction PDF, traitement documentaire, analyse de documents,
  SDC, sinistres, structured data, analyse facture, OCR PDF, process PDF.
---

# Kolektis — Traitement Automatique de Documents PDF

## Comment ça marche

Cette skill orchestre le traitement de PDFs via le serveur MCP Kolektis.
Le MCP server gère la communication avec l'API — l'authentification se fait
par clé API, configurée à l'installation du plugin.

## Outils MCP disponibles

| Outil | Usage |
|-------|-------|
| `kolektis_process_pdf` | Traiter un seul PDF (envoie le base64, reçoit le texte extrait + structured) |
| `kolektis_account_info` | Vérifier le plan, crédits restants, usage du mois |
| `kolektis_check_credits` | Vérifier rapidement les crédits avant un batch |

## Workflow

### Premier contact

Quand l'utilisateur demande un traitement de documents :

1. Vérifie que l'utilisateur a sélectionné un dossier contenant des PDFs
2. Liste les PDFs trouvés avec `Glob` ou `ls`
3. Présente un résumé (nombre, noms des fichiers)
4. Vérifie les crédits avec `kolektis_check_credits`
5. Demande confirmation avant de lancer — chaque traitement consomme 1 crédit

### Traitement

Pour chaque PDF :

1. Lis le fichier PDF avec l'outil `Read` (il retourne le contenu)
2. Encode le contenu en base64 via Bash : `base64 -w0 /chemin/vers/fichier.pdf`
3. Appelle `kolektis_process_pdf` avec le nom du fichier et le base64
4. Informe l'utilisateur de la progression : "Traitement 3/12 — facture_mars.pdf..."
5. Après chaque fichier, vérifie qu'il n'y a pas eu d'erreur de crédits

**Important** :
- Traite les fichiers un par un (pas de parallélisme)
- Si > 10 fichiers : traite par lots de 10, informe de la progression
- Après chaque lot, vérifie les crédits avec `kolektis_check_credits`

### Sauvegarde

Après traitement, sauvegarde les résultats dans un sous-dossier `kolektis_results/` :

- Un JSON par document : `{nom_original}_result.json`
- Un récapitulatif `summary.json` :

```json
{
  "processed_at": "2026-03-22T10:30:00Z",
  "total_files": 6,
  "succeeded": 6,
  "failed": 0,
  "files": ["doc1.pdf", "doc2.pdf"]
}
```

### Exploitation

Une fois les résultats disponibles, l'utilisateur peut poser des questions. Pour répondre :

1. Lis les JSON depuis `kolektis_results/` ou utilise les résultats en mémoire
2. Privilégie les données `structured` (propres) plutôt que `extracted` (brut)
3. Croise les données de plusieurs documents si nécessaire
4. Cite les sources (quel document, quelle section)

Exemples de questions :
- "Quel est le montant total des factures ?"
- "Résume les points clés de chaque courrier"
- "Y a-t-il des incohérences entre les documents ?"
- "Crée un tableau récapitulatif de tous les sinistres"

## Gestion des erreurs

| Erreur MCP | Signification | Action |
|------------|---------------|--------|
| "Clé API invalide" | Auth échouée | Dire à l'utilisateur de vérifier sa clé sur kolektis.com/clauder |
| "Crédits insuffisants" | Plus de crédits | Dire de recharger sur kolektis.com/account/billing |
| "Erreur serveur" | Problème backend | Réessayer une fois, puis signaler le problème |

## Première utilisation

Si le MCP server n'est pas connecté ou que les appels échouent :

1. Explique que le plugin nécessite une clé API Kolektis
2. Dirige vers `https://www.kolektis.com/clauder` pour créer un compte gratuit (50 docs/mois)
3. Explique : "Une fois inscrit, copiez votre clé API et ajoutez-la dans les paramètres du plugin Kolektis"

## Bonnes pratiques

- **Toujours demander confirmation** avant de lancer un traitement (ça consomme des crédits)
- **Vérifier les crédits** avant un gros batch avec `kolektis_check_credits`
- **Ne jamais afficher la clé API** dans les réponses à l'utilisateur
- **Sauvegarder les résultats** systématiquement dans `kolektis_results/`
- **Gérer les gros volumes** : informer de la progression, proposer de traiter par lots
