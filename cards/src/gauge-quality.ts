export function bandPath(from:number,to:number,min:number,max:number,radius=50){
  if(![from,to,min,max,radius].every(Number.isFinite)||to<=from||max<=min)return '';
  const a0=Math.min(1,Math.max(0,(from-min)/(max-min))),a1=Math.min(1,Math.max(0,(to-min)/(max-min)));if(a1<=a0)return '';
  const start=135+270*a0,end=135+270*a1,point=(degrees:number)=>{const r=degrees*Math.PI/180;return{x:60+radius*Math.cos(r),y:60+radius*Math.sin(r)};},p0=point(start),p1=point(end);
  return `M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)} A ${radius} ${radius} 0 ${end-start>180?1:0} 1 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`;
}
