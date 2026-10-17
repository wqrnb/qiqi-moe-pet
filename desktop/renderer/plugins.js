(function (root) {
  const plugins = [];

  function say(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  plugins.push({
    id: "taskbar",
    label: "任务栏散步",
    toggle: true,
    defaultEnabled: true,
    dir: 1,
    pause: 0,
    pauseAction: "wait",
    leg: 0,
    wants: function (api) {
      return api.enabled("taskbar") && !api.dragging && !api.emoting;
    },
    onInterrupt: function () {
      this.pause = 0;
      this.leg = 0;
    },
    update: function (api) {
      const area = api.workArea();
      const floor = area.y + area.height;
      api.feet.y += (floor - api.feet.y) * Math.min(1, api.dt / 260);
      if (Math.abs(floor - api.feet.y) < 1.2) api.feet.y = floor;

      if (this.pause > 0) {
        this.pause -= api.dt;
        api.setAction(this.pauseAction || "wait");
        return;
      }

      const margin = 56;
      const left = area.x + margin;
      const right = area.x + area.width - margin;
      if (api.feet.x >= right) {
        api.feet.x = right;
        this.dir = -1;
        this.pause = 900;
        this.pauseAction = "wave";
      } else if (api.feet.x <= left) {
        api.feet.x = left;
        this.dir = 1;
        this.pause = 900;
        this.pauseAction = "wave";
      } else {
        api.feet.x += this.dir * 78 * api.dt / 1000;
      }
      api.facing = this.dir < 0 ? -1 : 1;
      api.setAction("taskbarWalk");
      this.leg += api.dt;
      if (this.leg > 16000) {
        this.leg = 0;
        const roll = Math.random();
        if (roll < 0.28) {
          this.pauseAction = "sleep";
          this.pause = 3600;
          api.say("走累了，眯一下下。");
        } else if (roll < 0.55) {
          this.pauseAction = "wait";
          this.pause = 1700;
          api.say(say(["任务栏也好软。", "我在这儿陪你。", "再走一段吧。"]));
        } else {
          this.pauseAction = "wave";
          this.pause = 1200;
        }
      }
    },
  });

  plugins.push({
    id: "wander",
    label: "桌面闲逛",
    toggle: true,
    defaultEnabled: false,
    phase: "move",
    target: null,
    left: 0,
    pauseAction: "idle",
    slot: -1,
    wants: function (api) {
      if (!api.enabled("wander") || api.dragging || api.emoting) return false;
      if (!api.enabled("taskbar")) return true;
      return Math.floor(api.now / 22000) % 2 === 0;
    },
    onInterrupt: function () {
      this.phase = "move";
      this.target = null;
    },
    pick: function (area) {
      const minX = area.x + 70;
      const maxX = Math.max(minX + 1, area.x + area.width - 70);
      const minY = area.y + 80;
      const maxY = Math.max(minY + 1, area.y + area.height - 70);
      this.target = {
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
      };
    },
    update: function (api) {
      const area = api.workArea();
      const slot = Math.floor(api.now / 22000);
      if (this.slot !== slot) {
        this.slot = slot;
        this.phase = "move";
        this.target = null;
      }
      if (!this.target) this.pick(area);
      if (this.phase === "pause") {
        this.left -= api.dt;
        api.setAction(this.pauseAction);
        if (this.left <= 0) {
          this.phase = "move";
          this.pick(area);
        }
        return;
      }
      if (api.moveToward(this.target.x, this.target.y, 96)) {
        this.phase = "pause";
        this.left = 1500 + Math.random() * 2200;
        const choices = ["idle", "sit", "review", "read", "wave", "wait"];
        this.pauseAction = choices[Math.floor(Math.random() * choices.length)];
        api.setAction(this.pauseAction, { restart: true });
        if (Math.random() < 0.45) {
          api.say(say(["这边看看。", "桌面也好好逛。", "我又找到一块空地。"]));
        }
      }
    },
  });

  plugins.push({
    id: "perch",
    label: "自动栖窗追逐",
    toggle: true,
    defaultEnabled: true,
    phase: "idle",
    cooldownUntil: 0,
    left: 0,
    win: null,
    vy: 0,
    anchor: null,
    onEnable: function (api) {
      if (this.phase === "idle") this.cooldownUntil = api.now + 12000;
    },
    onDisable: function () {
      if (this.phase !== "idle" && this.phase !== "drop") this.phase = "drop";
    },
    onInterrupt: function (api) {
      this.phase = "idle";
      this.vy = 0;
      this.cooldownUntil = (api ? api.now : Date.now()) + 6000;
    },
    force: function (mode) {
      this.forcedMode = mode;
      this.phase = "boot";
    },
    ledge: function (api) {
      const area = api.workArea();
      return {
        title: "窗沿",
        x: area.x + area.width * 0.22,
        y: area.y + 78,
        width: Math.max(240, area.width * 0.38),
        height: 180,
      };
    },
    begin: function (api, mode) {
      if (mode === "drop") {
        const area = api.workArea();
        const floor = area.y + area.height;
        this.vy = api.feet.y < floor - 48 ? -120 : -560;
        this.phase = "drop";
        api.say("跳下去咯～");
        return;
      }
      if (mode === "chase") {
        this.phase = "chase";
        this.left = 7000;
        api.say("红点点，我来追！");
        api.setAction("notice", { restart: true });
        return;
      }
      const windows = api.windows();
      const usable = (windows || []).filter(function (win) {
        return win && win.width > 180 && win.height > 80;
      });
      this.win = usable.length
        ? usable[Math.floor(Math.random() * usable.length)]
        : this.ledge(api);
      this.phase = "goto";
      api.say(this.win.title && this.win.title !== "窗沿"
        ? "我去「" + this.win.title.slice(0, 12) + "」上面坐坐。"
        : "我去窗沿坐坐～");
    },
    wants: function (api) {
      if (this.phase === "boot") {
        this.begin(api, this.forcedMode || "perch");
        return true;
      }
      if (this.phase !== "idle") return true;
      if (!api.enabled("perch") || api.dragging || api.emoting) return false;
      if (api.now < this.cooldownUntil) return false;
      this.begin(api, "perch");
      return true;
    },
    update: function (api) {
      const area = api.workArea();
      const floor = area.y + area.height;
      if (this.phase === "goto" && this.win) {
        const half = 70;
        const targetX = Math.min(
          this.win.x + this.win.width - half,
          Math.max(this.win.x + half, this.win.x + this.win.width / 2)
        );
        const targetY = this.win.y + 2;
        if (api.moveToward(targetX, targetY, 130)) {
          this.phase = "sit";
          this.left = 5600;
          this.anchor = api.cursor();
          api.setAction("perch", { restart: true });
          api.say("坐这儿刚刚好。");
        }
        return;
      }
      if (this.phase === "sit") {
        this.left -= api.dt;
        const current = api.action();
        if (current === "idle" || current === "walkLeft" || current === "walkRight" || current === "taskbarWalk") api.setAction("perch");
        const cursor = api.cursor();
        const moved = this.anchor
          ? Math.hypot(cursor.x - this.anchor.x, cursor.y - this.anchor.y)
          : 0;
        const near = Math.hypot(cursor.x - api.feet.x, cursor.y - api.feet.y);
        if (moved > 28 && near < 280) {
          this.phase = "chase";
          this.left = 6800;
          api.say("红点点，我来追！");
          api.setAction("chase", { restart: true });
          return;
        }
        if (this.left <= 0) {
          this.phase = "drop";
          this.vy = -80;
          api.say("我跳下去啦。");
        }
        return;
      }
      if (this.phase === "chase") {
        this.left -= api.dt;
        const cursor = api.cursor();
        const aimX = cursor.x - api.facing * 36;
        const aimY = cursor.y + 28;
        api.setLaser({
          x1: api.feet.x + api.facing * 42,
          y1: api.feet.y - 150,
          x2: cursor.x,
          y2: cursor.y,
        });
        const caught = api.moveToward(aimX, aimY, 250, "chase");
        if (caught || this.left <= 0) {
          api.say(caught ? "抓到啦～" : "跑够啦。");
          api.setAction("jump", { restart: true });
          this.phase = "drop";
          this.vy = -160;
        }
        return;
      }
      if (this.phase === "drop") {
        this.vy += 1900 * api.dt / 1000;
        api.feet.y += this.vy * api.dt / 1000;
        api.setAction(this.vy < 0 ? "jump" : "parachute");
        if (api.feet.y >= floor) {
          api.feet.y = floor;
          this.vy = 0;
          this.phase = "idle";
          this.cooldownUntil = api.now + 20000;
          api.setAction("idle", { restart: true });
        }
      }
    },
  });

  plugins.push({
    id: "trail",
    label: "拖拽爱心樱花",
    toggle: true,
    defaultEnabled: true,
    wants: function () { return false; },
  });

  plugins.push({
    id: "matrix",
    label: "矩阵滤镜",
    toggle: true,
    defaultEnabled: false,
    wants: function () { return false; },
  });

  plugins.push({
    id: "gremlin",
    label: "小捣蛋模式",
    toggle: true,
    defaultEnabled: false,
    phase: "idle",
    cooldownUntil: Infinity,
    left: 0,
    targetX: 0,
    targetY: 0,
    onEnable: function (api) {
      this.phase = "idle";
      this.cooldownUntil = api.now + 8000;
    },
    onDisable: function () {
      this.phase = "idle";
    },
    onInterrupt: function (api) {
      this.phase = "idle";
      this.cooldownUntil = (api ? api.now : Date.now()) + 8000;
    },
    wants: function (api) {
      if (this.phase === "prank") return true;
      if (!api.enabled("gremlin") || api.dragging || api.emoting) return false;
      if (api.now < this.cooldownUntil) return false;
      this.phase = "prank";
      this.left = 1500;
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.targetX = api.feet.x + dir * (110 + Math.random() * 80);
      this.targetY = api.feet.y - (16 + Math.random() * 36);
      api.say(say(["嘿嘿～", "偷偷挪一下。", "就闹一下下。"]));
      return true;
    },
    update: function (api) {
      this.left -= api.dt;
      api.moveToward(this.targetX, this.targetY, 210);
      if (this.left < 420) api.setAction("gremlin");
      if (this.left <= 0) {
        this.phase = "idle";
        this.cooldownUntil = api.now + 28000 + Math.random() * 22000;
        api.say(say(["好啦，不闹了。", "嘿嘿，就一下。"]));
      }
    },
  });

  root.QiqiPlugins = plugins;
})(window);
