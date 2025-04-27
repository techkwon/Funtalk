// index.js 최상단 로그
console.log('[index.js] 파일 시작');

// .env 또는 config.js에서 OPENAI_API_KEY를 읽어오는 코드 추가
// (1) config.js에서 export된 OPENAI_API_KEY가 있으면 사용
// (2) window.OPENAI_API_KEY가 있으면 사용
// (3) 없으면 안내 메시지
let OPENAI_API_KEY = '';
try {
  if (typeof window !== 'undefined' && window.OPENAI_API_KEY) {
    OPENAI_API_KEY = window.OPENAI_API_KEY;
  } else if (typeof OPENAI_API_KEY !== 'undefined') {
    // 이미 전역에 선언되어 있으면 사용
    OPENAI_API_KEY = OPENAI_API_KEY;
  } else if (typeof importScripts === 'function') {
    // 웹워커 환경 등
    // pass
  } else {
    // config.js에서 import 시도
    try {
      // 동적 import 사용
      import('./config.js').then(module => {
        OPENAI_API_KEY = module.OPENAI_API_KEY;
      }).catch(() => {
        // config.js 로드 실패
      });
    } catch (e) {
      // pass
    }
  }
} catch (e) {
  // pass
}
if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY가 정의되어 있지 않습니다. config.js 또는 window.OPENAI_API_KEY로 설정하세요.');
}

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
import { GoogleGenAI } from 'https://esm.sh/@google/genai@0.6.0';
import { marked } from 'https://esm.sh/marked@^15.0.7';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, addDoc, query, getDocs, where, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { db, storage } from "./firebaseConfig.js";
// ttsUtils.js에서 함수 가져오기
import { generateAndUploadTTS, saveTTSUrlToFirestore } from './ttsUtils.js';

const auth = getAuth();
const provider = new GoogleAuthProvider();

function debugLog(msg) {
    console.log('[DEBUG]', msg);
}
const ai = new GoogleGenAI({ apiKey: 'AIzaSyBu3dI321KSpWeu1Q5EJhwypH0fB-yZ2gE' });
const chat = ai.chats.create({
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
  history: [],
});
const additionalInstructions = `\nUse a fairy tale story about white Pomeranian as a metaphor.\nKeep sentences short but conversational, casual, educational and engaging.\nGenerate a cute, animate for each sentence with ink-painting on white background.\nNo commentary, just begin your explanation. speak korean.\nKeep going until you're done.`;

async function addSlide(text, image) {
    debugLog('addSlide called');
    const slideshow = document.querySelector('#slideshow');
    slideshow.removeAttribute('hidden');
    const slide = document.createElement('div');
    slide.className = 'slide';
    const caption = document.createElement('div');
    caption.innerHTML = await marked.parse(text);
    slide.append(image);
    slide.append(caption);
    slideshow.append(slide);
    // 슬라이드 추가 시 마지막 스토리 정보 저장 및 저장 버튼 활성화
    setLastStory(text, image.src);
}
function parseError(error) {
    debugLog('parseError called');
    if (typeof error === 'string') {
        const regex = /{"error":(.*)}/gm;
        const m = regex.exec(error);
        try {
            const e = m[1];
            const err = JSON.parse(e);
            return err.message;
        }
        catch (e) {
            return error;
        }
    }
    if (error && error.message)
        return error.message;
    return String(error);
}
async function generate(message) {
  // // 주석 처리 또는 삭제: generate 함수 시작 부분의 로그인 확인 로직
  // console.log('[generate] 함수 시작');
  // const user = auth.currentUser;
  // console.log('[generate] 현재 사용자:', user);
  // if (!user) {
  //   console.log('[generate] 로그인되지 않음. 로그인 UI 표시 시도.');
  //   alert('스토리 생성을 위해 로그인이 필요합니다.');
  //   const emailAuth = document.getElementById('email-auth');
  //   if (emailAuth) {
  //     console.log('[generate] email-auth 요소 찾음, 표시.');
  //     emailAuth.style.display = 'flex'; 
  //   } else {
  //     console.error('[generate] email-auth 요소를 찾을 수 없음!');
  //   }
  //   return; 
  // }
  // console.log('[generate] 로그인 확인됨.');

  // --- 페이지 로드 상태 확인 --- (기존 로직 유지)
  if (!window._domReady) {
    alert('페이지가 완전히 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  // --- 메시지 유효성 검사 --- (기존 로직 유지)
  if (!message || typeof message !== 'string' || !message.trim()) {
    debugLog('generate: 빈 메시지로 호출됨');
    return;
  }
  
  debugLog('[generate] 함수 실행'); // generate 로직 시작 로그
  
  const userInput = document.querySelector('#input');
  if (!userInput) {
    console.error('userInput DOM 요소를 찾을 수 없습니다. index.html 구조와 id="input"을 확인하세요.');
    return;
  }
  const modelOutput = document.querySelector('#output');
  const slideshow = document.querySelector('#slideshow');
  const error = document.querySelector('#error');
  // DOM 요소 존재 여부 체크 (문제 발생 시 에러 메시지)
  if (!modelOutput || !slideshow || !error) {
    alert('필수 UI 요소가 없습니다. 새로고침 후 다시 시도하거나, index.html 구조를 확인하세요.');
    return;
  }
  if (userInput) userInput.disabled = true;
  let timeoutId = setTimeout(() => {
    if (userInput && 'disabled' in userInput) {
      try {
        userInput.disabled = false;
        userInput.focus();
      } catch (err) {
        console.error('userInput 상태 복원 중 오류:', err);
      }
    }
    console.error('응답이 없습니다. 다시 입력해 주세요.');
  }, 5000);
  chat.history.length = 0;
  modelOutput.innerHTML = '';
  // 기존 슬라이드 모두 제거 및 숨김
  slideshow.innerHTML = '';
  slideshow.setAttribute('hidden', true);
  error.innerHTML = '';
  allStories = []; // 새로 생성할 때마다 초기화
  storyTitle = message; // 제목 저장
  try {
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';
    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });
    let text = '';
    let img = null;
    let gotResponse = false;
    for await (const chunk of result) {
      gotResponse = true;
      for (const candidate of chunk.candidates) {
        for (const part of candidate.content.parts ?? []) {
          if (part.text) {
            text += part.text;
          } else {
            try {
              const data = part.inlineData;
              if (data) {
                img = document.createElement('img');
                img.src = `data:image/png;base64,` + data.data;
              } else {
                debugLog('no data', chunk);
              }
            } catch (e) {
              debugLog('no data', chunk);
            }
          }
          if (text && img) {
            await addSlide(text, img);
            text = '';
            img = null;
          }
        }
      }
    }
    if (img) {
      await addSlide(text, img);
      text = '';
    }
    const title = message;
    enableTTSButton(title);
    if (gotResponse) {
      clearTimeout(timeoutId);
      if (userInput && 'disabled' in userInput) {
        try {
          userInput.disabled = false;
          userInput.focus();
        } catch (err) {
          console.error('userInput 상태 복원 중 오류:', err);
        }
      }
      await openGalleryAfterGeneration();
      showGenerationComplete();
    }
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = parseError(e);
    console.error('Something went wrong:', msg);
    if (userInput && 'disabled' in userInput) {
      try {
        userInput.disabled = false;
        userInput.focus();
      } catch (err) {
        console.error('userInput 상태 복원 중 오류:', err);
      }
    }
  }
}
let lastStoryText = '';
let lastStoryImageUrl = '';
let allStories = [];
let storyTitle = '';

function setLastStory(text, imageUrl) {
  lastStoryText = text;
  lastStoryImageUrl = imageUrl;
  document.getElementById('save-story-btn').disabled = false;
  // 새로운 슬라이드가 추가될 때마다 배열에도 추가
  allStories.push({ text, imageUrl });
  const ttsGenBtn = document.getElementById('tts-gen-btn');
  if (ttsGenBtn) ttsGenBtn.disabled = false;
}

function clearLastStory() {
  lastStoryText = '';
  lastStoryImageUrl = '';
  document.getElementById('save-story-btn').disabled = true;
  allStories = [];
  storyTitle = '';
  const ttsGenBtn = document.getElementById('tts-gen-btn');
  if (ttsGenBtn) ttsGenBtn.disabled = true;
}

async function saveStoryToFirestore(text, imageUrl, order = null, title = null) {
  const user = auth.currentUser;
  if (!user) {
    console.error('로그인이 필요합니다.');
    alert('이야기를 저장하려면 로그인이 필요합니다.');
    return false;
  }
  let finalImageUrl = imageUrl;
  try {
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      const ext = imageUrl.substring(11, imageUrl.indexOf(';'));
      const fileName = `stories/${user.uid}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, fileName);
      const base64 = imageUrl.split(',')[1];
      await uploadString(storageRef, base64, 'base64');
      finalImageUrl = await getDownloadURL(storageRef);
    }
    const docData = {
      uid: user.uid,
      text,
      imageUrl: finalImageUrl,
      createdAt: serverTimestamp(),
    };
    if (order !== null) docData.order = order;
    if (title !== null) docData.title = title;
    await addDoc(collection(db, "stories"), docData);
    debugLog('스토리 Firestore 저장 성공');
    return true;
  } catch (e) {
    console.error('스토리 Firestore 저장 실패:', e);
    debugLog('스토리 Firestore 저장 실패: ' + e.message);
    return false;
  }
}

const saveStoryBtn = document.getElementById('save-story-btn');
const saveStoryMsg = document.getElementById('save-story-message');

// // saveStoryBtn 클릭 이벤트 핸들러 (임시 주석 처리)
// if (saveStoryBtn) {
//   saveStoryBtn.onclick = async () => {
//     console.log("'이야기 저장하기' 버튼 클릭");
//     const user = auth.currentUser;
// 
//     // 1. 로그인 상태 확인
//     if (!user) {
//       console.error('저장 시도: 로그인이 필요합니다.');
//       alert('이야기를 저장하려면 먼저 로그인해주세요.');
//       return; // 로그인 안되어 있으면 함수 종료
//     }
//     console.log('로그인 확인됨:', user.uid);
// 
//     // 2. 저장할 데이터 확인
//     if (!allStories || allStories.length === 0) {
//       console.warn('저장할 스토리가 없습니다.');
//       alert('저장할 이야기가 없습니다. 먼저 이야기를 생성해주세요.');
//       return;
//     }
//     console.log(`저장할 스토리 제목: "${storyTitle}", 총 슬라이드: ${allStories.length}개`);
// 
//     // 3. 저장 프로세스 시작
//     let ok = true;
//     if (!saveStoryMsg) {
//       console.error('saveStoryMsg DOM 요소가 없습니다.');
//     } else {
//       saveStoryMsg.textContent = `0 / ${allStories.length} 저장 중...`;
//     }
// 
//     for (let i = 0; i < allStories.length; i++) {
//       const story = allStories[i];
//       console.log(`슬라이드 ${i + 1} 저장 시도...`, story);
//       if (saveStoryMsg) saveStoryMsg.textContent = `${i + 1} / ${allStories.length} 저장 중...`;
//       
//       // saveStoryToFirestore 호출
//       const result = await saveStoryToFirestore(story.text, story.imageUrl, i + 1, storyTitle);
//       
//       if (!result) {
//         ok = false;
//         console.error(`슬라이드 ${i + 1} 저장 실패`);
//         // 실패 시 루프 중단 또는 계속 진행 여부 결정 (여기서는 계속 진행)
//       }
//     }
// 
//     // 4. 결과 메시지 표시
//     if (ok) {
//       console.log('모든 스토리 저장 성공!');
//       if (saveStoryMsg) {
//         saveStoryMsg.textContent = '모든 이야기 저장 완료!';
//         setTimeout(() => { saveStoryMsg.textContent = ''; }, 3000);
//       }
//       // 성공 시 스토리 데이터 초기화 (필요에 따라 주석 해제)
//       // clearLastStory(); 
//     } else {
//       console.error('일부 또는 전체 스토리 저장 실패!');
//       if (saveStoryMsg) {
//         saveStoryMsg.textContent = '저장 실패!';
//         setTimeout(() => { saveStoryMsg.textContent = ''; }, 3000);
//       }
//     }
//   };
// } else {
//   console.error('save-story-btn 요소를 찾을 수 없습니다.');
// }

const ttsGenBtn = document.getElementById('tts-gen-btn');
const ttsGenMsg = document.getElementById('tts-gen-message');

// Firestore에서 stories를 불러와 TTS 생성 및 저장 (수정: ttsUtils 함수 사용)
async function generateTTSFromFirestore(title) {
  const user = auth.currentUser;
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  if (!ttsGenMsg) {
    console.error('ttsGenMsg DOM 요소가 없습니다. index.html에 <div id="tts-gen-message"></div>를 추가하세요.');
  }
  if (ttsGenMsg) ttsGenMsg.textContent = '스토리 불러오는 중...';
  
  // 1. Firestore에서 stories 불러오기 (order 순)
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
      if (ttsGenBtn) ttsGenBtn.disabled = false; // 버튼 다시 활성화
      return;
    }
    
    let ok = true;
    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      const text = story.text;
      if (ttsGenMsg) ttsGenMsg.textContent = `${i + 1} / ${stories.length} 음성 생성 중...`;
      
      try {
        // ttsUtils.js의 함수 호출
        const audioUrl = await generateAndUploadTTS(text, i + 1, title);
        await saveTTSUrlToFirestore(audioUrl, i + 1, title);
      } catch (e) {
        ok = false;
        console.error(`TTS 생성 실패 (Story ${i + 1}):`, e);
        if (ttsGenMsg) ttsGenMsg.textContent = `음성 생성 실패 (Story ${i+1})`;
        // 실패 시 루프 중단 또는 사용자에게 알림 강화 가능
        break; // 한 번 실패하면 중단
      }
    }
    
    // 최종 결과 메시지
    if (ok) {
      if (ttsGenMsg) {
        ttsGenMsg.textContent = '모든 음성 생성 완료!';
        setTimeout(() => { if (ttsGenMsg) ttsGenMsg.textContent = ''; }, 3000);
      }
    } else {
      // 실패 메시지는 루프 내에서 이미 표시됨
      // 필요하다면 여기서 추가적인 실패 처리
    }
    
  } catch (error) {
    console.error("Firestore 스토리 로딩 또는 TTS 처리 중 오류:", error);
    if (ttsGenMsg) ttsGenMsg.textContent = '오류 발생!';
  } finally {
    if (ttsGenBtn) ttsGenBtn.disabled = false; // 작업 완료 후 버튼 활성화
  }
}

// --- 갤러리 슬라이드 자동 오픈 및 완료 안내 ---
async function openGalleryAfterGeneration() {
  // 이미지 슬라이드가 하나 이상 생성되었는지 확인
  if (allStories.length === 0) {
    alert('이미지가 생성되지 않아 갤러리를 열 수 없습니다.');
    return;
  }
  // 최신 생성 스토리만 Firestore에 저장 (order 부여)
  for (let i = 0; i < allStories.length; i++) {
    await saveStoryToFirestore(allStories[i].text, allStories[i].imageUrl, i, storyTitle);
  }
  // 갤러리 페이지로 이동 (최신 생성된 스토리 강조)
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

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded 이벤트 발생');

  // DOM 요소 가져오기
  const userInput = document.querySelector('#input');
  const runBtn = document.querySelector('#run-btn');
  const saveStoryBtn = document.getElementById('save-story-btn');
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
