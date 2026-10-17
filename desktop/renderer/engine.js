(function () {
  const catalog = window.QiqiCatalog;
  const ACTIONS = catalog.ACTIONS;
  const SHEET = catalog.SHEET;
  const SCALE = 1.5;
  const SPRITE_W = SHEET.frameWidth * SCALE;
  const SPRITE_H = SHEET.frameHeight * SCALE;
  const FOOT_Y = 202 / SHEET.frameHeight;
  const SETTINGS_KEY = "qiqi-desktop-settings-v1";
  const MOVER_ORDER = ["gremlin", "perch", "wander", "taskbar"];

  const CLICK_LINES = [
    "你来啦。",
    "轻轻一下，我收到啦。",
    "今天也一起玩吧～",
    "我把兔耳朵竖起来了。",
  ];

  function pick(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function createPreviewHost(stage) {
    const pet = document.getElementById("window");
    let cursor = null;

    function updateCursor(event) {
      const rect = stage.getBoundingClientRect();
      cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    window.addEventListener("pointermove", updateCursor, true);
    window.addEventListener("pointerdown", updateCursor, true);

    function workArea() {
      const rect = stage.getBoundingClientRect();
      const bar = stage.querySelector(".taskbar");
      const barRect = bar.getBoundingClientRect();
      return { x: 0, y: 0, width: rect.width, height: Math.max(120, barRect.top - rect.top) };
    }

    return {
      kind: "preview",
      getWorkArea: function () { return workArea(); },
      getCursor: function () {
        if (cursor) return cursor;
        const area = workArea();
        return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      },
      setBounds: function (bounds) {
        pet.style.left = bounds.x + "px";
        pet.style.top = bounds.y + "px";
        pet.style.width = bounds.width + "px";
        pet.style.height = bounds.height + "px";
      },
      setIgnoreMouse: function () {},
      listWindows: function () {
        const rect = stage.getBoundingClientRect();
        const windows = Array.prototype.map.call(stage.querySelectorAll(".fake-window"), function (el) {
          const box = el.getBoundingClientRect();
          const title = el.querySelector(".fake-title");
          return {
            title: title ? title.textContent : "",
            x: box.left - rect.left,
            y: box.top - rect.top,
            width: box.width,
            height: box.height,
          };
        });
        return Promise.resolve(windows);
      },
      setLaser: function (laser) {
        if (stage._qiqiTrail) stage._qiqiTrail.setLaser(laser);
      },
      addTrail: function (point) {
        if (stage._qiqiTrail) stage._qiqiTrail.push(point.x, point.y);
      },
      quit: function () {},
      onRecenter: function () {},
    };
  }

  function loadSettings(plugins) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
    catch (error) { saved = {}; }
    const settings = {};
    plugins.forEach(function (plugin) {
      if (Object.prototype.hasOwnProperty.call(saved, plugin.id)) settings[plugin.id] = !!saved[plugin.id];
      else settings[plugin.id] = !!plugin.defaultEnabled;
    });
    return settings;
  }

  function saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch (error) { /* preview storage can be blocked */ }
  }

  function start() {
    const stage = document.getElementById("stage");
    const host = window.qiqiDesktop || createPreviewHost(stage);
    const canvas = document.getElementById("sprite");
    const ctx = canvas.getContext("2d");
    const speech = document.getElementById("speech");
    const menu = document.getElementById("menu");
    const status = document.getElementById("status");
    const plugins = window.QiqiPlugins || [];
    const byId = {};
    plugins.forEach(function (plugin) { byId[plugin.id] = plugin; });

    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ratio = function () { return window.devicePixelRatio || 1; };
    canvas.width = Math.floor(SPRITE_W * ratio());
    canvas.height = Math.floor(SPRITE_H * ratio());
    canvas.style.width = SPRITE_W + "px";
    canvas.style.height = SPRITE_H + "px";

    const offscreen = document.createElement("canvas");
    offscreen.width = SHEET.frameWidth;
    offscreen.height = SHEET.frameHeight;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });

    const extras = new Map();
    const sheet = new Image();
    let sheetReady = false;
    sheet.onload = function () { sheetReady = true; };
    sheet.onerror = function () { say("精灵图没有加载出来。"); };
    sheet.src = SHEET.src;

    Object.keys(ACTIONS).forEach(function (id) {
      const action = ACTIONS[id];
      if (!action.src) return;
      const image = new Image();
      image.src = action.src;
      extras.set(action.src, image);
    });

    const state = {
      settings: loadSettings(plugins),
      feet: { x: 160, y: 400 },
      facing: 1,
      vx: 1,
      actionId: "idle",
      actionSpeed: 1,
      actionLoop: true,
      frameIndex: 0,
      frameElapsed: 0,
      dragging: false,
      emote: null,
      menuOpen: false,
      laser: null,
      windows: [],
      workArea: { x: 0, y: 0, width: 800, height: 600 },
      now: performance.now(),
      dt: 16,
      ignoreMouse: true,
      boundKey: "",
      speechTimer: 0,
      lastTrail: null,
      lastClick: 0,
      pointer: null,
    };

    if (host.kind === "preview") {
      const trailCanvas = document.getElementById("trail-layer");
      const trailCtx = trailCanvas.getContext("2d");
      const layer = QiqiTrail.createLayer();
      stage._qiqiTrail = layer;
      const resizeTrail = function () {
        const rect = stage.getBoundingClientRect();
        const scale = ratio();
        trailCanvas.width = Math.max(1, Math.floor(rect.width * scale));
        trailCanvas.height = Math.max(1, Math.floor(rect.height * scale));
        trailCanvas._w = rect.width;
        trailCanvas._h = rect.height;
      };
      resizeTrail();
      window.addEventListener("resize", resizeTrail);
      let trailLast = performance.now();
      const drawTrail = function (now) {
        const dt = now - trailLast;
        trailLast = now;
        const scale = ratio();
        trailCtx.setTransform(scale, 0, 0, scale, 0, 0);
        layer.draw(trailCtx, trailCanvas._w || stage.clientWidth, trailCanvas._h || stage.clientHeight, dt);
        requestAnimationFrame(drawTrail);
      };
      requestAnimationFrame(drawTrail);
    }

    function say(text, ms) {
      speech.textContent = text;
      speech.hidden = !text;
      window.clearTimeout(state.speechTimer);
      if (!text) return;
      state.speechTimer = window.setTimeout(function () { speech.hidden = true; }, ms || 2400);
    }

    const api = {
      get now() { return state.now; },
      get dt() { return state.dt; },
      get feet() { return state.feet; },
      get dragging() { return state.dragging; },
      get emoting() { return !!state.emote; },
      get facing() { return state.facing; },
      set facing(value) { state.facing = value < 0 ? -1 : 1; },
      enabled: function (id) { return !!state.settings[id]; },
      workArea: function () { return state.workArea; },
      cursor: function () { return host.getCursor(); },
      windows: function () { return state.windows; },
      say: say,
      action: function () { return state.actionId; },
      setAction: setAction,
      setLaser: function (laser) { state.laser = laser; },
      moveToward: function (x, y, speed) {
        const dx = x - state.feet.x;
        const dy = y - state.feet.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          if (Math.abs(dx) > 1) state.facing = dx < 0 ? -1 : 1;
          return true;
        }
        const step = Math.min(dist, speed * state.dt / 1000);
        state.feet.x += dx / dist * step;
        state.feet.y += dy / dist * step;
        state.vx = dx;
        state.facing = dx < 0 ? -1 : 1;
        setAction("walk", { speed: speed > 160 ? 1.75 : 1 });
        return false;
      },
    };

    function setAction(id, opts) {
      opts = opts || {};
      let resolved = id === "walk" ? (state.facing < 0 ? "walkLeft" : "walkRight") : id;
      const action = ACTIONS[resolved];
      if (!action) return;
      const speed = opts.speed || 1;
      const loop = opts.loop != null ? opts.loop : !!action.loop;
      if (!opts.restart && state.actionId === resolved) {
        state.actionSpeed = speed;
        state.actionLoop = loop;
        return;
      }
      state.actionId = resolved;
      state.actionSpeed = speed;
      state.actionLoop = loop;
      state.frameIndex = 0;
      state.frameElapsed = 0;
    }

    function playEmote(id, ms) {
      const action = ACTIONS[id];
      if (!action) return;
      const duration = ms || catalog.actionDuration(action);
      state.emote = {
        id: id,
        left: duration,
        total: duration,
        baseY: state.feet.y,
        hop: id === "jump",
      };
      setAction(id, { restart: true, loop: !!action.loop && !!ms });
    }

    function clampFeet() {
      const area = state.workArea;
      const minX = area.x + 36;
      const maxX = area.x + area.width - 36;
      state.feet.x = Math.min(maxX, Math.max(minX, state.feet.x));
      const minY = area.y + 24;
      const maxY = area.y + area.height;
      state.feet.y = Math.min(maxY, Math.max(minY, state.feet.y));
    }

    function refreshWindows() {
      const pending = host.listWindows();
      if (pending && pending.then) {
        pending.then(function (list) { state.windows = list || []; }).catch(function () { state.windows = []; });
      }
    }

    function placeHome() {
      state.workArea = host.getWorkArea(state.feet);
      state.feet.x = state.workArea.x + Math.min(180, state.workArea.width * 0.22);
      state.feet.y = state.workArea.y + state.workArea.height;
    }

    function hitSprite(localX, localY) {
      const cx = SPRITE_W * (95 / SHEET.frameWidth);
      const cy = SPRITE_H * (104 / SHEET.frameHeight);
      const rx = SPRITE_W * (58 / SHEET.frameWidth);
      const ry = SPRITE_H * (100 / SHEET.frameHeight);
      const nx = (localX - cx) / rx;
      const ny = (localY - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }

    function syncIgnore(clientX, clientY) {
      if (host.kind !== "electron") return;
      let hit = false;
      if (state.menuOpen) {
        const menuBox = menu.getBoundingClientRect();
        hit = clientX >= menuBox.left && clientX <= menuBox.right && clientY >= menuBox.top && clientY <= menuBox.bottom;
      }
      if (!hit) {
        const box = canvas.getBoundingClientRect();
        hit = hitSprite(clientX - box.left, clientY - box.top);
      }
      if (state.dragging) hit = true;
      const ignore = !hit;
      if (ignore !== state.ignoreMouse) {
        state.ignoreMouse = ignore;
        host.setIgnoreMouse(ignore);
      }
    }

    function layout() {
      const menuWidth = state.menuOpen ? 248 : 0;
      const menuHeight = state.menuOpen
        ? Math.min(Math.max(menu.scrollHeight || 0, 460), Math.max(200, state.workArea.height - 16))
        : 0;
      let spriteX = 0;
      let spriteY = 0;
      let winW = SPRITE_W;
      let winH = SPRITE_H;
      const spriteLeft = state.feet.x - SPRITE_W / 2;
      const spriteTop = state.feet.y - SPRITE_H * FOOT_Y;
      if (state.menuOpen) {
        const roomRight = state.workArea.x + state.workArea.width - (spriteLeft + SPRITE_W);
        const placeLeft = roomRight < menuWidth + 12;
        winW = SPRITE_W + menuWidth;
        winH = Math.max(SPRITE_H, menuHeight + 8);
        if (placeLeft) spriteX = menuWidth;
        const overflow = spriteTop + winH - (state.workArea.y + state.workArea.height);
        if (overflow > 0) spriteY = overflow;
        menu.style.left = (placeLeft ? 6 : SPRITE_W + 6) + "px";
        menu.style.top = Math.max(6, spriteY) + "px";
        menu.style.maxHeight = Math.max(160, state.workArea.height - 24) + "px";
      }
      canvas.style.left = spriteX + "px";
      canvas.style.top = spriteY + "px";
      speech.style.left = (spriteX + SPRITE_W / 2) + "px";
      speech.style.top = (spriteY + 2) + "px";
      const bounds = {
        x: Math.round(spriteLeft - spriteX),
        y: Math.round(spriteTop - spriteY),
        width: Math.round(winW),
        height: Math.round(winH),
      };
      const key = bounds.x + "," + bounds.y + "," + bounds.width + "," + bounds.height;
      if (key !== state.boundKey) {
        state.boundKey = key;
        host.setBounds(bounds);
      }
    }

    function buildMenu() {
      const groups = [
        { title: "动作", items: [
          { action: "wave", label: "挥挥手" },
          { action: "jump", label: "跳一下" },
          { action: "wait", label: "乖乖等待" },
          { action: "review", label: "认真看看" },
          { action: "sleep", label: "睡一会儿" },
        ] },
        { title: "走动", items: [
          { toggle: "taskbar" },
          { toggle: "wander" },
          { toggle: "perch" },
          { command: "perch", label: "现在去栖窗" },
          { command: "chase", label: "追逐鼠标" },
          { command: "drop", label: "跳回下面" },
        ] },
        { title: "花样", items: [
          { toggle: "matrix" },
          { toggle: "trail" },
          { toggle: "gremlin" },
        ] },
      ];
      menu.replaceChildren();
      groups.forEach(function (group) {
        const heading = document.createElement("div");
        heading.className = "group";
        heading.textContent = group.title;
        menu.appendChild(heading);
        group.items.forEach(function (item) {
          const button = document.createElement("button");
          button.type = "button";
          if (item.toggle) {
            const plugin = byId[item.toggle];
            const on = !!state.settings[item.toggle];
            button.dataset.toggle = item.toggle;
            button.innerHTML = "<span>" + (plugin ? plugin.label : item.toggle) + "</span><span class='mark'>" + (on ? "开" : "关") + "</span>";
            button.setAttribute("aria-pressed", on ? "true" : "false");
          } else {
            button.dataset.action = item.action || "";
            button.dataset.command = item.command || "";
            button.textContent = item.label;
          }
          menu.appendChild(button);
        });
      });
      const quit = document.createElement("button");
      quit.type = "button";
      quit.dataset.command = "quit";
      quit.textContent = host.kind === "electron" ? "退出" : "这是网页预览";
      menu.appendChild(quit);
    }

    function openMenu() {
      state.menuOpen = true;
      menu.hidden = false;
      buildMenu();
      state.ignoreMouse = false;
      if (host.kind === "electron") host.setIgnoreMouse(false);
      layout();
    }

    function closeMenu() {
      state.menuOpen = false;
      menu.hidden = true;
      state.boundKey = "";
      layout();
    }

    function command(name) {
      closeMenu();
      if (name === "quit") {
        if (host.kind === "electron") host.quit();
        else say("这是网页预览。桌面版在 desktop 目录里 npm start。");
        return;
      }
      if (name === "wave" || name === "jump" || name === "wait" || name === "review" || name === "notice") {
        playEmote(name);
        return;
      }
      if (name === "sleep") {
        playEmote("sleep", 6400);
        say("那我眯一会儿。");
        return;
      }
      const perch = byId.perch;
      if (perch && (name === "perch" || name === "chase" || name === "drop")) {
        state.emote = null;
        perch.force(name);
      }
    }

    function toggleSetting(id) {
      state.settings[id] = !state.settings[id];
      saveSettings(state.settings);
      const plugin = byId[id];
      if (plugin && state.settings[id] && plugin.onEnable) plugin.onEnable(api);
      if (plugin && !state.settings[id] && plugin.onDisable) plugin.onDisable(api);
      if (id === "gremlin" && state.settings[id]) say("小捣蛋打开了。她只会自己挪一挪，不碰你的文件。");
      if (id === "gremlin" && !state.settings[id]) say("小捣蛋关掉了。");
      if (id === "matrix" && state.settings[id]) say("矩阵滤镜打开了，还是我。");
      buildMenu();
    }

    function advance(dt) {
      if (reduce || !sheetReady) return;
      const action = ACTIONS[state.actionId];
      if (!action || action.src) return;
      const frames = action.frames;
      let ms = Array.isArray(action.frameMs)
        ? action.frameMs[Math.min(state.frameIndex, action.frameMs.length - 1)]
        : action.frameMs;
      ms = ms / (state.actionSpeed || 1);
      state.frameElapsed += dt;
      if (state.frameElapsed < ms) return;
      state.frameElapsed = 0;
      if (state.frameIndex < frames.length - 1) {
        state.frameIndex += 1;
        return;
      }
      if (state.actionLoop) {
        state.frameIndex = 0;
        return;
      }
      if (action.next && !state.emote) setAction(action.next, { restart: true });
    }

    function drawMatrix(sx, sy) {
      offCtx.clearRect(0, 0, SHEET.frameWidth, SHEET.frameHeight);
      offCtx.drawImage(sheet, sx, sy, SHEET.frameWidth, SHEET.frameHeight, 0, 0, SHEET.frameWidth, SHEET.frameHeight);
      const pixels = offCtx.getImageData(0, 0, SHEET.frameWidth, SHEET.frameHeight).data;
      const cell = 6;
      const chars = "01アイウエオカキクケコ";
      const tick = Math.floor(state.now / 90);
      ctx.save();
      ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textBaseline = "top";
      for (let y = 0; y < SHEET.frameHeight; y += cell) {
        for (let x = 0; x < SHEET.frameWidth; x += cell) {
          const index = (y * SHEET.frameWidth + x) * 4;
          const alpha = pixels[index + 3];
          if (alpha < 48) continue;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const pink = red > 150 && red > blue + 18 && green > 70;
          const bright = (red + green + blue) / 3 / 255;
          ctx.globalAlpha = Math.min(1, alpha / 255) * (0.55 + bright * 0.45);
          ctx.fillStyle = pink ? "#ff8fb3" : (bright > 0.72 ? "#e7fff2" : "#3eea96");
          const glyph = chars[(x * 3 + y + tick) % chars.length];
          ctx.fillText(glyph, x * SCALE, y * SCALE);
        }
      }
      ctx.restore();
    }

    function draw() {
      const scale = ratio();
      if (canvas.width !== Math.floor(SPRITE_W * scale) || canvas.height !== Math.floor(SPRITE_H * scale)) {
        canvas.width = Math.floor(SPRITE_W * scale);
        canvas.height = Math.floor(SPRITE_H * scale);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = "rgba(195, 128, 157, 0.2)";
      ctx.beginPath();
      ctx.ellipse(SPRITE_W / 2, SPRITE_H * FOOT_Y + 1, 58, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      const action = ACTIONS[state.actionId] || ACTIONS.idle;
      if (action.src && extras.get(action.src)) {
        ctx.drawImage(extras.get(action.src), 0, 0, SPRITE_W, SPRITE_H);
        return;
      }
      if (!sheetReady) return;
      const column = action.frames[Math.min(state.frameIndex, action.frames.length - 1)];
      const sx = column * SHEET.frameWidth;
      const sy = (action.row || 0) * SHEET.frameHeight;
      if (state.settings.matrix) drawMatrix(sx, sy);
      else ctx.drawImage(sheet, sx, sy, SHEET.frameWidth, SHEET.frameHeight, 0, 0, SPRITE_W, SPRITE_H);
    }

    function interruptPlugins() {
      plugins.forEach(function (plugin) {
        if (plugin.onInterrupt) plugin.onInterrupt(api);
      });
    }

    function step(now) {
      const dt = Math.min(48, now - state.now || 16);
      state.now = now;
      state.dt = dt;
      state.workArea = host.getWorkArea(state.feet);
      state.laser = null;

      if (state.emote) {
        state.emote.left -= dt;
        if (state.emote.hop) {
          const t = 1 - Math.max(0, state.emote.left) / state.emote.total;
          state.feet.y = state.emote.baseY - Math.sin(Math.PI * Math.min(1, t)) * 64;
        }
        if (state.emote.left <= 0) {
          if (state.emote.hop) state.feet.y = state.emote.baseY;
          state.emote = null;
          setAction("idle", { restart: true });
        }
      } else if (!state.dragging && !state.menuOpen) {
        let owner = null;
        for (let index = 0; index < MOVER_ORDER.length; index += 1) {
          const plugin = byId[MOVER_ORDER[index]];
          if (plugin && plugin.wants && plugin.wants(api)) {
            owner = plugin;
            break;
          }
        }
        if (owner && owner.update) owner.update(api);
        else if (ACTIONS[state.actionId] && !ACTIONS[state.actionId].loop) {
          /* hold the last one-shot frame until a mover replaces it */
        } else if (state.actionId.indexOf("walk") === 0 || state.actionId === "fall" || state.actionId === "sit") {
          setAction("idle");
        }
        clampFeet();
      }

      advance(dt);
      draw();
      layout();
      if (status) {
        const action = ACTIONS[state.actionId];
        status.textContent = action ? action.label : state.actionId;
      }
      if (state.laser) {
        host.setLaser(state.laser);
        state.laserSent = true;
      } else if (state.laserSent) {
        host.setLaser(null);
        state.laserSent = false;
      }
      requestAnimationFrame(step);
    }

    canvas.addEventListener("pointerdown", function (event) {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        openMenu();
        return;
      }
      if (event.button !== 0) return;
      const cursor = host.getCursor();
      state.pointer = {
        id: event.pointerId,
        x: cursor.x,
        y: cursor.y,
        feetX: state.feet.x,
        feetY: state.feet.y,
        moved: false,
      };
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!state.pointer || event.pointerId !== state.pointer.id) return;
      const cursor = host.getCursor();
      const distance = Math.hypot(cursor.x - state.pointer.x, cursor.y - state.pointer.y);
      if (!state.pointer.moved && distance < 6) return;
      if (!state.pointer.moved) {
        state.pointer.moved = true;
        state.dragging = true;
        state.emote = null;
        closeMenu();
        interruptPlugins();
        say("带着我走吧。", 1200);
      }
      state.feet.x = state.pointer.feetX + (cursor.x - state.pointer.x);
      state.feet.y = state.pointer.feetY + (cursor.y - state.pointer.y);
      state.facing = cursor.x - state.pointer.x < 0 ? -1 : 1;
      setAction("walk");
      if (state.settings.trail) {
        const last = state.lastTrail;
        if (!last || Math.hypot(cursor.x - last.x, cursor.y - last.y) > 14) {
          state.lastTrail = { x: cursor.x, y: cursor.y };
          host.addTrail(cursor);
        }
      }
    });

    function endPointer(event) {
      if (!state.pointer || event.pointerId !== state.pointer.id) return;
      const moved = state.pointer.moved;
      state.pointer = null;
      state.dragging = false;
      state.lastTrail = null;
      if (moved) {
        clampFeet();
        setAction("idle", { restart: true });
        return;
      }
      const now = performance.now();
      if (now - state.lastClick < 340) {
        playEmote("jump");
        say("蹦！");
      } else {
        playEmote("wave");
        say(pick(CLICK_LINES));
      }
      state.lastClick = now;
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("contextmenu", function (event) { event.preventDefault(); });

    window.addEventListener("pointerdown", function (event) {
      if (!state.menuOpen) return;
      if (menu.contains(event.target)) return;
      closeMenu();
    });
    menu.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    menu.addEventListener("click", function (event) {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.toggle) {
        toggleSetting(button.dataset.toggle);
        return;
      }
      command(button.dataset.command || button.dataset.action);
    });

    window.addEventListener("mousemove", function (event) { syncIgnore(event.clientX, event.clientY); });
    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    if (host.onRecenter) {
      host.onRecenter(function () { placeHome(); });
    }

    plugins.forEach(function (plugin) {
      if (state.settings[plugin.id] && plugin.onEnable) plugin.onEnable(api);
    });

    placeHome();
    refreshWindows();
    window.setInterval(refreshWindows, 1600);
    say("我来啦～");
    requestAnimationFrame(step);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}());
