// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { latLonToXZ } from './core/data.js';
export const ORIGIN = {
    lat: 36.11624,
    lon: -115.17455
};
export const SIGN_LATLON = {
    lat: 36.0820593,
    lon: -115.1727735
};
const D = Math.PI / 180;
export const PLACES = [
    {
        id: 'welcome',
        name: 'Welcome to Fabulous Las Vegas',
        lat: 36.08206,
        lon: -115.17277,
        group: 'Strip',
        badge: {
            bg: '#e33b4c',
            fg: '#fff',
            glyph: '★'
        },
        view: {
            dist: 190,
            pitch: 58 * D,
            yaw: 0
        }
    },
    {
        id: 'mandalay',
        name: 'Mandalay Bay',
        lat: 36.0918,
        lon: -115.1748,
        group: 'Strip',
        badge: {
            bg: '#b8892c',
            fg: '#fff5d6',
            glyph: 'M'
        }
    },
    {
        id: 'allegiant',
        name: 'Allegiant Stadium',
        lat: 36.0908,
        lon: -115.1833,
        group: 'Off-Strip',
        badge: {
            bg: '#111317',
            fg: '#c7cbd3',
            glyph: 'A'
        },
        view: {
            dist: 900,
            pitch: 55 * D,
            yaw: -40 * D
        }
    },
    {
        id: 'luxor',
        name: 'Luxor',
        lat: 36.0955,
        lon: -115.176,
        group: 'Strip',
        badge: {
            bg: '#1c1f2b',
            fg: '#e8d79b',
            glyph: '▲'
        }
    },
    {
        id: 'excalibur',
        name: 'Excalibur',
        lat: 36.0986,
        lon: -115.1754,
        group: 'Strip',
        badge: {
            bg: '#c9353a',
            fg: '#fff',
            glyph: 'E'
        }
    },
    {
        id: 'nyny',
        name: 'New York-New York',
        lat: 36.1024,
        lon: -115.1747,
        group: 'Strip',
        badge: {
            bg: '#3d5b7a',
            fg: '#fff',
            glyph: 'NY'
        }
    },
    {
        id: 'tmobile',
        name: 'T-Mobile Arena',
        lat: 36.10283,
        lon: -115.17818,
        group: 'Strip',
        badge: {
            bg: '#3a2a22',
            fg: '#ff8a4a',
            glyph: 'T'
        }
    },
    {
        id: 'ballpark',
        name: 'Athletics Ballpark — under construction',
        lat: 36.09927,
        lon: -115.17002,
        group: 'Strip',
        badge: {
            bg: '#0f4d3a',
            fg: '#ffd23f',
            glyph: 'A’s'
        },
        view: {
            dist: 650,
            pitch: 55 * D,
            yaw: -40 * D
        }
    },
    {
        id: 'trop-overview',
        name: 'Tropicana corner (Luxor → MGM)',
        lat: 36.0985,
        lon: -115.1745,
        group: 'Strip',
        view: {
            dist: 1250,
            pitch: 58 * D,
            yaw: 42 * D
        }
    },
    {
        id: 'mgm',
        name: 'MGM Grand',
        lat: 36.1024,
        lon: -115.1699,
        group: 'Strip',
        badge: {
            bg: '#1f7a55',
            fg: '#e8d79b',
            glyph: 'MGM'
        },
        view: {
            dist: 700,
            pitch: 58 * D,
            yaw: 120 * D
        }
    },
    {
        id: 'tropicana',
        name: 'Tropicana Ave × the Strip',
        lat: 36.1021,
        lon: -115.1726,
        group: 'Strip',
        view: {
            dist: 380,
            pitch: 60 * D,
            yaw: 20 * D
        }
    },
    {
        id: 'aria',
        name: 'ARIA',
        lat: 36.1072,
        lon: -115.1768,
        group: 'Strip',
        info: 'Curvilinear Pelli Clarke Pelli glass towers at CityCenter with luxury porte-cochère valet & The Shops at Crystals.',
        badge: {
            bg: '#5f7593',
            fg: '#fff',
            glyph: 'A'
        }
    },
    {
        id: 'crystals',
        name: 'Crystals & Gucci Flagship',
        lat: 36.1080,
        lon: -115.1740,
        group: 'Strip',
        noValetLook: true,
        info: 'Studio Daniel Libeskind crystalline luxury district featuring the faceted Gucci Flagship, Louis Vuitton, Prada, Fendi, Dolce & Gabbana & Tiffany & Co.',
        badge: {
            bg: '#8c6d46',
            fg: '#fff2cf',
            glyph: 'G'
        },
        view: {
            dist: 310,
            pitch: 60 * D,
            yaw: -65 * D
        }
    },
    {
        id: 'blvd',
        name: 'BLVD · In-N-Out, Adidas & Netflix',
        lat: 36.1066,
        lon: -115.1722,
        group: 'Strip',
        noValetLook: true,
        info: 'East Strip flagship retail row across from ARIA featuring the new In-N-Out Burger Flagship, Adidas 3-Stripe Store, Netflix House, Lululemon, JD Sports, Puma & 63 Las Vegas.',
        badge: {
            bg: '#d91e26',
            fg: '#ffe033',
            glyph: 'B'
        },
        view: {
            dist: 320,
            pitch: 60 * D,
            yaw: 75 * D
        }
    },
    {
        id: 'cosmo',
        name: 'The Cosmopolitan',
        lat: 36.11,
        lon: -115.1745,
        group: 'Strip',
        badge: {
            bg: '#2b2f3a',
            fg: '#fff',
            glyph: 'C'
        }
    },
    {
        id: 'bellagio',
        name: 'Bellagio',
        lat: 36.1129,
        lon: -115.1766,
        group: 'Strip',
        badge: {
            bg: '#2c4e86',
            fg: '#f3e6c4',
            glyph: 'B'
        },
        view: {
            dist: 650,
            pitch: 57 * D,
            yaw: -70 * D
        }
    },
    {
        id: 'paris',
        name: 'Paris Las Vegas',
        lat: 36.1124,
        lon: -115.1705,
        group: 'Strip',
        badge: {
            bg: '#2b4fa3',
            fg: '#f6d36b',
            glyph: 'P'
        }
    },
    {
        id: 'caesars',
        name: 'Caesars Palace',
        lat: 36.1162,
        lon: -115.1755,
        group: 'Strip',
        badge: {
            bg: '#b79a5e',
            fg: '#fff',
            glyph: 'C'
        }
    },
    {
        id: 'flamingo',
        name: 'Flamingo Las Vegas',
        lat: 36.1162,
        lon: -115.1702,
        group: 'Strip',
        badge: {
            bg: '#e8508f',
            fg: '#fff',
            glyph: 'F'
        }
    },
    {
        id: 'flamingo-x',
        name: 'Flamingo Rd × the Strip',
        lat: 36.11468,
        lon: -115.17288,
        group: 'Strip',
        view: {
            dist: 170,
            pitch: 64 * D,
            yaw: 0
        }
    },
    {
        id: 'highroller',
        name: 'High Roller',
        lat: 36.1176,
        lon: -115.1684,
        group: 'Strip',
        badge: {
            bg: '#2d3a55',
            fg: '#7fd3ff',
            glyph: '◎'
        }
    },
    {
        id: 'mirage',
        name: 'Hard Rock — under construction',
        lat: 36.1212,
        lon: -115.1741,
        group: 'Strip',
        badge: {
            bg: '#a8812e',
            fg: '#fff',
            glyph: 'HR'
        }
    },
    {
        id: 'venetian',
        name: 'The Venetian',
        lat: 36.1215,
        lon: -115.1689,
        group: 'Strip',
        badge: {
            bg: '#8a6f45',
            fg: '#fff',
            glyph: 'V'
        }
    },
    {
        id: 'ti',
        name: 'Treasure Island',
        lat: 36.1247,
        lon: -115.1721,
        group: 'Strip',
        badge: {
            bg: '#5a3d8f',
            fg: '#ffd58a',
            glyph: 'TI'
        }
    },
    {
        id: 'sphere',
        name: 'Sphere',
        lat: 36.12123,
        lon: -115.16208,
        group: 'Off-Strip',
        badge: {
            bg: '#111',
            fg: '#9be7ff',
            glyph: '●'
        },
        view: {
            dist: 520,
            pitch: 58 * D,
            yaw: -150 * D
        }
    },
    {
        id: 'wynn',
        name: 'Wynn Las Vegas',
        lat: 36.1266,
        lon: -115.1655,
        group: 'Strip',
        badge: {
            bg: '#7a5a2e',
            fg: '#f3d7a2',
            glyph: 'W'
        }
    },
    {
        id: 'resortsworld',
        name: 'Resorts World',
        lat: 36.13477,
        lon: -115.16621,
        group: 'Strip',
        badge: {
            bg: '#b02344',
            fg: '#fff',
            glyph: 'RW'
        },
        view: { dist: 815, pitch: 52 * D, yaw: -10 * D }
    },
    {
        id: 'circus-circus',
        name: 'Circus Circus',
        lat: 36.13775,
        lon: -115.16538,
        group: 'Strip',
        badge: {
            bg: '#a34e69',
            fg: '#f5e9d8',
            glyph: 'CC'
        },
        view: { dist: 710, pitch: 57 * D, yaw: 23 * D }
    },
    {
        id: 'fontainebleau',
        name: 'Fontainebleau',
        lat: 36.13793,
        lon: -115.15950,
        group: 'Strip',
        badge: {
            bg: '#1c3c7a',
            fg: '#fff',
            glyph: 'F'
        },
        view: { dist: 860, pitch: 54 * D, yaw: -35 * D }
    },
    {
        id: 'strat',
        name: 'The STRAT',
        lat: 36.1475,
        lon: -115.1566,
        group: 'Strip',
        badge: {
            bg: '#2c3240',
            fg: '#ff6b5a',
            glyph: 'S'
        },
        view: {
            dist: 900,
            pitch: 60 * D,
            yaw: 200 * D
        }
    },
    {
        id: 'rio',
        name: 'Rio',
        lat: 36.1166,
        lon: -115.1866,
        group: 'Off-Strip',
        badge: {
            bg: '#7b2a9e',
            fg: '#fff',
            glyph: 'R'
        }
    },
    {
        id: 'palms',
        name: 'Palms',
        lat: 36.114,
        lon: -115.1946,
        group: 'Off-Strip',
        badge: {
            bg: '#1f7f8f',
            fg: '#fff',
            glyph: 'P'
        }
    },
    {
        id: 'lvcc',
        name: 'Las Vegas Convention Center',
        lat: 36.1312,
        lon: -115.1520,
        group: 'Off-Strip'
    },
    {
        id: 'fremont',
        name: 'Fremont Street Experience',
        lat: 36.1705,
        lon: -115.1436,
        group: 'Downtown',
        badge: {
            bg: '#1d2440',
            fg: '#ffd166',
            glyph: 'FS'
        },
        view: {
            dist: 520,
            pitch: 60 * D,
            yaw: 120 * D
        }
    }
];
export function placeXZ(p) {
    return latLonToXZ(ORIGIN, p.lat, p.lon);
}
export function viewFor(p) {
    const [x, z] = placeXZ(p);
    return {
        x,
        z,
        dist: 600,
        pitch: 56 * D,
        yaw: 0,
        ...p.view
    };
}
export function startView(id) {
    const p = id ? PLACES.find((q)=>q.id === id) : undefined;
    if (p) return viewFor(p);
    const [x, z] = latLonToXZ(ORIGIN, 36.1185, -115.1700);
    return {
        x,
        z,
        dist: 2300,
        pitch: 54 * D,
        yaw: -18 * D
    };
}
