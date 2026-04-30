# 다음 세션 진입 안내

> 본 fork 작업을 *다음 세션* (또는 *다른 collaborator*) 이 이어갈 때 **여기서 시작**하면 됩니다. 메모리 시스템 의존도를 줄이기 위한 fork 내부 진입점.

## 현재 상태 (2026-04-30 기준)

- **현재 브랜치**: `local/devel`
- **마일스톤 agent-v0.1 진행률**: 3/6 closed (50%)
- **누적 방법론 다듬기**: R-001~R-015 (15건 정식화)

## 완료된 작업

| 이슈 | 제목 | 보고서 |
|------|------|--------|
| [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ | NestJS agent-server 스켈레톤 + docker-compose 통합 | [task_agent-v0.1_1_report.md](../report/task_agent-v0.1_1_report.md) |
| [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ | OpenAI Chat Completions 클라이언트 + 환경변수 검증 | [task_agent-v0.1_2_report.md](../report/task_agent-v0.1_2_report.md) |
| [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅ | hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프 | [task_agent-v0.1_3_report.md](../report/task_agent-v0.1_3_report.md) |

## 다음 작업

[**#4 멀티턴 세션 히스토리 관리 (in-memory)**](https://github.com/Alpha-ChangukChoi/rhwp/issues/4) — 등록 완료, 본문에 R-007~R-015 다듬기 점검표 포함됨.

### 진입 절차 (본가 [CLAUDE.md](../../CLAUDE.md) + fork [methodology_refinements.md](../manual/methodology_refinements.md) 결합)

```
1. R-011: 누적 환경 정합성 점검
   - cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
   - git status (working tree 깨끗?)
   - cat rhwp-agent-server/.env (OPENAI_API_KEY=sk-dummy 또는 실 키?)
   - ls rhwp-agent-server/{node_modules,dist} (existing?)

2. local/devel 에서 local/task4 브랜치 분기
   - git checkout local/devel
   - git checkout -b local/task4

3. 수행계획서 작성 (R-015 적용 — §6 결정사항에 반대 입장 근거 명시)
   - mydocs/plans/task_agent-v0.1_4.md
   - R-001 (b) 승인 미니사이클

4. 구현계획서 작성 (3~6 stage)
   - mydocs/plans/task_agent-v0.1_4_impl.md
   - R-001 (b) 승인 미니사이클

5. Stage 1~3 진행 (각 stage 완료 후 단계별 보고서 + 승인)

6. 최종 보고서 + 4 커밋 분할 + 이슈 #4 클로즈 + local/devel merge
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
grep -E "^OPENAI" rhwp-agent-server/.env

# 4. docker image 캐시
docker images rhwp-fork-agent-server --format '{{.Repository}}:{{.Tag}} {{.Size}}'

# 5. 자동 테스트 회귀 (선택, 1분)
cd rhwp-agent-server && npm test && npm run test:e2e
```

## 본가 코드 무수정 정책

3 task 누적으로 유지 중. 다음을 **수정 금지**:

- `src/` (Rust 핵심)
- `rhwp-studio/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`
- 본가의 다른 npm/, web/, examples/, tests/, mydocs/ (단 `mydocs/manual/methodology_refinements.md` 는 fork 전용 추가 문서)

## 활성 다듬기 (R-007~R-015) 사전 적용 의무

#4 부터는 **R-014 의무 적용** — 이슈 본문에 활성 다듬기 점검표 포함.

본 fork 의 활성 R-* 다듬기:

- R-001 이슈 등록 미니 사이클
- R-007 도구 버전 *제약*으로
- R-008 자동 검증 우선
- R-009 수치형 + 허용 오차
- R-010 외부 정보 조회 + fallback
- R-011 누적 환경 정합성 점검
- R-013 2단계 검증 사다리 (jest + 컨테이너)
- R-014 이슈 등록 시 다듬기 점검표
- R-015 수행계획서 §6 결정사항에 반대 입장 근거 명시

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
