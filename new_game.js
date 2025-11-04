// improved FPS game with creative targets, near‑miss detection, lighting, scenery, and scoreboard
let camera, scene, renderer;
let yawObject, pitchObject;
const objects = [];
const targetVelocities = [];
const targetRotationSpeeds = [];
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
            if (canJump) {
                velocity.y += 350;
            }
            canJump = false;
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
    }
}

function onClick() {
    if (!isLocked) return;
    // Use raycaster to check for direct hit
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(camera.position, dir);
    const intersects = raycaster.intersectObjects(objects, false);
    if (intersects.length > 0) {
        removeTarget(intersects[0].object);
        return;
    }
    // Near-miss detection based on angular difference and distance
    let bestIndex = -1;
    let bestAngle = 0.25; // ~14 degrees
    const camDir = dir.clone();
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const vecToObj = obj.position.clone().sub(camera.position);
        const distance = vecToObj.length();
        if (distance > 350) continue;
        const angle = camDir.angleTo(vecToObj);
        // use object's radius approximation
        const radius = obj.geometry.boundingSphere ? obj.geometry.boundingSphere.radius : 10;
        const angularRadius = Math.atan(radius / distance);
        if (angle < bestAngle + angularRadius) {
            bestAngle = angle;
            bestIndex = i;
        }
    }
    if (bestIndex >= 0) {
        removeTarget(objects[bestIndex]);
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
        if (moveForward || moveBackward) velocity.z += direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;
        // Translate player
        yawObject.translateX(-velocity.x * delta);
        yawObject.translateZ(-velocity.z * delta);
        yawObject.position.y += velocity.y * delta;
        // Keep player above ground
        if (yawObject.position.y < 10) {
            velocity.y = 0;
            yawObject.position.y = 10;
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
        prevTime = time;
    }
    renderer.render(scene, camera);
}

init();
animate();
