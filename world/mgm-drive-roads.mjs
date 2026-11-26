import {
  addDashed, addZebra, arrowPolysWorld, boundsOfPoly,
  clearLayersInPoly, clipOp, ctDifference, ctIntersection, ctUnion,
  emitCurbFaces, emitPolygons, exToPaths, offsetPaths, polyCum,
  ribbonRing, roundCorners, slicePoly, smoothPoly, toClipRing,
} from './resort-drive-kit.mjs';

// MGM Grand Porte-Cochere Motor Court & Tropicana Entrance Loops.
// Local coordinates in metres: x east, y up, z south.
// Stays strictly north of E Tropicana Ave (z <= 1686.5) and west of the Audrie St / garage overpass
// so Tropicana Ave and Carbon's Strip/Tropicana intersections remain completely untouched.

export const MGM_CLIP_POLY = [
  [468.0, 1666.0],
  [494.0, 1622.0],
  [548.0, 1582.0],
  [608.0, 1582.0],
  [626.0, 1624.0],
  [628.0, 1650.0],
  [596.0, 1686.5],
  [468.0, 1686.5],
];

export function finishMgmDrivePavement(layers) {
  const { major, sidewalk, concreteMedians, medianPlanting, curb, curbFaces, paint, paintDim } = layers;

  const clipSection = [toClipRing(MGM_CLIP_POLY)];
  clearLayersInPoly(layers, boundsOfPoly(MGM_CLIP_POLY), clipSection, MGM_CLIP_POLY);

  // 1. UNIFIED MGM GRAND PORTE-COCHERE MOTOR COURT (covers Google Road bulge + Satellite canopy plaza!)
  const motorCourt = roundCorners([toClipRing([
    [501.0, 1648.0],
    [516.0, 1618.0],
    [546.0, 1592.0],
    [574.0, 1585.0],
    [605.0, 1587.0],
    [618.0, 1616.0],
    [617.0, 1646.0],
    [594.0, 1678.0],
    [556.0, 1685.5],
    [512.0, 1685.5],
    [496.0, 1668.0],
  ])], 6.0);

  // West Tropicana Ave exit / entry mouth (extended west of x = 468 for curb-free mouth)
  const westLeg = smoothPoly([
    [460.0, 1675.0],
    [486.0, 1674.8],
    [501.0, 1669.0],
    [511.0, 1652.0],
    [526.0, 1630.0],
    [560.0, 1598.0],
    [588.0, 1590.5],
    [606.0, 1591.5],
    [622.0, 1574.0],
  ], 4);
  const westLegCum = polyCum(westLeg);

  // Outer south & east loop connecting back toward garage / Audrie ramp (extended east of x = 628)
  const eastLoop = smoothPoly([
    [504.0, 1668.0],
    [522.0, 1681.5],
    [560.0, 1681.5],
    [588.0, 1677.5],
    [608.0, 1664.0],
    [635.0, 1639.0],
  ], 4);
  const eastLoopCum = polyCum(eastLoop);

  // North stub toward MGM service portal (401340356 / 700008974)
  const northStub = [
    [581.0, 1592.0],
    [581.2, 1574.0],
  ];

  const rawAsphalt = exToPaths(clipOp(ctUnion, [
    ...motorCourt,
    toClipRing(ribbonRing(westLeg, 5.2)),
    toClipRing(ribbonRing(eastLoop, 4.8)),
    toClipRing(ribbonRing(northStub, 3.6)),
  ]));
  const smoothAsphalt = offsetPaths(offsetPaths(rawAsphalt, 1.8), -1.8);

  // 2. TWO SATELLITE-ALIGNED LANDSCAPED GARDEN ISLANDS INSIDE MGM GRAND'S PORTE-COCHERE COURT
  // Large SE elliptical landscaped garden island (x = 553..604, z = 1623..1674)
  const seGarden = roundCorners([toClipRing([
    [555.0, 1654.0],
    [582.0, 1622.5],
    [603.5, 1624.5],
    [604.0, 1644.0],
    [586.0, 1671.5],
    [556.0, 1673.0],
  ])], 5.5);

  // SW valet-bay landscaped island (x = 519..543, z = 1659..1674)
  const swIsland = roundCorners([toClipRing([
    [519.5, 1664.0],
    [542.5, 1659.5],
    [543.5, 1673.0],
    [520.0, 1673.5],
  ])], 3.2);

  const allIslands = [...seGarden, ...swIsland];
  const drivableUnclipped = exToPaths(clipOp(ctDifference, smoothAsphalt, allIslands));
  const drivableEx = clipOp(ctIntersection, drivableUnclipped, clipSection);
  const drivablePaths = exToPaths(drivableEx);
  emitPolygons(major, drivableEx, 0, 0.05);

  const islandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, allIslands)), clipSection);
  const islandPaths = exToPaths(islandsEx);
  emitPolygons(concreteMedians, islandsEx, 0.11, 0.2);
  const greenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(seGarden, -0.75),
    ...offsetPaths(swIsland, -0.5),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, greenRaw, islandPaths), 0.124, 0.3);

  const outerWalkBand = offsetPaths(drivableUnclipped, 2.3);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...drivableUnclipped, ...islandPaths])), clipSection), 0.11, 0.35);

  const islandCurb = exToPaths(clipOp(ctDifference, islandPaths, offsetPaths(islandPaths, -0.18)));
  const outerCurb = exToPaths(clipOp(ctDifference, offsetPaths(drivableUnclipped, 0.18), [...drivableUnclipped, ...islandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurb, ...outerCurb])), clipSection), 0.17, 0.05);
  emitCurbFaces(curbFaces, islandPaths, 0, 0.17, MGM_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, outerCurb, clipSection)), 0, 0.17, MGM_CLIP_POLY);

  // 3. LANE DIVIDERS, ARROWS & PORTE-COCHERE ZEBRA CROSSWALK
  const whitePolys = [], dimPolys = [];
  const mainDash = slicePoly(westLeg, westLegCum, 14.0, westLegCum.at(-1) - 18.0);
  if (mainDash.length >= 2) addDashed(whitePolys, mainDash, 2.4, 4.2, 0.072);
  const eastDash = slicePoly(eastLoop, eastLoopCum, 10.0, eastLoopCum.at(-1) - 12.0);
  if (eastDash.length >= 2) addDashed(whitePolys, eastDash, 2.4, 4.2, 0.072);
  // Inner porte-cochere valet lane divider (parallel to canopy)
  addDashed(whitePolys, [[576.0, 1608.0], [540.0, 1644.0]], 2.2, 3.8, 0.072);
  // Satellite-matched diagonal zebra crosswalk under MGM's octagonal canopy
  addZebra(whitePolys, [539.5, 1609.0], [552.5, 1621.5], 2.8);
  for (const [ax, az, hx, hz] of [
    [562.0, 1597.0, -0.73, 0.68],
    [516.0, 1642.0, -0.58, 0.81],
    [566.0, 1681.5, 0.99, -0.05],
    [611.0, 1632.0, -0.1, -0.99],
  ]) {
    dimPolys.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 2.9));
  }
  const whiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, whitePolys)), drivablePaths);
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, dimPolys)), drivablePaths)), exToPaths(whiteEx));
  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);
}
