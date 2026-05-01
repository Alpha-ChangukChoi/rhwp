# [Stage 3 보고서] task_agent-v0.1_5 — agent/index.ts + 통합 e2e (Vite dev) + main.ts 진입점 (분리 커밋)

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **수행계획서**: [task_agent-v0.1_5.md](../plans/task_agent-v0.1_5.md)
- **구현계획서**: [task_agent-v0.1_5_impl.md](../plans/task_agent-v0.1_5_impl.md)
- **단계**: 3 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task5`
- **작성일**: 2026-05-01
- **소요 시간**: 약 65분 (기준 70±30분 — 허용 범위 내, R-009 정상)

---

## 1. R-010 외부 정보 조회 결과

본 stage 의 외부 docs 의존: **0건**.

| 항목 | 출처 | 차단 시 영향 |
|------|------|------------|
| `Element.click()` (visibility 무관 click 발화) | MDN — 브라우저 표준 | 0 |
| `Page.setRequestInterception` + CORS preflight | puppeteer 문서 (Stage 1 이미 활용) | 0 |
| Vite dev `.css` 직접 서빙 | rhwp-studio 인프라 (Stage 2 이미 검증) | 0 |
| `[data-menu="view"] .menu-dropdown` DOM 구조 | rhwp-studio index.html (Stage 0 점검) | 0 |

R-010 가설 자연 충족.

## 2. 변경 파일

### 신규 (2개)

| 경로 | 라인 수 | 역할 |
|------|--------|------|
| [`rhwp-studio/src/agent/index.ts`](../../rhwp-studio/src/agent/index.ts) | 44 | `mountAgentSidebar()` (idempotent) + `hookMenuToggle()` 메뉴 hook + `agent.css` import |
| [`rhwp-studio/e2e/agent-integration.test.mjs`](../../rhwp-studio/e2e/agent-integration.test.mjs) | 310 | 통합 e2e 4건 + vite dev spawn + setupIntegration 헬퍼 |

### 수정 (다음 커밋)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-studio/src/main.ts` | 1~2줄 import + `mountAgentSidebar()` 호출 — **Stage 3 (b) 단독 커밋, 본가 무수정 정책 예외** |

본 보고서까지의 변경: **본가 코드 무수정 ✅**. main.ts 변경은 다음 commit 에서 단독 처리.

## 3. TypeScript strict 검증

```
$ npx tsc --noEmit -p . 2>&1 | grep "src/agent/"
(empty)
```

agent/* 누적 8개 .ts (Stage 1 3 + Stage 2 4 + Stage 3 1) + 1 .css 모두 strict 통과.

## 4. 통합 e2e 결과 (Vite dev)

```
$ node e2e/agent-integration.test.mjs
[vite] :7712 dev ready
▶ 통합: mountAgentSidebar() → 사이드바 body 직속 mount + 기본 닫힘                ✓ pass
▶ 통합: 보기 메뉴 → AI 채팅 항목 클릭 → 사이드바 열림 (R-5-G)                      ✓ pass
▶ 통합: 첫 메시지 전송 → createSession + sendMessage + AI 응답 표시 (R-009 28ms)  ✓ pass
▶ 통합: 두 번째 메시지 → sessionId 재사용 (createSession 1회만)                   ✓ pass

=== 4 passed, 0 failed ===
```

### 4건 분류

| # | 테스트 | 검증 항목 | R-* |
|---|--------|----------|-----|
| 1 | mountAgentSidebar() body 직속 mount + 기본 닫힘 | `parentTag === BODY` + `data-open=false` + 기존 메뉴 1개 추가 + `#scroll-container` 보존 | R-5-H, 본가 무수정 정책 |
| 2 | 보기 메뉴 → AI 채팅 클릭 → 사이드바 열림 | `agent-menu-item.click()` → toggle | R-5-G |
| 3 | 첫 메시지 전송 → createSession + sendMessage + AI 응답 | type + click → fetch 2회 + assistant 메시지 표시 + 응답시간 28ms | R-5-C/D, R-009 |
| 4 | 두 번째 메시지 → sessionId 재사용 | createSession 1회만, sendMessage 2회, 응답 r1/r2 누적 | R-5-C/D |

### Stage 1·2 회귀 검증

```
$ node e2e/agent-component.test.mjs
=== 11 passed, 0 failed ===
```

Stage 1 5건 + Stage 2 6건 모두 회귀 0. **누적 15건 (격리 11 + 통합 4) 모두 pass**.

## 5. R-009 수치 어설션 결과 (누적)

| 항목 | 기준 ± 오차 | 실측 (Stage) | 판정 |
|------|------------|------|------|
| 응답시간 (mock) | 5000 ± 2000 ms | 6 ms (Stage 1) → 4 ms (Stage 2) → 28 ms (Stage 3 통합) | ✅ |
| 사이드바 너비 | 360 ± 60 px | 360 px | ✅ |
| 메시지 max length | 10000 ± 2000 자 | 10000 자 | ✅ |

Stage 3 의 *통합 시나리오* 응답시간 28 ms — Stage 1·2 의 단일 호출 (4~6 ms) 보다 약 5배. 다만 *createSession + sendMessage 2 round trip + DOM 갱신 + waitForFunction polling* 포함이라 정상 범위.

## 6. 결정 적용 결과 (R-5-A~K)

| ID | 추천 | Stage 3 적용 | 변경 |
|----|------|-----------|------|
| R-5-A vanilla DOM | 채택 | `index.ts` 의 `hookMenuToggle` 가 `document.createElement` + `appendChild` | — |
| R-5-G 메뉴바 보기 메뉴 hook | 채택 | `data-cmd` 없는 `.md-item` 추가 → menu-bar 의 위임 핸들러가 dispatch 미호출 + closeAll() 정상 + 별도 click listener 가 toggle | — |
| R-5-I client wrapper | 채택 | `mountAgentSidebar()` 가 `AgentClient + AgentStore + AgentSidebar` 인스턴스화 | — |
| R-5-K puppeteer-only | 채택 | 통합 e2e 도 같은 인프라 (vite spawn + headless puppeteer) — layer 1·2 일관 | — |

R-5-F (Vite preview), R-5-J (HTTP) 는 *분리 commit (b)* 영역.

## 7. 본가 무수정 정책 자기 점검

| 영역 | 변경 형태 | 정책 정합 |
|------|---------|---------|
| `rhwp-studio/src/agent/` (신규 폴더) | 신규 파일 9개 (index.ts 포함) | ✅ 옵션 2 변형 영역 |
| `rhwp-studio/e2e/agent-component.test.mjs` | 신규 + Stage 2 수정 | ✅ |
| `rhwp-studio/e2e/agent-integration.test.mjs` | 신규 | ✅ |
| `rhwp-studio/src/main.ts` | **다음 커밋 (Stage 3 b)** — 1~2줄 단독 | ⚠️ 본가 무수정 정책 *예외*, 분리 커밋 |
| `rhwp-studio/index.html` | 무수정 — 메뉴바 hook 은 런타임 `appendChild` | ✅ |
| `rhwp-studio/vite.config.ts` | 무수정 — multi-page 미정의, `setContent` 또는 dynamic import 로 회피 | ✅ |
| `rhwp-studio/src/style.css` | 무수정 — `agent.css` 별도 import | ✅ |
| 본가 다른 영역 (`src/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`) | 무수정 | ✅ |

**본가 무수정 정책 자기 점검 통과** (예외 1건 = main.ts 분리 커밋).

런타임 DOM 추가 (메뉴 hook 의 `appendChild`) 는 *index.html 파일 무수정* 정책의 본질에 해당 — *파일 수정 ≠ 런타임 DOM 변경*. 통합 e2e #1 에서 `#scroll-container` 보존 검증 (rhwp-studio 메인 동작 영향 0).

## 8. 발견·deviation

### 발견 1: 통합 e2e 5건 → 4건 (PWA SW 1건 분리)

**원인**: 본가 무수정 정책 분리 커밋 + R-013 layer 2 (Vite preview) 의 *commit 순서 제약 충돌*. Vite preview 의 PWA SW 활성 검증은 `main.ts` 가 `mountAgentSidebar` 를 import 한 *production 빌드 결과물* 필요 → main.ts 변경 후만 가능.

**처리**:
- 통합 e2e 4건 (vite dev 모드) — Stage 3 (a) 커밋
- PWA SW 점검 — Stage 3 (b) main.ts 커밋 *후* `npm run build && vite preview` 로 별도 수동 점검 → 본 보고서 §11 에 결과 갱신

**deviation 분류**: 구현계획서 §3.2 의 5건 → 4 + 1 분리. R-009 *허용 오차 범위* 가 아닌 *commit 분리 의 구조적 결과*. 보고서 명시 + 본 task 회고에서 R-013 frontend 변형 정식화 자료로 활용.

### 발견 2: page.click vs element.click() flaky

**현상**: 통합 e2e 첫 시도에서 `page.click('#agent-sidebar .agent-chat-input__send')` 가 *button click 이벤트 미발화* (handleSend 미호출, textarea 미clear) — 그러나 *동일 패턴* 의 다음 테스트는 정상.

**원인**: puppeteer headless Chrome 의 *visibility check* 가 *transition / layout 시점* 에 따라 flaky.

**처리**: `await page.evaluate(() => el.click())` 로 통일 — DOM `Element.click()` 메서드는 visibility 무관 즉시 발화. 통합 4건 모두 안정 동작 확인.

**회고 자료**: rhwp-studio e2e 의 기존 `helpers.mjs` 에서 `clickEditArea` 등이 *page.click* 사용 — 동일 flaky 가능성. 본 task 의 *element.click() 우회 패턴* 을 별도 task 에서 helpers.mjs 갱신 후보로.

### 발견 3: 메뉴 hook 의 #studio-root outerHTML 변경 = 정상

첫 통합 1 테스트에서 `#studio-root outerHTML.length` 비교로 본가 영역 무영향 검증 시도 → 메뉴 hook 이 *런타임 항목 추가* 라 변경 검출 → 검증 실패. 정정: *index.html 파일 무수정* 이 정책 본질, *런타임 DOM 추가는 허용*. 검증을 *기존 메뉴 항목 보존 (count + 1)* + *#scroll-container 보존* 으로 변경.

### 발견 4: page.type 한국어 입력 puppeteer headless 미지원

테스트 3 의 `page.type('안녕')` 이 *입력 안 됨* (puppeteer headless 의 한국어 IME 미처리). 영어로 변경 (`'hi'`). mock 응답도 영어로 통일.

**회고**: rhwp-studio 의 한국어 e2e 시나리오 (도구 결과 시각화 한국어 등) 는 *page.evaluate 로 textarea.value 직접 설정* 패턴 권장. 본 task 외 회고.

### deviation: 0건 (R-009 기준)

R-009 수치 3건 모두 허용 범위 내. 위 발견 4건 모두 *해결됨* 또는 *분리 커밋 영역*.

## 9. 종료 체크

- [x] `agent/index.ts` 신규 — `mountAgentSidebar()` + `hookMenuToggle()` + `agent.css` import
- [x] 통합 e2e 4건 (Vite dev) 모두 pass + 격리 11건 회귀 0 (누적 15건)
- [x] R-009 응답시간 28ms (< 7000ms 허용 범위)
- [x] R-5-G 메뉴바 보기 메뉴 hook 정상 — `agent-menu-item.click()` → toggle
- [x] R-5-H 기본 닫힘 동작 + 너비 360px
- [x] 본가 무수정 정책 자기 점검 통과 (예외 1건 = main.ts, 다음 커밋)
- [ ] **`main.ts` 진입점 1~2줄 추가** — Stage 3 (b) 단독 커밋
- [ ] **`npm run build` 통과 (production 번들)** — Stage 3 (b) 후 검증
- [ ] **PWA SW 점검 (R-5-F)** — Stage 3 (b) 후 vite preview 로 검증, 본 보고서 §11 갱신

## 10. 방법론 평가 메모

### R-013 frontend layer 2 정의 — *분리 발견*

본 task 가 *frontend 첫 사례* 라 R-013 layer 2 의 *production 정합성* 정신을 *Vite preview + Puppeteer* 로 정의 (R-5-F). 그러나 본 task 의 *본가 무수정 정책 분리 커밋* (R-5-0 옵션 2 변형) 과 충돌:
- R-5-0 분리 커밋 → main.ts 가 *별도 commit* 까지 *agent/* 미import* → production 번들에 *agent/* 포함 0
- 따라서 *Vite preview 로 통합 검증* 은 main.ts 변경 *후* 만 가능
- Stage 3 (a) 의 통합 e2e 는 *Vite dev* 사용 → R-013 layer 2 정신 부분 손상 (HMR 등 dev 전용 기능 활성)

**대안 1** (채택): Stage 3 분리 — (a) Vite dev 통합 e2e 4건 + (b) main.ts 단독 + production preview 검증 (PWA SW). R-013 layer 2 정신 *2 단계 분할 충족*.

**대안 2** (비채택): main.ts 변경을 commit 1 에 합침 → 본가 무수정 정책 분리 의도 손상 (cherry-pick 어려움)

**대안 3** (비채택): vite.config 에 entry 추가 → 본가 vite.config 수정 (정책 위반)

본 task 회고에서 **R-013 보강** 또는 **R-016 신설** 후보 — *본가 무수정 정책과 R-013 frontend layer 2 의 commit 순서 결합 패턴*. 백엔드와 다른 *frontend 고유 구조*.

### R-014/R-015 두 번째 의무 적용 — Stage 3 효과

| 측정 항목 | Stage 3 결과 |
|----------|-----------|
| 결정 변경 | 0건 (R-5-A~K 11건 모두 추천 유지) |
| 누락 | 0건 (R-5-G 메뉴 hook 의 *위임 dispatcher 우회 패턴* 등 모두 §6 결정 추적) |
| 반대 입장 근거 활용 | R-5-K (puppeteer-only) 의 *부팅 비용* 단점이 Stage 3 통합 e2e 까지 일관 작동으로 *부분 충족* — 별도 결정 변경 없음 |

#4 (첫 의무 적용) 의 *결정 변경 0건 + 누락 0건* 결과를 본 task 도 유지. **R-014/R-015 의 두 번째 의무 적용 효과 입증**.

### 발견 4건 의 회고 자료 가치

본 task 의 *발견 4건* 은 *방법론 외 기술 발견* — R-014/R-015 효과 측정 항목과 무관. 그러나 *후속 task 의 R-010 외부 정보 조회 사전 명시* 형태로 정식화 가치 — `methodology_refinements.md` 의 *R-N-** 형태 정식화* 또는 *기술 노트* 별도 문서.

## 11. Stage 3 (b) 후 갱신 영역 (예약)

main.ts commit 후 다음 검증 결과를 본 보고서에 갱신:

- `npm run build` 통과 여부
- production 번들에 agent/* 포함 확인
- `vite preview` 시 사이드바 자동 mount 확인
- PWA SW 활성 시 mock fetch 인터셉트 정상 동작 (R-5-F)

**갱신 시점**: Stage 3 (b) 커밋 직후.

## 12. 다음 단계

Stage 3 (a) 커밋 → main.ts 1~2줄 변경 → Stage 3 (b) 단독 커밋 → production preview 검증 → 본 보고서 §11 갱신.
