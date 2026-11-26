import {
  addDashed, addZebra, arrowPolysWorld, boundsOfPoly,
  clearLayersInPoly, clipOp, ctDifference, ctIntersection, ctUnion,
  emitCurbFaces, emitPolygons, exToPaths, offsetPaths, polyCum,
  ribbonRing, roundCorners, slicePoly, smoothPoly, toClipRing,
} from './resort-drive-kit.mjs';

// Mandalay Bay Curved Porte-Cochere Motor Court & Las Vegas Blvd Entrance Drives.
// Local coordinates in metres: x east, y up, z south.
// Stays strictly west of S Las Vegas Blvd's southbound curb (x <= 125.0) and preserves
// Mandalay Bay's green frontage lawns (frontagePlanting).

export const MANDALAY_CLIP_POLY = [
  [16.0, 2618.0],
  [66.0, 2618.0],
  [104.0, 2662.0],
  [125.0, 2694.0],
  [125.0, 2762.0],
  [92.0, 2762.0],
  [54.0, 2732.0],
  [16.0, 2684.0],
];

export function finishMandalayDrivePavement(layers) {
  const { major, sidewalk, concreteMedians, medianPlanting, curb, curbFaces, paint, paintDim } = layers;

  const clipSection = [toClipRing(MANDALAY_CLIP_POLY)];
  // Preserve Mandalay Bay's lush green frontage lawns outside the paved corridor
  clearLayersInPoly({ ...layers, frontagePlanting: null }, boundsOfPoly(MANDALAY_CLIP_POLY), clipSection, MANDALAY_CLIP_POLY);

  // 1. SWEEPING CURVED PORTE-COCHERE ARRIVAL PLAZA (smooth curve covering Google Road's wide west arc!)
  const mainPorteCochere = smoothPoly([
    [27.5, 2610.0],
    [26.0, 2642.0],
    [26.8, 2666.0],
    [34.5, 2688.0],
    [47.5, 2704.0],
    [68.0, 2718.0],
    [94.0, 2733.0],
    [108.5, 2750.0],
    [114.0, 2768.0],
  ], 5);
  const mainCum = polyCum(mainPorteCochere);

  // Outer south return lane parallel to main arrival (399554532)
  const southInner = smoothPoly([
    [68.0, 2718.0],
    [88.0, 2736.0],
    [101.0, 2752.0],
    [105.5, 2768.0],
  ], 4);

  // Inner curved north return loop from porte-cochere (707026939)
  const northInner = smoothPoly([
    [68.0, 2716.0],
    [79.5, 2696.0],
    [83.2, 2678.0],
    [79.5, 2657.0],
    [68.0, 2639.0],
    [53.0, 2622.0],
    [48.0, 2612.0],
  ], 4);
  const northInnerCum = polyCum(northInner);

  // Outer curved Strip inbound approach sweeping north toward Mandalay garage/valet (1012756548 + 399554472)
  const stripInbound = smoothPoly([
    [131.0, 2704.5],
    [110.0, 2703.2],
    [97.5, 2698.0],
    [93.0, 2682.0],
    [89.5, 2661.0],
    [78.0, 2641.0],
    [62.0, 2626.0],
    [49.0, 2612.0],
  ], 4);

  // Strip inbound direct connector into porte-cochere throat (707026938 + 399554500)
  const stripDirect = smoothPoly([
    [98.0, 2698.5],
    [86.0, 2710.5],
    [68.0, 2717.0],
  ], 3);

  // Strip outbound exit sweeping east to S Las Vegas Blvd (399554529)
  const stripOutbound = smoothPoly([
    [80.0, 2712.5],
    [95.0, 2717.8],
    [114.0, 2719.8],
    [131.0, 2722.5],
  ], 4);

  // Wide motor-court apron under Mandalay Bay's curved canopy so Google Road's outer west arc is 100% covered
  const canopyPad = roundCorners([toClipRing([
    [20.2, 2620.0],
    [36.5, 2620.0],
    [36.5, 2664.0],
    [52.0, 2695.0],
    [74.0, 2712.0],
    [64.0, 2722.0],
    [39.0, 2705.0],
    [21.0, 2674.0],
  ])], 4.5);

  const rawAsphalt = exToPaths(clipOp(ctUnion, [
    ...canopyPad,
    toClipRing(ribbonRing(mainPorteCochere, 5.4)),
    toClipRing(ribbonRing(southInner, 3.8)),
    toClipRing(ribbonRing(northInner, 3.6)),
    toClipRing(ribbonRing(stripInbound, 3.8)),
    toClipRing(ribbonRing(stripDirect, 4.0)),
    toClipRing(ribbonRing(stripOutbound, 3.8)),
  ]));
  const smoothAsphalt = offsetPaths(offsetPaths(rawAsphalt, 1.8), -1.8);

  // 2. SLEEK LANDSCAPED MEDIANS & SPLITTER ISLANDS (matching Google Satellite & preserving lawns!)
  // Curved center median separating north inner return & Strip inbound curve
  const curveMedian = roundCorners([toClipRing([
    [62.0, 2630.0],
    [74.0, 2642.0],
    [84.5, 2662.0],
    [87.5, 2684.0],
    [85.0, 2698.0],
    [81.5, 2697.0],
    [84.5, 2682.0],
    [81.5, 2662.0],
    [71.0, 2644.0],
    [59.5, 2632.0],
  ])], 1.1);

  // Small teardrop splitter triangle between Strip inbound & Strip outbound at x = 90..112, z = 2707..2715
  const stripSplitter = roundCorners([toClipRing([
    [93.0, 2708.5],
    [114.0, 2708.0],
    [114.0, 2715.0],
    [95.0, 2713.5],
  ])], 1.6);

  const allIslands = [...curveMedian, ...stripSplitter];
  const drivableUnclipped = exToPaths(clipOp(ctDifference, smoothAsphalt, allIslands));
  const drivableEx = clipOp(ctIntersection, drivableUnclipped, clipSection);
  const drivablePaths = exToPaths(drivableEx);
  emitPolygons(major, drivableEx, 0, 0.05);

  const islandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, allIslands)), clipSection);
  const islandPaths = exToPaths(islandsEx);
  emitPolygons(concreteMedians, islandsEx, 0.11, 0.2);
  const greenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(curveMedian, -0.4),
    ...offsetPaths(stripSplitter, -0.5),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, greenRaw, islandPaths), 0.124, 0.25);

  const outerWalkBand = offsetPaths(drivableUnclipped, 2.2);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...drivableUnclipped, ...islandPaths])), clipSection), 0.11, 0.35);

  const islandCurb = exToPaths(clipOp(ctDifference, islandPaths, offsetPaths(islandPaths, -0.18)));
  const outerCurb = exToPaths(clipOp(ctDifference, offsetPaths(drivableUnclipped, 0.18), [...drivableUnclipped, ...islandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurb, ...outerCurb])), clipSection), 0.17, 0.05);
  emitCurbFaces(curbFaces, islandPaths, 0, 0.17, MANDALAY_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, outerCurb, clipSection)), 0, 0.17, MANDALAY_CLIP_POLY);

  // 3. LANE MARKINGS, FLOW ARROWS & PORTE-COCHERE ZEBRA CROSSWALK
  const whitePolys = [], dimPolys = [];
  const mainDash = slicePoly(mainPorteCochere, mainCum, 10.0, mainCum.at(-1) - 10.0);
  if (mainDash.length >= 2) addDashed(whitePolys, mainDash, 2.4, 4.2, 0.072);
  const northDash = slicePoly(northInner, northInnerCum, 12.0, northInnerCum.at(-1) - 10.0);
  if (northDash.length >= 2) addDashed(whitePolys, northDash, 2.2, 4.0, 0.07);
  addZebra(whitePolys, [23.0, 2655.0], [34.0, 2655.0], 2.8);
  for (const [ax, az, hx, hz] of [
    [27.0, 2640.0, 0.0, 1.0],
    [45.0, 2701.0, 0.72, 0.69],
    [82.5, 2678.0, -0.08, -0.99],
    [106.0, 2719.0, 0.99, 0.12],
    [104.0, 2743.0, 0.66, 0.75],
  ]) {
    dimPolys.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 2.9));
  }
  const whiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, whitePolys)), drivablePaths);
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, dimPolys)), drivablePaths)), exToPaths(whiteEx));
  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);
}
