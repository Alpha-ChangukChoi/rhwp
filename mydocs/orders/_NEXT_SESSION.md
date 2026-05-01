# 다음 세션 진입 안내

> 본 fork 작업을 *다음 세션* (또는 *다른 collaborator*) 이 이어갈 때 **여기서 시작**하면 됩니다. 메모리 시스템 의존도를 줄이기 위한 fork 내부 진입점.

## 현재 상태 (2026-05-01 기준)

- **현재 브랜치**: `local/task6` (#6 종결 — 최종 보고서 작성 완료, merge 승인 대기)
- **마일스톤 agent-v0.1 진행률**: **6/6 closed 후보 (100%)** — #1~#6 모두 완료
- **누적 방법론 다듬기**: R-001~R-015 (15건 정식화) + R-5-K (#5 신설) + **R-018·R-019 가설 후보** (#6 신설)
- **본가 무수정 정책**: #5 옵션 2 변형 (#6 동일 적용) — 본가 코드 수정 0 유지

## 완료된 작업 (agent-v0.1 마일스톤 100%)

| 이슈 | 제목 | 보고서 |
|------|------|--------|
| [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ | NestJS agent-server 스켈레톤 + docker-compose 통합 | [task_agent-v0.1_1_report.md](../report/task_agent-v0.1_1_report.md) |
| [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ | OpenAI Chat Completions 클라이언트 + 환경변수 검증 | [task_agent-v0.1_2_report.md](../report/task_agent-v0.1_2_report.md) |
| [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅ | hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프 | [task_agent-v0.1_3_report.md](../report/task_agent-v0.1_3_report.md) |
| [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4) ✅ | 멀티턴 세션 히스토리 관리 (in-memory) | [task_agent-v0.1_4_report.md](../report/task_agent-v0.1_4_report.md) |
| [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5) ✅ | rhwp-studio 우측 사이드바 채팅 UI | [task_agent-v0.1_5_report.md](../report/task_agent-v0.1_5_report.md) |
| [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6) ✅ | agent-server HTTP endpoint (ChatController) + CORS | [task_agent-v0.1_6_report.md](../report/task_agent-v0.1_6_report.md) |

### 사용자 직접 사용 가능 도달

agent-v0.1 종결로 사용자가 *브라우저 직접* 으로 다음을 수행 가능:

1. `docker compose up agent-server` (port 3000)
2. `cd rhwp-studio && npx vite --port 7711` (호스트 옵션 미지정 — D-6-5)
3. 브라우저: `http://localhost:7711/`
4. 메뉴바 "보기" → "AI 채팅" → 사이드바 열림
5. 메시지 입력 → 실 OpenAI (gpt-5.4) 응답 + 멀티턴 컨텍스트 인지

## 다음 작업 — agent-v0.1 마일스톤 종결 처리

### 즉시

1. **`local/task6` → `local/devel` merge** (작업지시자 승인 후)
2. **`local/devel` → `devel` push** (메인테이너)
3. **GitHub Issue #6 close** (`closes #6` 본 PR commit 또는 명시 close)

## agent-v0.2 마일스톤 입구

### 최종 목표

> **현재 브라우저에 열린 hwp/hwpx 파일을 에이전트가 *구조 인지* (표·차트·이미지·수식·머리말·각주 등) 로 분석하고 사용자와 상호작용하면서 문서를 수정한다.**

### 작업지시자 확정 핵심 디자인 결정 4건

(메모리 등록: [`agent_v02_design_decisions.md`](../../.claude/projects/-Users-a111-04-2402-01-Desktop-side-projects-rhwp-fork/memory/agent_v02_design_decisions.md))

1. **LLM 표현 = 혼합** (Markdown 본문 + JSON 노드 ID 매개)
   - Markdown 본문 (LLM 가독성 + 토큰 효율)
   - 노드 ID `[#p15]` `[#t1]` `[#c1]` 등 inline marker 로 매개
   - 순수 JSON 트리 폐기 — LLM 가독성·토큰 비효율
2. **Vision API 사용** (auto 모드 + raw_data 동봉)
   - 차트 = vision PNG + raw chart_data 동시 (수치 정확도)
   - LLM 능동 호출 (필요 시 vision tool)
3. **노드 ID = 유지·fork 매핑·rhwp-studio 발급**
   - stable ID (추가/삭제 시 기존 유지, 새 노드만 new ID)
   - 본가 IR 무수정 → fork 영역 매핑 테이블
   - rhwp-studio (frontend) 발급 + tool 호출 시 동봉
4. **컨텍스트 = outline + on-demand 청크**
   - 첫 turn 시스템 prompt 에 outline 자동 주입 (짧게)
   - LLM 능동: `get_text(node_id)` / `get_table(node_id)` / `get_chart(node_id)` 등 tool 호출로 세부 회수
   - embedding 검색·전 문서 매번 전달 폐기

### v0.2 task 후보 분해 (5 Tier, 16 task)

#### Tier 1 — 인프라 (필수, 순차)

| # | 제목 |
|---|------|
| **B1** | 양방향 채널 (SSE 우선 검토 + WebSocket 비교) — agent-server tool 호출 → 클라 push → 결과 회신 |
| **B2** | IR → LLM 표현 변환기 (sketch + text 혼합) |
| **B3** | IR 노드 ID 부여 + outline tool — *기술 조사 task 선행 권장* |
| **B4** | 객체별 tool 매핑 (`get_text`, `get_table`, `get_chart`, `get_image`, `get_equation`) |
| **B5** | 사용자 승인 UI + 노드 단위 편집 명령 매핑 (`insert_paragraph_after`, `edit_table_cell`, `replace_text_in_node`) |

#### Tier 2 — 분석 능력
- B6: 컨텍스트 청킹 전략 (결정 4 정착)
- B7: 시스템 프롬프트 — 현재 문서 outline 자동 주입
- B8: 표 분석 도구
- B9: 차트 데이터 해석 (vision + raw_data)

#### Tier 3 — 풍부한 편집 + 미디어
- B10: 서식 도구 (글꼴/정렬/색)
- B11: 표 편집 도구 (행/열, 셀 병합)
- B12: Vision API 정착 (이미지/차트 썸네일)
- B13: 수식 도구 (라텍스 ↔ Equation)

#### Tier 4 — 일괄 작업
- B14: 멀티스텝 planning ("이 보고서 정리해줘")
- B15: 일괄 편집 미리보기 (전체 diff)
- B16: undo / 변경 history

### 권장 진입 순서

1. **agent-v0.1 종결 처리** (`local/devel` merge + #6 close)
2. **방법론 정식화 task** (선택, 또는 v0.2 첫 task 와 병행) — R-016/R-017/R-018/R-019 후보
3. **기술 조사 task** (필수 선행) — `rhwp IR 의 노드 ID 정책 + LLM 친화 표현 변환기 prototype` — 결정 3 의 *사전 점검* 영역
4. **B1 (양방향 채널)** — SSE vs WebSocket 결정 R-014/R-015 적용
5. **B2 (변환기)** → **B3 (노드 ID 매핑)** → **B4 (객체 tool)** → **B5 (편집 UI)** 순서

### 방법론 정식화 후보 (agent-v0.1 종결 회고)

| 후보 | 출처 | 내용 |
|------|------|------|
| **R-016** | #5 + #6 | frontend 검증 사다리 정식화 (puppeteer 단일 + mount 범위) |
| **R-017** | #5 + #6 | 본가 무수정 정책 *옵션 2 변형* 정식화 |
| **R-018** | #6 D-6-3 | **결정 누적 일관성 점검** — 과거 task 같은 레이어 일관성 (예: ChatService 의 `complete()` wrap 했지만 `completeWithTools()` 누락) |
| **R-019** | #6 D-6-4/5 | **fork dev 환경 origin 일관성 정책** — manual 작성 (CORS_ALLOWED_ORIGINS default 4 port 안 분배 + `--host` 옵션 미사용 + 브라우저 `localhost` 접속) |

## fork 작업 환경 점검 (R-011)

매 세션 시작 시 다음 명령으로 환경 점검:

```bash
cd /Users/a111-04-2402-01/Desktop/side-projects/rhwp-fork

# 1. git
git branch --show-current
git status --short

# 2. 의존성·빌드 캐시 (백엔드)
ls rhwp-agent-server/node_modules >/dev/null 2>&1 && echo "agent node_modules ok" || echo "MISSING"
ls rhwp-agent-server/dist >/dev/null 2>&1 && echo "agent dist ok" || echo "MISSING"

# 3. 환경변수
grep -E "^OPENAI|^SESSION|^CORS" rhwp-agent-server/.env

# 4. docker image 캐시
docker images rhwp-fork-agent-server --format '{{.Repository}}:{{.Tag}} {{.Size}}'

# 5. rhwp-studio 빌드 캐시 (frontend)
ls rhwp-studio/node_modules >/dev/null 2>&1 && echo "studio node_modules ok" || echo "MISSING"
ls rhwp-studio/dist >/dev/null 2>&1 && echo "studio dist ok" || echo "MISSING"

# 6. pkg/ WASM
ls pkg/rhwp.js >/dev/null 2>&1 && echo "pkg/ WASM ok" || echo "MISSING — docker compose --env-file .env.docker run --rm wasm"

# 7. 자동 회귀 (선택, ~3분 — 실 OpenAI 호출 포함하면 비용 발생)
cd rhwp-agent-server && npm test && npm run test:e2e && cd ..
cd rhwp-studio && node e2e/agent-component.test.mjs && node e2e/agent-integration.test.mjs && cd ..
# (옵션) 실 OpenAI 통합 — 비용 발생
# cd rhwp-studio && node e2e/agent-real-integration.test.mjs && cd ..
```

## 본가 코드 무수정 정책 (옵션 2 변형 적용)

6 task 누적으로 유지 + #5·#6 의 *옵션 2 변형* 정착. 다음을 **수정 금지**:

- `src/` (Rust 핵심)
- `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`
- 본가의 다른 npm/, web/, examples/, tests/, mydocs/ (단 `mydocs/manual/methodology_refinements.md` 는 fork 전용 추가 문서)
- `rhwp-studio/index.html`, `rhwp-studio/vite.config.ts`, `rhwp-studio/style.css`, `rhwp-studio/package.json` 등 **rhwp-studio 의 본가 영역**

**예외 (옵션 2 변형, #5·#6 적용)**:
- `rhwp-studio/src/agent/` 폴더 — 신규 (#5)
- `rhwp-studio/e2e/agent-*.test.mjs` — 신규 (#5·#6)
- `rhwp-studio/src/main.ts` — **3줄 추가** (`import { mountAgentSidebar } from '@/agent';` + `mountAgentSidebar();`) — *분리 commit* (#5)
- `rhwp-agent-server/` 전체 — fork 영역 (본가에 없음)

본가 동기화 시 main.ts 의 변경 충돌만 해결하면 됨.

## 활성 다듬기 (R-007~R-015 + R-5-K) 사전 적용 의무

#4·#5·#6 에서 **R-014/R-015 의무 적용 — 결정 변경 0건 + 누락 0건 유지** (3 task 연속). 후속 task 도 동일 의무.

본 fork 의 활성 R-* 다듬기:

- R-001 이슈 등록 미니 사이클 — 두 task 연속 효과 입증
- R-007 도구 버전 *제약*으로
- R-008 자동 검증 우선
- R-009 수치형 + 허용 오차
- R-010 외부 정보 조회 + fallback
- R-011 누적 환경 정합성 점검
- R-013 2단계 검증 사다리 — backend (#2~#4 + #6) + frontend 변형 (#5) + 통합 (#6 Stage 4)
- R-014 이슈 등록 시 다듬기 점검표 (의무, #4부터)
- R-015 수행계획서 §6 결정사항에 반대 입장 근거 명시 (의무, #4부터)
- R-5-K (#5 신설) — frontend 단위 테스트 puppeteer-only

R-002 (Fork 셋업), R-012 (mock dup) 는 placeholder/별도 task 후보.

**v0.2 진입 시 R-016/R-017/R-018/R-019 정식화 검토**.

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
- agent-server: [rhwp-agent-server/README.md](../../rhwp-agent-server/README.md) (NestJS HTTP 모드, port 3000, /health + ChatController)
- agent UI: `rhwp-studio/src/agent/` (옵션 2 변형 영역)
- v0.2 입력 자료: 메모리 [`agent_v02_design_decisions.md`](../../.claude/projects/-Users-a111-04-2402-01-Desktop-side-projects-rhwp-fork/memory/agent_v02_design_decisions.md)
