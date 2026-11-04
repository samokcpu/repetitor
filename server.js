import express from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { ChatYandexGPT } from '@langchain/yandex/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

// Разрешаем запросы с других сайтов (для GitHub Pages)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const chat = new ChatYandexGPT({
  model: 'yandexgpt-lite',
  temperature: 0.2,
  maxTokens: 2000,
});

const schoolPrompts = {
  math: `Ты — строгий учитель математики. Реши задачу ПОШАГОВО. Формат СТРОГО:\nШАГ 1: ...\nШАГ 2: ...\nОТВЕТ: ...\n\nЗадание: `,
  russian: `Ты — учитель русского языка. Разбери задание по шагам. Формат СТРОГО:\nШАГ 1: ...\nШАГ 2: ...\nОТВЕТ: ...\n\nЗадание: `,
  english: `You are an English teacher. Explain step-by-step. Формат СТРОГО:\nШАГ 1: ...\nШАГ 2: ...\nОТВЕТ: ...\n\nЗадание: `,
};

async function extractTextFromImage(buffer) {
  const worker = await createWorker('rus+eng');
  try {
    const { data } = await worker.recognize(buffer);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

app.post('/api/solve', async (req, res) => {
  const { subject, task } = req.body;
  if (!['math', 'russian', 'english'].includes(subject)) return res.status(400).json({ error: 'Неизвестный предмет' });

  try {
    const response = await chat.invoke([
      new SystemMessage(schoolPrompts[subject]),
      new HumanMessage(task.trim()),
    ]);
    res.json(parseAnswer(response.content));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка YandexGPT' });
  }
});

app.post('/api/solve-image', upload.single('image'), async (req, res) => {
  const subject = req.body.subject || 'math';
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

  try {
    const text = await extractTextFromImage(req.file.buffer);
    const response = await chat.invoke([
      new SystemMessage(schoolPrompts[subject]),
      new HumanMessage(text),
    ]);
    res.json({ extractedText: text, ...parseAnswer(response.content) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обработки фото' });
  }
});

function parseAnswer(text) {
  const steps = [];
  let answer = '';
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (/^ШАГ\s*\d+/i.test(t)) steps.push(t.replace(/^ШАГ\s*\d+[:.)]?\s*/i, ''));
    else if (/^ОТВЕТ[:]/i.test(t)) answer = t.replace(/^ОТВЕТ[:]\s*/i, '');
  }
  if (steps.length === 0) steps.push(text);
  if (!answer) answer = 'См. решение выше';
  return { steps, answer };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
