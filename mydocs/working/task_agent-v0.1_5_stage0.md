# [Stage 0 보고서] task_agent-v0.1_5 — 사전 점검 (코드 변경 0)

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **수행계획서**: [task_agent-v0.1_5.md](../plans/task_agent-v0.1_5.md)
- **구현계획서**: [task_agent-v0.1_5_impl.md](../plans/task_agent-v0.1_5_impl.md)
- **단계**: 0 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task5`
- **작성일**: 2026-05-01
- **소요 시간**: 약 8분 (기준 15±10분 — 허용 범위 내, R-009 정상)

---

## 1. 점검 항목 4건

### 1.1 agent-server 인터페이스 재확인 (R-5-D)

[`rhwp-agent-server/src/chat/chat.service.ts:108-125`](../../rhwp-agent-server/src/chat/chat.service.ts) 재확인:

```ts
async completeInSession(sessionId: SessionId, userMessage: ChatMessage): Promise<ChatMessage> {
  this.sessions.append(sessionId, userMessage);          // ← sessionId 반드시 유효 (없으면 SessionNotFoundError)
  const conversation = [...this.sessions.get(sessionId).messages];
  const assistantReply = await this.completeWithTools(conversation);
  this.sessions.append(sessionId, assistantReply);
  // ...
}
```

[`rhwp-agent-server/src/session/session.service.ts:22-33`](../../rhwp-agent-server/src/session/session.service.ts):

```ts
create(initialMessages: ChatMessage[] = []): SessionId {
  const id = randomUUID();   // ← 외부 sessionId 인자 비수용. 자동 발급만.
  // ...
}
```

**결론**: R-5-D 추천 (서버 자동 발급) **강제 유지**. 클라이언트 발급 채택 시 SessionService 시그니처 변경 필요 → 본 task 범위 외.

### 1.2 agent-server HTTP endpoint 부재 + mock 가정 인터페이스 (R-5-J)

[`rhwp-agent-server/src/main.ts`](../../rhwp-agent-server/src/main.ts):

```ts
const app = await NestFactory.create(AppModule);
await app.listen(port);   // ← 이미 HTTP 모드로 부팅 (port 3000)
```

[`rhwp-agent-server/src/app.module.ts`](../../rhwp-agent-server/src/app.module.ts) 의 controllers:

```ts
controllers: [HealthController]   // ← /health 만. ChatController 부재.
```

**발견 (Stage 0 보강)**: agent-server 가 *이미 HTTP 모드* 로 부팅 중. 단지 `ChatController` 가 부재. **#6 의 작업 범위가 좁아짐** — agent-v0.1 마일스톤 6개 중 마지막 task = ChatController 등록 + 인증/CORS + sessionId 발급 endpoint 만.

**본 task 의 mock 가정 인터페이스** (Stage 1~3 puppeteer page.route 인터셉트 대상):

| 가정 endpoint | 응답 | #6 가 구현할 ChatController 메서드 (추정) |
|--------------|------|--------------------------------------|
| `POST /chat/session` | `{ sessionId: string }` | `SessionService.create()` wrapper |
| `POST /chat/session/:id/messages` body `{ content: string }` | `{ reply: ChatMessage }` | `ChatService.completeInSession()` wrapper |

본 task 종료 시 *#6 등록 추천 보고* — 위 인터페이스 가정안 포함.

### 1.3 #6 마일스톤 등록 상태 (R-5-J)

```
$ gh issue list --repo Alpha-ChangukChoi/rhwp --milestone "agent-v0.1" --state all
#5 OPEN   rhwp-studio 우측 사이드바 채팅 UI
#4 CLOSED 멀티턴 세션 히스토리 관리 (in-memory)
#3 CLOSED hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프
#2 CLOSED OpenAI Chat Completions 클라이언트 + 환경변수 검증
#1 CLOSED NestJS agent-server 스켈레톤 + docker-compose 통합
```

마일스톤 진행률 표기 (`_NEXT_SESSION.md`): *4/6 closed* → 6개 중 1개 미등록. **#6 (또는 차기 번호) 미등록 확인**. 본 task 종결 시 등록 추천.

### 1.4 본가 무수정 정책 변경 영역 사전 점검

| 영역 | 변경 형태 | 본가 무수정 정책 |
|------|---------|---------------|
| `rhwp-studio/src/agent/` (신규 9개 파일) | 신규 폴더 | ✅ 옵션 2 변형 영역 (#5 정책 결정 채택안) |
| `rhwp-studio/e2e/agent-component.test.mjs` | 신규 e2e | ✅ 옵션 2 변형 영역 |
| `rhwp-studio/e2e/agent-integration.test.mjs` | 신규 e2e | ✅ 옵션 2 변형 영역 |
| `rhwp-studio/src/main.ts` | 1~2줄 import + mountAgentSidebar() 호출 | ⚠️ **본가 무수정 정책 예외** — 분리 커밋 |
| `rhwp-studio/index.html` | **무수정** — 메뉴바 hook 은 DOM 조작 (런타임) | ✅ |
| `rhwp-studio/vite.config.ts` | **무수정** — 격리 mount 는 puppeteer setContent 로 회피 | ✅ |
| `rhwp-studio/src/style.css` | **무수정** (목표) — `agent.css` 별도 파일 + main.ts 에서 import | ✅ (Stage 2 검증) |
| 본가 다른 영역 (`src/` Rust, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`) | 무수정 | ✅ |

[`rhwp-studio/src/agent/`](../../rhwp-studio/src/) 부재 확인:

```
$ ls rhwp-studio/src/agent/
ls: rhwp-studio/src/agent/: No such file or directory
```

신규 폴더 생성 안전.

## 2. 추가 발견 (Stage 0 보강)

### 2.1 agent-server 가 이미 HTTP 모드

NestJS `app.listen(port)` 로 *이미 HTTP 서버* 부팅. 단지 `ChatController` 부재. 즉 *#6 의 작업 범위가 좁아짐*. 본 task 의 mock 가정 인터페이스가 *#6 의 라우트 정의 가이드* 로 활용 가능.

### 2.2 PWA Service Worker 의 dev 모드 비활성

[`rhwp-studio/vite.config.ts:73`](../../rhwp-studio/vite.config.ts):

```ts
VitePWA({
  // ...
  devOptions: {
    enabled: false,   // ← dev 모드 SW 비활성
  },
});
```

**Stage 영향**:
- Stage 1·2 (`vite dev`): SW 비활성 → SW 영향 검증 불요
- Stage 3 (`vite preview`): SW 활성 → R-5-F 보강 PWA SW 점검 적용

### 2.3 Workbox 설정의 cross-origin 처리

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2,ttf,otf}'],
  runtimeCaching: [{ urlPattern: /\.wasm$/, handler: 'CacheFirst', ... }],
}
```

- `globPatterns`: precache 대상 — *static asset 만*. agent-server `POST /chat/session/*` 미포함.
- `runtimeCaching`: `.wasm$` 만 CacheFirst. agent-server 호출은 *기본 SW pass-through*.
- *cross-origin POST* 는 SW 의 default fetch 핸들러 통과 → puppeteer `setRequestInterception` 우선 가능성 높음.

**Stage 3 PWA SW 점검 시 추가 검증**: SW 가 활성이지만 *agent-server URL 패턴이 cache 대상 외* → 인터셉트 우려 낮음. 그러나 *workbox 가 자동 추가하는 navigation request 핸들러* 가 영향 줄 수 있어 Stage 3 통합 e2e 에서 실측.

### 2.4 Vite 설정 정합

```ts
resolve: { alias: { '@': resolve(__dirname, 'src'), '@wasm': resolve(__dirname, '..', 'pkg') } }
server: { port: 7700 }
```

- 신규 `rhwp-studio/src/agent/` 코드도 `@/agent` alias 사용 가능 (rhwp-studio 정합)
- dev/preview 기본 포트 7700 — puppeteer 테스트의 `VITE_PORT = 7700` 정합
- multi-page 정의 없음 → puppeteer `setContent` 패턴 채택 (vite.config 무수정 유지)

## 3. 종료 체크

- [x] `completeInSession()` + `SessionService.create()` 시그니처 재확인 → R-5-D 추천 강제 유지
- [x] HTTP endpoint 상태 — agent-server 이미 HTTP 모드, ChatController 만 부재. mock 가정 인터페이스 명시
- [x] #6 미등록 확인 — 본 task 종료 시 등록 추천
- [x] 본가 무수정 정책 변경 영역 8건 사전 점검 (정책 위반 0, 예외 1건 = main.ts 분리 커밋)

추가 발견 4건 — Stage 1~3 진입 시 활용.

## 4. 결정 변경 0건

§6 결정사항 11건 (R-5-0 + R-5-A~K) 중 *Stage 0 결과로 변경된 항목 0건*:

| ID | 추천 (수행계획서) | Stage 0 후 | 변경 |
|----|-----------------|----------|------|
| R-5-D | 서버 자동 발급 | 강제 유지 (인터페이스 강제) | — |
| R-5-J | HTTP — #6 의존 | mock 가정 진행 + #6 등록 추천 | — (구체화) |
| R-5-F | Vite preview + Puppeteer | 동일 + SW 점검 가설 보강 | — (구체화) |

R-5-J 와 R-5-F 는 *결정 변경 없음, 적용 방식 구체화*.

## 5. 발견·deviation

| 항목 | 분류 | 처리 |
|------|------|------|
| agent-server 이미 HTTP 모드 | 발견 (deviation 아님) | #6 작업 범위 축소 — 최종 보고서에 반영 |
| `devOptions.enabled: false` | 발견 | Stage 3 SW 점검 부담 ↓ |
| Workbox `globPatterns` cross-origin 미포함 | 발견 | Stage 3 SW 인터셉트 우려 ↓ |

**deviation 0건**. 모두 *수행계획서/구현계획서의 가정* 을 구체화하는 발견.

## 6. 방법론 평가 메모

### R-014/R-015 두 번째 의무 적용 — Stage 0 효과

이슈 #5 본문 + 수행계획서 §6 의 R-5-K 사전 점검표 + 구현계획서 §0 사전 점검 → **Stage 0 가 *4건 점검 + 4건 추가 발견* 을 코드 변경 0 으로 완료**. R-014 (점검표) + R-015 (반대 입장 근거) + R-001 (사전 점검 미니사이클) 의 *결합 효과* 측정 사례.

#4 (R-014/R-015 첫 의무 적용) 의 deviation 0 + 결정 변경 0 결과를 본 task 도 유지 가능성 높음 — Stage 0 시점 deviation 0 + 결정 변경 0 확인.

### R-013 frontend 변형 적용 직전

Stage 1 진입 시 R-013 layer 1 (puppeteer 격리 mount) 첫 실행. 본 task 가 *R-013 frontend 변형의 첫 사례*. Stage 1 종료 시 효과 측정.

## 7. 다음 단계

Stage 1 진입 — `agent-client.ts` + `agent-store.ts` + 격리 puppeteer 4건 (기준 50±25분, R-009).

작업지시자 승인 후 진입.
