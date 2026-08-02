# Doro ERP Front

Doro ERP의 매장 직원 및 고객용 웹 인터페이스입니다. Vue 3의 Composition API와
TypeScript를 사용하며, Vite를 개발 서버 및 프로덕션 빌드 도구로 사용합니다.

현재 저장소는 Vue 프로젝트의 기본 개발 환경과 예제 화면이 구성된 초기 단계입니다.
실제 ERP 업무 기능은 요구사항에 따라 순차적으로 구현합니다.

## 기술 스택

| 구분 | 도구 | 용도 |
| --- | --- | --- |
| UI | Vue 3 | 컴포넌트 기반 사용자 인터페이스 |
| 언어 | TypeScript | 정적 타입 검사 |
| 빌드 | Vite | 개발 서버 및 프로덕션 번들 생성 |
| 라우팅 | Vue Router | SPA 화면 이동 |
| 상태 관리 | Pinia | 애플리케이션 상태 관리 |
| 단위 테스트 | Vitest, Vue Test Utils | 컴포넌트 및 로직 테스트 |
| E2E 테스트 | Playwright | 실제 브라우저 사용자 흐름 테스트 |
| 코드 품질 | ESLint, Oxlint | 정적 분석 및 자동 수정 |
| 포매팅 | Prettier | 코드 형식 통일 |

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

기본 개발 서버 주소는 `http://localhost:5173`입니다.

## 주요 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run build` | 타입 검사 후 프로덕션 빌드 생성 |
| `npm run preview` | 생성된 프로덕션 빌드 미리보기 |
| `npm run type-check` | Vue 및 TypeScript 타입 검사 |
| `npm run lint` | Oxlint와 ESLint 검사 및 자동 수정 |
| `npm run format` | `src/` 디렉터리를 Prettier로 포매팅 |
| `npm run test:unit` | Vitest 단위 테스트 실행 |
| `npm run test:e2e` | Playwright E2E 테스트 실행 |

## 테스트

단위 테스트를 실행합니다.

```sh
npm run test:unit
```

Playwright를 처음 사용할 때는 테스트용 브라우저를 설치해야 합니다.

```sh
npx playwright install
npm run test:e2e
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
├── e2e/                 # Playwright E2E 테스트
├── public/              # 빌드 과정 없이 제공되는 정적 파일
├── src/
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
├── vite.config.ts       # Vite 설정
└── vitest.config.ts     # Vitest 설정
```

`@` 별칭은 `src/` 디렉터리를 가리킵니다.

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

## 권장 개발 도구

- [Visual Studio Code](https://code.visualstudio.com/)
- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- Vue DevTools 브라우저 확장

Vetur가 설치되어 있다면 Vue - Official 확장과 충돌하지 않도록 비활성화합니다.
