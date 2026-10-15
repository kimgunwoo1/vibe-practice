import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GSC 챗봇 (Next.js)",
  description: "Next.js와 Claude로 만든 GSC 챗봇",
};

// 화면이 그려지기 전에 테마를 정해서 다크 모드가 깜빡이지 않게 한다.
// 저장된 값이 없으면 운영체제 설정(prefers-color-scheme)을 따른다.
const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t !== 'light' && t !== 'dark') {
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 인라인 스크립트가 data-theme을 바꾸므로 hydration 경고를 끈다
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
