/* Compact map chrome. Routing and vehicle state remain in app.js. */
window.setupMapChrome = function({ getMap, getLayer }) {
  const byId = id => document.getElementById(id);
  const places = byId('places-panel'), layers = byId('layers-panel');
  const placesButton = byId('places-toggle'), layersButton = byId('layers-toggle');
  const announce = text => { byId('map-announcement').textContent = text; };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let currentTheme = 'day';
  const hash = new URLSearchParams(location.hash.slice(1));

  const sheet = byId('sheet'), search = byId('place-search-input');
  const phone = matchMedia('(max-width: 720px)');

  // ── places: a dropdown list on desktop, the body of a draggable bottom sheet on phones ──
  function setSheet(state) {
    sheet.dataset.state = state;
    sheet.style.removeProperty('--sheet-height');
    const open = state !== 'peek';
    places.classList.toggle('hidden', !open);
    placesButton.setAttribute('aria-expanded', String(open));
    byId('sheet-grabber').setAttribute('aria-label', open ? 'Collapse places' : 'Expand places');
  }
  function closePanels(restore = false) {
    const hadPlaces = !places.classList.contains('hidden');
    const hadLayers = !layers.classList.contains('hidden');
    if (hadPlaces) setSheet('peek');
    layers.classList.add('hidden');
    layersButton.setAttribute('aria-expanded', 'false');
    if (restore && (hadPlaces || hadLayers) && !phone.matches) (hadPlaces ? placesButton : layersButton).focus();
  }
  function togglePanel(panel, button) {
    const wasOpen = !panel.classList.contains('hidden');
    closePanels();
    if (wasOpen) return;
    if (panel === places) setSheet(phone.matches ? 'half' : 'open');
    else { panel.classList.remove('hidden'); button.setAttribute('aria-expanded', 'true'); }
  }
  placesButton.addEventListener('click', () => togglePanel(places, placesButton));
  layersButton.addEventListener('click', () => togglePanel(layers, layersButton));
  byId('places-close').addEventListener('click', () => closePanels(true));
  byId('layers-close').addEventListener('click', () => closePanels(true));
  document.addEventListener('pointerdown', event => {
    const inside = [sheet, layers, layersButton].some(element => element.contains(event.target));
    if (!inside && event.target.closest?.('.map-stage, #labels')) closePanels();
    else if (!inside && !layers.classList.contains('hidden') && !event.target.closest?.('.top-controls')) closePanels();
  });
  // typing filters the list; Enter still flies to the best match (app.js)
  const filterPlaces = query => {
    query = query.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll('#landmark-chips .chip').forEach(chip => {
      const matches = chip.textContent.toLowerCase().includes(query);
      chip.hidden = !matches;
      if (matches) count++;
    });
    document.querySelectorAll('#landmark-chips .list-heading').forEach(heading => {
      let next = heading.nextElementSibling, any = false;
      while (next && !next.classList.contains('list-heading')) { if (!next.hidden) any = true; next = next.nextElementSibling; }
      heading.hidden = !any;
    });
    byId('places-empty').classList.toggle('hidden', count > 0);
  };
  search.addEventListener('input', () => {
    filterPlaces(search.value);
    if (places.classList.contains('hidden')) setSheet(phone.matches ? 'full' : 'open');
  });
  search.addEventListener('focus', () => { if (phone.matches) setSheet('full'); });
  byId('places-filter').addEventListener('input', event => filterPlaces(event.target.value));

  // bottom sheet: tap the grabber to cycle, or drag it like Apple Maps
  {
    const order = ['peek', 'half', 'full'];
    const grabber = byId('sheet-grabber');
    let drag = null;
    grabber.addEventListener('click', () => {
      if (drag?.moved) return;
      setSheet(order[(order.indexOf(sheet.dataset.state) + 1) % order.length] ?? 'half');
    });
    const start = event => {
      if (!phone.matches || event.target.closest('input, .corridor-chips, button:not(#sheet-grabber)')) return;
      drag = { y: event.clientY, h: sheet.getBoundingClientRect().height, moved: false, id: event.pointerId };
      sheet.setPointerCapture?.(event.pointerId);
    };
    sheet.addEventListener('pointerdown', start);
    sheet.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dy = drag.y - event.clientY;
      if (Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      sheet.classList.add('dragging');
      if (places.classList.contains('hidden')) places.classList.remove('hidden');
      sheet.style.setProperty('--sheet-height', `${Math.max(120, Math.min(innerHeight - 60, drag.h + dy))}px`);
    });
    const end = event => {
      if (!drag || event.pointerId !== drag.id) return;
      sheet.classList.remove('dragging');
      if (drag.moved) {
        const h = sheet.getBoundingClientRect().height, vh = innerHeight;
        const next = h < vh * 0.32 ? 'peek' : h < vh * 0.72 ? 'half' : 'full';
        setSheet(next);
        setTimeout(() => { drag = null; }, 0);
      } else drag = null;
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
  }
  document.querySelectorAll('#landmark-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      byId('view-title').textContent = chip.querySelector('span').textContent;
      const params = new URLSearchParams(location.hash.slice(1));
      params.set('view', chip.dataset.view);
      history.replaceState(null, '', '#' + params.toString());
      announce(`Viewing ${byId('view-title').textContent}`);
      search.value = ''; filterPlaces('');
      search.blur();
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
    const sky = {
      day: ['#6ea8e8', '#dfe9f2', '#d6e0e8'],
      golden: ['#4b6fa8', '#ffc58a', '#e9b98e'],
      night: ['#050814', '#161d36', '#121628'],
    }[currentTheme];
    map.setSky({ 'sky-color': sky[0], 'horizon-color': sky[1], 'fog-color': sky[2], 'sky-horizon-blend': 0.65, 'horizon-fog-blend': 0.5 });
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
    const icon = document.querySelector(`.theme-control .theme-btn[data-theme="${name}"] svg`);
    if (icon) byId('theme-cycle').innerHTML = icon.outerHTML;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', name === 'night' ? '#0e1320' : name === 'golden' ? '#f2d2ae' : '#e9eef2');
    const params = new URLSearchParams(location.hash.slice(1));
    params.set('theme', name);
    history.replaceState(null, '', '#' + params.toString());
    announce(`${name === 'golden' ? 'Sunset' : name} lighting`);
  }
  document.querySelectorAll('.theme-btn').forEach(button => button.addEventListener('click', () => setTheme(button.dataset.theme)));
  const nextTheme = () => ['day', 'golden', 'night'][(['day', 'golden', 'night'].indexOf(currentTheme) + 1) % 3];
  byId('theme-cycle').addEventListener('click', () => setTheme(nextTheme()));
  for (const [id, method] of [['toggle-streets-btn', 'setStreetsVisible'], ['toggle-labels-btn', 'setLabelsVisible']]) {
    byId(id).addEventListener('click', () => {
      const button = byId(id), selected = !button.classList.contains('active');
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.lastElementChild.textContent = selected ? 'ON' : 'OFF';
      getLayer()?.[method](selected);
    });
  }

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
    if (window.vegasFleet?.selected.phase === 'manual') return;
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
    switch (event.key.toLowerCase()) {
      case 't': setTheme(nextTheme()); break;
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
    map.on('dragstart', () => getLayer()?.stopFollowing?.());
    setTheme(hash.get('theme') || 'day');
    const view = hash.get('view');
    const chip = [...document.querySelectorAll('#landmark-chips .chip')].find(item => item.dataset.view === view);
    if (chip) chip.click();
  }
  getMap().once('load', onMapReady);
  syncPressed();

  // ── robotaxi panel: shown by default on desktop, tucked away on phones ──
  const fleetButton = byId('fleet-toggle');
  const syncFleet = () => {
    const shown = phone.matches ? document.body.classList.contains('fleet-open') : !document.body.classList.contains('fleet-hidden');
    fleetButton.setAttribute('aria-pressed', String(shown));
  };
  fleetButton.addEventListener('click', () => {
    if (phone.matches) document.body.classList.toggle('fleet-open');
    else document.body.classList.toggle('fleet-hidden');
    if (phone.matches && document.body.classList.contains('fleet-open')) closePanels();
    syncFleet();
  });
  phone.addEventListener('change', () => { syncFleet(); if (!phone.matches) setSheet('peek'); });
  syncFleet();

  // ── loading screen: real progress, lifted the moment the skyline exists ──
  const bootText = byId('boot-text'), bootFill = byId('boot-fill');
  addEventListener('vegas-progress', ({ detail }) => {
    if (detail.state === 'error') {
      bootText.textContent = 'The city could not load. Reload to try again.';
      return;
    }
    bootText.textContent = detail.text;
    if (detail.fraction != null) bootFill.style.width = `${Math.round(detail.fraction * 100)}%`;
  });
  addEventListener('vegas-city-reveal', ({ detail }) => {
    if (detail.phase !== 'skyline') return;
    bootFill.style.width = '100%';
    requestAnimationFrame(() => setTimeout(() => {
      document.body.classList.remove('booting');
      showHint();
    }, 120));
  });
  addEventListener('vegas-landmarks-ready', () => document.body.classList.remove('booting'));

  // ── one-time gesture tip, worded for the device in hand ──
  const hint = byId('map-hint');
  function showHint() {
    try { if (localStorage.getItem('vegas-hint-seen')) return; } catch { /* storage blocked */ }
    const touch = matchMedia('(pointer: coarse)').matches;
    byId('map-hint-text').textContent = touch
      ? 'Pinch to zoom · twist to rotate · drag two fingers up to tilt'
      : 'Drag to move · right-drag or ⌃-drag to orbit · scroll to zoom';
    hint.hidden = false;
    setTimeout(dismissHint, 9000);
  }
  function dismissHint() {
    hint.hidden = true;
    try { localStorage.setItem('vegas-hint-seen', '1'); } catch { /* storage blocked */ }
  }
  byId('map-hint-close').addEventListener('click', dismissHint);

  // Interactive `?` Hover Tooltip Inspector for controls, landmarks, storefronts & vehicles
  let tipEl = document.getElementById('vegas-hover-tip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'vegas-hover-tip';
    tipEl.className = 'vegas-hover-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.hidden = true;
    tipEl.innerHTML = `
      <div class="vht-head">
        <span class="vht-q" aria-hidden="true">?</span>
        <div class="vht-titles">
          <strong class="vht-title"></strong>
          <span class="vht-sub"></span>
        </div>
      </div>
      <p class="vht-body"></p>
    `;
    document.body.append(tipEl);
  }
  const vhtTitle = tipEl.querySelector('.vht-title');
  const vhtSub = tipEl.querySelector('.vht-sub');
  const vhtBody = tipEl.querySelector('.vht-body');
  let activeTipTarget = null;

  const positionTip = (clientX, clientY) => {
    const pad = 16;
    const w = tipEl.offsetWidth || 280;
    const h = tipEl.offsetHeight || 96;
    let x = clientX + 16;
    let y = clientY + 16;
    if (x + w + pad > window.innerWidth) x = Math.max(pad, clientX - w - 14);
    if (y + h + pad > window.innerHeight) y = Math.max(pad, clientY - h - 14);
    tipEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  };

  document.addEventListener('pointermove', event => {
    const target = event.target?.closest?.('[data-tip]');
    if (!target) {
      if (!tipEl.hidden) {
        tipEl.hidden = true;
        activeTipTarget = null;
      }
      return;
    }
    if (target !== activeTipTarget) {
      activeTipTarget = target;
      vhtTitle.textContent = target.dataset.tipTitle || target.getAttribute('aria-label') || 'Las Vegas Strip';
      vhtSub.textContent = target.dataset.tipSub || 'Interactive Guide';
      vhtBody.textContent = target.dataset.tip || '';
      tipEl.hidden = false;
    }
    positionTip(event.clientX, event.clientY);
  }, { passive: true });
};
