const start = document.getElementById('start');
const stop = document.getElementById('stop');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const detection = document.getElementById('detection');
const link = document.getElementById('signin-link');
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', {willReadFrequently: true});
const seen = new Map();
const opened = new Set();
const openSignin = document.getElementById('open-signin');
const refreshLive = document.getElementById('refresh-live');
const refreshResult = document.getElementById('refresh-result');
const rawTab = new URLSearchParams(location.search).get('liveTab');
const liveTab = rawTab !== null && /^\d+$/.test(rawTab) ? Number(rawTab) : null;
let stream;
let timer;
let audio;
let refreshed = false;
let session = 0;
let originalLiveUrl;

async function schoolTab() {
  if (!Number.isSafeInteger(liveTab)) return null;
  const tab = await chrome.tabs.get(liveTab);
  if (!tab.url) return null;
  const url = new URL(tab.url);
  return url.protocol === 'https:' && url.hostname.endsWith('.sjtu.edu.cn') ? tab : null;
}

async function refreshAndCatchUp(currentSession) {
  if (!refreshLive.checked || refreshed) return;
  refreshed = true;
  try {
    const tab = await schoolTab();
    if (!tab || tab.url !== originalLiveUrl || currentSession !== session) {
      if (currentSession === session) refreshResult.textContent = '原直播标签页已变化，跳过刷新。';
      return;
    }
    refreshResult.textContent = '正在刷新直播，已保留签到链接。';
    await chrome.tabs.reload(tab.id);
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (currentSession !== session) return;
      const reloaded = await schoolTab();
      if (!reloaded || reloaded.url !== tab.url) break;
      if (reloaded.status !== 'complete') continue;
      const result = await chrome.tabs.sendMessage(tab.id,{type:'catchUpLive'}).catch(() => null);
      if (!result) continue;
      if (currentSession === session) refreshResult.textContent = result;
      return;
    }
    if (currentSession === session) refreshResult.textContent = '直播尚未恢复播放，请切回直播页检查。';
  } catch {
    if (currentSession === session) refreshResult.textContent = '无法刷新直播，请检查原直播标签页。';
  }
}

schoolTab().then(tab => {
  if (tab) {
    originalLiveUrl = tab.url;
    document.getElementById('refresh-option').hidden = false;
  }
}).catch(() => {});

function attendanceUrl(text) {
  if (!text || /[\s\u0000-\u001f\u007f]/u.test(text)) return null;
  try {
    const url = new URL(text);
    if (url.origin !== 'https://mlearning.sjtu.edu.cn' || url.username || url.password) return null;
    if (!/^\/lms\/mobile2\/forscan\/?$/.test(url.pathname)) return null;
    const codes = url.searchParams.getAll('courseCode');
    const types = url.searchParams.getAll('fromType');
    if (codes.length !== 1 || !/^[a-z0-9]+$/i.test(codes[0])) return null;
    return types.length === 1 && types[0] === 'scanRollCall' ? url : null;
  } catch {
    return null;
  }
}

function ring() {
  if (audio?.state !== 'running') return false;
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  tone.frequency.setValueAtTime(880, now);
  tone.frequency.setValueAtTime(1175, now + 0.22);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.55);
  tone.connect(gain).connect(audio.destination);
  tone.start(now);
  tone.stop(now + 0.55);
  return true;
}

async function notifyAttendance(url, fingerprint, currentSession) {
  const shouldOpen = openSignin.checked && !opened.has(fingerprint);
  if (shouldOpen) opened.add(fingerprint);
  const tasks = [chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: '发现 SJTU 签到二维码',
    message: shouldOpen ? '请在学校签到页确认签到结果。' : '请返回直播扫码页查看签到链接。',
  })];
  if (shouldOpen) tasks.push(chrome.tabs.create({url: url.href, active: true}));
  const [notice, tab] = await Promise.allSettled(tasks);
  if (currentSession !== session) return;
  const details = [];
  if (tab?.status === 'rejected') {
    opened.delete(fingerprint);
    details.push('自动打开失败，可点击下方签到链接');
  }
  if (notice.status === 'rejected') details.push('桌面通知未发出');
  if (details.length) status.textContent += ' · ' + details.join(' · ');
}

function scan() {
  if (preview.readyState < 2 || !preview.videoWidth) return;
  const scale = Math.min(1, 1920 / Math.max(preview.videoWidth, preview.videoHeight));
  const width = Math.max(1, Math.round(preview.videoWidth * scale));
  const height = Math.max(1, Math.round(preview.videoHeight * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.drawImage(preview, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  const qr = jsQR(frame.data, width, height, {inversionAttempts: 'dontInvert'});
  const now = performance.now();
  for (const [code, lastSeen] of seen) {
    if (now - lastSeen >= 10000) seen.delete(code);
  }
  const url = attendanceUrl(qr?.data);
  if (!url) return;
  const course = url.searchParams.get('courseCode');
  const history = url.searchParams.get('signHistoryId');
  const fingerprint = history ? JSON.stringify([course, history]) : course;
  const alreadySeen = seen.has(fingerprint) || opened.has(fingerprint);
  seen.set(fingerprint, now);
  link.href = url.href;
  detection.hidden = false;
  if (alreadySeen) return;
  const sounded = ring();
  status.textContent = '已识别签到二维码 · ' + new Date().toLocaleTimeString('zh-CN') +
    (sounded ? '' : ' · 声音未启用，请点测试声音');
  void notifyAttendance(url, fingerprint, session);
  void refreshAndCatchUp(session);
}

function stopCapture(message, keepLink = false) {
  if (!keepLink) session++;
  window.liveSpeech.stop();
  clearInterval(timer);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  preview.srcObject = null;
  preview.hidden = true;
  if (!keepLink) {
    link.removeAttribute('href');
    detection.hidden = true;
  }
  seen.clear();
  start.disabled = false;
  stop.disabled = true;
  status.textContent = message;
}

start.onclick = async () => {
  start.disabled = true;
  session++;
  refreshed = false;
  opened.clear();
  refreshResult.textContent = '';
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {displaySurface: 'browser', frameRate: {ideal: 5, max: 10}},
      audio: document.getElementById('speech-enabled').checked,
      selfBrowserSurface: 'exclude',
    });
    const track = stream.getVideoTracks()[0];
    const source = track.getSettings().displaySurface;
    if (source && source !== 'browser') {
      stopCapture('请在共享窗口中选择「标签页」，然后选中直播。');
      return;
    }
    track.addEventListener('ended', () => {
      const wasRefreshing = refreshed;
      stopCapture('共享已结束。可重新选择直播。', wasRefreshing);
    }, {once: true});
    preview.srcObject = stream;
    await preview.play();
    if (track.readyState === 'ended') return;
    preview.hidden = false;
    stop.disabled = false;
    status.textContent = '正在扫描直播。建议将此页保持在前台。';
    try {
      window.liveSpeech.start(stream);
    } catch {
      document.getElementById('speech-status').textContent = '无法读取直播音频，扫码继续运行。';
    }
    timer = setInterval(() => {
      try {
        scan();
      } catch {
        stopCapture('无法读取直播画面，请重新选择直播标签页。');
      }
    }, 250);
  } catch (error) {
    stopCapture(error.name === 'NotAllowedError' ? '共享未授权或已取消。' : '无法开启直播共享，请重试。');
  }
};

stop.onclick = () => stopCapture('已停止扫码。');
document.getElementById('test-sound').onclick = async () => {
  try {
    audio ??= new AudioContext();
    await audio.resume();
    ring();
  } catch {
    status.textContent = '无法播放提示音，请检查 Edge 的声音设置。';
  }
};
document.getElementById('test-notification').onclick = async () => {
  try {
    if (await chrome.notifications.getPermissionLevel() !== 'granted') {
      status.textContent = 'Edge 未获得桌面通知权限。';
      return;
    }
    await chrome.notifications.create({
      type:'basic', iconUrl:'icon.png', title:'SJTU 签到提醒测试',
      message:'看到这条通知后，即可确认桌面提醒可见。',
    });
    status.textContent = '已请求 Edge 显示测试通知，请检查 Windows 通知。';
  } catch {
    status.textContent = '无法发出桌面通知，请检查 Edge 和 Windows 的通知设置。';
  }
};
window.addEventListener('pagehide', () => stopCapture('已停止扫码。'));
