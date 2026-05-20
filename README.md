# 🐾 Pokédex Trainer Dashboard

![Angular](https://img.shields.io/badge/Angular-19-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![License](https://img.shields.io/badge/License-MIT-green)

> A modern Pokémon trainer dashboard built with Angular 19, featuring real-time battle updates, team management, and interactive charts.

## ✨ Features

- 📖 **Pokédex** - Browse 151 Pokémon with search, filter, sort, and pagination
- ⚡ **Team Builder** - Create and manage Pokémon teams with type coverage analysis
- 🏆 **Battle Log** - Real-time battle updates with 5-second polling
- 👤 **Trainer Profile** - Manage your profile and view battle statistics
- 📊 **Interactive Charts** - Radar charts, bar charts, and doughnut charts with animations
- 🌙 **Dark/Light Theme** - Toggle between themes with smooth transitions

## 📸 Screenshots

### Pokédex
![Pokédex Table](./docs/images/pokedex.png)

*Pokémon list with type badges, stat columns, and pagination controls*

### Pokémon Detail Panel
![Pokémon Detail](./docs/images/pokemon-detail.png)

*Detailed view with stats radar chart, Pokémon cry audio, and YouTube video*

### Team Builder
![Team Builder](./docs/images/team-builder.png)

*Create teams with Pokémon search, type coverage analysis, and type distribution chart*

### Battle Log
![Battle Log](./docs/images/battle-log.png)

*Real-time battle logs with severity filters and monthly battle results chart*

### Trainer Profile
![Trainer Profile](./docs/images/profile.png)

*Trainer information with edit functionality and battle statistics*

### Dark Theme
![Dark Theme](./docs/images/dark-theme.png)

*Modern dark theme with glass morphism effects*

## 🛠️ Tech Stack

- **Frontend**: Angular 19, TypeScript, RxJS
- **State Management**: BehaviorSubject + Signals
- **API**: GraphQL (PokeAPI), REST (JSON Server)
- **Charts**: Chart.js
- **Styling**: SCSS with CSS Variables
- **Testing**: Jasmine, Karma


## Key Technical Decision Summary

### Why `db.json` (not `db.js`)?

| Requirement | How `db.json` fulfills it |
|-------------|---------------------------|
| **Battle Log Polling** | `interval(5000) + switchMap` works perfectly with REST |
| **Avatar Base64 Storage** | Stable up to 2MB, no 500 errors |
| **CRUD Operations** | Full REST support (GET/POST/PATCH/DELETE) |
| **Development Speed** | Zero configuration, immediate start |
| **Deployment** | Single file, no extra setup |

### Why Not GraphQL?

1. Assignment requires **polling simulation**, not GraphQL subscriptions
2. `json-server` is stable for Base64 images; `json-graphql-server` returns 500 errors
3. REST is simpler, faster to implement, meets all requirements

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/modernWebDev9/pokemon.git

# Install dependencies
cd pokemon
npm install

# Start Server (Terminal 1)
npm start
# Start JSON Server (Terminal 2)
npx json-server db.json --port 4000