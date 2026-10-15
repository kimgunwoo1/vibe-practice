"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ERROR_MARKER, MAX_MESSAGE_LENGTH, type ChatMessage, type ChatRequest } from "@/lib/chat";
import { chatStore, mountedStore, themeStore } from "@/lib/store";
import styles from "./Chat.module.css";

const SUGGESTIONS = [
  "장애인활동지원은 누가 받을 수 있어?",
  "활동지원 서비스는 어떻게 신청해?",
  "활동지원사가 되려면 어떻게 해야 해?",
];

function newId() {
  return crypto.randomUUID();
}

// 흘러들어온 글자 중 ERROR_MARKER 앞은 답변, 뒤는 오류 문장
function splitReply(raw: string): { text: string; error: string | null } {
  const i = raw.indexOf(ERROR_MARKER);
  return i === -1 ? { text: raw, error: null } : { text: raw.slice(0, i), error: raw.slice(i + 1) };
}

export default function Chat() {
  const messages = useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getSnapshot,
    chatStore.getServerSnapshot,
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

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 새 글자가 생기면 맨 아래로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // '기록 지우기' 확인 상태는 3초 뒤 원래대로
  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  function setAssistant(id: string, patch: Partial<ChatMessage>, persist = false) {
    chatStore.update((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)), persist);
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    const userMsg: ChatMessage = { id: newId(), role: "user", text: question };
    const assistantId = newId();
    // 오류 안내 말풍선은 Claude에게 보내지 않는다
    const history: ChatRequest["messages"] = [...messages, userMsg]
      .filter((m) => !m.error && m.text)
      .map((m) => ({ role: m.role, content: m.text }));

    chatStore.update((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", text: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let raw = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history } satisfies ChatRequest),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `서버 오류가 났어요 (${res.status}).`);
      }

      // 서버가 보내는 글자를 조각조각 읽어서 바로 화면에 붙인다
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += value;
        const { text, error } = splitReply(raw);
        // 오류가 오면 반쯤 나온 답은 버리고 오류 문장만 보여 준다
        setAssistant(assistantId, error === null ? { text } : { text: error, error: true });
      }
      if (!raw) setAssistant(assistantId, { text: "답변이 비어 있어요. 다시 시도해 주세요.", error: true });
    } catch (err) {
      if (controller.signal.aborted) {
        // '중지'를 눌렀으면 받은 데까지만 남긴다
        if (!splitReply(raw).text) chatStore.update((prev) => prev.filter((m) => m.id !== assistantId));
      } else {
        const message = err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "서버에 연결하지 못했어요. npm run dev가 켜져 있는지 확인해 주세요.";
        setAssistant(assistantId, { text: message, error: true });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      chatStore.update((prev) => prev); // 다 받은 뒤 한 번만 저장
      inputRef.current?.focus();
    }
  }

  function resetChat() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    abortRef.current?.abort();
    chatStore.update(() => []);
  }

  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>🤖 GSC 챗봇</h1>
        <div className={styles.headerBtns}>
          {mounted && messages.length > 0 && (
            <button
              className={`${styles.textBtn} ${confirmReset ? styles.confirm : ""}`}
              onClick={resetChat}
            >
              {confirmReset ? "한 번 더 누르면 삭제" : "기록 지우기"}
            </button>
          )}
          <button
            className={styles.themeBtn}
            onClick={() => themeStore.set(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "라이트 모드 전환" : "다크 모드 전환"}
          >
            {mounted ? (theme === "dark" ? "☀️" : "🌙") : null}
          </button>
        </div>
      </header>
      <p className={styles.sub}>Next.js + Claude</p>

      <div className={styles.log} aria-live="polite">
        {mounted && messages.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyAvatar} aria-hidden="true">🤖</div>
            <h2 className={styles.emptyTitle}>안녕하세요! GSC 챗봇이에요</h2>
            <p className={styles.emptyText}>장애인활동지원에 대해 무엇이든 물어보세요.</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className={styles.suggestion} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`${styles.row} ${m.role === "user" ? styles.userRow : ""}`}>
            {m.role === "assistant" && (
              <div className={styles.avatar} aria-hidden="true">
                🤖
              </div>
            )}
            <div
              className={`${styles.bubble} ${m.role === "user" ? styles.user : styles.assistant} ${m.error ? styles.error : ""}`}
            >
              {m.text ||
                (streaming && m.id === lastId ? (
                  <span className={styles.typing} aria-label="생각하는 중">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter는 보내기, Shift+Enter는 줄바꿈. 한글 조합 중(isComposing)의 Enter는 무시
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="메시지를 입력하세요"
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          autoFocus
        />
        {streaming ? (
          <button
            type="button"
            className={styles.stopBtn}
            onClick={() => abortRef.current?.abort()}
            aria-label="중지"
            title="중지"
          >
            ■
          </button>
        ) : (
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim()}
            aria-label="보내기"
            title="보내기"
          >
            ↑
          </button>
        )}
      </form>
      <div className={styles.hint}>
        <p className={styles.privacy}>🔒 이름·주민번호·연락처·주소 등 개인정보는 입력하지 마세요.</p>
        <p>Enter 보내기 · Shift+Enter 줄바꿈</p>
      </div>
    </div>
  );
}
