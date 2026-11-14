import { configObject,normalizeMeasurements,entityId,MEASUREMENTS,type Measurement } from './entities';
import { CALCULATED_VALUES,calculatedValueId,type CalculatedValue } from './firmware-model';
export type HistoryRole=Measurement|CalculatedValue;
export interface HistoryConfig { type:'custom:flowio-history-card';title:string;hours_to_show:number;measurements:Measurement[];calculated_values:CalculatedValue[]; }
export function historyEntityId(prefix:string,role:HistoryRole){return(CALCULATED_VALUES as readonly string[]).includes(role)?calculatedValueId(prefix,role as CalculatedValue):entityId(prefix,role as Measurement);}
export function historyLabel(role:HistoryRole){return(CALCULATED_VALUES as readonly string[]).includes(role)?`Valeur calculée ${role.toUpperCase()}`:undefined;}
export function normalizeHistoryConfig(input:unknown):HistoryConfig {
  const raw=configObject(input);
  if('entity_prefix' in raw)throw new Error('entity_prefix supprimé : le préfixe vient de l’intégration Flow.io. Retirer ce champ.');
  const hours=raw.hours_to_show??24,title=raw.title??'Historique de la piscine';
  if(typeof title!=='string')throw new Error('Titre invalide');
  if(typeof hours!=='number'||!Number.isInteger(hours)||hours<1||hours>168)throw new Error('Durée entière attendue entre 1 et 168 heures');
  const calculated=raw.calculated_values===undefined?CALCULATED_VALUES:raw.calculated_values;
  if(calculated!==null&&(!Array.isArray(calculated)||calculated.some(value=>!(CALCULATED_VALUES as readonly unknown[]).includes(value))))throw new Error('Choisir les valeurs calculées proposées');
  return {type:'custom:flowio-history-card',title,hours_to_show:hours,measurements:normalizeMeasurements(raw.measurements,MEASUREMENTS),calculated_values:[...new Set((calculated??[]) as CalculatedValue[])]};
}
export function nativeHistoryConfigs(c:HistoryConfig,prefix:string){return [...c.measurements,...c.calculated_values].map(role=>({type:'history-graph',entities:[historyEntityId(prefix,role)],hours_to_show:c.hours_to_show}));}
