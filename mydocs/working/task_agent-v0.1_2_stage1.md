# [Stage 1 보고서] task_agent-v0.1_2 — 의존성 + ConfigModule + 환경변수 검증

- **이슈**: [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2)
- **수행계획서**: [task_agent-v0.1_2.md](../plans/task_agent-v0.1_2.md)
- **구현계획서**: [task_agent-v0.1_2_impl.md](../plans/task_agent-v0.1_2_impl.md) Stage 1
- **단계**: Stage 1 / 3
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

`openai`/`@nestjs/config`/`joi` 의존성 설치, joi 검증 스키마 작성, ConfigModule 등록, OPENAI_API_KEY 누락 시 부팅 실패 e2e 자동 검증까지 완료.

| 종료 체크 | 결과 |
|----------|------|
| R-2 (OPENAI_MODEL=gpt-5.4) 결정 | ✅ 작업지시자 응답 |
| `npm install` 0 vulnerabilities | ✅ 14 packages 추가 |
| `npm run build` exit 0 | ✅ |
| `npm run test:e2e` 3 passed | ✅ (config 2 + health 1) |
| `.env.example` 갱신 (OPENAI_MODEL/TIMEOUT_MS) | ✅ |

## 2. 실행 로그 발췌

### 2.1 R-2 결정

작업지시자 응답: `gpt-5.4`. `.env.example` 의 OPENAI_MODEL 기본값 + joi schema default 모두 동일 값으로 설정.

### 2.2 의존성 설치

```
$ npm install openai @nestjs/config joi
added 14 packages, and audited 703 packages in 3s
148 packages are looking for funding
found 0 vulnerabilities
```

설치 버전 (R-007: 안정 채널 사용):
- `openai`: ^6.35.0
- `@nestjs/config`: ^4.0.4
- `joi`: ^18.1.2

### 2.3 빌드 + 자동 테스트

```
$ npm run build
> nest build
(exit 0)

$ npm run test:e2e
> jest --config ./test/jest-e2e.json

Test Suites: 2 passed, 2 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        1.315 s
```

테스트 명세:
- `ConfigModule env validation > OPENAI_API_KEY 누락 시 모듈 컴파일 실패`
- `ConfigModule env validation > OPENAI_API_KEY 있으면 정상 컴파일 + 기본값 적용`
- `HealthController (e2e) > /health (GET) returns ok payload`

## 3. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/src/config/env.schema.ts` | joi 검증 스키마 (PORT, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TIMEOUT_MS) |
| `rhwp-agent-server/test/setup-env.ts` | jest setupFiles — NODE_ENV='test' + OPENAI_API_KEY 기본값 |
| `rhwp-agent-server/test/config.e2e-spec.ts` | env 검증 e2e 자동 테스트 (2건) |

### 수정

| 경로 | 변경 |
|------|------|
| `rhwp-agent-server/src/app.module.ts` | ConfigModule 등록 + `ignoreEnvFile: NODE_ENV==='test'` 분기 |
| `rhwp-agent-server/.env.example` | OPENAI_MODEL=gpt-5.4, OPENAI_TIMEOUT_MS=30000 추가 |
| `rhwp-agent-server/test/jest-e2e.json` | `setupFiles` 등록 |
| `rhwp-agent-server/package.json`/`package-lock.json` | 14 packages 추가 |

## 4. 계획 대비 편차 (Deviations)

### 4.1 ConfigModule.forRoot 모듈 평가 캐싱 (계획 외 발견)

- **현상**: AppModule 을 import 한 첫 시점에 `ConfigModule.forRoot({...})` 가 한 번 평가되어 결과 DynamicModule 가 캐싱됨. 이후 테스트에서 `delete process.env.OPENAI_API_KEY` 후 다시 compile 해도 *재검증되지 않음* (이미 'sk-test' 로 통과 결과).
- **원인 분석**: 첫 모듈 평가 시점이 `import { AppModule } from ...` 줄이며, 이는 jest setupFiles(`process.env.OPENAI_API_KEY = 'sk-test'`) 실행 *직후* 발생. 따라서 캐싱된 결과가 항상 통과 상태.
- **해결**: 본 스펙에서만 ConfigModule 을 인라인으로 매번 새로 구성. AppModule 의 ConfigModule.forRoot 자체 검증은 다른 스펙(`HealthController e2e`)에서 부팅 정상 여부로 간접 검증됨.
- **반영**: `test/config.e2e-spec.ts` 에 인라인 buildModule() 헬퍼 + 명시적 주석으로 이유 기록.
- **재검토**: AppModule 자체의 ConfigModule 동작 검증이 필요해지면 jest.resetModules + dynamic import 패턴으로 별도 스펙 추가 가능. 본 task 범위 외.

### 4.2 setup-env.ts 신규 추가 (구현계획서 §1.x 에 미명시)

- **이유**: e2e 테스트 디렉터리(rhwp-agent-server) 내부에 `.env` 파일이 존재(Stage 3 #1에서 cp). 이 파일의 빈 `OPENAI_API_KEY=` 가 process.env 의 delete 를 덮어쓰는 경합 발생.
- **해결**:
  - `setup-env.ts` 에서 NODE_ENV='test' 강제 설정
  - AppModule 의 ConfigModule.forRoot 에 `ignoreEnvFile: NODE_ENV==='test'` 분기
- **이득**: 테스트 환경에서 .env 파일 영향 격리. production 동작은 그대로.
- **반영**: 본 보고서 + 구현계획서 다음 task 작성 시 setup-env 패턴을 보일러플레이트 항목으로 미리 포함 권장 (R-002 Fork 셋업 사전 단계 정식화 시 추가 항목).

### 4.3 R-007 적용 결과 (도구 버전 명시 방식)

수행계획서 §4 에서 *"`openai` npm 안정 채널 (`@latest` 또는 `^x.y` 잠금)"* 처럼 *제약*으로 명시. 실제 설치된 v6.35.0 / v4.0.4 / v18.1.2 모두 안정 채널 → **deviation 0**. 본 회귀가 R-007 가설(*도구 버전 제약화 → deviation ↓*) 의 첫 실측 결과이며, **#1 의 Stage 1 (Node 22 / NestJS 11 deviation 2건)** 대비 차이 명확.

## 5. 검증 방법 (재현)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/rhwp-agent-server

npm install                 # 14 packages 추가 (openai, @nestjs/config, joi 포함)
npm run build               # exit 0
npm run test:e2e            # 3 passed
```

## 6. 다음 단계 — Stage 2 진입 체크리스트

- [ ] Stage 1 보고서 승인
- [ ] OpenAI SDK 모킹 디자인 합의 (jest 수동 모킹 — R-3 결정 그대로)
- [ ] ChatService 인터페이스 합의 (`complete(messages) → ChatMessage` — R-4 결정 그대로)

## 7. 방법론 평가 메모

### 7.1 R-007/R-008/R-009 첫 실측 (1/3)

| 가설 | Stage 1 결과 |
|------|------------|
| **R-007** (도구 버전 제약화 → deviation ↓) | 의존성 3개 모두 deviation 0. #1 Stage 1 (Node/NestJS deviation 2건) 대비 개선. **가설 부분 입증** |
| **R-008** (자동 테스트로 manual 검증 ↓) | Stage 1 종료 체크 5건 모두 자동 명령으로 충족. 작업지시자 manual curl 0회. **가설 입증** |
| **R-009** (수치형 + 오차 → deviation 분류 명확화) | Stage 1 의 명시 수치 제약 없음(시간만, 30 ± 15분 → 실제 약 35분). **가설 미적용** (Stage 2/3 에서 실측) |

### 7.2 계획 외 발견 2건의 본질

발견 1 (ConfigModule 캐싱) + 발견 2 (.env 파일 경합) 모두 *NestJS @nestjs/config 의 동작 특성* 또는 *#1 의 Stage 3 잔재 (.env 파일)* 에서 비롯. 즉 외부 도구·이전 단계 산출물의 영향. 본 task 의 절차 문제는 아니나, 다음 deviation 패턴이 관찰됨:

> *"여러 이전 task 의 산출물이 누적된 상태에서 첫 통합 테스트를 작성하면 예측하지 못한 경합 발견"*

R-002 (Fork 셋업 사전 단계) 또는 R-011 후보 (*"task 시작 시 누적 환경 정합성 점검"*) 로 정식화 후보. 본 task 종료 시 검토.

### 7.3 본 stage 의 시간 실측 (R-009 첫 적용)

- **계획**: 30 ± 15분 (15~45분)
- **실제**: 약 35분 (R-2 결정 5분 + 의존성·코드 15분 + 캐싱 디버그 15분)
- **분석**: 계획 범위 안. 캐싱 디버그가 *예상하지 못한 의존성 동작*에서 시간을 잡았으나 R-009 의 ±15분 허용 오차 안에 들어감. **가설 부분 입증** (오차 범위가 deviation 분류에 도움).
