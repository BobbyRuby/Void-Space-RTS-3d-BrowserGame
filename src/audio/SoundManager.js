// ============================================================
// VOID SUPREMACY 3D - Sound Manager
// Handles all game audio: music, SFX, spatial audio
// ============================================================

import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { sceneManager } from '../rendering/SceneManager.js?v=20260119';

// Sound definitions with procedurally generated audio
const SOUND_DEFS = {
    // UI Sounds
    click: { type: 'ui', volume: 0.3 },
    select: { type: 'ui', volume: 0.4 },
    error: { type: 'ui', volume: 0.5 },
    buildStart: { type: 'ui', volume: 0.5 },
    buildComplete: { type: 'ui', volume: 0.6 },
    unitReady: { type: 'ui', volume: 0.5 },

    // Combat Sounds
    laserSmall: { type: 'combat', volume: 0.3, spatial: true },
    laserMedium: { type: 'combat', volume: 0.4, spatial: true },
    laserHeavy: { type: 'combat', volume: 0.5, spatial: true },
    explosion: { type: 'combat', volume: 0.6, spatial: true },
    explosionLarge: { type: 'combat', volume: 0.8, spatial: true },
    shield: { type: 'combat', volume: 0.3, spatial: true },

    // Unit Sounds
    engineLoop: { type: 'unit', volume: 0.2, loop: true, spatial: true },
    harvesting: { type: 'unit', volume: 0.3, loop: true, spatial: true },
    moveCommand: { type: 'unit', volume: 0.3 },
    attackCommand: { type: 'unit', volume: 0.4 },

    // Ambient
    ambientSpace: { type: 'ambient', volume: 0.15, loop: true }
};

// Max concurrent instances of the same sound name playing at once (voice limiting).
const MAX_CONCURRENT_VOICES = 6;

export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.ambientGain = null;

        this.sounds = new Map();
        this.activeSounds = new Map();
        this.musicTrack = null;         // calm layer
        this.combatTrack = null;        // combat layer
        this.musicCalmGain = null;      // crossfade gain for the calm layer
        this.musicCombatGain = null;    // crossfade gain for the combat layer
        this.combatIntensity = 0;       // 0..1, rises on combat events, decays over time
        this._musicInterval = null;     // crossfade decay/apply timer
        this.voiceCounts = new Map(); // soundName -> active instance count

        this.enabled = true;
        this.masterVolume = 1;
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.muted = false;

        this.initialized = false;

        // Restore persisted volume preferences (survives reloads).
        this.loadPersistedVolumes();
    }

    // ===== Persistence =====

    loadPersistedVolumes() {
        try {
            const read = (key, fallback) => {
                const raw = localStorage.getItem(key);
                if (raw === null) return fallback;
                const n = parseFloat(raw);
                return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
            };
            this.masterVolume = read('vs_vol_master', this.masterVolume);
            this.musicVolume = read('vs_vol_music', this.musicVolume);
            this.sfxVolume = read('vs_vol_sfx', this.sfxVolume);
            this.muted = localStorage.getItem('vs_muted') === '1';
        } catch (e) {
            // localStorage unavailable (private mode / disabled) - keep defaults.
        }
    }

    _persistVolumes() {
        try {
            localStorage.setItem('vs_vol_master', String(this.masterVolume));
            localStorage.setItem('vs_vol_music', String(this.musicVolume));
            localStorage.setItem('vs_vol_sfx', String(this.sfxVolume));
            localStorage.setItem('vs_muted', this.muted ? '1' : '0');
        } catch (e) {
            // Non-fatal: preferences simply will not persist this session.
        }
    }

    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create gain nodes for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;

            this.musicGain = this.audioContext.createGain();
            this.musicGain.connect(this.masterGain);
            this.musicGain.gain.value = this.musicVolume;

            // Two music layers (calm / combat) crossfaded by combatIntensity.
            // Both feed musicGain, so the music volume slider still governs both.
            this.musicCalmGain = this.audioContext.createGain();
            this.musicCalmGain.connect(this.musicGain);
            this.musicCalmGain.gain.value = 1;   // full calm at start
            this.musicCombatGain = this.audioContext.createGain();
            this.musicCombatGain.connect(this.musicGain);
            this.musicCombatGain.gain.value = 0; // combat layer silent at start

            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.connect(this.masterGain);
            this.sfxGain.gain.value = this.sfxVolume;

            this.ambientGain = this.audioContext.createGain();
            this.ambientGain.connect(this.masterGain);
            this.ambientGain.gain.value = 0.3;

            // Generate procedural sounds
            await this.generateSounds();

            // Setup event listeners
            this.setupEventListeners();

            // Mark initialized BEFORE starting playback: playAmbient/playMusic
            // both guard on `initialized`, so setting it after them made the
            // first-init calls early-return and no music/ambient ever started.
            this.initialized = true;

            // Start ambient space sound
            this.playAmbient();

            // Start layered background music (calm + combat crossfade)
            this.playMusic();

            console.log('Sound system initialized');

        } catch (error) {
            console.warn('Audio initialization failed:', error);
            this.enabled = false;
        }
    }

    setupEventListeners() {
        // Store unsubscribe functions for cleanup
        this._unsubs = [
            // Combat events
            eventBus.on(GameEvents.COMBAT_PROJECTILE_FIRED, (data) => {
                const soundType = data.damage > 50 ? 'laserHeavy' : data.damage > 20 ? 'laserMedium' : 'laserSmall';
                this.playSpatial(soundType, data.startPos);
                this._bumpIntensity(0.06); // each shot swells the combat music
            }),

            eventBus.on(GameEvents.COMBAT_EXPLOSION, (data) => {
                const soundType = data.size > 10 ? 'explosionLarge' : 'explosion';
                this.playSpatial(soundType, data.position);
                this._bumpIntensity(0.15); // explosions swell it harder
            }),

            eventBus.on(GameEvents.ENTITY_DAMAGED, (data) => {
                if (data.entity.shield > 0) {
                    this.playSpatial('shield', data.entity.position);
                }
            }),

            // UI events
            eventBus.on(GameEvents.ENTITY_SELECTED, () => {
                this.play('select');
            }),

            eventBus.on(GameEvents.BUILDING_PLACED, () => {
                this.play('buildStart');
            }),

            eventBus.on(GameEvents.BUILDING_COMPLETED, () => {
                this.play('buildComplete');
            }),

            eventBus.on(GameEvents.UNIT_SPAWNED, () => {
                this.play('unitReady');
            }),

            eventBus.on(GameEvents.UNIT_COMMAND, (data) => {
                if (data.command === 'move') {
                    this.play('moveCommand');
                } else if (data.command === 'attack') {
                    this.play('attackCommand');
                }
            }),

            eventBus.on(GameEvents.UI_ALERT, (data) => {
                if (data.type === 'danger') {
                    this.play('error');
                }
            })
        ];

        // Resume audio context on user interaction
        document.addEventListener('click', () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: true });
    }

    // ===== Procedural Sound Generation =====

    async generateSounds() {
        // Generate each sound procedurally
        this.sounds.set('click', this.generateClick());
        this.sounds.set('select', this.generateSelect());
        this.sounds.set('error', this.generateError());
        this.sounds.set('buildStart', this.generateBuildStart());
        this.sounds.set('buildComplete', this.generateBuildComplete());
        this.sounds.set('unitReady', this.generateUnitReady());
        this.sounds.set('laserSmall', this.generateLaser(0.1, 800, 1200));
        this.sounds.set('laserMedium', this.generateLaser(0.15, 500, 800));
        this.sounds.set('laserHeavy', this.generateLaser(0.25, 200, 400));
        this.sounds.set('explosion', this.generateExplosion(0.3));
        this.sounds.set('explosionLarge', this.generateExplosion(0.5));
        this.sounds.set('shield', this.generateShield());
        this.sounds.set('moveCommand', this.generateBeep(0.1, 600));
        this.sounds.set('attackCommand', this.generateBeep(0.1, 400));
        this.sounds.set('ambientSpace', this.generateAmbientSpace());
    }

    generateClick() {
        const duration = 0.05;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            data[i] = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 50);
        }

        return buffer;
    }

    generateSelect() {
        const duration = 0.1;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            const freq = 400 + t * 2000;
            data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 20) * 0.5;
        }

        return buffer;
    }

    generateError() {
        const duration = 0.2;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            data[i] = (Math.sin(2 * Math.PI * 200 * t) + Math.sin(2 * Math.PI * 250 * t)) * Math.exp(-t * 10) * 0.3;
        }

        return buffer;
    }

    generateBuildStart() {
        const duration = 0.3;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            const freq = 300 + Math.sin(t * 20) * 100;
            data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5) * 0.4;
        }

        return buffer;
    }

    generateBuildComplete() {
        const duration = 0.4;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            // Rising arpeggio
            const note1 = t < 0.1 ? Math.sin(2 * Math.PI * 523 * t) : 0;
            const note2 = t >= 0.1 && t < 0.2 ? Math.sin(2 * Math.PI * 659 * t) : 0;
            const note3 = t >= 0.2 && t < 0.3 ? Math.sin(2 * Math.PI * 784 * t) : 0;
            const note4 = t >= 0.3 ? Math.sin(2 * Math.PI * 1047 * t) : 0;
            data[i] = (note1 + note2 + note3 + note4) * Math.exp(-(t % 0.1) * 20) * 0.3;
        }

        return buffer;
    }

    generateUnitReady() {
        const duration = 0.25;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            const freq = 600 + t * 400;
            data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 8) * 0.4;
        }

        return buffer;
    }

    generateLaser(duration, freqStart, freqEnd) {
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            const freq = freqStart + (freqEnd - freqStart) * (t / duration);
            // Add some harmonics for a richer laser sound
            data[i] = (
                Math.sin(2 * Math.PI * freq * t) * 0.5 +
                Math.sin(2 * Math.PI * freq * 2 * t) * 0.3 +
                Math.sin(2 * Math.PI * freq * 3 * t) * 0.2
            ) * Math.exp(-t * 15) * 0.5;
        }

        return buffer;
    }

    generateExplosion(duration) {
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            // White noise with low-pass filter effect
            const noise = Math.random() * 2 - 1;
            const lowFreq = Math.sin(2 * Math.PI * 60 * t) * 0.5;
            const envelope = Math.exp(-t * 8);
            data[i] = (noise * 0.7 + lowFreq) * envelope * 0.6;
        }

        return buffer;
    }

    generateShield() {
        const duration = 0.15;
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            // Metallic ping sound
            data[i] = (
                Math.sin(2 * Math.PI * 2000 * t) * 0.3 +
                Math.sin(2 * Math.PI * 3000 * t) * 0.2 +
                Math.sin(2 * Math.PI * 4000 * t) * 0.1
            ) * Math.exp(-t * 30) * 0.4;
        }

        return buffer;
    }

    generateBeep(duration, freq) {
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 20) * 0.3;
        }

        return buffer;
    }

    generateAmbientSpace() {
        const duration = 10; // 10 second loop
        const buffer = this.audioContext.createBuffer(1, duration * this.audioContext.sampleRate, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            // Deep space rumble with subtle variations
            const rumble = (
                Math.sin(2 * Math.PI * 30 * t + Math.sin(t * 0.5) * 2) * 0.3 +
                Math.sin(2 * Math.PI * 45 * t + Math.sin(t * 0.3) * 1.5) * 0.2 +
                Math.sin(2 * Math.PI * 60 * t) * 0.1
            );
            // Add subtle noise
            const noise = (Math.random() * 2 - 1) * 0.05;
            data[i] = (rumble + noise) * 0.3;
        }

        return buffer;
    }

    // ===== Music Generation =====

    generateMusic() {
        // Generate an epic space soundtrack
        const duration = 60; // 60 second loop
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate);
        const leftData = buffer.getChannelData(0);
        const rightData = buffer.getChannelData(1);

        // Musical parameters
        const bpm = 80;
        const beatDuration = 60 / bpm;

        // Chord progression (epic space feel)
        const chords = [
            [130.81, 164.81, 196.00], // C minor
            [116.54, 146.83, 174.61], // Bb major
            [123.47, 155.56, 185.00], // B diminished
            [130.81, 164.81, 196.00], // C minor
        ];

        for (let i = 0; i < leftData.length; i++) {
            const t = i / sampleRate;
            const beat = Math.floor(t / beatDuration);
            const chordIndex = Math.floor(beat / 8) % chords.length;
            const chord = chords[chordIndex];

            // Bass drone
            const bass = Math.sin(2 * Math.PI * chord[0] * 0.5 * t) * 0.15;

            // Pad synth with slow attack
            const padEnvelope = Math.min(1, (t % (beatDuration * 8)) / 2);
            const pad = (
                Math.sin(2 * Math.PI * chord[0] * t) * 0.08 +
                Math.sin(2 * Math.PI * chord[1] * t) * 0.06 +
                Math.sin(2 * Math.PI * chord[2] * t) * 0.04
            ) * padEnvelope;

            // Arpeggiated synth
            const arpBeat = beat % 4;
            const arpNote = chord[arpBeat % 3] * 2;
            const arpEnvelope = Math.exp(-((t % beatDuration) * 4));
            const arp = Math.sin(2 * Math.PI * arpNote * t) * arpEnvelope * 0.1;

            // Combine and add slight stereo width
            const mono = bass + pad + arp;
            leftData[i] = mono + Math.sin(2 * Math.PI * 0.1 * t) * 0.02;
            rightData[i] = mono - Math.sin(2 * Math.PI * 0.1 * t) * 0.02;
        }

        return buffer;
    }

    // Combat music layer: same chord progression as generateMusic() (so the two
    // layers stay harmonically aligned while crossfading) but faster, with a
    // driving kick + urgent 16th-note arpeggio. Crossfaded in by combatIntensity.
    generateCombatMusic() {
        const duration = 48;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate);
        const leftData = buffer.getChannelData(0);
        const rightData = buffer.getChannelData(1);

        const bpm = 120;
        const beatDuration = 60 / bpm;

        const chords = [
            [130.81, 164.81, 196.00], // C minor
            [116.54, 146.83, 174.61], // Bb major
            [123.47, 155.56, 185.00], // B diminished
            [130.81, 164.81, 196.00], // C minor
        ];

        for (let i = 0; i < leftData.length; i++) {
            const t = i / sampleRate;
            const beat = Math.floor(t / beatDuration);
            const chord = chords[Math.floor(beat / 8) % chords.length];

            // Driving kick + sub bass each beat
            const beatPhase = (t % beatDuration) / beatDuration;
            const kick = Math.exp(-beatPhase * 12) * Math.sin(2 * Math.PI * 60 * t) * 0.22;
            const bass = Math.sin(2 * Math.PI * chord[0] * 0.5 * t) * 0.12;

            // Urgent 16th-note arpeggio one octave up, brighter (added harmonic)
            const sixteenth = Math.floor(t / (beatDuration / 4));
            const arpNote = chord[sixteenth % 3] * 2;
            const arpEnv = Math.exp(-((t % (beatDuration / 4)) * 12));
            const arp = (
                Math.sin(2 * Math.PI * arpNote * t) +
                Math.sin(2 * Math.PI * arpNote * 2 * t) * 0.4
            ) * arpEnv * 0.09;

            // Sustained tension pad on the fifth
            const pad = Math.sin(2 * Math.PI * chord[1] * t) * 0.05;

            const mono = kick + bass + arp + pad;
            leftData[i] = mono + Math.sin(2 * Math.PI * 0.15 * t) * 0.02;
            rightData[i] = mono - Math.sin(2 * Math.PI * 0.15 * t) * 0.02;
        }

        return buffer;
    }

    // ===== Voice Limiting =====

    // Returns true if another instance of soundName is allowed to start.
    _canPlayVoice(soundName) {
        return (this.voiceCounts.get(soundName) || 0) < MAX_CONCURRENT_VOICES;
    }

    // Tracks a started voice and releases it when the source finishes.
    _trackVoice(soundName, source) {
        this.voiceCounts.set(soundName, (this.voiceCounts.get(soundName) || 0) + 1);
        source.addEventListener('ended', () => {
            const count = this.voiceCounts.get(soundName) || 0;
            this.voiceCounts.set(soundName, Math.max(0, count - 1));
        });
    }

    // ===== Playback Methods =====

    play(soundName, volume = 1) {
        if (!this.enabled || !this.initialized) return;

        const buffer = this.sounds.get(soundName);
        if (!buffer) return;
        if (!this._canPlayVoice(soundName)) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        const def = SOUND_DEFS[soundName] || { volume: 0.5 };
        gainNode.gain.value = def.volume * volume;

        source.connect(gainNode);
        gainNode.connect(this.sfxGain);

        this._trackVoice(soundName, source);
        source.start();

        return source;
    }

    playSpatial(soundName, position, volume = 1) {
        if (!this.enabled || !this.initialized) return;
        if (!sceneManager.camera) return;

        const buffer = this.sounds.get(soundName);
        if (!buffer) return;
        if (!this._canPlayVoice(soundName)) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        // Create panner for 3D positioning
        const panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 50;
        panner.maxDistance = 500;
        panner.rolloffFactor = 1;

        // Set position relative to camera
        const camPos = sceneManager.camera.position;
        const relX = (position.x - camPos.x) / 100;
        const relY = (position.y - camPos.y) / 100;
        const relZ = (position.z - camPos.z) / 100;
        panner.setPosition(relX, relY || 0, relZ);

        const gainNode = this.audioContext.createGain();
        const def = SOUND_DEFS[soundName] || { volume: 0.5 };
        gainNode.gain.value = def.volume * volume;

        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.sfxGain);

        this._trackVoice(soundName, source);
        source.start();

        return source;
    }

    playMusic() {
        if (!this.enabled || !this.initialized) return;

        // Calm layer -> calm gain (audible when peaceful).
        this.musicTrack = this.audioContext.createBufferSource();
        this.musicTrack.buffer = this.generateMusic();
        this.musicTrack.loop = true;
        this.musicTrack.connect(this.musicCalmGain || this.musicGain);
        this.musicTrack.start();

        // Combat layer -> combat gain (silent until combatIntensity rises).
        this.combatTrack = this.audioContext.createBufferSource();
        this.combatTrack.buffer = this.generateCombatMusic();
        this.combatTrack.loop = true;
        this.combatTrack.connect(this.musicCombatGain || this.musicGain);
        this.combatTrack.start();

        this._startMusicCrossfade();
    }

    // Bumps the combat-intensity meter (0..1). Called on combat events; the
    // crossfade timer decays it back toward calm.
    _bumpIntensity(amount) {
        this.combatIntensity = Math.min(1, this.combatIntensity + amount);
    }

    // Decays combatIntensity over time and equal-power crossfades the calm /
    // combat layers. Equal-power (cos/sin) keeps perceived loudness constant
    // across the fade. Runs off a light timer, not the render loop.
    _startMusicCrossfade() {
        if (this._musicInterval) return;
        const DECAY = 0.9;        // per-tick multiplier (~250ms tick)
        const TICK_MS = 250;
        this._musicInterval = setInterval(() => {
            try {
                if (!this.audioContext || !this.musicCalmGain || !this.musicCombatGain) return;
                this.combatIntensity *= DECAY;
                if (this.combatIntensity < 0.01) this.combatIntensity = 0;
                const i = this.combatIntensity;
                const calm = Math.cos(i * Math.PI / 2);
                const combat = Math.sin(i * Math.PI / 2);
                const t = this.audioContext.currentTime;
                this.musicCalmGain.gain.setTargetAtTime(calm, t, 0.2);
                this.musicCombatGain.gain.setTargetAtTime(combat, t, 0.2);
            } catch (e) {
                // Never let the audio timer throw into the page.
            }
        }, TICK_MS);
    }

    playAmbient() {
        if (!this.enabled || !this.initialized) return;

        const buffer = this.sounds.get('ambientSpace');
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.ambientGain);
        source.start();

        this.activeSounds.set('ambientSpace', source);
    }

    // ===== Volume Controls =====

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
        }
        this._persistVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.value = this.musicVolume;
        }
        this._persistVolumes();
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.sfxVolume;
        }
        this._persistVolumes();
    }

    // Mute toggles applied gain to 0 without discarding the chosen master level.
    setMuted(muted) {
        this.muted = !!muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
        }
        this._persistVolumes();
    }

    mute() {
        this.setMuted(true);
    }

    unmute() {
        this.setMuted(false);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    // ===== Update Loop =====

    update(deltaTime) {
        // Resume audio context on first update after user interaction
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Update listener position for 3D audio (follows camera)
        // this.scene is never assigned on this class; read the live scene from
        // the SceneManager singleton instead so the listener actually tracks the camera.
        const scene = sceneManager.scene;
        if (scene && scene.activeCamera && this.audioContext) {
            const cam = scene.activeCamera;
            const listener = this.audioContext.listener;

            if (listener.positionX) {
                listener.positionX.value = cam.position.x;
                listener.positionY.value = cam.position.y;
                listener.positionZ.value = cam.position.z;
            }
        }
    }

    dispose() {
        // Unsubscribe from event bus listeners
        this._unsubs?.forEach(unsub => unsub?.());
        this._unsubs = null;

        if (this._musicInterval) {
            clearInterval(this._musicInterval);
            this._musicInterval = null;
        }
        if (this.musicTrack) {
            try { this.musicTrack.stop(); } catch (e) {}
        }
        if (this.combatTrack) {
            try { this.combatTrack.stop(); } catch (e) {}
        }

        this.activeSounds.forEach(source => {
            try { source.stop(); } catch (e) {}
        });
        this.activeSounds.clear();

        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

export const soundManager = new SoundManager();

export default SoundManager;
