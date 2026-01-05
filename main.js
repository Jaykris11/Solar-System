import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { initScene, initLights } from './sceneSetup.js';
import { createSun, createStars, createStardust, createPlanets } from './constructors.js';
import { planetsData } from './planetData.js';

// --- INITIALIZATION ---
const { scene, camera, renderer } = initScene();
initLights(scene);

const loader = new THREE.TextureLoader();

// Create Objects
const { sun, sunGlow, sunOuterGlow } = createSun(loader);
scene.add(sun);

const stars = createStars();
stars.forEach(s => scene.add(s));

const starDust = createStardust();
scene.add(starDust);

const { groups: planetGroups, meshes: planetMeshes, satellitePivot } = createPlanets(scene, loader, planetsData);

// --- ANIMATION STATE ---
const clock = new THREE.Clock();
const INTRO_DURATION = 6.5;
const introStartPos = new THREE.Vector3(0, 150, 1800);
const introEndPos = new THREE.Vector3(0, 40, 100);
let introComplete = false;

// Helpers
const getScrollPercent = () => {
    const h = document.documentElement, b = document.body, st = 'scrollTop', sh = 'scrollHeight';
    return (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight);
};

const uiIds = ['info-intro', 'info-mercury', 'info-venus', 'info-earth', 'info-mars', 'info-jupiter', 'info-saturn', 'info-uranus', 'info-neptune'];
const updateUI = (index) => {
    uiIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if(i === index) el.classList.add('active');
        else el.classList.remove('active');
    });
};

// --- LOOP ---
const currentLook = new THREE.Vector3(0, 0, 0);
const baseFOV = 60;

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // 1. Sun & Global Animations
    sun.rotation.y = time * 0.05;
    const pulse = 1 + Math.sin(time * 2) * 0.1;
    sunGlow.scale.setScalar(pulse);
    sunOuterGlow.scale.setScalar(pulse * 1.1);
    sunOuterGlow.rotation.z -= 0.002;

    stars.forEach(s => s.rotation.y = time * 0.01);

    // 2. Stardust Logic
    const dustPos = starDust.geometry.attributes.position.array;
    for(let i=0; i<800; i++) {
        dustPos[i*3 + 2] += 2; 
        if(dustPos[i*3 + 2] > 2500) dustPos[i*3 + 2] = -500;
    }
    starDust.geometry.attributes.position.needsUpdate = true;

    // 3. Planet Animations
    planetsData.forEach((data, i) => {
        planetMeshes[i].rotation.y += 0.002;
        if (planetMeshes[i].userData.clouds) planetMeshes[i].userData.clouds.rotation.y += 0.003;
        
        const currentAngle = data.angle + (time * data.speed * 0.15);
        planetGroups[i].position.x = Math.cos(currentAngle) * data.distance;
        planetGroups[i].position.z = Math.sin(currentAngle) * data.distance;
    });
    if (satellitePivot) satellitePivot.rotation.y -= 0.02;

    // 4. Camera State Machine
    if (time < INTRO_DURATION) {
        // Intro Phase
        const ease = 1 - Math.pow(1 - (time / INTRO_DURATION), 3); // Cubic Ease Out
        camera.position.lerpVectors(introStartPos, introEndPos, ease);
        camera.lookAt(0, 0, 0);
        starDust.material.opacity = 0.6 * (1 - ease);
    } else {
        // Scroll Phase
        if (!introComplete) {
            introComplete = true;
            document.getElementById('ui-layer').classList.add('visible');
            document.getElementById('scroll-indicator').classList.add('visible');
            document.body.style.overflowY = 'auto'; // Unlock scroll
        }

        const p = getScrollPercent();
        const totalSegments = planetGroups.length + 1;
        const segmentIndex = Math.min(Math.floor(p * totalSegments), totalSegments - 1);

        let targetVec = new THREE.Vector3();
        let lookVec = new THREE.Vector3();

        if (segmentIndex === 0) {
            targetVec.copy(introEndPos);
            lookVec.set(0, 0, 0);
        } else {
            const planetIdx = segmentIndex - 1;
            const group = planetGroups[planetIdx];
            const data = planetsData[planetIdx];
            const offset = data.size * 4 + 15;
            targetVec.set(group.position.x + offset * 0.8, group.position.y + (data.size * 2), group.position.z + offset);
            lookVec.copy(group.position);
        }

        const dist = camera.position.distanceTo(targetVec);
        camera.position.lerp(targetVec, dist > 50 ? 0.06 : 0.03);
        camera.position.y += Math.sin(time * 0.5) * 0.02;
        
        // FOV
        let targetFOV = baseFOV;
        if (dist > 20) targetFOV = Math.min(baseFOV + (dist * 0.15), 85);
        camera.fov += (targetFOV - camera.fov) * 0.05;
        camera.updateProjectionMatrix();

        currentLook.lerp(lookVec, 0.04);
        camera.lookAt(currentLook);
        updateUI(segmentIndex);
    }

    renderer.render(scene, camera);
}

animate();