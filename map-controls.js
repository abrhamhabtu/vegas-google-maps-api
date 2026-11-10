/* Compact map chrome. Routing and vehicle state remain in app.js. */
window.setupMapChrome = function({ getMap, getLayer }) {
  const byId = id => document.getElementById(id);
  const places = byId('places-panel'), layers = byId('layers-panel');
  const placesButton = byId('places-toggle'), layersButton = byId('layers-toggle');
  const announce = text => { byId('map-announcement').textContent = text; };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let currentTheme = 'day';
  const hash = new URLSearchParams(location.hash.slice(1));

  function closePanels(restore = false) {
    const hadPlaces = !places.classList.contains('hidden');
    const hadLayers = !layers.classList.contains('hidden');
    places.classList.add('hidden'); layers.classList.add('hidden');
    placesButton.setAttribute('aria-expanded', 'false');
    layersButton.setAttribute('aria-expanded', 'false');
    if (restore && (hadPlaces || hadLayers)) (hadPlaces ? placesButton : layersButton).focus();
  }
  function togglePanel(panel, button) {
    const wasOpen = !panel.classList.contains('hidden');
    closePanels();
    if (!wasOpen) {
      panel.classList.remove('hidden');
      button.setAttribute('aria-expanded', 'true');
      if (panel === places) byId('places-filter').focus();
    }
  }
  placesButton.addEventListener('click', () => togglePanel(places, placesButton));
  layersButton.addEventListener('click', () => togglePanel(layers, layersButton));
  byId('places-close').addEventListener('click', () => closePanels(true));
  byId('layers-close').addEventListener('click', () => closePanels(true));
  document.addEventListener('pointerdown', event => {
    if (!places.contains(event.target) && !layers.contains(event.target) && !placesButton.contains(event.target) && !layersButton.contains(event.target)) closePanels();
  });
  byId('places-filter').addEventListener('input', event => {
    const query = event.target.value.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll('#landmark-chips .chip').forEach(chip => {
      const matches = chip.textContent.toLowerCase().includes(query);
      chip.hidden = !matches;
      if (matches) count++;
    });
    byId('places-empty').classList.toggle('hidden', count > 0);
  });
  document.querySelectorAll('#landmark-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      byId('view-title').textContent = chip.querySelector('span').textContent;
      const params = new URLSearchParams(location.hash.slice(1));
      params.set('view', chip.dataset.view);
      history.replaceState(null, '', '#' + params.toString());
      announce(`Viewing ${byId('view-title').textContent}`);
      closePanels(true);
    });
  });

  function applyRasterTheme() {
    const map = getMap();
    // Newly added raster sources may still be loading; paint can be set as soon
    // as their layers exist, including a deep-linked night/sunset initial view.
    if (!map) return;
    const palette = {
      day: { saturation: 0, max: 1, min: 0, contrast: 0 },
      golden: { saturation: -0.12, max: 0.92, min: 0.025, contrast: 0.04 },
      night: { saturation: -0.75, max: 0.40, min: 0.015, contrast: 0.14 },
    }[currentTheme];
    for (const id of ['google-roadmap-layer', 'google-satellite-layer']) {
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, 'raster-saturation', palette.saturation);
      map.setPaintProperty(id, 'raster-brightness-max', palette.max);
      map.setPaintProperty(id, 'raster-brightness-min', palette.min);
      map.setPaintProperty(id, 'raster-contrast', palette.contrast);
    }
  }
  function setTheme(name) {
    if (!['day', 'golden', 'night'].includes(name)) return;
    currentTheme = name;
    document.body.dataset.theme = name;
    document.querySelectorAll('.theme-btn').forEach(button => {
      const selected = button.dataset.theme === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    getLayer()?.setTheme(name);
    applyRasterTheme();
    const params = new URLSearchParams(location.hash.slice(1));
    params.set('theme', name);
    history.replaceState(null, '', '#' + params.toString());
    announce(`${name === 'golden' ? 'Sunset' : name} lighting`);
  }
  document.querySelectorAll('.theme-btn').forEach(button => button.addEventListener('click', () => setTheme(button.dataset.theme)));

  const panel = byId('av-panel'), panelBody = byId('av-panel-body'), collapse = byId('av-panel-toggle');
  collapse.addEventListener('click', () => {
    const expanded = panel.classList.toggle('collapsed') === false;
    collapse.setAttribute('aria-expanded', String(expanded));
    collapse.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} simulation controls`);
    panelBody.inert = !expanded;
  });
  const summarizeSimulation = () => {
    const status = byId('sim-status').textContent;
    const summary = status === 'AUTONOMOUS'
      ? `${byId('tel-speed').textContent} · ${byId('lane-select').selectedOptions[0].textContent.split(' — ')[0]}`
      : `Las Vegas Boulevard · ${status.toLowerCase()}`;
    if (byId('av-summary').textContent !== summary) byId('av-summary').textContent = summary;
  };
  const telemetryObserver = new MutationObserver(summarizeSimulation);
  for (const id of ['sim-status', 'tel-speed']) telemetryObserver.observe(byId(id), { childList: true, subtree: true, characterData: true });
  byId('lane-select').addEventListener('change', summarizeSimulation);

  const moveOptions = () => ({ duration: reducedMotion.matches ? 0 : 350 });
  byId('map-zoom-in').addEventListener('click', () => getMap()?.zoomIn(moveOptions()));
  byId('map-zoom-out').addEventListener('click', () => getMap()?.zoomOut(moveOptions()));
  byId('cam-north').addEventListener('click', () => getMap()?.resetNorth(moveOptions()));

  function syncPressed() {
    for (const id of ['mode-lanes-btn', 'mode-3d-btn', 'toggle-bldg-btn', 'toggle-satellite-btn', 'toggle-traffic-btn']) {
      const button = byId(id), active = button.classList.contains('active');
      button.setAttribute('aria-pressed', String(active));
      if (button.lastElementChild?.tagName === 'SPAN') button.lastElementChild.textContent = active ? 'ON' : 'OFF';
    }
  }
  const observer = new MutationObserver(syncPressed);
  for (const id of ['mode-lanes-btn', 'mode-3d-btn', 'toggle-bldg-btn', 'toggle-satellite-btn', 'toggle-traffic-btn']) observer.observe(byId(id), { attributes: true, attributeFilter: ['class'] });

  function showControls() {
    document.body.classList.remove('hide-chrome');
    byId('show-controls').classList.add('hidden');
  }
  byId('show-controls').addEventListener('click', showControls);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!byId('api-modal').classList.contains('hidden')) byId('close-api-modal-btn').click();
      closePanels(true); showControls(); return;
    }
    if (!byId('api-modal').classList.contains('hidden')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
    switch (event.key.toLowerCase()) {
      case 't': setTheme(['day', 'golden', 'night'][(['day', 'golden', 'night'].indexOf(currentTheme) + 1) % 3]); break;
      case 'n': byId('cam-north').click(); break;
      case 'd': byId(getMap()?.getPitch() > 10 ? 'mode-lanes-btn' : 'mode-3d-btn').click(); break;
      case 'p': placesButton.click(); break;
      case 'l': layersButton.click(); break;
      case 'h': {
        closePanels();
        const hidden = document.body.classList.toggle('hide-chrome');
        byId('show-controls').classList.toggle('hidden', !hidden);
        break;
      }
      default: return;
    }
    event.preventDefault();
  });

  // Keep the existing settings modal keyboard-contained and restore its trigger.
  const modal = byId('api-modal');
  new MutationObserver(() => {
    if (!modal.classList.contains('hidden')) byId('api-key-input').focus();
    else if (modal.contains(document.activeElement)) byId('api-key-btn').focus();
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const fields = [...modal.querySelectorAll('input, button')];
    const first = fields[0], last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
    if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
  });

  function onMapReady() {
    const map = getMap();
    map.scrollZoom.setWheelZoomRate(1 / 600);
    map.on('rotate', () => { byId('compass-needle').style.transform = `rotate(${-map.getBearing()}deg)`; });
    setTheme(hash.get('theme') || 'day');
    const view = hash.get('view');
    const chip = [...document.querySelectorAll('#landmark-chips .chip')].find(item => item.dataset.view === view);
    if (chip) chip.click();
  }
  getMap().once('load', onMapReady);
  syncPressed();
};
