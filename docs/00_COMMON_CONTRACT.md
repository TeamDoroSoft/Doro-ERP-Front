# Frontend 공통 구현 계약

이 문서는 모든 Phase에 선행한다. 구현 중 충돌이 생기면 다음 우선순위를 따른다.

1. 실제 Service Controller·Request·Response·Enum
2. `../../Doro-ERP-Service/contracts/`의 기계 계약
3. `../../Docs/Specifications/`의 기능 명세·기술 설계·통신 계약
4. `../../Docs/매뉴얼/사이트맵.md`
5. 이 구현 계획

계약을 바꿔야 하면 Front에서 임의로 맞추지 말고 정본 문서와 Service 변경을 별도 작업으로 기록한다.

## 작업 시작 규칙

```bash
git status --short --branch
rg --files src e2e docs
npm run type-check
npm run test:unit -- --run
```

- 기존 변경을 덮어쓰거나 되돌리지 않는다.
- 한 번에 Slice 하나만 구현한다.
- Front 작업 중 Service·Infra를 임의로 수정하지 않는다.
- 새 Framework나 대형 UI Library는 필요성과 Bundle 영향을 설명할 수 있을 때만 추가한다.
- Vue 3 Composition API, `<script setup lang="ts">`, Pinia, Vue Router와 기존 UI Component를 우선 사용한다.
- 작업 시작과 종료에 `git status --short --branch`와 `git diff --check`를 실행하고, 사용자 또는 다른 작업자의 변경을 구현 범위와 섞지 않는다.

## Front 코드 구조

도메인 구현은 다음 기본 구조를 사용한다. 단순 파일 하나 때문에 빈 계층을 만들지는 않되, View에 HTTP·멱등성·DTO 변환을 직접 넣지 않는다.

```text
src/
├── api/              # Wire DTO와 Edge HTTP Client
├── components/       # 공통 UI와 도메인 표현 Component
├── composables/      # Route Flow, Query, Command 상태와 Polling
├── layouts/          # PosLayout, KioskLayout
├── navigation/       # Role별 표시용 Navigation 정의
├── payments/         # Toss SDK Adapter와 짧은 수명의 결제 처리 상태
├── router/           # Route Meta와 Guard
├── stores/           # 직원 Session, Kiosk Session, Kiosk Cart
└── views/            # Route 단위 조립
```

- `api`는 Vue Component에 의존하지 않는다.
- Pinia Store를 서버 응답 Cache의 기본 장소로 사용하지 않는다. 여러 Route가 공유해야 하는 Session·Cart만 Store에 둔다.
- 금액은 통화 단위가 KRW인 정수로 표시하며, V1 `int64` 값은 안전 범위를 확인하지 않고 JavaScript `number`로 변환하지 않는다.
- 날짜·시간은 서버 영업일과 매장 시간대를 존중한다. Browser의 로컬 날짜를 영업일의 정본으로 사용하지 않는다.

## 아키텍처 경계

- Browser는 Vite의 `/api` Proxy를 포함해 Edge API만 호출한다. 업무 Service를 직접 호출하지 않는다.
- POS 직원 Session과 Kiosk 기기 Session은 Layout·Guard·Pinia Store를 분리한다.
- 금액, Role, Tenant Scope, 판매 가능 여부와 상태 전이의 최종 권위는 서버다.
- `ManagementWorkspace`는 골격 참고용이다. 실제 도메인 로직을 거대한 범용 Component에 계속 추가하지 않는다.
- Store Access·Commerce·Payment·Queue·Audit 외 별도 Backend Service를 가정하지 않는다.

## Edge Dependency Gate

기준일 현재 Edge 코드에 명시적으로 구현된 외부 Route는 직원 Payment 4종과 Audit 조회 2종이다. 다른 `/api/**`는 Fail-Closed `503`일 수 있으며 Kiosk 인증 전달 계약 `CTX-006-K`도 미완료다.

| Gate | 허용하는 완료 상태 |
|---|---|
| API Client와 Mock Test만 완료 | `FRONT_IMPLEMENTED` |
| Edge 미개방 또는 인증 계약 미완료 | `INTEGRATION_BLOCKED` |
| 실제 Edge Request·Response 확인 | `INTEGRATION_VERIFIED` |
| 배포 Secret·TLS·Network와 Browser Flow 확인 | `E2E_VERIFIED` |

Payment·Audit도 Edge 코드 존재만으로 종단 완료라 하지 않는다. 실제 Runtime과 배포 조건을 확인해야 한다. 미개방 Route를 범용 Proxy로 우회하거나 Production Fake Data를 넣지 않는다.

## Role 원칙

서버 인가가 최종 권위다. 메뉴 숨김과 Route Meta는 UX 보조 수단이다.

| 기능 | OWNER | MANAGER | STAFF | KIOSK_DEVICE |
|---|---:|---:|---:|---:|
| POS 주문·결제·Queue | O | O | O | X |
| Category·Product·가격 변경 | O | O | X | X |
| 품절 Toggle | O | O | O | X |
| Table 관리 | O | O | X | X |
| Sales 조회 | O | O | O | X |
| Daily Closing | O | O | X | X |
| 직원 관리 | 전체 | STAFF만 | X | X |
| Kiosk 기기 관리 | O | O | X | X |
| Audit·보안 이력 | O | O | X | X |

`STAFF`도 품절 Toggle이 가능하다는 뜻이며 OWNER·MANAGER를 제외한다는 뜻이 아니다. 직원은 삭제하지 않고 상태 변경으로 비활성화한다. 마지막 활성 OWNER는 비활성화하거나 MANAGER/STAFF로 Role을 바꿀 수 없다.

## 멱등성

계약이 요구하는 Command에만 Operation별 `Idempotency-Key`를 사용한다.

- Order 생성
- Payment 생성·승인·취소
- Entry Queue 등록
- 직원 생성
- 관리자 비밀번호 Reset

같은 논리 작업의 재시도는 같은 Key와 같은 Payload를 유지한다. 사용자가 새 작업을 시작하면 새 Key를 발급한다. 모든 POST에 Interceptor로 새 Key를 자동 생성하지 않는다. 중복 Click 차단은 서버 멱등성을 대체하지 않는다.

Key와 Payload를 함께 다루는 작은 Operation 객체를 사용하고, Component가 다시 Render되었다는 이유로 Key를 교체하지 않는다. 성공·명시적 취소·새 Draft 시작 때만 폐기한다. 영구 Storage에 원문 Key를 저장하지 않는다.

## 보안

- Browser에 둘 수 있는 Toss Key는 Client Key뿐이다.
- Secret Key, Cookie, CSRF Token, Kiosk Credential, Order 조회 Token, Payment Key, 원문 Idempotency Key를 Log·Analytics·영구 Store에 남기지 않는다.
- Toss Callback 처리 후 민감 Query를 즉시 제거한다.
- Legacy Route Redirect와 로그인 복귀 URL은 Query·Hash를 기본 폐기하고 명시적 Allowlist만 전달한다.
- Tenant ID를 URL이나 일반 Form 입력으로 받지 않는다.
- 다른 Tenant Resource의 존재를 `403`과 `404` 차이로 추측하게 만들지 않는다.

## 공통 UI 상태

각 Slice에서 해당되는 상태를 구현한다.

- Loading, Empty, Field Validation, 중복 Action 차단
- Network Error와 `401`, `403`, `404`, `409`, `503`
- Idempotent Replay와 Payload Conflict
- `REVIEW_REQUIRED`
- Event 반영 지연 중 자동 재조회와 수동 새로고침
- Store Inactive
- Kiosk 미등록·인증 실패·`REVOKED`

## Slice 완료 조건

- Route 새로고침과 Bookmark가 동작한다.
- API DTO는 실제 Wire Field와 일치한다.
- 정상·Validation·권한·충돌·Network 상태 Test가 있다.
- 멱등 Command는 재시도 Key 유지와 새 작업 Key 교체를 검증한다.
- Placeholder, 하드코딩 성공 Data, 비활성 저장 버튼을 제거한다.
- 관련 Unit/Component Test가 통과한다.
- 해당 핵심 E2E를 Phase 안에서 추가하거나 정확한 Blocker를 기록한다.
- 변경 후 `type-check`, `lint`, Unit Test, `build`를 실행한다.

## Test 경계

- API Test: Method, Path, Query, Header, Wire Body, Problem Details 변환을 검증한다.
- Composable/Store Test: 중복 Action, 재시도, Key 수명, Polling 정리를 검증한다.
- Component Test: 사용자에게 보이는 Loading·Empty·Validation·권한·오류 상태를 검증한다.
- Router Test: 직접 진입, Redirect, Query 정리, Session·Role Guard를 검증한다.
- Playwright Mock Scenario: Browser Navigation과 화면 연결을 검증하되 통합 완료로 표시하지 않는다.
- Backend E2E: 실제 Edge Runtime을 통과한 경우에만 `INTEGRATION_VERIFIED` 또는 `E2E_VERIFIED` 근거로 사용한다.

Test에서 Service에 없는 상태·필드·Endpoint를 편의상 만들지 않는다. Mock Fixture는 실제 Wire DTO의 최소 유효 예시를 사용한다.

## Slice 작업 보고

1. 구현 Route와 관련 요구사항 ID
2. 호출 API와 소유 Service
3. 정상·오류·권한·멱등 처리
4. 환경 변수와 설정 영향
5. 실행한 검증과 결과
6. 남은 Edge·Service·SQS Blocker
7. UI Screenshot
