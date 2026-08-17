# 보안 스크리닝 & Firebase 접근 제어

점검일 기준 요약. 시크릿은 코드에 넣지 말고 `.env.local`만 사용한다. DB는 **Firebase만** 사용한다 (Supabase 미사용).

## 1. 하드코딩 스크리닝 결과

| 항목 | 결과 |
|---|---|
| API 키 / Secret / 비밀번호 리터럴 | **없음** (`process.env`만) |
| Git에 추적된 `.env` / credentials | **없음** |
| `.env.example` | 키 이름만, 값은 비어 있음 (허용) |
| `/api/config`의 `GOOGLE_CLIENT_ID` | OAuth **공개** 클라이언트 ID (의도적). Secret·Gemini 키는 미포함 |

서버 사용처:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`(옵션), `GEMINI_API_KEY` → `src/api/*` + `.env.local`

## 2. `.gitignore`

포함: `.env`, `.env.local`, `.env.*`, `node_modules/`, `build/`, `dist/`, `.next/`, `*.lic`, `firebase-adminsdk*.json` 등.

## 3. Firebase Security Rules

현재 앱은 Firestore를 쓰지 않고 **메모리 세션**이다. Firebase Auth + Firestore를 붙일 때 아래를 적용한다.

- 규칙 예시: [`docs/firebase-security-rules.examples`](firebase-security-rules.examples)

원칙:
1. 컬렉션 기본 deny, 본인(`request.auth.uid`)만 CRUD.
2. 브라우저에는 Firebase **웹 설정(공개)**만. Admin SDK / 서비스 계정은 서버 `.env.local`만.
3. Supabase·Postgres RLS는 사용하지 않는다.
