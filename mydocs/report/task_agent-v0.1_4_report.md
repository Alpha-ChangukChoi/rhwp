# [최종 보고서] task_agent-v0.1_4 — 멀티턴 세션 히스토리 관리 (in-memory)

- **이슈**: [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task4`
- **수행 기간**: 2026-04-30 (단일일, 약 1.5시간)
- **단계 수**: 3
- **작성일**: 2026-04-30

---

## 1. 요약

agent-v0.1 마일스톤의 **멀티턴 대화 인프라** 완성. #2 의 `complete()` 와 #3 의 `completeWithTools()` 가 *단일 호출* 만 처리하던 한계를 해소. **세션 단위 히스토리 누적** + **자동 prepend** 후 도구 호출 루프 활용 패턴.

**핵심 산출물**:
- `SessionService` (in-memory `Map<SessionId, Session>` + lazy on-access expire + sliding TTL + FIFO drop)
- `ChatService.completeInSession(sessionId, userMessage)` — 기존 `completeWithTools()` 위에 세션 history 자동 prepend
- 환경변수 `SESSION_TTL_MS` (default 30분), `SESSION_MAX_HISTORY` (default 50) Joi 검증 추가
- 단위 32건 + e2e 6건 자동 검증
- compose 환경 부팅 검증 (R-013 2단계 사다리)

이슈 종료 조건 7 항목 충족.

| 종료 조건 | 결과 |
|----------|------|
| `SessionService.create/append/get/expire` 단위 테스트 | ✅ 단위 11건 |
| `ChatService.completeInSession()` 자동 e2e 모킹 | ✅ 단위 3건 + e2e 1건 |
| 세션 TTL 30분 ± 10분 (R-009) | ✅ Joi default + 단위 expect (50ms 주입) |
| max history 50 ± 20 (R-009) | ✅ Joi default + 단위 expect (2/3 주입) |
| compose 부팅·초기화 정상 (R-013) | ✅ SessionModule + ChatModule initialized |
| 응답 시간 (모킹 1턴 < 100ms) | ✅ 자동 expect |
| 문서 4종 완비 | ✅ |

## 2. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/src/session/session.types.ts` | `Session`, `SessionId` 타입 |
| `rhwp-agent-server/src/session/session.errors.ts` | `SessionNotFoundError`, `SessionExpiredError` |
| `rhwp-agent-server/src/session/session.service.ts` | SessionService (in-memory + lifecycle) |
| `rhwp-agent-server/src/session/session.module.ts` | NestJS module |
| `rhwp-agent-server/src/session/session.service.spec.ts` | 단위 11건 |
| `rhwp-agent-server/test/chat-session.e2e-spec.ts` | 멀티턴 세션 e2e |
| `mydocs/plans/task_agent-v0.1_4.md` | 수행계획서 |
| `mydocs/plans/task_agent-v0.1_4_impl.md` | 구현계획서 |
| `mydocs/working/task_agent-v0.1_4_stage{1,2,3}.md` | 단계별 보고서 |
| `mydocs/report/task_agent-v0.1_4_report.md` | 본 최종 보고서 |

### 수정

| 경로 | 변경 |
|------|------|
| `rhwp-agent-server/src/chat/chat.service.ts` | 생성자 SessionService DI + `completeInSession()` 메서드 (기존 `complete()`, `completeWithTools()` 무수정) |
| `rhwp-agent-server/src/chat/chat.service.spec.ts` | beforeEach providers 갱신 + `buildConfig()` 헬퍼 + `completeInSession` describe 3건 |
| `rhwp-agent-server/src/chat/chat.module.ts` | SessionModule import |
| `rhwp-agent-server/src/config/env.schema.ts` | `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` Joi 검증 추가 |
| `rhwp-agent-server/.env.example` | 두 환경변수 default 명시 |
| `mydocs/manual/methodology_refinements.md` | R-014/R-015 효과 측정 결과 추가 (본 보고서 작성 후 갱신) |
| `mydocs/orders/20260430.md` | #4 항목 + 회고 추가 |

본가 코드 무수정 — 4 task 누적으로 정책 유지.

**신규 의존성 0건**. `crypto.randomUUID()` (Node 19+ 표준) 만 사용.

## 3. 통합 검증 결과

### 3.1 jest 환경 (Stage 1·2)
```
build:    exit 0
unit:     32 passed (Stage 1 종료 시점 29 + Stage 2 신규 3)
e2e:      6 passed + 1 skipped (config 2 + health 1 + chat 1 + chat-tools 1
                              + chat-session 1, real-api skipped)
```

### 3.2 컨테이너 환경 (Stage 3)
```
build:    success (캐시 활용, ~11s)
up:       Up 4 seconds
logs:     SessionModule dependencies initialized ✅ (신규)
          ChatModule dependencies initialized ✅
health:   {"status":"ok","service":"rhwp-agent-server","version":"0.1.0"}
down:     정상 정리
```

R-013 2단계 검증 사다리의 두 layer 결과 *일관*.

## 4. 결정 추적 (수행계획서 §6 R-4-A~I → 실제)

| ID | 결정 | 실제 적용 |
|----|------|----------|
| R-4-A | in-memory Map | ✅ `Map<SessionId, Session>` (Cache Manager 미도입) |
| R-4-B | 서버 자동 발급 (UUID v4) | ✅ `crypto.randomUUID()` |
| R-4-B 보강 | `create(initialMessages?)` 단순 | ✅ externalId 인자 미노출 (후속 #6 시점 확장 여지) |
| R-4-C | sliding TTL | ✅ `lastAccessedAt` 갱신 + 단위 #8 검증 |
| R-4-D | 메시지 수 가드 (50±20) | ✅ Joi default 50 + 단위 expect |
| R-4-E | expired/없음 → 에러 throw | ✅ `SessionNotFoundError`, `SessionExpiredError` 분리 |
| R-4-F | FIFO drop + system 보존 | ✅ `enforceMaxHistory()` 의 budget = max - system count 정확화 |
| R-4-G | ChatService↔SessionService 평행 (DI) | ✅ ChatService 생성자에 sessions 추가 |
| R-4-H | lazy on-access expire | ✅ `get()` 진입 시 검사 + `store.delete()` |
| R-4-I | 환경변수 채택 | ✅ Joi schema + `.env.example` |

**추천 변경 0건** — 9건 결정 모두 처음 추천 그대로 적용.

## 5. Deviation 종합

| ID | 단계 | 내용 | 영향 | 처리 |
|----|------|------|------|------|
| 5.1.1 | Stage 1 | `enforceMaxHistory()` 의 trim 로직을 *budget = max - system count* 으로 정확화 (구현계획서 §1.4 의 `nonSystem.slice(overflow)` 가 *system 메시지가 max 근처일 때* 경계 동작 부정확) | 정확성 ↑, R-4-F 정확성 보강 | 그대로 진행 (단위 #9 로 검증) |
| 3.2.1 | Stage 3 | 사용자 `.env` 미갱신 → 컨테이너 환경에 SESSION_* 환경변수 부재 → Joi default fallback 동작 | 기능 0, *계획 안의 정상 범위* | 구현계획서 §리스크 인지 시나리오, sub-task 분리 불필요. 사용자 production 배포 시 .env 명시 권장 |

**3 stage 누적 deviation 2건 (모두 사전 인지 또는 정확성 향상)**. #1 (6건) → #2 (3건) → #3 (1건 긍정) → **#4 (2건, 모두 *계획 안의 정상 범위*)** 의 trend.

## 6. 회고

### 6.1 예상 대비 실제

| 항목 | 예상 | 실제 |
|------|------|------|
| Stage 1 | 35 ± 15분 | 25분 |
| Stage 2 | 50 ± 20분 | 30분 |
| Stage 3 | 25 ± 10분 | 15분 |
| 전체 | 110 ± 45분 | 약 70분 + 보고서 |
| Deviation | 0~3건 | 2건 (모두 정상 범위) |
| Manual 검증 | 0회 | 0회 ✅ |

**시간 단축 요인**:
- R-007~R-015 사전 적용으로 *결정 마찰 0*
- R-4-A~I 9개 결정 사전 명시 + *반대 입장 근거*까지 명시 (R-015) → *self-check 정확도 ↑* → 구현 시 모호함 0
- 신규 의존성 0 → npm install 비용 0

### 6.2 가장 큰 학습

1. **R-014/R-015 의 첫 의무 적용 효과 입증**: 9건 결정 모두 *추천 변경 0건*. #3 의 R-3-D (결정 변경 사례) 같은 일이 본 task 에서는 0회. *반대 입장 근거 사전 명시*가 *self-check 의 정확도를 높여 처음부터 정확한 추천*을 가능하게 함.
2. **사전 인지 deviation 의 가치**: 구현계획서 §리스크 에 명시된 *"compose 환경변수 주입 fallback"* 시나리오가 정확히 발생 — 사전 인지로 *계획 안의 정상 범위*로 즉시 분류, 정신적 비용 0.
3. **`enforceMaxHistory()` 의 경계 정확화**: 구현 직전에 *system 메시지가 max 근처* 케이스를 자체 발견 → budget 기반 로직으로 정확화. R-009 (수치 + 허용 오차) 정신상 *경계 조건*에서의 정확성이 deviation 발생 여지 사전 차단.

### 6.3 재작업 회수

0회. 본 task 는 *구현 단계에서 재작업 없이 곧장 통과* — 4 task 누적 중 가장 매끄러운 진행.

## 7. 방법론 평가 (본 task 종합)

본 task 는 **R-007~R-015 의 *완전 누적* 사전 적용 첫 사례**. R-014/R-015 의 *첫 의무 적용 효과 측정* 완료.

### 7.1 R-007~R-015 누적 가설 검증 (4 task 트렌드)

| 가설 | #1 (적용 X) | #2 (R-7/8/9) | #3 (R-7~13) | #4 (R-7~15 *완전*) | 트렌드 |
|------|------------|-------------|-------------|------------------|--------|
| Deviation 건수 | 6건 | 3건 | 1건 (긍정) | 2건 (정상 범위) | **0~정상 범위 수렴** |
| 추천 변경 (수행계획서 §6) | N/A | N/A | 1건 (R-3-D) | **0건** | *반대 입장 근거 효과* |
| Manual 검증 | ~3회 | 0회 | 0회 | **0회** | **0 유지** |
| 시간 (계획 대비) | 거의 정확 | 거의 정확 | 하한 미만 | **하한 근처/미만** | **단축 안정** |
| 재작업 | 1회+ | 1회 | 0회 | **0회** | **0 유지** |

4 task 누적으로 *fork 자기 개선 루프*가 정량적으로 안정 입증됨.

### 7.2 R-014 (이슈 점검표 의무) — 첫 의무 적용 효과

본 task 는 R-014 첫 의무 적용 사례. 이슈 #4 본문에 R-007~R-015 점검표 포함됨.

| 측정 항목 | 결과 |
|----------|------|
| 작업지시자 다듬기 적용 *즉시 파악* | ✅ (Stage 1 시작 전 R-011 환경 점검 + 점검표 대조 → 진입 즉시 작업 흐름 가시화) |
| 클로드 다듬기 누락 0건 | ✅ (9개 R-4-* 결정사항 모두 §6 명시, 누락 0) |
| 이슈 본문 → 수행계획서 → 구현계획서 → 단계별 보고서 일관성 | ✅ (점검표 항목이 각 단계 보고서에 자연스럽게 trace) |

### 7.3 R-015 (반대 입장 근거 명시) — 첫 의무 적용 효과

§6 의 9건 결정사항 모두 *추천 + 이유 + 반대 입장 근거* 형식 의무 적용.

| 측정 항목 | 결과 | 해석 |
|----------|------|------|
| 결정 변경 건수 | **0건** | #3 의 R-3-D (1건 변경) 대비 0건. *반대 입장 사전 명시 → self-check 정확도 ↑* 가설 입증 |
| 작업지시자 검증 질문 | 0건 (승인만) | *반대 입장이 사전에 명시되어 있어 별도 질문 불필요* — 양쪽 근거를 즉시 비교 가능 |
| 추천의 "철저함 인센티브" | 측정 정성적 | 9건 결정 모두 *반대 입장 근거 작성 과정*에서 추천 자체를 한 번 더 점검하게 됨 |

**반대 가설**: 본 task 의 결정 항목들이 *명백한 추천이 있는 경우*만 모여서 변경 여지 자체가 작았을 수도 있음. #5/#6 의 더 복잡한 결정 시점 (UI 컴포넌트 디자인, 프로토콜 선택) 에서 재측정 필요.

### 7.4 R-013 (2단계 검증 사다리) — 누적 효과

| Layer | 환경 | 본 task 검증 항목 |
|-------|------|------------------|
| 1a | jest 단위 | SessionService lifecycle (11건) — TTL/sliding/FIFO drop 모두 자동 expect |
| 1b | jest e2e | ChatService.completeInSession 누적 + AppModule 부트스트랩 |
| 2 | docker compose | SessionModule + ChatModule DI / health / fallback |

#2/#3 와 일관되게 *jest 통과 → compose 통과* 패턴. 본 task 의 SESSION_* 환경변수 fallback 시나리오는 *layer 2 에서만 발견 가능한 차이* — R-013 의 가치 재입증.

### 7.5 R-014/R-015 정식화 정착 종합

본 task 종료 시점에 fork 는 *15개의 정식화된 R-* 다듬기*를 누적 + R-014/R-015 의 첫 의무 적용 효과 입증.

| 다듬기 그룹 | 항목 | 4 task 누적 적용 효과 |
|------------|------|---------------------|
| 절차 골격 | R-001 (이슈 등록 미니사이클), R-014 (다듬기 점검표) | 작업지시자 검증 게이트 명확화 |
| 도구 사용 | R-007 (버전 제약), R-008 (자동 검증), R-009 (수치+오차) | manual 검증 0회 유지 |
| 외부 의존성 | R-010 (외부 정보 조회) | 본 task 외부 의존 0 → 효과 측정 보류 |
| 환경 | R-011 (누적 환경 정합성) | 시작 시점 deviation 0 유지 |
| 검증 사다리 | R-013 (2단계) | 모든 backend task 의 표준 골격 |
| 결정 품질 | R-015 (반대 입장 근거) | 본 task에서 결정 변경 0건 — *효과 입증* |
| 구체 인프라 | R-012 (mock 단일 원천) | 후속 R-012 task 후보 (별도) |

**핵심 가설** (4 task 누적 입증): *"다듬기를 누적할수록 deviation 발생률 감소 + 작업 시간 단축 + 작업지시자 부담 감소 + 결정 품질 ↑"* — 본 task 의 R-015 첫 의무 적용으로 *결정 품질* 차원이 합류.

### 7.6 다른 프로젝트 일반화 가능성 (강한 후보, #3 시점 분류 유지)

본 task 는 #3 의 일반화 후보 분류를 그대로 입증:

1. R-001/R-014/R-015 의 *결정 가시성 패턴* — 모든 협업 작업 ✅
2. R-007/R-008/R-009 의 *도구·검증·수치 표현 패턴* — 모든 엔지니어링 작업 ✅
3. R-010 의 *외부 의존성 fallback 명시* — 본 task 적용 사례 없음
4. R-013 의 *2단계 검증 사다리* — backend / production 환경이 있는 모든 작업 ✅ (재입증)

## 8. 다음 이슈 후보 (agent-v0.1 마일스톤)

| 이슈 | 제목 | 의존 | 사전 적용할 다듬기 | 새 과제 |
|------|------|------|-----------------|--------|
| #5 (예정) | rhwp-studio 사이드바 채팅 UI | #3+#4 ✅ | R-007~R-015 전부 (frontend 적용 검증) | DOM/CSS 영역의 *2단계 검증 사다리* (jest + 브라우저 e2e) 정의 |
| #6 (예정) | 백엔드↔프런트엔드 메시지·tool 호출 프로토콜 | #5 | 위 전부 | sessionId 발급 정책 결정 (서버/클라이언트, 본 task §R-4-B 보강 인계) |

#5/#6 시점에서 R-014/R-015 의 효과를 *frontend / 프로토콜* 영역에서 재측정.

### 후속 task 후보 (마일스톤 외)

- 영속 저장 (DB/redis) — 본 task §R-4-A 의 후속
- max history 토큰 기반 가드 — 본 task §R-4-D 의 후속
- 정기 sweep (`@nestjs/schedule`) — 본 task §R-4-H 의 후속
- 멱등 키 (completeInSession 재시도 시) — 본 task Stage 2 §4 (3) 의 후속
- (R-012) jest manual mock dup 정리 — 별도 *테스트 인프라 정리 task*

## 9. 종료 처리 체크

- [ ] 본 보고서 작업지시자 승인
- [ ] 단계별 커밋 (Stage 1 / 2 / 3 / 최종) 4건 완료
- [ ] `git status` 깨끗
- [ ] 이슈 #4 클로즈
- [ ] `local/task4` → `local/devel` no-ff merge
- [ ] orders/20260430.md 갱신
- [ ] methodology_refinements.md 의 R-014/R-015 *효과 측정 결과* 섹션 추가
