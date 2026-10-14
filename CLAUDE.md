# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Standalone single-file web pages, written in Korean for a beginner learning web development:

- `index.html` — to-do list (add / complete / delete, filters, clear completed)
- `rps.html` — rock-paper-scissors game (score tracking, Web Audio sound effects)
- `todo/index.html` — newer, fuller TODO app (inline edit, due dates, progress bar, toggle all). Lives in a subfolder of this same repo, not its own repo; served at https://kimgunwoo1.github.io/vibe-practice/todo/

Each page is fully self-contained: inline `<style>` and `<script>`, no build step, no dependencies, no tests. Keep it that way — no frameworks, bundlers, or external files unless the user asks.

## Running

- Local: `open index.html` (or `open rps.html`, `open todo/index.html`). Works from `file://`.
- Live: GitHub Pages serves `main` from the repo root at https://kimgunwoo1.github.io/vibe-practice/ — a push to `main` redeploys in about a minute.
- `node` is not installed. To syntax-check a page's script, extract the `<script>` body and parse it with `osascript -l JavaScript` (`new Function(src)`).

## Shared conventions across both pages

These must stay in sync when editing either page:

- **Theme**: both pages copy the same pastel palette as CSS variables on `:root`, with dark values under `:root[data-theme="dark"]`. The dark-mode toggle stores `'light'`/`'dark'` under the shared `localStorage` key `'theme'`, so switching on one page carries over to the other. On first visit it falls back to `prefers-color-scheme`.
- **Persistence**: state is saved to `localStorage` via `load()`/`save()` helpers using `JSON.stringify`/`JSON.parse`, always wrapped in `try/catch` so the page still works when storage is blocked. Keys: `'todos'` (index.html), `'rps-stats'` and `'rps-sound'` (rps.html), `'todo-app'` (todo/index.html — deliberately separate from `'todos'` because all pages share one origin on GitHub Pages and the item shape differs). Changing a stored data shape breaks existing users' saved data — `rps.html` merges loaded data over `emptyStats()` defaults for this reason.
- **Rendering**: state lives in a JS variable; every mutation calls `save()` then `render()`, which rebuilds the DOM. Use `textContent` (not `innerHTML`) for user-entered text.
- **Navigation**: each page has a `.page-link` card below `.app` linking to the other. Use relative file names (`index.html`, `rps.html`), not `./`, so links also work from `file://`. `todo/index.html` has no `.page-link` yet; if one is added, link up with `../index.html` / `../rps.html`.
- **No browser dialogs**: destructive actions use a two-click confirm (button text changes, reverts after 3s) instead of `confirm()`.

## Git / deploy

- Remote `origin` is https://github.com/kimgunwoo1/vibe-practice (public; HTTPS credentials are stored in the keychain, so `git push` works non-interactively).
- `gh` CLI is installed (`/opt/homebrew/bin/gh`) and logged in as `kimgunwoo1`, but with a fine-grained PAT that cannot create repositories (`gh repo create` → "Resource not accessible by personal access token"). New repos and GitHub settings (Pages, visibility) must be done by the user in the web UI. Prefer adding new pages as subfolders of this repo over new repos.
- Don't nest a git repo inside this one (e.g. a `todo/.git`): `git add` would record only a gitlink, not the files.
- Commit messages are in Korean.
- After pushing a page change, verify the deploy by diffing the live URL against the local file (`curl -s <url> | diff -q - <file>`).
