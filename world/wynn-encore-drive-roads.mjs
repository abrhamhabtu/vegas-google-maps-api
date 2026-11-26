import {
  addDashed, addZebra, arrowPolysWorld, boundsOfPoly, circleRing,
  clearLayersInPoly, clipOp, ctDifference, ctIntersection, ctUnion,
  emitCurbFaces, emitPolygons, exToPaths, offsetPaths, polyCum,
  ribbonRing, roundCorners, slicePoly, smoothPoly, toClipRing,
} from './resort-drive-kit.mjs';

// Wynn Las Vegas Main Gate Drive & Porte-Cochere Rotary + Encore Porte-Cochere Motor Court.
// Local coordinates in metres: x east, y up, z south.
// Stays strictly east of S Las Vegas Blvd's east Strip crosswalk and southwest of Encore Resort Blvd.

export const WYNN_CLIP_POLY = [
  [626.0, -1274.0],
  [742.0, -1262.0],
  [742.0, -1192.0],
  [664.0, -1194.0],
  [614.0, -1248.0],
];

export const ENCORE_CLIP_POLY = [
  [834.0, -1536.0],
  [906.0, -1526.0],
  [960.0, -1476.0],
  [960.0, -1452.0],
  [896.0, -1452.0],
  [834.0, -1512.0],
];

export function finishWynnEncoreDrivePavement(layers) {
  const { major, sidewalk, concreteMedians, medianPlanting, curb, curbFaces, paint, paintDim } = layers;

  // ── 1. WYNN MAIN GATE DRIVE & PORTE-COCHERE ROTARY ──
  const wynnClip = [toClipRing(WYNN_CLIP_POLY)];
  clearLayersInPoly(layers, boundsOfPoly(WYNN_CLIP_POLY), wynnClip, WYNN_CLIP_POLY);

  const cx = 692.5, cz = -1233.5;
  const rotaryOuter = toClipRing(circleRing(cx, cz, 29.8, 96));

  // South porte-cochere bulge under Wynn's canopy (687..720, -1218..-1193) + east valet staging arc (x = 728)
  const canopyCourt = roundCorners([toClipRing([
    [668.0, -1218.0],
    [682.0, -1201.0],
    [714.0, -1200.5],
    [731.0, -1215.0],
    [732.0, -1244.0],
    [716.0, -1255.0],
    [672.0, -1245.0],
  ])], 5.0);

  // Inbound EB Main Gate Dr (extended past Strip seam for curb-free mouth)
  const inCenter = smoothPoly([
    [610.0, -1260.0],
    [624.0, -1251.5],
    [646.0, -1240.0],
    [666.0, -1228.5],
    [682.0, -1214.0],
  ], 4);
  const inCum = polyCum(inCenter);

  // Outer SW valet bypass curve (960111421)
  const swBypass = smoothPoly([
    [626.0, -1250.0],
    [646.0, -1230.0],
    [664.0, -1217.5],
    [682.0, -1207.5],
  ], 4);

  // Outbound WB Main Gate Dr (extended past Strip seam for curb-free mouth)
  const outCenter = smoothPoly([
    [704.0, -1253.0],
    [678.0, -1255.0],
    [653.5, -1255.2],
    [635.0, -1264.0],
    [616.0, -1272.5],
  ], 4);
  const outCum = polyCum(outCenter);

  // Clean east exit spur toward Wynn garage (960111420)
  const eastSpur = [
    [706.0, -1251.0],
    [734.0, -1249.2],
  ];

  // Continuous west Strip mouth throat across [[626,-1274],[614,-1248]]
  const stripMouth = toClipRing([
    [610.0, -1276.0],
    [634.0, -1271.0],
    [628.0, -1244.0],
    [608.0, -1251.0],
  ]);

  const wynnRaw = exToPaths(clipOp(ctUnion, [
    rotaryOuter, ...canopyCourt,
    toClipRing(ribbonRing(inCenter, 4.6)),
    toClipRing(ribbonRing(swBypass, 3.8)),
    toClipRing(ribbonRing(outCenter, 4.6)),
    toClipRing(ribbonRing(eastSpur, 3.4)),
    stripMouth,
  ]));
  const wynnSmooth = offsetPaths(offsetPaths(wynnRaw, 2.0), -2.0);

  // Circular Wynn Porte-Cochere Landscaped Garden Island + Main Gate Dr Teardrop Approach Median
  const wynnCenterGarden = [toClipRing(circleRing(692.0, -1236.0, 13.4, 72))];
  const wynnGateMedian = roundCorners([toClipRing([
    [631.0, -1256.8],
    [662.0, -1247.8],
    [664.5, -1240.5],
    [654.0, -1241.5],
    [629.0, -1253.2],
  ])], 1.4);

  const wynnIslands = [...wynnCenterGarden, ...wynnGateMedian];
  const wynnDrivableUnclipped = exToPaths(clipOp(ctDifference, wynnSmooth, wynnIslands));
  const wynnDrivableEx = clipOp(ctIntersection, wynnDrivableUnclipped, wynnClip);
  const wynnDrivablePaths = exToPaths(wynnDrivableEx);
  emitPolygons(major, wynnDrivableEx, 0, 0.05);

  const wynnIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, wynnIslands)), wynnClip);
  const wynnIslandPaths = exToPaths(wynnIslandsEx);
  emitPolygons(concreteMedians, wynnIslandsEx, 0.11, 0.2);
  const wynnGreenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(wynnCenterGarden, -0.7),
    ...offsetPaths(wynnGateMedian, -0.45),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, wynnGreenRaw, wynnIslandPaths), 0.124, 0.3);

  const wynnWalkBand = offsetPaths(wynnDrivableUnclipped, 2.4);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, wynnWalkBand, [...wynnDrivableUnclipped, ...wynnIslandPaths])), wynnClip), 0.11, 0.35);

  const wynnIslandCurb = exToPaths(clipOp(ctDifference, wynnIslandPaths, offsetPaths(wynnIslandPaths, -0.18)));
  const wynnOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(wynnDrivableUnclipped, 0.18), [...wynnDrivableUnclipped, ...wynnIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...wynnIslandCurb, ...wynnOuterCurb])), wynnClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, wynnIslandPaths, 0, 0.17, WYNN_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, wynnOuterCurb, wynnClip)), 0, 0.17, WYNN_CLIP_POLY);

  const wWhite = [], wDim = [];
  const rotaryDash = circleRing(692.0, -1236.0, 20.8, 72); rotaryDash.push(rotaryDash[0]);
  addDashed(wWhite, rotaryDash, 2.3, 4.0, 0.072);
  const inDash = slicePoly(inCenter, inCum, 14.0, inCum.at(-1) - 10.0);
  if (inDash.length >= 2) addDashed(wWhite, inDash, 2.3, 4.0, 0.072);
  const outDash = slicePoly(outCenter, outCum, 10.0, outCum.at(-1) - 14.0);
  if (outDash.length >= 2) addDashed(wWhite, outDash, 2.3, 4.0, 0.072);
  addZebra(wWhite, [676.0, -1220.5], [685.0, -1205.5], 2.8);
  for (const [ax, az, hx, hz] of [
    [645.0, -1240.0, 0.87, 0.49],
    [646.0, -1258.5, -0.90, -0.44],
    [694.0, -1212.0, 0.99, 0.08],
    [714.0, -1234.0, 0.04, -0.99],
  ]) {
    wDim.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 2.9));
  }
  const wWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, wWhite)), wynnDrivablePaths);
  const wDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, wDim)), wynnDrivablePaths)), exToPaths(wWhiteEx));
  emitPolygons(paint, wWhiteEx, 0, 0.005);
  emitPolygons(paintDim, wDimEx, 0, 0.005);

  // ── 2. ENCORE PORTE-COCHERE MOTOR COURT (x = 834 .. 960, z = -1536 .. -1452) ──
  const encoreClip = [toClipRing(ENCORE_CLIP_POLY)];
  clearLayersInPoly(layers, boundsOfPoly(ENCORE_CLIP_POLY), encoreClip, ENCORE_CLIP_POLY);

  const encOuter = smoothPoly([
    [846.0, -1538.0],
    [855.0, -1519.0],
    [868.0, -1505.0],
    [884.0, -1489.0],
    [905.0, -1475.0],
    [932.0, -1463.0],
    [963.0, -1462.5],
  ], 4);
  const encOuterCum = polyCum(encOuter);

  const encInner = smoothPoly([
    [877.0, -1540.0],
    [883.0, -1516.0],
    [892.0, -1496.0],
    [910.0, -1482.5],
    [937.0, -1471.0],
    [963.0, -1468.0],
  ], 4);

  const encCross = smoothPoly([
    [856.0, -1513.0],
    [872.0, -1509.0],
    [892.0, -1506.0],
  ], 3);

  const encRaw = exToPaths(clipOp(ctUnion, [
    toClipRing(ribbonRing(encOuter, 5.6)),
    toClipRing(ribbonRing(encInner, 4.8)),
    toClipRing(ribbonRing(encCross, 3.8)),
  ]));
  const encSmooth = offsetPaths(offsetPaths(encRaw, 1.8), -1.8);

  const encNorthIsland = roundCorners([toClipRing([
    [861.0, -1527.0],
    [876.0, -1525.0],
    [875.5, -1514.5],
    [864.0, -1515.5],
  ])], 1.8);
  const encSouthIsland = roundCorners([toClipRing([
    [877.0, -1503.0],
    [886.0, -1500.5],
    [882.0, -1493.5],
    [875.0, -1496.5],
  ])], 1.3);

  const encIslands = [...encNorthIsland, ...encSouthIsland];
  const encDrivableUnclipped = exToPaths(clipOp(ctDifference, encSmooth, encIslands));
  const encDrivableEx = clipOp(ctIntersection, encDrivableUnclipped, encoreClip);
  const encDrivablePaths = exToPaths(encDrivableEx);
  emitPolygons(major, encDrivableEx, 0, 0.05);

  const encIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, encIslands)), encoreClip);
  const encIslandPaths = exToPaths(encIslandsEx);
  emitPolygons(concreteMedians, encIslandsEx, 0.11, 0.2);
  const encGreenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(encNorthIsland, -0.45),
    ...offsetPaths(encSouthIsland, -0.38),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, encGreenRaw, encIslandPaths), 0.124, 0.25);

  const encWalkBand = offsetPaths(encDrivableUnclipped, 2.3);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, encWalkBand, [...encDrivableUnclipped, ...encIslandPaths])), encoreClip), 0.11, 0.35);

  const encIslandCurb = exToPaths(clipOp(ctDifference, encIslandPaths, offsetPaths(encIslandPaths, -0.18)));
  const encOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(encDrivableUnclipped, 0.18), [...encDrivableUnclipped, ...encIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...encIslandCurb, ...encOuterCurb])), encoreClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, encIslandPaths, 0, 0.17, ENCORE_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, encOuterCurb, encoreClip)), 0, 0.17, ENCORE_CLIP_POLY);

  const eWhite = [], eDim = [];
  const eDash = slicePoly(encOuter, encOuterCum, 10.0, encOuterCum.at(-1) - 10.0);
  if (eDash.length >= 2) addDashed(eWhite, eDash, 2.3, 4.0, 0.072);
  addZebra(eWhite, [901.0, -1482.5], [910.0, -1470.5], 2.8);
  eDim.push(...arrowPolysWorld(884.0, -1489.0, 0.72, 0.69, ['through'], 2.9));
  eDim.push(...arrowPolysWorld(928.0, -1466.0, 0.91, 0.41, ['through'], 2.9));
  const eWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, eWhite)), encDrivablePaths);
  const eDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, eDim)), encDrivablePaths)), exToPaths(eWhiteEx));
  emitPolygons(paint, eWhiteEx, 0, 0.005);
  emitPolygons(paintDim, eDimEx, 0, 0.005);
}
