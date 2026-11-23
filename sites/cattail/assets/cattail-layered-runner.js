/* CATTAIL — layered illustrated running cat (multi-variant).
 * Each cat is six transparent hand-painted layers (body, two front legs, two hind legs, tail)
 * packed into one WebP atlas by tools/build_cat.py. Variants live in cattail-cat-variants.js.
 * Pick a cat with ?cat=<id> or data-cat="<id>" on the mount; otherwise CATTAIL_CAT_DEFAULT
 * ("random" = a different cat on each visit). Limb rotations follow the wheel's eight-step gait.
 */
(function(){
"use strict";
const W=640,H=360,DPR=2;
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
function initRunner(mount){
 const variant=pickVariant(mount);
 const canvas=document.createElement("canvas");
 canvas.className="ct-layered-runner";
 canvas.width=W*DPR;
 canvas.height=H*DPR;
 canvas.setAttribute("role","img");
 const poses=(variant&&variant.poses)||DEFAULT_POSES;
 const ctx=canvas.getContext("2d",{alpha:true});
 if(!ctx)throw new Error("Canvas 2D is unavailable");
 ctx.imageSmoothingQuality="high";
 const image=new Image();
 image.decoding="async";
 let ready=false,frame=0;
 function part(name,angle,dy){
  const p=variant.pieces[name],s=p.src,k=p.scale,j=p.joint;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.translate(p.at[0],p.at[1]+dy);
  if(angle)ctx.rotate(angle*Math.PI/180);
  ctx.drawImage(image,s[0],s[1],s[2],s[3],-j[0]*k,-j[1]*k,s[2]*k,s[3]*k);
 }
 function render(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!ready)return;
  const pose=poses[frame];
  for(const name of variant.order){
   const bob=(pose.bob||0)*(name==="tail"?.3:1);
   part(name,name==="body"?0:(pose[name]||0),bob);
  }
 }
 function setPose(index){
  frame=((Number(index)||0)%poses.length+poses.length)%poses.length;
  render();
 }
 if(variant){
  canvas.dataset.cat=variant.id;
  canvas.setAttribute("aria-label",(variant.label||"貓咪")+"在跑輪裡跑步，四隻腳和尾巴分別活動");
  image.onload=()=>{ready=image.naturalWidth>0;if(ready)render()};
  image.onerror=()=>{
   canvas.setAttribute("aria-label","貓咪插畫暫時無法載入");
   console.warn("CATTAIL cat atlas could not be loaded:",variant.atlas);
  };
  image.src=variant.atlas;
 }else{
  canvas.setAttribute("aria-label","貓咪插畫暫時無法載入");
  console.warn("CATTAIL: no cat variants registered (cattail-cat-variants.js)");
 }
 mount.replaceChildren(canvas);
 return {setPose,frameCount:poses.length,render,canvas,variant};
}
window.CattailLayeredRunner=initRunner;
})();
