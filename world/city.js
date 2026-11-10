// Scene composition from vegas-strip-v2. All rendered lanes and drivers share graph.
import { buildLaneGraph } from '../landmarks/vendor/map/lanegraph.js';
import { buildRoads } from '../landmarks/vendor/map/roads.js';
import { planValets, buildValets } from '../landmarks/vendor/map/valets.js';
import { buildTrees } from '../landmarks/vendor/map/trees.js';
import { buildCityLights } from '../landmarks/vendor/map/citylights.js';
import { buildStreetscape } from '../landmarks/vendor/map/streetscape.js';
import { buildSkybridges } from '../landmarks/vendor/map/skybridges.js';
import { buildStreetNames } from '../landmarks/vendor/map/names.js';
import { buildBuildings, makeHeightIndex } from '../landmarks/vendor/map/buildings.js';
import { buildLandmarks } from '../landmarks/vendor/landmarks/landmarks.js';
import { buildResorts } from '../landmarks/vendor/landmarks/resorts.js';
import { buildArenas } from '../landmarks/vendor/landmarks/arenas.js';
import { buildGuitar } from '../landmarks/vendor/landmarks/guitar.js';
import { buildDetails } from '../landmarks/vendor/landmarks/details.js';
import { welcomeSign } from '../landmarks/vendor/landmarks/welcome.js';
import { buildSigns } from '../landmarks/vendor/landmarks/signs.js';
import { buildRailways } from './railways.js';

const THREE = window.THREE;
export async function buildCity(data, engine) {
  const buildings = new THREE.Group(), roads = new THREE.Group(), detail = new THREE.Group();
  buildings.name = 'Vegas buildings'; roads.name = 'Street network'; detail.name = 'City life';
  engine.progress('Preparing streets…');
  const graph = buildLaneGraph(data);
  const valetPlan = planValets(data);
  await engine.yield();
  engine.progress('Opening bridges…');
  const roadOutput = buildRoads(data, graph, valetPlan.zones);
  const valets = buildValets(data, valetPlan, graph);
  graph.valets = valets.stops;
  roads.add(roadOutput.group, buildStreetNames(graph));
  detail.add(buildSkybridges(data, graph), buildRailways(data, graph, engine));
  await engine.yield();
  engine.progress('Bringing the city to life…');
  // The clearance-aware rail renderer above owns guideways and supports.
  const specialData = { ...data, rail: [] };
  buildings.add(buildLandmarks(specialData, engine), buildArenas(data, engine), buildGuitar(data, engine));
  const resorts = buildResorts(data, engine);
  buildings.add(resorts.group, buildDetails(specialData, engine), welcomeSign(graph, engine), valets.group);
  buildings.add(buildBuildings(data, valetPlan).group);
  detail.add(buildTrees(data, graph));
  const lights = buildCityLights(data);
  detail.add(lights.group, buildStreetscape(graph, engine, lights.spots), buildSigns(data, graph));
  return { graph, buildings, roads, detail, heightAt: makeHeightIndex(data, resorts.heights) };
}
