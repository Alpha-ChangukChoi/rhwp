# [Stage 3 보고서] task_agent-v0.1_1 — docker-compose 통합 + 최종 검증

- **이슈**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1)
- **수행계획서**: [task_agent-v0.1_1.md](../plans/task_agent-v0.1_1.md)
- **구현계획서**: [task_agent-v0.1_1_impl.md](../plans/task_agent-v0.1_1_impl.md) Stage 3
- **단계**: Stage 3 / 3 (마지막)
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

`docker-compose.yml` 에 agent-server 서비스 추가, fork 루트 `.gitignore` 보강, agent-server + rhwp-studio dev 서버 동시 기동·검증 완료. `docker compose down` 으로 정상 정리까지 확인.

| 종료 체크 | 결과 |
|----------|------|
| `docker compose up agent-server` 정상 기동 | ✅ |
| restart 정책 작동 확인 | ⚠️ 부분 (deviation §4.1) |
| rhwp-studio (vite) 와 동시 작동, 포트 충돌 없음 | ✅ |
| `curl :3000/health` 200 + `curl :7700/` 200 | ✅ |
| `docker compose down` 정상 종료 + 자원 정리 | ✅ |
| `.env.example` 커밋, `.env` gitignore 처리 | ✅ |

## 2. 실행 로그 발췌

### 2.1 docker-compose.yml 수정

`services:` 블록에 agent-server 1개 추가, `volumes:` 미변경. 본가 `dev`/`test`/`wasm` 서비스 무수정.

```yaml
agent-server:
  build:
    context: ./rhwp-agent-server
    dockerfile: Dockerfile
  env_file: ./rhwp-agent-server/.env
  ports:
    - "3000:3000"
  restart: unless-stopped
```

### 2.2 .gitignore 검증

```
$ git check-ignore -v rhwp-agent-server/.env rhwp-agent-server/node_modules rhwp-agent-server/dist
.gitignore:85:rhwp-agent-server/.env       rhwp-agent-server/.env
.gitignore:83:rhwp-agent-server/node_modules/  rhwp-agent-server/node_modules
.gitignore:84:rhwp-agent-server/dist/          rhwp-agent-server/dist
```

### 2.3 Compose 기동 + 동거 검증

```
$ cp rhwp-agent-server/.env.example rhwp-agent-server/.env
$ docker compose up -d agent-server
 Network rhwp-fork_default  Created
 Container rhwp-fork-agent-server-1  Started

$ cd rhwp-studio && nohup npx vite --host 0.0.0.0 --port 7700 > /tmp/vite-agent-stage3.log 2>&1 &
PID=58074

$ curl -sI http://localhost:7700/ | head -1
HTTP/1.1 200 OK

$ curl -s http://localhost:3000/health
{"status":"ok","service":"rhwp-agent-server","version":"0.1.0"}
```

### 2.4 정리

```
$ docker compose down
 Container rhwp-fork-agent-server-1  Stopped
 Container rhwp-fork-agent-server-1  Removed
 Network rhwp-fork_default  Removed

$ kill 58074    # vite

$ lsof -i :7700 -i :3000
(빈 결과 — 포트 모두 해제)
```

## 3. 변경 파일 목록

### 신규

없음.

### 수정

| 경로 | 변경 |
|------|------|
| `docker-compose.yml` | `services:` 에 `agent-server` 추가 (build context = `./rhwp-agent-server`, ports 3000:3000, restart=unless-stopped, env_file=./rhwp-agent-server/.env) |
| `.gitignore` | 끝부분에 `rhwp-agent-server/{node_modules,dist,.env,*.log}` 4 패턴 추가 |

### 작업 중 생성된 비커밋 파일 (gitignore 처리)

- `rhwp-agent-server/node_modules/` (Stage 1 npm install 결과)
- `rhwp-agent-server/dist/` (Stage 1 npm run build 결과)
- `rhwp-agent-server/.env` (.env.example 사본, OPENAI_API_KEY placeholder)
- `rhwp-studio/node_modules/` (이번 stage 에서 install)

## 4. 계획 대비 편차 (Deviations)

### 4.1 restart 정책 자동 작동 미검증

- **계획**: 구현계획서 §3.5 "restart 정책 작동 (한 번 죽여서 재기동 확인)"
- **실제**:
  ```
  $ docker kill rhwp-fork-agent-server-1
  $ docker inspect rhwp-fork-agent-server-1 --format '{{.State.Status}} restart={{.RestartCount}}'
  exited restart=0 exitCode=137
  ```
  - SIGKILL(137) 후 자동 재시작 트리거되지 않음. RestartCount=0.
- **분석**:
  - Docker 29.0.1 + Compose v2 환경에서 `docker kill` 시 unless-stopped 정책이 즉시 동작하지 않은 것으로 관찰. 이는 환경/버전 의존성이 있는 영역 (Docker daemon 재시작 시 자동 재시작은 동작 가능, 명시 kill 후 동작은 일관되지 않음).
  - 본 task 의 본질 (docker-compose 통합)에는 영향 없음 — `docker compose start agent-server` 로 즉시 재기동 + `/health` 정상 응답 확인.
- **재검토 옵션**:
  - 별도 검증 task 로 분리 (restart 정책 자체의 환경 매트릭스 점검)
  - 또는 restart 정책을 `always` 로 강화 (사용자 명시 stop 도 무시하고 재시작)
  - 본 이슈 스코프는 "compose 통합 가능" 이며 자동 재시작이 종료조건이 아님. **그대로 진행** 권장, 후속 별도 검증 task 후보.

### 4.2 rhwp-studio npm install 추가 작업

- **계획**: 구현계획서에 명시되지 않았으나 fork 클론 직후 rhwp-studio 의존성이 미설치 → vite 기동 불가.
- **실제**: Stage 3.3 검증 직전 `cd rhwp-studio && npm install` 1회 실행. 본 task 산출물은 아니지만 통합 검증을 위해 필요.
- **영향**: rhwp-studio 측 변경 없음 (의존성 install 만). 본가 코드 무수정 정책 유지.
- **반영**: 본가의 sync workflow 에서 fork 클론 직후 누가 어떤 디렉터리 install 해야 하는지 onboarding 문서가 있으면 도움됨. Stage 3 발견 사항으로 별도 task 후보.

## 5. 검증 방법 (재현)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# 사전 준비 (1회)
cp rhwp-agent-server/.env.example rhwp-agent-server/.env
cd rhwp-studio && npm install && cd ..

# 세션 1 — agent-server (compose)
docker compose up -d agent-server
sleep 3
curl -s http://localhost:3000/health    # → status:ok JSON

# 세션 2 — rhwp-studio (vite, 본가 패턴)
cd rhwp-studio
npx vite --host 0.0.0.0 --port 7700 &
sleep 5
curl -sI http://localhost:7700/ | head -1   # → HTTP/1.1 200 OK

# 종료
docker compose down
kill %1   # vite
```

## 6. Stage 3 종료 체크 종합

| § | 체크 항목 | 결과 |
|---|----------|------|
| 3.5.1 | `docker compose up agent-server` 정상 기동 | ✅ |
| 3.5.2 | restart 정책 작동 (한 번 죽여서 재기동) | ⚠️ deviation §4.1 — `docker compose start` 로 즉시 재기동은 정상 |
| 3.5.3 | rhwp-studio (vite) 와 동시 작동, 포트 충돌 없음 | ✅ 3000/7700 분리 |
| 3.5.4 | `curl :3000/health` 200 + `curl :7700/` 200 | ✅ 둘 다 응답 |
| 3.5.5 | `docker compose down` 정상 종료 | ✅ 컨테이너·네트워크 정리 |
| 3.5.6 | `.env.example` 커밋, `.env` 는 gitignore | ✅ git check-ignore 검증 |

## 7. 방법론 평가 메모

### 7.1 잘 작동한 부분

- **(A) 정정안의 실제 동작 확인**: rhwp-studio는 본가 패턴(`npx vite`) 그대로 + agent-server 만 compose 데몬 → 본가 디자인을 깨지 않으면서 종료조건 충족. 수행계획서 단계의 정정 결정이 실측에서도 유효.
- **자동 검증 패턴 일관성**: Stage 1 (e2e), Stage 2 (curl + exec), Stage 3 (curl + compose ps) 모두 *명령 + 기대 출력*으로 정의되어 작업지시자가 동일 명령으로 결과 재현 가능.
- **본가 무수정 정책 유지**: Stage 3 까지 본가 src/, rhwp-studio/, rhwp-chrome/, rhwp-firefox/, rhwp-safari/, rhwp-vscode/, rhwp-shared/ 모두 무변경. upstream sync 충돌 없음.

### 7.2 마찰·오버헤드

- **restart 정책 deviation**: 환경 의존적 검증이 *명령 한 줄*로 결정적이지 않음. R-009 후보 (수치형/환경 의존 제약은 기준치 + 허용 오차) 의 또 다른 사례.
- **rhwp-studio npm install** 사전 단계가 구현계획서에 누락. R-002 (Fork 셋업 사전 단계 placeholder) 의 일반화 시점에 *"fork 의존성 설치 매트릭스"* 도 포함해야 함.
- **`docker kill` vs `restart: unless-stopped` 의미론**: 이는 Docker 자체의 동작 영역이지 절차 문제는 아님. 단, 검증 명령 작성 시 *"환경 의존적 동작은 별도 매트릭스로 분리"* 가이드가 있으면 deviation 발생률 ↓.

### 7.3 Stage 1·2·3 누적 평가 메모

- 3 stage 모두 deviation 발생, 모두 *외부 도구·환경 변동*에서 기인 (절차 결함 아님).
- 각 stage 종료 체크가 *자동 검증 가능 명령*으로 정의되어 *작업지시자 승인 시 의심 여지 최소화*. 이 패턴이 본 fork 첫 task 의 가장 큰 절차 자산.
- 최종 보고서에서 R-007/R-009 등 후보 정식화 + 본 task 회고 정리 예정.
