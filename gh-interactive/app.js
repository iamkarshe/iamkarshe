import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const widget = document.querySelector(".widget");
const labelLayer = document.querySelector("#labels");
const logBody = document.querySelector("#log-body");
const panel = document.querySelector("#panel");
const panelKicker = document.querySelector("#panel-kicker");
const panelTitle = document.querySelector("#panel-title");
const panelRole = document.querySelector("#panel-role");
const panelCopy = document.querySelector("#panel-copy");
const panelClose = document.querySelector("#panel-close");

const CYAN = new THREE.Color(0x00c8ff);
const RED = new THREE.Color(0xff2a4f);
const AMBER = new THREE.Color(0xffb020);

/* ---------------------------------------------------------------
   Architecture model — three tiers stacked in real vertical depth.
   Signals originate in the vehicle and rise to the SOC.
---------------------------------------------------------------- */

const TIERS = [
  { id: "vehicle", label: "IN-VEHICLE", y: -3.4, half: 6.4, depth: 3.6, tone: 0x0f3346 },
  { id: "transport", label: "TRANSPORT", y: 0.5, half: 4.6, depth: 2.8, tone: 0x123047 },
  { id: "cloud", label: "CLOUD / SOC", y: 4.4, half: 6.4, depth: 2.4, tone: 0x3a1424 },
];

const NODES = {
  SNS: {
    tier: "vehicle", pos: [-4.6, -1.3], tone: "cyan", label: "SENSORS",
    title: "Sensor cluster", role: "DATA SOURCE",
    copy: "Raw vehicle signals begin here. I care about how this data is timestamped, bounded, and trusted before anything downstream relies on it.",
  },
  ECU: {
    tier: "vehicle", pos: [-4.4, 1.5], tone: "cyan", label: "LEGACY ECU",
    title: "Legacy ECU (UDS)", role: "EMBEDDED C/C++",
    copy: "Classic diagnostic services on constrained hardware. Embedded C/C++ work where timing, memory, and failure behaviour are design constraints rather than afterthoughts.",
  },
  OBD: {
    tier: "vehicle", pos: [-1.4, 2.6], tone: "red", label: "OBD / DIAG",
    title: "OBD / diagnostic port", role: "ATTACK SURFACE",
    copy: "Physical diagnostic access is a high-value entry point. It needs authentication, least privilege, vehicle-state rules, and logging — not open access because it is 'internal'.",
  },
  ZGW: {
    tier: "vehicle", pos: [-1.5, 0], tone: "cyan", label: "ZONAL GATEWAY",
    title: "Zonal gateway", role: "SEGMENTATION",
    copy: "Where segmentation is enforced between domains. Routing decisions here decide whether a compromised node stays contained or spreads.",
  },
  HPC: {
    tier: "vehicle", pos: [1.8, 0], tone: "cyan", label: "HPC / DOMAIN",
    title: "HPC / domain controller", role: "SDV COMPUTE",
    copy: "The software-defined vehicle compute layer running service-oriented applications. Modern diagnostics (SOVD) and containers live here, so it needs governed interfaces.",
  },
  TCU: {
    tier: "vehicle", pos: [1.4, -2.4], tone: "red", label: "TELEMATICS",
    title: "Telematics unit (TCU)", role: "ATTACK SURFACE",
    copy: "The vehicle's link to the outside world, and therefore remotely reachable. Every exposed service here is threat modelled and rate-limited before it ships.",
  },
  OTA: {
    tier: "transport", pos: [3.0, -1.0], tone: "red", label: "OTA CHANNEL",
    title: "OTA update channel", role: "ATTACK SURFACE",
    copy: "Software delivery is a supply chain into the vehicle. Signing, rollback protection, and update governance decide whether it is an asset or a liability.",
  },
  SGW: {
    tier: "transport", pos: [-0.4, 0], tone: "cyan", label: "SECURE GATEWAY",
    title: "Secure gateway (mTLS / X.509)", role: "TRUST BOUNDARY",
    copy: "Device identity and mutual TLS. Certificates, rotation, and revocation are the difference between trusted telemetry and unverifiable noise.",
  },
  ING: {
    tier: "cloud", pos: [-4.6, 0.2], tone: "cyan", label: "INGESTION",
    title: "Ingestion & normalization", role: "SIEM LOGGING",
    copy: "High-volume ingestion that normalizes messy device signals into detection-ready events, with lineage preserved so findings stay attributable.",
  },
  SIEM: {
    tier: "cloud", pos: [-1.4, 0.2], tone: "red", label: "SIEM CORE",
    title: "SIEM core", role: "DETECTION",
    copy: "Correlation and detection logic over fleet-wide events. Built for auditability, so every alert carries the evidence needed to justify it later.",
  },
  AI: {
    tier: "cloud", pos: [1.8, 0.2], tone: "amber", label: "AI TRIAGE",
    title: "AI triage & enrichment", role: "AI FOR SIEM",
    copy: "Enrichment, correlation, and prioritization that reduce alert volume reaching a human. The aim is fewer, better alerts — never confidence an analyst must disprove.",
  },
  SOC: {
    tier: "cloud", pos: [4.8, 0.2], tone: "red", label: "ANALYST / SOC",
    title: "Analyst decision", role: "GOVERNED RESPONSE",
    copy: "A human owns the outcome, with reasoning traceable back to the originating signal. Findings feed back into detection so the system sharpens over time.",
  },
};

const LINKS = [
  ["SNS", "ZGW"], ["ECU", "ZGW"], ["OBD", "ZGW"],
  ["ZGW", "HPC"], ["TCU", "HPC"], ["OTA", "HPC"],
  ["HPC", "SGW"], ["SGW", "ING"],
  ["ING", "SIEM"], ["SIEM", "AI"], ["AI", "SOC"],
];

const TELEMETRY_ROUTES = [
  ["SNS", "ZGW", "HPC", "SGW", "ING", "SIEM", "AI", "SOC"],
  ["ECU", "ZGW", "HPC", "SGW", "ING", "SIEM", "AI", "SOC"],
  ["TCU", "HPC", "SGW", "ING", "SIEM", "AI", "SOC"],
];

const THREATS = [
  {
    origin: "OBD",
    route: ["OBD", "ZGW", "HPC", "SGW", "ING", "SIEM", "AI", "SOC"],
    detail: "unauthorized UDS session on diagnostic port",
    verdict: "SEVERITY HIGH",
    action: "session blocked, port locked to vehicle state",
  },
  {
    origin: "TCU",
    route: ["TCU", "HPC", "SGW", "ING", "SIEM", "AI", "SOC"],
    detail: "anomalous outbound traffic from telematics unit",
    verdict: "SEVERITY MEDIUM",
    action: "endpoint quarantined, fleet rule deployed",
  },
  {
    origin: "OTA",
    route: ["OTA", "HPC", "SGW", "ING", "SIEM", "AI", "SOC"],
    detail: "update package signature mismatch",
    verdict: "SEVERITY CRITICAL",
    action: "rollout halted, artifact rejected",
  },
];

/* --------------------------- scene setup --------------------------- */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070d, 0.028);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
camera.position.set(11.5, 6.5, 15.5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x05070d, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 13;
controls.maxDistance = 34;
controls.minPolarAngle = Math.PI * 0.12;
controls.maxPolarAngle = Math.PI * 0.62;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.28;
controls.target.set(0, 0.4, 0);

scene.add(new THREE.AmbientLight(0x2b435f, 1.6));

const keyLight = new THREE.PointLight(CYAN, 40, 40);
keyLight.position.set(-9, -2, 7);
scene.add(keyLight);

const rimLight = new THREE.PointLight(RED, 36, 40);
rimLight.position.set(9, 7, 5);
scene.add(rimLight);

/* --------------------------- tier planes --------------------------- */

const tierAnchors = [];

TIERS.forEach((tier) => {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(tier.half * 2, tier.depth * 2),
    new THREE.MeshBasicMaterial({
      color: tier.tone,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = tier.y;
  scene.add(plane);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(tier.half * 2, tier.depth * 2)),
    new THREE.LineBasicMaterial({ color: tier.tone, transparent: true, opacity: 0.75 }),
  );
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = tier.y;
  scene.add(outline);

  const grid = new THREE.GridHelper(tier.half * 2, 12, tier.tone, tier.tone);
  grid.position.y = tier.y + 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  scene.add(grid);

  tierAnchors.push({
    label: tier.label,
    point: new THREE.Vector3(-tier.half - 1.5, tier.y + 0.25, tier.depth * 0.75),
  });
});

/* ----------------------------- nodes ----------------------------- */

const toneColor = { cyan: CYAN, red: RED, amber: AMBER };
const nodeMeshes = [];
const nodeEntries = new Map();

const coreGeometry = new THREE.IcosahedronGeometry(0.32, 1);

Object.entries(NODES).forEach(([id, node]) => {
  const tier = TIERS.find((entry) => entry.id === node.tier);
  const color = toneColor[node.tone];
  const position = new THREE.Vector3(node.pos[0], tier.y + 0.55, node.pos[1]);

  const group = new THREE.Group();
  group.position.copy(position);

  const core = new THREE.Mesh(
    coreGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x0d1622,
      emissive: color,
      emissiveIntensity: 0.7,
      metalness: 0.6,
      roughness: 0.25,
    }),
  );
  core.userData.nodeId = id;
  group.add(core);
  nodeMeshes.push(core);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.54, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  group.add(halo);

  // stem down to its tier plane, so height reads as architecture
  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0, 0, 0),
    ]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 }),
  );
  group.add(stem);

  scene.add(group);

  const element = document.createElement("span");
  element.className = "label";
  element.dataset.tone = node.tone;
  element.textContent = node.label;
  labelLayer.append(element);

  nodeEntries.set(id, { ...node, id, position, group, core, halo, element });
});

/* ----------------------------- links ----------------------------- */

function nodePos(id) {
  return nodeEntries.get(id).position;
}

LINKS.forEach(([from, to]) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([nodePos(from), nodePos(to)]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x3d6182, transparent: true, opacity: 0.45 }),
  );
  scene.add(line);
});

/* ---------------------------- packets ---------------------------- */

function routeCurve(route) {
  return new THREE.CatmullRomCurve3(route.map((id) => nodePos(id).clone()), false, "catmullrom", 0.12);
}

const packets = [];

function spawnPacket({ route, color, size = 0.11, speed = 0.055, onStage, onDone }) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 12, 12),
    new THREE.MeshBasicMaterial({ color }),
  );
  scene.add(mesh);

  const trail = new THREE.Mesh(
    new THREE.SphereGeometry(size * 2.1, 12, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 }),
  );
  scene.add(trail);

  packets.push({
    mesh,
    trail,
    curve: routeCurve(route),
    route,
    progress: 0,
    speed,
    stage: 0,
    onStage,
    onDone,
  });
}

function pulseNode(id, color) {
  const entry = nodeEntries.get(id);
  if (!entry) return;
  entry.pulse = 1;
  if (color) entry.halo.material.color.set(color);
}

/* --------------------------- event log --------------------------- */

let clockStart = Date.now();

function stamp() {
  const seconds = Math.floor((Date.now() - clockStart) / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function log(message, kind = "") {
  const line = document.createElement("p");
  if (kind) line.className = kind;
  const time = document.createElement("span");
  time.className = "t";
  time.textContent = `${stamp()}  `;
  line.append(time, document.createTextNode(message));
  logBody.append(line);

  while (logBody.childElementCount > 6) logBody.firstElementChild.remove();
}

/* ------------------------ traffic simulation ------------------------ */

const TELEMETRY_MESSAGES = [
  "sensor frame batch normalized",
  "CAN signal set forwarded via zonal gateway",
  "diagnostic heartbeat verified",
  "telematics payload signed and queued",
  "fleet telemetry committed to detection index",
];

let telemetryIndex = 0;

function emitTelemetry() {
  const route = TELEMETRY_ROUTES[telemetryIndex % TELEMETRY_ROUTES.length];
  telemetryIndex += 1;

  spawnPacket({
    route,
    color: CYAN,
    speed: 0.05,
    onStage: (id) => pulseNode(id, CYAN),
  });

  if (telemetryIndex % 2 === 0) {
    log(TELEMETRY_MESSAGES[telemetryIndex % TELEMETRY_MESSAGES.length]);
  }
}

let threatIndex = 0;

function emitThreat() {
  const threat = THREATS[threatIndex % THREATS.length];
  threatIndex += 1;

  const originName = NODES[threat.origin].title;
  log(`ANOMALY  ${threat.detail}`, "threat");

  spawnPacket({
    route: threat.route,
    color: RED,
    size: 0.15,
    speed: 0.038,
    onStage: (id) => {
      pulseNode(id, RED);
      if (id === "SGW") log(`identity check on ${originName} traffic`, "threat");
      if (id === "ING") log("event normalized, lineage preserved", "");
      if (id === "SIEM") log("correlation rule matched", "threat");
      if (id === "AI") log(`AI triage  ${threat.verdict}`, "ai");
      if (id === "SOC") log(`analyst decision  ${threat.action}`, "resolve");
    },
    onDone: () => pulseNode("SIEM", CYAN),
  });
}

/* --------------------------- interaction --------------------------- */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(4, 4);
let selectedId = null;

function setPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
}

function selectNode(id) {
  const entry = nodeEntries.get(id);
  if (!entry) return;

  if (selectedId) nodeEntries.get(selectedId).core.scale.setScalar(1);
  selectedId = id;
  entry.core.scale.setScalar(1.5);

  panelKicker.textContent = entry.tier.toUpperCase();
  panelTitle.textContent = entry.title;
  panelRole.textContent = entry.role;
  panelCopy.textContent = entry.copy;
  panel.classList.add("is-open");
  controls.autoRotate = false;
}

canvas.addEventListener("pointermove", (event) => {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  canvas.style.cursor = raycaster.intersectObjects(nodeMeshes).length ? "pointer" : "grab";
});

canvas.addEventListener("click", (event) => {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const [hit] = raycaster.intersectObjects(nodeMeshes);
  if (hit) selectNode(hit.object.userData.nodeId);
});

panelClose.addEventListener("click", () => {
  panel.classList.remove("is-open");
  if (selectedId) nodeEntries.get(selectedId).core.scale.setScalar(1);
  selectedId = null;
  controls.autoRotate = true;
});

/* ----------------------------- loop ----------------------------- */

const tierElements = tierAnchors.map((anchor) => {
  const element = document.createElement("span");
  element.className = "label is-tier";
  element.textContent = anchor.label;
  labelLayer.append(element);
  return { element, point: anchor.point };
});

function project(vector, width, height) {
  const projected = vector.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: projected.z < 1,
  };
}

function resize() {
  const width = widget.clientWidth;
  const height = widget.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

const clock = new THREE.Clock();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let telemetryTimer = 0;
let threatTimer = 7.5;

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();
  const width = widget.clientWidth;
  const height = widget.clientHeight;

  telemetryTimer += delta;
  threatTimer += delta;

  if (telemetryTimer > 1.9) {
    telemetryTimer = 0;
    emitTelemetry();
  }

  if (threatTimer > 11) {
    threatTimer = 0;
    emitThreat();
  }

  for (let index = packets.length - 1; index >= 0; index -= 1) {
    const packet = packets[index];
    packet.progress += packet.speed * delta * 6;

    if (packet.progress >= 1) {
      scene.remove(packet.mesh, packet.trail);
      packet.mesh.geometry.dispose();
      packet.mesh.material.dispose();
      packet.trail.geometry.dispose();
      packet.trail.material.dispose();
      if (packet.onDone) packet.onDone();
      packets.splice(index, 1);
      continue;
    }

    const point = packet.curve.getPoint(packet.progress);
    packet.mesh.position.copy(point);
    packet.trail.position.copy(packet.curve.getPoint(Math.max(0, packet.progress - 0.02)));

    const stageNow = Math.floor(packet.progress * (packet.route.length - 1)) + 1;
    if (stageNow > packet.stage && stageNow < packet.route.length) {
      packet.stage = stageNow;
      if (packet.onStage) packet.onStage(packet.route[stageNow]);
    }
  }

  nodeEntries.forEach((entry) => {
    if (!reducedMotion) {
      entry.group.rotation.y += 0.004;
    }

    if (entry.pulse > 0) {
      entry.pulse = Math.max(0, entry.pulse - delta * 1.6);
      const scale = 1 + entry.pulse * 0.9;
      entry.halo.scale.setScalar(scale);
      entry.halo.material.opacity = 0.5 + entry.pulse * 0.5;
    } else {
      entry.halo.scale.setScalar(1);
      entry.halo.material.opacity = 0.42;
    }

    const screen = project(entry.position, width, height);
    entry.element.style.display = screen.visible ? "block" : "none";
    entry.element.style.left = `${screen.x}px`;
    entry.element.style.top = `${screen.y - 26}px`;
  });

  tierElements.forEach(({ element, point }) => {
    const screen = project(point, width, height);
    element.style.display = screen.visible ? "block" : "none";
    element.style.left = `${screen.x}px`;
    element.style.top = `${screen.y}px`;
  });

  keyLight.intensity = 40 + Math.sin(elapsed * 1.4) * 6;
  rimLight.intensity = 36 + Math.cos(elapsed * 1.1) * 6;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

new ResizeObserver(resize).observe(widget);
resize();

log("pipeline initialized", "resolve");
log("device identity verified via X.509", "");
log("detection rules loaded, fleet baseline active", "");
log("monitoring in-vehicle telemetry", "");
emitTelemetry();

animate();
