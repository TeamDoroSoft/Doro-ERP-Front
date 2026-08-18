# Phase 8. 종단 품질·안정화

## 목표

이전 Phase에서 이미 작성한 Test를 기반으로 공통 예외 UX, 접근성, 반응형, 핵심 종단 Flow와 Release 검증을 마무리한다. 기능 Test를 이 Phase까지 미루지 않는다.

관련 요구사항: 전 Phase의 Front 수용 기준, `FR-EDGE-001`~`FR-EDGE-005`, `FR-AUDIT-004`, `FR-AUDIT-006`

## 선행 조건

- [Phase 1](./PHASE_01_POS_SHELL.md)부터 [Phase 7](./PHASE_07_KIOSK.md)까지 Front 구현 완료
- [공통 구현 계약](./00_COMMON_CONTRACT.md)
- 각 Phase의 Integration Blocker 목록

## Slice 8.1 — 공통 Feedback 정리

- Loading·Empty·Field Error·Network Error Component 일관성
- `401`, `403`, `404`, `409`, `503` 사용자 안내
- Store Inactive, `REVIEW_REQUIRED`, Event Lag 표준 Pattern
- 업무별 필요한 Action과 재시도만 제공
- 오류 상세에 민감정보가 노출되지 않는지 확인

## Slice 8.2 — 접근성·반응형

- POS Desktop·Tablet Layout
- Kiosk 가로/세로 Touch Layout
- Keyboard Focus, Label, Dialog Focus Trap, Color Contrast
- Status를 색상만으로 전달하지 않음
- 긴 한국어 Label·큰 금액·Empty/Error 문구 Overflow 확인

## Slice 8.3 — 회귀·상태 복구

- 새로고침·뒤로가기·Bookmark
- 로그인 만료와 원래 목적지 복귀
- 중복 Click·Network 재시도·Idempotent Replay
- Callback 중 새로고침
- Event 지연 후 자동/수동 재조회
- Kiosk 다음 고객 Session 초기화

## Slice 8.4 — 핵심 Playwright E2E

최소 Flow:

1. 직원 로그인 → 주문 생성 → 결제 → Queue READY → 주문 완료
2. 직원 `CREATED` 주문의 결제 전 취소
3. 직원 `PAID` Payment 전액 취소와 Event 반영
4. Entry 등록 → 입장, 취소, 미방문
5. OWNER·MANAGER·STAFF Role별 관리 접근
6. Kiosk 메뉴 → 장바구니 → Checkout → 결제 → 주문 상태
7. `REVIEW_REQUIRED`, `409`, `503`와 Session 만료

실제 Backend가 필요한 Scenario와 Mock Browser Scenario를 명확히 이름으로 구분한다.

각 Scenario 이름 또는 Test Tag에 다음 실행 경계를 표시한다.

- `mock-ui`: Browser 내부 Route Mock으로 UI 연결만 검증
- `edge-integration`: 실제 Edge와 하위 Runtime을 사용
- `provider-sandbox`: Toss Test 환경까지 포함

`mock-ui` 통과를 실제 결제·SQS·Session 종단 검증으로 보고하지 않는다.

## Slice 8.5 — Release 검증

```bash
npm run type-check
npm run lint
npm run test:unit -- --run
npm run build
npm run test:e2e
```

- Lint 자동 수정 전후 Diff 확인
- 실제 환경이 없어 E2E 일부를 실행하지 못하면 미실행으로 기록
- 사용하지 않는 Admin Route·Placeholder·Test 결제 Navigation 제거 확인
- 환경 변수 문서와 Screenshot 갱신
- Secret·Token·개인정보가 Git Diff와 Build Artifact에 없는지 확인

## Slice 8.6 — 문서·운영 인계

- README의 실제 Route·환경 변수·개발 명령 갱신
- Phase별 최종 상태와 Edge·SQS·Provider Blocker 표 갱신
- UI 변경 Screenshot을 Role·Viewport·상태와 함께 기록
- 제거된 Legacy Route와 호환 Redirect 종료 조건 기록
- 배포 설정을 임의 생성하지 않고 Infra 준비 상태를 정확히 기술

### UI Screenshot 기록

아래 이미지는 실제 Integration 증거가 아니라 Playwright `mock-ui` fixture로 생성한 UI·반응형 기록이다. 실제 개인정보, 운영 Tenant, Credential, Token, `paymentKey`, Authorization, Cookie는 포함하지 않는다.

| 파일 | Role | Viewport | State |
| --- | --- | --- | --- |
| `screenshots/phase08/pos-owner-order-detail-desktop-paid.png` | OWNER | Desktop 1280px | 주문 접수·결제 완료 |
| `screenshots/phase08/pos-manager-queue-tablet-waiting.png` | MANAGER | Tablet 1024px | 입장 대기 |
| `screenshots/phase08/pos-owner-catalog-desktop.png` | OWNER | Desktop 1280px | 상품 활성·품절 혼합 |
| `screenshots/phase08/pos-owner-sales-desktop.png` | OWNER | Desktop 1280px | 영업일 선택 전 Empty |
| `screenshots/phase08/kiosk-menu-landscape.png` | Kiosk customer | Landscape 1366×768 | 메뉴 탐색 |
| `screenshots/phase08/kiosk-checkout-portrait.png` | Kiosk customer | Portrait 768×1024 | 포장 선택 |
| `screenshots/phase08/kiosk-order-status-portrait-ready.png` | Kiosk customer | Portrait 768×1024 | 결제 완료·준비 완료 |

## 최종 완료 체크

- [x] 모든 Phase의 완료 체크와 상태 기록
- [x] 공통 Feedback·접근성·반응형 검증
- [x] 핵심 POS Mock UI E2E
- [x] 핵심 Kiosk Mock UI E2E와 명확한 CTX-006-K Blocker
- [x] 전체 명령 통과
- [x] API 직접 Service 호출·Production Fake·임시 Proxy 없음
- [x] 상태값·Role·Route가 정본과 일치
- [x] 변경 UI Screenshot과 작업 보고 완료
- [x] README와 Phase 상태표가 최종 코드와 일치
- [x] Mock·Edge·Provider 검증 결과가 구분되어 있음
