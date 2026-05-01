# [Stage 1 보고서] task_agent-v0.1_5 — agent-client + agent-store + 격리 puppeteer 테스트

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **수행계획서**: [task_agent-v0.1_5.md](../plans/task_agent-v0.1_5.md)
- **구현계획서**: [task_agent-v0.1_5_impl.md](../plans/task_agent-v0.1_5_impl.md)
- **단계**: 1 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task5`
- **작성일**: 2026-05-01
- **소요 시간**: 약 35분 (기준 50±25분 — 허용 범위 내, R-009 정상)

---

## 1. R-010 외부 정보 조회 결과

본 stage 의 외부 docs 의존: **0건**.

| 항목 | 출처 | 차단 시 영향 |
|------|------|------------|
| `crypto.randomUUID()` (브라우저) | MDN — Chrome 92+ | 0 (사용자 환경 보장) |
| `EventTarget` API | MDN — 브라우저 표준 | 0 |
| `fetch` + `AbortController` | MDN — 브라우저 표준 | 0 |
| Vite alias `@`, .ts on-the-fly transform | rhwp-studio 인프라 | 0 |

R-010 가설 (외부 정보 조회 사전 명시 → 진행 끊김 0) 자연 충족.

## 2. 변경 파일

### 신규 (4개)

| 경로 | 라인 수 | 역할 |
|------|--------|------|
| [`rhwp-studio/src/agent/types.ts`](../../rhwp-studio/src/agent/types.ts) | 33 | `ChatMessage`, `SessionId`, `AgentClientConfig`, `AgentStoreState` 타입 |
| [`rhwp-studio/src/agent/agent-client.ts`](../../rhwp-studio/src/agent/agent-client.ts) | 62 | `createSession()`, `sendMessage()`, AbortController 타임아웃 |
| [`rhwp-studio/src/agent/agent-store.ts`](../../rhwp-studio/src/agent/agent-store.ts) | 55 | `EventTarget` 기반 store + `send()`, 동시성 가드, change dispatch |
| [`rhwp-studio/e2e/agent-component.test.mjs`](../../rhwp-studio/e2e/agent-component.test.mjs) | 343 | 격리 puppeteer 5건 + vite spawn + CORS preflight 헬퍼 |

본가 코드 무수정 ✅. `rhwp-studio/src/agent/` 신규 폴더 + `rhwp-studio/e2e/agent-component.test.mjs` 신규 파일만.

## 3. TypeScript strict 검증

```
$ npx tsc --noEmit -p rhwp-studio 2>&1 | grep "src/agent/"
(empty)
```

agent/ 폴더 신규 코드는 strict 모드 통과 (에러 0). 기존 `src/core/wasm-bridge.ts`, `src/hwpctl/index.ts` 의 `@wasm/rhwp.js` 부재 에러 2건은 *환경 사전 상태* (pkg/ WASM 빌드 부재) — 본 task 영향 0, deviation 분류 외.

## 4. 격리 puppeteer 테스트 결과

```
$ node e2e/agent-component.test.mjs
[vite] :7711 ready
▶ AgentClient.createSession() POST /chat/session 호출
  ✓ pass
▶ AgentStore.send() — 첫 메시지: createSession + sendMessage + state 갱신 (R-009 응답시간)
    elapsed: 6ms (R-009 < 5000ms)
  ✓ pass
▶ AgentStore.send() — pending 중 재호출 즉시 return (동시성 가드)
  ✓ pass
▶ AgentStore — change 이벤트 dispatch (EventTarget pub/sub)
    change events: 5
  ✓ pass
▶ AgentClient — fetch 타임아웃 (AbortController, R-009 timeoutMs)
    aborted: AbortError
  ✓ pass

=== 5 passed, 0 failed ===
```

### 테스트 5건 분류

| # | 테스트 | 검증 항목 | R-* |
|---|--------|----------|-----|
| 1 | `AgentClient.createSession()` POST | URL/method 정합 + sessionId 응답 파싱 | R-5-D 채택안 |
| 2 | `AgentStore.send()` — 첫 메시지 | createSession + sendMessage 순차 + state 갱신 + 응답시간 6ms | R-5-C/D + R-009 |
| 3 | `AgentStore.send()` — pending 가드 | 동시 호출 시 둘째 즉시 return + createSession 1회만 | (자체 발견) |
| 4 | `AgentStore` — change dispatch | EventTarget 5회 dispatch (pending → sid → user → assistant → pending false) | R-5-B 채택안 |
| 5 | `AgentClient` — 타임아웃 | AbortController 200ms override 시 AbortError | R-009 timeoutMs |

## 5. 결정 적용 결과 (R-5-A~K)

| ID | 추천 | Stage 1 적용 | 변경 |
|----|------|-----------|------|
| R-5-A vanilla DOM | 채택 | agent/* 모두 vanilla TS, DOM 미사용 (Stage 2 검증) | — |
| R-5-B EventTarget | 채택 | AgentStore extends EventTarget, change dispatch 검증 (5회) | — |
| R-5-C 첫 메시지 발급 | 채택 | `send()` 첫 호출 시 sessionId === null 이면 createSession | — |
| R-5-D 서버 자동 발급 | 채택 (강제) | client 가 sessionId 인자 안 보냄, server 응답 받음 | — |
| R-5-I client wrapper | 채택 | AgentClient 클래스 단일 추상 | — |

R-5-E (도구 결과 시각화), R-5-F (layer 2), R-5-G/H (사이드바) 는 Stage 2/3 영역.

## 6. R-5-B 재평가 (구현계획서 종료 체크 항목)

**EventTarget 유지 결정** — module singleton 단순화 비채택.

근거:
- AgentStore.send() 는 *비동기 + 단계적 갱신* — Stage 1 검증에서 5회 change dispatch 확인
- UI 컴포넌트가 *비동기 응답 시점* 에 자동 갱신 받으려면 *이벤트 기반 구독* 가치 명확
- module singleton 으로 단순화 시 호출처가 *언제 갱신할지* 결정 부담 → 4개 컴포넌트 (Stage 2) 에 분산 부담

Stage 2 (UI 컴포넌트) 진입 시 *4개 컴포넌트 모두 동일 store change 구독* 가설 자연 충족 예상.

## 7. 발견·deviation

### 발견 (deviation 아님)

| 항목 | 내용 | 처리 |
|------|------|------|
| **CORS preflight 누락** | 첫 실행 시 cross-origin POST 의 OPTIONS preflight 미처리로 fetch fail (3/5 실패) | 즉시 수정 — `handlePreflight()` 헬퍼 + 응답 CORS 헤더 추가 → 5/5 pass. 구현계획서 §1.8 의 *기본 4건* → *5건 (change dispatch 추가)* 보강 |
| **TypeScript 기존 에러** | `src/core/wasm-bridge.ts`, `src/hwpctl/index.ts` 의 `@wasm/rhwp.js` 부재 (pkg/ WASM 빌드 부재) | 환경 사전 상태 — 본 task 외. R-011 환경 점검 보강 사항으로 *Stage 1 보고서* 에 명시 (현 항목) |
| **vite multi-page 미정의 + setContent 패턴 동작** | 구현계획서 §1.7 가정대로 `page.goto('/__agent_test__')` SPA fallback + `setContent` + dynamic `import('/src/agent/agent-client.ts')` 정상 동작 | 가정 검증 완료 — vite.config 무수정 패턴 확정 |

### deviation: 0건

R-009 응답시간 6ms (< 5000ms 허용 범위 내), 모든 테스트 pass.

## 8. 종료 체크

- [x] R-010 외부 docs 의존 0
- [x] `tsc --noEmit -p rhwp-studio` 신규 코드 strict 통과 (agent/* 에러 0)
- [x] puppeteer 격리 5건 모두 pass (구현계획서 §1.8 의 4건 → 5건으로 보강)
- [x] R-009 응답시간 자동 어설션 (6ms, < 5000ms)
- [x] AgentStore EventTarget change 이벤트 검증 (5회 dispatch)
- [x] R-5-B 재평가 명시 (EventTarget 유지)

## 9. 방법론 평가 메모

### R-013 layer 1 (frontend 변형) 첫 적용 효과

본 stage 가 R-013 *frontend layer 1* (puppeteer 컴포넌트 격리 mount) 의 *첫 사례*. 백엔드의 jest 단위 테스트와 비교:

| 항목 | jest (backend) | puppeteer (frontend, R-5-K) |
|------|---------------|---------------------------|
| 부팅 시간 | 1초 미만 | 약 2~3초 (vite spawn + browser launch) |
| 격리도 | 완전 (모킹) | DOM 환경 동반 (단점) |
| 인터셉트 정합성 | jest.mock | puppeteer.setRequestInterception (CORS 처리 추가) |
| 신규 의존성 | jest (기존) | 0 (puppeteer-core 기존) |
| 컨벤션 정합 | NestJS 표준 | rhwp-studio e2e/*.test.mjs 정합 |

**결론**: R-5-K 채택안 (puppeteer-only) 이 *부팅 시간 약간 ↑* 단점 외에는 정합성 우위. *격리도 손상* 은 본 task 의 *AgentClient/Store 가 모두 브라우저 코드* 라 자연 trade-off.

### R-014/R-015 두 번째 의무 적용 — Stage 1 효과

- 이슈 #5 본문 점검표 + 수행계획서 §6 (R-5-0 + R-5-A~K 11건) 의 *반대 입장 근거* 가 Stage 1 진입 시 *결정 적용 흐름 가시성* ↑
- *결정 변경 0건* 유지 (#4 동일 결과)
- CORS preflight 발견은 *방법론 외 기술 발견* — R-014/R-015 효과 측정 항목과 무관

### R-013 layer 2 정식화 후보 자료 누적

본 task 종료 시 R-013 layer 1·2 정의를 *backend (jest+compose) / frontend (puppeteer 격리+통합)* 로 분기 정식화 또는 R-016 분리. Stage 1 의 *부팅 시간 / 격리도 / 인터셉트 정합성* 측정 결과가 정식화 자료로 활용 가능.

## 10. 다음 단계

Stage 2 진입 — UI 컴포넌트 4종 (Sidebar / ChatInput / MessageList / ToolResultCard) + agent.css + 격리 puppeteer 6건 추가 (기준 70±30분, R-009).

작업지시자 승인 후 진입.
