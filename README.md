# ❄️ Qor Jangi (Snow Clash Online) — Yangi Yil Shukuhi 🎄

Real-time multiplayer qor jangi brauzer o'yini (HTML5 Canvas + Python aiohttp WebSockets).

## 🎮 O'yin xususiyatlari
- **Multiplayer Rejimlar**: 1 vs 1 Duel, 2 vs 2 Jamoa, 4 vs 4 Squad (PUBG uslubi), Battle Royale (FFA).
- **Xonalar tizimi**: Xona yaratish (unikal kod bilan), do'stlarni chaqirish, jamoa tanlash, kutish lobbisi.
- **Do'kon (Shop)**: Tangalar yig'ib 5 xil libos (Santa, Ninja, Qirol, Ayiq, Kiber) va 4 xil qor to'pi effektlari (Olovli, Plazma, Kamalak).
- **Zadachalar (Quests)**: Raundlarda g'alaba qozonish, dushmanlarni yiqitish va tanga yig'ish orqali mukofotlar.
- **3 ta Katta Dunyo**: Bayram Shaharchasi, Muz Qal'asi, Sehrli Qor O'rmoni.
- **Reyting (Leaderboard)**: Top 1, Top 2, Top 3 va Top 100 ligalari.
- **Audio tizim**: 3 xil vibe (Jingle Bells, Cyber Neon Battle, Chill Lo-Fi) va mustaqil musiqa/ovoz boshqaruvi.

## 🚀 Ishga tushirish (Local)

1. Python 3.9+ o'rnatilgan bo'lishi kerak.
2. Kerakli kutubxonalarni o'rnatish:
```bash
pip install -r requirements.txt
```
3. Serverni ishga tushirish:
```bash
python server.py
```
Windows foydalanuvchilari shunchaki `start_game.bat` faylini 2 marta bosishlari mumkin.

4. Brauzerda ochish:
```
http://localhost:8000
```

## 📁 Fayllar tuzilishi
```
snowball_clash/
├── server.py              # WebSocket & HTTP server
├── requirements.txt       # Python bog'liqliklari
├── start_game.bat         # 1-klikda ishga tushirish skripti
├── README.md              # Qo'llanma
├── .gitignore             # Git istisnolar
└── static/                # Front-end fayllar
    ├── index.html         # Asosiy HTML interfeys
    ├── css/
    │   └── style.css      # Zamonaviy frosted-glass dizayn
    └── js/
        ├── audio.js       # 3 xil trekli Web Audio tizimi
        ├── game.js        # Canvas dvigateli va fizika
        ├── lobby.js       # Bosh menyu va xonalar boshqaruvi
        └── shop_quests.js # Do'kon, vazifalar va reyting
```
