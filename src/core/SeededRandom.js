// ============================================================
// VOID SUPREMACY 3D - Seeded Random Number Generator
// Mulberry32 PRNG for reproducible map generation
// ============================================================

/**
 * Mulberry32 - Fast, high-quality 32-bit seeded PRNG
 * Same seed always produces same sequence of numbers
 */
export class SeededRandom {
    /**
     * Create a seeded random number generator
     * @param {number|string} seed - Numeric seed or string (will be hashed)
     */
    constructor(seed = Date.now()) {
        this.setSeed(seed);
    }

    /**
     * Set a new seed
     * @param {number|string} seed - Numeric seed or string
     */
    setSeed(seed) {
        if (typeof seed === 'string') {
            seed = this.hashString(seed);
        }
        this.seed = seed >>> 0; // Ensure unsigned 32-bit
        this.state = this.seed;
    }

    /**
     * Hash a string to a 32-bit integer
     * Uses FNV-1a hash algorithm
     * @param {string} str - String to hash
     * @returns {number}
     */
    hashString(str) {
        let hash = 2166136261; // FNV offset basis
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = (hash * 16777619) >>> 0; // FNV prime, keep as unsigned
        }
        return hash;
    }

    /**
     * Generate next random number using Mulberry32
     * @returns {number} Random float between 0 (inclusive) and 1 (exclusive)
     */
    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Generate random float in range [min, max)
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number}
     */
    range(min, max) {
        return min + this.next() * (max - min);
    }

    /**
     * Generate random integer in range [min, max]
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @returns {number}
     */
    int(min, max) {
        return Math.floor(this.range(min, max + 1));
    }

    /**
     * Generate random angle in radians [0, 2*PI)
     * @returns {number}
     */
    angle() {
        return this.next() * Math.PI * 2;
    }

    /**
     * Generate random boolean with optional probability
     * @param {number} probability - Probability of true (default 0.5)
     * @returns {boolean}
     */
    bool(probability = 0.5) {
        return this.next() < probability;
    }

    /**
     * Pick random element from array
     * @param {Array} array - Array to pick from
     * @returns {*} Random element
     */
    pick(array) {
        if (array.length === 0) return undefined;
        return array[this.int(0, array.length - 1)];
    }

    /**
     * Shuffle array in place using Fisher-Yates
     * @param {Array} array - Array to shuffle
     * @returns {Array} Same array, shuffled
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generate random point in circle
     * @param {number} radius - Circle radius
     * @returns {{x: number, z: number}}
     */
    pointInCircle(radius) {
        const r = Math.sqrt(this.next()) * radius;
        const angle = this.angle();
        return {
            x: Math.cos(angle) * r,
            z: Math.sin(angle) * r
        };
    }

    /**
     * Generate random point in ring (annulus)
     * @param {number} innerRadius - Inner radius
     * @param {number} outerRadius - Outer radius
     * @returns {{x: number, z: number}}
     */
    pointInRing(innerRadius, outerRadius) {
        const r = Math.sqrt(this.range(innerRadius * innerRadius, outerRadius * outerRadius));
        const angle = this.angle();
        return {
            x: Math.cos(angle) * r,
            z: Math.sin(angle) * r
        };
    }

    /**
     * Generate Gaussian (normal) distributed random number
     * Uses Box-Muller transform
     * @param {number} mean - Mean (default 0)
     * @param {number} stdDev - Standard deviation (default 1)
     * @returns {number}
     */
    gaussian(mean = 0, stdDev = 1) {
        const u1 = this.next();
        const u2 = this.next();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * stdDev;
    }

    /**
     * Get the current seed (for saving/restoring state)
     * @returns {number}
     */
    getSeed() {
        return this.seed;
    }

    /**
     * Get the current internal state
     * @returns {number}
     */
    getState() {
        return this.state;
    }

    /**
     * Restore internal state (for save/load)
     * @param {number} state
     */
    setState(state) {
        this.state = state >>> 0;
    }

    /**
     * Reset to initial seed
     */
    reset() {
        this.state = this.seed;
    }

    /**
     * Create a new generator with same seed (fork)
     * @returns {SeededRandom}
     */
    fork() {
        const forked = new SeededRandom(this.seed);
        forked.state = this.state;
        return forked;
    }
}

// Global seeded random instance for game use
let globalRng = new SeededRandom();

/**
 * Get the global seeded random instance
 * @returns {SeededRandom}
 */
export function getSeededRandom() {
    return globalRng;
}

/**
 * Set the global seed
 * @param {number|string} seed
 */
export function setGlobalSeed(seed) {
    globalRng.setSeed(seed);
}

/**
 * Reset the global RNG to a new instance
 * @param {number|string} seed
 */
export function resetSeededRandom(seed) {
    globalRng = new SeededRandom(seed);
    return globalRng;
}

export default SeededRandom;
