import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "장애인 지원 상담 챗봇",
  description: "장애인활동지원과 장애인근로지원 제도를 쉽게 안내하는 AI 상담 챗봇",
};

// 화면이 그려지기 전에 테마와 글자 크기를 적용해 깜빡임을 막는다
const prefsScript = `
try {
  var t = localStorage.getItem('theme');
  if (t !== 'light' && t !== 'dark') {
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
  if (localStorage.getItem('ai-chat-font') === 'large') {
    document.documentElement.dataset.font = 'large';
  }
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 인라인 스크립트가 data-* 속성을 바꾸므로 hydration 경고를 끈다
    <html lang="ko" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
