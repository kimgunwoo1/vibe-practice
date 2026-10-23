# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Standalone single-file web pages, written in Korean for a beginner learning web development:

- `index.html` — to-do list (add / complete / delete, filters, clear completed)
- `rps.html` — rock-paper-scissors game (score tracking, Web Audio sound effects)
- `todo/index.html` — newer, fuller TODO app (inline edit, due dates, progress bar, toggle all). Lives in a subfolder of this same repo, not its own repo; served at https://kimgunwoo1.github.io/vibe-practice/todo/

- `todo-next/` — the exception: a Next.js (App Router, TypeScript) port of the TODO app with its own `package.json` (`npm run dev` / `build` / `lint` inside that folder). Uses the same palette and `'theme'` key; stores todos under `'todo-next'`. GitHub Pages does not build it — it is not live.

- `chat-next/` — Next.js (App Router, TypeScript) AI chatbot using the Claude API via `@anthropic-ai/sdk` (model `claude-haiku-5-5`, streaming, effort `low`; Haiku has no server-side `fallbacks`). Same structure/palette as `todo-next/`; stores the conversation under `'chat-next'`. Needs `ANTHROPIC_API_KEY` in `chat-next/.env.local` (git-ignored; `.env.example` is the committed template). The key is used only in `app/api/chat/route.ts` (server) — never in client components. Not live on GitHub Pages.

- `ai-chat/` — a **separate project** from `chat-next/` (shares no code or storage keys): an AI counseling chatbot for Korea's 장애인활동지원 / 장애인근로지원 programs, for disabled people and their families. Next.js 16 (App Router, TypeScript) + Hono API (`app/api/[[...route]]/route.ts`) + Mastra agent (`anthropic/claude-sonnet-5-5`) + MongoDB Atlas (conversations via Mastra Memory, plus a Vector Search index for RAG). Answers cite the official 사업안내 PDF: `npm run convert-tables` rewrites table pages into prose (`docs/converted/*.json`, committed), then `npm run ingest` chunks and embeds the PDF (Google `gemini-embedding-001`) into MongoDB. The PDFs themselves are git-ignored (originals on Google Drive). Needs `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `MONGODB_URI`, `SESSION_SECRET` in `ai-chat/.env.local` (`.env.example` is the template). Deploys to Google Cloud Run (`Dockerfile`), not GitHub Pages. Read `ai-chat/CLAUDE.md` before working there.

- `gsc-admin/` — **not part of this repo.** It is a separate **private** repository (`kimgunwoo1/gsc-admin`) checked out into this folder and ignored by this repo's `.gitignore`. It handles personal data, so never add or copy its files into this public repo. Work, commit, and push from inside `gsc-admin/` (its own git remote) and read its own `CLAUDE.md` first.

- `tests/` — Playwright end-to-end tests (own `package.json`; `npm test` inside that folder). Opens the pages via `file://`, no server. Currently covers `todo/index.html` (`todo.spec.js`); update it when changing that page's behavior or element ids.

Each page is fully self-contained: inline `<style>` and `<script>`, no build step, no dependencies. Tests live only in `tests/`, never inside the pages. Keep it that way — no frameworks, bundlers, or external files unless the user asks.

## Running

- Local: `open index.html` (or `open rps.html`, `open todo/index.html`). Works from `file://`.
- Live: GitHub Pages serves `main` from the repo root at https://kimgunwoo1.github.io/vibe-practice/ — a push to `main` redeploys in about a minute.
- `node` v24 is now installed (`/usr/local/bin/node`). To syntax-check a single-file page's script without it, extract the `<script>` body and parse it with `osascript -l JavaScript` (`new Function(src)`).

## Shared conventions across both pages

These must stay in sync when editing either page:

- **Theme**: both pages copy the same pastel palette as CSS variables on `:root`, with dark values under `:root[data-theme="dark"]`. The dark-mode toggle stores `'light'`/`'dark'` under the shared `localStorage` key `'theme'`, so switching on one page carries over to the other. On first visit it falls back to `prefers-color-scheme`.
- **Persistence**: state is saved to `localStorage` via `load()`/`save()` helpers using `JSON.stringify`/`JSON.parse`, always wrapped in `try/catch` so the page still works when storage is blocked. Keys: `'todos'` (index.html), `'rps-stats'` and `'rps-sound'` (rps.html), `'todo-app'` (todo/index.html — deliberately separate from `'todos'` because all pages share one origin on GitHub Pages and the item shape differs). Changing a stored data shape breaks existing users' saved data — `rps.html` merges loaded data over `emptyStats()` defaults for this reason.
- **Rendering**: state lives in a JS variable; every mutation calls `save()` then `render()`, which rebuilds the DOM. Use `textContent` (not `innerHTML`) for user-entered text.
- **Navigation**: each page has a `.page-link` card below `.app` linking to the other. Use relative file names (`index.html`, `rps.html`), not `./`, so links also work from `file://`. `todo/index.html` links up to both with `../index.html` / `../rps.html` in a two-column `.page-links` grid.
- **No browser dialogs**: destructive actions use a two-click confirm (button text changes, reverts after 3s) instead of `confirm()`.

## Git / deploy

- Remote `origin` is https://github.com/kimgunwoo1/vibe-practice (public; HTTPS credentials are stored in the keychain, so `git push` works non-interactively).
- `gh` CLI is installed (`/opt/homebrew/bin/gh`) and logged in as `kimgunwoo1`, but with a fine-grained PAT that cannot create repositories (`gh repo create` → "Resource not accessible by personal access token"). New repos and GitHub settings (Pages, visibility) must be done by the user in the web UI. The token only reaches repositories selected on it (now `vibe-practice` and `gsc-admin`); a new repo must also be added to the token by the user (GitHub → Settings → Personal access tokens → Fine-grained tokens → `vibe-practice` → Edit → Repository access, Contents: Read and write), otherwise push fails with 403. Prefer adding new pages as subfolders of this repo over new repos.
- Don't nest a git repo inside this one (e.g. a `todo/.git`): `git add` would record only a gitlink, not the files. The one exception is `gsc-admin/`, which is its own private repo and is listed in `.gitignore`.
- Commit messages are in Korean.
- After pushing a page change, verify the deploy by diffing the live URL against the local file (`curl -s <url> | diff -q - <file>`).
