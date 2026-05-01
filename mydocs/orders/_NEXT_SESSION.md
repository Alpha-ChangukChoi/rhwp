# 다음 세션 진입 안내

> 본 fork 작업을 *다음 세션* (또는 *다른 collaborator*) 이 이어갈 때 **여기서 시작**하면 됩니다. 메모리 시스템 의존도를 줄이기 위한 fork 내부 진입점.

## 현재 상태 (2026-05-01 기준)

- **현재 브랜치**: `local/devel` (#5 merge 완료 상태)
- **마일스톤 agent-v0.1 진행률**: **5/6 closed (83%)** — #1~#5 완료, #6 미등록
- **누적 방법론 다듬기**: R-001~R-015 (15건 정식화) + R-5-K (#5 진행 중 신설) — 본 fork 전용
- **본가 무수정 정책 첫 변형 안정 운용**: 옵션 2 변형 (`rhwp-studio/src/agent/` + `main.ts` 1~2줄 분리 commit) — #5 입증

## 완료된 작업

| 이슈 | 제목 | 보고서 |
|------|------|--------|
| [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ | NestJS agent-server 스켈레톤 + docker-compose 통합 | [task_agent-v0.1_1_report.md](../report/task_agent-v0.1_1_report.md) |
| [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ | OpenAI Chat Completions 클라이언트 + 환경변수 검증 | [task_agent-v0.1_2_report.md](../report/task_agent-v0.1_2_report.md) |
| [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅ | hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프 | [task_agent-v0.1_3_report.md](../report/task_agent-v0.1_3_report.md) |
| [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4) ✅ | 멀티턴 세션 히스토리 관리 (in-memory) | [task_agent-v0.1_4_report.md](../report/task_agent-v0.1_4_report.md) |
| [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5) ✅ | rhwp-studio 우측 사이드바 채팅 UI | [task_agent-v0.1_5_report.md](../report/task_agent-v0.1_5_report.md) |

## 다음 작업

### #6 — agent-server HTTP endpoint + 인증/CORS (미등록)

#5 의 Stage 0 사전 점검 §2.1 발견으로 **#6 작업 범위 축소**:

> agent-server 가 *이미 HTTP 모드* 로 부팅 중 (`app.listen(port)`, port 3000). 단지 `ChatController` 가 부재. 즉 **#6 의 작업 범위가 좁아짐** — agent-v0.1 마일스톤 6개 중 마지막 task = ChatController 등록 + 인증/CORS + sessionId 발급 endpoint 만.

#5 의 mock 가정 인터페이스 (#6 의 라우트 정의 가이드):

| 가정 endpoint | 응답 | #6 가 구현할 ChatController 메서드 |
|--------------|------|--------------------------------|
| `POST /chat/session` | `{ sessionId: string }` | `SessionService.create()` wrapper |
| `POST /chat/session/:id/messages` body `{ content: string }` | `{ reply: ChatMessage }` | `ChatService.completeInSession()` wrapper |

**진입 절차** (R-001 미니사이클):
1. R-011 환경 점검 — 본 문서 *fork 작업 환경 점검* 절 명령
2. **추가 — `pkg/` WASM 빌드 보강 검토** (D-5-6 환경 정비) — #6 진행 전에 환경 정비 task 분리 또는 #6 내 포함 결정
3. R-001 (a)→(b)→(c) 로 #6 이슈 등록 (R-014 점검표 본문 포함, R-5-* 검증된 항목 인용)
4. `local/task6` 브랜치 분기
5. 수행계획서 (R-015 — §6 에 *#5 mock 가정 인터페이스 vs. #6 실 구현* 옵션 결정)
6. 구현계획서 (3~6 stage)
7. Stage 진행
8. 최종 보고서 + 커밋 분할 + 이슈 #6 클로즈 + local/devel merge → **agent-v0.1 마일스톤 100% 완성**

### 또는: 환경 정비 task (#5 의 D-5-6 후속)

| 항목 | 작업 | 영향 |
|------|------|------|
| `pkg/` WASM 빌드 | `cargo build --target wasm32-unknown-unknown` 또는 `docker compose --env-file .env.docker run --rm wasm` | rhwp-studio production 빌드 활성화 + #5 의 5번째 통합 e2e (main.ts 자동 mount) skip 해제 + PWA SW 점검 (R-5-F) 활성화 |

이는 *방법론 외 환경 정비 작업* — 별도 GitHub issue 없이 작업지시자가 *직접 빌드* 또는 *별도 task 등록* 결정.

### 또는: 방법론 정식화 task

| 항목 | 작업 |
|------|------|
| **R-016 또는 R-013 보강** | frontend 검증 사다리 정식화 — backend (jest+compose) / frontend (puppeteer 단일 + mount 범위) 분기. #5 보고서 §7.6 자료 활용 |
| e2e helpers.mjs 갱신 | #5 deviation D-5-1/2/3 우회 패턴 통합 (CORS preflight 헬퍼 + element.click() + page.evaluate value 설정) |

## fork 작업 환경 점검 (R-011)

매 세션 시작 시 다음 명령으로 환경 점검:

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# 1. git
git branch --show-current
git status --short

# 2. 의존성·빌드 캐시 (백엔드)
ls rhwp-agent-server/node_modules >/dev/null 2>&1 && echo "agent node_modules ok" || echo "MISSING"
ls rhwp-agent-server/dist >/dev/null 2>&1 && echo "agent dist ok" || echo "MISSING"

# 3. 환경변수
grep -E "^OPENAI|^SESSION" rhwp-agent-server/.env

# 4. docker image 캐시
docker images rhwp-fork-agent-server --format '{{.Repository}}:{{.Tag}} {{.Size}}'

# 5. rhwp-studio 빌드 캐시 (frontend)
ls rhwp-studio/node_modules >/dev/null 2>&1 && echo "studio node_modules ok" || echo "MISSING"
ls rhwp-studio/dist >/dev/null 2>&1 && echo "studio dist ok" || echo "MISSING"

# 6. pkg/ WASM (D-5-6 — #5 발견 환경 사전 상태)
ls pkg/rhwp.js >/dev/null 2>&1 && echo "pkg/ WASM ok" || echo "MISSING (D-5-6)"

# 7. 자동 회귀 (선택, ~1분)
cd rhwp-agent-server && npm test && npm run test:e2e && cd ..
cd rhwp-studio && node e2e/agent-component.test.mjs && node e2e/agent-integration.test.mjs && cd ..
```

## 본가 코드 무수정 정책 (옵션 2 변형 적용)

5 task 누적으로 유지 + #5 의 *옵션 2 변형* 첫 적용. 다음을 **수정 금지**:

- `src/` (Rust 핵심)
- `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`
- 본가의 다른 npm/, web/, examples/, tests/, mydocs/ (단 `mydocs/manual/methodology_refinements.md` 는 fork 전용 추가 문서)
- `rhwp-studio/index.html`, `rhwp-studio/vite.config.ts`, `rhwp-studio/style.css`, `rhwp-studio/package.json` 등 **rhwp-studio 의 본가 영역**

**예외 (옵션 2 변형, #5 적용)**:
- `rhwp-studio/src/agent/` 폴더 — 신규 (옵션 2 변형 영역)
- `rhwp-studio/e2e/agent-*.test.mjs` — 신규 (옵션 2 변형 영역)
- `rhwp-studio/src/main.ts` — **3줄 추가** (`import { mountAgentSidebar } from '@/agent';` + `mountAgentSidebar();`) — *분리 commit* 으로 본가 동기화 충돌 surface 최소화

본가 동기화 시 main.ts 의 변경 충돌만 해결하면 됨. agent/* 는 본가에 없으므로 무영향.

## 활성 다듬기 (R-007~R-015 + R-5-K) 사전 적용 의무

#4·#5 에서 **R-014/R-015 두 번째 의무 적용 — 결정 변경 0건 + 누락 0건 유지**. 후속 task 도 동일 의무.

본 fork 의 활성 R-* 다듬기:

- R-001 이슈 등록 미니 사이클 — 두 task 연속 효과 입증 (#5 의 R-5-K 신설이 (a) self-check 가치 입증)
- R-007 도구 버전 *제약*으로
- R-008 자동 검증 우선
- R-009 수치형 + 허용 오차
- R-010 외부 정보 조회 + fallback
- R-011 누적 환경 정합성 점검 — D-5-6 (#5) 후속 보강 사항 (pkg/ WASM)
- R-013 2단계 검증 사다리 — **frontend 변형 첫 사례 #5** (puppeteer 단일 + mount 범위), R-016 정식화 후보
- R-014 이슈 등록 시 다듬기 점검표 (의무, #4부터)
- R-015 수행계획서 §6 결정사항에 반대 입장 근거 명시 (의무, #4부터)
- R-5-K (#5 신설) — frontend 단위 테스트 puppeteer-only

R-002 (Fork 셋업), R-012 (mock dup) 는 placeholder/별도 task 후보.

## 본가 동기화

본가 (edwardkim/rhwp) 업데이트를 가져오려면:

```bash
git fetch upstream
git checkout local/devel
git merge upstream/devel  # 또는 git rebase
```

**주의**: `rhwp-studio/src/main.ts` 의 fork 추가 3줄 (`import { mountAgentSidebar } from '@/agent';` + `mountAgentSidebar();`) 가 *충돌 surface*. 본가에서 main.ts 의 import 영역 또는 마지막에 변경이 있으면 충돌 가능 → 수동 merge 후 commit `edf00ce` (Stage 3 b) 의 의도를 보존.

## 참고 자료

- 본가 절차: [CLAUDE.md](../../CLAUDE.md)
- 다듬기 누적: [methodology_refinements.md](../manual/methodology_refinements.md)
- 오늘 할일 누적: [orders/20260501.md](20260501.md)
- agent-server: [rhwp-agent-server/README.md](../../rhwp-agent-server/README.md) (NestJS HTTP 모드, port 3000, /health 만)
- agent UI: `rhwp-studio/src/agent/` (옵션 2 변형 영역)
