/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

console.log('index.tsx script loaded');

import {GoogleGenAI} from '@google/genai';
import {marked} from 'marked';

function debugLog(msg: string) {
  console.log('[DEBUG]', msg);
}

const ai = new GoogleGenAI({apiKey: 'AIzaSyBu3dI321KSpWeu1Q5EJhwypH0fB-yZ2gE'});

const chat = ai.chats.create({
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
  history: [],
});

const additionalInstructions = `
Use a fairy tale story about white Pomeranian as a metaphor.
Keep sentences short but conversational, casual, educational and engaging.
Generate a cute, animate for each sentence with ink-painting on white background.
No commentary, just begin your explanation.
Keep going until you're done.`;

async function addSlide(text: string, image: HTMLImageElement) {
  debugLog('addSlide called');
  const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
  const slide = document.createElement('div');
  slide.className = 'slide';
  const caption = document.createElement('div') as HTMLDivElement;
  caption.innerHTML = await marked.parse(text);
  slide.append(image);
  slide.append(caption);
  slideshow.append(slide);
}

function parseError(error: any) {
  debugLog('parseError called');
  if (typeof error === 'string') {
    const regex = /{"error":(.*)}/gm;
    const m = regex.exec(error);
    try {
      const e = m[1];
      const err = JSON.parse(e);
      return err.message;
    } catch (e) {
      return error;
    }
  }
  if (error && error.message) return error.message;
  return String(error);
}

async function generate(message: string) {
  debugLog('generate called');
  const userInput = document.querySelector('#input') as HTMLTextAreaElement;
  const modelOutput = document.querySelector('#output') as HTMLDivElement;
  const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
  const error = document.querySelector('#error') as HTMLDivElement;
  userInput.disabled = true;

  chat.history.length = 0;
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  error.toggleAttribute('hidden', true);

  try {
    debugLog('generate try block');
    const userTurn = document.createElement('div') as HTMLDivElement;
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });

    let text = '';
    let img = null;

    for await (const chunk of result) {
      debugLog('chunk received');
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
                debugLog('no data in chunk');
              }
            } catch (e) {
              debugLog('exception in image part');
            }
          }
          if (text && img) {
            await addSlide(text, img);
            slideshow.removeAttribute('hidden');
            text = '';
            img = null;
          }
        }
      }
    }
    if (img) {
      await addSlide(text, img);
      slideshow.removeAttribute('hidden');
      text = '';
    }
  } catch (e) {
    debugLog('generate catch block');
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  }
  userInput.disabled = false;
  userInput.focus();
}

document.addEventListener('DOMContentLoaded', () => {
  debugLog('DOMContentLoaded');
  const userInput = document.querySelector('#input') as HTMLTextAreaElement;
  const modelOutput = document.querySelector('#output') as HTMLDivElement;
  const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
  const error = document.querySelector('#error') as HTMLDivElement;
  const runBtn = document.querySelector('#run-btn') as HTMLButtonElement;
  if (!userInput || !modelOutput || !slideshow || !error || !runBtn) {
    debugLog('필수 DOM 요소가 존재하지 않습니다.');
    throw new Error('필수 DOM 요소가 존재하지 않습니다.');
  }

  userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
    debugLog('keydown event');
    if (e.code === 'Enter') {
      e.preventDefault();
      const message = userInput.value;
      debugLog('Enter pressed: ' + message);
      await generate(message);
    }
  });

  runBtn.addEventListener('click', async () => {
    debugLog('실행 버튼 클릭됨');
    const message = userInput.value;
    await generate(message);
  });

  const examples = document.querySelectorAll('#examples li');
  examples.forEach((li) =>
    li.addEventListener('click', async (e) => {
      debugLog('예시 클릭: ' + li.textContent);
      await generate(li.textContent);
    }),
  );
});
