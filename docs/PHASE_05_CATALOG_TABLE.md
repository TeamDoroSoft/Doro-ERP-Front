# Phase 5. Catalog·Table 관리

## 목표

판매 메뉴의 원천인 Category·Product 관리와 기존 Table 관리 화면을 실제 계약과 Role에 맞게 완성한다.

관련 요구사항: `FR-CATALOG-001`~`FR-CATALOG-005`, `FR-TABLE-001`~`FR-TABLE-004`

## 선행 조건·문서

- [Phase 4](./PHASE_04_QUEUE.md) 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/Specifications/03 상품·메뉴 관리/`
- `../../Docs/Specifications/04 기본 테이블 관리/`

Catalog는 Commerce, Table은 Store Access가 소유한다.

## 계약 고정점

- Category·Product는 물리 삭제가 아니라 수정·비활성화 모델을 사용
- 옵션·토핑·사이즈·복잡한 세트 구성을 추가하지 않음
- OWNER·MANAGER는 Category·Product·가격 관리 가능
- OWNER·MANAGER·STAFF 모두 품절 Toggle 가능
- STAFF는 Table 관리 불가, 주문 생성에서 활성 Table 조회만 가능
- 판매 메뉴 DTO와 관리 DTO를 분리

## API 범위

| Method | Path | Role |
|---|---|---|
| `GET`, `POST` | `/api/v1/catalog/categories` | 조회: 직원, 생성: OWNER·MANAGER |
| `PATCH` | `/api/v1/catalog/categories/{categoryId}` | OWNER·MANAGER |
| `GET`, `POST` | `/api/v1/catalog/products` | 조회: 직원, 생성: OWNER·MANAGER |
| `PATCH` | `/api/v1/catalog/products/{productId}` | OWNER·MANAGER |
| `PATCH` | `/api/v1/catalog/products/{productId}/sold-out` | 모든 직원 Role |
| `GET`, `POST` | `/api/v1/tables` | 조회: 직원, 생성: OWNER·MANAGER |
| `PATCH` | `/api/v1/tables/{tableId}` | OWNER·MANAGER |
| `PATCH` | `/api/v1/tables/{tableId}/status` | OWNER·MANAGER |

## Slice 5.1 — Category 조회·생성

- `/pos/catalog` 관리 Shell과 Category 목록
- Loading·Empty·오류 상태
- OWNER·MANAGER 생성 Form과 Validation
- STAFF는 생성 Action 없음

## Slice 5.2 — Category 수정·비활성화

- 이름·정렬·활성 상태 등 실제 DTO Field만 사용
- 물리 삭제 Button과 DELETE 요청을 만들지 않음
- 비활성화가 판매 메뉴에 반영되는 지연을 안전하게 표시

## Slice 5.3 — Product 조회·생성

- 선택 Category의 Product 목록
- 실제 명세의 이름·가격·활성·품절 Field만 사용
- 서버 Validation과 금액 표기
- 옵션 Editor를 추가하지 않음

## Slice 5.4 — Product 수정·비활성화

- OWNER·MANAGER 가격·기본 정보·활성 상태 수정
- STAFF에게 관리 Form 숨김
- 물리 삭제가 아닌 비활성 처리

## Slice 5.5 — 품절 Toggle

- OWNER·MANAGER·STAFF 모두 허용
- Optimistic UI를 쓰더라도 실패 시 서버 상태로 복원
- 판매 메뉴 재조회와 상태 정합성 검증

## Slice 5.6 — Table Route·Role 이전

- 기존 Table API Client·View·Test 재사용
- `/pos/tables`로 이전
- OWNER·MANAGER 목록·생성·수정·활성/비활성
- STAFF 직접 접근 제한, 주문 Form에서는 조회만 허용
- 활성 Order가 있는 Table 비활성화 충돌 처리

## 기존 자산 처리

- `src/api/table.ts`와 `TableManagementView.vue`는 계약이 맞는 부분을 유지하고 Route·권한·오류 Test를 보강한다.
- `CatalogManagementView.vue`와 `workspaceDefinitions.ts`의 정적 Form은 실제 Catalog View로 교체한다.
- Product 품절은 관리 권한 Form과 분리된 작은 Action으로 만들어 STAFF 화면에서도 사용할 수 있게 한다.

## Phase 완료 체크

- [ ] Category 생성·수정·비활성 Test
- [ ] Product 생성·수정·비활성 Test
- [ ] 세 Role의 품절 Toggle Test
- [ ] 판매/관리 DTO 분리 확인
- [ ] Table 관리 Role·Conflict Test
- [ ] DELETE·옵션·STAFF 전용 품절이라는 잘못된 구현 없음
- [ ] Catalog Placeholder와 비활성 저장 Button 제거
- [ ] 금액 입력·표시가 정수 KRW 계약과 일치
- [ ] 관련 E2E 추가 또는 Edge Blocker 기록
- [ ] 공통 검증 명령 통과

다음 Phase: [Phase 6 — Sales & Administration](./PHASE_06_SALES_ADMIN.md)
