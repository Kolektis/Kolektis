---
name: kolektis
description: |
  Kolektis document processing — analyse automatique de PDFs via l'API Kolektis.
  Utilise cette skill chaque fois que l'utilisateur mentionne Kolektis, veut traiter ou analyser des documents PDF
  via une API de traitement documentaire, ou souhaite extraire et structurer des données depuis des PDFs
  (courriers, factures, SDC, sinistres, contrats, relevés, etc.). Active aussi quand l'utilisateur veut poser
  des questions sur le contenu extrait de documents déjà traités par Kolektis.
  Trigger keywords: kolektis, process-aurelien, extraction PDF, traitement documentaire, analyse de documents,
  SDC, sinistres, structured data from PDF, extraction courrier, analyse facture.
---

# Kolektis Document Processing

## Vue d'ensemble

Cette skill orchestre le traitement automatique de documents PDF via l'API Kolektis.
Le MCP server `kolektis` gère la communication avec l'API — l'authentification se fait
par clé API, configurée une seule fois à l'installation du plugin.

## Outils MCP disponibles

| Outil | Usage |
|-------|-------|
| `kolektis_process_pdf` | Traiter un seul PDF |
| `kolektis_process_batch` | Traiter plusieurs PDFs d'un coup |
| `kolektis_list_results` | Lister les documents traités dans la session |
| `kolektis_get_result` | Récupérer le résultat détaillé d'un document |
| `kolektis_account_info` | Vérifier les crédits restants et l'usage |

## Workflow

### Premier contact

Quand l'utilisateur demande un traitement de documents :

1. Vérifie que l'utilisateur a sélectionné un dossier contenant des PDFs
2. Liste les PDFs trouvés avec `Glob` ou `ls`
3. Présente un résumé (nombre, noms des fichiers)
4. Demande confirmation avant de lancer — chaque traitement consomme des crédits

### Traitement

1. Si ≤ 10 fichiers : utilise `kolektis_process_batch` en une seule fois
2. Si > 10 fichiers : traite par lots de 10, informe de la progression
3. Après chaque lot, vérifie qu'il n'y a pas eu d'erreur de crédits (402)

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

1. Lis les JSON depuis `kolektis_results/` ou utilise `kolektis_get_result`
2. Privilégie les données `structured` (propres) plutôt que `extracted` (brut)
3. Croise les données de plusieurs documents si nécessaire
4. Cite les sources (quel document, quelle section)

## Gestion des erreurs

| Code | Signification | Action |
|------|---------------|--------|
| 401 | Clé API invalide | Dire à l'utilisateur de vérifier sa clé sur kolektis.com/account |
| 402 | Crédits insuffisants | Dire à l'utilisateur de recharger sur kolektis.com/account/billing |
| 429 | Rate limit | Attendre 30 secondes puis réessayer |
| 5xx | Erreur serveur | Réessayer une fois, puis signaler le problème |

## Première utilisation (clé API manquante)

Si le MCP server n'est pas connecté ou que l'appel échoue avec une erreur d'API key :

1. Explique que le plugin nécessite une clé API Kolektis
2. Dirige vers `https://www.kolektis.com/signup` pour créer un compte
3. Explique : "Une fois inscrit, copiez votre clé API depuis votre tableau de bord et ajoutez-la dans les paramètres du plugin Kolektis"
