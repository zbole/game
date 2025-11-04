let camera, scene, renderer;
const objects = [];
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
let yawObject, pitchObject;
let score = 0;
let scoreboard;
const targetVelocities = [];
const worldSize = 800;

function init() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    pitchObject = new THREE.Object3D();
    pitchObject.add(camera);
    yawObject = new THREE.Object3D();
    yawObject.position.y = 10;
    yawObject.add(pitchObject);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(worldSize, worldSize, 10, 10);
    floorGeometry.rotateX(-Math.PI / 2);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);

    // Boundary walls
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const wallThickness = 10;
    const wallHeight = 50;
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
        const x = (Math.random() - 0.5) * (worldSize - 100);
        const z = (Math.random() - 0.5) * (worldSize - 100);
        tree.position.set(x, 4, z);
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

function spawnTarget() {
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
    const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
    const cube = new THREE.Mesh(boxGeometry, material);
    const x = (Math.random() - 0.5) * (worldSize - 40);
    const z = (Math.random() - 0.5) * (worldSize - 40);
    cube.position.set(x, 10, z);
    scene.add(cube);
    objects.push(cube);
    const v = new THREE.Vector3((Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 100);
    targetVelocities.push(v);
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
    const directionVector = new THREE.Vector3();
    camera.getWorldDirection(directionVector);
    raycaster.set(camera.position, directionVector);
    const intersects = raycaster.intersectObjects(objects, false);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        scene.remove(hit);
        const index = objects.indexOf(hit);
        if (index > -1) {
            objects.splice(index, 1);
            targetVelocities.splice(index, 1);
        }
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

        // Invert sign for z to correct forward/back orientation
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

        // Update targets movement
        for (let i = 0; i < objects.length; i++) {
            const cube = objects[i];
            const v = targetVelocities[i];
            cube.position.addScaledVector(v, delta);
            if (cube.position.x < -worldSize / 2 + 10 || cube.position.x > worldSize / 2 - 10) {
                v.x = -v.x;
            }
            if (cube.position.z < -worldSize / 2 + 10 || cube.position.z > worldSize / 2 - 10) {
                v.z = -v.z;
            }
        }

        prevTime = time;
    }

    renderer.render(scene, camera);
}

init();
animate();
