# 할 일 목록 (Next.js)

`todo/index.html`과 같은 기능을 Next.js(App Router) + TypeScript로 만든 버전입니다.

## 실행

```bash
npm install      # 처음 한 번
npm run dev      # 개발 서버 → http://localhost:3000
npm run build    # 배포용 빌드
npm run lint     # 코드 검사
```

## 기능

- 할 일 추가 / 완료 체크 / 삭제
- 더블클릭 또는 ✏️ 버튼으로 수정 (Enter 저장, Esc 취소)
- 전체 · 진행 중 · 완료 필터, 모두 완료/해제
- 진행률 막대, 완료 항목 일괄 삭제(두 번 눌러 확인)
- 다크 모드 — 다른 페이지들과 같은 `'theme'` 키를 공유
- 브라우저 `localStorage`의 `'todo-next'` 키에 저장 (다른 탭과 자동 동기화)

## 파일 구조

- `app/layout.tsx` — HTML 뼈대, 테마 깜빡임 방지 스크립트
- `app/page.tsx` — 첫 화면
- `app/globals.css` — 공통 파스텔 색상표
- `components/TodoApp.tsx` — 목록 전체 화면 (클라이언트 컴포넌트)
- `components/TodoItem.tsx` — 할 일 한 줄
- `lib/store.ts` — localStorage 저장소 (`useSyncExternalStore`로 구독)
