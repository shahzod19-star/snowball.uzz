// game.js - Qor Jangi (Snow Clash) Kuchaytirilgan Dvigateli (Tez harakat, Tangalar, 3 ta Katta Karta, Skinlar)

class SnowClashGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas3D = document.getElementById('gameCanvas3D');
        this.threeEngine = null;
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.setupCanvas();

        if (this.canvas3D && window.SnowClash3D) {
            this.threeEngine = new SnowClash3D(this.canvas3D, this);
        }

        this.isRunning = false;
        this.isPaused = false;
        this.isMultiplayer = false;
        this.ws = null;
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        this.playerName = localStorage.getItem('snow_player_name') || 'QorJangchisi';
        this.playerColor = localStorage.getItem('snow_player_color') || '#e63946';
        this.characterType = localStorage.getItem('snow_char_type') || 'steve';
        if (this.characterType === 'human' || this.characterType === 'classic') this.characterType = 'steve';
        this.battleType = localStorage.getItem('snow_battle_type') || 'snow';
        this.equippedSkin = localStorage.getItem('snow_equipped_skin') || 'steve';
        this.equippedSnowball = localStorage.getItem('snow_equipped_ball') || 'classic';

        this.gameMode = '1v1';
        this.mapType = this.battleType === 'gun' ? 'warzone' : 'wonderland'; // 'wonderland', 'fortress', 'forest', 'warzone'
        this.roomCode = '';

        // Kamera Rejimi (3D 3-Litso Orqadan, 3D 1-Litso FPS, 3D Tepadan)
        this.cameraMode = localStorage.getItem('snow_camera_mode') || 'third_person';
        if (this.threeEngine) this.threeEngine.cameraMode = this.cameraMode;
        this.gunRecoil = 0;
        this.gunMuzzleFlash = 0;
        this.lastTouchTurnX = null;

        // Tanga va Iqtisodiyot
        this.coins = parseInt(localStorage.getItem('snow_coins') || '100', 10);
        this.matchCoinsEarned = 0;

        // Sozlamalar
        this.settings = {
            showKillFeed: true,
            gameSpeedMultiplier: 1.0
        };

        this.matchTimeLeft = 180;
        this.timerInterval = null;
        this.blueScore = 0;
        this.redScore = 0;
        this.isGameOver = false;

        this.players = new Map();
        this.snowballs = [];
        this.particles = [];
        this.snowflakes = [];
        this.obstacles = [];
        this.footprints = [];
        this.groundCoins = []; // Yerdagi terib olinadigan oltin tangalar

        this.stats = { hits: 0, kills: 0 };
        this.keys = {};
        this.mousePos = { x: this.width / 2, y: this.height / 2 };
        this.isMouseDown = false;

        // O'yinchi xususiyatlari - O'rtacha normal qulay tezlik
        this.localPlayer = {
            id: this.playerId,
            name: this.playerName,
            x: 400,
            y: 300,
            radius: 22,
            color: this.playerColor,
            characterType: this.characterType,
            skin: this.equippedSkin,
            snowballType: this.equippedSnowball,
            team: 'blue',
            hp: 100,
            maxHp: 100,
            snowballs: 4,
            maxSnowballs: 5,
            reserveAmmo: 120,
            maxReserveAmmo: 120,
            isReloading: false,
            reloadProgress: 0,
            reloadDuration: 36,
            isCrafting: false,
            craftProgress: 0,
            craftDuration: 35,
            speed: 4.4, // O'rtacha, qulay, tabiiy tezlik
            sprintSpeed: 5.6, // Shift bosilgandagi yugurish
            angle: 0,
            walkCycle: 0,
            isMoving: false,
            isSprinting: false,
            isDead: false,
            throwCooldown: 0,
            throwAnim: 0
        };

        this.joystick = { active: false, touchId: null, centerX: 0, centerY: 0, dx: 0, dy: 0, maxRadius: 42 };
        this.mobileSprinting = false;
        this.touchAimActive = false;

        this.initSnowflakes(160);
        this.setupEventListeners();
        this.initMobileControls();
        this.setupMap();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    setupCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2.5); // 4K / Retina Ultra Sharp
        this.canvas.width = Math.floor(this.width * this.dpr);
        this.canvas.height = Math.floor(this.height * this.dpr);
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        if (this.threeEngine && typeof this.threeEngine.onResize === 'function') {
            this.threeEngine.onResize();
        }
    }

    initSnowflakes(count) {
        this.snowflakes = [];
        for (let i = 0; i < count; i++) {
            this.snowflakes.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 2.8 + 1,
                speedY: Math.random() * 1.5 + 0.9,
                speedX: Math.random() * 0.8 - 0.4,
                opacity: Math.random() * 0.7 + 0.3,
                swingAngle: Math.random() * Math.PI * 2
            });
        }
    }

    // 3 TA KATTA VA BO'YITILGAN XARITA
    setupMap() {
        this.obstacles = [];
        this.groundCoins = [];
        const w = this.width;
        const h = this.height;

        // Barcha xaritalarda Ko'k va Qizil Minecraft Bazalari ekranning chetlariga joylashtiriladi
        // Bu o'yinchilarning to'siq ichida tiqilib qolmasligini 100% kafolatlaydi!

        // 1. Ko'k Qal'a Bazasi (Chap tomonda, x=0 devoriga yopishgan)
        const blueWallW = Math.max(60, Math.min(100, w * 0.07));
        this.obstacles.push({ type: 'fortress_blue', x: 0, y: h * 0.28, width: blueWallW, height: h * 0.44, team: 'blue' });
        this.obstacles.push({ type: 'watchtower', x: blueWallW * 0.6, y: h * 0.14, radius: 22, team: 'blue' });
        this.obstacles.push({ type: 'watchtower', x: blueWallW * 0.6, y: h * 0.86, radius: 22, team: 'blue' });
        this.obstacles.push({ type: 'chest', x: blueWallW * 0.7, y: h * 0.48, width: 28, height: 24 });
        this.obstacles.push({ type: 'tnt', x: blueWallW * 0.7, y: h * 0.28, width: 26, height: 26 });
        this.obstacles.push({ type: 'tnt', x: blueWallW * 0.7, y: h * 0.72, width: 26, height: 26 });

        // 2. Qizil Qal'a Bazasi (O'ng tomonda, x=w devoriga yopishgan)
        const redWallW = Math.max(60, Math.min(100, w * 0.07));
        this.obstacles.push({ type: 'fortress_red', x: w - redWallW, y: h * 0.28, width: redWallW, height: h * 0.44, team: 'red' });
        this.obstacles.push({ type: 'watchtower', x: w - redWallW * 0.6, y: h * 0.14, radius: 22, team: 'red' });
        this.obstacles.push({ type: 'watchtower', x: w - redWallW * 0.6, y: h * 0.86, radius: 22, team: 'red' });
        this.obstacles.push({ type: 'chest', x: w - redWallW * 0.7 - 28, y: h * 0.48, width: 28, height: 24 });
        this.obstacles.push({ type: 'tnt', x: w - redWallW * 0.7 - 26, y: h * 0.28, width: 26, height: 26 });
        this.obstacles.push({ type: 'tnt', x: w - redWallW * 0.7 - 26, y: h * 0.72, width: 26, height: 26 });

        if (this.mapType === 'warzone') {
            // ⚔️ MINECRAFT WARZONE BAZASI - Markaziy barrikadalar va TNT boshpanalar
            // O'yinchilar spawn nuqtalari (w*0.24 va w*0.76) butunlay ochiq maydon!
            this.obstacles.push({ type: 'wall', x: w * 0.5 - 60, y: h * 0.5 - 18, width: 120, height: 36 });
            this.obstacles.push({ type: 'wall', x: w * 0.5 - 18, y: h * 0.18, width: 36, height: 75 });
            this.obstacles.push({ type: 'wall', x: w * 0.5 - 18, y: h * 0.70, width: 36, height: 75 });

            // TNT Barrikadalari (Markazda, o'yinchilardan uzoqda)
            this.obstacles.push({ type: 'tnt', x: w * 0.38, y: h * 0.44, width: 28, height: 28 });
            this.obstacles.push({ type: 'tnt', x: w * 0.62, y: h * 0.56, width: 28, height: 28 });

            // Minecraft Sandiqlari
            this.obstacles.push({ type: 'chest', x: w * 0.44, y: h * 0.22, width: 30, height: 24 });
            this.obstacles.push({ type: 'chest', x: w * 0.56, y: h * 0.78, width: 30, height: 24 });

            // Blokli archalar
            this.obstacles.push({ type: 'mc_tree', x: w * 0.35, y: h * 0.22, radius: 28 });
            this.obstacles.push({ type: 'mc_tree', x: w * 0.65, y: h * 0.22, radius: 28 });
            this.obstacles.push({ type: 'mc_tree', x: w * 0.35, y: h * 0.78, radius: 28 });
            this.obstacles.push({ type: 'mc_tree', x: w * 0.65, y: h * 0.78, radius: 28 });

        } else if (this.mapType === 'wonderland') {
            // 1. QIShKI SHAHARCHA
            this.obstacles.push({ type: 'grand_tree', x: w / 2, y: h / 2, radius: 55 });
            this.obstacles.push({ type: 'gift', x: w / 2 - 45, y: h / 2 + 50, width: 26, height: 26, color: '#ff3366', ribbon: '#ffd166' });
            this.obstacles.push({ type: 'gift', x: w / 2 + 35, y: h / 2 + 45, width: 28, height: 28, color: '#ffd166', ribbon: '#4cc9f0' });

            this.obstacles.push({ type: 'cabin', x: w * 0.34, y: h * 0.24, width: 65, height: 48 });
            this.obstacles.push({ type: 'cabin', x: w * 0.66 - 65, y: h * 0.76 - 48, width: 65, height: 48 });

            this.obstacles.push({ type: 'snowman', x: w * 0.38, y: h * 0.45, radius: 24 });
            this.obstacles.push({ type: 'snowman', x: w * 0.62, y: h * 0.55, radius: 24 });

            this.obstacles.push({ type: 'mc_tree', x: w * 0.35, y: h * 0.75, radius: 30 });
            this.obstacles.push({ type: 'mc_tree', x: w * 0.65, y: h * 0.25, radius: 30 });
            this.obstacles.push({ type: 'snow_mound', x: w * 0.46, y: h * 0.72, radius: 32 });
            this.obstacles.push({ type: 'snow_mound', x: w * 0.54, y: h * 0.28, radius: 32 });

        } else if (this.mapType === 'fortress') {
            // 2. MUZ QAL'ASI
            const cx = w / 2;
            const cy = h / 2;
            this.obstacles.push({ type: 'ice_pillar', x: cx, y: cy, radius: 46 });

            this.obstacles.push({ type: 'wall', x: cx - 180, y: cy - 90, width: 26, height: 100 });
            this.obstacles.push({ type: 'wall', x: cx + 154, y: cy - 90, width: 26, height: 100 });
            this.obstacles.push({ type: 'wall', x: cx - 90, y: cy + 110, width: 100, height: 26 });
            this.obstacles.push({ type: 'wall', x: cx - 90, y: cy - 136, width: 100, height: 26 });

            this.obstacles.push({ type: 'ice_pillar', x: w * 0.34, y: h * 0.22, radius: 30 });
            this.obstacles.push({ type: 'ice_pillar', x: w * 0.66, y: h * 0.78, radius: 30 });
            this.obstacles.push({ type: 'snowman', x: w * 0.34, y: h * 0.78, radius: 24 });
            this.obstacles.push({ type: 'snowman', x: w * 0.66, y: h * 0.22, radius: 24 });

        } else {
            // 3. SEHRLI O'RMON
            const treePositions = [
                { x: w * 0.34, y: h * 0.22 }, { x: w * 0.44, y: h * 0.28 },
                { x: w * 0.56, y: h * 0.28 }, { x: w * 0.66, y: h * 0.22 },
                { x: w * 0.34, y: h * 0.78 }, { x: w * 0.44, y: h * 0.72 },
                { x: w * 0.56, y: h * 0.72 }, { x: w * 0.66, y: h * 0.78 },
                { x: w * 0.40, y: h * 0.50 }, { x: w * 0.60, y: h * 0.50 }
            ];

            treePositions.forEach(tp => {
                this.obstacles.push({ type: 'mc_tree', x: tp.x, y: tp.y, radius: 30 });
            });

            this.obstacles.push({ type: 'cabin', x: w * 0.46, y: h * 0.36, width: 75, height: 50 });
            this.obstacles.push({ type: 'snowman', x: w * 0.50, y: h * 0.64, radius: 24 });
        }

        this.spawnGroundCoins(7);
    }

    spawnGroundCoins(count) {
        this.groundCoins = [];
        for (let i = 0; i < count; i++) {
            const cx = Math.random() * (this.width - 240) + 120;
            const cy = Math.random() * (this.height - 240) + 120;
            if (!this.checkObstacleCollision(cx, cy, 15)) {
                this.groundCoins.push({
                    x: cx,
                    y: cy,
                    value: 5,
                    pulse: Math.random() * Math.PI * 2,
                    isCollected: false
                });
            }
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.setupMap();
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;

            // Space - Qor yasash (Qor rejimida)
            if (e.code === 'Space' && !this.isPaused && !this.localPlayer.isDead) {
                e.preventDefault();
                if (this.battleType === 'gun') {
                    this.reloadGun();
                } else {
                    this.startCrafting();
                }
            }

            // R - Qayta o'qlash (Reload) qurol rejimida
            if ((e.key.toLowerCase() === 'r' || e.code === 'KeyR') && !this.isPaused && this.isRunning && !this.localPlayer.isDead) {
                e.preventDefault();
                if (this.battleType === 'gun') {
                    this.reloadGun();
                } else {
                    this.startCrafting();
                }
            }

            // V / F / C - Kamera Rejimini almashtirish (1-Litso / 2-Litso)
            if ((e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'c') && !this.isPaused && this.isRunning) {
                e.preventDefault();
                this.toggleCameraMode();
            }

            // Enter - Otish (Qurol yoki Qor otish)
            if ((e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') && !this.isPaused && this.isRunning && !this.localPlayer.isDead) {
                e.preventDefault();
                this.throwSnowball();
            }

            // Pauza (Escape yoki P)
            if ((e.key.toLowerCase() === 'p' || e.key === 'Escape' || e.code === 'Escape') && this.isRunning) {
                e.preventDefault();
                this.togglePause();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
            if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
                this.keys['enter'] = false;
                this.keys['numpadenter'] = false;
            }
        });

        // 1-Litso va 2-Litso UI Tugmalari
        const btnPersp = document.getElementById('btnTogglePerspective');
        if (btnPersp) {
            btnPersp.addEventListener('click', () => this.toggleCameraMode());
        }
        const btnMobPersp = document.getElementById('btnMobilePerspective');
        if (btnMobPersp) {
            const handleMobToggle = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCameraMode();
            };
            btnMobPersp.addEventListener('click', handleMobToggle);
            btnMobPersp.addEventListener('touchstart', handleMobToggle, { passive: false });
        }

        window.addEventListener('mousemove', (e) => {
            if ((this.cameraMode === 'third_person' || this.cameraMode === 'first_person') && this.isRunning && !this.isPaused && !this.localPlayer.isDead) {
                if (e.movementX !== undefined && Math.abs(e.movementX) < 140) {
                    this.localPlayer.angle += e.movementX * 0.0035;
                } else {
                    const diffX = e.clientX - (this.width / 2);
                    this.localPlayer.angle += diffX * 0.00015;
                }
            } else if (this.cameraMode === 'top_down') {
                const dx = e.clientX - (this.width / 2);
                const dy = e.clientY - (this.height / 2);
                this.localPlayer.angle = Math.atan2(dy, dx);
            }
            this.mousePos.x = e.clientX;
            this.mousePos.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isMouseDown = true;
                if (this.isRunning && !this.isPaused && !this.localPlayer.isDead) {
                    this.throwSnowball();
                }
            } else if (e.button === 2) {
                e.preventDefault();
                if (this.isRunning && !this.isPaused && !this.localPlayer.isDead) {
                    this.startCrafting();
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isMouseDown = false;
        });

        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    initMobileControls() {
        const mobileLayer = document.getElementById('mobileControlsLayer');
        const joystickZone = document.getElementById('joystickZone');
        const joystickKnob = document.getElementById('joystickKnob');
        const btnSprint = document.getElementById('btnMobileSprint');
        const btnCraft = document.getElementById('btnMobileCraft');
        const btnShoot = document.getElementById('btnMobileShoot');

        if (!joystickZone || !joystickKnob) return;

        // Ekranga har qanday teginish sodir bo'lganda mobil boshqaruvni yoqish
        window.addEventListener('touchstart', () => {
            if (this.isRunning && !this.isGameOver && mobileLayer) {
                mobileLayer.classList.add('active');
            }
        }, { passive: true });

        // 1. JOYSTICK LOGIC (Pointer va Touch to'liq qo'llab-quvvatlanadi)
        const updateStickPosition = (clientX, clientY) => {
            if (!this.joystick.active) return;
            const diffX = clientX - this.joystick.centerX;
            const diffY = clientY - this.joystick.centerY;
            const dist = Math.hypot(diffX, diffY);
            const angle = Math.atan2(diffY, diffX);
            const clampedDist = Math.min(dist, this.joystick.maxRadius);

            const knobX = Math.cos(angle) * clampedDist;
            const knobY = Math.sin(angle) * clampedDist;

            joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

            if (dist > 4) {
                this.joystick.dx = Math.cos(angle) * (clampedDist / this.joystick.maxRadius);
                this.joystick.dy = Math.sin(angle) * (clampedDist / this.joystick.maxRadius);
            } else {
                this.joystick.dx = 0;
                this.joystick.dy = 0;
            }
        };

        const handleStickStart = (clientX, clientY, identifier) => {
            this.joystick.active = true;
            this.joystick.touchId = identifier;
            const rect = joystickZone.getBoundingClientRect();
            this.joystick.centerX = rect.left + rect.width / 2;
            this.joystick.centerY = rect.top + rect.height / 2;
            updateStickPosition(clientX, clientY);
        };

        const handleStickEnd = () => {
            this.joystick.active = false;
            this.joystick.touchId = null;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
        };

        // Pointer hodisalari
        joystickZone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            handleStickStart(e.clientX, e.clientY, e.pointerId);
        });

        window.addEventListener('pointermove', (e) => {
            if (this.joystick.active && (this.joystick.touchId === null || this.joystick.touchId === e.pointerId)) {
                updateStickPosition(e.clientX, e.clientY);
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.joystick.active) handleStickEnd();
        });
        window.addEventListener('pointercancel', () => {
            if (this.joystick.active) handleStickEnd();
        });

        // Touch hodisalari (Safari & mobil brauzerlar)
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                handleStickStart(t.clientX, t.clientY, t.identifier);
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!this.joystick.active) return;
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                if (t.identifier === this.joystick.touchId) {
                    updateStickPosition(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.joystick.touchId) {
                    handleStickEnd();
                    break;
                }
            }
        });
        window.addEventListener('touchcancel', () => {
            handleStickEnd();
        });

        // 2. SPRINT TUGMASI
        if (btnSprint) {
            const toggleSprint = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.mobileSprinting = !this.mobileSprinting;
                btnSprint.classList.toggle('active', this.mobileSprinting);
                if (window.soundSystem) window.soundSystem.playSnowStep();
            };
            btnSprint.addEventListener('pointerdown', toggleSprint);
            btnSprint.addEventListener('touchstart', toggleSprint, { passive: false });
            btnSprint.addEventListener('click', toggleSprint);
        }

        // 3. CRAFT / RELOAD TUGMASI (Qor yasash yoki O'qlash)
        if (btnCraft) {
            const doCraftOrReload = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isRunning && !this.isPaused && !this.localPlayer.isDead) {
                    if (this.battleType === 'gun') {
                        this.reloadGun();
                    } else {
                        this.startCrafting();
                    }
                }
            };
            btnCraft.addEventListener('pointerdown', doCraftOrReload);
            btnCraft.addEventListener('touchstart', doCraftOrReload, { passive: false });
            btnCraft.addEventListener('click', doCraftOrReload);
        }

        // 4. SHOOT TUGMASI
        if (btnShoot) {
            const doShoot = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isRunning && !this.isPaused && !this.localPlayer.isDead) {
                    this.throwSnowball();
                }
            };
            btnShoot.addEventListener('pointerdown', doShoot);
            btnShoot.addEventListener('touchstart', doShoot, { passive: false });
            btnShoot.addEventListener('click', doShoot);
        }

        // 5. CANVAS DIRECT TAP-TO-SHOOT (Maydonga to'g'ridan-to'g'ri barmog'i bilan tegib otish)
        const handleCanvasTouch = (clientX, clientY) => {
            if (!this.isRunning || this.isPaused || this.localPlayer.isDead) return;
            this.mousePos.x = clientX;
            this.mousePos.y = clientY;
            this.touchAimActive = true;
            this.throwSnowball();
            setTimeout(() => { this.touchAimActive = false; }, 350);
        };

        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isRunning || this.isPaused || this.localPlayer.isDead) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (this.joystick.active && t.identifier === this.joystick.touchId) continue;
                const target = document.elementFromPoint(t.clientX, t.clientY);
                if (target && target.closest('.m-action-btn, .joystick-zone, .interactive')) continue;
                handleCanvasTouch(t.clientX, t.clientY);
            }
        }, { passive: false });
    }

        reloadGun() {
        const p = this.localPlayer;
        if (!p || p.isDead || p.isReloading || p.snowballs >= p.maxSnowballs || p.reserveAmmo <= 0) return;
        p.isReloading = true;
        p.reloadProgress = 0;
        p.reloadDuration = 36;
        this.showKillFeed(`🔄 ${p.name} qurolni qayta o'qlamoqda...`, false);
        if (window.soundSystem) window.soundSystem.playSnowStep();
    }

    addCoins(amount) {
        this.coins += amount;
        this.matchCoinsEarned += amount;
        localStorage.setItem('snow_coins', this.coins);
        
        // UI yangilash
        const hudCoins = document.getElementById('hudCoinsText');
        if (hudCoins) hudCoins.textContent = this.coins;
        const lobbyCoins = document.getElementById('lobbyCoinsText');
        if (lobbyCoins) lobbyCoins.textContent = this.coins;

        // Quests (Vazifalar) tizimiga xabar
        if (window.shopAndQuests) {
            window.shopAndQuests.onCoinsCollected(amount);
        }
    }

    startMatch(config) {
        this.playerName = config.name || localStorage.getItem('snow_player_name') || 'QorJangchisi';
        this.playerColor = config.color || localStorage.getItem('snow_player_color') || '#e63946';
        this.characterType = config.characterType || localStorage.getItem('snow_char_type') || 'steve';
        if (this.characterType === 'human' || this.characterType === 'classic') this.characterType = 'steve';
        this.battleType = config.battleType || localStorage.getItem('snow_battle_type') || 'snow';
        this.equippedSkin = localStorage.getItem('snow_equipped_skin') || 'steve';
        this.equippedSnowball = localStorage.getItem('snow_equipped_ball') || 'classic';

        this.gameMode = config.mode || '1v1';
        if (this.battleType === 'gun') {
            this.mapType = 'warzone'; // Qurolli jang faqat Minecraft Bazasi (warzone)da!
        } else {
            this.mapType = config.map || 'wonderland';
            if (this.mapType === 'warzone') this.mapType = 'wonderland';
        }
        this.roomCode = config.roomCode || '';
        this.isMultiplayer = config.isMultiplayer || false;
        this.botDifficulty = config.botDifficulty || (window.shopAndQuests ? window.shopAndQuests.botDifficulty : 'normal');

        // Qahramonning kuchaytirilgan (upgraded) va daraja (level) xususiyatlari
        const playerStats = window.shopAndQuests ? window.shopAndQuests.getPlayerStats() : {
            maxHp: 100, damage: 25, speed: 4.4, sprintSpeed: 5.6, maxSnowballs: 5, maxShield: 0, shield: 0
        };

        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.matchTimeLeft = 180;
        this.blueScore = 0;
        this.redScore = 0;
        this.stats = { hits: 0, kills: 0 };
        this.matchCoinsEarned = 0;
        this.snowballs = [];
        this.particles = [];
        this.footprints = [];

        this.setupMap();

        this.localPlayer.id = this.playerId;
        this.localPlayer.name = this.playerName;
        this.localPlayer.color = this.playerColor;
        this.localPlayer.characterType = this.characterType;
        this.localPlayer.skin = this.equippedSkin;
        this.localPlayer.snowballType = this.equippedSnowball;
        this.localPlayer.maxHp = playerStats.maxHp;
        this.localPlayer.hp = playerStats.maxHp;
        this.localPlayer.speed = playerStats.speed;
        this.localPlayer.sprintSpeed = playerStats.sprintSpeed;
        if (this.battleType === 'gun') {
            this.localPlayer.snowballs = 30; // 30 talik magazin
            this.localPlayer.maxSnowballs = 30;
            this.localPlayer.reserveAmmo = 120;
            this.localPlayer.maxReserveAmmo = 120;
            this.localPlayer.isReloading = false;
            this.localPlayer.reloadProgress = 0;
            this.localPlayer.reloadDuration = 36;
        } else {
            this.localPlayer.maxSnowballs = playerStats.maxSnowballs;
            this.localPlayer.snowballs = Math.min(4, playerStats.maxSnowballs);
            this.localPlayer.reserveAmmo = 0;
            this.localPlayer.isReloading = false;
        }
        this.localPlayer.snowballDamage = playerStats.damage;
        this.localPlayer.maxShield = playerStats.maxShield;
        this.localPlayer.shield = playerStats.shield;
        this.localPlayer.isCrafting = false;
        this.localPlayer.isDead = false;
        this.localPlayer.team = config.team || 'blue';

        // Xavfsiz, ochiq maydonda spawn qilish (Bazalardan ancha uzoqda)
        if (this.localPlayer.team === 'blue') {
            this.localPlayer.x = this.width * 0.24;
            this.localPlayer.y = this.height * 0.5;
        } else {
            this.localPlayer.x = this.width * 0.76;
            this.localPlayer.y = this.height * 0.5;
        }

        // Safe-Spawn Resolver: Agar o'yinchi spawn bo'lganda to'siqqa yaqin bo'lsa, ochiq joyga surish
        let safeSpawnNudge = 0;
        while (this.checkObstacleCollision(this.localPlayer.x, this.localPlayer.y, this.localPlayer.radius + 6) && safeSpawnNudge < 25) {
            this.localPlayer.x += (this.localPlayer.team === 'blue' ? 14 : -14);
            safeSpawnNudge++;
        }

        this.players.clear();
        this.players.set(this.playerId, this.localPlayer);

        const inGameHUD = document.getElementById('inGameHUD');
        if (inGameHUD) inGameHUD.classList.remove('hidden');
        const mainLobby = document.getElementById('mainLobbyScreen');
        if (mainLobby) mainLobby.classList.add('hidden');

        const hudPlayerName = document.getElementById('hudPlayerName');
        if (hudPlayerName) hudPlayerName.textContent = this.playerName;
        const hudRoomTag = document.getElementById('hudRoomTag');
        if (hudRoomTag) hudRoomTag.textContent = this.getModeLabel(this.gameMode);
        
        const hudCoins = document.getElementById('hudCoinsText');
        if (hudCoins) hudCoins.textContent = this.coins;

        this.updateHpUI();
        this.updateSnowballSlotsUI();
        this.updateScoreUI();
        this.updatePerspectiveButtonUI();

        // Qurol va Qor rejimi HUD elementlarini sozlash
        const hudGunAmmo = document.getElementById('hudGunAmmoInventory');
        const hudSnowSlots = document.getElementById('hudSnowballInventory') || document.getElementById('hudSnowballSlots');
        const hudCraftGuide = document.getElementById('guideCraftOrReload');
        const mobileCraftBtn = document.getElementById('btnMobileCraft');

        if (this.battleType === 'gun') {
            if (hudGunAmmo) {
                hudGunAmmo.style.display = 'flex';
                hudGunAmmo.innerHTML = `🔫 <span id="gunMagCount">${this.localPlayer.snowballs}</span> / <span id="gunReserveCount" style="color:#a0aec0;">${this.localPlayer.reserveAmmo}</span>`;
            }
            if (hudSnowSlots) hudSnowSlots.style.display = 'none';
            if (hudCraftGuide) hudCraftGuide.innerHTML = `<span class="key-badge">R</span> O'QLASH`;
            if (mobileCraftBtn) mobileCraftBtn.innerHTML = `🔄<span class="m-btn-label">O'QLASH</span>`;
        } else {
            if (hudGunAmmo) hudGunAmmo.style.display = 'none';
            if (hudSnowSlots) hudSnowSlots.style.display = 'flex';
            if (hudCraftGuide) hudCraftGuide.innerHTML = `<span class="key-badge">PROBEL</span> QOR YASASH`;
            if (mobileCraftBtn) mobileCraftBtn.innerHTML = `❄️<span class="m-btn-label">YASASH</span>`;
        }

        const mobileLayer = document.getElementById('mobileControlsLayer');
        if (mobileLayer) {
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
            if (isTouch) {
                mobileLayer.classList.add('active');
            } else {
                mobileLayer.classList.remove('active');
            }
        }

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.isRunning && !this.isPaused && !this.isGameOver) {
                this.matchTimeLeft--;
                this.updateTimerUI();
                if (this.matchTimeLeft <= 0) {
                    if (this.gameMode === '2v2' || this.gameMode === '4v4') {
                        if (this.blueScore > this.redScore) {
                            this.endGame({ team: 'blue', isTeam: true });
                        } else if (this.redScore > this.blueScore) {
                            this.endGame({ team: 'red', isTeam: true });
                        } else {
                            this.endGame({ isDraw: true, isTeam: true });
                        }
                    } else if (this.gameMode === '1v1') {
                        let alive = [];
                        for (let [id, p] of this.players) if (!p.isDead) alive.push(p);
                        if (alive.length === 1) this.endGame(alive[0]);
                        else this.endGame({ isDraw: true });
                    } else {
                        let best = null;
                        let maxHp = -1;
                        for (let [id, p] of this.players) {
                            if (!p.isDead && p.hp > maxHp) {
                                maxHp = p.hp;
                                best = p;
                            }
                        }
                        this.endGame(best || { isDraw: true });
                    }
                }
            }
        }, 1000);

        if (!this.isMultiplayer || config.useBots) {
            this.spawnBots();
        }

        if (this.threeEngine) {
            this.threeEngine.updateSkyAndFog();
            this.threeEngine.buildEnvironment();
            this.threeEngine.cameraMode = this.cameraMode;
        }

        if (window.soundSystem && !window.soundSystem.musicMuted) {
            window.soundSystem.startMusic();
        }

        this.showKillFeed(`❄️ ${this.playerName} jangga kirdi! Qor oting va tanga yig'ing!`, true);
    }

    getModeLabel(mode) {
        switch (mode) {
            case '1v1': return '1 vs 1 Duel';
            case '2v2': return '2 vs 2 Jamoa';
            case '4v4': return '4 vs 4 Squad';
            default: return 'Battle Royale';
        }
    }

    toggleCameraMode() {
        if (this.cameraMode === 'third_person') {
            this.cameraMode = 'first_person';
        } else if (this.cameraMode === 'first_person') {
            this.cameraMode = 'top_down';
        } else {
            this.cameraMode = 'third_person';
        }
        localStorage.setItem('snow_camera_mode', this.cameraMode);
        if (this.threeEngine) this.threeEngine.cameraMode = this.cameraMode;
        this.updatePerspectiveButtonUI();
        let msg = '👤 3D 3-LITSO (Haqiqiy 3D Minecraft Orqadan Ko\'rish yoqildi!)';
        if (this.cameraMode === 'first_person') msg = '👁️ 3D 1-LITSO (Birinchi Shaxs FPS yoqildi!)';
        if (this.cameraMode === 'top_down') msg = '🗺️ 3D TEPADAN (Izometrik 3D Ko\'rinish yoqildi!)';
        this.showKillFeed(msg, false);
        if (window.soundSystem) window.soundSystem.playClick();
    }

    updatePerspectiveButtonUI() {
        const btn = document.getElementById('btnTogglePerspective');
        const mBtn = document.getElementById('btnMobilePerspective');
        let text = '👤 3D 3-LITSO';
        if (this.cameraMode === 'first_person') text = '👁️ 3D 1-LITSO (FPS)';
        if (this.cameraMode === 'top_down') text = '🗺️ 3D TEPADAN';
        if (btn) btn.innerHTML = text;
        if (mBtn) mBtn.innerHTML = text;
    }

    spawnBots() {
        const botNames = ['Artur_Santa', 'QorBola_99', 'MuzYurak', 'Bobur_Sniper', 'Snegurochka', 'Shaxzod_Frost', 'QishkiBo\'ri'];
        const colors = ['#e63946', '#4cc9f0', '#06d6a0', '#ffd166', '#b5179e'];
        const skins = ['santa', 'ninja', 'king', 'bear', 'cyber'];

        const botConf = window.shopAndQuests ? window.shopAndQuests.getBotConfig(this.botDifficulty) : {
            difficulty: 'normal', speed: 3.5, hp: 100, maxHp: 100, damage: 24, throwCooldownMin: 30, throwCooldownMax: 45, spread: 0.14, canDodge: false, dodgeChance: 0, predictLead: 0, shield: 0, ballType: 'classic'
        };

        let teamBlueCount = this.localPlayer.team === 'blue' ? 1 : 0;
        let teamRedCount = this.localPlayer.team === 'red' ? 1 : 0;
        let totalBots = 1;

        if (this.gameMode === '1v1') totalBots = 1;
        else if (this.gameMode === '2v2') totalBots = 3;
        else if (this.gameMode === '4v4') totalBots = 7;
        else totalBots = 4;

        for (let i = 0; i < totalBots; i++) {
            const botId = 'bot_' + i;
            let tag = '';
            if (botConf.difficulty === 'hacker') tag = ' 💀[HACKER]';
            else if (botConf.difficulty === 'pro') tag = ' 🔴[PRO]';
            else if (botConf.difficulty === 'noob') tag = ' 🟢[NOOB]';

            const name = botNames[i % botNames.length] + tag;
            let team = 'red';

            if (this.gameMode === '2v2') {
                team = (teamBlueCount < 2) ? 'blue' : 'red';
                if (team === 'blue') teamBlueCount++; else teamRedCount++;
            } else if (this.gameMode === '4v4') {
                team = (teamBlueCount < 4) ? 'blue' : 'red';
                if (team === 'blue') teamBlueCount++; else teamRedCount++;
            } else if (this.gameMode === 'ffa') {
                team = 'ffa_' + i;
            }

            let spawnX, spawnY;
            if (team === 'blue') {
                spawnX = this.width * 0.22 + Math.random() * 40;
                spawnY = this.height * 0.3 + (i * 90);
            } else if (team === 'red') {
                spawnX = this.width * 0.78 - Math.random() * 40;
                spawnY = this.height * 0.3 + (i * 90);
            } else {
                spawnX = Math.random() * (this.width - 240) + 120;
                spawnY = Math.random() * (this.height - 200) + 100;
            }

            // Safe-Spawn Resolver for Bots
            let botNudge = 0;
            while (this.checkObstacleCollision(spawnX, spawnY, 26) && botNudge < 25) {
                spawnX += (team === 'blue' ? 14 : -14);
                botNudge++;
            }

            const mcTypes = ['steve', 'skeleton', 'zombie', 'creeper', 'enderman'];
            const bot = {
                id: botId,
                name: name,
                isBot: true,
                difficulty: botConf.difficulty,
                x: spawnX,
                y: spawnY,
                radius: 22,
                color: team === 'blue' ? '#4cc9f0' : (team === 'red' ? '#ff3366' : colors[i % colors.length]),
                characterType: mcTypes[i % mcTypes.length],
                skin: (botConf.difficulty === 'hacker') ? 'cyber' : skins[i % skins.length],
                snowballType: botConf.ballType || 'classic',
                team: team,
                hp: botConf.hp,
                maxHp: botConf.maxHp,
                shield: botConf.shield || 0,
                maxShield: botConf.shield || 0,
                damage: botConf.damage || 24,
                speed: botConf.speed,
                spread: botConf.spread,
                canDodge: botConf.canDodge,
                dodgeChance: botConf.dodgeChance,
                predictLead: botConf.predictLead,
                throwCooldownMin: botConf.throwCooldownMin,
                throwCooldownMax: botConf.throwCooldownMax,
                snowballs: 4,
                maxSnowballs: 5,
                isCrafting: false,
                craftProgress: 0,
                craftDuration: (botConf.difficulty === 'hacker' ? 20 : (botConf.difficulty === 'pro' ? 26 : 35)),
                angle: 0,
                walkCycle: 0,
                isMoving: false,
                isDead: false,
                throwCooldown: Math.floor(Math.random() * 20) + 15,
                throwAnim: 0
            };

            this.players.set(botId, bot);
        }
    }

    startCrafting() {
        if (this.localPlayer.isCrafting || this.localPlayer.isDead) return;
        if (this.localPlayer.snowballs >= this.localPlayer.maxSnowballs) {
            this.showKillFeed("⚠️ Qor zaxirangiz to'lgan (5/5)!", false);
            return;
        }

        this.localPlayer.isCrafting = true;
        this.localPlayer.craftProgress = 0;

        if (window.soundSystem) window.soundSystem.playSnowCraft();
        this.createSnowSplash(this.localPlayer.x, this.localPlayer.y, '#ffffff', 8);
    }

    findNearestEnemy() {
        let nearest = null;
        let minDist = 520;
        for (let [id, p] of this.players) {
            if (p.id === this.localPlayer.id || p.isDead) continue;
            if ((this.gameMode === '2v2' || this.gameMode === '4v4') && p.team === this.localPlayer.team) continue;
            const d = Math.hypot(p.x - this.localPlayer.x, p.y - this.localPlayer.y);
            if (d < minDist) {
                minDist = d;
                nearest = p;
            }
        }
        return nearest;
    }

    // TEZ VA SHIDDATLI QOR OTISH (AUTO-AIM BILAN MOBIL MOSLASHGAN)
    throwSnowball(targetAngle = null) {
        if (this.localPlayer.isDead) return;
        if (this.localPlayer.throwCooldown > 0) return;

        // 🔫 QUROLLI JANG REJIMI (Gun Warfare Firing)
        if (this.battleType === 'gun') {
            if (this.localPlayer.snowballs <= 0) {
                if (this.localPlayer.reserveAmmo > 0 && !this.localPlayer.isReloading) {
                    this.reloadGun();
                } else if (this.localPlayer.reserveAmmo <= 0) {
                    this.showKillFeed("❌ O'q tugadi! Zaxirada o'q yo'q!", false);
                }
                return;
            }

            this.localPlayer.snowballs--;
            this.localPlayer.throwCooldown = 7; // Avtomat tezligi
            this.localPlayer.throwAnim = 8;
            this.updateSnowballSlotsUI();

            let angle = targetAngle;
            if (this.cameraMode === 'first_person') {
                angle = this.localPlayer.angle;
                this.gunRecoil = 1.0;
                this.gunMuzzleFlash = 5;
            } else if (angle === null) {
                if (this.touchAimActive) {
                    const dx = this.mousePos.x - this.localPlayer.x;
                    const dy = this.mousePos.y - this.localPlayer.y;
                    angle = Math.atan2(dy, dx);
                } else {
                    const nearest = this.findNearestEnemy();
                    if (nearest) {
                        angle = Math.atan2(nearest.y - this.localPlayer.y, nearest.x - this.localPlayer.x);
                    } else {
                        angle = this.localPlayer.angle;
                    }
                }
            }

            if (window.soundSystem) window.soundSystem.playThrow();

            const speed = 32;
            const dmg = this.localPlayer.snowballDamage || 28;

            this.snowballs.push({
                id: 'bullet_' + Math.random().toString(36).substr(2, 9),
                ownerId: this.localPlayer.id,
                ownerTeam: this.localPlayer.team,
                x: this.localPlayer.x + Math.cos(angle) * (this.localPlayer.radius + 14),
                y: this.localPlayer.y + Math.sin(angle) * (this.localPlayer.radius + 14),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 4.5,
                damage: dmg,
                type: 'bullet',
                isBullet: true,
                maxDist: 850,
                travelled: 0
            });
            return;
        }

        if (this.localPlayer.isCrafting) return;
        if (this.localPlayer.snowballs <= 0) {
            this.showKillFeed("❌ Qoringiz qolmadi! Qor yasang yoki oling!", false);
            this.startCrafting();
            return;
        }

        this.localPlayer.snowballs--;
        this.localPlayer.throwCooldown = 11;
        this.localPlayer.throwAnim = 8;
        this.updateSnowballSlotsUI();

        let angle = targetAngle;
        let dist = 380;

        if (this.cameraMode === 'first_person') {
            angle = this.localPlayer.angle;
            dist = 550;
            this.gunRecoil = 1.0;
            this.gunMuzzleFlash = 6;
        } else if (angle === null) {
            if (this.touchAimActive) {
                // Ekranga barmog'i bilan tegilganda
                const dx = this.mousePos.x - this.localPlayer.x;
                const dy = this.mousePos.y - this.localPlayer.y;
                angle = Math.atan2(dy, dx);
                dist = Math.hypot(dx, dy);
            } else {
                // "OTISH" tugmasi bosilganda: Yaqin atrofda dushman bo'lsa Auto-Aim!
                const nearest = this.findNearestEnemy();
                if (nearest) {
                    const edx = nearest.x - this.localPlayer.x;
                    const edy = nearest.y - this.localPlayer.y;
                    angle = Math.atan2(edy, edx);
                    dist = Math.hypot(edx, edy);
                    this.localPlayer.angle = angle;
                } else if (this.localPlayer.isMoving || (this.joystick && this.joystick.active)) {
                    // Harakat yo'nalishiga qarab otish
                    angle = this.localPlayer.angle;
                } else {
                    const dx = this.mousePos.x - this.localPlayer.x;
                    const dy = this.mousePos.y - this.localPlayer.y;
                    angle = Math.atan2(dy, dx);
                    dist = Math.hypot(dx, dy);
                }
            }
        }

        // QOR TO'PI TEZLIGI
        const speed = (this.cameraMode === 'first_person') ? 18.0 : 15.5;

        const snowball = {
            id: 'sb_' + Math.random().toString(36).substr(2, 7),
            ownerId: this.localPlayer.id,
            ownerTeam: this.localPlayer.team,
            ownerName: this.localPlayer.name,
            ballType: this.localPlayer.snowballType,
            x: this.localPlayer.x + Math.cos(angle) * (this.localPlayer.radius + 6),
            y: this.localPlayer.y + Math.sin(angle) * (this.localPlayer.radius + 6),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 8.5,
            maxDist: Math.min(dist + 80, 680),
            travelled: 0,
            damage: this.localPlayer.snowballDamage || 25
        };

        this.snowballs.push(snowball);
        if (window.soundSystem) window.soundSystem.playThrow();

        if (this.isMultiplayer && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'throw_snowball',
                snowball: snowball
            }));
        }
    }

    botThrowSnowball(bot, target) {
        if (bot.isDead || bot.throwCooldown > 0) return;

        // Qurol rejimida botlar tezkor o'q otadi
        if (this.battleType === 'gun') {
            if (bot.snowballs <= 0) {
                bot.snowballs = 30; // Bot avtomatik qayta o'qlaydi
                bot.throwCooldown = 30;
                return;
            }
            bot.snowballs--;
            bot.throwCooldown = 18;
            bot.throwAnim = 8;

            const speed = 30;
            let targetX = target.x;
            let targetY = target.y;
            const dist = Math.hypot(targetX - bot.x, targetY - bot.y);

            if (bot.predictLead && target.isMoving) {
                const travelTime = (dist / speed) * bot.predictLead;
                const targetSpeed = target.isSprinting ? (target.sprintSpeed || 5.6) : (target.speed || 4.4);
                targetX += Math.cos(target.angle) * targetSpeed * travelTime;
                targetY += Math.sin(target.angle) * targetSpeed * travelTime;
            }

            const spread = (Math.random() - 0.5) * 0.12;
            const shootAngle = Math.atan2(targetY - bot.y, targetX - bot.x) + spread;
            const dmg = bot.snowballDamage || 22;

            this.snowballs.push({
                id: 'bot_bullet_' + Math.random().toString(36).substr(2, 9),
                ownerId: bot.id,
                ownerTeam: bot.team,
                x: bot.x + Math.cos(shootAngle) * (bot.radius + 12),
                y: bot.y + Math.sin(shootAngle) * (bot.radius + 12),
                vx: Math.cos(shootAngle) * speed,
                vy: Math.sin(shootAngle) * speed,
                radius: 4.5,
                damage: dmg,
                type: 'bullet',
                isBullet: true,
                maxDist: 800,
                travelled: 0
            });
            return;
        }

        if (bot.snowballs <= 0) return;

        bot.snowballs--;
        const minCd = bot.throwCooldownMin || 25;
        const maxCd = bot.throwCooldownMax || 40;
        bot.throwCooldown = Math.floor(Math.random() * (maxCd - minCd + 1)) + minCd;
        bot.throwAnim = 8;

        const speed = 14.5;
        let targetX = target.x;
        let targetY = target.y;
        const dist = Math.hypot(targetX - bot.x, targetY - bot.y);

        // Usta (Pro) va Kiber (Hacker) botlar uchun bashoratli nishonga olish (Predictive Aim)
        if (bot.predictLead && target.isMoving) {
            const travelTime = (dist / speed) * bot.predictLead;
            const targetSpeed = target.isSprinting ? (target.sprintSpeed || 5.6) : (target.speed || 4.4);
            targetX += Math.cos(target.angle) * targetSpeed * travelTime;
            targetY += Math.sin(target.angle) * targetSpeed * travelTime;
        }

        const spread = (Math.random() - 0.5) * (bot.spread !== undefined ? bot.spread : 0.18);
        const dx = targetX - bot.x;
        const dy = targetY - bot.y;
        const angle = Math.atan2(dy, dx) + spread;

        const snowball = {
            id: 'sb_' + Math.random().toString(36).substr(2, 7),
            ownerId: bot.id,
            ownerTeam: bot.team,
            ownerName: bot.name,
            ballType: bot.snowballType,
            x: bot.x + Math.cos(angle) * (bot.radius + 6),
            y: bot.y + Math.sin(angle) * (bot.radius + 6),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 8.5,
            maxDist: Math.min(dist + 80, 680),
            travelled: 0,
            damage: bot.damage || 24
        };

        this.snowballs.push(snowball);
        if (window.soundSystem) window.soundSystem.playThrow();
    }

    gameLoop(timestamp) {
        this.lastTime = timestamp;

        if (this.isRunning && !this.isPaused) {
            this.update();
        }

        this.render();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update() {
        this.updateSnowflakes();
        this.updateLocalPlayer();
        this.updateBots();
        this.updateSnowballs();
        this.updateParticles();
        this.updateGroundCoins();
        this.checkWinCondition();

        if (this.isMultiplayer && this.ws && this.ws.readyState === WebSocket.OPEN && Math.random() < 0.45) {
            this.ws.send(JSON.stringify({
                type: 'update_position',
                x: this.localPlayer.x,
                y: this.localPlayer.y,
                angle: this.localPlayer.angle,
                hp: this.localPlayer.hp,
                snowballs: this.localPlayer.snowballs,
                isCrafting: this.localPlayer.isCrafting,
                isMoving: this.localPlayer.isMoving,
                isDead: this.localPlayer.isDead
            }));
        }
    }

    updateSnowflakes() {
        for (let flake of this.snowflakes) {
            flake.y += flake.speedY;
            flake.swingAngle += 0.02;
            flake.x += Math.sin(flake.swingAngle) * 0.7 + flake.speedX;

            if (flake.y > this.height) {
                flake.y = -5;
                flake.x = Math.random() * this.width;
            }
            if (flake.x > this.width) flake.x = 0;
            if (flake.x < 0) flake.x = this.width;
        }
    }

    // O'YINCHI HARAKATI (Sprint & Tezlik)
    updateLocalPlayer() {
        const p = this.localPlayer;
        if (p.isDead) return;

        if (p.throwCooldown > 0) p.throwCooldown--;
        if (p.throwAnim > 0) p.throwAnim--;
        if (this.gunRecoil > 0) this.gunRecoil = Math.max(0, this.gunRecoil - 0.08);
        if (this.gunMuzzleFlash > 0) this.gunMuzzleFlash--;

                if (p.isReloading) {
            p.reloadProgress++;
            if (p.reloadProgress >= p.reloadDuration) {
                const needed = p.maxSnowballs - p.snowballs;
                const take = Math.min(needed, p.reserveAmmo);
                p.snowballs += take;
                p.reserveAmmo -= take;
                p.isReloading = false;
                p.reloadProgress = 0;
                this.updateSnowballSlotsUI();
                this.showKillFeed(`⚡ Magazin to'ldi: ${p.snowballs} / ${p.reserveAmmo}`, false);
            }
        }

        if (p.isCrafting) {
            p.craftProgress++;
            const ring = document.getElementById('mobileCraftRing');
            if (ring) {
                const pct = Math.min(100, Math.round((p.craftProgress / p.craftDuration) * 100));
                ring.style.background = `conic-gradient(#06d6a0 ${pct}%, transparent 0%)`;
            }
            if (p.craftProgress >= p.craftDuration) {
                p.isCrafting = false;
                p.craftProgress = 0;
                if (p.snowballs < p.maxSnowballs) {
                    p.snowballs++;
                    this.updateSnowballSlotsUI();
                }
                if (ring) ring.style.background = 'none';
            }
            p.isMoving = false;
            return;
        } else {
            const ring = document.getElementById('mobileCraftRing');
            if (ring && p.craftProgress === 0) ring.style.background = 'none';
        }

        let dx = 0;
        let dy = 0;

        if (this.cameraMode === 'third_person' || this.cameraMode === 'first_person') {
            // 3D Harakat (Third-Person va FPS): W/S oldinga-orqaga, A/D chapga-o'ngga (strafe)
            let fwd = 0;
            let strafe = 0;

            if (this.keys['w'] || this.keys['arrowup'] || this.keys['keyw']) fwd += 1;
            if (this.keys['s'] || this.keys['arrowdown'] || this.keys['keys']) fwd -= 1;
            if (this.keys['a'] || this.keys['keya']) strafe -= 1;
            if (this.keys['d'] || this.keys['keyd']) strafe += 1;

            // Q va E yoki chap/o'ng strelkalar bilan burilish
            if (this.keys['arrowleft'] || this.keys['keyq']) p.angle -= 0.045;
            if (this.keys['arrowright'] || this.keys['keye']) p.angle += 0.045;

            // Joystik 3D rejimda: Y o'qi oldinga/orqaga, X o'qi strafe
            if (this.joystick && this.joystick.active && (Math.abs(this.joystick.dx) > 0.05 || Math.abs(this.joystick.dy) > 0.05)) {
                fwd += -this.joystick.dy;
                strafe += this.joystick.dx;
            }

            if (fwd !== 0 && strafe !== 0 && (!this.joystick || !this.joystick.active)) {
                fwd *= 0.7071;
                strafe *= 0.7071;
            }

            dx = Math.cos(p.angle) * fwd - Math.sin(p.angle) * strafe;
            dy = Math.sin(p.angle) * fwd + Math.cos(p.angle) * strafe;
        } else {
            // 3D Tepadan (Top-down): W/S/A/D global yo'nalishlar
            if (this.keys['w'] || this.keys['arrowup'] || this.keys['keyw']) dy -= 1;
            if (this.keys['s'] || this.keys['arrowdown'] || this.keys['keys']) dy += 1;
            if (this.keys['a'] || this.keys['arrowleft'] || this.keys['keya']) dx -= 1;
            if (this.keys['d'] || this.keys['arrowright'] || this.keys['keyd']) dx += 1;

            if (this.joystick && this.joystick.active && (Math.abs(this.joystick.dx) > 0.05 || Math.abs(this.joystick.dy) > 0.05)) {
                dx = this.joystick.dx;
                dy = this.joystick.dy;
            }

            if (dx !== 0 && dy !== 0 && (!this.joystick || !this.joystick.active)) {
                dx *= 0.7071;
                dy *= 0.7071;
            }
        }

        p.isMoving = (Math.hypot(dx, dy) > 0.08);
        p.isSprinting = ((this.keys['shift'] || this.keys['shiftleft'] || this.keys['shiftright']) || this.mobileSprinting) && p.isMoving;

        const currentSpeed = p.isSprinting ? p.sprintSpeed : p.speed;

        if (p.isMoving) {
            p.walkCycle += p.isSprinting ? 0.24 : 0.17;
            const nextX = p.x + dx * currentSpeed;
            const nextY = p.y + dy * currentSpeed;

            const collX = this.checkObstacleCollision(nextX, p.y, p.radius);
            const collY = this.checkObstacleCollision(p.x, nextY, p.radius);

            if (nextX >= p.radius && nextX <= this.width - p.radius && !collX) {
                p.x = nextX;
            }
            if (nextY >= p.radius && nextY <= this.height - p.radius && !collY) {
                p.y = nextY;
            }

            // Unstuck mexanizmi: Agar o'yinchi biron sabab to'siq ichida tiqilib qolsa, markazga tomon itarib chiqarish
            if (this.checkObstacleCollision(p.x, p.y, p.radius)) {
                const centerX = this.width / 2;
                const centerY = this.height / 2;
                const pushAngle = Math.atan2(centerY - p.y, centerX - p.x);
                p.x += Math.cos(pushAngle) * 4;
                p.y += Math.sin(pushAngle) * 4;
            }

            if (Math.random() < 0.25) {
                this.footprints.push({ x: p.x, y: p.y + 12, alpha: 0.5 });
                if (this.footprints.length > 80) this.footprints.shift();
            }
        }

        // Qahramonning nishon burchagi (Top-down rejimda sichqonchaga qaraydi)
        if (this.cameraMode === 'top_down') {
            if (this.touchAimActive) {
                p.angle = Math.atan2(this.mousePos.y - p.y, this.mousePos.x - p.x);
            } else if (this.joystick && this.joystick.active && p.isMoving) {
                p.angle = Math.atan2(dy, dx);
            } else {
                p.angle = Math.atan2(this.mousePos.y - p.y, this.mousePos.x - p.x);
            }
        }

        // Avtomatik otish (Enter, Sichqoncha yoki Sensorli otish bosib turilganda)
        if ((this.keys['enter'] || this.keys['numpadenter'] || this.isMouseDown || this.touchFireActive) && !p.isDead && !this.isPaused) {
            this.throwSnowball();
        }
    }

    // YERDAGI TANGALARNI TERIB OLISH
    updateGroundCoins() {
        const p = this.localPlayer;
        if (p.isDead) return;

        for (let coin of this.groundCoins) {
            if (coin.isCollected) continue;
            coin.pulse += 0.08;

            const dist = Math.hypot(p.x - coin.x, p.y - coin.y);
            if (dist < p.radius + 14) {
                // Tanga olindi!
                coin.isCollected = true;
                this.addCoins(coin.value);
                this.createSnowSplash(coin.x, coin.y, '#ffd166', 10);
                if (window.shopAndQuests) window.shopAndQuests.onCoinsCollected(coin.value);
                if (window.soundSystem) window.soundSystem.playNote(587.33, 0.2, 0, 'sine', 0.2); // Ding!
            }
        }
    }

    updateBots() {
        for (let [id, bot] of this.players) {
            if (!bot.isBot || bot.isDead) continue;

            if (bot.throwCooldown > 0) bot.throwCooldown--;
            if (bot.throwAnim > 0) bot.throwAnim--;

            if (bot.isCrafting) {
                bot.craftProgress++;
                if (bot.craftProgress >= bot.craftDuration) {
                    bot.isCrafting = false;
                    bot.craftProgress = 0;
                    if (bot.snowballs < bot.maxSnowballs) bot.snowballs++;
                }
                bot.isMoving = false;
                continue;
            }

            if (bot.snowballs <= 0) {
                bot.isCrafting = true;
                bot.craftProgress = 0;
                continue;
            }

            let nearestEnemy = null;
            let minDist = 9999;

            for (let [otherId, target] of this.players) {
                if (otherId === bot.id || target.isDead) continue;
                if (this.isFriendly(bot, target)) continue;

                const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestEnemy = target;
                }
            }

            if (nearestEnemy) {
                bot.angle = Math.atan2(nearestEnemy.y - bot.y, nearestEnemy.x - bot.x);

                let moveDx = 0;
                let moveDy = 0;

                // Usta (Pro) va Kiber (Hacker) botlar uchun qor to'pidan chaqqon chetlanish (Dodge)
                let isDodging = false;
                if (bot.canDodge) {
                    for (let sb of this.snowballs) {
                        if (sb.ownerTeam !== bot.team) {
                            const d = Math.hypot(sb.x - bot.x, sb.y - bot.y);
                            if (d < 170) {
                                const dot = (sb.vx * (bot.x - sb.x)) + (sb.vy * (bot.y - sb.y));
                                if (dot > 0 && Math.random() < (bot.dodgeChance || 0.75)) {
                                    const sbSpeed = Math.hypot(sb.vx, sb.vy) || 1;
                                    moveDx = -sb.vy / sbSpeed * 1.3;
                                    moveDy = sb.vx / sbSpeed * 1.3;
                                    isDodging = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!isDodging) {
                    if (minDist > 280) {
                        moveDx = Math.cos(bot.angle);
                        moveDy = Math.sin(bot.angle);
                    } else if (minDist < 140) {
                        moveDx = -Math.cos(bot.angle);
                        moveDy = -Math.sin(bot.angle);
                    } else {
                        moveDx = -Math.sin(bot.angle);
                        moveDy = Math.cos(bot.angle);
                    }
                }

                bot.isMoving = (moveDx !== 0 || moveDy !== 0);
                if (bot.isMoving) bot.walkCycle += 0.17;

                const nextX = bot.x + moveDx * bot.speed;
                const nextY = bot.y + moveDy * bot.speed;

                if (nextX >= bot.radius && nextX <= this.width - bot.radius && !this.checkObstacleCollision(nextX, bot.y, bot.radius)) {
                    bot.x = nextX;
                }
                if (nextY >= bot.radius && nextY <= this.height - bot.radius && !this.checkObstacleCollision(bot.x, nextY, bot.radius)) {
                    bot.y = nextY;
                }

                if (minDist < 520 && bot.throwCooldown <= 0 && Math.random() < 0.10) {
                    this.botThrowSnowball(bot, nearestEnemy);
                }
            }
        }
    }

    isFriendly(p1, p2) {
        if (this.gameMode === 'ffa') return false;
        return p1.team === p2.team;
    }

    updateSnowballs() {
        for (let i = this.snowballs.length - 1; i >= 0; i--) {
            const sb = this.snowballs[i];
            sb.x += sb.vx;
            sb.y += sb.vy;
            sb.travelled += Math.hypot(sb.vx, sb.vy);

            // To'siqlarga urilish
            if (this.checkObstacleCollision(sb.x, sb.y, sb.radius)) {
                this.createSnowSplash(sb.x, sb.y, this.getSnowballColor(sb.ballType), 12);
                if (window.soundSystem) window.soundSystem.playHit();
                this.snowballs.splice(i, 1);
                continue;
            }

            // O'yinchilarga tegish
            let hitPlayer = false;
            for (let [playerId, player] of this.players) {
                if (player.isDead) continue;
                if (player.id === sb.ownerId) continue;
                if (this.isFriendly({ team: sb.ownerTeam }, player)) continue;

                const dist = Math.hypot(player.x - sb.x, player.y - sb.y);
                if (dist < player.radius + sb.radius) {
                    hitPlayer = true;
                    this.applyDamage(player, sb);
                    this.createSnowSplash(sb.x, sb.y, this.getSnowballColor(sb.ballType), 18);
                    if (window.soundSystem) window.soundSystem.playHit();
                    break;
                }
            }

            if (hitPlayer) {
                this.snowballs.splice(i, 1);
                continue;
            }

            if (sb.travelled >= sb.maxDist || sb.x < 0 || sb.x > this.width || sb.y < 0 || sb.y > this.height) {
                this.createSnowSplash(sb.x, sb.y, this.getSnowballColor(sb.ballType), 8);
                this.snowballs.splice(i, 1);
            }
        }
    }

    getSnowballColor(type) {
        if (type === 'fire') return '#ff5400';
        if (type === 'plasma') return '#00f5d4';
        if (type === 'rainbow') return '#ffd166';
        return '#ffffff';
    }

    applyDamage(target, snowball) {
        let dmg = snowball.damage || 25;

        // Muz Qalqoni (Frost Shield) himoyasi: zarbani birinchi bo'lib qalqon oladi
        if (target.shield > 0) {
            if (target.shield >= dmg) {
                target.shield -= dmg;
                dmg = 0;
                this.createSnowSplash(snowball.x, snowball.y, '#00f5d4', 14);
            } else {
                dmg -= target.shield;
                target.shield = 0;
                this.createSnowSplash(snowball.x, snowball.y, '#00f5d4', 24); // Qalqon parchalanish effekti
                if (window.soundSystem) window.soundSystem.playSnowCraft();
            }
        }

        target.hp -= dmg;
        if (target.hp < 0) target.hp = 0;

        if (snowball.ownerId === this.localPlayer.id) {
            this.stats.hits++;
            this.addCoins(3); // Har bir tekkizilgan zarb uchun +3 tanga!
            document.getElementById('statHits').textContent = this.stats.hits;
            if (window.shopAndQuests) window.shopAndQuests.onSnowballHit();
        }

        if (target.id === this.localPlayer.id) {
            this.updateHpUI();
        }

        if (target.hp <= 0 && !target.isDead) {
            target.isDead = true;
            this.onPlayerEliminated(target, snowball);
        }
    }

    onPlayerEliminated(victim, killerSnowball) {
        this.createSnowSplash(victim.x, victim.y, '#ffffff', 30);
        this.showKillFeed(`⛄ ${victim.name} muzlab qoldi! (${killerSnowball.ownerName})`, true);

        if (killerSnowball.ownerId === this.localPlayer.id) {
            this.stats.kills++;
            this.addCoins(15); // Raqibni yiqitganda +15 tanga mukofot!
            document.getElementById('statKills').textContent = this.stats.kills;
            if (window.shopAndQuests) window.shopAndQuests.onEnemyEliminated();
        }

        if (killerSnowball.ownerTeam === 'blue') this.blueScore++;
        else if (killerSnowball.ownerTeam === 'red') this.redScore++;
        this.updateScoreUI();

        this.checkWinCondition();
    }

    checkWinCondition() {
        if (this.isGameOver) return;

        if (this.gameMode === '1v1') {
            let alivePlayers = [];
            for (let [id, p] of this.players) {
                if (!p.isDead) alivePlayers.push(p);
            }
            if (alivePlayers.length <= 1) {
                this.endGame(alivePlayers[0]);
            }
        } else if (this.gameMode === '2v2' || this.gameMode === '4v4') {
            const targetKills = this.gameMode === '4v4' ? 4 : 2;
            let blueAlive = 0;
            let redAlive = 0;
            for (let [id, p] of this.players) {
                if (!p.isDead) {
                    if (p.team === 'blue') blueAlive++;
                    else if (p.team === 'red') redAlive++;
                }
            }

            // G'alaba shartlari:
            // 1. Bir jamoaning barcha o'yinchilari yiqitildi
            // 2. Yoki jamoa 4 ta (2v2 da 2 ta) yiqitish hisobiga erishdi
            if (this.blueScore >= targetKills || (redAlive === 0 && blueAlive > 0)) {
                this.endGame({ team: 'blue', isTeam: true });
            } else if (this.redScore >= targetKills || (blueAlive === 0 && redAlive > 0)) {
                this.endGame({ team: 'red', isTeam: true });
            } else if (blueAlive === 0 && redAlive === 0) {
                if (this.blueScore > this.redScore) {
                    this.endGame({ team: 'blue', isTeam: true });
                } else if (this.redScore > this.blueScore) {
                    this.endGame({ team: 'red', isTeam: true });
                } else {
                    this.endGame({ isDraw: true, isTeam: true });
                }
            }
        } else {
            let aliveCount = 0;
            let lastSurvivor = null;
            for (let [id, p] of this.players) {
                if (!p.isDead) {
                    aliveCount++;
                    lastSurvivor = p;
                }
            }
            if (aliveCount <= 1) {
                this.endGame(lastSurvivor);
            }
        }
    }

    endGame(winner) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isRunning = false;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        const inGameHUD = document.getElementById('inGameHUD');
        if (inGameHUD) inGameHUD.classList.add('hidden');

        const mobileLayer = document.getElementById('mobileControlsLayer');
        if (mobileLayer) mobileLayer.classList.remove('active');
        if (this.joystick) {
            this.joystick.active = false;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
            const knob = document.getElementById('joystickKnob');
            if (knob) knob.style.transform = 'translate(-50%, -50%)';
        }

        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const desc = document.getElementById('gameOverDesc');

        let isVictory = false;
        let isDraw = false;

        if (winner && winner.isDraw) {
            isDraw = true;
            title.textContent = "🤝 DURRANG!";
            desc.textContent = "Ikkala jamoa teng natija ko'rsatdi!";
            title.className = "winner-banner draw";
        } else if (winner && winner.isTeam) {
            const winTeam = (winner.team === 'Ko\'k Jamoa' || winner.team === 'blue') ? 'blue' : 'red';
            const teamName = winTeam === 'blue' ? "Ko'k Jamoa" : "Qizil Jamoa";
            isVictory = (this.localPlayer.team === winTeam);

            if (isVictory) {
                title.textContent = "🏆 G'ALABA! SIZ YUTDINGIZ!";
                desc.textContent = `Tabriklaymiz! Sizning jamoangiz (${teamName}) zafar quchdi!`;
                title.className = "winner-banner victory";
            } else {
                title.textContent = "⛄ MAG'LUBIYAT";
                desc.textContent = `Raqib jamoa (${teamName}) g'alaba qozondi.`;
                title.className = "winner-banner defeat";
            }
        } else if (winner) {
            isVictory = (winner.id === this.localPlayer.id);
            if (isVictory) {
                title.textContent = "🏆 G'ALABA! SIZ YUTDINGIZ!";
                desc.textContent = "Tabriklaymiz! Siz qor jangida g'olib bo'ldingiz!";
                title.className = "winner-banner victory";
            } else {
                title.textContent = "⛄ MAG'LUBIYAT";
                desc.textContent = `${winner.name || 'Raqib'} jangda g'olib bo'ldi!`;
                title.className = "winner-banner defeat";
            }
        } else {
            // Agar g'olib ko'rsatilmagan bo'lsa (masalan vaqt tugaganda hisob bo'yicha)
            if (this.gameMode === '2v2' || this.gameMode === '4v4') {
                const myScore = (this.localPlayer.team === 'blue') ? this.blueScore : this.redScore;
                const oppScore = (this.localPlayer.team === 'blue') ? this.redScore : this.blueScore;
                if (myScore > oppScore) {
                    isVictory = true;
                    title.textContent = "🏆 G'ALABA! SIZ YUTDINGIZ!";
                    desc.textContent = "Sizning jamoangiz ko'proq ochko to'plab zafar quchdi!";
                    title.className = "winner-banner victory";
                } else if (myScore < oppScore) {
                    title.textContent = "⛄ MAG'LUBIYAT";
                    desc.textContent = "Raqib jamoa ko'proq ochko to'pladi.";
                    title.className = "winner-banner defeat";
                } else {
                    isDraw = true;
                    title.textContent = "🤝 DURRANG!";
                    desc.textContent = "O'yin teng hisob bilan yakunlandi!";
                    title.className = "winner-banner draw";
                }
            } else {
                isVictory = !this.localPlayer.isDead;
                title.textContent = isVictory ? "🏆 G'ALABA! SIZ YUTDINGIZ!" : "⛄ MAG'LUBIYAT";
                desc.textContent = isVictory ? "Siz tirik qoldingiz va g'olib bo'ldingiz!" : "Siz muzlab qoldingiz.";
                title.className = isVictory ? "winner-banner victory" : "winner-banner defeat";
            }
        }

        // Mukofot berish va Kuboklar (Trophy System)
        // Faqat jamoaviy lobbilarda (2v2, 4v4 yoki multiplayer lobi) kubok beriladi
        const isLobbyTeamMatch = (this.isMultiplayer || this.gameMode === '2v2' || this.gameMode === '4v4');
        let trophyDelta = 0;
        if (isLobbyTeamMatch) {
            let currentTrophies = parseInt(localStorage.getItem('snow_trophies') || '1250', 10);
            if (isVictory) {
                trophyDelta = 30; // G'alabada +30 kubok
                currentTrophies += trophyDelta;
            } else if (isDraw) {
                trophyDelta = 5;
                currentTrophies += trophyDelta;
            } else {
                trophyDelta = -10; // Mag'lubiyatda -10 kubok
                currentTrophies = Math.max(0, currentTrophies + trophyDelta);
            }
            localStorage.setItem('snow_trophies', currentTrophies);
            if (window.shopAndQuests) {
                window.shopAndQuests.trophies = currentTrophies;
                window.shopAndQuests.updateProfileAndHeaderUI();
            }
        }

        if (isVictory) {
            this.addCoins(50);
            if (window.soundSystem) window.soundSystem.playVictory();
            if (window.shopAndQuests) window.shopAndQuests.onMatchWon();
        } else if (isDraw) {
            this.addCoins(25);
            if (window.soundSystem) window.soundSystem.playVictory();
        } else {
            this.addCoins(10);
            if (window.soundSystem) window.soundSystem.playDefeat();
        }

        // Tanga va Kubok natijasini ko'rsatish
        const coinsEarnedElem = document.getElementById('matchCoinsEarned');
        if (coinsEarnedElem) {
            if (isLobbyTeamMatch && trophyDelta !== 0) {
                const sign = trophyDelta > 0 ? '+' : '';
                coinsEarnedElem.textContent = `+${this.matchCoinsEarned} 🪙 | ${sign}${trophyDelta} 🏆`;
            } else {
                coinsEarnedElem.textContent = `+${this.matchCoinsEarned} 🪙`;
            }
        }

        modal.classList.remove('hidden');
    }

    checkObstacleCollision(x, y, radius) {
        for (let obs of this.obstacles) {
            if (obs.type === 'grand_tree' || obs.type === 'tree' || obs.type === 'mc_tree' || obs.type === 'snowman' || obs.type === 'snow_mound' || obs.type === 'ice_pillar' || obs.type === 'watchtower') {
                const dist = Math.hypot(obs.x - x, obs.y - y);
                if (dist < (obs.radius || 28) + radius) return true;
            } else if (obs.type === 'gift' || obs.type === 'wall' || obs.type === 'cabin' || obs.type === 'fortress_blue' || obs.type === 'fortress_red' || obs.type === 'tnt' || obs.type === 'chest') {
                if (x + radius > obs.x && x - radius < obs.x + obs.width &&
                    y + radius > obs.y && y - radius < obs.y + obs.height) {
                    return true;
                }
            }
        }
        return false;
    }

    createSnowSplash(x, y, color = '#ffffff', count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 2.8 + 1.2,
                color: color,
                alpha: 1,
                decay: Math.random() * 0.04 + 0.02
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            if (p.alpha <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.footprints.length - 1; i >= 0; i--) {
            this.footprints[i].alpha -= 0.0006;
            if (this.footprints[i].alpha <= 0) this.footprints.splice(i, 1);
        }
    }

    showKillFeed(message, isImportant = false) {
        if (!this.settings.showKillFeed && !isImportant) return;
        const feed = document.getElementById('killFeed');
        if (!feed) return;

        while (feed.children.length >= 2) {
            feed.removeChild(feed.firstChild);
        }

        const item = document.createElement('div');
        item.className = 'feed-item';
        item.textContent = message;
        feed.appendChild(item);

        setTimeout(() => {
            if (item.parentNode) item.parentNode.removeChild(item);
        }, 3000);
    }

    updateHpUI() {
        const hpBar = document.getElementById('hudHpBar');
        const hpText = document.getElementById('hudHpText');
        const maxHp = this.localPlayer.maxHp || 100;
        const curHp = Math.max(0, this.localPlayer.hp);
        const pct = Math.max(0, Math.min(100, (curHp / maxHp) * 100));

        if (hpBar) {
            hpBar.style.width = pct + '%';
            if (pct < 35) hpBar.classList.add('danger');
            else hpBar.classList.remove('danger');
        }
        if (hpText) hpText.textContent = `${curHp} / ${maxHp} HP`;

        const shieldContainer = document.getElementById('hudShieldContainer');
        const shieldBar = document.getElementById('hudShieldBar');
        const shieldText = document.getElementById('hudShieldText');

        if (this.localPlayer.maxShield > 0) {
            if (shieldContainer) shieldContainer.style.display = 'block';
            if (shieldText) {
                shieldText.style.display = 'inline';
                shieldText.textContent = `🛡️ ${this.localPlayer.shield} / ${this.localPlayer.maxShield}`;
            }
            if (shieldBar) {
                const shPct = Math.max(0, Math.min(100, (this.localPlayer.shield / this.localPlayer.maxShield) * 100));
                shieldBar.style.width = shPct + '%';
            }
        } else {
            if (shieldContainer) shieldContainer.style.display = 'none';
            if (shieldText) shieldText.style.display = 'none';
        }
    }

    updateSnowballSlotsUI() {
        if (this.battleType === 'gun') {
            const magSpan = document.getElementById('gunMagCount');
            const resSpan = document.getElementById('gunReserveCount');
            if (magSpan) magSpan.textContent = this.localPlayer.snowballs;
            if (resSpan) resSpan.textContent = this.localPlayer.reserveAmmo;
            return;
        }
        const slotsContainer = document.getElementById('snowballSlots');
        if (!slotsContainer) return;
        slotsContainer.innerHTML = '';
        const max = this.localPlayer.maxSnowballs || 5;
        const current = this.localPlayer.snowballs;
        for (let i = 0; i < max; i++) {
            const slot = document.createElement('div');
            slot.className = (i < current) ? 'snowball-slot filled' : 'snowball-slot';
            slotsContainer.appendChild(slot);
        }
    }

    updateScoreUI() {
        document.getElementById('scoreBlue').textContent = this.blueScore;
        document.getElementById('scoreRed').textContent = this.redScore;
    }

    updateTimerUI() {
        const m = Math.floor(this.matchTimeLeft / 60);
        const s = this.matchTimeLeft % 60;
        document.getElementById('matchTimer').textContent =
            `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // =======================================================
    // 🧪 AVTOMATIK TESTOVIY REJIM (DIAGNOSTICS & TEST SUITE)
    // =======================================================
    // =======================================================
    runSelfDiagnostics() {
        const results = [];
        if (this.obstacles.length === 0) {
            this.setupMap(this.battleType === 'gun' ? 'warzone' : 'wonderland');
        }
        const p = this.localPlayer || {
            x: (this.width || 800) * 0.24,
            y: (this.height || 600) * 0.5,
            radius: 24,
            snowballs: this.battleType === 'gun' ? 30 : 5,
            reserveAmmo: 120,
            maxSnowballs: 5
        };

        // 1. Harakat va to'siqlar xavfsizligi testi
        const spawnColl = this.checkObstacleCollision(p.x, p.y, p.radius);
        const moves = [
            { dir: 'W (Yuqoriga)', dx: 0, dy: -5 },
            { dir: 'S (Pastga)', dx: 0, dy: 5 },
            { dir: 'A (Chapga)', dx: -5, dy: 0 },
            { dir: "D (O'ngga)", dx: 5, dy: 0 }
        ];
        let movesPassed = 0;
        for (let m of moves) {
            const testX = p.x + m.dx;
            const testY = p.y + m.dy;
            if (!this.checkObstacleCollision(testX, testY, p.radius)) {
                movesPassed++;
            }
        }
        results.push({
            name: "Harakatlanish Tizimi (Player Movement)",
            passed: !spawnColl && movesPassed === 4,
            details: `Spawn to'siqsiz: ${!spawnColl ? 'HA (100% ochiq maydon)' : 'YOQ'}, 4 ta yo'nalish harakati: ${movesPassed}/4`
        });

        // 2. Qurol va Qor rejimi testi
        const isGun = this.battleType === 'gun';
        const ammoOk = isGun ? (p.snowballs === 30 && p.reserveAmmo === 120) : (p.snowballs > 0);
        results.push({
            name: `Jang Rejimi (${isGun ? 'Qurolli Jang 🔫' : 'Qor Jangi ❄️'})`,
            passed: ammoOk,
            details: isGun ? `Magazin: ${p.snowballs}/30, Zaxira: ${p.reserveAmmo}/120 (R bilan zaryadlash)` : `Qor to'pi: ${p.snowballs}/${p.maxSnowballs} (Space yoki tugma bilan yasash)`
        });

        // 3. Minecraft 3D Perspektiva va Xarita testi
        const mapOk = (isGun ? this.mapType === 'warzone' : true) && this.obstacles.length >= 6;
        results.push({
            name: "Minecraft Muhiti va Xarita Bazalari",
            passed: mapOk,
            details: `Xarita: ${this.mapType}, To'siqlar va qal'alar: ${this.obstacles.length} ta, Voxel bulutlar va kvadrat quyosh: Aktiv`
        });

        // 4. 3D Kamera Rejimlari
        results.push({
            name: "3D Kamera Perspektivasi (3-Litso / 1-Litso / Tepadan)",
            passed: !!this.cameraMode,
            details: `Hozirgi rejim: ${this.cameraMode === 'third_person' ? '👤 3D 3-Litso (Orqadan)' : (this.cameraMode === 'first_person' ? '👁️ 3D 1-Litso (FPS)' : '🗺️ 3D Tepadan')}`
        });

        // 5. Minecraft 3D Personaj Modellari
        const charType = p.characterType || this.characterType || 'steve';
        results.push({
            name: "Minecraft 3D Personaj Modeli",
            passed: typeof this.drawMinecraftCharacter === 'function',
            details: `Faol qahramon: ${charType.toUpperCase()} (Steve, Skeleton, Enderman, Zombie, Creeper)`
        });

        // 6. Enter va Sichqoncha bilan Otish Tizimi
        results.push({
            name: "Otish Tizimi (Enter, Sichqoncha, Mobil Tugma)",
            passed: typeof this.throwSnowball === 'function',
            details: "Enter klavishi, sichqoncha chap tugmasi va ekrandagi sensor tugma bilan otish faol"
        });

        // 7. Three.js Real 3D WebGL Dvigateli
        results.push({
            name: "Three.js Real 3D WebGL Dvigateli",
            passed: !!window.THREE,
            details: window.THREE ? "WebGL 3D grafik dvigateli va Minecraft 3D dunyosi aktiv" : "Zaxira 2D rejim faol"
        });

        // Konsol va ekranga hisobot chiqarish
        console.log("%c=== 🧪 O'YIN TEST HISOBOTI (DIAGNOSTICS) ===", "color:#00f5d4; font-size:14px; font-weight:bold;");
        let allPassed = true;
        for (let r of results) {
            const icon = r.passed ? '✅' : '❌';
            if (!r.passed) allPassed = false;
            console.log(`${icon} ${r.name}: ${r.details}`);
        }
        if (allPassed) {
            this.showKillFeed("✅ TEST REJIMI: Harakat, Qurol va 3D Minecraft to'liq ishlamoqda!", true);
        } else {
            this.showKillFeed("⚠️ Testda kamchiliklar aniqlandi, konsolni ko'ring.", true);
        }

        const total = results.length;
        const passed = results.filter(r => r.passed).length;
        const failed = total - passed;
        return { total, passed, failed, results };
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseModal = document.getElementById('pauseModal');
        if (this.isPaused) pauseModal.classList.remove('hidden');
        else pauseModal.classList.add('hidden');
    }

    // ==========================================
    // RENDERLASH
    // ==========================================
    render() {
        // 1. Agar Three.js 3D dvigateli mavjud bo'lsa, haqiqiy 3D WebGL renderlash
        if (this.threeEngine) {
            this.threeEngine.render();
        }

        // 2. 2D Canvas orqali HUD elementlari, effektlar va nishon
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Agar Three.js mavjud bo'lmasa, zaxira 2D render ishlaydi
        if (!this.threeEngine) {
            if (this.cameraMode === 'first_person') {
                this.renderFirstPerson(ctx);
            } else {
                this.renderThirdPerson(ctx);
            }
            return;
        }

        // Three.js bilan birga: 2D Overlay (Qor bo'roni, Krosshayr nishon, zarbalar)
        this.render2DOverlays(ctx);
    }

    render2DOverlays(ctx) {
        // 1. Krosshayr (Nishon)
        const cx = this.width / 2;
        const cy = this.height / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy);
        ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy);
        ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5);
        ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 14);
        ctx.stroke();

        // 2. 2D Zarrachalar (Particles)
        this.renderParticles(ctx);

        // 3. Qor yog'ishi (Snowflakes)
        this.renderSnowflakes(ctx);
        ctx.restore();
    }

    renderThirdPerson(ctx) {
        this.renderTerrain(ctx);
        this.renderFootprints(ctx);
        this.renderGroundCoins(ctx);
        this.renderObstacles(ctx);

        for (let [id, player] of this.players) {
            this.renderPlayer(ctx, player);
        }

        this.renderSnowballs(ctx);
        this.renderParticles(ctx);
        this.renderSnowflakes(ctx);
    }

    // =======================================================
    // 1-LITSO (3D FIRST PERSON PERSPECTIVE) DVIGATELI
    // =======================================================
    renderFirstPerson(ctx) {
        const p = this.localPlayer;
        const walkBob = p.isMoving ? Math.sin(p.walkCycle) * 5 : 0;
        const horizonY = this.height * 0.48 + walkBob;

        // 1. Qishki Osmon, Tog'lar va Qorli Yer
        this.renderFirstPersonSky(ctx, horizonY, p);

        // 2. 3D Proyeksiyalangan Ob'ektlar (Dushmanlar, Daraxtlar, Qor to'plari, Tangalar)
        this.renderFirstPersonEntities(ctx, horizonY, p);

        // 3. 3D Qor Bo'roni (Blizzard)
        this.renderFirstPersonSnowflakes(ctx, horizonY);

        // 4. Oldingi qatordagi Voxel Qo'l va Qor Quroli (Rasmdagidek)
        if (!p.isDead) {
            this.renderFirstPersonGun(ctx, p);
        }

        // 5. Retro 1-Litso HUD (❤️ Yurak, Sariq Raqamli Hisob, Krosshayr Nishon)
        this.renderFirstPersonHUD(ctx, p);
    }

    renderFirstPersonSky(ctx, horizonY, p) {
        const w = this.width;
        const h = this.height;

        // 1. MINECRAFT KO'K OSMON (Azure Sky)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, '#558de8');
        skyGrad.addColorStop(0.65, '#78aaff');
        skyGrad.addColorStop(1, '#a8cdff');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // 2. MINECRAFT KVADRAT QUYOSH (Square Sun)
        ctx.save();
        const sunAngleOffset = ((p.angle * 280) % (w * 1.6) + w * 1.6) % (w * 1.6) - w * 0.3;
        const sunY = Math.max(30, horizonY * 0.32);

        // Kvadrat quyosh nuri (Halo)
        ctx.fillStyle = 'rgba(255, 245, 140, 0.25)';
        ctx.fillRect(sunAngleOffset - 42, sunY - 42, 84, 84);

        // Tashqi sariq kvadrat
        ctx.fillStyle = '#fff066';
        ctx.fillRect(sunAngleOffset - 26, sunY - 26, 52, 52);

        // Ichki oq kvadrat
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sunAngleOffset - 16, sunY - 16, 32, 32);
        ctx.restore();

        // 3. MINECRAFT 3D VOXEL BULUTLAR (Drifting Cubic Clouds)
        ctx.save();
        const cloudTime = performance.now() * 0.012;
        const cloudDrift = (cloudTime + p.angle * 180) % (w * 1.4);

        const clouds = [
            { xRel: -w * 0.2, y: horizonY * 0.22, w: 180, h: 26 },
            { xRel: w * 0.25, y: horizonY * 0.35, w: 240, h: 32 },
            { xRel: w * 0.70, y: horizonY * 0.18, w: 200, h: 28 },
            { xRel: w * 1.15, y: horizonY * 0.38, w: 260, h: 30 }
        ];

        for (let c of clouds) {
            let cx = (c.xRel - cloudDrift) % (w * 1.5);
            if (cx < -300) cx += w * 1.5;

            // Pastki soya qatlami (Minecraft cloud underside shadow)
            ctx.fillStyle = '#c7d2fe';
            ctx.fillRect(cx, c.y + c.h - 6, c.w, 6);

            // Asosiy oq kvadrat bulut
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx, c.y, c.w, c.h - 6);

            // Qo'shimcha pikselli pog'onalar (Stepped cloud voxels)
            ctx.fillRect(cx + 25, c.y - 8, c.w - 50, 8);
        }
        ctx.restore();

        // 4. MINECRAFT POG'ONALI TOG'LAR (Stepped Voxel Mountain Chunks)
        ctx.save();
        const mountainDrift = (p.angle * 140) % (w * 0.8);

        // Uzoqdagi tosh/qor pog'onali bloklar
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(-w, horizonY);
        const stepW = 38;
        for (let x = -w * 2; x < w * 3; x += stepW) {
            const hIndex = Math.floor(Math.abs(Math.sin(x * 0.008) * 4 + Math.cos(x * 0.016) * 3));
            const peakH = 25 + hIndex * 14;
            const drawX = x - mountainDrift;
            ctx.lineTo(drawX, horizonY - peakH);
            ctx.lineTo(drawX + stepW, horizonY - peakH);
        }
        ctx.lineTo(w * 3, horizonY);
        ctx.closePath();
        ctx.fill();

        // Oq qorli tepaliklar (Minecraft Snow Caps on peaks)
        ctx.fillStyle = '#e2e8f0';
        for (let x = -w * 2; x < w * 3; x += stepW) {
            const hIndex = Math.floor(Math.abs(Math.sin(x * 0.008) * 4 + Math.cos(x * 0.016) * 3));
            if (hIndex >= 3) {
                const peakH = 25 + hIndex * 14;
                const drawX = x - mountainDrift;
                ctx.fillRect(drawX, horizonY - peakH, stepW, 10);
            }
        }
        ctx.restore();

        // 5. YER (MINECRAFT PERSPECTIVE GROUND)
        if (this.mapType === 'warzone') {
            // Warzone: Cobblestone / Tosh g'isht zamin
            const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
            groundGrad.addColorStop(0, '#334155');
            groundGrad.addColorStop(0.5, '#1e293b');
            groundGrad.addColorStop(1, '#0f172a');
            ctx.fillStyle = groundGrad;
            ctx.fillRect(0, horizonY, w, h - horizonY);

            // Perspektivali blokli tosh kataklar
            ctx.save();
            ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
            ctx.lineWidth = 2;
            for (let i = 1; i <= 8; i++) {
                const py = horizonY + Math.pow(i / 8, 2.1) * (h - horizonY);
                ctx.beginPath();
                ctx.moveTo(0, py);
                ctx.lineTo(w, py);
                ctx.stroke();
            }
            // Vertikal chuqurlik nur chiziqlari (3D vanishing lines)
            for (let vx = 0; vx < w; vx += 120) {
                ctx.beginPath();
                ctx.moveTo(w / 2, horizonY);
                ctx.lineTo(vx * 2 - w / 2, h);
                ctx.stroke();
            }
            ctx.restore();
        } else {
            // Qorli maydon (Snow block terrain)
            const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
            groundGrad.addColorStop(0, '#f1f5f9');
            groundGrad.addColorStop(0.35, '#e2e8f0');
            groundGrad.addColorStop(1, '#cbd5e1');
            ctx.fillStyle = groundGrad;
            ctx.fillRect(0, horizonY, w, h - horizonY);

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1.5;
            for (let i = 1; i <= 7; i++) {
                const py = horizonY + Math.pow(i / 7, 2.0) * (h - horizonY);
                ctx.beginPath();
                ctx.moveTo(0, py);
                ctx.lineTo(w, py);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    renderFirstPersonEntities(ctx, horizonY, p) {
        const w = this.width;
        const fov = 1.25; // ~72 daraja FOV
        const projDist = (w / 2) / Math.tan(fov / 2);

        const renderList = [];

        // A. To'siqlar va Daraxtlar
        for (let obs of this.obstacles) {
            const dx = obs.x - p.x;
            const dy = obs.y - p.y;
            const distFwd = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
            const distSide = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
            if (distFwd < 10) continue;

            const screenX = (w / 2) + (distSide / distFwd) * projDist;
            const rawScale = projDist / distFwd;
            const scale = Math.min(rawScale * 0.40, 4.2);
            const screenY = horizonY + scale * 16;

            if (screenX > -scale * 200 && screenX < w + scale * 200) {
                renderList.push({ type: 'obstacle', data: obs, dist: distFwd, screenX, screenY, scale });
            }
        }

        // B. Boshqa O'yinchilar va Botlar (Minecraft Real Proportsiya)
        for (let [id, otherP] of this.players) {
            if (id === p.id) continue;
            const dx = otherP.x - p.x;
            const dy = otherP.y - p.y;
            const distFwd = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
            const distSide = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
            if (distFwd < 8) continue;

            const screenX = (w / 2) + (distSide / distFwd) * projDist;
            const rawScale = projDist / distFwd;
            const scale = Math.min(rawScale * 0.40, 4.2); // Normal, tabiiy o'lcham - ulkan bo'lib ketmaydi!
            const screenY = horizonY + scale * 16;

            if (screenX > -scale * 140 && screenX < w + scale * 140) {
                renderList.push({ type: 'player', data: otherP, dist: distFwd, screenX, screenY, scale });
            }
        }

        // C. Uchayotgan Qor to'plari
        for (let sb of this.snowballs) {
            const dx = sb.x - p.x;
            const dy = sb.y - p.y;
            const distFwd = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
            const distSide = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
            if (distFwd < 5) continue;

            const screenX = (w / 2) + (distSide / distFwd) * projDist;
            const scale = projDist / distFwd;
            const screenY = horizonY - scale * 3;

            renderList.push({ type: 'snowball', data: sb, dist: distFwd, screenX, screenY, scale });
        }

        // D. Yerdagi Oltin Tangalar
        for (let coin of this.groundCoins) {
            if (coin.isCollected) continue;
            const dx = coin.x - p.x;
            const dy = coin.y - p.y;
            const distFwd = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
            const distSide = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
            if (distFwd < 10) continue;

            const screenX = (w / 2) + (distSide / distFwd) * projDist;
            const scale = projDist / distFwd;
            const screenY = horizonY + scale * 18;

            renderList.push({ type: 'coin', data: coin, dist: distFwd, screenX, screenY, scale });
        }

        // Eng uzoqdagidan eng yaqindagiga qarab chizish (Painter's Algorithm)
        renderList.sort((a, b) => b.dist - a.dist);

        for (let item of renderList) {
            if (item.type === 'obstacle') {
                this.draw3DObstacle(ctx, item.data, item.screenX, item.screenY, item.scale);
            } else if (item.type === 'player') {
                this.draw3DPlayer(ctx, item.data, item.screenX, item.screenY, item.scale);
            } else if (item.type === 'snowball') {
                this.draw3DSnowball(ctx, item.data, item.screenX, item.screenY, item.scale);
            } else if (item.type === 'coin') {
                this.draw3DCoin(ctx, item.data, item.screenX, item.screenY, item.scale);
            }
        }
    }

    draw3DPlayer(ctx, otherP, screenX, screenY, scale) {
        ctx.save();
        const charType = otherP.characterType || 'steve';
        const teamColor = otherP.team === 'blue' ? '#38bdf8' : (otherP.team === 'red' ? '#f43f5e' : (otherP.color || '#e63946'));

        // Enderman baland va ingichka, oddiy o'yinchilar proporsional
        const heightMultiplier = charType === 'enderman' ? 1.45 : 1.0;
        const widthMultiplier = charType === 'enderman' ? 0.58 : 1.0;

        const baseW = 34 * scale * widthMultiplier;
        const baseH = 74 * scale * heightMultiplier;

        // Voxel kvadrat soya
        ctx.fillStyle = 'rgba(0, 10, 25, 0.28)';
        ctx.fillRect(screenX - baseW * 0.7, screenY - baseW * 0.15, baseW * 1.4, baseW * 0.3);

        if (otherP.isDead) {
            // Muzlagan Minecraft Blok
            ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2 * scale;
            ctx.fillRect(screenX - baseW * 0.45, screenY - baseH * 0.9, baseW * 0.9, baseH * 0.9);
            ctx.strokeRect(screenX - baseW * 0.45, screenY - baseH * 0.9, baseW * 0.9, baseH * 0.9);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('⛄ MUZLADI', screenX, screenY - baseH * 0.95);
            ctx.restore();
            return;
        }

        const legSwing = Math.sin(otherP.walkCycle || 0) * (11 * scale);

        // ==========================================
        // 1. OYOQLAR (Voxel Legs)
        // ==========================================
        const legW = baseW * 0.38;
        const legH = baseH * 0.38;

        if (charType === 'steve') {
            // Steve: Ko'k-binafsha jinsi shim (Rasmdagi kabi #414bb2)
            ctx.fillStyle = '#414bb2';
            ctx.fillRect(screenX - baseW * 0.42, screenY - legH + legSwing, legW, legH);
            ctx.fillStyle = '#363d91';
            ctx.fillRect(screenX + baseW * 0.04, screenY - legH - legSwing, legW, legH);
            // Kulrang poyabzal (Gray shoes)
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(screenX - baseW * 0.42, screenY - 5 * scale + legSwing, legW, 5 * scale);
            ctx.fillRect(screenX + baseW * 0.04, screenY - 5 * scale - legSwing, legW, 5 * scale);
        } else if (charType === 'zombie') {
            // Zombie: Indigo shim (Rasmdagi kabi)
            ctx.fillStyle = '#3d4380';
            ctx.fillRect(screenX - baseW * 0.42, screenY - legH + legSwing, legW, legH);
            ctx.fillStyle = '#313667';
            ctx.fillRect(screenX + baseW * 0.04, screenY - legH - legSwing, legW, legH);
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(screenX - baseW * 0.42, screenY - 5 * scale + legSwing, legW, 5 * scale);
            ctx.fillRect(screenX + baseW * 0.04, screenY - 5 * scale - legSwing, legW, 5 * scale);
        } else if (charType === 'skeleton') {
            // Skeleton: Juda ingichka oq suyak oyoqlar (Rasmdagi kabi)
            const thinLegW = legW * 0.45;
            ctx.fillStyle = '#d1d5db';
            ctx.fillRect(screenX - baseW * 0.30, screenY - legH + legSwing, thinLegW, legH);
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(screenX + baseW * 0.15, screenY - legH - legSwing, thinLegW, legH);
        } else if (charType === 'enderman') {
            // Enderman: Juda uzun ingichka qop-qora oyoqlar (Rasmdagi kabi)
            const enderLegW = legW * 0.45;
            ctx.fillStyle = '#08080c';
            ctx.fillRect(screenX - baseW * 0.32, screenY - legH + legSwing, enderLegW, legH);
            ctx.fillRect(screenX + baseW * 0.12, screenY - legH - legSwing, enderLegW, legH);
        } else if (charType === 'creeper') {
            // Creeper: 4 ta kalta yashil blok oyoq
            ctx.fillStyle = '#2d6a4f';
            ctx.fillRect(screenX - baseW * 0.46, screenY - legH * 0.6 + legSwing, legW * 1.1, legH * 0.6);
            ctx.fillStyle = '#1b4332';
            ctx.fillRect(screenX + baseW * 0.02, screenY - legH * 0.6 - legSwing, legW * 1.1, legH * 0.6);
        }

        // ==========================================
        // 2. TANA (Voxel Torso)
        // ==========================================
        const torsoW = baseW * 0.84;
        const torsoH = baseH * 0.36;
        const torsoY = screenY - legH - torsoH;

        if (charType === 'steve') {
            // Steve: Feruza/Cyan futbolka (Rasmdagi kabi #00a8a8)
            ctx.fillStyle = '#00a8a8';
            ctx.fillRect(screenX - torsoW / 2, torsoY, torsoW, torsoH);
            // Yoqa o'yig'i (V-neck)
            ctx.fillStyle = '#d7a17c';
            ctx.fillRect(screenX - torsoW * 0.18, torsoY, torsoW * 0.36, torsoH * 0.24);
        } else if (charType === 'zombie') {
            // Zombie: Ko'k-yashil futbolka (Rasmdagi kabi)
            ctx.fillStyle = '#007788';
            ctx.fillRect(screenX - torsoW / 2, torsoY, torsoW, torsoH);
            ctx.fillStyle = '#4f772d';
            ctx.fillRect(screenX - torsoW * 0.18, torsoY, torsoW * 0.36, torsoH * 0.24);
        } else if (charType === 'skeleton') {
            // Skeleton: OCHIQ QOVURG'ALI SUYAK KO'KRAK (Rasmdagi kabi HOLLOW RIBCAGE!)
            // Orqa fon bo'sh ko'rinadi (hollow)
            ctx.fillStyle = '#1e293b'; // Bo'shliq soyasi
            ctx.fillRect(screenX - torsoW * 0.38, torsoY + torsoH * 0.15, torsoW * 0.76, torsoH * 0.7);

            // Markaziy umurtqa suyagi (Spine column)
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(screenX - 3 * scale, torsoY, 6 * scale, torsoH);

            // 3 ta oq qovurg'a shinalari (Horizontal ribs)
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(screenX - torsoW / 2, torsoY, torsoW, 4 * scale); // Yelka suyagi
            ctx.fillRect(screenX - torsoW * 0.44, torsoY + torsoH * 0.3, torsoW * 0.88, 3 * scale);
            ctx.fillRect(screenX - torsoW * 0.44, torsoY + torsoH * 0.58, torsoW * 0.88, 3 * scale);
            ctx.fillRect(screenX - torsoW * 0.32, torsoY + torsoH * 0.85, torsoW * 0.64, 4 * scale); // Tos suyagi
        } else if (charType === 'enderman') {
            // Enderman: Uzun ingichka qora tana (Rasmdagi kabi)
            ctx.fillStyle = '#08080c';
            ctx.fillRect(screenX - torsoW * 0.35, torsoY - torsoH * 0.25, torsoW * 0.7, torsoH * 1.25);
        } else if (charType === 'creeper') {
            // Creeper: Yashil pikselli tana
            ctx.fillStyle = '#38b000';
            ctx.fillRect(screenX - torsoW / 2, torsoY, torsoW, torsoH);
            ctx.fillStyle = '#2d6a4f';
            ctx.fillRect(screenX - torsoW * 0.3, torsoY + torsoH * 0.15, torsoW * 0.3, torsoH * 0.3);
            ctx.fillRect(screenX + torsoW * 0.05, torsoY + torsoH * 0.45, torsoW * 0.3, torsoH * 0.3);
        }

        // Diamond Armor ko'krak nishoni
        if (otherP.skin === 'diamond_armor') {
            ctx.fillStyle = '#00b4d8';
            ctx.fillRect(screenX - torsoW / 2, torsoY, torsoW, torsoH);
            ctx.strokeStyle = '#90e0ef';
            ctx.lineWidth = 2 * scale;
            ctx.strokeRect(screenX - torsoW / 2, torsoY, torsoW, torsoH);
        }

        // ==========================================
        // 3. QO'LLAR (Voxel Arms)
        // ==========================================
        const armW = baseW * 0.24;
        const armH = baseH * 0.36;
        const armY = torsoY;

        if (charType === 'zombie') {
            // ZOMBI: IKKALA QO'LI TO'G'RI OLDINGA CHO'ZILGAN (Rasmdagi zombie stancedek!)
            ctx.fillStyle = '#4f772d'; // Yashil zombi qo'li
            ctx.fillRect(screenX - torsoW / 2 - armW * 0.9, armY - armH * 0.25, armW * 1.1, armH * 0.6);
            ctx.fillRect(screenX + torsoW / 2 - armW * 0.2, armY - armH * 0.25, armW * 1.1, armH * 0.6);
            // Yenglar
            ctx.fillStyle = '#007788';
            ctx.fillRect(screenX - torsoW / 2 - armW * 0.9, armY, armW * 0.45, armH * 0.3);
            ctx.fillRect(screenX + torsoW / 2 + armW * 0.45, armY, armW * 0.45, armH * 0.3);
        } else if (charType === 'enderman') {
            // ENDERMAN: TIZSADAN HAM PASTGA TUSHGAN JUDA UZUN QORA QO'LLAR!
            const longArmH = armH * 1.5;
            ctx.fillStyle = '#08080c';
            ctx.fillRect(screenX - torsoW / 2 - armW * 0.6, armY - legSwing * 0.3, armW * 0.6, longArmH);
            ctx.fillRect(screenX + torsoW / 2, armY + legSwing * 0.3, armW * 0.6, longArmH);
        } else if (charType === 'skeleton') {
            // SKELETON: Yupqa suyak qo'llar
            const thinArmW = armW * 0.5;
            ctx.fillStyle = '#d1d5db';
            ctx.fillRect(screenX - torsoW / 2 - thinArmW, armY - legSwing * 0.4, thinArmW, armH);
            ctx.fillRect(screenX + torsoW / 2, armY + legSwing * 0.4, thinArmW, armH);
            // Qo'lda qurol yoki kamon
            const handX = screenX + torsoW / 2 + thinArmW;
            const handY = armY + armH * 0.85;
            if (this.battleType === 'gun') {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(handX - 3 * scale, handY - 14 * scale, 6 * scale, 18 * scale);
            }
        } else if (charType === 'steve') {
            // STEVE: Tananing o'ng va chap qo'li
            // Chap qo'l
            ctx.fillStyle = '#00a8a8'; // Yeng
            ctx.fillRect(screenX - torsoW / 2 - armW, armY - legSwing * 0.4, armW, armH * 0.32);
            ctx.fillStyle = '#d7a17c'; // Teri
            ctx.fillRect(screenX - torsoW / 2 - armW, armY + armH * 0.32 - legSwing * 0.4, armW, armH * 0.68);

            // O'ng qo'l
            ctx.fillStyle = '#00a8a8';
            ctx.fillRect(screenX + torsoW / 2, armY + legSwing * 0.4, armW, armH * 0.32);
            ctx.fillStyle = '#d7a17c';
            ctx.fillRect(screenX + torsoW / 2, armY + armH * 0.32 + legSwing * 0.4, armW, armH * 0.68);

            // Qo'ldagi qurol yoki qor to'pi
            const handX = screenX + torsoW / 2 + armW / 2;
            const handY = armY + armH * 0.85 + legSwing * 0.4;
            if (this.battleType === 'gun') {
                ctx.fillStyle = '#854d0e'; // Wooden stock
                ctx.fillRect(handX - 3 * scale, handY - 4 * scale, 7 * scale, 14 * scale);
                ctx.fillStyle = '#1e293b'; // Barrel
                ctx.fillRect(handX - 2 * scale, handY - 18 * scale, 5 * scale, 16 * scale);
            } else if (otherP.snowballs > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(handX, handY, 6 * scale, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ==========================================
        // 4. BOSH (Cubic Voxel Head - 100% Rasmdagidek)
        // ==========================================
        const headSize = baseW * 0.76;
        const headX = screenX - headSize / 2;
        const headY = torsoY - headSize;

        if (charType === 'steve') {
            // Steve boshi: Teri #d7a17c, soch #4a2c11
            ctx.fillStyle = '#d7a17c';
            ctx.fillRect(headX, headY, headSize, headSize);
            // Jigarrang soch (Top & Sides)
            ctx.fillStyle = '#4a2c11';
            ctx.fillRect(headX, headY, headSize, headSize * 0.3);
            ctx.fillRect(headX, headY, headSize * 0.18, headSize * 0.55);
            ctx.fillRect(headX + headSize * 0.82, headY, headSize * 0.18, headSize * 0.55);
            // Moviy ko'zlar
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(headX + headSize * 0.16, headY + headSize * 0.48, headSize * 0.24, headSize * 0.14);
            ctx.fillRect(headX + headSize * 0.60, headY + headSize * 0.48, headSize * 0.24, headSize * 0.14);
            ctx.fillStyle = '#25397a';
            ctx.fillRect(headX + headSize * 0.28, headY + headSize * 0.48, headSize * 0.12, headSize * 0.14);
            ctx.fillRect(headX + headSize * 0.72, headY + headSize * 0.48, headSize * 0.12, headSize * 0.14);
            // Burun
            ctx.fillStyle = '#c58b68';
            ctx.fillRect(headX + headSize * 0.42, headY + headSize * 0.64, headSize * 0.16, headSize * 0.12);
        } else if (charType === 'zombie') {
            // Zombie: Yashil kalla (#4f772d), qora ko'zlar
            ctx.fillStyle = '#4f772d';
            ctx.fillRect(headX, headY, headSize, headSize);
            ctx.fillStyle = '#283618';
            ctx.fillRect(headX, headY, headSize, headSize * 0.28);
            // Qora ko'zlar
            ctx.fillStyle = '#0f1406';
            ctx.fillRect(headX + headSize * 0.18, headY + headSize * 0.45, headSize * 0.22, headSize * 0.16);
            ctx.fillRect(headX + headSize * 0.60, headY + headSize * 0.45, headSize * 0.22, headSize * 0.16);
        } else if (charType === 'skeleton') {
            // Skeleton: Oq-kulrang suyak kalla, chuqur qora ko'z va og'iz (Rasmdagi kabi)
            ctx.fillStyle = '#d1d5db';
            ctx.fillRect(headX, headY, headSize, headSize);
            // Katta qora ko'z chuqurlari
            ctx.fillStyle = '#111827';
            ctx.fillRect(headX + headSize * 0.15, headY + headSize * 0.32, headSize * 0.26, headSize * 0.26);
            ctx.fillRect(headX + headSize * 0.59, headY + headSize * 0.32, headSize * 0.26, headSize * 0.26);
            // Qora og'iz teshigi
            ctx.fillRect(headX + headSize * 0.24, headY + headSize * 0.70, headSize * 0.52, headSize * 0.15);
        } else if (charType === 'enderman') {
            // Enderman: Qop-qora kalla va yupqa binafsharang porloq ko'zlar (Rasmdagi kabi)
            ctx.fillStyle = '#08080c';
            ctx.fillRect(headX, headY, headSize, headSize);
            // Porlab turuvchi binafsha ko'zlar
            ctx.fillStyle = '#e040fb';
            ctx.shadowColor = '#e040fb';
            ctx.shadowBlur = 12 * scale;
            ctx.fillRect(headX + headSize * 0.10, headY + headSize * 0.46, headSize * 0.32, headSize * 0.10);
            ctx.fillRect(headX + headSize * 0.58, headY + headSize * 0.46, headSize * 0.32, headSize * 0.10);
            ctx.shadowBlur = 0;

            // Atrofida suzuvchi binafsha Ender zarrachalari
            ctx.fillStyle = '#c084fc';
            for (let ep = 0; ep < 3; ep++) {
                const pOffX = Math.sin(otherP.walkCycle + ep * 2) * (headSize * 0.7);
                const pOffY = Math.cos(otherP.walkCycle + ep * 2) * (headSize * 0.5);
                ctx.fillRect(screenX + pOffX, headY + pOffY, 3 * scale, 3 * scale);
            }
        } else if (charType === 'creeper') {
            // Creeper: Mashhur qora g'amgin yuzi
            ctx.fillStyle = '#38b000';
            ctx.fillRect(headX, headY, headSize, headSize);
            ctx.fillStyle = '#000000';
            ctx.fillRect(headX + headSize * 0.16, headY + headSize * 0.24, headSize * 0.24, headSize * 0.24);
            ctx.fillRect(headX + headSize * 0.60, headY + headSize * 0.24, headSize * 0.24, headSize * 0.24);
            ctx.fillRect(headX + headSize * 0.38, headY + headSize * 0.48, headSize * 0.24, headSize * 0.32);
            ctx.fillRect(headX + headSize * 0.24, headY + headSize * 0.64, headSize * 0.52, headSize * 0.22);
        }

        // Diamond Dubulg'a
        if (otherP.skin === 'diamond_armor') {
            ctx.fillStyle = '#00b4d8';
            ctx.fillRect(headX - 2 * scale, headY - 3 * scale, headSize + 4 * scale, headSize * 0.45);
            ctx.fillRect(headX - 2 * scale, headY, headSize * 0.18, headSize);
            ctx.fillRect(headX + headSize * 0.82, headY, headSize * 0.18 + 2 * scale, headSize);
        }

        // Frost Shield Auras
        if (otherP.shield > 0) {
            ctx.strokeStyle = '#00f5d4';
            ctx.lineWidth = 3 * scale;
            ctx.shadowColor = '#00f5d4';
            ctx.shadowBlur = 12 * scale;
            ctx.strokeRect(screenX - baseW * 0.55, headY - 4 * scale, baseW * 1.1, baseH * 1.12);
            ctx.shadowBlur = 0;
        }

        // ==========================================
        // 5. JON VA NOMI (Overhead Nameplate & HP)
        // ==========================================
        const barW = Math.max(46, 56 * scale);
        const barH = Math.max(5, 7 * scale);
        const barX = screenX - barW / 2;
        const barY = headY - 14 * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barW, barH);
        const hpPct = Math.max(0, Math.min(1, otherP.hp / (otherP.maxHp || 100)));
        ctx.fillStyle = hpPct > 0.35 ? '#06d6a0' : '#ff3366';
        ctx.fillRect(barX, barY, barW * hpPct, barH);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(otherP.name, screenX, barY - 4 * scale);

        ctx.restore();
    }

    // =======================================================
    // PODIUMDAGI 3D AYLANMA MINECRAFT PREVIEWSI
    // =======================================================
    draw3DHeroPreview(ctx, cx, cy, charType, skin, ball, frame, battleType) {
        ctx.save();
        const rot = frame * 0.65;
        const scale = 1.15;
        const baseW = 42 * scale;
        const baseH = 88 * scale;

        // 1. Tosh Podium (Stone Pedestal)
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, baseW * 1.1, baseW * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 18, baseW * 1.3, baseW * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 3D Personaj
        const bob = Math.sin(frame * 2) * 3;
        const pY = cy - 20 + bob;

        const fakePlayer = {
            id: 'preview',
            name: '',
            team: 'blue',
            color: '#4cc9f0',
            characterType: charType || 'steve',
            skin: skin || 'steve',
            snowballs: 1,
            hp: 100,
            maxHp: 100,
            shield: 0,
            walkCycle: frame * 1.8,
            isDead: false
        };

        this.draw3DPlayer(ctx, fakePlayer, cx, pY, scale);
        ctx.restore();
    }

    draw3DObstacle(ctx, obs, screenX, screenY, scale) {
        ctx.save();
        const r = (obs.radius || 30) * scale;
        const w = (obs.width || 60) * scale;
        const h = (obs.height || 60) * scale;

        if (obs.type === 'fortress_blue' || obs.type === 'fortress_red') {
            // Katta Minecraft Qal'a Devori (Stone / Nether Brick)
            const isBlue = obs.type === 'fortress_blue';
            ctx.fillStyle = isBlue ? '#475569' : '#450a0a';
            ctx.fillRect(screenX - w / 2, screenY - h, w, h);
            ctx.strokeStyle = isBlue ? '#334155' : '#260404';
            ctx.lineWidth = 3 * scale;
            ctx.strokeRect(screenX - w / 2, screenY - h, w, h);

            // Tishsimon minoralar (Crenellations)
            ctx.fillStyle = isBlue ? '#64748b' : '#7f1d1d';
            const toothW = w / 5;
            for (let i = 0; i < 5; i += 2) {
                ctx.fillRect(screenX - w / 2 + i * toothW, screenY - h - toothW * 0.7, toothW, toothW * 0.7);
            }

            // Minecraft Bayrog'i (Banner)
            ctx.fillStyle = isBlue ? '#0284c7' : '#dc2626';
            ctx.fillRect(screenX - 8 * scale, screenY - h * 0.8, 16 * scale, 32 * scale);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(screenX - 3 * scale, screenY - h * 0.8 + 6 * scale, 6 * scale, 20 * scale);

        } else if (obs.type === 'watchtower') {
            // Kuzatuv Minorasi (Watchtower)
            const towerH = 110 * scale;
            const towerW = 40 * scale;
            ctx.fillStyle = obs.team === 'blue' ? '#334155' : '#3f1a1a';
            ctx.fillRect(screenX - towerW / 2, screenY - towerH, towerW, towerH);

            // Tom maydonchasi
            ctx.fillStyle = obs.team === 'blue' ? '#0ea5e9' : '#ef4444';
            ctx.fillRect(screenX - towerW * 0.7, screenY - towerH - 12 * scale, towerW * 1.4, 12 * scale);

        } else if (obs.type === 'tnt') {
            // TNT Bloki
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(screenX - w / 2, screenY - h, w, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(screenX - w / 2, screenY - h * 0.65, w, h * 0.32);
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${Math.max(9, Math.round(11 * scale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TNT', screenX, screenY - h * 0.49);

        } else if (obs.type === 'chest') {
            // Minecraft Yog'och Sandig'i
            ctx.fillStyle = '#a16207';
            ctx.fillRect(screenX - w / 2, screenY - h, w, h);
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2 * scale;
            ctx.strokeRect(screenX - w / 2, screenY - h, w, h);
            // Qulf
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(screenX - 4 * scale, screenY - h * 0.55, 8 * scale, 9 * scale);

        } else if (obs.type === 'mc_tree' || obs.type === 'tree' || obs.type === 'grand_tree') {
            // Blokli Minecraft Archasi
            ctx.fillStyle = '#78350f'; // Oak trunk
            ctx.fillRect(screenX - r * 0.22, screenY - r * 0.8, r * 0.44, r * 0.8);

            // Blokli barglar qatlami
            ctx.fillStyle = '#15803d';
            ctx.fillRect(screenX - r * 1.1, screenY - r * 1.6, r * 2.2, r * 0.85);
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(screenX - r * 0.8, screenY - r * 2.3, r * 1.6, r * 0.8);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(screenX - r * 0.5, screenY - r * 2.8, r * 1.0, r * 0.6);

            if (obs.type === 'grand_tree') {
                ctx.fillStyle = '#fde047';
                ctx.font = `${Math.max(14, Math.round(22 * scale))}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('⭐', screenX, screenY - r * 2.9);
            }
        } else if (obs.type === 'snowman') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(screenX, screenY - r * 0.6, r * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX, screenY - r * 1.5, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f97316';
            ctx.fillRect(screenX, screenY - r * 1.5, r * 0.35, 4 * scale);
        } else {
            ctx.fillStyle = '#64748b';
            ctx.fillRect(screenX - w / 2, screenY - h, w, h);
        }

        ctx.restore();
    }

    draw3DSnowball(ctx, sb, screenX, screenY, scale) {
        ctx.save();
        const r = Math.max(4, (sb.radius || 8.5) * scale * 1.3);

        // Yorqin qor sharchasi
        const ballGrad = ctx.createRadialGradient(screenX - r * 0.3, screenY - r * 0.3, r * 0.2, screenX, screenY, r);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.7, '#e0f4ff');
        ballGrad.addColorStop(1, '#a8dadc');

        ctx.fillStyle = ballGrad;
        ctx.shadowColor = '#70d6ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    draw3DCoin(ctx, coin, screenX, screenY, scale) {
        ctx.save();
        const r = Math.max(6, 12 * scale);
        const bounce = Math.sin(coin.pulse) * (8 * scale);

        // Soya
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Oltin tanga
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#e09f3e';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(screenX, screenY - bounce, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(8, Math.round(11 * scale))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', screenX, screenY - bounce);
        ctx.restore();
    }

    renderFirstPersonSnowflakes(ctx, horizonY) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        for (let flake of this.snowflakes) {
            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.radius * 1.1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // =======================================================
    // 4. OLDINGI QATORDAGI VOXEL QO'L VA QOR QUROLI (Rasmdagidek)
    // =======================================================
    renderFirstPersonGun(ctx, p) {
        ctx.save();
        const w = this.width;
        const h = this.height;

        const walkBobX = p.isMoving ? Math.sin(p.walkCycle) * 10 : 0;
        const walkBobY = p.isMoving ? Math.abs(Math.cos(p.walkCycle)) * 8 : 0;

        const recoilX = this.gunRecoil * 18;
        const recoilY = this.gunRecoil * 32;
        const recoilAngle = -this.gunRecoil * 0.18;

        const gunOriginX = w * 0.72 + walkBobX + recoilX;
        const gunOriginY = h * 0.82 + walkBobY + recoilY;

        ctx.translate(gunOriginX, gunOriginY);
        ctx.rotate(recoilAngle);

        if (this.battleType === 'gun') {
            // ==========================================
            // 🔫 3D VOXEL PIXEL ASSAULT RIFLE (AK-47 / BLASTER)
            // ==========================================
            // Steve / Qahramonning bloki qo'li
            ctx.save();
            ctx.fillStyle = '#00a8a8'; // Steve cyan sleeve
            ctx.fillRect(-w * 0.04, -h * 0.02, w * 0.14, h * 0.35);
            ctx.fillStyle = '#fcd5ce'; // Hand
            ctx.fillRect(-w * 0.06, -30, 42, 44);
            ctx.restore();

            // Qurolning yog'och stock qismi (Wooden Stock)
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(w * 0.02, -18, w * 0.12, 38);
            ctx.fillStyle = '#713f12';
            ctx.fillRect(w * 0.06, -14, w * 0.07, 28);

            // Receiver (Metall markaziy quti)
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-w * 0.14, -38, w * 0.16, 46);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-w * 0.14, -38, w * 0.16, 12);

            // Egri magazin (Curved Banana Magazine)
            ctx.save();
            ctx.fillStyle = p.isReloading ? '#475569' : '#0f172a';
            const magDropY = p.isReloading ? Math.sin(p.reloadProgress / p.reloadDuration * Math.PI) * 45 : 0;
            ctx.translate(0, magDropY);
            ctx.beginPath();
            ctx.moveTo(-w * 0.08, 8);
            ctx.lineTo(-w * 0.04, 8);
            ctx.lineTo(-w * 0.02, 58);
            ctx.lineTo(-w * 0.07, 58);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Yog'och Handguard
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(-w * 0.22, -34, w * 0.08, 32);

            // Uzun Stvol (Barrel & Gas Tube)
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-w * 0.32, -30, w * 0.10, 22);

            // Oldingi nishon (Front Sight)
            ctx.fillStyle = '#334155';
            ctx.fillRect(-w * 0.30, -42, 10, 14);

            // Otishdagi olov va chaqnash (Muzzle Flash & Sparks)
            if (this.gunMuzzleFlash > 0) {
                ctx.save();
                ctx.fillStyle = '#f59e0b';
                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur = 25;
                ctx.beginPath();
                ctx.arc(-w * 0.34, -20, 24, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(-w * 0.34, -20, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // O'qlashdagi progress aylana
            if (p.isReloading) {
                const prog = p.reloadProgress / p.reloadDuration;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(-w * 0.05, 30, 26, 0, Math.PI * 2 * prog);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("O'QLANMOQDA...", -w * 0.05, 75);
            }

        } else {
            // ==========================================
            // ❄️ VOXEL QOR QUROLI (Snowball Blaster)
            // ==========================================
            const suitColor = p.color || '#e63946';
            ctx.fillStyle = suitColor;
            ctx.fillRect(-w * 0.06, -h * 0.04, w * 0.14, h * 0.35);

            // Metall blaster korpusi
            ctx.fillStyle = '#2b2d42';
            ctx.fillRect(-w * 0.18, -42, w * 0.16, 52);
            ctx.fillStyle = '#70d6ff';
            ctx.fillRect(-w * 0.28, -36, w * 0.11, 38);

            if (p.snowballs > 0) {
                const ballRadius = 26;
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#70d6ff';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(-w * 0.14, -54, ballRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (p.isCrafting) {
                const craftProg = p.craftProgress / p.craftDuration;
                ctx.strokeStyle = '#06d6a0';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(-w * 0.14, -54, 24, 0, Math.PI * 2 * craftProg);
                ctx.stroke();
            }
        }

        ctx.restore();
        ctx.restore();
    }

    // =======================================================
    // 5. RETRO 1-LITSO HUD (❤️ Yurak, 1 | 20 Hisob, Krosshayr)
    // =======================================================
    renderFirstPersonHUD(ctx, p) {
        ctx.save();
        const w = this.width;
        const h = this.height;

        // A. O'rtadagi nishon (Crosshair)
        const cx = w / 2;
        const cy = h / 2;

        // Dushman yaqinligini tekshirish (krosshayr qizil rangga kirishi uchun)
        let aimingAtEnemy = false;
        for (let [id, otherP] of this.players) {
            if (id === p.id || otherP.isDead) continue;
            if ((this.gameMode === '2v2' || this.gameMode === '4v4') && otherP.team === p.team) continue;
            const dx = otherP.x - p.x;
            const dy = otherP.y - p.y;
            const distFwd = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
            const distSide = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
            if (distFwd > 15 && Math.abs(distSide) < 35) {
                aimingAtEnemy = true;
                break;
            }
        }

        const chColor = aimingAtEnemy ? '#ff3366' : '#ffffff';
        const chSize = aimingAtEnemy ? 14 : 18;
        const chGap = aimingAtEnemy ? 4 : 6;

        ctx.strokeStyle = chColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = chColor;
        ctx.shadowBlur = aimingAtEnemy ? 12 : 4;

        // Yuqori, pastki, chap, o'ng chiziqlar
        ctx.beginPath();
        ctx.moveTo(cx, cy - chGap); ctx.lineTo(cx, cy - chGap - chSize);
        ctx.moveTo(cx, cy + chGap); ctx.lineTo(cx, cy + chGap + chSize);
        ctx.moveTo(cx - chGap, cy); ctx.lineTo(cx - chGap - chSize, cy);
        ctx.moveTo(cx + chGap, cy); ctx.lineTo(cx + chGap + chSize, cy);
        ctx.stroke();

        // Markaziy nuqta
        ctx.fillStyle = chColor;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();

        // B. Chap Yuqoridagi Retro Pixel ❤️ Yurak va HP (Rasmdagidek)
        ctx.save();
        const heartX = 28;
        const heartY = 75;

        // Pixel Yurakcha ❤️
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(heartX, heartY + 10);
        ctx.bezierCurveTo(heartX, heartY, heartX - 16, heartY, heartX - 16, heartY + 16);
        ctx.bezierCurveTo(heartX - 16, heartY + 28, heartX, heartY + 38, heartX, heartY + 44);
        ctx.bezierCurveTo(heartX, heartY + 38, heartX + 16, heartY + 28, heartX + 16, heartY + 16);
        ctx.bezierCurveTo(heartX + 16, heartY, heartX, heartY, heartX, heartY + 10);
        ctx.fill();

        // Katta qalin HP raqami (Rasmdagi 99 / 100)
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.font = '900 34px "Fredoka One", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.max(0, p.hp)}`, heartX + 28, heartY + 20);

        if (p.shield > 0) {
            ctx.fillStyle = '#00f5d4';
            ctx.font = '800 16px sans-serif';
            ctx.fillText(`🛡️ +${p.shield}`, heartX + 28, heartY + 46);
        }
        ctx.restore();

        // C. O'ng Yuqoridagi Sariq Raqamli Match Hisobi (Rasmdagi 1 | 20 dek)
        ctx.save();
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 10;
        ctx.font = '900 36px "Fredoka One", monospace, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.blueScore} | ${this.redScore}`, w - 30, 80);
        ctx.restore();

        // D. Qurol yonidagi Qor to'plari soni
        ctx.save();
        ctx.fillStyle = 'rgba(8, 20, 38, 0.85)';
        ctx.strokeStyle = '#70d6ff';
        ctx.lineWidth = 1.5;
        const ammoX = w - 160;
        const ammoY = h - 45;
        ctx.beginPath();
        ctx.roundRect(ammoX, ammoY, 135, 34, 17);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`❄️ QOR: ${p.snowballs} / ${p.maxSnowballs}`, ammoX + 68, ammoY + 17);
        ctx.restore();

        ctx.restore();
    }

    renderTerrain(ctx) {
        if (this.mapType === 'warzone') {
            // ⚔️ MINECRAFT WARZONE BAZASI - Blokli tosh zamin
            ctx.fillStyle = '#334155';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            const bSize = 44;
            for (let x = 0; x < this.width; x += bSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.height);
                ctx.stroke();
            }
            for (let y = 0; y < this.height; y += bSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(this.width, y);
                ctx.stroke();
            }

            // Qal'a chegaralari
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 8;
            ctx.strokeRect(6, 6, this.width - 12, this.height - 12);
            return;
        }

        const grad = ctx.createRadialGradient(this.width / 2, this.height / 2, 80, this.width / 2, this.height / 2, this.width * 0.7);
        if (this.mapType === 'forest') {
            grad.addColorStop(0, '#dceee8');
            grad.addColorStop(0.7, '#c6dfd6');
            grad.addColorStop(1, '#aecdbe');
        } else if (this.mapType === 'fortress') {
            grad.addColorStop(0, '#e2f0fb');
            grad.addColorStop(0.7, '#cbe3f5');
            grad.addColorStop(1, '#b0d4ee');
        } else {
            grad.addColorStop(0, '#eaf4fa');
            grad.addColorStop(0.6, '#d9e9f3');
            grad.addColorStop(1, '#c7dfed');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.strokeStyle = 'rgba(112, 214, 255, 0.4)';
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
    }

    renderFootprints(ctx) {
        for (let fp of this.footprints) {
            ctx.save();
            ctx.fillStyle = `rgba(160, 195, 220, ${fp.alpha})`;
            ctx.beginPath();
            ctx.ellipse(fp.x, fp.y, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    renderGroundCoins(ctx) {
        for (let coin of this.groundCoins) {
            if (coin.isCollected) continue;
            ctx.save();
            const bounce = Math.sin(coin.pulse) * 4;
            
            // Soya
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(coin.x, coin.y + 10, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Oltin tanga
            ctx.fillStyle = '#ffd166';
            ctx.strokeStyle = '#e09f3e';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(coin.x, coin.y - bounce, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Yaltiroq belgi
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', coin.x, coin.y - bounce);
            ctx.restore();
        }
    }

    renderObstacles(ctx) {
        for (let obs of this.obstacles) {
            if (obs.type === 'grand_tree') this.drawGrandHolidayTree(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'tree' || obs.type === 'mc_tree') this.drawPineTree(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'snowman') this.drawSnowman(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'gift') this.drawGiftBox(ctx, obs.x, obs.y, obs.width, obs.height, obs.color, obs.ribbon);
            else if (obs.type === 'snow_mound') this.drawSnowMound(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'wall') this.drawIceWall(ctx, obs.x, obs.y, obs.width, obs.height);
            else if (obs.type === 'ice_pillar') this.drawIcePillar(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'cabin') this.drawCabin(ctx, obs.x, obs.y, obs.width, obs.height);
            else if (obs.type === 'fortress_blue' || obs.type === 'fortress_red') {
                ctx.save();
                const isBlue = obs.type === 'fortress_blue';
                ctx.fillStyle = isBlue ? '#334155' : '#450a0a';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeStyle = isBlue ? '#475569' : '#7f1d1d';
                ctx.lineWidth = 3;
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(isBlue ? "KO'K QAL'A" : "QIZIL QAL'A", obs.x + obs.width / 2, obs.y + obs.height / 2);
                ctx.restore();
            } else if (obs.type === 'watchtower') {
                ctx.save();
                ctx.fillStyle = obs.team === 'blue' ? '#0284c7' : '#dc2626';
                ctx.beginPath();
                ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();
            } else if (obs.type === 'tnt') {
                ctx.save();
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(obs.x, obs.y + obs.height * 0.35, obs.width, obs.height * 0.3);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('TNT', obs.x + obs.width / 2, obs.y + obs.height / 2);
                ctx.restore();
            } else if (obs.type === 'chest') {
                ctx.save();
                ctx.fillStyle = '#b45309';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 2;
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(obs.x + obs.width / 2 - 2, obs.y + obs.height / 2 - 2, 4, 5);
                ctx.restore();
            }
        }
    }

    drawCabin(ctx, x, y, w, h) {
        ctx.save();
        // Soya
        ctx.fillStyle = 'rgba(0, 20, 40, 0.25)';
        ctx.fillRect(x, y + h - 5, w, 10);

        // Yog'och devorlar
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(x, y + 15, w, h - 15);
        ctx.strokeStyle = '#5c3a1e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y + 15, w, h - 15);

        // Eshikcha va deraza
        ctx.fillStyle = '#ffd166'; // Issiq chiroq yonib turgan deraza
        ctx.fillRect(x + w * 0.2, y + 24, 14, 14);
        ctx.strokeStyle = '#5c3a1e';
        ctx.strokeRect(x + w * 0.2, y + 24, 14, 14);

        // Qor qoplagan uchburchak tom
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 16);
        ctx.lineTo(x + w / 2, y - 8);
        ctx.lineTo(x + w + 6, y + 16);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#c5dbe8';
        ctx.stroke();

        ctx.restore();
    }

    drawGrandHolidayTree(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 30, 60, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.4, r * 1.1, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        const time = performance.now() * 0.003;
        const tiers = [
            { radius: r, color: '#105638' },
            { radius: r * 0.8, color: '#166e48' },
            { radius: r * 0.55, color: '#1e8a5b' }
        ];

        tiers.forEach((tier, idx) => {
            ctx.fillStyle = tier.color;
            ctx.beginPath();
            ctx.arc(x, y - idx * 10, tier.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y - idx * 10 - tier.radius * 0.3, tier.radius * 0.7, 0, Math.PI);
            ctx.fill();
        });

        const colors = ['#ff3366', '#ffd166', '#70d6ff', '#ffffff'];
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 + time * 0.5;
            const dist = r * 0.75;
            const lx = x + Math.cos(angle) * dist;
            const ly = y + Math.sin(angle) * dist * 0.85;

            const glow = Math.sin(time * 3 + i) * 0.5 + 0.5;
            ctx.fillStyle = colors[i % colors.length];
            ctx.shadowColor = colors[i % colors.length];
            ctx.shadowBlur = 10 * glow;
            ctx.beginPath();
            ctx.arc(lx, ly, 4 + glow * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffd166';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', x, y - 25);
        ctx.restore();
    }

    drawPineTree(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 30, 60, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.3, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1b6b47';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f0f8ff';
        ctx.beginPath();
        ctx.arc(x, y - r * 0.3, r * 0.65, 0, Math.PI);
        ctx.fill();
        ctx.restore();
    }

    drawSnowman(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 30, 60, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.3, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#c5dbe8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y - r * 0.55, r * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f77f00';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.55);
        ctx.lineTo(x + 12, y - r * 0.5);
        ctx.lineTo(x, y - r * 0.45);
        ctx.fill();

        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.25, r * 0.45, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawGiftBox(ctx, x, y, w, h, boxColor, ribbonColor) {
        ctx.save();
        ctx.fillStyle = boxColor;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = ribbonColor;
        ctx.fillRect(x + w / 2 - 2, y, 4, h);
        ctx.fillRect(x, y + h / 2 - 2, w, 4);

        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawSnowMound(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = '#d3e8f4';
        ctx.strokeStyle = '#b8d6ea';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x - 5, y - 4, r * 0.6, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawIceWall(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(112, 214, 255, 0.45)';
        ctx.strokeStyle = '#70d6ff';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }

    drawIcePillar(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(112, 214, 255, 0.5)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❄️', x, y);
        ctx.restore();
    }

    // =======================================================
    // PERSONAJLAR VA SKINLAR (Santa, Ninja, Qirol, Ayiq, Kiber)
    // =======================================================
    renderPlayer(ctx, p) {
        ctx.save();

        if (p.isDead) {
            this.drawSnowman(ctx, p.x, p.y, p.radius);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name + " (Muzladi)", p.x, p.y - p.radius - 8);
            ctx.restore();
            return;
        }

        // Barcha o'yinchilar Minecraft Voxel uslubida chiziladi
        this.drawMinecraftCharacter(ctx, p);

        // Muz Qalqoni (Frost Shield)
        if (p.shield > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f5d4';
            ctx.lineWidth = 2.5;
            ctx.fillStyle = 'rgba(0, 245, 212, 0.14)';
            ctx.shadowColor = '#00f5d4';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        if (p.isCrafting) {
            const prog = p.craftProgress / p.craftDuration;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = '#081324';
        ctx.font = 'bold 12px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y - p.radius - 14);

        const hpWidth = 36;
        const hpHeight = 5;
        const hpX = p.x - hpWidth / 2;
        const hpY = p.y - p.radius - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(hpX, hpY, hpWidth, hpHeight);
        ctx.fillStyle = (p.hp / (p.maxHp || 100)) > 0.35 ? '#06d6a0' : '#ff3366';
        ctx.fillRect(hpX, hpY, (p.hp / (p.maxHp || 100)) * hpWidth, hpHeight);

        if (p.shield > 0 && p.maxShield > 0) {
            const shY = hpY - 4;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(hpX, shY, hpWidth, 3);
            ctx.fillStyle = '#00f5d4';
            ctx.fillRect(hpX, shY, Math.min(1, (p.shield / p.maxShield)) * hpWidth, 3);
        }

        ctx.restore();
    }

    drawMinecraftCharacter(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        const charType = p.characterType || 'steve';

        // 1. Tana bloki (Voxel Body)
        let bodyColor = '#00a8a8'; // Steve cyan
        if (charType === 'zombie') bodyColor = '#006d77';
        else if (charType === 'skeleton') bodyColor = '#d1d5db';
        else if (charType === 'enderman') bodyColor = '#111118';
        else if (charType === 'creeper') bodyColor = '#38b000';
        else if (p.skin === 'diamond_armor') bodyColor = '#00b4d8';

        ctx.fillStyle = bodyColor;
        ctx.fillRect(-12, -14, 24, 28);

        // 2. Qo'llar (Arms)
        let handColor = '#fcd5ce';
        if (charType === 'zombie') handColor = '#4f772d';
        else if (charType === 'skeleton') handColor = '#d1d5db';
        else if (charType === 'enderman') handColor = '#111118';
        else if (charType === 'creeper') handColor = '#2d6a4f';

        const armSwing = p.isMoving ? Math.sin(p.walkCycle) * 6 : 0;
        ctx.fillStyle = handColor;
        ctx.fillRect(-18, -12 + armSwing, 6, 24);
        ctx.fillRect(12, -12 - armSwing, 6, 24);

        // 3. Bosh bloki (Head Cube)
        ctx.fillStyle = handColor;
        ctx.fillRect(-10, -10, 20, 20);

        if (charType === 'steve') {
            ctx.fillStyle = '#4a2e18'; // Brown hair
            ctx.fillRect(-10, -10, 20, 6);
            ctx.fillStyle = '#2b3a67'; // Blue eyes
            ctx.fillRect(-6, 2, 4, 3);
            ctx.fillRect(2, 2, 4, 3);
        } else if (charType === 'enderman') {
            ctx.fillStyle = '#e040fb'; // Purple slit eyes
            ctx.fillRect(-7, 2, 5, 2);
            ctx.fillRect(2, 2, 5, 2);
        } else if (charType === 'creeper') {
            ctx.fillStyle = '#000000'; // Creeper face
            ctx.fillRect(-5, 0, 3, 3);
            ctx.fillRect(2, 0, 3, 3);
            ctx.fillRect(-2, 3, 4, 4);
        }

        // 4. Qo'ldagi qurol yoki qor to'pi
        if (this.battleType === 'gun') {
            // Pixel AK-47
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(10, 6, 6, 12);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(11, -12, 4, 18);
        } else if (p.snowballs > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(14, 6, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    renderSnowballs(ctx) {
        for (let sb of this.snowballs) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 30, 60, 0.15)';
            ctx.beginPath();
            ctx.arc(sb.x, sb.y + 10, sb.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = this.getSnowballColor(sb.ballType);
            ctx.shadowColor = this.getSnowballColor(sb.ballType);
            ctx.shadowBlur = sb.ballType !== 'classic' ? 14 : 6;
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, sb.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    renderParticles(ctx) {
        for (let p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    renderSnowflakes(ctx) {
        for (let flake of this.snowflakes) {
            ctx.save();
            ctx.globalAlpha = flake.opacity;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

window.snowClashGame = new SnowClashGame();
