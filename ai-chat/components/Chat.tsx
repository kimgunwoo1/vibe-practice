"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientError, type ChatMessage, type Conversation } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import Sidebar from "./Sidebar";

const MAX_LENGTH = 2000;

const SUGGESTIONS = [
  { group: "활동지원", questions: ["장애인활동지원은 누가 받을 수 있나요?", "활동지원 신청은 어디서 어떻게 하나요?"] },
  { group: "근로지원", questions: ["근로지원인 서비스는 어떤 도움을 주나요?", "근로지원인은 어떻게 신청하나요?"] },
];

function readPref(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 화면 낭독기에 읽어 줄 문장. 스트리밍 중 글자마다 읽지 않도록 답변이 끝났을 때만 바꾼다.
  const [announcement, setAnnouncement] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch {
      // 목록을 못 불러와도 대화는 계속할 수 있다
    }
  }, []);

  useEffect(() => {
    api.listConversations().then(setConversations, () => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function stop() {
    abortRef.current?.abort();
  }

  function startNew() {
    stop();
    setCurrentId(null);
    setMessages([]);
    setError(null);
    setDrawerOpen(false);
    inputRef.current?.focus();
  }

  async function openConversation(id: string) {
    stop();
    setCurrentId(id);
    setMessages([]);
    setError(null);
    setDrawerOpen(false);
    try {
      setMessages(await api.getMessages(id));
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "대화를 불러오지 못했어요.");
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;

    const botId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: message },
      { id: botId, role: "assistant", text: "" },
    ]);
    setInput("");
    setError(null);
    setStreaming(true);
    setAnnouncement("");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const full = await api.streamChat({
        conversationId: currentId,
        message,
        signal: controller.signal,
        onConversationId: setCurrentId,
        onText: (t) => setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: t } : m))),
      });
      setAnnouncement(`답변: ${full}`);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof ClientError ? err.message : "답변을 받지 못했어요. 다시 시도해 주세요.");
      }
      // 글자가 하나도 오지 않은 빈 답변 칸은 지운다
      setMessages((prev) => prev.filter((m) => m.id !== botId || m.text));
    } finally {
      abortRef.current = null;
      setStreaming(false);
      void refreshConversations();
      // 대화 제목은 답변이 끝난 뒤 서버에서 따로 만들어지므로 잠시 뒤 한 번 더 불러온다
      setTimeout(refreshConversations, 4000);
    }
  }

  async function togglePin(c: Conversation) {
    try {
      await api.updateConversation(c.id, { pinned: !c.pinned });
      await refreshConversations();
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "고정하지 못했어요.");
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteConversation(id);
      if (id === currentId) startNew();
      await refreshConversations();
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "삭제하지 못했어요.");
    }
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writePref("theme", next);
  }

  function toggleFont() {
    const large = readPref("ai-chat-font") !== "large";
    if (large) document.documentElement.dataset.font = "large";
    else delete document.documentElement.dataset.font;
    writePref("ai-chat-font", large ? "large" : "normal");
  }

  return (
    <div className="flex h-dvh">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNew={startNew}
        onSelect={openConversation}
        onTogglePin={togglePin}
        onDelete={remove}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="rounded-lg px-3 py-2 hover:bg-surface-2 md:hidden"
            aria-label="대화 목록 열기"
            aria-controls="sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <h1 className="flex-1 truncate text-lg font-bold">장애인 지원 상담 챗봇</h1>
          <button type="button" id="font-toggle" onClick={toggleFont} className="rounded-lg px-3 py-2 hover:bg-surface-2">
            <span aria-hidden="true">가+</span>
            <span className="sr-only">글자 크기 바꾸기</span>
          </button>
          <button type="button" id="theme-toggle" onClick={toggleTheme} className="rounded-lg px-3 py-2 hover:bg-surface-2">
            <span aria-hidden="true">🌓</span>
            <span className="sr-only">다크 모드 바꾸기</span>
          </button>
        </header>

        <section aria-label="대화 내용" className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h2 className="mb-2 text-xl font-bold">안녕하세요! 무엇이 궁금하신가요?</h2>
                <p className="mb-4 text-muted">
                  장애인활동지원과 장애인근로지원 제도에 대해 쉽게 알려 드려요. 정확한 지원 시간이나 금액은
                  해마다 바뀌므로 담당 기관에 꼭 확인해 주세요.
                </p>
                {SUGGESTIONS.map((s) => (
                  <div key={s.group} className="mt-3">
                    <h3 className="mb-2 font-semibold">{s.group}</h3>
                    <div className="flex flex-wrap gap-2">
                      {s.questions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="rounded-full border border-border bg-surface-2 px-4 py-2 text-left hover:border-accent"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul id="messages" className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <MessageBubble key={m.id} message={m} pending={streaming && i === messages.length - 1} />
                ))}
              </ul>
            )}
            <div ref={endRef} />
          </div>
        </section>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        <form
          className="border-t border-border bg-surface/80 px-4 py-3 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="mx-auto max-w-3xl">
            {error && (
              <p role="alert" id="error" className="mb-2 rounded-lg border border-danger px-3 py-2 text-danger">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <label htmlFor="message-input" className="sr-only">
                질문 입력
              </label>
              <textarea
                id="message-input"
                ref={inputRef}
                rows={2}
                maxLength={MAX_LENGTH}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // 한글 조합 중 Enter는 글자 확정이므로 보내지 않는다
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="궁금한 점을 적어 주세요 (Shift+Enter로 줄바꿈)"
                aria-describedby="privacy-note"
                className="min-h-12 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-3"
              />
              {streaming ? (
                <button type="button" id="stop" onClick={stop} className="rounded-2xl border border-border px-5 py-3 font-semibold">
                  중지
                </button>
              ) : (
                <button
                  type="submit"
                  id="send"
                  disabled={!input.trim()}
                  className="rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-fg disabled:opacity-50"
                >
                  보내기
                </button>
              )}
            </div>
            <p id="privacy-note" className="mt-2 text-sm text-muted">
              주민등록번호, 전화번호, 주소 같은 개인정보는 입력하지 마세요. 답변은 참고용이며 정확한 내용은 담당
              기관에 확인해 주세요.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
