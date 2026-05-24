# ⌨️ Type Siege

> A fast-paced neon typing defense game. Defend your core by typing words to destroy waves of enemies.

![TypeScript](https://img.shields.io/badge/TypeScript-96.8%25-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)

---

## 🎮 About

**Type Siege** is a browser-based typing defense game. Waves of enemies advance toward your core — your only weapon is your keyboard. Type the words above each enemy before they reach you to destroy them.

The game tracks your **WPM**, **combo streaks**, and **wave progress**, rewarding fast and accurate typists with higher scores.

---

## ✨ Features

- 🌊 **Wave-based enemy system** — survive increasingly difficult waves
- ⚡ **Combo tracking** — chain kills for score multipliers
- 📊 **WPM tracking** — real-time words-per-minute display
- 🎨 **Cyberpunk neon aesthetic** — immersive dark theme with glowing visuals
- 📱 **Responsive design** — playable across screen sizes

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + Radix UI |
| State Management | Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Deployment | GitHub Pages (`gh-pages`) |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/progharshith/type-siege.git
cd type-siege

# Install dependencies
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

```bash
npm run build
```

The output will be in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

---

## 📁 Project Structure

```
type-siege/
├── src/              # Application source code
├── index.html        # HTML entry point
├── vite.config.ts    # Vite configuration
├── tsconfig.json     # TypeScript configuration
├── components.json   # shadcn/ui component config
└── package.json      # Dependencies & scripts
```

---

## 🧹 Code Quality

```bash
# Lint
npm run lint

# Format with Prettier
npm run format
```

---

## 📜 License

This project is open source. Feel free to fork and build your own version!

---

<p align="center">Made with <3 by <a href="https://github.com/progharshith">progharshith</a></p>
