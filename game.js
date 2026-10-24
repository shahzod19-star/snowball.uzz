// game.js - Qor Jangi (Snow Clash) Kuchaytirilgan Dvigateli (Tez harakat, Tangalar, 3 ta Katta Karta, Skinlar)

class SnowClashGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.setupCanvas();

        this.isRunning = false;
        this.isPaused = false;
        this.isMultiplayer = false;
        this.ws = null;
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        this.playerName = localStorage.getItem('snow_player_name') || 'QorJangchisi';
        this.playerColor = localStorage.getItem('snow_player_color') || '#e63946';
        this.characterType = localStorage.getItem('snow_char_type') || 'human';
        this.equippedSkin = localStorage.getItem('snow_equipped_skin') || 'santa';
        this.equippedSnowball = localStorage.getItem('snow_equipped_ball') || 'classic';

        this.gameMode = '1v1';
        this.mapType = 'wonderland'; // 'wonderland', 'fortress', 'forest'
        this.roomCode = '';

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
        this.canvas.width = this.width;
        this.canvas.height = this.height;
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

        if (this.mapType === 'wonderland') {
            // 1. BAYRAM MAYDONI & SHAHARCHASI (Katta maydon, ko'plab boshpanalar)
            this.obstacles.push({ type: 'grand_tree', x: w / 2, y: h / 2, radius: 60 });
            
            // Sovg'alar
            this.obstacles.push({ type: 'gift', x: w / 2 - 50, y: h / 2 + 55, width: 28, height: 28, color: '#ff3366', ribbon: '#ffd166' });
            this.obstacles.push({ type: 'gift', x: w / 2 + 40, y: h / 2 + 50, width: 30, height: 30, color: '#ffd166', ribbon: '#4cc9f0' });
            this.obstacles.push({ type: 'gift', x: w / 2 + 5, y: h / 2 - 65, width: 26, height: 26, color: '#4cc9f0', ribbon: '#ff3366' });

            // Qor uychalari (Chalets / Cabins)
            this.obstacles.push({ type: 'cabin', x: w * 0.18, y: h * 0.25, width: 70, height: 50 });
            this.obstacles.push({ type: 'cabin', x: w * 0.82 - 70, y: h * 0.75 - 50, width: 70, height: 50 });

            // Qor odamlar
            this.obstacles.push({ type: 'snowman', x: w * 0.28, y: h * 0.45, radius: 26 });
            this.obstacles.push({ type: 'snowman', x: w * 0.72, y: h * 0.55, radius: 26 });

            // Archalar to'plami
            this.obstacles.push({ type: 'tree', x: w * 0.15, y: h * 0.75, radius: 34 });
            this.obstacles.push({ type: 'tree', x: w * 0.85, y: h * 0.25, radius: 34 });
            this.obstacles.push({ type: 'tree', x: w * 0.38, y: h * 0.18, radius: 30 });
            this.obstacles.push({ type: 'tree', x: w * 0.62, y: h * 0.82, radius: 30 });

            // Qor tepaliklari
            this.obstacles.push({ type: 'snow_mound', x: w * 0.4, y: h * 0.72, radius: 36 });
            this.obstacles.push({ type: 'snow_mound', x: w * 0.6, y: h * 0.28, radius: 36 });

        } else if (this.mapType === 'fortress') {
            // 2. MUZ QAL'ASI (Ice Citadel Arena)
            const cx = w / 2;
            const cy = h / 2;
            this.obstacles.push({ type: 'ice_pillar', x: cx, y: cy, radius: 50 });

            // Qal'aning 4 burchak mustahkam devorlari
            this.obstacles.push({ type: 'wall', x: cx - 220, y: cy - 120, width: 28, height: 140 });
            this.obstacles.push({ type: 'wall', x: cx + 192, y: cy - 120, width: 28, height: 140 });
            this.obstacles.push({ type: 'wall', x: cx - 120, y: cy + 140, width: 140, height: 28 });
            this.obstacles.push({ type: 'wall', x: cx - 120, y: cy - 168, width: 140, height: 28 });

            // Burchak minoralari
            this.obstacles.push({ type: 'ice_pillar', x: w * 0.15, y: h * 0.2, radius: 36 });
            this.obstacles.push({ type: 'ice_pillar', x: w * 0.85, y: h * 0.8, radius: 36 });
            this.obstacles.push({ type: 'snowman', x: w * 0.15, y: h * 0.8, radius: 26 });
            this.obstacles.push({ type: 'snowman', x: w * 0.85, y: h * 0.2, radius: 26 });

        } else {
            // 3. SEHRLI QOR O'RMONI (Enchanted Pine Forest) - Katta o'rmon va muzli so'qmoqlar
            const treePositions = [
                { x: w * 0.2, y: h * 0.2 }, { x: w * 0.35, y: h * 0.28 },
                { x: w * 0.5, y: h * 0.15 }, { x: w * 0.65, y: h * 0.28 }, { x: w * 0.8, y: h * 0.2 },
                { x: w * 0.2, y: h * 0.8 }, { x: w * 0.35, y: h * 0.72 },
                { x: w * 0.5, y: h * 0.85 }, { x: w * 0.65, y: h * 0.72 }, { x: w * 0.8, y: h * 0.8 },
                { x: w * 0.25, y: h * 0.5 }, { x: w * 0.75, y: h * 0.5 }
            ];

            treePositions.forEach(tp => {
                this.obstacles.push({ type: 'tree', x: tp.x, y: tp.y, radius: 32 });
            });

            // O'rmon ichidagi qor uychasi va qor tepaliklari
            this.obstacles.push({ type: 'cabin', x: w * 0.45, y: h * 0.44, width: 80, height: 55 });
            this.obstacles.push({ type: 'snowman', x: w * 0.42, y: h * 0.62, radius: 26 });
            this.obstacles.push({ type: 'snowman', x: w * 0.58, y: h * 0.36, radius: 26 });
        }

        // Xaritada terib olinadigan Oltin Tangalarni joylashtirish (5-8 ta tanga)
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

            // Space - Qor yasash
            if (e.code === 'Space' && !this.isPaused && !this.localPlayer.isDead) {
                e.preventDefault();
                this.startCrafting();
            }

            // Pauza (Escape yoki P)
            if ((e.key.toLowerCase() === 'p' || e.key === 'Escape' || e.code === 'Escape') && this.isRunning) {
                e.preventDefault();
                this.togglePause();
            } else if (e.key === 'Enter' && this.isPaused && this.isRunning) {
                e.preventDefault();
                this.togglePause();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        });

        window.addEventListener('mousemove', (e) => {
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

        // 3. CRAFT TUGMASI
        if (btnCraft) {
            const doCraft = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isRunning && !this.isPaused && !this.localPlayer.isDead) {
                    this.startCrafting();
                }
            };
            btnCraft.addEventListener('pointerdown', doCraft);
            btnCraft.addEventListener('touchstart', doCraft, { passive: false });
            btnCraft.addEventListener('click', doCraft);
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
        this.characterType = config.characterType || localStorage.getItem('snow_char_type') || 'human';
        this.equippedSkin = localStorage.getItem('snow_equipped_skin') || 'santa';
        this.equippedSnowball = localStorage.getItem('snow_equipped_ball') || 'classic';

        this.gameMode = config.mode || '1v1';
        this.mapType = config.map || 'wonderland';
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
        this.localPlayer.maxSnowballs = playerStats.maxSnowballs;
        this.localPlayer.snowballs = Math.min(4, playerStats.maxSnowballs);
        this.localPlayer.snowballDamage = playerStats.damage;
        this.localPlayer.maxShield = playerStats.maxShield;
        this.localPlayer.shield = playerStats.shield;
        this.localPlayer.isCrafting = false;
        this.localPlayer.isDead = false;
        this.localPlayer.team = config.team || 'blue';

        if (this.localPlayer.team === 'blue') {
            this.localPlayer.x = this.width * 0.18;
            this.localPlayer.y = this.height * 0.5;
        } else {
            this.localPlayer.x = this.width * 0.82;
            this.localPlayer.y = this.height * 0.5;
        }

        this.players.clear();
        this.players.set(this.playerId, this.localPlayer);

        document.getElementById('hudPlayerName').textContent = this.playerName;
        document.getElementById('hudRoomTag').textContent = this.getModeLabel(this.gameMode);
        
        const hudCoins = document.getElementById('hudCoinsText');
        if (hudCoins) hudCoins.textContent = this.coins;

        this.updateHpUI();
        this.updateSnowballSlotsUI();
        this.updateScoreUI();

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
                spawnX = this.width * 0.15 + Math.random() * 80;
                spawnY = this.height * 0.3 + (i * 90);
            } else if (team === 'red') {
                spawnX = this.width * 0.85 - Math.random() * 80;
                spawnY = this.height * 0.3 + (i * 90);
            } else {
                spawnX = Math.random() * (this.width - 200) + 100;
                spawnY = Math.random() * (this.height - 200) + 100;
            }

            const bot = {
                id: botId,
                name: name,
                isBot: true,
                difficulty: botConf.difficulty,
                x: spawnX,
                y: spawnY,
                radius: 22,
                color: team === 'blue' ? '#4cc9f0' : (team === 'red' ? '#ff3366' : colors[i % colors.length]),
                characterType: 'human',
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
        if (this.localPlayer.isCrafting || this.localPlayer.isDead) return;
        if (this.localPlayer.throwCooldown > 0) return;

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

        if (angle === null) {
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
        const speed = 15.5;

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
        if (bot.snowballs <= 0 || bot.throwCooldown > 0 || bot.isDead) return;

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

        if (this.keys['w'] || this.keys['arrowup'] || this.keys['keyw']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown'] || this.keys['keys']) dy += 1;
        if (this.keys['a'] || this.keys['arrowleft'] || this.keys['keya']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright'] || this.keys['keyd']) dx += 1;

        // Virtual Joystik harakati
        if (this.joystick && this.joystick.active && (Math.abs(this.joystick.dx) > 0.05 || Math.abs(this.joystick.dy) > 0.05)) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        }

        if (dx !== 0 && dy !== 0 && (!this.joystick || !this.joystick.active)) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        p.isMoving = (Math.hypot(dx, dy) > 0.08);
        // Shift tugmasi yoki Mobil Sprint yoqilganda
        p.isSprinting = ((this.keys['shift'] || this.keys['shiftleft'] || this.keys['shiftright']) || this.mobileSprinting) && p.isMoving;

        const currentSpeed = p.isSprinting ? p.sprintSpeed : p.speed;

        if (p.isMoving) {
            p.walkCycle += p.isSprinting ? 0.24 : 0.17;
            const nextX = p.x + dx * currentSpeed;
            const nextY = p.y + dy * currentSpeed;

            if (nextX >= p.radius && nextX <= this.width - p.radius && !this.checkObstacleCollision(nextX, p.y, p.radius)) {
                p.x = nextX;
            }
            if (nextY >= p.radius && nextY <= this.height - p.radius && !this.checkObstacleCollision(p.x, nextY, p.radius)) {
                p.y = nextY;
            }

            if (Math.random() < 0.25) {
                this.footprints.push({ x: p.x, y: p.y + 12, alpha: 0.5 });
                if (this.footprints.length > 80) this.footprints.shift();
            }
        }

        // Qahramonning nishon burchagi
        if (this.touchAimActive) {
            p.angle = Math.atan2(this.mousePos.y - p.y, this.mousePos.x - p.x);
        } else if (this.joystick && this.joystick.active && p.isMoving) {
            p.angle = Math.atan2(dy, dx);
        } else {
            p.angle = Math.atan2(this.mousePos.y - p.y, this.mousePos.x - p.x);
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

        // Mukofot berish
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

        // Tanga natijasini ko'rsatish
        const coinsEarnedElem = document.getElementById('matchCoinsEarned');
        if (coinsEarnedElem) coinsEarnedElem.textContent = `+${this.matchCoinsEarned} 🪙`;

        modal.classList.remove('hidden');
    }

    checkObstacleCollision(x, y, radius) {
        for (let obs of this.obstacles) {
            if (obs.type === 'grand_tree' || obs.type === 'tree' || obs.type === 'snowman' || obs.type === 'snow_mound' || obs.type === 'ice_pillar') {
                const dist = Math.hypot(obs.x - x, obs.y - y);
                if (dist < obs.radius + radius) return true;
            } else if (obs.type === 'gift' || obs.type === 'wall' || obs.type === 'cabin') {
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
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

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

    renderTerrain(ctx) {
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
            else if (obs.type === 'tree') this.drawPineTree(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'snowman') this.drawSnowman(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'gift') this.drawGiftBox(ctx, obs.x, obs.y, obs.width, obs.height, obs.color, obs.ribbon);
            else if (obs.type === 'snow_mound') this.drawSnowMound(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'wall') this.drawIceWall(ctx, obs.x, obs.y, obs.width, obs.height);
            else if (obs.type === 'ice_pillar') this.drawIcePillar(ctx, obs.x, obs.y, obs.radius);
            else if (obs.type === 'cabin') this.drawCabin(ctx, obs.x, obs.y, obs.width, obs.height);
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

        if (p.characterType === 'human') {
            this.drawHumanCharacter(ctx, p);
        } else {
            this.drawClassicCharacter(ctx, p);
        }

        // Muz Qalqoni (Frost Shield) gumbazi va neon aurasini chizish
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

        // Overhead Qalqon mini-bari
        if (p.shield > 0 && p.maxShield > 0) {
            const shY = hpY - 4;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(hpX, shY, hpWidth, 3);
            ctx.fillStyle = '#00f5d4';
            ctx.fillRect(hpX, shY, Math.min(1, (p.shield / p.maxShield)) * hpWidth, 3);
        }

        ctx.restore();
    }

    drawHumanCharacter(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);

        ctx.fillStyle = 'rgba(0, 20, 40, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        const legSwing = p.isMoving ? Math.sin(p.walkCycle) * 8 : 0;
        ctx.fillStyle = p.skin === 'ninja' ? '#0f172a' : (p.skin === 'cyber' ? '#00f5d4' : '#1e293b');
        ctx.beginPath();
        ctx.ellipse(-6, 10 + legSwing, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6, 10 - legSwing, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        const bendY = p.isCrafting ? 4 : 0;
        
        // Skin bo'yicha kiyim rangi
        let jacketColor = p.color;
        if (p.skin === 'ninja') jacketColor = '#1e293b';
        else if (p.skin === 'king') jacketColor = '#7209b7';
        else if (p.skin === 'bear') jacketColor = '#f8fafc';
        else if (p.skin === 'cyber') jacketColor = '#0b090a';

        ctx.fillStyle = jacketColor;
        ctx.beginPath();
        ctx.roundRect(-12, -8 + bendY, 24, 20, 6);
        ctx.fill();
        ctx.strokeStyle = p.skin === 'cyber' ? '#00f5d4' : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Sharf yoki aksessuar
        ctx.fillStyle = p.skin === 'king' ? '#ffd166' : '#ffffff';
        ctx.fillRect(-10, -10 + bendY, 20, 5);

        const throwArm = p.throwAnim ? (p.throwAnim / 8) * 12 : 0;
        const armAngle = p.angle;
        
        const hx1 = Math.cos(armAngle - 0.6) * (14 + throwArm);
        const hy1 = Math.sin(armAngle - 0.6) * (14 + throwArm) + bendY;
        const hx2 = Math.cos(armAngle + 0.6) * 14;
        const hy2 = Math.sin(armAngle + 0.6) * 14 + bendY;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx1, hy1, 5, 0, Math.PI * 2);
        ctx.arc(hx2, hy2, 5, 0, Math.PI * 2);
        ctx.fill();

        if (p.snowballs > 0 && !p.isCrafting) {
            const sbX = Math.cos(armAngle) * (15 + throwArm);
            const sbY = Math.sin(armAngle) * (15 + throwArm) + bendY;
            ctx.fillStyle = this.getSnowballColor(p.snowballType);
            ctx.beginPath();
            ctx.arc(sbX, sbY, 6.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Boshi
        ctx.fillStyle = '#fcd5ce';
        ctx.beginPath();
        ctx.arc(0, -16 + bendY, 9, 0, Math.PI * 2);
        ctx.fill();

        // BOSHQARIQ / BOSH KIYIMI (Skinlar bo'yicha)
        if (p.skin === 'king') {
            // Oltin toj
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.moveTo(-8, -20 + bendY);
            ctx.lineTo(-8, -27 + bendY);
            ctx.lineTo(-4, -23 + bendY);
            ctx.lineTo(0, -29 + bendY);
            ctx.lineTo(4, -23 + bendY);
            ctx.lineTo(8, -27 + bendY);
            ctx.lineTo(8, -20 + bendY);
            ctx.closePath();
            ctx.fill();
        } else if (p.skin === 'ninja') {
            // Qora ninja niqobi
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -20 + bendY, 16, 7);
            ctx.fillStyle = '#70d6ff'; // Porlovchi ko'zlar
            ctx.fillRect(-5, -18 + bendY, 3, 2);
            ctx.fillRect(2, -18 + bendY, 3, 2);
        } else if (p.skin === 'bear') {
            // Qutb ayig'i quloqlari
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(-8, -24 + bendY, 4, 0, Math.PI * 2);
            ctx.arc(8, -24 + bendY, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.skin === 'cyber') {
            // Kiber neon shlem
            ctx.fillStyle = '#00f5d4';
            ctx.fillRect(-8, -22 + bendY, 16, 4);
        } else {
            // Santa qalpoqchasi
            ctx.fillStyle = '#d90429';
            ctx.beginPath();
            ctx.moveTo(-9, -18 + bendY);
            ctx.lineTo(9, -18 + bendY);
            ctx.lineTo(0, -28 + bendY);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-10, -19 + bendY, 20, 4);
            ctx.beginPath();
            ctx.arc(0, -29 + bendY, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawClassicCharacter(ctx, p) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 20, 40, 0.2)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + p.radius * 0.6, p.radius * 0.9, p.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        let bodyOffsetY = p.isCrafting ? Math.sin(p.craftProgress * 0.5) * 3 : 0;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bodyOffsetY, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const handDist = p.radius + 6;
        const hx1 = p.x + Math.cos(p.angle - 0.5) * handDist;
        const hy1 = p.y + Math.sin(p.angle - 0.5) * handDist + bodyOffsetY;
        const hx2 = p.x + Math.cos(p.angle + 0.5) * handDist;
        const hy2 = p.y + Math.sin(p.angle + 0.5) * handDist + bodyOffsetY;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx1, hy1, 6, 0, Math.PI * 2);
        ctx.arc(hx2, hy2, 6, 0, Math.PI * 2);
        ctx.fill();

        if (p.snowballs > 0 && !p.isCrafting) {
            const sbX = p.x + Math.cos(p.angle) * (p.radius + 5);
            const sbY = p.y + Math.sin(p.angle) * (p.radius + 5) + bodyOffsetY;
            ctx.fillStyle = this.getSnowballColor(p.snowballType);
            ctx.beginPath();
            ctx.arc(sbX, sbY, 6.5, 0, Math.PI * 2);
            ctx.fill();
        }

        const capX = p.x + Math.cos(p.angle) * 3;
        const capY = p.y - 4 + bodyOffsetY;
        ctx.fillStyle = '#d90429';
        ctx.beginPath();
        ctx.arc(capX, capY, p.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(capX, capY - p.radius * 0.6, 5, 0, Math.PI * 2);
        ctx.fill();

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
