'use strict';

const $ = (sel) => document.querySelector(sel);

const state = {
  mergeFiles: [],
  splitFile: null,
  splitPages: 0,
  compressFile: null,
  extractFile: null,
  organizeFile: null,
  organizeDoc: null,
  decorateFile: null,
  decorateDoc: null,
  highlightFile: null,
  highlightDoc: null,
  highlightPages: [],
  highlights: [],
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

  const quality = (document.querySelector('input[name="compress-quality"]:checked') || {}).value || 'medium';
  const fd = new FormData();
  fd.append('file', state.compressFile);
  fd.append('quality', quality);

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
    const engine = res.headers.get('X-Compress-Engine') || '';

    const engineNote = {
      gs: 'Mesin: Ghostscript — teks tetap bisa dicari.',
      lossless: 'Mesin: lossless — teks tetap bisa dicari.',
      raster: 'Mesin: rasterisasi — teks menjadi gambar (tidak bisa dicari).',
      original: 'File sudah optimal — tidak ada penghematan, dikembalikan seperti aslinya.',
    }[engine] || '';

    if (engine === 'original') {
      $('#compress-result-text').textContent = 'Selesai! Tidak ada penghematan untuk file ini.';
    } else {
      $('#compress-result-text').textContent = 'Selesai! File berhasil dikompres.';
    }

    const sizeLine = `Ukuran: ${formatSize(originalSize)} → ${formatSize(compressedSize)} (hemat ${ratio})`;
    $('#compress-ratio').textContent = engineNote ? `${sizeLine} ${engineNote}` : sizeLine;
    $('#compress-ratio').hidden = false;
    $('#compress-result').hidden = false;
    showAlert('File berhasil diproses.', 'info');
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

// ---------- PDF.JS LOADER ----------

let pdfjsLibPromise = null;

function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('/vendor/pdfjs/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
      return lib;
    });
  }
  return pdfjsLibPromise;
}

// ---------- ORGANIZE ----------

const ORGANIZE_PREVIEW_MAX = 100;

const organizeDrop = $('#organize-drop');
const organizeInput = $('#organize-input');
const organizeGrid = $('#organize-grid');
const organizeBtn = $('#organize-btn');
const organizeReset = $('#organize-reset');

organizeDrop.addEventListener('click', () => organizeInput.click());
organizeDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); organizeInput.click(); }
});
organizeDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  organizeDrop.classList.add('dragover');
});
organizeDrop.addEventListener('dragleave', () => organizeDrop.classList.remove('dragover'));
organizeDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  organizeDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) setOrganizeFile(e.dataTransfer.files[0]);
});
organizeInput.addEventListener('change', () => {
  if (organizeInput.files.length) setOrganizeFile(organizeInput.files[0]);
  organizeInput.value = '';
});

async function setOrganizeFile(file) {
  if (!isPdf(file)) {
    showAlert('File harus PDF.');
    return;
  }
  hideAlert();
  $('#organize-result').hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  $('#organize-name').textContent = file.name;
  $('#organize-info').hidden = false;
  $('#organize-pages').textContent = 'memeriksa…';
  organizeGrid.hidden = true;
  organizeGrid.innerHTML = '';
  $('#organize-options').hidden = true;

  try {
    const res = await apiPost('/api/pagecount', fd);
    const data = await res.json();
    state.organizeFile = file;
    $('#organize-pages').textContent = data.pages + ' halaman';
    $('#organize-options').hidden = false;
    organizeGrid.hidden = false;
    await renderOrganizeThumbs(file);
  } catch (err) {
    state.organizeFile = null;
    $('#organize-info').hidden = true;
    showAlert(err.message);
  }
}

async function renderOrganizeThumbs(file) {
  organizeGrid.innerHTML = '';
  const btnInfo = document.createElement('p');
  btnInfo.className = 'hint grid-loading';
  btnInfo.textContent = 'Membuat thumbnail…';
  organizeGrid.appendChild(btnInfo);

  let pdfDoc;
  try {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    pdfDoc = await pdfjs.getDocument({ data: buf }).promise;
  } catch (err) {
    organizeGrid.innerHTML = '';
    showAlert('Gagal render preview: ' + err.message);
    return;
  }

  const count = Math.min(pdfDoc.numPages, ORGANIZE_PREVIEW_MAX);
  organizeGrid.innerHTML = '';

  for (let i = 1; i <= count; i += 1) {
    const page = await pdfDoc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(160 / baseViewport.width, 200 / baseViewport.height, 1);
    const viewport = page.getViewport({ scale });

    const card = document.createElement('div');
    card.className = 'page-card';
    card.dataset.num = String(i);
    card.dataset.rot = '0';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'page-thumb';

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    thumbWrap.appendChild(canvas);

    const badge = document.createElement('span');
    badge.className = 'page-badge';
    badge.textContent = String(i);
    thumbWrap.appendChild(badge);
    card.appendChild(thumbWrap);

    const controls = document.createElement('div');
    controls.className = 'page-controls';
    const rotBtn = btn('↻', 'Putar 90°', () => rotateCard(card));
    const upBtn = btn('↑', 'Naik', () => moveCard(card, -1));
    const downBtn = btn('↓', 'Turun', () => moveCard(card, 1));
    const rmBtn = btn('✕', 'Hapus', () => removeCard(card));
    rmBtn.classList.add('remove');
    controls.append(rotBtn, upBtn, downBtn, rmBtn);
    card.appendChild(controls);

    organizeGrid.appendChild(card);
  }

  if (pdfDoc.numPages > count) {
    const note = document.createElement('p');
    note.className = 'hint grid-note';
    note.textContent = `Preview dibatasi ${count} halaman pertama (PDF punya ${pdfDoc.numPages} halaman).`;
    organizeGrid.appendChild(note);
  }
}

function rotateCard(card) {
  const cur = parseInt(card.dataset.rot, 10) || 0;
  const next = (cur + 90) % 360;
  card.dataset.rot = String(next);
  const canvas = card.querySelector('canvas');
  if (canvas) canvas.style.transform = `rotate(${next}deg)`;
}

function moveCard(card, delta) {
  const sibling = delta < 0 ? card.previousElementSibling : card.nextElementSibling;
  if (!sibling || !sibling.classList.contains('page-card')) return;
  if (delta < 0) {
    organizeGrid.insertBefore(card, sibling);
  } else {
    organizeGrid.insertBefore(sibling, card);
  }
  card.classList.add('pulse');
  setTimeout(() => card.classList.remove('pulse'), 400);
}

function removeCard(card) {
  card.classList.add('deleted');
  const canvas = card.querySelector('canvas');
  if (canvas) canvas.style.opacity = '0.15';
  card.querySelectorAll('.icon-btn').forEach((b) => { b.disabled = true; });
  card.querySelector('.page-badge').classList.add('strikethrough');
}

organizeReset.addEventListener('click', () => {
  if (state.organizeFile) renderOrganizeThumbs(state.organizeFile);
});

organizeBtn.dataset.label = 'Proses';
organizeBtn.addEventListener('click', async () => {
  if (!state.organizeFile) return;

  const cards = Array.from(organizeGrid.querySelectorAll('.page-card'));
  const kept = cards.filter((c) => !c.classList.contains('deleted'));
  if (kept.length === 0) {
    showAlert('Semua halaman dihapus. Minimal sisakan satu halaman.');
    return;
  }

  const order = kept.map((c) => parseInt(c.dataset.num, 10));
  const rotations = {};
  for (const c of kept) {
    const rot = parseInt(c.dataset.rot, 10) || 0;
    if (rot) rotations[c.dataset.num] = rot;
  }

  hideAlert();
  $('#organize-result').hidden = true;

  const fd = new FormData();
  fd.append('file', state.organizeFile);
  fd.append('order', JSON.stringify(order));
  fd.append('rotations', JSON.stringify(rotations));

  setBusy(organizeBtn, true, 'Memproses…');
  try {
    const res = await apiPost('/api/organize', fd);
    const url = await downloadUrl(res);
    const link = $('#organize-download');
    link.href = url;
    let name = $('#organize-filename').value.trim() || 'hasil-atur-halaman.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    link.download = name;
    $('#organize-result').hidden = false;
    showAlert('Halaman berhasil diatur.', 'info');
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(organizeBtn, false);
  }
});

// ---------- DECORATE ----------

const decorateDrop = $('#decorate-drop');
const decorateInput = $('#decorate-input');
const decorateBtn = $('#decorate-btn');
const decoratePreview = $('#decorate-preview');
const previewCtx = decoratePreview.getContext('2d');
let decorateBase = null;

decorateDrop.addEventListener('click', () => decorateInput.click());
decorateDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); decorateInput.click(); }
});
decorateDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  decorateDrop.classList.add('dragover');
});
decorateDrop.addEventListener('dragleave', () => decorateDrop.classList.remove('dragover'));
decorateDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  decorateDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) setDecorateFile(e.dataTransfer.files[0]);
});
decorateInput.addEventListener('change', () => {
  if (decorateInput.files.length) setDecorateFile(decorateInput.files[0]);
  decorateInput.value = '';
});

async function setDecorateFile(file) {
  if (!isPdf(file)) {
    showAlert('File harus PDF.');
    return;
  }
  hideAlert();
  $('#decorate-result').hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  $('#decorate-name').textContent = file.name;
  $('#decorate-info').hidden = false;
  $('#decorate-pages').textContent = 'memeriksa…';
  $('#decorate-options').hidden = true;

  try {
    const res = await apiPost('/api/pagecount', fd);
    const data = await res.json();
    state.decorateFile = file;
    state.decoratePages = data.pages;
    $('#decorate-pages').textContent = data.pages + ' halaman';
    $('#decorate-options').hidden = false;
    await renderDecoratePreview(file);
  } catch (err) {
    state.decorateFile = null;
    $('#decorate-info').hidden = true;
    showAlert(err.message);
  }
}

async function renderDecoratePreview(file) {
  try {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const pdfDoc = await pdfjs.getDocument({ data: buf }).promise;
    const page = await pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const boxW = decoratePreview.parentElement.clientWidth || 400;
    const scale = Math.min(boxW / baseViewport.width, 1.2);
    const viewport = page.getViewport({ scale });

    decoratePreview.width = viewport.width;
    decoratePreview.height = viewport.height;
    await page.render({ canvasContext: previewCtx, viewport }).promise;

    decorateBase = {
      width: viewport.width,
      height: viewport.height,
      pdfW: baseViewport.width,
      pdfH: baseViewport.height,
      canvas: document.createElement('canvas'),
    };
    decorateBase.canvas.width = viewport.width;
    decorateBase.canvas.height = viewport.height;
    decorateBase.canvas.getContext('2d').drawImage(decoratePreview, 0, 0);
    drawDecorateOverlay();
  } catch (err) {
    showAlert('Gagal render preview: ' + err.message);
  }
}

function decorateMode() {
  const el = document.querySelector('input[name="decorate-mode"]:checked');
  return el ? el.value : 'watermark';
}

function drawDecorateOverlay() {
  if (!decorateBase) return;
  const { width, height, pdfW, pdfH } = decorateBase;
  const scale = width / pdfW;
  const mode = decorateMode();

  previewCtx.clearRect(0, 0, width, height);
  previewCtx.drawImage(decorateBase.canvas, 0, 0);

  const wmEls = $('#decorate-watermark-fields');
  const pnEls = $('#decorate-numbers-fields');
  wmEls.hidden = mode === 'numbers';
  pnEls.hidden = mode === 'watermark';

  if (mode === 'watermark' || mode === 'both') {
    const text = $('#wm-text').value.trim();
    const style = $('#wm-style').value;
    const opacity = parseInt($('#wm-opacity').value, 10) / 100;
    const color = $('#wm-color').value;
    const sizeOpt = parseInt($('#wm-size').value, 10);
    if (text) {
      const size = (sizeOpt || Math.max(18, Math.floor(Math.min(pdfW, pdfH) / 8))) * scale;
      previewCtx.save();
      previewCtx.globalAlpha = opacity;
      previewCtx.fillStyle = color;
      previewCtx.font = `${size}px Helvetica, sans-serif`;
      previewCtx.textBaseline = 'middle';
      const tw = previewCtx.measureText(text).width;

      if (style === 'center') {
        previewCtx.fillText(text, (width - tw) / 2, height / 2);
      } else if (style === 'diagonal') {
        previewCtx.translate(width / 2, height / 2);
        previewCtx.rotate(-Math.PI / 4);
        previewCtx.fillText(text, -tw / 2, 0);
      } else {
        const stepX = tw + size * 2;
        const stepY = size * 5;
        previewCtx.rotate(-Math.PI / 6);
        for (let y = -height; y < height * 2; y += stepY) {
          const rowIdx = Math.round(y / stepY);
          const offset = rowIdx % 2 === 0 ? 0 : stepX / 2;
          for (let x = -width; x < width * 2; x += stepX) {
            previewCtx.fillText(text, x + offset, y);
          }
        }
      }
      previewCtx.restore();
    }
  }

  if (mode === 'numbers' || mode === 'both') {
    const format = $('#pn-format').value;
    const position = $('#pn-position').value;
    const color = $('#pn-color').value;
    const size = (parseInt($('#pn-size').value, 10) || 10) * scale;
    const text = format.replace(/\{n\}/g, '1').replace(/\{total\}/g, String(state.decoratePages || 1));
    previewCtx.save();
    previewCtx.fillStyle = color;
    previewCtx.font = `${size}px Helvetica, sans-serif`;
    const tw = previewCtx.measureText(text).width;
    const margin = 20 * scale;
    let x;
    let y;
    switch (position) {
      case 'bottom-left': x = margin; y = height - margin; break;
      case 'bottom-right': x = width - tw - margin; y = height - margin; break;
      case 'top-center': x = (width - tw) / 2; y = margin + size; break;
      case 'top-left': x = margin; y = margin + size; break;
      case 'top-right': x = width - tw - margin; y = margin + size; break;
      default: x = (width - tw) / 2; y = height - margin;
    }
    previewCtx.textBaseline = 'alphabetic';
    previewCtx.fillText(text, x, y);
    previewCtx.restore();
  }
}

['#wm-text', '#wm-style', '#wm-color', '#wm-size', '#pn-format', '#pn-position', '#pn-color', '#pn-size'].forEach((sel) => {
  $(sel).addEventListener('input', drawDecorateOverlay);
  $(sel).addEventListener('change', drawDecorateOverlay);
});
$('#wm-opacity').addEventListener('input', () => {
  $('#wm-opacity-val').textContent = $('#wm-opacity').value + '%';
  drawDecorateOverlay();
});
document.querySelectorAll('input[name="decorate-mode"]').forEach((r) => {
  r.addEventListener('change', drawDecorateOverlay);
});

decorateBtn.dataset.label = 'Proses';
decorateBtn.addEventListener('click', async () => {
  if (!state.decorateFile) return;
  const mode = decorateMode();

  if ((mode === 'watermark' || mode === 'both') && !$('#wm-text').value.trim()) {
    showAlert('Teks watermark kosong.');
    return;
  }

  hideAlert();
  $('#decorate-result').hidden = true;

  setBusy(decorateBtn, true, 'Memproses…');
  try {
    let currentBlob = null;

    if (mode === 'watermark' || mode === 'both') {
      const fd = new FormData();
      fd.append('file', state.decorateFile);
      fd.append('text', $('#wm-text').value);
      fd.append('style', $('#wm-style').value);
      fd.append('opacity', String(parseInt($('#wm-opacity').value, 10) / 100));
      fd.append('color', $('#wm-color').value);
      const sizeVal = $('#wm-size').value.trim();
      if (sizeVal) fd.append('fontSize', sizeVal);
      const res = await apiPost('/api/watermark', fd);
      currentBlob = await res.blob();
    }

    if (mode === 'numbers' || mode === 'both') {
      const fd = new FormData();
      const srcFile = currentBlob
        ? new File([currentBlob], 'intermediate.pdf', { type: 'application/pdf' })
        : state.decorateFile;
      fd.append('file', srcFile);
      fd.append('format', $('#pn-format').value);
      fd.append('position', $('#pn-position').value);
      fd.append('fontSize', $('#pn-size').value || '10');
      fd.append('color', $('#pn-color').value);
      const res = await apiPost('/api/page-numbers', fd);
      currentBlob = await res.blob();
    }

    const url = URL.createObjectURL(currentBlob);
    const link = $('#decorate-download');
    link.href = url;
    let name = $('#decorate-filename').value.trim() || 'hasil-edit.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    link.download = name;
    $('#decorate-result').hidden = false;
    showAlert('PDF berhasil diedit.', 'info');
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(decorateBtn, false);
  }
});

updateDecorateFieldVisibility();

function updateDecorateFieldVisibility() {
  const mode = decorateMode();
  $('#decorate-watermark-fields').hidden = mode === 'numbers';
  $('#decorate-numbers-fields').hidden = mode === 'watermark';
}

// ---------- HIGHLIGHT ----------

const HIGHLIGHT_MAX = 1000;
const HIGHLIGHT_MAX_PAGES = 200;

const highlightDrop = $('#highlight-drop');
const highlightInput = $('#highlight-input');
const highlightBtn = $('#highlight-btn');
const highlightViewer = $('#highlight-viewer');
const highlightSearchBtn = $('#highlight-search-btn');
const highlightUndoBtn = $('#highlight-undo');
const highlightClearBtn = $('#highlight-clear');

let highlightObserver = null;
let highlightGroupCounter = 0;
let highlightPdfjsLib = null;

function highlightMode() {
  const el = document.querySelector('input[name="highlight-mode"]:checked');
  return el ? el.value : 'cursor';
}

highlightDrop.addEventListener('click', () => highlightInput.click());
highlightDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); highlightInput.click(); }
});
highlightDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  highlightDrop.classList.add('dragover');
});
highlightDrop.addEventListener('dragleave', () => highlightDrop.classList.remove('dragover'));
highlightDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  highlightDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) setHighlightFile(e.dataTransfer.files[0]);
});
highlightInput.addEventListener('change', () => {
  if (highlightInput.files.length) setHighlightFile(highlightInput.files[0]);
  highlightInput.value = '';
});

async function setHighlightFile(file) {
  if (!isPdf(file)) {
    showAlert('File harus PDF.');
    return;
  }
  hideAlert();
  $('#highlight-result').hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  $('#highlight-name').textContent = file.name;
  $('#highlight-info').hidden = false;
  $('#highlight-pages').textContent = 'memeriksa…';
  $('#highlight-options').hidden = true;

  try {
    const res = await apiPost('/api/pagecount', fd);
    const data = await res.json();
    state.highlightFile = file;
    $('#highlight-pages').textContent = data.pages + ' halaman';
    $('#highlight-options').hidden = false;
    await renderHighlightViewer(file);
  } catch (err) {
    state.highlightFile = null;
    $('#highlight-info').hidden = true;
    showAlert(err.message);
  }
}

async function renderHighlightViewer(file) {
  const viewer = highlightViewer;
  if (highlightObserver) {
    highlightObserver.disconnect();
    highlightObserver = null;
  }
  if (state.highlightDoc) {
    try { state.highlightDoc.destroy(); } catch (_) { /* already destroyed */ }
  }
  viewer.innerHTML = '';
  viewer.hidden = false;
  state.highlightDoc = null;
  state.highlightPages = [];
  state.highlights = [];
  highlightGroupCounter = 0;
  pushHighlight._capped = false;
  updateHighlightToolbar();

  const loading = document.createElement('p');
  loading.className = 'hint grid-loading';
  loading.textContent = 'Menyiapkan viewer…';
  viewer.appendChild(loading);

  let doc;
  try {
    highlightPdfjsLib = await loadPdfjs();
    const buf = await file.arrayBuffer();
    doc = await highlightPdfjsLib.getDocument({ data: buf }).promise;
  } catch (err) {
    showAlert('Gagal render preview: ' + err.message);
    return;
  }

  state.highlightDoc = doc;
  const count = Math.min(doc.numPages, HIGHLIGHT_MAX_PAGES);
  const boxW = Math.max(320, viewer.clientWidth - 40);
  viewer.innerHTML = '';

  highlightObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const entry = state.highlightPages.find((p) => p.wrap === e.target);
        if (entry) ensureHighlightPage(entry);
        highlightObserver.unobserve(e.target);
      }
    },
    { root: viewer, rootMargin: '400px' }
  );

  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(boxW / base.width, 1.5);
    const viewport = page.getViewport({ scale });

    const wrap = document.createElement('div');
    wrap.className = 'hl-page';
    wrap.style.setProperty('--scale-factor', String(scale));
    wrap.style.width = viewport.width + 'px';
    wrap.style.height = viewport.height + 'px';

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const hlLayer = document.createElement('div');
    hlLayer.className = 'hl-highlights';

    const textEl = document.createElement('div');
    textEl.className = 'textLayer';

    const badge = document.createElement('span');
    badge.className = 'hl-page-badge';
    badge.textContent = String(i);

    wrap.append(canvas, hlLayer, textEl, badge);
    viewer.appendChild(wrap);

    state.highlightPages.push({
      index: i - 1,
      page,
      viewport,
      wrap,
      hlLayer,
      textEl,
      renderPromise: null,
      renderFailed: false,
    });
    highlightObserver.observe(wrap);
  }

  if (doc.numPages > count) {
    const note = document.createElement('p');
    note.className = 'hint grid-note';
    note.textContent = `Viewer dibatasi ${count} halaman pertama (PDF punya ${doc.numPages} halaman).`;
    viewer.appendChild(note);
  }
}

function ensureHighlightPage(entry) {
  if (entry.renderPromise) return entry.renderPromise;
  entry.renderPromise = (async () => {
    try {
      const ctx = entry.wrap.querySelector('canvas').getContext('2d');
      await entry.page.render({ canvasContext: ctx, viewport: entry.viewport }).promise;
      const textLayer = new highlightPdfjsLib.TextLayer({
        textContentSource: entry.page.streamTextContent(),
        container: entry.textEl,
        viewport: entry.viewport,
      });
      await textLayer.render();
    } catch (err) {
      entry.renderFailed = true;
      if (!ensureHighlightPage._warned) {
        ensureHighlightPage._warned = true;
        showAlert('Gagal merender sebagian halaman: ' + err.message);
      }
    }
  })();
  return entry.renderPromise;
}

function findPageForClientRect(r) {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (const entry of state.highlightPages) {
    const wr = entry.wrap.getBoundingClientRect();
    if (cx >= wr.left && cx <= wr.right && cy >= wr.top && cy <= wr.bottom) return entry;
  }
  return null;
}

function clientRectToPdf(entry, r) {
  const wr = entry.wrap.getBoundingClientRect();
  const p1 = entry.viewport.convertToPdfPoint(r.left - wr.left, r.top - wr.top);
  const p2 = entry.viewport.convertToPdfPoint(r.right - wr.left, r.bottom - wr.top);
  return {
    page: entry.index,
    x: Math.min(p1[0], p2[0]),
    y: Math.min(p1[1], p2[1]),
    w: Math.abs(p2[0] - p1[0]),
    h: Math.abs(p2[1] - p1[1]),
  };
}

function rectsTouch(a, b) {
  const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (yOverlap < 1) return false;
  const xGap = Math.max(Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w), 0);
  return xGap <= 2;
}

function mergeHighlightRect(rect, group) {
  const m = { page: rect.page, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    for (let i = state.highlights.length - 1; i >= 0; i -= 1) {
      const h = state.highlights[i];
      if (h.group !== group || h.page !== m.page) continue;
      if (!rectsTouch(m, h)) continue;
      const x2 = Math.max(m.x + m.w, h.x + h.w);
      const y2 = Math.max(m.y + m.h, h.y + h.h);
      m.x = Math.min(m.x, h.x);
      m.y = Math.min(m.y, h.y);
      m.w = x2 - m.x;
      m.h = y2 - m.y;
      state.highlights.splice(i, 1);
      mergedAny = true;
    }
  }
  return m;
}

function pushHighlight(rect, source, group) {
  if (rect.w < 0.5 || rect.h < 0.5) return 0;
  if (state.highlights.length >= HIGHLIGHT_MAX) {
    if (!pushHighlight._capped) {
      pushHighlight._capped = true;
      showAlert(`Maksimal ${HIGHLIGHT_MAX} highlight tercapai.`);
    }
    return 0;
  }
  const dup = state.highlights.some(
    (h) =>
      h.page === rect.page &&
      Math.abs(h.x - rect.x) < 0.5 &&
      Math.abs(h.y - rect.y) < 0.5 &&
      Math.abs(h.w - rect.w) < 0.5 &&
      Math.abs(h.h - rect.h) < 0.5
  );
  if (dup) return 0;
  const m = mergeHighlightRect(rect, group);
  state.highlights.push({
    page: m.page,
    x: m.x,
    y: m.y,
    w: m.w,
    h: m.h,
    source,
    group,
  });
  return 1;
}

function addHighlightRectsFromRange(range, knownEntry, source, group) {
  let added = 0;
  for (const r of range.getClientRects()) {
    if (r.width < 1 || r.height < 1) continue;
    const entry = knownEntry || findPageForClientRect(r);
    if (!entry) continue;
    added += pushHighlight(clientRectToPdf(entry, r), source, group);
  }
  return added;
}

function renderHighlightOverlays() {
  const color = $('#highlight-color').value;
  const opacity = parseInt($('#highlight-opacity').value, 10) / 100;
  for (const entry of state.highlightPages) {
    entry.hlLayer.innerHTML = '';
    for (const h of state.highlights) {
      if (h.page !== entry.index) continue;
      const a = entry.viewport.convertToViewportPoint(h.x, h.y);
      const b = entry.viewport.convertToViewportPoint(h.x + h.w, h.y + h.h);
      const div = document.createElement('div');
      div.className = 'hl-mark';
      div.style.left = Math.min(a[0], b[0]) + 'px';
      div.style.top = Math.min(a[1], b[1]) + 'px';
      div.style.width = Math.abs(b[0] - a[0]) + 'px';
      div.style.height = Math.abs(b[1] - a[1]) + 'px';
      div.style.backgroundColor = color;
      div.style.opacity = String(opacity);
      entry.hlLayer.appendChild(div);
    }
  }
}

function updateHighlightToolbar() {
  const groups = new Set(state.highlights.map((h) => h.group));
  const n = groups.size;
  $('#highlight-count').textContent = n + ' sorotan';
  highlightUndoBtn.disabled = n === 0;
  highlightClearBtn.disabled = n === 0;
  highlightBtn.disabled = n === 0 || !state.highlightFile;
}

highlightViewer.addEventListener('mouseup', () => {
  if (highlightMode() !== 'cursor') return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  let added = 0;
  const group = ++highlightGroupCounter;
  for (let i = 0; i < sel.rangeCount; i += 1) {
    added += addHighlightRectsFromRange(sel.getRangeAt(i), null, 'cursor', group);
  }
  if (added > 0) {
    sel.removeAllRanges();
    renderHighlightOverlays();
    updateHighlightToolbar();
  }
});

highlightUndoBtn.addEventListener('click', () => {
  if (!state.highlights.length) return;
  const lastGroup = state.highlights[state.highlights.length - 1].group;
  state.highlights = state.highlights.filter((h) => h.group !== lastGroup);
  renderHighlightOverlays();
  updateHighlightToolbar();
});

highlightClearBtn.addEventListener('click', () => {
  state.highlights = [];
  renderHighlightOverlays();
  updateHighlightToolbar();
});

document.querySelectorAll('input[name="highlight-mode"]').forEach((r) => {
  r.addEventListener('change', () => {
    $('#highlight-search-row').hidden = highlightMode() !== 'search';
  });
});

$('#highlight-color').addEventListener('input', renderHighlightOverlays);
$('#highlight-opacity').addEventListener('input', () => {
  $('#highlight-opacity-val').textContent = $('#highlight-opacity').value + '%';
  renderHighlightOverlays();
});

function collectTextLines(root) {
  const lines = [];
  let cur = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.nodeValue) cur.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') {
          if (cur.length) { lines.push(cur); cur = []; }
        } else {
          walk(child);
        }
      }
    }
  };
  walk(root);
  if (cur.length) lines.push(cur);
  return lines;
}

function rangeFromIndexes(nodes, start, end) {
  let acc = 0;
  let startSet = false;
  const range = document.createRange();
  for (const node of nodes) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    const next = acc + len;
    if (!startSet && start >= acc && start < next) {
      range.setStart(node, start - acc);
      startSet = true;
    }
    if (startSet && end > acc && end <= next) {
      range.setEnd(node, end - acc);
      return range;
    }
    acc = next;
  }
  return null;
}

function searchInPage(entry, query, group) {
  let added = 0;
  for (const nodes of collectTextLines(entry.textEl)) {
    const full = nodes.map((n) => n.nodeValue || '').join('');
    if (!full) continue;
    const lowered = full.toLowerCase();
    const canCaseFold = lowered.length === full.length;
    const haystack = canCaseFold ? lowered : full;
    const needle = canCaseFold ? query.toLowerCase() : query;
    let from = 0;
    let idx;
    while ((idx = haystack.indexOf(needle, from)) !== -1) {
      from = idx + needle.length;
      const range = rangeFromIndexes(nodes, idx, idx + needle.length);
      if (range) added += addHighlightRectsFromRange(range, entry, 'search', group);
      if (state.highlights.length >= HIGHLIGHT_MAX) return added;
    }
  }
  return added;
}

highlightSearchBtn.dataset.label = 'Cari & sorot';
highlightSearchBtn.addEventListener('click', async () => {
  const q = $('#highlight-query').value.trim();
  if (!q) {
    showAlert('Masukkan teks yang dicari.');
    return;
  }
  if (!state.highlightDoc) return;

  hideAlert();
  setBusy(highlightSearchBtn, true, 'Mencari…');
  try {
    state.highlights = state.highlights.filter((h) => h.source !== 'search');
    const group = ++highlightGroupCounter;
    let found = 0;
    for (const entry of state.highlightPages) {
      await ensureHighlightPage(entry);
      if (state.highlights.length >= HIGHLIGHT_MAX) break;
      found += searchInPage(entry, q, group);
    }
    renderHighlightOverlays();
    updateHighlightToolbar();
    if (found === 0) {
      showAlert('Teks tidak ditemukan di dalam PDF.', 'info');
    } else {
      showAlert(`${found} bagian teks di-highlight.`, 'info');
    }
  } catch (err) {
    showAlert('Gagal mencari teks: ' + err.message);
  } finally {
    setBusy(highlightSearchBtn, false);
  }
});

highlightBtn.dataset.label = 'Terapkan & Unduh';
highlightBtn.addEventListener('click', async () => {
  if (!state.highlightFile) return;
  if (!state.highlights.length) {
    showAlert('Belum ada teks yang disorot.');
    return;
  }

  hideAlert();
  $('#highlight-result').hidden = true;

  const rects = state.highlights.map((h) => ({
    page: h.page,
    x: Math.round(h.x * 100) / 100,
    y: Math.round(h.y * 100) / 100,
    w: Math.round(h.w * 100) / 100,
    h: Math.round(h.h * 100) / 100,
  }));

  const fd = new FormData();
  fd.append('file', state.highlightFile);
  fd.append('rects', JSON.stringify(rects));
  fd.append('color', $('#highlight-color').value);
  fd.append('opacity', String(parseInt($('#highlight-opacity').value, 10) / 100));

  setBusy(highlightBtn, true, 'Memproses…');
  try {
    const res = await apiPost('/api/highlight', fd);
    const url = await downloadUrl(res);
    const link = $('#highlight-download');
    link.href = url;
    let name = $('#highlight-filename').value.trim() || 'hasil-highlight.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    link.download = name;
    $('#highlight-result').hidden = false;
    showAlert('Highlight ditambahkan ke PDF.', 'info');
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBusy(highlightBtn, false);
  }
});
