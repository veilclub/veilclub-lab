/* CATTAIL illustrated order book — static client-side selection, not an online checkout.
   Coverflow and continuous card movement adapt the interaction model from VEIL;
   the artwork, components, content and page state are independent. */
const CATTAIL_SERVICES=[
 {id:"can",name:"特級優質罐罐",group:"貓咪互動",price:30000,accent:"#d9e5d1",art:"can",
  desc:"投餵罐罐也許能增進感情，但請勿將店內貓咪餵成卡車。",note:"貓咪會不會靠近，還是得看牠當天的心情。"},
 {id:"chorus",name:"貓咪交響樂",group:"貓咪互動",price:100000,accent:"#e4cccd",art:"music",
  desc:"貓咪會在你身旁大聲嚎叫，音量與時長依貓咪心情而定。",note:"附近的貓咪可能忍不住跟著合唱。"},
 {id:"party",name:"吸貓派對",group:"貓咪互動",price:500000,accent:"#d6e3d7",art:"paw",
  desc:"購買後請先與櫃台確認想站的位置。櫃台會宣布你「身上噴了貓草香水！」，貓咪們就會圍到你身邊。",note:"香氣有時效性，會慢慢散去。"},
 {id:"healing",name:"貓咪治癒",group:"醫護站",price:100000,accent:"#c4dcd0",art:"bandage",
  desc:"被貓咪抓咬弄傷了嗎？來醫護站讓我們細心包紮治癒您。",note:"此為店內角色扮演服務。"},
 {id:"vaccine",name:"喵喵健康針",group:"醫護站",price:300000,accent:"#edcfb9",art:"care",
  desc:"主要提供給店內貓咪施打的健康針劑，如果你想讓你的貓咪朋友一起打，也一樣歡迎購買。",note:"此為店內角色扮演服務。"},
 {id:"photo",name:"與貓咪合照",group:"現場拍攝",price:300000,accent:"#d7d8e9",art:"camera",
  desc:"基礎包含一隻貓咪，每多加一隻貓咪 +50,000 Gil。",note:"加拍貓咪的費用由櫃台確認；照片可於 Discord 領取。"}
];
(function(){
"use strict";
const $=id=>document.getElementById(id);
const root=$("ct-order"),stage=$("ct-stage"),browse=$("ct-browse"),detail=$("ct-detail"),slot=$("ct-display-slot");
const paper=$("ct-paper"),stamp=$("ct-paw-stamp"),dots=$("ct-dots"),counter=$("ct-counter"),currentName=$("ct-current-name");
const modeButtons=[...document.querySelectorAll("[data-mode]")];
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
const nf=new Intl.NumberFormat("en-US");
const format=n=>nf.format(n)+" Gil";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp=(x,min,max)=>Math.max(min,Math.min(x,max));
const basePath=location.pathname+location.search;
const limitedCats=cats.filter(c=>typeof c.specialService==="string"&&c.specialService.trim());
const serviceEntries=CATTAIL_SERVICES.map((s,i)=>({...s,type:"service",key:"service-"+s.id,index:i}));
const catEntries=limitedCats.map((cat,i)=>({type:"cat",key:"cat-"+cat.sourceIndex,id:cat.sourceIndex,name:cat.name,group:cat.role,
 price:300000,accent:["#d4e1d6","#e8d6c4","#e4c9cd","#d5e4df"][i%4],cat,desc:cat.specialService,note:"實際服務內容請與貓咪及櫃台確認。"}));
let mode="service",active=0,phase="BROWSE",selected=null,drag=null,dragFraction=0,run=0,wheelAt=0,clickLock=0;
let portraitPromise=null;
const cart=new Map();
const entries=()=>mode==="service"?serviceEntries:catEntries;
const activeEntry=()=>entries()[active];
function artSvg(type){
 const common='viewBox="0 0 200 210" aria-hidden="true" focusable="false" class="ct-drawing"';
 const p={
  can:'<path d="M45 66 Q100 44 155 66 L153 151 Q100 176 47 151 Z"/><ellipse cx="100" cy="65" rx="55" ry="19"/><ellipse cx="100" cy="151" rx="53" ry="16"/><path d="M65 103 Q100 83 135 103 M69 131 Q100 143 131 131"/><path d="M92 115 Q83 105 77 115 Q71 127 99 137 Q128 125 122 115 Q114 105 106 115"/>',
  music:'<path d="M72 44 V133 M72 55 L145 38 V117 M72 55 L145 38"/><ellipse cx="54" cy="146" rx="23" ry="15" transform="rotate(-18 54 146)"/><ellipse cx="127" cy="130" rx="23" ry="15" transform="rotate(-18 127 130)"/><path d="M49 53 Q42 38 27 43 M160 60 Q173 58 178 70 M32 98 Q22 107 27 119"/>',
  paw:'<ellipse cx="100" cy="136" rx="49" ry="34"/><ellipse cx="54" cy="74" rx="14" ry="19" transform="rotate(-19 54 74)"/><ellipse cx="88" cy="62" rx="13" ry="21" transform="rotate(-6 88 62)"/><ellipse cx="123" cy="62" rx="13" ry="21" transform="rotate(7 123 62)"/><ellipse cx="155" cy="76" rx="14" ry="19" transform="rotate(20 155 76)"/><path d="M100 116 L100 156 M80 136 H120"/>',
  bandage:'<rect x="54" y="34" width="92" height="143" rx="18" transform="rotate(40 100 104)"/><rect x="66" y="88" width="68" height="37" rx="8" transform="rotate(40 100 104)"/><path d="M81 92 L82 92 M95 106 L96 106 M107 117 L108 117 M124 112 L125 112" stroke-width="7"/>',
  care:'<path d="M65 43 Q101 29 137 43 L133 74 L104 95 L66 75 Z"/><path d="M100 94 V163 M85 163 H117"/><path d="M89 51 V71 M78 61 H101"/><path d="M145 104 Q164 125 145 143 M57 110 Q41 130 59 147"/><path d="M99 160 Q79 145 62 163 Q58 175 72 180 H125 Q144 180 139 166 Q129 147 99 160 Z"/>',
  camera:'<rect x="29" y="73" width="143" height="94" rx="13"/><path d="M61 72 L75 49 H121 L136 72 M40 62 H58"/><circle cx="102" cy="122" r="29"/><circle cx="102" cy="122" r="17"/><circle cx="152" cy="90" r="5"/>'
 };
 return '<svg '+common+'>'+p[type]+'</svg>';
}
function cardHTML(entry,i){
 const num=String(i+1).padStart(2,"0"),cat=entry.type==="cat";
 const art=cat?'<span class="ct-cat-picture" data-photo="'+entry.cat.sourceIndex+'"><span class="ct-photo-pending">照片載入中</span></span>':artSvg(entry.art);
 return '<span class="ct-card-inner"><span class="ct-card-number"><span>CATTAIL / '+(cat?'CAT COLLECTION':'MENU CARD')+'</span><span>'+num+'</span></span>'+
 '<span class="ct-art">'+art+'</span><span class="ct-card-bottom"><span class="ct-card-type">'+safe(entry.group)+'</span>'+
 '<strong class="ct-card-name">'+safe(entry.name)+'</strong><span class="ct-card-sub">'+(cat?'貓咪限定服務':format(entry.price))+'</span></span>'+
 '<span class="ct-card-edge">'+(cat?'CAT / '+num:'MENU / '+num)+'</span></span>';
}
function refreshPhotos(){
 stage.querySelectorAll("[data-photo]").forEach(setPhoto);
 slot.querySelectorAll("[data-photo]").forEach(setPhoto);
}
function setPhoto(holder){
 const index=Number(holder.dataset.photo),person=cats[index];
 if(!person)return;
 if(!person.image){
  const label=holder.querySelector(".ct-photo-pending");
  if(label&&portraitPromise)label.textContent="照片待補";
  return;
 }
 const old=holder.querySelector("img");
 if(old&&old.src===person.image)return;
 const img=document.createElement("img");img.src=person.image;img.alt=person.name+"的照片";img.loading="lazy";img.decoding="async";
 img.onerror=()=>{img.replaceWith(Object.assign(document.createElement("span"),{className:"ct-photo-pending",textContent:"照片待補"}))};
 holder.replaceChildren(img);
}
function loadPortraits(){
 if(portraitPromise)return portraitPromise;
 portraitPromise=fetch("members.html",{cache:"force-cache"})
 .then(response=>{if(!response.ok)throw Error("Photo archive unavailable");return response.text()})
 .then(html=>{
  const doc=new DOMParser().parseFromString(html,"text/html");
  if(!doc.getElementById("member-source"))throw Error("Photo archive is missing member-source");
  doc.querySelectorAll(".member-card[data-id]").forEach(card=>{
   const person=cats[Number(card.dataset.id)];if(!person)return;
   const imgs=[...card.querySelectorAll("img.portrait-photo,img.extra-photo")].map(x=>x.getAttribute("src")).filter(Boolean);
   person.images=imgs;person.image=imgs[0]||"";
  });
  refreshPhotos();
 }).catch(error=>{
  console.warn("CATTAIL photos:",error);
  document.querySelectorAll("[data-photo] .ct-photo-pending").forEach(el=>{el.textContent="照片待補"});
 });
 return portraitPromise;
}
function renderBrowse(){
 const list=entries();
 stage.replaceChildren();dots.replaceChildren();
 list.forEach((entry,i)=>{
  const card=document.createElement("button");card.type="button";card.className="ct-card";card.dataset.index=i;
  card.dataset.key=entry.key;card.style.setProperty("--accent",entry.accent);card.setAttribute("aria-label",entry.name);
  card.innerHTML=cardHTML(entry,i);stage.append(card);
  const dot=document.createElement("button");dot.type="button";dot.className="ct-dot";dot.dataset.dot=i;dot.setAttribute("aria-label","查看 "+entry.name);
  dot.addEventListener("click",()=>setActive(i));dots.append(dot);
 });
 positionCards();
 refreshPhotos();
}
function stepSize(){return innerWidth<680?Math.min(158,innerWidth*.43):innerWidth<940?205:Math.min(260,stage.clientWidth*.22)}
function positionCards(){
 const step=stepSize(),list=entries();
 stage.querySelectorAll(".ct-card").forEach(el=>{
  const i=Number(el.dataset.index),delta=i-active-dragFraction,ad=Math.abs(delta),direction=Math.sign(delta);
  const cutoff=innerWidth<680?2.3:3.5;
  const pos=direction*(Math.min(1,ad)*step+Math.max(0,ad-1)*step*.68);
  el.style.setProperty("--shift",pos+"px");
  el.style.setProperty("--depth",-Math.min(260,ad*100)+"px");
  el.style.setProperty("--yaw",(-direction*Math.min(35,ad*27))+"deg");
  el.style.setProperty("--tilt",(direction*Math.min(6,ad*3.5))+"deg");
  el.style.setProperty("--scale",Math.max(.60,1-ad*.13));
  el.style.setProperty("--alpha",ad>cutoff?0:Math.max(.33,1-ad*.19));
  el.style.setProperty("--bright",Math.max(.50,1-ad*.15));
  el.style.setProperty("--layer",String(100-Math.round(ad*14)));
  el.style.setProperty("--pointer",ad>2.5?"none":"auto");
  const chosen=i===active;el.classList.toggle("is-active",chosen);
  el.setAttribute("aria-pressed",String(chosen));el.tabIndex=chosen?0:-1;
 });
 dots.querySelectorAll(".ct-dot").forEach((d,i)=>d.setAttribute("aria-current",String(i===active)));
 $("ct-prev").disabled=active===0;
 $("ct-next").disabled=active===list.length-1;
 counter.textContent=String(active+1).padStart(2,"0")+" / "+String(list.length).padStart(2,"0");
 currentName.textContent=list[active]?.name||"";
}
function setActive(i){
 if(phase!=="BROWSE")return;
 active=clamp(i,0,entries().length-1);
 dragFraction=0;positionCards();
}
function setMode(next){
 if(!["service","cat"].includes(next))return;
 if(phase!=="BROWSE"){
  history.replaceState({ctBrowse:true},"",basePath);
  restoreBrowse({instant:true,focus:false});
 }
 if(next===mode)return;
 mode=next;active=0;dragFraction=0;renderBrowse();
 document.body.dataset.ctMode=mode;
 modeButtons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===mode)));
 $("ct-mode-description").textContent=mode==="service"?"轉動跑輪，挑選一般消費項目。":"有些服務只由特定貓咪提供。先挑貓咪，再看看牠能做些什麼。";
 $("ct-browse-label").textContent=mode==="service"?"MENU / ALL SERVICES":"CATTAIL / LIMITED SERVICES";
 $("ct-counter-label").textContent=mode==="service"?"貓咪消費項目":"貓咪限定服務";
}
function paperContent(entry){
 const cat=entry.type==="cat",note=entry.note||"";
 paper.replaceChildren();
 const top=document.createElement("div");top.className="ct-paper-top";
 const a=document.createElement("span");a.textContent="CATTAIL · "+(cat?"CAT SERVICE":"SERVICE CARD");
 const b=document.createElement("span");b.textContent=cat?"CAT "+String(entry.id+1).padStart(2,"0"):"MENU "+String(entry.index+1).padStart(2,"0");
 top.append(a,b);paper.append(top);
 const h=document.createElement("h2");h.id="ct-paper-heading";h.tabIndex=-1;h.textContent=entry.name;paper.append(h);
 const meta=document.createElement("div");meta.className="ct-paper-meta";meta.textContent=cat?"貓咪限定服務 · "+entry.group:entry.group;paper.append(meta);
 if(cat&&entry.cat.tags?.length){
  const chips=document.createElement("div");chips.className="ct-paper-tags";
  entry.cat.tags.forEach(tag=>{const el=document.createElement("span");el.textContent=tag;chips.append(el)});
  paper.append(chips);
 }
 const desc=document.createElement("p");desc.className="ct-paper-description";desc.textContent=entry.desc;paper.append(desc);
 if(note){const n=document.createElement("p");n.className="ct-paper-note";n.textContent=note;paper.append(n)}
 const price=document.createElement("div");price.className="ct-paper-price";
 const label=document.createElement("small");label.textContent=cat?"貓咪限定服務":"單項價格";
 const amount=document.createElement("strong");amount.textContent=format(entry.price);
 price.append(label,amount);paper.append(price);
 const actions=document.createElement("div");actions.className="ct-paper-cta";
 const add=document.createElement("button");add.type="button";add.className="ct-add";add.textContent="加入消費清單";
 add.addEventListener("click",()=>addToCart(entry));
 const back=document.createElement("button");back.type="button";back.className="ct-return";back.textContent="返回選卡";back.addEventListener("click",leaveDetail);
 actions.append(add,back);paper.append(actions);
}
function finishOpening(token,direct=false){
 if(token!==run)return;
 phase="FLIGHT";
 stamp.classList.add("is-stamped");
 const reveal=()=>{if(token!==run)return;paper.classList.add("is-visible");phase="PINNED";$("ct-paper-heading")?.focus({preventScroll:true})};
 if(direct||reduceMotion.matches)reveal();else setTimeout(reveal,210);
}
function openSelected({direct=false,updateHistory=true}={}){
 if(phase!=="BROWSE")return;
 const entry=activeEntry();
 const card=stage.querySelector('.ct-card[data-index="'+active+'"]');
 if(!entry||!card)return;
 const rect=card.getBoundingClientRect();
 phase="PULL";run++;
 const token=run;
 selected=card;
 paperContent(entry);
 detail.hidden=false;browse.hidden=true;
 slot.append(card);
 card.classList.add("is-pinned");
 card.style.removeProperty("pointer-events");card.tabIndex=-1;
 stamp.classList.remove("is-stamped");paper.classList.remove("is-visible");
 const after=card.getBoundingClientRect();
 if(updateHistory){history.pushState({ctDetail:true},"",basePath+"#"+entry.key)}
 if(direct||reduceMotion.matches||!card.animate||!after.width){
  finishOpening(token,true);return;
 }
 const dx=rect.left-after.left,dy=rect.top-after.top,sx=rect.width/after.width,sy=rect.height/after.height;
 const animation=card.animate([
  {translate:dx+"px "+dy+"px",scale:sx+" "+sy,rotate:"-5deg",opacity:1,offset:0},
  {translate:(dx*.45)+"px "+(dy*.35-24)+"px",scale:(sx+(1-sx)*.5)+" "+(sy+(1-sy)*.5),rotate:"3deg",opacity:1,offset:.55},
  {translate:"0px 0px",scale:"1 1",rotate:"0deg",opacity:1,offset:1}
 ],{duration:780,easing:"cubic-bezier(.25,.7,.25,1)",fill:"both"});
 animation.finished.then(()=>{
  animation.cancel();finishOpening(token);
 }).catch(()=>{if(token===run)finishOpening(token,true)});
}
function restoreBrowse({instant=false,focus=true}={}){
 if(phase==="BROWSE")return;
 run++;const card=selected;
 selected=null;phase="RETURN";
 stamp.classList.remove("is-stamped");paper.classList.remove("is-visible");
 if(card){
  const start=card.getBoundingClientRect();
  stage.append(card);
  card.classList.remove("is-pinned");
  detail.hidden=true;browse.hidden=false;
  positionCards();
  const end=card.getBoundingClientRect();
  if(!instant&&!reduceMotion.matches&&card.animate&&end.width){
   const dx=start.left-end.left,dy=start.top-end.top;
   const sx=start.width/end.width,sy=start.height/end.height;
   const anim=card.animate([{translate:dx+"px "+dy+"px",scale:sx+" "+sy,opacity:1},{translate:"0px 0px",scale:"1 1",opacity:1}],{duration:460,easing:"ease-out",fill:"both"});
   anim.finished.then(()=>anim.cancel()).catch(()=>{});
  }
 }else{detail.hidden=true;browse.hidden=false;positionCards()}
 phase="BROWSE";
 if(focus)stage.querySelector('.ct-card.is-active')?.focus({preventScroll:true});
}
function leaveDetail(){
 if(phase!=="PINNED")return;
 if(history.state?.ctDetail)history.back();
 else{history.replaceState({ctBrowse:true},"",basePath);restoreBrowse()}
}
function syncFromLocation(){
 const key=decodeURIComponent(location.hash.slice(1));
 const target=[...serviceEntries,...catEntries].find(x=>x.key===key);
 if(!target){restoreBrowse({instant:true,focus:false});return}
 const next=target.type;
 if(phase!=="BROWSE")restoreBrowse({instant:true,focus:false});
 setMode(next);
 active=entries().findIndex(x=>x.key===key);positionCards();
 openSelected({direct:true,updateHistory:false});
}
function addToCart(entry){
 const current=cart.get(entry.key);
 if(current)current.qty=Math.min(99,current.qty+1);
 else cart.set(entry.key,{key:entry.key,name:entry.name,group:entry.type==="cat"?"貓咪限定服務":entry.group,price:entry.price,qty:1});
 renderCart();
 const add=paper.querySelector(".ct-add");
 if(add){add.textContent="已加入，再加一份？";add.focus({preventScroll:true})}
}
function renderCart(){
 const list=$("ct-cart-lines"),empty=$("ct-cart-empty");
 const rows=[...cart.values()],total=rows.reduce((sum,x)=>sum+x.price*x.qty,0);
 list.replaceChildren();empty.hidden=rows.length>0;
 for(const entry of rows){
  const row=document.createElement("div");row.className="ct-cart-line";
  const heading=document.createElement("div");const name=document.createElement("b");name.textContent=entry.name;
  const group=document.createElement("small");group.textContent=entry.group;heading.append(name,group);
  const qty=document.createElement("div");qty.className="ct-cart-qty";
  const minus=document.createElement("button");minus.type="button";minus.textContent="−";minus.setAttribute("aria-label","減少 "+entry.name);
  minus.addEventListener("click",()=>changeQty(entry.key,-1));
  const count=document.createElement("span");count.textContent=String(entry.qty);
  const plus=document.createElement("button");plus.type="button";plus.textContent="+";plus.setAttribute("aria-label","增加 "+entry.name);
  plus.addEventListener("click",()=>changeQty(entry.key,1));
  qty.append(minus,count,plus);
  const sum=document.createElement("span");sum.className="ct-cart-subtotal";sum.textContent=format(entry.price*entry.qty);
  row.append(heading,qty,sum);list.append(row);
 }
 $("ct-cart-total").textContent=format(total);
 $("ct-cart-amount").textContent=String(rows.reduce((n,x)=>n+x.qty,0));
 $("ct-copy").disabled=rows.length===0;
 $("ct-copy-status").textContent="";
}
function changeQty(key,diff){
 const row=cart.get(key);if(!row)return;
 row.qty+=diff;
 if(row.qty<1)cart.delete(key);
 if(row.qty>99)row.qty=99;
 renderCart();
}
async function copyCart(){
 const rows=[...cart.values()];if(!rows.length)return;
 const total=rows.reduce((n,x)=>n+x.qty*x.price,0);
 const lines=["貓尾草｜消費項目（尚未下單）",""];
 rows.forEach(e=>lines.push(e.name+" × "+e.qty+"｜"+format(e.price*e.qty)));
 lines.push("","選購小計："+format(total),"入場費另計：50,000 Gil（含當日套餐一份）","限定服務與加購內容請現場確認。");
 const output=lines.join("\n");
 let success=false;
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(output);success=true}}catch{}
 if(!success){
  const box=document.createElement("textarea");box.value=output;box.style.position="fixed";box.style.opacity="0";document.body.append(box);box.select();
  try{success=document.execCommand("copy")}catch{}
  box.remove();
 }
 $("ct-copy-status").textContent=success?"已複製消費清單。":"無法自動複製，請使用瀏覽器的複製功能。";
}
window.addEventListener("cattail:add-service",event=>{
 const entry=serviceEntries.find(s=>s.id===event.detail?.id);
 if(entry)addToCart(entry);
});
modeButtons.forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
dots.addEventListener("keydown",e=>{if(e.key==="ArrowRight")setActive(active+1);else if(e.key==="ArrowLeft")setActive(active-1)});
$("ct-prev").addEventListener("click",()=>setActive(active-1));
$("ct-next").addEventListener("click",()=>setActive(active+1));
$("ct-open").addEventListener("click",()=>openSelected());
stage.addEventListener("pointerdown",e=>{
 if(phase!=="BROWSE"||(e.button!==undefined&&e.button!==0))return;
 drag={id:e.pointerId,x:e.clientX,last:e.clientX,time:performance.now(),velocity:0,target:e.target.closest(".ct-card"),moved:false};
 try{stage.setPointerCapture(e.pointerId)}catch{}
});
stage.addEventListener("pointermove",e=>{
 if(!drag||e.pointerId!==drag.id||phase!=="BROWSE")return;
 const now=performance.now(),dx=e.clientX-drag.x,dt=Math.max(1,now-drag.time);
 drag.velocity=(e.clientX-drag.last)/dt;drag.last=e.clientX;drag.time=now;
 if(Math.abs(dx)>7)drag.moved=true;
 if(drag.moved){dragFraction=clamp(-dx/stepSize(),-3,3);positionCards()}
});
function finishPointer(e,cancel=false){
 if(!drag||drag.id!==e.pointerId)return;
 const d=drag;drag=null;dragFraction=0;
 if(phase!=="BROWSE")return;
 if(cancel){positionCards();return}
 const dx=e.clientX-d.x;
 if(d.moved||Math.abs(dx)>7){
  const fling=clamp(-dx/stepSize()-d.velocity*190/stepSize(),-3,3);
  const step=Math.abs(fling)<.3?0:Math.sign(fling)*Math.max(1,Math.round(Math.abs(fling)));
  setActive(active+step);clickLock=performance.now()+260;
 }else if(d.target){
  const idx=Number(d.target.dataset.index);
  if(idx!==active)setActive(idx);else openSelected();
 }else positionCards();
}
stage.addEventListener("pointerup",e=>finishPointer(e));
stage.addEventListener("pointercancel",e=>finishPointer(e,true));
stage.addEventListener("lostpointercapture",e=>{if(drag&&drag.id===e.pointerId){drag=null;dragFraction=0;positionCards()}});
stage.addEventListener("click",e=>{
 if(performance.now()<clickLock){e.preventDefault();return}
 if(e.detail!==0)return;
 const card=e.target.closest(".ct-card");
 if(!card||phase!=="BROWSE")return;
 const index=Number(card.dataset.index);
 if(index===active)openSelected();else setActive(index);
});
stage.addEventListener("wheel",e=>{
 if(phase!=="BROWSE")return;
 const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
 if(!delta)return;
 e.preventDefault();const now=performance.now();
 if(now-wheelAt<240)return;
 wheelAt=now;setActive(active+(delta>0?1:-1));
},{passive:false});
document.addEventListener("keydown",e=>{
 const tag=document.activeElement?.tagName;
 if(["INPUT","TEXTAREA","SELECT"].includes(tag))return;
 if(phase==="PINNED"&&e.key==="Escape"){e.preventDefault();leaveDetail();return}
 if(phase!=="BROWSE")return;
 if(e.key==="ArrowRight"&&(stage.contains(document.activeElement)||document.activeElement===stage)){e.preventDefault();setActive(active+1)}
 if(e.key==="ArrowLeft"&&(stage.contains(document.activeElement)||document.activeElement===stage)){e.preventDefault();setActive(active-1)}
 if((e.key==="Enter"||e.key===" ")&&document.activeElement===stage){e.preventDefault();openSelected()}
});
window.addEventListener("resize",()=>{if(phase==="BROWSE")positionCards()});
window.addEventListener("popstate",syncFromLocation);
$("ct-copy").addEventListener("click",copyCart);
renderBrowse();renderCart();
document.body.dataset.ctMode=mode;
loadPortraits();
if(location.hash)syncFromLocation();
else history.replaceState({ctBrowse:true},"",basePath);
})();
