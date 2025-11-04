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
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
    pitchObject = new THREE.Object3D();
    pitchObject.add(camera);
    yawObject = new THREE.Object3D();
    yawObject.position.y = 10;
    yawObject.add(pitchObject);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080);

    // Lighting
    scene.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 10, 7);
    scene.add(light);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(worldSize, worldSize);
    floorGeometry.rotateX(-Math.PI / 2);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);

    // Boundary walls
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const wallHeight = 50;
    const wallThickness = 10;
    const half = worldSize / 2;
    const walls = [
        new THREE.Mesh(new THREE.BoxGeometry(worldSize, wallHeight, wallThickness), wallMaterial),
        new THREE.Mesh(new THREE.BoxGeometry(worldSize, wallHeight, wallThickness), wallMaterial),
        new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, worldSize), wallMaterial),
        new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, worldSize), wallMaterial),
    ];
    walls[0].position.set(0, wallHeight / 2, -half);
    walls[1].position.set(0, wallHeight / 2, half);
    walls[2].position.set(-half, wallHeight / 2, 0);
    walls[3].position.set(half, wallHeight / 2, 0);
    walls.forEach(w => scene.add(w));

    // Trees / scenery
    for (let i = 0; i < 10; i++) {
        const trunkGeom = new THREE.CylinderGeometry(1, 1, 8, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        const crownGeom = new THREE.SphereGeometry(4, 8, 8);
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
    for (let i = 0; i < 10; i++) {
        spawnTarget();
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

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

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', onClick);
    window.addEventListener('resize', onWindowResize);

    scene.add(yawObject);
}

function randomColor() {
    return new THREE.Color(Math.random(), Math.random(), Math.random());
}

function spawnTarget() {
    const types = ['box', 'sphere', 'cone', 'torus', 'cylinder'];
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
            geometry = new THREE.CylinderGeometry(size / 4, size / 4, size, 16);
            break;
    }
    const material = new THREE.MeshPhongMaterial({ color: randomColor() });
    const mesh = new THREE.Mesh(geometry, material);
    const halfArea = worldSize / 2 - 50;
    mesh.position.set((Math.random() * 2 - 1) * halfArea, size / 2 + 1, (Math.random() * 2 - 1) * halfArea);
    scene.add(mesh);
    objects.push(mesh);
    const vel = new THREE.Vector3((Math.random() * 2 - 1) * 50, 0, (Math.random() * 2 - 1) * 50);
    targetVelocities.push(vel);
    const rot = new THREE.Vector3((Math.random() * 2 - 1) * 1.0, (Math.random() * 2 - 1) * 1.0, (Math.random() * 2 - 1) * 1.0);
    targetRotationSpeeds.push(rot);
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
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(camera.position, dir);
    const intersects = raycaster.intersectObjects(objects, false);
    if (intersects.length > 0) {
        removeTarget(intersects[0].object);
        return;
    }
    // near miss detection
    let bestIndex = -1;
    let bestAngle = 0.2;
    const camDir = dir.clone();
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const vecToObj = obj.position.clone().sub(camera.position);
        const distance = vecToObj.length();
        const angle = camDir.angleTo(vecToObj);
        const maxDist = 300;
        if (distance < maxDist && angle < bestAngle) {
            bestAngle = angle;
            bestIndex = i;
        }
    }
    if (bestIndex >= 0) {
        removeTarget(objects[bestIndex]);
    }
}

function removeTarget(obj) {
    const index = objects.indexOf(obj);
    if (index > -1) {
        scene.remove(obj);
        objects.splice(index, 1);
        targetVelocities.splice(index, 1);
        targetRotationSpeeds.splice(index, 1);
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

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z += direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        yawObject.translateX(-velocity.x * delta);
        yawObject.translateZ(-velocity.z * delta);
        yawObject.position.y += velocity.y * delta;

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
          if (obj.position.x < -worldSize / 2 + 20 || obj.position.x > worldSize / 2 - 20) {
            v.x = -v.x;
        }
        if (obj.position.z < -worldSize / 2 + 20 || obj.position.z > worldSize / 2 - 20) {
            v.z = -v.z;
        }            }
       
            const rot = targetRotationSpeeds[i];
            obj.rotation.x += rot.x * delta;
            obj.rotation.y += rot.y * delta;
            obj.rotation.z += rot.z * delta;
        }

        prevTime = time;
    }

    renderer.render(scene, camera);
}

init();
animate();
