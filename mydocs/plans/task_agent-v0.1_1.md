# [수행계획서] task_agent-v0.1_1 — NestJS agent-server 스켈레톤 + docker-compose 통합

- **이슈**: [#1 — NestJS agent-server 스켈레톤 + docker-compose 통합](https://github.com/Alpha-ChangukChoi/rhwp/issues/1)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task1`
- **작성일**: 2026-04-30
- **방법론 근거**: 본가 [CLAUDE.md](../../CLAUDE.md) 타스크 진행 절차 3단계 + fork [methodology_refinements.md](../manual/methodology_refinements.md) R-001

---

## 1. 목적 / 배경

rhwp 프로젝트에 **OpenAI 기반 멀티턴 에이전트로 HWP 문서를 편집**하는 기능을 추가하기 위한 백엔드 인프라의 첫 단추를 만든다.

본 작업은 후속 이슈에서 다룰 다음 항목들의 토대를 제공한다.
- OpenAI Chat Completions API 호출 + 도구(tool) 사용 루프
- hwpctl Action ↔ OpenAI tool 매핑 정의
- 멀티턴 세션 히스토리 관리
- rhwp-studio 사이드바 채팅 UI
- 백엔드 ↔ 프런트엔드 메시지·tool 호출 프로토콜

본 이슈에서는 **에이전트 로직은 다루지 않고** 인프라 골격(NestJS 프로젝트, 헬스체크, docker-compose 통합)까지만 완성한다. 이렇게 분리하는 이유는 (a) 인프라가 정상 동작하는 상태를 일찍 가시화하고, (b) 후속 작업에서 OpenAI 키나 멀티턴 세션 같은 본질적 결정에 집중하기 위함이다.

## 2. 종료 조건

> **[수정 2026-04-30]** 본가 `docker-compose.yml` 분석 결과, 본가는 일회성 빌드 컨테이너 패턴(`dev`/`test`/`wasm` 서비스가 `cargo build` 등 일회 실행) 이며 rhwp-studio dev 서버는 compose에 등록되지 않음. 따라서 이슈 본문의 *"compose 로 rhwp-studio + agent-server 동시 기동"* 을 본가 패턴에 맞춰 다음과 같이 재정의 (작업지시자 승인 완료 — 옵션 A).

- [ ] `docker compose up agent-server` 로 **agent-server 데몬 기동** (포그라운드 또는 `-d`)
- [ ] 별도 셸에서 rhwp-studio `npx vite --host 0.0.0.0 --port 7700` 기동 (본가 절차 그대로)
- [ ] 두 서비스 살아있는 상태에서 `curl http://localhost:3000/health` 응답 **200 OK**
- [ ] NestJS 빌드·의존성 정상 (`npm run build` 무에러)
- [ ] 수행계획서 / 구현계획서 / 단계별 보고서 / 최종 보고서 작성 완료

헬스체크 응답 본문 형식:

```json
{ "status": "ok", "service": "rhwp-agent-server", "version": "0.1.0" }
```

## 3. 영향 범위

| 종류 | 경로 | 변경 형태 |
|------|------|----------|
| 신규 디렉터리 | `rhwp-agent-server/` | 전체 신규 |
| 신규 | `rhwp-agent-server/package.json` | NestJS 의존성, 스크립트 |
| 신규 | `rhwp-agent-server/tsconfig*.json` | TypeScript 설정 |
| 신규 | `rhwp-agent-server/nest-cli.json` | NestJS CLI 설정 |
| 신규 | `rhwp-agent-server/src/main.ts` | 부트스트랩 |
| 신규 | `rhwp-agent-server/src/app.module.ts` | 루트 모듈 |
| 신규 | `rhwp-agent-server/src/health/health.controller.ts` | `/health` 엔드포인트 |
| 신규 | `rhwp-agent-server/Dockerfile` | 컨테이너 빌드 |
| 신규 | `rhwp-agent-server/.dockerignore` | 빌드 컨텍스트 축소 |
| 신규 | `rhwp-agent-server/.env.example` | 환경변수 템플릿 (`OPENAI_API_KEY=` placeholder) |
| 수정 | `docker-compose.yml` | `agent-server` 서비스 추가 (rhwp-studio와 함께 기동) |
| 수정 | `.gitignore` (선택) | `rhwp-agent-server/node_modules`, `dist`, `.env` 패턴 추가 |

본가 코드(`src/`, `rhwp-studio/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`)는 **수정하지 않는다**. upstream 동기화 충돌을 최소화하기 위함.

## 4. 외부 의존성

| 항목 | 버전 | 비고 |
|------|------|------|
| Node.js | 20.x LTS | NestJS 10 권장 |
| npm 또는 pnpm | npm 기본 | (rhwp-studio는 npm 사용 → 동일하게) |
| NestJS | 10.x 안정 | `@nestjs/cli`, `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` |
| TypeScript | 5.x | NestJS 10 호환 |
| Docker | 기존 사용 중 | 변경 없음 |
| docker-compose | 기존 사용 중 | 서비스 추가만 |

OpenAI SDK(`openai` npm package)는 **본 이슈에서 설치하지 않는다** (스코프 분리). 다음 이슈에서 도입.

## 5. 단계 분할 개요

상세는 구현계획서(`task_agent-v0.1_1_impl.md`)에서 3~6단계로 확정한다. 잠정 분할:

| Stage | 내용 | 검증 |
|-------|------|------|
| **Stage 1** | NestJS 프로젝트 스캐폴드 (`rhwp-agent-server/`), `/health` 엔드포인트 구현 | `npm run start` → `curl :<port>/health` 200 OK |
| **Stage 2** | Dockerfile + .dockerignore 작성, 단독 빌드·실행 검증 | `docker build` → `docker run` → `/health` 200 OK |
| **Stage 3** | docker-compose.yml 통합, rhwp-studio와 함께 기동 검증 + 최종 문서 정리 | `docker compose up` → 두 서비스 모두 기동, `/health` 200 OK |

3단계로 가는 것이 본가 절차의 최소(3단계)에 부합하면서 "코드 → 컨테이너 → 통합" 의 자연스러운 흐름을 따른다.

## 6. 리스크 / 미해결 결정사항

이 절은 구현계획서 확정 직전까지 작업지시자 결정을 받아야 한다. 각 항목별로 **추천안 + 이유**를 제시.

### R-1. 포트 번호
- **추천**: agent-server를 **3000번**으로 (NestJS 기본). rhwp-studio는 7700번이라 충돌 없음.
- 대안: 8787, 8080 등. 사용자 환경의 다른 서비스와 충돌이 우려되면 결정.

### R-2. 모노레포 구조
- **추천**: `rhwp-agent-server/` 자체 `package.json` 보유 (rhwp-studio와 동일 패턴). 루트 통합 X.
- 이유: 패키지 매니저 워크스페이스를 강제하지 않고, 추후 분리·이식 자유도 확보.

### R-3. NestJS 스캐폴드 방법
- **추천**: `npx @nestjs/cli@latest new rhwp-agent-server --package-manager npm --skip-git` 로 표준 템플릿 생성 → 불필요한 보일러플레이트만 정리.
- 이유: 직접 수동 구성 시 누락·오설정 위험. CLI 템플릿이 베스트 프랙티스 반영.

### R-4. 개발 모드 vs 프로덕션 모드
- **추천**: Dockerfile은 **multi-stage** 로 작성 (builder → slim runtime). 컴포즈는 일단 프로덕션 모드 1개. 개발 시 host watch는 다음 이슈에서 검토.
- 이유: 본 이슈는 인프라 검증이 목적. dev hot reload는 OpenAI 호출 작업할 때 본격적으로 필요해짐.

### R-5. .env 처리
- **추천**: `rhwp-agent-server/.env.example` 만 커밋, 실제 `.env` 는 사용자가 복사 + `OPENAI_API_KEY` 채움. `.env` 는 [.gitignore](.gitignore) 에 이미 등록되어 있음.
- 이유: 본가 패턴(`.env.docker.example`)과 일관성.

### R-6. 헬스체크 라이브러리
- **추천**: `@nestjs/terminus` **사용 안 함**. 단순 컨트롤러로 직접 구현.
- 이유: terminus는 DB·외부 의존성 헬스체크용. 현재는 외부 의존성 없음 → 과한 의존성. 후속 이슈에서 OpenAI 연결 헬스체크가 필요해지면 그때 도입.

### R-7. 노드 버전 핀
- **추천**: `rhwp-agent-server/.nvmrc` 에 `20` 명시. Dockerfile은 `node:20-alpine` 또는 `node:20-slim` 사용.
- 이유: 재현성. 사용자 로컬 노드 버전과 무관하게 동일 결과.

### R-8. Lint / Format 도구
- **추천**: NestJS CLI가 기본 제공하는 ESLint + Prettier 그대로 유지. 추가 커스텀 X.
- 이유: 본 이슈 스코프 외. 본가 rhwp-studio 와 분리된 패키지라 통합 lint 강제할 필요 없음.

### R-9. 사용자 로컬 Node.js 설치 상태
- 사용자는 이전에 `cargo: command not found` 가 발생했음. Node.js·npm 도 미설치일 가능성 있음.
- **추천**: Stage 1 시작 시 `node --version`, `npm --version` 확인. 미설치 시 nvm 또는 Node.js 공식 설치 안내.
- 본 작업은 Docker만으로도 가능하나 로컬 개발·디버깅 편의를 위해 권장.

### R-10. docker-compose 디자인 정합 [신규 2026-04-30]
- **발견**: 본가 `docker-compose.yml` 은 데몬 호스팅이 아니라 **일회성 빌드 컨테이너** 정의 (`dev`/`test`/`wasm` → `cargo build` 등 일회 실행). rhwp-studio 는 등록되지 않고 별도 `npx vite` 로 띄움.
- **결정 (옵션 A 승인)**: agent-server 만 docker-compose 에 데몬 서비스로 추가. rhwp-studio 는 본가 패턴대로 `npx vite` 별도 기동.
- **세부 사항**:
  - agent-server 빌드 컨텍스트: `./rhwp-agent-server` (본가 Dockerfile 과 분리)
  - `restart: unless-stopped` 적용 (개발 편의)
  - 본가 `.env.docker` 와 분리된 `rhwp-agent-server/.env` 사용
  - 종료 조건 §2 에 반영 완료

## 7. 일정 가이드

본가 절차상 단계별 승인 게이트가 있어 **소요 시간보다 승인 사이클**이 지배적이다.

| 단계 | 코드 작업 추정 | 승인 사이클 | 비고 |
|------|--------------|-----------|------|
| 수행계획서 작성·승인 | — | 1회 | 본 문서 |
| 구현계획서 작성·승인 | — | 1회 | 다음 단계 |
| Stage 1 | 30~60분 | 1회 | NestJS 스캐폴드 + 헬스체크 |
| Stage 2 | 30~60분 | 1회 | Dockerfile + 단독 검증 |
| Stage 3 | 30~60분 | 1회 | compose 통합 + 문서 정리 |
| 최종 보고서 | — | 1회 | 방법론 평가 섹션 포함 |

## 8. 방법론 평가 메모 (사전)

- **R-001 (이슈등록 미니사이클)**: 첫 적용 매끄러움. 본 수행계획서 작성·승인에도 동일 패턴 적용 — *(a) 초안 제시 → (b) 승인 → (c) 반영* 후 다음 단계.
- **R-002 (Fork 셋업 사전 단계)**: 본 task 시작 전 fork 클론·upstream 등록·Issues 활성화·sync 스크립트 배치 등 비명시 단계가 다수 있었음. 본 task 종료 시 회고로 정식화 후보.
- **본 단계 자체에 대한 관찰**: 수행계획서가 "단계 분할 개요"까지 포함해 구현계획서와 일부 중복됨. 절차 일반화 시 두 문서 경계를 명확히 해야 할 가능성. (R-003 후보로 메모)
