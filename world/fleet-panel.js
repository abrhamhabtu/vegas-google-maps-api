import { buildRideCard } from '../landmarks/vendor/ui/ride.js';

const mountedPanels = new WeakMap();

const attribute = (element, name, value) => {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
};

/**
 * Mount the original Fleet ride UI. The engine owns the panel's render sync;
 * Fleet must also provide paused, setPaused(boolean), and resetRun().
 * Returns the root element and a refresh method for external state changes.
 */
export function mountFleetPanel(fleet, engine, { onFollowingChange } = {}) {
  if (mountedPanels.has(fleet)) return mountedPanels.get(fleet);

  const ui = document.getElementById('driving-ui') || document.createElement('div');
  ui.id = 'driving-ui';
  ui.setAttribute('role', 'region');
  ui.setAttribute('aria-label', 'Fleet driving controls');
  if (!ui.isConnected) document.body.append(ui);
  document.body.classList.add('fleet-panel-mounted');

  const previousChange = fleet.onChange;
  buildRideCard(fleet, ui);
  const refreshRide = fleet.onChange;
  const card = ui.querySelector('.ride');
  const body = ui.querySelector('.ride-body');
  const fold = ui.querySelector('.ride-fold');
  const lab = ui.querySelector('.lab');
  const labToggle = ui.querySelector('.lab-toggle');
  const pill = ui.querySelector('.dr-pill');
  const traffic = ui.querySelector('.lab-traffic input');
  const trafficNumber = ui.querySelector('.lab-traffic b');
  const go = ui.querySelector('.ride-go');
  const cancel = ui.querySelector('.ride-cancel');
  const trip = ui.querySelector('.ride-trip');
  const tripTitle = ui.querySelector('.ride-title');
  const stateButtons = [...ui.querySelectorAll('.seg button, .lab-chips button')];
  const carButtons = [...ui.querySelectorAll('.ride-head .seg button')];

  const group = (element, label) => {
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', label);
  };
  group(card, 'Robotaxi booking and driving');
  group(ui.querySelector('.ride-head .seg'), 'Vehicle');
  group(ui.querySelector('.seg-mode'), 'Driving style');
  group(ui.querySelector('.ride-body > .seg:not(.seg-mode)'), 'Driving mode');
  group(ui.querySelector('.ride-book'), 'Book a ride');
  group(ui.querySelector('.lab-chips'), 'Driving scenarios');
  group(ui.querySelector('.seg-cam'), 'Follow camera');
  group(pill, 'Driving telemetry');
  lab.setAttribute('role', 'region');
  lab.setAttribute('aria-label', 'Driving lab and run telemetry');
  body.id = 'fleet-ride-body';
  lab.id = 'fleet-driving-lab';
  fold.setAttribute('aria-controls', body.id);
  labToggle.setAttribute('aria-controls', lab.id);
  labToggle.setAttribute('aria-keyshortcuts', 'B');
  labToggle.title = 'Driving lab (B)';
  const cameras = ui.querySelector('.seg-cam');
  cameras.setAttribute('aria-keyshortcuts', 'C');
  cameras.title = 'Cycle follow camera (C)';
  traffic.setAttribute('aria-label', 'Nearby traffic vehicles');
  ui.querySelector('.ride-recentre').setAttribute('aria-label', 'Follow the selected car');
  const manual = ui.querySelector('.ride-keys');
  manual.id = 'fleet-manual-instructions';
  const modes = [...ui.querySelectorAll('.ride-body > .seg:not(.seg-mode) button')];
  modes[0].setAttribute('aria-label', 'Self-driving mode');
  modes[1].setAttribute('aria-label', 'Manual driving mode');
  modes[1].setAttribute('aria-describedby', manual.id);
  for (const button of carButtons) {
    const cname = button.textContent.trim();
    button.setAttribute('aria-label', `Select ${cname}`);
    button.querySelector('i')?.setAttribute('aria-hidden', 'true');
    const carSpecs = {
      Zoox: '3.63 m bidirectional robotaxi with sliding glass doors, four corner sensor pods, and four-wheel steering.',
      Waymo: 'Silver Ojai with the sixth-generation Waymo Driver, a wide roof sensor bar, and fender and rear sensors.',
      Tesla: 'Gold two-seat Cybercab with butterfly doors, flush exterior cameras, and front and rear lightbars.'
    };
    button.dataset.tipTitle = `${cname} Autonomous Vehicle`;
    button.dataset.tipSub = 'Click to select & follow on the Las Vegas Strip';
    button.dataset.tip = carSpecs[cname] || `Select ${cname} autonomous vehicle.`;
  }
  const addHelpBadge = (targetEl, title, sub, text) => {
    if (!targetEl || targetEl.querySelector('.help-q')) return;
    const q = document.createElement('span');
    q.className = 'help-q';
    q.textContent = '?';
    q.setAttribute('aria-hidden', 'true');
    q.dataset.tipTitle = title;
    q.dataset.tipSub = sub;
    q.dataset.tip = text;
    targetEl.append(q);
  };
  const styleButtons = [...ui.querySelectorAll('.seg-mode button')];
  if (styleButtons[0]) {
    styleButtons[0].dataset.tipTitle = 'Smooth Driving Profile';
    styleButtons[0].dataset.tipSub = 'Chauffeur-grade passenger comfort';
    styleButtons[0].dataset.tip = 'Gentle acceleration & braking, generous following headways, and early turn-pocket alignment along the Strip.';
  }
  if (styleButtons[1]) {
    styleButtons[1].dataset.tipTitle = 'Assertive Driving Profile';
    styleButtons[1].dataset.tipSub = 'Dynamic urban lane-change planner';
    styleButtons[1].dataset.tip = 'Brisk throttle response, proactive passing around slower traffic, and tighter intersection gap acceptance.';
  }
  modes[0].dataset.tipTitle = 'L4 Self-Driving Mode';
  modes[0].dataset.tipSub = 'Autonomous route & intersection control';
  modes[0].dataset.tip = 'Vehicle autonomously navigates lanes, traffic signals, turn pockets, and resort porte-cochère valets.';
  modes[1].dataset.tipTitle = 'Manual Drive Mode (WASD / Arrows)';
  modes[1].dataset.tipSub = 'Take the wheel yourself';
  modes[1].dataset.tip = 'Drive any vehicle manually using W/S or Up/Down for throttle/brake, A/D or Left/Right to steer, and Space for e-brake.';
  labToggle.dataset.tipTitle = 'Autonomous Driving Lab (Shortcut: B)';
  labToggle.dataset.tipSub = 'Scenarios, traffic density & live telemetry';
  labToggle.dataset.tip = 'Open the AV testbed to trigger edge-case traffic scenarios, adjust live vehicle count, and inspect safety telemetry.';
  cameras.dataset.tipTitle = 'Camera Perspective (Shortcut: C)';
  cameras.dataset.tipSub = 'Chase · Hood · Overhead';
  cameras.dataset.tip = 'Switch between 3D Chase Cam behind the vehicle, low-hood street view, or top-down lane-planning view.';

  // Quick-dispatch preset routes for instant 1-click Strip rides
  const bookBox = ui.querySelector('.ride-book');
  if (bookBox && !bookBox.querySelector('.ride-quick-routes')) {
    const quickWrap = document.createElement('div');
    quickWrap.className = 'ride-quick-routes';
    const quickHeader = document.createElement('div');
    quickHeader.className = 'ride-quick-header';
    quickHeader.innerHTML = `<span>Instant Strip Rides</span>`;
    addHelpBadge(
      quickHeader,
      'Instant Strip Valet-to-Valet Rides',
      '1-Click Autonomous Dispatch',
      'Click any route pill to immediately dispatch the selected robotaxi between iconic Las Vegas resort porte-cochère valets and lock the chase camera.'
    );
    const quickPills = document.createElement('div');
    quickPills.className = 'ride-quick-pills';
    const presets = [
      ['ARIA → Bellagio', 'ARIA', 'Bellagio', 'Cruise past Crystals, Gucci & Cosmopolitan into the Bellagio porte-cochère.'],
      ['Caesars → Wynn', 'Caesars Palace', 'Wynn Las Vegas', 'Northbound Strip run past The Mirage/Hard Rock, Venetian & Treasure Island to Wynn.'],
      ['MGM → Venetian', 'MGM Grand', 'The Venetian', 'Full mid-Strip autonomous run across Tropicana, Harmon & Flamingo intersections.'],
      ['NYNY → ARIA', 'New York-New York', 'ARIA', 'Pass Showcase Mall, Park MGM, BLVD (In-N-Out & Adidas) into ARIA valet.']
    ];
    const fromSel = bookBox.querySelector('.ride-from');
    const toSel = bookBox.querySelector('.ride-to');
    for (const [label, fromName, toName, desc] of presets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ride-quick-pill';
      btn.textContent = label;
      btn.dataset.tipTitle = label;
      btn.dataset.tipSub = '1-Click Robotaxi Dispatch';
      btn.dataset.tip = desc;
      btn.addEventListener('click', () => {
        const fi = fleet.places.findIndex(p => p.name === fromName);
        const ti = fleet.places.findIndex(p => p.name === toName);
        if (fi >= 0 && ti >= 0 && fromSel && toSel) {
          fromSel.value = String(fi);
          toSel.value = String(ti);
          fromSel.dispatchEvent(new Event('change'));
          toSel.dispatchEvent(new Event('change'));
          go.click();
        }
      });
      quickPills.append(btn);
    }
    quickWrap.append(quickHeader, quickPills);
    bookBox.insertBefore(quickWrap, go);
  }

  for (const icon of ui.querySelectorAll('svg')) icon.setAttribute('aria-hidden', 'true');
  const stats = ui.querySelector('.lab-stats');
  stats.setAttribute('role', 'list');
  stats.setAttribute('aria-label', 'Run telemetry');
  const statTips = [
    ['Collisions', 'Total vehicle-to-vehicle contact events during the current test run.'],
    ['Red Lights', 'Signalized stop-bar violations while intersection phase is red.'],
    ['Hard Stops', 'High-deceleration braking events (> 4.5 m/s²) or Automatic Emergency Braking (AEB).'],
    ['Ride Comfort', 'Passenger lateral & longitudinal smoothness score based on jerk and steering work.']
  ];
  [...stats.children].forEach((stat, idx) => {
    stat.setAttribute('role', 'listitem');
    const [stTitle, stDesc] = statTips[idx] || ['Telemetry Metric', 'Live autonomous driving performance metric.'];
    stat.dataset.tipTitle = stTitle;
    stat.dataset.tipSub = 'Live AV Telemetry';
    stat.dataset.tip = stDesc;
  });
  pill.querySelector('.dr-unit').setAttribute('aria-hidden', 'true');

  const transport = document.createElement('div');
  transport.className = 'fleet-transport';
  group(transport, 'City simulation');
  const cityStatus = document.createElement('span');
  cityStatus.className = 'fleet-city-status';
  const pause = document.createElement('button');
  pause.className = 'fleet-pause';
  const reset = document.createElement('button');
  reset.className = 'fleet-reset';
  reset.textContent = 'Reset city';
  reset.setAttribute('aria-label', 'Reset city simulation');
  reset.title = 'Reset city simulation';
  transport.append(cityStatus, pause, reset);
  body.append(transport);

  const announcement = document.createElement('div');
  announcement.className = 'fleet-announcement sr-only';
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  ui.append(announcement);
  const announce = text => {
    if (announcement.textContent !== text) announcement.textContent = text;
  };
  for (const button of ui.querySelectorAll('button')) button.type = 'button';

  let previousFollowing;
  let previousStatus;
  const sync = () => {
    const following = Boolean(fleet.following);
    const paused = Boolean(fleet.paused);
    const hidden = ui.hidden || ui.classList.contains('dr-hidden') || document.body.classList.contains('hide-chrome');
    const folded = card.classList.contains('folded');
    const labOpen = !lab.hidden;
    const focused = document.activeElement;
    ui.inert = hidden;
    body.inert = folded;
    lab.inert = !labOpen;
    attribute(ui, 'aria-hidden', hidden);
    attribute(body, 'aria-hidden', folded);
    attribute(fold, 'aria-expanded', !folded);
    attribute(fold, 'aria-label', `${folded ? 'Expand' : 'Collapse'} driving controls`);
    attribute(labToggle, 'aria-expanded', labOpen);
    attribute(labToggle, 'aria-label', `${labOpen ? 'Close' : 'Open'} driving lab`);
    for (const button of stateButtons) attribute(button, 'aria-pressed', button.classList.contains('on'));
    if (folded && body.contains(focused) && !hidden) fold.focus();
    if (!labOpen && lab.contains(focused) && !hidden) labToggle.focus();
    if (hidden && ui.contains(focused)) document.getElementById('show-controls')?.focus();
    attribute(cancel, 'aria-label', cancel.textContent === 'Done' ? 'Finish the completed ride' : 'Cancel the current ride');

    const count = String(fleet.trafficCount);
    if (traffic.value !== count) traffic.value = count;
    if (trafficNumber.textContent !== count) trafficNumber.textContent = count;
    attribute(traffic, 'aria-valuetext', `${count} traffic vehicles`);
    const speed = pill.querySelector('b');
    attribute(speed, 'aria-label', `${speed.textContent} miles per hour`);
    const limit = pill.querySelector('.dr-limit');
    attribute(limit, 'aria-label', `Speed limit ${limit.textContent} miles per hour`);
    const turn = pill.querySelector('.dr-turn');
    attribute(turn, 'aria-label', `Next turn: ${turn.textContent.replace('↰', 'left').replace('↱', 'right').replace('↶', 'U-turn')}`);
    const cityText = paused ? 'City paused' : 'City running';
    if (cityStatus.textContent !== cityText) cityStatus.textContent = cityText;
    attribute(transport, 'data-paused', paused);
    if (pause.textContent !== (paused ? 'Resume' : 'Pause')) pause.textContent = paused ? 'Resume' : 'Pause';
    attribute(pause, 'aria-label', `${paused ? 'Resume' : 'Pause'} city simulation`);

    // Announce phase changes and booking errors without reading speed every frame.
    const car = carButtons.find(button => button.classList.contains('on'))?.textContent.trim() || 'Vehicle';
    const error = go.textContent !== 'Request ride' ? go.textContent : '';
    const state = `${car}. ${!trip.hidden ? tripTitle.textContent : fleet.selected.phase === 'manual' ? 'Manual driving' : 'Self-driving'}. ${cityText}.`;
    const status = error || state;
    if (status !== previousStatus) { previousStatus = status; announce(status); }
    document.body.classList.toggle('fleet-following', following && !ui.hidden);
    if (following !== previousFollowing) {
      previousFollowing = following;
      onFollowingChange?.(following);
    }
  };
  const refresh = () => { refreshRide.call(fleet); sync(); };
  fleet.onChange = () => { previousChange?.call(fleet); refresh(); };
  pause.addEventListener('click', () => { fleet.setPaused(!fleet.paused); refresh(); });
  reset.addEventListener('click', () => { fleet.resetRun(); refresh(); announce('City simulation reset.'); });
  ui.addEventListener('click', sync);
  ui.addEventListener('input', sync);
  const observer = new MutationObserver(sync);
  for (const element of [card, lab, ui, document.body]) {
    observer.observe(element, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  matchMedia('(max-width: 960px)').addEventListener('change', event => {
    if (event.matches) card.classList.add('folded');
    sync();
  });
  let lastSync = 0;
  engine.afterRender.push(() => {
    const now = performance.now();
    if (now - lastSync < 150) return;
    lastSync = now;
    sync();
  });

  const panel = { element: ui, refresh };
  mountedPanels.set(fleet, panel);
  sync();
  return panel;
}
