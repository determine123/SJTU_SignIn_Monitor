const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');
test('acknowledging still clears notifications when the audio document API fails',async()=>{
 const h=await boot(path.join(__dirname,'../edge-signin-monitor'));
 h.db.pending={test:{message:'fixture'}};
 h.run("chrome.offscreen.hasDocument=async()=>{throw Error('audio unavailable')}; globalThis.cleared=[]; chrome.notifications.getAll=async()=>({test:{}}); chrome.notifications.clear=async id=>cleared.push(id)");
 const reply=await h.message({type:'ack'});
 assert.equal(reply.ok,true);assert.equal(reply.audioStopped,false);
 assert.equal(h.run('cleared.length'),1);
 assert.equal(typeof h.db.pending==='object'?Object.keys(h.db.pending).length: h.db.pending,0);
 assert(h.db.logs.some(x=>(typeof x==='string'?x:x.message).includes('声音停止失败')));
});

test('successful acknowledgement confirms audio cleanup',async()=>{const h=await boot(path.join(__dirname,'../edge-signin-monitor'));const reply=await h.message({type:'ack'});assert.equal(reply.ok,true);assert.equal(reply.audioStopped,true);});
