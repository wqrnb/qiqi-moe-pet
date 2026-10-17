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
    },
  };

  function locomotionAction(vx) {
    return vx < 0 ? "walkLeft" : "walkRight";
  }

  function actionDuration(action) {
    if (!action) return 0;
    if (Array.isArray(action.frameMs)) {
      return action.frameMs.reduce(function (sum, ms) { return sum + ms; }, 0);
    }
    const count = action.frames ? action.frames.length : 1;
    return action.frameMs * count;
  }

  return {
    SHEET: SHEET,
    EMPTY_CELLS: EMPTY_CELLS,
    ACTIONS: ACTIONS,
    locomotionAction: locomotionAction,
    actionDuration: actionDuration,
  };
});
