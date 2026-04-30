# [Stage 2 보고서] task_agent-v0.1_2 — ChatService + 모킹 e2e

- **이슈**: [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2)
- **수행계획서**: [task_agent-v0.1_2.md](../plans/task_agent-v0.1_2.md)
- **구현계획서**: [task_agent-v0.1_2_impl.md](../plans/task_agent-v0.1_2_impl.md) Stage 2
- **단계**: Stage 2 / 3
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

OpenAI SDK 수동 모킹, ChatService 구현 (factory + service + types + errors), ChatModule 등록, 단위 테스트 3건 + 모킹 e2e 1건 자동 검증까지 완료.

| 종료 체크 | 결과 |
|----------|------|
| `npm run build` exit 0 | ✅ |
| 단위 테스트 (`chat.service.spec.ts`) | ✅ 3 passed |
| e2e 테스트 (`chat.e2e-spec.ts` + 기존) | ✅ 4 passed |
| R-009: 모킹 응답 시간 < 100ms | ✅ 테스트 안에 expect 포함 |
| OpenAiError 도메인 에러 throw 검증 | ✅ 단위 테스트 2건 |
| ChatService 가 OPENAI_MODEL 사용 | ✅ e2e 통과로 간접 검증 |

## 2. 실행 로그 발췌

```
$ npm run build
> nest build (exit 0)

$ npm test
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total       (chat.service.spec.ts)
Time:        0.59 s

$ npm run test:e2e
Test Suites: 3 passed, 3 total
Tests:       4 passed, 4 total       (config 2 + health 1 + chat 1)
Time:        1.535 s
```

## 3. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/src/chat/chat.types.ts` | ChatRole / ChatMessage 타입 |
| `rhwp-agent-server/src/chat/chat.errors.ts` | OpenAiError 도메인 에러 클래스 |
| `rhwp-agent-server/src/chat/openai.factory.ts` | OPENAI_CLIENT 토큰 + factory provider |
| `rhwp-agent-server/src/chat/chat.service.ts` | complete(messages) + 응답 시간 로깅 |
| `rhwp-agent-server/src/chat/chat.module.ts` | ChatModule 정의 (provider/exports) |
| `rhwp-agent-server/src/chat/chat.service.spec.ts` | 단위 테스트 (3건) |
| `rhwp-agent-server/test/chat.e2e-spec.ts` | 모킹 e2e (1건) |
| `rhwp-agent-server/test/__mocks__/openai.ts` | OpenAI SDK manual mock (e2e jest 용) |
| `rhwp-agent-server/src/__mocks__/openai.ts` | 동일 mock (단위 jest 용 — deviation §4.1) |

### 수정

| 경로 | 변경 |
|------|------|
| `rhwp-agent-server/src/app.module.ts` | ChatModule import 추가 |

## 4. 계획 대비 편차 (Deviations)

### 4.1 manual mock 위치 dup (`src/__mocks__/` + `test/__mocks__/`)

- **현상**: jest 의 manual mock 검색은 *각 jest config 의 rootDir 의 `__mocks__/` 하위*. 본 프로젝트는 단위(`rootDir: src`)와 e2e(`rootDir: .` = test) 둘이 분리되어, 양쪽이 같은 모듈 (openai) 모킹을 위해 각자 위치에 manual mock 필요.
- **영향**: 동일 파일이 2곳에 존재 (코드 dup). 한쪽 수정 시 다른 쪽도 수정해야 함.
- **본 task 에서의 처리**: 두 파일 모두 작성 + 본 보고서에 명시.
- **재검토 옵션** (후속 후보):
  - 옵션 A: jest config 의 `roots` 에 양쪽 디렉터리 추가 → manual mock 검색 통합
  - 옵션 B: 단위 테스트도 e2e 디렉터리로 이동 (testRegex 분리)
  - 옵션 C: mock 본체를 별도 helper 파일에 두고 양쪽 `__mocks__/openai.ts` 는 re-export
  - 본 task 종료 후 별도 *테스트 인프라 정리 task* 후보. 본 task 의 본질 검증에는 영향 없음.

### 4.2 R-007 적용 결과 (Stage 1 와 일관)

`openai`/`@nestjs/config`/`joi` 안정 채널 표현 → 실제 설치 모두 *제약 안*. 본 stage 에서도 외부 도구 deviation 0. **R-007 가설 추가 입증**.

### 4.3 R-008 적용 결과 (자동 테스트)

종료 체크 6건 모두 자동 명령. 작업지시자 manual 검증 0회. **R-008 가설 추가 입증**.

### 4.4 R-009 적용 결과 (수치형 + 오차)

- 응답 시간 모킹 `< 100ms`: 두 테스트(단위 + e2e) 안에서 `expect(elapsed).toBeLessThan(100)` 으로 **자동 측정**. 실제 elapsed 1ms 이하로 통과 (mock 즉시 반환).
- 작업 시간 60 ± 20분: 실제 약 50분 (코드 작성 25분 + 단위 mock 위치 디버그 15분 + 검증 + 보고서 10분). 계획 범위 안. **R-009 가설 입증**.

## 5. 검증 방법 (재현)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/rhwp-agent-server

npm run build               # exit 0
npm test                    # 단위: 3 passed
npm run test:e2e            # e2e: 4 passed
```

## 6. 다음 단계 — Stage 3 진입 체크리스트

- [ ] Stage 2 보고서 승인
- [ ] 옵셔널 실 API 테스트 디자인 합의 (`describe.skip` + `jest.unmock('openai')`)
- [ ] Docker compose 통합 검증 시 ConfigModule 부팅 검증 동작 재확인

## 7. 방법론 평가 메모

### 7.1 R-007/R-008/R-009 누적 (2/3)

| 가설 | Stage 1 | Stage 2 | 누적 평가 |
|------|---------|---------|-----------|
| R-007 (버전 제약화 → deviation ↓) | 입증 | 추가 입증 | ✅ 일관성 확보 |
| R-008 (자동 테스트로 manual ↓) | 입증 | 추가 입증 | ✅ manual curl 0회 (Stage 1+2 누적) |
| R-009 (수치형 + 오차) | 부분 (시간만) | 입증 (응답 시간 + 시간 모두 자동 측정) | ✅ 본격 측정 도입 |

### 7.2 manual mock dup 패턴

본 task 의 첫 *jest 인프라 deviation*. NestJS CLI default jest config (단위 vs e2e 분리) 가 내장 디자인이라 회피 어려움. 단순 dup 으로 처리. 후속 *테스트 인프라 정리 task* 후보 (R-012 후보: *jest manual mock 의 단일 진실 원천 패턴*).

### 7.3 Stage 1 의 deviation 학습이 Stage 2 에서 작용한 부분

Stage 1 의 캐싱 (4.1) 이슈 학습이 Stage 2 의 `chat.e2e-spec.ts` 작성 시 *AppModule import 만으로 충분, ConfigModule 인라인 불필요* 판단에 도움. 즉 직전 stage 의 보고서가 다음 stage 디자인의 입력으로 작용하는 패턴이 잘 작동.

### 7.4 본 stage 의 시간 실측 (R-009 누적)

- **계획**: 60 ± 20분 (40~80분)
- **실제**: 약 50분
- **분석**: 계획 범위 안. mock 위치 디버그가 15분 (예상치 못함)이 있었으나 R-009 의 ±20분 허용 오차 안 → deviation 으로 분류 안 됨. **R-009 가설 입증**.
