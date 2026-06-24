# 웨네버 출시 체크리스트

## 공개 URL

- 개인정보처리방침 URL: `https://wenever-privacy.netlify.app/`
- Google Play 계정 삭제 웹 링크: `https://wenever-privacy.netlify.app/#delete-account`
- 지원 이메일: `support@wenever.app`

## EAS

- 프로젝트: `@junsu0665/wenever`
- EAS project ID: `b125997a-10ed-4b1e-92b9-a435bd345b2b`
- Android package: `com.wenever.app`
- iOS bundle ID: `com.wenever.app`
- Android production build ID: `b3fe55aa-6969-4fc4-8005-e6108aa45868`
- Android production build logs: `https://expo.dev/accounts/junsu0665/projects/wenever/builds/b3fe55aa-6969-4fc4-8005-e6108aa45868`

## Google Play Console 입력값

- 앱 이름: `웨네버`
- 광고 포함: 예
- 개인정보처리방침: `https://wenever-privacy.netlify.app/`
- 계정 삭제 URL: `https://wenever-privacy.netlify.app/#delete-account`
- 앱 액세스: 심사용 로그인 계정이 필요합니다.
- Data safety에는 계정 정보, 이메일, 이름, 학교/학년/반, 사진 또는 이미지, 게시글/댓글/신고, 앱 상호작용, 광고 이벤트, 알림 토큰 처리를 반영합니다.

## App Store Connect 입력값

- 앱 이름: `웨네버`
- Bundle ID: `com.wenever.app`
- 개인정보처리방침 URL: `https://wenever-privacy.netlify.app/`
- 지원 URL: `https://wenever-privacy.netlify.app/#contact`
- 앱 내 계정 삭제 경로: `프로필 > 계정 삭제`
- App Privacy에는 계정 정보, 연락처 정보, 사용자 콘텐츠, 식별자 또는 사용 데이터 성격의 광고 이벤트 처리를 반영합니다.

## 아직 사람 손이 필요한 항목

- 운영 EAS 환경변수에 Supabase, NEIS, AdMob 실제 값을 모두 설정합니다.
- `EXPO_PUBLIC_ALLOW_MOCKS=false`, `EXPO_PUBLIC_OCR_PROVIDER=endpoint`, `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false` 상태로 production build를 만듭니다.
- iOS production build는 Apple Developer 로그인, 2FA, `APPLE_TEAM_ID` EAS secret이 필요합니다. 이 값이 없으면 `ios.appleTeamId` 경고가 나며 iOS 빌드가 실패할 수 있습니다.
- `app.config.js` production guard가 요구하는 환경변수 전체가 EAS production environment에 들어 있는지 확인합니다.
- Play Store 제출 자동화는 Google Play service account JSON 또는 수동 업로드가 필요합니다.
- 심사용 계정과 스토어 스크린샷을 준비해야 합니다.

## 최종 로컬 확인 명령

```sh
npm run typecheck
npx expo-doctor
npx expo export -p web
```

`npx expo export -p web`은 공개 정책 페이지가 아니라 앱 web export 확인용입니다. 스토어용 공개 정책 페이지는 `netlify.toml` 기준으로 `site/privacy`를 배포합니다.
