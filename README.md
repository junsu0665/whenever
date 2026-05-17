# 웨네버

고교학점제 고등학생을 위한 모바일 전용 Expo 앱 MVP입니다. 컨셉은 학교 인증 기반 익명 커뮤니티와 시간표 중심 생활 앱입니다.

## 실행

```sh
npm install
npm run ios
```

Android는 `npm run android`로 실행합니다.

## 현재 구현

- 하단 탭: 홈, 시간표, 게시판, 급식, 내정보, 관리자
- Supabase Auth 기반 로그인/회원가입/프로필 생성
- 학생증 업로드 기반 인증 상태 흐름과 승인 전 앱 사용 차단
- 학생증 반려 사유 노출과 재제출 플로우
- 관리자 화면: 신고 관리, 사용자 관리, 글 관리, 학생증 인증 승인/반려
- 학교 인증 익명 게시판과 같은 수강자 게시판
- 게시글 상세 보기, 조회수/공감/댓글, 익명 댓글 작성과 댓글 공감/신고
- 내 글/내 댓글, 내 글/댓글 삭제와 게시판 페이지 단위 더보기
- 인기글 가중치 랭킹, 게시판 검색, 북마크
- 하단 시트 기반 익명 글쓰기 화면
- Supabase Edge Function 기반 시간표 OCR
- 월-금 전체 시간표 그리드 보기, 수업 수동 추가/삭제, 학기 라벨
- 친구 시간표 겹침 ON/OFF 설정
- NEIS 급식 중식/석식 동기화와 캐시
- 급식 날짜 이동
- 같은 학교/학년/과목 시험별 익명 성적 제보, 현재 상위 점수, 5등급제 상위 10% 현황
- Supabase Edge Function 기반 성적 AI 참고 예측
- 앱 실행/하단 배너/촬영 화면/성적 분석 대기/게시판 네이티브 스폰서 광고 슬롯
- 광고 노출/클릭/숨김/신고 이벤트 기록 초안과 광고 수익화 DB migration
- Expo push token 저장, 시간표/급식 로컬 예약, 댓글 서버 푸시 endpoint
- 관리자 운영 지표, 신고 사유 통계, 부정 사용 신호
- Supabase analytics event와 전역 앱 오류 로그 초안
- Supabase 연결 준비와 RLS migration 초안

## 환경변수

`.env.example`을 기준으로 값을 채우면 mock provider에서 실제 provider로 전환할 수 있습니다.

```sh
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_OCR_PROVIDER=endpoint
EXPO_PUBLIC_OCR_ENDPOINT=
EXPO_PUBLIC_SCORE_PREDICTION_ENDPOINT=
EXPO_PUBLIC_COMMUNITY_PUSH_ENDPOINT=
EXPO_PUBLIC_ALLOW_MOCKS=false
EXPO_PUBLIC_NEIS_API_KEY=
EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT=
EXPO_PUBLIC_SUPPORT_EMAIL=
ADMOB_ANDROID_APP_ID=
ADMOB_IOS_APP_ID=
EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID=
EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID=
EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID=
EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID=
```

## 시간표 AI 인식

운영 배포에서는 앱에 OpenAI 키를 넣지 않습니다. `EXPO_PUBLIC_OCR_PROVIDER=endpoint`와 Supabase Edge Function URL인 `EXPO_PUBLIC_OCR_ENDPOINT`를 사용하세요.

개발 mock은 `EXPO_PUBLIC_ALLOW_MOCKS=true`일 때만 동작합니다. preview/production 빌드는 `eas.json`에서 mock이 꺼져 있으므로 Supabase 환경변수가 없으면 앱이 운영 설정 누락 화면에서 멈춥니다.

## Supabase

초기 DB 계약은 `supabase/migrations/20260512000000_wenever_mvp.sql`에 있고, 출시용 보강과 성적 제보 계약은 `supabase/migrations/20260514000000_launch_p0.sql`, `supabase/migrations/20260514010000_launch_p1.sql`, `supabase/migrations/20260514020000_remove_friend_add.sql`, `supabase/migrations/20260514030000_launch_operations.sql`, `supabase/migrations/20260516000000_score_reports.sql`, `supabase/migrations/20260516010000_fix_score_exam_create.sql`에 있습니다.

운영 전 체크리스트:

```sh
supabase functions deploy ocr-timetable
supabase functions deploy score-predictor
supabase functions deploy delete-account
supabase functions deploy grant-admin
supabase functions deploy community-push
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set OPENAI_SCORE_MODEL=gpt-4o-mini
supabase secrets set ADMIN_BOOTSTRAP_TOKEN=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function에 기본 제공되는 예약 secret입니다. Dashboard Secrets 화면에서 직접 추가하지 않습니다.

- 앱 환경변수 `EXPO_PUBLIC_OCR_PROVIDER=endpoint`
- 앱 환경변수 `EXPO_PUBLIC_OCR_ENDPOINT=https://<project>.functions.supabase.co/ocr-timetable`
- 앱 환경변수 `EXPO_PUBLIC_SCORE_PREDICTION_ENDPOINT=https://<project>.functions.supabase.co/score-predictor`
- 앱 환경변수 `EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT=https://<project>.functions.supabase.co/delete-account`
- 앱 환경변수 `EXPO_PUBLIC_COMMUNITY_PUSH_ENDPOINT=https://<project>.functions.supabase.co/community-push`
- 운영 mock 차단: `EXPO_PUBLIC_ALLOW_MOCKS=false`

## Google AdMob 광고

모바일 앱 광고는 AdSense가 아니라 AdMob으로 연동합니다. `react-native-google-mobile-ads`는 네이티브 SDK를 포함하므로 Expo Go에서는 실제 광고가 뜨지 않고 EAS development/preview/production 빌드가 필요합니다.

개발/검수 빌드는 기본 Google 테스트 App ID와 테스트 광고 단위를 사용합니다. 운영 배포 전에는 AdMob 콘솔에서 Android/iOS App ID와 광고 단위 ID를 발급받아 EAS 환경변수에 넣고 `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`로 설정합니다.

```sh
eas secret:create --scope project --name ADMOB_ANDROID_APP_ID --value ca-app-pub-...~...
eas secret:create --scope project --name ADMOB_IOS_APP_ID --value ca-app-pub-...~...
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID --value ca-app-pub-.../...
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID --value ca-app-pub-.../...
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID --value ca-app-pub-.../...
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID --value ca-app-pub-.../...
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_USE_TEST_ADS --value false
```

Android 출시 전 Google Play Console의 앱 콘텐츠 정책 항목에서 광고 포함 여부를 `예`로 표시해야 합니다.

## 관리자 권한 부여

권장 절차는 `grant-admin` Edge Function입니다.

1. 운영자가 앱에서 회원가입과 프로필 생성을 완료합니다.
2. Supabase secret에 `ADMIN_BOOTSTRAP_TOKEN`을 설정합니다.
3. 운영자 로그인 세션의 access token으로 `grant-admin`에 `bootstrapToken`을 POST합니다.
4. 함수가 현재 로그인 사용자만 `is_admin=true`, `verification_status=approved`, `account_status=active`로 승격합니다.

SQL Editor로 긴급 처리해야 할 때만 `supabase/admin_bootstrap.sql`의 이메일을 바꿔 1회 실행합니다.

## 정책

약관, 개인정보 처리, 학생증 이미지 보관, 탈퇴 데이터 삭제 정책 초안은 `LEGAL.md`에 있습니다. 실제 출시 전에는 회사/운영 주체명, 연락처, 보관 기간, 법적 고지 문구를 확정해야 합니다.
