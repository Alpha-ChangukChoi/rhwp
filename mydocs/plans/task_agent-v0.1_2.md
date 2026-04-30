# [수행계획서] task_agent-v0.1_2 — OpenAI Chat Completions 클라이언트 + 환경변수 검증

- **이슈**: [#2 — OpenAI Chat Completions 클라이언트 + 환경변수 검증](https://github.com/Alpha-ChangukChoi/rhwp/issues/2)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task2`
- **선행 task**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) NestJS agent-server 스켈레톤 + docker-compose 통합 (완료)
- **작성일**: 2026-04-30
- **방법론 근거**: 본가 [CLAUDE.md](../../CLAUDE.md) 절차 3단계 + fork [methodology_refinements.md](../manual/methodology_refinements.md) R-001/R-007/R-008/R-009

---

## 1. 목적 / 배경

agent-v0.1 마일스톤의 **백엔드 핵심 인프라**. #1 의 NestJS 스켈레톤 위에 OpenAI Chat Completions 호출 능력을 얹는다. 다만 본 이슈는 *도구(tool) 사용 없는 단순 메시지 호출*까지만 다루며, 다음의 후속 의존을 받는다.

```
#2 (본 task) — OpenAI 호출 인프라
   ├─→ #3 hwpctl Action ↔ tool 매핑
   ├─→ #4 멀티턴 세션 히스토리
   ├─→ #5 사이드바 UI (#3+#4 의 산출물 소비)
   └─→ #6 메시지·tool 호출 프로토콜
```

본 task 의 핵심 의도는 *후속에서 안심하고 호출할 수 있는 단단한 기반*을 만드는 것. 즉:

- **부팅 시 환경변수 검증** — 키 없으면 즉시 실패. 후속 단계에서 *런타임에 키 체크*로 매번 가드할 필요를 없앤다.
- **모킹 우선 자동 테스트** — 후속 작업이 매번 OpenAI 비용을 들이지 않고 회귀 검증 가능.
- **인터페이스 단순화** — `complete(messages) → assistant message` 정도로 추상화. 후속에서 도구·멀티턴을 얹을 때 인터페이스 변경 비용 ↓.

## 2. 종료 조건

이슈 #2 의 종료 조건을 그대로 인용 (R-009 적용된 수치 포함).

- [ ] `openai` npm 의존성 설치 (안정 채널)
- [ ] 환경변수 누락 시 부팅 실패 (명시적 에러 메시지, 자동 e2e 테스트로 검증)
- [ ] `ChatService.complete(messages)` → assistant 응답 반환 (모킹 e2e 테스트로 검증)
- [ ] 옵셔널 실 API 통합 테스트 (`OPENAI_API_KEY` 있을 때만 실행 — `describe.skip` 또는 `jest.config` 분리)
- [ ] 응답 시간 기준치 + 허용 오차 (R-009):
  - 모킹: 100ms 이하 (테스트 timeout 1s)
  - 실 API: 30s ± 10s (timeout 40s, 초과 시 deviation 기록)
- [ ] 수행계획서 / 구현계획서 / 단계별 보고서 / 최종 보고서 작성

## 3. 영향 범위

| 종류 | 경로 | 변경 형태 |
|------|------|----------|
| 수정 | `rhwp-agent-server/package.json` | `openai`, `@nestjs/config`, `joi` 추가 |
| 수정 | `rhwp-agent-server/src/app.module.ts` | ConfigModule + ChatModule import |
| 수정 | `rhwp-agent-server/src/main.ts` | 부팅 검증 후크 (필요 시) |
| 수정 | `rhwp-agent-server/.env.example` | `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS` 추가 |
| 신규 | `rhwp-agent-server/src/config/env.schema.ts` | joi 검증 스키마 |
| 신규 | `rhwp-agent-server/src/chat/chat.module.ts` | ChatModule 정의 |
| 신규 | `rhwp-agent-server/src/chat/chat.service.ts` | OpenAI 호출 + complete() |
| 신규 | `rhwp-agent-server/src/chat/openai.factory.ts` | OpenAI 클라이언트 인스턴스 (DI 친화) |
| 신규 | `rhwp-agent-server/src/chat/chat.types.ts` | Message / Result 타입 |
| 신규 | `rhwp-agent-server/test/chat.e2e-spec.ts` | 모킹 기반 ChatService e2e |
| 신규 | `rhwp-agent-server/test/chat-real-api.e2e-spec.ts` | 실 API 옵셔널 테스트 |
| 신규 | `rhwp-agent-server/test/__mocks__/openai.ts` | OpenAI SDK 수동 모킹 |

본가 코드 무수정 — `src/`, `rhwp-studio/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/` 모두 변경 없음. `docker-compose.yml`, `.gitignore` 도 본 task 에서는 미수정 (env 만 늘어남, 기존 `rhwp-agent-server/.env` 가 이미 무시 처리됨).

## 4. 외부 의존성

R-007 적용 — 버전은 *제약*으로 명시.

| 항목 | 제약 | 비고 |
|------|------|------|
| Node.js | #1 의 .nvmrc (22) 그대로 | 고정 |
| `openai` | npm 안정 채널 (`@latest` 또는 `^x.y` 잠금) | 작업 시점 LTS 기준 |
| `@nestjs/config` | NestJS 11 호환 (`^4` 또는 그 시점 stable) | 환경변수 주입 표준 |
| `joi` | 안정 채널 | env 스키마 검증 (대안: zod, class-validator) |
| OpenAI 모델 | 작업 시점의 권장 채팅 모델 | Stage 1 시작 시 [OpenAI docs](https://platform.openai.com/docs/models) 1회 확인 후 .env.example 기본값 결정 |

## 5. 단계 분할 개요

상세는 구현계획서에서 확정. 잠정 분할:

| Stage | 내용 | 검증 |
|-------|------|------|
| **Stage 1** | `openai` + `@nestjs/config` + `joi` 의존성 + ConfigModule + 환경변수 검증 (key 없으면 부팅 실패) | 자동 e2e: 키 누락 시 `app.init()` reject |
| **Stage 2** | ChatService 구현 (`complete(messages)`) + OpenAI SDK 수동 모킹 + 모킹 e2e | 자동 e2e: 임의 messages → mock assistant 응답 |
| **Stage 3** | 옵셔널 실 API 통합 테스트 + 통합 검증 + 문서 정리 | jest 조건부 실행, 키 있으면 1회 실호출 |

3 stage (본가 절차 최소치).

## 6. 리스크 / 미해결 결정사항

각 항목별 추천안 + 이유. 작업지시자 결정이 필요한 부분만 표시.

### R-1. 환경변수 검증 도구
- **추천**: `@nestjs/config` + `joi` 스키마 (NestJS 공식 권장 패턴)
- **대안**: `zod` (TypeScript 친화), `class-validator` (NestJS DTO 와 일관성)
- **이유**: joi 가 NestJS 공식 문서 표준 + 후속 task 의 추가 환경변수 누적 시 학습 곡선 ↓.

### R-2. OpenAI 모델 기본값 (R-007 적용)
- **추천**: Stage 1 시작 시 [OpenAI docs](https://platform.openai.com/docs/models) 1회 확인 후 결정. `.env.example` 의 `OPENAI_MODEL` 기본값으로 설정.
- **이유**: 모델 라인업·이름이 자주 변경됨. 계획 시점에 고정하면 deviation 발생 가능 → R-007 정신.

### R-3. 모킹 라이브러리
- **추천**: jest 수동 모킹 (`test/__mocks__/openai.ts`) — 추가 의존성 0
- **대안**: `nock` (HTTP 레벨 모킹), `msw` (서비스 워커 기반)
- **이유**: openai SDK 자체를 모킹하면 인스턴스 동작이 결정적이고 *SDK 버전 업그레이드 시에도 안정*. HTTP 레벨 모킹은 SDK 가 내부 구조 바꾸면 깨짐.

### R-4. ChatService 인터페이스
- **추천**: `complete(messages: ChatMessage[]): Promise<ChatMessage>` — 단순 동기형 1회 응답
- **대안**: 스트리밍 `completeStream(messages): AsyncIterable<ChatChunk>`
- **이유**: 본 task 는 *호출 가능성 검증* 까지. 스트리밍은 #5 사이드바 UI 시점에 도입 (사용자 체감 타이밍이 그때 중요). 인터페이스를 너무 일찍 복잡화하면 후속 작업이 더 어려워짐.

### R-5. 에러 처리 전략
- **추천**: OpenAI API 에러는 `OpenAiError` 도메인 클래스로 변환. HTTP 응답 변환은 #6 (프로토콜) 에서 처리.
- **대안**: 즉시 `HttpException` 으로 던짐
- **이유**: 본 task 는 service 계층까지. HTTP 노출이 없으니 HTTP 의미론이 새지 않게.

### R-6. 응답 시간 측정·로깅
- **추천**: ChatService 안에서 `console.time/timeEnd` 또는 `Date.now()` 차감으로 elapsed 로깅. 메트릭 라이브러리(prom-client 등) 미도입.
- **이유**: 본 task 는 시간 *측정*까지. 메트릭 수집·노출은 후속 옵저버빌리티 task 후보.

### R-7. CI 에서의 옵셔널 실 API 테스트
- **추천**: 본 task 에서는 *실행 가능 형태*까지만 — `OPENAI_API_KEY` 환경변수 있을 때 실행, 없으면 skip. CI 통합(GitHub Actions 시크릿)은 후속.
- **이유**: 본 task 의 본질은 service 동작. CI 자체는 인프라 결정 (사용·비용 정책 포함).

### R-8. 환경변수 추가 항목 명세 (.env.example)
- **추가 예정**:
  - `OPENAI_API_KEY=` (#1 에서 이미 placeholder)
  - `OPENAI_MODEL=` (Stage 1 시작 시 기본값 결정)
  - `OPENAI_TIMEOUT_MS=30000` (30초, R-009 정신)
- **이유**: 후속 #3~#6 에서 추가될 OPENAI_TOOL_CHOICE 등은 본 task 범위 외.

## 7. 일정 가이드

R-009 적용된 *기준치 + 허용 오차*:

| 단계 | 코드 작업 추정 (기준 ± 오차) | 승인 사이클 | 비고 |
|------|---------------------------|-----------|------|
| 수행계획서 | — | 1회 | 본 문서 |
| 구현계획서 | — | 1회 | 다음 단계 |
| Stage 1 | 30 ± 15 분 | 1회 | ConfigModule + joi schema |
| Stage 2 | 60 ± 20 분 | 1회 | ChatService + 모킹 + e2e |
| Stage 3 | 30 ± 15 분 | 1회 | 실 API 옵셔널 테스트 + 문서 |
| 최종 보고서 | — | 1회 | 방법론 평가 누적 |

기준치 초과 시 deviation 기록 + 분석.

## 8. 방법론 평가 메모 (사전)

### 8.1 R-007/R-008/R-009 의 첫 실측 사례

본 task 는 R-007/R-008/R-009 가 사전 적용된 *최초의 task*. 검증할 가설:

- **R-007 가설**: 도구 버전을 *고정*이 아닌 *제약*으로 적은 결과, deviation 발생률이 #1 보다 낮을 것.
- **R-008 가설**: 종료 조건을 *자동 테스트로 표현*한 결과, 작업지시자 manual 검증 단계가 더 줄거나 사라질 것.
- **R-009 가설**: 응답 시간 등 수치형 제약을 *기준치 + 허용 오차*로 표기한 결과, deviation 발생 시에도 *계획 안의 정상 범위* 또는 *후속 task로 분리*가 명확히 결정될 것.

### 8.2 R-001 (이슈 등록 미니사이클) 2회 적용

#1 1회 → #2 2회. 같은 패턴이 *사용자·작업 흐름에 마찰을 추가하는지 줄이는지* 관찰. #1 에서는 사용자 응답 사이클 1회 추가됐지만 결정 가시성 ↑로 보상. 누적 효과는 최종 보고서에서 평가.

### 8.3 본가 절차 외부 추가 단계

본 task 의 핵심 결정 (R-2 OpenAI 모델 기본값) 이 *Stage 1 시작 시 OpenAI docs 확인* 같은 외부 의존성. 이런 *진행 중 외부 정보 조회 단계*가 본가 절차에 명시적이지 않음. 차기 절차 다듬기(R-010) 후보:

> "외부 정보 조회가 필요한 결정은 수행계획서에 *조회 대상 + 결정 기준*을 명시하고, 실제 조회·결정은 해당 stage 시작 시점에 수행한다."

본 task 종료 시 정식 등록 검토.
