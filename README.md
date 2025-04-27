# FunTalk - 포메에게 물어봐

Gemini API와 Firebase를 사용하여 만든 AI 동화 생성 애플리케이션입니다. 사용자가 질문이나 주제를 입력하면, 귀여운 포메라니안 캐릭터가 등장하는 짧은 동화와 관련 이미지를 생성하고 TTS 음성으로 들려줍니다.

## 주요 기능

*   텍스트 입력 기반 동화 및 이미지 생성 (Gemini API)
*   장면별 이미지 슬라이드쇼
*   생성된 이야기 및 이미지 저장 (Firebase Firestore, Storage)
*   생성된 이야기 TTS 음성 생성 및 저장 (OpenAI TTS API, Firebase Functions, Storage)
*   갤러리에서 저장된 이야기 조회 및 음성 듣기
*   사용자 인증 (Firebase Authentication)

## 기술 스택

*   **Frontend:** HTML, CSS, JavaScript
*   **Backend:** Firebase (Hosting, Firestore, Storage, Functions, Authentication)
*   **AI APIs:**
    *   Google Gemini API (Text & Image Generation)
    *   OpenAI TTS API (Text-to-Speech)

## 실행 방법

1.  저장소를 클론합니다.
2.  Firebase 프로젝트 설정 및 API 키 설정:
    *   Firebase 프로젝트를 생성하고 필요한 서비스(Hosting, Firestore, Storage, Functions, Authentication)를 활성화합니다.
    *   `firebaseConfig.js` 파일에 자신의 Firebase 프로젝트 설정 정보를 입력합니다.
    *   `config.js` 파일에 Gemini API 키 (`GEMINI_API_KEY`)를 입력합니다. (`.gitignore`에 추가 권장)
    *   Firebase Functions 환경 변수 또는 비밀 관리자에 OpenAI API 키 (`OPENAI_API_KEY`)와 Gemini API 키 (`GEMINI_API_KEY`)를 설정합니다.
3.  필요한 npm 패키지를 설치합니다 (Cloud Functions).
    ```bash
    cd functions
    npm install
    cd ..
    ```
4.  Firebase CLI를 사용하여 프로젝트를 배포합니다.
    ```bash
    firebase deploy
    ```
5.  배포된 Hosting URL로 접속합니다.

## 참고

*   Firebase Storage CORS 설정이 필요할 수 있습니다.
*   Firestore 색인이 필요할 수 있습니다 (갤러리 조회 시). 