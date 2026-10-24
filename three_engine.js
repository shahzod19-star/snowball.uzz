// three_engine.js - Real-time 3D WebGL Minecraft Engine for Snow Clash (Qor Jangi)
// Powered by Three.js

class SnowClash3D {
    constructor(canvas3D, game) {
        this.canvas = canvas3D;
        this.game = game;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Chiroqlar va Muhit
        this.sunLight = null;
        this.ambientLight = null;
        this.groundMesh = null;
        this.skyBox = null;
        this.sunMesh = null;
        this.cloudsGroup = null;

        // Ob'ektlar to'plami
        this.playerMeshes = new Map(); // id -> Group
        this.obstacleMeshes = [];
        this.projectileMeshes = new Map(); // id -> Mesh
        this.coinMeshes = new Map(); // id -> Mesh
        this.cloudMeshes = [];

        // Kamera parametrlari
        this.cameraMode = localStorage.getItem('snow_camera_mode') || 'third_person'; // 'third_person', 'first_person', 'top_down'
        this.cameraYaw = 0;
        this.cameraPitch = 0.2;
        this.targetCamYaw = 0;

        // Teksturalar kesh
        this.textures = {};

        this.init();
    }

    init() {
        if (!window.THREE) {
            console.warn("Three.js topilmadi, 2D rejim ishlatiladi.");
            return;
        }

        // 1. Renderer sozlash
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 2. Sahna (Scene)
        this.scene = new THREE.Scene();
        this.updateSkyAndFog();

        // 3. Kamera (Perspective Camera)
        this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 1, 3000);
        this.camera.position.set(0, 100, 200);

        // 4. Chiroqlar (Lighting)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(this.ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x3a404a, 0.45);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff5dd, 0.95);
        this.sunLight.position.set(250, 400, 200);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 1200;
        const d = 500;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.scene.add(this.sunLight);

        // 5. Procedural Minecraft Teksturalar
        this.initMinecraftTextures();

        // 6. 3D Zamin (Ground), Kvadrat Quyosh va Voxel Bulutlar
        this.buildEnvironment();

        // Oyna o'lchami o'zgarganda
        window.addEventListener('resize', () => this.onResize());
    }

    updateSkyAndFog() {
        if (!this.scene) return;
        const isGun = this.game.battleType === 'gun';
        const skyColor = isGun ? 0x222733 : 0x78aaff;
        const fogColor = isGun ? 0x222733 : 0xa0c4f8;
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.0016);
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        if (this.camera && this.renderer) {
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.width, this.height);
        }
    }

    // ==============================================================
    // TEKSTURALAR GENERATORI (MINECRAFT PIXEL TEXTURES)
    // ==============================================================
    createCanvasTexture(w, h, drawFn) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        drawFn(ctx, w, h);
        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    initMinecraftTextures() {
        // Steve Face
        this.textures.steveFace = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#c68652'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#4a2c11'; ctx.fillRect(0, 0, w, 24); // soch
            ctx.fillRect(0, 24, 12, 16); ctx.fillRect(w - 12, 24, 12, 16);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(14, 30, 10, 8); ctx.fillRect(40, 30, 10, 8); // ko'z oqi
            ctx.fillStyle = '#2563eb'; ctx.fillRect(18, 30, 6, 8); ctx.fillRect(40, 30, 6, 8); // qorachiq
            ctx.fillStyle = '#b46d3e'; ctx.fillRect(26, 38, 12, 8); // burun
            ctx.fillStyle = '#582900'; ctx.fillRect(22, 48, 20, 6); // og'iz / soqol
        });

        // Skeleton Skull Face
        this.textures.skeletonFace = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#d1d5db'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#111827';
            ctx.fillRect(12, 22, 14, 14); // chap ko'z chuquri
            ctx.fillRect(38, 22, 14, 14); // o'ng ko'z chuquri
            ctx.fillRect(28, 38, 8, 8);   // burun teshigi
            ctx.fillRect(16, 50, 32, 8);  // og'iz tishlari
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(24, 50, 4, 8); ctx.fillRect(36, 50, 4, 8);
        });

        // Enderman Face
        this.textures.endermanFace = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#090a0f'; ctx.fillRect(0, 0, w, h);
            // Binafsha yonuvchi ko'zlar
            ctx.fillStyle = '#e040fb';
            ctx.fillRect(8, 28, 18, 8);
            ctx.fillRect(38, 28, 18, 8);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(16, 30, 6, 4);
            ctx.fillRect(42, 30, 6, 4);
        });

        // Zombie Face
        this.textures.zombieFace = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#4f772d'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#283618'; ctx.fillRect(0, 0, w, 20); // yashil-jigarrang soch
            ctx.fillRect(0, 20, 8, 16); ctx.fillRect(w - 8, 20, 8, 16);
            ctx.fillStyle = '#1b3211';
            ctx.fillRect(14, 28, 10, 8); ctx.fillRect(40, 28, 10, 8); // ko'z
            ctx.fillRect(26, 40, 12, 6); // burun
            ctx.fillRect(20, 50, 24, 6); // og'iz
        });

        // Creeper Face
        this.textures.creeperFace = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#38b000'; ctx.fillRect(0, 0, w, h);
            // piksellar
            for (let x = 0; x < 64; x += 8) {
                for (let y = 0; y < 64; y += 8) {
                    if ((x + y) % 16 === 0) {
                        ctx.fillStyle = '#2d6a4f'; ctx.fillRect(x, y, 8, 8);
                    }
                }
            }
            // Classic Creeper yuz
            ctx.fillStyle = '#081c15';
            ctx.fillRect(12, 16, 12, 14); // ko'zlar
            ctx.fillRect(40, 16, 12, 14);
            ctx.fillRect(24, 30, 16, 20); // burun va og'iz ustuni
            ctx.fillRect(16, 40, 8, 18);  // lab pastga
            ctx.fillRect(40, 40, 8, 18);
        });

        // TNT Block Texture
        this.textures.tntSide = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 20, w, 24); // oq belbog'
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TNT', w / 2, h / 2 + 1);
        });

        // Sandiq (Chest) Texture
        this.textures.chestSide = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#b45309'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#292524'; ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, w - 4, h - 4);
            ctx.fillStyle = '#78350f'; ctx.fillRect(6, 6, w - 12, h - 12);
            ctx.fillStyle = '#ffd166'; ctx.fillRect(w / 2 - 4, h / 2 - 6, 8, 12); // qulf
            ctx.fillStyle = '#000000'; ctx.fillRect(w / 2 - 2, h / 2 - 2, 4, 4);
        });

        // Tosh Qal'a (Cobblestone) Texture
        this.textures.cobble = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
            for (let y = 0; y < 64; y += 16) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke();
                const shift = (y % 32 === 0) ? 0 : 16;
                for (let x = shift; x <= 64; x += 32) {
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke();
                }
            }
        });

        // Qor Zamin Texture
        this.textures.snow = this.createCanvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#e2e8f0';
            for (let i = 0; i < 16; i++) {
                const rx = (i * 17) % 64;
                const ry = (i * 29) % 64;
                ctx.fillRect(rx, ry, 3, 3);
            }
        });
    }

    // ==============================================================
    // 3D MUHIT VA ZAMINNI YARATISH
    // ==============================================================
    buildEnvironment() {
        // Eski muhitni tozalash
        if (this.groundMesh) this.scene.remove(this.groundMesh);
        if (this.sunMesh) this.scene.remove(this.sunMesh);
        if (this.cloudsGroup) this.scene.remove(this.cloudsGroup);

        const isGun = this.game.battleType === 'gun';
        const mapW = Math.max(1200, this.game.width);
        const mapH = Math.max(800, this.game.height);

        // 1. Zamin (Ground Plane)
        const groundTex = isGun ? this.textures.cobble : this.textures.snow;
        groundTex.wrapS = THREE.RepeatWrapping;
        groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(mapW / 40, mapH / 40);

        const groundGeo = new THREE.PlaneGeometry(mapW * 1.5, mapH * 1.5);
        const groundMat = new THREE.MeshStandardMaterial({
            map: groundTex,
            roughness: 0.85,
            metalness: 0.1
        });
        this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.y = 0;
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);

        // 2. Kvadrat Minecraft Quyosh (Square Sun Mesh)
        const sunGeo = new THREE.BoxGeometry(45, 45, 6);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.sunMesh.position.set(220, 380, -500);
        this.sunMesh.rotation.y = Math.PI * 0.15;
        this.scene.add(this.sunMesh);

        // Kvadrat quyoshning sariq nuri (Aura)
        const haloGeo = new THREE.BoxGeometry(75, 75, 2);
        const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff066, transparent: true, opacity: 0.45 });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.position.set(0, 0, -2);
        this.sunMesh.add(haloMesh);

        // 3. 3D Voxel Bulutlar (Drifting Voxel Clouds)
        this.cloudsGroup = new THREE.Group();
        this.cloudMeshes = [];
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const cloudShadowMat = new THREE.MeshStandardMaterial({ color: 0xc7d2fe, roughness: 0.9 });

        for (let i = 0; i < 14; i++) {
            const cw = 120 + Math.random() * 140;
            const ch = 16 + Math.random() * 10;
            const cd = 80 + Math.random() * 80;

            const cg = new THREE.Group();
            const topCloud = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), cloudMat);
            topCloud.position.y = ch / 2;
            cg.add(topCloud);

            const botCloud = new THREE.Mesh(new THREE.BoxGeometry(cw, 4, cd), cloudShadowMat);
            botCloud.position.y = 2;
            cg.add(botCloud);

            cg.position.set(
                (Math.random() - 0.5) * mapW * 2,
                240 + Math.random() * 60,
                (Math.random() - 0.5) * mapH * 2
            );
            cg.userData = { speed: 0.2 + Math.random() * 0.3 };
            this.cloudsGroup.add(cg);
            this.cloudMeshes.push(cg);
        }
        this.scene.add(this.cloudsGroup);

        // 4. Xarita atrofidagi Minecraft Blokli Devorlar va Pog'onali Tog'lar
        this.buildPerimeterChunkMountains(mapW, mapH);

        // 5. Xarita To'siqlari (Qal'alar, Sandiqlar, TNT)
        this.syncObstacles();
    }

    buildPerimeterChunkMountains(mapW, mapH) {
        const mountainGroup = new THREE.Group();
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });

        const halfW = mapW * 0.55;
        const halfH = mapH * 0.55;

        // Xaritani o'rab turgan tog' bloklari
        const step = 80;
        for (let x = -halfW; x <= halfW; x += step) {
            for (let z of [-halfH, halfH]) {
                const h = 60 + Math.abs(Math.sin(x * 0.02) * 90);
                const block = new THREE.Mesh(new THREE.BoxGeometry(step, h, step), stoneMat);
                block.position.set(x, h / 2, z);
                mountainGroup.add(block);

                const cap = new THREE.Mesh(new THREE.BoxGeometry(step + 1, 14, step + 1), snowCapMat);
                cap.position.set(x, h + 7, z);
                mountainGroup.add(cap);
            }
        }
        for (let z = -halfH; z <= halfH; z += step) {
            for (let x of [-halfW, halfW]) {
                const h = 60 + Math.abs(Math.cos(z * 0.02) * 90);
                const block = new THREE.Mesh(new THREE.BoxGeometry(step, h, step), stoneMat);
                block.position.set(x, h / 2, z);
                mountainGroup.add(block);

                const cap = new THREE.Mesh(new THREE.BoxGeometry(step + 1, 14, step + 1), snowCapMat);
                cap.position.set(x, h + 7, z);
                mountainGroup.add(cap);
            }
        }
        this.scene.add(mountainGroup);
    }

    // ==============================================================
    // 3D MINECRAFT PERSONAJI (STEVE, SKELETON, ENDERMAN, ZOMBIE, CREEPER)
    // ==============================================================
    createMinecraftCharacterMesh(charType, team, isGun) {
        const root = new THREE.Group();

        let headTex = this.textures.steveFace;
        let skinColor = 0xc68652;
        let shirtColor = (team === 'blue') ? 0x00a8a8 : 0xd90429;
        let pantsColor = 0x3a4bb2;
        let armColor = shirtColor;

        if (charType === 'skeleton') {
            headTex = this.textures.skeletonFace;
            skinColor = 0xd1d5db;
            shirtColor = 0xd1d5db;
            pantsColor = 0x9ca3af;
            armColor = 0xd1d5db;
        } else if (charType === 'enderman') {
            headTex = this.textures.endermanFace;
            skinColor = 0x090a0f;
            shirtColor = 0x090a0f;
            pantsColor = 0x090a0f;
            armColor = 0x090a0f;
        } else if (charType === 'zombie') {
            headTex = this.textures.zombieFace;
            skinColor = 0x4f772d;
            shirtColor = (team === 'blue') ? 0x00a8a8 : 0xd90429;
            pantsColor = 0x274c77;
            armColor = shirtColor;
        } else if (charType === 'creeper') {
            headTex = this.textures.creeperFace;
            skinColor = 0x38b000;
            shirtColor = 0x2d6a4f;
            pantsColor = 0x1b4332;
            armColor = 0x38b000;
        }

        const bodyGroup = new THREE.Group();
        root.add(bodyGroup);

        if (charType === 'creeper') {
            // Creeper: Katta tana va 4 ta oyoq
            const headGeo = new THREE.BoxGeometry(16, 16, 16);
            const headMatArray = [
                new THREE.MeshStandardMaterial({ color: skinColor }),
                new THREE.MeshStandardMaterial({ color: skinColor }),
                new THREE.MeshStandardMaterial({ color: skinColor }),
                new THREE.MeshStandardMaterial({ color: skinColor }),
                new THREE.MeshStandardMaterial({ map: headTex }), // Front
                new THREE.MeshStandardMaterial({ color: skinColor })
            ];
            const head = new THREE.Mesh(headGeo, headMatArray);
            head.position.y = 30;
            head.castShadow = true;
            bodyGroup.add(head);

            const bodyGeo = new THREE.BoxGeometry(14, 22, 10);
            const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 15;
            body.castShadow = true;
            bodyGroup.add(body);

            // 4 ta oyoq
            const legGeo = new THREE.BoxGeometry(6, 10, 6);
            const legMat = new THREE.MeshStandardMaterial({ color: pantsColor });
            const legs = [];
            const legPositions = [
                [-4, 5, 4], [4, 5, 4],
                [-4, 5, -4], [4, 5, -4]
            ];
            for (let pos of legPositions) {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(...pos);
                leg.castShadow = true;
                bodyGroup.add(leg);
                legs.push(leg);
            }
            root.userData = { bodyGroup, head, legs, charType, isCreeper: true };
            return root;
        }

        // Standard gumanoid personajlar (Steve, Skeleton, Enderman, Zombie)
        const isEnderman = (charType === 'enderman');
        const isSkeleton = (charType === 'skeleton');
        const isZombie = (charType === 'zombie');

        const scaleY = isEnderman ? 1.4 : 1.0;
        const limbW = (isSkeleton || isEnderman) ? 4 : 7;

        // 1. Torso (Gavda)
        let torso;
        if (isSkeleton) {
            // Skeleton: Qovurg'alar va ichki bo'shliq (Hollow ribcage)
            const torsoGroup = new THREE.Group();
            const spine = new THREE.Mesh(new THREE.BoxGeometry(3, 24, 3), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
            spine.position.y = 20;
            torsoGroup.add(spine);

            // Qovurg'alar
            const ribMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db });
            for (let r = 0; r < 4; r++) {
                const rib = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 8), ribMat);
                rib.position.y = 12 + r * 5;
                torsoGroup.add(rib);
            }
            torso = torsoGroup;
            bodyGroup.add(torso);
        } else {
            const torsoGeo = new THREE.BoxGeometry(14, 22 * scaleY, 9);
            const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor });
            torso = new THREE.Mesh(torsoGeo, torsoMat);
            torso.position.y = 20 * scaleY;
            torso.castShadow = true;
            bodyGroup.add(torso);
        }

        // 2. Head (Bosh)
        const headW = isEnderman ? 14 : 16;
        const headGeo = new THREE.BoxGeometry(headW, headW, headW);
        const headMatArray = [
            new THREE.MeshStandardMaterial({ color: skinColor }),
            new THREE.MeshStandardMaterial({ color: skinColor }),
            new THREE.MeshStandardMaterial({ color: skinColor }),
            new THREE.MeshStandardMaterial({ color: skinColor }),
            new THREE.MeshStandardMaterial({ map: headTex }), // Oldi
            new THREE.MeshStandardMaterial({ color: skinColor })
        ];
        const head = new THREE.Mesh(headGeo, headMatArray);
        head.position.y = (32 + headW / 2) * scaleY;
        head.castShadow = true;
        bodyGroup.add(head);

        // 3. Arms (Qo'llar) pivot nuqtalari bilan
        const armH = 22 * (isEnderman ? 1.5 : 1.0);
        const armGeo = new THREE.BoxGeometry(limbW, armH, limbW);
        const armMat = new THREE.MeshStandardMaterial({ color: armColor });

        const leftArmPivot = new THREE.Group();
        leftArmPivot.position.set(-9.5, 30 * scaleY, 0);
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.y = -armH / 2;
        leftArm.castShadow = true;
        leftArmPivot.add(leftArm);
        bodyGroup.add(leftArmPivot);

        const rightArmPivot = new THREE.Group();
        rightArmPivot.position.set(9.5, 30 * scaleY, 0);
        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.y = -armH / 2;
        rightArm.castShadow = true;
        rightArmPivot.add(rightArm);
        bodyGroup.add(rightArmPivot);

        // Zombie holati: Ikkala qo'l to'g'riga cho'zilgan
        if (isZombie) {
            leftArmPivot.rotation.x = -Math.PI / 2;
            rightArmPivot.rotation.x = -Math.PI / 2;
        }

        // 4. Qo'ldagi 3D Qurol (3D Weapon)
        const weaponGroup = new THREE.Group();
        if (isGun) {
            // 3D Avtomat / Miltiq (Assault Rifle)
            const bodyM = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 18), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
            bodyM.position.z = 6;
            weaponGroup.add(bodyM);

            const barrelM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 12), new THREE.MeshStandardMaterial({ color: 0x4b5563 }));
            barrelM.position.z = 18;
            weaponGroup.add(barrelM);

            const stockM = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5, 8), new THREE.MeshStandardMaterial({ color: 0x78350f }));
            stockM.position.z = -5;
            weaponGroup.add(stockM);

            const magM = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 4), new THREE.MeshStandardMaterial({ color: 0x111827 }));
            magM.position.set(0, -5, 5);
            magM.rotation.x = 0.2;
            weaponGroup.add(magM);

            weaponGroup.position.set(0, -armH + 2, 6);
            rightArmPivot.add(weaponGroup);
        } else {
            // 3D Qor to'pi yoki Yoy
            const snowSphere = new THREE.Mesh(
                new THREE.SphereGeometry(4, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
            );
            snowSphere.position.set(0, -armH + 2, 4);
            weaponGroup.add(snowSphere);
            rightArmPivot.add(weaponGroup);
        }

        // 5. Legs (Oyoqlar) pivot nuqtalari bilan
        const legH = 22 * scaleY;
        const legGeo = new THREE.BoxGeometry(limbW, legH, limbW);
        const legMat = new THREE.MeshStandardMaterial({ color: pantsColor });

        const leftLegPivot = new THREE.Group();
        leftLegPivot.position.set(-3.8, 12 * scaleY, 0);
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.y = -legH / 2;
        leftLeg.castShadow = true;
        leftLegPivot.add(leftLeg);
        bodyGroup.add(leftLegPivot);

        const rightLegPivot = new THREE.Group();
        rightLegPivot.position.set(3.8, 12 * scaleY, 0);
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.y = -legH / 2;
        rightLeg.castShadow = true;
        rightLegPivot.add(rightLeg);
        bodyGroup.add(rightLegPivot);

        root.userData = {
            bodyGroup, head, torso,
            leftArmPivot, rightArmPivot,
            leftLegPivot, rightLegPivot,
            weaponGroup,
            charType, isZombie, isSkeleton, isEnderman
        };

        return root;
    }

    // ==============================================================
    // TO'SIQLARNI 3D MODEL SIFATIDA CHIQARISH
    // ==============================================================
    syncObstacles() {
        for (let m of this.obstacleMeshes) {
            this.scene.remove(m);
        }
        this.obstacleMeshes = [];

        const mapW = this.game.width || 1200;
        const mapH = this.game.height || 800;

        for (let obs of (this.game.obstacles || [])) {
            try {
                const ow = Number(obs.width) || (Number(obs.radius) ? Number(obs.radius) * 2 : 36);
                const oh = Number(obs.height) || (Number(obs.radius) ? Number(obs.radius) * 2 : 36);
                const ox = (Number(obs.x) || 0) + ow / 2 - mapW / 2;
                const oz = (Number(obs.y) || 0) + oh / 2 - mapH / 2;

                if (obs.type === 'fortress_blue' || obs.type === 'fortress_red') {
                    // 3D Qal'a (Stone Castle Fortress)
                    const fortGeo = new THREE.BoxGeometry(ow, 45, oh);
                    const fortMat = new THREE.MeshStandardMaterial({
                        map: this.textures.cobble,
                        roughness: 0.8
                    });
                    const fortMesh = new THREE.Mesh(fortGeo, fortMat);
                    fortMesh.position.set(ox, 22.5, oz);
                    fortMesh.castShadow = true;
                    fortMesh.receiveShadow = true;

                    // Qal'a tishlari (Crenellations)
                    for (let step = -ow / 2 + 10; step < ow / 2; step += 24) {
                        const tooth = new THREE.Mesh(new THREE.BoxGeometry(14, 12, oh + 2), fortMat);
                        tooth.position.set(step, 28, 0);
                        fortMesh.add(tooth);
                    }

                    this.scene.add(fortMesh);
                    this.obstacleMeshes.push(fortMesh);
                } else if (obs.type === 'tnt') {
                    // 3D Qizil TNT bloki
                    const tntGeo = new THREE.BoxGeometry(ow, 32, oh);
                    const tntMatArray = [
                        new THREE.MeshStandardMaterial({ map: this.textures.tntSide }),
                        new THREE.MeshStandardMaterial({ map: this.textures.tntSide }),
                        new THREE.MeshStandardMaterial({ color: 0x991b1b }), // usti
                        new THREE.MeshStandardMaterial({ color: 0x7f1d1d }), // pasti
                        new THREE.MeshStandardMaterial({ map: this.textures.tntSide }),
                        new THREE.MeshStandardMaterial({ map: this.textures.tntSide })
                    ];
                    const tntMesh = new THREE.Mesh(tntGeo, tntMatArray);
                    tntMesh.position.set(ox, 16, oz);
                    tntMesh.castShadow = true;
                    this.scene.add(tntMesh);
                    this.obstacleMeshes.push(tntMesh);
                } else if (obs.type === 'chest') {
                    // 3D Yog'och Sandiq (Chest)
                    const chestGeo = new THREE.BoxGeometry(ow, 28, oh);
                    const chestMat = new THREE.MeshStandardMaterial({ map: this.textures.chestSide });
                    const chestMesh = new THREE.Mesh(chestGeo, chestMat);
                    chestMesh.position.set(ox, 14, oz);
                    chestMesh.castShadow = true;
                    this.scene.add(chestMesh);
                    this.obstacleMeshes.push(chestMesh);
                } else if (obs.type === 'mc_tree' || obs.type === 'grand_tree') {
                    // 3D Minecraft Archasi (Blocky Tree)
                    const treeGroup = new THREE.Group();
                    const isGrand = (obs.type === 'grand_tree');
                    const trunkH = isGrand ? 55 : 36;
                    const trunkW = isGrand ? 16 : 10;
                    const trunk = new THREE.Mesh(
                        new THREE.BoxGeometry(trunkW, trunkH, trunkW),
                        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
                    );
                    trunk.position.y = trunkH / 2;
                    trunk.castShadow = true;
                    treeGroup.add(trunk);

                    const leavesW = isGrand ? 65 : 44;
                    const leavesH = isGrand ? 50 : 32;
                    const leaves = new THREE.Mesh(
                        new THREE.BoxGeometry(leavesW, leavesH, leavesW),
                        new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 })
                    );
                    leaves.position.y = trunkH + leavesH / 2 - 8;
                    leaves.castShadow = true;
                    treeGroup.add(leaves);

                    treeGroup.position.set(ox, 0, oz);
                    this.scene.add(treeGroup);
                    this.obstacleMeshes.push(treeGroup);
                } else if (obs.type === 'watchtower') {
                    // 3D Qorovul Minorasi (Watchtower)
                    const towerGeo = new THREE.CylinderGeometry(ow / 2, ow / 2, 55, 10);
                    const towerMat = new THREE.MeshStandardMaterial({ map: this.textures.cobble, roughness: 0.8 });
                    const towerMesh = new THREE.Mesh(towerGeo, towerMat);
                    towerMesh.position.set(ox, 27.5, oz);
                    towerMesh.castShadow = true;
                    this.scene.add(towerMesh);
                    this.obstacleMeshes.push(towerMesh);
                } else if (obs.type === 'snowman') {
                    // 3D Qorbola (Snowman)
                    const smGroup = new THREE.Group();
                    const smMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
                    const botSphere = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 8), smMat);
                    botSphere.position.y = 14;
                    smGroup.add(botSphere);

                    const topSphere = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 8), smMat);
                    topSphere.position.y = 32;
                    smGroup.add(topSphere);

                    smGroup.position.set(ox, 0, oz);
                    this.scene.add(smGroup);
                    this.obstacleMeshes.push(smGroup);
                } else {
                    // Boshqa tosh / devor to'siqlari
                    const bGeo = new THREE.BoxGeometry(ow, 30, oh);
                    const bMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
                    const bMesh = new THREE.Mesh(bGeo, bMat);
                    bMesh.position.set(ox, 15, oz);
                    bMesh.castShadow = true;
                    this.scene.add(bMesh);
                    this.obstacleMeshes.push(bMesh);
                }
            } catch (err) {
                console.warn("To'siq 3D render xatosi:", err);
            }
        }
    }

    // ==============================================================
    // O'YINCHILAR VA ANIMATSIYANI YANGILASH
    // ==============================================================
    updatePlayers() {
        const activeIds = new Set();
        const mapW = this.game.width;
        const mapH = this.game.height;

        for (let [id, p] of this.game.players) {
            activeIds.add(id);

            let meshGroup = this.playerMeshes.get(id);
            if (!meshGroup) {
                meshGroup = this.createMinecraftCharacterMesh(
                    p.characterType || 'steve',
                    p.team,
                    this.game.battleType === 'gun'
                );
                this.scene.add(meshGroup);
                this.playerMeshes.set(id, meshGroup);
            }

            // Koordinata va burilish
            const targetX = p.x - mapW / 2;
            const targetZ = p.y - mapH / 2;
            meshGroup.position.set(targetX, 0, targetZ);
            meshGroup.rotation.y = -p.angle + Math.PI / 2;

            // Yurish animatsiyasi (Walking cycle)
            const ud = meshGroup.userData;
            if (p.isMoving && !p.isDead) {
                const walk = p.walkCycle || 0;
                if (ud.isCreeper) {
                    if (ud.legs) {
                        ud.legs[0].rotation.x = Math.sin(walk) * 0.6;
                        ud.legs[1].rotation.x = -Math.sin(walk) * 0.6;
                        ud.legs[2].rotation.x = -Math.sin(walk) * 0.6;
                        ud.legs[3].rotation.x = Math.sin(walk) * 0.6;
                    }
                } else {
                    if (ud.leftLegPivot) ud.leftLegPivot.rotation.x = Math.sin(walk) * 0.75;
                    if (ud.rightLegPivot) ud.rightLegPivot.rotation.x = -Math.sin(walk) * 0.75;

                    if (!ud.isZombie) {
                        if (ud.leftArmPivot) ud.leftArmPivot.rotation.x = -Math.sin(walk) * 0.75;
                        // Qurolli qo'l nishonga qarab turadi
                        if (ud.rightArmPivot) {
                            ud.rightArmPivot.rotation.x = (this.game.battleType === 'gun') ? -Math.PI / 3 : Math.sin(walk) * 0.4;
                        }
                    }
                }
                if (ud.bodyGroup) {
                    ud.bodyGroup.position.y = Math.abs(Math.sin(walk * 2)) * 1.5;
                }
            } else {
                // Turganda qo'l-oyoqlarni joyiga qaytarish
                if (ud.leftLegPivot) ud.leftLegPivot.rotation.x = 0;
                if (ud.rightLegPivot) ud.rightLegPivot.rotation.x = 0;
                if (!ud.isZombie && ud.leftArmPivot) ud.leftArmPivot.rotation.x = 0;
                if (!ud.isZombie && ud.rightArmPivot) {
                    ud.rightArmPivot.rotation.x = (this.game.battleType === 'gun') ? -Math.PI / 3 : 0;
                }
                if (ud.bodyGroup) ud.bodyGroup.position.y = 0;
            }

            // O'lgan bo'lsa erga yotqizish
            if (p.isDead) {
                meshGroup.rotation.x = Math.PI / 2;
                meshGroup.position.y = 5;
            } else {
                meshGroup.rotation.x = 0;
                meshGroup.position.y = 0;
            }

            // Agar 1-litso (FPS) bo'lsa va bu mahalliy o'yinchi bo'lsa, uni yashirish yoki faqat qo'lini ko'rsatish
            if (id === this.game.playerId && this.cameraMode === 'first_person') {
                meshGroup.visible = false;
            } else {
                meshGroup.visible = true;
            }
        }

        // Ketgan o'yinchilar modellarini o'chirish
        for (let [id, mesh] of this.playerMeshes) {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                this.playerMeshes.delete(id);
            }
        }
    }

    // ==============================================================
    // 3D QOR TO'PLARI VA O'QLAR (PROJECTILES)
    // ==============================================================
    updateProjectiles() {
        const activeIds = new Set();
        const mapW = this.game.width;
        const mapH = this.game.height;

        for (let i = 0; i < this.game.snowballs.length; i++) {
            const ball = this.game.snowballs[i];
            const pId = 'proj_' + i;
            activeIds.add(pId);

            let mesh = this.projectileMeshes.get(pId);
            if (!mesh) {
                if (this.game.battleType === 'gun') {
                    // Oltin rangli 3D O'q (Tracer bullet)
                    const bGeo = new THREE.CylinderGeometry(1.2, 1.2, 10, 6);
                    const bMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
                    mesh = new THREE.Mesh(bGeo, bMat);
                    mesh.rotation.x = Math.PI / 2;
                } else {
                    // Oq 3D Qor to'pi
                    const sGeo = new THREE.SphereGeometry(ball.radius || 6, 8, 8);
                    const sMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
                    mesh = new THREE.Mesh(sGeo, sMat);
                }
                this.scene.add(mesh);
                this.projectileMeshes.set(pId, mesh);
            }

            const bx = ball.x - mapW / 2;
            const bz = ball.y - mapH / 2;
            const by = 22 + (ball.z || 0);
            mesh.position.set(bx, by, bz);

            if (this.game.battleType === 'gun') {
                const angle = Math.atan2(ball.vy, ball.vx);
                mesh.rotation.y = -angle;
            }
        }

        for (let [id, mesh] of this.projectileMeshes) {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                this.projectileMeshes.delete(id);
            }
        }
    }

    // ==============================================================
    // 3D OLTIN TANGALAR (COINS)
    // ==============================================================
    updateCoins() {
        const activeIds = new Set();
        const mapW = this.game.width;
        const mapH = this.game.height;
        const time = performance.now() * 0.003;

        for (let i = 0; i < this.game.groundCoins.length; i++) {
            const coin = this.game.groundCoins[i];
            const cId = 'coin_' + i;
            activeIds.add(cId);

            let mesh = this.coinMeshes.get(cId);
            if (!mesh) {
                const coinGeo = new THREE.CylinderGeometry(6, 6, 2, 10);
                const coinMat = new THREE.MeshStandardMaterial({
                    color: 0xffd166,
                    metalness: 0.8,
                    roughness: 0.2
                });
                mesh = new THREE.Mesh(coinGeo, coinMat);
                mesh.rotation.x = Math.PI / 2;
                this.scene.add(mesh);
                this.coinMeshes.set(cId, mesh);
            }

            const cx = coin.x - mapW / 2;
            const cz = coin.y - mapH / 2;
            const cy = 10 + Math.sin(time * 3 + i) * 3;
            mesh.position.set(cx, cy, cz);
            mesh.rotation.z += 0.04;
        }

        for (let [id, mesh] of this.coinMeshes) {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                this.coinMeshes.delete(id);
            }
        }
    }

    // ==============================================================
    // KAMERA BOSHQARUVI (3D 3-LITSO / 1-LITSO / TOP-DOWN)
    // ==============================================================
    updateCamera() {
        const p = this.game.localPlayer;
        if (!p || !this.camera) return;

        const mapW = this.game.width;
        const mapH = this.game.height;
        const pWorldX = p.x - mapW / 2;
        const pWorldZ = p.y - mapH / 2;

        const yaw = p.angle; // O'yinchining burchagi
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);

        if (this.cameraMode === 'third_person') {
            // 3D 3-Litso: Haqiqiy Minecraft 3D ko'rinishi (Orqa yelkadan)
            const camDistance = 120;
            const camHeight = 55;
            const shoulderRight = 14;

            const rightX = -sinY * shoulderRight;
            const rightZ = cosY * shoulderRight;

            const camX = pWorldX - cosY * camDistance + rightX;
            const camY = camHeight;
            const camZ = pWorldZ - sinY * camDistance + rightZ;

            // Silliq kamera
            this.camera.position.x += (camX - this.camera.position.x) * 0.35;
            this.camera.position.y += (camY - this.camera.position.y) * 0.35;
            this.camera.position.z += (camZ - this.camera.position.z) * 0.35;

            const lookTargetX = pWorldX + cosY * 120;
            const lookTargetY = 24;
            const lookTargetZ = pWorldZ + sinY * 120;
            this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
        } else if (this.cameraMode === 'first_person') {
            // 3D 1-Litso FPS: Ko'z balandligida
            const eyeY = 32;
            this.camera.position.set(pWorldX, eyeY, pWorldZ);

            const lookTargetX = pWorldX + cosY * 150;
            const lookTargetY = eyeY + Math.tan(-this.cameraPitch) * 50;
            const lookTargetZ = pWorldZ + sinY * 150;
            this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
        } else {
            // 3D Tepadan (Top-down Isometric)
            const topHeight = 360;
            this.camera.position.set(pWorldX, topHeight, pWorldZ + 140);
            this.camera.lookAt(pWorldX, 0, pWorldZ);
        }
    }

    // ==============================================================
    // ASOSIY FRAME RENDER QILISH (RENDER LOOP)
    // ==============================================================
    render() {
        if (!this.renderer || !this.scene || !this.camera) return;
        try {
            // 1. Bulutlarni sekin harakatlantirish
            for (let c of this.cloudMeshes) {
                c.position.x += c.userData.speed;
                if (c.position.x > this.game.width) {
                    c.position.x = -this.game.width;
                }
            }

            // 2. Personajlarni yangilash
            this.updatePlayers();

            // 3. To'plar va o'qlarni yangilash
            this.updateProjectiles();

            // 4. Tangalarni yangilash
            this.updateCoins();

            // 5. Kamerani yangilash
            this.updateCamera();

            // 6. WebGL 3D Chizish
            this.renderer.render(this.scene, this.camera);
        } catch (err) {
            console.warn('[ThreeEngine] Render frame warning:', err);
        }
    }
}

window.SnowClash3D = SnowClash3D;
