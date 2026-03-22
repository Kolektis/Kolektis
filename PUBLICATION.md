# Guide de publication du plugin Kolektis

## Phase 1 — Marketplace GitHub (maintenant)

### 1. Créer le repo GitHub

```bash
# Depuis le dossier kolektis-plugin/
git init
git add .
git commit -m "Initial release: Kolektis plugin for Claude"

# Créer le repo sur GitHub (public)
gh repo create monceaulitis/kolektis-claude-plugin --public --source=. --push
```

### 2. Vos clients installent en 2 commandes

Dans Claude, le client tape :

```
/plugin marketplace add monceaulitis/kolektis-claude-plugin
/plugin install kolektis
```

C'est tout. Claude leur demandera leur clé API au premier usage.

### 3. Mise à jour du plugin

Quand vous améliorez le plugin, poussez simplement sur GitHub :

```bash
git add .
git commit -m "v1.1: amélioration extraction factures"
git push
```

Les clients reçoivent la mise à jour automatiquement.

---

## Phase 2 — Marketplace officiel Anthropic (quand c'est stable)

### Prérequis

Avant de soumettre, assurez-vous que :
- Le plugin fonctionne bien avec 5-10 clients réels
- La page signup (kolektis.com/signup) est en production
- L'API gère correctement les clés API et la facturation
- Vous avez un support client (email ou chat)

### Soumission

1. Rendez-vous sur https://claude.ai/settings/plugins/submit
2. Remplissez le formulaire :
   - **Source** : `monceaulitis/kolektis-claude-plugin` (votre repo GitHub)
   - **Catégorie** : Document Processing / Business Tools
   - **Description** : celle du plugin.json
   - **URL support** : votre email ou page de support
3. Anthropic review le plugin (délai variable)
4. Une fois approuvé, le plugin apparaît dans le marketplace officiel

### Ce qui change pour les clients

Avant (GitHub marketplace) :
```
/plugin marketplace add monceaulitis/kolektis-claude-plugin
/plugin install kolektis
```

Après (marketplace officiel) :
```
/plugin install kolektis
```

Plus besoin d'ajouter le marketplace — le plugin est directement trouvable.

---

## Checklist backend Kolektis

Avant la Phase 1, implémentez côté serveur :

- [ ] `POST /api/signup` → crée un compte, retourne `{ api_key: "kol_..." }`
- [ ] `GET /api/account` → retourne crédits restants, usage, plan
- [ ] Modifier `/api/process-aurelien` pour accepter le header `X-API-Key`
- [ ] Table de tracking : qui utilise quoi, combien de documents, quand
- [ ] Page signup hébergée sur kolektis.com/signup
- [ ] Système de crédits / facturation par plan (Starter/Pro/Enterprise)
