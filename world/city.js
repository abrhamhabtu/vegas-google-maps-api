// Scene composition from vegas-strip-v2. All rendered lanes and drivers share graph.
import { buildLaneGraph } from '../landmarks/vendor/map/lanegraph.js';
import { planValets, buildValets } from '../landmarks/vendor/map/valets.js';
import { buildBuildings, heroOwned, makeHeightIndex } from '../landmarks/vendor/map/buildings.js';
import { buildLandmarks } from '../landmarks/vendor/landmarks/landmarks.js';
import { buildResorts } from '../landmarks/vendor/landmarks/resorts.js';
import { buildArenas } from '../landmarks/vendor/landmarks/arenas.js';
import { buildTropicanaTrio } from './tropicana-trio.js';
import { buildFourCorners } from './four-corners.js';
import { buildWynn } from './wynn-ti.js';
import { buildRio } from './rio.js';
import { buildNorthStrip } from './north-strip.js';
import { buildLuxor } from './luxor.js';
import { buildMandalayBay } from './mandalay-bay.js';
import { stripModels } from './landmark-models.js';
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
 *   3. streets      – intersection plan (once), roads, street names → engine.reveal('roads')
 *   4. details      – streamed cooperatively after the city is live (valets, coaster/trams,
 *                     welcome sign, skybridges, rail, trees, lights, streetscape, signs)
 * The three groups are handed to the engine up front so each phase can appear as soon as it exists.
 */
export async function buildCity(data, engine) {
  // Start downloading post-skyline modules immediately so they overlap with lane graph + skyline CPU work.
  const streetModulesPromise = Promise.all([
    import('../landmarks/vendor/map/intersections.js'),
    import('../landmarks/vendor/map/roads.js'),
    import('../landmarks/vendor/map/names.js'),
  ]);
  const detailModulesPromise = Promise.all([
    import('../landmarks/vendor/landmarks/details.js'),
    import('../landmarks/vendor/landmarks/welcome.js'),
    import('../landmarks/vendor/map/skybridges.js'),
    import('./railways.js'),
    import('../landmarks/vendor/map/trees.js'),
    import('../landmarks/vendor/map/citylights.js'),
    import('../landmarks/vendor/map/streetscape.js'),
    import('../landmarks/vendor/landmarks/signs.js'),
    import('./venetian-palazzo.js'),
  ]);

  const buildings = new THREE.Group(), roads = new THREE.Group(), detail = new THREE.Group();
  buildings.name = 'Vegas buildings'; roads.name = 'Street network'; detail.name = 'City life';
  engine.attach?.({ buildings, roads, detail });

  engine.progress('Mapping the Strip…', 0.1);
  const graph = stage('lane graph', () => buildLaneGraph(data));
  const valetPlan = stage('valet plan', () => planValets(data));
  await engine.yield();
  if (engine.isDisposed?.()) return null;

  engine.progress('Raising the skyline…', 0.45);
  // The clearance-aware rail renderer below owns guideways and supports.
  const specialData = { ...data, rail: [] };
  buildings.add(stage('landmarks', () => buildLandmarks(specialData, engine)), buildArenas(data, engine));
  const resorts = stage('resorts', () => buildResorts(data, engine));
  buildings.add(resorts.group);
  // Must run before buildBuildings: these claim the tower footprints they model by hand.
  stage('hero resorts', () => {
    buildings.add(buildTropicanaTrio(specialData, graph), buildFourCorners(specialData), buildWynn(specialData));
    buildings.add(buildRio(specialData, graph), buildNorthStrip(specialData, graph, engine));
    buildings.add(buildLuxor(specialData, graph), buildMandalayBay(specialData, graph));
    for (const item of stripModels) buildings.add(item.build(specialData, undefined, engine, graph));
    claimBellagioBridgeBuildings(specialData, heroOwned);
  });
  buildings.add(stage('buildings', () => buildBuildings(data, valetPlan)).group);
  engine.reveal?.('skyline', buildings);
  await engine.paint();
  if (engine.isDisposed?.()) return null;

  engine.progress('Planning intersections…', 0.55);
  const [{ planIntersections }, { buildRoads }, { buildStreetNames }] = await streetModulesPromise;
  if (engine.isDisposed?.()) return null;
  const plan = stage('intersections', () => planIntersections(data, graph));
  await engine.yield();
  if (engine.isDisposed?.()) return null;

  engine.progress('Paving the streets…', 0.65);
  performance.mark('city:roads');
  // Coalesce frequent 28ms road-loop yields to ~140ms slices so buildRoads finishes far faster
  // without stalling repeatedly on full MapLibre + WebGL skyline repaints while keeping UI responsive.
  let lastRoadYield = performance.now();
  const roadYield = async () => {
    const now = performance.now();
    if (now - lastRoadYield < 140) return;
    await engine.yield();
    lastRoadYield = performance.now();
  };
  const roadOutput = await buildRoads(data, graph, valetPlan.zones, plan, roadYield);
  performance.measure('city:roads', 'city:roads');
  if (engine.isDisposed?.()) return null;

  roads.add(roadOutput.group, buildStreetNames(graph, roadOutput.crossingGaps));
  engine.reveal?.('roads', roads);

  const heightAt = makeHeightIndex(data, resorts.heights);

  // Non-critical secondary details stream in cooperatively after the city is already live and interactive.
  async function finishDetails(onBatch) {
    const [
      { buildDetails },
      { welcomeSign },
      { buildSkybridges },
      { buildRailways },
      { buildTrees },
      { buildCityLights },
      { buildStreetscape },
      { buildSigns },
      { isRialtoBridge },
    ] = await detailModulesPromise;
    if (engine.isDisposed?.()) return;

    await engine.yield();
    if (engine.isDisposed?.()) return;
    const valets = stage('valets', () => buildValets(data, valetPlan, graph));
    graph.valets = valets.stops;
    buildings.add(valets.group);
    onBatch?.(valets.group);

    await engine.yield();
    if (engine.isDisposed?.()) return;
    const stripDetails = stage('details', () => buildDetails(specialData, engine, graph));
    const welcome = stage('welcome', () => welcomeSign(engine));
    buildings.add(stripDetails, welcome);
    onBatch?.(stripDetails);
    onBatch?.(welcome);

    await engine.yield();
    if (engine.isDisposed?.()) return;
    const genericBridgeData = { ...data, walks: data.walks.filter(w => !isRialtoBridge(w) && !isBellagioSkybridgeWalk(w)) };
    const skybridges = stage('skybridges', () => buildSkybridges(genericBridgeData, graph));
    const bellagioArch = stage('bellagio-arch', () => buildBellagioArchitecture());
    detail.add(skybridges, bellagioArch);
    onBatch?.(skybridges);
    onBatch?.(bellagioArch);

    await engine.yield();
    if (engine.isDisposed?.()) return;
    const railways = stage('railways', () => buildRailways(data, graph, engine));
    detail.add(railways);
    onBatch?.(railways);

    await engine.yield();
    if (engine.isDisposed?.()) return;
    const trees = stage('trees', () => buildTrees(data, graph, roadOutput.planting));
    detail.add(trees);
    onBatch?.(trees);

    await engine.yield();
    if (engine.isDisposed?.()) return;
    const lights = buildCityLights(data);
    const streetscape = stage('streetscape', () => buildStreetscape(graph, engine, lights.spots));
    const signs = stage('signs', () => buildSigns(data, graph));
    detail.add(lights.group, streetscape, signs);
    onBatch?.(lights.group);
    onBatch?.(streetscape);
    onBatch?.(signs);

    engine.reveal?.('streets', detail);
    performance.mark('scene:details complete');
  }

  return { graph, buildings, roads, detail, bridgeDecks: roadOutput.bridgeDecks, heightAt, finishDetails };
}
