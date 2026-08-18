# Phase 1. POS Route·인증 Shell

## 목표

기존 `/admin/**` 구조를 `/pos/**`로 이전하고 직원 인증, 강제 비밀번호 변경, Role별 Navigation의 안정적인 기반을 만든다. 업무 API 기능은 이 Phase에서 구현하지 않는다.

관련 요구사항: `FR-IAM-001`, `FR-IAM-007`, `FR-EDGE-001`~`FR-EDGE-003`, `FR-EDGE-005`

현재 상태: `FRONT_IMPLEMENTED`. Route·Layout·Navigation·Guard·Mock Test 코드는 완료했다. 실제 Browser 실행은 환경 Blocker 때문에 `E2E_VERIFIED`가 아니다.

## 선행 문서

- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/매뉴얼/사이트맵.md`
- `../../Docs/Specifications/02 계정·역할·기기 인증/`

## Slice 1.1 — Router 이전

범위:

- `/`와 `/pos`를 `/pos/orders`로 Redirect
- `/login` → `/pos/login`
- `/account/change-password` → `/pos/account/change-password`
- 기존 `/admin/**`는 대응 `/pos/**` Redirect만 제공
- Dashboard Route와 Navigation 제거
- Toss Callback처럼 내부 처리용 Route는 Navigation에서 숨김
- Legacy Redirect는 함수형 Redirect로 구현하고 Query·Hash를 기본 폐기
- Catch-all은 인증 상태에 따라 `/pos/login` 또는 안전한 POS 화면으로 Replace

검증:

- 새 Route 직접 진입·새로고침·Bookmark
- 기존 URL Redirect와 Query 중 민감정보 비전파
- 존재하지 않는 Route의 안전한 처리

## Slice 1.2 — POS Layout·Navigation

`AdminLayout.vue`, Header, Sidebar를 `PosLayout` 의미로 전환한다. 목표 Navigation은 다음과 같다.

- 주문
- 입장 대기·조리 대기
- 메뉴
- 테이블
- 매출
- 설정
- 이력

동일 화면을 Admin과 POS에 중복 구현하지 않는다. 현재 UI Component와 CSS를 재사용하고, 파일명 변경 시 모든 Import와 Test를 함께 갱신한다.

## Slice 1.3 — 인증·Session Guard

- 기존 `auth.ts`와 `operatorSession.ts` 재사용
- 인증 전 목적지 보존 후 로그인 성공 시 복귀
- 비밀번호 변경 강제 대상은 `/pos/account/change-password`로 이동
- Logout 시 직원 Session과 민감 상태 정리
- 개발 Preview는 운영 Session으로 오인되지 않게 유지 또는 명시적으로 격리
- 공통 HTTP `401`은 `/pos/login?reason=session-expired`로 이동하고 무한 Redirect를 만들지 않음
- 로그인 복귀 대상은 내부 `/pos/**` Path만 허용하고 외부 URL·민감 Query는 거부

## Slice 1.4 — Role Navigation Guard

- OWNER·MANAGER·STAFF 메뉴 노출을 공통 Role 표와 일치시킴
- STAFF에게 Table 관리, Settings, History 관리 메뉴를 숨김
- 직접 URL 접근 UX와 서버 `403` 처리를 모두 검증
- Client Guard를 서버 인가 대체로 사용하지 않음
- 거절 Redirect는 `reason=forbidden` 등 비민감 사유를 전달하고 도착 화면에서 한 번 안내

## Slice 1.5 — 현재 구현 보완

2026-08-17 코드 점검에서 확인한 작업을 다음 순서로 끝낸다.

1. `src/router/index.ts`: Legacy Redirect의 Query·Hash 제거, Catch-all, 허용된 복귀 URL Test 추가
2. `src/main.ts`: 전역 `401` 목적지를 `/pos/login`으로 변경
3. POS 공통 Layout 또는 도착 View: 직접 URL Role 거절 안내 추가
4. `e2e/vue.spec.ts`, `dev-preview.spec.ts`, `management.spec.ts`, `audit.spec.ts`: `/pos/**` IA와 새 Navigation으로 이전
5. 사용처가 없는 `AdminLayout`, `AdminHeader`, `AdminSidebar`, `adminNavigation`, `DashboardView`와 관련 Test 제거
6. 새 POS Component Test 파일도 실제 Component 이름에 맞게 Rename

호환 Wrapper를 남겨야 한다면 실제 Import 사용처와 제거 시점을 이 문서에 기록한다. 단순히 구 Test 이름을 유지하기 위해 남기지 않는다.

## 산출물

- `src/layouts/PosLayout.vue`
- `src/components/layout/PosHeader.vue`, `PosSidebar.vue`
- `src/navigation/posNavigation.ts`
- POS Route·Guard와 Test
- 로그인·비밀번호 변경·전역 401의 `/pos/**` 정합성
- Phase 1 Browser Navigation Playwright Scenario

## Phase 완료 체크

- [x] Slice 1.1 Router Test 통과
- [x] Slice 1.2 Layout·Navigation Component Test 통과
- [x] Slice 1.3 인증·강제 비밀번호 변경 Guard Test 통과
- [x] Slice 1.4 Role별 메뉴·직접 URL Test 통과
- [x] `/admin/**`에 실제 화면 중복 없음
- [x] `/pos/orders` Placeholder는 다음 Phase 대상임이 명확함
- [x] Legacy Redirect에서 임의 Query·Hash와 외부 복귀 URL이 전달되지 않음
- [x] 전역 401과 Logout이 `/pos/login`을 사용함
- [x] Catch-all과 권한 거절 안내가 있음
- [x] Phase 1 대상 Playwright가 새 IA를 사용함
- [x] 미사용 Admin·Dashboard 파일과 Test 이름 정리
- [x] Type Check·Lint·Unit Test·Build 통과
- [ ] Playwright 실제 Browser 실행

## 검증 기록

- `npm run type-check`: 통과
- `npm run lint`: 통과
- `npm run test:unit -- --run`: 18 Files, 103 Tests 통과
- `npm run build`: 통과
- `npx tsc -p e2e/tsconfig.json --noEmit`: 통과
- `git diff --check`: 통과
- `npm run test:e2e`: Vite 기동과 12개 Scenario 수집까지 성공했으나 Chromium 실행에 필요한 `libglib-2.0.so.0`이 실행 환경에 없어 미실행

Playwright 실패는 Application Assertion 실패가 아니라 Browser Runtime 의존성 Blocker다. 필요한 OS Library가 준비된 CI 또는 개발 환경에서 재실행하기 전까지 `E2E_VERIFIED`로 올리지 않는다.

다음 Phase: [Phase 2 — Order](./PHASE_02_ORDER.md)
