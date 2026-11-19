/* CATTAIL / Watercolour tabby component.
   Native SVG layers only. Fur, stripes and running limbs remain separately animated.
   Editorial illustration: muted ochre, umber and dry-brush texture, not cartoon line art. */
(function(){
"use strict";
function createPaintedTabby(mount){
 const ns="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox","0 0 240 172");
 svg.setAttribute("role","img");
 svg.setAttribute("aria-label","帶水彩筆觸的虎斑貓在跑輪裡小跑");
 svg.setAttribute("preserveAspectRatio","xMidYMax meet");
 svg.classList.add("ct-painted-tabby");
 const bodyShape="M68 84 C80 72 97 69 118 72 C137 72 155 79 166 89 C172 95 171 109 159 118 C143 129 116 132 94 124 C76 117 64 102 68 84 Z";
 const furMarks=[];
 // Seeded marks: stable positions and direction, clipped to the real torso silhouette.
 const seeded=n=>{const v=Math.sin(n*78.233+3.671)*143758.545;return v-Math.floor(v)};
 const brushPalette=["#f8e6c9","#765a48","#5e534a","#d8ad80","#9a795e","#f0cf9e"];
 for(let i=0;i<175;i++){
  const x=66+seeded(i+11)*116;
  const y=70+seeded(i+247)*67;
  const length=2+seeded(i+465)*10;
  const endX=x+length*.71;
  const endY=y+length*.34;
  const width=.45+seeded(i+603)*1.8;
  const opacity=.11+seeded(i+706)*.35;
  const color=brushPalette[Math.floor(seeded(i+401)*brushPalette.length)];
  furMarks.push('<path d="M'+x.toFixed(1)+' '+y.toFixed(1)+' q'+(length*.33).toFixed(1)+' '+(-length*.42).toFixed(1)+' '+(endX-x).toFixed(1)+' '+(endY-y).toFixed(1)+'" stroke="'+color+'" stroke-width="'+width.toFixed(1)+'" opacity="'+opacity.toFixed(2)+'" fill="none" stroke-linecap="round"/>');
 }
 const stripes=[
  "M86 76 Q99 87 96 102",
  "M103 72 Q116 87 112 106",
  "M120 74 Q132 89 131 105",
  "M141 80 Q154 93 151 107",
  "M77 97 Q86 113 91 120",
  "M104 113 Q112 123 119 125",
  "M127 115 Q140 122 147 116"
 ].map((d,i)=>'<path d="'+d+'" fill="none" stroke="'+(i%2?"#6f4e3d":"#6d5447")+'" stroke-width="'+(i%3===0?7.5:5.6)+'" stroke-opacity="'+(i%2?.46:.55)+'" stroke-linecap="round" filter="url(#ct-soft-paint)"/>').join("");
 const skin= [
 '<defs>',
 '<linearGradient id="ct-tabby-main" x1=".13" y1=".08" x2=".82" y2="1" objectBoundingBox="true"><stop offset="0" stop-color="#e6c39a"/><stop offset=".32" stop-color="#b18b67"/><stop offset=".68" stop-color="#a77d5d"/><stop offset="1" stop-color="#7a6759"/></linearGradient>',
 '<linearGradient id="ct-tabby-leg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b48d69"/><stop offset=".72" stop-color="#967555"/><stop offset="1" stop-color="#ead4b4"/></linearGradient>',
 '<linearGradient id="ct-tabby-face" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#dabb92"/><stop offset=".59" stop-color="#b78b69"/><stop offset="1" stop-color="#a27c66"/></linearGradient>',
 '<linearGradient id="ct-tabby-cheek" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e7d3b6"/><stop offset="1" stop-color="#cba784"/></linearGradient>',
 '<clipPath id="ct-tabby-body-mask"><path d="'+bodyShape+'"/></clipPath>',
 '<filter id="ct-tabby-dry" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="2" seed="8" result="rough"/><feDisplacementMap in="SourceGraphic" in2="rough" scale="1.2" xChannelSelector="R" yChannelSelector="G"/></filter>',
 '<filter id="ct-soft-paint" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation=".9"/></filter>',
 '<filter id="ct-pigment"><feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="2" seed="13" result="p"/><feColorMatrix in="p" type="saturate" values="0" result="grey"/><feComponentTransfer in="grey"><feFuncA type="linear" slope=".16"/></feComponentTransfer></filter>',
 '</defs>'
 ].join("");
 const artwork=[
 skin,
 '<g id="ct-tabby-moving">',
 // Watercolor tail, kept behind the torso.
 '<path id="ct-tabby-tail-outline" d="" fill="none" stroke="#70533e" stroke-width="17" stroke-linecap="round" opacity=".73"/>',
 '<path id="ct-tabby-tail-fill" d="" fill="none" stroke="#ba9470" stroke-width="12" stroke-linecap="round"/>',
 '<path id="ct-tabby-tail-ink" d="" fill="none" stroke="#5d4d43" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 13" opacity=".6"/>',
 // Legs behind the body, each has separate animation paths.
 '<path id="ct-tabby-rear-far" d="" fill="none" stroke="#7b6655" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
 '<path id="ct-tabby-front-far" d="" fill="none" stroke="#9c8067" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
 // Layered torso with natural, un-inked boundaries.
 '<path d="'+bodyShape+'" fill="url(#ct-tabby-main)" filter="url(#ct-tabby-dry)"/>',
 '<g clip-path="url(#ct-tabby-body-mask)">',
  '<path d="M76 96 Q95 81 120 83 Q151 84 161 96" fill="none" stroke="#f2d8b1" stroke-width="14" opacity=".24" filter="url(#ct-soft-paint)"/>',
  '<path d="M92 116 Q126 137 161 111" fill="none" stroke="#e8d1b4" stroke-width="18" opacity=".36" filter="url(#ct-soft-paint)"/>',
  '<path d="M74 84 Q100 72 127 77" fill="none" stroke="#f9e8cb" stroke-width="5" opacity=".38"/>',
  stripes,
  '<g>'+furMarks.join("")+'</g>',
  '<rect x="57" y="64" width="127" height="72" fill="#756353" filter="url(#ct-pigment)" opacity=".24"/>',
 '</g>',
 // Neck tufts painted behind face.
 '<path d="M153 86 Q164 77 174 77 Q164 90 178 101 Q171 112 158 108" fill="#d5b08b" opacity=".78"/>',
 '<path d="M157 108 Q171 123 180 109 Q171 120 163 119" fill="#ecd5b4" opacity=".75"/>',
 // Foreground legs with pale paws, still one continuous motion.
 '<path id="ct-tabby-rear-near" d="" fill="none" stroke="url(#ct-tabby-leg)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>',
 '<path id="ct-tabby-front-near" d="" fill="none" stroke="url(#ct-tabby-leg)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>',
 '<path id="ct-tabby-rear-highlight" d="" fill="none" stroke="#edcfaa" stroke-width="3" stroke-opacity=".42" stroke-linecap="round"/>',
 '<path id="ct-tabby-front-highlight" d="" fill="none" stroke="#f3d7b4" stroke-width="3" stroke-opacity=".45" stroke-linecap="round"/>',
 // Cat ears have warm ink-wash edges, not hard triangles or cartoon outlines.
 '<path d="M177 75 Q176 63 183 52 Q189 58 191 67 Q199 60 205 58 Q208 70 204 77" fill="url(#ct-tabby-face)" stroke="#8d6f5b" stroke-width="1.5" stroke-opacity=".45" stroke-linejoin="round"/>',
 '<path d="M181 68 Q182 60 184 59 L187 67 Z M199 69 L204 63 L204 72 Z" fill="#b78280" opacity=".55"/>',
 '<path d="M167 80 Q181 69 194 72 Q208 73 214 83 Q218 91 210 99 Q200 103 190 106 Q176 109 167 99 Q163 92 167 80 Z" fill="url(#ct-tabby-face)" filter="url(#ct-tabby-dry)"/>',
 // Distinct, soft cream cheek, slight impressionist asymmetry.
 '<path d="M193 88 Q208 82 215 90 Q214 100 204 103 L191 103 Q188 96 193 88 Z" fill="url(#ct-tabby-cheek)" opacity=".95"/>',
 '<path d="M169 81 Q183 77 190 83" fill="none" stroke="#70584b" stroke-width="4.5" opacity=".3" filter="url(#ct-soft-paint)"/>',
 '<path d="M173 87 Q183 85 187 89 M170 93 Q178 92 182 98" fill="none" stroke="#5d5147" stroke-width="2" stroke-opacity=".44" stroke-linecap="round"/>',
 '<path d="M201 85 Q206 82 210 86 Q205 90 201 85 Z" fill="#5f6254"/>',
 '<path d="M205 84 L206 88" stroke="#d8bc98" stroke-width="1"/>',
 '<path d="M212 92 L217 93 L214 97 Z" fill="#a3736d" opacity=".72"/>',
 '<path d="M210 99 Q207 102 204 101" fill="none" stroke="#806654" stroke-width=".8" opacity=".75"/>',
 '<g fill="none" stroke="#f4e4cb" stroke-width=".75" stroke-linecap="round" opacity=".9"><path d="M204 95 Q220 89 227 88"/><path d="M204 97 Q218 97 231 100"/><path d="M202 99 Q217 106 225 110"/></g>',
 '<g fill="none" stroke="#584d46" stroke-width=".65" opacity=".5"><path d="M194 96 Q186 91 181 92"/><path d="M195 99 Q186 98 177 100"/></g>',
 // Finishing dry-brush highlights in face and shoulder.
 '<path d="M173 77 Q181 74 191 77" fill="none" stroke="#f6e1c5" stroke-width="2.7" opacity=".48"/>',
 '<path d="M176 100 Q186 109 198 103" fill="none" stroke="#f3d5af" stroke-width="2.8" opacity=".45" filter="url(#ct-soft-paint)"/>',
 '</g>'
 ].join("");
 svg.innerHTML=artwork;
 mount.replaceChildren(svg);
 const limbIds=["ct-tabby-rear-far","ct-tabby-front-far","ct-tabby-rear-near","ct-tabby-front-near"];
 const limbs=limbIds.map(id=>svg.querySelector("#"+id));
 const highlights=[svg.querySelector("#ct-tabby-rear-highlight"),svg.querySelector("#ct-tabby-front-highlight")];
 const tailNodes=["ct-tabby-tail-outline","ct-tabby-tail-fill","ct-tabby-tail-ink"].map(id=>svg.querySelector("#"+id));
 const moving=svg.querySelector("#ct-tabby-moving");
 const gait=[
  ["M99 113 Q93 128 76 135 L63 144","M155 110 Q159 126 170 136 L182 145","M92 116 Q84 134 66 151 L58 152","M159 114 Q179 127 193 144 L209 144","M76 91 Q48 89 41 65 Q36 47 47 36",0],
  ["M99 113 Q89 132 82 143 L80 151","M155 110 Q172 125 182 139 L193 144","M92 116 Q89 137 78 147 L70 151","M159 114 Q180 123 200 129 L214 129","M76 91 Q44 82 43 61 Q42 43 54 35",-2],
  ["M99 113 Q90 130 79 142 L68 143","M155 110 Q166 134 173 146 L171 152","M92 116 Q77 126 67 143 L62 151","M159 114 Q178 135 191 140 L201 144","M76 92 Q47 83 46 57 Q44 40 57 33",-1],
  ["M99 113 Q91 139 101 152 L113 151","M155 110 Q167 130 181 137 L190 145","M92 116 Q90 129 98 139 L111 145","M159 114 Q174 125 191 140 L200 149","M76 91 Q43 79 40 61 Q42 45 52 37",1],
  ["M99 113 Q82 135 78 150 L65 151","M155 110 Q153 130 155 146 L163 151","M92 116 Q90 139 77 149 L68 151","M159 114 Q175 135 183 148 L197 148","M76 91 Q46 85 43 60 Q42 43 52 36",2],
  ["M99 113 Q88 129 72 139 L62 146","M155 110 Q169 124 187 133 L204 133","M92 116 Q83 132 69 146 L64 151","M159 114 Q177 122 198 137 L210 142","M76 91 Q48 92 42 70 Q35 52 46 39",0],
  ["M99 113 Q90 132 82 145 L80 151","M155 110 Q167 130 172 145 L182 150","M92 116 Q88 138 74 151 L65 150","M159 114 Q171 137 180 145 L188 150","M76 91 Q49 87 43 65 Q39 47 50 36",-2],
  ["M99 113 Q84 131 71 142 L67 150","M155 110 Q163 132 173 144 L186 147","M92 116 Q80 129 62 142 L54 144","M159 114 Q181 128 197 142 L213 144","M76 92 Q48 85 43 63 Q39 44 48 35",-1]
 ];
 function setPose(index){
  const pose=gait[index%gait.length];
  limbs.forEach((node,i)=>node.setAttribute("d",pose[i]));
  highlights[0].setAttribute("d",pose[2]);
  highlights[1].setAttribute("d",pose[3]);
  tailNodes.forEach(node=>node.setAttribute("d",pose[4]));
  moving.setAttribute("transform","translate(0 "+pose[5]+")");
 }
 setPose(0);
 return {setPose,svg};
}
window.CattailPaintedTabby=createPaintedTabby;
})();