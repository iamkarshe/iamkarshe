import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#systems-canvas");
const widget = document.querySelector(".widget");
const labelLayer = document.querySelector("#node-labels");
const panel = document.querySelector("#node-panel");
const panelIndex = document.querySelector("#panel-index");
const panelTitle = document.querySelector("#panel-title");
const panelCopy = document.querySelector("#panel-copy");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070d, 0.045);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
camera.position.set(1.7, 2.2, 14);

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
controls.minDistance = 8;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.72;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.target.set(1.7, 0, 0);

const CYAN = new THREE.Color(0x00c8ff);
const RED = new THREE.Color(0xff2a4f);
const DARK = new THREE.Color(0x111827);

scene.add(new THREE.AmbientLight(0x29415f, 1.5));

const cyanLight = new THREE.PointLight(CYAN, 34, 24);
cyanLight.position.set(-6, 4, 6);
scene.add(cyanLight);

const redLight = new THREE.PointLight(RED, 30, 24);
redLight.position.set(7, -2, 5);
scene.add(redLight);

const systemNodes = [
  {
    id: "NODE_01",
    title: "Embedded edge",
    short: "CHIP / ECU",
    tone: "cyan",
    position: [-4.8, -1.6, 0.4],
    copy: "Embedded C/C++ at the constrained edge, where reliability, timing, and security boundaries begin.",
  },
  {
    id: "NODE_02",
    title: "Vehicle trust",
    short: "SDV / TRUST",
    tone: "red",
    position: [-1.7, 1.6, 0],
    copy: "Automotive cybersecurity across connected mobility, SDV interfaces, validation, and compliance-aware design.",
  },
  {
    id: "NODE_03",
    title: "Secure telemetry",
    short: "SIGNAL / LOG",
    tone: "cyan",
    position: [1.4, -1.1, 0.6],
    copy: "Detection-ready signals shaped through reliable ingestion, normalization, and traceability.",
  },
  {
    id: "NODE_04",
    title: "SIEM operations",
    short: "SIEM / SOC",
    tone: "red",
    position: [4.3, 1.35, 0],
    copy: "Security pipelines built for analyst workflows, auditability, and faster incident decisions.",
  },
  {
    id: "NODE_05",
    title: "AI intelligence",
    short: "AI / DECISION",
    tone: "cyan",
    position: [7.0, -0.6, 0.2],
    copy: "AI workflows that enrich, triage, and prioritize alerts — reducing analyst load without adding noise.",
  },
];

const nodeMeshes = [];
const labelElements = [];
const nodeGroup = new THREE.Group();
scene.add(nodeGroup);

const coreGeometry = new THREE.IcosahedronGeometry(0.46, 1);
const shellGeometry = new THREE.IcosahedronGeometry(0.7, 1);

systemNodes.forEach((node, index) => {
  const color = node.tone === "cyan" ? CYAN : RED;
  const group = new THREE.Group();
  group.position.set(...node.position);

  const core = new THREE.Mesh(
    coreGeometry,
    new THREE.MeshStandardMaterial({
      color: DARK,
      emissive: color,
      emissiveIntensity: 0.75,
      metalness: 0.65,
      roughness: 0.22,
    }),
  );
  core.userData.nodeIndex = index;
  group.add(core);
  nodeMeshes.push(core);

  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(shellGeometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.48 }),
  );
  shell.userData.spin = index % 2 === 0 ? 1 : -1;
  group.add(shell);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.88, 0.012, 8, 72),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42 }),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.rotation.y = index * 0.3;
  group.add(ring);

  nodeGroup.add(group);

  const label = document.createElement("span");
  label.className = "node-label";
  label.dataset.tone = node.tone;
  label.textContent = `${node.id} · ${node.short}`;
  labelLayer.append(label);
  labelElements.push({ element: label, group });
});

const curves = [];
const packets = [];

for (let index = 0; index < systemNodes.length - 1; index += 1) {
  const from = new THREE.Vector3(...systemNodes[index].position);
  const to = new THREE.Vector3(...systemNodes[index + 1].position);
  const midpoint = from.clone().lerp(to, 0.5);
  midpoint.z += index % 2 === 0 ? -1.4 : 1.4;

  const curve = new THREE.CatmullRomCurve3([from, midpoint, to]);
  curves.push(curve);

  const points = curve.getPoints(80);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const colors = [];
  points.forEach((_, pointIndex) => {
    const mixed = CYAN.clone().lerp(RED, pointIndex / (points.length - 1));
    colors.push(mixed.r, mixed.g, mixed.b);
  });
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const path = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42 }),
  );
  scene.add(path);

  const packet = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 10),
    new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? CYAN : RED }),
  );
  packet.userData.offset = index / curves.length;
  scene.add(packet);
  packets.push(packet);
}

const grid = new THREE.GridHelper(34, 34, 0x12334c, 0x101c2b);
grid.position.y = -3.8;
grid.material.transparent = true;
grid.material.opacity = 0.24;
scene.add(grid);

const starCount = window.matchMedia("(max-width: 560px)").matches ? 380 : 780;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);

for (let index = 0; index < starCount; index += 1) {
  const stride = index * 3;
  starPositions[stride] = (Math.random() - 0.5) * 32;
  starPositions[stride + 1] = (Math.random() - 0.5) * 18;
  starPositions[stride + 2] = (Math.random() - 0.5) * 14 - 3;
  const color = Math.random() > 0.56 ? CYAN : RED;
  starColors[stride] = color.r;
  starColors[stride + 1] = color.g;
  starColors[stride + 2] = color.b;
}

const starsGeometry = new THREE.BufferGeometry();
starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
starsGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

const stars = new THREE.Points(
  starsGeometry,
  new THREE.PointsMaterial({ size: 0.032, vertexColors: true, transparent: true, opacity: 0.7 }),
);
scene.add(stars);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(2, 2);
let selectedMesh = null;

function setPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
}

function showNode(index) {
  const node = systemNodes[index];
  if (!node) return;

  if (selectedMesh) selectedMesh.scale.setScalar(1);
  selectedMesh = nodeMeshes[index];
  selectedMesh.scale.setScalar(1.28);

  panelIndex.textContent = node.id;
  panelTitle.textContent = node.title;
  panelCopy.textContent = node.copy;
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
  if (hit) showNode(hit.object.userData.nodeIndex);
});

function resize() {
  const width = widget.clientWidth;
  const height = widget.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function updateLabels() {
  const width = widget.clientWidth;
  const height = widget.clientHeight;

  labelElements.forEach(({ element, group }) => {
    const projected = group.position.clone().project(camera);
    const isVisible = projected.z < 1;
    element.style.display = isVisible ? "block" : "none";
    element.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    element.style.top = `${(-projected.y * 0.5 + 0.5) * height - 46}px`;
  });
}

const clock = new THREE.Clock();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animate() {
  const elapsed = clock.getElapsedTime();

  if (!reducedMotion) {
    stars.rotation.y = elapsed * 0.008;
    nodeGroup.children.forEach((group, index) => {
      group.rotation.y += 0.0025 * group.children[1].userData.spin;
      group.position.y = systemNodes[index].position[1] + Math.sin(elapsed * 0.8 + index) * 0.08;
    });
    packets.forEach((packet, index) => {
      const progress = (elapsed * 0.11 + packet.userData.offset) % 1;
      packet.position.copy(curves[index].getPoint(progress));
    });
  }

  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

new ResizeObserver(resize).observe(widget);
resize();
animate();

const terminalToggle = document.querySelector("#terminal-toggle");
const terminalPanel = document.querySelector("#terminal-panel");
const terminalClose = document.querySelector("#terminal-close");
const terminalOutput = document.querySelector("#terminal-output");
const terminalForm = document.querySelector("#terminal-form");
const terminalInput = document.querySelector("#terminal-input");

const commandResponses = {
  help: [
    "AVAILABLE_COMMANDS",
    "  focus      active engineering focus",
    "  systems    systems previously shaped",
    "  stack      core working toolkit",
    "  contact    collaboration channels",
    "  clear      clear this console",
  ],
  focus: [
    "CURRENT_FOCUS",
    "  01  Automotive cybersecurity + SDV",
    "  02  Embedded C / C++",
    "  03  SIEM logging + detection-ready data",
    "  04  AI-assisted security operations",
  ],
  systems: [
    "SYSTEMS_SHAPED",
    "  Enterprise  demand forecasting · SLA control towers · fleet optimization",
    "  Warehouse   mobile automation workflows",
    "  Digital     e-commerce · OTS · rank prediction",
    "  Status      active under team ownership; mentored + guided",
  ],
  stack: [
    "WORKING_STACK",
    "  Core        C · C++ · Python · Linux",
    "  Platform    Docker · PostgreSQL · Redis · AWS",
  ],
  contact: [
    "CONTACT",
    "  LinkedIn    linkedin.com/in/karshe",
    "  Website     karshe.in",
    "  Email       utkarsh2point0@gmail.com",
  ],
};

function appendTerminalLine(content, className = "") {
  const line = document.createElement("p");
  line.className = className;
  line.textContent = content;
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function runCommand(rawCommand) {
  const command = rawCommand.trim().toLowerCase();
  if (!command) return;

  appendTerminalLine(`~$ ${command}`, "command");

  if (command === "clear") {
    terminalOutput.replaceChildren();
    return;
  }

  const response = commandResponses[command];
  if (!response) {
    appendTerminalLine(`Command not found: ${command}. Type "help".`, "red");
    return;
  }

  response.forEach((line, index) => appendTerminalLine(line, index === 0 ? "cyan" : ""));
}

function openTerminal() {
  terminalPanel.hidden = false;
  terminalToggle.setAttribute("aria-expanded", "true");
  terminalInput.focus({ preventScroll: true });
}

function closeTerminal() {
  terminalPanel.hidden = true;
  terminalToggle.setAttribute("aria-expanded", "false");
}

terminalToggle.addEventListener("click", () => {
  if (terminalPanel.hidden) openTerminal();
  else closeTerminal();
});

terminalClose.addEventListener("click", closeTerminal);

terminalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runCommand(terminalInput.value);
  terminalInput.value = "";
});
