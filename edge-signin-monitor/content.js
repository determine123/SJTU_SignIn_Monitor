let last='';let timer;
async function scan(){
 try{const r=await chrome.runtime.sendMessage({type:"status"});if(!r?.active)return;}catch{return;}
 const record=SigninParser.parse(document);const now=Date.now();
 const signature=JSON.stringify(record);
 if(signature===last&&now-(scan.sent||0)<20000)return;
 const top=window===window.top;
 // Suppress repeated reports only after the worker confirms processing them.
 // A disconnected worker or rejected report must remain eligible for retry.
 try{const reply=await chrome.runtime.sendMessage({type:'report',record,top,url:location.href,login:top&&(/\/login|jaccount/i.test(location.href)||!!document.querySelector('input[type=password]')),time:now});if(reply?.ok){last=signature;scan.sent=now;}}catch{}
}
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,800)}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(scan,15000);scan();
