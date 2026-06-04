/**
 * LiquidPill — drop-in 3D pill effect for the web.
 *
 * Usage:
 *   import { LiquidPill } from './liquid-pill.js';
 *   const pill = new LiquidPill(document.getElementById('container'), {
 *     pillType: 'capsule',
 *     pillColor: { primary: '#3d1538', secondary: '#ece6da' },
 *     spin: true,
 *     orbitControls: true,
 *     background: 'transparent',
 *     initialFill: 0,
 *     tapToFill: true,
 *     onFillChange: (filled) => console.log(filled),
 *   });
 *
 * Imperative API:
 *   pill.setFill(1);            // 0..1, eased toward target
 *   pill.toggleFill();
 *   pill.setSpin(false);
 *   pill.setPillType('tablet');
 *   pill.setPillColor({ primary: '#a394b8' });
 *   pill.resize();              // call when container size changes (ResizeObserver
 *                                // is wired up automatically, but this is a manual escape)
 *   pill.destroy();             // tear down WebGL + listeners
 *
 * Requires three.js (>= r166) available via your bundler/importmap. See demo.html.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const DEFAULTS = {
  pillType: "capsule",
  pillColor: { primary: "#3d1538", secondary: "#ece6da" },
  spin: true,
  spinSpeed: 30,
  orbitControls: true,
  background: "transparent",
  initialFill: 0,
  tapToFill: true,
  onFillChange: null,
  imprint: null,
};

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
    ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fillText(ln, 0, y + 1.5);
    ctx.fillStyle = color; ctx.fillText(ln, 0, y);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

// Geometry constants shared with the original HTML effect.
const PILL_RADIUS = 0.55;
const PILL_LENGTH = 1.7;
const LIQUID_RADIUS = PILL_RADIUS * 0.93;
const LIQUID_LENGTH = PILL_LENGTH * 0.95;
const LIQUID_HALF_AXIS = LIQUID_LENGTH / 2 + LIQUID_RADIUS;

const TABLET_RADIUS = 0.55;
const TABLET_THICKNESS = 0.34;
const TABLET_FILL_MIN = -TABLET_RADIUS - 0.08;
const TABLET_FILL_MAX = TABLET_RADIUS + 0.08;

export class LiquidPill {
  constructor(container, options = {}) {
    if (!container) throw new Error("LiquidPill: container is required");
    this.container = container;
    this.opts = { ...DEFAULTS, ...options };
    this.fillTarget = clamp01(this.opts.initialFill);
    this.fillState = this.fillTarget;
    this._disposed = false;

    this._setupRenderer();
    this._setupScene();
    this._setupLights();
    this._buildPill();
    this._setupControls();
    this._setupTaps();
    this._setupResize();
    this._startLoop();
  }

  // -------- public API --------

  setFill(value) {
    const next = clamp01(value);
    this.fillTarget = next;
    this.opts.onFillChange?.(next);
  }

  toggleFill() {
    this.setFill(this.fillTarget > 0.5 ? 0 : 1);
  }

  setSpin(spinning) {
    this.opts.spin = !!spinning;
  }

  setPillType(pillType) {
    if (pillType !== "capsule" && pillType !== "tablet") return;
    if (pillType === this.opts.pillType) return;
    this.opts.pillType = pillType;
    this._rebuildPill();
  }

  setPillColor(pillColor) {
    this.opts.pillColor = { ...this.opts.pillColor, ...pillColor };
    this._applyPillColor();
  }

  resize() {
    this._handleResize();
  }

  destroy() {
    if (this._disposed) return;
    this._disposed = true;
    cancelAnimationFrame(this._raf);
    this._resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this._onDown);
    this.renderer.domElement.removeEventListener("pointerup", this._onUp);
    this._disposePill();
    this.controls?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // -------- setup --------

  _setupRenderer() {
    const { width, height } = this._size();
    const alpha = this.opts.background === "transparent";
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    if (!alpha) this.renderer.setClearColor(new THREE.Color(this.opts.background), 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;

    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.container.appendChild(canvas);
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    if (this.opts.background !== "transparent") {
      this.scene.background = new THREE.Color(this.opts.background);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const { width, height } = this._size();
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    this.camera.position.set(0, 0.3, 4.6);
    this.camera.lookAt(0, 0, 0);
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.45);
    fill.position.set(-4, 2, -2);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd9ff, 0.55);
    rim.position.set(0, -2, -4);
    this.scene.add(rim);
  }

  _buildPill() {
    this.pillGroup = new THREE.Group();
    this.scene.add(this.pillGroup);

    if (this.opts.pillType === "capsule") {
      this._buildCapsule();
    } else {
      this._buildTablet();
    }
  }

  _rebuildPill() {
    this._disposePill();
    this.scene.remove(this.pillGroup);
    this._buildPill();
  }

  _disposePill() {
    if (!this.pillGroup) return;
    this.pillGroup.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    this.tabletClipPlane = null;
    this.glassMaterial = null;
    this.liquidMaterial = null;
    this.tabletMatteMaterial = null;
    this.tabletGlassMaterial = null;
    this.fillUniform = null;
  }

  _buildCapsule() {
    const fillUniform = { value: this.fillState };

    const liquid = new THREE.MeshPhysicalMaterial({
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.7,
    });
    liquid.onBeforeCompile = (shader) => {
      shader.uniforms.uFill = fillUniform;
      shader.uniforms.uFillHalf = { value: LIQUID_HALF_AXIS };
      shader.uniforms.uPrimary = {
        value: new THREE.Color(this.opts.pillColor.primary),
      };
      shader.uniforms.uSecondary = {
        value: new THREE.Color(
          this.opts.pillColor.secondary ?? this.opts.pillColor.primary,
        ),
      };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>\nvarying vec3 vLocalPos;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\nvLocalPos = position;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vLocalPos;
uniform float uFill;
uniform float uFillHalf;
uniform vec3 uPrimary;
uniform vec3 uSecondary;`,
        )
        .replace(
          "void main() {",
          `void main() {
  float fillLine = mix(-uFillHalf, uFillHalf, uFill);
  if (vLocalPos.y > fillLine) discard;`,
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec3 _baseColor = vLocalPos.y > 0.0 ? uSecondary : uPrimary;
vec4 diffuseColor = vec4(_baseColor, opacity);`,
        );
      liquid.userData.shader = shader;
    };

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.14,
      metalness: 0,
      transmission: 0.86,
      thickness: 0.5,
      ior: 1.4,
      attenuationDistance: 4.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const liquidMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(LIQUID_RADIUS, LIQUID_LENGTH, 40, 80),
      liquid,
    );
    liquidMesh.rotation.set(0, Math.PI, Math.PI / 2);
    liquidMesh.renderOrder = 1;

    const glassMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(PILL_RADIUS, PILL_LENGTH, 48, 96),
      glass,
    );
    glassMesh.rotation.set(0, Math.PI, Math.PI / 2);
    glassMesh.renderOrder = 2;

    this.pillGroup.add(liquidMesh, glassMesh);
    this.tapMeshes = [liquidMesh, glassMesh];
    this.fillUniform = fillUniform;
    this.glassMaterial = glass;
    this.liquidMaterial = liquid;

    if (this.opts.imprint) {
      const tex = makeLabelTexture(this.opts.imprint, { rotate: Math.PI / 2, color: "rgba(70,55,60,0.5)", sizeFactor: 0.52 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      plane.position.set(0.46, 0, 0.5);
      plane.renderOrder = 1.6;
      this.pillGroup.add(plane);
    }
  }

  _buildTablet() {
    const clipPlane = new THREE.Plane(
      new THREE.Vector3(0, -1, 0),
      TABLET_FILL_MIN +
        (TABLET_FILL_MAX - TABLET_FILL_MIN) * this.fillState,
    );

    const matte = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.opts.pillColor.primary),
      roughness: 0.92,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
      envMapIntensity: 0.35,
      sheen: 0.25,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color(0xe8def5),
      clippingPlanes: [clipPlane],
      side: THREE.DoubleSide,
    });

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.14,
      metalness: 0,
      transmission: 0.86,
      thickness: 0.5,
      ior: 1.4,
      attenuationDistance: 4.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    const matteMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        TABLET_RADIUS * 0.95,
        TABLET_RADIUS * 0.95,
        TABLET_THICKNESS * 0.92,
        96,
        1,
        false,
      ),
      matte,
    );
    matteMesh.rotation.set(Math.PI / 2, 0, 0);
    matteMesh.renderOrder = 1;

    const glassMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        TABLET_RADIUS,
        TABLET_RADIUS,
        TABLET_THICKNESS,
        96,
        1,
        false,
      ),
      glass,
    );
    glassMesh.rotation.set(Math.PI / 2, 0, 0);
    glassMesh.renderOrder = 2;

    this.pillGroup.add(matteMesh, glassMesh);
    this.tapMeshes = [matteMesh, glassMesh];
    this.tabletClipPlane = clipPlane;
    this.tabletMatteMaterial = matte;
    this.tabletGlassMaterial = glass;

    if (this.opts.imprint) {
      const tex = makeLabelTexture(this.opts.imprint, { color: "rgba(60,46,68,0.5)", sizeFactor: 0.5 });
      const mk = () => new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      const front = mk(); front.position.set(0, 0, 0.176); front.renderOrder = 1.6;
      const back = mk(); back.position.set(0, 0, -0.176); back.rotation.y = Math.PI; back.renderOrder = 1.6;
      this.pillGroup.add(front, back);
    }
  }

  _applyPillColor() {
    if (this.opts.pillType === "capsule" && this.liquidMaterial?.userData.shader) {
      const sh = this.liquidMaterial.userData.shader;
      sh.uniforms.uPrimary.value.set(this.opts.pillColor.primary);
      sh.uniforms.uSecondary.value.set(
        this.opts.pillColor.secondary ?? this.opts.pillColor.primary,
      );
    } else if (this.opts.pillType === "tablet" && this.tabletMatteMaterial) {
      this.tabletMatteMaterial.color.set(this.opts.pillColor.primary);
    }
  }

  _setupControls() {
    if (!this.opts.orbitControls) return;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 12;
    this.controls.target.set(0, 0, 0);
  }

  _setupTaps() {
    if (!this.opts.tapToFill) return;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._pressOrigin = { x: 0, y: 0 };
    this._pressed = false;
    this._onDown = (e) => {
      this._pressed = true;
      this._pressOrigin.x = e.clientX;
      this._pressOrigin.y = e.clientY;
    };
    this._onUp = (e) => {
      if (!this._pressed) return;
      this._pressed = false;
      const dx = e.clientX - this._pressOrigin.x;
      const dy = e.clientY - this._pressOrigin.y;
      if (Math.hypot(dx, dy) > 6) return; // drag, not tap
      const rect = this.renderer.domElement.getBoundingClientRect();
      this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this._raycaster.intersectObjects(this.tapMeshes, false);
      if (hits.length > 0) this.toggleFill();
    };
    this.renderer.domElement.addEventListener("pointerdown", this._onDown);
    this.renderer.domElement.addEventListener("pointerup", this._onUp);
  }

  _setupResize() {
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(this.container);
  }

  _size() {
    const rect = this.container.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)) || 1,
      height: Math.max(1, Math.floor(rect.height)) || 1,
    };
  }

  _handleResize() {
    const { width, height } = this._size();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  _startLoop() {
    this._clock = new THREE.Clock();
    const tick = () => {
      if (this._disposed) return;
      const dt = this._clock.getDelta();

      if (this.opts.spin && this.pillGroup) {
        this.pillGroup.rotation.y += (this.opts.spinSpeed * Math.PI) / 180 * dt;
      }

      // Eased fill state.
      const k = 1 - Math.exp(-dt * 6);
      this.fillState += (this.fillTarget - this.fillState) * k;
      if (Math.abs(this.fillState - this.fillTarget) < 0.001) {
        this.fillState = this.fillTarget;
      }

      if (this.opts.pillType === "capsule" && this.fillUniform) {
        this.fillUniform.value = this.fillState;
      } else if (this.opts.pillType === "tablet" && this.tabletClipPlane) {
        this.tabletClipPlane.constant =
          TABLET_FILL_MIN +
          (TABLET_FILL_MAX - TABLET_FILL_MIN) * this.fillState;
        this.tabletGlassMaterial.opacity = smoothstep(
          1 - this.fillState,
          0,
          0.25,
        );
      }

      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(x, edge0, edge1) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
