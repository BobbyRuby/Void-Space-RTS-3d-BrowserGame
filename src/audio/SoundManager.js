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

export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.ambientGain = null;

        this.sounds = new Map();
        this.activeSounds = new Map();
        this.musicTrack = null;

        this.enabled = true;
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;

        this.initialized = false;
    }

    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create gain nodes for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);

            this.musicGain = this.audioContext.createGain();
            this.musicGain.connect(this.masterGain);
            this.musicGain.gain.value = this.musicVolume;

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

            // Start ambient space sound
            this.playAmbient();

            // Start background music
            this.playMusic();

            this.initialized = true;
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
            }),

            eventBus.on(GameEvents.COMBAT_EXPLOSION, (data) => {
                const soundType = data.size > 10 ? 'explosionLarge' : 'explosion';
                this.playSpatial(soundType, data.position);
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

    // ===== Playback Methods =====

    play(soundName, volume = 1) {
        if (!this.enabled || !this.initialized) return;

        const buffer = this.sounds.get(soundName);
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        const def = SOUND_DEFS[soundName] || { volume: 0.5 };
        gainNode.gain.value = def.volume * volume;

        source.connect(gainNode);
        gainNode.connect(this.sfxGain);

        source.start();

        return source;
    }

    playSpatial(soundName, position, volume = 1) {
        if (!this.enabled || !this.initialized) return;
        if (!sceneManager.camera) return;

        const buffer = this.sounds.get(soundName);
        if (!buffer) return;

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

        source.start();

        return source;
    }

    playMusic() {
        if (!this.enabled || !this.initialized) return;

        const musicBuffer = this.generateMusic();
        this.musicTrack = this.audioContext.createBufferSource();
        this.musicTrack.buffer = musicBuffer;
        this.musicTrack.loop = true;
        this.musicTrack.connect(this.musicGain);
        this.musicTrack.start();
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
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.value = this.musicVolume;
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.sfxVolume;
        }
    }

    mute() {
        this.setMasterVolume(0);
    }

    unmute() {
        this.setMasterVolume(1);
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
        if (this.scene && this.scene.activeCamera && this.audioContext) {
            const cam = this.scene.activeCamera;
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

        if (this.musicTrack) {
            this.musicTrack.stop();
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
