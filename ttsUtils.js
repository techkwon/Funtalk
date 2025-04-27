import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { db, storage } from "./firebaseConfig.js";

const auth = getAuth();

// blob -> base64 변환
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // base64 데이터 부분만 추출
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// TTS 생성 및 Storage 업로드 함수 (export 추가)
export async function generateAndUploadTTS(text, order, title) {
  console.log(`[TTS Utils] generateAndUploadTTS 호출됨: title=${title}, order=${order}`);
  const url = "https://api.openai.com/v1/audio/speech";
  const headers = {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  };
  const body = JSON.stringify({
    model: "tts-1", // 또는 "tts-1-hd"
    input: text,
    voice: "nova", // 사용 가능한 다른 목소리: alloy, echo, fable, onyx, shimmer
    response_format: "mp3" // 다른 포맷: opus, aac, flac
  });

  try {
    console.log("[TTS Utils] OpenAI TTS API 요청 시작...");
    const res = await fetch(url, { method: "POST", headers, body });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error("[TTS Utils] OpenAI TTS API 오류 응답:", errText);
      throw new Error("OpenAI TTS API 오류: " + errText);
    }
    
    console.log("[TTS Utils] OpenAI TTS API 응답 수신, Blob 변환 중...");
    const blob = await res.blob();
    console.log("[TTS Utils] Blob 생성 완료, Base64 변환 및 업로드 시작...");

    // Firebase Storage 업로드
    const user = auth.currentUser;
    if (!user) {
      throw new Error('TTS 업로드를 위해 로그인이 필요합니다.');
    }
    
    const fileName = `tts/${user.uid}_${title}_${order}_${Date.now()}.mp3`;
    const storageRef = ref(storage, fileName);
    
    // blob을 base64로 변환하여 업로드
    const base64Data = await blobToBase64(blob);
    console.log(`[TTS Utils] Base64 변환 완료, Storage 업로드 시작: ${fileName}`);
    await uploadString(storageRef, base64Data, 'base64');
    console.log(`[TTS Utils] Storage 업로드 완료: ${fileName}`);
    
    // 업로드된 파일의 다운로드 URL 가져오기
    const audioUrl = await getDownloadURL(storageRef);
    console.log(`[TTS Utils] 다운로드 URL 생성 완료: ${audioUrl}`);
    return audioUrl;

  } catch (error) {
    console.error("[TTS Utils] generateAndUploadTTS 함수 오류:", error);
    throw error; // 오류를 다시 던져 호출한 곳에서 처리하도록 함
  }
}

// Firestore에 음성 URL 저장 함수 (export 추가)
export async function saveTTSUrlToFirestore(audioUrl, order, title) {
  console.log(`[TTS Utils] saveTTSUrlToFirestore 호출됨: title=${title}, order=${order}`);
  const user = auth.currentUser;
  if (!user) {
    console.error("[TTS Utils] Firestore 저장 실패: 로그인이 필요합니다.");
    return false; // 또는 오류 throw
  }

  try {
    await addDoc(collection(db, "tts"), {
      uid: user.uid,
      audioUrl,
      order,
      title,
      createdAt: serverTimestamp(),
    });
    console.log(`[TTS Utils] Firestore 'tts' 컬렉션 저장 성공: title=${title}, order=${order}`);
    return true;
  } catch (error) {
    console.error("[TTS Utils] Firestore 'tts' 컬렉션 저장 실패:", error);
    return false; // 또는 오류 throw
  }
} 