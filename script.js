const form = document.getElementById('form');
const dropzone = document.getElementById('dropzone');
const fileInput = form.querySelector('input[type="file"]');
const statusP = document.getElementById('status');
const resultDiv = document.getElementById('result');
const rawPre = document.getElementById('raw');
const copyBtn = document.getElementById("copy");
const fileNameSpan = document.getElementById("filename");
const prismLink = document.querySelector('link[href*="prism"]')
const root = document.documentElement;

const prismLight = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";
const prismDark = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";

const applyTheme = (theme) => {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  prismLink.href = theme === "dark" ? prismDark : prismLight;
  document.getElementById('color_mode').innerHTML = theme === "dark" ? '<img src="light.png"></img>' : '<img src="dark.png"></img>';
};

const toggleTheme = () => {
  const current = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(current);
};

applyTheme("light");

const saved = localStorage.getItem("theme");
if (saved) root.setAttribute("data-theme", saved);

function drawResults(data) {
  showResult();
  

  // Nyers json
  rawPre.textContent = JSON.stringify(data, null, 2);
  copyBtn.innerHTML = '<img src="copy.png">';

  // Kirajzolás
  const { fileName, extracted } = data;
  const { allergens, nutrition } = extracted || {};

  fileNameSpan.textContent = fileName;

  // Allergének tábla
  const allergenRows = Object.entries(allergens || {}).map(
    ([k, v]) => `<tr><td>${k}</td><td>${v ? 'igen' : 'nem'}</td></tr>`
  ).join('');

  // Tápérték tábla
  const nutrientRows = Object.entries(nutrition || {}).map(([k, obj]) => {
    if (!obj) return `<tr><td>${k}</td><td colspan="2">nincs adat</td></tr>`;
    return `<tr><td>${k}</td><td>${obj.value}</td><td>${obj.unit}</td></tr>`;
  }).join('');

  resultDiv.innerHTML = `
<pre id='result_container'>
<div>
<h4>Allergének</h4><table>
  <thead><tr><th>Allergén</th><th>Jelen van?</th></tr></thead>
  <tbody>${allergenRows}</tbody>
</table>
</div>
<div>
<h4>Tápérték</h4><table>
  <thead><tr><th>Megnevezés</th><th>Érték</th><th>Egység</th></tr></thead>
  <tbody>${nutrientRows}</tbody></table></div></pre>`;

}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideResult();
  dropzone.classList.add('spinner');
  dropzone.textContent = 'Feldolgozás...';
  resultDiv.innerHTML = '';
  rawPre.textContent = '';

  const fd = new FormData(form);
  const file = fd.get('file');
  if (!file || !file.name) {
    statusP.innerHTML = '<span class="error">Válassz egy PDF-et!</span>';
    dropzone.innerHTML = '<span id="drop">Dobd ide</span> a PDF-et vagy <span id="click">kattints</span>';
    dropzone.classList.remove('spinner');
    return;
  }

  try {
    const force = document.getElementById('force').checked ? 'true' : 'false';
    const res = await fetch(`https://pdfextract.up.railway.app//upload?force_ocr=${force}`, {
      method: 'POST',
      body: fd
    });
    const data = await res.json();
    dropzone.classList.remove('spinner');

    if (!res.ok) throw new Error(data.error || 'Hiba');
    dropzone.innerHTML = '<span id="drop">Dobd ide</span> a PDF-et vagy <span id="click">kattints</span>';

    drawResults(data);

  } catch (err) {
    statusP.innerHTML = `<span class="error">${err.message}</span>`;
    dropzone.innerHTML = '<span id="drop">Dobd ide</span> a PDF-et vagy <span id="click">kattints</span>';
    dropzone.classList.remove('spinner');
  }
});

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => form.requestSubmit());

// drag and drop
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', e => {
  dropzone.classList.remove('dragover');
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  form.requestSubmit();
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(rawPre.textContent);
  copyBtn.innerHTML = '<img src="check.png">';
});

function hideResult() {
  document.getElementById("raw_container").style.display = "none";
  document.getElementById("resultTitle").style.display = "none";
  document.getElementById("rawTitle").style.display = "none";
}

function showResult() {
  document.getElementById("raw_container").style.display = "block";
  document.getElementById("resultTitle").style.display = "block";
  document.getElementById("rawTitle").style.display = "block";
}

hideResult();