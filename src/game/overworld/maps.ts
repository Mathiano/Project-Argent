import labData from '../maps/lab.json';
import houseData from '../maps/house.json';
import route31Data from '../maps/route31.json';
import gymData from '../maps/gym.json';
import type { MapData } from './types';

const REGISTRY: { readonly [name: string]: MapData } = {
  LAB: labData as MapData,
  HOUSE: houseData as MapData,
  ROUTE31: route31Data as MapData,
  GYM: gymData as MapData,
};

export function getMap(name: string): MapData {
  const map = REGISTRY[name];
  if (!map) throw new Error(`Argent overworld: unknown map "${name}"`);
  return map;
}

export function listMaps(): readonly string[] {
  return Object.keys(REGISTRY);
}
