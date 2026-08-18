# Phase 2. POS Order 핵심 흐름

## 목표

직원이 판매 메뉴를 조회해 `DINE_IN` 또는 `TAKEOUT` Order를 만들고, 목록·상세에서 결제 전 취소와 준비 완료 후 완료 처리를 수행하게 한다.

관련 요구사항: `FR-CATALOG-004`, `FR-CATALOG-005`, `FR-TABLE-002`, `FR-TABLE-003`, `FR-ORDER-001`~`FR-ORDER-006`

현재 상태: `INTEGRATION_BLOCKED`. Front 구현과 Mock 경계 Test는 완료했지만 Edge가 Commerce·Table Route를 아직 제공하지 않아 실제 API 통합은 검증하지 못했다.

## 선행 조건·문서

- [Phase 1](./PHASE_01_POS_SHELL.md) 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/Specifications/03 상품·메뉴 관리/`
- `../../Docs/Specifications/04 기본 테이블 관리/`
- `../../Docs/Specifications/05 POS·Kiosk 통합 주문/`

소유 Service는 Commerce이며 Table 조회는 Store Access다. 실제 Edge 미개방 시 `INTEGRATION_BLOCKED`로 기록한다.

## 계약 고정점

- Order: `CREATED`, `ACCEPTED`, `COMPLETED`, `CANCELLED`
- `CREATED → ACCEPTED`는 직원 접수가 아니라 `PaymentApproved` Event 결과
- 직원 Command: 생성, `CREATED` 취소, `READY` 이후 완료
- 생성 Body 핵심: `orderChannel`, `serviceType`, `tableId`, `lines`
- 옵션·토핑·고객정보·전화번호를 추가하지 않음
- 금액과 합계는 서버 응답을 표시
- 판매 메뉴는 판매 가능한 항목만 반환하며 `soldOut`·`active` Flag가 없음
- 현재 직원 `OrderView`는 `orderId`, `displayNumber`, `totalAmount`, `currency`, `status`, `businessDate`, `orderAccessToken`만 반환
- 품목 Snapshot·Table·Service Type·Fulfillment 상태는 현재 조회 Wire에 없으므로 상세 응답에 있다고 가정하지 않음

## API 범위

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/api/v1/catalog/menu` | 판매 메뉴 |
| `GET` | `/api/v1/tables` | 활성 Table 선택 자료 |
| `POST` | `/api/v1/orders` | 멱등 주문 생성 |
| `GET` | `/api/v1/orders` | 영업일·상태 목록 |
| `GET` | `/api/v1/orders/{orderId}` | 상세·연결 상태 |
| `POST` | `/api/v1/orders/{orderId}/cancel` | `CREATED` 취소 |
| `POST` | `/api/v1/orders/{orderId}/complete` | READY 확인 후 완료 |

모든 호출은 Edge `/api` 경계만 사용한다. Edge 미개방 상태에서는 MSW 같은 새 Runtime Dependency를 성급히 추가하지 말고 기존 HTTP Mock 방식으로 Client·Component 계약을 검증한다.

## Slice 2.1 — 판매 메뉴 조회

- `src/api/catalog.ts`에 판매용 Menu DTO와 조회 Client 구현
- Category별 Product 표시
- 판매 메뉴에 없는 품절·비활성 Product를 별도 Client Cache에서 되살리지 않음
- 관리용 Catalog DTO와 판매용 Menu DTO 분리
- Loading·Empty·503 상태 구현
- Wire DTO를 실제 `CatalogMenuController` 응답과 대조하고 화면 전용 Model 변환은 별도 함수로 둠

## Slice 2.2 — 주문 Draft

- `/pos/orders/new` View 구현
- `DINE_IN`·`TAKEOUT` 선택
- `DINE_IN`일 때만 활성 Table 선택, `TAKEOUT`에서는 `tableId` 제거
- Product 수량 추가·감소·삭제
- Client 예상 합계는 참고 표시만 가능하며 생성 결과의 서버 금액으로 교체

이 Slice는 아직 Command를 보내지 않는다. Draft 상태와 Validation Test에 집중한다.

Draft는 `/pos/orders/new`의 수명에 묶는다. 다른 주문 상세로 이동하거나 생성 성공 후에는 비우고, 잘못된 Table·수량 0·품절 항목을 전송하지 않는다.

## Slice 2.3 — 멱등 주문 생성

- `POST /api/v1/orders`
- 논리 주문별 UUID `Idempotency-Key`
- 전송 중 중복 Click 차단
- Network 재시도에는 같은 Key·Payload 유지
- Payload 변경 또는 새 주문 시작 시 새 Key
- 성공 후 `/pos/orders/:orderId` 이동
- Replay와 `409` Payload Conflict 구분
- 실패 후 같은 Draft 재시도와 사용자가 수정한 새 Draft를 구분

## Slice 2.4 — 주문 목록

- `/pos/orders`
- `businessDate`와 실제 Order 상태 Filter
- Empty·Loading·Error·새로고침 상태
- `CREATED`를 `PLACED`로 번역하지 않음

## Slice 2.5 — 주문 상세·결제 전 취소

- `GET /api/v1/orders/{orderId}`
- 현재 `OrderView`가 제공하는 표시 번호·영업일·서버 금액·상태 표시
- 품목·Table·Service Type 상세는 Backend Wire 계약 확장 전까지 임의 Data 대신 연동 준비 안내
- `CREATED`에서만 `POST /api/v1/orders/{orderId}/cancel`
- `ACCEPTED` 취소 Button은 Commerce 취소를 호출하지 않고 Phase 3의 Payment 전액 취소 Flow로 연결
- 직원 `accept` Action을 만들지 않음

## Slice 2.6 — 주문 완료

- `POST /api/v1/orders/{orderId}/complete`
- `ACCEPTED` Order에서 완료 Command를 제공하되 Fulfillment가 `READY`인지 서버가 확인하므로 Client가 거짓 완료 상태를 선반영하지 않음
- Queue 지연·충돌은 상태 재조회와 안내로 처리

## 권장 산출물

- `src/api/catalog.ts`, `src/api/order.ts`와 API Test
- 주문 Draft·Command 수명을 담당하는 작은 Composable
- `PosOrdersView`, `PosOrderCreateView`, `PosOrderDetailView`와 도메인 Component
- Order Route별 Component Test와 Mock Playwright Flow

기존 `OrdersView.vue`와 `ManagementWorkspace`는 부분 확장하지 말고 실제 View로 교체한다. 이름을 바꾸면 Router Import와 Test를 같은 Slice에서 정리한다.

## Phase 완료 체크

- [x] 판매 메뉴 조회 Test
- [x] DINE_IN·TAKEOUT Draft Validation Test
- [x] 멱등 생성·Replay·Conflict Test
- [x] 목록 Filter Test
- [x] 상세·CREATED 취소 Test
- [x] READY 이후 완료와 충돌 Test
- [x] 판매 메뉴와 Order DTO에 존재하지 않는 Flag·상세 Field를 발명하지 않음
- [x] `PLACED`, `CANCELED`, 직원 접수 Action이 코드에 없음
- [x] 모든 API Method·Path·Header·Body가 실제 Wire 계약과 일치
- [x] 영업일을 Browser 로컬 날짜로 임의 확정하지 않음
- [x] `ManagementWorkspace` 주문 Placeholder 제거
- [x] 핵심 주문 E2E 추가 및 Edge Blocker 기록
- [x] 공통 검증 명령 통과

## 구현·검증 기록

- 판매 메뉴, 주문 생성·목록·상세 API Client와 실제 Commerce Wire DTO를 구현했다.
- 주문 Draft는 View 수명에 두고 `DINE_IN`일 때만 Table을 지연 조회한다. Network 재시도는 같은 멱등 Key를 유지하고 실제 Payload가 바뀔 때만 Key를 교체한다.
- 목록은 영업일·실제 상태 Filter를 사용하며, 상세는 현재 `OrderView`가 주는 요약만 표시한다.
- `CREATED` 취소와 `ACCEPTED` 완료 Command를 구현했다. 충돌 시 서버 상태를 재조회하며 낙관적으로 상태를 선반영하지 않는다.
- `e2e/order.spec.ts`에 포장 주문 생성과 `CREATED` 취소 Mock Browser Scenario를 추가했다.
- `npx oxlint .`, `npx eslint . --no-cache`, `npm run lint`: 통과
- `npm run type-check`, `npx tsc -p e2e/tsconfig.json --noEmit`: 통과
- `npm run test:unit -- --run`: 26 Files, 122 Tests 통과
- `npm run build`, `git diff --check`: 통과
- `npm run test:e2e`: 실행 환경에 `libglib-2.0.so.0`이 없어 Chromium을 시작할 수 없는 기존 Blocker가 남아 있다.

Front 결과는 `FRONT_IMPLEMENTED`이며 실제 연동 상태는 `INTEGRATION_BLOCKED`다. Edge Route와 Browser Runtime이 준비되기 전까지 `INTEGRATION_VERIFIED` 또는 `E2E_VERIFIED`로 올리지 않는다.

다음 Phase: [Phase 3 — Payment](./PHASE_03_PAYMENT.md)
