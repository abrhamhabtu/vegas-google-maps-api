// Small original illustrations for the four center Strip resort labels.
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
};

export function landmarkBadgeArt(id) {
  return Object.hasOwn(art, id)
    ? `<svg viewBox="0 0 46 46" aria-hidden="true"><path d="M0 0h46v46H0z" fill="#172540"/>${art[id]}</svg>`
    : '';
}
