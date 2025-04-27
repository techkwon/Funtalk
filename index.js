// index.js 최상단 로그
console.log('[index.js] 파일 시작');

// --- 전역 변수 선언 --- 
let GEMINI_API_KEY = '';
let genAI = null;
let chat = null;

// --- GoogleGenerativeAI 임포트 (동적) ---
let GoogleGenerativeAI = null;

// --- API 키 로드 및 클라이언트 초기화 함수 --- 
async function initializeGeminiClient() {
  // GoogleGenerativeAI SDK 동적 임포트
  if (!GoogleGenerativeAI) { 
    try {
      const genAIModule = await import("https://esm.run/@google/generative-ai");
      GoogleGenerativeAI = genAIModule.GoogleGenerativeAI;
      console.log('GoogleGenerativeAI SDK 로드 완료');
    } catch (sdkError) {
       console.error('GoogleGenerativeAI SDK 로드 실패:', sdkError);
       alert('AI 라이브러리 로드에 실패했습니다. 네트워크 연결을 확인하고 페이지를 새로고침 해보세요.');
       return; // SDK 로드 실패 시 초기화 중단
    }
  }
  
  // API 키 로드
  if (!GEMINI_API_KEY) { // API 키가 이미 로드되었는지 확인
     try {
       const config = await import('./config.js');
       if (config && config.GEMINI_API_KEY) {
         GEMINI_API_KEY = config.GEMINI_API_KEY;
       } else {
         // 2. window 객체에서 가져오기 (대체)
         if (typeof window !== 'undefined' && window.GEMINI_API_KEY) {
           GEMINI_API_KEY = window.GEMINI_API_KEY;
         }
       }
     } catch(e) {
       console.warn('config.js 로드 실패 또는 API 키를 찾을 수 없음:', e);
     }
  }

  if (!GEMINI_API_KEY) {
    console.error(' 중요: Gemini API 키가 정의되지 않았습니다! config.js 또는 window.GEMINI_API_KEY를 설정해주세요.');
    console.warn('⚠️ 경고: API 키를 클라이언트 코드에 직접 노출하는 것은 보안 위험이 있습니다. 서버 측에서 처리하는 것이 좋습니다.');
    return; // API 키 없으면 초기화 중단
  }

  // 3. API 키 로드 성공 후 클라이언트 초기화
  if (GoogleGenerativeAI) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp-image-generation",
        generationConfig: {
           response_modalities: ["TEXT", "IMAGE"] // 텍스트와 이미지 응답 명시적 요청
        }
      });
      chat = model.startChat({
        generationConfig: {
           response_modalities: ["TEXT", "IMAGE"] // 텍스트와 이미지 응답 명시적 요청
        }
      });
      console.log('Gemini AI 클라이언트 초기화 완료 (모델: gemini-2.0-flash-exp-image-generation, 모달리티 설정됨)');
    } catch (initError) {
       console.error('Gemini AI 클라이언트 초기화 중 오류 발생:', initError);
       alert('Gemini 클라이언트 초기화에 실패했습니다. API 키가 올바른지 확인하세요.');
    }
  } else {
    console.error('GoogleGenerativeAI SDK가 로드되지 않았습니다.');
    alert('AI 라이브러리를 로드하지 못했습니다. 페이지를 새로고침 해보세요.');
  }
}

// --- 비동기 초기화 실행 --- 
initializeGeminiClient(); 

// --- 나머지 코드 (import, Firebase 설정 등) --- 
import { marked } from 'https://esm.sh/marked@^15.0.7';
import { getAuth, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, addDoc, query, getDocs, where, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { db, storage } from "./firebaseConfig.js";

const auth = getAuth();

// --- DOMContentLoaded 보장 및 generate 방어 ---
if (document.readyState === 'loading') {
  window._domReady = false;
  document.addEventListener('DOMContentLoaded', () => {
    window._domReady = true;
  });
} else {
  window._domReady = true;
}

console.log('index.js script loaded');

function debugLog(msg) {
    console.log('[DEBUG]', msg);
}

// --- 슬라이드 추가 함수 (복구 및 수정) ---
async function addSlide(text, imageData) {
  debugLog('addSlide 호출됨');
  const slideshow = document.querySelector('#slideshow');
  if (!slideshow) return;
  slideshow.removeAttribute('hidden');
  const slide = document.createElement('div');
  slide.className = 'slide';
  
  // 캡션 생성
  const caption = document.createElement('div');
  caption.innerHTML = await marked.parse(text);
  
  // 이미지 생성 (Base64 데이터 사용)
  let imgElement = null;
  if (imageData) {
      imgElement = document.createElement('img');
      imgElement.src = `data:image/png;base64,${imageData}`; // MIME 타입은 필요시 조정
      // 이미지 스타일 추가 (기존 CSS 또는 인라인)
      imgElement.style.width = '90%'; 
      imgElement.style.maxHeight = '220px';
      imgElement.style.borderRadius = '10px';
      imgElement.style.margin = '16px 0 8px 0';
  } else {
      console.warn('addSlide: 이미지 데이터가 없습니다.');
      // 이미지가 없을 경우 대체 텍스트나 아이콘 표시 가능
  }
  
  // 슬라이드에 이미지(있다면)와 캡션 추가
  if (imgElement) {
      slide.append(imgElement);
  }
  slide.append(caption);
  slideshow.append(slide);

  // --- 스토리 저장 준비 (allStories 배열 채우기) ---
  // saveStoryToFirestore 함수는 이제 base64 데이터를 받거나, 
  // Cloud Function에서 Storage 업로드 후 URL을 반환받아 사용하도록 수정 필요.
  // 우선 allStories에는 base64 데이터와 텍스트 저장.
  allStories.push({ text, imageData }); 
  
  // --- 저장 및 TTS 버튼 활성화 (스토리 데이터 준비 완료) ---
  const saveBtn = document.getElementById('save-story-btn');
  const ttsBtn = document.getElementById('tts-gen-btn');
  if (saveBtn) saveBtn.disabled = false;
  if (ttsBtn) ttsBtn.disabled = false;
}

let lastStoryText = '';
let lastStoryImageUrl = '';
let allStories = [];
let storyTitle = '';

// --- generate 함수 수정: 클라이언트 측 Gemini 호출 --- 
async function generate(message) {
  // --- 페이지 로드, 메시지 유효성, API 클라이언트 확인 --- 
  if (!window._domReady) {
    alert('페이지가 완전히 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    debugLog('generate: 빈 메시지로 호출됨');
    return;
  }
  if (!chat) {
    console.error('Gemini chat instance is not initialized. Trying to re-initialize...');
    // 초기화 재시도 또는 사용자에게 알림 강화
    await initializeGeminiClient(); // 초기화 함수 다시 호출 시도
    if (!chat) {
      alert('Gemini AI 클라이언트 초기화에 실패했습니다. API 키 및 네트워크 연결을 확인하고 페이지를 새로고침 해주세요.');
      return; 
    }
  }

  debugLog('[generate] 클라이언트 측 Gemini API 호출 시작');

  const userInput = document.querySelector('#input');
  const modelOutput = document.querySelector('#output');
  const slideshow = document.querySelector('#slideshow');
  const errorDisplay = document.querySelector('#error');
  const saveStoryBtn = document.getElementById('save-story-btn');
  const ttsGenBtn = document.getElementById('tts-gen-btn');

  // --- UI 초기화 --- 
  if (userInput) userInput.disabled = true;
  if (saveStoryBtn) saveStoryBtn.disabled = true;
  if (ttsGenBtn) ttsGenBtn.disabled = true;
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  slideshow.setAttribute('hidden', true);
  errorDisplay.innerHTML = '';
  errorDisplay.hidden = true;
  allStories = []; // 초기화
  storyTitle = message; // 제목 저장

  // 사용자 입력 표시
  const userTurn = document.createElement('div');
  userTurn.innerHTML = await marked.parse(message);
  userTurn.className = 'user-turn';
  modelOutput.append(userTurn);
  userInput.value = '';

  // 로딩 표시
  const loadingDiv = document.createElement('div');
  loadingDiv.textContent = '포메가 이야기를 생각하고 있어요... 🐾';
  loadingDiv.style.marginTop = '15px';
  modelOutput.append(loadingDiv);

  try {
    // --- Gemini API 호출 (sendMessageStream 사용 - 스트리밍 복원) ---
    const additionalInstructions = `
Use a fairy tale story about white Pomeranian as a metaphor.
Keep korean sentences short but conversational, casual, educational and engaging.
Generate a cute, animate for each sentence with ink-painting on white background.
No commentary, just begin your explanation.
Keep going until you\'re done.`;
    const fullPrompt = message + additionalInstructions;

    // --- chat.sendMessageStream 호출 (스트리밍) ---
    // chat 객체는 initializeGeminiClient에서 이미 생성 및 설정됨
    const result = await chat.sendMessageStream(fullPrompt);

    // --- 스트림 처리 로직 복원 및 수정 ---
    let currentText = '';
    let currentImageData = null;
    let slideAdded = false; // 슬라이드가 최소 하나 추가되었는지 확인

    for await (const chunk of result.stream) {
      // 로딩 표시 제거 (첫 청크 수신 시)
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }

      // 청크에서 텍스트 추출
      const chunkText = chunk.text ? chunk.text() : null;
      if (chunkText) {
        currentText += chunkText;
      }

      // 청크에서 이미지 데이터 추출 (inlineData 구조 확인)
      let chunkImageData = null;
      if (chunk.candidates && chunk.candidates.length > 0 && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
         const imagePart = chunk.candidates[0].content.parts.find(part => part.inlineData);
         if (imagePart && imagePart.inlineData.data) {
           chunkImageData = imagePart.inlineData.data; // Base64 데이터
           console.log('Gemini API: 이미지 데이터(base64) 수신됨 (Stream Chunk)');
         }
      }

      // 이미지 데이터가 있으면, 현재까지의 텍스트와 함께 슬라이드 추가
      if (chunkImageData) {
        await addSlide(currentText || ' ', chunkImageData);
        slideshow.removeAttribute('hidden');
        slideAdded = true;
        currentText = ''; // 슬라이드 추가 후 텍스트 초기화
        // 스트리밍에서는 이미지 받은 후 currentImageData를 바로 null 처리할 필요 없음
      }
    }

    // 스트림 종료 후 남은 텍스트 처리 (마지막 부분이 텍스트인 경우)
    if (currentText) {
       await addSlide(currentText, null); // 이미지 없이 텍스트만 추가
       slideshow.removeAttribute('hidden');
       slideAdded = true;
    }

    if (!slideAdded) {
      // 유효한 응답이 없는 경우
      console.warn("Gemini API 스트림으로부터 유효한 내용을 받지 못했습니다.");
      // 비어있는 경우 오류를 던지지 않도록 수정 (텍스트만 올 수도 있으므로)
      // throw new Error('Gemini API로부터 유효한 응답(텍스트 또는 이미지)을 받지 못했습니다.');
    }

    console.log('[generate] 클라이언트 측 Gemini API 스트리밍 호출 완료');
    enableTTSButton(storyTitle); // TTS 버튼 활성화
    showGenerationComplete(); // 완료 메시지 표시

  } catch (e) {
    // 로딩 표시 제거 (오류 시)
    if (loadingDiv.parentNode) {
      loadingDiv.remove();
    }
    console.error('[generate] 함수 오류 발생:', e);
    if (e.message) {
      console.error('[generate] 오류 메시지:', e.message);
    }
    // 사용자에게 표시할 메시지
    let errorMsg = '이야기 생성 중 오류가 발생했습니다.';
    if (e && typeof e.message === 'string') {
      // API 키 관련 오류 메시지 감지 (예시)
      if (e.message.includes('API key not valid')) {
        errorMsg = 'Gemini API 키가 유효하지 않습니다. 확인해주세요.';
      } else if (e.message.includes('quota')) {
        errorMsg = 'API 사용 할당량을 초과했습니다.';
      } else {
        errorMsg = `이야기 생성 실패: ${e.message}`;
      }
    }
    errorDisplay.textContent = errorMsg;
    errorDisplay.hidden = false;
  } finally {
    // --- 입력 필드 다시 활성화 --- 
    if (userInput) {
      userInput.disabled = false;
      userInput.focus();
    }
  }
}

const ttsGenBtn = document.getElementById('tts-gen-btn');
const ttsGenMsg = document.getElementById('tts-gen-message');

// Firestore에서 stories를 불러와 Cloud Function으로 TTS 생성 요청
async function triggerGenerateAndSaveTTS(title) {
  const user = auth.currentUser;
  if (!user) {
    alert('TTS 생성을 위해 로그인이 필요합니다.');
    return;
  }
  if (!ttsGenMsg) {
    console.error('ttsGenMsg DOM 요소가 없습니다.');
  }
  if (ttsGenMsg) ttsGenMsg.textContent = 'TTS 요청 준비 중...';

  // 1. Firestore에서 해당 title의 stories 불러오기 (order 순)
  const q = query(
    collection(db, "stories"),
    where("uid", "==", user.uid),
    where("title", "==", title),
    orderBy("order")
  );

  try {
    const snap = await getDocs(q);
    const stories = [];
    snap.forEach(doc => stories.push(doc.data()));

    if (!stories.length) {
      if (ttsGenMsg) ttsGenMsg.textContent = '해당 스토리가 없습니다.';
      return;
    }

    // 2. 각 스토리에 대해 Cloud Function 호출
    if (ttsGenMsg) ttsGenMsg.textContent = `총 ${stories.length}개 음성 생성 요청 중...`;
    let successCount = 0;
    let failCount = 0;
    const ttsFunctionUrl = 'https://us-central1-fairytale-186ee.cloudfunctions.net/generateAndSaveTTS'; // 배포된 함수 URL

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      const order = story.order || (i + 1); // order 필드가 없을 경우 대비
      
      if (ttsGenMsg) ttsGenMsg.textContent = `${i + 1}/${stories.length} 요청 중: ${title} (파트 ${order})...`;
      
      try {
        const response = await fetch(ttsFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: story.text, 
            order: order, 
            title: title, 
            uid: user.uid // 사용자 UID 전달
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error(`[TTS Trigger] Cloud Function 호출 실패 (Story ${order}):`, result);
          failCount++;
        } else {
          console.log(`[TTS Trigger] Cloud Function 호출 성공 (Story ${order}):`, result);
          successCount++;
        }
      } catch (e) {
        console.error(`[TTS Trigger] fetch 오류 (Story ${order}):`, e);
        failCount++;
      }
    }

    // 3. 최종 결과 메시지
    if (ttsGenMsg) {
      let finalMsg = `TTS 생성 요청 완료: 총 ${stories.length}개 중 ${successCount}개 성공`;
      if (failCount > 0) {
        finalMsg += `, ${failCount}개 실패`;
      }
      ttsGenMsg.textContent = finalMsg;
      setTimeout(() => { if (ttsGenMsg) ttsGenMsg.textContent = ''; }, 5000); // 5초 후 메시지 지우기
    }

  } catch (error) {
    console.error("Firestore 스토리 로딩 또는 TTS 요청 중 오류:", error);
    if (ttsGenMsg) ttsGenMsg.textContent = '오류 발생!';
  }
}

// ttsGenBtn 클릭 핸들러 (수정: triggerGenerateAndSaveTTS 호출)
if (ttsGenBtn) {
  ttsGenBtn.onclick = async () => {
    if (!ttsGenBtn) return; 
    ttsGenBtn.disabled = true; // 버튼 비활성화
    
    // 현재 storyTitle 사용 (generate 함수에서 설정됨)
    let title = storyTitle;
    if (!title) {
      // TODO: 갤러리 등 다른 곳에서 제목을 가져오는 로직 필요 시 추가
      alert('먼저 스토리를 생성해주세요.'); 
      ttsGenBtn.disabled = false; // 버튼 다시 활성화
      return;
    }
    
    await triggerGenerateAndSaveTTS(title);
    
    ttsGenBtn.disabled = false; // 작업 완료 후 버튼 활성화
  };
}

// --- openGalleryAfterGeneration 함수 수정 --- 
async function openGalleryAfterGeneration() {
  // 스토리 저장은 여기서 하지 않음 (save 버튼 클릭 시 처리하도록 변경 필요)
  console.log('[openGalleryAfterGeneration] 호출됨, allStories 길이:', allStories.length);
  
  // allStories 배열이 채워졌는지 확인 (addSlide에서 채워짐)
  if (!allStories || allStories.length === 0) {
    alert('이야기가 생성되지 않아 갤러리를 열 수 없습니다. (이미지/텍스트 확인 필요)');
    return;
  }

  // TODO: Firestore에 저장하는 로직은 '이야기 저장하기' 버튼 클릭 시 수행하도록 변경 필요
  // 현재는 갤러리 페이지만 이동
  window.location.href = `gallery.html?title=${encodeURIComponent(storyTitle)}`; 
}

// --- 생성 완료 안내 메시지 ---
function showGenerationComplete() {
  const modelOutput = document.querySelector('#output');
  const doneMsg = document.createElement('div');
  doneMsg.textContent = '모든 생성이 완료되었습니다!';
  doneMsg.style.margin = '20px 0 0 0';
  doneMsg.style.fontWeight = 'bold';
  doneMsg.style.color = '#2196f3';
  doneMsg.style.fontSize = '1.1em';
  modelOutput.appendChild(doneMsg);
}

// Firestore에 저장하는 로직 함수 (DB 구조 반영 수정)
async function saveStoryToFirebase() {
  const user = auth.currentUser;
  const saveBtn = document.getElementById('save-story-btn');
  const saveMsg = document.getElementById('save-story-message'); // ID 수정

  if (!user) {
    alert('스토리 저장을 위해 로그인이 필요합니다.');
    return;
  }

  if (!allStories || allStories.length === 0) {
    alert('저장할 스토리가 없습니다.');
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  if (saveMsg) saveMsg.textContent = '스토리 저장 중...';

  try {
    // Firestore 저장을 위한 트랜잭션 또는 Batch 사용 고려 가능 (선택 사항)
    // 여기서는 각 슬라이드를 순차적으로 저장
    for (let i = 0; i < allStories.length; i++) {
      const storyPart = allStories[i];
      let imageUrl = null;

      // 1. 이미지 데이터가 있으면 Storage에 업로드하고 URL 얻기
      if (storyPart.imageData) {
        const imageName = `${Date.now()}-${i}.png`; // 고유 파일 이름 생성
        const storageRef = ref(storage, `stories/${user.uid}/${storyTitle}/${imageName}`);
        try {
           const uploadTask = await uploadString(storageRef, storyPart.imageData, 'base64', {
             contentType: 'image/png' // MIME 타입 명시
           });
           imageUrl = await getDownloadURL(uploadTask.ref);
           console.log(`[Save Story] Image ${i+1} uploaded: ${imageUrl}`);
        } catch(uploadError) {
           console.error(`[Save Story] Image ${i+1} upload failed:`, uploadError);
           // 이미지 업로드 실패 시 처리 (예: 건너뛰거나 전체 저장 실패 처리)
           if (saveMsg) saveMsg.textContent = `오류: 이미지 ${i+1} 업로드 실패.`;
           throw uploadError; // 저장 중단
        }
      }

      // 2. Firestore에 데이터 저장
      const storyData = {
        uid: user.uid,
        title: storyTitle,
        order: i + 1, // 1부터 시작하는 순서
        text: storyPart.text || '', // 텍스트 없으면 빈 문자열
        imageUrl: imageUrl, // 이미지 URL 또는 null
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "stories"), storyData);
      console.log(`[Save Story] Story part ${i+1} saved to Firestore.`);
      if (saveMsg) saveMsg.textContent = `스토리 ${i+1}/${allStories.length} 저장 완료...`;
    }

    if (saveMsg) {
       saveMsg.textContent = '스토리가 성공적으로 저장되었습니다!';
       // 갤러리 이동 버튼 활성화 또는 자동 이동 등 추가 구현 가능
       // 예: const galleryBtn = document.getElementById('go-to-gallery-btn'); if(galleryBtn) galleryBtn.disabled = false;
       setTimeout(() => { if (saveMsg) saveMsg.textContent = ''; }, 5000);
    }

  } catch (error) {
    console.error("[Save Story] Firestore 저장 중 오류 발생:", error);
    if (saveMsg) saveMsg.textContent = '스토리 저장 중 오류가 발생했습니다.';
  } finally {
    if (saveBtn) saveBtn.disabled = false; // 완료 또는 오류 시 버튼 다시 활성화
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded 이벤트 발생');

  // DOM 요소 가져오기
  const userInput = document.querySelector('#input');
  const runBtn = document.querySelector('#run-btn');
  const saveStoryBtn = document.getElementById('save-story-btn');
  const saveMsg = document.getElementById('save-story-message'); // 메시지 표시용 div
  const ttsGenBtn = document.getElementById('tts-gen-btn');
  const loginLink = document.getElementById('login-link');
  const logoutBtn = document.getElementById('logout-btn');
  const galleryLink = document.getElementById('gallery-link');
  const emailAuth = document.getElementById('email-auth');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailSignupBtn = document.getElementById('email-signup-btn');
  const emailLoginBtn = document.getElementById('email-login-btn');
  const authMsg = document.getElementById('auth-message');
  const originalPlaceholder = userInput ? userInput.placeholder : '질문을 입력하세요...';

  // --- 초기 UI 상태 설정: 일단 비활성화 --- 
  console.log('[Init UI] 입력창 및 버튼 초기 비활성화 설정 시작');
  if (userInput) {
    userInput.disabled = true;
    userInput.placeholder = '인증 상태 확인 중...';
    console.log('[Init UI] userInput 비활성화됨');
  } else {
    console.error('[Init UI] userInput 요소를 찾을 수 없음!');
  }
  if (runBtn) {
    runBtn.disabled = true;
    console.log('[Init UI] runBtn 비활성화됨');
  } else {
    console.error('[Init UI] runBtn 요소를 찾을 수 없음!');
  }
  if (loginLink) loginLink.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
  console.log('[Init UI] 초기 비활성화 설정 완료');
  // --- 초기 UI 상태 설정 끝 --- 

  // 필수 DOM 요소 없을 경우 오류 메시지 (필요시 유지)
  if (!userInput || !runBtn) {
    console.error('필수 DOM 요소(input, run-btn)가 존재하지 않습니다.');
  }

  // 로그인 상태 감지 및 UI 업데이트
  console.log('[Auth] onAuthStateChanged 리스너 등록 시도');
  onAuthStateChanged(auth, (user) => {
    console.log('[Auth State Changed] 이벤트 발생, user:', user ? user.uid : 'null');
    if (user) {
      console.log('[Auth State] 로그인됨 처리 시작');
      if (loginLink) loginLink.style.display = 'none';
      if (logoutBtn) {
        console.log('[Auth State] logoutBtn 표시');
        logoutBtn.style.display = 'inline-block';
      }
      if (userInput) {
        console.log('[Auth State] userInput 활성화 시도');
        userInput.disabled = false;
        userInput.placeholder = originalPlaceholder;
      }
      if (runBtn) {
        console.log('[Auth State] runBtn 활성화 시도');
        runBtn.disabled = false;
      }
      console.log('[Auth State] 로그인됨 처리 완료');
    } else {
      console.log('[Auth State] 로그아웃됨 처리 시작');
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (loginLink) {
        console.log('[Auth State] loginLink 표시');
        loginLink.style.display = 'inline-block';
      }
      if (userInput) {
        console.log('[Auth State] userInput 비활성화 시도');
        userInput.disabled = true;
        userInput.placeholder = '로그인 후 질문을 입력하세요...';
      }
      if (runBtn) {
        console.log('[Auth State] runBtn 비활성화 시도');
        runBtn.disabled = true;
      }
      if (emailAuth) emailAuth.style.display = 'none';
      console.log('[Auth State] 로그아웃됨 처리 완료');
    }
  });
  console.log('[Auth] onAuthStateChanged 리스너 등록 완료');

  // 로그인 버튼 클릭 시 이메일/비번 폼 표시
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (emailAuth) {
        emailAuth.style.display = emailAuth.style.display === 'flex' ? 'none' : 'flex';
      }
    });
  }

  // 로그아웃 버튼 클릭 시 로그아웃
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      // 로그아웃 후 입력창 비활성화 및 플레이스홀더 변경은 onAuthStateChanged에서 처리됨
    });
  }

  // 회원가입
  if (emailSignupBtn) {
    emailSignupBtn.onclick = async () => {
      if (!emailInput || !passwordInput || !authMsg) return;
      
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      if (!email || !password) {
        if (authMsg) {
          authMsg.textContent = '이메일/비밀번호를 입력하세요.';
          authMsg.style.color = '#f44336';
        }
        return;
      }
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        // Firestore users 컬렉션이 없을 경우 에러가 발생할 수 있으므로 try/catch로 처리
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: user.displayName || '',
            createdAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error('사용자 정보 Firestore 저장 실패:', err);
        }
        
        if (authMsg) {
          authMsg.textContent = '회원가입 성공!';
          authMsg.style.color = '#2196f3';
        }
        if (emailAuth) setTimeout(() => { emailAuth.style.display = 'none'; }, 1000);
        if (loginLink) loginLink.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
      } catch (e) {
        console.error('회원가입 실패:', e);
        if (authMsg) {
          authMsg.textContent = '회원가입 실패: 이미 가입된 이메일이거나 비밀번호가 약함';
          authMsg.style.color = '#f44336';
        }
      }
    };
  }

  // 로그인
  if (emailLoginBtn) {
    emailLoginBtn.onclick = async () => {
      if (!emailInput || !passwordInput || !authMsg) return;
      
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      if (!email || !password) {
        if (authMsg) {
          authMsg.textContent = '이메일/비밀번호를 입력하세요.';
          authMsg.style.color = '#f44336';
        }
        return;
      }
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        if (authMsg) {
          authMsg.textContent = '로그인 성공!';
          authMsg.style.color = '#2196f3';
        }
        if (emailAuth) setTimeout(() => { emailAuth.style.display = 'none'; }, 1000);
        if (loginLink) loginLink.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
      } catch (e) {
        console.error('로그인 실패:', e);
        if (authMsg) {
          authMsg.textContent = '로그인 실패: 이메일/비밀번호를 확인하세요.';
          authMsg.style.color = '#f44336';
        }
      }
    };
  }

  // 질문 실행: 엔터 입력 또는 버튼 클릭 시 generate 호출
  userInput.addEventListener('keydown', async (e) => {
    if (e.code === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = userInput.value.trim();
      if (message) await generate(message);
    }
  });
  runBtn.addEventListener('click', async () => {
    const message = userInput.value.trim();
    if (message) await generate(message);
  });

  // --- 이야기 저장 버튼 핸들러 추가 ---
  if (saveStoryBtn) {
    saveStoryBtn.onclick = async () => {
      await saveStoryToFirebase(); // 위에서 정의한 저장 함수 호출
    };
    console.log('[Init UI] saveStoryBtn 이벤트 리스너 등록됨');
  } else {
     console.error('[Init UI] saveStoryBtn 요소를 찾을 수 없음!');
  }

  // 기타 버튼 예시 (기존)
  galleryLink.addEventListener('click', (e) => {
    // 갤러리 이동
  });
});

function enableTTSButton(title) {
  const ttsBtn = document.getElementById('tts-gen-btn');
  if (ttsBtn) {
    ttsBtn.disabled = false;
    ttsBtn.dataset.title = title;
  }
}

// index.js 최하단 로그
console.log('[index.js] 파일 끝');
