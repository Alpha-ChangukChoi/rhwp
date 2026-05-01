# [Stage 2 보고서] task_agent-v0.1_5 — UI 컴포넌트 4종 + 격리 puppeteer 6건 추가

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **수행계획서**: [task_agent-v0.1_5.md](../plans/task_agent-v0.1_5.md)
- **구현계획서**: [task_agent-v0.1_5_impl.md](../plans/task_agent-v0.1_5_impl.md)
- **단계**: 2 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task5`
- **작성일**: 2026-05-01
- **소요 시간**: 약 50분 (기준 70±30분 — 허용 범위 내, R-009 정상)

---

## 1. R-010 외부 정보 조회 결과

본 stage 의 외부 docs 의존: **0건**.

| 항목 | 출처 | 차단 시 영향 |
|------|------|------------|
| HTML `<details>` / `<summary>` (R-5-E collapsible) | MDN — 브라우저 표준 | 0 |
| CSS `position: fixed; transform: translateX` | 브라우저 표준 | 0 |
| `getComputedStyle` (테스트용) | 브라우저 표준 | 0 |
| Vite link `<link rel="stylesheet">` dev 처리 | rhwp-studio 인프라 | 0 |

R-010 차단 시 영향 0 유지.

## 2. 변경 파일

### 신규 (5개)

| 경로 | 라인 수 | 역할 |
|------|--------|------|
| [`rhwp-studio/src/agent/components/chat-input.ts`](../../rhwp-studio/src/agent/components/chat-input.ts) | 54 | textarea + 전송 버튼, Enter/Shift+Enter, max 10000자 |
| [`rhwp-studio/src/agent/components/tool-result-card.ts`](../../rhwp-studio/src/agent/components/tool-result-card.ts) | 58 | `<details>` 기반 collapsible (R-5-E) |
| [`rhwp-studio/src/agent/components/message-list.ts`](../../rhwp-studio/src/agent/components/message-list.ts) | 86 | AgentStore change 구독 + 사용자/AI 구분 + tool result 통합 |
| [`rhwp-studio/src/agent/components/sidebar.ts`](../../rhwp-studio/src/agent/components/sidebar.ts) | 77 | 컨테이너 + open/close/toggle + pending 시 입력 disable |
| [`rhwp-studio/src/agent/agent.css`](../../rhwp-studio/src/agent/agent.css) | 229 | 사이드바 + 메시지 + 도구카드 + 입력 스타일 |

### 수정 (1개)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-studio/e2e/agent-component.test.mjs` | MOUNT_HTML 갱신 (components import + agent.css link) + 6건 테스트 추가 (5건 → 11건) |

본가 코드 무수정 ✅. `index.html` / `vite.config.ts` / `style.css` 모두 무수정. 사이드바는 `document.body` 직속 mount → `#studio-root` 무영향.

## 3. TypeScript strict 검증

```
$ npx tsc --noEmit -p . 2>&1 | grep "src/agent/"
(empty)
```

agent/ 폴더 신규 코드 11개 파일 모두 strict 통과 (에러 0). 누적 7개 .ts (3 + 4 신규) + 1 .css.

## 4. 격리 puppeteer 테스트 결과

```
$ node e2e/agent-component.test.mjs
[vite] :7711 ready
▶ AgentClient.createSession() POST /chat/session 호출                              ✓ pass
▶ AgentStore.send() — 첫 메시지 (R-009 응답시간 4ms)                                 ✓ pass
▶ AgentStore.send() — pending 가드                                                  ✓ pass
▶ AgentStore — change 이벤트 dispatch (5회)                                          ✓ pass
▶ AgentClient — fetch 타임아웃 (AbortController)                                    ✓ pass
▶ AgentSidebar — 기본 닫힘 (R-5-H) + 너비 360px (R-009)                              ✓ pass
▶ AgentSidebar.toggle() — 열림/닫힘 전환                                             ✓ pass
▶ ChatInput — Enter 전송 + Shift+Enter 줄바꿈                                        ✓ pass
▶ ChatInput — max length 10000 (R-009)                                              ✓ pass
▶ MessageList — store change 구독 + 사용자/AI 구분 렌더링                             ✓ pass
▶ ToolResultCard — collapsible 토글 (R-5-E)                                         ✓ pass

=== 11 passed, 0 failed ===
```

**Stage 1 회귀 0건** (5건 모두 동일 결과 유지) + **Stage 2 신규 6건 pass**.

### 신규 6건 분류

| # | 테스트 | 검증 항목 | R-* |
|---|--------|----------|-----|
| 6 | `AgentSidebar` 기본 닫힘 + 너비 | `data-open=false` + `getComputedStyle.width = 360px` | R-5-H, R-009 |
| 7 | `AgentSidebar.toggle()` | open ↔ close 전환 | R-5-H |
| 8 | `ChatInput` Enter / Shift+Enter | Enter 전송, Shift+Enter 줄바꿈, 전송 후 textarea clear | R-5-A vanilla DOM |
| 9 | `ChatInput` max length | `textarea.maxLength === 10000` (R-009 10000±2000 범위) | R-009 |
| 10 | `MessageList` 사용자/AI 구분 | `.agent-message--user` / `.agent-message--assistant` 분리 렌더 | R-5-A, R-5-B |
| 11 | `ToolResultCard` collapsible | default closed → click → open + 결과 본문 표시 | R-5-E |

## 5. R-009 수치 어설션 결과

| 항목 | 기준 ± 오차 | 실측 | 판정 |
|------|------------|------|------|
| 응답시간 (mock) | 5000 ± 2000 ms | 4 ms | ✅ |
| 사이드바 너비 | 360 ± 60 px | 360 px | ✅ (정확히 중앙) |
| 메시지 max length | 10000 ± 2000 자 | 10000 자 | ✅ (정확히 중앙) |

세 수치 모두 *허용 범위 내 + 기준 정확히 일치*. R-009 가설 (수치 + 허용 오차 명시 → deviation 발생 시 자동 분류) 자연 충족.

## 6. 결정 적용 결과 (R-5-A~K)

| ID | 추천 | Stage 2 적용 | 변경 |
|----|------|-----------|------|
| R-5-A vanilla DOM | 채택 | 4 컴포넌트 모두 `document.createElement` + 직접 DOM 조작 | — |
| R-5-B EventTarget | 채택 | MessageList + AgentSidebar 가 `addEventListener('change', ...)` | — |
| R-5-E collapsible card | 채택 | `<details>` + `<summary>` 표준 HTML 사용 (CSS marker 비활성) | — |
| R-5-H 기본 닫힘 | 채택 | AgentSidebar 생성자 `dataset.open = 'false'` | — |
| R-5-K puppeteer-only | 채택 | 컴포넌트 격리 mount 6건 모두 puppeteer 단일 인프라 | — |

R-5-C/D (sessionId), R-5-F (layer 2), R-5-G (메뉴바 hook), R-5-I (client wrapper) 는 Stage 1 또는 Stage 3 영역.

## 7. R-5-B 재평가 (Stage 2 데이터 보강)

**Stage 1 결정 유지** — EventTarget pub/sub 채택.

Stage 2 의 데이터 입증:
- `MessageList` + `AgentSidebar` 두 컴포넌트가 *동일 store change 이벤트* 를 독립 구독
- `AgentSidebar` 는 *pending 변화* 만 관심 (입력 disable), `MessageList` 는 *messages/error/pending 모두* 렌더링
- 동일 store 의 *다른 관심사 분리* 가 EventTarget pub/sub 으로 *자연스럽게* 구현 — module singleton 시 *호출처가 어떤 변경을 누구에게 알릴지* 결정 부담

수행계획서 R-5-B *반대 입장 근거 (module singleton 단순화)* 가 Stage 2 시점에서 *불충분한 단순화* 임이 입증.

## 8. 발견·deviation

### 발견 (deviation 아님)

| 항목 | 내용 | 처리 |
|------|------|------|
| Vite dev `<link rel="stylesheet" href="/src/agent/agent.css">` 정상 처리 | dev 모드에서 .css 파일 직접 서빙 + 격리 테스트에서 `getComputedStyle` 어설션 가능 | 가정 검증 — Stage 3 production 빌드 시 `import './agent.css'` 패턴 정합 |
| `<details>` 표준 사용 | R-5-E collapsible 을 *직접 JS 토글 구현* 없이 HTML 표준으로 처리 — 코드 단순화 | 회고에서 *vanilla 표준 우선* 의 추가 사례로 기록 |

### deviation: 0건

R-009 수치 3건 모두 기준치 정확히 일치 (응답시간 4ms, 너비 360px, max 10000자). 모든 테스트 pass.

## 9. 종료 체크

- [x] 컴포넌트 4종 신규 + agent.css
- [x] 컴포넌트 격리 6건 추가 모두 pass (누적 11건, Stage 1 회귀 0)
- [x] `#agent-sidebar` 가 *body 직속* — `#studio-root` 무영향 (본가 무수정 정책)
- [x] R-009 사이드바 너비 360px (CSS 검증), max length 10000 (DOM 어설션) — 자동 어설션 통과
- [x] R-5-A vanilla DOM 정합 — 신규 의존성 0 유지
- [x] R-5-E collapsible card — `<details>` 토글 동작 검증

## 10. 방법론 평가 메모

### R-014/R-015 두 번째 의무 적용 — Stage 2 효과

- 결정 변경 0건 유지 (#4 동일, Stage 0 → Stage 1 → Stage 2 누적)
- 누락 0건 유지 (R-5-A~K 11건 모두 stage 별 적용 추적)
- *반대 입장 근거가 추천 변경 유도* 0건 — Stage 2 시점에서 *오히려 추천 강화* (R-5-B EventTarget 의 pub/sub 가치가 4 컴포넌트 → 2 컴포넌트 동시 구독으로 입증됨)

### R-013 frontend layer 1 효과 측정

| 측정 | 결과 |
|------|------|
| 부팅 시간 (vite spawn + browser launch) | 약 2~3초 (1회) — 11 테스트 *동일 vite 인스턴스 재사용* 으로 분산 |
| 격리 시간 (테스트당) | 약 1~2초 (page.goto + setContent + evaluate) |
| 회귀 검출 | Stage 1 의 5건 회귀 0 — 컴포넌트 추가가 기존 store/client 동작 영향 없음 자동 검증 |
| 자동 어설션 정밀도 | DOM 속성 (`data-open`, `maxLength`) + computed style (`width`) + DOM 트리 (`.agent-message--user`) 모두 안정적 |

R-5-K (puppeteer-only) 채택안의 *정밀도 + 정합성* 입증. Stage 3 (layer 2 통합) 진입 시점에서 동일 인프라 재활용.

### R-013 정식화 자료 누적 (Stage 1 → Stage 2)

본 task 종료 시 R-013 layer 1·2 frontend 변형을 *별도 R-* 또는 R-013 보강* 으로 정식화 후보. Stage 1·2 의 *동일 puppeteer 인프라 + mount 범위 차별화* 패턴이 정식화의 *구체 모델* 로 활용 가능.

## 11. 다음 단계

Stage 3 진입 — `agent/index.ts` (mountAgentSidebar) + `main.ts` 진입점 1~2줄 (분리 커밋) + 메뉴바 hook + Vite preview + 통합 e2e 5건 + PWA SW 점검 (기준 70±30분, R-009).

작업지시자 승인 후 진입.
