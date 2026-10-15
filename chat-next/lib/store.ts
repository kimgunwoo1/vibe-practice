// localStorage에 저장되는 작은 저장소들 (todo-next/lib/store.ts와 같은 방식).
// React의 useSyncExternalStore로 구독하면 서버 렌더링(빈 값)과
// 브라우저(저장된 값) 사이의 hydration 불일치 없이 값을 읽을 수 있다.

import type { ChatMessage } from "./chat";

export type Theme = "light" | "dark";

type Listener = () => void;

// ---------- 대화 기록 ----------

// 다른 페이지들('todos', 'todo-app', 'todo-next')과 겹치지 않는 별도 키
const CHAT_KEY = "chat-next";
const EMPTY: ChatMessage[] = [];

let chatCache: ChatMessage[] | null = null;
const chatListeners = new Set<Listener>();

function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  } catch {
    // 저장소가 막혀 있어도 화면은 계속 동작한다
  }
}

export const chatStore = {
  getSnapshot(): ChatMessage[] {
    if (chatCache === null) chatCache = loadChat();
    return chatCache;
  },
  getServerSnapshot(): ChatMessage[] {
    return EMPTY;
  },
  subscribe(listener: Listener) {
    chatListeners.add(listener);
    return () => {
      chatListeners.delete(listener);
    };
  },
  // 답변이 흘러들어오는 동안은 글자마다 저장하지 않도록 persist=false로 부른다
  update(updater: (prev: ChatMessage[]) => ChatMessage[], persist = true) {
    chatCache = updater(chatStore.getSnapshot());
    if (persist) saveChat(chatCache);
    chatListeners.forEach((l) => l());
  },
};

// ---------- 테마 ----------

// 다른 페이지들과 같은 키를 써서 다크 모드 설정이 함께 적용된다
export const THEME_KEY = "theme";
const themeListeners = new Set<Listener>();

export const themeStore = {
  getSnapshot(): Theme {
    // layout.tsx의 인라인 스크립트가 첫 화면 전에 data-theme을 정해 둔다
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  },
  getServerSnapshot(): Theme {
    return "light";
  },
  subscribe(listener: Listener) {
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  },
  set(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    themeListeners.forEach((l) => l());
  },
};

// 서버에서는 false, 브라우저에서 hydration이 끝나면 true
export const mountedStore = {
  getSnapshot: () => true,
  getServerSnapshot: () => false,
  subscribe: () => () => {},
};
