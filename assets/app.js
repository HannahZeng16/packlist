/* 出行清单 —— 浏览为主线，打勾为附加。数据全在本机 localStorage。 */
'use strict';
const LS='travelkit.v1', SNAP='travelkit.snap';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let TREE=[], ITEMS=[], BYID={}, SUB={}, TOP={};
let S={dep:'2026-11-01', own:{},buy:{},pack:{},done:{},chk:{},star:{},top:{},del:{},note:{},open:{},hide:{}};
let V={v:'home'};
let storageOK=true;

/* ───────── 存储 ───────── */
function save(){
  try{ localStorage.setItem(LS,JSON.stringify(S)); storageOK=true; }
  catch(e){ storageOK=false; toast('存不进去了，可能是无痕模式'); }
}
function load(){
  let raw=null;
  try{ raw=localStorage.getItem(LS); }catch(e){ storageOK=false; }
  if(raw){ try{ Object.assign(S,JSON.parse(raw)); }catch(e){} }
  for(const k of ['own','buy','pack','done','chk','star','top','del','note','open','hide'])
    if(!S[k]||typeof S[k]!=='object') S[k]={};
}
/* 自动快照：每次改动存一份，留最近 10 份，数据乱了能回滚 */
function snapshot(){
  try{
    const a=JSON.parse(localStorage.getItem(SNAP)||'[]');
    const last=a[a.length-1];
    const now=Date.now(), body=JSON.stringify(S);
    if(last && now-last.t < 180000){ a[a.length-1]={t:now,d:body}; }
    else a.push({t:now,d:body});
    localStorage.setItem(SNAP, JSON.stringify(a.slice(-10)));
  }catch(e){}
}
let snapTimer=null;
function commit(){ save(); clearTimeout(snapTimer); snapTimer=setTimeout(snapshot,1200); }

/* ───────── 日期 ───────── */
const today=()=>{const d=new Date(); d.setHours(0,0,0,0); return d;};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function daysLeft(){
  const p=(S.dep||'').split('-'); if(p.length!==3) return null;
  const d=new Date(+p[0],+p[1]-1,+p[2]); d.setHours(0,0,0,0);
  return Math.round((d-today())/864e5);
}

/* ───────── 条目查询 ───────── */
const live=()=>ITEMS.filter(i=>!S.del[i.id]);
const inSub=p=>live().filter(i=>i.p===p);
const inTop=t=>live().filter(i=>i.p.split('.')[0]===t);
const isGoods=i=>i.kind==='buy';
const gotIt=i=>!!(S.buy[i.id]||S.own[i.id]);          // 买了 或 家里有
/* 能装箱 = 是个实体东西（有 carry）且不是到当地才买的。
   跟「要不要买」无关 —— 护照不是买的，但必须装进随身包。 */
const packable=i=>!!i.carry && i.where!=='sg';
/* 准备好了没：要买的看买没买，要办的看办没办 */
const ready=i=>i.kind==='buy' ? gotIt(i) : !!S.done[i.id];

function stats(){
  const L=live();
  const shopAll=L.filter(isGoods), shopOK=shopAll.filter(gotIt);
  const packAll=L.filter(packable), packOK=packAll.filter(i=>S.pack[i.id]);
  const doAll=L.filter(i=>i.kind==='do'), doOK=doAll.filter(i=>S.done[i.id]);
  return {
    shop:[shopOK.length,shopAll.length], pack:[packOK.length,packAll.length],
    todo:[doOK.length,doAll.length],
    notReady: packAll.filter(i=>!ready(i)).length
  };
}
const pct=([a,b])=>b?Math.round(a/b*100):0;

/* ───────── 渲染入口 ───────── */
function render(){
  const app=$('#app'); let title='出行清单', left='', right='';
  if(V.v==='home'){ app.innerHTML=vHome(); }
  else if(V.v==='list'){
    if(V.c){ title=TOP[V.c]?TOP[V.c].n:''; left='<button class="back" data-act="back">‹ 返回</button>'; }
    else title='清单';
    app.innerHTML=vList();
  }
  else if(V.v==='me'){ title='我的'; app.innerHTML=vMe(); }
  $('#ttl').innerHTML=esc(title);
  $('#tleft').innerHTML=left; $('#tright').innerHTML=right;
  $$('.tabbar button').forEach(b=>b.setAttribute('aria-selected', b.dataset.go===V.v));
  window.scrollTo(0, V.keepScroll||0); V.keepScroll=0;
}
function go(v){ V=Object.assign({},v); history.pushState(V,'',hashOf(V)); render(); }
function hashOf(v){
  if(v.v==='home') return '#/';
  let h='#/'+v.v;
  if(v.m&&v.m!=='browse') h+='/'+v.m;
  if(v.c) h+='/'+v.c;
  return h;
}
function fromHash(){
  const p=(location.hash||'').replace(/^#\/?/,'').split('/').filter(Boolean);
  if(!p.length) return {v:'home'};
  const v={v:p[0]};
  if(p[0]==='list'){
    if(p[1]&&['shop','pack','todo'].includes(p[1])) v.m=p[1];
    else if(p[1]){ v.m='browse'; v.c=p[1]; }
    if(p[2]) v.c=p[2];
  }
  return v;
}

/* ───────── 首页 ───────── */
function vHome(){
  const st=stats(), d=daysLeft();
  let h='<div class="wrap">';
  if(!storageOK) h+='<div class="alert"><span>⚠️</span><div>这个浏览器存不了数据（无痕模式？），勾了会丢。换普通模式打开。</div></div>';
  if(st.notReady>0 && d!==null && d<=14)
    h+='<div class="alert"><span>⚠️</span><div>还有 <b>'+st.notReady+'</b> 件要带的东西没准备好，离出发只剩 '+d+' 天</div></div>';
  h+='<div class="hero"><div class="lab">距离出发</div>';
  h+= d===null ? '<div class="num">—</div>'
    : d>0 ? '<div class="num">'+d+'<b>天</b></div>'
    : d===0 ? '<div class="num" style="font-size:38px">今天出发</div>'
    : '<div class="num" style="font-size:34px">已出发 '+(-d)+' 天</div>';
  h+='<div class="date">'+esc(S.dep||'未设置')+' <button data-act="setdep">改</button></div></div>';
  const M=[['shop','🛒','购物','把要买的买齐',st.shop],
           ['pack','🧳','打包','对着箱子装，别漏',st.pack],
           ['todo','✅','要办的事','签证、租房、银行',st.todo]];
  M.forEach(([m,ic,nm,sub,n])=>{
    h+='<button class="mode" data-mode="'+m+'"><div class="ic">'+ic+'</div><div class="mid">'
      +'<div class="nm">'+nm+'</div><div class="bar"><i style="width:'+pct(n)+'%"></i></div>'
      +'<div class="n">'+n[0]+' / '+n[1]+' · '+sub+'</div></div><div class="go">›</div></button>';
  });
  h+='<div class="sec">浏览</div>';
  h+='<button class="mode" data-act="browse"><div class="ic">📖</div><div class="mid">'
    +'<div class="nm">全部清单</div><div class="n" style="margin-top:0">'+live().length+' 条，按分类翻，不用勾也能看</div>'
    +'</div><div class="go">›</div></button>';
  h+='</div>';
  return h;
}

/* ───────── 清单 ───────── */
function groupOf(m,key){
  const n=key.replace('m:'+m+':','');
  const g=modeGroups(m).find(x=>x[0]===n);
  return g?g[1]:[];
}
function vList(){
  const m=V.m||'browse';
  if(V.q!=null) return vSearch();
  if(m==='browse' && !V.c) return vCats();
  if(m==='browse') return vCat(V.c);
  return vMode(m);
}
function vCats(){
  let h='<div class="wrap">'+searchBox()+'<div class="grid">';
  TREE.forEach(t=>{
    const all=inTop(t.id); if(!all.length) return;
    const l=all.filter(countable);
    const ok=l.filter(marked).length;
    h+='<button class="cc" data-cat="'+t.id+'"><div class="hd"><span class="ci">'+t.icon+'</span>'
      +'<span class="nm">'+esc(t.n)+'</span></div>'
      +'<div class="bar"><i style="width:'+(l.length?Math.round(ok/l.length*100):0)+'%"></i></div>'
      +'<div class="n">'+ok+' / '+l.length+(all.length>l.length?' <span style="color:var(--faint)">+'+(all.length-l.length)+' 条了解</span>':'')+'</div></button>';
  });
  return h+'</div></div>';
}
/* know 类只是「要知道」，不该出现在任何进度里 —— 既不算分子也不算分母 */
const countable=i=>i.kind!=='know';
function marked(i,mode){
  if(mode==='pack') return !!S.pack[i.id];
  if(mode==='shop') return gotIt(i);
  if(i.kind==='buy')   return !!S.pack[i.id]||gotIt(i);
  if(i.kind==='do')    return !!S.done[i.id];
  if(i.kind==='avoid') return !!S.chk[i.id];
  return false;
}

/* 排序。置顶永远最前；其余按模式：
   购物 —— 已买的沉底   打包 —— 已准备好的提前（购物里勾过的，装箱时就在最前）
   注意：只在 render 时算一次。勾选当下走 refreshRow 局部刷新，位置不动，不跳走。 */
function sortFor(list,mode){
  const rank=i=>{
    if(S.top[i.id]) return 0;
    if(mode==='shop') return gotIt(i)?2:1;
    if(mode==='pack') return ready(i)?1:2;
    return 1;
  };
  return list.map((it,n)=>[rank(it),n,it]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(x=>x[2]);
}

/* 局部刷新：只换那一行 + 更新计数，整页不重排 */
function refreshRow(id,mode){
  const el=document.querySelector('.row[data-id="'+id+'"]');
  if(!el){ render(); return; }
  const box=document.createElement('div');
  box.innerHTML=rowHTML(BYID[id],mode);
  el.replaceWith(box.firstElementChild);
  refreshCounts(mode);
}
function refreshCounts(mode){
  document.querySelectorAll('.grp').forEach(g=>{
    const gc=g.querySelector('.gc'); if(!gc) return;
    let ok=0,tot=0;
    g.querySelectorAll('.row').forEach(r=>{
      const i=BYID[r.dataset.id]; if(!i||!countable(i)) return;
      tot++; if(marked(i,mode)) ok++;
    });
    gc.textContent=ok+'/'+tot;
    const sa=g.querySelector('.gall'); if(sa) sa.textContent = ok===tot&&tot ? '取消' : '全选';
  });
  const hd=document.getElementById('modehint'); if(hd) hd.innerHTML=modeHint(mode);
}

function vCat(cid){
  const t=TOP[cid]; if(!t) return '<div class="empty">找不到这个分类</div>';
  const subs=t.sub.filter(s=>inSub(s.id).length && !S.hide[s.id]);
  const anyOpen=subs.some(s=>isOpen(s.id));
  let h='<div class="wrap">';
  h+='<div class="toolbar"><span class="muted">'+subs.length+' 个分类 · '+inTop(cid).length+' 条</span>'
    +'<button class="tbtn" data-foldall="'+cid+'" data-to="'+(anyOpen?0:1)+'">'
    +(anyOpen?'全部收起':'全部展开')+'</button></div>';
  subs.forEach(s=>{
    const l=sortFor(inSub(s.id)), open=isOpen(s.id);
    const cl=l.filter(countable), ok=cl.filter(i=>marked(i)).length;
    h+='<div class="grp" data-open="'+(open?1:0)+'">'
      +'<div class="gh" data-grp="'+s.id+'"><span class="gx">›</span><span class="gn">'+esc(s.n)+'</span>'
      +'<span class="gc">'+ok+'/'+cl.length+'</span></div>'
      +'<div class="body">'+l.map(i=>rowHTML(i)).join('')+'</div></div>';
  });
  const hid=t.sub.filter(s=>S.hide[s.id]&&inSub(s.id).length);
  if(hid.length) h+='<div class="muted" style="padding:10px 2px">已隐藏 '+hid.length+' 组：'
    +hid.map(s=>'<button data-unhide="'+s.id+'" class="lnk">'+esc(s.n)+'</button>').join('')+'</div>';
  return h+'</div>';
}
/* 分组展开状态。默认值按 key 区分：
   'm:' 开头是模式页的分组 → 默认展开；其余是分类页的二级 → 默认收起。
   渲染和点击事件必须用同一个函数，否则第一次点击会算反。 */
function isOpen(key){
  if(S.open[key]!==undefined) return !!S.open[key];
  return String(key).startsWith('m:');
}

/* 购物 / 打包 / 待办 三个模式 */
function modeHint(m){
  const st=stats();
  if(m==='shop') return '勾过的留在原位不会消失。<b>下次进来</b>才会沉到底部。'
    +(st.shop[0]?' 已买 <b>'+st.shop[0]+'</b> 件。':'');
  if(m==='pack') return '购物里勾过的排在每组最前面。还没准备好的置灰。'
    +(st.notReady?' 还有 <b>'+st.notReady+'</b> 件没买 / 没办好。':' 要带的都齐了。');
  return '签证、租房、银行这些要去办的事。';
}
function modeGroups(m){
  if(m==='shop'){
    const pool=live().filter(isGoods);   /* 全部显示，勾了也不消失 */
    return [['在国内买','cn'],['到了当地买','sg'],['还没定在哪买','']]
      .map(([n,k])=>[n, sortFor(pool.filter(i=>(i.where||'')===k),'shop')]);
  }
  if(m==='pack'){
    const pool=live().filter(packable);
    return [['随身（漏了当场出事）','cabin'],['托运','checked']]
      .map(([n,k])=>[n, sortFor(pool.filter(i=>i.carry===k),'pack')]);
  }
  const pool=live().filter(i=>i.kind==='do');
  return TOP['todo'].sub.map(s=>[s.n, sortFor(pool.filter(i=>i.p===s.id),m)]);
}
function vMode(m){
  const groups=modeGroups(m).filter(g=>g[1].length);
  const anyOpen=groups.some(([n])=>isOpen('m:'+m+':'+n));
  let h='<div class="wrap">';
  h+='<div class="seg">'+[['shop','🛒 购物'],['pack','🧳 打包'],['todo','✅ 要办的事']]
     .map(([k,n])=>'<button data-mode="'+k+'" aria-pressed="'+(k===m)+'">'+n+'</button>').join('')+'</div>';
  h+='<div class="toolbar">'
    +'<button class="tbtn" data-foldm="'+m+'" data-to="'+(anyOpen?0:1)+'">'+(anyOpen?'全部收起':'全部展开')+'</button>'
    +'<button class="tbtn'+(V.bulk?' on':'')+'" data-bulk="'+m+'">'+(V.bulk?'退出多选':'多选')+'</button>'
    +'</div>';
  h+='<div class="muted mhint" id="modehint">'+modeHint(m)+'</div>';
  if(!groups.length) return h+'<div class="empty">这里还没有内容</div></div>';

  groups.forEach(([n,l])=>{
    const key='m:'+m+':'+n, open=isOpen(key);
    const cl=l.filter(countable), ok=cl.filter(i=>marked(i,m)).length;
    h+='<div class="grp" data-open="'+(open?1:0)+'">'
      +'<div class="gh" data-grp="'+esc(key)+'"><span class="gx">›</span><span class="gn">'+esc(n)+'</span>'
      +'<span class="gc">'+ok+'/'+cl.length+'</span>'
      +'<button class="gall" data-all="'+esc(key)+'" data-m="'+m+'">'+(ok===cl.length&&cl.length?'取消':'全选')+'</button>'
      +'</div><div class="body">'+l.map(i=>rowHTML(i,m)).join('')+'</div></div>';
  });
  h+='</div>';
  if(V.bulk) h+=bulkBar(m);
  return h;
}
function bulkBar(m){
  const n=Object.keys(V.sel||{}).filter(k=>V.sel[k]).length;
  const label=m==='pack'?'标记已装箱':m==='shop'?'标记已买':'标记已办';
  return '<div class="bulkbar"><span>已选 <b>'+n+'</b> 项</span>'
    +'<button class="bbtn ghost" data-bulkall="'+m+'">全选本页</button>'
    +'<button class="bbtn" data-apply="'+m+'"'+(n?'':' disabled')+'>'+label+'</button></div>';
}

/* 一行条目 */
function rowHTML(i,mode){
  const k=i.kind, bulk=!!V.bulk;
  let on=0, dis=false, cls='';
  if(mode==='pack'){ on=S.pack[i.id]?1:0; dis=!ready(i); if(dis) cls+=' off'; }
  else if(k==='buy'){ on=S.buy[i.id]?1:(S.own[i.id]?2:0); }
  else if(k==='do'){ on=S.done[i.id]?1:0; }
  else if(k==='avoid'){ on=S.chk[i.id]?1:0; }
  else { dis=true; }
  if(on) cls+=' done';
  if(S.star[i.id]) cls+=' key';
  if(S.top[i.id]) cls+=' pinned';
  const sel=bulk && V.sel && V.sel[i.id];
  if(sel) cls+=' sel';

  let chips='';
  if(S.top[i.id]) chips+='<span class="chip pin">置顶</span>';
  if(i.qty) chips+='<span class="chip qty">'+esc(i.qty)+'</span>';
  if(i.carry==='cabin') chips+='<span class="chip cabin">随身</span>';
  if(mode!=='pack'&&k==='buy'&&S.own[i.id]) chips+='<span class="chip">家里有</span>';
  if(mode==='pack'&&!dis&&!S.pack[i.id]) chips+='<span class="chip ok">已备好</span>';
  if(i.where==='sg'&&mode!=='shop') chips+='<span class="chip">到当地买</span>';
  if(i.pack==='sg-ntu') chips+='<span class="chip sg">新加坡/NTU</span>';
  if(k==='know') chips+='<span class="chip">了解就行</span>';
  const note=S.note[i.id]||i.n;

  const ck = bulk && !dis
    ? '<button class="ck bulk" data-pick="'+i.id+'" data-on="'+(sel?1:0)+'">'+(sel?'✓':'')+'</button>'
    : '<button class="ck" data-on="'+on+'" data-ck="'+i.id+'" data-mode="'+(mode||'')+'"'+(dis?' disabled':'')+'>'+(on?'✓':'')+'</button>';

  return '<div class="row'+cls+'" data-id="'+i.id+'">'+ck
    +'<div class="rt" data-detail="'+i.id+'"><div class="t">'+esc(i.t)+'</div>'
    +(note?'<div class="n">'+esc(note)+'</div>':'')
    +(dis&&mode==='pack'?'<div class="n warnline">'+(i.kind==='buy'?'还没买':'还没办好')+'</div>':'')
    +(chips?'<div class="chips">'+chips+'</div>':'')+'</div>'
    +'<div class="acts">'
    +'<button class="star" data-star="'+i.id+'" data-on="'+(S.star[i.id]?1:0)+'" title="标记关键">'+(S.star[i.id]?'★':'☆')+'</button>'
    +'<button class="pin" data-top="'+i.id+'" data-on="'+(S.top[i.id]?1:0)+'" title="置顶">'+(S.top[i.id]?'↥':'↑')+'</button>'
    +'</div></div>';
}

/* 搜索。关键：输入框只渲染一次，打字时只换 #sres 的内容 —— 之前整块重建，
   输入框被替换掉，iOS 上焦点和输入法状态直接丢，打不进字。 */
function searchBox(){
  return '<div class="search"><span class="sicon">🔍</span>'
    +'<input id="q" type="search" enterkeyhint="search" autocomplete="off" '
    +'placeholder="搜东西，比如「牙刷」「插头」" value="'+esc(V.q||'')+'">'
    +'<button class="sclr" data-act="clrq" '+(V.q?'':'hidden')+'>✕</button></div>';
}
function searchResults(){
  const q=(V.q||'').trim().toLowerCase();
  if(!q) return '<div class="empty">输入关键词，比如「牙刷」「插头」「护照」</div>';
  const l=sortFor(live().filter(i=>
    (i.t+' '+(i.n||'')+' '+(S.note[i.id]||'')+' '+(SUB[i.p]?SUB[i.p].n:'')).toLowerCase().includes(q)));
  if(!l.length) return '<div class="empty">没找到「'+esc(q)+'」</div>';
  let h='<div class="muted mhint">找到 '+l.length+' 条</div>';
  h+='<div class="grp" data-open="1"><div class="body">'+l.map(i=>rowHTML(i)).join('')+'</div></div>';
  return h;
}
function vSearch(){
  return '<div class="wrap">'+searchBox()+'<div id="sres">'+searchResults()+'</div></div>';
}

/* ───────── 我的 ───────── */
function vMe(){
  const st=stats(), delN=Object.keys(S.del).filter(k=>S.del[k]).length;
  const R=(a,t,s)=>'<button class="srow" data-act="'+a+'"><div class="rt"><div>'+t+'</div>'
    +(s?'<div class="sub">'+s+'</div>':'')+'</div><span style="color:var(--faint)">›</span></button>';
  let h='<div class="wrap"><div class="sec">设置</div><div class="card" style="padding:0 14px">'
    +R('setdep','出发日期','现在 '+esc(S.dep||'未设置'))
    +R('folds','隐藏用不上的分组','比如彩妆、生理用品、剃须')
    +'</div>';
  h+='<div class="sec">数据</div><div class="card" style="padding:0 14px">'
    +R('backup','导出备份','换手机、清缓存前先导出')
    +R('restore','恢复备份','会覆盖现在的进度')
    +R('snaps','自动快照','出错了能回滚，留最近 10 份')
    +R('trash','回收站','里面有 '+delN+' 条')
    +'</div>';
  h+='<div class="sec">这份清单</div><div class="card">'
    +'<div class="muted">共 '+live().length+' 条 · 要买 '+st.shop[1]+' · 要办 '+st.todo[1]+' · 要装箱 '+st.pack[1]+'<br>'
    +'数据只存在这台手机的浏览器里，不上传任何地方。<br>'
    +'<b style="color:var(--warn)">清掉浏览器数据就没了，记得定期导出备份。</b></div></div>';
  h+='<div class="muted" style="text-align:center;padding:20px 0 10px">出行清单 · v1</div></div>';
  return h;
}

/* ───────── 弹层 ───────── */
function sheet(html){ $('#sheet').innerHTML='<div class="hbar"></div>'+html;
  $('#sheet').hidden=false; $('#mask').hidden=false; }
function closeSheet(){ $('#sheet').hidden=true; $('#mask').hidden=true; }
function toast(t){ const e=document.createElement('div'); e.className='toast'; e.textContent=t;
  document.body.appendChild(e); setTimeout(()=>e.remove(),1900); }

/* ───────── 条目详情 ───────── */
function detail(id){
  const i=BYID[id]; if(!i) return;
  const t=TOP[i.p.split('.')[0]], s=SUB[i.p];
  let h='<h3>'+esc(i.t)+'</h3><div class="muted">'+esc(t.n)+' › '+esc(s.n)+(i.qty?' · 建议 '+esc(i.qty):'')+'</div>';
  if(i.n) h+='<div class="muted" style="margin-top:10px">'+esc(i.n)+'</div>';
  if(i.kind==='do'&&i.carry){
    h+='<button class="srow" data-packtog="'+id+'"><div class="rt"><div>'
      +(S.pack[id]?'✓ 已装箱':'标记已装箱')+'</div><div class="sub">'
      +(i.carry==='cabin'?'随身携带 —— 漏了当场出事':'托运')+'</div></div></button>';
  }
  if(i.kind==='buy'){
    h+='<div class="sec">状态</div><div class="seg">'
      +[['none','还要买'],['buy','已经买了'],['own','家里有']].map(([k,n])=>{
        const on=k==='buy'?!!S.buy[id]:k==='own'?!!S.own[id]:!(S.buy[id]||S.own[id]);
        return '<button data-set="'+k+'" data-t="'+id+'" aria-pressed="'+on+'">'+n+'</button>';}).join('')
      +'</div>';
    if(i.carry) h+='<button class="srow" data-packtog="'+id+'"><div class="rt"><div>'
      +(S.pack[id]?'✓ 已装箱':'标记已装箱')+'</div><div class="sub">'
      +(i.carry==='cabin'?'随身携带 —— 漏了当场出事':'托运')+'</div></div></button>';
  }
  h+='<div class="sec">备注</div><textarea class="fld" id="nt" rows="2" placeholder="写点什么，比如买了哪个牌子">'+esc(S.note[id]||'')+'</textarea>';
  h+='<button class="btn" data-act="savenote" data-t="'+id+'">保存</button>';
  h+='<button class="btn ghost" data-del="'+id+'" style="color:var(--warn)">删掉这条</button>';
  sheet(h);
}

/* 勾选一条。购物和打包是两个独立状态：买了 ≠ 装箱了 */
function toggleOne(id,m){
  const i=BYID[id]; if(!i) return;
  if(m==='pack'){ S.pack[id]=!S.pack[id]; return; }
  if(i.kind==='buy'){
    if(S.own[id]) S.own[id]=false;
    else S.buy[id]=!S.buy[id];
    if(!S.buy[id]&&!S.own[id]) S.pack[id]=false;   /* 退回「还要买」就不可能已装箱 */
    return;
  }
  if(i.kind==='do')    S.done[id]=!S.done[id];
  else if(i.kind==='avoid') S.chk[id]=!S.chk[id];
}
function setOne(id,m,on){
  const i=BYID[id]; if(!i) return;
  if(m==='pack'){ if(on&&!ready(i)) return; S.pack[id]=on; return; }
  if(i.kind==='buy'){ S.buy[id]=on; if(!on){ S.own[id]=false; S.pack[id]=false; } return; }
  if(i.kind==='do')    S.done[id]=on;
  else if(i.kind==='avoid') S.chk[id]=on;
}

/* ───────── 事件 ───────── */
document.addEventListener('click',e=>{
  const T=e.target, hit=sel=>T.closest('['+sel+']');
  let el;
  /* 勾选 */
  if(el=hit('data-ck')){
    const id=el.dataset.ck, i=BYID[id], m=el.dataset.mode;
    toggleOne(id,m); commit(); refreshRow(id,m); return;   /* 局部刷新：位置不动，不跳走 */
  }
  if(el=hit('data-pick')){                                 /* 多选模式下选中 */
    const id=el.dataset.pick; V.sel=V.sel||{}; V.sel[id]=!V.sel[id];
    refreshRow(id,V.m); const b=document.querySelector('.bulkbar');
    if(b) b.outerHTML=bulkBar(V.m); return;
  }
  if(el=hit('data-star')){ const id=el.dataset.star; S.star[id]=!S.star[id];
    commit(); refreshRow(id,V.m==='browse'?null:V.m); return; }
  if(el=hit('data-top')){ const id=el.dataset.top; S.top[id]=!S.top[id];
    commit(); V.keepScroll=window.scrollY; render();
    toast(S.top[id]?'已置顶':'已取消置顶'); return; }
  if(el=hit('data-foldall')||hit('data-foldm')){
    const to=el.dataset.to==='1';
    if(el.dataset.foldall){ (TOP[el.dataset.foldall].sub||[]).forEach(x=>S.open[x.id]=to); }
    else { const m=el.dataset.foldm; modeGroups(m).forEach(([n])=>S.open['m:'+m+':'+n]=to); }
    commit(); V.keepScroll=window.scrollY; render(); return;
  }
  if(el=hit('data-all')){                                  /* 整组全选 / 取消 */
    const key=el.dataset.all, m=el.dataset.m, l=groupOf(m,key).filter(countable);
    const allOn=l.length && l.every(i=>marked(i,m));
    l.forEach(i=>setOne(i.id,m,!allOn));
    commit(); V.keepScroll=window.scrollY; render();
    toast(allOn?'已取消整组':'已勾选 '+l.length+' 项'); return;
  }
  if(el=hit('data-bulk')){ V.bulk=!V.bulk; V.sel={}; V.keepScroll=window.scrollY; render(); return; }
  if(el=hit('data-bulkall')){
    const m=el.dataset.bulkall; V.sel=V.sel||{};
    const all=modeGroups(m).flatMap(g=>g[1]).filter(i=>countable(i)&&!(m==='pack'&&!ready(i)));
    const on=!all.every(i=>V.sel[i.id]);
    all.forEach(i=>V.sel[i.id]=on);
    V.keepScroll=window.scrollY; render(); return;
  }
  if(el=hit('data-apply')){
    const m=el.dataset.apply, ids=Object.keys(V.sel||{}).filter(k=>V.sel[k]);
    ids.forEach(id=>setOne(id,m,true));
    V.sel={}; V.bulk=false; commit(); V.keepScroll=window.scrollY; render();
    toast('已标记 '+ids.length+' 项'); return;
  }
  if(el=hit('data-detail')){ detail(el.dataset.detail); return; }
  if(el=hit('data-grp')){ const k=el.dataset.grp;
    S.open[k]=!isOpen(k); commit(); V.keepScroll=window.scrollY; render(); return; }
  if(el=hit('data-cat')){ go({v:'list',m:'browse',c:el.dataset.cat}); return; }
  if(T.id==='q' && V.q==null){ V.q=''; V.c=null; V.m='browse';
    render(); setTimeout(()=>{const q=$('#q'); if(q) q.focus();},0); return; }
  if(el=hit('data-unhide')){ S.hide[el.dataset.unhide]=false; commit(); render(); return; }
  if(el=hit('data-mode')){ V.bulk=false; V.sel={}; go({v:'list',m:el.dataset.mode}); return; }
  if(el=hit('data-go')){ go({v:el.dataset.go}); return; }
  /* 详情里的操作 */
  if(el=hit('data-set')){
    const id=el.dataset.t, k=el.dataset.set;
    S.buy[id]=(k==='buy'); S.own[id]=(k==='own');
    if(k==='none') S.pack[id]=false;
    commit(); detail(id); render(); return;
  }
  if(el=hit('data-packtog')){ const id=el.dataset.packtog; S.pack[id]=!S.pack[id];
    commit(); detail(id); render(); return; }
  if(el=hit('data-del')){ const id=el.dataset.del; S.del[id]=true; commit();
    closeSheet(); render(); toast('已删，可在「我的 › 回收站」找回'); return; }
  if(el=hit('data-undel')){ const id=el.dataset.undel; S.del[id]=false; commit(); act('trash'); render(); return; }
  if(el=hit('data-hidetog')){ const k=el.dataset.hidetog; S.hide[k]=!S.hide[k]; commit(); act('folds'); return; }
  if(el=hit('data-snap')){ const t=+el.dataset.snap;
    try{ const a=JSON.parse(localStorage.getItem(SNAP)||'[]'); const s=a.find(x=>x.t===t);
      if(s){ Object.assign(S,JSON.parse(s.d)); save(); closeSheet(); render(); toast('已回滚'); } }catch(e){}
    return; }
  if(el=hit('data-act')){ act(el.dataset.act, el); return; }
  if(T.id==='mask') closeSheet();
});

document.addEventListener('input',e=>{
  if(e.target.id!=='q') return;
  V.q=e.target.value;
  const box=$('#sres');
  if(box) box.innerHTML=searchResults();       /* 输入框原封不动，焦点不丢 */
  else { V.c=null; V.m='browse'; render(); }
  const c=$('.sclr'); if(c) c.hidden=!V.q;
});

function act(a,el){
  if(a==='clrq'){ V.q=''; render(); setTimeout(()=>{const q=$('#q'); if(q) q.focus();},0); return; }
  if(a==='back'){ if(V.q!=null) V.q=null; else V.c=null; V.bulk=false; V.sel={}; render(); return; }
  if(a==='browse'){ go({v:'list',m:'browse'}); return; }
  if(a==='setdep'){
    sheet('<h3>出发日期</h3><div class="muted">倒计时和提醒都按这个算</div>'
      +'<input type="date" class="fld" id="dp" value="'+esc(S.dep||'')+'">'
      +'<button class="btn" data-act="savedep">保存</button>'); return; }
  if(a==='savedep'){ S.dep=$('#dp').value; commit(); closeSheet(); render(); return; }
  if(a==='savenote'){ const id=el.dataset.t; S.note[id]=$('#nt').value.trim();
    commit(); closeSheet(); render(); toast('已保存'); return; }
  if(a==='folds'){
    let h='<h3>隐藏用不上的分组</h3><div class="muted">隐藏后不出现在清单和进度里，随时能开回来</div>';
    TREE.filter(t=>t.kind==='goods').forEach(t=>{
      t.sub.forEach(s=>{ const n=inSub(s.id).length; if(!n) return;
        h+='<button class="srow" data-hidetog="'+s.id+'"><div class="rt"><div>'+esc(t.n)+' › '+esc(s.n)+'</div>'
          +'<div class="sub">'+n+' 条</div></div><span>'+(S.hide[s.id]?'已隐藏':'显示中')+'</span></button>'; });
    });
    sheet(h); return; }
  if(a==='trash'){
    const l=ITEMS.filter(i=>S.del[i.id]);
    let h='<h3>回收站</h3>';
    h+= l.length? l.map(i=>'<button class="srow" data-undel="'+i.id+'"><div class="rt"><div>'+esc(i.t)+'</div></div>'
        +'<span style="color:var(--accent)">恢复</span></button>').join('')
      : '<div class="muted" style="padding:16px 0">空的</div>';
    sheet(h); return; }
  if(a==='snaps'){
    let a2=[]; try{ a2=JSON.parse(localStorage.getItem(SNAP)||'[]'); }catch(e){}
    let h='<h3>自动快照</h3><div class="muted">每次改动自动存，留最近 10 份。数据乱了点一下回滚。</div>';
    h+= a2.length? a2.slice().reverse().map(s=>{const d=new Date(s.t);
        return '<button class="srow" data-snap="'+s.t+'"><div class="rt"><div>'
        +d.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
        +'</div></div><span style="color:var(--accent)">回滚</span></button>';}).join('')
      : '<div class="muted" style="padding:16px 0">还没有快照</div>';
    sheet(h); return; }
  if(a==='backup'){
    const blob=new Blob([JSON.stringify({v:1,t:Date.now(),S},null,1)],{type:'application/json'});
    const u=URL.createObjectURL(blob), a3=document.createElement('a');
    a3.href=u; a3.download='出行清单备份-'+ymd(new Date())+'.json'; a3.click();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
    toast('已导出，存到「文件」里最稳'); return; }
  if(a==='restore'){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
    inp.onchange=()=>{ const f=inp.files[0]; if(!f) return; const r=new FileReader();
      r.onload=()=>{ try{ const d=JSON.parse(r.result); if(!d.S) throw 0;
          snapshot(); Object.assign(S,d.S); save(); render(); toast('已恢复'); }
        catch(e){ toast('这个文件读不了'); } };
      r.readAsText(f); };
    inp.click(); return; }
}

window.addEventListener('popstate',e=>{ V=e.state||{v:'home'}; render(); });
window.addEventListener('scroll',()=>{ $('#top').classList.toggle('stuck', window.scrollY>4); },{passive:true});

/* ───────── 启动 ───────── */
(async function(){
  try{
    const [t,i]=await Promise.all([
      fetch('data/tree.json').then(r=>r.json()),
      fetch('data/items.json').then(r=>r.json())]);
    TREE=t.tree; ITEMS=i.items;
    TREE.forEach(x=>{ TOP[x.id]=x; x.sub.forEach(s=>{ SUB[s.id]=s; s.top=x.id; }); });
    ITEMS.forEach(x=>BYID[x.id]=x);
  }catch(e){
    $('#app').innerHTML='<div class="empty">数据没加载出来<br><small>'+esc(e.message)+'</small></div>'; return;
  }
  load(); V=fromHash(); render();
  window.addEventListener('hashchange',()=>{ V=fromHash(); render(); });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
