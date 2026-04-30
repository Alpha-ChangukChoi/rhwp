# [구현계획서] task_agent-v0.1_1 — NestJS agent-server 스켈레톤 + docker-compose 통합

- **이슈**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1)
- **수행계획서**: [task_agent-v0.1_1.md](./task_agent-v0.1_1.md) (작업지시자 승인 완료, 2026-04-30)
- **브랜치**: `local/task1`
- **단계 수**: 3 (본가 절차 최소치)
- **작업 위치**: `/Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/`

---

## 단계 분할 원칙

각 stage 는 독립적으로 검증 가능한 종료 상태를 가진다. 즉 *Stage N 완료 후 Stage N+1 시작 전*에 작업지시자 승인 게이트가 있고, 그 시점에 **검증 명령으로 Stage N의 결과물을 확인**할 수 있어야 한다.

Stage 간 의존:

```
Stage 1: 코드 (npm run start 로 검증)
   ↓
Stage 2: 컨테이너 단독 (docker run 으로 검증)
   ↓
Stage 3: compose 통합 + rhwp-studio 동거 (실제 종료 조건 검증)
```

---

## Stage 1 — NestJS 프로젝트 스캐폴드 + /health 엔드포인트

### 1.0 사전 점검 (R-9)

```bash
node --version    # >= 20.x 필요
npm --version
```

미설치 시:
1. nvm 설치: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
2. 새 터미널 후: `nvm install 20 && nvm use 20`

### 1.1 NestJS CLI 로 프로젝트 생성

fork 디렉터리에서 실행 (rhwp-agent-server 폴더는 명령이 자동 생성).

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
npx @nestjs/cli@latest new rhwp-agent-server \
    --package-manager npm \
    --skip-git \
    --skip-install
cd rhwp-agent-server
npm install
```

`--skip-git`: fork 의 git 을 그대로 사용 (별도 저장소 만들지 않음)
`--skip-install`: install 은 별도 단계에서 (실패 시 진단 용이)

### 1.2 보일러플레이트 정리

NestJS CLI 가 생성한 기본 Hello World 파일들을 제거하고 health 엔드포인트로 교체.

**삭제**:
- `src/app.controller.ts`
- `src/app.controller.spec.ts`
- `src/app.service.ts`

**유지·수정**: `src/app.module.ts`, `src/main.ts`

### 1.3 Health 컨트롤러 작성

**경로**: `rhwp-agent-server/src/health/health.controller.ts`

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'rhwp-agent-server',
      version: '0.1.0',
    };
  }
}
```

### 1.4 AppModule 수정

**경로**: `rhwp-agent-server/src/app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

### 1.5 main.ts — PORT 환경변수 지원

**경로**: `rhwp-agent-server/src/main.ts`

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`rhwp-agent-server listening on :${port}`);
}
bootstrap();
```

### 1.6 환경 파일

**경로**: `rhwp-agent-server/.nvmrc`
```
20
```

**경로**: `rhwp-agent-server/.env.example`
```
# rhwp-agent-server 환경변수 템플릿
# 사용법: cp .env.example .env 후 값 채우기

PORT=3000

# OpenAI (다음 이슈에서 사용)
OPENAI_API_KEY=
```

### 1.7 검증

```bash
cd rhwp-agent-server
npm run build               # 빌드 무에러
npm run start &             # 백그라운드 기동
sleep 3
curl -s http://localhost:3000/health | jq .
# 기대 출력:
# {
#   "status": "ok",
#   "service": "rhwp-agent-server",
#   "version": "0.1.0"
# }
kill %1                     # 백그라운드 프로세스 종료
```

### 1.8 Stage 1 종료 체크

- [ ] `node --version` ≥ 20
- [ ] `npm run build` exit 0
- [ ] `curl :3000/health` JSON 정확히 일치 (status / service / version 3개 필드)
- [ ] 보일러플레이트 파일 3개 삭제 확인

### 1.9 Stage 1 보고서

**경로**: `mydocs/working/task_agent-v0.1_1_stage1.md`

내용 항목:
1. 실행 명령 + 출력 로그 발췌
2. 생성·삭제된 파일 목록
3. 검증 결과 (체크박스)
4. 발생한 문제·해결
5. 방법론 평가 메모 (이 stage 가 도움됐는지/오버헤드였는지)

---

## Stage 2 — Multi-stage Dockerfile + 단독 검증

### 2.1 Dockerfile 작성

**경로**: `rhwp-agent-server/Dockerfile`

```dockerfile
# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER node
EXPOSE 3000

CMD ["node", "dist/main"]
```

### 2.2 .dockerignore 작성

**경로**: `rhwp-agent-server/.dockerignore`

```
node_modules
dist
.env
.env.*
!.env.example
*.log
.DS_Store
.vscode
.idea
```

### 2.3 단독 빌드·실행 검증

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/rhwp-agent-server

docker build -t rhwp-agent-server:dev .
docker run --rm -d -p 3000:3000 --name rhwp-agent-test rhwp-agent-server:dev
sleep 3
curl -s http://localhost:3000/health | jq .
# 기대: Stage 1.7 과 동일 JSON
docker stop rhwp-agent-test
```

### 2.4 Stage 2 종료 체크

- [ ] `docker build` 성공 (이미지 크기 200MB 이하 권장 — node:20-alpine + production deps 만)
- [ ] 컨테이너 기동 직후 `/health` 200 OK
- [ ] `docker stop` 정상 종료 (SIGTERM 처리)
- [ ] non-root 유저(`node`)로 실행됨 (`docker exec rhwp-agent-test whoami` → `node`)

### 2.5 Stage 2 보고서

**경로**: `mydocs/working/task_agent-v0.1_1_stage2.md`

내용 항목:
1. 이미지 크기 측정 결과
2. 빌드·실행 로그 발췌
3. 검증 결과
4. 보안 점검 (USER node, 노출 포트, .env 누락 여부)
5. 방법론 평가 메모

---

## Stage 3 — docker-compose 통합 + 최종 검증 + 문서 정리

### 3.1 docker-compose.yml 수정

**경로**: `docker-compose.yml` (fork 루트)

기존 services(`dev`/`test`/`wasm`) 끝에 `agent-server` 추가, volumes 변경 없음.

```yaml
services:
  dev:
    # ... (기존 그대로)
  test:
    # ... (기존 그대로)
  wasm:
    # ... (기존 그대로)

  agent-server:
    build:
      context: ./rhwp-agent-server
      dockerfile: Dockerfile
    env_file: ./rhwp-agent-server/.env
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  cargo-cache:
  cargo-bin:
  wasm-pack-cache:
```

`.env` 파일이 없으면 `env_file` 이 실패하므로 `.env.example` 을 복사하라는 안내가 필요 — README 또는 onboarding 문서에 명시.

### 3.2 .gitignore 보강

**경로**: `.gitignore` (fork 루트)

본가 `.gitignore` 끝에 다음 블록 추가:

```
# rhwp-agent-server (fork 전용)
rhwp-agent-server/node_modules/
rhwp-agent-server/dist/
rhwp-agent-server/.env
rhwp-agent-server/*.log
```

### 3.3 통합 검증

준비:
```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
cp rhwp-agent-server/.env.example rhwp-agent-server/.env
```

세션 1 — agent-server 기동:
```bash
docker compose up --build agent-server
```

세션 2 — rhwp-studio 기동 (본가 패턴):
```bash
cd rhwp-studio
npx vite --host 0.0.0.0 --port 7700
```

세션 3 — 검증:
```bash
curl -s http://localhost:3000/health | jq .   # agent-server 응답
curl -sI http://localhost:7700/ | head -1     # vite HTTP 200 OK
```

### 3.4 종료 처리 검증

```bash
# 세션 1 에서 Ctrl+C 또는:
docker compose down agent-server
# 세션 2 에서 Ctrl+C
```

종료 후 `docker ps -a | grep agent-server` 컨테이너 정리됨 확인.

### 3.5 Stage 3 종료 체크

- [ ] `docker compose up agent-server` 정상 기동, restart 정책 작동 (한 번 죽여서 재기동 확인)
- [ ] rhwp-studio (`npx vite`) 와 동시 작동, 포트 충돌 없음
- [ ] `curl :3000/health` 200 OK, `curl :7700/` 200 OK
- [ ] `docker compose down` 정상 종료
- [ ] `.env.example` 만 커밋, `.env` 는 .gitignore 처리됨 확인 (`git check-ignore rhwp-agent-server/.env`)

### 3.6 Stage 3 보고서

**경로**: `mydocs/working/task_agent-v0.1_1_stage3.md`

내용 항목:
1. compose up 로그 발췌
2. 동시 기동 검증 결과
3. 재시작 정책 검증
4. 본가 docker-compose 디자인 정합성 평가
5. 방법론 평가 메모

### 3.7 최종 보고서

**경로**: `mydocs/report/task_agent-v0.1_1_report.md`

내용 항목:
1. **요약** — 이슈 종료 조건 4개 모두 충족 여부
2. **변경 파일 목록** — diff 통계
3. **검증 결과** — Stage 1·2·3 종료 체크 통합
4. **결정 추적** — 수행계획서 §6 R-1~R-10 의 실제 적용 결과
5. **회고** — 예상 대비 실제 소요·예상 못 한 발견·재작업 횟수
6. **방법론 평가** — fork 절차 첫 적용 회고
   - R-001 (이슈등록 미니사이클) 효과
   - R-002 (Fork 셋업 사전 단계) 회고로 정식화 가능 여부
   - R-003~R-005 신규 후보 정리
7. **다음 이슈 후보** — agent-v0.1 마일스톤의 다음 단계 (OpenAI 호출 / hwpctl tool 매핑 / 사이드바 UI)

### 3.8 커밋 전략

본가 [CLAUDE.md](../../CLAUDE.md) 절차대로 단계별 보고서는 해당 단계 소스 커밋과 함께 커밋한다. 즉:

- 커밋 1: Stage 1 코드 + `task_agent-v0.1_1_stage1.md`
- 커밋 2: Stage 2 코드 + `task_agent-v0.1_1_stage2.md`
- 커밋 3: Stage 3 코드 + `task_agent-v0.1_1_stage3.md`
- 커밋 4: 최종 보고서 + (필요 시) orders 갱신

수행계획서·구현계획서는 첫 커밋(Stage 1)에 포함.

커밋 메시지 패턴: `Task #1: <단계 요약>`

---

## 의존성·전제

| 항목 | 상태 | 비고 |
|------|------|------|
| Node.js 20.x | 사용자 점검 필요 (R-9) | Stage 1.0 |
| Docker (compose v2) | 본가 사용 중 | 변경 없음 |
| GitHub Issue #1 | 등록 완료 | |
| `local/task1` 브랜치 | 생성 완료 | |
| 본가 `docker-compose.yml` | 무수정 정책 — `agent-server` service 만 추가 | R-10 |

## 리스크 (Stage 1 시작 직전)

- **Node.js 미설치**: 사용자가 점검 결과 미공유. nvm 설치 분기 가능성.
- **NestJS CLI 네트워크**: `npx @nestjs/cli@latest new` 가 npm registry 접근. 사내망/방화벽 환경이면 실패 가능 — 발생 시 사용자 환경 확인 후 대응.
- **Docker 데몬 상태**: 사용자 로컬 Docker Desktop 미실행이면 Stage 2~3 실패. 검증 단계에서 명시적으로 확인.

---

## 방법론 평가 메모 (구현계획서 차원)

- **수행계획서 ↔ 구현계획서 경계**: 수행계획서는 *Why·What·결정 항목*, 구현계획서는 *How·검증 명령·파일 내용 단위* 로 정리해 중복을 줄였다. 이 경계가 안정적이면 R-003 으로 정식화 후보.
- **Stage 검증 명령의 구체성**: 각 stage 종료 체크에 *실행 가능한 명령*과 *기대 출력*을 두어, 작업지시자가 동일 명령으로 결과를 검증할 수 있게 했다. 이 패턴이 잘 작동하면 R-004 후보.
- **R-10 (docker-compose 정합)** 이 *수행계획서 §6 작성 후 구현계획서 작성 전 사이*에 발견되었음. 수행계획서 단계에 "기존 인프라·디자인 사전 분석" 의무 항목을 추가하면 발견을 앞당길 수 있다 — R-005 후보로 메모.
