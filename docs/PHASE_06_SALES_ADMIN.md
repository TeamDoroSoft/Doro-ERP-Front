# Phase 6. Sales·Settings·History

## 목표

매출·마감과 매장 운영 설정, 직원·Kiosk 기기 관리, Audit·보안 이력을 작은 Slice로 나누어 완성한다.

관련 요구사항: `FR-TENANT-002`~`FR-TENANT-005`, `FR-IAM-002`~`FR-IAM-006`, `FR-SALES-001`~`FR-SALES-005`, `FR-AUDIT-003`~`FR-AUDIT-005`

`FR-TENANT-001`, `FR-TENANT-006`의 시스템 관리자 Provisioning·Tenant 상태 전환은 이 SPA의 사용자 기능 범위가 아니다.

## 선행 조건·문서

- [Phase 5](./PHASE_05_CATALOG_TABLE.md) 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- `../../Docs/Specifications/01 업체·매장 관리/`
- `../../Docs/Specifications/02 계정·역할·기기 인증/`
- `../../Docs/Specifications/08 매출·일일 마감/`
- `../../Docs/Specifications/09 Audit·History·Logging/`

Sales는 Commerce, Store·Employee·Kiosk Device·Security History는 Store Access, Audit은 Audit Service가 소유한다.

## 계약 고정점

- MVP Sales는 일별 요약과 Daily Closing이며 시간대·상품별 분석이 아님
- 직원 삭제 Endpoint는 없으며 상태 변경으로 비활성화
- 마지막 활성 OWNER는 비활성화하거나 Role을 낮출 수 없음
- Kiosk Credential은 등록 시 1회 발급하고 Rotate·Revoke 수명주기를 가짐
- Revoke 상태 명칭은 `REVOKED`; Token 삭제라는 표현을 사용하지 않음
- Sales의 signed int64 금액은 JavaScript 안전 정수 범위를 넘을 수 있으므로 정밀도를 보존

## API 범위

| 영역 | Method·Path |
|---|---|
| Sales | `GET /api/v1/sales/daily`, `POST /api/v1/sales/daily/{businessDate}/close`, `GET /api/v1/sales/closings/{businessDate}` |
| Store | `GET /api/v1/store`, `PATCH /api/v1/store`, `PATCH /api/v1/store/status` |
| Employee | `POST·GET /api/v1/employees`, `GET /api/v1/employees/{id}`, Role·Status `PATCH`, Password Reset `POST` |
| Kiosk Device | `POST /api/v1/kiosk-devices`, `POST /{id}/rotate`, `POST /{id}/revoke` |
| Audit | `GET /api/v1/audits`, `GET /api/v1/audits/{id}` |
| Security | `GET /api/v1/security-history` |

Employee 생성과 Password Reset은 각각 독립된 `Idempotency-Key` Operation으로 구현한다. Store 상태 변경처럼 중요 관리 작업에 재인증이 요구되면 `POST /api/v1/auth/reauthenticate` 계약을 먼저 확인하고 화면에 연결한다.

## Slice 6.1 — 일별 매출 조회

- `/pos/sales`
- 영업일별 서버 집계 값 표시
- STAFF 포함 허용 Role 조회 UX
- 시간대별 Chart·메뉴별 통계를 만들지 않음
- int64 금액의 Parsing·Formatting 정밀도 Test

## Slice 6.2 — Daily Closing

- OWNER·MANAGER만 마감 Command 노출
- 마감 상태·이미 마감됨·영업일 충돌 처리
- Client에서 매출을 재계산하거나 마감 성공을 선반영하지 않음

## Slice 6.3 — 매장 설정

- `/pos/settings`의 Store Tab
- 실제 조회·수정·상태 API Field만 사용
- Store Inactive 상태가 업무 화면에 일관되게 반영되도록 연결

## Slice 6.4 — 직원 목록·생성

- Settings의 Employee Tab
- OWNER는 허용 범위 전체, MANAGER는 STAFF 범위만 관리
- STAFF 접근 금지
- 생성·목록·상세와 Field Validation
- 직원 생성 멱등 재시도와 Payload Conflict 처리

## Slice 6.5 — 직원 Role·상태·비밀번호 Reset

- Role 변경, 활성·비활성, 관리자 비밀번호 Reset을 별도 Action으로 구현
- 마지막 활성 OWNER 보호 오류를 명시적으로 표시
- 물리 삭제 UI 없음
- 자기 자신의 권한 변경 등 실제 계약의 금지 조건 처리
- Password Reset의 멱등 Key와 1회성 초기 비밀번호 노출 범위를 실제 응답 계약에 맞춤

## Slice 6.6 — Kiosk 기기 수명주기

- Settings의 Kiosk Device Tab
- OWNER·MANAGER 등록
- 최초 Credential은 한 번만 노출하고 재표시·Log·영구 Store 저장 금지
- Rotate 시 새 Credential도 한 번만 노출
- Revoke 처리와 `REVOKED` 표시

## Slice 6.7 — Audit History

- `/pos/history` Audit Tab
- 기존 `AuditLogView`, Cursor Paging, Filter, 상세 재사용
- OWNER·MANAGER 접근
- 민감 Metadata Masking 유지

## Slice 6.8 — Security History

- History의 Security Tab
- 로그인 실패·Role/상태 변경 등 실제 계약 Event 조회
- Audit와 Security DTO·Paging 방식을 억지로 하나로 합치지 않음
- STAFF 접근 금지

## 기존 자산 처리

- `AuditLogView.vue`, `src/api/audit.ts`는 `/pos/history` Audit Tab 안에서 재사용하고 회귀 Test를 유지한다.
- `SalesClosingView`, `StaffManagementView`, `StoreSettingsView`의 `ManagementWorkspace` 정의는 실제 API 기반 View로 교체한다.
- Settings와 History는 Route 하나 아래 Tab을 사용하되, Tab별 API 오류와 Paging 상태를 서로 섞지 않는다.

## Phase 완료 체크

- [ ] Sales 조회·Daily Closing Role/Conflict Test
- [ ] Store 조회·수정·Inactive Test
- [ ] Employee 생성·Role·상태·Reset Test
- [ ] 마지막 활성 OWNER 보호 Test
- [ ] Kiosk 등록·Rotate·Revoke와 Credential 비노출 Test
- [ ] Audit Cursor·상세 회귀 Test
- [ ] Security History 권한·Paging Test
- [ ] Employee 생성·Password Reset 멱등 Test
- [ ] Sales int64 정밀도 Test
- [ ] Management Placeholder 제거
- [ ] 관련 E2E 추가 또는 각 Service/Edge Blocker 기록
- [ ] 공통 검증 명령 통과

다음 Phase: [Phase 7 — Kiosk](./PHASE_07_KIOSK.md)
