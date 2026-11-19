/* CATTAIL wheel — tabby cat movement traced from an original generated eight-pose reference.
   Labels travel about the wheel hub while information remains beside/above the wheel. */
(function(){
"use strict";
const panel=document.getElementById("ct-wheel-shell");
if(!panel||typeof CATTAIL_SERVICES==="undefined")return;
const service=CATTAIL_SERVICES;
const byId=id=>document.getElementById(id);
const wheel=byId("ct-wheel-assembly"),scene=byId("ct-wheel-scene");
const grooves=byId("ct-wheel-grooves"),labels=byId("ct-wheel-labels");
const runner=byId("ct-wheel-runner"),title=byId("ct-wheel-title"),desc=byId("ct-wheel-description"),note=byId("ct-wheel-note"),price=byId("ct-wheel-price");
const status=byId("ct-wheel-counter");
const modes=window.matchMedia("(prefers-reduced-motion: reduce)");
const number=new Intl.NumberFormat("en-US");
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const poses=[
"M15 19 L13,24 L14,34 L23,47 L24,51 L20,57 L19,62 L12,67 L5,79 L7,82 L10,81 L16,73 L31,69 L34,71 L32,77 L43,86 L48,85 L46,83 L43,83 L39,78 L40,75 L45,70 L57,73 L67,87 L73,86 L72,84 L71,86 L69,84 L67,74 L83,77 L89,81 L92,81 L93,79 L79,71 L76,67 L79,61 L86,61 L89,59 L89,52 L86,47 L88,43 L82,46 L79,43 L78,43 L75,47 L68,51 L61,50 L46,46 L30,46 L20,34 L18,27 L19,21 L21,18 L30,15 L28,14 L23,14 L19,15Z",
"M15 18 L12,25 L14,34 L25,48 L23,52 L23,59 L17,62 L16,74 L17,77 L20,76 L21,68 L25,68 L29,70 L26,76 L32,86 L38,85 L36,83 L37,84 L34,83 L32,76 L41,69 L48,69 L61,74 L62,75 L59,77 L59,80 L66,78 L68,75 L75,75 L82,79 L84,79 L84,76 L84,77 L80,76 L80,73 L71,69 L78,61 L87,60 L89,59 L89,51 L86,48 L88,43 L82,46 L79,43 L78,43 L75,46 L68,50 L62,50 L43,44 L30,43 L21,34 L18,27 L19,20 L22,16 L28,15 L28,14 L21,13Z",
"M15 18 L12,25 L14,34 L25,46 L23,54 L25,60 L20,64 L20,65 L27,74 L29,79 L32,77 L32,73 L29,73 L26,68 L29,69 L30,71 L29,68 L34,72 L35,76 L38,77 L39,72 L35,66 L38,65 L41,65 L49,68 L50,70 L45,77 L39,79 L39,81 L45,81 L55,73 L63,72 L87,83 L92,82 L91,80 L91,82 L88,81 L88,79 L80,74 L77,69 L77,64 L80,60 L86,60 L89,58 L89,51 L86,47 L88,43 L81,45 L80,43 L78,42 L74,47 L66,50 L43,43 L30,42 L21,34 L18,27 L19,20 L22,16 L27,16 L29,14 L22,13Z",
"M18 14 L13,21 L12,28 L16,37 L25,47 L25,57 L20,60 L21,63 L29,71 L37,76 L47,79 L58,72 L70,86 L77,86 L76,84 L76,86 L72,84 L73,83 L71,81 L68,73 L79,60 L87,60 L90,56 L89,51 L86,46 L88,42 L81,45 L79,42 L73,47 L67,49 L46,42 L37,41 L31,42 L21,34 L17,26 L19,18 L22,16 L28,13 L23,12Z",
"M19 13 L13,20 L12,29 L17,38 L25,47 L25,56 L30,62 L26,70 L27,72 L38,79 L41,79 L41,78 L38,76 L39,78 L32,72 L38,72 L41,74 L44,77 L43,79 L46,80 L50,80 L55,76 L59,86 L61,88 L65,88 L65,85 L65,86 L63,85 L63,87 L61,85 L63,84 L62,83 L62,75 L73,67 L79,61 L89,59 L89,52 L86,47 L88,43 L81,46 L78,43 L74,47 L67,49 L45,41 L30,41 L20,32 L17,25 L17,22 L20,18 L27,13 L23,12Z",
"M16 16 L13,22 L12,28 L15,36 L24,48 L22,55 L24,61 L18,66 L23,77 L25,79 L28,78 L28,77 L27,76 L26,77 L24,75 L23,71 L24,70 L27,74 L25,70 L29,69 L30,70 L30,73 L38,80 L43,82 L43,79 L37,73 L43,68 L46,68 L58,72 L58,75 L55,77 L56,80 L64,76 L76,86 L82,87 L82,85 L82,86 L80,84 L80,86 L78,85 L79,83 L73,77 L72,70 L74,68 L74,66 L76,65 L80,61 L87,61 L89,59 L89,52 L86,48 L88,43 L81,46 L78,43 L74,48 L68,50 L61,49 L45,44 L30,44 L21,34 L18,27 L18,22 L19,19 L22,16 L29,15 L29,14 L22,12Z",
"M15 19 L13,25 L14,33 L24,50 L22,55 L22,61 L17,62 L11,73 L9,79 L10,82 L12,82 L18,74 L37,70 L54,71 L57,83 L59,87 L64,86 L61,82 L63,73 L73,77 L82,77 L89,80 L92,79 L91,77 L91,78 L88,77 L88,75 L76,70 L75,68 L79,61 L87,61 L89,59 L89,52 L86,48 L88,43 L81,46 L80,43 L78,43 L74,48 L67,51 L43,46 L30,45 L21,34 L18,28 L18,23 L20,20 L23,17 L29,16 L29,15 L28,14 L22,14Z",
"M16 18 L13,24 L14,32 L16,37 L25,50 L22,55 L20,62 L15,65 L7,75 L6,78 L7,80 L10,80 L16,72 L25,71 L26,72 L25,77 L28,84 L30,86 L35,86 L36,84 L32,83 L30,79 L31,77 L39,71 L46,71 L64,75 L65,76 L63,78 L64,80 L70,79 L81,85 L87,83 L86,81 L86,83 L81,82 L82,80 L76,75 L74,67 L76,65 L75,64 L79,61 L87,61 L89,59 L89,51 L86,48 L88,43 L81,46 L80,43 L78,43 L74,47 L68,50 L61,50 L46,46 L31,45 L21,35 L18,28 L20,20 L30,15 L23,14Z"
];
const svgNS="http://www.w3.org/2000/svg";
const svg=document.createElementNS(svgNS,"svg");
svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("role","img");svg.setAttribute("aria-label","正在跑步的棕色虎斑貓");
svg.innerHTML='<defs><pattern id="ct-cat-fur" patternUnits="userSpaceOnUse" width="11" height="11" patternTransform="rotate(-18)"><path d="M0 0 V11" stroke="#563c2d" stroke-width="2.3"/><path d="M5 0 V11" stroke="#e8c69a" stroke-width="1.7"/></pattern></defs><path id="ct-cat-pose" class="ct-cat-shape"/><path id="ct-cat-marking" class="ct-cat-pattern"/><circle class="ct-cat-eye" cx="84.5" cy="51.7" r="1.3"/><path d="M86 56l4 .7M86 57l4 1.7" stroke="#5c4738" stroke-width=".65" fill="none"/>';
runner.append(svg);
const shape=byId("ct-cat-pose"),marking=byId("ct-cat-marking");
function setPose(i){shape.setAttribute("d",poses[i]);marking.setAttribute("d",poses[i])}
setPose(0);
let index=0,angle=0,turnUntil=0,catTimer=null,drag=null;
const items=service.map((entry,i)=>{
 const button=document.createElement("span");
 button.className="ct-wheel-label";button.textContent=entry.name;button.dataset.index=i;
 labels.append(button);return button;
});
function relative(i,selected){
 let delta=(i-selected+service.length)%service.length;
 if(delta>service.length/2)delta-=service.length;
 return delta;
}
function paint(animate=false){
 const size=wheel.clientWidth||450,rad=size*.345;
 items.forEach((node,i)=>{
  const d=relative(i,index),theta=d*Math.PI*.31;
  // The label rises along a circular route from the spindle to the upper rim.
  const x=Math.round(Math.sin(theta)*rad);
  const y=Math.round(-Math.cos(theta)*rad);
  node.style.setProperty("--wheel-x",x+"px");
  node.style.setProperty("--wheel-y",y+"px");
  node.style.setProperty("--wheel-opacity",Math.abs(d)<=1?"1":"0");
  node.style.setProperty("--wheel-scale",d===0?"1.03":".83");
  node.classList.toggle("is-selected",d===0);
 });
 const item=service[index];
 title.textContent=item.name;desc.textContent=item.desc;note.textContent=item.note||"";
 note.hidden=!item.note;
 price.textContent=number.format(item.price)+" Gil";
 status.textContent=String(index+1).padStart(2,"0")+" / "+String(service.length).padStart(2,"0");
 if(animate&&!modes.matches){turnUntil=Date.now()+750;runner.classList.add("running");startRun()}
}
function startRun(){
 if(modes.matches||catTimer)return;
 catTimer=setInterval(()=>{
  if(Date.now()>turnUntil){
   clearInterval(catTimer);catTimer=null;runner.classList.remove("running");setPose(0);return;
  }
  setPose(Math.floor(Date.now()/76)%poses.length);
 },72);
}
function step(by){
 const before=index;
 index=(index+by%service.length+service.length)%service.length;
 angle+=by*60;grooves.style.transform="rotate("+angle+"deg)";
 paint(before!==index);
}
byId("ct-wheel-prev").addEventListener("click",()=>step(-1));
byId("ct-wheel-next").addEventListener("click",()=>step(1));
byId("ct-wheel-add").addEventListener("click",()=>{
 window.dispatchEvent(new CustomEvent("cattail:add-service",{detail:{id:service[index].id}}));
 const button=byId("ct-wheel-add");button.textContent="已加入，繼續加一份";setTimeout(()=>{button.textContent="加入消費清單"},1100);
});
scene.addEventListener("pointerdown",event=>{
 if(event.button!==undefined&&event.button!==0)return;
 if(event.target.closest("button"))return;
 drag={id:event.pointerId,startX:event.clientX,startY:event.clientY};
 scene.classList.add("is-dragging");
 try{scene.setPointerCapture(event.pointerId)}catch{}
 if(!modes.matches){turnUntil=Date.now()+340;runner.classList.add("running");startRun()}
});
function finishDrag(event,cancel=false){
 if(!drag||event.pointerId!==drag.id)return;
 const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
 drag=null;scene.classList.remove("is-dragging");
 if(cancel||Math.abs(dx)<=12||Math.abs(dx)<=Math.abs(dy))return;
 const amount=Math.sign(-dx)*clamp(Math.round(Math.abs(dx)/95),1,3);
 step(amount);
}
scene.addEventListener("pointerup",finishDrag);
scene.addEventListener("pointercancel",e=>finishDrag(e,true));
scene.addEventListener("lostpointercapture",()=>{drag=null;scene.classList.remove("is-dragging")});
scene.addEventListener("wheel",e=>{
 if(document.body.dataset.ctMode==="cat")return;
 const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
 if(!delta)return;
 e.preventDefault();if(Date.now()<lastWheel+230)return;
 lastWheel=Date.now();step(delta>0?1:-1);
},{passive:false});
let lastWheel=0;
scene.tabIndex=0;scene.setAttribute("aria-label","貓咪跑輪，左右方向鍵切換服務");
scene.addEventListener("keydown",e=>{
 if(e.key==="ArrowRight"){e.preventDefault();step(1)}
 else if(e.key==="ArrowLeft"){e.preventDefault();step(-1)}
});
window.addEventListener("resize",()=>paint(false));
paint(false);
})();