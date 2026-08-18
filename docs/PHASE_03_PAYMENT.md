# Phase 3. Order Payment 통합

## 목표

기존 Toss 테스트 Flow를 Order 상세에 통합하고 Payment 생성·조회·승인·전액 취소 및 불확실 결과를 안전하게 처리한다.

관련 요구사항: `FR-PAY-001`~`FR-PAY-006`, `FR-ORDER-005`, `FR-ORDER-006`

현재 상태: `FRONT_IMPLEMENTED`. Front 코드와 Mock 경계 Test는 완료했으며 실제 Edge·Payment Runtime 통합은 아직 검증하지 않았다.

## 선행 조건·문서

- [Phase 2](./PHASE_02_ORDER.md) 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/Specifications/05 POS·Kiosk 통합 주문/`
- `../../Docs/Specifications/06 Toss Payments 테스트 결제/`
- 기존 `src/api/payment.ts`, `src/payments/`, Payment View와 Test

## 계약 고정점

- Payment: `PENDING`, `PAID`, `FAILED`, `REVIEW_REQUIRED`, `CANCELLED`
- 생성·승인·취소는 서로 다른 Operation이며 Key도 각각 분리
- Order 금액을 Client가 결제 금액의 정본으로 결정하지 않음
- 결제 전 Order 취소는 Commerce, 결제 후 전액 취소는 Payment가 소유
- `REVIEW_REQUIRED`를 성공이나 실패로 추측하지 않음

## API·Route 범위

| Method | Path | 용도 |
|---|---|---|
| `POST` | `/api/v1/payments` | Order 기반 Payment 생성 |
| `GET` | `/api/v1/payments/{paymentId}` | 상태 조회 |
| `POST` | `/api/v1/payments/{paymentId}/confirm` | Toss 승인 |
| `POST` | `/api/v1/payments/{paymentId}/cancel` | 직원 전액 취소 |

사용자 화면은 `/pos/orders/:orderId` 안에 통합한다. Callback 전용 Route가 필요하면 Navigation에 노출하지 않고, 성공·실패 처리 후 원 Order 상세로 `replace`한다.

## Slice 3.1 — Payment 생성·조회

- Order 상세에서 `POST /api/v1/payments`
- 생성 Operation의 Idempotency Key 수명 관리
- `GET /api/v1/payments/{id}` 조회
- Order와 Payment 상태를 별도 영역에 표시
- `PENDING` 생성 결과로 Toss 결제 단계 진입

## Slice 3.2 — Toss 요청·승인

- 현재 Toss SDK Adapter 재사용
- 프로젝트가 이미 사용하는 결제창 방식을 유지하고 새 Widget 방식을 임의 도입하지 않음
- Toss 성공 Callback에서 승인 API 호출
- 승인 Operation은 생성과 다른 Idempotency Key 사용
- 서버 금액 검증 실패, Provider 실패, Network 불확실 결과 구분
- Toss 요청 값은 Payment 생성 응답만 사용하며 사용자가 입력하는 Order ID·금액 Form을 제거

## Slice 3.3 — Callback 보안·복귀

- `paymentKey` 등 Callback Query를 필요한 짧은 범위에서만 사용
- Callback 값을 메모리로 복사한 직후 `history.replaceState` 또는 Router Replace로 URL에서 제거
- Log·Pinia Persistence·Analytics에 Payment Key를 남기지 않음
- 처리 후 원 Order 상세로 복귀
- 새로고침·중복 Callback에서도 승인 Key와 결과가 안전하게 유지됨을 검증

## Slice 3.4 — 직원 전액 취소

- `PAID` Payment에 `POST /api/v1/payments/{id}/cancel`
- 취소 전용 Idempotency Key 유지
- 취소 성공 직후 Order를 Client에서 `CANCELLED`로 조작하지 않음
- `PaymentCancelled` Event 반영까지 Payment와 Order 상태를 독립 표시
- 부분 취소 UI를 만들지 않음

## Slice 3.5 — 불확실 결과·Event Lag

- `REVIEW_REQUIRED` 직원 확인 안내
- 승인·취소 후 Payment와 Order 재조회
- 제한된 자동 Polling과 수동 새로고침 제공
- Timeout 후 성공·실패를 추측하지 않음
- 독립 `/admin/payments` Navigation과 `/payments/test` 사용자 노출 정리

## 기존 자산 처리

- `src/api/payment.ts`, `src/payments/tossPayment.ts`의 검증된 DTO·Adapter·Test를 재사용한다.
- `pendingPayment.ts`가 민감 값을 Session Storage에 저장하는지 재검토하고 최소 식별자·Operation 상태만 남긴다.
- `PaymentCheckoutView`, `PaymentResultView`, `PaymentsManagementView`는 통합 Flow에 맞게 이동하거나 제거한다.
- 기존 `e2e/payment.spec.ts`의 수동 Order ID·금액 입력 Scenario를 Order 상세 시작 Scenario로 변경한다.

## Phase 완료 체크

- [x] 생성·조회·승인 Operation Test
- [x] Operation별 Idempotency Key 분리 Test
- [x] Callback 민감 Query 제거 Test
- [x] PAID 전액 취소 Test
- [x] REVIEW_REQUIRED·Provider 오류·Network 불확실 Test
- [x] Payment와 Order Event Lag Test
- [x] Toss Secret 또는 Payment Key 영구 저장 없음
- [x] 사용자 입력 금액·Order ID 기반 Test 결제 화면 제거
- [x] 독립 Payment Navigation과 구 `/admin/payments` 화면 제거
- [x] 핵심 Payment E2E 추가 및 Runtime Blocker 기록
- [x] 공통 검증 명령 통과

## 구현·검증 기록

- 기존 Payment Client를 공통 `apiRequest`·`ApiError` 경계로 통합하고 생성·조회·승인·전액 취소 계약을 실제 Payment·Edge Controller와 맞췄다.
- 주문 상세에 결제 Panel을 통합했다. Client 입력 금액이나 Order ID Form은 제거했으며 Payment 생성 응답의 금액과 Provider Order ID만 Toss 요청에 사용한다.
- 생성·승인·취소 Key는 서로 분리하고 같은 Operation 재시도에서는 Key를 유지한다.
- Callback의 `paymentKey`, Provider Order ID와 금액은 메모리로 옮긴 직후 URL에서 제거한다. `paymentKey`·Secret·API Base URL은 Storage에 저장하지 않는다.
- 최근 Payment 연결은 비민감 `orderId → paymentId`만 Session Storage에 남기며 조회 응답을 현재 Order와 다시 대조한다.
- `PAID` 전액 취소 후 Order를 낙관 변경하지 않는다. `REVIEW_REQUIRED`와 Event 반영 지연은 제한 Polling·수동 새로고침·안내로 처리한다.
- 독립 `PaymentCheckoutView`, `PaymentsManagementView`와 사용자용 `/payments/test` 화면을 제거하고 Legacy URL은 Query를 폐기한 채 주문 목록으로 보낸다.
- `e2e/payment.spec.ts`를 Order 상세 시작 기준의 승인·Toss 취소·검토 필요·전액 취소 Scenario로 교체했다.
- Vitest 기본 worker가 실행 환경의 Process 한도를 넘지 않도록 `maxWorkers: 2`로 제한했다.
- `npx oxlint .`, `npx eslint . --no-cache`, `npm run lint`: 통과
- `npm run type-check`, `npx tsc -p e2e/tsconfig.json --noEmit`: 통과
- `npm run test:unit -- --run`: 27 Files, 136 Tests 통과
- `npm run build`, `git diff --check`: 통과
- `npm run test:e2e`: Chromium Runtime의 `libglib-2.0.so.0` 부재로 실제 Browser 실행을 검증하지 못했다. E2E TypeScript 정적 검사는 통과했다.

Mock 결과를 실제 통합으로 과장하지 않으므로 `INTEGRATION_VERIFIED`와 `E2E_VERIFIED`는 표시하지 않는다.

다음 Phase: [Phase 4 — Queue](./PHASE_04_QUEUE.md)
