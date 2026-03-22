# Kolektis — Plugin Claude

Plugin officiel pour le traitement documentaire via l'API Kolektis.
Permet d'analyser des PDFs (courriers, factures, sinistres, SDC...) directement depuis Claude.

## Installation

Depuis le marketplace Claude :
1. Recherchez "Kolektis" dans les plugins
2. Cliquez "Installer"
3. Entrez votre clé API (obtenue sur https://www.kolektis.com/signup)

## Utilisation

Dites simplement à Claude :
- "Traite les PDFs de mon dossier avec Kolektis"
- "Analyse ces documents"
- "Extrais les données de ces factures"

Claude va automatiquement :
1. Lister les PDFs de votre dossier
2. Les envoyer à l'API Kolektis
3. Sauvegarder les résultats
4. Répondre à vos questions sur le contenu

## Structure du plugin

```
kolektis-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifeste du plugin
├── .mcp.json                # Config du MCP server
├── mcp-server/
│   ├── package.json
│   └── index.js             # Serveur MCP (API calls)
├── skills/
│   └── kolektis/
│       └── SKILL.md         # Instructions pour Claude
├── signup-page/
│   └── index.html           # Template page d'inscription (à héberger)
└── README.md
```

## Publication sur le marketplace

### Option 1 : Marketplace officiel Anthropic
Soumettez sur https://claude.ai/settings/plugins/submit

### Option 2 : Votre propre marketplace
Créez un repo GitHub avec un fichier `.claude-plugin/marketplace.json` :

```json
{
  "name": "kolektis-marketplace",
  "displayName": "Kolektis Plugins",
  "plugins": [
    {
      "name": "kolektis",
      "source": "./"
    }
  ]
}
```

Vos clients ajoutent le marketplace avec :
```
/plugin marketplace add votre-org/kolektis-marketplace
```

## Développement

```bash
cd mcp-server/
npm install
KOLEKTIS_API_KEY=kol_test123 node index.js
```
