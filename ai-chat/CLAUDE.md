# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 개요

장애인활동지원과 장애인근로지원 제도를 쉽게 안내하는 AI 상담 챗봇입니다. 저장소 루트(`vibe-practice`)의 하위 폴더이지만, 기존 `chat-next/`(GSC 챗봇)와는 **별개의 프로젝트**입니다. 코드나 저장 키를 공유하지 않습니다. 이 폴더는 GitHub Pages에서 빌드되지 않고 Google Cloud Run에 배포합니다.

- 대상 사용자: 장애인 당사자와 가족(기준), 활동지원사·근로지원인, 사업주, 기관 담당자
- 말투: 쉬운 우리말, 짧은 문장, 전문용어는 풀어서 설명
- UI와 커밋 메시지는 한국어

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프레임워크 | Next.js (App Router, TypeScript) — 화면과 API를 한 앱에 |
| API | Hono — `app/api/[[...route]]/route.ts` 하나에 마운트(`hono/vercel`의 `handle`) |
| DB | MongoDB Atlas + Mongoose |
| AI 에이전트 | Mastra (`@mastra/core`, `@mastra/memory`, `@mastra/mongodb`) |
| 모델 | Claude Sonnet 5.5 (`claude-sonnet-5-5`) |
| 스타일 | Tailwind CSS, 색은 CSS 변수(라이트/다크) |
| 테스트 | Vitest (API·로직), Playwright (화면) |
| 배포 | Google Cloud Run (`asia-northeast3`, 서울) |

라이브러리 API는 자주 바뀝니다. 코드를 쓰기 전에 설치된 버전의 문서를 확인합니다.
- Next.js 16: `node_modules/next/dist/docs/` (`AGENTS.md` 참고)
- Mastra: `node_modules/@mastra/{core,memory,mongodb}/dist/docs/` (설치 버전과 맞는 문서가 들어 있음)
- Hono, Mongoose: context7

Mastra 모델은 `provider/model` 문자열로 지정합니다(`anthropic/claude-sonnet-5-5`). Mastra가 `ANTHROPIC_API_KEY`를 자동으로 읽으므로 AI SDK provider 패키지는 설치하지 않습니다.

## 디렉터리 구조

```
ai-chat/
├─ app/
│  ├─ api/[[...route]]/route.ts   # Hono 앱을 Next.js에 연결 (export GET, POST, DELETE…)
│  ├─ layout.tsx, page.tsx        # 사이드바(대화 목록) + 대화창
│  └─ globals.css
├─ components/                    # 클라이언트 컴포넌트 (API 키·DB 접근 금지)
│  ├─ Chat.tsx                    # 화면 전체 상태 (대화, 스트리밍, 테마, 글자 크기)
│  ├─ Sidebar.tsx                 # 대화 목록 (고정, 두 번 눌러 삭제)
│  └─ MessageBubble.tsx           # 답변 마크다운 렌더링
├─ server/
│  ├─ app.ts                      # Hono 앱 (basePath '/api', 오류 처리)
│  ├─ env.ts, errors.ts           # 컨텍스트 타입, ApiError
│  ├─ middleware/                 # anon-id.ts, rate-limit.ts
│  └─ routes/                     # chat.ts, conversations.ts
├─ mastra/
│  ├─ index.ts                    # Mastra 인스턴스 (MongoDBStore, globalThis 캐시)
│  ├─ agents/counselor.ts         # 상담 에이전트 + 시스템 프롬프트 + Memory
│  └─ tools/                      # 에이전트 도구 (RAG 검색 등, 추후)
├─ lib/
│  ├─ api.ts                      # 브라우저에서 /api 부르는 함수 (클라이언트 전용)
│  ├─ db.ts                       # Mongoose 연결 (globalThis 캐시)
│  └─ mask.ts                     # 개인정보 마스킹
├─ models/RateLimit.ts            # Mongoose 모델
├─ docs/                          # RAG용 공식 문서 (추후 추가)
├─ scripts/ingest.ts              # 문서 → 벡터 인덱스 적재 (추후)
├─ tests/unit/                    # Vitest (vitest.config.mts)
├─ tests/e2e/                     # Playwright (playwright.config.ts)
├─ Dockerfile, .dockerignore
└─ .env.example
```

`server/`, `mastra/`, `lib/db.ts`, `models/`는 서버 전용입니다. 클라이언트 컴포넌트에서 import하지 않습니다(필요하면 파일 첫 줄에 `import 'server-only'`).

## 요청 흐름

1. 브라우저가 `POST /api/chat`에 `{ conversationId?, message }`를 보냅니다. 새 대화면 `conversationId`를 빼고 보냅니다.
2. Hono 미들웨어가 익명 ID 쿠키를 확인하거나 새로 발급하고, 요청 횟수를 제한합니다.
3. 메시지의 개인정보를 마스킹한 뒤 Mastra 상담 에이전트를 실행합니다.
   - `resource` = 익명 ID, `thread.id` = conversationId (새 대화면 서버가 UUID 생성)
4. 응답 본문은 **답변 글자만 담은 `text/plain` 스트림**이고, 대화 ID는 `X-Conversation-Id` 헤더로 알려 줍니다. 도중 오류는 스트림을 오류로 끊어 알립니다. Mastra Memory가 메시지를 MongoDB에 저장합니다.
5. Mastra `generateTitle`이 답변 뒤에 대화 제목을 따로 만듭니다. 그래서 화면은 답변이 끝난 뒤와 4초 뒤에 대화 목록을 다시 불러옵니다.

## 상담 에이전트 규칙 (시스템 프롬프트)

- 다루는 범위는 **장애인활동지원**(보건복지부)과 **장애인근로지원**(근로지원인 서비스, 한국장애인고용공단) 두 가지입니다. 범위 밖 질문은 정중히 거절하고, 두 분야로 할 수 있는 일을 안내합니다.
- 질문이 어느 분야인지 애매하면 되묻습니다. 두 제도를 섞어서 답하지 않습니다.
- 지원 시간, 금액, 본인부담금, 자격 기준처럼 해마다 바뀌는 숫자는 **지어내지 않습니다.** 근거 문서(RAG)에 있을 때만 출처와 기준 연도를 함께 말합니다. 없으면 기관으로 안내합니다.
  - 활동지원: 주민센터(읍·면·동), 국민연금공단 1355, 보건복지상담센터 129
  - 근로지원: 한국장애인고용공단 1588-1519
- 개인의 수급 여부나 판정 결과를 단정하지 않습니다. "신청해서 판정을 받아야 정확히 알 수 있다"고 안내합니다.
- 사용자가 개인정보를 적으면 그 내용을 되풀이하지 않고, 입력하지 말라고 짧게 안내합니다.
- 답변은 짧은 문단과 목록으로 씁니다. 마크다운 표는 꼭 필요할 때만 씁니다.

에이전트는 처음에는 1개로 시작합니다. 분야별 지시가 많아지면 분야별 에이전트 2개와 라우터로 나누는 것을 검토합니다.

## RAG (추후 — 문서가 준비되면)

아직 문서가 없습니다. 지금은 RAG 없이 위 규칙만으로 동작합니다. 문서를 넣을 때는 다음 순서로 진행합니다.

1. `docs/`에 공식 문서를 넣습니다(예: 「장애인활동지원 사업안내」, 근로지원인 사업 지침). 파일 이름에 기준 연도를 붙입니다.
2. `scripts/ingest.ts`가 문서를 잘게 나누고(`@mastra/rag`) 임베딩해 MongoDB Atlas Vector Search에 넣습니다. 각 조각에는 `{ domain: 'activity' | 'work', source, year, page }` 메타데이터를 붙입니다.
3. 에이전트에 검색 도구를 추가합니다. 도구는 `domain`으로 결과를 걸러냅니다.
4. 답변 끝에 출처(문서 이름, 연도, 쪽)를 표시합니다.

미정: 임베딩 모델. Claude에는 임베딩 모델이 없으므로 별도 제공자를 골라야 합니다(예: Voyage AI, OpenAI, Google).

## 데이터

같은 MongoDB 데이터베이스를 쓰고, 컬렉션으로 역할을 나눕니다.

- **Mastra Memory**(`@mastra/mongodb`): 대화 스레드와 메시지. 컬렉션 이름은 Mastra가 정합니다. 직접 수정하지 않고 Mastra API(`listThreads`, `getThreadById`, `recall`, `updateThread`, `deleteThread`)로만 다룹니다.
  - 대화 목록의 정보도 스레드에 함께 둡니다. 제목은 `thread.title`, 고정 여부는 `thread.metadata.pinned`에 저장합니다. 직접 바꾼 제목은 `metadata.titlePinned: true`로 표시해 자동 제목 생성이 덮어쓰지 않게 합니다. 같은 정보를 Mongoose에 한 번 더 저장하지 않습니다.
- **Mongoose**(`models/`): Mastra 밖의 앱 데이터.
  - `RateLimit`: `{ key, count, expiresAt }`
  - 사용자 설정처럼 새 앱 데이터가 생기면 여기에 추가합니다.
- 대화와 메시지는 **기한 없이 보관**합니다. 자동 삭제(TTL)는 두지 않고, 사용자가 직접 지울 때만 삭제합니다. TTL은 `RateLimit`에만 씁니다.

Mongoose 규칙:
- 연결은 `lib/db.ts`의 `connectDB()` 하나로만 만듭니다. 개발 서버가 모듈을 다시 불러와도 연결이 늘지 않도록 `globalThis`에 캐시합니다.
- 모델은 `mongoose.models.X || mongoose.model('X', schema)` 패턴으로 등록합니다(핫 리로드 때 중복 등록 오류 방지).
- 대화를 다루는 모든 API는 `getOwnedThread()`로 `thread.resourceId === anonId`를 먼저 확인합니다. 남의 대화는 존재 여부도 알리지 않도록 404로 답합니다.

## API (Hono, `/api` 아래)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/chat` | 메시지 전송, 응답 스트리밍 |
| GET | `/conversations` | 내 대화 목록 |
| GET | `/conversations/:id/messages` | 대화의 메시지 |
| PATCH | `/conversations/:id` | 제목 변경, 고정 |
| DELETE | `/conversations/:id` | 대화 삭제(Mastra 스레드와 메시지) |
| GET | `/health` | Cloud Run 상태 확인 (쿠키·DB 없이 응답) |

- 입력 검증은 zod(`@hono/zod-validator`)로 합니다. 메시지 길이 상한은 2,000자입니다.
- 오류는 `{ error: { code, message } }` 형식으로 보냅니다. `message`는 사용자에게 그대로 보여 줄 수 있는 한국어 문장입니다.

## 화면

- 왼쪽에 대화 목록 사이드바(휴대폰에서는 서랍 형태), 오른쪽에 대화창을 둡니다.
- 첫 화면에는 인사말과 분야별 추천 질문(활동지원 / 근로지원)을 보여 줍니다.
- 응답은 스트리밍으로 보여 주고 마크다운으로 렌더링합니다. 중지 버튼을 둡니다.
- 대화 삭제처럼 되돌릴 수 없는 동작은 두 번 눌러 확인합니다(3초 뒤 원래대로). `confirm()`은 쓰지 않습니다.
- 입력창 아래에 "주민등록번호, 전화번호, 주소 같은 개인정보는 입력하지 마세요" 안내를 둡니다.
- 다크 모드: `localStorage`의 `'theme'`(`'light'`/`'dark'`)에 저장하고, 첫 방문 때는 `prefers-color-scheme`을 따릅니다.

### 접근성 (WCAG 2.1 AA / KWCAG)

- 새 답변은 `aria-live="polite"` 영역으로 화면 낭독기에 알립니다. 스트리밍 중에 글자마다 읽지 않도록 답변이 끝났을 때 알립니다.
- 키보드만으로 모든 기능을 쓸 수 있어야 하고, 포커스 표시가 보여야 합니다.
- 글자 크기 키우기 버튼을 둡니다(저장 키 `'ai-chat-font'`). 색 대비는 4.5:1 이상으로 맞춥니다.
- `prefers-reduced-motion`을 켠 사용자에게는 애니메이션을 끕니다.

## 보안과 개인정보

- `ANTHROPIC_API_KEY`와 `MONGODB_URI`는 서버 코드에서만 씁니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- 익명 ID: 첫 요청 때 무작위 ID를 발급하고 `SESSION_SECRET`으로 서명한 쿠키(`HttpOnly`, `Secure`, `SameSite=Lax`, 1년)에 담습니다. 로그인 기능은 없습니다.
- 마스킹: 메시지를 에이전트에 넘기거나 저장하기 전에 `lib/mask.ts`로 주민등록번호, 휴대전화 번호, 이메일 패턴을 `***`로 바꿉니다.
- 요청 제한(`POST /chat`에만 적용): Cloud Run은 인스턴스가 여러 개라 메모리 카운터를 쓸 수 없습니다. 그래서 MongoDB `RateLimit` 컬렉션(TTL)으로 횟수를 셉니다.
  - 익명 ID: 분당 10회, 하루 100회
  - IP: 분당 30회, 하루 300회 (기관 사무실처럼 여러 사람이 한 IP를 쓸 수 있어 더 넉넉하게)
  - IP는 `X-Forwarded-For`의 첫 번째 값을 씁니다.
- 서버 로그에 메시지 본문을 남기지 않습니다.

## 환경 변수

`.env.local`은 git에서 제외하고, `.env.example`(값 없이 이름만)을 커밋합니다.

```
ANTHROPIC_API_KEY=
MONGODB_URI=
MONGODB_DB_NAME=ai-chat   # Mastra와 Mongoose가 같은 DB를 씀
SESSION_SECRET=
```

`SESSION_SECRET`이 없으면 `/api/health`를 뺀 모든 API가 `CONFIG` 오류(500)를 돌려줍니다.

## 실행

```
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm test           # Vitest
npm run test:e2e   # Playwright (포트 3100에 개발 서버를 직접 띄움)
```

로컬 MongoDB도 쓸 수 있지만, Vector Search(RAG)는 Atlas에서만 동작하므로 개발용 Atlas 무료 클러스터를 권장합니다.

## 배포 (Google Cloud Run)

- `next.config.ts`에 `output: 'standalone'`을 설정합니다. `Dockerfile`은 멀티 스테이지(deps → build → runner, `node:24-slim`)로 만들고 root가 아닌 사용자로 실행합니다. 서버는 `PORT` 환경 변수를 따릅니다.
- 지역은 `asia-northeast3`, 요청 제한 시간은 300초(스트리밍 대비)로 합니다. 비용을 줄이려면 최소 인스턴스는 0으로 둡니다.
- 비밀 값은 Secret Manager에 두고 `--set-secrets`로 연결합니다.
- Atlas 접속 허용: Cloud Run은 나가는 IP가 고정되지 않습니다. 처음에는 `0.0.0.0/0`을 허용하고 강한 DB 비밀번호를 씁니다. 운영 단계에서는 VPC 커넥터와 Cloud NAT로 고정 IP를 만들어 그 IP만 허용합니다.
- 배포 후 `/api/health`와 대화 한 번으로 동작을 확인합니다.

## 테스트

- Vitest(`tests/unit/`): 마스킹, 입력 검증, 익명 쿠키, 대화 소유권 검사. Hono 앱을 `app.request()`로 직접 부릅니다. `@/mastra`와 요청 제한은 `vi.mock`으로 바꿔 Claude와 MongoDB를 부르지 않습니다. `server-only`는 `vitest.config.mts`에서 빈 모듈로 바꿉니다.
- Playwright(`tests/e2e/`): 메시지 전송, 마크다운 표시, 대화 목록, 삭제 확인, 오류 알림, 다크 모드와 글자 크기. `/api/*`는 모두 `page.route`로 가로채므로 API 키나 DB 없이 돌아갑니다.
- 동작이나 요소 id를 바꾸면 테스트도 함께 고칩니다.

## 미정 사항

- RAG 문서와 임베딩 모델 (문서가 준비되면 결정)
- Cloud Run 도메인 연결 여부
