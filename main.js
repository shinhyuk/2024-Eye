import { Game2048 } from "./game.js";
import { EyeTracker } from "./eyeTracker.js";

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restart");
const msgEl = document.getElementById("game-msg");
const msgTextEl = document.getElementById("game-msg-text");
const msgRestartBtn = document.getElementById("msg-restart");

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const startCamBtn = document.getElementById("start-cam");
const stopCamBtn = document.getElementById("stop-cam");
const calibrateBtn = document.getElementById("calibrate");
const trackerStatusEl = document.getElementById("tracker-status");
const gazeDirEl = document.getElementById("gaze-direction");
const sensInput = document.getElementById("sensitivity");
const sensVal = document.getElementById("sensitivity-val");
const cdInput = document.getElementById("cooldown");
const cdVal = document.getElementById("cooldown-val");

// ---- Game ----
const game = new Game2048(boardEl, ({ score, best, over, won }) => {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  if (over) {
    msgTextEl.textContent = won ? "🎉 2048 달성! 계속 도전하세요" : "게임 종료";
    msgEl.hidden = false;
  } else {
    msgEl.hidden = true;
  }
});

const restart = () => game.reset();
restartBtn.addEventListener("click", restart);
msgRestartBtn.addEventListener("click", restart);

// Keyboard controls
const KEYMAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down",
  A: "left", D: "right", W: "up", S: "down",
};
window.addEventListener("keydown", (e) => {
  const dir = KEYMAP[e.key];
  if (!dir) return;
  e.preventDefault();
  game.move(dir);
});

window.addEventListener("resize", () => game.resize());

// ---- Eye tracker ----
const tracker = new EyeTracker({
  video,
  canvas: overlay,
  onGaze: (dir) => {
    gazeDirEl.textContent = ({ left: "← 왼쪽", right: "→ 오른쪽", up: "↑ 위", down: "↓ 아래" })[dir];
    flashGazeEl(dir);
    game.move(dir);
  },
  onStatus: (s) => {
    trackerStatusEl.textContent = s;
  },
});

let gazeFlashTimer = null;
function flashGazeEl(dir) {
  gazeDirEl.style.transition = "color 80ms";
  gazeDirEl.style.color = "#43a047";
  clearTimeout(gazeFlashTimer);
  gazeFlashTimer = setTimeout(() => {
    gazeDirEl.style.color = "";
  }, 250);
}

startCamBtn.addEventListener("click", async () => {
  startCamBtn.disabled = true;
  try {
    await tracker.start();
    stopCamBtn.disabled = false;
    calibrateBtn.disabled = false;
  } catch (err) {
    console.error(err);
    trackerStatusEl.textContent = "오류: " + err.message;
    startCamBtn.disabled = false;
  }
});

stopCamBtn.addEventListener("click", () => {
  tracker.stop();
  startCamBtn.disabled = false;
  stopCamBtn.disabled = true;
  calibrateBtn.disabled = true;
  gazeDirEl.textContent = "-";
});

calibrateBtn.addEventListener("click", () => tracker.calibrate());

sensInput.addEventListener("input", () => {
  tracker.setSensitivity(sensInput.value);
  sensVal.textContent = Number(sensInput.value).toFixed(2);
});
cdInput.addEventListener("input", () => {
  tracker.setCooldown(cdInput.value);
  cdVal.textContent = cdInput.value;
});

// initial display
sensVal.textContent = Number(sensInput.value).toFixed(2);
cdVal.textContent = cdInput.value;
