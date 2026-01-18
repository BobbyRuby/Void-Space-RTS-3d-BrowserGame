// ============================================================
// VOID SUPREMACY 3D - Configuration Module
// All game constants, unit definitions, building definitions
// ============================================================

// Mutable CONFIG object - can be modified by pre-game lobby
export let CONFIG = {
    MAP_SIZE: 1200,
    NUM_PLAYERS: 4,
    NUM_AI_PLAYERS: 3,
    NUM_NEUTRAL_ALIENS: 2,

    // Ore settings (C&C style)
    ORE_FIELDS: 8,
    ORE_PER_FIELD_MIN: 2,
    ORE_PER_FIELD_MAX: 4,
    ORE_AMOUNT_MIN: 1500,
    ORE_AMOUNT_MAX: 3000,
    ORE_REGROW_RATE: 0.02,
    ORE_REGROW_DELAY: 30,
    ORE_SPREAD_CHANCE: 0.01,  // 1% chance per second (multiplied by dt in ResourceSystem)

    // Crystal settings (rare, valuable)
    CRYSTAL_FIELDS: 6,
    CRYSTAL_AMOUNT_MIN: 500,
    CRYSTAL_AMOUNT_MAX: 1000,
    CRYSTAL_VALUE_MULTIPLIER: 5,
    CRYSTAL_REGROW_RATE: 0.5,

    // Asteroid belt
    ASTEROID_BELT_INNER: 400,
    ASTEROID_BELT_OUTER: 550,
    NUM_ASTEROIDS: 200,

    // Build range
    BUILD_RANGE: 80,

    // Auto-defense settings
    DEFENSE_RADIUS: 150,           // Units within this range respond to attacks
    DEFENSE_COOLDOWN: 2000,        // Ms before same building can trigger again

    // Game settings (set by lobby)
    GAME_SPEED: 1.0,
    FOG_OF_WAR: false,
    AI_DIFFICULTY: 'normal',       // easy, normal, hard
    MAP_SEED: '',
    STARTING_CREDITS: 1000,
    STARTING_HARVESTERS: 1
};

/**
 * Apply configuration from pre-game lobby
 * @param {Object} lobbyConfig - Configuration from PreGameLobby
 */
export function applyGameConfig(lobbyConfig) {
    if (!lobbyConfig) return;

    // Map settings
    if (lobbyConfig.mapSize !== undefined) {
        CONFIG.MAP_SIZE = lobbyConfig.mapSize;
        // Adjust asteroid belt based on map size
        CONFIG.ASTEROID_BELT_INNER = Math.floor(lobbyConfig.mapSize * 0.33);
        CONFIG.ASTEROID_BELT_OUTER = Math.floor(lobbyConfig.mapSize * 0.46);
    }
    if (lobbyConfig.mapSeed !== undefined) {
        CONFIG.MAP_SEED = lobbyConfig.mapSeed;
    }
    if (lobbyConfig.numAIPlayers !== undefined) {
        CONFIG.NUM_AI_PLAYERS = lobbyConfig.numAIPlayers;
        CONFIG.NUM_PLAYERS = 1 + lobbyConfig.numAIPlayers; // Player + AI opponents
    }

    // Resource settings
    if (lobbyConfig.oreFields !== undefined) {
        CONFIG.ORE_FIELDS = lobbyConfig.oreFields;
    }
    if (lobbyConfig.crystalFields !== undefined) {
        CONFIG.CRYSTAL_FIELDS = lobbyConfig.crystalFields;
    }
    if (lobbyConfig.resourceRegrowRate !== undefined) {
        CONFIG.ORE_REGROW_RATE = lobbyConfig.resourceRegrowRate;
        CONFIG.CRYSTAL_REGROW_RATE = lobbyConfig.resourceRegrowRate * 5; // Crystals regrow slower
    }

    // Starting resources
    if (lobbyConfig.startingCredits !== undefined) {
        CONFIG.STARTING_CREDITS = lobbyConfig.startingCredits;
    }
    if (lobbyConfig.startingHarvesters !== undefined) {
        CONFIG.STARTING_HARVESTERS = lobbyConfig.startingHarvesters;
    }

    // Game options
    if (lobbyConfig.fogOfWar !== undefined) {
        CONFIG.FOG_OF_WAR = lobbyConfig.fogOfWar;
    }
    if (lobbyConfig.aiDifficulty !== undefined) {
        CONFIG.AI_DIFFICULTY = lobbyConfig.aiDifficulty;
    }
    if (lobbyConfig.gameSpeed !== undefined) {
        CONFIG.GAME_SPEED = lobbyConfig.gameSpeed;
    }

    console.log('Game config applied:', CONFIG);
}

/**
 * Reset CONFIG to default values
 */
export function resetConfig() {
    CONFIG = {
        MAP_SIZE: 1200,
        NUM_PLAYERS: 4,
        NUM_AI_PLAYERS: 3,
        NUM_NEUTRAL_ALIENS: 2,
        ORE_FIELDS: 8,
        ORE_PER_FIELD_MIN: 2,
        ORE_PER_FIELD_MAX: 4,
        ORE_AMOUNT_MIN: 1500,
        ORE_AMOUNT_MAX: 3000,
        ORE_REGROW_RATE: 0.02,
        ORE_REGROW_DELAY: 30,
        ORE_SPREAD_CHANCE: 0.01,  // 1% chance per second (multiplied by dt in ResourceSystem)
        CRYSTAL_FIELDS: 6,
        CRYSTAL_AMOUNT_MIN: 500,
        CRYSTAL_AMOUNT_MAX: 1000,
        CRYSTAL_VALUE_MULTIPLIER: 5,
        CRYSTAL_REGROW_RATE: 0.5,
        ASTEROID_BELT_INNER: 400,
        ASTEROID_BELT_OUTER: 550,
        NUM_ASTEROIDS: 200,
        BUILD_RANGE: 80,
        DEFENSE_RADIUS: 150,
        DEFENSE_COOLDOWN: 2000,
        GAME_SPEED: 1.0,
        FOG_OF_WAR: false,
        AI_DIFFICULTY: 'normal',
        MAP_SEED: '',
        STARTING_CREDITS: 1000,
        STARTING_HARVESTERS: 1
    };
}

// ============================================================
// Weapon Type Definitions
// ============================================================
export const WEAPON_TYPES = {
    laser: {
        projectileSpeed: 8,
        projectileSize: 0.3,
        trailLength: 3,
        color: 'team',  // Uses team color
        sound: 'laser'
    },
    plasma: {
        projectileSpeed: 4,
        projectileSize: 1.2,
        trailLength: 1,
        color: [0, 1, 0.5],  // Cyan-green
        glow: true,
        sound: 'plasma'
    },
    missile: {
        projectileSpeed: 2.5,
        projectileSize: 0.8,
        trailLength: 5,
        color: [1, 0.5, 0],  // Orange
        homing: true,
        sound: 'missile'
    },
    cannon: {
        projectileSpeed: 5,
        projectileSize: 1.5,
        trailLength: 2,
        color: [1, 1, 0],  // Yellow
        sound: 'cannon'
    },
    beam: {
        instant: true,  // No projectile, instant hit
        color: [1, 0, 0],  // Red
        duration: 0.2,
        sound: 'beam'
    }
};

export const TEAMS = {
    PLAYER: 0,
    ENEMY_1: 1,
    ENEMY_2: 2,
    ENEMY_3: 3,
    NEUTRAL: 4,
    NEUTRAL_2: 5
};

export const TEAM_COLORS = [
    [0.2, 0.6, 1.0],   // Player - Blue
    [1.0, 0.3, 0.2],   // Enemy 1 - Red
    [0.2, 1.0, 0.3],   // Enemy 2 - Green
    [1.0, 0.8, 0.2],   // Enemy 3 - Yellow
    [0.8, 0.4, 1.0],   // Neutral 1 - Purple (Aliens)
    [0.4, 1.0, 0.8]    // Neutral 2 - Cyan (Aliens)
];

export const TEAM_NAMES = [
    'You',
    'Crimson Empire',
    'Verdant Collective',
    'Solar Dynasty',
    'Ancient Ones',
    'The Watchers'
];

export const BUILDINGS = {
    commandCenter: {
        name: 'Command Center',
        icon: '🏛️',
        size: 14,
        maxHealth: 2500,
        cost: 0,
        energyProduction: 25,
        energyDrain: 5,
        supplyProvided: 15,
        buildTime: 0,
        canBuild: ['harvester', 'scout'],
        color: [0.2, 0.6, 0.8]
    },
    powerPlant: {
        name: 'Power Plant',
        icon: '⚡',
        size: 8,
        maxHealth: 600,
        cost: 150,
        energyProduction: 35,
        energyDrain: 0,
        buildTime: 20,
        color: [0.8, 0.8, 0.2]
    },
    refinery: {
        name: 'Refinery',
        icon: '🏭',
        size: 10,
        maxHealth: 1000,
        cost: 200,
        energyDrain: 8,
        buildTime: 25,
        processRate: 60,
        color: [0.7, 0.4, 0.2]
    },
    shipyard: {
        name: 'Shipyard',
        icon: '🚀',
        size: 14,
        maxHealth: 1500,
        cost: 350,
        energyDrain: 5,
        buildTime: 30,
        canBuild: ['interceptor', 'striker', 'heavy', 'bomber', 'gunship'],
        color: [0.3, 0.5, 0.7]
    },
    advancedShipyard: {
        name: 'Advanced Shipyard',
        icon: '🛸',
        size: 18,
        maxHealth: 2500,
        cost: 900,
        energyDrain: 10,
        buildTime: 50,
        canBuild: ['frigate', 'cruiser', 'battlecruiser', 'dreadnought'],
        color: [0.5, 0.3, 0.7]
    },
    turret: {
        name: 'Defense Turret',
        icon: '🔫',
        size: 5,
        maxHealth: 500,
        cost: 175,
        energyDrain: 3,
        buildTime: 15,
        damage: 30,
        range: 70,
        fireRate: 400,
        weaponType: 'cannon',
        hardpoints: [{ x: -1.2, y: 2, z: 4 }, { x: 1.2, y: 2, z: 4 }],
        color: [0.6, 0.3, 0.3]
    },
    supplyDepot: {
        name: 'Supply Depot',
        icon: '📦',
        size: 6,
        maxHealth: 500,
        cost: 100,
        energyDrain: 0,
        supplyProvided: 12,
        buildTime: 15,
        color: [0.4, 0.6, 0.4]
    },
    radar: {
        name: 'Sensor Array',
        icon: '📡',
        size: 6,
        maxHealth: 400,
        cost: 200,
        energyDrain: 5,
        buildTime: 20,
        sensorRange: 200,
        color: [0.3, 0.7, 0.7]
    },
    forceFieldGenerator: {
        name: 'Force Field Generator',
        icon: '🛡️',
        size: 6,
        maxHealth: 800,
        cost: 400,
        energyDrain: 8,
        buildTime: 25,
        maxRange: 100,        // Max distance to connect to another generator
        fieldHealth: 2000,    // Health of field segment between generators
        fieldWidth: 4,        // Width of field segment for collision
        fieldRegen: 5,        // HP/s regeneration when not taking damage
        fieldRegenDelay: 10,  // Seconds before regeneration after damage
        color: [0.2, 0.5, 0.8]
    }
};

export const UNITS = {
    harvester: {
        name: 'Harvester',
        icon: '⛏️',
        size: 4,
        maxHealth: 200,
        shield: 0,
        speed: 20,
        cost: 100,
        supply: 1,
        buildTime: 15,
        harvestRate: 30,
        cargoCapacity: 200,
        color: [0.6, 0.5, 0.3]
    },
    scout: {
        name: 'Scout',
        icon: '◇',
        size: 2,
        maxHealth: 50,
        shield: 30,
        speed: 40,
        cost: 50,
        supply: 1,
        buildTime: 8,
        damage: 5,
        range: 35,
        fireRate: 180,
        weaponType: 'laser',
        // Nose-mounted laser - visual model is needle-shaped
        hardpoints: [{ x: 0, y: 0.3, z: 2 }],
        color: [0.6, 0.6, 1]
    },
    interceptor: {
        name: 'Interceptor',
        icon: '▷',
        size: 2.5,
        maxHealth: 80,
        shield: 40,
        speed: 35,
        cost: 100,
        supply: 1,
        buildTime: 12,
        damage: 12,
        range: 40,
        fireRate: 250,
        weaponType: 'laser',
        // Wing-mounted weapon pods - muzzles at visual (±2.5, 0, 1)
        // Scale: size*0.5 = 1.25, so config = visual/1.25
        hardpoints: [{ x: -2, y: 0, z: 0.8 }, { x: 2, y: 0, z: 0.8 }],
        color: [0.5, 0.8, 0.5]
    },
    striker: {
        name: 'Strike Fighter',
        icon: '▶',
        size: 3,
        maxHealth: 100,
        shield: 50,
        speed: 30,
        cost: 150,
        supply: 2,
        buildTime: 15,
        damage: 18,
        range: 45,
        fireRate: 300,
        weaponType: 'plasma',
        // Forward-swept wing hardpoints - visual at (±2, -0.3, 1) and (±3.5, -0.3, 1)
        // Scale: size*0.5 = 1.5, so config = visual/1.5
        hardpoints: [
            { x: -1.33, y: -0.2, z: 0.67 }, { x: 1.33, y: -0.2, z: 0.67 },
            { x: -2.33, y: -0.2, z: 0.67 }, { x: 2.33, y: -0.2, z: 0.67 }
        ],
        color: [0.8, 0.5, 0.3]
    },
    heavy: {
        name: 'Heavy Fighter',
        icon: '◆',
        size: 4,
        maxHealth: 180,
        shield: 80,
        speed: 22,
        cost: 250,
        supply: 3,
        buildTime: 20,
        damage: 25,
        range: 50,
        fireRate: 400,
        weaponType: 'cannon',
        // Chin cannon muzzle at visual (0, -0.7, 7) + wing missile tubes
        // Scale: size*0.5 = 2, so config = visual/2
        hardpoints: [
            { x: 0, y: -0.35, z: 3.5 },  // Main chin cannon
            { x: -1.6, y: -0.2, z: 0.65 }, { x: 1.6, y: -0.2, z: 0.65 }  // Wing missile tubes
        ],
        color: [0.7, 0.3, 0.3]
    },
    bomber: {
        name: 'Bomber',
        icon: '◈',
        size: 5,
        maxHealth: 250,
        shield: 50,
        speed: 18,
        cost: 300,
        supply: 3,
        buildTime: 25,
        damage: 60,
        range: 35,
        fireRate: 1500,
        splash: 15,
        weaponType: 'missile',
        // Bomb bay torpedoes at visual (-1.2 to +1.2, -1, 0.5)
        // Scale: size*0.5 = 2.5, so config = visual/2.5
        hardpoints: [
            { x: -0.48, y: -0.4, z: 0.2 }, { x: 0.48, y: -0.4, z: 0.2 },
            { x: -0.16, y: -0.4, z: 0.2 }, { x: 0.16, y: -0.4, z: 0.2 }
        ],
        color: [0.5, 0.5, 0.7]
    },
    gunship: {
        name: 'Gunship',
        icon: '▣',
        size: 5,
        maxHealth: 300,
        shield: 100,
        speed: 20,
        cost: 350,
        supply: 4,
        buildTime: 25,
        damage: 20,
        range: 55,
        fireRate: 200,
        weaponType: 'laser',
        // Twin barrel turret muzzles at visual (±0.33, 2.83, 5.42)
        // Side sponson guns at visual (±2.92, 0, 4.58)
        // Scale: size*0.5 = 2.5, so config = visual/2.5
        hardpoints: [
            { x: -0.13, y: 1.13, z: 2.17 }, { x: 0.13, y: 1.13, z: 2.17 },  // Twin turret barrels
            { x: -1.17, y: 0, z: 1.83 }, { x: 1.17, y: 0, z: 1.83 }  // Side sponsons
        ],
        color: [0.4, 0.6, 0.4]
    },
    frigate: {
        name: 'Frigate',
        icon: '▰',
        size: 8,
        maxHealth: 600,
        shield: 200,
        speed: 15,
        cost: 500,
        supply: 5,
        buildTime: 35,
        damage: 35,
        range: 65,
        fireRate: 500,
        weaponType: 'cannon',
        // Twin turrets at z:6 and z:-2 with dual barrels at visual (±0.5, 3, 10) and (±0.5, 3, 2)
        // Scale: size*0.5 = 4, so config = visual/4
        hardpoints: [
            { x: -0.125, y: 0.75, z: 2.5 }, { x: 0.125, y: 0.75, z: 2.5 },  // Front turret
            { x: -0.125, y: 0.75, z: 0.5 }, { x: 0.125, y: 0.75, z: 0.5 }   // Rear turret
        ],
        color: [0.3, 0.5, 0.6]
    },
    cruiser: {
        name: 'Cruiser',
        icon: '▮',
        size: 12,
        maxHealth: 1000,
        shield: 400,
        speed: 12,
        cost: 800,
        supply: 8,
        buildTime: 45,
        damage: 50,
        range: 80,
        fireRate: 600,
        weaponType: 'plasma',
        secondaryWeapon: 'cannon',
        // VLS batteries on sides + bow weapons
        // Visual scale s = 12/10 = 1.2, mult = 6
        hardpoints: [
            { x: -0.42, y: 0.5, z: 2.33, weapon: 'plasma' }, { x: 0.42, y: 0.5, z: 2.33, weapon: 'plasma' },
            { x: -0.42, y: 0.5, z: 1.17, weapon: 'cannon' }, { x: 0.42, y: 0.5, z: 1.17, weapon: 'cannon' }
        ],
        color: [0.5, 0.4, 0.6]
    },
    battlecruiser: {
        name: 'Battlecruiser',
        icon: '▬',
        size: 16,
        maxHealth: 1800,
        shield: 600,
        speed: 10,
        cost: 1200,
        supply: 12,
        buildTime: 60,
        damage: 80,
        range: 90,
        fireRate: 700,
        weaponType: 'beam',
        secondaryWeapon: 'missile',
        // Triple turrets at z:12, z:2, z:-6 with muzzles at (±0.8*s, y+1.5*s, z+10*s)
        // Visual scale s = 16/12 = 1.33, mult = 8
        hardpoints: [
            // Front turret (z:12) - beams
            { x: -0.13, y: 0.56, z: 2.75, weapon: 'beam' }, { x: 0.13, y: 0.56, z: 2.75, weapon: 'beam' },
            // Middle turret (z:2) - beams
            { x: -0.13, y: 0.81, z: 1.5, weapon: 'beam' }, { x: 0.13, y: 0.81, z: 1.5, weapon: 'beam' },
            // Broadside missile tubes
            { x: -1.17, y: 0, z: 1.0, weapon: 'missile' }, { x: 1.17, y: 0, z: 1.0, weapon: 'missile' },
            { x: -1.17, y: 0, z: 0.5, weapon: 'missile' }, { x: 1.17, y: 0, z: 0.5, weapon: 'missile' }
        ],
        color: [0.6, 0.3, 0.5]
    },
    dreadnought: {
        name: 'Dreadnought',
        icon: '█',
        size: 22,
        maxHealth: 3000,
        shield: 1000,
        speed: 7,
        cost: 2000,
        supply: 20,
        buildTime: 90,
        damage: 120,
        range: 100,
        fireRate: 800,
        weaponType: 'beam',
        secondaryWeapon: 'cannon',
        tertiaryWeapon: 'missile',
        // Four super-heavy turrets at z:18, z:10, z:-4, z:-12 with triple barrels
        // Muzzles at ((j-1)*1.2*s, (y+2.5)*s, (z+15)*s) where s=22/15=1.47, mult=11
        hardpoints: [
            // Forward turret (z:18) - beams
            { x: -0.16, y: 0.59, z: 3.0, weapon: 'beam' }, { x: 0, y: 0.59, z: 3.0, weapon: 'beam' }, { x: 0.16, y: 0.59, z: 3.0, weapon: 'beam' },
            // Second turret (z:10) - beams
            { x: -0.16, y: 0.95, z: 2.27, weapon: 'beam' }, { x: 0, y: 0.95, z: 2.27, weapon: 'beam' }, { x: 0.16, y: 0.95, z: 2.27, weapon: 'beam' },
            // Broadside cannons
            { x: -0.91, y: 0.09, z: 1.27, weapon: 'cannon' }, { x: 0.91, y: 0.09, z: 1.27, weapon: 'cannon' },
            // Missile launchers
            { x: -0.91, y: -0.09, z: 0.82, weapon: 'missile' }, { x: 0.91, y: -0.09, z: 0.82, weapon: 'missile' },
            { x: -0.91, y: 0, z: 0.45, weapon: 'missile' }, { x: 0.91, y: 0, z: 0.45, weapon: 'missile' }
        ],
        color: [0.4, 0.3, 0.5]
    }
};

export const ALIEN_UNITS = {
    guardian: {
        name: 'Guardian',
        icon: '⬡',
        size: 6,
        maxHealth: 400,
        shield: 200,
        speed: 15,
        damage: 40,
        range: 60,
        fireRate: 500,
        weaponType: 'plasma',
        hardpoints: [{ x: -1, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }],
        color: [0.8, 0.4, 1.0]
    },
    sentinel: {
        name: 'Sentinel',
        icon: '⬢',
        size: 10,
        maxHealth: 800,
        shield: 400,
        speed: 8,
        damage: 60,
        range: 80,
        fireRate: 600,
        weaponType: 'beam',
        hardpoints: [{ x: 0, y: 0, z: 4 }, { x: -2, y: 0, z: 3 }, { x: 2, y: 0, z: 3 }],
        color: [0.6, 0.2, 0.8]
    }
};

// Helper to get team color as Color3
export function getTeamColor3(team) {
    const c = TEAM_COLORS[team] || TEAM_COLORS[0];
    return new BABYLON.Color3(c[0], c[1], c[2]);
}

// Helper to get team color as hex string
export function getTeamColorHex(team) {
    const c = TEAM_COLORS[team] || TEAM_COLORS[0];
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toHex(c[0])}${toHex(c[1])}${toHex(c[2])}`;
}

// ============================================================
// Graphics Quality Settings
// ============================================================

// Tessellation levels for ship geometry (affects smoothness)
export const TESSELLATION_SETTINGS = {
    LOW: {
        sphere: 4,
        cylinder: 6,
        box: 1,          // Subdivisions for beveled boxes
        tube: 8,         // Tube path segments
        torus: 12,
        useNormalMaps: false,
        useFresnel: false,
        mergeMeshes: true
    },
    MEDIUM: {
        sphere: 8,
        cylinder: 10,
        box: 1,
        tube: 12,
        torus: 18,
        useNormalMaps: true,
        useFresnel: false,
        mergeMeshes: true
    },
    HIGH: {
        sphere: 12,
        cylinder: 14,
        box: 2,
        tube: 16,
        torus: 24,
        useNormalMaps: true,
        useFresnel: true,
        mergeMeshes: true
    },
    ULTRA: {
        sphere: 16,
        cylinder: 18,
        box: 2,
        tube: 20,
        torus: 32,
        useNormalMaps: true,
        useFresnel: true,
        mergeMeshes: false  // Keep separate for potential animations
    }
};

// LOD (Level of Detail) distance thresholds
export const LOD_SETTINGS = {
    LOW: {
        enabled: false,
        highDetailDistance: 50,
        mediumDetailDistance: 100,
        lowDetailDistance: 200,
        billboardDistance: 400
    },
    MEDIUM: {
        enabled: true,
        highDetailDistance: 80,
        mediumDetailDistance: 150,
        lowDetailDistance: 300,
        billboardDistance: 500
    },
    HIGH: {
        enabled: true,
        highDetailDistance: 100,
        mediumDetailDistance: 200,
        lowDetailDistance: 400,
        billboardDistance: 600
    },
    ULTRA: {
        enabled: true,
        highDetailDistance: 150,
        mediumDetailDistance: 300,
        lowDetailDistance: 500,
        billboardDistance: 800
    }
};

export const GRAPHICS_SETTINGS = {
    LOW: {
        postProcessing: false,
        bloom: false,
        fxaa: false,
        ssao: false,
        shadows: false,
        motionBlur: false,
        volumetric: false,
        materials: 'standard',
        tessellation: TESSELLATION_SETTINGS.LOW,
        lod: LOD_SETTINGS.LOW
    },
    MEDIUM: {
        postProcessing: true,
        bloom: { enabled: true, intensity: 0.3, threshold: 0.7, kernel: 32 },
        fxaa: true,
        ssao: false,
        shadows: false,
        motionBlur: false,
        volumetric: false,
        materials: 'standard',
        tessellation: TESSELLATION_SETTINGS.MEDIUM,
        lod: LOD_SETTINGS.MEDIUM
    },
    HIGH: {
        postProcessing: true,
        bloom: { enabled: true, intensity: 0.5, threshold: 0.6, kernel: 64 },
        fxaa: true,
        ssao: { enabled: true, radius: 2, strength: 1, samples: 16 },
        shadows: { enabled: true, mapSize: 1024 },
        motionBlur: false,
        volumetric: false,
        materials: 'pbr',
        tessellation: TESSELLATION_SETTINGS.HIGH,
        lod: LOD_SETTINGS.HIGH
    },
    ULTRA: {
        postProcessing: true,
        bloom: { enabled: true, intensity: 0.7, threshold: 0.5, kernel: 128 },
        fxaa: true,
        ssao: { enabled: true, radius: 3, strength: 1.5, samples: 32 },
        motionBlur: { enabled: true, strength: 0.5 },
        shadows: { enabled: true, mapSize: 2048, soft: true },
        volumetric: true,
        materials: 'pbr',
        tessellation: TESSELLATION_SETTINGS.ULTRA,
        lod: LOD_SETTINGS.ULTRA
    }
};

// Current graphics level (can be changed at runtime)
export let graphicsLevel = 'MEDIUM';

export function setGraphicsLevel(level) {
    if (GRAPHICS_SETTINGS[level]) {
        graphicsLevel = level;
        // Sync to window for external scripts (void-ships-enhanced.js)
        if (typeof window !== 'undefined') {
            window.graphicsLevel = level;
        }
        return true;
    }
    return false;
}

// Expose to window for external scripts (void-ships-enhanced.js)
if (typeof window !== 'undefined') {
    window.GRAPHICS_SETTINGS = GRAPHICS_SETTINGS;
    window.graphicsLevel = graphicsLevel;
}
