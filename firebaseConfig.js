// Firebase 프로젝트 설정 정보를 입력하세요.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDta1zwalDfceLCCkhwfAMuDufsf_aaOIE",
  authDomain: "fairytale-186ee.firebaseapp.com",
  projectId: "fairytale-186ee",
  storageBucket: "fairytale-186ee.firebasestorage.app", // 올바른 스토리지 버킷 이름으로 수정
  messagingSenderId: "226743877675",
  appId: "1:226743877675:web:6942fe5e5f7fd566626a6e",
  measurementId: "G-NJB455BDMV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// <YOUR_API_KEY> 부분을 실제 키로 교체하세요.
