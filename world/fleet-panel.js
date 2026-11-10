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
    button.setAttribute('aria-label', `Select ${button.textContent.trim()}`);
    button.querySelector('i')?.setAttribute('aria-hidden', 'true');
  }
  for (const icon of ui.querySelectorAll('svg')) icon.setAttribute('aria-hidden', 'true');
  const stats = ui.querySelector('.lab-stats');
  stats.setAttribute('role', 'list');
  stats.setAttribute('aria-label', 'Run telemetry');
  for (const stat of stats.children) stat.setAttribute('role', 'listitem');
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
