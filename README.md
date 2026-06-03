# Double Move Chess: Web Client

This is the web client for the Double Move Chess game. It is a highly polished, responsive React application built with TypeScript and Vite. It allows players to match up against a trained ONNX value network running directly in the browser via WebAssembly (WASM), or fall back to a pure classical alpha-beta search engine.

---

## ✨ Features

- **🎮 Game Modes**: Play against the **🧠 Neural Network AI** (WebGL/WASM accelerated) or **🧮 Pure Classical** engine (alphabeta search with PST heuristics), or play locally against a friend in **Local PvP** mode.
- **🎨 Modern Design**: Beautiful dark mode styled with premium gradients, harmonized HSL color tokens, micro-animations, and clean Noto Sans typography.
- **📦 Saved Games Database**: Keeps track of your played games locally in the browser. You can revisit games or delete old logs.
- **🔍 Deep Game Analysis**:
  - **Instant Load**: Loading games into analysis mode is immediate, avoiding browser freezes.
  - **Interactive Stepper**: Play through the game's moves manually ply-by-ply.
  - **Interactive Move Log**: Click any move in the log to jump the chessboard straight to that turn. Active moves are highlighted.
  - **On-Demand Engine**: Click the **Begin Analysis** button to start a depth-5 evaluation sweep of the whole game. Shows classification badges (Blunder, Mistake, Good, Great, Neutral) and best-move recommendations dynamically.
- **🚀 Portable Build**: Configured to build with relative path resolution (`base: "./"`) so the production build is instantly ready to deploy on **GitHub Pages** or any subfolder structure.

---

## 🛠️ Tech Stack

- **Framework**: React 19 (TypeScript)
- **Bundler**: Vite
- **Styling**: Modern CSS variables & utilities (vanilla CSS for maximum control)
- **AI Inference**: `onnxruntime-web` (running `model.onnx` on wasm/webgl)
- **Icons**: `lucide-react`
- **Typography**: Google Fonts Noto Sans & Noto Sans Mono

---

## 🚀 Development & Build

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
Ensure you have placed your trained `model.onnx` file inside the `public/` directory, then start Vite:
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 3. Build for Production
Compiles the application to highly optimized static assets in the `dist/` directory with relative base paths (fully compatible with GitHub Pages hosting):
```bash
npm run build
```

### 4. Deploy to GitHub Pages
Automatically builds the app and publishes the production files in `dist/` to the `gh-pages` branch of your GitHub repository:
```bash
npm run deploy
```

### 5. Preview the Build
Locally preview your production build:
```bash
npm run preview
```
