// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { CAR_DOT, CAR_NAMES } from '../cars/vehicles.js';
import { PROFILES } from '../sim/driver.js';
import { SCENARIOS } from '../sim/fleet.js';
const el = (tag, cls, text)=>{
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};
export function buildRideCard(fleet, ui) {
    const pill = el('div', 'dr-pill');
    const speedEl = el('b'), unit = el('span', 'dr-unit', 'mph'), sign = el('span', 'dr-limit'), turn = el('span', 'dr-turn'), think = el('span', 'dr-think');
    pill.append(speedEl, unit, sign, turn, think);
    const card = el('div', 'ride');
    const head = el('div', 'ride-head');
    const cars = el('div', 'seg');
    const pills = new Map();
    for (const k of [
        'zoox',
        'waymo',
        'tesla'
    ]){
        const b = el('button');
        b.innerHTML = `<i style="background:${CAR_DOT[k]}"></i>${CAR_NAMES[k]}`;
        b.onclick = ()=>fleet.select(k);
        pills.set(k, b);
        cars.append(b);
    }
    const fold = el('button', 'ride-fold');
    fold.setAttribute('aria-label', 'Fold');
    fold.innerHTML = '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg>';
    head.append(cars, fold);
    const body = el('div', 'ride-body');
    fold.onclick = ()=>{
        card.classList.toggle('folded');
    };
    const styles = el('div', 'seg seg-mode');
    const styleBtns = new Map();
    for (const P of Object.values(PROFILES)){
        const b = el('button', undefined, P.label);
        b.dataset.key = P.key;
        b.onclick = ()=>fleet.setProfile(P.key);
        styleBtns.set(P.key, b);
        styles.append(b);
    }
    const modes = el('div', 'seg');
    const autoBtn = el('button', undefined, 'Self-driving'), driveBtn = el('button', undefined, 'Drive');
    autoBtn.onclick = ()=>fleet.setManual(false);
    driveBtn.onclick = ()=>{
        fleet.setManual(true);
        driveBtn.blur();
    };
    modes.append(autoBtn, driveBtn);
    const booking = el('div', 'ride-book');
    const row = (label)=>{
        const w = el('label', 'ride-row');
        const s = el('select');
        s.setAttribute('aria-label', label);
        w.append(el('span', undefined, label), s);
        return {
            w,
            s
        };
    };
    const pick = row('Pick up'), drop = row('Drop off');
    for (const p of fleet.places){
        pick.s.add(new Option(p.name, p.name));
        drop.s.add(new Option(p.name, p.name));
    }
    const start = (name, fallback)=>{
        const i = fleet.places.findIndex((p)=>p.name === name);
        return i >= 0 ? i : fallback;
    };
    pick.s.selectedIndex = start('Caesars Palace', 0);
    drop.s.selectedIndex = start('Bellagio', 1);
    const go = el('button', 'ride-go', 'Request ride');
    const flash = (t)=>{
        go.textContent = t;
        setTimeout(()=>{
            go.textContent = 'Request ride';
        }, 1500);
    };
    go.onclick = ()=>{
        const a = fleet.places[pick.s.selectedIndex], b = fleet.places[drop.s.selectedIndex];
        if (!a || !b || a === b) return flash('Choose two different places');
        if (!fleet.book(a, b)) flash('No route from here');
    };
    booking.append(pick.w, drop.w, go);
    const trip = el('div', 'ride-trip');
    const line1 = el('div', 'ride-title'), line2 = el('div', 'ride-sub'), bar = el('div', 'ride-bar'), fill = el('i');
    bar.append(fill);
    const cancel = el('button', 'ride-cancel', 'Cancel');
    cancel.onclick = ()=>fleet.cancel();
    trip.append(line1, line2, bar, cancel);
    const manual = el('div', 'ride-keys');
    manual.innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows · <kbd>Space</kbd> brake';
    const back = el('button', 'ride-recentre', 'Follow car');
    back.onclick = ()=>fleet.recentre();
    body.append(styles, modes, booking, trip, manual, back);
    card.append(head, body);
    const labBtn = el('button', 'lab-toggle');
    labBtn.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h4M7 2v4L3.5 12a1.3 1.3 0 0 0 1.1 2h6.8a1.3 1.3 0 0 0 1.1-2L9 6V2"/></svg>Lab';
    const lab = el('div', 'lab');
    lab.hidden = true;
    const toggleLab = ()=>{
        lab.hidden = !lab.hidden;
        labBtn.classList.toggle('on', !lab.hidden);
        if (!lab.hidden && innerWidth < 960) card.classList.add('folded');
    };
    labBtn.onclick = toggleLab;
    const chips = el('div', 'lab-chips');
    const chipBtns = new Map();
    for (const [key, label] of Object.entries(SCENARIOS)){
        const b = el('button', undefined, label);
        b.onclick = ()=>fleet.runScenario(key);
        chipBtns.set(key, b);
        chips.append(b);
    }
    const controls = el('div', 'lab-row');
    const traffic = el('label', 'lab-traffic');
    const slider = el('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '40';
    slider.value = String(fleet.trafficCount);
    slider.setAttribute('aria-label', 'Traffic');
    slider.oninput = ()=>{
        fleet.setDensity(Number(slider.value));
        trafficN.textContent = slider.value;
    };
    const trafficN = el('b', undefined, slider.value);
    traffic.append(el('span', undefined, 'Traffic'), slider, trafficN);
    const cams = el('div', 'seg seg-cam');
    const camBtns = new Map();
    for (const [m, label] of [
        [
            'chase',
            'Chase'
        ],
        [
            'high',
            'High'
        ],
        [
            'top',
            'Top'
        ]
    ]){
        const b = el('button', undefined, label);
        b.onclick = ()=>fleet.setCamera(m);
        camBtns.set(m, b);
        cams.append(b);
    }
    const reset = el('button', 'lab-reset', 'Reset run');
    reset.onclick = ()=>{
        fleet.telemetry = {
            seconds: 0,
            metres: 0,
            collisions: 0,
            redLights: 0,
            aeb: 0,
            hardStops: 0,
            passes: 0,
            yields: 0,
            lane: 0,
            samples: 0
        };
    };
    controls.append(traffic, cams, reset);
    const stats = el('div', 'lab-stats');
    const statEl = new Map();
    for (const [k, label] of [
        [
            'time',
            'Run'
        ],
        [
            'dist',
            'Driven'
        ],
        [
            'hit',
            'Contacts'
        ],
        [
            'red',
            'Red lights'
        ],
        [
            'pass',
            'Passes'
        ],
        [
            'aeb',
            'Emergency'
        ],
        [
            'hard',
            'Hard stops'
        ]
    ]){
        const c = el('div'), v = el('b', undefined, '0');
        c.append(v, el('span', undefined, label));
        statEl.set(k, v);
        stats.append(c);
    }
    const result = el('div', 'lab-result');
    lab.append(chips, controls, stats, result);
    ui.append(card, pill, labBtn, lab);
    if (innerWidth < 960) card.classList.add('folded');
    fleet.listen('keydown', (e)=>{
        const t = e.target;
        if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(SELECT|INPUT|TEXTAREA)$/.test(t?.tagName) || t?.isContentEditable || document.querySelector('.modal-backdrop:not(.hidden) [aria-modal="true"]')) return;
        const k = e.key.toLowerCase();
        if (k === 'b') toggleLab();
        if (k === 'c') {
            const order = [
                'chase',
                'high',
                'top'
            ];
            fleet.setCamera(order[(order.indexOf(fleet.cameraMode) + 1) % 3]);
        }
    });
    const mph = (v)=>`${Math.round(Math.abs(v) * 2.237)}`;
    const dist = (m)=>{
        const mi = m / 1609.34;
        return mi >= 0.1 ? `${mi.toFixed(1)} mi` : `${Math.round(m * 3.28 / 10) * 10} ft`;
    };
    const clock = (s)=>`${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const ARROW = {
        left: '↰',
        right: '↱',
        uturn: '↶'
    };
    const refresh = ()=>{
        const c = fleet.selected, isManual = c.phase === 'manual', onTrip = !isManual && !!c.pickup, d = c.driver;
        for (const [k, b] of pills)b.classList.toggle('on', k === c.kind);
        for (const [k, b] of styleBtns)b.classList.toggle('on', k === c.profile.key);
        autoBtn.classList.toggle('on', !isManual);
        driveBtn.classList.toggle('on', isManual);
        styles.hidden = isManual;
        booking.hidden = isManual || onTrip;
        trip.hidden = !onTrip;
        manual.hidden = !isManual;
        back.hidden = fleet.following;
        ui.classList.toggle('dr-following', fleet.following);
        pill.hidden = !fleet.following;
        speedEl.textContent = mph(c.v);
        if (d) {
            sign.hidden = false;
            sign.textContent = String(Math.round(d.limit * 2.237 / 5) * 5);
            const n = d.nextTurn(), left = n ? n.s - d.progress : Infinity;
            turn.hidden = !n || left > 800;
            if (n) turn.textContent = `${ARROW[n.movement]} ${dist(left)}${n.onto ? ` · ${n.onto}` : ''}`;
            think.textContent = d.tactic;
            think.classList.toggle('alarm', d.aebOn);
        } else {
            sign.hidden = true;
            turn.hidden = true;
            think.textContent = isManual ? 'You have the wheel' : '';
            think.classList.remove('alarm');
        }
        if (onTrip) {
            const name = (s)=>c[s]?.name ?? '';
            const left = d ? d.remaining : 0, moving = d?.waitingAtLight ? `Waiting for green · ${dist(left)}` : `${mph(c.v)} mph · ${dist(left)}`;
            let title = '', sub = '';
            if (c.phase === 'to-pickup') {
                title = `Picking up at ${name('pickup')}`;
                sub = moving;
            } else if (c.phase === 'boarding') {
                title = `Rider boarding at ${name('pickup')}`;
                sub = `Next stop ${name('dropoff')}`;
            } else if (c.phase === 'to-dropoff') {
                title = `Heading to ${name('dropoff')}`;
                sub = moving;
            } else if (c.phase === 'arriving') {
                title = `Dropping off at ${name('dropoff')}`;
                sub = 'Have a great time';
            } else if (c.phase === 'arrived') {
                title = `Arrived at ${name('dropoff')}`;
                sub = 'Ride complete';
            }
            line1.textContent = title;
            line2.textContent = sub;
            fill.style.width = d ? `${Math.min(100, d.progress / (d.path.length || 1) * 100).toFixed(1)}%` : c.phase === 'to-pickup' || c.phase === 'boarding' ? '0%' : '100%';
            cancel.textContent = c.phase === 'arrived' ? 'Done' : 'Cancel';
        }
        const active = fleet.scenario?.key ?? 'city';
        for (const [k, b] of chipBtns)b.classList.toggle('on', k === active);
        for (const [m, b] of camBtns)b.classList.toggle('on', m === fleet.cameraMode);
        const t = fleet.telemetry;
        statEl.get('time').textContent = clock(t.seconds);
        statEl.get('dist').textContent = dist(t.metres);
        statEl.get('hit').textContent = String(t.collisions);
        statEl.get('red').textContent = String(t.redLights);
        statEl.get('pass').textContent = String(t.passes);
        statEl.get('aeb').textContent = String(t.aeb);
        statEl.get('hard').textContent = String(t.hardStops);
        result.textContent = fleet.scenario ? fleet.scenario.armed ? `${SCENARIOS[fleet.scenario.key]} running…` : `Setting up ${SCENARIOS[fleet.scenario.key].toLowerCase()} on the road ahead…` : fleet.lastResult ?? '';
        result.hidden = !result.textContent;
        result.classList.toggle('bad', !!fleet.lastResult && /contact/.test(fleet.lastResult) && !fleet.scenario);
    };
    fleet.onChange = refresh;
    fleet.uiInterval = setInterval(refresh, 200);
    refresh();
}
