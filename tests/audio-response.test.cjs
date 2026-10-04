const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');
for(const play of [true,false])test(`audio command ${play?'play':'stop'} requires a positive offscreen acknowledgement`,async()=>{
 const h=await boot(path.join(__dirname,'../edge-signin-monitor'));
 h.run('chrome.offscreen.hasDocument=async()=>true;chrome.runtime.sendMessage=async()=>({ok:false})');
 await assert.rejects(()=>h.run(`audio(${play})`),/音频页面未确认/);
 h.run('chrome.runtime.sendMessage=async()=>undefined');
 await assert.rejects(()=>h.run(`audio(${play})`),/音频页面未确认/);
 h.run('chrome.runtime.sendMessage=async()=>({ok:true})');
 await h.run(`audio(${play})`);
});
