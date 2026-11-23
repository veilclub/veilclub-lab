/* CATTAIL — layered illustrated running cat (multi-variant, segmented tail).
 * Each cat is transparent hand-painted layers (body, two front legs, two hind legs, and a tail
 * split into segments) packed into one WebP atlas by tools/cattail/build_cat.py.
 * Variants live in cattail-cat-variants.js. Pick a cat with ?cat=<id> or data-cat="<id>" on the
 * mount; otherwise CATTAIL_CAT_DEFAULT ("random" = a different cat on each visit).
 * Legs follow the wheel's eight-step gait. Tail segments are chained: each one turns about its own
 * joint on top of its parent's turn, driven by a travelling wave — a slow sway at rest, a quicker,
 * fuller flow while the wheel runs. Honours prefers-reduced-motion and pauses when off-screen.
 */
(function(){
"use strict";
const W=640,H=360,DPR=2,VIEW_OX=16;
const DEFAULT_POSES=[
 // Independent shoulder/hip angles (deg, clockwise) make the feet genuinely stride.
 {frontNear:-16,frontFar:13,rearNear:17,rearFar:-12,tail:-7,bob:0},
 {frontNear:-6,frontFar:20,rearNear:9,rearFar:-21,tail:-3,bob:-2},
 {frontNear:13,frontFar:6,rearNear:-8,rearFar:-9,tail:4,bob:-4},
 {frontNear:21,frontFar:-9,rearNear:-19,rearFar:9,tail:7,bob:-2},
 {frontNear:11,frontFar:-21,rearNear:-13,rearFar:19,tail:3,bob:0},
 {frontNear:-7,frontFar:-12,rearNear:4,rearFar:17,tail:-3,bob:-2},
 {frontNear:-20,frontFar:7,rearNear:17,rearFar:-3,tail:-7,bob:-4},
 {frontNear:-13,frontFar:17,rearNear:12,rearFar:-15,tail:-2,bob:-2}
];
// Tail wave (keep identical to build_cat.py): angle_k = gait(k==0) + amp_k * sin(phase - k*lag)
const WAVE={baseAmp:3,tipAmp:15,lag:.75,idle:{scale:.5,period:2.8},run:{scale:1,period:.61}};
const LIMBS=["frontNear","frontFar","rearNear","rearFar"];
function pickVariant(mount){
 const reg=window.CATTAIL_CAT_VARIANTS||{};
 const ids=Object.keys(reg);
 if(!ids.length)return null;
 let want=null;
 try{want=new URLSearchParams(location.search).get("cat")}catch(e){}
 want=want||mount.dataset.cat||window.CATTAIL_CAT_DEFAULT||"random";
 if(reg[want])return reg[want];
 return reg[ids[Math.floor(Math.random()*ids.length)]];
}
function waveAmps(n,custom){
 if(custom&&custom.amp){const a=custom.amp.slice(0,n);while(a.length<n)a.push(custom.amp[custom.amp.length-1]);return a}
 if(n===1)return [0];
 return Array.from({length:n},(_,i)=>WAVE.baseAmp+(WAVE.tipAmp-WAVE.baseAmp)*i/(n-1));
}
function initRunner(mount){
 const variant=pickVariant(mount);
 const canvas=document.createElement("canvas");
 canvas.className="ct-layered-runner";
 canvas.width=W*DPR;
 canvas.height=H*DPR;
 canvas.setAttribute("role","img");
 const poses=(variant&&variant.poses)||DEFAULT_POSES;
 const chain=(variant&&variant.chains&&variant.chains.tail)||[];
 const amps=waveAmps(chain.length,variant&&variant.tailWave);
 const lag=(variant&&variant.tailWave&&variant.tailWave.lag)||WAVE.lag;
 const reduce=window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):{matches:false};
 const ctx=canvas.getContext("2d",{alpha:true});
 if(!ctx)throw new Error("Canvas 2D is unavailable");
 ctx.imageSmoothingQuality="high";
 const image=new Image();
 image.decoding="async";
 let ready=false,frame=0,phase=0,scale=WAVE.idle.scale,speed=2*Math.PI/WAVE.idle.period;
 let raf=0,last=0,onScreen=true;
 function rotateAbout(at,deg){
  if(!deg)return;
  ctx.translate(at[0],at[1]);ctx.rotate(deg*Math.PI/180);ctx.translate(-at[0],-at[1]);
 }
 function drawNeutral(p){
  const s=p.src,k=p.scale,j=p.joint;
  ctx.drawImage(image,s[0],s[1],s[2],s[3],p.at[0]-j[0]*k,p.at[1]-j[1]*k,s[2]*k,s[3]*k);
 }
 function render(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!ready)return;
  const pose=poses[frame],bob=pose.bob||0,wave=reduce.matches?0:scale;
  for(const name of variant.order){
   const p=variant.pieces[name];
   ctx.setTransform(DPR,0,0,DPR,DPR*VIEW_OX,0);
   const ci=chain.indexOf(name);
   if(ci>=0){
    ctx.translate(0,bob*.3);
    for(let i=0;i<=ci;i++){
     const a=(i===0?(pose.tail||0):0)+wave*amps[i]*Math.sin(phase-i*lag);
     rotateAbout(variant.pieces[chain[i]].at,a);
    }
   }else if(name==="body"){
    ctx.translate(0,bob);
   }else{
    ctx.translate(0,bob*(name==="tail"?.3:1));
    rotateAbout(p.at,LIMBS.includes(name)||name==="tail"?(pose[name]||0):0);
   }
   drawNeutral(p);
  }
 }
 function tick(now){
  raf=0;
  if(!ready||!chain.length||reduce.matches||!onScreen||document.hidden)return;
  const dt=Math.min(.1,last?(now-last)/1000:0);last=now;
  const target=mount.classList.contains("running")?WAVE.run:WAVE.idle;
  const ease=1-Math.exp(-dt/.25);
  scale+=(target.scale-scale)*ease;
  speed+=(2*Math.PI/target.period-speed)*ease;
  phase=(phase+speed*dt)%(2*Math.PI*1000);
  render();
  raf=requestAnimationFrame(tick);
 }
 function wake(){if(!raf&&chain.length&&!reduce.matches){last=0;raf=requestAnimationFrame(tick)}}
 function setPose(index){
  frame=((Number(index)||0)%poses.length+poses.length)%poses.length;
  render();
  wake();
 }
 if(variant){
  canvas.dataset.cat=variant.id;
  canvas.setAttribute("aria-label",(variant.label||"貓咪")+"在跑輪裡跑步，四隻腳和尾巴分別活動");
  image.onload=()=>{ready=image.naturalWidth>0;if(ready){render();wake()}};
  image.onerror=()=>{
   canvas.setAttribute("aria-label","貓咪插畫暫時無法載入");
   console.warn("CATTAIL cat atlas could not be loaded:",variant.atlas);
  };
  image.src=variant.atlas;
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)wake()});
  if(reduce.addEventListener)reduce.addEventListener("change",()=>{render();wake()});
  if("IntersectionObserver" in window){
   new IntersectionObserver(es=>{onScreen=es.some(e=>e.isIntersecting);if(onScreen)wake()}).observe(canvas);
  }
 }else{
  canvas.setAttribute("aria-label","貓咪插畫暫時無法載入");
  console.warn("CATTAIL: no cat variants registered (cattail-cat-variants.js)");
 }
 mount.replaceChildren(canvas);
 // setTailPhase: fixes the wave phase (radians) and stops the loop — used by visual tests.
 function setTailPhase(p,waveScale){phase=Number(p)||0;if(waveScale!=null)scale=waveScale;if(raf){cancelAnimationFrame(raf);raf=0}render()}
 return {setPose,setTailPhase,frameCount:poses.length,render,canvas,variant};
}
window.CattailLayeredRunner=initRunner;
})();
