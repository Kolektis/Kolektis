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

Cette skill permet de traiter des PDFs via l'API Kolektis (OCR + extraction + structuration).
Tout passe par des appels HTTP directs — **aucune installation requise côté client**.

L'utilisateur a juste besoin de :
1. Un compte Kolektis (gratuit : 50 documents/mois)
2. Sa clé API (obtenue à l'inscription)

## Configuration de la clé API

### Au premier lancement

Si aucune clé API n'est configurée, demande à l'utilisateur :

> Pour utiliser Kolektis, j'ai besoin de votre clé API.
> Si vous n'en avez pas encore, créez un compte gratuit sur **https://www.kolektis.com/clauder**
> (50 documents/mois offerts).
>
> Une fois inscrit, collez votre clé API ici.

### Stockage de la clé

Quand l'utilisateur fournit sa clé (format `kol_...`), sauvegarde-la :

```bash
mkdir -p ~/.kolektis
echo "KOLEKTIS_API_KEY=kol_xxxxx" > ~/.kolektis/config
chmod 600 ~/.kolektis/config
```

### Récupération de la clé

Au début de chaque workflow Kolektis, lis la clé :

```bash
cat ~/.kolektis/config 2>/dev/null
```

Si le fichier n'existe pas → demande la clé à l'utilisateur (voir "Au premier lancement").

## API Reference

**Base URL** : `https://www.kolektis.com`

**Authentification** : Header `X-API-Key: <clé>`

### POST /api/plugin/process — Traiter un PDF

Envoie un PDF et reçoit le texte extrait + données structurées.

```bash
curl -s -X POST "https://www.kolektis.com/api/plugin/process" \
  -H "X-API-Key: $KOLEKTIS_API_KEY" \
  -F "file=@/chemin/vers/document.pdf" \
  2>/dev/null
```

**Réponse** (JSON) :
```json
{
  "success": true,
  "filename": "document.pdf",
  "extracted": "Texte brut extrait du PDF...",
  "structured": { "type": "facture", "montant": "1234.56", ... },
  "credits_remaining": 47
}
```

### GET /api/account — Infos du compte

```bash
curl -s "https://www.kolektis.com/api/account" \
  -H "X-API-Key: $KOLEKTIS_API_KEY" \
  2>/dev/null
```

## Workflow principal

### 1. Initialisation

```
1. Lis la clé API depuis ~/.kolektis/config
2. Si pas de clé → demande à l'utilisateur (voir section Configuration)
3. Vérifie que l'utilisateur a sélectionné un dossier avec des PDFs
4. Liste les PDFs trouvés avec Glob("**/*.pdf")
5. Présente un résumé : nombre de fichiers, noms
6. Demande confirmation avant de traiter (chaque PDF consomme 1 crédit)
```

### 2. Traitement

Pour chaque PDF, exécute via Bash :

```bash
# Lire la clé
KOLEKTIS_API_KEY=$(grep KOLEKTIS_API_KEY ~/.kolektis/config | cut -d= -f2)

# Envoyer le PDF
RESULT=$(curl -s -X POST "https://www.kolektis.com/api/plugin/process" \
  -H "X-API-Key: $KOLEKTIS_API_KEY" \
  -F "file=@/chemin/vers/fichier.pdf" \
  2>/dev/null)

echo "$RESULT"
```

**Important** :
- Traite les fichiers un par un (pas de parallélisme)
- Après chaque fichier, vérifie le code de retour HTTP
- Informe l'utilisateur de la progression : "Traitement 3/12 — facture_mars.pdf..."

### 3. Sauvegarde des résultats

Après traitement, sauvegarde dans un sous-dossier `kolektis_results/` du dossier de l'utilisateur :

```bash
mkdir -p kolektis_results
# Pour chaque fichier traité :
echo "$RESULT" | python3 -m json.tool > "kolektis_results/${FILENAME%.pdf}_result.json"
```

Crée aussi un récapitulatif `kolektis_results/summary.json` :

```json
{
  "processed_at": "2026-03-22T10:30:00Z",
  "total_files": 6,
  "succeeded": 6,
  "failed": 0,
  "files": ["doc1.pdf", "doc2.pdf", "..."]
}
```

### 4. Exploitation des résultats

Une fois les résultats disponibles, l'utilisateur peut poser des questions. Pour répondre :

1. Lis les JSON depuis `kolektis_results/`
2. Privilégie les données `structured` (propres) plutôt que `extracted` (brut)
3. Croise les données de plusieurs documents si nécessaire
4. Cite toujours les sources (quel document, quelle section)

Exemples de questions auxquelles tu peux répondre :
- "Quel est le montant total des factures ?"
- "Résume les points clés de chaque courrier"
- "Y a-t-il des incohérences entre les documents ?"
- "Crée un tableau récapitulatif de tous les sinistres"

## Gestion des erreurs

Vérifie le HTTP status code dans chaque réponse curl. Utilise `-w "\n%{http_code}"` si besoin :

```bash
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://www.kolektis.com/api/plugin/process" \
  -H "X-API-Key: $KOLEKTIS_API_KEY" \
  -F "file=@$PDF_PATH" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
```

| Code | Signification | Action |
|------|---------------|--------|
| 200 | Succès | Continuer normalement |
| 401 | Clé API invalide | "Votre clé API semble invalide. Vérifiez-la sur https://www.kolektis.com/account ou recréez-en une sur https://www.kolektis.com/clauder" |
| 402 | Crédits insuffisants | "Vous n'avez plus de crédits. Rechargez sur https://www.kolektis.com/account/billing" |
| 429 | Rate limit | Attendre 30 secondes, réessayer automatiquement une fois |
| 5xx | Erreur serveur | Réessayer une fois après 10 secondes. Si ça persiste, signaler : "Le serveur Kolektis rencontre un problème. Réessayez plus tard ou contactez support@kolektis.com" |

## Bonnes pratiques

- **Toujours demander confirmation** avant de lancer un traitement (ça consomme des crédits)
- **Vérifier les crédits** avant un gros batch : `curl -s https://www.kolektis.com/api/account -H "X-API-Key: $KEY"`
- **Ne jamais afficher la clé API** dans les réponses à l'utilisateur
- **Sauvegarder les résultats** systématiquement dans `kolektis_results/`
- **Gérer les gros volumes** : informer de la progression, proposer de traiter par lots
