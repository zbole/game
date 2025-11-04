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
    }
    renderer.render(scene, camera);
}

init();
animate();
