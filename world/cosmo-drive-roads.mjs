import {
  addDashed, addRibbon, addZebra, arrowPolysWorld, boundsOfPoly,
  clearLayersInPoly, clipOp, ctDifference, ctIntersection, ctUnion,
  emitCurbFaces, emitPolygons, exToPaths, offsetPaths, polyCum,
  ribbonRing, roundCorners, slicePoly, smoothPoly, toClipRing,
} from './resort-drive-kit.mjs';

// The Cosmopolitan (Harmon Ave North Porte-Cochere Entry) & Crystals / Cosmopolitan South Valet Oval.
// Local coordinates in metres: x east, y up, z south.
// Stays strictly clear of W Harmon Ave (z = 766.5 .. 797.2) so Harmon Ave & Strip junctions remain untouched.

export const COSMO_NORTH_CLIP = [
  [-118.0, 732.0],
  [-54.0, 732.0],
  [-54.0, 766.5],
  [-118.0, 766.5],
];

export const COSMO_SOUTH_CLIP = [
  [-84.0, 797.5],
  [-55.0, 797.5],
  [-52.0, 809.0],
  [20.0, 809.0],
  [20.0, 855.0],
  [-84.0, 855.0],
];

export function finishCosmoDrivePavement(layers) {
  const { major, sidewalk, concreteMedians, medianPlanting, curb, curbFaces, paint, paintDim } = layers;

  // ── 1. COSMOPOLITAN NORTH HARMON VALET / GARAGE ENTRY (z <= 766.5) ──
  const northClip = [toClipRing(COSMO_NORTH_CLIP)];
  clearLayersInPoly(layers, boundsOfPoly(COSMO_NORTH_CLIP), northClip, COSMO_NORTH_CLIP);

  const northOut = smoothPoly([
    [-129.0, 737.0],
    [-102.0, 740.8],
    [-80.0, 743.5],
    [-68.0, 748.5],
    [-63.2, 756.5],
    [-60.5, 771.0],
  ], 4);
  const northIn = smoothPoly([
    [-71.9, 771.0],
    [-72.4, 763.5],
    [-76.2, 756.8],
    [-92.0, 753.8],
    [-129.0, 749.8],
  ], 4);
  const northThroat = toClipRing([
    [-76.8, 756.0],
    [-58.5, 756.0],
    [-56.5, 771.0],
    [-76.5, 771.0],
  ]);
  const northRaw = exToPaths(clipOp(ctUnion, [
    toClipRing(ribbonRing(northOut, 3.0)),
    toClipRing(ribbonRing(northIn, 3.0)),
    northThroat,
  ]));
  const northSmooth = offsetPaths(offsetPaths(northRaw, 1.4), -1.4);
  const northIsland = roundCorners([toClipRing([
    [-115.0, 744.2],
    [-86.0, 747.8],
    [-72.5, 750.8],
    [-74.5, 753.2],
    [-115.0, 746.5],
  ])], 0.85);

  const northDrivableUnclipped = exToPaths(clipOp(ctDifference, northSmooth, northIsland));
  const northDrivableEx = clipOp(ctIntersection, northDrivableUnclipped, northClip);
  const northDrivablePaths = exToPaths(northDrivableEx);
  emitPolygons(major, northDrivableEx, 0, 0.05);

  const northIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, northIsland)), northClip);
  const northIslandPaths = exToPaths(northIslandsEx);
  emitPolygons(concreteMedians, northIslandsEx, 0.11, 0.2);
  emitPolygons(medianPlanting, clipOp(ctIntersection, offsetPaths(northIsland, -0.38), northIslandPaths), 0.124, 0.25);

  const northWalkBand = offsetPaths(northDrivableUnclipped, 2.2);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, northWalkBand, [...northDrivableUnclipped, ...northIslandPaths])), northClip), 0.11, 0.35);

  const northIslandCurb = exToPaths(clipOp(ctDifference, northIslandPaths, offsetPaths(northIslandPaths, -0.18)));
  const northOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(northDrivableUnclipped, 0.18), [...northDrivableUnclipped, ...northIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...northIslandCurb, ...northOuterCurb])), northClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, northIslandPaths, 0, 0.17, COSMO_NORTH_CLIP);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, northOuterCurb, northClip)), 0, 0.17, COSMO_NORTH_CLIP);

  const nWhite = [], nDim = [];
  addDashed(nWhite, northOut.slice(3, -3), 2.2, 3.8, 0.07);
  addDashed(nWhite, northIn.slice(3, -3), 2.2, 3.8, 0.07);
  nDim.push(...arrowPolysWorld(-62.5, 759.5, 0.22, 0.97, ['through'], 2.8));
  nDim.push(...arrowPolysWorld(-73.2, 760.5, -0.32, -0.95, ['through'], 2.8));
  const nWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, nWhite)), northDrivablePaths);
  const nDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, nDim)), northDrivablePaths)), exToPaths(nWhiteEx));
  emitPolygons(paint, nWhiteEx, 0, 0.005);
  emitPolygons(paintDim, nDimEx, 0, 0.005);

  // ── 2. CRYSTALS / COSMOPOLITAN SOUTH VALET OVAL (z >= 797.5) ──
  const southClip = [toClipRing(COSMO_SOUTH_CLIP)];
  clearLayersInPoly(layers, boundsOfPoly(COSMO_SOUTH_CLIP), southClip, COSMO_SOUTH_CLIP);

  // Inbound sweep from Harmon Ave around the wide east porte-cochere turnaround (covers Google Road + Satellite!)
  const loopCenter = smoothPoly([
    [-74.6, 793.0],
    [-75.2, 804.0],
    [-74.8, 816.5],
    [-69.0, 825.5],
    [-55.0, 831.5],
    [-34.0, 838.5],
    [-12.0, 845.2],
    [4.5, 845.5],
    [12.2, 837.5],
    [11.8, 825.5],
    [2.0, 819.5],
    [-18.0, 819.0],
    [-38.0, 823.2],
    [-54.5, 822.2],
    [-62.6, 814.5],
    [-62.4, 804.0],
    [-61.4, 793.0],
  ], 5);
  const loopCum = polyCum(loopCenter);
  const loopRing = toClipRing(ribbonRing(loopCenter, 4.7));

  // Unified Harmon mouth throat + east turnaround apron so zero pale-blue Google road peeks outside
  const southMouthApron = toClipRing([
    [-79.5, 793.0],
    [-56.5, 793.0],
    [-57.5, 812.0],
    [-79.5, 812.0],
  ]);
  const eastCourtApron = roundCorners([toClipRing([
    [-30.0, 814.0],
    [14.5, 815.5],
    [16.5, 846.5],
    [-18.0, 849.5],
    [-58.0, 834.0],
    [-58.0, 818.0],
  ])], 4.0);

  const southRaw = exToPaths(clipOp(ctUnion, [loopRing, southMouthApron, ...eastCourtApron]));
  const southSmooth = offsetPaths(offsetPaths(southRaw, 1.8), -1.8);

  // Clean planted center oval island inside the Crystals / Cosmopolitan valet loop
  const centerOvalIsland = roundCorners([toClipRing([
    [-51.0, 825.0],
    [-34.0, 825.5],
    [-14.0, 823.8],
    [1.5, 826.5],
    [3.8, 833.5],
    [-4.5, 838.8],
    [-25.0, 834.5],
    [-49.0, 827.5],
  ])], 2.2);
  // Splitter median separating inbound & outbound throats near Harmon Ave (z = 800..816)
  const neckSplitter = roundCorners([toClipRing([
    [-70.2, 801.0],
    [-66.6, 801.0],
    [-66.6, 816.5],
    [-70.2, 816.5],
  ])], 1.4);

  const southIslands = [...centerOvalIsland, ...neckSplitter];
  const southDrivableUnclipped = exToPaths(clipOp(ctDifference, southSmooth, southIslands));
  const southDrivableEx = clipOp(ctIntersection, southDrivableUnclipped, southClip);
  const southDrivablePaths = exToPaths(southDrivableEx);
  emitPolygons(major, southDrivableEx, 0, 0.05);

  const southIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, southIslands)), southClip);
  const southIslandPaths = exToPaths(southIslandsEx);
  emitPolygons(concreteMedians, southIslandsEx, 0.11, 0.2);
  const southGreenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(centerOvalIsland, -0.55),
    ...offsetPaths(neckSplitter, -0.4),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, southGreenRaw, southIslandPaths), 0.124, 0.3);

  const southWalkBand = offsetPaths(southDrivableUnclipped, 2.3);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, southWalkBand, [...southDrivableUnclipped, ...southIslandPaths])), southClip), 0.11, 0.35);

  const southIslandCurb = exToPaths(clipOp(ctDifference, southIslandPaths, offsetPaths(southIslandPaths, -0.18)));
  const southOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(southDrivableUnclipped, 0.18), [...southDrivableUnclipped, ...southIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...southIslandCurb, ...southOuterCurb])), southClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, southIslandPaths, 0, 0.17, COSMO_SOUTH_CLIP);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, southOuterCurb, southClip)), 0, 0.17, COSMO_SOUTH_CLIP);

  // Lane divider dashed line around the valet loop + directional arrows + Harmon-mouth crosswalk
  const sWhite = [], sDim = [];
  const loopDash = slicePoly(loopCenter, loopCum, 14.0, loopCum.at(-1) - 14.0);
  if (loopDash.length >= 2) addDashed(sWhite, loopDash, 2.3, 4.0, 0.072);
  addZebra(sWhite, [-79.2, 800.0], [-57.8, 800.0], 2.8);
  for (const [ax, az, hx, hz] of [
    [-74.8, 811.0, 0.05, 0.99],
    [-34.0, 838.5, 0.95, 0.31],
    [11.8, 831.5, -0.04, -0.99],
    [-20.0, 819.0, -0.99, 0.08],
    [-62.2, 809.5, 0.05, -0.99],
  ]) {
    sDim.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 2.9));
  }
  const sWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, sWhite)), southDrivablePaths);
  const sDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, sDim)), southDrivablePaths)), exToPaths(sWhiteEx));
  emitPolygons(paint, sWhiteEx, 0, 0.005);
  emitPolygons(paintDim, sDimEx, 0, 0.005);
}
