import { db } from "./firebaseConfig.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, query, getDocs, orderBy, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
// ttsUtils.js에서 함수 가져오기
// import { generateAndUploadTTS, saveTTSUrlToFirestore } from './ttsUtils.js';

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

// DOM 요소 추가
const deleteModeControls = document.getElementById('delete-mode-controls');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

let galleryStoriesByTitle = {};
let galleryCurrentSet = null;
let galleryCurrentIdx = 0;
let galleryPreviewing = false;

// 상태 변수 추가
let isDeleteMode = false;
let selectedTitlesToDelete = [];

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

// Firestore에서 stories 모음 불러오기 (title별 그룹) - 수정
async function loadGalleryStories() {
  galleryList.innerHTML = '<span style="color:#888;">불러오는 중...</span>';
  const user = auth.currentUser;
  if (!user) return; // 로그인 안되어 있으면 중단

  // Firestore 쿼리 수정: 루트 stories 컬렉션에서 uid 필터링
  const q = query(collection(db, "stories"), 
                  where("uid", "==", user.uid), 
                  orderBy("createdAt", "desc"));
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
  const deleteToggleContainer = document.getElementById('delete-toggle-container');
  deleteToggleContainer.innerHTML = '';

  const titles = Object.keys(galleryStoriesByTitle);
  if (!titles.length) {
    galleryList.innerHTML = '<span style="color:#888;">저장된 이야기가 없습니다.</span>';
    deleteToggleContainer.style.display = 'none';
    return;
  }

  deleteToggleContainer.style.display = 'block';

  const toggleDeleteBtn = document.createElement('button');
  toggleDeleteBtn.textContent = isDeleteMode ? '삭제 모드 취소' : '이야기 선택 삭제';
  toggleDeleteBtn.onclick = toggleDeleteMode;
  toggleDeleteBtn.style.padding = '8px 15px';
  toggleDeleteBtn.style.cursor = 'pointer';
  deleteToggleContainer.appendChild(toggleDeleteBtn);

  titles.forEach(title => {
    const slides = galleryStoriesByTitle[title];
    const thumbUrl = slides[0]?.imageUrl || 'assets/pome-placeholder.png';

    const storyContainer = document.createElement('div');
    storyContainer.className = 'gallery-item-container';
    storyContainer.style.position = 'relative'; // 삭제 버튼 absolute 위치용
    if (selectedTitlesToDelete.includes(title)) {
        storyContainer.classList.add('selected-for-delete'); // 선택 시 시각적 피드백용 클래스
    }

    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.style.cursor = isDeleteMode ? 'pointer' : 'default'; // 삭제 모드일 때만 선택 가능
    div.onclick = () => {
        if (isDeleteMode) {
            handleItemSelection(title, storyContainer);
        } else {
            openGalleryViewer(title);
        }
    };

    const img = document.createElement('img');
    img.src = thumbUrl;
    img.className = 'gallery-thumb';
    img.onerror = () => { img.src = 'assets/pome-placeholder.png'; };
    div.appendChild(img);

    const cap = document.createElement('div');
    cap.textContent = title;
    cap.className = 'gallery-caption';
    div.appendChild(cap);

    storyContainer.appendChild(div);

    // 삭제 버튼 생성 및 스타일/위치 조정 (삭제 모드일 때만 표시되도록 수정 가능)
    if (isDeleteMode) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '선택'; // 버튼 텍스트 변경
        deleteBtn.className = 'gallery-select-btn'; // 클래스명 변경
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '8px';
        deleteBtn.style.right = '8px';
        deleteBtn.style.backgroundColor = selectedTitlesToDelete.includes(title) ? '#4CAF50' : '#f44336'; // 선택 상태 따라 색상 변경
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = (event) => {
            event.stopPropagation();
            handleItemSelection(title, storyContainer);
        };
        storyContainer.appendChild(deleteBtn);
    }

    galleryList.appendChild(storyContainer);
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

async function renderGallerySlide() {
  if (!galleryCurrentSet) return;
  const slide = galleryCurrentSet[galleryCurrentIdx];
  gallerySlideshow.innerHTML = '';

  if (slide.imageUrl) {
    const img = document.createElement('img');
    img.src = slide.imageUrl;
    img.style.display = 'block';
    img.style.maxWidth = '90%';
    img.style.maxHeight = '220px';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '10px';
    img.style.margin = '16px auto 8px auto';
    gallerySlideshow.appendChild(img);
  }

  const txt = document.createElement('div');
  txt.textContent = slide.text;
  txt.style.margin = '8px 15px 0 15px';
  txt.style.fontSize = '17px';
  txt.style.fontWeight = '500';
  txt.style.color = '#333';
  txt.style.textAlign = 'center';
  txt.style.lineHeight = '1.5';
  gallerySlideshow.appendChild(txt);

  const audioContainer = document.createElement('div');
  audioContainer.style.marginTop = '15px';
  gallerySlideshow.appendChild(audioContainer);

  let ttsExists = false; // TTS 존재 여부 플래그
  let ttsAudioUrl = null; // TTS URL 저장 변수

  try {
    const user = auth.currentUser;
    if (user) {
      // Firestore 쿼리 수정: 루트 tts 컬렉션 조회 및 uid 필터 추가
      const ttsQuery = query(collection(db, "tts"),
                           where("uid", "==", user.uid),
                           where("title", "==", slide.title),
                           where("order", "==", slide.order || (galleryCurrentIdx + 1))
                          );
      const ttsSnap = await getDocs(ttsQuery);

      ttsExists = !ttsSnap.empty; // 스냅샷이 비어있지 않으면 TTS 존재

      if (ttsExists) {
        const ttsDoc = ttsSnap.docs[0].data();
        if (ttsDoc.filePath) {
          const storage = getStorage();
          const audioRef = ref(storage, ttsDoc.filePath);
          ttsAudioUrl = await getDownloadURL(audioRef); // URL 저장
          // ... (플레이어 생성 및 추가)
          const audioPlayer = document.createElement('audio');
          audioPlayer.controls = true;
          audioPlayer.src = ttsAudioUrl;
          audioPlayer.style.width = '90%';
          audioContainer.appendChild(audioPlayer);
        }
      }
    }
  } catch (error) {
    console.error("[Gallery] Error fetching or displaying TTS audio:", error);
  }

  gallerySlideIndicator.textContent = `${galleryCurrentIdx + 1} / ${galleryCurrentSet.length}`;

  // TTS 버튼 상태 업데이트 로직 수정: findTTSUrl 호출 제거 및 ttsExists 사용
  if (ttsBtn && ttsMsg) {
    if (ttsExists) {
      ttsBtn.disabled = true;
      ttsMsg.textContent = '음성(mp3) 이미 존재';
    } else {
      ttsBtn.disabled = false;
      ttsMsg.textContent = '음성 없음 - 생성 가능';
    }
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

// 미리보기 로직 수정: findTTSUrl 호출 제거 및 직접 조회
galleryPreviewBtn.onclick = async () => {
  if (!galleryCurrentSet || galleryPreviewing) return;
  galleryPreviewing = true;

  for (let i = galleryCurrentIdx; i < galleryCurrentSet.length; i++) {
    if (!galleryPreviewing) break; // 중간에 닫으면 중지

    galleryCurrentIdx = i;
    await renderGallerySlide(); // 슬라이드 표시 (이 안에서 ttsAudioUrl 변수는 갱신될 수 있음)

    const slide = galleryCurrentSet[i];
    let currentSlideAudioUrl = null;

    // TTS URL 직접 조회 (renderGallerySlide와 유사 로직)
    try {
      const user = auth.currentUser;
      if (user) {
        const ttsQuery = query(collection(db, "tts"),
                             where("uid", "==", user.uid),
                             where("title", "==", slide.title),
                             where("order", "==", slide.order || (galleryCurrentIdx + 1))
                            );
        const ttsSnap = await getDocs(ttsQuery);
        if (!ttsSnap.empty) {
          const ttsDoc = ttsSnap.docs[0].data();
          if (ttsDoc.filePath) {
            const storage = getStorage();
            const audioRef = ref(storage, ttsDoc.filePath);
            currentSlideAudioUrl = await getDownloadURL(audioRef);
          }
        }
      }
    } catch (e) { console.error("Error fetching TTS for preview:", e); }

    // URL 있으면 재생, 없으면 잠시 대기
    if (currentSlideAudioUrl) {
      await playAudio(currentSlideAudioUrl);
    } else {
      await sleep(1500);
    }
  }
  galleryPreviewing = false;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 갤러리 슬라이드별 음성 생성 버튼 핸들러 (수정: Cloud Function 호출 방식으로 변경)
if (ttsBtn) {
  ttsBtn.onclick = async () => {
    if (!galleryCurrentSet) return;
    const slide = galleryCurrentSet[galleryCurrentIdx];
    const title = galleryCurrentSet[0]?.title || '';
    const order = galleryCurrentIdx + 1;
    const text = slide.text;
    const user = auth.currentUser; // 사용자 정보 가져오기

    if (!user) {
      alert('음성 생성을 위해 로그인이 필요합니다.');
      return;
    }
    if (!title) {
      alert('스토리 제목을 찾을 수 없습니다.');
      return;
    }
    if (!text) {
      alert('음성으로 변환할 텍스트가 없습니다.');
      return;
    }

    if (ttsMsg) ttsMsg.textContent = '음성 생성 요청 중...';
    ttsBtn.disabled = true;

    try {
      console.log(`[Gallery] Cloud Function 호출 시도: title=${title}, order=${order}`);
      const ttsFunctionUrl = 'https://us-central1-fairytale-186ee.cloudfunctions.net/generateAndSaveTTS'; // 배포된 함수 URL

      const response = await fetch(ttsFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text, 
          order: order, 
          title: title, 
          uid: user.uid // 사용자 UID 전달
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error(`[Gallery] Cloud Function 호출 실패:`, result);
        throw new Error(result.error || 'Cloud Function 호출 실패');
      } else {
        console.log(`[Gallery] Cloud Function 호출 성공:`, result);
        if (ttsMsg) ttsMsg.textContent = '음성 생성 완료!';
        // 성공 시 슬라이드를 다시 렌더링하여 오디오 플레이어 표시 및 버튼 상태 업데이트
        renderGallerySlide(); 
      }

    } catch (e) {
      console.error('[Gallery] TTS 생성 요청 실패:', e);
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

// --- 삭제 모드 토글 함수 ---
function toggleDeleteMode() {
    isDeleteMode = !isDeleteMode;
    selectedTitlesToDelete = []; // 모드 변경 시 선택 초기화
    galleryList.classList.toggle('delete-mode', isDeleteMode);
    deleteModeControls.style.display = isDeleteMode ? 'block' : 'none';
    renderGalleryList(); // 버튼 상태 및 UI 갱신
    // TODO: 삭제 모드 시작/취소 버튼 UI 업데이트
}

// --- 아이템 선택 처리 함수 ---
function handleItemSelection(title, containerElement) {
    if (!isDeleteMode) return;

    const index = selectedTitlesToDelete.indexOf(title);
    if (index > -1) {
        // 이미 선택됨 -> 선택 해제
        selectedTitlesToDelete.splice(index, 1);
        containerElement.classList.remove('selected-for-delete');
    } else {
        // 새로 선택
        selectedTitlesToDelete.push(title);
        containerElement.classList.add('selected-for-delete');
    }
    // 선택된 항목 수에 따라 확인 버튼 표시/숨김
    deleteModeControls.style.display = selectedTitlesToDelete.length > 0 ? 'block' : 'none';
    // 버튼 상태 갱신 (색상 등)
    renderGalleryList(); // 간단하게 전체 리스트를 다시 그림
}

// --- 선택 항목 삭제 함수 ---
async function deleteSelectedStorySets() {
    if (selectedTitlesToDelete.length === 0) {
        alert("삭제할 이야기를 선택해주세요.");
        return;
    }

    if (!confirm(`${selectedTitlesToDelete.length}개의 이야기 세트를 삭제하시겠습니까?\n\n- ${selectedTitlesToDelete.join('\n- ' )}`)) {
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("삭제를 위해 로그인이 필요합니다.");
        return;
    }

    console.log(`[Delete] Deleting ${selectedTitlesToDelete.length} story sets for user: ${user.uid}`);
    // TODO: 로딩 표시
    confirmDeleteBtn.disabled = true;
    cancelDeleteBtn.disabled = true;

    try {
        const storage = getStorage();
        let allPromises = [];

        for (const title of selectedTitlesToDelete) {
            // 1. Firestore stories 문서 조회 및 삭제 준비
            const storiesQuery = query(collection(db, "stories"),
                                     where("uid", "==", user.uid),
                                     where("title", "==", title));
            const storiesSnap = await getDocs(storiesQuery);
            storiesSnap.forEach((storyDoc) => {
                const storyData = storyDoc.data();
                if (storyData.imageUrl) {
                    try {
                        const urlDecoded = decodeURIComponent(storyData.imageUrl);
                        const pathRegex = /\/o\/(.+)\?alt=media/;
                        const match = urlDecoded.match(pathRegex);
                        if (match && match[1]) {
                            const imagePath = match[1];
                            const imageRef = ref(storage, imagePath);
                            allPromises.push(deleteObject(imageRef).catch(e => console.warn(`Failed to delete image ${imagePath}:`, e)));
                        }
                    } catch (e) { console.error(`Error processing image URL ${storyData.imageUrl}:`, e); }
                }
                allPromises.push(deleteDoc(doc(db, "stories", storyDoc.id)));
            });

            // 2. Firestore tts 문서 조회 및 삭제 준비
            const ttsQuery = query(collection(db, "tts"),
                                 where("uid", "==", user.uid),
                                 where("title", "==", title));
            const ttsSnap = await getDocs(ttsQuery);
            ttsSnap.forEach((ttsDoc) => {
                const ttsData = ttsDoc.data();
                if (ttsData.filePath) {
                    try {
                        const audioRef = ref(storage, ttsData.filePath);
                        allPromises.push(deleteObject(audioRef).catch(e => console.warn(`Failed to delete audio ${ttsData.filePath}:`, e)));
                    } catch (e) { console.error(`Error creating ref for audio path ${ttsData.filePath}:`, e); }
                }
                allPromises.push(deleteDoc(doc(db, "tts", ttsDoc.id)));
            });
        }

        // 3. 모든 삭제 작업 병렬 실행
        await Promise.all(allPromises);

        console.log(`[Delete] Successfully deleted selected story sets.`);

        // 4. 로컬 데이터 및 UI 업데이트
        selectedTitlesToDelete.forEach(title => {
            delete galleryStoriesByTitle[title];
        });
        selectedTitlesToDelete = [];
        isDeleteMode = false; // 삭제 후 모드 종료
        deleteModeControls.style.display = 'none';
        renderGalleryList();
        alert("선택한 이야기가 삭제되었습니다.");

    } catch (error) {
        console.error("[Delete] Error deleting selected story sets:", error);
        alert("이야기 삭제 중 오류가 발생했습니다.");
    } finally {
        // TODO: 로딩 표시 제거
        confirmDeleteBtn.disabled = false;
        cancelDeleteBtn.disabled = false;
    }
}

// --- 기존 deleteStorySet 함수는 삭제 또는 주석 처리 ---
/* async function deleteStorySet(title) { ... } */

// --- 이벤트 리스너 연결 --- 
// DOMContentLoaded 내부에 연결하거나, 함수 정의 후 바로 연결
if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = deleteSelectedStorySets;
}
if (cancelDeleteBtn) {
    cancelDeleteBtn.onclick = toggleDeleteMode; // 취소 버튼은 모드 토글
}
