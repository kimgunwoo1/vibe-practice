"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mountedStore, themeStore, todoStore, type Todo } from "@/lib/store";
import TodoItem from "./TodoItem";
import styles from "./TodoApp.module.css";

type Filter = "all" | "active" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "done", label: "완료" },
];

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function TodoApp() {
  const todos = useSyncExternalStore(
    todoStore.subscribe,
    todoStore.getSnapshot,
    todoStore.getServerSnapshot,
  );
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  const mounted = useSyncExternalStore(
    mountedStore.subscribe,
    mountedStore.getSnapshot,
    mountedStore.getServerSnapshot,
  );

  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const doneCount = todos.filter((t) => t.done).length;
  const activeCount = todos.length - doneCount;
  const percent = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;
  const allDone = todos.length > 0 && activeCount === 0;

  const visible = todos.filter((t) =>
    filter === "active" ? !t.done : filter === "done" ? t.done : true,
  );

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const todo: Todo = { id: newId(), text: value, done: false, createdAt: Date.now() };
    todoStore.update((prev) => [...prev, todo]);
    setText("");
  }

  function toggleTodo(id: string) {
    todoStore.update((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function editTodo(id: string, value: string) {
    todoStore.update((prev) => prev.map((t) => (t.id === id ? { ...t, text: value } : t)));
  }

  function deleteTodo(id: string) {
    todoStore.update((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleAll() {
    todoStore.update((prev) => prev.map((t) => ({ ...t, done: !allDone })));
  }

  // 완료 항목 삭제는 두 번 눌러야 실행된다 (3초 뒤 원래대로)
  function clearDone() {
    clearTimeout(confirmTimer.current);
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    todoStore.update((prev) => prev.filter((t) => !t.done));
  }

  const emptyMessage =
    todos.length === 0
      ? "할 일을 추가해 보세요 ✨"
      : filter === "active"
        ? "모든 일을 끝냈어요 🎉"
        : "아직 완료한 일이 없어요";

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>📝 할 일 목록</h1>
        <button
          type="button"
          className={styles.themeBtn}
          onClick={() => themeStore.set(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "라이트 모드 전환" : "다크 모드 전환"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>
      <p className={styles.sub}>Next.js 버전</p>

      <div className={styles.progress} aria-label={`진행률 ${percent}%`}>
        <div className={styles.progressBar} style={{ width: `${percent}%` }} />
      </div>

      <form className={styles.form} onSubmit={addTodo}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="할 일을 입력하세요"
          maxLength={200}
          aria-label="새 할 일"
        />
        <button type="submit" className={styles.addBtn}>
          추가
        </button>
      </form>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? `${styles.filter} ${styles.active}` : styles.filter}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        {todos.length > 0 && (
          <button type="button" className={styles.toggleAll} onClick={toggleAll}>
            {allDone ? "모두 해제" : "모두 완료"}
          </button>
        )}
      </div>

      {/* 서버 HTML에는 저장된 목록이 없으니, 브라우저에서 읽기 전까지는 비워 둔다 */}
      {mounted &&
        (visible.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          <ul className={styles.list}>
            {visible.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onEdit={editTodo}
                onDelete={deleteTodo}
              />
            ))}
          </ul>
        ))}

      {mounted && todos.length > 0 && (
        <footer className={styles.footer}>
          <span>
            남은 일 <strong>{activeCount}</strong>개 · 완료 {percent}%
          </span>
          {doneCount > 0 && (
            <button
              type="button"
              className={confirmClear ? `${styles.clearBtn} ${styles.confirm}` : styles.clearBtn}
              onClick={clearDone}
            >
              {confirmClear ? "정말 삭제할까요?" : `완료 ${doneCount}개 삭제`}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
