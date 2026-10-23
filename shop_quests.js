// shop_quests.js - Do'kon (Shop), Vazifalar (Quests) va Reyting (Leaderboard) Tizimi

class ShopAndQuestsManager {
    constructor() {
        this.coins = parseInt(localStorage.getItem('snow_coins') || '100', 10);
        this.trophies = parseInt(localStorage.getItem('snow_trophies') || '1250', 10);

        // Sotib olingan buyumlar
        this.ownedSkins = JSON.parse(localStorage.getItem('snow_owned_skins') || '["santa"]');
        this.ownedBalls = JSON.parse(localStorage.getItem('snow_owned_balls') || '["classic"]');

        this.equippedSkin = localStorage.getItem('snow_equipped_skin') || 'santa';
        this.equippedBall = localStorage.getItem('snow_equipped_ball') || 'classic';

        // Do'kondagi skinlar ro'yxati
        this.skinsCatalog = [
            { id: 'santa', name: '🎅 Santa Qizil', price: 0, desc: 'Klassik bayramona qishki libos' },
            { id: 'ninja', name: '🥷 Muzli Ninja', price: 150, desc: 'Qora niqob va chaqqon harakat' },
            { id: 'king', name: '👑 Qor Qiroli', price: 250, desc: 'Oltin toj va shohona plash' },
            { id: 'bear', name: '🐻 Qutb Ayig\'i', price: 200, desc: 'Qalin oq mo\'yna va issiq quloqlar' },
            { id: 'cyber', name: '🤖 Kiber Qorbo\'ron', price: 350, desc: 'Yaltiroq neon kiberzirh' }
        ];

        // Do'kondagi qurollar ro'yxati
        this.ballsCatalog = [
            { id: 'classic', name: '❄️ Klassik Qor to\'pi', price: 0, desc: 'Oq yumaloq qor to\'pi' },
            { id: 'fire', name: '🔥 Olovli Qor to\'pi', price: 180, desc: 'Qizil-olovli iz qoldirib uchadi' },
            { id: 'plasma', name: '⚡ Yashinli Plazma Qor', price: 220, desc: 'Moviy chaqmoq nuri bilan porlaydi' },
            { id: 'rainbow', name: '🌈 Kamalak Qor to\'pi', price: 300, desc: 'Rang-barang sehrli kamalak effekti' }
        ];

        // Vazifalar (Quests)
        this.quests = JSON.parse(localStorage.getItem('snow_quests_data') || JSON.stringify([
            { id: 'kills_5', title: '🎯 5 ta raqibni qor bilan yiqiting', target: 5, current: 0, reward: 60, claimed: false },
            { id: 'wins_2', title: '🏆 2 ta jangda g\'alaba qozoning', target: 2, current: 0, reward: 100, claimed: false },
            { id: 'coins_10', title: '🪙 Xaritadan 10 ta oltin tanga tering', target: 10, current: 0, reward: 50, claimed: false },
            { id: 'hits_20', title: '❄️ Raqiblarga 20 marta qor tekkizing', target: 20, current: 0, reward: 80, claimed: false }
        ]));

        this.initDOM();
    }

    initDOM() {
        this.updateCoinDisplays();
        this.renderShop();
        this.renderQuests();
        this.renderLeaderboard();
    }

    updateCoinDisplays() {
        const hudCoins = document.getElementById('hudCoinsText');
        const lobbyCoins = document.getElementById('lobbyCoinsText');
        const shopCoins = document.getElementById('shopCoinsDisplay');

        if (hudCoins) hudCoins.textContent = this.coins;
        if (lobbyCoins) lobbyCoins.textContent = this.coins;
        if (shopCoins) shopCoins.textContent = this.coins;
    }

    // DO'KONNI RENDERLASH
    renderShop() {
        const skinsContainer = document.getElementById('shopSkinsList');
        const ballsContainer = document.getElementById('shopBallsList');
        if (!skinsContainer || !ballsContainer) return;

        skinsContainer.innerHTML = '';
        ballsContainer.innerHTML = '';

        // 1. Kiyimlar
        this.skinsCatalog.forEach(skin => {
            const isOwned = this.ownedSkins.includes(skin.id);
            const isEquipped = (this.equippedSkin === skin.id);

            const card = document.createElement('div');
            card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;

            let actionBtn = '';
            if (isEquipped) {
                actionBtn = `<button class="btn-shop-action equipped" disabled>KIYILGAN ✅</button>`;
            } else if (isOwned) {
                actionBtn = `<button class="btn-shop-action equip" data-equip-skin="${skin.id}">KIYISH 👕</button>`;
            } else {
                const canAfford = this.coins >= skin.price;
                actionBtn = `<button class="btn-shop-action buy" data-buy-skin="${skin.id}" ${canAfford ? '' : 'disabled'}>
                    ${skin.price} 🪙 SOTIB OLISH
                </button>`;
            }

            card.innerHTML = `
                <div class="shop-item-title">${skin.name}</div>
                <div class="shop-item-desc">${skin.desc}</div>
                <div class="shop-item-footer">${actionBtn}</div>
            `;
            skinsContainer.appendChild(card);
        });

        // 2. Qor To'plari Quroli
        this.ballsCatalog.forEach(ball => {
            const isOwned = this.ownedBalls.includes(ball.id);
            const isEquipped = (this.equippedBall === ball.id);

            const card = document.createElement('div');
            card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;

            let actionBtn = '';
            if (isEquipped) {
                actionBtn = `<button class="btn-shop-action equipped" disabled>TANLANGAN ✅</button>`;
            } else if (isOwned) {
                actionBtn = `<button class="btn-shop-action equip" data-equip-ball="${ball.id}">TANLASH 🎯</button>`;
            } else {
                const canAfford = this.coins >= ball.price;
                actionBtn = `<button class="btn-shop-action buy" data-buy-ball="${ball.id}" ${canAfford ? '' : 'disabled'}>
                    ${ball.price} 🪙 SOTIB OLISH
                </button>`;
            }

            card.innerHTML = `
                <div class="shop-item-title">${ball.name}</div>
                <div class="shop-item-desc">${ball.desc}</div>
                <div class="shop-item-footer">${actionBtn}</div>
            `;
            ballsContainer.appendChild(card);
        });

        // Tugmalar hodisalari
        skinsContainer.querySelectorAll('[data-buy-skin]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.buySkin(btn.getAttribute('data-buy-skin'));
            });
        });

        skinsContainer.querySelectorAll('[data-equip-skin]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.equipSkin(btn.getAttribute('data-equip-skin'));
            });
        });

        ballsContainer.querySelectorAll('[data-buy-ball]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.buyBall(btn.getAttribute('data-buy-ball'));
            });
        });

        ballsContainer.querySelectorAll('[data-equip-ball]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.equipBall(btn.getAttribute('data-equip-ball'));
            });
        });
    }

    buySkin(skinId) {
        const skin = this.skinsCatalog.find(s => s.id === skinId);
        if (skin && this.coins >= skin.price && !this.ownedSkins.includes(skinId)) {
            this.coins -= skin.price;
            this.ownedSkins.push(skinId);
            this.equippedSkin = skinId;
            this.saveData();
            if (window.soundSystem) window.soundSystem.playVictory();
            this.renderShop();
            this.updateCoinDisplays();
            if (window.snowClashGame) window.snowClashGame.localPlayer.skin = skinId;
        }
    }

    equipSkin(skinId) {
        if (this.ownedSkins.includes(skinId)) {
            this.equippedSkin = skinId;
            localStorage.setItem('snow_equipped_skin', skinId);
            if (window.snowClashGame) window.snowClashGame.localPlayer.skin = skinId;
            this.renderShop();
        }
    }

    buyBall(ballId) {
        const ball = this.ballsCatalog.find(b => b.id === ballId);
        if (ball && this.coins >= ball.price && !this.ownedBalls.includes(ballId)) {
            this.coins -= ball.price;
            this.ownedBalls.push(ballId);
            this.equippedBall = ballId;
            this.saveData();
            if (window.soundSystem) window.soundSystem.playVictory();
            this.renderShop();
            this.updateCoinDisplays();
            if (window.snowClashGame) window.snowClashGame.localPlayer.snowballType = ballId;
        }
    }

    equipBall(ballId) {
        if (this.ownedBalls.includes(ballId)) {
            this.equippedBall = ballId;
            localStorage.setItem('snow_equipped_ball', ballId);
            if (window.snowClashGame) window.snowClashGame.localPlayer.snowballType = ballId;
            this.renderShop();
        }
    }

    saveData() {
        localStorage.setItem('snow_coins', this.coins);
        localStorage.setItem('snow_owned_skins', JSON.stringify(this.ownedSkins));
        localStorage.setItem('snow_owned_balls', JSON.stringify(this.ownedBalls));
        localStorage.setItem('snow_equipped_skin', this.equippedSkin);
        localStorage.setItem('snow_equipped_ball', this.equippedBall);
        localStorage.setItem('snow_quests_data', JSON.stringify(this.quests));
    }

    // VAZIFALARNI (QUESTS) RENDERLASH
    renderQuests() {
        const container = document.getElementById('questsListContainer');
        if (!container) return;
        container.innerHTML = '';

        this.quests.forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = 'quest-item-row';

            const pct = Math.min(100, Math.floor((q.current / q.target) * 100));
            const isCompleted = q.current >= q.target;

            let actionBtn = '';
            if (q.claimed) {
                actionBtn = `<button class="btn-quest-claim claimed" disabled>OLINDI ✅</button>`;
            } else if (isCompleted) {
                actionBtn = `<button class="btn-quest-claim ready" data-claim-quest="${idx}">OLISH (+${q.reward} 🪙)</button>`;
            } else {
                actionBtn = `<span style="font-size:0.85rem; font-weight:800; color:#a8dadc;">${q.current}/${q.target}</span>`;
            }

            card.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">${q.title}</div>
                    <div class="quest-progress-bar">
                        <div class="quest-progress-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>
                <div style="margin-left: 14px;">${actionBtn}</div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll('[data-claim-quest]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-claim-quest'), 10);
                this.claimQuestReward(idx);
            });
        });
    }

    claimQuestReward(idx) {
        const q = this.quests[idx];
        if (q && !q.claimed && q.current >= q.target) {
            q.claimed = true;
            this.coins += q.reward;
            this.saveData();
            if (window.soundSystem) window.soundSystem.playVictory();
            this.updateCoinDisplays();
            this.renderQuests();
        }
    }

    // O'yin hodisalari bo'yicha vazifalarni bajarish
    onEnemyEliminated() {
        const q = this.quests.find(item => item.id === 'kills_5');
        if (q && q.current < q.target) {
            q.current++;
            this.saveData();
            this.renderQuests();
        }
        // Kuboklar sonini oshirish
        this.addTrophies(25);
    }

    onMatchWon() {
        const q = this.quests.find(item => item.id === 'wins_2');
        if (q && q.current < q.target) {
            q.current++;
            this.saveData();
            this.renderQuests();
        }
        this.addTrophies(40);
    }

    onCoinsCollected(amount) {
        const q = this.quests.find(item => item.id === 'coins_10');
        if (q && q.current < q.target) {
            q.current++;
            this.saveData();
            this.renderQuests();
        }
    }

    onSnowballHit() {
        const q = this.quests.find(item => item.id === 'hits_20');
        if (q && q.current < q.target) {
            q.current++;
            this.saveData();
            this.renderQuests();
        }
    }

    addTrophies(amount) {
        this.trophies += amount;
        localStorage.setItem('snow_trophies', this.trophies);
        const trDisplay = document.getElementById('lobbyTrophies');
        if (trDisplay) trDisplay.textContent = this.trophies.toLocaleString();
        this.renderLeaderboard();
    }

    // REYTING (LEADERBOARD) TIZIMI (TOP 1, 2, 3, 100, 500)
    renderLeaderboard() {
        const container = document.getElementById('leaderboardList');
        if (!container) return;
        container.innerHTML = '';

        const playerName = localStorage.getItem('snow_player_name') || 'QorJangchisi';

        // Reytingdagi Top 8 nafar afsonaviy o'yinchi
        const topPlayers = [
            { rank: 1, name: 'Muzlatuvchi_X', trophies: 5420, kills: 480, badge: '🥇 OLTIN' },
            { rank: 2, name: 'SnowSniper_UZ', trophies: 4890, kills: 412, badge: '🥈 KUMUSH' },
            { rank: 3, name: 'Artur_Santa', trophies: 4310, kills: 350, badge: '🥉 BRONZA' },
            { rank: 4, name: 'Qor_Malikasi', trophies: 3820, kills: 295, badge: '👑 AFSONA' },
            { rank: 5, name: 'FrostBite_99', trophies: 3410, kills: 260, badge: '💎 MASTER' },
            { rank: 6, name: 'QishkiBo\'ri', trophies: 2980, kills: 210, badge: '💎 MASTER' },
            { rank: 7, name: 'Bobur_Ice', trophies: 2450, kills: 180, badge: '⭐ PLATINA' }
        ];

        // O'yinchining reytingdagi taxminiy o'rni
        let myRank = 42;
        if (this.trophies >= 5000) myRank = 2;
        else if (this.trophies >= 4000) myRank = 4;
        else if (this.trophies >= 3000) myRank = 6;
        else if (this.trophies >= 2000) myRank = 12;
        else if (this.trophies >= 1500) myRank = 24;

        topPlayers.forEach(p => {
            const row = document.createElement('div');
            row.className = `leaderboard-row ${p.rank <= 3 ? 'top' + p.rank : ''}`;
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="leaderboard-rank">#${p.rank}</span>
                    <span style="font-weight: 800;">${p.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span style="font-size: 0.78rem; font-weight: 800; color: #ffd166;">${p.badge}</span>
                    <span style="font-weight: 800; color: #70d6ff;">🏆 ${p.trophies}</span>
                </div>
            `;
            container.appendChild(row);
        });

        // O'yinchining o'z o'rni
        const myRow = document.createElement('div');
        myRow.className = 'leaderboard-row my-rank';
        myRow.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="leaderboard-rank my">#${myRank}</span>
                <span style="font-weight: 800; color: #06d6a0;">${playerName} (SIZ) ⭐</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 0.78rem; font-weight: 800; color: #06d6a0;">LIGA: TOP ${myRank <= 10 ? '10' : (myRank <= 100 ? '100' : '500')}</span>
                <span style="font-weight: 800; color: #ffd166;">🏆 ${this.trophies}</span>
            </div>
        `;
        container.appendChild(myRow);
    }
}

window.shopAndQuests = new ShopAndQuestsManager();
