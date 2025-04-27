# Firebase 웹앱 구축 TODO

## 1. Firebase 프로젝트 준비
- [x] Firebase 콘솔에서 프로젝트 생성 및 웹앱 등록 (FunTalk, ID: fairytale-186ee, 앱ID: 1:226743877675:web:6942fe5e5f7fd566626a6e)
- [ ] Firebase Hosting 활성화 및 도메인 설정
- [ ] Firestore Database 활성화 (테스트/프로덕션 모드 선택)
- [ ] Firebase Storage 활성화
- [ ] (선택) Firebase Authentication 활성화 (구글 등 소셜 로그인)

## 2. 환경설정 및 초기화
- [x] Firebase SDK 설정 방법 확인 및 앱ID 발급 완료
- [ ] Firebase SDK npm 설치 또는 CDN 추가
- [ ] `firebaseConfig` 정보로 프로젝트 연결
- [ ] `.env` 또는 `config.js`에 환경변수(API 키 등) 관리
- [ ] Firestore/Storage 인스턴스 준비

## 3. 데이터 구조 설계
- [ ] Firestore: `stories` 컬렉션 설계 (title, text, imageUrl, audioUrl, createdAt 등)
- [ ] Storage: 이미지, 오디오 파일 저장 경로 규칙 정의

## 4. 기능 개발
- [ ] 스토리 생성 시 이미지/오디오 파일 Storage 업로드
- [ ] 업로드된 파일의 다운로드 URL Firestore에 저장
- [ ] Firestore에 스토리 메타데이터 저장
- [ ] 스토리 목록/상세 조회 기능 구현
- [ ] 오디오(mp3), 이미지 렌더링 및 재생 UI 구현
- [ ] (선택) 스토리 삭제/수정, 즐겨찾기 등 부가 기능

## 5. 권한 및 보안 설정
- [ ] Firestore/Storage 보안 규칙 작성 (읽기/쓰기 제한)
- [ ] (선택) 인증 유저만 업로드/삭제 가능하도록 제한

## 6. 배포 및 테스트
- [ ] `firebase.json` 환경설정 (public 디렉토리 등)
- [ ] `firebase deploy`로 웹앱 배포
- [ ] 실제 배포 사이트에서 기능 테스트

## 7. 추가 개선 아이디어
- [ ] 스토리 갤러리/공유/다운로드 기능
- [ ] 유저별 마이페이지/관리자 페이지
- [ ] 인기/추천 스토리, 태그, 검색 등

---

**[진행상황]**
- Firebase 프로젝트 생성 및 웹앱 등록, 앱ID 발급까지 완료했습니다.
- 다음 단계: SDK 설치 및 초기화, Firestore/Storage 활성화, config.js에 firebaseConfig 정보 추가

**각 단계별로 체크하며 진행하세요! 필요시 세부 코드/설정 예시도 요청하실 수 있습니다.**
