# GSC 챗봇 (Next.js + Claude)

Next.js(App Router)와 Anthropic의 Claude API로 만든 채팅 앱입니다.

## 실행 방법

1. API 키 준비: https://platform.claude.com/settings/keys 에서 키를 발급받습니다.
2. `.env.example`을 `.env.local`로 복사하고 `ANTHROPIC_API_KEY=` 뒤에 키를 넣습니다.
3. 실행:

   ```bash
   npm install   # 처음 한 번
   npm run dev   # http://localhost:3000
   ```

`.env.local`은 `.gitignore`에 들어 있어서 GitHub에 올라가지 않습니다. 키는 절대 코드에 직접 쓰지 마세요.

## 구조

- `app/api/chat/route.ts` — 서버. 대화 기록을 받아 Claude에게 보내고, 답변을 글자 단위로 흘려보냅니다(스트리밍). API 키는 여기서만 씁니다.
- `components/Chat.tsx` — 화면. 메시지 입력, 답변 표시, 중지, 새 대화, 다크 모드.
- `lib/chat.ts` — 서버와 화면이 함께 쓰는 타입과 상수.
- `lib/store.ts` — localStorage 저장소. 대화는 `'chat-next'`, 테마는 다른 페이지와 같은 `'theme'` 키.

GitHub Pages는 서버 코드를 실행할 수 없어서 이 앱은 Pages에 올라가지 않습니다(로컬 전용).
