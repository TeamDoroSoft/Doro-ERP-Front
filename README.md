# Doro ERP Front

Doro ERP의 매장 직원 및 고객용 웹 인터페이스입니다. Vue 3의 Composition API와
TypeScript를 사용하며, Vite를 개발 서버 및 프로덕션 빌드 도구로 사용합니다.

직원 POS와 고객 Kiosk의 Phase 01~07 Front 구현이 완료되어 있으며, Browser Route Mock 기반
회귀 테스트를 제공합니다. 실제 Edge·하위 Service·SQS·Toss Sandbox 종단 검증과 Mock UI 검증은
서로 다른 상태로 관리합니다.

## 기술 스택

| 구분        | 도구                   | 용도                             |
| ----------- | ---------------------- | -------------------------------- |
| UI          | Vue 3                  | 컴포넌트 기반 사용자 인터페이스  |
| 언어        | TypeScript             | 정적 타입 검사                   |
| 빌드        | Vite                   | 개발 서버 및 프로덕션 번들 생성  |
| 라우팅      | Vue Router             | SPA 화면 이동                    |
| 상태 관리   | Pinia                  | 애플리케이션 상태 관리           |
| 단위 테스트 | Vitest, Vue Test Utils | 컴포넌트 및 로직 테스트          |
| E2E 테스트  | Playwright             | 실제 브라우저 사용자 흐름 테스트 |
| 코드 품질   | ESLint, Oxlint         | 정적 분석 및 자동 수정           |
| 포매팅      | Prettier               | 코드 형식 통일                   |

## 사전 요구사항

- Node.js `^22.18.0` 또는 `>=24.12.0`
- npm

설치된 버전을 확인합니다.

```sh
node --version
npm --version
```

## 설치 및 실행

저장소 루트에서 의존성을 설치합니다.

```sh
npm install
```

개발 서버를 실행합니다.

```sh
npm run dev
```

Windows PowerShell에서는 동일 명령을 `npm.cmd run dev`처럼 실행할 수 있습니다.

기본 개발 서버 주소는 `http://localhost:5173`입니다.

## 주요 명령어

| 명령어                | 설명                                           |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Vite 개발 서버 실행                            |
| `npm run dev:admin`   | Provider Admin 전용 개발 서버 실행             |
| `npm run build`       | 타입 검사 후 프로덕션 빌드 생성                |
| `npm run build:admin` | 타입 검사 후 Provider Admin 전용 Artifact 생성 |
| `npm run preview`     | 생성된 프로덕션 빌드 미리보기                  |
| `npm run type-check`  | Vue 및 TypeScript 타입 검사                    |
| `npm run lint`        | Oxlint와 ESLint 검사 및 자동 수정              |
| `npm run format`      | `src/` 디렉터리를 Prettier로 포매팅            |
| `npm run test:unit`   | Vitest 단위 테스트 실행                        |
| `npm run test:e2e`    | Playwright E2E 테스트 실행                     |
| `npm run test:e2e:admin` | Provider Admin Browser Route Mock E2E 실행  |

## 테스트

단위 테스트를 실행합니다.

```sh
npm run test:unit
```

Playwright를 처음 사용할 때는 테스트용 브라우저를 설치해야 합니다.

```sh
npx playwright install
npm run test:e2e
npm run test:e2e:admin
```

특정 브라우저나 테스트 파일만 실행할 수도 있습니다.

```sh
npm run test:e2e -- --project=chromium
npm run test:e2e -- e2e/vue.spec.ts
npm run test:e2e -- --debug
```

CI 환경에서는 프로덕션 빌드를 먼저 생성한 뒤 E2E 테스트를 실행합니다.

```sh
npm run build
npm run test:e2e
```

## 프로젝트 구조

```text
Doro-ERP-Front/
├── admin.html            # Provider Admin 전용 HTML Entry
├── e2e/                 # Playwright E2E 테스트
├── public/              # 빌드 과정 없이 제공되는 정적 파일
├── src/
│   ├── admin/           # Provider Admin Entry·실제 Edge API UI·Unit Test
│   ├── assets/          # 스타일, 이미지 등의 소스 에셋
│   ├── components/      # 재사용 가능한 Vue 컴포넌트
│   │   └── __tests__/   # 컴포넌트 단위 테스트
│   ├── router/          # Vue Router 설정
│   ├── stores/          # Pinia 스토어
│   ├── views/           # 라우트 단위 화면
│   ├── App.vue          # 최상위 Vue 컴포넌트
│   └── main.ts          # 애플리케이션 진입점
├── eslint.config.ts     # ESLint 설정
├── playwright.config.ts # Playwright 설정
├── vite.admin.config.ts # Provider Admin 전용 dist-admin 빌드 설정
├── vite.config.ts       # Vite 설정
└── vitest.config.ts     # Vitest 설정
```

`@` 별칭은 `src/` 디렉터리를 가리킵니다.
일반 `npm run build`는 `dist/`에 POS·Kiosk Artifact를 만들고, `npm run build:admin`은
별도 Entry를 `dist-admin/`에 출력합니다. 생성된 두 디렉터리는 소스 구조가 아니라 빌드 산출물입니다.

업무 기능이 추가되면 `identity`, `store`, `catalog`, `inventory`, `order`,
`payment`, `notification` 경계를 유지하고 모듈 간 순환 의존성을 만들지 않습니다.

## 개발 규칙

- Vue 컴포넌트는 PascalCase로 이름을 지정합니다.
- 변수와 함수는 camelCase를 사용합니다.
- 새 컴포넌트는 Composition API와 `<script setup lang="ts">` 사용을 권장합니다.
- 정상 처리뿐 아니라 입력 검증, 권한, 중복 요청, 실패 흐름을 테스트합니다.
- 커밋 전 `npm run lint`, `npm run test:unit`, `npm run build`를 실행합니다.

## 환경 변수와 보안

로컬 전용 환경 변수는 `.env.local`에 작성합니다. 브라우저에서 사용해야 하는 값만
`VITE_` 접두사를 붙일 수 있으며, 이 값은 클라이언트 번들에 노출된다는 점에
주의해야 합니다.

시크릿, 결제 키, 개인정보 또는 값이 채워진 환경 파일은 커밋하지 않습니다. 결제 승인과
같이 인증정보가 필요한 API는 반드시 백엔드에서 호출합니다.

| 변수                     | 용도                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `VITE_EDGE_PROXY_TARGET` | 로컬 개발용 Vite `/api` Proxy 대상 Edge Runtime                                                                    |
| `VITE_TOSS_CLIENT_KEY`   | Browser 사용이 허용된 Toss 테스트 Client Key                                                                       |
| `VITE_PUBLIC_APP_ORIGIN` | 운영 POS Origin. 경로 없는 HTTPS Origin만 허용 (`https://doro.minseok.click`)                                       |
| `VITE_KIOSK_APP_ORIGIN`  | 운영 Kiosk 전용 Origin. 경로 없는 HTTPS Origin만 허용 (`https://kiosk.minseok.click`)                               |

운영 Build에서는 두 Origin을 모두 설정합니다. Kiosk Origin의 `/`와 허용되지 않은 경로는
`/kiosk/activate`로 정규화하고, POS Origin의 `/kiosk/**` 접근은 같은 경로·Query·Hash를 Kiosk
Origin으로 이동시킵니다. 공개 `/pay/**`도 Kiosk Origin에서 열리지만 직원·기기 인증 Guard와는
분리됩니다. 로컬 단일 Origin 개발에서는 두 값을 비울 수 있습니다.

Toss Secret Key, Kiosk Secret·Credential, HMAC Key는 `VITE_*` 환경 변수에 넣지 않습니다.

Browser API 요청은 운영에서 항상 same-origin `/api/v1`을 사용합니다. CloudFront의 `/api/*`
Behavior가 Public Edge Runtime으로 전달하며, 개별 업무 서비스 Origin을 Front Bundle에 넣지 않습니다.
로컬 개발에서는 `VITE_EDGE_PROXY_TARGET`이 가리키는 Edge Runtime으로 Vite가 `/api`를 Proxy합니다.

Provider Admin은 Public POS·Kiosk Artifact와 분리된 Entry 및 `dist-admin/` Artifact로 빌드합니다.
`npm run build`는 Admin Entry·Asset을 포함하지 않으며, `npm run build:admin`은 정적 Container
배포용 Admin Artifact만 생성합니다. Admin Artifact는 `/api/v1/provider/**`를 호출하므로
same-origin `/api`가 반드시 `admin` Profile로 실행한 Edge Runtime에 Routing되어야 합니다.
Public Edge Profile에서는 Provider Admin Route가 `503`으로 차단됩니다.

## GitHub Actions 배포

두 View Layer는 Build와 배포 대상을 공유하지 않습니다.

| Workflow            | Trigger                   | 결과                                                            |
| ------------------- | ------------------------- | --------------------------------------------------------------- |
| `verify-front.yml`  | Pull Request, `main` Push | Lint·Unit Test·Public/Admin Build 및 Admin Container Build 검증 |
| `deploy-public.yml` | 수동 실행                 | Public `dist/`를 S3에 동기화하고 CloudFront Cache 무효화        |
| `publish-admin.yml` | `main` Push, 수동 실행    | Provider Admin Image를 ECR에 게시하고 GitOps Release PR 생성    |

AWS 인증은 Access Key 대신 GitHub OIDC와 `prod` Environment에 제한된 최소 권한 IAM Role을
사용합니다. 두 Workflow는 선택 가능한 배포 환경을 받지 않고 `prod` Environment로만 실행합니다.

Public Front 배포 Role, Provider Admin ECR 게시 Role과 대상 S3·CloudFront·ECR Resource는 Infra
저장소에서 먼저 생성해야 합니다. 두 Workflow는 서로의 권한과 기존 Service Image 게시 Role을
공유하지 않습니다.

| Variable                              | Workflow      | 용도                                           |
| ------------------------------------- | ------------- | ---------------------------------------------- |
| `AWS_REGION`                          | Public, Admin | AWS Region. 생략 시 `ap-northeast-2`           |
| `AWS_FRONTEND_DEPLOY_ROLE_ARN`        | Public        | Public Front 전용 S3·CloudFront 배포 Role      |
| `AWS_ADMIN_ECR_PUSH_ROLE_ARN`         | Admin         | Provider Admin 전용 ECR 게시 Role              |
| `FRONTEND_S3_BUCKET`                  | Public        | `dist/` 전용 S3 Bucket 이름                    |
| `FRONTEND_CLOUDFRONT_DISTRIBUTION_ID` | Public        | 배포 후 무효화할 Distribution ID               |
| `FRONTEND_ECR_REPOSITORY`             | Admin         | Provider Admin ECR Repository 이름             |
| `PUBLIC_TOSS_CLIENT_KEY`              | Public        | Browser 공개가 허용된 Toss Client Key          |
| `PUBLIC_APP_ORIGIN`                   | Public        | POS 전용 HTTPS Origin                           |
| `KIOSK_APP_ORIGIN`                    | Public        | Kiosk 전용 HTTPS Origin                         |
| `GITOPS_APP_ID`                       | Admin         | GitOps 쓰기 권한이 있는 GitHub App ID          |

Admin Workflow에는 `prod` Environment Secret `GITOPS_APP_PRIVATE_KEY`도 필요합니다. GitHub App은
`Doro-ERP-GitOps` 저장소의 Contents와 Pull requests에 `Read and write` 권한을 가져야 합니다.

Admin Workflow는 Private EKS API에 직접 접속하지 않습니다. ECR 게시 후 GitOps Release PR을 만들고,
승인된 PR이 병합되면 Argo CD가 Provider Admin Deployment와 ClusterIP Service를 자동 Rollout합니다.
Admin Nginx는 `/api/`를 같은 Namespace의 `edge-api:8080`으로 전달합니다. 외부 Route와 DNS는 만들지
않으며 SSM 관리 경로의 `kubectl port-forward`로만 접근합니다. Admin API Client와 OIDC Session UI는
구현됐지만 실제 Browser E2E 검증 완료를 의미하지 않습니다.

## 주요 Route

- 직원 POS: `/pos/login`, `/pos/orders`, `/pos/queues/entry`, `/pos/queues/fulfillment`,
  `/pos/catalog`, `/pos/tables`, `/pos/sales`, `/pos/settings`, `/pos/history`
- 고객 Kiosk: `/kiosk/activate`, `/kiosk/order`, `/kiosk/waiting`, `/kiosk/payment`
- 주문 Kiosk 내부 흐름: `/kiosk/cart`, `/kiosk/checkout` (기기 내 Toss 직접 결제는 폐기)
- 고객 모바일 Checkout: `/pay/:publicId`, `/pay/:publicId/success`, `/pay/:publicId/fail`
- DEV Preview는 개발 빌드에서만 제공되며 Production 인증 우회 수단이 아닙니다.

Kiosk Runtime을 서버에서 다시 확인해 `ORDER`, `ENTRY_QUEUE`, `PAYMENT` 전용 Route로 분기합니다.
주문 Kiosk는 테이블이나 내부 상태를 노출하지 않고 페어링된 결제 Kiosk로 Handoff하며, 결제
Kiosk는 일회용 Token을 저장하지 않고 실제 QR만 표시합니다. 공개 Checkout Route는 Fragment와
Toss Redirect Query를 즉시 제거한 뒤 Resolve·Start·Confirm·Status 계약을 사용합니다. 직원 주문의
`PAY_NOW`·`PAY_LATER`, 결제 Kiosk 인계와 Table Session 서버 합계도 연결되어 있습니다. 이 구현과
Browser Mock 통과는 실제 배포 Cookie·Edge·Toss Test Mode 종단 검증 완료를 의미하지 않습니다.

## 검증 경계와 현재 상태

| 영역                            | Front               | 실제 통합 상태        | 근거·Blocker                                                                                  |
| ------------------------------- | ------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| POS Shell·Auth                  | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Front·Edge Route 연결 완료, 실제 배포 Session Runtime 미검증                                  |
| Order                           | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Front·Edge Order와 Table Route 연결 완료, 실제 Runtime·AWS 연동 미검증                        |
| Catalog                         | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | 판매 메뉴와 Category·Product 관리 Edge Route 연결 완료, 실제 Runtime·AWS 연동 미검증          |
| Table·Queue·Sales·POS 운영 화면 | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Front 호출과 Edge Route 계약 정합성 확인 완료, 실제 Runtime 종단 검증 미완료                  |
| Provider Admin                  | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Admin API Client·OIDC Session UI·Unit·Mock Browser E2E 구현, 실제 OIDC·Production 배포는 미검증 |
| Payment                         | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Edge Route 연결 완료, 실제 Runtime·Toss Sandbox 미검증                                        |
| Audit                           | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Edge Route 연결 완료, 실제 Runtime 미검증                                                     |
| Kiosk                           | `FRONT_IMPLEMENTED` | `INTEGRATION_BLOCKED` | Front·Edge Kiosk Route 연결 완료, 실제 기기 Credential 종단 검증 미완료                       |

Playwright 테스트는 Browser Route Mock 기반 `mock-ui` 검증입니다. 실제 Edge를 사용하는
`edge-integration`이나 Toss Test Provider까지 사용하는 `provider-sandbox` 통과를 의미하지 않습니다.
Provider Admin E2E도 실제 Admin Entry와 API Client를 Chromium에서 실행하지만 API 응답은 Browser
Route Mock이므로 실제 OIDC·Admin Runtime·Production 검증을 의미하지 않습니다.

Legacy `/admin/**`, `/payments/test` 경로는 호환을 위해 Query와 Hash를 폐기한 뒤 안전한 POS Route로
Redirect합니다. 외부 사용 종료가 확인되기 전까지 유지합니다.

## 권장 개발 도구

- [Visual Studio Code](https://code.visualstudio.com/)
- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- Vue DevTools 브라우저 확장

Vetur가 설치되어 있다면 Vue - Official 확장과 충돌하지 않도록 비활성화합니다.
