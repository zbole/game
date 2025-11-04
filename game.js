let camera, scene, renderer, controls;
const objects = [];
let raycaster;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

function init() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080);

    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    controls = new THREE.PointerLockControls(camera, document.body);

    const overlay = document.getElementById('overlay');
    const crosshair = document.getElementById('crosshair');

    // Click overlay to lock the pointer and start the game
    overlay.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        overlay.style.display = 'none';
        crosshair.style.display = 'block';
    });

    controls.addEventListener('unlock', () => {
        overlay.style.display = '';
        crosshair.style.display = 'none';
    });

    scene.add(controls.getObject());

    // Create the floor
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x999999 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    // Set up raycaster for shooting
    raycaster = new THREE.Raycaster();

    // Generate cubes to shoot
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
    for (let i = 0; i < 20; i++) {
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(boxGeometry, material);
        cube.position.x = Math.random() * 800 - 400;
        cube.position.y = 10;
        cube.position.z = Math.random() * 800 - 400;
        scene.add(cube);
        objects.push(cube);
    }

    // Listen for movement and click events
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', onClick);

    // Set up renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);
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
    if (!controls.isLocked) return;

    const directionVector = new THREE.Vector3();
    camera.getWorldDirection(directionVector);
    raycaster.set(camera.position, directionVector);
    const intersects = raycaster.intersectObjects(objects, false);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        scene.remove(hit);
        objects.splice(objects.indexOf(hit), 1);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // Apply friction and gravity
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta;

        // Determine direction based on inputs
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // Accelerate in the direction the player is moving
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        // Move the camera
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        // Apply vertical movement
        controls.getObject().position.y += velocity.y * delta;
        if (controls.getObject().position.y < 10) {
            velocity.y = 0;
            controls.getObject().position.y = 10;
            canJump = true;
        }

        prevTime = time;
    }

    renderer.render(scene, camera);
}

init();
animate();
