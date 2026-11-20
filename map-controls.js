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
  const sphereAd = byId('sphere-ad');
  sphereAd.value = new URLSearchParams(location.search).get('sphere-ad') || '';
  if (sphereAd.selectedIndex < 0) sphereAd.selectedIndex = 0;
  sphereAd.addEventListener('change', () => {
    const url = new URL(location.href);
    if (sphereAd.value) url.searchParams.set('sphere-ad', sphereAd.value);
    else url.searchParams.delete('sphere-ad');
    history.replaceState(null, '', url);
    dispatchEvent(new Event('vegas-sphere-ad'));
  });

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
    const inside = [sheet, layers, layersButton, byId('rail-layers-btn')].some(element => element?.contains(event.target));
    if (!inside && event.target.closest?.('.map-stage, #labels')) closePanels();
    else if (!inside && !layers.classList.contains('hidden') && !event.target.closest?.('.top-controls')) closePanels();
  });
  // typing filters the list; Enter still flies to the best match (app.js)
  const filterPlaces = query => {
    query = query.toLowerCase().trim();
    let count = 0;
    document.querySelectorAll('#landmark-chips .chip').forEach(chip => {
      const matches = chip.textContent.toLowerCase().includes(query) || (chip.dataset.alias ?? '').toLowerCase().includes(query);
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
      if (!phone.matches || event.target.closest('input, select, .corridor-chips, button:not(#sheet-grabber)')) return;
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
      byId('sphere-ad-control').hidden = chip.dataset.view !== 'sphere';
      setStudioLinks();
      announce(`Viewing ${byId('view-title').textContent}`);
      search.value = ''; filterPlaces('');
      search.blur();
      closePanels(true);
    });
  });
  function setStudioLinks() {
    const params = new URLSearchParams(location.hash.slice(1));
    const view = params.get('view') || 'bellagio';
    const url = new URL('./landmark-studio.html', location.href);
    const studio = document.querySelector(`.chip[data-view="${CSS.escape(view)}"]`)?.dataset;
    url.search = new URLSearchParams({ from: view, theme: currentTheme });
    if (studio?.studioFocus) url.searchParams.set('focus', studio.studioFocus);
    url.hash = studio?.studioModel || view;
    document.querySelectorAll('[data-studio-link]').forEach(link => { link.href = url.href; });
  }
  setStudioLinks();
  addEventListener('hashchange', setStudioLinks);

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
    // At street height an off-center camera can see past the last raster row.
    map.getContainer().style.backgroundColor = sky[1];
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
    setStudioLinks();
    announce(`${name === 'golden' ? 'Sunset' : name} lighting`);
  }
  document.querySelectorAll('.theme-btn').forEach(button => button.addEventListener('click', () => setTheme(button.dataset.theme)));
  const nextTheme = () => ['day', 'golden', 'night'][(['day', 'golden', 'night'].indexOf(currentTheme) + 1) % 3];
  byId('theme-cycle').addEventListener('click', () => setTheme(nextTheme()));
  const labelsQuickBtn = byId('labels-quick-toggle');
  const setLabelsState = (selected) => {
    const panelBtn = byId('toggle-labels-btn');
    if (panelBtn) {
      panelBtn.classList.toggle('active', selected);
      panelBtn.setAttribute('aria-pressed', String(selected));
      panelBtn.lastElementChild.textContent = selected ? 'ON' : 'OFF';
    }
    if (labelsQuickBtn) {
      labelsQuickBtn.classList.toggle('active', selected);
      labelsQuickBtn.setAttribute('aria-pressed', String(selected));
      labelsQuickBtn.title = selected ? 'Hide place labels (B)' : 'Show place labels (B)';
    }
    getLayer()?.setLabelsVisible(selected);
    const labelsEl = byId('labels');
    if (labelsEl) labelsEl.classList.toggle('hidden', !selected);
    announce(selected ? 'Place labels shown' : 'Place labels hidden');
  };
  labelsQuickBtn?.addEventListener('click', () => {
    setLabelsState(!labelsQuickBtn.classList.contains('active'));
  });
  byId('toggle-labels-btn')?.addEventListener('click', () => {
    const panelBtn = byId('toggle-labels-btn');
    setLabelsState(!panelBtn.classList.contains('active'));
  });
  byId('toggle-streets-btn')?.addEventListener('click', () => {
    const button = byId('toggle-streets-btn'), selected = !button.classList.contains('active');
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.lastElementChild.textContent = selected ? 'ON' : 'OFF';
    getLayer()?.setStreetsVisible(selected);
  });

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

  // Right-rail Layers & Recenter buttons
  byId('rail-layers-btn')?.addEventListener('click', () => togglePanel(layers, layersButton));
  byId('cam-recenter')?.addEventListener('click', () => {
    const activeChip = document.querySelector('#landmark-chips .chip.active')
      || document.querySelector('#landmark-chips .chip[data-view="bellagio"]');
    if (activeChip) activeChip.click();
  });

  // 2D / 3D button in the Apple Maps right rail (shows the mode you switch TO, just like Apple Maps)
  const dimBtn = byId('view-dim-toggle');
  const pitchTrack = byId('pitch-slider-track');
  const pitchThumb = byId('pitch-slider-thumb');
  const MAX_PITCH = 75;
  function syncPitchUI() {
    const map = getMap();
    if (!map) return;
    const pitch = Math.max(0, Math.min(MAX_PITCH, map.getPitch()));
    const is3D = pitch > 10;
    if (dimBtn) {
      dimBtn.textContent = is3D ? '2D' : '3D';
      dimBtn.setAttribute('aria-pressed', String(is3D));
    }
    if (pitchThumb && pitchTrack) {
      // Top = 75° (deep 3D), Bottom = 0° (flat 2D) — matches Apple Maps vertical tilt rail
      const pct = 1 - pitch / MAX_PITCH;
      const topPx = 13 + pct * 48;
      pitchThumb.style.top = `${topPx.toFixed(1)}px`;
      pitchTrack.setAttribute('aria-valuenow', String(Math.round(pitch)));
    }
  }
  dimBtn?.addEventListener('click', () => {
    const map = getMap();
    if (!map) return;
    if (map.getPitch() > 10) byId('mode-lanes-btn').click();
    else byId('mode-3d-btn').click();
  });
  if (pitchTrack) {
    let pitchDrag = null;
    const applyPitchFromY = clientY => {
      const map = getMap();
      if (!map) return;
      const rect = pitchTrack.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientY - (rect.top + 13)) / 48));
      const nextPitch = (1 - t) * MAX_PITCH;
      getLayer()?.stopFollowing?.();
      map.setPitch(nextPitch);
      syncPitchUI();
    };
    pitchTrack.addEventListener('pointerdown', event => {
      event.preventDefault();
      pitchDrag = event.pointerId;
      pitchTrack.classList.add('dragging');
      pitchTrack.setPointerCapture?.(event.pointerId);
      applyPitchFromY(event.clientY);
    });
    pitchTrack.addEventListener('pointermove', event => {
      if (pitchDrag !== event.pointerId) return;
      applyPitchFromY(event.clientY);
    });
    const endPitch = event => {
      if (pitchDrag !== event.pointerId) return;
      pitchDrag = null;
      pitchTrack.classList.remove('dragging');
    };
    pitchTrack.addEventListener('pointerup', endPitch);
    pitchTrack.addEventListener('pointercancel', endPitch);
    pitchTrack.addEventListener('keydown', event => {
      const map = getMap();
      if (!map) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        map.easeTo({ pitch: Math.min(MAX_PITCH, map.getPitch() + 10), duration: 180 });
        event.preventDefault();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        map.easeTo({ pitch: Math.max(0, map.getPitch() - 10), duration: 180 });
        event.preventDefault();
      }
    });
  }

  // Seamless Desktop Compass Orbit Control:
  // 1) Press & hold ‹ / › for butter-smooth 60 FPS continuous orbiting (single click steps 30°)
  // 2) Drag the compass dial left/right with smooth momentum glide on release
  // 3) Scroll wheel / trackpad scroll over the compass pill to rotate effortlessly
  // 4) Single click the center N dial to snap cleanly back to North
  const compassPill = byId('compass-orbit-pill');
  const compassBtn = byId('cam-north');
  const compassNeedle = byId('compass-needle');
  const compassCardinal = byId('compass-cardinal');
  const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let glideRaf = 0;
  const cancelGlide = () => { if (glideRaf) { cancelAnimationFrame(glideRaf); glideRaf = 0; } };
  function syncCompassUI() {
    const map = getMap();
    if (!map) return;
    const bearing = map.getBearing();
    if (compassNeedle) compassNeedle.style.transform = `rotate(${-bearing}deg)`;
    if (compassCardinal) {
      const norm = ((bearing % 360) + 360) % 360;
      compassCardinal.textContent = CARDINALS[Math.round(norm / 45) % 8];
    }
  }
  // Hold-to-orbit + click-to-step buttons (‹ / ›)
  const bindOrbitStep = (buttonId, dir) => {
    const btn = byId(buttonId);
    if (!btn) return;
    let holdRaf = 0, holdTimer = 0, holding = false, activePointer = null, lastTs = 0;
    const stopHold = (triggerClick) => {
      clearTimeout(holdTimer);
      if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = 0; }
      btn.classList.remove('holding');
      compassPill?.classList.remove('orbiting');
      const wasHold = holding;
      holding = false;
      activePointer = null;
      if (triggerClick && !wasHold) {
        const map = getMap();
        if (!map) return;
        cancelGlide();
        getLayer()?.stopFollowing?.();
        map.easeTo({ bearing: map.getBearing() + dir * 30, duration: reducedMotion.matches ? 0 : 280 });
      }
    };
    btn.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      event.preventDefault();
      cancelGlide();
      activePointer = event.pointerId;
      btn.setPointerCapture?.(event.pointerId);
      btn.classList.add('holding');
      holdTimer = setTimeout(() => {
        holding = true;
        compassPill?.classList.add('orbiting');
        getLayer()?.stopFollowing?.();
        lastTs = performance.now();
        const step = (now) => {
          if (!holding) return;
          const dt = Math.min(0.05, (now - lastTs) / 1000);
          lastTs = now;
          const map = getMap();
          if (map) {
            map.setBearing(map.getBearing() + dir * 78 * dt);
            syncCompassUI();
          }
          holdRaf = requestAnimationFrame(step);
        };
        holdRaf = requestAnimationFrame(step);
      }, 150);
    });
    btn.addEventListener('pointerup', event => { if (event.pointerId === activePointer) stopHold(true); });
    btn.addEventListener('pointercancel', event => { if (event.pointerId === activePointer) stopHold(false); });
    btn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const map = getMap();
        if (map) map.easeTo({ bearing: map.getBearing() + dir * 30, duration: reducedMotion.matches ? 0 : 260 });
      }
    });
  };
  bindOrbitStep('compass-orbit-left', -1);
  bindOrbitStep('compass-orbit-right', 1);

  // Smooth wheel / trackpad scroll over the compass pill rotates bearing directly
  compassPill?.addEventListener('wheel', event => {
    const map = getMap();
    if (!map) return;
    event.preventDefault();
    cancelGlide();
    getLayer()?.stopFollowing?.();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    map.setBearing(map.getBearing() + delta * 0.22);
    syncCompassUI();
  }, { passive: false });

  // Drag the center compass dial left/right (with smooth inertia glide on release), or click for North
  {
    let compassDrag = null;
    compassBtn.addEventListener('pointerdown', event => {
      const map = getMap();
      if (!map) return;
      cancelGlide();
      compassDrag = {
        id: event.pointerId, startX: event.clientX, lastX: event.clientX, lastTime: performance.now(),
        startBearing: map.getBearing(), velocity: 0, moved: false,
      };
      compassBtn.setPointerCapture?.(event.pointerId);
    });
    compassBtn.addEventListener('pointermove', event => {
      if (!compassDrag || compassDrag.id !== event.pointerId) return;
      const now = performance.now();
      const dxTotal = event.clientX - compassDrag.startX;
      if (Math.abs(dxTotal) > 3) {
        compassDrag.moved = true;
        compassBtn.classList.add('dragging');
        compassPill?.classList.add('orbiting');
      }
      if (!compassDrag.moved) return;
      const dt = Math.max(4, now - compassDrag.lastTime);
      const stepDeg = (event.clientX - compassDrag.lastX) * 0.85;
      compassDrag.velocity = compassDrag.velocity * 0.55 + (stepDeg / dt) * 16.67 * 0.45;
      compassDrag.lastX = event.clientX;
      compassDrag.lastTime = now;
      getLayer()?.stopFollowing?.();
      getMap()?.setBearing(compassDrag.startBearing + dxTotal * 0.85);
      syncCompassUI();
    });
    const endCompass = event => {
      if (!compassDrag || compassDrag.id !== event.pointerId) return;
      const { moved, velocity } = compassDrag;
      compassDrag = null;
      compassBtn.classList.remove('dragging');
      compassPill?.classList.remove('orbiting');
      if (!moved) {
        getMap()?.resetNorth(moveOptions());
      } else if (!reducedMotion.matches && Math.abs(velocity) > 0.35) {
        let vel = Math.max(-14, Math.min(14, velocity));
        const glide = () => {
          const map = getMap();
          if (!map || Math.abs(vel) < 0.08) { glideRaf = 0; return; }
          map.setBearing(map.getBearing() + vel);
          syncCompassUI();
          vel *= 0.90;
          glideRaf = requestAnimationFrame(glide);
        };
        glideRaf = requestAnimationFrame(glide);
      }
    };
    compassBtn.addEventListener('pointerup', endCompass);
    compassBtn.addEventListener('pointercancel', endCompass);
    compassBtn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cancelGlide();
        getMap()?.resetNorth(moveOptions());
      }
    });
  }

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
      case 'n': cancelGlide(); getMap()?.resetNorth(moveOptions()); break;
      case 'q': {
        const map = getMap();
        if (map) { cancelGlide(); getLayer()?.stopFollowing?.(); map.easeTo({ bearing: map.getBearing() - 30, duration: reducedMotion.matches ? 0 : 240 }); }
        break;
      }
      case 'e': {
        const map = getMap();
        if (map) { cancelGlide(); getLayer()?.stopFollowing?.(); map.easeTo({ bearing: map.getBearing() + 30, duration: reducedMotion.matches ? 0 : 240 }); }
        break;
      }
      case 'd': byId(getMap()?.getPitch() > 10 ? 'mode-lanes-btn' : 'mode-3d-btn').click(); break;
      case 'p': placesButton.click(); break;
      case 'l': layersButton.click(); break;
      case 'b': labelsQuickBtn?.click(); break;
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
    map.on('rotate', syncCompassUI);
    map.on('pitch', syncPitchUI);
    map.on('dragstart', () => getLayer()?.stopFollowing?.());
    syncCompassUI();
    syncPitchUI();
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
    requestAnimationFrame(() => {
      document.body.classList.remove('booting');
      showHint();
    });
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
