/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Firebase Functions 및 Admin SDK 초기화
// const functions = require("firebase-functions"); // v1 방식 주석 처리
const {onRequest} = require("firebase-functions/v2/https"); // v2 방식 import
const admin = require("firebase-admin");
admin.initializeApp();

// Google Generative AI SDK 가져오기
const {GoogleGenerativeAI} = require("@google/generative-ai");

// --- generateStory HTTP Cloud Function (v2 방식) ---
exports.generateStory = onRequest(
    {secrets: ["GEMINI_API_KEY"]}, // 사용할 비밀 지정
    async (req, res) => {
      // CORS 설정 (모든 출처 허용 - 개발용. 실제 서비스에서는 특정 도메인만 허용하도록 변경 권장)
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        // Preflight 요청 처리
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      // 요청 본문에서 prompt 가져오기
      const userPrompt = req.body.prompt;
      if (!userPrompt) {
        console.error("요청 본문에 'prompt'가 없습니다.");
        res.status(400).json({error: "Request body must contain 'prompt'"});
        return;
      }

      // --- 환경 변수에서 API 키 가져오기 (v2 방식) ---
      // const geminiApiKey = functions.config().gemini?.key; // v1 방식 (사용 불가)
      const geminiApiKey = process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        console.error("Gemini API 키가 환경 변수(process.env.GEMINI_API_KEY)에 설정되지 않았습니다.");
        res.status(500).json({error: "API key not configured"});
        return;
      }

      console.log("수신된 프롬프트:", userPrompt);

      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const modelName = "gemini-1.5-pro-latest"; // 이미지 생성 가능성이 높은 모델 사용
        const model = genAI.getGenerativeModel({
          model: modelName,
        });

        console.log(`[${modelName}] API 호출 시작 (스트리밍 방식)...`);

        const fullPrompt = `${userPrompt}\n\n(이 프롬프트에 어울리는 귀여운 포메라니안 동화 그림과 함께, 한국어로 짧고 재미있는 이야기 형식으로 답해주세요.)`;

        // --- API 호출 방식을 스트리밍으로 변경 ---
        const result = await model.generateContentStream(fullPrompt);

        // --- 스트림 응답 처리 ---
        let generatedText = "";
        let generatedImageData = null;

        console.log("Gemini API 스트림 수신 시작...");
        // 스트림을 순회하며 텍스트와 이미지 데이터 추출
        for await (const chunk of result.stream) {
          // 청크에서 텍스트 추출 (chunk.text() 사용)
          const chunkText = chunk.text ? chunk.text() : null;
          if (chunkText) {
            generatedText += chunkText;
          }

          // 청크에서 이미지 데이터 추출 (기존 로직과 유사)
          // (스트림에서는 일반적으로 마지막 청크 등에 이미지가 몰려올 수 있음)
          if (!generatedImageData && chunk.candidates && chunk.candidates.length > 0) {
            const candidate = chunk.candidates[0];
            if (candidate.content && candidate.content.parts) {
              const imagePart = candidate.content.parts.find((part) => part.inlineData);
              if (imagePart && imagePart.inlineData.data) {
                generatedImageData = imagePart.inlineData.data; // Base64 데이터
                console.log("Gemini API: 스트림에서 이미지 데이터(base64) 수신됨");
                // 이미지를 찾으면 더 이상 이미지 파트 탐색 불필요 (첫 이미지만 사용 가정)
              }
            }
          }
        }
        console.log("Gemini API 스트림 수신 완료.");

        // --- 최종 결과 확인 및 응답 ---
        if (!generatedText && !generatedImageData) {
          console.error("Gemini API 스트림 응답에서 텍스트 또는 이미지 데이터를 추출하지 못했습니다.");
          // 스트림 응답 전체를 로깅하여 구조 확인 (디버깅용)
          try {
            const aggregatedResponse = await result.response;
            console.error("전체 응답 객체 (디버깅용):", JSON.stringify(aggregatedResponse));
          } catch (aggError) {
            console.error("전체 응답 객체 로깅 중 오류:", aggError);
          }
          throw new Error("API 스트림 응답 처리 실패");
        }

        console.log("Gemini API 최종 응답 텍스트:", generatedText ? generatedText.substring(0, 100) + "..." : "없음");
        console.log("Gemini API 최종 이미지 데이터 수신 여부:", !!generatedImageData);

        // 클라이언트에 결과 반환 (텍스트와 이미지 데이터 포함)
        res.status(200).json({text: generatedText, imageData: generatedImageData});
      } catch (error) {
        console.error("Google GenAI API 호출 중 오류:", error);
        res.status(500).json({error: "Failed to generate story", details: error.message});
      }
    });

// --- generateAndSaveTTS HTTP Cloud Function (v2 방식) ---
const fetch = require("node-fetch");
const {getStorage} = require("firebase-admin/storage"); // Admin SDK Storage
const {getFirestore} = require("firebase-admin/firestore"); // Admin SDK Firestore

exports.generateAndSaveTTS = onRequest(
    {secrets: ["OPENAI_API_KEY"]}, // 사용할 비밀 지정
    async (req, res) => {
      // CORS 설정
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      // 요청 본문에서 데이터 가져오기 (text, order, title, uid 필요)
      const {text, order, title, uid} = req.body;
      if (!text || !order || !title || !uid) {
        console.error("요청 본문에 필요한 데이터(text, order, title, uid)가 없습니다.", req.body);
        res.status(400).json({error: "Missing required fields: text, order, title, uid"});
        return;
      }

      // --- OpenAI API 키 가져오기 (v2 방식) ---
      // const openaiApiKey = functions.config().openai?.key; // v1 방식 (사용 불가)
      const openaiApiKey = process.env.OPENAI_API_KEY;

      if (!openaiApiKey) {
        console.error("OpenAI API 키가 환경 변수(process.env.OPENAI_API_KEY)에 설정되지 않았습니다.");
        res.status(500).json({error: "OpenAI API key not configured"});
        return;
      }

      console.log(`[TTS] 생성 요청 수신: title=${title}, order=${order}`);

      try {
        // 1. OpenAI TTS API 호출
        console.log("[TTS] OpenAI API 호출 시작...");
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            input: text,
            voice: "nova", // 또는 다른 목소리
            response_format: "mp3",
          }),
        });

        if (!ttsResponse.ok) {
          const errText = await ttsResponse.text();
          console.error("[TTS] OpenAI API 오류 응답:", errText);
          throw new Error(`OpenAI TTS API failed with status ${ttsResponse.status}: ${errText}`);
        }

        // 2. 오디오 데이터(Buffer) 가져오기
        const audioBuffer = await ttsResponse.buffer();
        console.log("[TTS] OpenAI API 응답 수신 (Buffer 생성됨)");

        // 3. Firebase Storage에 업로드
        const bucket = getStorage().bucket(); // 기본 버킷 사용
        const fileName = `tts/${uid}_${title}_${order}_${Date.now()}.mp3`;
        const file = bucket.file(fileName);

        console.log(`[TTS] Storage 업로드 시작: ${fileName}`);
        await file.save(audioBuffer, {
          metadata: {contentType: "audio/mpeg"}, // MIME 타입 지정
        });
        console.log(`[TTS] Storage 업로드 완료: ${fileName}`);

        // 4. 업로드된 파일의 공개 URL 가져오기 (getSignedUrl은 복잡하므로 getPublicUrl 사용)
        // 주의: Storage 규칙이 공개 읽기를 허용해야 함. 또는 getDownloadURL 사용 (권장)
        // 여기서는 간단히 파일 경로만 저장하고 클라이언트에서 getDownloadURL로 가져오도록 유도 가능
        // const audioUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`; // 공개 URL 방식 (규칙 필요)

        // getDownloadURL 방식을 위해 파일 참조만 반환하거나, 클라이언트에서 처리
        // 여기서는 Firestore에 경로만 저장
        const filePath = fileName;

        // 5. Firestore 'tts' 컬렉션에 저장
        console.log(`[TTS] Firestore 저장 시도: title=${title}, order=${order}`);
        const db = getFirestore();
        await db.collection("tts").add({
          uid: uid,
          filePath: filePath, // Storage 파일 경로 저장
          order: order,
          title: title,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log("[TTS] Firestore 저장 성공");

        // 클라이언트에 성공 응답 (파일 경로 또는 간단한 성공 메시지)
        res.status(200).json({success: true, filePath: filePath});
      } catch (error) {
        console.error("[TTS] 함수 처리 중 오류:", error);
        res.status(500).json({error: "Failed to generate or save TTS", details: error.message});
      }
    });

console.log("functions/index.js 로드 완료 (v2 구문 적용)");
