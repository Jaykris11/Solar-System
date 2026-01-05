import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// --- SUN ---
export function createSun(loader) {
    const sunGeo = new THREE.SphereGeometry(15, 64, 64);
    const sunMat = new THREE.MeshBasicMaterial({ 
        map: loader.load('https://upload.wikimedia.org/wikipedia/commons/9/99/Map_of_the_full_sun.jpg'),
        color: 0xffeebb 
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);

    // Inner Glow
    const sunGlow = new THREE.Mesh(
        new THREE.SphereGeometry(16.5, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.15, side: THREE.BackSide, blending: THREE.AdditiveBlending })
    );
    sun.add(sunGlow);

    // Outer Glow
    const sunOuterGlow = new THREE.Mesh(
        new THREE.SphereGeometry(25, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.08, side: THREE.BackSide, blending: THREE.AdditiveBlending })
    );
    sun.add(sunOuterGlow);

    return { sun, sunGlow, sunOuterGlow };
}

// --- STARS ---
export function createStars() {
    const createSystem = (count, size, color, spread) => {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count); 
        for(let i=0; i<count*3; i++) {
            pos[i] = (Math.random() - 0.5) * spread;
            if(i % 3 === 0) sizes[i/3] = Math.random(); 
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('sizePhase', new THREE.BufferAttribute(sizes, 1));
        const mat = new THREE.PointsMaterial({ size: size, color: color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
        const points = new THREE.Points(geo, mat);
        points.userData = { originalSize: size };
        return points;
    };

    const stars1 = createSystem(5000, 0.4, 0xffffff, 2000);
    const stars2 = createSystem(2000, 0.8, 0xaaccff, 1500);
    const stars3 = createSystem(1000, 1.2, 0xffccaa, 1000);
    return [stars1, stars2, stars3];
}

// --- STARDUST ---
export function createStardust() {
    const dustCount = 800;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for(let i=0; i<dustCount; i++) {
        dustPos[i*3] = (Math.random() - 0.5) * 400;     
        dustPos[i*3+1] = (Math.random() - 0.5) * 200;   
        dustPos[i*3+2] = Math.random() * 2500;          
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x88ccff, size: 0.6, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
    return new THREE.Points(dustGeo, dustMat);
}

// --- PLANETS ---
export function createPlanets(scene, loader, dataList) {
    const groups = [];
    const meshes = [];
    let satellitePivot = null;

    dataList.forEach(data => {
        const group = new THREE.Group();
        const angle = Math.random() * Math.PI * 2;
        data.angle = angle;
        group.position.set(Math.cos(angle) * data.distance, 0, Math.sin(angle) * data.distance);

        // Orbit
        const orbit = new THREE.Mesh(
            new THREE.RingGeometry(data.distance - 0.15, data.distance + 0.15, 128),
            new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.12, transparent: true, side: THREE.DoubleSide })
        );
        orbit.rotation.x = -Math.PI / 2;
        scene.add(orbit);

        // Material
        const matConfig = { map: loader.load(data.tex), roughness: 0.8, metalness: 0.1 };
        if (data.bump) { matConfig.bumpMap = loader.load(data.bump); matConfig.bumpScale = data.bumpScale || 0.05; }
        if (data.specular) { matConfig.roughnessMap = loader.load(data.specular); matConfig.roughness = 1.0; }

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.size, 64, 64), new THREE.MeshStandardMaterial(matConfig));
        
        if (data.name === 'Saturn') { mesh.rotation.x = 26.7 * (Math.PI / 180); mesh.rotation.z = 0.1; }
        else if (data.name === 'Uranus') { mesh.rotation.z = Math.PI / 2; }

        group.add(mesh);

        // Clouds
        if (data.clouds) {
            const cloudTexUrl = data.cloudTex || 'https://upload.wikimedia.org/wikipedia/commons/2/23/Blue_Marble_Clouds.png';
            const clouds = new THREE.Mesh(
                new THREE.SphereGeometry(data.size * (data.name === 'Venus' ? 1.01 : 1.02), 64, 64),
                new THREE.MeshStandardMaterial({ map: loader.load(cloudTexUrl), transparent: true, opacity: data.name === 'Venus' ? 0.6 : 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
            );
            mesh.add(clouds);
            mesh.userData.clouds = clouds;
        }

        // Rings
        if (data.ring) {
            const ringGeo = new THREE.RingGeometry(data.size * 1.4, data.size * 2.5, 128);
            const pos = ringGeo.attributes.position;
            const uv = ringGeo.attributes.uv;
            for (let i = 0; i < pos.count; i++) {
                const radius = Math.sqrt(pos.getX(i)**2 + pos.getY(i)**2);
                uv.setXY(i, (radius - data.size * 1.4) / (data.size * 2.5 - data.size * 1.4), 0.5);
            }
            const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: loader.load(data.ringTex), side: THREE.DoubleSide, transparent: true, opacity: 0.9, color: 0xdddddd }));
            ring.rotation.x = Math.PI / 2;
            mesh.add(ring);
        }

        // Satellite
        if (data.satellite) {
            const satPivot = new THREE.Group();
            group.add(satPivot);
            satellitePivot = satPivot;
            const satBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 }));
            satBody.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.4), new THREE.MeshStandardMaterial({ color: 0x3333aa, roughness: 0.2 })));
            satBody.rotation.z = Math.PI / 2;
            satBody.position.set(data.size * 2.5, 0, 0);
            satPivot.add(satBody);
        }

        scene.add(group);
        groups.push(group);
        meshes.push(mesh);
    });

    return { groups, meshes, satellitePivot };
}