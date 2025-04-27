import { db } from "./firebaseConfig.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, query, getDocs, orderBy, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
// ttsUtils.js에서 함수 가져오기
import { generateAndUploadTTS, saveTTSUrlToFirestore } from './ttsUtils.js';

const galleryList = document.getElementById('gallery-list');
const galleryViewer = document.getElementById('gallery-viewer');
const gallerySlideshow = document.getElementById('gallery-slideshow');
const galleryPrevBtn = document.getElementById('gallery-prev-btn');
const galleryNextBtn = document.getElementById('gallery-next-btn');
const galleryPreviewBtn = document.getElementById('gallery-preview-btn');
const galleryCloseBtn = document.getElementById('gallery-close-btn');
const gallerySlideIndicator = document.getElementById('gallery-slide-indicator');
const ttsBtn = document.getElementById('gallery-tts-btn');
const ttsMsg = document.getElementById('gallery-tts-message');

let galleryStoriesByTitle = {};
let galleryCurrentSet = null;
let galleryCurrentIdx = 0;
let galleryPreviewing = false;

// 인증 처리: 로그인 안되어 있으면 로그인 유도 (Google)
const auth = getAuth();
const provider = new GoogleAuthProvider();
function showLoginPrompt() {
  galleryList.innerHTML = '<button id="gallery-login-btn" style="font-size:18px;padding:16px 28px;">Google로 로그인</button>';
  document.getElementById('gallery-login-btn').onclick = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert('로그인 실패: ' + e.message);
    }
  };
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadGalleryStories();
  } else {
    showLoginPrompt();
  }
});

// Firestore에서 stories 모음 불러오기 (title별 그룹)
async function loadGalleryStories() {
  galleryList.innerHTML = '<span style="color:#888;">불러오는 중...</span>';
  const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const byTitle = {};
  snap.forEach(doc => {
    const d = doc.data();
    if (!d.title) return;
    if (!byTitle[d.title]) byTitle[d.title] = [];
    byTitle[d.title].push({ ...d, id: doc.id });
  });
  // order 순서대로 정렬
  for (const t in byTitle) {
    byTitle[t].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  galleryStoriesByTitle = byTitle;
  renderGalleryList();
}

function renderGalleryList() {
  galleryList.innerHTML = '';
  const titles = Object.keys(galleryStoriesByTitle);
  if (!titles.length) {
    galleryList.innerHTML = '<span style="color:#888;">저장된 이야기가 없습니다.</span>';
    return;
  }
  titles.forEach(title => {
    const slides = galleryStoriesByTitle[title];
    const thumbUrl = slides[0]?.imageUrl || '';
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = 'center';
    div.style.cursor = 'pointer';
    div.onclick = () => openGalleryViewer(title);
    const img = document.createElement('img');
    img.src = thumbUrl;
    img.className = 'gallery-thumb';
    div.appendChild(img);
    const cap = document.createElement('div');
    cap.textContent = title;
    cap.style.marginTop = '8px';
    cap.style.fontWeight = 'bold';
    cap.style.fontSize = '15px';
    div.appendChild(cap);
    galleryList.appendChild(div);
  });
}

function openGalleryViewer(title) {
  galleryCurrentSet = galleryStoriesByTitle[title] || [];
  galleryCurrentIdx = 0;
  galleryViewer.style.display = 'flex';
  document.getElementById('gallery-main').style.display = 'none';
  renderGallerySlide();
}

galleryCloseBtn.onclick = () => {
  galleryViewer.style.display = 'none';
  document.getElementById('gallery-main').style.display = 'block';
  galleryPreviewing = false;
};

galleryPrevBtn.onclick = () => {
  if (!galleryCurrentSet) return;
  if (galleryCurrentIdx > 0) {
    galleryCurrentIdx--;
    renderGallerySlide();
  }
};

galleryNextBtn.onclick = () => {
  if (!galleryCurrentSet) return;
  if (galleryCurrentIdx < galleryCurrentSet.length - 1) {
    galleryCurrentIdx++;
    renderGallerySlide();
  }
};

function renderGallerySlide() {
  if (!galleryCurrentSet) return;
  const slide = galleryCurrentSet[galleryCurrentIdx];
  gallerySlideshow.innerHTML = '';
  if (slide.imageUrl) {
    const img = document.createElement('img');
    img.src = slide.imageUrl;
    img.style.width = '90%';
    img.style.maxHeight = '220px';
    img.style.borderRadius = '10px';
    img.style.margin = '16px 0 8px 0';
    gallerySlideshow.appendChild(img);
  }
  const txt = document.createElement('div');
  txt.textContent = slide.text;
  txt.style.margin = '8px 0 0 0';
  txt.style.fontSize = '18px';
  txt.style.fontWeight = '500';
  txt.style.color = '#333';
  txt.style.textAlign = 'center';
  gallerySlideshow.appendChild(txt);
  gallerySlideIndicator.textContent = `${galleryCurrentIdx + 1} / ${galleryCurrentSet.length}`;
  // 음성 생성 버튼 상태 제어
  if (ttsBtn && ttsMsg) {
    ttsBtn.disabled = true;
    ttsMsg.textContent = '';
    findTTSUrl(slide).then(url => {
      if (url) {
        ttsBtn.disabled = true;
        ttsMsg.textContent = '음성(mp3) 이미 존재';
      } else {
        ttsBtn.disabled = false;
        ttsMsg.textContent = '음성 없음 - 생성 가능';
      }
    });
  }
}

// 슬라이드별 TTS(mp3) 자동 재생 기능 추가
async function findTTSUrl(slide) {
  // 1. slide 객체에 ttsUrl 필드가 있으면 우선 사용
  if (slide.ttsUrl) return slide.ttsUrl;
  // 2. 없으면 Firestore tts 컬렉션에서 title/order로 조회
  try {
    const q = query(collection(db, "tts"),
      where("title", "==", slide.title),
      where("order", "==", slide.order)
    );
    const snap = await getDocs(q);
    let url = null;
    snap.forEach(doc => { const d = doc.data(); if (d.audioUrl) url = d.audioUrl; });
    return url;
  } catch (e) {
    return null;
  }
}

function playAudio(url) {
  return new Promise((resolve) => {
    let audio = document.getElementById('gallery-audio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'gallery-audio';
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }
    audio.src = url;
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play();
  });
}

// 미리보기: 해당 슬라이드의 TTS 자동 재생 & 다음 슬라이드로 전환
let galleryPreviewTimeout = null;

galleryPreviewBtn.onclick = async () => {
  if (!galleryCurrentSet) return;
  if (galleryPreviewing) return;
  galleryPreviewing = true;
  for (let i = galleryCurrentIdx; i < galleryCurrentSet.length; i++) {
    galleryCurrentIdx = i;
    renderGallerySlide();
    const slide = galleryCurrentSet[i];
    const ttsUrl = await findTTSUrl(slide);
    if (ttsUrl) {
      await playAudio(ttsUrl);
    } else {
      await sleep(1500);
    }
    if (!galleryPreviewing) break;
  }
  galleryPreviewing = false;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 갤러리 슬라이드별 음성 생성 버튼 핸들러 (수정: ttsUtils 함수 사용)
if (ttsBtn) {
  ttsBtn.onclick = async () => {
    if (!galleryCurrentSet) return;
    const slide = galleryCurrentSet[galleryCurrentIdx];
    const title = galleryCurrentSet[0]?.title || ''; // 현재 보고 있는 세트의 제목 가져오기
    const order = galleryCurrentIdx + 1; // 현재 슬라이드의 순서 (1부터 시작)
    const text = slide.text; // 현재 슬라이드의 텍스트

    if (!title) {
      alert('스토리 제목을 찾을 수 없습니다.');
      return;
    }

    if (ttsMsg) ttsMsg.textContent = '음성 생성 중...';
    ttsBtn.disabled = true;
    
    try {
      console.log(`[Gallery] TTS 생성 시도: title=${title}, order=${order}`);
      // ttsUtils.js의 함수 호출
      const audioUrl = await generateAndUploadTTS(text, order, title);
      
      console.log(`[Gallery] TTS 생성 성공, Firestore 저장 시도: ${audioUrl}`);
      // Firestore에 저장 (ttsUtils.js의 함수 호출)
      await saveTTSUrlToFirestore(audioUrl, order, title);
      
      if (ttsMsg) ttsMsg.textContent = '음성 생성 완료!';
      // 성공 시 버튼 상태 업데이트 (이미 생성되었으므로 비활성화 유지)
      // renderGallerySlide() 함수가 TTS 상태를 다시 확인하고 버튼 상태를 조절함
      renderGallerySlide(); // 슬라이드 UI 업데이트 (TTS 상태 포함)

    } catch (e) {
      console.error('[Gallery] TTS 생성 또는 저장 실패:', e);
      if (ttsMsg) ttsMsg.textContent = '음성 생성 실패: ' + (e.message || e);
      ttsBtn.disabled = false; // 실패 시 버튼 다시 활성화
    }
  };
}

// 페이지 진입 시 인증 상태 확인 후 갤러리 목록 로딩
// (onAuthStateChanged에서 처리)

document.addEventListener('DOMContentLoaded', () => {
  // 인증 상태 확인
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadGalleryStories();
    } else {
      showLoginPrompt();
    }
  });
});
