"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/api";

export default function MessageBubble({ message, pending }: { message: ChatMessage; pending: boolean }) {
  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <h3 className="sr-only">내 질문</h3>
        {/* 사용자 입력은 마크다운으로 해석하지 않고 글자 그대로 보여 준다 */}
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-user-bubble px-4 py-3">
          {message.text}
        </p>
      </li>
    );
  }

  return (
    <li className="flex justify-start">
      <h3 className="sr-only">상담 도우미 답변</h3>
      <div className="prose-answer max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
        {message.text ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {message.text}
          </ReactMarkdown>
        ) : pending ? (
          <span className="text-muted">답변을 준비하고 있어요…</span>
        ) : null}
      </div>
    </li>
  );
}
