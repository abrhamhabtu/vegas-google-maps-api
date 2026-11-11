// Small original illustrations for landmark labels.
const pillars = (xs, y, h, color, width) => xs.map(x =>
  `<path d="M${x} ${y}v${h}" stroke="${color}" stroke-width="${width}"/>`,
).join('');

const art = {
  bellagio: `
    <path d="M5 34V14l15-3 3-3 3 3 15 3v20z" fill="#9e7254" stroke="#ead4a7" stroke-width="1.1"/>
    <path d="M6 17l14-2h6l14 2M6 24l14-1h6l14 1M6 32l14-1h6l14 1" stroke="#f9d990" stroke-width="1.2"/>
    ${pillars([9,13,17,21,25,29,33,37], 15, 19, '#30364c', 1.65)}
    <path d="M0 37q10-3 23-3t23 3v9H0z" fill="#273c6e"/>
    <path d="M7 41q3-11 6 0m0 0q4-17 8 0m-2 0q4-21 8 0m-2 0q4-17 8 0m0 0q3-11 6 0" fill="none" stroke="#ffe9a3" stroke-width="1.35"/>
    <path d="M10 42h26m-21 2h16" stroke="#f5d18b" stroke-width=".8"/>`,
  paris: `
    <ellipse cx="23" cy="21.5" rx="15.8" ry="18.2" fill="#1c3972" stroke="#bddaff" stroke-width="1"/>
    <path d="M23 3c-16 10-16 27 0 37m0-37c16 10 16 27 0 37m0-37v37M9 13q14 4 28 0M7 25q16 4 32 0M12 34q11 4 22 0" fill="none" stroke="#91bbf1" stroke-width=".85"/>
    <path d="M8 25q5-7 10 1 5-7 10 0 5-7 10-1m-29 3q14 4 28 0" fill="none" stroke="#ffd36f" stroke-width="1.4"/>
    <text x="23" y="19" fill="#ffb29c" stroke="#291b36" stroke-width=".3" text-anchor="middle" font-family="Georgia,serif" font-size="11" font-weight="bold" font-style="italic">Paris</text>
    <path d="M20 39h6v5h-6z" fill="#e3b57a"/>`,
  caesars: `
    <path d="M4 16 23 6l19 10v3H4z" fill="#ddc293" stroke="#f8e6c8" stroke-width="1"/>
    <path d="M10 15 23 9l13 6z" fill="#83705f"/>
    <path d="M7 19h32v19H7z" fill="#655442"/>
    ${pillars([9,15,21,27,33,38], 19, 18, '#f3ddb3', 3.3)}
    <path d="M4 18h38m-39 21h40m-42 3h44" stroke="#f6dfb9" stroke-width="1.8"/>
    <path d="M22 11h2v3h-2z" fill="#e2bd79"/>`,
  flamingo: `
    <path d="M22 39C9 40 4 34 3 24c8 3 12 7 18 14M23 39C9 32 8 21 9 16c9 5 11 12 14 23M23 39C15 30 16 20 20 13c4 7 5 16 3 26M24 39c5-13 10-21 15-23 1 10-5 19-15 23M24 39c9-9 14-11 19-12-1 10-8 13-19 12" fill="#da477f" stroke="#ffb575" stroke-width="1.3"/>
    <path d="M22 41V27q-1-5 4-5l3 3" fill="none" stroke="#ffdca1" stroke-width="1.6"/>
    <text x="23" y="12" text-anchor="middle" font-size="8" font-family="Georgia,serif" font-style="italic" fill="#ffdce9">Flamingo</text>
    <path d="M9 42h28" stroke="#f7aa7b" stroke-width="1.5"/>`,
  resortsworld: `
    <path d="M0 0h46v46H0z" fill="#87a5c7"/>
    <path d="M6 15q10-5 18-1l17 7v17H6z" fill="#a85b46" stroke="#f2d3bd" stroke-width="1"/>
    <path d="M6 16q9-5 18-2v22q-10-3-18 0z" fill="#703534"/>
    <path d="M8 20q8-4 14-3v13q-7-1-14 2z" fill="#333140"/>
    <path d="M11 27c4-6 6-4 9-7-1 4-2 8-5 8l-2-2z" fill="#cc6554"/>
    <path d="M25 14v21m14-14v18M30 17v21m4-19v20M24 20l16 7m-16-2 16 7m-16-2 16 7" stroke="#e49e72" stroke-width=".75"/>
    <path d="M4 37l9-2 12 1 8 2h11v8H2z" fill="#f4dcc6"/>
    <path d="M13 39q6-2 13 1l-5 3-10-1z" fill="#83cccf"/>`,
  'circus-circus': `
    <path d="M0 0h46v46H0z" fill="#93abc6"/>
    <path d="M8 12l12-3v22H8zm16-3 13 4v18H24z" fill="#ecdcc7"/>
    ${pillars([10,13,16,19,25,28,31,34], 13, 17, '#6d646c', 1.25)}
    <path d="M4 33q4-2 10-6l3-5h12l4 5 9 6v8H4z" fill="#f5e8d9"/>
    <path d="M17 22h3l-8 11H7zm5 0h3l-1 11h-5zm6 0h2l8 11h-6z" fill="#c75776"/>
    <path d="M5 34h36v4H5z" fill="#ae526d"/>
    <path d="M10 39h26" stroke="#efbd71" stroke-width="2" stroke-dasharray="1 2"/>`,
  fontainebleau: `
    <path d="M0 0h46v46H0z" fill="#92aed0"/>
    <path d="M7 7l10 6 3 4 7 1 11-7 2 24q-17 9-31-1z" fill="#35618b" stroke="#c8e0f0" stroke-width="1"/>
    <path d="m12 11 2 25m4-21 2 23m6-20 1 20m5-23 1 21m4-23 1 21" stroke="#b2d6eb" stroke-width=".9"/>
    <path d="M3 35l10-2 10 5 20-4v12H3z" fill="#e1dfd8"/>
    <path d="M12 38l7 2-1 3-8-2zm14 2 7-2 2 3-7 2z" fill="#66aacc"/>
    <path d="M22 39l6 2-6 2-5-2z" fill="#f7f2e6"/>`,
};

export function landmarkBadgeArt(id) {
  return Object.hasOwn(art, id)
    ? `<svg viewBox="0 0 46 46" aria-hidden="true"><path d="M0 0h46v46H0z" fill="#172540"/>${art[id]}</svg>`
    : '';
}
