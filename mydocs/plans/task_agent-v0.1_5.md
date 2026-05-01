# [수행계획서] task_agent-v0.1_5 — rhwp-studio 우측 사이드바 채팅 UI

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task5`
- **선행 task**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ + [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ + [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅ + [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4) ✅
- **작성일**: 2026-05-01
- **방법론 근거**: 본가 [CLAUDE.md](../../CLAUDE.md) 절차 3단계 + fork [methodology_refinements.md](../manual/methodology_refinements.md) R-001/R-007/R-008/R-009/R-010/R-011/R-013/R-014/R-015

---

## 1. 목적 / 배경

agent-v0.1 마일스톤의 **사용자 가시 산출물 첫 task**. #2 의 `complete()`, #3 의 `completeWithTools()`, #4 의 `completeInSession()` 백엔드를 *실제 사용자 채팅으로 연결*. 본 fork 의 **첫 frontend task** — R-013 의 layer 2 (compose 부팅) 가 frontend 에 무의미하므로 *layer 2 재정의* 가 본 task 의 신규 도전.

```
사용자 입력 (rhwp-studio 편집 영역)
    ↓
우측 사이드바 채팅 UI (#5 본 task)  ← 본가 무수정 정책 예외: rhwp-studio/src/agent/
    ↓ sessionId + userMessage
agent-server (#4 ChatService.completeInSession)
    ├─ SessionService.get(sessionId) ── lazy expire
    ├─ history + userMessage → completeWithTools (#3 의 도구 호출 루프)
    └─ assistant reply + tool calls/results
    ↑ 응답
사이드바 메시지 누적 표시 + 도구 호출 결과 시각화
```

본 task 는 *UI 와 백엔드 연결* 까지만. HTTP 엔드포인트 외부 노출·인증·CORS 는 #6, 사이드바 너비 조정·마크다운 렌더링·영속 저장은 마일스톤 외.

## 2. 종료 조건

이슈 #5 의 종료 조건을 그대로 인용 (R-009 적용된 수치 포함).

- [ ] `rhwp-studio/src/agent/` 모듈 — Sidebar / ChatInput / MessageList / ToolResultCard 등 컴포넌트
- [ ] `src/main.ts` 진입점 import 1~2줄 (본가 무수정 정책 예외, **분리 커밋**)
- [ ] agent-server `completeInSession` 호출 단위 테스트 (#4 SessionService 연동, mocked)
- [ ] 도구 호출 결과 시각화 (#3 의 도구 명·인자·결과)
- [ ] 자동 e2e (R-013 layer 2 재정의 — Vite preview + Puppeteer 유력)
- [ ] 사이드바 toggle (열기/닫기) 동작 검증
- [ ] 응답 시간 (R-009): 메시지 전송 → 첫 응답 표시 ≤ **5초 ± 2초** (즉 3~7초 허용 범위, 모킹 기준)
- [ ] 메시지 max length (R-009): **10,000자 ± 2,000자** (즉 8,000~12,000자 허용 범위)
- [ ] 사이드바 너비 (R-009): **360px ± 60px** (즉 300~420px 허용 범위)
- [ ] 수행계획서 / 구현계획서 / 단계별 보고서 / 최종 보고서 작성

## 3. 영향 범위

| 종류 | 경로 | 변경 형태 |
|------|------|----------|
| 신규 | `rhwp-studio/src/agent/sidebar.ts` (또는 `.tsx`) | 사이드바 컨테이너 컴포넌트 |
| 신규 | `rhwp-studio/src/agent/chat-input.ts` | 채팅 입력창 컴포넌트 |
| 신규 | `rhwp-studio/src/agent/message-list.ts` | 메시지 누적 표시 |
| 신규 | `rhwp-studio/src/agent/tool-result-card.ts` | 도구 호출 결과 시각화 |
| 신규 | `rhwp-studio/src/agent/agent-client.ts` | agent-server 호출 wrapper |
| 신규 | `rhwp-studio/src/agent/agent-store.ts` | 채팅 상태 관리 (R-5-B) |
| 신규 | `rhwp-studio/src/agent/agent.css` | 사이드바 스타일 |
| 신규 | `rhwp-studio/e2e/agent-component.test.mjs` | Puppeteer 컴포넌트 격리 mount 테스트 (R-013 layer 1 — frontend 변형, R-5-K) |
| 신규 | `rhwp-studio/e2e/agent-integration.test.mjs` | Puppeteer 통합 e2e (R-013 layer 2 — Vite preview) |
| 수정 | `rhwp-studio/src/main.ts` | 진입점 1~2줄 — `import './agent'; agent.mount()` 형태 (분리 커밋) |
| 수정 (선택) | `rhwp-studio/src/style.css` 또는 `index.html` | 사이드바 컨테이너 슬롯 (필요 시) |

**본가 코드 무수정 정책 예외** (사전 결정, [`mydocs/orders/_NEXT_SESSION.md`](../orders/_NEXT_SESSION.md) §"#5 정책 충돌 결정" 인용):

옵션 1 (산발 수정), 옵션 2 원안 (sibling 패키지), 옵션 3 (iframe) 모두 비채택. **옵션 2 의 변형** — `rhwp-studio/src/agent/` 신규 폴더 + `src/main.ts` 진입점 1~2줄 만 수정 — 채택. 본가 동기화 충돌 표면을 `main.ts` 의 1~2줄로 *국소화* + 통합도 (상대 경로 import) 유지.

main.ts 1~2줄 수정은 **분리 커밋** — 본가 동기화 시 cherry-pick / revert 용이성 확보.

본가 다른 폴더 (`src/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`, `rhwp-agent-server/` 외) 무수정 유지.

### 누적 환경 점검 (R-011)

본 task 시작 시 점검 완료:

- working tree clean ✅ (`local/task5` 분기 직후)
- `rhwp-agent-server/.env`: OPENAI_* 3개 (4 task 누적 일관)
- `rhwp-agent-server/{node_modules,dist}` 캐시 유효 ✅
- `rhwp-fork-agent-server:latest` (286MB) 캐시 유효 ✅
- `rhwp-studio/node_modules` 유효 ✅
- `rhwp-studio/dist` ⚠️ **부재** — 첫 frontend task 라 빌드 캐시 신규 (Stage 진행 중 첫 빌드)
- `rhwp-studio/package.json` 존재 ✅
- git remotes: origin + upstream 모두 등록 ✅

### 추가 발견 사항 (R-010 결과, 수행계획서 보강)

구현계획서 작성 전 R-010 외부 정보 조회로 다음 발견:

1. **rhwp-studio 단위 테스트 프레임워크 부재** — `package.json` scripts 에 `test` 없음. jest/vitest 의존성 0. 기존 컨벤션 = *e2e (puppeteer) only* (`e2e/*.test.mjs` 26개). **R-5-K 신설** — §6 결정사항으로 정식화.
2. **TypeScript ^6.0.3 + Vite ^8.0.10** — 빌드: `tsc && vite build`. 신규 코드도 TS 컴파일 통과 필수 (빌드 실패 시 R-013 layer 2 차단).
3. **vite-plugin-pwa ^1.2.0** — preview 모드의 service worker 가 `fetch` 인터셉트 가능성. R-5-F 검증 시 점검 필요 (R-5-F 보강).
4. **import alias `@/...`** — vite.config 정의. 신규 `rhwp-studio/src/agent/` 코드도 alias 사용 가능 (rhwp-studio 정합).

## 4. 외부 의존성

R-007 적용 (모두 *제약*으로 명시):

| 항목 | 제약 | 비고 |
|------|------|------|
| `rhwp-studio` 기존 빌드 도구 | 안정 채널 (Vite 기본) | rhwp-studio/package.json 기존 그대로 |
| 채팅 UI 컴포넌트 라이브러리 | **R-5-A 결정 후 확정** — vanilla DOM 우선 | rhwp-studio 정합 시 신규 의존성 0 |
| 상태 관리 라이브러리 | **R-5-B 결정 후 확정** — module singleton 우선 | 신규 의존성 0 가능 |
| `puppeteer-core` (e2e) | rhwp-studio/e2e 기존 그대로 (^24.42.0) | #4 의 host CDP 패턴 재활용 + 컴포넌트 격리 mount + 통합 mount 두 형태 (R-5-K 결정) |
| `crypto.randomUUID()` (sessionId 클라이언트 발급 시) | 브라우저 표준 (Chrome 92+) | 개발 호스트 = 최신 Chrome |
| `fetch` API | 브라우저 표준 | agent-server 호출용 |
| TypeScript | rhwp-studio 기존 (^6.0.3) | `tsc && vite build` 통과 필수 |
| Vite | rhwp-studio 기존 (^8.0.10) | `npm run build && npm run preview` 패턴 (R-5-F) |

**신규 의존성 0 목표**. R-5-A/R-5-B 결정에 따라 변경 가능 (그 경우 §6 결정 시점에 명시 + 안정 채널 선택).

## 5. 단계 분할 개요 (잠정, 구현계획서에서 확정)

R-5-K 결정 (puppeteer-only) 반영:

| Stage | 내용 | 검증 |
|-------|------|------|
| **Stage 1** | `agent-client.ts` + `agent-store.ts` + 컴포넌트 격리 puppeteer 테스트 (R-013 layer 1 frontend 변형) | Vite dev + puppeteer 컴포넌트 mount + mocked fetch 어설션 |
| **Stage 2** | UI 컴포넌트 (Sidebar / ChatInput / MessageList / ToolResultCard) + 컴포넌트 격리 puppeteer 테스트 | Vite dev + puppeteer DOM 어설션 |
| **Stage 3** | `main.ts` 진입점 통합 + 사이드바 toggle + 통합 e2e (R-013 layer 2 — Vite preview + production 번들 + PWA SW 점검) | `npm run build && npm run preview` + puppeteer 통합 mount + mocked agent-server |
| **Stage 4** (선택) | 실 agent-server 통합 검증 | host CDP 수동 점검 (OPENAI_API_KEY 사용) |

3~4 stage. Stage 4 는 OPENAI 실 API 의존이라 옵셔널. 구현계획서 §단계 정의에서 *3 stage 본행 + 1 옵셔널* 또는 *3 stage 압축* 확정.

## 6. 리스크 / 미해결 결정사항

R-015 적용 — 각 항목별 추천 + 이유 + **반대 입장 근거**.

### R-5-0. 본가 코드 무수정 정책 예외 (사전 결정 인용)

본 결정은 _NEXT_SESSION.md §"#5 정책 충돌 결정" 에서 이미 확정. 본 §6 에는 *결정 경위 인용* 만.

- **채택**: 옵션 2 의 변형 — `rhwp-studio/src/agent/` 신규 폴더 + `src/main.ts` 진입점 1~2줄
- **이유 요약**: 본가 동기화 충돌 표면을 `main.ts` 1~2줄로 국소화 + 상대 경로 import 통합도 유지
- **반대 입장 근거 (옵션 1 산발 수정)**: 본가 동기화 충돌 위험 분포 *예측 불가* → 비채택
- **반대 입장 근거 (옵션 2 원안 sibling 패키지)**: cross-package 공개 API 정의 부담이 #5 범위 외 → 비채택
- **반대 입장 근거 (옵션 3 iframe)**: 통합도 손상이 #5 핵심 가치 손상 → 비채택

### R-5-A. 컴포넌트 형태 (vanilla DOM vs. lit vs. React/Vue 격리)
- **추천**: **vanilla DOM API** (rhwp-studio 정합)
- **이유**:
  1. rhwp-studio 의 기존 컴포넌트 (`view/`, `command/`, `hwpctl/`) 모두 *vanilla DOM* — 정합성 100%
  2. 신규 의존성 0 (R-007 안정 채널 + 의존성 추가 부담 회피)
  3. 사이드바 + 채팅 UI 정도의 복잡도는 vanilla 로 충분
  4. 본가 동기화 시 의존성 충돌 표면 0
- **반대 입장 근거**:
  1. 채팅 메시지 동적 업데이트가 빈번 → React/Vue 의 *reactive 렌더링* 이 코드량 절감 가능
  2. 향후 마크다운 렌더링/스트리밍 응답 추가 시 vanilla 의 *재렌더링 로직* 부담 ↑
  3. lit 은 web components 표준 + 가벼움 → 두 마리 토끼 (정합성 + 반응성)
- **결정 경위**: rhwp-studio 정합 우선. 후속 task 에서 *마크다운/스트리밍* 도입 시 lit 검토 가능. 본 task 시점에 격리 React/Vue 도입은 *YAGNI*.

### R-5-B. 상태 관리 (module-level singleton vs. EventTarget vs. 외부 라이브러리)
- **추천**: **EventTarget 기반 store** — module-level singleton + EventTarget 으로 변경 알림
- **이유**:
  1. 브라우저 표준 (`EventTarget` 클래스) — 신규 의존성 0
  2. pub/sub 패턴 자연스럽게 적용 — UI 컴포넌트가 store 변경 구독
  3. rhwp-studio 의 기존 `command/` 패턴 (event-driven) 과 정합 가능
- **반대 입장 근거**:
  1. 단순 module-level singleton + 직접 함수 호출 만으로 충분 (사이드바 단일 컨테이너 → DOM 갱신 함수 직접 호출)
  2. zustand/redux 는 *복잡한 상태* 에서 진가 발휘 — 본 task 의 채팅 메시지 배열 수준에선 과해상도
  3. EventTarget 도 *수동 unsubscribe* 부담 (메모리 leak 위험)
- **결정 경위**: 본 task 의 *UI 컴포넌트 수* (Sidebar, ChatInput, MessageList, ToolResultCard) 가 4개 — pub/sub 의 가치 발생. 단일 호출 만으로 충분한 경우라면 module singleton 으로 단순화. **구현계획서에서 첫 stage 진행 시 재평가**.

### R-5-C. sessionId 발급 시점 (사이드바 첫 열림 vs. 첫 메시지 전송 vs. 페이지 로드)
- **추천**: **첫 메시지 전송 시**
- **이유**:
  1. 사용자가 *실제로 채팅을 시작* 할 때만 세션 자원 소비 — 자원 효율
  2. 사이드바 토글만 한 사용자 (의도 없음) 의 빈 세션 누적 방지
  3. 페이지 로드 시 발급 시 *모든 사용자가 세션 자원 점유* — 비효율
- **반대 입장 근거**:
  1. 페이지 로드 시 발급은 *첫 메시지 응답 지연 0* (이미 세션 준비됨)
  2. 사이드바 첫 열림 시 발급은 *사용자 의도 명확* + 첫 메시지 지연 회피의 절충안
  3. 첫 메시지 전송 시 발급은 *create + append 두 호출* 첫 메시지에 발생 (#4 R-4-B 와 동일 이슈)
- **결정 경위**: agent-server (#4) 가 *클라이언트 sessionId 인자 옵셔널* 미지원 (#4 R-4-B 보강에서 후속 으로 미룸). 따라서 *서버 자동 발급* 만 가능 → 첫 메시지 전송 시 round-trip 발생. 그러나 R-5-D 와 묶어서 *클라이언트 발급* 채택 시 페이지 로드 시 발급 가능. **R-5-D 와 함께 결정**.

### R-5-D. sessionId 발급자 (server vs. client)
- **추천**: **server (현재 #4 의 자동 발급 그대로)**
- **이유**:
  1. #4 R-4-B 결정 — 서버 자동 발급. 본 task 가 별도 결정하면 *#4 결정 뒤집기*
  2. 클라이언트 발급은 *POST /session 신규 endpoint* 필요 (마일스톤 외 #6 영역 침범)
  3. 본 task 에서 server.completeInSession() 의 *첫 호출 응답에 sessionId 포함* 패턴 활용 가능 (#4 가 이미 그렇게 동작)
- **반대 입장 근거**:
  1. 클라이언트 발급은 *오프라인 첫 호출* 가능 (PWA 시나리오)
  2. UUID 사용 시 충돌 확률 무시 가능 — 발급자 차이가 기능적 차이 적음
  3. 클라이언트 발급은 *#5 와 #4 의 의존성 역전* — 백엔드가 클라이언트에 종속되지 않아 깔끔
- **결정 경위**: #4 결정 존중. 단, #4 의 `completeInSession(sessionId)` 가 *없는 sessionId 자동 생성* 동작인지 확인 필요. 만약 없으면 *별도 create() 호출* 첫 메시지 전 필요. **Stage 1 첫 통합 시점에 #4 인터페이스 재확인 후 R-5-C/D 동시 확정**.

### R-5-E. 도구 호출 결과 시각화 형태 (collapsible card vs. inline pill vs. raw json toggle)
- **추천**: **collapsible card** — 도구 명 + 인자 요약 항상 표시, 결과는 클릭 시 펼침
- **이유**:
  1. #3 의 도구 호출 결과는 *구조화된 객체* — JSON 트리 형태가 자연
  2. 항상 펼친 상태는 *메시지 흐름 가독성 ↓*, 항상 접힌 상태는 *디버깅 어려움* → 토글이 절충
  3. 사용자에게 *AI 가 어떤 도구를 호출했는지* 가시성 ↑
- **반대 입장 근거**:
  1. inline pill (예: `[hwpctl.insertText("hello")]`) 은 메시지 흐름 자연스러움 — 채팅 UI 답게
  2. 디버깅 모드 (별도 토글) 가 더 명확 — 일반 사용 시 도구 결과 숨김
  3. raw json toggle 은 *개발자 친화* — agent-v0.1 의 사용자가 *개발자 본인* 일 가능성 높음
- **결정 경위**: 본 task 는 *agent-v0.1 마일스톤 — 개발자 검증 단계*. *디버깅 가시성* 우선 → collapsible card 채택. UX 개선은 후속 마일스톤.

### R-5-F. R-013 layer 2 재정의 (frontend task 첫 사례)
- **추천**: **Vite preview + Puppeteer e2e**
- **이유**:
  1. Vite preview 는 *production 번들* 서빙 — `npm run build && npm run preview` 패턴
  2. rhwp-studio/e2e 의 기존 puppeteer-core 인프라 (host CDP / headless Chrome) 재활용
  3. 백엔드의 docker compose 부팅 검증과 *목적 동일* (production 환경 정합성)
  4. R-013 정의 *"jest 의 가짜 환경에서 통과한 검증이 실제 production 환경에서도 동일 동작"* 에 대응 — Vite preview 가 그 역할
  5. **vite-plugin-pwa 의 service worker 가 production 빌드에서만 활성** → preview 모드가 SW 의 fetch 인터셉트 영향까지 검증 (보강 발견)
- **반대 입장 근거 (dev server 헤드리스)**:
  1. Vite dev server 가 *HMR 등 개발 전용 기능* 을 포함 → production 정합성 일부 손상
  2. 빌드 시간 절감 (preview 는 build 필수, dev 는 즉시 시작)
  3. dev server 는 SW 비활성 → SW 영향 검증 불가
  4. 그러나 *production 환경 정합* 이 layer 2 본질 — dev server 로는 R-013 정신 미달
- **반대 입장 근거 (compose 통합)**:
  1. compose 에 rhwp-studio + agent-server *cross-process orchestration* 가능 — 가장 production 유사
  2. 그러나 frontend dev server 의 docker 컨테이너화 *과해상도* — 사용자가 *브라우저에서 직접* 접속하는 게 정상
  3. 본 task 의 *agent-server 호출* 만 검증 → mock 으로 충분
- **결정 경위**: Vite preview 채택. 단, *agent-server 호출* 은 본 task 에서 mock 으로 처리 — 실제 통합은 Stage 4 (옵셔널) 또는 후속 task. **R-013 layer 2 정의 자체를 frontend task 의 새 사다리로 정식화** — 본 task 회고에서 R-016 (또는 R-013 보강) 후보.
- **PWA SW 점검 항목**: Stage 3 검증 시 *agent-client.ts 의 fetch 가 SW 에 의해 가로채지는지* 확인. 가로채면 mock 동작 안 하므로 *workbox-window 의 SW 갱신 hook* 또는 *fetch URL 화이트리스트* 처리 필요. 발생 시 §6 추가 결정사항 또는 Stage 3 deviation 보고.

### R-5-K. 단위 테스트 형태 (frontend, R-010 결과 보강)
- **추천**: **(D) puppeteer-only — 컴포넌트 격리 mount (layer 1) + 통합 mount (layer 2)**
- **이유**:
  1. rhwp-studio 기존 컨벤션 정합 (`e2e/*.test.mjs` 26개, 모두 puppeteer)
  2. 신규 의존성 0 — 본가 무수정 정책 0 영향
  3. `agent-client.ts` (순수 모듈) 도 puppeteer 컨텍스트에서 dynamic import + mocked fetch 어설션 가능
  4. layer 1·2 의 *동일 인프라* 재사용 → 도구 컨텍스트 전환 비용 0
- **반대 입장 근거 (A: Node 22 `node --test`)**:
  1. 순수 모듈 테스트는 Node test runner 가 빠름 (puppeteer 부팅 비용 회피)
  2. TS → JS 변환에 `tsx` 또는 `--experimental-strip-types` 필요 → 의존성/플래그 추가
  3. rhwp-studio 컨벤션 일탈 — 두 패턴 공존 부담
- **반대 입장 근거 (B: cross-package, agent-server jest)**:
  1. 의존성 0 유지
  2. 그러나 Vite alias `@/...` ↔ tsconfig paths 충돌 가능성
  3. cross-package import 시 빌드 환경 차이로 *runtime ≠ test* 위험
- **반대 입장 근거 (C: vitest 도입)**:
  1. 가장 *현대적* + Vite 정합 (vite + vitest 한 쌍)
  2. 그러나 `package.json` 수정 = 본가 무수정 정책 위반 — 정책 갱신 필요
  3. 본 task 범위 외 (정책 결정 부담)
- **결정 경위**: rhwp-studio 컨벤션 정합 + 신규 의존성 0 + 본가 무수정 정책 0 영향이 (D) 의 결정적 우위. *단위 테스트 격리성 손상* (DOM 환경 동반) 은 본 task 범위 (UI + agent-client) 에서 *허용 가능 trade-off* — 모든 코드가 어차피 브라우저 실행 환경. 후속 task 에서 *순수 알고리즘 모듈* 작성 시 (A) 검토 가능.

### R-5-G. 사이드바 toggle 진입점 (메뉴바 보기 메뉴 vs. 도구 상자 신규 버튼 vs. 단축키)
- **추천**: **메뉴바 *보기* 메뉴 + 단축키** (둘 다)
- **이유**:
  1. 메뉴바 보기 메뉴는 *발견 가능성* 높음 (사용자가 *다른 보기 옵션* 과 함께 인지)
  2. 단축키는 *반복 사용 시 효율* — 채팅을 자주 켜고 끄는 시나리오
  3. rhwp-studio 의 기존 메뉴바 패턴과 정합
- **반대 입장 근거**:
  1. 도구 상자 신규 버튼은 *시각적 표시* — 사이드바 켤 수 있다는 *기능 존재* 즉시 인지
  2. 메뉴바만 사용 시 *발견 단계 1단계 깊음* (메뉴 클릭 → 보기 → 채팅)
  3. 단축키는 *학습 부담* — 신규 사용자에게 의미 없음
- **결정 경위**: 메뉴바 보기 메뉴 우선 (발견 가능성 + 정합성). 단축키는 *Stage 3 또는 후속* 으로 분리 가능. 도구 상자 버튼은 본가 (`tb-` 접두어) 영역 변경 부담 → 본가 무수정 정책에 위배 가능 → 비채택. **단축키 추가 여부는 구현계획서 단계 분리**.

### R-5-H. 사이드바 기본 상태 (열림 vs. 닫힘)
- **추천**: **닫힘** (사용자 명시 toggle 시에만 열림)
- **이유**:
  1. 사용자가 *HWP 편집* 위해 rhwp-studio 를 열었을 때 채팅 UI 가 *기본 보임* 은 산만
  2. agent-v0.1 단계에선 채팅 UI 는 *옵셔널 보조 기능* — 강요 X
  3. 사용자가 *명시적으로 켰을 때* 만 띄워야 sessionId 발급 시점 (R-5-C) 자연스러움
- **반대 입장 근거**:
  1. 기본 열림은 *기능 존재 인지* 강함 — 발견 가능성 ↑
  2. 신규 사용자가 *채팅 가능 사실* 을 모를 수 있음
  3. agent-v0.1 의 *사용자 = 개발자* 라 산만 우려 적음
- **결정 경위**: 닫힘 채택. *최초 한 번* 만 *사이드바 안내 toast* (별도 task) 로 발견 가능성 보강 가능. 본 task 는 *최소 동작*.

### R-5-I. 채팅 입력 → 백엔드 호출 방식 (fetch 직접 vs. 가벼운 client wrapper)
- **추천**: **client wrapper** (`agent-client.ts`)
- **이유**:
  1. 단위 테스트에서 *모킹 용이* — wrapper 함수 1개 mock 으로 끝
  2. 에러 처리 / 타임아웃 / 재시도 정책을 *한 곳* 에 집중
  3. 후속 #6 에서 *HTTP 외 프로토콜* (예: WebSocket) 도입 시 wrapper 만 교체 → UI 영향 0
- **반대 입장 근거**:
  1. fetch 직접 사용은 *코드량 ↓ + 추상 레이어 0*
  2. wrapper 는 *YAGNI* — 본 task 가 *프로토콜 변경 가능성* 미상
  3. 단위 테스트는 *fetch 직접 mock* 도 가능
- **결정 경위**: wrapper 채택. *추상 레이어* 의 비용 (파일 1개) < *모킹/에러 처리/프로토콜 변경* 가치. R-3-D (zod 단일 진실 원천) 의 *추상 가치 명확* 패턴과 동일.

### R-5-J. agent-server 접속 형태 (NestJS CLI 직접 vs. HTTP)
- **추천**: **HTTP 호출 (#6 마일스톤 내 가정)**
- **이유**:
  1. 브라우저는 NestJS CLI *직접 호출 불가능* — IPC 또는 HTTP 만 가능
  2. #6 의 마일스톤 내 여부 확인 결과 (Stage 1 첫 통합 시점) 따라 결정 — *마일스톤 내* 면 HTTP 인프라 사용, *마일스톤 외* 면 본 task 가 *임시 HTTP endpoint 추가* (#6 영역 침범 위험)
  3. 임시 mock fetch 로 단위/e2e 테스트는 가능 (R-013 layer 2 mock 가능)
- **반대 입장 근거 (NestJS CLI)**:
  1. CLI 모드는 *프로세스간 통신 0* — 단일 프로세스 simplicity
  2. 그러나 브라우저 환경에서 불가능 → *데스크톱 앱* (Electron/Tauri) 시나리오에서만 의미
  3. rhwp-studio 는 *브라우저 SPA* — CLI 직접 호출 불가
- **결정 경위**: HTTP 만 가능. **#6 의 마일스톤 내 여부 확인** 이 우선 → 마일스톤 내면 #6 가 본 task 보다 *선행* 되어야 (의존 역전). 마일스톤 외면 본 task 에서 *임시 HTTP endpoint* 추가 또는 *전체 mock* 으로 진행. **Stage 1 진입 전에 #6 마일스톤 상태 확인 + 의존 역전 시 작업지시자 의사결정 요청**.

## 7. 일정 가이드 (R-009)

frontend 첫 task 라 백엔드 task 보다 큰 오차 적정. 비교 기준 = #4 (백엔드, 4번째 task) 의 110±45분.

| 단계 | 코드 작업 (기준 ± 오차) | 비고 |
|------|----------------------|------|
| 수행계획서 | — | 본 문서 |
| 구현계획서 | — | 다음 단계 |
| Stage 1 | 50 ± 25분 | agent-client + agent-store + puppeteer 격리 테스트 (#6 의존 확인 포함) |
| Stage 2 | 70 ± 30분 | UI 컴포넌트 4개 + puppeteer 격리 테스트 (frontend 첫 사례라 큰 오차) |
| Stage 3 | 70 ± 30분 | main.ts 통합 + Vite preview + 통합 e2e + PWA SW 점검 (R-013 layer 2 재정의 포함, +10분 SW 점검 보강) |
| Stage 4 (선택) | 30 ± 15분 | 실 agent-server 통합 (옵셔널) |
| 최종 보고서 | — | 방법론 평가 누적 + R-013 layer 2 재정의 회고 |

총 코드 작업 190±85분 (Stage 4 제외 시). 백엔드 #4 의 1.7배 — frontend 첫 사례 + R-013 신규 정의 + R-5-K 신설 + PWA SW 점검 반영.

## 8. 방법론 평가 메모 (사전)

### 8.1 R-007~R-015 사전 적용 (5번째 task)

본 task 는 **R-014/R-015 두 번째 의무 적용 사례** (#4 가 첫 사례, deviation 0건 + 결정 변경 0건 + 누락 0건 입증). 본 task 의 검증 가설:

| ID | 본 task 가설 | 검증 방법 |
|----|-------------|---------|
| R-007 | 도구 버전 *제약* 표현 → deviation 0 (frontend 신규 의존성 0 목표) | Stage 종료 시 도구 버전 deviation 집계 |
| R-008 | 자동 검증 우선 → manual 브라우저 점검 0회 (Stage 4 제외) | Stage 종료 시 manual 검증 횟수 집계 |
| R-009 | 응답 시간 / 메시지 max length / 사이드바 너비 *기준 + 오차* → deviation 발생 시 *허용 범위 내* 자동 분류 |
| R-010 | 외부 정보 조회 (Vite preview vs. dev server vs. compose? lit vs. vanilla?) → 사전 명시 → 진행 끊김 0 |
| R-011 | 누적 환경 점검 → 시작 시점 deviation 0 (단, `dist` 부재는 첫 frontend task 정상) |
| R-013 | **layer 2 재정의 (Vite preview + Puppeteer)** → frontend task 첫 사례 — *재정의 자체* 가 검증 항목 |
| R-014 | 이슈 본문 점검표 (#5 본문 포함됨) → 작업지시자 즉시 파악 가능 — 두 번째 의무 적용 |
| R-015 | §6 결정사항 11건 (R-5-0 + R-5-A~J + R-5-K) 모두 *반대 입장 근거* 명시 → 결정 변경 유도되는지 측정 |

### 8.2 R-015 적용 효과 사전 예측

§6 의 R-5-A~R-5-K 중 *반대 입장 근거가 추천 변경을 유도할 가능성* 이 높은 항목:

- **R-5-B** (상태 관리): *module singleton* 단순화 vs. EventTarget pub/sub 가치 — Stage 1 첫 구현 시 재평가 명시
- **R-5-D** (sessionId 발급자): #4 의 `completeInSession()` 인터페이스 재확인 시 변경 가능
- **R-5-J** (agent-server 접속 형태): #6 의 마일스톤 내 여부 따라 본 task 범위 자체 변동 가능 — *결정 변경* 보다 *의존 역전* 의 형태로 영향
- **R-5-K** (단위 테스트 형태): puppeteer 부팅 비용이 실제 측정에서 *허용 범위 초과* 시 (A) Node test runner 재고려 가능

위 4개는 작업지시자 검증 질문 가능성 높음. 클로드 self-check 에서 *반대 입장 근거가 추천 변경을 유도하는지* 본 task 종료 시 평가.

### 8.3 R-013 layer 2 재정의 의의

본 task 는 R-013 의 *frontend 첫 사례*. 백엔드 (#2~#4) 의 *jest + compose* 사다리가 frontend 에 무의미 → *jest + Vite preview Puppeteer* 사다리로 재정의.

본 task 종료 시 R-013 정의 자체를 *backend / frontend 양 갈래* 로 분기시키거나 R-016 (frontend 검증 사다리 정식화) 으로 정식화 후보.

### 8.4 *5번째 task (#5)* 의 의의

- #1: R-007/R-008/R-009 신규 정식화 (적용 0건)
- #2: R-007~R-009 첫 사전 적용 + R-010~R-013 신규 정식화
- #3: R-007~R-013 사전 적용 → deviation 0건 + R-014/R-015 신규 정식화
- #4: R-007~R-015 모두 사전 적용 → 첫 *완전 누적* + R-014/R-015 첫 *의무* 적용 (효과 입증)
- **#5 (본 task)**: *frontend 첫 사례* — R-013 layer 2 재정의 + R-014/R-015 두 번째 의무 적용 + 본가 코드 무수정 정책 *첫 변형* (rhwp-studio/src/agent/ 폴더 + main.ts 1~2줄)

frontend 환경의 *방법론 호환성* + *본가 무수정 정책 변형* 의 안정성 입증이 본 task 의 핵심 평가 항목.
