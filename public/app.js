'use strict';

const $ = (sel) => document.querySelector(sel);

const state = {
  mergeFiles: [],
  splitFile: null,
  splitPages: 0,
  compressFile: null,
  extractFile: null,
};

// ---------- util ----------

function showAlert(message, type = 'error') {
  const el = $('#alert');
  el.textContent = message;
  el.className = 'alert ' + type;
  el.hidden = false;
  clearTimeout(showAlert._t);
  if (type !== 'error') {
    showAlert._t = setTimeout(() => { el.hidden = true; }, 5000);
  }
}

function hideAlert() {
  $('#alert').hidden = true;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function apiPost(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    let msg = 'Terjadi kesalahan.';
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch (_) { /* non-JSON error */ }
    throw new Error(msg);
  }
  return res;
}

function downloadUrl(res) {
  return res.blob().then((blob) => URL.createObjectURL(blob));
}

function setBusy(btn, busy, busyText) {
  btn.disabled = busy;
  btn.textContent = busy ? busyText : btn.dataset.label;
  document.body.classList.toggle('loading', busy);
}

// ---------- tabs ----------

const navTabs = document.querySelectorAll('.nav-tab');
const navbar = $('.navbar');
const hamburger = $('.nav-hamburger');

function activateTab(tab) {
  navTabs.forEach((t) => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  $('#' + tab.getAttribute('aria-controls')).classList.add('active');
  hideAlert();
  // Close mobile menu on selection
  navbar.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
}

navTabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab));
});

// Keyboard navigation for tabs
navTabs.forEach((tab, idx) => {
  tab.addEventListener('keydown', (e) => {
    let targetIdx = idx;
    if (e.key === 'ArrowRight') targetIdx = (idx + 1) % navTabs.length;
    else if (e.key === 'ArrowLeft') targetIdx = (idx - 1 + navTabs.length) % navTabs.length;
    else if (e.key === 'Home') targetIdx = 0;
    else if (e.key === 'End') targetIdx = navTabs.length - 1;
    else return;
    e.preventDefault();
    navTabs[targetIdx].focus();
    activateTab(navTabs[targetIdx]);
  });
});

// Hamburger toggle
hamburger.addEventListener('click', () => {
  const isOpen = navbar.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', isOpen);
  if (isOpen) {
    // Focus first tab when opening
    const activeTab = navbar.querySelector('.nav-tab.active') || navTabs[0];
    activeTab.focus();
  }
});

// Close menu on click outside
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target) && !hamburger.contains(e.target)) {
    navbar.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

// ---------- config ----------

fetch('/api/config')
  .then((r) => r.json())
  .then((cfg) => {
    $('#merge-limits').textContent = `${cfg.maxFiles} file / ${cfg.maxTotalMb} MB`;
  })
  .catch(() => {});

// ---------- MERGE ----------

const mergeDrop = $('#merge-drop');
const mergeInput = $('#merge-input');
const mergeList = $('#merge-list');
const mergeBtn = $('#merge-btn');

mergeDrop.addEventListener('click', () => mergeInput.click());
mergeDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mergeInput.click(); }
});
mergeDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  mergeDrop.classList.add('dragover');
});
mergeDrop.addEventListener('dragleave', () => mergeDrop.classList.remove('dragover'));
mergeDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  mergeDrop.classList.remove('dragover');
  addMergeFiles(e.dataTransfer.files);
});
mergeInput.addEventListener('change', () => {
  addMergeFiles(mergeInput.files);
  mergeInput.value = '';
});

function addMergeFiles(fileList) {
  const files = Array.from(fileList || []).filter(isPdf);
  const rejected = Array.from(fileList || []).length - files.length;
  if (rejected > 0) {
    showAlert(`${rejected} file dilewati (bukan PDF).`, 'info');
  }
  state.mergeFiles = state.mergeFiles.concat(files);
  renderMergeList();
  hideAlert();
}

function renderMergeList() {
  mergeList.innerHTML = '';
  mergeList.hidden = state.mergeFiles.length === 0;

  state.mergeFiles.forEach((file, i) => {
    const li = document.createElement('li');

    const num = document.createElement('span');
    num.className = 'fsize';
    num.textContent = i + 1 + '.';

    const name = document.createElement('span');
    name.className = 'fname';
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement('span');
    size.className = 'fsize';
    size.textContent = formatSize(file.size);

    const up = btn('↑', 'Naik', () => move(i, -1));
    const down = btn('↓', 'Turun', () => move(i, 1));
    const rm = btn('✕', 'Hapus', () => {
      state.mergeFiles.splice(i, 1);
      renderMergeList();
    });
    rm.classList.add('remove');

    li.append(num, name, size, up, down, rm);
    mergeList.appendChild(li);
  });

  mergeBtn.disabled = state.mergeFiles.length < 2;
}

function btn(symbol, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  b.textContent = symbol;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function move(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.mergeFiles.length) return;
  const arr = state.mergeFiles;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  renderMergeList();
}

mergeBtn.dataset.label = 'Gabungkan';
mergeBtn.addEventListener('click', async () => {
  if (state.mergeFiles.length < 2) return;
  hideAlert();
  $('#merge-result').hidden = true;

  const fd = new FormData();
  state.mergeFiles.forEach((f) => fd.append('files', f));

  setBusy(mergeBtn, true, 'Memproses…');
  try {
    const res = await apiPost('/api/merge', fd);
    const url = await downloadUrl(res);
    const link = $('#merge-download');
    link.href = url;
    let name = $('#merge-name').value.trim() || 'hasil-merge.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    link.download = name;
    $('#merge-result').hidden = false;
    showAlert('File berhasil digabung.', 'info');
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(mergeBtn, false);
  }
});

// ---------- SPLIT ----------

const splitDrop = $('#split-drop');
const splitInput = $('#split-input');
const splitBtn = $('#split-btn');

splitDrop.addEventListener('click', () => splitInput.click());
splitDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); splitInput.click(); }
});
splitDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  splitDrop.classList.add('dragover');
});
splitDrop.addEventListener('dragleave', () => splitDrop.classList.remove('dragover'));
splitDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  splitDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) setSplitFile(e.dataTransfer.files[0]);
});
splitInput.addEventListener('change', () => {
  if (splitInput.files.length) setSplitFile(splitInput.files[0]);
  splitInput.value = '';
});

async function setSplitFile(file) {
  if (!isPdf(file)) {
    showAlert('File harus PDF.');
    return;
  }
  hideAlert();
  $('#split-result').hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  $('#split-name').textContent = file.name;
  $('#split-info').hidden = false;
  $('#split-pages').textContent = 'memeriksa…';
  $('#split-options').hidden = true;

  try {
    const res = await apiPost('/api/pagecount', fd);
    const data = await res.json();
    state.splitFile = file;
    state.splitPages = data.pages;
    $('#split-pages').textContent = data.pages + ' halaman';
    $('#split-options').hidden = false;
  } catch (err) {
    state.splitFile = null;
    $('#split-info').hidden = true;
    showAlert(err.message);
  }
}

document.querySelectorAll('input[name="split-mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    $('#split-ranges').disabled = radio.value !== 'ranges' || !radio.checked;
    if (radio.checked && radio.value === 'ranges') $('#split-ranges').disabled = false;
  });
});

splitBtn.dataset.label = 'Pisahkan';
splitBtn.addEventListener('click', async () => {
  if (!state.splitFile) return;
  const mode = document.querySelector('input[name="split-mode"]:checked').value;

  if (mode === 'ranges') {
    const input = $('#split-ranges').value.trim();
    if (!input) {
      showAlert('Masukkan rentang halaman, contoh: 1-3,5,7-9');
      return;
    }
    if (!/^\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*$/.test(input)) {
      showAlert('Format rentang tidak valid. Contoh: 1-3,5,7-9');
      return;
    }
  }

  hideAlert();
  $('#split-result').hidden = true;

  const fd = new FormData();
  fd.append('file', state.splitFile);
  fd.append('mode', mode);
  if (mode === 'ranges') fd.append('ranges', $('#split-ranges').value);

  setBusy(splitBtn, true, 'Memproses…');
  try {
    const res = await apiPost('/api/split', fd);
    const url = await downloadUrl(res);
    const link = $('#split-download');
    link.href = url;

    const zip = res.headers.get('Content-Type') === 'application/zip';
    link.download = zip ? 'hasil-split.zip' : 'hasil-split.pdf';
    link.textContent = zip ? 'Unduh hasil (ZIP)' : 'Unduh hasil PDF';
    $('#split-result-text').textContent = zip
      ? 'Selesai! Beberapa file dikemas dalam ZIP.'
      : 'Selesai! File berhasil dipisahkan.';
    $('#split-result').hidden = false;
    showAlert('File berhasil dipisahkan.', 'info');
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(splitBtn, false);
  }
});

// ---------- COMPRESS ----------

const compressDrop = $('#compress-drop');
const compressInput = $('#compress-input');
const compressBtn = $('#compress-btn');

compressDrop.addEventListener('click', () => compressInput.click());
compressDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); compressInput.click(); }
});
compressDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  compressDrop.classList.add('dragover');
});
compressDrop.addEventListener('dragleave', () => compressDrop.classList.remove('dragover'));
compressDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  compressDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) setCompressFile(e.dataTransfer.files[0]);
});
compressInput.addEventListener('change', () => {
  if (compressInput.files.length) setCompressFile(compressInput.files[0]);
  compressInput.value = '';
});

async function setCompressFile(file) {
  if (!isPdf(file)) {
    showAlert('File harus PDF.');
    return;
  }
  hideAlert();
  $('#compress-result').hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  $('#compress-name').textContent = file.name;
  $('#compress-size').textContent = formatSize(file.size);
  $('#compress-info').hidden = false;
  $('#compress-options').hidden = false;
  state.compressFile = file;
}

compressBtn.dataset.label = 'Kompres';
compressBtn.addEventListener('click', async () => {
  if (!state.compressFile) return;

  hideAlert();
  $('#compress-result').hidden = true;

  const fd = new FormData();
  fd.append('file', state.compressFile);

  setBusy(compressBtn, true, 'Memproses…');
  try {
    const res = await apiPost('/api/compress', fd);
    const url = await downloadUrl(res);
    const link = $('#compress-download');
    link.href = url;
    link.download = 'hasil-kompres.pdf';

    const originalSize = parseInt(res.headers.get('X-Original-Size') || '0', 10);
    const compressedSize = parseInt(res.headers.get('X-Compressed-Size') || '0', 10);
    const ratio = res.headers.get('X-Compress-Ratio') || '0%';

    $('#compress-result-text').textContent = 'Selesai! File berhasil dikompres.';
    if (originalSize && compressedSize) {
      $('#compress-ratio').textContent = `Ukuran: ${formatSize(originalSize)} → ${formatSize(compressedSize)} (hemat ${ratio})`;
      $('#compress-ratio').hidden = false;
    }
    $('#compress-result').hidden = false;
    showAlert('File berhasil dikompres.', 'info');
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(compressBtn, false);
  }
});

// ---------- EXTRACT TEXT ----------

const extractDrop = $('#extract-drop');
const extractInput = $('#extract-input');
const extractBtn = $('#extract-btn');
const extractCopy = $('#extract-copy');
const extractDownload = $('#extract-download');
const extractTextarea = $('#extract-textarea');

extractDrop.addEventListener('click', () => extractInput.click());
extractDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); extractInput.click(); }
});
extractDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  extractDrop.classList.add('dragover');
});
extractDrop.addEventListener('dragleave', () => extractDrop.classList.remove('dragover'));
extractDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  extractDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) setExtractFile(e.dataTransfer.files[0]);
});
extractInput.addEventListener('change', () => {
  if (extractInput.files.length) setExtractFile(extractInput.files[0]);
  extractInput.value = '';
});

async function setExtractFile(file) {
  if (!isPdf(file)) {
    showAlert('File harus PDF.');
    return;
  }
  hideAlert();
  $('#extract-result').hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  $('#extract-name').textContent = file.name;
  $('#extract-options').hidden = false;
  state.extractFile = file;

  try {
    const res = await apiPost('/api/pagecount', fd);
    const data = await res.json();
    $('#extract-pages').textContent = data.pages + ' halaman';
    $('#extract-info').hidden = false;
  } catch (err) {
    state.extractFile = null;
    $('#extract-info').hidden = true;
    showAlert(err.message);
  }
}

extractBtn.dataset.label = 'Ekstrak Teks';
extractBtn.addEventListener('click', async () => {
  if (!state.extractFile) return;

  hideAlert();
  $('#extract-result').hidden = true;
  extractTextarea.value = '';

  const format = document.querySelector('input[name="extract-format"]:checked').value;

  const fd = new FormData();
  fd.append('file', state.extractFile);
  fd.append('format', format);

  setBusy(extractBtn, true, 'Memproses…');
  try {
    const res = await apiPost('/api/extract-text', fd);
    const data = await res.json();

    extractTextarea.value = data.text || '(Tidak ada teks tereksrak)';
    $('#extract-result').hidden = false;
    showAlert('Teks berhasil diekstrak.', 'info');

    // Set download filename
    const baseName = (data.name || 'hasil').replace(/\.pdf$/i, '');
    extractDownload.href = URL.createObjectURL(new Blob([data.text || ''], { type: 'text/plain' }));
    extractDownload.download = `${baseName}.txt`;
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(extractBtn, false);
  }
});

extractCopy.addEventListener('click', async () => {
  if (!extractTextarea.value) return;
  try {
    await navigator.clipboard.writeText(extractTextarea.value);
    showAlert('Teks disalin ke clipboard.', 'info');
  } catch (_) {
    extractTextarea.select();
    document.execCommand('copy');
    showAlert('Teks disalin.', 'info');
  }
});
