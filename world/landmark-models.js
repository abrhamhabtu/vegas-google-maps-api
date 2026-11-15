/** Shared landmark catalogue. Builders return independent Three.js groups in local metres. */
import { buildAria, buildVdara, buildVeer, buildCrystals, buildCosmopolitan } from './citycenter.js';
import { buildPlanetHollywood, buildFlamingo, buildVenetian, buildPalazzo, buildHardRockHotel } from './mid-strip-resorts.js';
import { buildGuitar } from '../landmarks/vendor/landmarks/guitar.js';
import { buildLuxor } from './luxor.js';
import { buildMandalayBay } from './mandalay-bay.js';
import { buildMGM, buildNYNY } from './tropicana-trio.js';
import { buildExcalibur } from './excalibur.js';

export const stripModels = [
  { id: 'aria', title: 'ARIA', district: 'CityCenter', color: '#84b1ce', bearing: 119, build: buildAria,
    description: 'Two opposing blue glass arcs, silver service floors, and a low, sweeping arrival canopy.' },
  { id: 'vdara', title: 'Vdara', district: 'CityCenter', color: '#83adc8', bearing: 46, build: buildVdara,
    description: 'Three staggered crescents with different heights and tight ribbons of etched glass.' },
  { id: 'veer', title: 'Veer Towers', district: 'CityCenter', color: '#d2b85e', bearing: 68, build: buildVeer,
    description: 'Two towers lean in opposing directions. Amber shade fins change the rhythm of each elevation.' },
  { id: 'crystals', title: 'The Shops at Crystals', district: 'CityCenter', color: '#bbcdd1', bearing: 94, build: buildCrystals,
    description: 'Sloping zinc panels and glass skylights fold together above the Strip storefronts.' },
  { id: 'cosmopolitan', title: 'The Cosmopolitan', district: 'Harmon Avenue', color: '#8daed2', bearing: 76, build: buildCosmopolitan,
    description: 'Folded glass towers over a shared podium, with rows of projecting terraces and balcony rails.' },
  { id: 'planet-hollywood', title: 'Planet Hollywood', district: 'Harmon Avenue', color: '#c5adba', bearing: -65, build: buildPlanetHollywood,
    description: 'A tall central hotel with rounded lower wings, stone frames, and a Strip-facing marquee.' },
  { id: 'flamingo', title: 'Flamingo', district: 'Flamingo Road', color: '#e1a4c8', bearing: -65, build: buildFlamingo,
    description: 'Periwinkle glazing set between cream piers, with rose lighting along the lower floors.' },
  { id: 'venetian', title: 'The Venetian', district: 'The Venetian Resort', color: '#ddc29a', bearing: -62, build: buildVenetian,
    description: 'The Venetian and Venezia hotel towers use paired windows, deep pilasters, and layered Italian cornices.' },
  { id: 'palazzo', title: 'The Palazzo', district: 'Spring Mountain Road', color: '#c6a17b', bearing: -48, build: buildPalazzo,
    description: 'A taller, warmer limestone tower with three wings, vertical piers, and a deep top arcade.' },
  { id: 'guitar', title: 'Hard Rock / former Mirage', district: 'Mid Strip', color: '#cda873', bearing: 133,
    description: 'The retained Y-shaped Mirage in its reference-era colors, with the Hard Rock guitar on the former volcano site.',
    build(data, options, engine) {
      const hotel = buildHardRockHotel(data, options);
      hotel.add(buildGuitar(data, engine));
      return hotel;
    } },
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
