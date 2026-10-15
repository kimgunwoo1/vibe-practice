// localStorage에 저장되는 작은 저장소들.
// React의 useSyncExternalStore로 구독하면 서버 렌더링(빈 값)과
// 브라우저(저장된 값) 사이의 hydration 불일치 없이 값을 읽을 수 있다.

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

export type Theme = "light" | "dark";

type Listener = () => void;

// ---------- 할 일 목록 ----------

// 'todos'(index.html), 'todo-app'(todo/index.html)과 겹치지 않는 별도 키
const TODOS_KEY = "todo-next";
const EMPTY: Todo[] = [];

let todosCache: Todo[] | null = null;
const todoListeners = new Set<Listener>();

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(TODOS_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as Todo[]) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos: Todo[]) {
  try {
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  } catch {
    // 저장소가 막혀 있어도 화면은 계속 동작한다
  }
}

export const todoStore = {
  getSnapshot(): Todo[] {
    if (todosCache === null) todosCache = loadTodos();
    return todosCache;
  },
  getServerSnapshot(): Todo[] {
    return EMPTY;
  },
  subscribe(listener: Listener) {
    todoListeners.add(listener);
    // 다른 탭에서 바꾼 내용도 반영
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TODOS_KEY) return;
      todosCache = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      todoListeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  update(updater: (prev: Todo[]) => Todo[]) {
    todosCache = updater(todoStore.getSnapshot());
    saveTodos(todosCache);
    todoListeners.forEach((l) => l());
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
