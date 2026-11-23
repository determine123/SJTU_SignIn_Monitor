(() => {
  const targetGap = 1.5;
  const rate = 1.25;
  let busy = false;

  function gap(video) {
    const ranges = video.seekable;
    const index = ranges.length - 1;
    if (index < 0 || video.currentTime < ranges.start(index)) return null;
    const distance = ranges.end(index) - video.currentTime;
    return Number.isFinite(distance) && distance >= 0 ? distance : null;
  }

  async function catchUp(video) {
    if (busy) return '直播检查或追帧已在进行。';
    if (gap(video) === null) return '播放器未报告可用的直播边缘。';
    if (Number.isFinite(video.duration)) {
      const initialEdge = video.currentTime + gap(video);
      busy = true;
      await new Promise(resolve => setTimeout(resolve, 1200));
      busy = false;
      const distance = gap(video);
      const currentEdge = video.currentTime + distance;
      if (distance === null || currentEdge <= initialEdge || video.duration - currentEdge > 1) {
        return '未确认画面为可追帧的直播。';
      }
    }
    const distance = gap(video);
    if (distance === null || video.paused || video.ended) return '直播状态已变化，请重试。';
    if (distance <= targetGap) return '已接近播放器直播边缘。';
    const original = video.playbackRate;
    if (original <= 0 || original >= rate) return '当前播放速度无需调整。';
    const deadline = performance.now() + 25000;
    const src = video.currentSrc;
    video.playbackRate = rate;
    if (video.playbackRate !== rate) return '播放器未接受倍速设置。';
    busy = true;
    const events = ['pause', 'waiting', 'ended', 'emptied', 'seeking'];
    const timer = setInterval(() => {
      const remaining = gap(video);
      if (!video.isConnected || video.currentSrc !== src || video.playbackRate !== rate ||
          remaining === null || remaining <= targetGap || performance.now() >= deadline) finish();
    }, 250);
    function finish() {
      clearInterval(timer);
      for (const event of events) video.removeEventListener(event, finish);
      window.removeEventListener('pagehide', finish);
      busy = false;
      if (video.playbackRate === rate) video.playbackRate = original;
    }
    for (const event of events) video.addEventListener(event, finish);
    window.addEventListener('pagehide', finish);
    return '正在以 1.25× 追近直播边缘，结束后恢复原倍速。';
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type !== 'catchUpLive' || sender.id !== chrome.runtime.id) return;
    const [video] = [...document.querySelectorAll('video')]
      .filter(item => !item.paused && !item.ended && item.videoWidth &&
        item.clientWidth >= 160 && item.clientHeight >= 90)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    if (!video) return;
    catchUp(video).then(reply, () => reply('播放器未接受倍速设置。'));
    return true;
  });
})();
