/** Shared landmark catalogue. Builders return independent Three.js groups in local metres. */
import { buildAria, buildVdara, buildVeer, buildCrystals, buildCosmopolitan } from './citycenter.js';
import { buildPlanetHollywood, buildFlamingo, buildHardRockHotel } from './mid-strip-resorts.js';
import { buildVenetian, buildPalazzo } from './venetian-palazzo.js';
import { buildGuitar } from './hard-rock-guitar.js';
import { buildLuxor } from './luxor.js';
import { buildMandalayBay } from './mandalay-bay.js';
import { buildMGM, buildNYNY } from './tropicana-trio.js';
import { buildExcalibur } from './excalibur.js';
import { buildStrat } from './strat.js';
import { buildTreasureIsland } from './treasure-island.js';
import { buildCaesars } from './caesars-palace.js';
import { buildHighRoller } from './high-roller.js';
import { buildGrandPrixPlaza } from './grand-prix-plaza.js';
import { buildParkMgm } from './park-mgm.js';
import { buildAllegiant, buildTMobile } from './event-venues.js';
import { buildTrumpHotel } from './trump-hotel.js';
import { buildFlamingoMarquees } from './flamingo-marquees.js';
import { buildFashionShow, buildWynnMarquees } from './north-strip-marquees.js';
import { buildPalmsCasino, buildPalmsPlace } from './palms.js';
import { buildBlvd, buildShowcase, buildWaldorfStorefronts } from './strip-retail.js';

export const stripModels = [
  { id: 'palms', title: 'Palms Casino Resort', district: 'West Flamingo Road', color: '#85c1c7', bearing: 55, build: buildPalmsCasino,
    details: [
      { id: 'towers', label: 'Ivory & Fantasy', target: [-1781, 67, 198], bearing: 59, elevation: 0.26, range: 284 },
      { id: 'tall-wall', label: 'Ivory Tall Wall', target: [-1747, 73, 150], bearing: 85, elevation: 0.12, range: 206 },
      { id: 'pools', label: 'Resort pools', target: [-1699, 8, 198], bearing: 252, elevation: 0.93, range: 142 },
    ],
    description: 'Ivory Tower’s rooftop arch and Tall Wall, the blue Fantasy Tower, and the resort pools off West Flamingo Road.' },
  { id: 'palms-place', title: 'Palms Place', district: 'Arville Street', color: '#8bbacf', bearing: 154, build: buildPalmsPlace,
    details: [{ id: 'pool', label: 'Pool & SkyTube', target: [-2161, 14, 249], bearing: 130, elevation: 0.57, range: 116 }],
    description: 'Blue glass balconies, the sixth-floor pool, and an enclosed connection to the main resort.' },
  { id: 'aria', title: 'ARIA', district: 'CityCenter', color: '#84b1ce', bearing: 119, build: buildAria,
    details: [{ id: 'crown', label: 'Crown lettering', target: [-235, 180, 970], bearing: 101, elevation: 0.25, range: 113 }],
    description: 'Two opposing arcs of blue glass with a slatted crown, illuminated Aria lettering, and a sweeping arrival canopy.' },
  { id: 'vdara', title: 'Vdara', district: 'CityCenter', color: '#83adc8', bearing: 46, build: buildVdara,
    description: 'Three staggered crescents with different heights and tight ribbons of etched glass.' },
  { id: 'veer', title: 'Veer Towers', district: 'CityCenter', color: '#d2b85e', bearing: 68, build: buildVeer,
    description: 'Two towers lean in opposing directions. Amber shade fins change the rhythm of each elevation.' },
  { id: 'crystals', title: 'The Shops at Crystals', district: 'CityCenter', color: '#bbcdd1', bearing: 94, build: buildCrystals,
    description: 'Sloping zinc panels and glass skylights fold together above the Strip storefronts.' },
  { id: 'blvd', title: 'BLVD Las Vegas', district: 'Across from ARIA', color: '#d2c8b7', bearing: 277, build: buildBlvd,
    details: [
      { id: 'north', label: 'ABC, JD Sports & H&M', target: [178, 8, 1063], bearing: 281, elevation: 0.18, range: 120 },
      { id: 'south', label: 'Puma & Pandora', target: [175, 9, 1190], bearing: 269, elevation: 0.18, range: 98 },
    ],
    description: 'Glass storefronts, street-facing video panels, and the elevated In-N-Out dining deck across from ARIA.' },
  { id: 'showcase', title: 'Showcase Mall', district: 'Across from New York–New York', color: '#eac07a', bearing: 272, build: buildShowcase,
    details: [
      { id: 'hard-rock-cafe', label: 'Hard Rock Cafe', target: [178, 13, 1338], bearing: 263, elevation: 0.16, range: 67 },
      { id: 'candy', label: 'Coca-Cola & M&M’s', target: [178, 11, 1418], bearing: 276, elevation: 0.18, range: 68 },
    ],
    description: 'The guitar sign, contoured glass Coke bottle, giant candy package, and the shops beneath them.' },
  { id: 'waldorf-storefronts', view: 'blvd', title: 'Whataburger & Parry’s', district: 'Waldorf Astoria', color: '#ed8f58', bearing: 84,
    build: buildWaldorfStorefronts, description: 'A two-story street front with an orange canopy and the two restaurant signs.' },
  { id: 'cosmopolitan', title: 'The Cosmopolitan', district: 'Harmon Avenue', color: '#8daed2', bearing: 76, build: buildCosmopolitan,
    description: 'Folded glass towers over a shared podium, with rows of projecting terraces and balcony rails.' },
  { id: 'planet-hollywood', title: 'Planet Hollywood', district: 'Harmon Avenue', color: '#c5adba', bearing: -65, build: buildPlanetHollywood,
    description: 'A tall central hotel with rounded lower wings, stone frames, and a Strip-facing marquee.' },
  { id: 'flamingo', title: 'Flamingo', district: 'Flamingo Road', color: '#e1a4c8', bearing: -65, build: buildFlamingo,
    description: 'Periwinkle glazing set between cream piers, with rose lighting along the lower floors.' },
  { id: 'caesars', title: 'Caesars Palace', district: 'Flamingo Road', color: '#e7c9ab', bearing: 136, build: buildCaesars,
    details: [
      { id: 'flamingo', label: 'Flamingo frontage', target: [-126, 49, 77], bearing: 144, elevation: 0.39, range: 339 },
      { id: 'roofs', label: 'Tower roofs', target: [-145, 119, 63], bearing: 155, elevation: 0.61, range: 305 },
      { id: 'casino-roofs', label: 'Casino and lower roofs', target: [-77, 43, -90], bearing: 115, elevation: 0.48, range: 308 },
      { id: 'colosseum', label: 'Colosseum', target: [-30, 16, -183], bearing: 82, elevation: 0.48, range: 174 },
    ],
    description: 'Augustus, Octavius and Palace towers with layered stone façades, red temple roofs, and the Colosseum.' },
  { id: 'highroller', title: 'High Roller', district: 'The LINQ Promenade', color: '#6cd9f1', bearing: 101, build: buildHighRoller,
    details: [
      { id: 'cabins', label: 'Cabins and rim', target: [575, 138, -151], bearing: 108, elevation: 0.23, range: 106 },
      { id: 'station', label: 'Wheel House', target: [575, 15, -144], bearing: 65, elevation: 0.43, range: 122 },
    ],
    description: 'A single illuminated rim, 112 tension cables, and 28 level glass capsules above the Wheel House.' },
  { id: 'grand-prix', title: 'Grand Prix Plaza', district: 'Harmon & Koval', color: '#ff5761', bearing: 144, build: buildGrandPrixPlaza,
    details: [{ id: 'pit-straight', label: 'Pit straight', target: [1157, 12, 732], bearing: 134, elevation: 0.62, range: 345 }],
    description: 'The Formula 1 pit building and roof display, with a race-week grandstand, starting grid, and the first four turns.' },
  { id: 'venetian', title: 'The Venetian', district: 'The Venetian Resort', color: '#ddc29a', bearing: -62, build: buildVenetian,
    details: [{ id: 'canal', label: 'Canal frontage', target: [327, 29, -629], bearing: -68, elevation: 0.43, range: 215 }],
    description: 'Two pale hotel towers above the Grand Canal, the Doge’s Palace arcades, the Rialto Bridge, and the brick Campanile.' },
  { id: 'palazzo', title: 'The Palazzo', district: 'Spring Mountain Road', color: '#c6a17b', bearing: -48, build: buildPalazzo,
    details: [{ id: 'tower', label: 'Tower frontage', target: [592, 105, -873], bearing: -22, elevation: 0.34, range: 337 }],
    description: 'A gold-lit limestone tower with vertical PALAZZO lettering, broad bands, and pools on the resort roof.' },
  { id: 'treasure-island', title: 'Treasure Island', district: "Sirens’ Cove", color: '#e1a68e', bearing: 89, build: buildTreasureIsland,
    details: [
      { id: 'cove', label: 'Sirens’ Cove', target: [370, 8, -944], bearing: 87, elevation: 0.65, range: 158 },
      { id: 'corner', label: 'CVS corner display', target: [414, 14, -998], bearing: 73, elevation: 0.12, range: 57 },
    ],
    description: 'Coral piers wrap a three-wing tower above the lagoon, its two pirate ships, and the Strip marquee.' },
  { id: 'guitar', title: 'Hard Rock / former Mirage', district: 'Mid Strip', color: '#7eb5c7', bearing: 164,
    details: [
      { id: 'guitar-front', label: 'Guitar from the south', target: [140, 102, -546], bearing: 172, elevation: 0.14, range: 337.48 },
      { id: 'hotel-glazing', label: 'Former Mirage glazing', target: [-67, 50, -566], bearing: 149, elevation: 0.26, range: 312 },
    ],
    description: 'Cobalt glass and six silver strings define the Guitar Hotel. The neck steel is exposed and the former Mirage tower is halfway through recladding.',
    build(data, options, engine) {
      const hotel = buildHardRockHotel(data, options);
      hotel.add(buildGuitar(data, options, engine));
      return hotel;
    } },
  { id: 'trump', title: 'Trump International Hotel', district: 'Fashion Show Drive', color: '#d1a74e', bearing: 148, build: buildTrumpHotel,
    details: [{ id: 'crown', label: 'Silver crown', target: [171, 184, -1486], bearing: 148, elevation: 0.24, range: 117 }],
    description: 'Gold curtain walls rise between stepped bronze returns and a silver crown with serif lettering.' },
  { id: 'flamingo-approach', title: 'Flamingo marquees', district: 'Las Vegas Boulevard', color: '#ef7675', bearing: 171, build: buildFlamingoMarquees,
    description: 'The temple-crowned Caesars Palace LED and three-sided Horseshoe display frame the Strip.' },
  { id: 'fashion-show', title: 'Fashion Show', district: 'Spring Mountain Road', color: '#b0bfc4', bearing: 138, build: buildFashionShow,
    details: [{ id: 'columns', label: 'LED columns', target: [555, 24, -1245], bearing: 101, elevation: 0.13, range: 137 }],
    description: 'Two silver columns with wraparound displays support the tilted Cloud canopy.' },
  { id: 'wynn-marquees', view: 'encore-marquee', title: 'Wynn and Encore marquees', district: 'North Strip', color: '#c39a75', bearing: 204, build: buildWynnMarquees,
    details: [
      { id: 'wynn', label: 'Wynn at Sands', target: [626, 25, -1172], bearing: 208, elevation: 0.12, range: 96 },
      { id: 'encore', label: 'Encore street sign', target: [851, 26, -1672], bearing: 211, elevation: 0.12, range: 93 },
    ],
    description: 'Wynn’s bronze scroll and Encore’s oval crest frame two working portrait displays.' },
  { id: 'strat', title: 'The STRAT / Stratosphere', district: 'North Strip', color: '#c4ddfa', bearing: 127, build: buildStrat,
    details: [
      { id: 'skypod', label: 'SkyPod', target: [1714, 258.9, -3470], bearing: 135, elevation: 0.34, range: 90 },
      { id: 'entrance', label: 'Entrance', target: [1714, 19.3, -3469], bearing: 83, elevation: 0.49, range: 105 },
    ],
    description: 'Three swept concrete legs rise to the SkyPod, with its diamond lattice, red Big Shot mast, and reference-era ride hardware.' },
  { id: 'park-mgm', title: 'Park MGM', district: 'The Park', color: '#c3a773', bearing: 91, build: buildParkMgm,
    details: [{ id: 'crown', label: 'Crown lettering', target: [-109, 103, 1290], bearing: 96, elevation: 0.25, range: 118 }],
    description: 'Pale hotel wings with a charcoal-green crown and warm, individually spaced Park MGM letters.' },
  { id: 'tmobile', title: 'T-Mobile Arena', district: 'The Park', color: '#d986ad', bearing: 68, build: buildTMobile,
    details: [{ id: 'plaza', label: 'Toshiba Plaza', target: [-251, 22, 1471], bearing: 61, elevation: 0.19, range: 163 }],
    description: 'A slatted bronze bowl opens onto Toshiba Plaza with a sculpted glass concourse, video mesh, and roofline lettering.' },
  { id: 'allegiant', title: 'Allegiant Stadium', district: 'West of I-15', color: '#b6c3cd', bearing: 56, build: buildAllegiant,
    details: [
      { id: 'north', label: 'North Lanai', target: [-736, 26, 2719], bearing: 29, elevation: 0.19, range: 194 },
      { id: 'roof', label: 'ETFE roof', target: [-789, 59, 2841], bearing: 94, elevation: 0.83, range: 374 },
    ],
    description: 'The charcoal shell wraps a glazed North Lanai and a ribbed ETFE roof, with curved stadium lettering around the apron.' },
];

const southModels = [
  { id: 'mandalay-bay', view: 'luxor', title: 'Mandalay Bay', district: 'South Strip', color: '#dabe7d', bearing: 72, needsGraph: true,
    description: 'The gold hotel wings, W Las Vegas, and the landscaped beach complex.',
    build: (data, _options, _engine, graph) => buildMandalayBay(data, graph) },
  { id: 'luxor', title: 'Luxor', district: 'South Strip', color: '#8097b2', bearing: 68, needsGraph: true,
    description: 'The dark glass pyramid, adjoining hotel towers, and the Sphinx court.',
    build: (data, _options, _engine, graph) => buildLuxor(data, graph) },
  { id: 'mgm', title: 'MGM Grand', district: 'Tropicana Avenue', color: '#92bb9e', bearing: -55, needsGraph: true,
    description: 'Green curtain walls, gold roof lettering, and the Strip-facing lion rotunda.',
    build: (data, _options, _engine, graph) => buildMGM(data, graph) },
  { id: 'nyny', view: 'mgm', title: 'New York-New York', district: 'Tropicana Avenue', color: '#c9b593', bearing: 68,
    description: 'A cluster of New York skyscrapers, the Brooklyn Bridge, and the Statue of Liberty.', build: buildNYNY },
  { id: 'excalibur', view: 'mgm', title: 'Excalibur', district: 'Tropicana Avenue', color: '#c8a4a8', bearing: 82,
    description: 'Castle gatehouses, white towers, and the colored conical turrets along the Strip.', build: buildExcalibur },
];

export const studioModels = [...stripModels, ...southModels];
