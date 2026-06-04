// pill-field.js — render MANY liquid pills through ONE shared WebGL context.
// Each pill is a scene group; every frame we render each group into the screen
// rectangle of its DOM placeholder (scissor + viewport). One renderer total.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const PILL_RADIUS = 0.55, PILL_LENGTH = 1.7;
const LIQUID_RADIUS = PILL_RADIUS * 0.93, LIQUID_LENGTH = PILL_LENGTH * 0.95;
const LIQUID_HALF_AXIS = LIQUID_LENGTH / 2 + LIQUID_RADIUS;
const TABLET_RADIUS = 0.55, TABLET_THICKNESS = 0.34;
const TABLET_FILL_MIN = -TABLET_RADIUS - 0.08, TABLET_FILL_MAX = TABLET_RADIUS + 0.08;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// engraved imprint as a transparent canvas texture
function makeLabelTexture(text, { rotate = 0, color = "rgba(55,42,52,0.5)", weight = 700, sizeFactor = 0.46 } = {}) {
  const S = 256;
  const cv = document.createElement("canvas"); cv.width = cv.height = S;
  const ctx = cv.getContext("2d");
  ctx.translate(S / 2, S / 2); ctx.rotate(rotate);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const lines = String(text).split("\n");
  const fs = Math.floor((S * sizeFactor) / (lines.length > 1 ? 1.5 : 1));
  ctx.font = `${weight} ${fs}px Arial, Helvetica, sans-serif`;
  const lh = fs * 1.04;
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    // soft emboss: light highlight under dark fill
    ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fillText(ln, 0, y + 1.5);
    ctx.fillStyle = color; ctx.fillText(ln, 0, y);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

export class PillField {
  constructor() {
    // ONE offscreen WebGL renderer shared by every pill; we blit its output
    // into each pill's own 2D <canvas> (which lives in the DOM and scrolls
    // perfectly with its card — no fixed-overlay desync).
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.dpr = Math.min(window.devicePixelRatio, 2);
    r.setPixelRatio(this.dpr);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.localClippingEnabled = true;
    r.autoClear = false;
    this.BUF = 360; // fixed shared buffer (CSS px); we render each pill into a region
    r.setSize(this.BUF, this.BUF, false);
    this.renderer = r;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.45); fill.position.set(-4, 2, -2); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd9ff, 0.55); rim.position.set(0, -2, -4); this.scene.add(rim);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    this.pills = new Map();
    this.clock = new THREE.Clock();
    this._raf = requestAnimationFrame(() => this._tick());
  }

  setClipElement() {} // no-op (kept for API compatibility)

  add(id, opts) {
    const group = new THREE.Group();       // outer: fixed 3/4 tilt for depth
    const spinner = new THREE.Group();      // inner: spins around the pill's symmetry axis
    group.add(spinner);
    group.visible = false;
    const isCap = opts.geo === "capsule";
    // original turntable spin: rotate around the vertical (Y) axis, no tilt
    group.rotation.set(0, 0, 0);
    const rec = {
      ...opts, group, spinner, ctx: opts.canvas.getContext("2d"),
      fillState: 0, dirty: true, lastTarget: 0,
      spinAxis: "y",
      fitR: isCap ? 1.5 : 0.72,      // bounding radius for camera framing
    };
    rec.fillState = opts.getFill();
    rec.lastTarget = opts.getFill();
    if (isCap) this._buildCapsule(rec); else this._buildTablet(rec);
    this.scene.add(group);
    this.pills.set(id, rec);
  }

  remove(id) {
    const rec = this.pills.get(id);
    if (!rec) return;
    this.scene.remove(rec.group);
    rec.group.traverse((o) => {
      if (o.isMesh) { o.geometry?.dispose(); const m = o.material; Array.isArray(m) ? m.forEach((x) => x.dispose()) : m?.dispose(); }
    });
    this.pills.delete(id);
  }

  setColor(id, color) {
    const rec = this.pills.get(id);
    if (!rec) return;
    if (rec.geo === "capsule" && rec.liquidShader) {
      rec.liquidShader.uniforms.uPrimary.value.set(color.primary);
      rec.liquidShader.uniforms.uSecondary.value.set(color.secondary ?? color.primary);
    } else if (rec.matte) {
      rec.matte.color.set(color.primary);
    }
    rec.dirty = true;
  }

  burst(id) {
    const rec = this.pills.get(id);
    if (rec) { rec.burstStart = performance.now(); rec.dirty = true; }
  }

  _buildCapsule(rec) {
    const fillUniform = { value: rec.fillState };
    const liquid = new THREE.MeshPhysicalMaterial({ roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.18, envMapIntensity: 0.7 });
    liquid.onBeforeCompile = (shader) => {
      shader.uniforms.uFill = fillUniform;
      shader.uniforms.uFillHalf = { value: LIQUID_HALF_AXIS };
      shader.uniforms.uPrimary = { value: new THREE.Color(rec.color.primary) };
      shader.uniforms.uSecondary = { value: new THREE.Color(rec.color.secondary ?? rec.color.primary) };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLocalPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalPos = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
varying vec3 vLocalPos;
uniform float uFill; uniform float uFillHalf; uniform vec3 uPrimary; uniform vec3 uSecondary;`)
        .replace("void main() {", `void main() {
  float fillLine = mix(-uFillHalf, uFillHalf, uFill);
  if (vLocalPos.y > fillLine) discard;`)
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec3 _baseColor = vLocalPos.y > 0.0 ? uSecondary : uPrimary;
vec4 diffuseColor = vec4(_baseColor, opacity);`);
      rec.liquidShader = shader;
    };
    const glass = this._glass();
    const liquidMesh = new THREE.Mesh(new THREE.CapsuleGeometry(LIQUID_RADIUS, LIQUID_LENGTH, 40, 80), liquid);
    liquidMesh.rotation.set(0, Math.PI, Math.PI / 2); liquidMesh.renderOrder = 1;
    const glassMesh = new THREE.Mesh(new THREE.CapsuleGeometry(PILL_RADIUS, PILL_LENGTH, 48, 96), glass);
    glassMesh.rotation.set(0, Math.PI, Math.PI / 2); glassMesh.renderOrder = 2;
    rec.spinner.add(liquidMesh, glassMesh);
    rec.fillUniform = fillUniform;
    rec.capGlass = glass;

    if (rec.imprint) {
      const tex = makeLabelTexture(rec.imprint, { rotate: Math.PI / 2, color: "rgba(70,55,60,0.5)", sizeFactor: 0.52 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      plane.position.set(0.46, 0, 0.5); // on the light (secondary) half, front surface
      plane.renderOrder = 1.6;
      rec.spinner.add(plane);
    }
  }

  _buildTablet(rec) {
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0),
      TABLET_FILL_MIN + (TABLET_FILL_MAX - TABLET_FILL_MIN) * rec.fillState);
    const matte = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(rec.color.primary), roughness: 0.92, metalness: 0,
      clearcoat: 0.08, clearcoatRoughness: 0.7, envMapIntensity: 0.35,
      sheen: 0.25, sheenRoughness: 0.95, sheenColor: new THREE.Color(0xe8def5),
      clippingPlanes: [clipPlane], side: THREE.DoubleSide,
    });
    const glass = this._glass();
    const matteMesh = new THREE.Mesh(new THREE.CylinderGeometry(TABLET_RADIUS * 0.95, TABLET_RADIUS * 0.95, TABLET_THICKNESS * 0.92, 96, 1, false), matte);
    matteMesh.rotation.set(Math.PI / 2, 0, 0); matteMesh.renderOrder = 1;
    const glassMesh = new THREE.Mesh(new THREE.CylinderGeometry(TABLET_RADIUS, TABLET_RADIUS, TABLET_THICKNESS, 96, 1, false), glass);
    glassMesh.rotation.set(Math.PI / 2, 0, 0); glassMesh.renderOrder = 2;
    rec.spinner.add(matteMesh, glassMesh);
    rec.clipPlane = clipPlane; rec.matte = matte; rec.tabletGlass = glass;

    if (rec.imprint) {
      const tex = makeLabelTexture(rec.imprint, { color: "rgba(60,46,68,0.5)", sizeFactor: 0.5 });
      const mk = () => new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      const front = mk(); front.position.set(0, 0, 0.176); front.renderOrder = 1.6;
      const back = mk(); back.position.set(0, 0, -0.176); back.rotation.y = Math.PI; back.renderOrder = 1.6;
      rec.spinner.add(front, back);
    }
  }

  _glass() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.14, metalness: 0, transmission: 0.86,
      thickness: 0.5, ior: 1.4, attenuationDistance: 4.0, clearcoat: 1.0,
      clearcoatRoughness: 0.06, envMapIntensity: 1.25, transparent: true, side: THREE.DoubleSide,
    });
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05); // clamp dt so a dropped frame can't jump the spin
    const r = this.renderer;
    const vh = window.innerHeight, vw = window.innerWidth;
    const fovTan = Math.tan((this.camera.fov * Math.PI / 180) / 2);

    for (const rec of this.pills.values()) {
      const cv = rec.canvas;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) continue;

      // figure out whether this pill needs a fresh frame at all
      const speed = rec.getSpeed ? rec.getSpeed() : 30;
      const spinning = rec.getSpin() && speed > 0;
      const target = rec.getFill();
      if (rec.lastTarget !== target) { rec.lastTarget = target; rec.dirty = true; }
      const filling = Math.abs(rec.fillState - target) > 0.002;
      const bursting = !!rec.burstStart;
      const active = spinning || filling || bursting || rec.dirty;
      if (!active) continue; // static (taken & settled) pills cost nothing

      // cull pills scrolled offscreen
      const box = cv.getBoundingClientRect();
      if (box.bottom < -40 || box.top > vh + 40 || box.right < -40 || box.left > vw + 40) continue;

      // keep the 2D canvas bitmap matched to its CSS size
      const bw = Math.round(w * this.dpr), bh = Math.round(h * this.dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      // render into the fixed shared buffer (no per-frame resize → smooth spin)
      let pw = w, ph = h;
      if (pw > this.BUF || ph > this.BUF) { const s = this.BUF / Math.max(pw, ph); pw *= s; ph *= s; }

      // spin around the shape's symmetry axis (+ completion burst) → constant silhouette
      let spinDps = spinning ? speed : 0;
      if (rec.burstStart) {
        const t = (performance.now() - rec.burstStart) / 680; // 0..1
        if (t < 1) spinDps += (1 - t) * (1 - t) * 1150; // fast spin, eases out
        else rec.burstStart = 0;
      }
      if (spinDps) rec.spinner.rotation[rec.spinAxis] += (spinDps * Math.PI / 180) * dt;

      // eased fill
      const k = 1 - Math.exp(-dt * 6);
      rec.fillState += (target - rec.fillState) * k;
      if (Math.abs(rec.fillState - target) < 0.002) rec.fillState = target;
      const f = rec.fillState;
      if (rec.geo === "capsule") {
        if (rec.fillUniform) rec.fillUniform.value = f;
        // empty = frosted translucent shell; full = thin glossy clear coat so the
        // opaque liquid reads as a SOLID colored pill (no ghosting)
        if (rec.capGlass) {
          rec.capGlass.roughness = 0.16 * (1 - f) + 0.03 * f;
          rec.capGlass.thickness = 0.5 * (1 - f) + 0.08 * f;
          rec.capGlass.transmission = 0.84 * (1 - f) + 1.0 * f; // clear glossy coat when full → liquid reads solid
          rec.capGlass.envMapIntensity = 1.25;
        }
      } else if (rec.clipPlane) {
        rec.clipPlane.constant = TABLET_FILL_MIN + (TABLET_FILL_MAX - TABLET_FILL_MIN) * f;
        rec.tabletGlass.opacity = smoothstep(1 - f, 0, 0.25); // glass vanishes → solid matte tablet
      }

      // frame the pill's bounding sphere so it never clips and never appears to
      // shrink as it spins (silhouette is constant now)
      const aspect = pw / ph;
      const R = rec.fitR, margin = 1.16;
      const dist = Math.max(R / fovTan, R / (fovTan * aspect)) * margin + R;
      this.camera.aspect = aspect;
      this.camera.position.set(0, 0.1, dist);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateProjectionMatrix();

      // render this pill into the top-left region of the shared buffer
      r.setViewport(0, this.BUF - ph, pw, ph);
      r.setScissor(0, this.BUF - ph, pw, ph);
      r.setScissorTest(true);
      r.clear();
      rec.group.visible = true;
      r.render(this.scene, this.camera);
      rec.group.visible = false;

      // blit the rendered region into this pill's own canvas
      const sw = Math.round(pw * this.dpr), sh = Math.round(ph * this.dpr);
      rec.ctx.clearRect(0, 0, bw, bh);
      rec.ctx.drawImage(r.domElement, 0, 0, sw, sh, 0, 0, bw, bh);

      // settled & not spinning → mark static so we stop re-rendering it
      if (!spinning && !bursting && rec.fillState === target) rec.dirty = false;
    }
    this._raf = requestAnimationFrame(() => this._tick());
  }
}
