// shop_quests.js - Do'kon (Shop), Vazifalar (Quests), Reyting (Leaderboard), Raqib Sozlamalari va Qahramonni Kuchaytirish (Upgrades) Tizimi

class ShopAndQuestsManager {
    constructor() {
        this.coins = parseInt(localStorage.getItem('snow_coins') || '100', 10);
        this.trophies = parseInt(localStorage.getItem('snow_trophies') || '1250', 10);
        this.level = parseInt(localStorage.getItem('snow_level') || '1', 10);
        this.xp = parseInt(localStorage.getItem('snow_xp') || '0', 10);
        this.upgradePoints = parseInt(localStorage.getItem('snow_upgrade_points') || '1', 10);
        this.botDifficulty = localStorage.getItem('snow_bot_difficulty') || 'normal';

        // Upgrades: hp, damage, speed, capacity, shield
        let defaultUpgrades = { hp: 0, damage: 0, speed: 0, capacity: 0, shield: 0 };
        try {
            this.upgrades = Object.assign(defaultUpgrades, JSON.parse(localStorage.getItem('snow_player_upgrades') || '{}'));
        } catch (e) {
            this.upgrades = defaultUpgrades;
        }

        // Sotib olingan buyumlar (Standart holda faqat Steve va Barbie bepul ochiq)
        this.ownedSkins = JSON.parse(localStorage.getItem('snow_owned_skins') || '["steve", "barbie"]');
        if (!this.ownedSkins.includes('steve')) this.ownedSkins.push('steve');
        if (!this.ownedSkins.includes('barbie')) this.ownedSkins.push('barbie');
        this.ownedBalls = JSON.parse(localStorage.getItem('snow_owned_balls') || '["classic", "pixel_ak47"]');
        if (!this.ownedBalls.includes('pixel_ak47')) this.ownedBalls.push('pixel_ak47');

        this.equippedSkin = localStorage.getItem('snow_equipped_skin') || 'steve';
        this.equippedBall = localStorage.getItem('snow_equipped_ball') || 'classic';

        // Minecraft va Qahramonlar Skinlar (Boshqa barcha qahramonlar do'kondan sotib olinadi)
        this.skinsCatalog = [
            { id: 'steve', name: '⛏️ Steve (Klassik)', price: 0, desc: 'Minecraft afsonaviy bosh qahramoni' },
            { id: 'barbie', name: '🎀 Barbie (Qizlar uchun)', price: 0, desc: 'Pushti libosli, sariq sochli go\'zal va chaqqon qahramon' },
            { id: 'soldier', name: '🎖️ Harbiy Soldat', price: 180, desc: 'Taktik kamuflaj va kaskali maxsus kuchlar jangchisi' },
            { id: 'zombie', name: '🧟 Zombie (Yashil)', price: 120, desc: 'Yashil xatarli mutant jangchi' },
            { id: 'skeleton', name: '💀 Skelet Mergan', price: 180, desc: 'Oq suyakli chaqqon nishonchi' },
            { id: 'enderman', name: '🌌 Enderman (Ender)', price: 260, desc: 'Binafsha ko\'zli sirli qora jonzot' },
            { id: 'creeper', name: '💥 Creeper Kamuflaj', price: 220, desc: 'Yashil portlovchi blokli qahramon' },
            { id: 'diamond_armor', name: '💎 Olmos Zirhli Steve', price: 340, desc: 'To\'liq olmos (Diamond) zirh bilan himoyalangan' },
            { id: 'netherite', name: '🔥 Netherite Jangchisi', price: 450, desc: 'Eng mustahkam va kuchli qora qotishma zirh' },
            { id: 'cyber_steve', name: '🤖 Kiber Voxel Steve', price: 500, desc: 'Neon nurlar bilan porlovchi kiber blok' }
        ];

        // Qurollar va Qor to'plari ro'yxati
        this.ballsCatalog = [
            { id: 'classic', name: '❄️ Klassik Qor to\'pi', price: 0, desc: 'Oq yumaloq qor to\'pi' },
            { id: 'pixel_ak47', name: '🔫 Pixel AK-47 Miltig\'i', price: 150, desc: 'Tezkor o\'q otuvchi klassik blokli miltiq' },
            { id: 'laser_blaster', name: '⚡ Redstone Lazer Blaster', price: 240, desc: 'Qizil lazerli plazma nurlari bilan otadi' },
            { id: 'diamond_sniper', name: '💎 Olmosli Snayper', price: 350, desc: 'Uzoq masofaga kritik katta zarar yetkazadi' },
            { id: 'tnt_cannon', name: '💥 TNT Granatomyot', price: 420, desc: 'Blokli portlovchi katta snaryadlar otadi' },
            { id: 'fire_magma', name: '🔥 Magma Olov To\'pi', price: 200, desc: 'Olovli iz qoldirib harakatlanadi' }
        ];

        // Kuchaytirish konfiguratsiyasi (5 ta asosiy parametr)
        this.upgradesConfig = {
            hp: {
                name: "Maksimal Jon (Max HP)",
                icon: "❤️",
                maxLevel: 5,
                base: 100,
                perLevel: 15,
                desc: "Jangda ko'proq zarbalarga bardosh berish qobiliyati",
                costCoins: [80, 140, 220, 320, 450],
                unit: "HP"
            },
            damage: {
                name: "Qor Zarari (Snow Damage)",
                icon: "💥",
                maxLevel: 5,
                base: 25,
                perLevel: 6,
                desc: "Raqibga tekkanda kuchliroq zarba yetkazadi",
                costCoins: [90, 160, 240, 340, 480],
                unit: "Zarar"
            },
            speed: {
                name: "Harakat Tezligi (Speed)",
                icon: "⚡",
                maxLevel: 5,
                base: 4.4,
                perLevel: 0.35,
                desc: "Maydonda tez yugurish va qordan oson qochish",
                costCoins: [85, 150, 230, 330, 460],
                unit: "Tezlik"
            },
            capacity: {
                name: "Qor Zaxirasi (Snow Bag)",
                icon: "🎒",
                maxLevel: 5,
                base: 5,
                perLevel: 1,
                desc: "Bir vaqtning o'zida olib yurish mumkin bo'lgan qorlar soni",
                costCoins: [70, 130, 200, 290, 400],
                unit: "ta Qor"
            },
            shield: {
                name: "Muz Qalqoni (Frost Shield)",
                icon: "🛡️",
                maxLevel: 5,
                base: 0,
                perLevel: 25,
                desc: "Joningizdan oldin zarbalarni qaytaruvchi moviy neon qalqon",
                costCoins: [100, 180, 270, 380, 520],
                unit: "Qalqon"
            }
        };

        // KUNLIK OSON VAZIFALAR (DAILY QUESTS - Har kuni avtomatik yangilanadi)
        const todayDateStr = new Date().toISOString().slice(0, 10);
        const lastSavedDate = localStorage.getItem('snow_daily_quest_date');
        const defaultDailyQuests = [
            { id: 'daily_match_1', title: '🎮 Kunlik: 1 ta jang o\'ynang', target: 1, current: 0, reward: 35, claimed: false },
            { id: 'daily_kills_2', title: '🎯 Kunlik: 2 ta raqibni yiqiting', target: 2, current: 0, reward: 50, claimed: false },
            { id: 'daily_coins_5', title: '🪙 Kunlik: 5 ta oltin tanga tering', target: 5, current: 0, reward: 40, claimed: false },
            { id: 'daily_hits_5', title: '❄️ Kunlik: Raqibga 5 marta qor/o\'q tekkizing', target: 5, current: 0, reward: 35, claimed: false },
            { id: 'daily_win_1', title: '🏆 Kunlik: 1 ta jangda g\'alaba qozoning', target: 1, current: 0, reward: 75, claimed: false }
        ];

        if (lastSavedDate !== todayDateStr) {
            this.quests = defaultDailyQuests;
            localStorage.setItem('snow_daily_quest_date', todayDateStr);
            localStorage.setItem('snow_quests_data', JSON.stringify(this.quests));
        } else {
            try {
                this.quests = JSON.parse(localStorage.getItem('snow_quests_data') || '[]');
                if (!this.quests || this.quests.length === 0) this.quests = defaultDailyQuests;
            } catch (e) {
                this.quests = defaultDailyQuests;
            }
        }

        this.toastTimeout = null;
        this.initDOM();
    }

    initDOM() {
        this.updateCoinDisplays();
        this.updateLevelDisplays();
        this.renderShop();
        this.renderQuests();
        this.renderLeaderboard();
        this.renderUpgradesModal();
        this.setupDifficultyPicker();
    }

    updateCoinDisplays() {
        const hudCoins = document.getElementById('hudCoinsText');
        const lobbyCoins = document.getElementById('lobbyCoinsText');
        const shopCoins = document.getElementById('shopCoinsDisplay');

        if (hudCoins) hudCoins.textContent = this.coins;
        if (lobbyCoins) lobbyCoins.textContent = this.coins;
        if (shopCoins) shopCoins.textContent = this.coins;
    }

    // ==============================================================
    // LEVEL, XP VA KUCHAYTIRISH (TOOL / UPGRADES) TIZIMI
    // ==============================================================
    getXpNeeded(lvl) {
        return Math.round(75 * Math.pow(lvl, 1.3));
    }

    addXP(amount) {
        this.xp += amount;
        let oldLevel = this.level;
        let gainedLevels = 0;

        while (this.xp >= this.getXpNeeded(this.level)) {
            this.xp -= this.getXpNeeded(this.level);
            this.level++;
            this.upgradePoints += 1;
            this.coins += 50;
            gainedLevels++;
        }

        this.saveData();
        this.updateCoinDisplays();
        this.updateLevelDisplays();
        this.renderUpgradesModal();

        if (gainedLevels > 0) {
            this.showLevelUpNotification(this.level, gainedLevels);
        }
    }

    showLevelUpNotification(newLevel, gainedCount) {
        if (window.soundSystem) window.soundSystem.playLevelUp();

        const toast = document.getElementById('levelUpToast');
        const title = document.getElementById('levelUpTitle');
        const desc = document.getElementById('levelUpDesc');

        if (toast && title && desc) {
            title.textContent = `⭐ ${newLevel}-DARAJA!`;
            desc.textContent = `+${gainedCount} Kuchaytirish Ochkosi va +${gainedCount * 50} 🪙 mukofot oldingiz!`;
            toast.classList.remove('hidden');

            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                toast.classList.add('hidden');
            }, 3600);
        }

        if (window.snowClashGame) {
            window.snowClashGame.showKillFeed(`🎉 LEVEL UP! Siz ${newLevel}-Darajaga ko'tarildingiz! Qudratingiz oshdi!`, true);
        }
    }

    updateLevelDisplays() {
        const xpNeeded = this.getXpNeeded(this.level);
        const pct = Math.min(100, Math.floor((this.xp / xpNeeded) * 100));

        // Lobby badge
        const lobbyLvl = document.getElementById('lobbyLevel');
        if (lobbyLvl) lobbyLvl.textContent = `${this.level}-Daraja`;

        // Mini XP bar
        const xpFill = document.getElementById('lobbyXpFill');
        if (xpFill) xpFill.style.width = `${pct}%`;

        const xpText = document.getElementById('lobbyXpText');
        if (xpText) xpText.textContent = `${this.xp} / ${xpNeeded} XP`;

        // Kuchaytirish tugmasidagi ochko indikatori
        const upgBadge = document.getElementById('upgradePointsBadge');
        if (upgBadge) upgBadge.textContent = this.upgradePoints;

        // Modal ichidagi ma'lumotlar
        const upgLevelDisp = document.getElementById('upgLevelDisplay');
        if (upgLevelDisp) upgLevelDisp.textContent = `⭐ ${this.level}-Daraja`;

        const upgPointsDisp = document.getElementById('upgPointsDisplay');
        if (upgPointsDisp) upgPointsDisp.textContent = `⚡ ${this.upgradePoints} ta`;

        const upgCoinsDisp = document.getElementById('upgCoinsDisplay');
        if (upgCoinsDisp) upgCoinsDisp.textContent = `🪙 ${this.coins}`;
    }

    getPlayerStats() {
        // Har bir daraja uchun o'z-o'zidan passiv qo'shimcha quvvat (+3 HP, +1 zarar)
        const lvlBonusHp = (this.level - 1) * 3;
        const lvlBonusDmg = (this.level - 1) * 1;

        const hpLvl = Math.min(5, this.upgrades.hp || 0);
        const dmgLvl = Math.min(5, this.upgrades.damage || 0);
        const spdLvl = Math.min(5, this.upgrades.speed || 0);
        const capLvl = Math.min(5, this.upgrades.capacity || 0);
        const shdLvl = Math.min(5, this.upgrades.shield || 0);

        return {
            maxHp: 100 + (hpLvl * 15) + lvlBonusHp,
            damage: 25 + (dmgLvl * 6) + lvlBonusDmg,
            speed: +(4.4 + (spdLvl * 0.35)).toFixed(2),
            sprintSpeed: +(5.6 + (spdLvl * 0.4)).toFixed(2),
            maxSnowballs: 5 + capLvl,
            maxShield: shdLvl * 25,
            shield: shdLvl * 25
        };
    }

    upgradeStat(statKey, usePoints = true) {
        const cfg = this.upgradesConfig[statKey];
        if (!cfg) return;
        const currentLvl = this.upgrades[statKey] || 0;
        if (currentLvl >= cfg.maxLevel) return;

        if (usePoints) {
            if (this.upgradePoints < 1) return;
            this.upgradePoints -= 1;
        } else {
            const cost = cfg.costCoins[currentLvl] || 9999;
            if (this.coins < cost) return;
            this.coins -= cost;
        }

        this.upgrades[statKey] = currentLvl + 1;
        this.saveData();

        if (window.soundSystem) window.soundSystem.playVictory();
        this.updateCoinDisplays();
        this.updateLevelDisplays();
        this.renderUpgradesModal();

        // Agar o'yin davomida bo'lsa, xususiyatlarni darhol jonlantirish
        if (window.snowClashGame && window.snowClashGame.localPlayer) {
            const s = this.getPlayerStats();
            const p = window.snowClashGame.localPlayer;
            p.maxHp = s.maxHp;
            p.hp = Math.min(p.hp + 15, s.maxHp);
            p.speed = s.speed;
            p.sprintSpeed = s.sprintSpeed;
            p.maxSnowballs = s.maxSnowballs;
            p.snowballDamage = s.damage;
            p.maxShield = s.maxShield;
            if (statKey === 'shield') p.shield = s.shield;
            window.snowClashGame.updateHpUI();
            window.snowClashGame.updateSnowballSlotsUI();
        }
    }

    renderUpgradesModal() {
        const container = document.getElementById('upgradesListContainer');
        if (!container) return;
        container.innerHTML = '';

        for (let [key, cfg] of Object.entries(this.upgradesConfig)) {
            const curLvl = this.upgrades[key] || 0;
            const isMax = curLvl >= cfg.maxLevel;
            const coinCost = isMax ? 0 : (cfg.costCoins[curLvl] || 0);

            let curVal, nextVal;
            if (key === 'hp') {
                curVal = `${100 + curLvl * cfg.perLevel + (this.level - 1) * 3} ${cfg.unit}`;
                nextVal = isMax ? 'MAX' : `${100 + (curLvl + 1) * cfg.perLevel + (this.level - 1) * 3} ${cfg.unit}`;
            } else if (key === 'damage') {
                curVal = `${25 + curLvl * cfg.perLevel + (this.level - 1) * 1} ${cfg.unit}`;
                nextVal = isMax ? 'MAX' : `${25 + (curLvl + 1) * cfg.perLevel + (this.level - 1) * 1} ${cfg.unit}`;
            } else if (key === 'speed') {
                curVal = `${(4.4 + curLvl * cfg.perLevel).toFixed(2)} ${cfg.unit}`;
                nextVal = isMax ? 'MAX' : `${(4.4 + (curLvl + 1) * cfg.perLevel).toFixed(2)} ${cfg.unit}`;
            } else if (key === 'capacity') {
                curVal = `${5 + curLvl * cfg.perLevel} ${cfg.unit}`;
                nextVal = isMax ? 'MAX' : `${5 + (curLvl + 1) * cfg.perLevel} ${cfg.unit}`;
            } else if (key === 'shield') {
                curVal = `${curLvl * cfg.perLevel} ${cfg.unit}`;
                nextVal = isMax ? 'MAX' : `${(curLvl + 1) * cfg.perLevel} ${cfg.unit}`;
            }

            let pipsHtml = '';
            for (let i = 0; i < cfg.maxLevel; i++) {
                pipsHtml += `<div class="upg-meter-pip ${i < curLvl ? 'filled' : ''}"></div>`;
            }

            const card = document.createElement('div');
            card.className = `upgrade-card ${isMax ? 'maxed' : ''}`;

            let actionsHtml = '';
            if (isMax) {
                actionsHtml = `<button class="btn-upg-action" disabled style="background: rgba(6, 214, 160, 0.2); color: #06d6a0;">MAKSIMAL ✅</button>`;
            } else {
                const canUsePoint = this.upgradePoints >= 1;
                const canUseCoins = this.coins >= coinCost;

                actionsHtml = `
                    <button class="btn-upg-action point" data-upg-key="${key}" data-upg-type="point" ${canUsePoint ? '' : 'disabled'}>
                        ⚡ 1 Ochko
                    </button>
                    <button class="btn-upg-action coins" data-upg-key="${key}" data-upg-type="coins" ${canUseCoins ? '' : 'disabled'}>
                        🪙 ${coinCost} Tanga
                    </button>
                `;
            }

            card.innerHTML = `
                <div class="upg-card-header">
                    <div class="upg-card-title">
                        <span>${cfg.icon}</span>
                        <span>${cfg.name}</span>
                    </div>
                    <span class="upg-card-level-badge">${isMax ? 'MAX DARAJA' : `${curLvl}/${cfg.maxLevel}-Daraja`}</span>
                </div>
                <div class="upg-card-desc">${cfg.desc}</div>
                <div class="upg-stats-row">
                    <span class="upg-stat-current">${curVal}</span>
                    <span class="upg-stat-arrow">${isMax ? '★' : '➜'}</span>
                    <span class="upg-stat-next">${nextVal}</span>
                </div>
                <div class="upg-card-footer">
                    <div class="upg-meter">${pipsHtml}</div>
                    <div class="upg-actions-group">${actionsHtml}</div>
                </div>
            `;

            container.appendChild(card);
        }

        container.querySelectorAll('[data-upg-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-upg-key');
                const type = btn.getAttribute('data-upg-type');
                this.upgradeStat(key, type === 'point');
            });
        });
    }

    // ==============================================================
    // DUSHMAN / BOT QIYINLIK DARAJASI (NOOB -> PRO -> HACKER)
    // ==============================================================
    getBotConfig(difficulty = this.botDifficulty) {
        switch (difficulty) {
            case 'noob':
                return {
                    difficulty: 'noob',
                    label: "🟢 Noob (Oson)",
                    speed: 2.5,
                    hp: 75,
                    maxHp: 75,
                    damage: 15,
                    throwCooldownMin: 50,
                    throwCooldownMax: 75,
                    spread: 0.38,
                    canDodge: false,
                    dodgeChance: 0,
                    predictLead: 0,
                    shield: 0,
                    ballType: 'classic',
                    color: '#48cae4'
                };
            case 'pro':
                return {
                    difficulty: 'pro',
                    label: "🔴 Pro (Usta)",
                    speed: 4.5,
                    hp: 130,
                    maxHp: 130,
                    damage: 30,
                    throwCooldownMin: 18,
                    throwCooldownMax: 28,
                    spread: 0.04,
                    canDodge: true,
                    dodgeChance: 0.75,
                    predictLead: 0.85,
                    shield: 0,
                    ballType: 'classic',
                    color: '#ff0054'
                };
            case 'hacker':
                return {
                    difficulty: 'hacker',
                    label: "💀 Hacker (Boss)",
                    speed: 5.3,
                    hp: 160,
                    maxHp: 160,
                    damage: 36,
                    throwCooldownMin: 12,
                    throwCooldownMax: 20,
                    spread: 0.01,
                    canDodge: true,
                    dodgeChance: 0.92,
                    predictLead: 1.0,
                    shield: 50,
                    ballType: 'plasma',
                    color: '#9d4edd'
                };
            case 'normal':
            default:
                return {
                    difficulty: 'normal',
                    label: "🟡 Normal (O'rtacha)",
                    speed: 3.5,
                    hp: 100,
                    maxHp: 100,
                    damage: 24,
                    throwCooldownMin: 30,
                    throwCooldownMax: 45,
                    spread: 0.14,
                    canDodge: false,
                    dodgeChance: 0,
                    predictLead: 0,
                    shield: 0,
                    ballType: 'classic',
                    color: '#ffd166'
                };
        }
    }

    setBotDifficulty(diff) {
        this.botDifficulty = diff;
        localStorage.setItem('snow_bot_difficulty', diff);

        const buttons = document.querySelectorAll('#difficultyPicker .diff-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-diff') === diff) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (window.soundSystem) window.soundSystem.playSnowCraft();
    }

    setupDifficultyPicker() {
        const picker = document.getElementById('difficultyPicker');
        if (!picker) return;

        const btns = picker.querySelectorAll('.diff-btn');
        btns.forEach(btn => {
            const diff = btn.getAttribute('data-diff');
            if (diff === this.botDifficulty) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            btn.addEventListener('click', () => {
                this.setBotDifficulty(diff);
            });
        });
    }

    // ==============================================================
    // DO'KON (SHOP) TIZIMI
    // ==============================================================
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
            if (window.snowClashGame && window.snowClashGame.localPlayer) {
                window.snowClashGame.localPlayer.skin = skinId;
            }
            if (typeof window.renderLobbyCharacterCards === 'function') {
                window.renderLobbyCharacterCards();
            }
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
        localStorage.setItem('snow_trophies', this.trophies);
        localStorage.setItem('snow_level', this.level);
        localStorage.setItem('snow_xp', this.xp);
        localStorage.setItem('snow_upgrade_points', this.upgradePoints);
        localStorage.setItem('snow_bot_difficulty', this.botDifficulty);
        localStorage.setItem('snow_player_upgrades', JSON.stringify(this.upgrades));
        localStorage.setItem('snow_owned_skins', JSON.stringify(this.ownedSkins));
        localStorage.setItem('snow_owned_balls', JSON.stringify(this.ownedBalls));
        localStorage.setItem('snow_equipped_skin', this.equippedSkin);
        localStorage.setItem('snow_equipped_ball', this.equippedBall);
        localStorage.setItem('snow_quests_data', JSON.stringify(this.quests));
    }

    // ==============================================================
    // VAZIFALAR (QUESTS) TIZIMI
    // ==============================================================
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

    onEnemyEliminated() {
        this.quests.forEach(q => {
            if ((q.id === 'kills_5' || q.id === 'daily_kills_2') && q.current < q.target) {
                q.current++;
            }
        });
        this.saveData();
        this.renderQuests();
        this.addTrophies(25);
        this.addXP(60); // Raqib yiqitilganda +60 XP!
    }

    onMatchWon() {
        this.quests.forEach(q => {
            if ((q.id === 'wins_2' || q.id === 'daily_win_1') && q.current < q.target) {
                q.current++;
            }
        });
        this.saveData();
        this.renderQuests();
        this.addTrophies(40);
        this.addXP(150); // Jangda g'alaba qozonilganda +150 XP!
    }

    onCoinsCollected(amount = 1) {
        this.quests.forEach(q => {
            if ((q.id === 'coins_10' || q.id === 'daily_coins_5') && q.current < q.target) {
                q.current = Math.min(q.target, q.current + amount);
            }
        });
        this.saveData();
        this.renderQuests();
        this.addXP(5 * amount); // Har bir tanga uchun +5 XP!
    }

    onSnowballHit() {
        this.quests.forEach(q => {
            if ((q.id === 'hits_20' || q.id === 'daily_hits_5') && q.current < q.target) {
                q.current++;
            }
        });
        this.saveData();
        this.renderQuests();
        this.addXP(15); // Har bir tekkizilgan qor uchun +15 XP!
    }

    onMatchPlayed() {
        this.quests.forEach(q => {
            if (q.id === 'daily_match_1' && q.current < q.target) {
                q.current++;
            }
        });
        this.saveData();
        this.renderQuests();
    }

    // ==============================================================
    // ADMIN BOSHQARUV USULLARI (ADMIN HUQUQLARI VA TANGA QO'SHISH)
    // ==============================================================
    adminAddCoins(amount = 50000) {
        this.coins += amount;
        this.saveData();
        this.updateCoinDisplays();
        if (window.snowClashGame) {
            window.snowClashGame.coins = this.coins;
            window.snowClashGame.updateHUDCoins();
            window.snowClashGame.showKillFeed(`👑 ADMIN: +${amount.toLocaleString()} 🪙 muvaffaqiyatli qo'shildi!`, true);
        }
        this.renderShop();
        this.renderUpgradesModal();
        return this.coins;
    }

    adminUnlockAllSkins() {
        this.skinsCatalog.forEach(s => {
            if (!this.ownedSkins.includes(s.id)) {
                this.ownedSkins.push(s.id);
            }
        });
        this.ballsCatalog.forEach(b => {
            if (!this.ownedBalls.includes(b.id)) {
                this.ownedBalls.push(b.id);
            }
        });
        this.saveData();
        this.renderShop();
        if (typeof window.renderLobbyCharacterCards === 'function') {
            window.renderLobbyCharacterCards();
        }
        if (window.snowClashGame) {
            window.snowClashGame.showKillFeed(`👑 ADMIN: Barcha personaj va qurollar to'liq ochildi!`, true);
        }
    }

    adminMaxUpgrades() {
        Object.keys(this.upgradesConfig).forEach(k => {
            this.upgrades[k] = this.upgradesConfig[k].maxLevel;
        });
        this.level = 50;
        this.upgradePoints = 99;
        this.saveData();
        this.updateLevelDisplays();
        this.renderUpgradesModal();
        if (window.snowClashGame) {
            window.snowClashGame.initStatsFromUpgrades();
            window.snowClashGame.showKillFeed(`👑 ADMIN: Qahramon 50-Darajaga va maksimal quvvatga yetkazildi!`, true);
        }
    }

    adminGodMode() {
        if (window.snowClashGame && window.snowClashGame.localPlayer) {
            const lp = window.snowClashGame.localPlayer;
            lp.isGodMode = !lp.isGodMode;
            if (lp.isGodMode) {
                lp.hp = 999999;
                lp.maxHp = 999999;
                lp.shield = 999999;
                lp.maxShield = 999999;
            } else {
                lp.hp = 100;
                lp.maxHp = 100;
                lp.shield = 0;
            }
            window.snowClashGame.updateHUD();
            window.snowClashGame.showKillFeed(`👑 ADMIN: O'lmaslik (God Mode): ${lp.isGodMode ? 'YOQILDI' : 'O\'CHIRILDI'}!`, true);
        }
    }

    addTrophies(amount) {
        this.trophies += amount;
        localStorage.setItem('snow_trophies', this.trophies);
        const trDisplay = document.getElementById('lobbyTrophies');
        if (trDisplay) trDisplay.textContent = this.trophies.toLocaleString();
        this.renderLeaderboard();
    }

    // ==============================================================
    // REYTING (LEADERBOARD) TIZIMI (TOP 1, 2, 3, 100, 500)
    // ==============================================================
    renderLeaderboard() {
        const container = document.getElementById('leaderboardList');
        if (!container) return;
        container.innerHTML = '';

        const playerName = localStorage.getItem('snow_player_name') || 'QorJangchisi';

        const topPlayers = [
            { rank: 1, name: 'Muzlatuvchi_X', trophies: 5420, kills: 480, badge: '🥇 OLTIN' },
            { rank: 2, name: 'SnowSniper_UZ', trophies: 4890, kills: 412, badge: '🥈 KUMUSH' },
            { rank: 3, name: 'Artur_Santa', trophies: 4310, kills: 350, badge: '🥉 BRONZA' },
            { rank: 4, name: 'Qor_Malikasi', trophies: 3820, kills: 295, badge: '👑 AFSONA' },
            { rank: 5, name: 'FrostBite_99', trophies: 3410, kills: 260, badge: '💎 MASTER' },
            { rank: 6, name: 'QishkiBo\'ri', trophies: 2980, kills: 210, badge: '💎 MASTER' },
            { rank: 7, name: 'Bobur_Ice', trophies: 2450, kills: 180, badge: '⭐ PLATINA' }
        ];

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
window.adminAddCoins = (amt = 50000) => window.shopAndQuests.adminAddCoins(amt);
window.adminUnlockAll = () => window.shopAndQuests.adminUnlockAllSkins();
window.adminMaxUpgrades = () => window.shopAndQuests.adminMaxUpgrades();
window.adminGodMode = () => window.shopAndQuests.adminGodMode();
