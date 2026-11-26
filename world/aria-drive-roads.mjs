import {
  addDashed, addRibbon, addZebra, arrowPolysWorld, boundsOfPoly, circleRing,
  clearLayersInPoly, clipOp, ctDifference, ctIntersection, ctUnion,
  emitCurbFaces, emitPolygons, exToPaths, offsetPaths, polyCum,
  ribbonRing, roundCorners, slicePoly, smoothPoly, toClipRing,
} from './resort-drive-kit.mjs';

// ARIA Resort & Casino Grand Porte-Cochere Rotary, Lumia Fountain Island,
// W Aria Place Boulevard, and South Aria/Park MGM Access Drive.
// Local coordinates in metres: x east, y up, z south.
// Stays strictly west of S Las Vegas Blvd & W Aria Pl Strip crosswalk (x <= 85)
// so Carbon's Strip intersection and crosswalks remain completely untouched.

export const ARIA_ROTARY = {
  cx: -107.5,
  cz: 995.5,
  fountainR: 12.0,
  outerR: 40.4,
};

export const ARIA_CLIP_POLY = [
  [-152.0, 952.0],
  [-86.0, 952.0],
  [-58.0, 984.0],
  [85.0, 1039.0],
  [85.0, 1094.0],
  [22.0, 1084.0],
  [8.0, 1072.0],
  [-18.0, 1080.0],
  [-88.0, 1082.0],
  [-98.0, 1096.5],
  [-120.0, 1096.5],
  [-116.0, 1072.0],
  [-92.0, 1044.0],
  [-136.0, 1040.0],
  [-152.0, 1018.0],
];

export function finishAriaDrivePavement(layers) {
  const { major, sidewalk, concreteMedians, medianPlanting, curb, curbFaces, paint, paintDim } = layers;

  const clipSection = [toClipRing(ARIA_CLIP_POLY)];
  clearLayersInPoly(layers, boundsOfPoly(ARIA_CLIP_POLY), clipSection, ARIA_CLIP_POLY);

  const { cx, cz, fountainR, outerR } = ARIA_ROTARY;

  // 1. UNIFIED ARIA GRAND PORTE-COCHERE ROTARY & W ARIA PL BOULEVARD
  const rotaryOuter = toClipRing(circleRing(cx, cz, outerR, 112));

  // Inbound WB W Aria Pl (extended past x = 85 for curb-free Strip mouth!)
  const wbCenter = smoothPoly([
    [92.0, 1055.2],
    [45.0, 1038.6],
    [0.0, 1020.4],
    [-40.0, 1005.0],
    [-64.0, 996.4],
    [-82.0, 985.5],
    [-98.0, 974.5],
  ], 4);
  const wbCum = polyCum(wbCenter);
  const wbRing = toClipRing(ribbonRing(wbCenter, 6.2));

  // Outbound EB W Aria Pl (extended past x = 85 for curb-free Strip mouth!)
  const ebCenter = smoothPoly([
    [-112.0, 1024.0],
    [-86.0, 1021.5],
    [-58.0, 1029.5],
    [-12.0, 1046.5],
    [36.0, 1063.8],
    [92.0, 1082.8],
  ], 4);
  const ebCum = polyCum(ebCenter);
  const ebRing = toClipRing(ribbonRing(ebCenter, 6.2));

  // Smooth throat apron connecting rotary to WB/EB boulevard + clean crossover gaps
  const blvdThroat = toClipRing([
    [-92.0, 968.0],
    [-58.0, 991.0],
    [89.0, 1047.5],
    [89.0, 1089.0],
    [-78.0, 1033.0],
    [-108.0, 1033.0],
  ]);

  // South Aria / Park MGM access tunnel drive (1094232389 / 1094232390 / 1094232391 / 1419080680 / 1419080681)
  // Extended south past z = 1096.5 for curb-free south seam!
  const southAccMain = smoothPoly([
    [-112.0, 1101.0],
    [-103.5, 1091.0],
    [-92.5, 1079.0],
    [-74.0, 1072.0],
    [-45.0, 1069.5],
    [-18.0, 1068.5],
    [-7.5, 1062.0],
    [1.0, 1052.0],
  ], 4);
  const southAccWest = smoothPoly([
    [-95.0, 1076.5],
    [-90.0, 1060.0],
    [-81.0, 1042.0],
    [-74.0, 1026.0],
  ], 3);
  const southAccEast = smoothPoly([
    [-18.0, 1068.5],
    [-13.0, 1060.0],
    [-9.5, 1049.0],
  ], 3);

  const rawAsphalt = exToPaths(clipOp(ctUnion, [
    rotaryOuter, wbRing, ebRing, blvdThroat,
    toClipRing(ribbonRing(southAccMain, 4.6)),
    toClipRing(ribbonRing(southAccWest, 3.6)),
    toClipRing(ribbonRing(southAccEast, 3.8)),
  ]));
  const smoothAsphalt = offsetPaths(offsetPaths(rawAsphalt, 2.0), -2.0);

  // 2. LUMIA FOUNTAIN ISLAND & LANDSCAPED BOULEVARD MEDIANS (exact Google Satellite layout!)
  // Circular Lumia Water-Wall Fountain + sculpted teardrop garden tail pointing east
  const fountainCircle = toClipRing(circleRing(cx, cz, fountainR, 84));
  const fountainTail = roundCorners([toClipRing([
    [-101.0, 984.5],
    [-81.5, 999.5],
    [-81.0, 1007.5],
    [-103.5, 1011.5],
  ])], 2.6);
  const fountainIsland = exToPaths(clipOp(ctUnion, [fountainCircle, ...fountainTail]));

  // West W Aria Pl landscaped median (between Veer Towers & rotary throat: x = -66 .. -41)
  const westMedian = roundCorners([toClipRing([
    [-65.5, 1004.5],
    [-41.5, 1013.2],
    [-45.5, 1024.0],
    [-69.5, 1015.4],
  ])], 2.2);

  // Mid W Aria Pl landscaped median (east of Veer crossover: x = -33 .. +18)
  const midMedian = roundCorners([toClipRing([
    [-33.5, 1016.2],
    [16.5, 1034.8],
    [12.8, 1045.5],
    [-37.2, 1026.8],
  ])], 2.4);

  // East W Aria Pl landscaped median (x = +25 .. +76, stops cleanly west of Strip crosswalk)
  const eastMedian = roundCorners([toClipRing([
    [24.5, 1037.8],
    [75.5, 1056.6],
    [72.2, 1066.2],
    [21.2, 1047.8],
  ])], 2.2);

  // South access drive splitter triangle (between W Aria Pl EB and Aria/Pk MGM Acc Tunl)
  const southAccessIsland = roundCorners([toClipRing([
    [-77.0, 1038.0],
    [-16.0, 1054.0],
    [-21.0, 1063.2],
    [-79.0, 1065.5],
    [-86.0, 1057.0],
  ])], 3.0);

  const allIslands = [...fountainIsland, ...westMedian, ...midMedian, ...eastMedian, ...southAccessIsland];
  const drivableUnclipped = exToPaths(clipOp(ctDifference, smoothAsphalt, allIslands));
  const drivableEx = clipOp(ctIntersection, drivableUnclipped, clipSection);
  const drivablePaths = exToPaths(drivableEx);
  emitPolygons(major, drivableEx, 0, 0.05);

  const islandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, allIslands)), clipSection);
  const islandPaths = exToPaths(islandsEx);
  emitPolygons(concreteMedians, islandsEx, 0.11, 0.2);

  // Lush green median planting inside the teardrop garden tail, all 3 boulevard medians & south triangle
  const greenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(fountainTail, -0.75),
    ...offsetPaths(westMedian, -0.65),
    ...offsetPaths(midMedian, -0.65),
    ...offsetPaths(eastMedian, -0.6),
    ...offsetPaths(southAccessIsland, -0.8),
  ]));
  // Keep circular Lumia fountain deck clean stone inside r = fountainR - 0.3
  const fountainKeepStone = [toClipRing(circleRing(cx, cz, fountainR - 0.3, 64))];
  const greenOnly = exToPaths(clipOp(ctDifference, greenRaw, fountainKeepStone));
  emitPolygons(medianPlanting, clipOp(ctIntersection, greenOnly, islandPaths), 0.124, 0.3);

  // Sidewalks & raised curbs computed from UNCLIPPED asphalt so east Strip & south access mouths stay curb-free!
  const outerWalkBand = offsetPaths(drivableUnclipped, 2.4);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...drivableUnclipped, ...islandPaths])), clipSection), 0.11, 0.35);

  const islandCurb = exToPaths(clipOp(ctDifference, islandPaths, offsetPaths(islandPaths, -0.18)));
  const outerCurbUnclipped = exToPaths(clipOp(ctDifference, offsetPaths(drivableUnclipped, 0.18), [...drivableUnclipped, ...islandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurb, ...outerCurbUnclipped])), clipSection), 0.17, 0.05);
  emitCurbFaces(curbFaces, islandPaths, 0, 0.17, ARIA_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, outerCurbUnclipped, clipSection)), 0, 0.17, ARIA_CLIP_POLY);

  // 3. CONCENTRIC ROTARY RINGS, BOULEVARD LANE DIVIDERS & ZEBRA CROSSWALKS
  const whitePolys = [], dimPolys = [];

  // Concentric rotary lane lines around Lumia Fountain (r = 21.5 m & r = 29.8 m)
  const rInnerDash = circleRing(cx, cz, 21.5, 84); rInnerDash.push(rInnerDash[0]);
  const rOuterDash = circleRing(cx, cz, 29.8, 96); rOuterDash.push(rOuterDash[0]);
  addDashed(whitePolys, rInnerDash, 2.4, 4.0, 0.072);
  addDashed(whitePolys, rOuterDash, 2.4, 4.0, 0.072);

  // Counter-clockwise rotary flow arrows
  for (const deg of [-105, -180, 105]) {
    const a = (deg * Math.PI) / 180;
    const r = 25.6;
    dimPolys.push(...arrowPolysWorld(cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.sin(a), -Math.cos(a), ['through'], 3.1));
  }

  // WB & EB boulevard dashed lane lines (3 lanes each: ±1.95 m offsets from centerline)
  const wbStraight = slicePoly(wbCenter, wbCum, 6.0, wbCum.at(-1) - 36.0);
  const ebStraight = slicePoly(ebCenter, ebCum, 40.0, ebCum.at(-1) - 6.0);
  if (wbStraight.length >= 2) {
    for (const off of [-2.0, 2.0]) {
      const shifted = wbStraight.map(([x, z]) => [x - 0.34 * off, z + 0.94 * off]);
      addDashed(whitePolys, shifted, 2.5, 4.5, 0.072);
    }
  }
  if (ebStraight.length >= 2) {
    for (const off of [-2.0, 2.0]) {
      const shifted = ebStraight.map(([x, z]) => [x - 0.34 * off, z + 0.94 * off]);
      addDashed(whitePolys, shifted, 2.5, 4.5, 0.072);
    }
  }

  // Boulevard flow arrows
  for (const [ax, az, hx, hz] of [
    [-15.0, 1014.5, -0.94, -0.34],
    [45.0, 1038.5, -0.94, -0.34],
    [-15.0, 1045.5, 0.94, 0.34],
    [45.0, 1067.0, 0.94, 0.34],
  ]) {
    dimPolys.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 3.0));
  }

  // Crosswalk across south access road west leg & main boulevard near Veer Towers
  addZebra(whitePolys, [-89.0, 1054.0], [-81.0, 1058.5], 2.8);
  addZebra(whitePolys, [-69.5, 991.5], [-77.5, 1028.0], 2.9);

  const whiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, whitePolys)), drivablePaths);
  const whitePaths = exToPaths(whiteEx);
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, dimPolys)), drivablePaths)), whitePaths);
  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);
}
