# Phase 7. Kiosk 고객 주문·결제

## 목표

직원 POS와 인증·상태·UI가 분리된 Kiosk Shell에서 메뉴 탐색, 장바구니, Order 생성, Toss 결제, 제한된 주문 상태 조회를 제공한다.

관련 요구사항: `FR-IAM-005`, `FR-IAM-007`, `FR-CATALOG-004`, `FR-TABLE-002`, `FR-TABLE-003`, `FR-ORDER-001`~`FR-ORDER-007`, `FR-PAY-001`~`FR-PAY-004`, `FR-PAY-006`, `FR-QUEUE-004`

## 선행 조건·문서

- [Phase 6](./PHASE_06_SALES_ADMIN.md) 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/Specifications/02 계정·역할·기기 인증/`
- `../../Docs/Specifications/03 상품·메뉴 관리/`
- `../../Docs/Specifications/04 기본 테이블 관리/`
- `../../Docs/Specifications/05 POS·Kiosk 통합 주문/`
- `../../Docs/Specifications/06 Toss Payments 테스트 결제/`

`CTX-006-K`가 확정·구현되지 않았다면 Kiosk 종단 연동은 `INTEGRATION_BLOCKED`다. Credential 전달 규격을 Front에서 발명하지 않는다.

Phase 시작 Gate에서 Service와 Edge의 `CTX-006-K` 상태를 다시 확인한다. 미완료여도 Layout·Cart·Touch UI와 계약 기반 API Client는 구현할 수 있지만, Production Fake Credential이나 직원 Session 우회는 금지한다.

## 계약 고정점

- Kiosk는 직원 Session Store·Layout·Navigation을 사용하지 않음
- 결제 수단 선택 기능 없이 Toss 테스트 결제만 제공
- 고객정보·연락처·회원·포인트·추천 기능 없음
- 장바구니 총액은 참고이며 서버 Order·Payment 금액이 정본
- 제한 조회 Token과 Kiosk Credential을 Query·Log·영구 Store에 남기지 않음
- Kiosk는 자신이 만든 Order만 제한 조회

## Slice 7.1 — Kiosk Layout·기기 Session

- `KioskLayout.vue`, `useKioskSessionStore.ts` 신설
- `/kiosk/**`와 `/pos/**` Guard 완전 분리
- 미등록·인증 실패·비활성·`REVOKED` 기기 차단 화면
- 직원 Navigation·설정·Audit·취소 기능 미노출
- 활성화 입력 화면이 필요하면 `POST /api/v1/kiosk-auth/activate`의 `tenantCode`, `deviceCode`, `secret`만 사용하고 성공 후 원문 Secret 즉시 폐기

## Slice 7.2 — 판매 메뉴 탐색

- `/kiosk`
- Category Tab과 큰 Product Card
- 품절·비활성 Product 선택 차단
- Touch Target·가로/세로 Display 대응
- 옵션 선택 UI 없음

## Slice 7.3 — 장바구니

- `/kiosk/cart`
- POS Draft와 분리된 `useKioskCartStore.ts`
- 수량 변경·삭제·비우기
- 새 주문 완료·취소 시 장바구니와 Operation Key 수명 정리
- 민감정보 Persistence 없음

## Slice 7.4 — Checkout·Order 생성

- `/kiosk/checkout`
- `DINE_IN`·`TAKEOUT`, DINE_IN일 때 활성 Table 선택
- 결제 수단 선택 UI 없음
- Kiosk Channel로 멱등 Order 생성
- 제한 조회 Token은 필요한 수명과 안전한 저장 범위만 사용
- 새 고객 Flow마다 새 주문 Idempotency Key를 만들고 결제 Operation Key와 분리

## Slice 7.5 — Toss 결제

- `/kiosk/payments/:paymentId`
- Phase 3의 검증된 Toss Adapter와 Operation별 멱등 정책 재사용
- Callback Query 즉시 제거
- Popup 차단·실패·`REVIEW_REQUIRED`·Network 불확실 상태의 Touch UX
- 직원 전액 취소 기능 없음

## Slice 7.6 — 주문 상태 조회·Session 종료

- `/kiosk/orders/:orderId`
- 표시 주문번호, Payment와 Order·Fulfillment 상태를 독립 표시
- 고객 표현은 서버 상태를 왜곡하지 않는 제한된 Label 사용
- `PREPARING`, `READY` 반영 지연 Polling과 수동 새로고침
- 일정 시간 후 다음 고객을 위해 주문·Cart·Token 상태 정리

## Kiosk Session 종료 규칙

- 기기 인증 Cookie는 매 주문 후 폐기하지 않는다. 고객 주문·조회 상태만 초기화한다.
- 제한 조회 Token은 해당 주문 조회 수명에만 두고 다른 주문에 재사용하지 않는다.
- 초기화 Timer는 남은 시간을 안내하며 결제 승인 처리 중에는 실행하지 않는다.
- 새 고객 시작, 명시적 완료, Timeout의 세 경로를 같은 초기화 함수로 처리한다.
- Browser Refresh 후 복구 범위는 확정된 Kiosk 인증·조회 Token 계약보다 넓게 만들지 않는다.

## Phase 완료 체크

- [ ] POS·Kiosk Store/Guard 격리 Test
- [ ] 기기 미등록·비활성·REVOKED Test
- [ ] 메뉴·장바구니 Touch Interaction Test
- [ ] DINE_IN·TAKEOUT Order 생성 Test
- [ ] Toss Callback·REVIEW_REQUIRED Test
- [ ] 제한 조회와 Session 정리 Test
- [ ] Kiosk 활성화 Secret·조회 Token·결제 Key가 영구 저장되지 않음
- [ ] 고객 상태 초기화와 기기 Session 유지가 분리됨
- [ ] 직원 기능·결제수단 선택·고객정보가 Kiosk에 없음
- [ ] Kiosk 핵심 E2E 추가 또는 CTX-006-K Blocker 기록
- [ ] 공통 검증 명령 통과

다음 Phase: [Phase 8 — Hardening](./PHASE_08_HARDENING.md)
