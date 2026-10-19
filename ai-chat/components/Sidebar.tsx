"use client";

import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/api";

type Props = {
  conversations: Conversation[];
  currentId: string | null;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onTogglePin: (c: Conversation) => void;
  onDelete: (id: string) => void;
};

export default function Sidebar(props: Props) {
  const { conversations, currentId, open, onClose, onNew, onSelect, onTogglePin, onDelete } = props;

  // 삭제는 두 번 눌러 확인한다 (3초 뒤 원래대로)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function handleDelete(id: string) {
    clearTimeout(timer.current);
    if (confirmId === id) {
      setConfirmId(null);
      onDelete(id);
    } else {
      setConfirmId(id);
      timer.current = setTimeout(() => setConfirmId(null), 3000);
    }
  }

  return (
    <>
      {/* 휴대폰에서 서랍이 열렸을 때 뒤 배경 */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <nav
        id="sidebar"
        aria-label="대화 목록"
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col gap-3 border-r border-border bg-surface p-4 transition-transform md:static md:translate-x-0 ${
          // 닫힌 서랍은 invisible로 키보드 탭 순서에서도 뺀다
          open ? "translate-x-0" : "-translate-x-full max-md:invisible"
        }`}
      >
        <button
          type="button"
          id="new-chat"
          onClick={onNew}
          className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg"
        >
          + 새 대화
        </button>

        {conversations.length === 0 ? (
          <p className="px-1 text-sm text-muted">아직 대화가 없어요.</p>
        ) : (
          <ul className="flex flex-1 flex-col gap-1 overflow-y-auto" id="conversation-list">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === currentId ? "page" : undefined}
                  className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left ${
                    c.id === currentId ? "bg-user-bubble font-semibold" : "hover:bg-surface-2"
                  }`}
                >
                  {c.pinned && <span aria-label="고정됨">📌 </span>}
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePin(c)}
                  aria-label={c.pinned ? `"${c.title}" 고정 풀기` : `"${c.title}" 고정`}
                  className="rounded-lg px-2 py-2 text-sm text-muted hover:bg-surface-2"
                >
                  {c.pinned ? "풀기" : "고정"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  aria-label={confirmId === c.id ? `"${c.title}" 정말 삭제` : `"${c.title}" 삭제`}
                  className={`rounded-lg px-2 py-2 text-sm hover:bg-surface-2 ${
                    confirmId === c.id ? "font-semibold text-danger" : "text-muted"
                  }`}
                >
                  {confirmId === c.id ? "확인" : "삭제"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </>
  );
}
