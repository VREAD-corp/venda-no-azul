/*! Venda no Azul: contagem anônima. Sem cookie, sem identificador, sem IP guardado; respeita Do Not Track e GPC. */
((n,l,d)=>{var A='https://script.google.com/macros/s/AKfycbyE7sl55i4q5RYcyacG13y6GDu1vf_eR2_1vUKKq-oSculAtpdYgr6rTJ73kMLWkRth/exec',q=new URLSearchParams(l.search),b,k;
window.VNA_API=A;window.vnaTrack=function(){};
if(n.doNotTrack=='1'||n.globalPrivacyControl||['outils.vread.fr','vendanoazul.github.io'].indexOf(l.hostname)<0)return;
b={action:'track',page:l.pathname,ref_domain:d.referrer.split('/')[2]||'',device:innerWidth<768?'mobile':'desktop'};
for(k of['source','medium','campaign'])b['utm_'+k]=q.get('utm_'+k);
window.vnaTrack=function(e){b.event=e;b.ts=Date.now();try{fetch(A+'?action=track',{method:'POST',keepalive:!0,credentials:'omit',redirect:'manual',body:JSON.stringify(b)}).catch(function(){})}catch(x){}};
window.vnaTrack('view')})(navigator,location,document);
