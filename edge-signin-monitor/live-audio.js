(() => {
  const enabled = document.getElementById('speech-enabled');
  const status = document.getElementById('speech-status');
  let stopCurrent;
  let lastAlert = -Infinity;

  async function notify(keywords) {
    const now = performance.now();
    if (now - lastAlert < 60000) return;
    lastAlert = now;
    if (await chrome.notifications.getPermissionLevel() !== 'granted') return;
    await chrome.notifications.create({
      type:'basic', iconUrl:'icon.png', title:'直播可能开始签到',
      message:'识别到签到相关语音（' + keywords.join('、') + '）。请查看直播或学校页面确认。',
    });
  }

  window.liveSpeech = {
    start(stream) {
      if (!enabled.checked) return;
      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        status.textContent = '共享未包含音频。请重新共享直播标签页并勾选共享音频。';
        return;
      }
      const input = new MediaStream(tracks);
      const mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        status.textContent = '当前 Edge 无法录制此次共享的音频。';
        return;
      }
      let stopped = false, timer, recorder, controller;
      stopCurrent = () => {
        stopped = true;
        clearTimeout(timer);
        if (recorder?.state === 'recording') recorder.stop();
        controller?.abort();
      };
      function cycle() {
        if (stopped || !enabled.checked) return;
        recorder = new MediaRecorder(input, {mimeType});
        recorder.ondataavailable = async ({data}) => {
          if (stopped || !enabled.checked) return;
          cycle();
          if (data.size && !controller) {
            controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 25000);
            try {
              const response = await fetch('http://127.0.0.1:18765/transcribe', {
                method:'POST', body:data, headers:{'X-SJTU-Audio':'1'}, signal:controller.signal,
              });
              if (!response.ok) throw Error('ASR request failed');
              const result = await response.json();
              if (stopped || !enabled.checked) return;
              if (result.keywords.length) {
                status.textContent = '识别到签到语音 · ' + result.keywords.join('、');
                await notify(result.keywords);
              } else {
                status.textContent = '语音监听中 · ' + (result.language || '等待语音');
              }
            } catch {
              if (!stopped) status.textContent = '本机 Qwen ASR 未就绪，扫码继续运行。';
            } finally {
              clearTimeout(timeout);
              controller = undefined;
            }
          }
        };
        recorder.start();
        timer = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 5000);
      }
      status.textContent = '正在读取直播标签页音频。';
      cycle();
    },
    stop() {
      stopCurrent?.();
      stopCurrent = undefined;
      status.textContent = '';
    },
  };
})();
