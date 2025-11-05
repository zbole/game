// improved FPS game with creative targets, near‑miss detection, lighting, scenery, and scoreboard
let camera, scene, renderer;
let yawObject, pitchObject;
const objects = [];
const targetVelocities = [];
const targetRotationSpeeds = [];

// Arrays for power-ups and their velocities. Power-ups provide bonus points and spawn extra targets when shot.
const powerUps = [];
const powerUpVelocities = [];
// Array to store active projectiles (small balls) fired by the player
const projectiles = [];
// Arrays for special star collectibles and their velocities. Stars grant bonus points and temporarily increase projectile speed.
const stars = [];
const starVelocities = [];
// Arrays for mountains and clouds used to beautify the environment.
const mountains = [];
const clouds = [];
const cloudVelocities = [];
// Decorative props placed around the arena (rocks, crates, etc.)
const decorations = [];
// Objects for the player's gun; gun meshes will be attached to the camera so it moves with the player.
let gun;
let gunBarrel;
let gunBody;
// Store gun parts to allow recoloring and customization on-the-fly.
const gunParts = [];
// Index into the gunColorPalette for cycling weapon colours.
let gunColorIndex = 0;
// Palette of colours to cycle through when the player presses a key to change weapon appearance.
const gunColorPalette = [0x333333, 0x444444, 0x555555, 0x888888, 0xff9933];

// Crosshair colour palette and index.  Cycling crosshair colours on command adds a bit of customisation.
const crosshairColors = ['#ffffff', '#ff0000', '#00ff00', '#00aaff', '#ffff00'];
let crosshairColorIndex = 0;
// Zoom state and parameters. Right‑click toggles aiming down sights by changing the camera FOV.
let isZoomed = false;
const normalFov = 75;
const zoomFov = 35;
// Running multiplier (hold Shift to run) and bobbing timer for subtle weapon sway while moving.
let runMultiplier = 1;
let bobbingTime = 0;
// Variables for movement mechanics and action cooldowns
// Allows the player to perform a double jump.  jumpCount tracks the current number of jumps
// executed without touching the ground, and maxJumps sets the limit (two jumps total).
let jumpCount = 0;
const maxJumps = 2;
// Indicates whether the player is crouching.  When crouched the player moves slower and
// the camera height is lowered.
let isCrouching = false;
// Tracks the timestamp of the last dash action and defines cooldown and distance for dashes (in milliseconds).
let lastDashTime = 0;
const dashCooldown = 500; // milliseconds
const dashDistance = 50; // units to dash
// Note: duplicate declarations of jumpCount, isCrouching, lastDashTime and dashCooldown below were
// removed when merging features.  See the primary declarations above for definitions.
// Multiplier for projectile speed and the number of boosted shots remaining. When shotsBoosted > 0
// each new projectile's speed will be multiplied by projectileSpeedMultiplier and
// shotsBoosted will decrement after each shot.
let projectileSpeedMultiplier = 1;
let shotsBoosted = 0;
let raycaster;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
let canJump = false;
let isLocked = false;
let score = 0;
let scoreboard;
const worldSize = 800;

function init() {
    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
    pitchObject = new THREE.Object3D();
    pitchObject.add(camera);
    yawObject = new THREE.Object3D();
    yawObject.position.y = 10;
    yawObject.add(pitchObject);

    // Scene and background
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080);
    // Add light fog for atmosphere
    scene.fog = new THREE.FogExp2(0xcccccc, 0.00025);

    // Lighting
    scene.add(new THREE.AmbientLight(0x505050));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Ground plane
    const floorGeom = new THREE.PlaneGeometry(worldSize, worldSize);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.receiveShadow = true;
    scene.add(floor);

    // Boundary walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const wallHeight = 50;
    const wallThickness = 10;
    const half = worldSize / 2;
    const walls = [
        new THREE.Mesh(new THREE.BoxGeometry(worldSize, wallHeight, wallThickness), wallMat),
        new THREE.Mesh(new THREE.BoxGeometry(worldSize, wallHeight, wallThickness), wallMat),
        new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, worldSize), wallMat),
        new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, worldSize), wallMat)
    ];
    walls[0].position.set(0, wallHeight / 2, -half);
    walls[1].position.set(0, wallHeight / 2, half);
    walls[2].position.set(-half, wallHeight / 2, 0);
    walls[3].position.set(half, wallHeight / 2, 0);
    walls.forEach(w => scene.add(w));

    // Trees for scenery
    for (let i = 0; i < 12; i++) {
        const trunkGeom = new THREE.CylinderGeometry(1.5, 1.5, 8, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        const crownGeom = new THREE.SphereGeometry(4, 16, 16);
        const crownMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const crown = new THREE.Mesh(crownGeom, crownMat);
        crown.position.y = 6;
        const tree = new THREE.Object3D();
        tree.add(trunk);
        tree.add(crown);
        const tx = (Math.random() - 0.5) * (worldSize - 100);
        const tz = (Math.random() - 0.5) * (worldSize - 100);
        tree.position.set(tx, 4, tz);
        scene.add(tree);
    }

    // Raycaster
    raycaster = new THREE.Raycaster();

    // Spawn initial targets
    for (let i = 0; i < 12; i++) {
        spawnTarget();
    }
    // Spawn a few power‑ups at the start
    for (let i = 0; i < 3; i++) {
        spawnPowerUp();
    }

    // Spawn a few stars at the start
    for (let i = 0; i < 2; i++) {
        spawnStar();
    }

    // Spawn decorative mountains around the arena
    for (let i = 0; i < 6; i++) {
        spawnMountain();
    }
    // Spawn some clouds high above the arena
    for (let i = 0; i < 4; i++) {
        spawnCloud();
    }

    // Spawn decorative props such as rocks and crates
    for (let i = 0; i < 8; i++) {
        spawnDecoration();
    }

    // Create the player's gun model and attach it to the camera
    createGun();

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Overlay and crosshair and scoreboard elements
    const overlay = document.getElementById('overlay');
    const crosshair = document.getElementById('crosshair');
    scoreboard = document.getElementById('scoreboard');
    updateScoreboard();

    overlay.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === renderer.domElement) {
            isLocked = true;
            overlay.style.display = 'none';
            crosshair.style.display = 'block';
        } else {
            isLocked = false;
            overlay.style.display = '';
            crosshair.style.display = 'none';
        }
    });

    // Input handlers
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', onClick);
    window.addEventListener('resize', onWindowResize);

    // Prevent the default context menu from appearing on right click and toggle zoom instead.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => {
        // Right mouse button (button === 2) toggles aiming down sights
        if (e.button === 2) {
            toggleZoom();
        }
    });

    scene.add(yawObject);
}

function randomColor() {
    // generate a vibrant color
    const h = Math.random();
    const s = 0.5 + Math.random() * 0.5;
    const l = 0.4 + Math.random() * 0.3;
    return new THREE.Color().setHSL(h, s, l);
}

function spawnTarget() {
    // Types of geometries including more creative shapes
    const types = ['box', 'sphere', 'cone', 'torus', 'cylinder', 'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron', 'torusKnot'];
    const type = types[Math.floor(Math.random() * types.length)];
    let geometry;
    let size = 10 + Math.random() * 20;
    switch (type) {
        case 'box':
            geometry = new THREE.BoxGeometry(size, size, size);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(size / 2, 16, 16);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(size / 2, size, 16);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(size / 2, size / 4, 8, 16);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(size / 3, size / 3, size, 16);
            break;
        case 'tetrahedron':
            geometry = new THREE.TetrahedronGeometry(size / 2);
            break;
        case 'octahedron':
            geometry = new THREE.OctahedronGeometry(size / 2);
            break;
        case 'dodecahedron':
            geometry = new THREE.DodecahedronGeometry(size / 2);
            break;
        case 'icosahedron':
            geometry = new THREE.IcosahedronGeometry(size / 2);
            break;
        case 'torusKnot':
            geometry = new THREE.TorusKnotGeometry(size / 3, size / 6, 64, 8);
            break;
    }
    const material = new THREE.MeshPhongMaterial({ color: randomColor(), shininess: 40 });
    const mesh = new THREE.Mesh(geometry, material);
    const halfArea = worldSize / 2 - 50;
    mesh.position.set(
        (Math.random() * 2 - 1) * halfArea,
        size / 2 + 2,
        (Math.random() * 2 - 1) * halfArea
    );
    scene.add(mesh);
    objects.push(mesh);

    // random velocity for target movement
    const velocityRange = 80;
    const v = new THREE.Vector3(
        (Math.random() * 2 - 1) * velocityRange,
        0,
        (Math.random() * 2 - 1) * velocityRange
    );
    targetVelocities.push(v);

    // random rotation speeds
    const rotSpeed = new THREE.Vector3(
        (Math.random() * 2 - 1) * 1.5,
        (Math.random() * 2 - 1) * 1.5,
        (Math.random() * 2 - 1) * 1.5
    );
    targetRotationSpeeds.push(rotSpeed);
}

// Spawn a power‑up object that moves around the arena. Shooting a power‑up grants bonus points and spawns extra targets.
function spawnPowerUp() {
    const size = 6 + Math.random() * 4;
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0xff00ff, shininess: 60 });
    const mesh = new THREE.Mesh(geometry, material);
    const halfArea = worldSize / 2 - 50;
    mesh.position.set(
        (Math.random() * 2 - 1) * halfArea,
        size / 2 + 2,
        (Math.random() * 2 - 1) * halfArea
    );
    scene.add(mesh);
    powerUps.push(mesh);
    // random velocity for power‑up movement
    const v = new THREE.Vector3(
        (Math.random() * 2 - 1) * 60,
        0,
        (Math.random() * 2 - 1) * 60
    );
    powerUpVelocities.push(v);
}

// Spawn a star collectible in the arena. Shooting a star grants bonus points and temporarily increases projectile speed.
function spawnStar() {
    const size = 6 + Math.random() * 4;
    // Use an octahedron geometry for a distinctive star-like shape
    const geometry = new THREE.OctahedronGeometry(size);
    const material = new THREE.MeshPhongMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        shininess: 80,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const halfArea = worldSize / 2 - 50;
    mesh.position.set(
        (Math.random() * 2 - 1) * halfArea,
        size / 2 + 2,
        (Math.random() * 2 - 1) * halfArea
    );
    scene.add(mesh);
    stars.push(mesh);
    // Random velocity for star movement
    const vel = new THREE.Vector3(
        (Math.random() * 2 - 1) * 40,
        0,
        (Math.random() * 2 - 1) * 40
    );
    starVelocities.push(vel);
}

// Spawn a mountain outside the arena to create background scenery.
function spawnMountain() {
    // Randomly choose geometry type for variety
    const types = ['cone', 'cylinder', 'icosahedron'];
    const type = types[Math.floor(Math.random() * types.length)];
    let geometry;
    const height = 80 + Math.random() * 80;
    const radius = 40 + Math.random() * 40;
    switch (type) {
        case 'cone':
            geometry = new THREE.ConeGeometry(radius, height, 16);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(radius, radius * 0.6, height, 16);
            break;
        case 'icosahedron':
            geometry = new THREE.IcosahedronGeometry(radius, 1);
            break;
    }
    const material = new THREE.MeshLambertMaterial({ color: 0x555533 });
    const mesh = new THREE.Mesh(geometry, material);
    // Position mountain just outside the arena boundaries
    const side = Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.5) {
        // Place along X side
        mesh.position.set(side * (worldSize / 2 + radius), height / 2 - 10, (Math.random() * 2 - 1) * (worldSize + 200));
    } else {
        // Place along Z side
        mesh.position.set((Math.random() * 2 - 1) * (worldSize + 200), height / 2 - 10, side * (worldSize / 2 + radius));
    }
    scene.add(mesh);
    mountains.push(mesh);
}

// Spawn a cloud composed of multiple spheres, moving slowly across the sky.
function spawnCloud() {
    const cloud = new THREE.Group();
    const sphereCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < sphereCount; i++) {
        const size = 8 + Math.random() * 10;
        const geom = new THREE.SphereGeometry(size, 8, 8);
        const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, opacity: 0.8, transparent: true });
        const sphere = new THREE.Mesh(geom, mat);
        sphere.position.set((Math.random() * 2 - 1) * 15, (Math.random() * 2 - 1) * 5, (Math.random() * 2 - 1) * 10);
        cloud.add(sphere);
    }
    // Position cloud high above the arena
    const half = worldSize / 2;
    cloud.position.set((Math.random() * 2 - 1) * half, 80 + Math.random() * 40, (Math.random() * 2 - 1) * half);
    scene.add(cloud);
    clouds.push(cloud);
    // Assign a slow horizontal velocity
    const vel = new THREE.Vector3((Math.random() * 2 - 1) * 10, 0, (Math.random() * 2 - 1) * 10);
    cloudVelocities.push(vel);
}

// Create a simple first‑person gun model and attach it to the player's pitch object.  The gun is
// built from basic shapes (a cylinder for the barrel and a box for the body) and positioned
// relative to the camera so that it appears in the bottom right of the screen.  This adds
// immersion to the FPS experience without requiring an external model file.
function createGun() {
    // Create a group for the gun so we can move it as a whole relative to the camera.
    gun = new THREE.Group();
    // Define materials for different parts of the weapon.  Dark metal for the main body,
    // mid‑tone metal for the slide, grip material for the handle and magazine, and
    // accent material for small details like rails and sights.
    const darkMetal = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const midMetal  = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const gripMat   = new THREE.MeshPhongMaterial({ color: 0x2f2b2a });
    const accentMat = new THREE.MeshPhongMaterial({ color: 0x666666 });
    // Barrel: a cylindrical tube slightly narrower than the slide
    const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 8.0, 16);
    gunBarrel = new THREE.Mesh(barrelGeo, darkMetal);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.25, -4.0);
    gun.add(gunBarrel);
    gunParts.push(gunBarrel);
    // Slide: a longer, taller box sits over the barrel
    const slideGeo = new THREE.BoxGeometry(1.8, 0.8, 6.5);
    const slide = new THREE.Mesh(slideGeo, midMetal);
    slide.position.set(0, 0.8, -3.5);
    gun.add(slide);
    gunParts.push(slide);
    // Top rail: a slim bar running along the top of the slide
    const railGeo = new THREE.BoxGeometry(1.6, 0.15, 6.0);
    const rail = new THREE.Mesh(railGeo, accentMat);
    rail.position.set(0, 1.25, -3.5);
    gun.add(rail);
    gunParts.push(rail);
    // Ejection port: a small rectangular opening on the slide
    const ejectGeo = new THREE.BoxGeometry(0.8, 0.3, 0.4);
    const ejection = new THREE.Mesh(ejectGeo, accentMat);
    ejection.position.set(0.6, 0.7, -1.0);
    gun.add(ejection);
    gunParts.push(ejection);
    // Rear sight: a small block at the back of the slide
    const rearSightGeo = new THREE.BoxGeometry(0.6, 0.3, 0.4);
    const rearSight = new THREE.Mesh(rearSightGeo, darkMetal);
    rearSight.position.set(0, 1.4, -6.0);
    gun.add(rearSight);
    gunParts.push(rearSight);
    // Grip/handle: a larger, more ergonomic box tilted back
    const gripGeo = new THREE.BoxGeometry(1.0, 2.8, 1.4);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0.5, -1.3, 2.0);
    grip.rotation.x = -0.6;
    gun.add(grip);
    gunParts.push(grip);
    // Magazine: attaches below the grip
    const magGeo = new THREE.BoxGeometry(0.7, 1.8, 1.2);
    const magazine = new THREE.Mesh(magGeo, gripMat);
    magazine.position.set(-0.1, -2.3, 2.0);
    magazine.rotation.x = -0.6;
    gun.add(magazine);
    gunParts.push(magazine);
    // Front sight near the muzzle
    const frontSightGeo = new THREE.BoxGeometry(0.4, 0.3, 0.4);
    const frontSight = new THREE.Mesh(frontSightGeo, darkMetal);
    frontSight.position.set(0, 1.05, -6.5);
    gun.add(frontSight);
    gunParts.push(frontSight);
    // Trigger guard: torus acting as a guard around the trigger area
    const triggerGeo = new THREE.TorusGeometry(0.4, 0.1, 8, 16);
    const triggerGuard = new THREE.Mesh(triggerGeo, darkMetal);
    triggerGuard.rotation.set(Math.PI / 2, 0, 0);
    triggerGuard.position.set(0.9, -0.4, 0.8);
    gun.add(triggerGuard);
    gunParts.push(triggerGuard);
    // Position the entire gun relative to the camera for a natural holding position
    gun.position.set(1.3, -1.5, -1.7);
    // Attach the gun to the pitchObject so it moves with the player's view.
    pitchObject.add(gun);
}

// Spawn a decorative object such as a rock or crate.  These props are purely aesthetic and
// randomly distributed across the ground to make the environment feel more lived‑in.
function spawnDecoration() {
    const size = 5 + Math.random() * 5;
    let geometry;
    if (Math.random() < 0.5) {
        geometry = new THREE.BoxGeometry(size, size, size);
    } else {
        geometry = new THREE.SphereGeometry(size / 2, 8, 8);
    }
    const material = new THREE.MeshLambertMaterial({ color: randomColor() });
    const mesh = new THREE.Mesh(geometry, material);
    const area = worldSize / 2 - 30;
    mesh.position.set((Math.random() * 2 - 1) * area, size / 2 + 1, (Math.random() * 2 - 1) * area);
    scene.add(mesh);
    decorations.push(mesh);
}

// Toggle the zoom state when the player right‑clicks.  Switching between normal and zoomed
// field‑of‑view simulates aiming down sights.  Crosshair opacity is reduced while zoomed.
function toggleZoom() {
    isZoomed = !isZoomed;
    camera.fov = isZoomed ? zoomFov : normalFov;
    camera.updateProjectionMatrix();
    const crosshairElem = document.getElementById('crosshair');
    if (crosshairElem) {
        // Change opacity and size of crosshair while zoomed for a sniping effect
        crosshairElem.style.opacity = isZoomed ? '0.3' : '1.0';
        // Preserve the translation that centers the crosshair and add a scale factor
        crosshairElem.style.transform = isZoomed ? 'translate(-50%, -50%) scale(0.6)' : 'translate(-50%, -50%) scale(1)';
    }
}

// Perform a quick dash forward in the direction the player is facing.  Uses a cooldown to
// prevent spamming.  This function ignores vertical direction so the player only dashes along the ground.
function dash() {
    const now = performance.now();
    if (now - lastDashTime < dashCooldown) return;
    lastDashTime = now;
    const dir = new THREE.Vector3();
    // Use the camera's world direction for movement
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    // Move the player forward by the configured dash distance
    yawObject.position.addScaledVector(dir, dashDistance);
}

// Perform a quick dash to the player's left.  This is computed using a cross product
// with the up vector to find the left direction relative to the camera.
function dashLeft() {
    const now = performance.now();
    if (now - lastDashTime < dashCooldown) return;
    lastDashTime = now;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const left = new THREE.Vector3();
    // left = up cross forward
    left.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    // Move the player left by the configured dash distance
    yawObject.position.addScaledVector(left, dashDistance);
}

// Perform a quick dash to the player's right.  Uses cross product to find the right direction relative to the camera.
function dashRight() {
    const now = performance.now();
    if (now - lastDashTime < dashCooldown) return;
    lastDashTime = now;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3();
    // right = forward cross up
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    // Move the player right by the configured dash distance
    yawObject.position.addScaledVector(right, dashDistance);
}

// Perform a quick dash backwards.  Moves the player opposite of the facing direction.
function dashBack() {
    const now = performance.now();
    if (now - lastDashTime < dashCooldown) return;
    lastDashTime = now;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    // Move backwards by subtracting the dash distance
    yawObject.position.addScaledVector(dir, -dashDistance);
}

// Perform a quick vertical dash upwards.  This adds a vertical offset to the player's position, subject to dash cooldown.
function dashUp() {
    const now = performance.now();
    if (now - lastDashTime < dashCooldown) return;
    lastDashTime = now;
    // Add vertical offset directly to the player position
    yawObject.position.y += dashDistance;
}

// Shoot a slow‑moving, larger projectile (bomb) that deals area damage when hitting targets.
function shootBomb() {
    if (!isLocked) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // Create a larger sphere for the bomb
    const bombGeom = new THREE.SphereGeometry(5, 12, 12);
    const bombMat = new THREE.MeshPhongMaterial({ color: 0xff5500 });
    const bomb = new THREE.Mesh(bombGeom, bombMat);
    // Determine starting position slightly in front of the player
    yawObject.updateMatrixWorld();
    const startPos = new THREE.Vector3();
    yawObject.getWorldPosition(startPos);
    const offset = dir.clone().multiplyScalar(10);
    bomb.position.copy(startPos).add(offset);
    scene.add(bomb);
    // Bomb travels more slowly than a standard projectile
    const speed = 300 * projectileSpeedMultiplier;
    const velVec = dir.clone().normalize().multiplyScalar(speed);
    projectiles.push({ mesh: bomb, velocity: velVec });
    // Handle boosted shots decrement if active
    if (shotsBoosted > 0) {
        shotsBoosted--;
        if (shotsBoosted === 0) {
            projectileSpeedMultiplier = 1;
        }
    }
}

// Cycle through different colour palettes for the gun. Each call applies a new colour to all gun parts.
function cycleGunColor() {
    gunColorIndex = (gunColorIndex + 1) % gunColorPalette.length;
    const newColor = gunColorPalette[gunColorIndex];
    gunParts.forEach(part => {
        // If material is an array (rare), update each; otherwise update the single material
        if (Array.isArray(part.material)) {
            part.material.forEach(mat => mat.color.setHex(newColor));
        } else {
            part.material.color.setHex(newColor);
        }
    });
}

// Cycle through crosshair colours.  Each call updates the colour of the on‑screen crosshair.
function cycleCrosshairColor() {
    const crosshairElem = document.getElementById('crosshair');
    if (!crosshairElem) return;
    crosshairColorIndex = (crosshairColorIndex + 1) % crosshairColors.length;
    crosshairElem.style.color = crosshairColors[crosshairColorIndex];
}

function updateScoreboard() {
    if (scoreboard) {
        scoreboard.textContent = `得分: ${score}`;
    }
}

function onMouseMove(event) {
    if (!isLocked) return;
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    yawObject.rotation.y -= movementX * 0.002;
    pitchObject.rotation.x -= movementY * 0.002;
    pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchObject.rotation.x));
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            // Allow up to two jumps (double jump) before touching the ground again
            if (jumpCount < 2) {
                velocity.y += 350;
                jumpCount++;
            }
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            // Holding shift increases movement speed (running)
            runMultiplier = 1.8;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            // Crouch: lower the player's height and reduce speed
            if (!isCrouching) {
                isCrouching = true;
                // lower player height
                yawObject.position.y -= 3;
                // slow down movement slightly when crouched
                runMultiplier *= 0.6;
            }
            break;
        case 'KeyE':
            // Dash forward when pressing E
            dash();
            break;
        case 'KeyQ':
            // Dash left when pressing Q
            dashLeft();
            break;
        case 'KeyR':
            // Spawn an extra star as an interactive element
            spawnStar();
            break;
        case 'KeyF':
            // Spawn a power-up when pressing F
            spawnPowerUp();
            break;
        case 'KeyG':
            // Spawn a decorative object (rock/crate) when pressing G
            spawnDecoration();
            break;
        case 'KeyZ':
            // Dash right when pressing Z
            dashRight();
            break;
        case 'KeyX':
            // Dash backward when pressing X
            dashBack();
            break;
        case 'Digit1':
            // Cycle weapon colour palette
            cycleGunColor();
            break;
        case 'KeyC':
            // Cycle through crosshair colours
            cycleCrosshairColor();
            break;
        case 'KeyV':
            // Vertical dash upward
            dashUp();
            break;
        case 'KeyB':
            // Launch a slow‑moving bomb projectile
            shootBomb();
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            // Release running key resets movement speed
            runMultiplier = 1;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            // Stand up when crouch key is released
            if (isCrouching) {
                isCrouching = false;
                // raise player height
                yawObject.position.y += 3;
                // restore speed multiplier if not running
                runMultiplier = 1;
            }
            break;
    }
}

function onClick() {
    if (!isLocked) return;
    // Shoot a small projectile (ball) in the direction the camera is facing
    const directionVec = new THREE.Vector3();
    camera.getWorldDirection(directionVec);
    // Create a sphere to represent the projectile
    const projGeom = new THREE.SphereGeometry(2, 8, 8);
    const projMat = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const projectile = new THREE.Mesh(projGeom, projMat);
    // Position the projectile slightly in front of the player's current world position
    const startPos = new THREE.Vector3();
    // Ensure the player's world matrix is up to date and use the player's world position (yawObject)
    yawObject.updateMatrixWorld();
    yawObject.getWorldPosition(startPos);
    const offset = directionVec.clone().multiplyScalar(10);
    projectile.position.copy(startPos).add(offset);
    scene.add(projectile);
    // Determine projectile speed with any active multipliers
    const speed = 600 * projectileSpeedMultiplier;
    const velocityVec = directionVec.clone().normalize().multiplyScalar(speed);
    projectiles.push({ mesh: projectile, velocity: velocityVec });
    // If the player has boosted shots remaining, decrement and reset multiplier when exhausted
    if (shotsBoosted > 0) {
        shotsBoosted--;
        if (shotsBoosted === 0) {
            projectileSpeedMultiplier = 1;
        }
    }
}

function removeTarget(obj) {
    const idx = objects.indexOf(obj);
    if (idx > -1) {
        scene.remove(obj);
        objects.splice(idx, 1);
        targetVelocities.splice(idx, 1);
        targetRotationSpeeds.splice(idx, 1);
        score++;
        updateScoreboard();
        spawnTarget();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (isLocked) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;
        // Apply friction and gravity
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta;
        // Determine movement directions
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        if (moveForward || moveBackward) velocity.z += direction.z * 400.0 * delta * runMultiplier;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta * runMultiplier;
        // Translate player
        yawObject.translateX(-velocity.x * delta);
        yawObject.translateZ(-velocity.z * delta);
        yawObject.position.y += velocity.y * delta;
        // Keep player above the ground.  Adjust the effective ground height when crouching so the
        // player remains lower.  Reset jump count upon landing to enable double jumps again.
        const groundHeight = isCrouching ? 7 : 10;
        if (yawObject.position.y < groundHeight) {
            velocity.y = 0;
            yawObject.position.y = groundHeight;
            jumpCount = 0;
            canJump = true;
        }
        // Move and rotate targets
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            const v = targetVelocities[i];
            obj.position.addScaledVector(v, delta);
            // Bounce off boundaries
            if (obj.position.x < -worldSize / 2 + 20 || obj.position.x > worldSize / 2 - 20) {
                v.x = -v.x;
            }
            if (obj.position.z < -worldSize / 2 + 20 || obj.position.z > worldSize / 2 - 20) {
                v.z = -v.z;
            }
            // Rotate object
            const rot = targetRotationSpeeds[i];
            obj.rotation.x += rot.x * delta;
            obj.rotation.y += rot.y * delta;
            obj.rotation.z += rot.z * delta;
            // Subtle color shift over time
            obj.material.color.offsetHSL(0.001 * delta, 0.0, 0.0);
        }

        // Update power‑ups: move around and bounce off boundaries
        for (let i = 0; i < powerUps.length; i++) {
            const pu = powerUps[i];
            const vel = powerUpVelocities[i];
            pu.position.addScaledVector(vel, delta);
            if (pu.position.x < -worldSize / 2 + 20 || pu.position.x > worldSize / 2 - 20) {
                vel.x = -vel.x;
            }
            if (pu.position.z < -worldSize / 2 + 20 || pu.position.z > worldSize / 2 - 20) {
                vel.z = -vel.z;
            }
            // Rotate power‑ups for visual interest
            pu.rotation.y += 2.0 * delta;
        }
        // Update stars: move, bounce, and rotate
        for (let i = 0; i < stars.length; i++) {
            const st = stars[i];
            const vel = starVelocities[i];
            st.position.addScaledVector(vel, delta);
            if (st.position.x < -worldSize / 2 + 20 || st.position.x > worldSize / 2 - 20) {
                vel.x = -vel.x;
            }
            if (st.position.z < -worldSize / 2 + 20 || st.position.z > worldSize / 2 - 20) {
                vel.z = -vel.z;
            }
            // Rotate for a sparkling effect
            st.rotation.x += 2.0 * delta;
            st.rotation.y += 3.0 * delta;
        }
        // Slowly shift the background hue for a more dynamic look
        if (scene.background && scene.background.isColor) {
            scene.background.offsetHSL(0.05 * delta, 0, 0);
        }

        // Update clouds: move slowly across the sky and wrap around the world boundaries
        for (let i = 0; i < clouds.length; i++) {
            const cl = clouds[i];
            const vel = cloudVelocities[i];
            cl.position.addScaledVector(vel, delta);
            const bound = worldSize / 2 + 200;
            if (cl.position.x < -bound) {
                cl.position.x = bound;
            } else if (cl.position.x > bound) {
                cl.position.x = -bound;
            }
            if (cl.position.z < -bound) {
                cl.position.z = bound;
            } else if (cl.position.z > bound) {
                cl.position.z = -bound;
            }
            // Gentle rotation for dynamic look
            cl.rotation.y += 0.1 * delta;
        }

        // Update projectiles: move and check collisions
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            // Determine projectile radius once per projectile
            const projRadius = proj.mesh.geometry.boundingSphere ? proj.mesh.geometry.boundingSphere.radius : 2;
            // Move projectile
            proj.mesh.position.addScaledVector(proj.velocity, delta);
            let hit = false;
            // Check collision with targets
            for (let j = objects.length - 1; j >= 0; j--) {
                const obj = objects[j];
                const objRadius = obj.geometry.boundingSphere ? obj.geometry.boundingSphere.radius : 10;
                const dist = proj.mesh.position.distanceTo(obj.position);
                if (dist < objRadius + projRadius) {
                    removeTarget(obj);
                    hit = true;
                    break;
                }
            }

            // Check collision with power‑ups
            for (let k = powerUps.length - 1; k >= 0 && !hit; k--) {
                const p = powerUps[k];
                const pr = p.geometry.boundingSphere ? p.geometry.boundingSphere.radius : 5;
                const distPU = proj.mesh.position.distanceTo(p.position);
                if (distPU < projRadius + pr) {
                    // Remove power‑up and apply bonus effects
                    scene.remove(p);
                    powerUps.splice(k, 1);
                    powerUpVelocities.splice(k, 1);
                    score += 5;
                    updateScoreboard();
                    // Spawn extra targets to keep the game lively
                    spawnTarget();
                    spawnTarget();
                    hit = true;
                    break;
                }
            }

            // Check collision with stars
            for (let s = stars.length - 1; s >= 0 && !hit; s--) {
                const st = stars[s];
                const sr = st.geometry.boundingSphere ? st.geometry.boundingSphere.radius : 5;
                const distStar = proj.mesh.position.distanceTo(st.position);
                if (distStar < sr + projRadius) {
                    // Remove star and grant bonus points and speed boost
                    scene.remove(st);
                    stars.splice(s, 1);
                    starVelocities.splice(s, 1);
                    score += 10;
                    updateScoreboard();
                    // Apply projectile speed boost and set number of boosted shots
                    projectileSpeedMultiplier = 2;
                    shotsBoosted += 5;
                    // Spawn a new star to keep the feature active
                    spawnStar();
                    hit = true;
                    break;
                }
            }
            // Remove projectile if hit or out of bounds
            const maxDist = worldSize;
            if (hit || Math.abs(proj.mesh.position.x) > maxDist || Math.abs(proj.mesh.position.z) > maxDist ||
                proj.mesh.position.y < 0 || proj.mesh.position.length() > maxDist * 1.5) {
                scene.remove(proj.mesh);
                projectiles.splice(i, 1);
            }
        }
        prevTime = time;
        // Update weapon bobbing when the player is moving. This gives a subtle sway to the gun to simulate walking.
        if (gun) {
            const moving = moveForward || moveBackward || moveLeft || moveRight;
            // Increase bobbing timer when moving, otherwise reset it to zero.
            if (moving) {
                bobbingTime += delta * 8.0;
            } else {
                bobbingTime = 0;
            }
            // Base offset for the gun relative to the camera
            // Match these values to the initial positioning set in createGun()
            const baseX = 1.3;
            const baseY = -1.5;
            const baseZ = -1.7;
            // Compute bobbing offsets using sine waves for horizontal and vertical sway
            const horizOffset = Math.sin(bobbingTime * 2.0) * 0.2;
            const vertOffset = Math.abs(Math.sin(bobbingTime)) * 0.3;
            gun.position.set(baseX + horizOffset, baseY - vertOffset, baseZ);
        }
    }
    // Render the scene after updates
    renderer.render(scene, camera);
}

init();
animate();
