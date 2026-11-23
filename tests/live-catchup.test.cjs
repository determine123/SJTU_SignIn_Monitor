const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../edge-signin-monitor/live-catchup.js'), 'utf8');

function fixture({ duration = Infinity, rangeCount = 1 } = {}) {
  let listener;
  let interval;
  let now = 0;
  const events = new Map();
  const video = {
    duration, seekable: {length:rangeCount, start:()=>0, end:()=>100},
    currentTime:95, playbackRate:1, videoWidth:1280, clientWidth:1280, clientHeight:720,
    currentSrc:'blob:example', isConnected:true,
    addEventListener:(event, callback)=>events.set(event, callback),
    removeEventListener:event=>events.delete(event),
  };
  vm.runInNewContext(source,{
    document:{querySelectorAll:()=>[video]},
    chrome:{runtime:{id:'test',onMessage:{addListener:fn=>listener=fn}}},
    performance:{now:()=>now},
    setTimeout:callback=>callback(),
    setInterval:callback=>(interval=callback,1),
    clearInterval:()=>{interval=undefined;},
    window:{addEventListener(){},removeEventListener(){}},
  });
  return {
    video, events,
    start:()=>new Promise(resolve=>listener({type:'catchUpLive'},{id:'test'},resolve)),
    tick:(time=0)=>{now=time;interval?.();},
  };
}

test('boosts a live player and restores the original rate near the edge',async()=>{
  const h=fixture();
  h.video.playbackRate=1.1;
  await h.start();
  assert.equal(h.video.playbackRate,1.25);
  h.video.currentTime=98.5;
  h.tick();
  assert.equal(h.video.playbackRate,1.1);
});

test('ends on buffering or timeout and preserves a manual rate change',async()=>{
  const h=fixture();
  await h.start();
  h.events.get('waiting')();
  assert.equal(h.video.playbackRate,1);
  await h.start();
  h.tick(25000);
  assert.equal(h.video.playbackRate,1);
  await h.start();
  h.video.playbackRate=1.5;
  h.tick(26000);
  assert.equal(h.video.playbackRate,1.5);
});

test('leaves fixed recordings and unknown live edges alone',async()=>{
  for(const options of [{duration:100},{rangeCount:0}]){
    const h=fixture(options);
    await h.start();
    assert.equal(h.video.playbackRate,1);
  }
});
