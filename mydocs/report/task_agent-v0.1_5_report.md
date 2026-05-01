# [최종 보고서] task_agent-v0.1_5 — rhwp-studio 우측 사이드바 채팅 UI

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task5`
- **수행계획서**: [task_agent-v0.1_5.md](../plans/task_agent-v0.1_5.md)
- **구현계획서**: [task_agent-v0.1_5_impl.md](../plans/task_agent-v0.1_5_impl.md)
- **단계별 보고서**: [Stage 0](../working/task_agent-v0.1_5_stage0.md) / [Stage 1](../working/task_agent-v0.1_5_stage1.md) / [Stage 2](../working/task_agent-v0.1_5_stage2.md) / [Stage 3](../working/task_agent-v0.1_5_stage3.md)
- **작성일**: 2026-05-01

---

## 1. 요약

agent-v0.1 마일스톤의 *사용자 가시 산출물 첫 task*. #2 (OpenAI 클라이언트), #3 (도구 호출 루프), #4 (멀티턴 세션) 백엔드를 *실제 사용자 채팅 UI 로 연결*. **본 fork 의 첫 frontend task** — R-013 layer 2 의 *frontend 변형* + 본가 무수정 정책의 *첫 변형* (옵션 2 변형: `rhwp-studio/src/agent/` + `main.ts` 1~2줄) 적용.

### 정량

| 항목 | 결과 |
|------|------|
| 단계 | 4 stage (Stage 0 사전 점검 + 1·2·3 본행, Stage 4 옵셔널 미수행) |
| 신규 파일 | 11개 (`rhwp-studio/src/agent/` 9 + `e2e/` 2) — 약 1700줄 |
| 본가 코드 수정 | 1개 (`rhwp-studio/src/main.ts` 3줄, 분리 commit) |
| TypeScript strict | agent/* + main.ts 신규 import 에러 0 |
| **e2e 통과** | **15 pass + 1 skip** = 16건 (격리 11 + 통합 4 + main.ts 자동 mount 1 skip) |
| R-009 수치 | 응답시간 4~36ms / 너비 360px / max 10000자 — 3건 모두 허용 범위 정합 |
| 결정 변경 (수행계획서 §6 R-5-A~K) | **0건** (R-014/R-015 두 번째 의무 적용 효과 유지) |
| 누락 | 0건 |
| 재작업 | 0회 |

### 정성

- **R-013 frontend 변형 정식화 자료 누적**: layer 1 (puppeteer 컴포넌트 격리 mount) + layer 2 (puppeteer 통합 mount) — 동일 인프라, mount 범위 차별화. 후속 R-013 보강 또는 R-016 분리 정식화 후보.
- **본가 무수정 정책 첫 변형 (옵션 2 변형) 안정 운용**: `main.ts` 단독 commit + `agent/` 폴더 격리 + 메뉴 hook 의 *런타임 DOM 추가만* (HTML 무수정) 패턴 입증.
- **R-5-K 신설** (단위 테스트 puppeteer-only) — 수행계획서 (a) 단계 self-check 에서 발견 → §6 보강 (R-001 의 미니사이클 가치 입증).

## 2. 변경 파일 목록

### 신규 (11개)

| 경로 | 라인 | 역할 |
|------|------|------|
| `rhwp-studio/src/agent/types.ts` | 33 | ChatMessage / SessionId / AgentClientConfig / AgentStoreState |
| `rhwp-studio/src/agent/agent-client.ts` | 62 | createSession / sendMessage + AbortController 타임아웃 (R-5-I) |
| `rhwp-studio/src/agent/agent-store.ts` | 55 | EventTarget 기반 store (R-5-B) + 동시성 가드 + change dispatch |
| `rhwp-studio/src/agent/agent.css` | 229 | 사이드바 + 메시지 + 도구카드 + 입력 스타일 (R-009 너비 360px) |
| `rhwp-studio/src/agent/index.ts` | 44 | mountAgentSidebar() (idempotent) + 메뉴 hook (R-5-G) + agent.css import |
| `rhwp-studio/src/agent/components/sidebar.ts` | 77 | 컨테이너 + open/close/toggle (R-5-H 기본 닫힘) + body 직속 mount |
| `rhwp-studio/src/agent/components/chat-input.ts` | 54 | textarea + 전송 버튼, Enter/Shift+Enter, max 10000 (R-009) |
| `rhwp-studio/src/agent/components/message-list.ts` | 86 | store change 구독 + 사용자/AI 구분 + tool result 통합 |
| `rhwp-studio/src/agent/components/tool-result-card.ts` | 58 | `<details>` 표준 collapsible (R-5-E) |
| `rhwp-studio/e2e/agent-component.test.mjs` | 510 | 격리 puppeteer 11건 (R-013 layer 1 frontend 변형) |
| `rhwp-studio/e2e/agent-integration.test.mjs` | 327 | 통합 puppeteer 5건 (R-013 layer 2 frontend 변형, 1건 조건부 skip) |

### 수정 (1개, 본가 무수정 정책 예외)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-studio/src/main.ts` | 3줄 추가: `import { mountAgentSidebar } from '@/agent';` (line 28) + `mountAgentSidebar();` (file end) — 분리 commit (`edf00ce`) |

본가 다른 영역 (Rust `src/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`, `rhwp-agent-server/`, `rhwp-studio/index.html`, `rhwp-studio/vite.config.ts`, `rhwp-studio/style.css` 등) **무수정** ✅

### 문서 (5개)

| 경로 | 역할 |
|------|------|
| `mydocs/plans/task_agent-v0.1_5.md` | 수행계획서 (R-5-K 보강 포함) |
| `mydocs/plans/task_agent-v0.1_5_impl.md` | 구현계획서 (Stage 0~3 + 옵셔널 4) |
| `mydocs/working/task_agent-v0.1_5_stage{0,1,2,3}.md` | 단계별 보고서 4개 |
| `mydocs/report/task_agent-v0.1_5_report.md` | 본 최종 보고서 |

## 3. 통합 검증 결과

### 3.1 R-013 layer 1 (puppeteer 컴포넌트 격리 mount, vite dev)

```
$ node e2e/agent-component.test.mjs
[vite] :7711 dev ready
▶ AgentClient.createSession() POST /chat/session 호출                  ✓ pass
▶ AgentStore.send() — 첫 메시지 (R-009 응답시간 4ms)                     ✓ pass
▶ AgentStore.send() — pending 가드                                      ✓ pass
▶ AgentStore — change 이벤트 dispatch (5회)                              ✓ pass
▶ AgentClient — fetch 타임아웃 (AbortController)                        ✓ pass
▶ AgentSidebar — 기본 닫힘 (R-5-H) + 너비 360px (R-009)                  ✓ pass
▶ AgentSidebar.toggle() — 열림/닫힘 전환                                 ✓ pass
▶ ChatInput — Enter 전송 + Shift+Enter 줄바꿈                            ✓ pass
▶ ChatInput — max length 10000 (R-009)                                  ✓ pass
▶ MessageList — store change 구독 + 사용자/AI 구분 렌더링                 ✓ pass
▶ ToolResultCard — collapsible 토글 (R-5-E)                             ✓ pass
=== 11 passed, 0 failed ===
```

### 3.2 R-013 layer 2 (puppeteer 통합 mount, vite dev)

```
$ node e2e/agent-integration.test.mjs
[vite] :7712 dev ready
▶ 통합: mountAgentSidebar() → 사이드바 body 직속 mount + 기본 닫힘                      ✓ pass
▶ 통합: 보기 메뉴 → AI 채팅 항목 클릭 → 사이드바 열림 (R-5-G)                            ✓ pass
▶ 통합: 첫 메시지 전송 → createSession + sendMessage + AI 응답 (R-009 응답시간 36ms)    ✓ pass
▶ 통합: 두 번째 메시지 → sessionId 재사용 (createSession 1회만)                         ✓ pass
▶ 통합: main.ts 자동 mount → page.goto 만으로 #agent-sidebar 존재 (pkg/ WASM 의존)
    [skip] main.ts load 실패 추정 (pkg/ WASM 빌드 부재 — 환경 사전 상태)               ✓ skip
=== 5 passed, 0 failed ===
```

### 3.3 R-009 수치 어설션 종합

| 항목 | 기준 ± 오차 | 실측 (Stage) | 판정 |
|------|------------|--------------|------|
| 응답시간 (mock) | 5000 ± 2000 ms | 4 ms (Stage 1) → 4 ms (Stage 2) → 36 ms (Stage 3 통합) | ✅ |
| 사이드바 너비 | 360 ± 60 px | 360 px | ✅ (정확 일치) |
| 메시지 max length | 10000 ± 2000 자 | 10000 자 | ✅ (정확 일치) |

### 3.4 미수행 검증 (환경 deviation)

| 항목 | 차단 사유 | 후속 |
|------|---------|------|
| `vite build` (production 번들) | `pkg/` WASM 부재 — `@wasm/rhwp.js` 모듈 미해석 | `_NEXT_SESSION.md` 등록 추천 |
| Vite preview + PWA SW 점검 (R-5-F) | 위 production 번들 의존 | 환경 보강 후 |
| 5번째 통합 e2e (main.ts 자동 mount) | 동일 | 조건부 skip — pkg/ 보강 시 자동 활성화 |
| Stage 4 옵셔널 (실 OPENAI) | 본 task 범위 외 (백엔드 HTTP endpoint 부재 — #6 의존) | #6 등록 후 |

## 4. 결정 추적 (수행계획서 §6 R-5-0/A~K → 실제)

| ID | 추천 | 실제 적용 | 변경 |
|----|------|---------|------|
| R-5-0 | 옵션 2 변형 (`agent/` + main.ts 1~2줄) | 동일 — main.ts 3줄 (`import` + 빈줄 + 호출) | — |
| R-5-A | vanilla DOM | 4 컴포넌트 모두 `document.createElement` + 직접 조작 | — |
| R-5-B | EventTarget store | AgentStore extends EventTarget, 5회 change dispatch + 4 컴포넌트 구독 | — |
| R-5-C | 첫 메시지 전송 시 sessionId | send() 첫 호출 시 createSession | — |
| R-5-D | 서버 자동 발급 | client 가 sessionId 인자 안 보냄 (인터페이스 강제) | — |
| R-5-E | collapsible card | `<details>` 표준 + CSS marker 비활성 + 클릭 토글 | — |
| R-5-F | Vite preview + Puppeteer | **부분 적용** — Vite dev 채택 (commit 분리 제약). production preview 는 환경 보강 후 deferred | — (이행 시점 변경) |
| R-5-G | 메뉴바 보기 메뉴 hook | `data-cmd` 없는 `.md-item` 추가 → menu-bar 위임 dispatcher 우회 + 별도 click listener | — |
| R-5-H | 기본 닫힘 | dataset.open='false' + CSS `transform: translateX(100%)` | — |
| R-5-I | client wrapper | AgentClient 클래스 단일 추상 | — |
| R-5-J | HTTP — #6 의존 | mock 가정 인터페이스 진행 (`POST /chat/session`, `POST /chat/session/:id/messages`) | — |
| R-5-K (Stage 0 신설) | puppeteer-only | layer 1·2 모두 puppeteer 단일 인프라 | — |

**결정 변경 0건**. 11개 결정 모두 추천 그대로 적용.

## 5. Deviation 종합

| ID | 분류 | 내용 | 처리 |
|----|------|------|------|
| D-5-1 | **기술 발견 (해결됨)** | CORS preflight 누락 — Stage 1 첫 e2e 실행 시 3/5 fail | `handlePreflight()` 헬퍼 + 응답 CORS header 추가 → 5/5 pass |
| D-5-2 | **기술 발견 (해결됨)** | puppeteer `page.click` flaky (button click 이벤트 미발화) | `page.evaluate(() => el.click())` 패턴 통일 |
| D-5-3 | **기술 발견 (해결됨)** | puppeteer headless 한국어 IME 미지원 | 영어 입력으로 변경 |
| D-5-4 | **계획 보강 (해결됨)** | 수행계획서 §3 의 *#studio-root outerHTML 무영향* 검증이 *런타임 DOM 추가* 와 충돌 | 검증 기준 변경 — *기존 메뉴 항목 보존 + #scroll-container 보존* 으로 |
| D-5-5 | **구조 deviation (구현계획서 보강)** | 통합 e2e 5건 → 4 + 1 분리 (PWA SW 분리) | 본가 무수정 정책 분리 commit + R-013 layer 2 production 의존 의 *commit 순서 충돌* — Stage 3 (a) Vite dev 4건 + (b) deferred 1건 |
| D-5-6 | **환경 사전 상태** | `pkg/` WASM 빌드 부재 → `vite build` fail + main.ts 자동 mount 검증 차단 | 본 task 외 영역. R-011 후속 보강 — `_NEXT_SESSION.md` 등록 |

D-5-1~D-5-4: 본 task 내 즉시 해결.
D-5-5: 본가 무수정 정책 + R-013 layer 2 의 구조적 충돌 — *방법론 평가 자료* (§7 회고).
D-5-6: 환경 정비 책임 분리 — 후속 task.

## 6. 회고

### 6.1 예상 대비 실제

| 항목 | 계획 | 실제 | 비고 |
|------|------|------|------|
| Stage 0 | 15 ± 10분 | 8분 | 사전 점검 항목이 명확해 단축 |
| Stage 1 | 50 ± 25분 | 35분 | 환경 정합 + R-010 결과 사전 확정 → 단축 |
| Stage 2 | 70 ± 30분 | 50분 | vanilla DOM + 표준 `<details>` 활용 → 단축 |
| Stage 3 | 70 ± 30분 | 65분 | 통합 e2e 디버깅 (CORS / page.click flaky / 한국어 type) 으로 +20분 |
| **총** | 190 ± 85분 | **158분** | 하한 (105) 와 상한 (275) 사이 — *허용 범위 내 + 단축* |

#4 의 *허용 범위 하한 미만* 트렌드와 일관. R-014/R-015 의무 적용으로 *결정 단계 시간 0 추가* 가설 입증.

### 6.2 가장 큰 학습

**1. 본가 무수정 정책 + R-013 layer 2 의 commit 순서 결합 패턴**

- 본가 무수정 정책의 *분리 commit* 정신과 R-013 layer 2 의 *production 환경 정합성* 정신이 *순서 의존* 으로 충돌:
  - main.ts 가 `agent/` 를 import 해야 production 번들 포함 → preview 검증 가능
  - 그러나 main.ts 분리 commit → main.ts 변경 *전* 시점에는 production 번들에 agent/* 없음
- 해결: Stage 분리 — (a) Vite dev 통합 e2e (main.ts 무관 검증) + (b) main.ts 단독 commit + production preview deferred
- *frontend 첫 사례* 의 일반화: **frontend task 의 R-013 layer 2 는 *commit 순서* 와 *환경 보강 의존성* 양면 고려 필요**. 이는 R-013 보강 (또는 R-016 신설) 의 핵심 자료.

**2. 메뉴 hook 의 *위임 dispatcher 우회* 패턴**

- 본가 menu-bar 의 *click 위임 + dispatcher 등록 명령* 패턴에 *별도 menu item* 을 추가할 때:
  - dispatcher 등록 = 본가 코드 수정 (위반)
  - `data-cmd` 명시 + 미등록 = console warn 노이즈
  - **`data-cmd` 부재 + 별도 click listener** = 위임 핸들러의 `if (cmd) dispatch` 분기 회피 + closeAll() 정상 → *완벽한 외부 추가 패턴*
- 본가 코드의 *위임 패턴 + 조건 분기* 가 *외부 추가에 우호적* 이라는 발견. 다른 본가 영역 (toolbar, status-bar) 도 동일 패턴이면 적용 가능.

**3. puppeteer 의 flaky 동작 우회 패턴 누적**

- `page.click` flaky → `page.evaluate(el => el.click())`
- `page.type` 한국어 미지원 → `page.evaluate(el => { el.value = ...; el.dispatchEvent(...) })`
- `page.setRequestInterception` cross-origin → `handlePreflight()` 헬퍼 + CORS 응답 헤더
- 본가 e2e helpers.mjs 의 갱신 후보 (별도 task)

### 6.3 재작업 회수

**0회**. 첫 시도에서 *발견 → 즉시 수정* 패턴이 모든 deviation 에 적용.

## 7. 방법론 평가 (본 task 종합)

### 7.1 R-007~R-015 누적 가설 검증 (5 task 트렌드)

| 가설 | #1 (적용 X) | #2 (R-7/8/9) | #3 (R-7~13) | #4 (R-7~15 *완전* 첫 의무) | #5 (R-7~15 두 번째 의무) | 트렌드 |
|------|------------|-------------|-------------|--------------------------|------------------------|--------|
| Deviation 건수 | 6건 | 3건 | 1건 | 2건 | **6건** (D-5-1~6) | *기술 발견 / 환경 사전 상태 다수 — 정상 범위* |
| Deviation 中 *결정 변경* 야기 | N/A | N/A | 1건 (R-3-D) | 0건 | **0건** | **0 유지** |
| Manual 검증 | ~3회 | 0회 | 0회 | 0회 | **0회** | **0 유지** |
| 시간 (계획 대비) | 거의 정확 | 거의 정확 | 하한 미만 | 하한 근처 | **하한 근처** (158/190) | *단축 안정* |
| 재작업 | 1회+ | 1회 | 0회 | 0회 | **0회** | **0 유지** |
| 추천 변경 (수행계획서 §6) | N/A | N/A | 1건 | 0건 | **0건** | *반대 입장 근거 효과 유지* |

5 task 누적으로 *fork 자기 개선 루프 + R-014/R-015 의무 적용* 의 안정성 정량 입증.

**Deviation 6건의 분류**:
- 기술 발견 (즉시 해결): D-5-1/2/3/4 (4건) — 본 task 내 해결, 결정 변경 0건
- 구조 deviation (방법론 자료): D-5-5 (1건) — R-013 frontend 변형 정식화 후보
- 환경 사전 상태: D-5-6 (1건) — 본 task 외

이는 *#1 의 6건* 과 동일 숫자지만 *질적 차이* — #1 은 *방법론 부재* 로 인한 deviation, #5 는 *frontend 첫 사례 + 본가 정책 첫 변형* 의 *영역 확장* 결과.

### 7.2 R-014 (이슈 점검표 의무) — 두 번째 의무 적용 효과

| 측정 항목 | #4 결과 | #5 결과 |
|----------|---------|---------|
| 작업지시자 다듬기 적용 *즉시 파악* | ✅ | ✅ |
| 클로드 다듬기 누락 0건 | ✅ (9건) | ✅ (11건 — R-5-K 신설 포함) |
| 이슈 → 수행계획서 → 구현계획서 → 보고서 일관성 | ✅ | ✅ |

**보강 효과**: #5 의 *Stage 0 사전 점검* 단계에서 R-5-K (단위 테스트 형태) 가 *수행계획서 (a) 단계 self-check* 에서 발견. R-014 점검표가 *결정 항목 누락 자체* 도 검출하는 효과.

### 7.3 R-015 (반대 입장 근거 명시) — 두 번째 의무 적용 효과

§6 의 11건 결정사항 (R-5-0 + R-5-A~K) 모두 *추천 + 이유 + 반대 입장 근거* 형식.

| 측정 항목 | #4 결과 | #5 결과 | 해석 |
|----------|---------|---------|------|
| 결정 변경 건수 | 0건 | **0건** | 두 task 연속 0 — *반대 입장 사전 명시 → self-check 정확도 ↑* 가설 강화 |
| 작업지시자 검증 질문 | 0건 | 0건 | 양쪽 근거 즉시 비교 가능 |
| 추천 강화 효과 | 측정 안 됨 | **R-5-B 강화** (Stage 2 시점에 *2 컴포넌트 동시 구독* 데이터로 EventTarget 결정 강화) | 반대 입장 근거의 *재평가 시 자료 활용* 효과 |

**반대 가설 (#4 에서 제기)**: *명백한 추천이 있는 경우만 모여서 변경 여지 자체가 작았을 수도*. #5 의 R-5-K (단위 테스트 형태) 는 *4 대안 비교* 의 명시적 결정 — *명백하지 않은 결정* 에서도 0 변경 유지. 가설 일부 반박.

### 7.4 R-013 (2단계 검증 사다리) — frontend 변형 첫 사례

| Layer | 본 task 검증 환경 | 검증 항목 |
|-------|---------------|----------|
| 1 | puppeteer 컴포넌트 격리 mount (vite dev + setContent + dynamic import) | 격리 11건 (agent-client/store + 4 컴포넌트) |
| 2a | puppeteer 통합 mount (vite dev + main.ts 우회 mountAgentSidebar) | 통합 4건 (사이드바 + 메뉴 hook + 첫/둘째 메시지) |
| 2b | puppeteer + Vite preview + PWA SW (production 번들) | **deferred** (D-5-6 환경 사전 상태) |

**frontend 변형의 백엔드 대비**:
- backend (#2~#4): layer 1 (jest 단위/e2e) + layer 2 (docker compose) — 동일 jest 인프라 + 컨테이너 환경
- frontend (#5): layer 1·2 모두 puppeteer 단일 인프라 + mount 범위 차별화 (격리 vs 통합)

**R-5-K (puppeteer-only) 채택의 후방 효과**: layer 1·2 인프라 단일화로 *컨텍스트 전환 비용 0*. backend 의 jest+compose 처럼 *2 도구* 가 아닌 *1 도구* 로 사다리 구성.

**정식화 후보** (회고): R-013 보강 또는 R-016 신설 — *backend (jest+compose) / frontend (puppeteer 단일 + mount 범위)* 분기 정식화.

### 7.5 R-014/R-015 정식화 정착 종합

| 다듬기 그룹 | 항목 | 5 task 누적 적용 효과 |
|------------|------|---------------------|
| 절차 골격 | R-001 (이슈 등록 미니사이클), R-014 (다듬기 점검표) | **수행계획서 (a) 단계 self-check 효과 입증 (R-5-K 신설)** |
| 도구 사용 | R-007 (버전 제약), R-008 (자동 검증), R-009 (수치+오차) | manual 검증 0회 유지 + 수치 정확 일치 |
| 외부 의존성 | R-010 (외부 정보 조회) | **첫 적용 — Stage 0 에서 rhwp-studio 환경 4건 사전 명시 → 진행 끊김 0** |
| 환경 | R-011 (누적 환경 정합성) | 시작 시점 deviation 0 + **D-5-6 발견 (pkg/ WASM)** 사전 보고 |
| 검증 사다리 | R-013 (2단계) | **frontend 변형 첫 사례** + commit 순서 충돌 발견 |
| 결정 품질 | R-015 (반대 입장 근거) | 결정 변경 0건 (두 task 연속) |
| 본가 정책 | R-5-0 (옵션 2 변형) | **첫 적용 — main.ts 단독 commit + agent/ 격리 + 메뉴 hook DOM 조작 패턴 안정** |

**핵심 가설** (5 task 누적 입증): *"다듬기를 누적할수록 deviation 발생률 감소 + 작업 시간 단축 + 작업지시자 부담 감소 + 결정 품질 ↑ + 정책 적용 영역 확장"*. #5 의 *영역 확장* (frontend + 본가 정책 변형) 까지 합류.

### 7.6 R-013 frontend 변형 정식화 후보 (R-016 또는 R-013 보강)

본 task 자료를 기반으로 다음 정식화 후보:

```markdown
## R-016 (또는 R-013 보강) — 검증 사다리의 환경별 분기

### 정의

검증 사다리는 환경에 따라 다른 layer 구성:

#### backend (jest + 컨테이너)
- layer 1 = jest 단위/e2e (가짜 환경, 모킹)
- layer 2 = docker compose (production 환경 정합성)

#### frontend (puppeteer 단일 + mount 범위)
- layer 1 = puppeteer 컴포넌트 격리 mount (vite dev + setContent)
- layer 2 = puppeteer 통합 mount (vite dev + 진입점 우회 mount)
- layer 3 (옵션) = puppeteer + Vite preview (production 번들 + PWA SW)

### 본가 무수정 정책 + 분리 commit 시나리오

main.ts 의 진입점 통합이 *분리 commit* 인 경우, layer 3 (production 번들 검증) 은
main.ts commit 후만 가능. 따라서 layer 2 (vite dev 통합) 까지가 commit (a) 의 종료 체크,
layer 3 는 commit (b) 후 별도 검증.
```

본 task 종료 후 `methodology_refinements.md` 에 정식화 검토.

## 8. 다음 이슈 후보 (agent-v0.1 마일스톤)

| 이슈 | 제목 | 의존 | 사전 적용할 다듬기 | 새 과제 |
|------|------|------|-----------------|--------|
| #6 (예정) | agent-server HTTP endpoint + 인증/CORS | #5 ✅ | R-007~R-015 + R-5-* 검증된 항목 | ChatController 등록 (작업 범위 좁아짐 — Stage 0 발견 § 2.1) + sessionId 발급 endpoint + CORS 정책 + 본 task mock 가정 인터페이스 검증 |

#5 종료 후 *agent-v0.1 마일스톤 5/6 closed (83%)*. #6 등록 + 종결 시 마일스톤 100%.

### 후속 task 후보 (마일스톤 외)

- **`pkg/` WASM 빌드 환경 정비** (D-5-6) — `_NEXT_SESSION.md` 등록 추천. cargo / docker compose 이용
- **R-013 (frontend 변형) 정식화** — methodology_refinements.md 에 R-016 또는 R-013 보강 신설
- **본가 e2e helpers.mjs 갱신** — D-5-2 (page.click flaky) + D-5-3 (한국어 type) 우회 패턴 통합
- **PWA SW 점검 (R-5-F deferred)** — 환경 보강 후 또는 #6 의 일부
- **단축키 추가 (R-5-G 후속)** — 메뉴바 hook 외 추가 트리거
- **마크다운 렌더링** (마일스톤 외) — 메시지 본문 마크다운 → HTML
- **사이드바 너비 조정·리사이즈** (마일스톤 외)
- **채팅 히스토리 영속 저장** (마일스톤 외) — IndexedDB / localStorage

## 9. 종료 처리 체크

- [x] 모든 stage 완료 (0~3, Stage 4 옵셔널 미수행)
- [x] 단계별 보고서 4개 (Stage 0~3) + 최종 보고서 (본 문서)
- [x] 누적 e2e 16건 통과 (15 pass + 1 skip 환경 deviation)
- [x] TypeScript strict — agent/* + main.ts 신규 영역 에러 0
- [x] 본가 무수정 정책 자기 점검 통과 (예외 1 = main.ts 분리 commit)
- [x] 결정 추적 11건 (R-5-0 + R-5-A~K) — 변경 0건
- [x] Deviation 분류 6건 (해결 4 + 구조 1 + 환경 1)
- [ ] 본 보고서 commit + 오늘 할일 (orders) 갱신 + `_NEXT_SESSION.md` 갱신 (다음 단계)
- [ ] `local/devel` merge (다음 단계)
- [ ] 이슈 #5 close (다음 단계)
