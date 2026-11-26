import {
  addDashed, addZebra, arrowPolysWorld, boundsOfPoly, circleRing,
  clearLayersInPoly, clipOp, ctDifference, ctIntersection, ctUnion,
  emitCurbFaces, emitPolygons, exToPaths, offsetPaths, polyCum,
  ribbonRing, roundCorners, slicePoly, smoothPoly, toClipRing,
} from './resort-drive-kit.mjs';

// The Venetian Front Porte-Cochere Loop & South Valet Motor Court + The Palazzo Porte-Cochere Rotary.
// Local coordinates in metres: x east, y up, z south.
// Stays strictly east of S Las Vegas Blvd's east Strip crosswalks (Venetian x >= 292, Palazzo x >= 364).

export const VENETIAN_FRONT_CLIP = [
  [292.0, -646.0],
  [386.0, -612.0],
  [390.0, -490.0],
  [400.0, -434.0],
  [355.0, -434.0],
  [320.0, -514.0],
  [320.0, -592.0],
  [288.0, -622.0],
];

export const VENETIAN_VALET_CLIP = [
  [396.0, -464.0],
  [524.0, -464.0],
  [524.0, -434.0],
  [396.0, -434.0],
];

export const PALAZZO_CLIP = [
  [364.0, -812.0],
  [404.0, -844.0],
  [424.0, -878.0],
  [486.0, -878.0],
  [486.0, -784.0],
  [364.0, -784.0],
];

export function finishVenetianPalazzoDrivePavement(layers) {
  const { major, sidewalk, concreteMedians, medianPlanting, curb, curbFaces, paint, paintDim } = layers;

  // ── 1. THE VENETIAN FRONT PORTE-COCHERE LOOP (x = 290..392, z = -645..-434) ──
  const vfClip = [toClipRing(VENETIAN_FRONT_CLIP)];
  clearLayersInPoly(layers, boundsOfPoly(VENETIAN_FRONT_CLIP), vfClip, VENETIAN_FRONT_CLIP);

  // Inbound sweeping SE from Las Vegas Blvd past Campanile into west valet lane
  const vfIn = smoothPoly([
    [280.0, -638.0],
    [304.0, -616.0],
    [326.0, -596.0],
    [329.5, -578.0],
    [329.0, -530.0],
    [332.5, -519.0],
    [346.0, -515.5],
    [360.0, -504.0],
    [364.5, -490.0],
    [365.5, -456.0],
    [376.0, -442.0],
    [404.0, -441.5],
  ], 4);
  const vfInCum = polyCum(vfIn);

  // Porte-cochere NB arrival / return loop (363.5..-570 -> 347..-598 -> Strip exit)
  const vfOut = smoothPoly([
    [404.0, -448.0],
    [378.0, -447.0],
    [371.5, -458.0],
    [371.2, -492.0],
    [364.0, -525.0],
    [364.0, -569.5],
    [356.0, -588.0],
    [342.0, -603.0],
    [318.0, -624.0],
    [290.0, -644.0],
  ], 4);

  // Porte-cochere crossover apron connecting west & east lanes cleanly at south & north ends
  const vfSouthCross = smoothPoly([
    [345.0, -516.5],
    [357.0, -522.0],
    [365.0, -526.0],
  ], 3);
  const vfNorthCross = smoothPoly([
    [329.0, -586.0],
    [342.0, -595.0],
    [356.0, -586.0],
  ], 3);

  const vfRaw = exToPaths(clipOp(ctUnion, [
    toClipRing(ribbonRing(vfIn, 4.4)),
    toClipRing(ribbonRing(vfOut, 4.4)),
    toClipRing(ribbonRing(vfSouthCross, 4.2)),
    toClipRing(ribbonRing(vfNorthCross, 4.2)),
  ]));
  const vfSmooth = offsetPaths(offsetPaths(vfRaw, 1.8), -1.8);

  // Lush planted Venetian Oval Court Island between SB west lane & NB porte-cochere lane
  const vfCenterIsland = roundCorners([toClipRing([
    [336.5, -583.5],
    [356.5, -583.5],
    [356.5, -527.5],
    [336.5, -527.5],
  ])], 7.5);
  // Sleek planted approach median between Strip entry & exit
  const vfStripMedian = roundCorners([toClipRing([
    [296.0, -633.0],
    [326.0, -607.5],
    [322.5, -603.0],
    [293.0, -629.5],
  ])], 1.3);

  const vfIslands = [...vfCenterIsland, ...vfStripMedian];
  const vfDrivableUnclipped = exToPaths(clipOp(ctDifference, vfSmooth, vfIslands));
  const vfDrivableEx = clipOp(ctIntersection, vfDrivableUnclipped, vfClip);
  const vfDrivablePaths = exToPaths(vfDrivableEx);
  emitPolygons(major, vfDrivableEx, 0, 0.05);

  const vfIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, vfIslands)), vfClip);
  const vfIslandPaths = exToPaths(vfIslandsEx);
  emitPolygons(concreteMedians, vfIslandsEx, 0.11, 0.2);
  const vfGreenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(vfCenterIsland, -0.75),
    ...offsetPaths(vfStripMedian, -0.4),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, vfGreenRaw, vfIslandPaths), 0.124, 0.3);

  const vfWalkBand = offsetPaths(vfDrivableUnclipped, 2.3);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, vfWalkBand, [...vfDrivableUnclipped, ...vfIslandPaths])), vfClip), 0.11, 0.35);

  const vfIslandCurb = exToPaths(clipOp(ctDifference, vfIslandPaths, offsetPaths(vfIslandPaths, -0.18)));
  const vfOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(vfDrivableUnclipped, 0.18), [...vfDrivableUnclipped, ...vfIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...vfIslandCurb, ...vfOuterCurb])), vfClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, vfIslandPaths, 0, 0.17, VENETIAN_FRONT_CLIP);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, vfOuterCurb, vfClip)), 0, 0.17, VENETIAN_FRONT_CLIP);

  const vfWhite = [], vfDim = [];
  const vfInDash = slicePoly(vfIn, vfInCum, 18.0, vfInCum.at(-1) - 12.0);
  if (vfInDash.length >= 2) addDashed(vfWhite, vfInDash, 2.4, 4.2, 0.072);
  addDashed(vfWhite, [[364.0, -568.0], [364.0, -526.0]], 2.2, 3.8, 0.072);
  addZebra(vfWhite, [359.5, -548.0], [369.0, -548.0], 2.8);
  vfDim.push(...arrowPolysWorld(329.0, -554.0, 0.0, 1.0, ['through'], 2.9));
  vfDim.push(...arrowPolysWorld(364.0, -558.0, 0.0, -1.0, ['through'], 2.9));
  vfDim.push(...arrowPolysWorld(368.0, -475.0, 0.0, 1.0, ['through'], 2.9));
  const vfWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, vfWhite)), vfDrivablePaths);
  const vfDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, vfDim)), vfDrivablePaths)), exToPaths(vfWhiteEx));
  emitPolygons(paint, vfWhiteEx, 0, 0.005);
  emitPolygons(paintDim, vfDimEx, 0, 0.005);

  // ── 2. THE VENETIAN SOUTH VALET / GARAGE COURT (x = 396..524, z = -464..-434) ──
  const vvClip = [toClipRing(VENETIAN_VALET_CLIP)];
  clearLayersInPoly(layers, boundsOfPoly(VENETIAN_VALET_CLIP), vvClip, VENETIAN_VALET_CLIP);

  const vvMainDrive = toClipRing([
    [392.0, -448.0],
    [528.0, -448.0],
    [528.0, -437.0],
    [392.0, -437.0],
  ]);
  const vvValetCourt = roundCorners([toClipRing([
    [406.0, -462.5],
    [516.0, -462.5],
    [516.0, -442.0],
    [406.0, -442.0],
  ])], 4.0);
  const vvRaw = exToPaths(clipOp(ctUnion, [vvMainDrive, ...vvValetCourt]));
  const vvSmooth = offsetPaths(offsetPaths(vvRaw, 1.4), -1.4);

  // Two crisp valet bay islands separating staging bays from the through drive (eliminates 5 dark ladder joints!)
  const vvIslandW = roundCorners([toClipRing([
    [416.0, -456.2],
    [454.0, -456.2],
    [454.0, -451.8],
    [416.0, -451.8],
  ])], 1.4);
  const vvIslandE = roundCorners([toClipRing([
    [466.0, -456.2],
    [504.0, -456.2],
    [504.0, -451.8],
    [466.0, -451.8],
  ])], 1.4);
  const vvIslands = [...vvIslandW, ...vvIslandE];
  const vvDrivableUnclipped = exToPaths(clipOp(ctDifference, vvSmooth, vvIslands));
  const vvDrivableEx = clipOp(ctIntersection, vvDrivableUnclipped, vvClip);
  const vvDrivablePaths = exToPaths(vvDrivableEx);
  emitPolygons(major, vvDrivableEx, 0, 0.05);

  const vvIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, vvIslands)), vvClip);
  const vvIslandPaths = exToPaths(vvIslandsEx);
  emitPolygons(concreteMedians, vvIslandsEx, 0.11, 0.2);
  emitPolygons(medianPlanting, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...offsetPaths(vvIslandW, -0.45), ...offsetPaths(vvIslandE, -0.45)])), vvIslandPaths), 0.124, 0.25);

  const vvWalkBand = offsetPaths(vvDrivableUnclipped, 2.2);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, vvWalkBand, [...vvDrivableUnclipped, ...vvIslandPaths])), vvClip), 0.11, 0.35);

  const vvIslandCurb = exToPaths(clipOp(ctDifference, vvIslandPaths, offsetPaths(vvIslandPaths, -0.18)));
  const vvOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(vvDrivableUnclipped, 0.18), [...vvDrivableUnclipped, ...vvIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...vvIslandCurb, ...vvOuterCurb])), vvClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, vvIslandPaths, 0, 0.17, VENETIAN_VALET_CLIP);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, vvOuterCurb, vvClip)), 0, 0.17, VENETIAN_VALET_CLIP);

  const vvWhite = [], vvDim = [];
  addDashed(vvWhite, [[402.0, -442.5], [518.0, -442.5]], 2.4, 4.2, 0.072);
  addZebra(vvWhite, [458.5, -456.0], [461.5, -438.0], 2.6);
  vvDim.push(...arrowPolysWorld(435.0, -440.0, 1, 0, ['through'], 2.8));
  vvDim.push(...arrowPolysWorld(485.0, -440.0, 1, 0, ['through'], 2.8));
  const vvWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, vvWhite)), vvDrivablePaths);
  const vvDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, vvDim)), vvDrivablePaths)), exToPaths(vvWhiteEx));
  emitPolygons(paint, vvWhiteEx, 0, 0.005);
  emitPolygons(paintDim, vvDimEx, 0, 0.005);

  // ── 3. THE PALAZZO PORTE-COCHERE ROTARY & FOUNTAIN GARDEN (x = 364..486, z = -878..-784) ──
  const palClip = [toClipRing(PALAZZO_CLIP)];
  clearLayersInPoly(layers, boundsOfPoly(PALAZZO_CLIP), palClip, PALAZZO_CLIP);

  const pcx = 447.0, pcz = -836.0;
  const palRotaryOuter = toClipRing(circleRing(pcx, pcz, 36.5, 96));

  // Inbound EB from Las Vegas Blvd into Palazzo rotary (extended west of x = 364 for curb-free mouth)
  const palIn = smoothPoly([
    [358.0, -793.5],
    [378.0, -794.0],
    [404.0, -798.5],
    [432.0, -800.5],
    [454.0, -806.5],
    [470.0, -822.0],
  ], 4);
  const palInCum = polyCum(palIn);

  // Outbound WB from Palazzo rotary back to Las Vegas Blvd
  const palOut = smoothPoly([
    [438.0, -868.5],
    [426.0, -854.0],
    [421.0, -831.0],
    [410.0, -817.5],
    [388.0, -811.0],
    [358.0, -804.5],
  ], 4);
  const palOutCum = polyCum(palOut);

  // North canopy porte-cochere flare under Palazzo's octagonal glass roof (435..475, -875..-845)
  const palCanopyFlare = roundCorners([toClipRing([
    [428.0, -875.5],
    [476.0, -875.5],
    [483.0, -842.0],
    [472.0, -804.0],
    [425.0, -804.0],
    [418.0, -842.0],
  ])], 8.0);

  const palRaw = exToPaths(clipOp(ctUnion, [
    palRotaryOuter, ...palCanopyFlare,
    toClipRing(ribbonRing(palIn, 4.6)),
    toClipRing(ribbonRing(palOut, 4.6)),
  ]));
  const palSmooth = offsetPaths(offsetPaths(palRaw, 2.0), -2.0);

  // Iconic Palazzo Circular Fountain Garden Island + Sleek Approach Median
  const palFountainGarden = [toClipRing(circleRing(pcx, pcz, 16.5, 72))];
  const palApproachMedian = roundCorners([toClipRing([
    [370.0, -800.0],
    [412.0, -805.5],
    [414.0, -811.5],
    [396.0, -810.0],
    [370.0, -802.0],
  ])], 1.4);

  const palIslands = [...palFountainGarden, ...palApproachMedian];
  const palDrivableUnclipped = exToPaths(clipOp(ctDifference, palSmooth, palIslands));
  const palDrivableEx = clipOp(ctIntersection, palDrivableUnclipped, palClip);
  const palDrivablePaths = exToPaths(palDrivableEx);
  emitPolygons(major, palDrivableEx, 0, 0.05);

  const palIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, palIslands)), palClip);
  const palIslandPaths = exToPaths(palIslandsEx);
  emitPolygons(concreteMedians, palIslandsEx, 0.11, 0.2);
  const palGreenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(palFountainGarden, -0.8),
    ...offsetPaths(palApproachMedian, -0.42),
  ]));
  emitPolygons(medianPlanting, clipOp(ctIntersection, palGreenRaw, palIslandPaths), 0.124, 0.3);

  const palWalkBand = offsetPaths(palDrivableUnclipped, 2.4);
  emitPolygons(sidewalk, clipOp(ctIntersection, exToPaths(clipOp(ctDifference, palWalkBand, [...palDrivableUnclipped, ...palIslandPaths])), palClip), 0.11, 0.35);

  const palIslandCurb = exToPaths(clipOp(ctDifference, palIslandPaths, offsetPaths(palIslandPaths, -0.18)));
  const palOuterCurb = exToPaths(clipOp(ctDifference, offsetPaths(palDrivableUnclipped, 0.18), [...palDrivableUnclipped, ...palIslandPaths]));
  emitPolygons(curb, clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...palIslandCurb, ...palOuterCurb])), palClip), 0.17, 0.05);
  emitCurbFaces(curbFaces, palIslandPaths, 0, 0.17, PALAZZO_CLIP);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, palOuterCurb, palClip)), 0, 0.17, PALAZZO_CLIP);

  const pWhite = [], pDim = [];
  const palRingDash = circleRing(pcx, pcz, 25.5, 84); palRingDash.push(palRingDash[0]);
  addDashed(pWhite, palRingDash, 2.4, 4.0, 0.072);
  const pInDash = slicePoly(palIn, palInCum, 10.0, palInCum.at(-1) - 10.0);
  if (pInDash.length >= 2) addDashed(pWhite, pInDash, 2.3, 4.0, 0.072);
  const pOutDash = slicePoly(palOut, palOutCum, 10.0, palOutCum.at(-1) - 10.0);
  if (pOutDash.length >= 2) addDashed(pWhite, pOutDash, 2.3, 4.0, 0.072);
  addZebra(pWhite, [438.0, -860.5], [444.0, -873.5], 2.8);
  for (const [ax, az, hx, hz] of [
    [392.0, -796.5, 0.98, 0.18],
    [390.0, -811.5, -0.97, -0.24],
    [474.0, -836.0, 0.0, -1.0],
    [447.0, -866.0, -1.0, 0.0],
  ]) {
    pDim.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 2.9));
  }
  const pWhiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, pWhite)), palDrivablePaths);
  const pDimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, pDim)), palDrivablePaths)), exToPaths(pWhiteEx));
  emitPolygons(paint, pWhiteEx, 0, 0.005);
  emitPolygons(paintDim, pDimEx, 0, 0.005);
}
