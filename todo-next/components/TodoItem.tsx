"use client";

import { useState } from "react";
import type { Todo } from "@/lib/store";
import styles from "./TodoApp.module.css";

type Props = {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
};

export default function TodoItem({ todo, onToggle, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  function startEdit() {
    setDraft(todo.text);
    setEditing(true);
  }

  // Enter나 포커스 이동으로 저장, 빈 칸이면 원래 내용 유지
  function finishEdit() {
    const value = draft.trim();
    if (value && value !== todo.text) onEdit(todo.id, value);
    setEditing(false);
  }

  return (
    <li className={todo.done ? `${styles.item} ${styles.done}` : styles.item}>
      <input
        type="checkbox"
        className={styles.check}
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
        aria-label="완료 표시"
      />

      {editing ? (
        <input
          className={styles.editInput}
          value={draft}
          autoFocus
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="할 일 수정"
        />
      ) : (
        <span className={styles.text} onDoubleClick={startEdit} title="더블클릭해서 수정">
          {todo.text}
        </span>
      )}

      {!editing && (
        <button type="button" className={styles.iconBtn} onClick={startEdit} title="수정">
          ✏️
        </button>
      )}
      <button
        type="button"
        className={`${styles.iconBtn} ${styles.deleteBtn}`}
        onClick={() => onDelete(todo.id)}
        title="삭제"
      >
        ✕
      </button>
    </li>
  );
}
