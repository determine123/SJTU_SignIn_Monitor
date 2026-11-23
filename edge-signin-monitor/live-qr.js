const start = document.getElementById('start');
const stop = document.getElementById('stop');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const detection = document.getElementById('detection');
const link = document.getElementById('signin-link');
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', {willReadFrequently: true});
const seen = new Map();
let stream;
let timer;
let audio;

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
  const code = url.searchParams.get('courseCode');
  const alreadySeen = seen.has(code);
  seen.set(code, now);
  if (alreadySeen) return;
  link.href = url.href;
  detection.hidden = false;
  const sounded = ring();
  status.textContent = '已识别签到二维码 · ' + new Date().toLocaleTimeString('zh-CN') +
    (sounded ? '' : ' · 声音未启用，请点测试声音');
}

function stopCapture(message) {
  clearInterval(timer);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  preview.srcObject = null;
  preview.hidden = true;
  link.removeAttribute('href');
  detection.hidden = true;
  seen.clear();
  start.disabled = false;
  stop.disabled = true;
  status.textContent = message;
}

start.onclick = async () => {
  start.disabled = true;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {displaySurface: 'browser', frameRate: {ideal: 5, max: 10}},
      audio: false,
      selfBrowserSurface: 'exclude',
    });
    const track = stream.getVideoTracks()[0];
    const source = track.getSettings().displaySurface;
    if (source && source !== 'browser') {
      stopCapture('请在共享窗口中选择「标签页」，然后选中直播。');
      return;
    }
    track.addEventListener('ended', () => stopCapture('共享已结束。可重新选择直播。'), {once: true});
    preview.srcObject = stream;
    await preview.play();
    if (track.readyState === 'ended') return;
    preview.hidden = false;
    stop.disabled = false;
    status.textContent = '正在扫描直播。建议将此页保持在前台。';
    timer = setInterval(() => {
      try {
        scan();
      } catch {
        stopCapture('无法读取直播画面，请重新选择直播标签页。');
      }
    }, 500);
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
window.addEventListener('pagehide', () => stopCapture('已停止扫码。'));
