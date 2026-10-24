// lobby.js - Bosh Menyu, Xona Yaratish/Ulanish va Real-time Lobi Boshqaruvi

document.addEventListener('DOMContentLoaded', () => {
    const game = window.snowClashGame;
    const sound = window.soundSystem;

    // Asosiy ekranlar va modallar
    const mainLobbyScreen = document.getElementById('mainLobbyScreen');
    const inGameHUD = document.getElementById('inGameHUD');

    const createRoomModal = document.getElementById('createRoomModal');
    const joinRoomModal = document.getElementById('joinRoomModal');
    const roomWaitingModal = document.getElementById('roomWaitingModal');
    const browseRoomsModal = document.getElementById('browseRoomsModal');
    const settingsModal = document.getElementById('settingsModal');
    const profileModal = document.getElementById('profileModal');
    const pauseModal = document.getElementById('pauseModal');
    const gameOverModal = document.getElementById('gameOverModal');

    // Profil va sozlamalar
    let playerName = localStorage.getItem('snow_player_name') || 'QorJangchisi';
    let playerColor = localStorage.getItem('snow_player_color') || '#e63946';
    let characterType = localStorage.getItem('snow_char_type') || 'steve';
    if (characterType === 'human' || characterType === 'classic') characterType = 'steve';
    let selectedBattleType = localStorage.getItem('snow_battle_type') || 'snow'; // 'snow' yoki 'gun'
    let selectedMode = '1v1';
    let selectedMap = selectedBattleType === 'gun' ? 'warzone' : 'wonderland';
    let currentRoomInfo = null;
    let isHost = false;

    // DOM Elementlari
    const lobbyPlayerName = document.getElementById('lobbyPlayerName');
    const editNameInput = document.getElementById('editNameInput');
    const heroPreviewCanvas = document.getElementById('heroPreviewCanvas');
    const heroCtx = heroPreviewCanvas.getContext('2d');

    // Musiqa pleyer elementlari
    const currentTrackDisplay = document.getElementById('currentTrackDisplay');
    const btnPrevTrack = document.getElementById('btnPrevTrack');
    const btnNextTrack = document.getElementById('btnNextTrack');
    const btnTogglePlayMusic = document.getElementById('btnTogglePlayMusic');

    // Sozlamalar elementlari
    const settingMusicSelect = document.getElementById('settingMusicSelect');
    const settingCharSelect = document.getElementById('settingCharSelect');
    const settingKillFeed = document.getElementById('settingKillFeed');

    // UI Dastlabki holati
    lobbyPlayerName.textContent = playerName + ' ✏️';
    editNameInput.value = playerName;

    // -------------------------------------------------------------
    // 1. PERSONAJNING PODIUMDAGI 3D PREVIEWSI (3D MINECRAFT HERO PREVIEW)
    // -------------------------------------------------------------
    let previewFrame = 0;
    function renderHeroPreview() {
        heroCtx.clearRect(0, 0, 180, 200);
        previewFrame += 0.035;
        const sq = window.shopAndQuests;
        const currentSkin = sq ? sq.equippedSkin : (localStorage.getItem('snow_equipped_skin') || 'steve');
        const currentBall = sq ? sq.equippedBall : (localStorage.getItem('snow_equipped_ball') || 'classic');

        if (game && typeof game.draw3DHeroPreview === 'function') {
            game.draw3DHeroPreview(heroCtx, 90, 160, characterType, currentSkin, currentBall, previewFrame, selectedBattleType);
        } else if (game && typeof game.drawMinecraftCharacter === 'function') {
            const p = {
                x: 90,
                y: 110,
                radius: 26,
                color: playerColor,
                characterType: characterType,
                skin: currentSkin,
                snowballType: currentBall,
                team: 'blue',
                hp: 100,
                maxHp: 100,
                snowballs: 1,
                isCrafting: false,
                isMoving: true,
                walkCycle: previewFrame * 2,
                angle: Math.sin(previewFrame) * 0.3,
                isDead: false,
                throwAnim: 0
            };
            game.drawMinecraftCharacter(heroCtx, p);
        }

        requestAnimationFrame(renderHeroPreview);
    }
    requestAnimationFrame(renderHeroPreview);

    // Minecraft Personaj tanlovi (Faqat xarid qilingan / mavjud personajlar ko'rinadi)
    const mcCharSelector = document.getElementById('mcCharacterSelector');
    const allKnownChars = {
        'steve': { name: 'Steve', icon: '⛏️', title: 'Steve - Klassik qahramon' },
        'barbie': { name: 'Barbie', icon: '🎀', title: 'Barbie - Qizlar uchun go\'zal' },
        'soldier': { name: 'Soldat', icon: '🎖️', title: 'Harbiy Soldat - Maxsus harbiy jangchi' },
        'zombie': { name: 'Zombi', icon: '🧟', title: 'Zombie - Yashil mutant' },
        'skeleton': { name: 'Skelet', icon: '💀', title: 'Skeleton - Mergan skelet' },
        'enderman': { name: 'Enderman', icon: '🌌', title: 'Enderman - Sirli mutant' },
        'creeper': { name: 'Creeper', icon: '💥', title: 'Creeper - Yashil maxluq' },
        'diamond_armor': { name: 'Olmos Steve', icon: '💎', title: 'Olmos Zirhli Steve' },
        'netherite': { name: 'Netherite', icon: '🔥', title: 'Netherite Jangchisi' },
        'cyber_steve': { name: 'Kiber Steve', icon: '🤖', title: 'Kiber Voxel Steve' }
    };

    function updateMcCharUI() {
        if (!mcCharSelector) return;
        const cards = mcCharSelector.querySelectorAll('.mc-char-card');
        cards.forEach(c => {
            if (c.getAttribute('data-char') === characterType) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
        if (settingCharSelect) settingCharSelect.value = characterType;
        localStorage.setItem('snow_char_type', characterType);
        localStorage.setItem('snow_equipped_skin', characterType);
        if (window.shopAndQuests) {
            window.shopAndQuests.equippedSkin = characterType;
        }
        if (game.localPlayer) {
            game.localPlayer.characterType = characterType;
            game.localPlayer.skin = characterType;
        }
    }

    window.renderLobbyCharacterCards = function() {
        if (!mcCharSelector) return;
        mcCharSelector.innerHTML = '';
        const sq = window.shopAndQuests;
        const owned = (sq && sq.ownedSkins) ? sq.ownedSkins : ['steve', 'barbie'];

        // Agar tanlangan personaj sotib olinmagan bo'lsa, birinchi mavjudiga o'tadi
        if (!owned.includes(characterType)) {
            characterType = owned[0] || 'steve';
        }

        owned.forEach(charId => {
            const meta = allKnownChars[charId] || { name: charId, icon: '⛏️', title: charId };
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `mc-char-card ${charId === characterType ? 'active' : ''}`;
            btn.setAttribute('data-char', charId);
            btn.title = meta.title;
            btn.textContent = `${meta.icon} ${meta.name}`;

            const handleSelect = (e) => {
                if (e) e.preventDefault();
                if (characterType !== charId) {
                    characterType = charId;
                    updateMcCharUI();
                    if (window.soundSystem) window.soundSystem.playClick();
                }
            };
            btn.addEventListener('click', handleSelect);
            btn.addEventListener('pointerdown', handleSelect);
            mcCharSelector.appendChild(btn);
        });

        updateMcCharUI();
    };

    if (settingCharSelect) {
        settingCharSelect.addEventListener('change', (e) => {
            characterType = e.target.value;
            updateMcCharUI();
            if (window.soundSystem) window.soundSystem.playClick();
        });
    }

    window.renderLobbyCharacterCards();

    // Jang Turi: Qor Jangi (Snow) vs Qurolli Jang (Gun)
    const btnBattleSnow = document.getElementById('btnBattleSnow');
    const btnBattleGun = document.getElementById('btnBattleGun');
    const pillMapWarzone = document.getElementById('pillMapWarzone');

    function updateBattleTypeUI() {
        if (selectedBattleType === 'gun') {
            if (btnBattleGun) btnBattleGun.classList.add('active');
            if (btnBattleSnow) btnBattleSnow.classList.remove('active');
            if (pillMapWarzone) {
                pillMapWarzone.style.display = 'flex';
                // Gun rejimida Minecraft Bazasi (warzone) majburiy
                const allPills = document.querySelectorAll('#mapPillsContainer .mode-pill');
                allPills.forEach(p => {
                    if (p.getAttribute('data-map') === 'warzone') {
                        p.classList.add('active');
                        p.style.display = 'flex';
                    } else {
                        p.classList.remove('active');
                        p.style.display = 'none'; // Qor va qurol bir kartada o'ynalmaydi!
                    }
                });
                selectedMap = 'warzone';
            }
        } else {
            if (btnBattleSnow) btnBattleSnow.classList.add('active');
            if (btnBattleGun) btnBattleGun.classList.remove('active');
            if (pillMapWarzone) {
                pillMapWarzone.style.display = 'none';
                const allPills = document.querySelectorAll('#mapPillsContainer .mode-pill');
                allPills.forEach(p => {
                    const m = p.getAttribute('data-map');
                    if (m === 'warzone') {
                        p.style.display = 'none';
                        p.classList.remove('active');
                    } else {
                        p.style.display = 'flex';
                    }
                });
                if (selectedMap === 'warzone') {
                    selectedMap = 'wonderland';
                    const wonderPill = document.querySelector('#mapPillsContainer .mode-pill[data-map="wonderland"]');
                    if (wonderPill) wonderPill.classList.add('active');
                }
            }
        }
        localStorage.setItem('snow_battle_type', selectedBattleType);
    }

    if (btnBattleSnow) {
        btnBattleSnow.addEventListener('click', () => {
            selectedBattleType = 'snow';
            updateBattleTypeUI();
        });
    }

    if (btnBattleGun) {
        btnBattleGun.addEventListener('click', () => {
            selectedBattleType = 'gun';
            updateBattleTypeUI();
        });
    }
    updateBattleTypeUI();



    // -------------------------------------------------------------
    // 2. MUSIQA VA SFX PLEYER BOSHQARUVI (HUD VA BOSH MENYUDAGI TUGMALAR)
    // -------------------------------------------------------------
    const btnMusic = document.getElementById('btnMusic');
    const btnSfx = document.getElementById('btnSfx');
    const btnPause = document.getElementById('btnPause');

    function syncAudioButtonsUI() {
        if (sound.musicMuted) {
            btnMusic.textContent = '🔇';
            btnMusic.classList.add('muted');
            btnTogglePlayMusic.textContent = '🔕';
        } else {
            btnMusic.textContent = '🎵';
            btnMusic.classList.remove('muted');
            btnTogglePlayMusic.textContent = '🔔';
        }

        if (sound.sfxMuted) {
            btnSfx.textContent = '🔈';
            btnSfx.classList.add('muted');
        } else {
            btnSfx.textContent = '🔊';
            btnSfx.classList.remove('muted');
        }

        const tr = sound.getCurrentTrack();
        if (currentTrackDisplay) currentTrackDisplay.textContent = tr.title;
        if (settingMusicSelect) settingMusicSelect.value = sound.currentTrackIndex;
    }

    btnMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.toggleMusic();
        syncAudioButtonsUI();
    });

    btnSfx.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.toggleSfx();
        syncAudioButtonsUI();
    });

    btnPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (game.isRunning) {
            game.togglePause();
        }
    });

    btnNextTrack.addEventListener('click', () => {
        sound.nextTrack();
        syncAudioButtonsUI();
    });

    btnPrevTrack.addEventListener('click', () => {
        const prevIdx = (sound.currentTrackIndex - 1 + sound.tracks.length) % sound.tracks.length;
        sound.setTrack(prevIdx);
        syncAudioButtonsUI();
    });

    btnTogglePlayMusic.addEventListener('click', () => {
        sound.toggleMusic();
        syncAudioButtonsUI();
    });

    syncAudioButtonsUI();

    // -------------------------------------------------------------
    // 3. REJIM VA XARITA TANLASH
    // -------------------------------------------------------------
    const modePills = document.querySelectorAll('.mode-pill[data-mode]');
    modePills.forEach(pill => {
        pill.addEventListener('click', () => {
            modePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedMode = pill.getAttribute('data-mode');
        });
    });

    const mapPills = document.querySelectorAll('.mode-pill[data-map]');
    mapPills.forEach(pill => {
        pill.addEventListener('click', () => {
            mapPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedMap = pill.getAttribute('data-map');
        });
    });

    // -------------------------------------------------------------
    // 4. MODALLARNI OCHISH VA YOPISH
    // -------------------------------------------------------------
    function openModal(modal) {
        modal.classList.remove('hidden');
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
    }

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-close');
            const target = document.getElementById(id);
            if (target) closeModal(target);
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop && backdrop.id !== 'pauseModal' && backdrop.id !== 'gameOverModal') {
                closeModal(backdrop);
            }
        });
    });

    // Profil tahrirlash
    document.getElementById('btnProfileCard').addEventListener('click', () => {
        editNameInput.value = playerName;
        document.getElementById('profileTotalHits').textContent = `${game.stats.hits} ta`;
        openModal(profileModal);
    });

    document.getElementById('btnSaveProfile').addEventListener('click', () => {
        const newName = editNameInput.value.trim();
        if (newName) {
            playerName = newName;
            localStorage.setItem('snow_player_name', playerName);
            lobbyPlayerName.textContent = playerName + ' ✏️';
            document.getElementById('hudPlayerName').textContent = playerName;
        }
        closeModal(profileModal);
    });

    // Sozlamalar modali
    document.getElementById('btnOpenSettings').addEventListener('click', () => {
        openModal(settingsModal);
    });

    // Kuchaytirish (Tool & Upgrades) modali
    const btnOpenUpgrades = document.getElementById('btnOpenUpgrades');
    if (btnOpenUpgrades) {
        btnOpenUpgrades.addEventListener('click', () => {
            if (window.shopAndQuests) window.shopAndQuests.renderUpgradesModal();
            openModal(document.getElementById('upgradesModal'));
        });
    }

    // Do'kon (Shop) modali
    const btnOpenShop = document.getElementById('btnOpenShop');
    if (btnOpenShop) {
        btnOpenShop.addEventListener('click', () => {
            if (window.shopAndQuests) window.shopAndQuests.renderShop();
            openModal(document.getElementById('shopModal'));
        });
    }

    // Vazifalar (Quests) modali
    const btnOpenQuests = document.getElementById('btnOpenQuests');
    if (btnOpenQuests) {
        btnOpenQuests.addEventListener('click', () => {
            if (window.shopAndQuests) window.shopAndQuests.renderQuests();
            openModal(document.getElementById('questsModal'));
        });
    }

    // Reyting (Leaderboard) modali
    const btnOpenLeaderboard = document.getElementById('btnOpenLeaderboard');
    if (btnOpenLeaderboard) {
        btnOpenLeaderboard.addEventListener('click', () => {
            if (window.shopAndQuests) window.shopAndQuests.renderLeaderboard();
            openModal(document.getElementById('leaderboardModal'));
        });
    }

    settingMusicSelect.addEventListener('change', (e) => {
        sound.setTrack(parseInt(e.target.value));
        updateMusicUI();
    });

    settingCharSelect.addEventListener('change', (e) => {
        characterType = e.target.value;
        updateTypeButtons();
    });

    settingKillFeed.addEventListener('change', (e) => {
        game.settings.showKillFeed = e.target.checked;
    });

    // -------------------------------------------------------------
    // 5. WEBSOCKET MULTIPLAYER BOG'LASH
    // -------------------------------------------------------------
    let ws = null;

    function getWebSocket() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return ws;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        try {
            ws = new WebSocket(wsUrl);
            game.ws = ws;

            ws.onopen = () => {
                console.log("[WS] Serverga muvaffaqiyatli ulandi");
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    handleServerMessage(msg);
                } catch (e) {
                    console.error("[WS] Xabar xatosi:", e);
                }
            };

            ws.onerror = (err) => {
                console.warn("[WS] Ulanish xatosi:", err);
            };

            ws.onclose = () => {
                console.log("[WS] Ulanish uzildi");
            };
        } catch (e) {
            console.warn("[WS] WebSocket ishga tushmadi:", e);
        }

        return ws;
    }

    function handleServerMessage(msg) {
        if (msg.type === 'room_created' || msg.type === 'room_joined') {
            currentRoomInfo = msg.room;
            isHost = (msg.type === 'room_created');
            if (msg.yourId) {
                game.playerId = msg.yourId;
                if (game.localPlayer) game.localPlayer.id = msg.yourId;
            }
            showWaitingLobby(msg.room, msg.players);
        } else if (msg.type === 'player_joined_lobby' || msg.type === 'lobby_players_update' || msg.type === 'player_left_lobby') {
            currentRoomInfo = msg.room || currentRoomInfo;
            updateWaitingRoomSlots(msg.players);
        } else if (msg.type === 'match_started') {
            closeModal(roomWaitingModal);
            mainLobbyScreen.classList.add('hidden');
            const myPlayerObj = (msg.players || []).find(p => p.id === game.playerId);
            const myTeam = myPlayerObj ? myPlayerObj.team : ((game.localPlayer && game.localPlayer.team) ? game.localPlayer.team : 'blue');
            const totalPlayers = (msg.players || []).length;
            const maxPlayers = (msg.room && msg.room.maxPlayers) ? msg.room.maxPlayers : getMaxPlayersForMode(msg.room ? msg.room.mode : selectedMode);
            const needBots = totalPlayers < maxPlayers;

            sound.init();
            sound.resume();
            syncAudioButtonsUI();

            game.startMatch({
                name: playerName,
                color: playerColor,
                characterType: characterType,
                battleType: selectedBattleType,
                mode: msg.room.mode,
                map: selectedBattleType === 'gun' ? 'warzone' : (msg.room.map || selectedMap),
                roomCode: msg.room.roomId,
                team: myTeam,
                isMultiplayer: true,
                useBots: needBots
            });
        } else if (msg.type === 'state_sync') {
            for (let p of msg.players) {
                if (p.id !== game.playerId) {
                    if (game.players.has(p.id)) {
                        const existing = game.players.get(p.id);
                        existing.x = p.x;
                        existing.y = p.y;
                        existing.angle = p.angle;
                        existing.hp = p.hp;
                        existing.snowballs = p.snowballs;
                        existing.isCrafting = p.isCrafting;
                        existing.isMoving = p.isMoving;
                        existing.isDead = p.isDead;
                        if (p.team) existing.team = p.team;
                    } else {
                        game.players.set(p.id, p);
                    }
                }
            }
            if (game.isRunning && !game.isGameOver) {
                game.checkWinCondition();
            }
        } else if (msg.type === 'remote_throw') {
            if (msg.snowball.ownerId !== game.playerId) {
                game.snowballs.push(msg.snowball);
                if (sound) sound.playThrow();
            }
        } else if (msg.type === 'remote_hit') {
            if (sound) sound.playHit();
            game.createSnowSplash(msg.x, msg.y, '#ffffff', 14);
        } else if (msg.type === 'remote_eliminated') {
            if (msg.killerTeam === 'blue') game.blueScore++;
            else if (msg.killerTeam === 'red') game.redScore++;
            game.updateScoreUI();
            if (game.players.has(msg.victimId)) {
                game.players.get(msg.victimId).isDead = true;
            }
            game.showKillFeed(`⛄ ${msg.victimName} muzlab qoldi! (${msg.killerName})`, true);
            if (game.isRunning && !game.isGameOver) {
                game.checkWinCondition();
            }
        } else if (msg.type === 'error') {
            alert(msg.message || "Xatolik yuz berdi");
        }
    }

    // -------------------------------------------------------------
    // 6. XONA YARATISH (CREATE ROOM) VA OFFLINE/ONLINE BOSHQARUV
    // -------------------------------------------------------------
    function getMaxPlayersForMode(mode) {
        if (mode === '1v1') return 2;
        if (mode === '2v2') return 4;
        if (mode === '3v3') return 6;
        if (mode === '4v4') return 8;
        return 6;
    }

    let localRoomPlayers = [];
    let localPlayerTeam = 'blue';

    const btnOpenCreateRoom = document.getElementById('btnOpenCreateRoom');
    const customRoomCodeInput = document.getElementById('customRoomCodeInput');
    const customRoomNameInput = document.getElementById('customRoomNameInput');
    const btnGenCode = document.getElementById('btnGenCode');
    const btnConfirmCreateRoom = document.getElementById('btnConfirmCreateRoom');

    function generateRandomCode() {
        const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let res = "QOR-";
        for (let i = 0; i < 4; i++) {
            res += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return res;
    }

    function openCreateRoomModalHandler() {
        if (customRoomCodeInput) customRoomCodeInput.value = generateRandomCode();
        if (customRoomNameInput) customRoomNameInput.value = `${playerName} xonasi`;
        openModal(createRoomModal);
    }

    if (btnOpenCreateRoom) {
        btnOpenCreateRoom.addEventListener('click', openCreateRoomModalHandler);
        btnOpenCreateRoom.addEventListener('touchend', (e) => {
            e.preventDefault();
            openCreateRoomModalHandler();
        });
    }

    if (btnGenCode) {
        btnGenCode.addEventListener('click', () => {
            if (customRoomCodeInput) customRoomCodeInput.value = generateRandomCode();
        });
    }

    function createLocalRoom(code, name) {
        isHost = true;
        localPlayerTeam = 'blue';
        const maxP = getMaxPlayersForMode(selectedMode);
        currentRoomInfo = {
            roomId: code,
            name: name,
            mode: selectedMode,
            map: selectedMap,
            maxPlayers: maxP,
            isCustom: true,
            isLocal: true
        };
        localRoomPlayers = [
            {
                id: game.playerId || 'local_player',
                name: playerName,
                color: playerColor,
                characterType: characterType,
                team: localPlayerTeam,
                isReady: true,
                isHost: true
            }
        ];
        closeModal(createRoomModal);
        showWaitingLobby(currentRoomInfo, localRoomPlayers);
    }

    function handleConfirmCreateRoom() {
        const code = ((customRoomCodeInput ? customRoomCodeInput.value.trim() : '') || generateRandomCode()).toUpperCase();
        const name = (customRoomNameInput ? customRoomNameInput.value.trim() : '') || `${playerName} xonasi`;

        let socket = null;
        try {
            socket = getWebSocket();
        } catch (e) {
            console.warn("[LOBBY] WebSocket ulanishi yo'q:", e);
        }

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'create_room',
                roomCode: code,
                roomName: name,
                mode: selectedMode,
                map: selectedMap,
                playerName: playerName,
                color: playerColor,
                characterType: characterType
            }));
            closeModal(createRoomModal);
            return;
        }

        if (socket && socket.readyState === WebSocket.CONNECTING) {
            let processed = false;
            const fallbackTimer = setTimeout(() => {
                if (!processed) {
                    processed = true;
                    createLocalRoom(code, name);
                }
            }, 800);

            socket.addEventListener('open', () => {
                if (!processed) {
                    processed = true;
                    clearTimeout(fallbackTimer);
                    socket.send(JSON.stringify({
                        type: 'create_room',
                        roomCode: code,
                        roomName: name,
                        mode: selectedMode,
                        map: selectedMap,
                        playerName: playerName,
                        color: playerColor,
                        characterType: characterType
                    }));
                    closeModal(createRoomModal);
                }
            }, { once: true });

            socket.addEventListener('error', () => {
                if (!processed) {
                    processed = true;
                    clearTimeout(fallbackTimer);
                    createLocalRoom(code, name);
                }
            }, { once: true });
            return;
        }

        // Agar server bo'lmasa (masalan GitHub Pages static rejimida)
        createLocalRoom(code, name);
    }

    if (btnConfirmCreateRoom) {
        btnConfirmCreateRoom.addEventListener('click', handleConfirmCreateRoom);
        btnConfirmCreateRoom.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleConfirmCreateRoom();
        });
    }

    // -------------------------------------------------------------
    // 7. XONAGA KIRISH (JOIN ROOM)
    // -------------------------------------------------------------
    const btnOpenJoinRoom = document.getElementById('btnOpenJoinRoom');
    const joinCodeInput = document.getElementById('joinCodeInput');
    const btnConfirmJoinRoom = document.getElementById('btnConfirmJoinRoom');

    if (btnOpenJoinRoom) {
        btnOpenJoinRoom.addEventListener('click', () => {
            if (joinCodeInput) joinCodeInput.value = '';
            openModal(joinRoomModal);
        });
    }

    function handleConfirmJoinRoom() {
        const code = (joinCodeInput ? joinCodeInput.value.trim() : '').toUpperCase();
        if (!code) {
            alert("Iltimos, xona kodini kiriting!");
            return;
        }

        let socket = null;
        try {
            socket = getWebSocket();
        } catch (e) {
            console.warn("[LOBBY] WS xatosi:", e);
        }

        const sendPayload = () => {
            socket.send(JSON.stringify({
                type: 'join_room',
                roomId: code,
                playerName: playerName,
                color: playerColor,
                characterType: characterType
            }));
            closeModal(joinRoomModal);
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
            sendPayload();
            return;
        }

        if (socket && socket.readyState === WebSocket.CONNECTING) {
            let processed = false;
            const fallbackTimer = setTimeout(() => {
                if (!processed) {
                    processed = true;
                    alert("Online serverga ulanib bo'lmadi (Offline rejim). Yangi xona yaratishingiz yoki botlar bilan o'ynashingiz mumkin!");
                }
            }, 1000);

            socket.addEventListener('open', () => {
                if (!processed) {
                    processed = true;
                    clearTimeout(fallbackTimer);
                    sendPayload();
                }
            }, { once: true });
            return;
        }

        alert("Online server mavjud emas (Offline rejim). Yangi xona yaratishingiz yoki botlar bilan o'ynashingiz mumkin!");
    }

    if (btnConfirmJoinRoom) {
        btnConfirmJoinRoom.addEventListener('click', handleConfirmJoinRoom);
        btnConfirmJoinRoom.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleConfirmJoinRoom();
        });
    }

    // -------------------------------------------------------------
    // 8. KUTISH LOBBISI (WAITING LOBBY)
    // -------------------------------------------------------------
    const waitingRoomTitle = document.getElementById('waitingRoomTitle');
    const waitingRoomCode = document.getElementById('waitingRoomCode');
    const btnCopyWaitingCode = document.getElementById('btnCopyWaitingCode');
    const blueTeamSlotsList = document.getElementById('blueTeamSlotsList');
    const redTeamSlotsList = document.getElementById('redTeamSlotsList');
    const btnSwitchTeam = document.getElementById('btnSwitchTeam');
    const btnToggleReady = document.getElementById('btnToggleReady');
    const btnHostStartMatch = document.getElementById('btnHostStartMatch');

    function showWaitingLobby(room, players) {
        if (waitingRoomTitle) {
            const modeText = game.getModeLabel ? game.getModeLabel(room.mode) : room.mode;
            const offlineTag = room.isLocal ? ' [Lokal]' : '';
            waitingRoomTitle.textContent = `🏆 ${room.name} (${modeText})${offlineTag}`;
        }
        if (waitingRoomCode) {
            waitingRoomCode.textContent = room.roomId;
        }
        updateWaitingRoomSlots(players);
        if (btnHostStartMatch) {
            btnHostStartMatch.style.display = isHost ? 'block' : 'none';
        }
        openModal(roomWaitingModal);
    }

    function updateWaitingRoomSlots(players) {
        if (!blueTeamSlotsList || !redTeamSlotsList) return;
        blueTeamSlotsList.innerHTML = '';
        redTeamSlotsList.innerHTML = '';

        if (!players) return;

        players.forEach(p => {
            const slot = document.createElement('div');
            slot.className = 'player-slot-item';

            const readyStatus = p.isReady ? '<span class="slot-ready-tag">✅ Tayyor</span>' : '<span style="color:#a8dadc;">⏳ Kutilmoqda</span>';
            const hostBadge = p.isHost ? ' 👑' : '';

            slot.innerHTML = `
                <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${p.color}; margin-right:6px;"></span>${p.name}${hostBadge}</span>
                ${readyStatus}
            `;

            if (p.team === 'blue') {
                blueTeamSlotsList.appendChild(slot);
            } else {
                redTeamSlotsList.appendChild(slot);
            }
        });
    }

    if (btnCopyWaitingCode) {
        btnCopyWaitingCode.addEventListener('click', () => {
            const code = waitingRoomCode.textContent;
            navigator.clipboard.writeText(code).then(() => {
                btnCopyWaitingCode.textContent = "✅ Nusxalandi!";
                setTimeout(() => {
                    btnCopyWaitingCode.textContent = "📋 Nusxalash";
                }, 2000);
            }).catch(() => {
                btnCopyWaitingCode.textContent = code;
            });
        });
    }

    if (btnSwitchTeam) {
        btnSwitchTeam.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN && currentRoomInfo && !currentRoomInfo.isLocal) {
                ws.send(JSON.stringify({ type: 'switch_team' }));
            } else if (currentRoomInfo && currentRoomInfo.isLocal) {
                localPlayerTeam = (localPlayerTeam === 'blue') ? 'red' : 'blue';
                if (localRoomPlayers.length > 0) {
                    localRoomPlayers[0].team = localPlayerTeam;
                }
                updateWaitingRoomSlots(localRoomPlayers);
                if (sound) sound.playClick();
            }
        });
    }

    if (btnToggleReady) {
        btnToggleReady.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN && currentRoomInfo && !currentRoomInfo.isLocal) {
                ws.send(JSON.stringify({ type: 'toggle_ready' }));
            } else if (currentRoomInfo && currentRoomInfo.isLocal) {
                if (localRoomPlayers.length > 0) {
                    localRoomPlayers[0].isReady = !localRoomPlayers[0].isReady;
                }
                updateWaitingRoomSlots(localRoomPlayers);
                if (sound) sound.playClick();
            }
        });
    }

    if (btnHostStartMatch) {
        btnHostStartMatch.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN && currentRoomInfo && !currentRoomInfo.isLocal) {
                ws.send(JSON.stringify({ type: 'start_match' }));
            } else {
                // Lokal yoki offline xonada o'yinni boshlash
                sound.init();
                sound.resume();
                syncAudioButtonsUI();
                closeModal(roomWaitingModal);
                mainLobbyScreen.classList.add('hidden');
                game.startMatch({
                    name: playerName,
                    color: playerColor,
                    characterType: characterType,
                    mode: currentRoomInfo ? currentRoomInfo.mode : selectedMode,
                    map: currentRoomInfo ? currentRoomInfo.map : selectedMap,
                    roomCode: currentRoomInfo ? currentRoomInfo.roomId : 'LOCAL',
                    team: localPlayerTeam || 'blue',
                    isMultiplayer: false,
                    useBots: true
                });
            }
        });
    }

    // -------------------------------------------------------------
    // 9. OCHIQ XONALARNI KO'RISH (BROWSE ROOMS)
    // -------------------------------------------------------------
    const btnOpenBrowseRooms = document.getElementById('btnOpenBrowseRooms');
    const roomsListContainer = document.getElementById('roomsListContainer');
    const btnRefreshRooms = document.getElementById('btnRefreshRooms');

    async function loadActiveRooms() {
        roomsListContainer.innerHTML = '<p style="color: #a8dadc; padding: 20px;">Yuklanmoqda...</p>';
        try {
            const res = await fetch('/api/rooms');
            const data = await res.json();
            renderRoomsList(data.rooms || []);
        } catch (e) {
            roomsListContainer.innerHTML = '<p style="color: #ff3366; padding: 20px;">Xonalarni yuklab bo\'lmadi.</p>';
        }
    }

    function renderRoomsList(rooms) {
        roomsListContainer.innerHTML = '';
        if (rooms.length === 0) {
            roomsListContainer.innerHTML = '<p style="color: #a8dadc; padding: 20px;">Hozirda ochiq xonalar mavjud emas. Yangi xona yarating!</p>';
            return;
        }

        rooms.forEach(r => {
            const row = document.createElement('div');
            row.className = 'room-item-row';
            row.innerHTML = `
                <div>
                    <div class="room-item-name">${r.name} [${r.roomId}]</div>
                    <div class="room-item-mode">${game.getModeLabel(r.mode)} • ${r.playerCount}/${r.maxPlayers} o'yinchi</div>
                </div>
                <button class="btn-join-room-row" data-room-id="${r.roomId}">Kirish 🚀</button>
            `;
            roomsListContainer.appendChild(row);
        });

        roomsListContainer.querySelectorAll('.btn-join-room-row').forEach(btn => {
            btn.addEventListener('click', () => {
                const rId = btn.getAttribute('data-room-id');
                let socket = null;
                try {
                    socket = getWebSocket();
                } catch (e) {
                    console.warn(e);
                }

                const sendJoin = () => {
                    socket.send(JSON.stringify({
                        type: 'join_room',
                        roomId: rId,
                        playerName: playerName,
                        color: playerColor,
                        characterType: characterType
                    }));
                    closeModal(browseRoomsModal);
                };

                if (socket && socket.readyState === WebSocket.OPEN) {
                    sendJoin();
                } else if (socket && socket.readyState === WebSocket.CONNECTING) {
                    socket.addEventListener('open', sendJoin, { once: true });
                } else {
                    alert("Online serverga ulanib bo'lmadi.");
                }
            });
        });
    }

    btnOpenBrowseRooms.addEventListener('click', () => {
        openModal(browseRoomsModal);
        loadActiveRooms();
    });

    btnRefreshRooms.addEventListener('click', loadActiveRooms);

    // -------------------------------------------------------------
    // 10. TEZKOR JANG VA OFFLINE BOT REJIMI
    // -------------------------------------------------------------
    const btnQuickPlay = document.getElementById('btnQuickPlay');
    const btnMobileQuickPlay = document.getElementById('btnMobileQuickPlay');
    const btnPlayBots = document.getElementById('btnPlayBots');

    const startQuickMatch = () => {
        sound.init();
        sound.resume();
        syncAudioButtonsUI();
        mainLobbyScreen.classList.add('hidden');
        game.startMatch({
            name: playerName,
            color: playerColor,
            characterType: characterType,
            battleType: selectedBattleType,
            mode: selectedMode,
            map: selectedBattleType === 'gun' ? 'warzone' : selectedMap,
            isMultiplayer: false,
            useBots: true
        });
    };

    btnQuickPlay.addEventListener('click', startQuickMatch);
    if (btnMobileQuickPlay) {
        btnMobileQuickPlay.addEventListener('click', startQuickMatch);
        btnMobileQuickPlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startQuickMatch();
        }, { passive: false });
    }

    btnPlayBots.addEventListener('click', () => {
        sound.init();
        sound.resume();
        syncAudioButtonsUI();
        mainLobbyScreen.classList.add('hidden');
        game.startMatch({
            name: playerName,
            color: playerColor,
            characterType: characterType,
            battleType: selectedBattleType,
            mode: selectedMode,
            map: selectedBattleType === 'gun' ? 'warzone' : selectedMap,
            isMultiplayer: false,
            useBots: true
        });
    });

    // Pauza va Game Over hodisalari
    document.getElementById('btnResume').addEventListener('click', () => {
        game.togglePause();
    });

    document.getElementById('btnRestart').addEventListener('click', () => {
        closeModal(pauseModal);
        game.startMatch({
            name: playerName,
            color: playerColor,
            characterType: characterType,
            battleType: selectedBattleType,
            mode: selectedMode,
            map: selectedBattleType === 'gun' ? 'warzone' : selectedMap,
            isMultiplayer: false,
            useBots: true
        });
    });

    document.getElementById('btnToLobby').addEventListener('click', () => {
        closeModal(pauseModal);
        game.isRunning = false;
        if (game.timerInterval) clearInterval(game.timerInterval);
        const mobileLayer = document.getElementById('mobileControlsLayer');
        if (mobileLayer) mobileLayer.classList.remove('active');
        if (inGameHUD) inGameHUD.classList.add('hidden');
        mainLobbyScreen.classList.remove('hidden');
    });

    document.getElementById('btnPlayAgain').addEventListener('click', () => {
        closeModal(gameOverModal);
        game.startMatch({
            name: playerName,
            color: playerColor,
            characterType: characterType,
            battleType: selectedBattleType,
            mode: selectedMode,
            map: selectedBattleType === 'gun' ? 'warzone' : selectedMap,
            isMultiplayer: false,
            useBots: true
        });
    });

    document.getElementById('btnGameOverLobby').addEventListener('click', () => {
        closeModal(gameOverModal);
        game.isRunning = false;
        if (game.timerInterval) clearInterval(game.timerInterval);
        const mobileLayer = document.getElementById('mobileControlsLayer');
        if (mobileLayer) mobileLayer.classList.remove('active');
        if (inGameHUD) inGameHUD.classList.add('hidden');
        mainLobbyScreen.classList.remove('hidden');
    });

    // To'liq ekran (Fullscreen) tugmasi
    const btnFullscreen = document.getElementById('btnFullscreen');
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                }
                btnFullscreen.textContent = '🗗';
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
                btnFullscreen.textContent = '⛶';
            }
        });
    }

    // -------------------------------------------------------------
    // KO'P TILLI TIZIM (O'ZBEK, RUS, INGLIZ TILLARI)
    // -------------------------------------------------------------
    let currentLang = localStorage.getItem('snow_lang') || 'uz';
    const translations = {
        uz: {
            brandTitle: "❄️ SNOW CLASH 3D ⚔️",
            brandSubtitle: "Minecraft 3D Arena & Battle Royale",
            battleSnow: "❄️ QOR JANGI",
            battleGun: "🔫 QUROLLI JANG",
            quickPlay: "🚀 TEZKOR JANG",
            createRoom: "➕ Xona Yaratish",
            joinRoom: "🔑 Xona Kodi bilan Kirish",
            browseRooms: "📋 Ochiq Xonalar",
            playBots: "🤖 Botlar bilan Mashq (Offline)",
            upgrades: "⚡ Kuchaytirish",
            shop: "🛒 Do'kon",
            quests: "📜 Vazifalar",
            leaderboard: "🏆 Reyting",
            dayText: "☀️ KUN",
            nightText: "🌙 TUN",
            scoreBlue: "Ko'k:",
            scoreRed: "Qizil:",
            radar: "🗺️ RADAR",
            alive: "Tirik"
        },
        ru: {
            brandTitle: "❄️ SNOW CLASH 3D ⚔️",
            brandSubtitle: "Minecraft 3D Боевая Арена и Королевская Битва",
            battleSnow: "❄️ СНЕЖНЫЙ БОЙ",
            battleGun: "🔫 ОРУЖЕЙНЫЙ БОЙ",
            quickPlay: "🚀 БЫСТРЫЙ БОЙ",
            createRoom: "➕ Создать Комнату",
            joinRoom: "🔑 Войти по Коду",
            browseRooms: "📋 Список Комнат",
            playBots: "🤖 Тренировка с Ботами",
            upgrades: "⚡ Прокачка",
            shop: "🛒 Магазин",
            quests: "📜 Задания",
            leaderboard: "🏆 Рейтинг",
            dayText: "☀️ ДЕНЬ",
            nightText: "🌙 НОЧЬ",
            scoreBlue: "Синие:",
            scoreRed: "Красные:",
            radar: "🗺️ РАДАР",
            alive: "Живых"
        },
        en: {
            brandTitle: "❄️ SNOW CLASH 3D ⚔️",
            brandSubtitle: "Minecraft 3D Arena & Battle Royale",
            battleSnow: "❄️ SNOW FIGHT",
            battleGun: "🔫 GUN BATTLE",
            quickPlay: "🚀 QUICK PLAY",
            createRoom: "➕ Create Room",
            joinRoom: "🔑 Join with Code",
            browseRooms: "📋 Browse Rooms",
            playBots: "🤖 Practice with Bots",
            upgrades: "⚡ Upgrades",
            shop: "🛒 Shop",
            quests: "📜 Quests",
            leaderboard: "🏆 Leaderboard",
            dayText: "☀️ DAY",
            nightText: "🌙 NIGHT",
            scoreBlue: "Blue:",
            scoreRed: "Red:",
            radar: "🗺️ RADAR",
            alive: "Alive"
        }
    };

    function updateDayNightButtonUI() {
        const btnToggleDayNight = document.getElementById('btnToggleDayNight');
        if (!btnToggleDayNight) return;
        const isNight = (game && game.timeOfDay === 'night');
        const t = translations[currentLang] || translations.uz;
        if (isNight) {
            btnToggleDayNight.classList.add('night');
            btnToggleDayNight.textContent = t.nightText;
        } else {
            btnToggleDayNight.classList.remove('night');
            btnToggleDayNight.textContent = t.dayText;
        }
    }

    function applyLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('snow_lang', lang);
        const t = translations[lang] || translations.uz;

        const langBtns = document.querySelectorAll('.lang-btn');
        langBtns.forEach(b => {
            if (b.getAttribute('data-lang') === lang) b.classList.add('active');
            else b.classList.remove('active');
        });

        const brandTitle = document.getElementById('brandTitle');
        if (brandTitle) brandTitle.textContent = t.brandTitle;

        const brandSubtitle = document.getElementById('brandSubtitle');
        if (brandSubtitle) brandSubtitle.textContent = t.brandSubtitle;

        if (btnBattleSnow) btnBattleSnow.textContent = t.battleSnow;
        if (btnBattleGun) btnBattleGun.textContent = t.battleGun;

        const btnQP = document.getElementById('btnQuickPlay');
        if (btnQP) btnQP.innerHTML = `<span>🚀</span> ${t.quickPlay.replace('🚀 ', '')}`;

        const btnCR = document.getElementById('btnOpenCreateRoom');
        if (btnCR) btnCR.innerHTML = `<span>➕</span> ${t.createRoom.replace('➕ ', '')}`;

        const btnJR = document.getElementById('btnOpenJoinRoom');
        if (btnJR) btnJR.innerHTML = `<span>🔑</span> ${t.joinRoom.replace('🔑 ', '')}`;

        const btnBR = document.getElementById('btnOpenBrowseRooms');
        if (btnBR) btnBR.innerHTML = `<span>📋</span> ${t.browseRooms.replace('📋 ', '')}`;

        const btnPB = document.getElementById('btnPlayBots');
        if (btnPB) btnPB.innerHTML = `<span>🤖</span> ${t.playBots.replace('🤖 ', '')}`;

        const btnOpenUpg = document.getElementById('btnOpenUpgrades');
        const upgBadge = document.getElementById('upgradePointsBadge');
        const upgBadgeVal = upgBadge ? upgBadge.textContent : '1';
        if (btnOpenUpg) {
            btnOpenUpg.innerHTML = `⚡ ${t.upgrades.replace('⚡ ', '')} <span class="upgrade-pts-badge" id="upgradePointsBadge">${upgBadgeVal}</span>`;
        }

        const btnSh = document.getElementById('btnOpenShop');
        if (btnSh) btnSh.textContent = t.shop;

        const btnQ = document.getElementById('btnOpenQuests');
        if (btnQ) btnQ.textContent = t.quests;

        const btnLB = document.getElementById('btnOpenLeaderboard');
        if (btnLB) btnLB.textContent = t.leaderboard;

        const minimapLabel = document.getElementById('minimapLabel');
        if (minimapLabel) minimapLabel.textContent = t.radar;

        const scoreBlueLabel = document.getElementById('scoreBlueLabel');
        if (scoreBlueLabel) scoreBlueLabel.textContent = t.scoreBlue;

        const scoreRedLabel = document.getElementById('scoreRedLabel');
        if (scoreRedLabel) scoreRedLabel.textContent = t.scoreRed;

        updateDayNightButtonUI();
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chosenLang = btn.getAttribute('data-lang');
            if (chosenLang) {
                applyLanguage(chosenLang);
                if (sound) sound.playClick();
            }
        });
    });

    // Kun / Tun rejimini almashtirish
    const btnToggleDayNight = document.getElementById('btnToggleDayNight');
    if (btnToggleDayNight) {
        btnToggleDayNight.addEventListener('click', () => {
            if (game && typeof game.toggleTimeOfDay === 'function') {
                game.toggleTimeOfDay();
            } else if (game) {
                game.timeOfDay = (game.timeOfDay === 'day' ? 'night' : 'day');
            }
            updateDayNightButtonUI();
            if (sound) sound.playClick();
        });
    }

    // -------------------------------------------------------------
    // ADMIN BOSHQARUV PANELI
    // -------------------------------------------------------------
    const adminModal = document.getElementById('adminModal');
    const btnOpenAdmin = document.getElementById('btnOpenAdmin');
    const btnAdminCoins = document.getElementById('btnAdminCoins');
    const btnAdminUnlockAll = document.getElementById('btnAdminUnlockAll');
    const btnAdminMaxLevel = document.getElementById('btnAdminMaxLevel');
    const btnAdminGodMode = document.getElementById('btnAdminGodMode');

    if (btnOpenAdmin && adminModal) {
        btnOpenAdmin.addEventListener('click', () => {
            adminModal.classList.remove('hidden');
            if (sound) sound.playClick();
        });
    }

    if (btnAdminCoins) {
        btnAdminCoins.addEventListener('click', () => {
            if (window.shopAndQuests) {
                window.shopAndQuests.adminAddCoins(50000);
            }
            if (sound) sound.playVictory();
        });
    }

    if (btnAdminUnlockAll) {
        btnAdminUnlockAll.addEventListener('click', () => {
            if (window.shopAndQuests) {
                window.shopAndQuests.adminUnlockAllSkins();
            }
            if (sound) sound.playVictory();
        });
    }

    if (btnAdminMaxLevel) {
        btnAdminMaxLevel.addEventListener('click', () => {
            if (window.shopAndQuests) {
                window.shopAndQuests.adminMaxUpgrades();
            }
            if (sound) sound.playLevelUp();
        });
    }

    if (btnAdminGodMode) {
        btnAdminGodMode.addEventListener('click', () => {
            if (window.shopAndQuests) {
                window.shopAndQuests.adminGodMode();
            }
            if (sound) sound.playClick();
        });
    }

    applyLanguage(currentLang);

    // Enter tugmasi o'yinda otish uchun ishlatiladi (game.js boshqaradi)

    document.body.addEventListener('click', () => {
        if (sound) sound.init();
    }, { once: true });
});

