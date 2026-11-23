/* CATTAIL — layered illustrated running cat.
 * Six transparent hand-drawn components are packed into one optimized WebP atlas:
 * body, extended front leg, bent front leg, extended rear leg, bent rear leg, tail.
 * Limb transforms are independent and tied to the wheel's existing eight-step gait.
 */
(function(){
"use strict";
const ASSET="assets/cattail-cat-layers.webp?v=1";
const W=640,H=360;
const UNIT=.75; // 512px authoring atlas scaled to 384px for download
const pieces={
 body:{src:[0,0,420,196],dest:[120,68,420,196],pivot:[318,180]},
 frontNear:{src:[0,205,216,157],dest:[415,194,216,157],pivot:[459,230]},
 frontFar:{src:[226,206,75,91],dest:[456,224,75,91],pivot:[476,236]},
 rearNear:{src:[308,206,180,143],dest:[88,170,180,143],pivot:[169,223]},
 rearFar:{src:[223,316,75,70],dest:[250,220,75,70],pivot:[276,229]},
 tail:{src:[301,359,198,134],dest:[-10,69,198,134],pivot:[183,188]}
};
const poses=[
 // Changing independent shoulder and hip angles makes the feet genuinely stride.
 {frontNear:-16,frontFar:13,rearNear:17,rearFar:-12,tail:-7,bob:0},
 {frontNear:-6,frontFar:20,rearNear:9,rearFar:-21,tail:-3,bob:-2},
 {frontNear:13,frontFar:6,rearNear:-8,rearFar:-9,tail:4,bob:-4},
 {frontNear:21,frontFar:-9,rearNear:-19,rearFar:9,tail:7,bob:-2},
 {frontNear:11,frontFar:-21,rearNear:-13,rearFar:19,tail:3,bob:0},
 {frontNear:-7,frontFar:-12,rearNear:4,rearFar:17,tail:-3,bob:-2},
 {frontNear:-20,frontFar:7,rearNear:17,rearFar:-3,tail:-7,bob:-4},
 {frontNear:-13,frontFar:17,rearNear:12,rearFar:-15,tail:-2,bob:-2}
];
function initRunner(mount){
 const canvas=document.createElement("canvas");
 canvas.className="ct-layered-runner";
 canvas.width=W;
 canvas.height=H;
 canvas.setAttribute("role","img");
 canvas.setAttribute("aria-label","手繪橘白虎斑貓在跑輪裡跑步，四隻腳和尾巴分別活動");
 const ctx=canvas.getContext("2d",{alpha:true});
 if(!ctx)throw new Error("Canvas 2D is unavailable");
 const image=new Image();
 image.decoding="async";
 let ready=false,frame=0;
 const map={
  tail:pieces.tail,
  rearFar:pieces.rearFar,
  rearNear:pieces.rearNear,
  frontFar:pieces.frontFar,
  frontNear:pieces.frontNear,
  body:pieces.body
 };
 function part(name,angle=0,dy=0,dx=0){
  const p=map[name],s=p.src.map(v=>v*UNIT),d=p.dest,pivot=p.pivot;
  ctx.save();
  ctx.translate(pivot[0]+dx,pivot[1]+dy);
  ctx.rotate(angle*Math.PI/180);
  ctx.translate(-pivot[0],-pivot[1]);
  // Flipback safeguard: the atlas contains no text or baked-in interface.
  ctx.drawImage(image,s[0],s[1],s[2],s[3],d[0],d[1],d[2],d[3]);
  ctx.restore();
 }
 function render(){
  ctx.clearRect(0,0,W,H);
  if(!ready)return;
  const pose=poses[frame];
  part("tail",pose.tail,pose.bob*.3);
  part("rearFar",pose.rearFar,pose.bob);
  part("frontFar",pose.frontFar,pose.bob);
  part("rearNear",pose.rearNear,pose.bob);
  // Front-near starts behind the torso; its joint is hidden naturally by the chest.
  part("frontNear",pose.frontNear,pose.bob);
  part("body",0,pose.bob);
 }
 function setPose(index){
  frame=((Number(index)||0)%poses.length+poses.length)%poses.length;
  render();
 }
 image.onload=()=>{
  ready=image.naturalWidth>=300&&image.naturalHeight>=300;
  if(ready)render();
 };
 image.onerror=()=>{
  canvas.setAttribute("aria-label","貓咪插畫暫時無法載入");
  console.warn("CATTAIL cat layer asset could not be loaded");
 };
 image.src=ASSET;
 mount.replaceChildren(canvas);
 return {setPose,frameCount:poses.length,render,canvas};
}
window.CattailLayeredRunner=initRunner;
})();