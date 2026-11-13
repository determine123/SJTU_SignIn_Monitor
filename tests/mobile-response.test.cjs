const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');const folder=path.resolve(__dirname,'../edge-signin-monitor');
const configs={PushPlus:{pushplus_token:'fixture-secret'},'Server酱':{serverchan_sendkey:'fixture-secret'},Telegram:{telegram_bot_token:'fixture-secret',telegram_chat_id:'42'}};
async function check(name,body,httpOK=true){const h=await boot(folder);h.c.fixture=body;h.c.httpOK=httpOK;await h.run("chrome.permissions.contains=async()=>true;fetch=async()=>({ok:httpOK,status:httpOK?200:503,json:async()=>fixture})");h.c.config=configs[name];await h.run("mobile('title','text',config)");assert(!JSON.stringify(h.db.logs).includes('fixture-secret'));return h.db.logs[0].message;}
for(const [name,body] of [['PushPlus',{code:200}],['Server酱',{code:0}],['Telegram',{ok:true}]])test(`${name} accepts only its documented success response`,async()=>assert.match(await check(name,body),/接口已接受/));
for(const [name,body] of [['PushPlus',{code:0}],['Server酱',{code:200}],['Telegram',{ok:'false'}]])test(`${name} rejects a response with another success format`,async()=>assert.match(await check(name,body),/拒绝/));
test('Telegram rejection logs its API error code rather than HTTP 200',async()=>assert.match(await check('Telegram',{ok:false,error_code:403}),/错误码 403/));
test('HTTP failure cannot be overridden by a successful JSON body',async()=>assert.match(await check('Telegram',{ok:true},false),/拒绝/));
for(const config of [{telegram_bot_token:'fixture-secret'},{telegram_chat_id:'42'}])test('incomplete Telegram settings explain why no request is sent',async()=>{
 const h=await boot(folder);h.c.config=config;await h.run("requests=0;fetch=async()=>{requests++;throw Error('must not send')};mobile('title','text',config)");
 assert.equal(h.c.requests,0);
 assert(h.db.logs.some(x=>/Telegram.*配置不完整/.test(x.message)));
 assert(!JSON.stringify(h.db.logs).includes('fixture-secret'));
});

test('API error strings cannot leak credentials into logs',async()=>assert.match(await check('PushPlus',{code:'fixture-secret'}),/错误码 200/));
for(const body of [null,{},[]])test('malformed success payload is rejected',async()=>assert.match(await check('Telegram',body),/拒绝/));
