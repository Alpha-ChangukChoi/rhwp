# [Stage 2 보고서] task_agent-v0.1_1 — Multi-stage Dockerfile + 단독 검증

- **이슈**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1)
- **수행계획서**: [task_agent-v0.1_1.md](../plans/task_agent-v0.1_1.md)
- **구현계획서**: [task_agent-v0.1_1_impl.md](../plans/task_agent-v0.1_1_impl.md) Stage 2
- **단계**: Stage 2 / 3
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

Multi-stage Dockerfile + .dockerignore 작성, 이미지 빌드, 단독 컨테이너 실행 + `/health` 응답 검증, non-root 사용자 확인, 정상 종료 + auto cleanup 까지 완료.

| 종료 체크 | 결과 |
|----------|------|
| `docker build` 성공 | ✅ |
| 이미지 크기 200MB 이하 권장 | ⚠️ 255MB (deviation, 보고서 §4.1) |
| 컨테이너 기동 직후 `/health` 200 OK | ✅ |
| non-root 유저 (`node`) 실행 | ✅ |
| `docker stop` 정상 종료 + cleanup | ✅ |

## 2. 실행 로그 발췌

### 2.1 환경 점검

```
$ docker --version
Docker version 29.0.1, build eedd969
$ docker buildx version
github.com/docker/buildx v0.29.1-desktop.1 28f6246ff24...
```

### 2.2 이미지 빌드 (§2.3)

```
$ docker build -t rhwp-agent-server:dev .
...
#15 exporting manifest list sha256:9ffb2b186e8a... done
#15 unpacking to docker.io/library/rhwp-agent-server:dev done
#15 DONE 0.8s

$ docker images rhwp-agent-server:dev --format '{{.Repository}}:{{.Tag}} size={{.Size}}'
rhwp-agent-server:dev size=255MB
```

### 2.3 컨테이너 기동 + 응답 검증

```
$ docker run --rm -d -p 3000:3000 --name rhwp-agent-test rhwp-agent-server:dev
da6505cb5f547418f708af9c7ea28b271233ca91c47e9fa791ce36875221fa62

$ curl -s http://localhost:3000/health
{"status":"ok","service":"rhwp-agent-server","version":"0.1.0"}

$ docker exec rhwp-agent-test whoami
node

$ docker logs rhwp-agent-test
[Nest] 1 - 04/30/2026  LOG [NestFactory] Starting Nest application...
[Nest] 1 - 04/30/2026  LOG [InstanceLoader] AppModule dependencies initialized +7ms
[Nest] 1 - 04/30/2026  LOG [RoutesResolver] HealthController {/health}: +3ms
[Nest] 1 - 04/30/2026  LOG [RouterExplorer] Mapped {/health, GET} route +1ms
[Nest] 1 - 04/30/2026  LOG [NestApplication] Nest application successfully started +2ms
```

### 2.4 종료 처리

```
$ docker stop rhwp-agent-test
rhwp-agent-test

$ docker ps -a --filter name=rhwp-agent-test
CONTAINER ID  IMAGE  COMMAND  CREATED  STATUS  PORTS  NAMES
(빈 결과 — --rm 플래그로 자동 제거됨)
```

## 3. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/Dockerfile` | multi-stage 빌드 (builder → slim runtime, USER node) |
| `rhwp-agent-server/.dockerignore` | 빌드 컨텍스트 축소 (node_modules, dist, .env, *.log 등) |

### 수정

없음.

## 4. 계획 대비 편차 (Deviations)

### 4.1 이미지 크기: 200MB 권장 → 실제 255MB

- **계획**: 구현계획서 §2.4 "이미지 크기 200MB 이하 권장"
- **실제**: 255MB (약 27% 초과)
- **원인 분석**:
  - `node:22-alpine` 베이스 ~145MB
  - production node_modules ~100MB (NestJS + Express + 의존 트리)
  - 어플리케이션 dist ~수 KB
- **영향**: 기능적 영향 없음. 컨테이너 풀·푸시 속도, 디스크 사용량에 미미한 영향.
- **재검토 옵션** (본 이슈 스코프 외, 후속 최적화 후보):
  - `npm ci --omit=dev --omit=optional` 추가
  - `node:22-alpine` → `gcr.io/distroless/nodejs22-debian12` (~50MB 감소)
  - dependencies 감사 (`npm-check-unused`)
  - 후속 이슈 또는 별도 최적화 task 로 분리 권장. 본 task 종료 조건은 "기동·응답·이미지 빌드 가능"이며 크기 한도는 권장이지 강제가 아님.

### 4.2 Node.js 버전 (Stage 1 deviation 4.1 의 연속)

- Dockerfile 베이스 이미지: `node:20-alpine` → **`node:22-alpine`**
- Stage 1 의 `.nvmrc` 22 와 일관성 유지를 위함.
- 별도 신규 deviation 아님.

## 5. 검증 방법

작업지시자가 동일 결과를 재현하려면 fork 디렉터리에서:

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/rhwp-agent-server

# 빌드
docker build -t rhwp-agent-server:dev .

# 기동 + 검증
docker run --rm -d -p 3000:3000 --name rhwp-agent-test rhwp-agent-server:dev
sleep 3
curl -s http://localhost:3000/health | jq .
# → { "status": "ok", "service": "rhwp-agent-server", "version": "0.1.0" }

docker exec rhwp-agent-test whoami      # → node

# 정리
docker stop rhwp-agent-test
docker ps -a --filter name=rhwp-agent-test    # 빈 결과
```

## 6. 다음 단계 — Stage 3 진입 체크리스트

- [ ] Stage 2 보고서 승인
- [ ] 본가 `docker-compose.yml` 무수정 정책 재확인 (수정은 services 추가만)
- [ ] rhwp-studio dev 서버 동작 (`npx vite --host 0.0.0.0 --port 7700`) 가능 여부 확인 (필요 시 사용자 환경 점검)

## 7. 방법론 평가 메모

### 7.1 잘 작동한 부분

- **multi-stage 패턴**: builder 단계에서 devDependencies + 빌드 도구가 모두 격리되어 runtime 이미지에 누출되지 않음. `npm prune --omit=dev` 까지 builder 단계에서 실행해 최종 이미지 깔끔.
- **즉시 검증 사이클**: build → run → curl → exec whoami → stop 을 한 단계에서 끝까지 돌려 *문제가 있다면 stage 종료 전에 노출됨*. 작업지시자 승인 시점에는 의심 여지가 거의 없는 상태.
- **비결정적 결과 기록**: "Dead" 상태가 일시적으로 잡혔다가 정리됨 → 보고서에 명시해 작업지시자가 동일 현상 만났을 때 당황하지 않게 함.

### 7.2 마찰·오버헤드

- **이미지 크기 권장치(200MB)** 가 *경험적 추정*에 가까웠음. NestJS 11 + Express 5 + 의존 트리에 대한 실측 자료가 없는 상태에서 임의로 정한 한도라 deviation 발생률이 높음.
  - **R-009 후보**: *수치형 제약(이미지 크기·빌드 시간 등)은 기준치 + 허용 오차*로 정의하고, 첫 실측 후 보정 가능하게 명시.
- **"Dead" 일시 상태** 같은 *컨테이너 런타임의 사소한 비결정성* 이 자동화 검증 신뢰도에 영향. 단일 명령 검증보다는 *재시도 또는 sleep 보정 포함된 검증 스크립트* 도입이 향후 안정성 ↑.

### 7.3 Stage 1·2 누적 평가 메모

- 자동 검증(e2e 테스트 + curl 단 한 번) 패턴이 *작업지시자 승인 사이클의 의심 여지를 줄이는 데* 효과적. Stage 3 에서도 compose up + curl 자동 스크립트 형태 유지 권장.
- 두 stage 모두 deviation 발생(Stage 1: Node/NestJS 버전, Stage 2: 이미지 크기). 모두 *외부 도구·생태계 변화 또는 임의 추정*에서 발생. 절차 문제가 아니라 계획의 *고정값 해상도*가 너무 높았던 것이 공통 원인. 최종 보고서에서 R-007/R-009 후보 정식화 검토.
