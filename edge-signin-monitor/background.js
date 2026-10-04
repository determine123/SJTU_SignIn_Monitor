importScripts('schedule.js');
const defaults={enabled:false,autoOpen:true,interval:30,sound:true,firstActive:true,courses:[],pushplus_token:'',serverchan_sendkey:'',telegram_bot_token:'',telegram_chat_id:''};
let queue=Promise.resolve();let audioCreating;let logQueue=Promise.resolve();
const urlFor=id=>`https://oc.sjtu.edu.cn/courses/${id}/external_tools/6650`;
async function settings(){return {...defaults,...(await chrome.storage.local.get('settings')).settings}}
async function audio(play){
 if(play){if(!await chrome.offscreen.hasDocument()){audioCreating ||= chrome.offscreen.createDocument({url:'offscreen.html',reasons:['AUDIO_PLAYBACK'],justification:'Play attendance alert until acknowledged'}).finally(()=>audioCreating=null);await audioCreating;}}
 if(await chrome.offscreen.hasDocument()){const reply=await chrome.runtime.sendMessage({type:play?'sound':'silence'});if(!reply?.ok)throw Error('音频页面未确认操作');}
}
function append(event){logQueue=logQueue.catch(()=>{}).then(async()=>{const {logs=[]}=await chrome.storage.local.get('logs');logs.unshift({time:Date.now(),...event});await chrome.storage.local.set({logs:logs.slice(0,300)});});return logQueue;}
async function mobile(title,text,s){
 const jobs=[];
 if(s.pushplus_token)jobs.push(['PushPlus','https://www.pushplus.plus/send',{token:s.pushplus_token,title,content:text,template:'txt'}]);
 if(s.serverchan_sendkey)jobs.push(['Server酱',`https://sctapi.ftqq.com/${encodeURIComponent(s.serverchan_sendkey)}.send`,{title,desp:text}]);
 if(s.telegram_bot_token&&s.telegram_chat_id)jobs.push(['Telegram',`https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`,{chat_id:s.telegram_chat_id,text:title+'\n'+text}]);
 await Promise.all(jobs.map(async([name,url,body])=>{
  try{const origin=new URL(url).origin+'/*';if(!await chrome.permissions.contains({origins:[origin]}))throw Error('permission');
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const d=await r.json();
   const ok=r.ok&&(name==='Telegram'?d.ok:[0,200].includes(d.code));await append({kind:'push',message:name+(ok?'：接口已接受（不代表已送达）':'：拒绝，错误码 '+String(d.code??r.status))});
  }catch{await append({kind:'push',message:name+'：发送失败，请检查网络与授权'});}
 }));
}
async function alertCourse(id,record,s,test=false){
 const title=test?'签到提醒测试':`课程 ${id} 签到提醒`;
 const message=test?'这是测试通知，请确认声音和通知是否正常。':`签到号 ${record.num} · ${record.status||'状态未知'}\n${record.created||''}`;
 const key=test?'test':'course-'+id;
 const {pending={}}=await chrome.storage.local.get('pending');pending[key]={course:id,message};await chrome.storage.local.set({pending});
 try{await chrome.notifications.create(key,{type:'basic',iconUrl:'icon.png',title,message,requireInteraction:true,buttons:[{title:'已收到，停止提醒'},{title:'打开课程'}]});}catch{await append({kind:'error',message:'桌面通知失败'});}
 if(s.sound){try{await audio(true);}catch{await append({kind:'error',message:'声音播放失败'});}}
 await append({kind:test?'test':'change',course:id,message});await mobile(title,message,s);
}
async function acknowledge(id){let audioStopped=true;const {pending={}}=await chrome.storage.local.get('pending');if(id)delete pending[id];else for(const key of Object.keys(pending))delete pending[key];await chrome.storage.local.set({pending});if(!Object.keys(pending).length)try{await audio(false);}catch{audioStopped=false;await append({kind:'error',message:'声音停止失败，请检查扩展音频页面'});}if(id)await chrome.notifications.clear(id);else for(const n of Object.keys(await chrome.notifications.getAll()))await chrome.notifications.clear(n);return audioStopped;}
async function report(m,sender){
 const s=await settings();if(!s.enabled||!await active()||!sender.tab)return;
 const {states={}}=await chrome.storage.local.get('states');
 const byUrl=/\/courses\/(\d+)\/external_tools\/6650/.exec(sender.tab.url||'');
 let id=byUrl?.[1]||Object.keys(states).find(k=>states[k].tabId===sender.tab.id);if(!s.courses.includes(id))return;
 const state=states[id]||{};state.tabId=sender.tab.id;
 if(m.top&&m.login){state.status='需要登录';state.lastCheck=Date.now();}
 if(m.record){const r=m.record;const previous=state.record;const fresh=previous&&previous.key!==r.key;const becameActive=previous&&!previous.active&&r.active;
  state.status='正常 · '+(r.status||'状态未知');state.lastCheck=Date.now();state.record=r;
  const should=!r.ended&&((!previous&&s.firstActive&&r.active)||fresh||becameActive);
  // Store baseline BEFORE external effects, so worker restarts do not repeat alerts.
  states[id]=state;await chrome.storage.local.set({states});
  if(should)await alertCourse(id,r,s);
 }else{states[id]=state;await chrome.storage.local.set({states});}
}
async function tick(){
 const s=await settings();if(!s.enabled||!await active())return;
 const {states={}}=await chrome.storage.local.get('states');const tabs=await chrome.tabs.query({});
 for(const id of s.courses){const state=states[id]||{};
  try{let tab=tabs.find(t=>(t.url||'').split('?')[0]===urlFor(id))||tabs.find(t=>t.id===state.tabId&&/jaccount|\/login/i.test(t.url||''));
  if(!tab&&!s.autoOpen){state.status='页面关闭，请手动打开课程';state.tabId=null;states[id]=state;continue;}
  if(!tab){tab=await chrome.tabs.create({url:urlFor(id),active:false});state.status='等待页面';state.tabId=tab.id;state.opened=Date.now();}
  else if(tab.status==='complete'&&Date.now()-(state.opened||0)>15000){
   if(/jaccount|\/login/i.test(tab.url||'')){state.status='需要登录';}
   else if(!/\/courses\/\d+\/external_tools\/6650/.test(tab.url||'')){await chrome.tabs.update(tab.id,{url:urlFor(id)});state.opened=Date.now();}
   else {if(Date.now()-(state.lastCheck||state.opened||0)>90000)state.status='未识别签到表格，请检查页面';await chrome.tabs.reload(tab.id);}
  }
  state.tabId=tab.id;states[id]=state;
  }catch{
   state.status='页面检查失败，将在下次检查重试';states[id]=state;
   await append({kind:'error',course:id,message:'课程页面检查失败，请检查页面或等待下次重试'});
  }
 }
 await chrome.storage.local.set({states});
}
async function active(){return Boolean((await chrome.storage.session.get('activated')).activated);}
const initialClasses=[];
async function planClasses(){
 for(const a of await chrome.alarms.getAll())if(a.name.startsWith('class:')||a.name==='class-plan')await chrome.alarms.clear(a.name);
 if(!await active())return;
 const {classEnabled=true,classSchedule=initialClasses,classSent={}}=await chrome.storage.local.get(['classEnabled','classSchedule','classSent']);
 if(!classEnabled)return;
 const due={};for(const [i,r] of ClassSchedule.validate(classSchedule).entries()){const n=ClassSchedule.next(r,Date.now(),classSent);if(n){const name='class:'+i;due[name]={...n,row:r};await chrome.alarms.create(name,{when:n.when});}}
 await chrome.storage.local.set({classDue:due});await chrome.alarms.create('class-plan',{periodInMinutes:60});
}
async function classReminder(name){
 const {classDue={},classSent={},classEnabled=true}=await chrome.storage.local.get(['classDue','classSent','classEnabled']);const event=classDue[name];
 if(!await active()||!classEnabled||!event||event.classAt<=Date.now()||classSent[event.key]){await planClasses();return;}
 if(Date.now()<event.when){await chrome.alarms.create(name,{when:event.when});return;}
 // Commit before notifications, so repeated alarms cannot duplicate the reminder.
 classSent[event.key]=Date.now();for(const k of Object.keys(classSent))if(classSent[k]<Date.now()-90*86400000)delete classSent[k];await chrome.storage.local.set({classSent});
 const r=event.row;const s=await settings();const title='上课提醒：'+r.name;const minutes=Math.max(1,Math.ceil((event.classAt-Date.now())/60000));const message=event.date+' '+r.time+' 上课（约 '+minutes+' 分钟后）\n'+(r.location||'');
 const key='lesson:'+event.key;const {pending={}}=await chrome.storage.local.get('pending');pending[key]={course:r.courseId,message};await chrome.storage.local.set({pending});
 try{await chrome.notifications.create(key,{type:'basic',iconUrl:'icon.png',title,message,requireInteraction:true,buttons:[{title:'已收到，停止提醒'},{title:'打开课程'}]});}catch{await append({kind:'error',message:'上课提醒桌面通知失败'});}
 if(s.sound)try{await audio(true);}catch{await append({kind:'error',message:'上课提醒声音播放失败'});}await append({kind:'class',course:r.courseId,message:title+' · '+message});await mobile(title,message,s);await planClasses();
}
async function bootstrap(){const s=await settings();if(s.enabled&&await active()){if(!await chrome.alarms.get('poll'))await chrome.alarms.create('poll',{periodInMinutes:Math.max(30,s.interval)/60});}else await chrome.alarms.clear('poll');await planClasses();}
chrome.alarms.onAlarm.addListener(a=>{queue=queue.then(async()=>{if(a.name==='poll')await tick();else if(a.name==='class-plan')await planClasses();else if(a.name.startsWith('class:'))await classReminder(a.name);}).catch(e=>append({kind:'error',message:'检查失败：'+e.name}));});
chrome.runtime.onStartup.addListener(()=>{queue=queue.then(async()=>{await chrome.storage.session.set({activated:false});await acknowledge();await bootstrap();}).catch(()=>{});});
chrome.runtime.onInstalled.addListener(()=>{queue=queue.then(bootstrap).catch(()=>{});});
chrome.notifications.onButtonClicked.addListener((id,index)=>{queue=queue.then(async()=>{if(index===1){const {pending={}}=await chrome.storage.local.get('pending');const course=pending[id]?.course;if(course)await chrome.tabs.create({url:urlFor(course)});}await acknowledge(id)}).catch(()=>{})});
chrome.notifications.onClosed.addListener((id,byUser)=>{if(byUser)queue=queue.then(()=>acknowledge(id)).catch(()=>{})});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(['sound','silence'].includes(m.type))return;
 if(m.type==='status'){Promise.all([active(),settings()]).then(([a,s])=>reply({active:a&&s.enabled}));return true;}
 queue=queue.then(async()=>{
  if(m.type==='activate'){if(!await active()){await chrome.storage.session.set({activated:true});const s=await settings();await chrome.storage.local.set({settings:{...s,enabled:true}});await bootstrap();await tick();}}
  if(m.type==='removeClass'){
   const {classSchedule=[]}=await chrome.storage.local.get('classSchedule');
   if(!Number.isInteger(m.index)||m.index<0||m.index>=classSchedule.length||JSON.stringify(classSchedule[m.index])!==JSON.stringify(m.row))throw Error('课表已更改，请重新打开扩展后再移除');
   await chrome.storage.local.set({classSchedule:classSchedule.filter((_,i)=>i!==m.index)});
   await planClasses();
  }
  if(m.type==='saveClasses'){const rows=ClassSchedule.validate(m.rows);await chrome.storage.local.set({classSchedule:rows,classEnabled:Boolean(m.enabled)});await planClasses();}
  if(m.type==='report')await report(m,sender);
  if(m.type==='save'){const old=await settings();const s={...old,...m.settings};s.interval=Math.max(30,Number(s.interval)||30);s.courses=[...new Set(s.courses.filter(id=>/^\d+$/.test(id)))];await chrome.storage.local.set({settings:s});await chrome.alarms.clear('poll');await bootstrap();if(s.enabled){if(!s.sound)await audio(false);await tick();}else await acknowledge();}
  if(m.type==='test')await alertCourse('95353',null,await settings(),true);
  if(m.type==='ack'){reply({ok:true,audioStopped:await acknowledge()});return;}
  reply({ok:true});
 }).catch(async e=>{await append({kind:'error',message:'操作失败：'+e.name});reply({ok:false,error:e.message});});return true;
});
queue=queue.then(async()=>{
 const {manualUseConfigured,classSchedule}=await chrome.storage.local.get(['manualUseConfigured','classSchedule']);
 if(!manualUseConfigured){const s=await settings();await chrome.storage.local.set({settings:{...s,enabled:false},manualUseConfigured:true});await chrome.storage.session.set({activated:false});await acknowledge();}
 if(!classSchedule)await chrome.storage.local.set({classSchedule:initialClasses,classEnabled:true});
 await bootstrap();
}).catch(e=>append({kind:'error',message:'初始化失败：'+e.name}));
