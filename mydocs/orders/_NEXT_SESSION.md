# 다음 세션 진입 안내

> 본 fork 작업을 *다음 세션* (또는 *다른 collaborator*) 이 이어갈 때 **여기서 시작**하면 됩니다. 메모리 시스템 의존도를 줄이기 위한 fork 내부 진입점.

## 현재 상태 (2026-04-30 기준)

- **현재 브랜치**: `local/devel`
- **마일스톤 agent-v0.1 진행률**: 4/6 closed (67%)
- **누적 방법론 다듬기**: R-001~R-015 (15건 정식화). R-014/R-015 첫 *의무* 적용 효과 측정 완료 (#4 — 결정 변경 0건, 누락 0건)

## 완료된 작업

| 이슈 | 제목 | 보고서 |
|------|------|--------|
| [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ | NestJS agent-server 스켈레톤 + docker-compose 통합 | [task_agent-v0.1_1_report.md](../report/task_agent-v0.1_1_report.md) |
| [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ | OpenAI Chat Completions 클라이언트 + 환경변수 검증 | [task_agent-v0.1_2_report.md](../report/task_agent-v0.1_2_report.md) |
| [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅ | hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프 | [task_agent-v0.1_3_report.md](../report/task_agent-v0.1_3_report.md) |
| [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4) ✅ | 멀티턴 세션 히스토리 관리 (in-memory) | [task_agent-v0.1_4_report.md](../report/task_agent-v0.1_4_report.md) |

## 다음 작업

[**#5 rhwp-studio 우측 사이드바 채팅 UI**](https://github.com/Alpha-ChangukChoi/rhwp/issues/5) — *미등록*. R-001 미니사이클로 이슈 본문 + R-014 점검표 작성 → 작업지시자 승인 후 등록.

### #5 정책 충돌 결정 (완료, 2026-04-30)

**채택안: 옵션 2의 변형** — `rhwp-studio/src/agent/` 신규 폴더 + `src/main.ts` 진입점 1~2줄 추가.

| 항목 | 내용 |
|------|------|
| 형식 | 본가 폴더 *내부*에 신규 sub-module 폴더 추가 (`src/agent/`) + 진입점 import 1~2줄 |
| 본가 동기화 충돌 표면 | `src/main.ts` 의 1~2줄만 — 충돌 시 즉시 인지·해결 가능 |
| 통합도 | rhwp-studio 의 `src/hwpctl/`, `src/command/`, `src/view/` 등 *상대 경로 import* 직접 접근 |
| R-013 layer 2 재정의 | `rhwp-studio/e2e/` 의 puppeteer + Vite preview 패턴 그대로 활용 |
| 무수정 정책 정신 | *기존 동작 변경 없음 + 추가 모듈 격리* → 본가 회귀 0, 동기화 안전 |

대안 검토 결과 (R-015 반대 입장 근거):
- **옵션 1** (산발 수정): 본가 동기화 충돌 위험 분포 예측 불가 → 비채택
- **옵션 2 원안** (sibling 패키지 `rhwp-studio-agent-ui/`): cross-package 공개 API 정의 부담이 #5 범위 외 → 비채택
- **옵션 3** (iframe): 통합도 손상이 #5 핵심 가치 손상 → 비채택

#5 수행계획서 §6 에는 *위 결정 경위*를 그대로 인용 + 본 task 의 추가 결정사항 (컴포넌트 라이브러리 / 상태 관리 / 도구 호출 결과 시각화 형태 / sessionId 발급 시점 / 채팅 입력 → 백엔드 호출 방식 등) 만 신규 명시.

### 진입 절차 (본가 [CLAUDE.md](../../CLAUDE.md) + fork [methodology_refinements.md](../manual/methodology_refinements.md) 결합)

```
0. (#5 사전) 정책 충돌 결정 완료 — 옵션 2의 변형 (rhwp-studio/src/agent/) 채택. 위 섹션 참조

1. R-011: 누적 환경 정합성 점검
   - cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
   - git status (working tree 깨끗?)
   - cat rhwp-agent-server/.env (OPENAI_* + SESSION_* — 후자 부재 시 default fallback)
   - ls rhwp-agent-server/{node_modules,dist}
   - cd rhwp-studio && (의존성·빌드 캐시 점검 — 첫 frontend task 라 패턴 신규)

2. R-001 (a)→(b)→(c) 로 #5 이슈 등록 (R-014 점검표 본문 포함)

3. local/devel 에서 local/task5 브랜치 분기

4. 수행계획서 작성 (R-015 — §6 에 위 정책 옵션 1/2/3 반대 입장 근거 포함)
   - mydocs/plans/task_agent-v0.1_5.md
   - R-001 (b) 승인 미니사이클

5. 구현계획서 작성 (3~6 stage). frontend task 라 R-013 2단계 사다리의
   layer 2 정의가 신규 (compose 대신 브라우저 e2e? Vite preview?)
   - mydocs/plans/task_agent-v0.1_5_impl.md
   - R-001 (b) 승인 미니사이클

6. Stage 진행 (각 stage 완료 후 단계별 보고서 + 승인)

7. 최종 보고서 + 커밋 분할 + 이슈 #5 클로즈 + local/devel merge
```

## fork 작업 환경 점검 (R-011)

매 세션 시작 시 다음 명령으로 환경 점검:

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# 1. git
git branch --show-current
git status --short

# 2. 의존성·빌드 캐시
ls rhwp-agent-server/node_modules >/dev/null 2>&1 && echo "node_modules ok" || echo "MISSING"
ls rhwp-agent-server/dist >/dev/null 2>&1 && echo "dist ok" || echo "MISSING"

# 3. 환경변수
grep -E "^OPENAI|^SESSION" rhwp-agent-server/.env

# 4. docker image 캐시
docker images rhwp-fork-agent-server --format '{{.Repository}}:{{.Tag}} {{.Size}}'

# 5. 자동 테스트 회귀 (선택, 1분)
cd rhwp-agent-server && npm test && npm run test:e2e
```

## 본가 코드 무수정 정책

4 task 누적으로 유지 중. 다음을 **수정 금지**:

- `src/` (Rust 핵심)
- `rhwp-studio/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`
- 본가의 다른 npm/, web/, examples/, tests/, mydocs/ (단 `mydocs/manual/methodology_refinements.md` 는 fork 전용 추가 문서)

**#5 정책 결정 완료** — 옵션 2의 변형 (`rhwp-studio/src/agent/` 신규 폴더 + `src/main.ts` 진입점 1~2줄). 위 *다음 작업* 섹션 *#5 정책 충돌 결정* 참조. 본가 다른 폴더는 수정 금지 유지.

## 활성 다듬기 (R-007~R-015) 사전 적용 의무

#4 에서 **R-014/R-015 첫 의무 적용** — 효과 측정 결과: 결정 변경 0건, 누락 0건. 후속 task 도 동일 의무 유지.

본 fork 의 활성 R-* 다듬기:

- R-001 이슈 등록 미니 사이클
- R-007 도구 버전 *제약*으로
- R-008 자동 검증 우선
- R-009 수치형 + 허용 오차
- R-010 외부 정보 조회 + fallback
- R-011 누적 환경 정합성 점검
- R-013 2단계 검증 사다리 (jest + 컨테이너) — **#5 frontend 시점에 layer 2 재정의 필요** (브라우저 e2e? Vite preview?)
- R-014 이슈 등록 시 다듬기 점검표 (의무, #4부터)
- R-015 수행계획서 §6 결정사항에 반대 입장 근거 명시 (의무, #4부터)

R-002 (Fork 셋업), R-012 (mock dup) 는 placeholder/별도 task 후보라 수행계획서에서는 *참고 항목*.

## 본가 동기화

본가 (edwardkim/rhwp) 업데이트를 가져오려면:

```bash
git fetch upstream
git checkout local/devel
git merge upstream/devel  # 또는 git rebase
```

본 fork 는 upstream remote 등록되어 있어야 함:
```bash
git remote -v   # upstream → https://github.com/edwardkim/rhwp.git
```

## 참고 자료

- 본가 절차: [CLAUDE.md](../../CLAUDE.md)
- 다듬기 누적: [methodology_refinements.md](../manual/methodology_refinements.md)
- 오늘 할일 누적: [orders/20260430.md](20260430.md)
- agent-server: [rhwp-agent-server/README.md](../../rhwp-agent-server/README.md) (NestJS CLI 기본)
