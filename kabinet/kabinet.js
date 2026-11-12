(function(){
var K=window.KAB,EV=K.EVENTS,$=function(q){return document.querySelector(q)};
function h(tag,props){
  var el=document.createElement(tag);
  if(props){Object.keys(props).forEach(function(k){var v=props[k];if(v==null||v===false)return;
    if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k==='html')el.innerHTML=v;
    else if(k==='value')el.value=v;else if(k.slice(0,2)==='on')el.addEventListener(k.slice(2),v);
    else el.setAttribute(k,v===true?'':v)})}
  for(var i=2;i<arguments.length;i++){[].concat(arguments[i]).forEach(function(c){if(c==null||c===false)return;el.append(c.nodeType?c:document.createTextNode(c))})}
  return el;
}
var tt;function toast(m){var e=$('#toast');e.textContent=m;e.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){e.classList.remove('show')},3200)}
var I={check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',play:'<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>',slides:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',save:'<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',quiz:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 8.5 1.4 1.4L12 7.3M8 15l1.4 1.4L12 13.8M14.5 9h2.5M14.5 15.5H17"/>'};
function ico(n){return h('span',{class:'ico',html:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[n]+'</svg>'})}
function first(n){return String(n||'').split(' ')[0]}
var TAGS=[['🎯','Было полезно'],['💡','Интересная тема'],['🔁','Хочу ещё такое'],['🛠','Возьму в работу'],['✨','Много идей']];
var REACT=[['👍','Класс'],['🔥','Огонь'],['💡','Интересная тема'],['🙏','Спасибо']];
function evById(id){return EV.filter(function(e){return e.id===id})[0]}
function need(n){return Math.max(1,Math.ceil(n*K.NEED_PERCENT-1e-9))}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}

/* ---------- состояние ---------- */
var S={screen:'boot',user:null,prog:{},qs:[],token:'',quiz:{},zoom:'',open:{},draft:{},ask:null,msg:'',busy:false,form:false,formErr:''};
function pr(id){return S.prog[id]||{mat:'',test:null,certName:'',cert:'',hMat:'',hCert:'',tags:[],review:''}}

/* ---------- связь с сервером ---------- */
var demo={user:{name:'Анна Беляева',email:'demo@example.ru'},prog:{},qs:[]};
function mockApi(b){
  var p=demo.prog[b.ev]=demo.prog[b.ev]||{mat:'',test:null,certName:'',cert:'',hMat:'',hCert:'',tags:[],review:''};
  if(b.a==='mat')p.mat='sent';
  if(b.a==='test'){var pass=b.score>=need(b.total),was=p.test&&p.test.pass;p.test={score:b.score,total:b.total,pass:!!(pass||was)}}
  if(b.a==='cert'){if(!(p.test&&p.test.pass))return {ok:false,err:'Сначала нужно пройти тест'};p.certName=b.name;p.cert='sent'}
  if(b.a==='heart'){if(b.key==='mat')p.hMat=b.emoji;else p.hCert=b.emoji}
  if(b.a==='review'){p.tags=b.tags||[];p.review=b.text||''}
  if(b.a==='ask')demo.qs.push({id:'q'+demo.qs.length,ev:b.ev,text:b.text,ans:''});
  return {ok:true,user:demo.user,prog:JSON.parse(JSON.stringify(demo.prog)),qs:JSON.parse(JSON.stringify(demo.qs))};
}
function api(body){
  if(!K.API) return new Promise(function(r){setTimeout(function(){r(mockApi(body))},150)});
  return fetch(K.API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)})
    .then(function(r){return r.json()}).catch(function(){return {ok:false,err:'Нет связи с сервером. Попробуйте ещё раз.'}});
}
function act(body){
  body.t=S.token;if(S.busy)return Promise.resolve();S.busy=true;
  return api(body).then(function(r){S.busy=false;
    if(!r.ok){if(r.err==='auth'){logout();toast('Сессия закончилась, войдите заново');return}toast(r.err||'Не получилось');render();return r}
    S.user=r.user;S.prog=r.prog||{};S.qs=r.qs||[];render();return r});
}
function logout(){try{localStorage.removeItem('rki_kab')}catch(e){}S.token='';S.user=null;S.screen='login';render()}
function boot(){
  var t='';try{t=new URLSearchParams(location.search).get('t')||''}catch(e){}
  var fromLink=!!t;
  if(!t){try{var j=JSON.parse(localStorage.getItem('rki_kab')||'null');if(j&&j.exp>Date.now())t=j.t}catch(e){}}
  if(!t&&!K.API){t='demo'}
  if(!t){S.screen='login';render();return}
  S.token=t;
  api({a:'me',t:t}).then(function(r){
    if(!r.ok){S.token='';S.screen='login';if(fromLink)S.msg='Ссылка устарела или неверна. Запросите новую по почте.';render();return}
    S.user=r.user;S.prog=r.prog||{};S.qs=r.qs||[];S.screen='cab';
    try{localStorage.setItem('rki_kab',JSON.stringify({t:t,exp:Date.now()+30*864e5}))}catch(e){}
    if(fromLink){try{history.replaceState(null,'',location.pathname)}catch(e){}}
    render();
  });
}

/* ---------- сертификат ---------- */
var tpl={};
function loadTpl(src){return tpl[src]||(tpl[src]=new Promise(function(res,rej){var i=new Image();i.onload=function(){res(i)};i.onerror=rej;i.src=src}))}
async function buildCert(ev,name,real){
  var c0=ev.cert,img=await loadTpl(c0.src),W=img.naturalWidth,H=img.naturalHeight,k=W/c0.refW,p=c0.pill;
  var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.drawImage(img,0,0);
  var px=p[0]*k,py=p[1]*k,pw=(p[2]-p[0])*k,ph=(p[3]-p[1])*k,cy=py+ph/2+2*k;
  if(c0.cover){
    var L=x.getImageData(Math.round(px),Math.round(py+ph/2),1,1).data,R=x.getImageData(Math.round(px+pw-1),Math.round(py+ph/2),1,1).data;
    var g=x.createLinearGradient(px-8*k,0,px+pw+8*k,0);g.addColorStop(0,'rgb('+L[0]+','+L[1]+','+L[2]+')');g.addColorStop(1,'rgb('+R[0]+','+R[1]+','+R[2]+')');
    x.fillStyle=g;x.fillRect(px,py,pw,ph);
  }
  var txt=real?String(name||'').toUpperCase():'ВАШЕ ИМЯ И ФАМИЛИЯ',size=(real?c0.size:c0.size*.75)*k;
  x.textAlign='center';x.textBaseline='middle';
  for(var i=0;i<30;i++){x.font='700 '+Math.round(size)+'px Georgia,"Times New Roman",serif';if(x.measureText(txt).width<=pw*.92)break;size*=.94}
  x.fillStyle=real?c0.color:'#A8996B';x.fillText(txt,px+pw/2,cy);
  return c;
}
var cimg={};
function certImg(ev,name,real,cls){
  var key=ev.id+'|'+(real?name:'')+'|'+real,hit=cimg[key];
  if(hit&&hit!=='wait')return h('img',{class:cls,src:hit,alt:'Сертификат'});
  if(!hit){cimg[key]='wait';buildCert(ev,name,real).then(function(c){cimg[key]=c.toDataURL('image/jpeg',.9);render()}).catch(function(){cimg[key]=ev.cert.src;render()})}
  return h('div',{class:cls+' skel'});
}
function saveCert(ev,name){
  buildCert(ev,name,true).then(function(c){c.toBlob(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='certificate-'+ev.id+'.png';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)},'image/png')}).catch(function(){toast('Не получилось сохранить')});
}

/* ---------- каркас ---------- */
function render(){
  var app=$('#app'),y=window.scrollY;
  var brand=h('div',{class:'brand'},h('svg',{viewBox:'0 0 28 28','aria-hidden':'true',html:'<defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--g1)"/><stop offset="1" stop-color="var(--g2)"/></linearGradient></defs><rect x="1" y="3" width="26" height="24" rx="8" fill="url(#bg1)"/><rect x="7.5" y="0.8" width="3" height="6" rx="1.5" fill="var(--ink)"/><rect x="17.5" y="0.8" width="3" height="6" rx="1.5" fill="var(--ink)"/><path d="M8.5 16.5l3.6 3.6 7.4-7.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'}),
    h('span',{class:'wm'},h('b',{text:'Календарь'}),' ',h('em',{text:'РКИ'})),h('span',{class:'cab',html:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/></svg>Мой кабинет<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6L9.5 22l10-12.5h-6.5z"/></svg>'}));
  var right=h('div',{class:'top-r'},h('a',{class:'btn btn-quiet btn-sm',href:'/'},'← Календарь'),S.user?h('button',{type:'button',class:'btn btn-quiet btn-sm',onclick:logout},'Выйти'):null);
  var kids=[h('div',{class:'top'},h('a',{href:'/',style:'text-decoration:none;color:inherit'},brand),right)];
  if(!K.API)kids.push(h('p',{class:'proto-note',text:'Демо-режим: сервер ещё не подключён, данные не сохраняются.'}));
  if(S.screen==='boot')kids.push(h('p',{class:'lead',text:'Загружаем…'}));
  else if(S.screen==='login')kids.push(loginV());
  else if(S.screen==='sent')kids.push(sentV());
  else kids.push(cabV());
  var m=null;if(S.screen==='cab'){kids.push(h('button',{type:'button',class:'fab',onclick:function(){S.ask={ev:EV[0].id,text:''};render()}},'💬 Вопрос организатору'));if(S.ask)kids.push(askV())}
  app.replaceChildren.apply(app,kids);window.scrollTo(0,y);
}

/* ---------- вход ---------- */
function loginV(){
  var inE=h('input',{type:'email',id:'l-e',placeholder:'name@example.ru',autocomplete:'email'}),err=h('div',{class:'err',text:S.msg});
  function submit(){
    var e=inE.value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){S.msg='Проверьте адрес почты';render();return}
    S.busy=true;api({a:'link',email:e}).then(function(r){S.busy=false;if(r.ok){S.msg='';S.sentTo=e;S.screen='sent'}else S.msg=r.err||'Не получилось';render()});
  }
  inE.addEventListener('keydown',function(ev){if(ev.key==='Enter')submit()});
  var form=S.form?reqV():null;
  return h('div',{class:'loginbox'},h('h1',{class:'ptitle',text:'Вход в кабинет'}),h('p',{class:'lead',text:'Введите почту, пришлём ссылку для входа. Пароль не нужен.'}),
    h('div',{class:'fld'},h('label',{for:'l-e',text:'Почта'}),inE),err,
    h('button',{type:'button',class:'btn btn-primary',style:'min-height:46px',onclick:submit},'Прислать ссылку'),
    h('p',{class:'help'},'Не были на мастер-классе и хотите посмотреть запись? ',h('button',{type:'button',class:'link',onclick:function(){S.form=true;S.formErr='';render()}},'Оставить заявку')),form);
}
function reqV(){
  var inN=h('input',{type:'text',id:'f-n',placeholder:'Как вас зовут',autocomplete:'name'}),inE=h('input',{type:'email',id:'f-e',placeholder:'name@example.ru',autocomplete:'email'}),ck=h('input',{type:'checkbox',id:'f-c'}),err=h('div',{class:'err',text:S.formErr});
  function submit(){
    var n=inN.value.trim(),e=inE.value.trim().toLowerCase();
    if(n.length<2){err.textContent='Напишите имя';return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){err.textContent='Проверьте адрес почты';return}
    if(!ck.checked){err.textContent='Нужно согласие на получение писем';return}
    S.busy=true;api({a:'request',name:n,email:e,consent:true}).then(function(r){S.busy=false;if(r.ok){S.form=false;S.sentTo=e;S.screen='sent'}else{S.formErr=r.err||'Не получилось';}render()});
  }
  return h('div',{class:'modal-bg',onclick:function(e){if(e.target===e.currentTarget){S.form=false;render()}}},
    h('div',{class:'modal',role:'dialog','aria-label':'Получить запись'},h('h3',{text:'Куда отправить ссылку?'}),
      h('div',{class:'fld'},h('label',{for:'f-n',text:'Имя'}),inN),h('div',{class:'fld'},h('label',{for:'f-e',text:'Почта'}),inE),
      h('label',{class:'chk'},ck,h('span',{text:'Согласен(на) получать письма от Календаря РКИ и на обработку данных'})),err,
      h('button',{type:'button',class:'btn btn-primary',style:'min-height:46px',onclick:submit},'Получить ссылку'),
      h('button',{type:'button',class:'back',onclick:function(){S.form=false;render()}},'Отмена')));
}
function sentV(){
  return h('div',{class:'centerbox'},h('span',{class:'big',text:'📬'}),h('h1',{class:'ptitle',text:'Проверьте почту'}),
    h('p',{class:'lead',text:'Если адрес '+S.sentTo+' есть у нас, туда придёт ссылка для входа. Загляните и в «Спам».'}),
    h('button',{type:'button',class:'back',onclick:function(){S.screen='login';render()}},'← Назад'));
}

/* ---------- кабинет ---------- */
function rowShell(o){
  var dot=h('div',{class:'s-num'},h('span',{class:'s-dot'},o.tone==='done'?ico('check'):String(o.no)),h('i',{class:'s-line'}));
  var pill=o.status?h('span',{class:'s-pill p-'+o.tone,text:o.status}):null;
  return h('div',{class:'step t-'+o.tone+(o.zoomed?' zoom':'')},dot,h('div',{class:'s-card'},h('div',{class:'s-text'},h('div',{class:'s-title'},h('span',{class:'s-emoji',text:o.emoji}),h('b',{text:o.title}),pill),h('p',{class:'s-hint',text:o.hint})),o.R));
}
function heartBox(ev,key){
  var p=pr(ev.id),cur=key==='mat'?p.hMat:p.hCert;
  if(cur)return h('div',{class:'react done'},h('span',{class:'react-em',text:cur}),h('span',{class:'react-t',text:'Спасибо · организатор узнал'}));
  function like(em){act({a:'heart',ev:ev.id,key:key,emoji:em})}
  var row=h('div',{class:'stk-row'});
  REACT.forEach(function(x,i){row.append(h('button',{type:'button',class:'stk c'+(i+1),onclick:function(){like(x[0])}},h('span',{class:'stk-e',text:x[0]}),h('span',{class:'stk-l',text:x[1]})))});
  return h('div',{class:'react'},h('button',{type:'button',class:'heart-btn',onclick:function(){like('❤️')}},h('span',{class:'heart-e',text:'❤️'}),h('span',{class:'heart-t'},h('b',{text:'Получил(а), спасибо!'}),h('small',{text:'Нажмите, чтобы организатор узнал'}))),row);
}
function linkBtn(url,cls,icon,label,dl){
  if(!url)return h('span',{class:'btn btn-quiet btn-sm dis','aria-disabled':'true'},icon,label+' · скоро');
  return h('a',{class:cls,href:url,target:'_blank',rel:'noopener'},icon,label);
}
function matRow(ev){
  var p=pr(ev.id),tone,status='',hint,R=h('div',{class:'m-right'});
  if((ev.recordingUrl||ev.presentationUrl)&&p.mat!=='sent'){
    /* материалы выдаются сразу, без запроса; факт открытия тихо фиксируем один раз */
    S.am=S.am||{};
    if(!p.mat&&!S.am[ev.id]&&S.token){S.am[ev.id]=1;setTimeout(function(){act({a:'mat',ev:ev.id})},0)}
    tone='done';status='Готово';hint='Запись и презентация открыты.';
    R.append(h('div',{class:'m-actions'},linkBtn(ev.recordingUrl,'btn btn-primary btn-sm',ico('play'),'Смотреть запись'),linkBtn(ev.presentationUrl,'btn btn-quiet btn-sm',ico('save'),'Скачать презентацию')),heartBox(ev,'mat'));
    return rowShell({no:1,emoji:'🎬',title:'Запись + презентация',tone:tone,status:status,hint:hint,R:R});
  }
  if(!p.mat){tone='todo';hint='Нажмите кнопку, материалы появятся здесь.';R.append(h('button',{type:'button',class:'btn btn-primary',onclick:function(){act({a:'mat',ev:ev.id})}},'Запросить'))}
  else if(p.mat==='req'){tone='wait';status='Запрос отправлен';hint='Материалы появятся здесь.';R.append(h('div',{class:'wait-note'},h('span',{class:'dots'},h('i'),h('i'),h('i')),h('span',{text:'Ждём организатора'})))}
  else{tone='done';status='Готово';hint=p.hMat?'Спасибо!':'Запись и презентация готовы.';
    R.append(h('div',{class:'m-actions'},linkBtn(ev.recordingUrl,'btn btn-primary btn-sm',ico('play'),'Смотреть запись'),linkBtn(ev.presentationUrl,'btn btn-quiet btn-sm',ico('save'),'Скачать презентацию')),heartBox(ev,'mat'))}
  return rowShell({no:1,emoji:'🎬',title:'Запись + презентация',tone:tone,status:status,hint:hint,R:R});
}
function testRow(ev){
  var p=pr(ev.id),q=S.quiz[ev.id],R=h('div',{class:'m-right'}),tone,status='',hint,n=ev.quiz.length,tried=!!p.test;
  if(p.test&&p.test.pass){tone='done';status='Пройден';hint='Тест пройден.';R.append(h('div',{class:'ok-line'},ico('check'),'Тест зачтён: '+p.test.score+' из '+p.test.total))}
  else if(q){
    tone='todo';hint='Выберите один ответ в каждом вопросе.';var qn=q.list[q.i];
    var box=h('div',{class:'quiz'},h('div',{class:'quiz-p'},h('span',{text:'Вопрос '+(q.i+1)+' из '+n}),h('i',null,h('em',{style:'width:'+Math.round(q.i/n*100)+'%'}))),h('b',{class:'quiz-q',text:qn.q}));
    qn.o.forEach(function(o,idx){box.append(h('button',{type:'button',class:'quiz-o',onclick:function(){q.ok+=(o.c?1:0);if(q.i+1<n){q.i++;render()}else{delete S.quiz[ev.id];act({a:'test',ev:ev.id,score:q.ok,total:n}).then(function(r){if(r&&r.ok){var t=pr(ev.id).test;toast(t&&t.pass?'Тест пройден!':'Не хватило баллов ('+q.ok+' из '+n+'), попробуйте ещё раз')}})}}},h('span',{text:String.fromCharCode(65+idx)}),o.t))});
    R.append(box)}
  else{tone='todo';hint=tried?'Не хватило. Попробуйте ещё раз.':'Ответьте на '+Math.round(K.NEED_PERCENT*100)+'% вопросов, чтобы получить сертификат.';
    R.append(h('button',{type:'button',class:'btn btn-primary',onclick:function(){S.quiz[ev.id]={i:0,ok:0,list:shuffle(ev.quiz).map(function(x){return {q:x.q,o:shuffle(x.o.map(function(t,i){return {t:t,c:i===x.c}}))}}).map(function(x){return {q:x.q,o:x.o}})};render()}},tried?'Пройти ещё раз':'Пройти тест'))}
  return rowShell({no:2,emoji:'📝',title:'Тестирование',tone:tone,status:status,hint:hint,R:R});
}
function certRow(ev){
  var p=pr(ev.id),R=h('div',{class:'m-right'}),tone,status='',hint,zoomed=false,passed=p.test&&p.test.pass;
  if(!passed){tone='lock';status='После теста';hint='Здесь появится сертификат после теста.';R.append(h('span',{class:'item-sub lock'},ico('quiz'),'Сначала тест'))}
  else if(!p.certName){
    tone='todo';hint='Как написать ваше имя в сертификате?';
    var inp=h('input',{type:'text',placeholder:'Фамилия Имя Отчество',value:S.user.name||'','aria-label':'Имя в сертификате'});
    R.append(h('div',{class:'namebox'},h('div',{class:'fld'},inp),h('span',{class:'nameprev',text:'Проверьте написание: исправить потом можно только через организатора.'}),h('button',{type:'button',class:'btn btn-primary',onclick:function(){var v=inp.value.trim().replace(/\s+/g,' ');if(v.length<3){toast('Напишите имя полностью');return}act({a:'cert',ev:ev.id,name:v})}},'Получить сертификат')))}
  else if(p.cert==='req'){tone='wait';status='Готовится';hint='Здесь появится сертификат в течение дня.';
    R.append(h('div',{class:'wait-note'},h('span',{class:'dots'},h('i'),h('i'),h('i')),h('span',{text:'Готовим сертификат'})),h('p',{class:'help'},'Не появился за день? Напишите на '+K.CONTACT_EMAIL+'.'))}
  else{tone='done';status='Готово';hint=p.hCert?'Спасибо!':'Сертификат готов.';zoomed=S.zoom===ev.id;
    var cb=h('button',{type:'button',class:'cert-btn','aria-label':'Показать сертификат крупно',onclick:function(){S.zoom=zoomed?'':ev.id;render()}});cb.append(certImg(ev,p.certName,true,'cert-img'));
    R.append(h('div',{class:'m-actions'},cb,h('button',{type:'button',class:'btn btn-primary btn-sm',onclick:function(){saveCert(ev,p.certName)}},ico('save'),'Сохранить')),heartBox(ev,'cert'))}
  return rowShell({no:3,emoji:'🏆',title:'Сертификат',tone:tone,status:status,hint:hint,R:R,zoomed:zoomed});
}
function reviewBox(ev){
  var p=pr(ev.id),d=S.draft[ev.id]=S.draft[ev.id]||{tags:[],text:''},open=!!S.open[ev.id];
  if(p.review||(p.tags&&p.tags.length))return h('div',{class:'review done'},h('div',{class:'rv-done-h'},h('b',{text:'Отправлено. Спасибо!'})),p.tags.length?h('div',{class:'tagrow'},p.tags.map(function(t){return h('span',{class:'tag-on',text:t})})):null,p.review?h('p',{class:'rv-quote',text:'«'+p.review+'»'}):null);
  if(!open)return h('div',{class:'review closed'},h('button',{type:'button',class:'rv-bar',onclick:function(){S.open[ev.id]=true;render()}},h('span',{class:'rv-ico',text:'💬'}),h('span',{class:'rv-bt'},h('b',{text:'Как вам мастер-класс?'}),h('small',{text:d.tags.length?'Выбрано: '+d.tags.length:'Стикеры и пара слов'})),h('span',{class:'chev',text:'⌄'})));
  var tags=h('div',{class:'tagrow'});
  TAGS.forEach(function(x){var on=d.tags.indexOf(x[1])>=0;tags.append(h('button',{type:'button',class:'tag-btn'+(on?' on':''),onclick:function(){var i=d.tags.indexOf(x[1]);if(i>=0)d.tags.splice(i,1);else d.tags.push(x[1]);render()}},h('span',{text:x[0]}),x[1]))});
  var ta=h('textarea',{class:'rv-text',rows:'2',maxlength:'600',placeholder:'Пожелание или идея (необязательно)',oninput:function(){d.text=ta.value}});ta.value=d.text;
  return h('div',{class:'review'},h('button',{type:'button',class:'rv-bar',onclick:function(){S.open[ev.id]=false;render()}},h('span',{class:'rv-ico',text:'💬'}),h('span',{class:'rv-bt'},h('b',{text:'Как вам мастер-класс?'}),h('small',{text:'Выберите стикеры, можно добавить пару слов'})),h('span',{class:'chev up',text:'⌄'})),tags,ta,
    h('div',{class:'rv-send'},h('button',{type:'button',class:'btn btn-primary btn-sm',onclick:function(){if(!d.tags.length&&!d.text.trim()){toast('Выберите стикер или напишите пару слов');return}act({a:'review',ev:ev.id,tags:d.tags,text:d.text.trim()}).then(function(){toast('Отправлено, спасибо!')})}},'Отправить')));
}
function evCard(ev){
  var p=pr(ev.id),got=p.cert==='sent'&&p.certName;
  var info=h('div',{class:'ev-info'},h('div',{class:'d-big'},h('b',{text:ev.day}),h('span',{text:ev.month})),h('div',{class:'d-sub',text:ev.weekday}),h('h3',{text:ev.title}),h('p',{class:'d-rest',text:ev.sub}),h('p',{class:'meta',text:ev.host}));
  var head=h('div',{class:'ev-head has-ban'+(ev.poster?' has-pic':'')},ev.poster?h('img',{class:'ev-poster',src:ev.poster,alt:'Афиша'}):null,info,h('div',{class:'ev-cert'},certImg(ev,got?p.certName:'',!!got,'ev-cert-img')));
  return h('article',{class:'ev'},head,h('div',{class:'mrows'},matRow(ev),testRow(ev),certRow(ev)),reviewBox(ev));
}

/* ---------- достижения ---------- */
var MI={
play:'<path d="M10 8.5v7l6-3.5z" fill="{c}"/>',
check:'<path d="M7.5 12.5l3 3 6-7" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
cert:'<circle cx="12" cy="10.5" r="3.6" fill="none" stroke="{c}" stroke-width="2"/><path d="M10 14l-1 5 3-1.6L15 19l-1-5" fill="none" stroke="{c}" stroke-width="1.8" stroke-linejoin="round"/>',
star:'<path d="M12 6.2l1.8 3.7 4 .5-2.9 2.8.8 4-3.7-2-3.7 2 .8-4-2.9-2.8 4-.5z" fill="{c}"/>',
heart:'<path d="M12 18s-5.5-3.4-5.5-7.1A3 3 0 0 1 12 9.4a3 3 0 0 1 5.5 1.5C17.5 14.6 12 18 12 18z" fill="{c}"/>',
chat:'<path d="M7 7.5h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5l-3 2.5v-2.5H7A1.5 1.5 0 0 1 5.5 14V9A1.5 1.5 0 0 1 7 7.5z" fill="none" stroke="{c}" stroke-width="1.9" stroke-linejoin="round"/>',
ask:'<path d="M9.6 9.8a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1 .8-1 1.6" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.1" fill="{c}"/>',
cup:'<path d="M8 6.5h8v3.5a4 4 0 0 1-8 0zM8 8H5.5c0 2 1 3 2.6 3.2M16 8h2.5c0 2-1 3-2.6 3.2M12 14v2.6M9 18h6" fill="none" stroke="{c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'};
var MT={bronze:['#F0B98A','#B8703A','#7A4519'],silver:['#F1F3FA','#B5BBD3','#6D7498'],gold:['#FBE6A8','#E3C27A','#A57A18'],violet:['#B9A8FF','#5A3FE0','#2F1C9A']};
var mu=0;
function medalSvg(tier,ic,on,size){
  var u='m'+(mu++),t=MT[tier],s;
  if(on)s='<defs><linearGradient id="'+u+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+t[0]+'"/><stop offset="1" stop-color="'+t[1]+'"/></linearGradient></defs><path d="M17 2h8l5 14h-8zM47 2h-8l-5 14h8z" fill="#5A3FE0" opacity=".9"/><circle cx="32" cy="38" r="22" fill="url(#'+u+')" stroke="'+t[2]+'" stroke-width="2"/><circle cx="32" cy="38" r="17" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/><g transform="translate(20 26)">'+MI[ic].replace(/\{c\}/g,t[2])+'</g>';
  else s='<path d="M17 2h8l5 14h-8zM47 2h-8l-5 14h8z" fill="#CFCBC0"/><circle cx="32" cy="38" r="22" fill="#ECE8DE" stroke="#BDB8AB" stroke-width="2" stroke-dasharray="4 4"/><g transform="translate(20 26)" opacity=".55">'+MI[ic].replace(/\{c\}/g,'#8A8676')+'</g>';
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 64 64" aria-hidden="true">'+s+'</svg>';
}
function medals(){
  var ps=EV.map(function(e){return pr(e.id)});
  function any(f){return ps.some(f)}
  return [
    {k:'first',t:'bronze',i:'play',n:'Первый эфир',how:'Откройте запись любого эфира.',on:any(function(p){return !!p.mat})},
    {k:'know',t:'silver',i:'check',n:'Знаток',how:'Сдайте любой тест на 60% и выше.',on:any(function(p){return p.test&&p.test.pass})},
    {k:'cert',t:'gold',i:'cert',n:'Сертификат',how:'Пройдите тест и получите сертификат.',on:any(function(p){return p.cert==='sent'&&p.certName})},
    {k:'top',t:'gold',i:'star',n:'Отличник',how:'Ответьте на все вопросы теста правильно.',on:any(function(p){return p.test&&p.test.total&&p.test.score===p.test.total})},
    {k:'thx',t:'violet',i:'heart',n:'Благодарный',how:'Нажмите «Получил(а), спасибо!» под записью или сертификатом.',on:any(function(p){return !!(p.hMat||p.hCert)})},
    {k:'voice',t:'silver',i:'chat',n:'Голос',how:'Оставьте отзыв о мастер-классе: стикеры или пара слов.',on:any(function(p){return (p.tags&&p.tags.length)||p.review})},
    {k:'ask',t:'bronze',i:'ask',n:'Любопытный',how:'Задайте вопрос организатору кнопкой внизу справа.',on:S.qs.length>0},
    {k:'cup',t:'gold',i:'cup',n:'Кубок сезона',how:'Получите сертификаты за все мастер-классы, которые уже прошли.',on:EV.length>1&&ps.every(function(p){return p.cert==='sent'&&p.certName})}
  ];
}
function achV(){
  var M=medals(),got=M.filter(function(m){return m.on}),open=!!S.achOpen,sel=M.filter(function(m){return m.k===S.achSel})[0];
  var bar=h('button',{type:'button',class:'ach-bar'+(open?' open':''),'aria-expanded':open?'true':'false',onclick:function(){S.achOpen=!S.achOpen;render()}},
    h('span',{class:'ach-mini',html:M.slice(0,3).map(function(m){return medalSvg(m.t,m.i,m.on,30)}).join('')}),
    h('span',{class:'ach-bt'},h('b',{text:'Мои достижения'}),h('small',{text:got.length+' из '+M.length+' · нажмите, что можно получить'})),
    h('span',{class:'ach-chev',text:'⌄'}));
  var box=h('div',{class:'ach'},bar);
  if(open){
    var pc=Math.round(got.length/M.length*100),grid=h('div',{class:'ach-grid'});
    M.forEach(function(m){grid.append(h('button',{type:'button',class:'ach-m'+(m.on?' on':' off')+(m.k===S.achSel?' sel':''),onclick:function(){S.achSel=S.achSel===m.k?'':m.k;render()}},h('span',{html:medalSvg(m.t,m.i,m.on,64)}),h('b',{text:m.n}),h('small',{text:m.on?'получено':'как получить'})))});
    var panel=h('div',{class:'ach-panel'},h('div',{class:'ach-top'},h('b',{text:'Собрано '+got.length+' из '+M.length}),h('span',{text:'осталось '+(M.length-got.length)})),h('div',{class:'ach-prog'},h('i',{style:'width:'+pc+'%'})),grid);
    if(sel)panel.append(h('div',{class:'ach-det'},h('span',{html:medalSvg(sel.t,sel.i,sel.on,56)}),h('div',null,h('b',{text:sel.n}),h('p',{text:sel.on?'Получено. Так держать!':sel.how}))));
    box.append(panel);
  }
  return box;
}
function cabV(){
  var out=h('div',{class:'cabwrap'},h('div',{class:'hello'},h('div',null,h('h1',{text:'Здравствуйте, '+first(S.user.name)}),h('p',{class:'muted',text:'Три простых шага до сертификата.'})),h('div',{class:'who-chip'},h('span',{text:S.user.name}),h('code',{text:S.user.email}))));
  var mine=S.qs;if(mine.length)out.append(h('div',{class:'myq'},mine.map(function(q){return h('div',{class:'mq'},h('small',{text:'Ваш вопрос'}),h('p',{text:q.text}),q.ans?h('div',{class:'ans'},h('b',{text:'Ответ организатора'}),h('p',{text:q.ans})):h('small',{class:'wt',text:'Организатор ответит на почту и здесь'}))})));
  out.append(achV());
  EV.forEach(function(ev){out.append(evCard(ev))});
  return out;
}
function stepNo(ev){var p=pr(ev.id);return p.mat!=='sent'?1:(!(p.test&&p.test.pass)?2:3)}
function askV(){
  var a=S.ask,sel=h('select',{'aria-label':'О каком мастер-классе'},EV.map(function(e){return h('option',{value:e.id,text:e.title})})),ta=h('textarea',{class:'rv-text',rows:'4',maxlength:'800',placeholder:'Напишите вопрос, ответим на почту и покажем здесь'});sel.value=a.ev;ta.value=a.text;
  return h('div',{class:'modal-bg',onclick:function(e){if(e.target===e.currentTarget){S.ask=null;render()}}},
    h('div',{class:'modal',role:'dialog','aria-label':'Вопрос организатору'},h('h3',{text:'Вопрос организатору'}),h('p',{class:'m',text:'Ваше имя и почту мы уже знаем.'}),h('div',{class:'fld'},sel),ta,
      h('button',{type:'button',class:'btn btn-primary',style:'min-height:46px;margin-top:10px',onclick:function(){var t=ta.value.trim();if(t.length<3){toast('Напишите вопрос');return}var e=evById(sel.value);S.ask=null;act({a:'ask',ev:e.id,step:stepNo(e),text:t}).then(function(r){if(r&&r.ok)toast('Вопрос отправлен')})}},'Отправить'),
      h('button',{type:'button',class:'back',onclick:function(){S.ask=null;render()}},'Отмена')));
}
boot();
})();
