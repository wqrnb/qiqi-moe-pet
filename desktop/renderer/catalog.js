(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.QiqiCatalog = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  // 1536×2288 sheet. Frame size is image size ÷ columns ÷ rows.
  // The web moe page uses the same sheet: idle row 0, wave row 3,
  // jump row 4, wait row 6, review row 8.
  const SHEET = {
    src: "../../assets/qiqi-spritesheet.webp",
    columns: 8,
    rows: 11,
    frameWidth: 192,
    frameHeight: 208,
  };

  // Cells that are blank today. Draw a new frame here, then list its column in `frames`.
  const EMPTY_CELLS = [
    [0, 7],
    [3, 4], [3, 5], [3, 6], [3, 7],
    [4, 5], [4, 6], [4, 7],
    [6, 6], [6, 7],
    [7, 6], [7, 7],
    [8, 6], [8, 7],
  ];

  const ACTIONS = {
    idle: {
      id: "idle",
      label: "安静待机",
      row: 0,
      frames: [0, 1, 2, 3, 4, 5, 6],
      frameMs: [280, 110, 110, 140, 140, 220, 160],
      loop: true,
    },
    walkRight: {
      id: "walkRight",
      label: "向右走",
      row: 1,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameMs: 100,
      loop: true,
    },
    walkLeft: {
      id: "walkLeft",
      label: "向左走",
      row: 2,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameMs: 100,
      loop: true,
    },
    wave: {
      id: "wave",
      label: "开心挥手",
      row: 3,
      frames: [0, 1, 2, 3],
      frameMs: 175,
      loop: false,
    },
    jump: {
      id: "jump",
      label: "开心蹦一下",
      row: 4,
      frames: [0, 1, 2, 3, 4],
      frameMs: 168,
      loop: false,
    },
    fall: {
      id: "fall",
      label: "落下",
      row: 4,
      frames: [2],
      frameMs: 180,
      loop: true,
    },
    sit: {
      id: "sit",
      label: "安静坐下",
      row: 5,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameMs: 180,
      loop: true,
    },
    wait: {
      id: "wait",
      label: "乖乖等待",
      row: 6,
      frames: [0, 1, 2, 3, 4, 5],
      frameMs: 168,
      loop: true,
    },
    notice: {
      id: "notice",
      label: "看过来",
      row: 7,
      frames: [0, 1, 2, 3, 4, 5],
      frameMs: 140,
      loop: false,
    },
    review: {
      id: "review",
      label: "认真看看",
      row: 8,
      frames: [0, 1, 2, 3, 4, 5],
      frameMs: 172,
      loop: false,
    },
    settle: {
      id: "settle",
      label: "低下头",
      row: 9,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameMs: 130,
      loop: false,
      next: "sit",
    },
    sleep: {
      id: "sleep",
      label: "睡一会儿",
      row: 10,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameMs: 160,
      loop: true,
      sequence: { stem: "qiqi_sleep" },
    },
    perch: {
      id: "perch",
      label: "栖在窗上",
      frameMs: 120,
      loop: true,
      fallback: "settle",
      sequence: { stem: "qiqi_perch" },
    },
    chase: {
      id: "chase",
      label: "追逐",
      frameMs: 80,
      loop: true,
      fallback: "walk",
      sequence: { stem: "qiqi_chase", facing: true },
    },
    parachute: {
      id: "parachute",
      label: "降落伞",
      frameMs: 110,
      loop: true,
      fallback: "fall",
      sequence: { stem: "qiqi_parachute" },
    },
    gremlin: {
      id: "gremlin",
      label: "小捣蛋",
      frameMs: 120,
      loop: true,
      fallback: "notice",
      sequence: { stem: "qiqi_gremlin" },
    },
    read: {
      id: "read",
      label: "看书",
      frameMs: 160,
      loop: true,
      fallback: "review",
      sequence: { stem: "qiqi_read" },
    },
    taskbarWalk: {
      id: "taskbarWalk",
      label: "任务栏上走",
      frameMs: 100,
      loop: true,
      fallback: "walk",
      sequence: { stem: "qiqi_taskbar", facing: true },
    },
  };

  const CLIP_ROOT = "../../assets/actions/";
  const MIN_SEQUENCE_FRAMES = 4;
  const MAX_SEQUENCE_FRAMES = 24;

  function locomotionAction(vx) {
    return vx < 0 ? "walkLeft" : "walkRight";
  }

  function frameFileName(stem, index) {
    const number = String(index).padStart(2, "0");
    return stem + "_" + number + ".png";
  }

  function clipUrl(stem, index) {
    return CLIP_ROOT + frameFileName(stem, index);
  }

  function acceptSequence(count) {
    return count >= MIN_SEQUENCE_FRAMES;
  }

  function sequenceStems() {
    const stems = [];
    Object.keys(ACTIONS).forEach(function (id) {
      const sequence = ACTIONS[id].sequence;
      if (!sequence) return;
      stems.push(sequence.stem);
      if (sequence.facing) {
        stems.push(sequence.stem + "_left");
        stems.push(sequence.stem + "_right");
      }
    });
    return stems;
  }

  // ready is a Set of stems that already passed acceptSequence (4 or more frames).
  // One still, or a 2–3 frame fragment, stays on the spritesheet.
  function resolvePlayback(requestedId, facing, ready) {
    const left = facing < 0;
    let id = requestedId || "idle";
    const seen = {};
    while (id && !seen[id]) {
      seen[id] = true;
      if (id === "taskbarWalk") {
        if (left && ready && ready.has("qiqi_taskbar_left")) {
          return { id: "taskbarWalk", stem: "qiqi_taskbar_left", mirror: false };
        }
        if (!left && ready && ready.has("qiqi_taskbar_right")) {
          return { id: "taskbarWalk", stem: "qiqi_taskbar_right", mirror: false };
        }
        if (ready && ready.has("qiqi_taskbar")) {
          return { id: "taskbarWalk", stem: "qiqi_taskbar", mirror: left };
        }
        id = "walk";
        continue;
      }
      if (id === "walk") {
        id = left ? "walkLeft" : "walkRight";
        continue;
      }
      if (id === "chase") {
        if (left && ready && ready.has("qiqi_chase_left")) {
          return { id: "chase", stem: "qiqi_chase_left", mirror: false };
        }
        if (!left && ready && ready.has("qiqi_chase_right")) {
          return { id: "chase", stem: "qiqi_chase_right", mirror: false };
        }
        if (ready && ready.has("qiqi_chase")) {
          return { id: "chase", stem: "qiqi_chase", mirror: left };
        }
        id = "walk";
        continue;
      }
      const action = ACTIONS[id];
      if (!action) return { id: "idle", stem: null, mirror: false };
      if (action.sequence && ready && ready.has(action.sequence.stem)) {
        return { id: id, stem: action.sequence.stem, mirror: false };
      }
      if (action.row != null && action.frames) return { id: id, stem: null, mirror: false };
      if (action.fallback) {
        id = action.fallback;
        continue;
      }
      return { id: "idle", stem: null, mirror: false };
    }
    return { id: "idle", stem: null, mirror: false };
  }

  function actionDuration(action) {
    if (!action) return 0;
    if (Array.isArray(action.frameMs)) {
      return action.frameMs.reduce(function (sum, ms) { return sum + ms; }, 0);
    }
    const count = action.frames ? action.frames.length : (action.sequence ? MIN_SEQUENCE_FRAMES : 1);
    return action.frameMs * count;
  }

  return {
    SHEET: SHEET,
    EMPTY_CELLS: EMPTY_CELLS,
    ACTIONS: ACTIONS,
    CLIP_ROOT: CLIP_ROOT,
    MIN_SEQUENCE_FRAMES: MIN_SEQUENCE_FRAMES,
    MAX_SEQUENCE_FRAMES: MAX_SEQUENCE_FRAMES,
    locomotionAction: locomotionAction,
    actionDuration: actionDuration,
    frameFileName: frameFileName,
    clipUrl: clipUrl,
    acceptSequence: acceptSequence,
    sequenceStems: sequenceStems,
    resolvePlayback: resolvePlayback,
  };
});
