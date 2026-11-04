let currentSubject = 'math';
let selectedImage = null;
const tabs = document.querySelectorAll('.tab');
const input = document.getElementById('taskInput');
const imageInput = document.getElementById('imageInput');
const fileName = document.getElementById('fileName');
const btn = document.getElementById('solveBtn');
const result = document.getElementById('result');

// ВАЖНО: Сюда потом вставим ссылку от Render
const BACKEND_URL = 'http://localhost:3000'; 

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentSubject = tab.dataset.subject;
  });
});

imageInput.addEventListener('change', () => {
  selectedImage = imageInput.files[0] || null;
  fileName.textContent = selectedImage ? selectedImage.name : '';
});

btn.addEventListener('click', async () => {
  const task = input.value.trim();
  if (!task && !selectedImage) return alert('Введи задание или загрузи фото');

  btn.disabled = true;
  btn.textContent = 'Решаю...';
  result.classList.remove('hidden');
  result.innerHTML = '<div>🧠 Думаю...</div>';

  try {
    let data;
    if (selectedImage) {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('subject', currentSubject);
      const res = await fetch(`${BACKEND_URL}/api/solve-image`, { method: 'POST', body: formData });
      data = await res.json();
    } else {
      const res = await fetch(`${BACKEND_URL}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: currentSubject, task })
      });
      data = await res.json();
    }

    if (data.error) throw new Error(data.error);

    let html = data.extractedText ? `<div class="step"><strong>📷 Распознано:</strong> ${data.extractedText}</div>` : '';
    data.steps.forEach((s, i) => html += `<div class="step"><strong>Шаг ${i + 1}:</strong> ${s}</div>`);
    html += `<div class="answer">✅ <strong>Ответ:</strong> ${data.answer}</div>`;
    result.innerHTML = html;
  } catch (err) {
    result.innerHTML = `<div>⚠️ ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Решить по шагам';
    selectedImage = null;
    imageInput.value = '';
    fileName.textContent = '';
  }
});
