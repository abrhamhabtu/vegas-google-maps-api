// Scene composition from vegas-strip-v2. All rendered lanes and drivers share graph.
import { buildLaneGraph } from '../landmarks/vendor/map/lanegraph.js';
import { buildRoads } from '../landmarks/vendor/map/roads.js';
import { planIntersections } from '../landmarks/vendor/map/intersections.js';
import { planValets, buildValets } from '../landmarks/vendor/map/valets.js';
import { buildTrees } from '../landmarks/vendor/map/trees.js';
import { buildCityLights } from '../landmarks/vendor/map/citylights.js';
import { buildStreetscape } from '../landmarks/vendor/map/streetscape.js';
import { buildSkybridges } from '../landmarks/vendor/map/skybridges.js';
import { buildStreetNames } from '../landmarks/vendor/map/names.js';
import { buildBuildings, heroOwned, makeHeightIndex } from '../landmarks/vendor/map/buildings.js';
import { buildLandmarks } from '../landmarks/vendor/landmarks/landmarks.js';
import { buildResorts } from '../landmarks/vendor/landmarks/resorts.js';
import { buildArenas } from '../landmarks/vendor/landmarks/arenas.js';
import { buildDetails } from '../landmarks/vendor/landmarks/details.js';
import { welcomeSign } from '../landmarks/vendor/landmarks/welcome.js';
import { buildSigns } from '../landmarks/vendor/landmarks/signs.js';
import { buildRailways } from './railways.js';
import { buildTropicanaTrio } from './tropicana-trio.js';
import { buildFourCorners } from './four-corners.js';
import { buildWynn } from './wynn-ti.js';
import { buildRio } from './rio.js';
import { buildNorthStrip } from './north-strip.js';
import { buildLuxor } from './luxor.js';
import { buildMandalayBay } from './mandalay-bay.js';
import { stripModels } from './landmark-models.js';
import { isRialtoBridge } from './venetian-palazzo.js';
import { buildBellagioArchitecture, claimBellagioBridgeBuildings, isBellagioSkybridgeWalk } from './bellagio-drive-roads.mjs';

const THREE = window.THREE;

/** Runs one builder and records it in the Performance timeline (DevTools → Performance → Timings). */
function stage(label, build) {
  const mark = `city:${label}`;
  performance.mark(mark);
  const result = build();
  performance.measure(mark, mark);
  return result;
}

/**
 * Builds the city in the order it becomes useful to look at:
 *   1. ground work  – lane graph and valet plan
 *   2. skyline      – landmarks, resorts and every other building  → engine.reveal('skyline')
 *   3. streets      – intersection plan (once), roads, valets, bridges, rail, trees, lights, signs
 * The three groups are handed to the engine up front so each phase can appear as soon as it exists.
 */
export async function buildCity(data, engine) {
  const buildings = new THREE.Group(), roads = new THREE.Group(), detail = new THREE.Group();
  buildings.name = 'Vegas buildings'; roads.name = 'Street network'; detail.name = 'City life';
  engine.attach?.({ buildings, roads, detail });

  engine.progress('Mapping the Strip…', 0.1);
  const graph = stage('lane graph', () => buildLaneGraph(data));
  const valetPlan = stage('valet plan', () => planValets(data));
  await engine.yield();
  engine.progress('Raising the skyline…', 0.45);
  // The clearance-aware rail renderer below owns guideways and supports.
  const specialData = { ...data, rail: [] };
  buildings.add(stage('landmarks', () => buildLandmarks(specialData, engine)), buildArenas(data, engine));
  const resorts = stage('resorts', () => buildResorts(data, engine));
  buildings.add(resorts.group, buildDetails(specialData, engine, graph), welcomeSign(engine));
  await engine.yield();
  // Must run before buildBuildings: these claim the tower footprints they model by hand.
  stage('hero resorts', () => {
    buildings.add(buildTropicanaTrio(specialData, graph), buildFourCorners(specialData), buildWynn(specialData));
    buildings.add(buildRio(specialData, graph), buildNorthStrip(specialData, graph, engine));
    buildings.add(buildLuxor(specialData, graph), buildMandalayBay(specialData, graph));
    for (const item of stripModels) buildings.add(item.build(specialData, undefined, engine, graph));
    claimBellagioBridgeBuildings(specialData, heroOwned);
  });
  buildings.add(stage('buildings', () => buildBuildings(data, valetPlan)).group);
  engine.reveal?.('skyline');
  await engine.paint();

  engine.progress('Planning intersections…', 0.52);
  const plan = stage('intersections', () => planIntersections(data, graph));
  await engine.yield();
  engine.progress('Paving the streets…', 0.6);
  performance.mark('city:roads');
  const roadOutput = await buildRoads(data, graph, valetPlan.zones, plan, engine.yield);
  performance.measure('city:roads', 'city:roads');
  const valets = stage('valets', () => buildValets(data, valetPlan, graph));
  graph.valets = valets.stops;
  buildings.add(valets.group);
  roads.add(roadOutput.group, buildStreetNames(graph, roadOutput.crossingGaps));
  engine.reveal?.('roads');
  await engine.yield();
  engine.progress('Opening bridges…', 0.85);
  const genericBridgeData = { ...data, walks: data.walks.filter(w => !isRialtoBridge(w) && !isBellagioSkybridgeWalk(w)) };
  detail.add(
    stage('skybridges', () => buildSkybridges(genericBridgeData, graph)),
    stage('bellagio-arch', () => buildBellagioArchitecture()),
    stage('railways', () => buildRailways(data, graph, engine)),
  );
  await engine.yield();
  engine.progress('Bringing the city to life…', 0.93);
  detail.add(stage('trees', () => buildTrees(data, graph, roadOutput.planting)));
  const lights = buildCityLights(data);
  detail.add(lights.group, stage('streetscape', () => buildStreetscape(graph, engine, lights.spots)), buildSigns(data, graph));
  engine.reveal?.('streets');
  return { graph, buildings, roads, detail, bridgeDecks: roadOutput.bridgeDecks, heightAt: makeHeightIndex(data, resorts.heights) };
}
