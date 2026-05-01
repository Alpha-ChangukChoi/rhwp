# [최종 보고서] task_agent-v0.1_6 — agent-server HTTP endpoint (ChatController) + CORS

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task6`
- **수행계획서**: [task_agent-v0.1_6.md](../plans/task_agent-v0.1_6.md)
- **구현계획서**: [task_agent-v0.1_6_impl.md](../plans/task_agent-v0.1_6_impl.md)
- **단계별 보고서**: [Stage 1](../working/task_agent-v0.1_6_stage1.md) / [Stage 2](../working/task_agent-v0.1_6_stage2.md) / [Stage 3](../working/task_agent-v0.1_6_stage3.md) / [Stage 4](../working/task_agent-v0.1_6_stage4.md)
- **작성일**: 2026-05-01

---

## 1. 요약

agent-v0.1 마일스톤의 **마지막 task** 이자 *6 task 통합 종결 검증* 단계. #1 (NestJS 스켈레톤) → #2 (OpenAI 클라이언트) → #3 (도구 호출 루프) → #4 (멀티턴 세션) → #5 (사이드바 UI) 의 모든 백엔드·프론트엔드 자산을 **HTTP endpoint (ChatController) + CORS + 사용자 승인 UI** 로 연결.

### 정량

| 항목 | 결과 |
|------|------|
| 단계 | 5 stage (Stage 0 사전 점검 + 1·2·3 본행 + 4 옵셔널) |
| 신규 파일 | 7개 (`rhwp-agent-server/src/chat/` 4 + `test/chat-http.e2e-spec.ts` + `rhwp-studio/e2e/agent-real-integration.test.mjs` + 보고서 5) |
| 수정 파일 | 5개 (`main.ts` + `chat.service.ts` + `chat.module.ts` + `chat.service.spec.ts` + `package.json`/`.env.example`/`env.schema.ts`) |
| 본가 코드 수정 | 0 (모두 fork 영역) |
| TypeScript strict | 0 에러 |
| **단위 테스트** | **38 pass** (Stage 1 +6 누적, 회귀 0) |
| **HTTP e2e** | **16 pass + 1 skipped** (Stage 2 신규 10 + 기존 6, real-api skip) |
| **compose 라이브 검증** | **모두 통과** (Stage 3) |
| **실 OpenAI 통합 e2e** | **1 pass** (Stage 4 옵셔널, 멀티턴 2 turn) |
| R-009 수치 | 응답시간 mock < 700ms / 실 < 30s / max length 12000 / port 3000 — 자동 expect |
| 결정 변경 (수행계획서 §6 R-6-A~I) | **0건** (R-014/R-015 *세 번째* 의무 적용 효과 유지) |
| 누락 (현재 task) | 0건 |
| 누락 (과거 task) | **1건 발견 — D-6-3 (Task #3 의 `completeWithTools` raw 에러 wrap 누락)** — 즉시 보강 |
| 재작업 | 0회 |
| 소요 (Stage 1·2·3·4) | 30 + 25 + 15 + 25 = **95분** (모두 R-009 허용 범위 내) |

### 정성

- **agent-v0.1 마일스톤 100% 완성** (#1~#6 6 task 모두 closed 후보 상태). 사용자 *직접 사용 가능* 영역 도달.
- **3 task 연속 결정 변경 0 + 현재 task 결정 누락 0** (R-014/R-015 누적 안정).
- **D-6-3 의 의미**: *과거 task 결정 일관성* 영역 발견 — R-014/R-015 의무 점검표가 다루지 않는 새 영역. R-018 (가설) *결정 누적 일관성 점검* 후보.
- **D-6-4/D-6-5 의 의미**: CORS *origin 정확 매칭* (port 7713 vs 7711, 호스트명 `127.0.0.1` vs `localhost`) — *fork dev 환경의 origin 일관성 정책* 정식화 자료. R-019 (가설) 후보.
- **사용자 직접 테스트 정상 동작** (옵션 A 브라우저 직접 사용) — Stage 4 옵셔널의 *시각적 종결*.

## 2. 변경 파일 목록

### 신규 (7개)

| 경로 | 라인 | 역할 | Stage |
|------|------|------|------|
| `rhwp-agent-server/src/chat/chat.dto.ts` | 11 | `SendMessageDto` (R-009 max 12000) | 1 |
| `rhwp-agent-server/src/chat/chat.controller.ts` | 33 | `@Controller('chat')` + 2 endpoint (R-6-A/E/F/G) | 1 |
| `rhwp-agent-server/src/chat/chat.controller.spec.ts` | 38 | ChatController 단위 (mock ChatService, 2건) | 1 |
| `rhwp-agent-server/src/chat/chat.exception-filter.ts` | 47 | Session*Error → 404/410, OpenAiError → 502 (R-6-D) | 1 |
| `rhwp-agent-server/src/chat/chat.exception-filter.spec.ts` | 53 | Filter 단위 (3건) | 1 |
| `rhwp-agent-server/test/chat-http.e2e-spec.ts` | 188 | HTTP e2e 10건 (정상 2 + 에러 2 + DTO 검증 3 + CORS 2 + 멀티턴 1) | 2 |
| `rhwp-studio/e2e/agent-real-integration.test.mjs` | 230 | 실 agent-server (compose) + 실 OpenAI 통합 e2e (1 testcase, 멀티턴 2 turn) | 4 |

### 수정 (5개, 모두 fork 영역)

| 경로 | 변경 | Stage |
|------|------|------|
| `rhwp-agent-server/src/main.ts` | `app.enableCors({...})` (R-6-C) + `useGlobalPipes(ValidationPipe)` (R-6-B) | 2 |
| `rhwp-agent-server/src/chat/chat.service.ts` | `createSession()` 추가 (R-6-G) + `completeWithTools` 의 raw 에러 wrap (D-6-3) | 1·2 |
| `rhwp-agent-server/src/chat/chat.module.ts` | `controllers: [ChatController]` + `APP_FILTER` 글로벌 등록 | 1 |
| `rhwp-agent-server/src/chat/chat.service.spec.ts` | createSession 1건 추가 | 1 |
| `rhwp-agent-server/package.json` + `.env.example` + `src/config/env.schema.ts` | `class-validator`/`class-transformer` 의존성 + `CORS_ALLOWED_ORIGINS` 환경변수 | 1 |

### 보고서 (5개)

| 경로 | 단계 |
|------|------|
| `mydocs/plans/task_agent-v0.1_6.md` | Stage 0 — 수행계획서 |
| `mydocs/plans/task_agent-v0.1_6_impl.md` | Stage 0 — 구현계획서 |
| `mydocs/working/task_agent-v0.1_6_stage1.md` | Stage 1 |
| `mydocs/working/task_agent-v0.1_6_stage2.md` | Stage 2 |
| `mydocs/working/task_agent-v0.1_6_stage3.md` | Stage 3 |
| `mydocs/working/task_agent-v0.1_6_stage4.md` | Stage 4 |
| `mydocs/report/task_agent-v0.1_6_report.md` | 본 문서 |

## 3. 통합 검증 결과 (Stage 1·2·3·4)

### 3.1 R-013 검증 사다리

| Layer | 도구 | Stage | 결과 |
|------|------|-------|------|
| Layer 1 단위 | jest | 1 | 38 pass (회귀 0) |
| Layer 1 HTTP e2e | jest + supertest (mocked openai) | 2 | 16 pass + 1 skipped |
| Layer 2 compose 실측 | docker compose + curl | 3 | 모두 통과 |
| Layer 2 통합 e2e (옵셔널) | puppeteer + compose + 실 OpenAI | 4 | 1 pass |

R-013 의 *2 단계 검증 사다리* 가 backend (4 task 누적) + frontend 변형 (#5) + **본 task 의 통합** 까지 일관 적용 종결.

### 3.2 핵심 검증 항목

#### Stage 1 단위 +6건
1. ChatController POST /chat/session — createSession 호출 + sessionId 반환
2. ChatController POST /chat/session/:id/messages — completeInSession 호출 + reply 반환
3. ChatExceptionFilter — SessionNotFoundError → 404
4. ChatExceptionFilter — SessionExpiredError → 410
5. ChatExceptionFilter — OpenAiError → 502
6. ChatService.createSession — SessionService.create() wrapper

#### Stage 2 HTTP e2e 10건
- 정상 2 + 에러 매핑 2 (404/502) + DTO 검증 3 (필수/max length/whitelist) + CORS 2 (preflight 정상/거부) + 멀티턴 1

#### Stage 3 compose 실측
- 부팅 로그 → `ChatController {/chat}` + 라우트 2건 매핑
- /health 200, POST /chat/session 201 + uuid
- OPTIONS preflight: localhost:7700 → 204+allow-origin / evil.example.com → 204+allow-origin **부재** (의도한 거부)
- bad session → 404, content 13000자 → 400

#### Stage 4 실 OpenAI 통합
- 1st "한국의 수도는?" → "서울" (3658ms, gpt-5.4)
- 2nd "방금 답한 단어를 영문 1단어로" → **"Seoul"** (1742ms) ← *멀티턴 컨텍스트 인지*
- sessionId 재사용 + DOM 어설션 통과

#### 사용자 직접 테스트 (옵션 A)
- 브라우저 직접 사용 (D-6-5 수정 후) — 정상 동작 확인 완료

## 4. 결정 추적 (R-6-A~I → 실제)

| ID | 추천 | 적용 (Stage) | 라이브 검증 (Stage 3·4) | 결과 |
|----|------|-----------|-------------------|------|
| R-6-A | REST POST endpoint | Stage 1 | curl + 실 fetch | ✅ 추천 그대로 |
| R-6-B | class-validator + ValidationPipe (whitelist+forbid+transform) | Stage 1·2 | curl 13000자 → 400 | ✅ 추천 그대로 |
| R-6-C | CORS 명시 list (4 dev port) | Stage 2 | preflight 허용/거부 라이브 + 직접 테스트 | ✅ + 트레이드오프 발견 (D-6-4/5) |
| R-6-D | Exception Filter (Session*→404/410, OpenAiError→502, APP_FILTER 글로벌) | Stage 1 | curl + Stage 2 e2e | ✅ + 과거 task 누락 발견 (D-6-3) |
| R-6-E | #5 mock 형식 정확 일치 (`{sessionId}`, `{reply}`) | Stage 1 | Stage 4 실 통합 | ✅ 추천 그대로 |
| R-6-F | ChatController 가 ChatService 만 의존 | Stage 1 | constructor 1 의존 | ✅ 추천 그대로 |
| R-6-G | createSession 노출 (SessionService.create() wrapper) | Stage 1 | Stage 4 sessionId 재사용 검증 | ✅ 추천 그대로 |
| R-6-H | 검증 방식 (Stage 4 통합) | Stage 4 | 실 OpenAI 통합 e2e | ✅ 옵셔널 수행 |
| R-6-I | 미인증 (credentials: false) | Stage 2 | CORS 헤더 정상 | ✅ 추천 그대로 |

**9건 결정 모두 추천 그대로 채택 + 변경 0건**.

## 5. Deviation 종합

| ID | Stage | 분류 | 처리 |
|----|------|------|------|
| **D-6-1** | 1 | TypeScript TS1272 — `isolatedModules + emitDecoratorMetadata` 조합에서 type-only import 강제 | `import type` 변경 → 즉시 통과 |
| **D-6-2** | 2 | supertest v7 default export — `import * as request` 시 TypeError | `import request from 'supertest'` 변경 → 즉시 통과 |
| **D-6-3** | 2 | **`completeWithTools`** 의 raw OpenAI 에러 미 wrap (Task #3 결정 누락) | try/catch 추가 → e2e #4 502 매핑 통과. 단위 38 회귀 0 |
| **D-6-4** | 4 | vite default port 7713 이 CORS 허용 list 부재 | port 7711 사용 (default 4 port 안) |
| **D-6-5** | 4 | 사용자 직접 테스트 안내 시 vite `--host 127.0.0.1` → CORS origin 정확 매칭 거부 | 안내 수정 (`--host` 제거 + `localhost:7711` 접속) → 정상 동작 |

**deviation 5건 모두 즉시 해결**. R-009 수치 영역의 deviation 0건.

### 의미 분류

| 영역 | 건수 | 본질 |
|------|------|------|
| 환경/도구 발견 (즉시 해결) | 2 (D-6-1, D-6-2) | 외부 도구 신버전 사양 |
| 과거 task 결정 일관성 | 1 (D-6-3) | *결정 누적 일관성 점검* 영역 — R-018 가설 후보 |
| CORS origin 정확 매칭 (포트·호스트명) | 2 (D-6-4, D-6-5) | *fork dev 환경 origin 일관성 정책* — R-019 가설 후보 |

## 6. 회고

### 6.1 예상 대비 실제

| 항목 | 예상 (구현계획서) | 실제 |
|------|-----------------|------|
| Stage 수 | 3 본행 + 1 옵셔널 | 3 + 1 동일 |
| Stage 1 시간 | 40 ± 15분 | 30분 (하한) |
| Stage 2 시간 | 35 ± 15분 | 25분 (하한) |
| Stage 3 시간 | 25 ± 10분 | 15분 (하한) |
| Stage 4 시간 | 30 ± 15분 | 25분 (하한) |
| HTTP e2e 건수 | 9건 (계획서 합산 오타) | 10건 (정상 합산) |
| 단위 +N건 | +6 | +6 동일 |
| deviation | 0~2 예상 | 5 (즉시 해결) |

**모든 Stage 가 *허용 범위 하한*** — R-014/R-015 의 *수행계획 단계 결정 정렬* 효과로 *구현 시간 단축* 가설 강화.

### 6.2 재작업

0회. 결정 변경 없이 모든 단계 1회 통과.

### 6.3 학습

1. **`completeWithTools` 누락 발견** (D-6-3) — *current task 의 결정 적용 시 같은 레이어 의 다른 메서드 일관성 점검* 의 가치. R-018 가설 후보.
2. **CORS 의 *origin 정확 매칭*** (D-6-4/5) — *fork dev 환경에서 e2e port·호스트명 정책의 통합 가이드* 가 부재함. *manual/* 정식화 후보.
3. **사용자 직접 테스트의 사각지대** — 자동 e2e 가 통과해도 *수동 안내* 가 결함을 가질 수 있음. 후속 task 에 *manual/agent_chat_user_guide.md* 작성 검토.
4. **시 계획서 합산 오타** (e2e 9 vs 10) — *항목 별 합산 자동 검증* 패턴 정식화 후보 (또는 점검표 자체 점검).

## 7. 방법론 평가 — 6 task 누적 + agent-v0.1 마일스톤 종결 회고

### 7.1 R-014/R-015 세 번째 의무 적용 효과 (#4·#5·#6 트렌드)

| 측정 항목 | #4 (첫 의무) | #5 (두 번째) | #6 (세 번째, 본 task) |
|----------|------------|------------|------|
| 결정 변경 | 0 / 9건 | 0 / 11건 | **0 / 9건** |
| 누락 (현재 task) | 0 | 0 | **0** |
| 누락 (과거 task 일관성) | 측정 안 함 | 측정 안 함 | **1 (D-6-3)** ← 새 영역 발견 |
| 추천 강화 효과 | — | R-5-B EventTarget | (없음) |
| 디자인 트레이드오프 발견 | — | — | **D-6-4/5** (R-6-C 의 origin 정확 매칭 영향) |
| Stage 시간 분포 | 허용 범위 내 | 허용 범위 내 | 허용 범위 *하한* |

**3 task 연속 결정 변경 0 + 현재 task 누락 0** — R-014/R-015 가설 *현재 task 결정 영역에서 안정적 효과* 강화.

### 7.2 R-013 backend / frontend 변형 통합 — R-016 정식화 자료

R-013 *2 단계 검증 사다리* 의 적용 패턴:

| task 영역 | Layer 1 | Layer 2 |
|---------|---------|---------|
| backend (#2~#4 + #6) | jest 단위 + jest e2e (supertest, mocked) | docker compose + curl 실측 |
| frontend (#5) | puppeteer 격리 mount | puppeteer 통합 mount (메인 dom + main.ts mount) |
| 통합 (#6 Stage 4) | — | puppeteer + compose + 실 OpenAI |

**R-016 정식화 후보**: *frontend 검증 사다리는 backend 의 jest+compose 와 동형, 다만 layer 의 도구가 puppeteer 단일 + mount 범위 차별*. agent-v0.1 종결 시점에 별도 *방법론 정식화 task* 로 분리 가능.

### 7.3 R-017 (가설) — 본가 무수정 정책 변형 패턴

#5 의 *옵션 2 변형* (`rhwp-studio/src/agent/` + `main.ts` 1~2줄 분리 commit) 가 본 task 에서도 *fork 영역 (rhwp-agent-server/, rhwp-studio/e2e/) 만 수정* 으로 일관 적용. **본가 코드 수정 0** 유지.

본 task 추가 자료: `rhwp-studio/e2e/agent-real-integration.test.mjs` (옵션 2 변형 영역 신규 파일) — 본가 동기화 시 충돌 surface 0.

### 7.4 R-018 (가설 후보) — 결정 누적 일관성 점검

D-6-3 발견 — *current task 의 R-* 결정이 *과거 task 의 같은 레이어 메서드* 의 일관성에 의존. 점검표가 *현재 task* 영역만 다루는 한계.

**가설**: "결정 사항 적용 시 *과거 task 의 같은 레이어 (e.g., ChatService) 의 다른 메서드* 도 일관성 점검 — 특히 try/catch / wrap / 에러 매핑 같은 *공통 패턴* 영역."

**검증 데이터**: 본 task D-6-3 1건. 후속 task 누적 시 정식화.

### 7.5 R-019 (가설 후보) — fork dev 환경 origin 일관성

D-6-4/5 발견 — CORS *origin 정확 매칭* 의 영향이 *e2e port* 와 *호스트명* 양면.

**가설**: "fork dev 환경에서 *e2e port* + *vite host* + *브라우저 접속 URL* 의 origin 일관성 정책 — 통합 매뉴얼 (`mydocs/manual/agent_dev_origin_policy.md`) 로 정식화. CORS_ALLOWED_ORIGINS 의 default 4 port 안에서 분배 + `--host` 옵션 미사용 (또는 `--host localhost`) + 브라우저 접속 `localhost`."

**검증 데이터**: 본 task D-6-4 (port) + D-6-5 (호스트명) 2건.

### 7.6 6 task 누적 트렌드

| task | 결정 변경 | 누락 (현 task) | deviation 수 (즉시 해결 포함) | 비고 |
|------|----------|--------------|---------------------------|------|
| #1 | — | — | 0 | R-014/R-015 도입 전 |
| #2 | 0 | 0 | 1 | |
| #3 | 0 | 0 | 0 | |
| #4 | 0 | 0 | 0 | R-014/R-015 첫 의무 |
| #5 | 0 | 0 | 6 | 두 번째 의무 (frontend 환경 사고 다수) |
| #6 | 0 | 0 | 5 (D-6-1~5) | 세 번째 의무 |

**결정 변경·누락 0건 누적 안정** + **deviation 은 *환경/구현 발견* 영역에 집중**. *결정 vs 발견* 의 분리 추적이 R-014/R-015 의 본질이라는 가설 강화.

## 8. 다음 마일스톤 후보 / 후속 task

### 8.1 agent-v0.1 마일스톤 100% 완성 — 종결 처리

| 행동 | 영역 |
|------|------|
| `local/task6` → `local/devel` merge | 메인테이너 |
| `local/devel` → `devel` merge + push | 메인테이너 |
| GitHub Issue #6 close (`closes #6` 본 PR commit) | 메인테이너 |
| `mydocs/orders/_NEXT_SESSION.md` 갱신 — agent-v0.1 100% + agent-v0.2 입구 | 메인테이너 |

### 8.2 agent-v0.2 마일스톤 입구 — *목표: hwp/hwpx 구조 인지 + 수정*

작업지시자 확정 결정 4건 (메모리 등록):

1. **LLM 표현 = 혼합** (Markdown 본문 + JSON 노드 ID 매개)
2. **Vision API 사용** (auto + raw_data 동봉)
3. **노드 ID = 유지·fork 측 매핑·rhwp-studio 발급**
4. **컨텍스트 = outline + on-demand 청크**

#### v0.2 task 후보 분해 (5 Tier, 16 task)

**Tier 1 — 인프라 (필수, 순차)**:
- B1: 양방향 채널 (SSE 우선 검토)
- B2: IR → LLM 표현 변환기 (sketch + text)
- B3: IR 노드 ID 부여 + outline tool
- B4: 객체별 tool (`get_text`, `get_table`, `get_chart`, `get_image`) 매핑
- B5: 사용자 승인 UI + 노드 단위 편집 명령 매핑

**Tier 2 — 분석 능력**:
- B6: 컨텍스트 청킹 전략 (결정 4 정착)
- B7: 시스템 프롬프트 — 현재 문서 outline 자동 주입
- B8: 표 분석 도구
- B9: 차트 데이터 해석 (vision + raw_data)

**Tier 3 — 풍부한 편집 + 미디어**:
- B10: 서식 도구 (글꼴/정렬/색)
- B11: 표 편집 도구 (행/열, 셀 병합)
- B12: Vision API 정착 (이미지/차트 썸네일)
- B13: 수식 도구 (라텍스 ↔ Equation)

**Tier 4 — 일괄 작업**:
- B14: 멀티스텝 planning
- B15: 일괄 편집 미리보기 (전체 diff)
- B16: undo / 변경 history

**우선순위**: B1·B2·B3 → 기술 조사 task 1건 (rhwp IR 의 노드 ID 정책 + LLM 친화 표현 변환기 prototype) **선행**.

### 8.3 방법론 정식화 task 후보

| 후보 | 출처 | 정식화 형태 |
|------|------|------------|
| **R-016** | #5 + #6 | frontend 검증 사다리 정식화 (puppeteer 단일 + mount 범위) |
| **R-017** | #5 + #6 | 본가 무수정 정책 *옵션 2 변형* 정식화 |
| **R-018** | #6 D-6-3 | 결정 누적 일관성 점검 — 과거 task 같은 레이어 일관성 |
| **R-019** | #6 D-6-4/5 | fork dev 환경 origin 일관성 정책 (manual) |

agent-v0.2 진입 전 또는 v0.2 첫 task 와 병행하여 정식화 task 등록 검토.

## 9. 종료 처리 체크

- [x] 단계별 보고서 (Stage 1·2·3·4) 모두 작성 + 커밋
- [x] 본 최종 보고서 작성
- [x] 단위 38 + e2e 16 + compose 실측 + 실 OpenAI 통합 모든 검증 통과
- [x] D-6-1·2·3·4·5 모두 즉시 해결
- [x] 사용자 직접 테스트 (옵션 A 브라우저) 정상 동작 확인
- [ ] `mydocs/orders/20260501.md` task #6 완료 상태 갱신
- [ ] `mydocs/orders/_NEXT_SESSION.md` agent-v0.1 100% + agent-v0.2 입구 갱신
- [ ] 본 보고서 + orders 갱신 commit 후 `local/task6` → `local/devel` merge 승인 요청
- [ ] (메인테이너) `local/devel` → `devel` push 후 GitHub Issue #6 close

작업지시자 승인 후 8.1 절차 진입.
