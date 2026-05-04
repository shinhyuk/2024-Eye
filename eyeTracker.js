// Eye gaze tracker using MediaPipe Face Mesh (loaded via CDN globals).
// Emits 'left' | 'right' | 'up' | 'down' events when gaze deviates from
// a calibrated center beyond the configured sensitivity threshold.

const FACEMESH_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
const CAMERA_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

// Landmark indices (MediaPipe Face Mesh with refine_landmarks=true)
// Right eye (subject's right, image's left in mirrored view)
const R_EYE_OUTER = 33;
const R_EYE_INNER = 133;
const R_EYE_TOP = 159;
const R_EYE_BOTTOM = 145;
const R_IRIS_CENTER = 468;
// Left eye (subject's left, image's right)
const L_EYE_OUTER = 263;
const L_EYE_INNER = 362;
const L_EYE_TOP = 386;
const L_EYE_BOTTOM = 374;
const L_IRIS_CENTER = 473;
// Face landmarks for head-pitch detection
const FOREHEAD = 10;
const CHIN = 152;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export class EyeTracker {
  constructor({ video, canvas, onGaze, onStatus }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onGaze = onGaze || (() => {});
    this.onStatus = onStatus || (() => {});

    this.faceMesh = null;
    this.camera = null;
    this.running = false;

    this.sensitivity = 0.07;   // gaze ratio threshold from center
    this.cooldownMs = 600;     // min time between emitted gaze events
    this.lastEmit = 0;
    this.lastDir = null;       // require returning toward center before re-emit
    this.invertX = false;
    this.invertY = false;

    this.calibration = { x: 0, y: 0, set: false };
    this.lastGaze = { x: 0, y: 0 }; // latest measured normalized gaze
  }

  async start() {
    if (this.running) return;
    this.onStatus("로딩 중...");
    await loadScript(FACEMESH_SCRIPT);
    await loadScript(CAMERA_SCRIPT);

    this.faceMesh = new window.FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    this.faceMesh.onResults((res) => this._onResults(res));

    this.camera = new window.Camera(this.video, {
      onFrame: async () => {
        if (this.faceMesh) await this.faceMesh.send({ image: this.video });
      },
      width: 640,
      height: 480,
      facingMode: "user",
    });
    // playsinline + muted are already set on the <video> element so iOS can
    // play the stream inline without going fullscreen.
    await this.camera.start();
    this.running = true;
    this.onStatus("실행 중 (보정 필요)");
  }

  stop() {
    if (!this.running) return;
    this.camera?.stop();
    this.camera = null;
    if (this.video.srcObject) {
      for (const tr of this.video.srcObject.getTracks()) tr.stop();
      this.video.srcObject = null;
    }
    this.faceMesh?.close();
    this.faceMesh = null;
    this.running = false;
    this.calibration.set = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.onStatus("비활성");
  }

  calibrate() {
    if (!this.running) return;
    this.calibration.x = this.lastGaze.x;
    this.calibration.y = this.lastGaze.y;
    this.calibration.set = true;
    this.onStatus("보정 완료 — 게임 시작!");
  }

  setSensitivity(v) { this.sensitivity = Number(v); }
  setCooldown(v) { this.cooldownMs = Number(v); }
  setInvertX(v) { this.invertX = !!v; }
  setInvertY(v) { this.invertY = !!v; }

  _onResults(res) {
    const w = this.video.videoWidth || 640;
    const h = this.video.videoHeight || 480;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.clearRect(0, 0, w, h);

    const faces = res.multiFaceLandmarks;
    if (!faces || !faces.length) return;
    const lm = faces[0];

    const gaze = this._computeGaze(lm, w, h);
    if (!gaze) return;
    this.lastGaze = gaze;

    this._draw(lm, gaze, w, h);

    if (!this.calibration.set) return;

    let dx = gaze.x - this.calibration.x;
    let dy = gaze.y - this.calibration.y;
    // User-facing axis inversion (applied after calibration so it doesn't
    // invalidate the stored center).
    if (this.invertX) dx = -dx;
    if (this.invertY) dy = -dy;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    let dir = null;
    if (Math.max(adx, ady) >= this.sensitivity) {
      if (adx >= ady) dir = dx > 0 ? "right" : "left";
      else            dir = dy > 0 ? "down"  : "up";
    }

    const now = performance.now();
    if (dir) {
      const elapsed = now - this.lastEmit;
      if (elapsed >= this.cooldownMs && dir !== this.lastDir) {
        this.lastEmit = now;
        this.lastDir = dir;
        this.onGaze(dir);
      }
    } else if (Math.max(adx, ady) < this.sensitivity * 0.5) {
      // Returned to neutral — allow same direction to be re-triggered.
      this.lastDir = null;
    }
  }

  _computeGaze(lm, w, h) {
    // Compute iris offset from each eye's center, normalized by eye WIDTH.
    // Using width for both axes (instead of width-for-x and height-for-y)
    // avoids the vertical signal being amplified when eyelids narrow the
    // eye opening, and keeps left/right and up/down on the same scale.
    const px = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });

    const rOuter = px(R_EYE_OUTER), rInner = px(R_EYE_INNER);
    const rTop = px(R_EYE_TOP),     rBottom = px(R_EYE_BOTTOM);
    const rIris = px(R_IRIS_CENTER);

    const lOuter = px(L_EYE_OUTER), lInner = px(L_EYE_INNER);
    const lTop = px(L_EYE_TOP),     lBottom = px(L_EYE_BOTTOM);
    const lIris = px(L_IRIS_CENTER);

    const rEyeCx = (rOuter.x + rInner.x) / 2;
    const rEyeCy = (rTop.y + rBottom.y) / 2;
    const lEyeCx = (lOuter.x + lInner.x) / 2;
    const lEyeCy = (lTop.y + lBottom.y) / 2;

    const rEyeW = Math.abs(rOuter.x - rInner.x);
    const lEyeW = Math.abs(lOuter.x - lInner.x);
    if (rEyeW < 1 || lEyeW < 1) return null;

    const rxOff = (rIris.x - rEyeCx) / rEyeW;
    const ryOff = (rIris.y - rEyeCy) / rEyeW;
    const lxOff = (lIris.x - lEyeCx) / lEyeW;
    const lyOff = (lIris.y - lEyeCy) / lEyeW;

    // Head pitch from MediaPipe z-depth. The z origin is at head center;
    // smaller z = closer to camera. When the user nods DOWN (chin to chest),
    // the chin recedes from the camera (chin.z grows) while the forehead
    // moves toward the camera (forehead.z shrinks). So chin.z - forehead.z
    // is positive when looking down, negative when looking up. People
    // naturally tilt their head for vertical input, so this is far more
    // reliable than the small iris movement within the eye opening.
    const headPitch = lm[CHIN].z - lm[FOREHEAD].z;

    // The camera frame is unmirrored: when the user looks to their right,
    // the iris moves toward the LEFT of the image. Negate x so positive x
    // means "user is looking to their right" — matching the mirrored video
    // they actually see on screen.
    const x = -((rxOff + lxOff) / 2);
    // Combine eye iris vertical and head pitch. Head pitch dominates because
    // its physical range is much larger; the iris term still contributes for
    // users who keep their head still and only move their eyes.
    const y = (ryOff + lyOff) / 2 + headPitch * 2.0;
    return { x, y };
  }

  _draw(lm, gaze, w, h) {
    const ctx = this.ctx;
    const drawDot = (i, color = "#00e676", r = 2) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // Eye outline points
    [R_EYE_OUTER, R_EYE_INNER, R_EYE_TOP, R_EYE_BOTTOM,
     L_EYE_OUTER, L_EYE_INNER, L_EYE_TOP, L_EYE_BOTTOM].forEach((i) =>
      drawDot(i, "#00bcd4", 2)
    );
    // Iris centers
    drawDot(R_IRIS_CENTER, "#ff5252", 3);
    drawDot(L_IRIS_CENTER, "#ff5252", 3);

    // HUD: gaze vector indicator (small box top-left of canvas)
    const boxSize = 70;
    const margin = 12;
    ctx.save();
    // The canvas is mirrored via CSS, so flip text/HUD back so it reads correctly.
    ctx.setTransform(-1, 0, 0, 1, w, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin, margin, boxSize, boxSize);

    // crosshair
    ctx.beginPath();
    ctx.moveTo(margin + boxSize / 2, margin);
    ctx.lineTo(margin + boxSize / 2, margin + boxSize);
    ctx.moveTo(margin, margin + boxSize / 2);
    ctx.lineTo(margin + boxSize, margin + boxSize / 2);
    ctx.stroke();

    let dx = this.calibration.set ? gaze.x - this.calibration.x : gaze.x;
    let dy = this.calibration.set ? gaze.y - this.calibration.y : gaze.y;
    if (this.invertX) dx = -dx;
    if (this.invertY) dy = -dy;
    const scale = boxSize * 3.5;
    const cx = margin + boxSize / 2 + Math.max(-boxSize / 2, Math.min(boxSize / 2, dx * scale));
    const cy = margin + boxSize / 2 + Math.max(-boxSize / 2, Math.min(boxSize / 2, dy * scale));

    ctx.fillStyle = this.calibration.set ? "#ffd600" : "#9e9e9e";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
