
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

const catLayerController=window.CattailLayeredRunner?.(runner);
if(!catLayerController)throw new Error("CATTAIL layer animation did not initialize");
const setPose=catLayerController.setPose;
const poseCount=catLayerController.frameCount;
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

  const x=Math.round(Math.sin(theta)*rad);
  const y=Math.round(-Math.cos(theta)*rad);
  node.style.setProperty("--wheel-x",x+"px");
  node.style.setProperty("--wheel-y",y+"px");
  node.style.setProperty("--wheel-opacity",Math.abs(d)<=1?"1":"0");
  node.style.setProperty("--wheel-scale",d===0?"1":".88");
  node.classList.toggle("is-selected",d===0);
 });
 const item=service[index];
 title.textContent=item.name;desc.textContent=item.desc;note.textContent=item.note||"";
 note.hidden=!item.note;
 price.textContent=number.format(item.price)+" Gil";
 status.textContent=String(index+1).padStart(2,"0")+" / "+String(service.length).padStart(2,"0");
 if(animate&&!modes.matches){turnUntil=Date.now()+900;runner.classList.add("running");startRun()}
}
function startRun(){
 if(modes.matches||catTimer)return;
 catTimer=setInterval(()=>{
  if(Date.now()>turnUntil){
   clearInterval(catTimer);catTimer=null;runner.classList.remove("running");setPose(0);return;
  }
  setPose(Math.floor(Date.now()/76)%poseCount);
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