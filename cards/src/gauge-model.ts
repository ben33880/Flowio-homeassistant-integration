import { MEASUREMENTS,type Measurement } from './entities';
export type VisualType='tile'|'arc'|'needle';
export interface Scale{type:VisualType;}
export type Visuals=Record<Measurement,Scale>;
const DEFAULT_TYPES:Record<Measurement,VisualType>={water_temperature:'tile',air_temperature:'tile',ph:'arc',orp:'arc',pressure:'needle'};
export function normalizeVisuals(input:unknown):Visuals{
if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)))throw new Error('visuals doit être un objet');
const raw=(input??{}) as Record<string,unknown>,result={} as Visuals;
for(const key of Object.keys(raw))if(!(MEASUREMENTS as readonly string[]).includes(key))throw new Error('Mesure visuelle inconnue');
for(const role of MEASUREMENTS){
const value=raw[role];if(value!==undefined&&(!value||typeof value!=='object'||Array.isArray(value)))throw new Error('Présentation invalide');
const v=(value??{}) as Record<string,unknown>,type=v.type??DEFAULT_TYPES[role];
if(typeof type!=='string'||!['tile','arc','needle'].includes(type))throw new Error('Présentation attendue : tile, arc ou needle');
result[role]={type:type as VisualType};
}return result;
}
export function numericValue(value:unknown):number|undefined{if(typeof value!=='number'&&typeof value!=='string')return undefined;if(typeof value==='string'&&!value.trim())return undefined;const n=Number(value);return Number.isFinite(n)?n:undefined;}
export function attributeScale(attributes?:Record<string,unknown>):{min:number;max:number}|undefined{const min=numericValue(attributes?.min),max=numericValue(attributes?.max);return min!==undefined&&max!==undefined&&max>min?{min,max}:undefined;}
export function gaugeGeometry(value:number|undefined,min:number,max:number,setpoint?:number,ring=false){if(value===undefined||![value,min,max,max-min].every(Number.isFinite)||max<=min)return undefined;const raw=(value-min)/(max-min),ratio=Math.min(1,Math.max(0,raw)),sweep=ring?360:270,start=ring?-90:135,circumference=2*Math.PI*50,arc=circumference*sweep/360;const point=(fraction:number,radius:number)=>{const a=(start+sweep*fraction)*Math.PI/180;return{x:60+radius*Math.cos(a),y:60+radius*Math.sin(a)};};return{ratio,arc,circumference,progress:arc*ratio,start,outOfRange:raw<0||raw>1,needleStart:point(ratio,35),needleEnd:point(ratio,52),target:setpoint!==undefined&&Number.isFinite(setpoint)&&setpoint>=min&&setpoint<=max?point((setpoint-min)/(max-min),46):undefined};}
