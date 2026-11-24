# Chating — Gemini AI Chatbot

A full-stack, modern AI chatbot built with **React**, **Vite**, **Tailwind CSS**, **Node.js / Express**, and the official **Google Gen AI SDK** (`@google/genai`).

## Overview

- **Backend-only Gemini integration**: All Gemini API calls run exclusively on the Express backend using `@google/genai` with real-time Server-Sent Events (SSE) streaming and multi-turn conversation context.
- **Responsive ChatGPT-inspired UI**: Collapsible chat history sidebar (desktop + mobile drawer), New Chat, inline conversation rename and delete, Markdown & GitHub Flavored Markdown rendering, syntax-highlighted code blocks with copy buttons, message copy, regenerate/retry, stop generation, smart auto-scrolling, and light/dark theme persistence.
- **Local browser persistence**: Conversations and theme preference are saved in `localStorage` without requiring a database or paid services.
- **Security & reliability**: `.env` is excluded from Git, API keys are never exposed to the client or logs, requests are validated and rate-limited, Markdown disables raw HTML injection, and missing/invalid API keys or quota/network failures render clear actionable guidance.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, `react-markdown`, `remark-gfm`, `rehype-highlight`, `lucide-react`
- **Backend**: Node.js, Express 4, `@google/genai`, `helmet`, `cors`, `express-rate-limit`, `dotenv`
- **Testing**: Node.js built-in test runner (`node --test`)

## Installation

Prerequisites: **Node.js 20+** and **npm 10+**.

Install all root, backend, and frontend dependencies from the project root:

```bash
npm run install:all
```

## Environment Variable Configuration

Copy `.env.example` to `.env` if `.env` does not already exist:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
PORT=3001
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google Gemini API key (server-side only; never commit `.env`) | _(empty)_ |
| `GEMINI_MODEL` | Supported Gemini model ID to use for responses | `gemini-4-hydrogen` |
| `PORT` | Backend Express server port | `3001` |

> **Security note**: `.env` is listed in `.gitignore` and must never be committed. Only `.env.example` is tracked in Git.

## Gemini API Setup

1. Sign in to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.
2. Open `.env` in the repository root and set `GEMINI_API_KEY`:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   GEMINI_MODEL=gemini-4-hydrogen
   PORT=3001
   ```
3. Restart the development or production server so the backend picks up the updated `.env`.
4. If `GEMINI_API_KEY` is blank, the app runs normally and displays a configuration banner guiding you to add the key rather than returning fake responses.

## Development Commands

Launch both the Express backend (`http://localhost:3001`) and Vite frontend (`http://localhost:5173`) together with one command:

```bash
npm run dev
```

Additional useful commands:

```bash
npm run dev:server   # Start backend only (node --watch)
npm run dev:client   # Start Vite frontend dev server only
npm test             # Run backend & client unit/integration tests (mocked Gemini streams)
npm run lint         # Run ESLint across the React client
```

## Production Build & Start

Build the optimized Vite frontend bundle and serve both the API and static UI from the Express server:

```bash
npm run build
npm start
```

The production server listens on `http://localhost:3001` (or the configured `PORT`).

## Project Folder Structure

```text
chating/
├── .env                        # Local secrets & config (gitignored)
├── .env.example                # Tracked environment template
├── .gitignore                  # Excludes secrets, dependencies, build artifacts
├── package.json                # Root scripts (dev, build, start, test, lint)
├── README.md                   # Project documentation
├── client/                     # React + Vite + Tailwind CSS frontend
│   ├── index.html
│   ├── eslint.config.js
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx             # Main chat workspace & stream state coordinator
│       ├── main.jsx
│       ├── index.css           # Theme tokens, markdown typography, syntax colors
│       ├── components/
│       │   ├── ApiSetupNotice.jsx
│       │   ├── BrandMark.jsx
│       │   ├── ChatInput.jsx
│       │   ├── EmptyState.jsx
│       │   ├── MarkdownRenderer.jsx
│       │   ├── MessageItem.jsx
│       │   └── Sidebar.jsx
│       ├── services/
│       │   └── chatApi.js      # SSE client & /api/health integration
│       └── utils/
│           └── storage.js      # localStorage persistence & date grouping
└── server/                     # Node.js + Express backend
    ├── package.json
    ├── src/
    │   ├── index.js            # Server entrypoint
    │   ├── app.js              # Express app, Helmet, CORS, static serving
    │   ├── config/
    │   │   └── env.js          # Environment loader & public config sanitizer
    │   ├── middleware/
    │   │   ├── rateLimiter.js  # API & chat stream rate limiters
    │   │   └── validateChatRequest.js
    │   ├── routes/
    │   │   └── chatRoutes.js   # GET /api/health, POST /api/chat/stream
    │   └── services/
    │       └── geminiService.js # Official @google/genai streaming & error mapping
    └── tests/
        └── server.test.js      # Automated backend API & SSE tests
```
