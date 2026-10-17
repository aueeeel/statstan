const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const heroVideo = $('hero-video');
if (heroVideo) {
  const toggle = document.querySelector('.video-toggle');
  const update = () => { if (!toggle) return; toggle.textContent = heroVideo.paused ? '▷' : 'Ⅱ'; toggle.setAttribute('aria-label', heroVideo.paused ? 'Воспроизвести фоновое видео' : 'Приостановить фоновое видео'); };
  if (reducedMotion.matches) heroVideo.pause();
  toggle?.addEventListener('click', () => { if (heroVideo.paused) heroVideo.play().catch(update); else heroVideo.pause(); });
  heroVideo.addEventListener('play', update); heroVideo.addEventListener('pause', update); update();
}

if ($('file-input')) initWorkspace();

function setButtonLoading(button, loading) {
  button.setAttribute('aria-busy', String(loading));
  const label = button.querySelector('.native-button-content');
  if (loading && !label) {
    const content = document.createElement('span');
    content.className = 'native-button-content';
    content.append(...button.childNodes);
    const spinner = document.createElement('span');
    spinner.className = 'native-button-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    button.append(spinner, content);
  } else if (!loading && label) {
    button.querySelector('.native-button-spinner')?.remove();
    label.replaceWith(...label.childNodes);
  }
}

function initWorkspace() {
  let file = null, objectUrl = null, report = null, isDemo = false, controller = null;
  let apiBase = window.FORTE_CONFIG?.apiBaseUrl || localStorage.getItem('forte-api-base') || '';
  let apiKey = ''; // Kept only in this tab's memory; never persisted or bundled.
  let selectedEvent = 0, duration = 0, demoRun = 0;
  const video = $('review-video');
  const demoEvents = [
    { type: 'Наличные вне рабочей зоны', timecode_sec: 12, description: 'Пример: на записи может быть отмечено перемещение предмета, похожего на банкноты, за пределы рабочей зоны. Событие требует проверки человеком.', rule: 'В этом примере норматив не задан. Подтверждённый источник должен приходить от сервиса анализа.', evidence_frames: [] },
    { type: 'Передача предмета вне зоны обзора', timecode_sec: 38, description: 'Пример: передача предмета частично закрыта от камеры. По такому фрагменту нельзя установить содержимое предмета или сделать окончательный вывод.', rule: 'Демонстрационная категория, не юридическое заключение.', evidence_frames: [] },
    { type: 'Рабочее место без наблюдения', timecode_sec: 67, description: 'Пример: сотрудник покидает рабочую зону, пока на столе остаются предметы. Для вывода нужно проверить контекст и применимое правило.', rule: 'Для реальной проверки требуется ссылка на релевантный нормативный источник.', evidence_frames: [] }
  ];
  const showError = (message) => { $('upload-error').textContent = message; $('upload-error').hidden = !message; };
  function updateConnection() {
    const ready = !!(apiBase && apiKey);
    $('connection-button').classList.toggle('connected', ready);
    $('connection-label').textContent = ready ? 'Сервис подключён' : 'Подключить сервис';
  }
  updateConnection();
  function resetReport() {
    report = null; $('results-content').hidden = true; $('empty-results').hidden = false;
    $('event-count').textContent = '0'; $('timeline-area').hidden = true;
    $('result-tab').classList.remove('active'); $('events-list').replaceChildren();
  }
  function clearVideo() {
    controller?.abort(); controller = null; demoRun++;
    video.pause(); video.removeAttribute('src'); video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null; file = null; duration = 0; isDemo = false;
    $('file-input').value = ''; $('drop-zone').hidden = false; $('video-stage').hidden = true;
    $('file-information').hidden = true; $('analyze-button').disabled = true;
    $('demo-scene').hidden = true; video.hidden = false;
    $('analysis-progress').hidden = true; $('video-tag').textContent = 'НОВАЯ ПРОВЕРКА';
    setButtonLoading($('analyze-button'), false);
    $('analyze-button').innerHTML = 'Начать проверку <span>↗</span>';
    resetReport(); showError('');
  }
  function useFile(candidate) {
    if (!candidate) return;
    if (!/\.(mov|mp4|webm)$/i.test(candidate.name)) { showError('Выберите видео в формате MOV, MP4 или WebM.'); return; }
    if (!candidate.size) { showError('Файл пуст. Выберите другую запись.'); return; }
    if (candidate.size > 250 * 1024 * 1024) { showError('Размер файла превышает 250 МБ. Выберите более короткую запись.'); return; }
    clearVideo(); file = candidate; objectUrl = URL.createObjectURL(file); video.src = objectUrl;
    $('drop-zone').hidden = true; $('video-stage').hidden = false; $('file-information').hidden = false;
    $('file-name').textContent = file.name; $('file-meta').textContent = `${formatBytes(file.size)} · Загружено на устройство`;
    $('video-tag').textContent = 'ГОТОВО К ПРОВЕРКЕ'; $('analyze-button').disabled = false;
  }
  $('choose-file').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => useFile(e.target.files[0]));
  $('remove-file').addEventListener('click', clearVideo);
  const drop = $('drop-zone');
  for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  for (const event of ['dragleave', 'drop']) drop.addEventListener(event, (e) => { e.preventDefault(); drop.classList.remove('dragging'); });
  drop.addEventListener('drop', (e) => useFile(e.dataTransfer.files[0]));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  video.addEventListener('loadedmetadata', () => { duration = Number.isFinite(video.duration) ? video.duration : 0; if (file) $('file-meta').textContent = `${formatBytes(file.size)} · ${formatTime(duration)} · Только на устройстве`; });
  video.addEventListener('error', () => { if (file) showError('Браузер не может показать этот кодек. Файл всё ещё можно отправить на ваш сервис для анализа.'); });
  const dialog = $('connection-dialog');
  $('connection-button').addEventListener('click', () => { $('api-url').value = apiBase; $('connection-error').hidden = true; dialog.showModal(); });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  $('disconnect-button').addEventListener('click', () => { apiBase = ''; apiKey = ''; $('api-key').value = ''; localStorage.removeItem('forte-api-base'); updateConnection(); dialog.close(); });
  $('connection-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = new URL($('api-url').value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) { connectionError('Укажите HTTP(S)-адрес без логина, пароля, параметров и фрагмента.'); return; }
    if (location.protocol === 'https:' && url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) { connectionError('Для сайта на HTTPS сервер тоже должен использовать HTTPS.'); return; }
    apiBase = url.href.replace(/\/+$/, ''); apiKey = $('api-key').value.trim();
    if (!apiKey) { connectionError('Введите API-ключ вашего сервиса.'); return; }
    localStorage.setItem('forte-api-base', apiBase); $('api-key').value = ''; updateConnection(); dialog.close();
  });
  function connectionError(message) { $('connection-error').textContent = message; $('connection-error').hidden = false; }
  for (const modal of document.querySelectorAll('dialog')) modal.addEventListener('click', (e) => { if (e.target === modal && (e.clientX < modal.getBoundingClientRect().left || e.clientX > modal.getBoundingClientRect().right || e.clientY < modal.getBoundingClientRect().top || e.clientY > modal.getBoundingClientRect().bottom)) modal.close(); });
  $('evidence-dialog').querySelector('.dialog-close').addEventListener('click', () => $('evidence-dialog').close());

  $('analyze-button').addEventListener('click', async () => {
    if (isDemo) { await runDemo(); return; }
    if (!file || controller) return;
    if (!apiBase || !apiKey) { $('connection-button').click(); return; }
    const pendingFile = file;
    controller = new AbortController();
    const current = controller;
    const timeout = setTimeout(() => current.abort(new Error('За 5 минут сервис не вернул результат. Попробуйте ещё раз.')), 300000);
    resetReport(); showError(''); setProcessing(true, 'Передаём видео вашему сервису…', 15);
    try {
      const data = new FormData(); data.append('file', pendingFile);
      const response = await fetch(`${apiBase}/api/v1/analyze`, { method: 'POST', headers: { 'X-API-Key': apiKey }, body: data, signal: current.signal, credentials: 'omit', redirect: 'error' });
      if (!response.ok) throw new Error(apiError(response.status));
      const job = await response.json();
      if (!job.job_id || !['string', 'number'].includes(typeof job.job_id)) throw new Error('Сервис не вернул job_id. Проверьте формат API.');
      const start = Date.now();
      while (!current.signal.aborted) {
        await abortableWait(1500, current.signal);
        const resultResponse = await fetch(`${apiBase}/api/v1/jobs/${encodeURIComponent(job.job_id)}`, { headers: { 'X-API-Key': apiKey }, signal: current.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
        if (!resultResponse.ok) throw new Error(apiError(resultResponse.status));
        const result = await resultResponse.json();
        if (result.status === 'failed') throw new Error('Сервис не смог обработать видео. Проверьте журнал сервера и повторите попытку.');
        if (result.status === 'done') { validateReport(result); report = result; renderReport(); break; }
        if (result.status !== 'processing') throw new Error('Сервис вернул неизвестный статус обработки.');
        setProcessing(true, 'Локальный сервис анализирует запись…', Math.min(88, 25 + (Date.now() - start) / 4500));
      }
    } catch (err) {
      if (current.signal.aborted) showError(current.signal.reason instanceof Error && current.signal.reason.name !== 'AbortError' ? current.signal.reason.message : 'Проверка отменена.');
      else showError(err instanceof TypeError ? 'Не удалось связаться с сервисом. Проверьте адрес, HTTPS и настройки CORS на сервере.' : err.message);
    } finally {
      clearTimeout(timeout); if (controller === current) { controller = null; setProcessing(false); }
    }
  });
  $('cancel-analysis').addEventListener('click', () => { controller?.abort(); demoRun++; if (isDemo) setProcessing(false); });
  function setProcessing(active, label = '', percent = 0) {
    $('analysis-progress').hidden = !active; $('analyze-button').disabled = active || (!file && !isDemo);
    setButtonLoading($('analyze-button'), active);
    $('remove-file').disabled = active; $('demo-button').disabled = active;
    if (active) { $('progress-label').textContent = label; $('progress-bar').style.width = `${percent}%`; }
  }
  $('demo-button').addEventListener('click', runDemo);
  async function runDemo() {
    clearVideo(); isDemo = true; duration = 84; const run = ++demoRun;
    $('drop-zone').hidden = true; $('video-stage').hidden = false; video.hidden = true;
    $('demo-scene').hidden = false; $('file-information').hidden = false;
    $('file-name').textContent = 'Демонстрация интерфейса'; $('file-meta').textContent = 'Условная схема · 01:24 · Без анализа записи'; $('video-tag').textContent = 'ДЕМОРЕЖИМ';
    $('analyze-button').innerHTML = 'Повторить демо <span>↻</span>';
    setProcessing(true, 'Показываем демонстрационный сценарий…', 35);
    await new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? 0 : 650));
    if (run !== demoRun) return;
    setProcessing(false);
    report = { job_id: 'demo-interface-only', status: 'done', verdict: 'violation', demo: true, violations: structuredClone(demoEvents) };
    renderReport();
  }
  function renderReport() {
    $('empty-results').hidden = true; $('results-content').hidden = false; $('demo-notice').hidden = !isDemo;
    $('result-tab').classList.add('active'); $('event-count').textContent = report.violations.length;
    const clean = report.verdict === 'no_violation'; const banner = $('verdict-banner');
    banner.classList.toggle('clean', clean); banner.replaceChildren();
    const symbol = document.createElement('span'); symbol.textContent = clean ? '✓' : '⌖';
    banner.append(symbol, document.createTextNode(clean ? 'Нарушение не обнаружено' : isDemo ? 'Демо: 3 события для проверки' : 'Обнаружены признаки возможных нарушений'));
    $('no-events').hidden = !clean; $('timeline-area').hidden = false;
    $('timeline-duration').textContent = duration ? formatTime(duration) : 'Длительность неизвестна';
    $('timeline-count').textContent = `${report.violations.length} ${pluralEvents(report.violations.length)}`;
    const list = $('events-list'); list.replaceChildren(); $('timeline-track').replaceChildren();
    const maxTime = Math.max(duration || 0, ...report.violations.map((v) => v.timecode_sec + 3), 1);
    report.violations.forEach((event, index) => {
      const element = document.createElement('article'); element.className = 'event';
      const top = document.createElement('button'); top.className = 'event-top'; top.type = 'button'; top.setAttribute('aria-expanded', 'false');
      const num = document.createElement('span'); num.className = 'event-number'; num.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('span'); title.className = 'event-title'; title.textContent = event.type;
      const time = document.createElement('span'); time.className = 'event-time'; time.textContent = formatTime(event.timecode_sec);
      top.append(num, title, time); top.addEventListener('click', () => selectEvent(index));
      const body = document.createElement('div'); body.className = 'event-body';
      const description = document.createElement('p'); description.textContent = event.description; body.append(description);
      const rule = document.createElement('div'); rule.className = 'event-rule';
      const ruleTitle = document.createElement('b'); ruleTitle.textContent = 'Основание: '; rule.append(ruleTitle);
      const source = event.normative_source || event.source;
      const sourceName = typeof source === 'string' ? source : source && typeof source === 'object' ? [source.title || source.document, source.section].filter(Boolean).join(', ') : '';
      rule.append(document.createTextNode(event.rule || sourceName || 'Нормативный источник не указан сервисом. Требуется проверка.'));
      const sourceUrl = event.source_url || (typeof source === 'object' ? source?.url : '');
      if (sourceUrl) { try { const url = new URL(sourceUrl); if (url.protocol === 'https:') { const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' Открыть источник ↗'; rule.append(link); } } catch {} }
      body.append(rule);
      const grid = document.createElement('div'); grid.className = 'evidence-grid';
      event.evidence_frames.slice(0, 3).forEach((frame) => {
        if (typeof frame.image_base64 !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(frame.image_base64)) return;
        const dataUrl = `data:image/jpeg;base64,${frame.image_base64}`;
        const button = document.createElement('button'); button.className = 'evidence-thumb'; button.type = 'button'; button.setAttribute('aria-label', `Открыть кадр ${formatTime(frame.timestamp_sec)}`);
        const img = document.createElement('img'); img.src = dataUrl; img.alt = `Кадр ${formatTime(frame.timestamp_sec)}`; button.append(img);
        button.addEventListener('click', () => { $('evidence-image').src = dataUrl; $('evidence-caption').textContent = `${event.type} · ${formatTime(frame.timestamp_sec)}`; $('evidence-dialog').showModal(); }); grid.append(button);
      });
      if (isDemo) { const placeholder = document.createElement('div'); placeholder.className = 'demo-evidence'; const text = document.createElement('span'); text.textContent = 'Иллюстрация · не кадр-доказательство'; placeholder.append(text); grid.append(placeholder); }
      body.append(grid); element.append(top, body); list.append(element);
      const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'timeline-marker'; marker.style.left = `${Math.max(2, Math.min(98, event.timecode_sec / maxTime * 100))}%`;
      marker.setAttribute('aria-label', `${formatTime(event.timecode_sec)} — ${event.type}`); marker.addEventListener('click', () => selectEvent(index)); $('timeline-track').append(marker);
    });
    if (report.violations.length) selectEvent(0);
  }
  function selectEvent(index) {
    selectedEvent = index;
    document.querySelectorAll('.event').forEach((el, i) => { el.classList.toggle('selected', i === index); el.querySelector('button').setAttribute('aria-expanded', String(i === index)); });
    document.querySelectorAll('.timeline-marker').forEach((el, i) => el.classList.toggle('selected', i === index));
    const event = report.violations[index];
    if (isDemo) $('demo-time').textContent = `${formatTime(event.timecode_sec)} / 01:24`;
    else if (video.readyState >= 1) { video.currentTime = Math.min(event.timecode_sec, duration || event.timecode_sec); video.pause(); }
  }
  $('export-report').addEventListener('click', () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = isDemo ? 'forte-vision-demo.json' : `forte-vision-${String(report.job_id).replace(/[^a-z0-9_-]/gi, '')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener('beforeunload', () => { controller?.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); });
  if (new URLSearchParams(location.search).get('demo') === '1') runDemo();
}

function validateReport(result) {
  if (!['violation', 'no_violation'].includes(result.verdict) || !Array.isArray(result.violations)) throw new Error('Ответ сервиса не соответствует схеме результата из кейса.');
  if (result.verdict === 'no_violation' && result.violations.length || result.verdict === 'violation' && !result.violations.length) throw new Error('Вердикт сервиса не согласуется со списком событий.');
  for (const v of result.violations) {
    if (typeof v.type !== 'string' || typeof v.description !== 'string' || !Number.isFinite(v.timecode_sec) || v.timecode_sec < 0 || !Array.isArray(v.evidence_frames) || !v.evidence_frames.length) throw new Error('В событии отсутствует описание, таймкод или кадр-доказательство.');
    if (v.evidence_frames.some((f) => !Number.isFinite(f.timestamp_sec) || f.timestamp_sec < 0 || typeof f.image_base64 !== 'string' || !f.image_base64)) throw new Error('Сервис вернул некорректный кадр-доказательство.');
  }
}
function apiError(status) { return status === 401 || status === 403 ? 'Сервис отклонил API-ключ. Проверьте подключение.' : status === 413 ? 'Сервис не принимает видео такого размера. Проверьте лимит на сервере.' : `Сервис вернул ошибку HTTP ${status}. Попробуйте ещё раз.`; }
function formatTime(value) { const seconds = Math.max(0, Math.floor(Number(value) || 0)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function formatBytes(bytes) { return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`; }
function pluralEvents(n) { return n % 10 === 1 && n % 100 !== 11 ? 'событие' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'события' : 'событий'; }
function abortableWait(ms, signal) { return new Promise((resolve, reject) => { if (signal.aborted) { reject(signal.reason); return; } const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms); function abort() { clearTimeout(timer); reject(signal.reason); } signal.addEventListener('abort', abort, { once: true }); }); }
