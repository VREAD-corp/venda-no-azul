/*! Venda no Azul: contagem anônima. Sem cookie, sem identificador, sem IP guardado; respeita Do Not Track e GPC. */
((n,l,d)=>{var A='https://script.google.com/macros/s/AKfycbyE7sl55i4q5RYcyacG13y6GDu1vf_eR2_1vUKKq-oSculAtpdYgr6rTJ73kMLWkRth/exec',q=new URLSearchParams(l.search),b,k,x='',s,go;
window.VNA_API=A;window.vnaTrack=function(){};
if(n.doNotTrack=='1'||n.globalPrivacyControl||['outils.vread.fr','vendanoazul.github.io'].indexOf(l.hostname)<0)return;
// Not a visit (counted apart, by reason): our tests (?octave_notrack=1, remembered here; =0 clears), automated browsers, crawlers. The user agent is read here, never sent.
try{s=localStorage;if(q.has('octave_notrack'))q.get('octave_notrack')=='1'?s.setItem('octave_notrack','1'):s.removeItem('octave_notrack');if(s.getItem('octave_notrack')=='1')x='notrack'}catch(e){}
if(!x&&q.get('octave_notrack')=='1')x='notrack';
if(!x&&n.webdriver)x='webdriver';
if(!x&&/bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|googleother|mediapartners|bingpreview|phantom|puppeteer|playwright|selenium/i.test(n.userAgent||''))x='bot';
window.VNA_EXCLUDED=x;
b={action:'track',v:2,page:l.pathname,ref_domain:d.referrer.split('/')[2]||'',device:innerWidth<768?'mobile':'desktop'};
if(x)b.excluded=x;
for(k of['source','medium','campaign'])b['utm_'+k]=q.get('utm_'+k);
window.vnaTrack=function(e){b.event=e;b.ts=Date.now();try{fetch(A+'?action=track',{method:'POST',keepalive:!0,credentials:'omit',redirect:'manual',body:JSON.stringify(b)}).catch(function(){})}catch(x){}};
// A prerendered or prefetched page is counted only once the visitor actually opens it.
go=function(){window.vnaTrack('view')};
if(d.prerendering)d.addEventListener('prerenderingchange',go,{once:!0});
else if(d.visibilityState=='prerender')d.addEventListener('visibilitychange',function v(){if(d.visibilityState!='prerender'){d.removeEventListener('visibilitychange',v);go()}});
else go()})(navigator,location,document);
