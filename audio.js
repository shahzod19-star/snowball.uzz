// audio.js - Web Audio API orqali 3 xil Vibe (Jingle Bells, Cyber Neon Battle, Chill Lo-Fi) va Ovozlar

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.musicPlaying = false;
        this.musicMuted = false; // Faqat musiqa
        this.sfxMuted = false;   // Faqat o'yin tovushlari
        this.melodyTimeout = null;
        this.currentOscillators = [];
        this.initialized = false;
        this.currentTrackIndex = 0;
        this.masterVolume = 0.15;

        // 3 xil butunlay boshqacha vibe:
        this.tracks = [
            { id: 0, title: "🔔 Jingle Bells (Bayramona)", genre: "classic" },
            { id: 1, title: "⚡ Neon Battle (Jangovar Vibe)", genre: "battle" },
            { id: 2, title: "☕ Chill Winter (Sokin Lo-Fi)", genre: "chill" }
        ];
    }

    init() {
        if (this.initialized && this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.ctx = new AudioContext();
            this.initialized = true;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    stopAllCurrentNotes() {
        if (this.melodyTimeout) {
            clearTimeout(this.melodyTimeout);
            this.melodyTimeout = null;
        }
        for (let osc of this.currentOscillators) {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {}
        }
        this.currentOscillators = [];
    }

    playNote(freq, duration = 0.35, timeOffset = 0, type = 'sine', gainLevel = 0.12) {
        if (!this.ctx || this.musicMuted) return;
        const now = this.ctx.currentTime + timeOffset;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        const vol = gainLevel * (this.masterVolume / 0.15);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);

        this.currentOscillators.push(osc);
    }

    startMusic() {
        this.init();
        this.resume();
        if (this.musicMuted) return;
        this.stopAllCurrentNotes();
        this.musicPlaying = true;
        this.playCurrentTrack();
    }

    stopMusic() {
        this.musicPlaying = false;
        this.stopAllCurrentNotes();
    }

    toggleMusic() {
        this.init();
        this.resume();
        this.musicMuted = !this.musicMuted;
        if (this.musicMuted) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        return !this.musicMuted; // true = yoqiq, false = o'chiq
    }

    toggleSfx() {
        this.init();
        this.resume();
        this.sfxMuted = !this.sfxMuted;
        return !this.sfxMuted;
    }

    setTrack(index) {
        this.init();
        this.resume();
        if (index >= 0 && index < this.tracks.length) {
            this.currentTrackIndex = index;
            if (!this.musicMuted) {
                this.stopAllCurrentNotes();
                this.startMusic();
            }
        }
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        if (!this.musicMuted) {
            this.stopAllCurrentNotes();
            this.startMusic();
        }
        return this.tracks[this.currentTrackIndex];
    }

    getCurrentTrack() {
        return this.tracks[this.currentTrackIndex];
    }

    playCurrentTrack() {
        if (!this.musicPlaying || this.musicMuted) return;

        if (this.currentTrackIndex === 0) {
            this.playJingleBells();
        } else if (this.currentTrackIndex === 1) {
            this.playNeonBattle();
        } else {
            this.playChillWinter();
        }
    }

    // 1-TREK: Bayramona Jingle Bells
    playJingleBells() {
        const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, C5 = 523.25;
        const melody = [
            [E4, 250], [E4, 250], [E4, 500],
            [E4, 250], [E4, 250], [E4, 500],
            [E4, 250], [G4, 250], [C4, 350], [D4, 150], [E4, 700],

            [F4, 250], [F4, 250], [F4, 350], [F4, 150],
            [F4, 250], [E4, 250], [E4, 250], [E4, 150], [E4, 150],
            [E4, 250], [D4, 250], [D4, 250], [E4, 250], [D4, 500], [G4, 500]
        ];

        let timeCursor = 0;
        for (let i = 0; i < melody.length; i++) {
            const [freq, duration] = melody[i];
            const secDuration = duration / 1000;
            this.playNote(freq, secDuration * 1.2, timeCursor, 'sine', 0.12);
            this.playNote(freq * 2.01, secDuration * 0.9, timeCursor, 'triangle', 0.06); // Bell ringing
            if (i % 3 === 0) {
                this.playNote(freq / 2, 0.45, timeCursor, 'triangle', 0.08); // Bas
            }
            timeCursor += secDuration;
        }

        this.melodyTimeout = setTimeout(() => {
            if (this.musicPlaying && !this.musicMuted) this.playCurrentTrack();
        }, (timeCursor + 0.8) * 1000);
    }

    // 2-TREK: Neon Battle Vibe (Tezkor, jangovar arcade/synthwave ritmi)
    playNeonBattle() {
        // Energetik elektron motiv (A minor / D minor drive)
        const A2 = 110.00, C3 = 130.81, D3 = 146.83, E3 = 164.81, G3 = 196.00, A3 = 220.00, C4 = 261.63, E4 = 329.63, G4 = 392.00;
        
        // Ritmik bassline va lead arpedjio
        const pattern = [
            // [bassFreq, leadFreq, duration_ms]
            [A2, A3, 160], [A2, C4, 160], [A2, E4, 160], [A2, G4, 160],
            [D3, F4 = 349.23, 160], [D3, D4 = 293.66, 160], [D3, A3, 160], [D3, F4, 160],
            [G3, G4, 160], [G3, D4, 160], [G3, B3 = 246.94, 160], [G3, D4, 160],
            [E3, E4, 160], [E3, B3, 160], [E3, G3, 160], [E3, E3, 160],

            [A2, C4, 160], [A2, E4, 160], [A2, A4 = 440.00, 160], [A2, E4, 160],
            [F3 = 174.61, A3, 160], [F3, C4, 160], [F3, F4, 160], [F3, C4, 160],
            [G3, B3, 160], [G3, D4, 160], [G3, G4, 160], [G3, D4, 160],
            [E3, G3, 160], [E3, B3, 160], [E3, E4, 160], [E3, B3, 160]
        ];

        let timeCursor = 0;
        for (let i = 0; i < pattern.length; i++) {
            const [bass, lead, duration] = pattern[i];
            const sec = duration / 1000;
            // Synth Bass (sawtooth)
            this.playNote(bass, sec * 0.9, timeCursor, 'sawtooth', 0.1);
            // Synth Lead (square / triangle)
            this.playNote(lead, sec * 0.7, timeCursor, 'square', 0.07);
            timeCursor += sec;
        }

        this.melodyTimeout = setTimeout(() => {
            if (this.musicPlaying && !this.musicMuted) this.playCurrentTrack();
        }, (timeCursor + 0.3) * 1000);
    }

    // 3-TREK: Chill Winter Lo-Fi (Sokin, yoqimli va zamonaviy vibe)
    playChillWinter() {
        // Yumshoq jaz/lo-fi akkordlar (Major 7th & Minor 7th)
        const C3 = 130.81, E3 = 164.81, G3 = 196.00, B3 = 246.94;
        const A2 = 110.00, C4 = 261.63, E4 = 329.63, G4 = 392.00;
        const F2 = 87.31, A3 = 220.00;
        const G2 = 98.00, D4 = 293.66;

        const chords = [
            // Akkord 1: Cmaj7
            { bass: C3, notes: [G3, B3, E4], dur: 1200 },
            // Akkord 2: Am7
            { bass: A2, notes: [E3, A3, C4], dur: 1200 },
            // Akkord 3: Fmaj7
            { bass: F2, notes: [C3, A3, E4], dur: 1200 },
            // Akkord 4: G7sus
            { bass: G2, notes: [D3 = 146.83, G3, D4], dur: 1200 }
        ];

        let timeCursor = 0;
        for (let c of chords) {
            const secDur = c.dur / 1000;
            // Yumshoq bas
            this.playNote(c.bass, secDur * 0.95, timeCursor, 'sine', 0.14);
            // Akkord notalari (Rhodes/E-piano uslubi)
            c.notes.forEach((freq, idx) => {
                this.playNote(freq, secDur * 0.9, timeCursor + idx * 0.04, 'sine', 0.08);
                this.playNote(freq * 1.5, secDur * 0.5, timeCursor + idx * 0.04, 'triangle', 0.04);
            });
            timeCursor += secDur;
        }

        this.melodyTimeout = setTimeout(() => {
            if (this.musicPlaying && !this.musicMuted) this.playCurrentTrack();
        }, (timeCursor + 0.5) * 1000);
    }

    // Ovoz effektlari (SFX)
    playSnowCraft() {
        if (!this.ctx || this.sfxMuted) return;
        this.resume();
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
        filter.Q.value = 2.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }

    playThrow() {
        if (!this.ctx || this.sfxMuted) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.exponentialRampToValueAtTime(130, now + 0.16);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
    }

    playHit() {
        if (!this.ctx || this.sfxMuted) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainOsc = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
        gainOsc.gain.setValueAtTime(0.25, now);
        gainOsc.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.connect(gainOsc);
        gainOsc.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);

        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, now);
        const gainNoise = this.ctx.createGain();
        gainNoise.gain.setValueAtTime(0.2, now);
        gainNoise.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        noise.connect(filter);
        filter.connect(gainNoise);
        gainNoise.connect(this.ctx.destination);
        noise.start(now);
    }

    playVictory() {
        if (!this.ctx || this.sfxMuted) return;
        this.resume();
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
        notes.forEach((freq, idx) => {
            this.playNote(freq, 0.45, idx * 0.1, 'sine', 0.25);
        });
    }

    playDefeat() {
        if (!this.ctx || this.sfxMuted) return;
        this.resume();
        const notes = [392.00, 349.23, 329.63, 261.63];
        notes.forEach((freq, idx) => {
            this.playNote(freq, 0.5, idx * 0.15, 'triangle', 0.2);
        });
    }
}

window.soundSystem = new SoundSystem();
