# Phase 4. Entry·Fulfillment Queue

## 목표

입장 대기와 조리 준비 Queue를 서로 다른 화면·상태 모델로 구현한다.

관련 요구사항: `FR-QUEUE-001`~`FR-QUEUE-004`, `FR-QUEUE-006`, `FR-ORDER-005`, `FR-ORDER-006`

## 선행 조건·문서

- [Phase 3](./PHASE_03_PAYMENT.md) 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/Specifications/07 대기열·호출·SQS/`

소유 Service는 Queue다. Edge Route 및 SQS 종단 상태를 분리해 기록한다.

## 계약 고정점

- Entry: `WAITING → ENTERED`, 예외 종료 `CANCELLED`, `NO_SHOW`
- Entry 등록 값은 `businessDate`, `partySize`; 연락처·호출 상태 없음
- Fulfillment: `PREPARING → READY`, Order 취소 시 `CANCELLED`
- Fulfillment는 `OrderAccepted` Event로 생성되며 직원이 생성하지 않음
- Fulfillment `READY`와 Order `COMPLETED`는 서로 다른 상태

## API 범위

| Method | Path | 용도 |
|---|---|---|
| `POST` | `/api/v1/queues/entry` | 멱등 입장 대기 등록 |
| `GET` | `/api/v1/queues/entry?businessDate=` | 영업일 목록 |
| `POST` | `/api/v1/queues/entry/{id}/enter` | 입장 |
| `POST` | `/api/v1/queues/entry/{id}/cancel` | 취소 |
| `POST` | `/api/v1/queues/entry/{id}/no-show` | 미방문 |
| `GET` | `/api/v1/queues/fulfillment` | 준비 목록 |
| `POST` | `/api/v1/queues/fulfillment/{id}/ready` | 준비 완료 |

## Slice 4.1 — Entry 목록·등록

- `/pos/queues/entry`
- 영업일별 Entry 목록
- 인원수 기반 등록 Modal
- 등록에 `Idempotency-Key` 적용
- 대기번호와 경과 시간 표시
- 전화번호·SMS·`CALLED` UI를 만들지 않음

## Slice 4.2 — Entry 상태 처리

- `WAITING`에서 Enter, Cancel, No-show Action
- Server Conflict 시 최신 목록 재조회
- 종료 상태 Action 비활성화
- 중복 Action과 Network Error 처리

## Slice 4.3 — Fulfillment 목록

- `/pos/queues/fulfillment`
- `PREPARING`, `READY`, `CANCELLED` 표시
- Order 표시번호와 주문 상세 Link
- `WAITING`이나 직원 생성 Action을 만들지 않음

## Slice 4.4 — READY 처리·Event Lag

- `PREPARING`에서만 Ready Command
- READY 결과 반영 후 Order 상세 이동 가능
- Payment 승인 후 Fulfillment 생성 지연 안내와 재조회
- Order 취소 후 Fulfillment 취소 지연을 거짓 상태로 덮지 않음
- 고객 호출·진동벨 기능을 추가하지 않음

## 권장 산출물

- `src/api/queue.ts`와 Entry/Fulfillment Wire DTO Test
- Entry 등록 Operation과 목록 재조회 Composable
- Entry와 Fulfillment를 분리한 Route View·Component
- 기존 `QueueOperationsView.vue` Placeholder 제거

경과 시간은 화면 표시용으로만 계산하고 상태 판단에 사용하지 않는다. Timer와 Polling은 Component Unmount 시 정리하며, Background Tab에서 무제한 요청하지 않는다.

## Phase 완료 체크

- [ ] Entry 등록 멱등·Validation Test
- [ ] Enter·Cancel·No-show 상태 전이 Test
- [ ] Fulfillment 목록·READY Test
- [ ] Event 지연·충돌·빈 목록 Test
- [ ] `CALLED`, Fulfillment `WAITING`·`COMPLETED`가 코드에 없음
- [ ] Timer·Polling 정리 Test
- [ ] `QueueOperationsView` Placeholder 제거
- [ ] Queue E2E 추가 또는 Edge/SQS Blocker 기록
- [ ] 공통 검증 명령 통과

다음 Phase: [Phase 5 — Catalog & Table](./PHASE_05_CATALOG_TABLE.md)
