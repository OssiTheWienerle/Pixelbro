const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 225,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    pixelArt: true
};

let game = new Phaser.Game(config);
let player;
let cursors;
let enemies;
let platforms;
let difficulty = 'Easy';
let currentLevelIndex = 0;
let gameState = 'START'; // START, PLAYING, BOSS, GAMEOVER, WIN
let soundEnabled = true;

let keybinds = {
    UP: Phaser.Input.Keyboard.KeyCodes.W,
    DOWN: Phaser.Input.Keyboard.KeyCodes.S,
    LEFT: Phaser.Input.Keyboard.KeyCodes.A,
    RIGHT: Phaser.Input.Keyboard.KeyCodes.D,
    ATTACK: Phaser.Input.Keyboard.KeyCodes.J,
    SPECIAL: Phaser.Input.Keyboard.KeyCodes.K,
    MELEE: Phaser.Input.Keyboard.KeyCodes.L,
    HEAL: Phaser.Input.Keyboard.KeyCodes.H
};

const DEFAULT_KEYBINDS = { ...keybinds };

function preload() {
}

function create() {
    this.cameras.main.setBackgroundColor('#2c3e50'); // Darker "night" sky to match Start UI vibe
    createTextures(this);
    this.particles = this.add.particles(0, 0, 'bullet', {
        speed: { min: -100, max: 100 },
        scale: { start: 1, end: 0 },
        lifespan: 500,
        emitting: false
    }).setDepth(10);

    // Procedural Audio placeholders (Simplified Synthesis)
    try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn("AudioContext not supported", e);
    }

    const playNote = (freq, duration, type = 'square') => {
        if (!soundEnabled || !this.audioContext) return;
        const ctx = this.audioContext;
        try {
            if (ctx.state === 'suspended') ctx.resume();
        } catch (e) { return; }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    };

    this.sounds = {
        shoot: { play: () => playNote(440, 0.1) },
        special: { play: () => { playNote(110, 0.5); playNote(220, 0.5); } },
        enemy: { play: () => playNote(200, 0.2, 'sawtooth') },
        boss: { play: () => playNote(100, 0.8, 'sawtooth') },
        music: { play: () => { }, stop: () => { } }
    };

    showStartScreen(this);
}

function update() {
    if (gameState === 'PLAYING' || gameState === 'BOSS') {
        if (player) player.update();
        if (enemies) {
            enemies.getChildren().forEach(enemy => {
                if (enemy.update) enemy.update();
            });
        }
        if (this.boss && this.boss.update) {
            this.boss.update();
        }
        if (this.barrels) {
            this.barrels.getChildren().forEach(barrel => {
                if (barrel.update) barrel.update();
            });
        }
    }
}

function createTextures(scene) {
    let graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // Player (24x24)
    graphics.fillStyle(0x1a1a1a); graphics.fillRect(6, 14, 12, 10);
    graphics.fillStyle(0x000088); graphics.fillRect(6, 8, 12, 8);
    graphics.fillStyle(0xffdbac); graphics.fillRect(7, 0, 10, 9);
    graphics.fillStyle(0x442200); graphics.fillRect(7, 5, 10, 5);
    graphics.fillStyle(0xff0000); graphics.fillRect(6, 2, 12, 3);
    graphics.fillRect(0, 2, 6, 1);
    graphics.fillStyle(0x000000); graphics.fillRect(9, 3, 2, 2); graphics.fillRect(13, 3, 2, 2);
    graphics.fillStyle(0x555555); graphics.fillRect(16, 10, 8, 4);
    graphics.fillStyle(0x333333); graphics.fillRect(18, 12, 4, 2);
    graphics.generateTexture('player', 24, 24);
    graphics.clear();

    // Enemy (24x24)
    graphics.fillStyle(0x2d3a2d); graphics.fillRect(6, 12, 12, 12);
    graphics.fillStyle(0x3e4d3e); graphics.fillRect(6, 8, 12, 6);
    graphics.fillStyle(0x000000); graphics.fillRect(7, 9, 10, 4);
    graphics.fillStyle(0x1a1a1a); graphics.fillRect(6, 0, 12, 8);
    graphics.fillStyle(0x333333); graphics.fillRect(6, 1, 12, 2);
    graphics.fillStyle(0xffdbac); graphics.fillRect(7, 6, 10, 3);
    graphics.fillStyle(0xff0000); graphics.fillRect(8, 7, 2, 2); graphics.fillRect(12, 7, 2, 2);
    graphics.fillStyle(0x000000); graphics.fillRect(16, 12, 8, 4);
    graphics.fillStyle(0x555555); graphics.fillRect(20, 12, 4, 1);
    graphics.generateTexture('enemy', 24, 24);
    graphics.clear();

    // Player Bullets (v0.2 brick design - red outer, yellow core)
    graphics.fillStyle(0xff0000); graphics.fillRect(0, 0, 14, 6); // Red outer layer
    graphics.fillStyle(0xffff00); graphics.fillRect(2, 1, 10, 4); // Yellow core
    graphics.generateTexture('bullet', 14, 6);
    graphics.clear();

    // Enemy Bullet (Red/Energy look)
    graphics.fillStyle(0xaa0000); graphics.fillCircle(4, 4, 4);
    graphics.fillStyle(0xff0000); graphics.fillCircle(4, 4, 2);
    graphics.generateTexture('enemy_bullet', 8, 8);
    graphics.clear();

    // Mega Bullet (3 blocks tall = 72px)
    graphics.fillStyle(0xff0000); graphics.fillRect(0, 0, 32, 72);
    graphics.fillStyle(0xffffff); graphics.fillRect(4, 4, 24, 64);
    graphics.fillStyle(0xffff00); graphics.fillRect(8, 8, 16, 56);
    graphics.generateTexture('mega_bullet', 32, 72);
    graphics.clear();

    // Blocks (Detailed dirt/grass)
    graphics.fillStyle(0x8B4513); graphics.fillRect(0, 0, 24, 24);
    graphics.fillStyle(0x654321); // Noise
    for (let i = 0; i < 8; i++) graphics.fillRect(Math.random() * 20, Math.random() * 20 + 4, 2, 2);
    graphics.fillStyle(0x228B22); graphics.fillRect(0, 0, 24, 6); // Grass top
    graphics.fillStyle(0x006400); graphics.fillRect(2, 0, 4, 2); graphics.fillRect(10, 0, 6, 2); graphics.fillRect(18, 0, 2, 2);
    graphics.generateTexture('block', 24, 24);
    graphics.clear();

    // Bedrock (undestroyable)
    graphics.fillStyle(0x222222); graphics.fillRect(0, 0, 24, 24);
    graphics.fillStyle(0x000000); graphics.fillRect(0, 0, 24, 2); graphics.fillRect(0, 0, 2, 24);
    graphics.fillStyle(0x444444); graphics.fillRect(22, 0, 2, 24); graphics.fillRect(0, 22, 2, 24);
    graphics.generateTexture('bedrock', 24, 24);
    graphics.clear();

    // Stone
    graphics.fillStyle(0x444444); graphics.fillRect(0, 0, 24, 24);
    graphics.fillStyle(0x666666); graphics.fillRect(2, 2, 20, 20);
    graphics.fillStyle(0x222222); graphics.fillRect(4, 4, 16, 16);
    graphics.generateTexture('stone', 24, 24);
    graphics.clear();

    // Explosive Barrel
    graphics.fillStyle(0x8B0000); graphics.fillRect(4, 4, 16, 20); // Main barrel
    graphics.fillStyle(0xff0000); graphics.fillRect(4, 8, 16, 2); graphics.fillRect(4, 18, 16, 2); // Rings
    graphics.fillStyle(0xffff00); graphics.fillRect(10, 10, 4, 8); // Warning symbol/glare
    graphics.generateTexture('explosive_barrel', 24, 24);
    graphics.clear();

    // Items - Medikit
    graphics.fillStyle(0xffffff); graphics.fillRect(0, 0, 24, 24);
    graphics.fillStyle(0xff0000); graphics.fillRect(10, 4, 4, 16); graphics.fillRect(4, 10, 16, 4);
    graphics.generateTexture('medikit', 24, 24);
    graphics.clear();

    // Special Ammo (+2) - Updated design with better contrast
    graphics.fillStyle(0x222222); graphics.fillRect(0, 0, 24, 24); // Dark BG
    // Cartridge 1
    graphics.fillStyle(0xffaa00); graphics.fillRect(4, 6, 6, 14); // Orange Casing
    graphics.fillStyle(0x888888); graphics.fillRect(4, 4, 6, 2); // Tip
    // Cartridge 2
    graphics.fillStyle(0xffaa00); graphics.fillRect(14, 6, 6, 14); // Orange Casing
    graphics.fillStyle(0x888888); graphics.fillRect(14, 4, 6, 2); // Tip
    // Highlight
    graphics.fillStyle(0xffff00); graphics.fillRect(6, 10, 2, 6); graphics.fillRect(16, 10, 2, 6);
    graphics.generateTexture('special_crate', 24, 24);
    graphics.clear();

    // Boss - Detailed
    // Main Body
    graphics.fillStyle(0x111111); graphics.fillRect(0, 0, 56, 56);
    graphics.fillStyle(0x555555); graphics.fillRect(4, 4, 48, 48); // Armor
    // Eyes
    graphics.fillStyle(0x000000); graphics.fillRect(10, 10, 36, 12); // Visor
    graphics.fillStyle(0xff0000); graphics.fillRect(14, 14, 8, 4); graphics.fillRect(34, 14, 8, 4); // Glowing eyes
    // Weapon Arms
    graphics.fillStyle(0x222222); graphics.fillRect(-8, 20, 12, 24); graphics.fillRect(52, 20, 12, 24);
    graphics.fillStyle(0xaa0000); graphics.fillRect(-8, 40, 12, 8); graphics.fillRect(52, 40, 12, 8); // Gun tips
    // Details
    graphics.fillStyle(0xaaaaaa); graphics.fillRect(20, 30, 16, 16); // Core
    graphics.fillStyle(0x00ffff); graphics.fillCircle(28, 38, 4); // Core light
    graphics.generateTexture('boss', 56, 56); // Slightly bigger
    graphics.clear();
}

function showStartScreen(scene) {
    scene.children.removeAll();

    // Background overlay (Matches game sky)
    scene.add.rectangle(200, 112, 400, 225, 0x2c3e50, 1.0);

    scene.add.text(200, 50, 'PIXELBROS', {
        fontSize: '40px',
        fill: '#00ffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
        shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
    }).setOrigin(0.5);

    let startBtn = scene.add.text(200, 110, 'START GAME', {
        fontSize: '20px',
        fill: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive();

    let optionsBtn = scene.add.text(200, 150, 'OPTIONS', {
        fontSize: '20px',
        fill: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive();

    // Hover effects
    [startBtn, optionsBtn].forEach(btn => {
        btn.on('pointerover', () => btn.setStyle({ fill: '#ffff00', backgroundColor: '#555555' }));
        btn.on('pointerout', () => btn.setStyle({ fill: '#ffffff', backgroundColor: '#333333' }));
    });

    startBtn.on('pointerdown', () => { currentLevelIndex = 0; initLevel(scene); });
    optionsBtn.on('pointerdown', () => showOptions(scene));
}

function showOptions(scene) {
    scene.children.removeAll();
    scene.add.rectangle(200, 112, 400, 225, 0x2c3e50, 1.0);

    scene.add.text(200, 30, 'OPTIONS', { fontSize: '24px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    let y = 70;
    const createBtn = (text, callback) => {
        let btn = scene.add.text(200, y, text, { fontSize: '16px', fill: '#fff' }).setOrigin(0.5).setInteractive();
        btn.on('pointerover', () => btn.setColor('#ffff00'));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        btn.on('pointerdown', callback);
        y += 30;
        return btn;
    };

    let soundBtn = createBtn(`Sound: ${soundEnabled ? 'ON' : 'OFF'}`, () => {
        soundEnabled = !soundEnabled;
        soundBtn.setText(`Sound: ${soundEnabled ? 'ON' : 'OFF'}`);
    });

    createBtn(`Difficulty: ${difficulty}`, () => showDifficultySelect(scene));
    createBtn('Keybinds', () => showKeybinds(scene));

    let backBtn = scene.add.text(200, 180, 'BACK', { fontSize: '16px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
    backBtn.on('pointerover', () => backBtn.setColor('#ffaaaa'));
    backBtn.on('pointerout', () => backBtn.setColor('#ff0000'));
    backBtn.on('pointerdown', () => showStartScreen(scene));
}

function showDifficultySelect(scene) {
    scene.children.removeAll();
    scene.add.text(200, 40, 'SELECT DIFFICULTY', { fontSize: '20px', fill: '#fff' }).setOrigin(0.5);
    ['Easy', 'Normal', 'Hard', 'Impossible'].forEach((mode, i) => {
        scene.add.text(200, 75 + i * 25, mode, { fontSize: '14px', fill: (difficulty === mode ? '#f00' : '#fff') }).setOrigin(0.5).setInteractive().on('pointerdown', () => { difficulty = mode; showOptions(scene); });
    });
}

function showKeybinds(scene) {
    scene.children.removeAll();
    scene.add.rectangle(200, 112, 400, 225, 0x2c3e50, 1.0);

    scene.add.text(200, 25, 'KEYBINDS', { fontSize: '24px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    let y = 60;
    Object.keys(keybinds).forEach(action => {
        let keyName = Phaser.Input.Keyboard.KeyCodes[keybinds[action]];
        // Find human readable name
        for (let k in Phaser.Input.Keyboard.KeyCodes) {
            if (Phaser.Input.Keyboard.KeyCodes[k] === keybinds[action]) {
                keyName = k; break;
            }
        }
        let btn = scene.add.text(200, y, `${action}: ${keyName}`, { fontSize: '14px', fill: '#fff' }).setOrigin(0.5).setInteractive();

        btn.on('pointerover', () => btn.setColor('#ffff00'));
        btn.on('pointerout', () => btn.setColor('#ffffff'));

        btn.on('pointerdown', () => {
            btn.setText(`Press key for ${action}...`).setColor('#00ff00');
            scene.input.keyboard.once('keydown', (event) => {
                keybinds[action] = event.keyCode;
                showKeybinds(scene); // Refresh to show new key
            });
        });
        y += 20;
    });

    let resetBtn = scene.add.text(120, 200, 'RESET DEFAULT', { fontSize: '14px', fill: '#ff00ff', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
    resetBtn.on('pointerover', () => resetBtn.setColor('#ffaaaa'));
    resetBtn.on('pointerout', () => resetBtn.setColor('#ff00ff'));
    resetBtn.on('pointerdown', () => {
        keybinds = { ...DEFAULT_KEYBINDS };
        showKeybinds(scene);
    });

    let backBtn = scene.add.text(280, 200, 'BACK', { fontSize: '14px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffff00'));
    backBtn.on('pointerdown', () => showOptions(scene));
}

function initLevel(scene) {
    // CRITICAL: Fully clear existing physics and objects
    if (player) { player.destroy(); player = null; }
    if (enemies) { enemies.clear(true, true); }
    if (platforms) { platforms.clear(true, true); }
    if (scene.medikits) { scene.medikits.clear(true, true); }
    if (scene.specialCrates) { scene.specialCrates.clear(true, true); }
    if (scene.enemyBullets) { scene.enemyBullets.clear(true, true); }
    if (scene.explosions) { scene.explosions.clear(true, true); }
    if (scene.barrels) { scene.barrels.clear(true, true); }
    if (scene.boss) { scene.boss.destroy(); scene.boss = null; }

    // Clear all existing colliders/overlaps to prevent reference errors
    scene.physics.world.colliders.destroy();

    gameState = 'PLAYING';
    const levelData = LEVELS[currentLevelIndex] || LEVELS[0];
    const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS['Easy'];
    localStorage.setItem('pixelBroLevel', currentLevelIndex);

    platforms = scene.physics.add.staticGroup();
    scene.medikits = scene.physics.add.staticGroup();
    scene.specialCrates = scene.physics.add.staticGroup();
    scene.barrels = scene.physics.add.group({
        immovable: true,
        allowGravity: false
    }); // Explosive barrels are dynamic sprites
    scene.medikits.setDepth(5);
    scene.specialCrates.setDepth(5);
    scene.explosions = scene.physics.add.group();

    // STRICT 24px GRID HELPER
    const getY = (row) => 213 - row * 24;

    // GROUND Generation (More realistic)
    for (let i = 0; i < levelData.length / 24; i++) {
        // Bedrock base
        platforms.create(i * 24 + 12, getY(0), 'bedrock');
        platforms.create(i * 24 + 12, getY(-1), 'bedrock');

        // Continuous Ground Layer (Row 1) - slight variations, chance of gap ("bomb crater" look, but rare)
        if (Math.random() > 0.05) {
            platforms.create(i * 24 + 12, getY(1), 'block');
        } else {
            // Gap/Pit
        }
    }

    // Structures
    levelData.structures.forEach(s => {
        let gx = Math.floor(s.x / 24) * 24;
        if (s.type === 'bunker') spawnStoneMedikitStructure(scene, gx, getY(2) - 12);
        else if (s.type === 'special_bunker') spawnStoneSpecialStructure(scene, gx, getY(2) - 12);
        else if (s.type === 'barrel_cluster') spawnBarrelCluster(scene, gx, getY(2) - 12);
    });

    // Random platforms (Less "bombed", more coherent hills/platforms)
    // We create clusters instead of single blocks
    for (let i = 0; i < 8; i++) {
        let gx = Phaser.Math.Between(10, (levelData.length / 24) - 10);
        let gy = Phaser.Math.Between(2, 5); // Higher
        let width = Phaser.Math.Between(2, 5);

        for (let w = 0; w < width; w++) {
            platforms.create((gx + w) * 24 + 12, getY(gy), 'block');
        }
    }

    player = new Player(scene, 48, 140, difficulty);
    enemies = scene.physics.add.group();

    // Bug Fix #4: Safe Enemy Spawn Positions
    for (let i = 0; i < settings.enemyCount; i++) {
        let spawned = false;
        let attempts = 0;

        while (!spawned && attempts < 50) {
            let ex = Phaser.Math.Between(600, levelData.length - 800);
            let ey = 0;

            // Find ground and check clearance
            let groundFound = false;
            for (let row = 1; row < 7; row++) {
                let ty = getY(row);
                let hasGround = false;
                platforms.getChildren().forEach(p => {
                    if (Math.abs(p.x - ex) < 12 && Math.abs(p.y - ty) < 12) hasGround = true;
                });
                if (hasGround) {
                    ey = ty - 24;
                    groundFound = true;
                    break;
                }
            }

            if (groundFound) {
                // Check horizontal 84px space on both sides
                let hSpaceSafe = true;
                platforms.getChildren().forEach(p => {
                    if (Math.abs(p.y - ey) < 20) { // Same floor level
                        if (Math.abs(p.x - ex) < 96) hSpaceSafe = false; // 84px + buffer
                    }
                });

                // Check vertical 48px clearance above
                let vSpaceSafe = true;
                platforms.getChildren().forEach(p => {
                    if (Math.abs(p.x - ex) < 24 && p.y < ey && p.y > ey - 60) vSpaceSafe = false;
                });

                if (hSpaceSafe && vSpaceSafe) {
                    enemies.add(new Enemy(scene, ex, ey, difficulty));
                    spawned = true;
                }
            }
            attempts++;
        }
    }

    // Bug Fix #3: Exactly 7 TNT Barrels, No Clustering
    const totalBarrels = 7;
    const bossAreaBarrels = 2;
    const levelBarrels = 5;

    const spawnBarrels = (count, startX, endX, minDistH, minDistV) => {
        for (let i = 0; i < count; i++) {
            let spawned = false;
            let attempts = 0;
            while (!spawned && attempts < 50) {
                let bx = Phaser.Math.Between(startX, endX);
                let by = -1;
                for (let row = 1; row < 6; row++) {
                    let ty = getY(row);
                    let hasGround = false;
                    platforms.getChildren().forEach(p => { if (Math.abs(p.x - bx) < 12 && Math.abs(p.y - ty) < 12) hasGround = true; });
                    if (hasGround) { by = ty - 24; break; }
                }
                if (by === -1) by = getY(1) - 24;

                let safeSpot = true;
                // Check other barrels
                scene.barrels.getChildren().forEach(b => {
                    if (Math.abs(b.x - bx) < minDistH && Math.abs(b.y - by) < minDistV) safeSpot = false;
                });
                // Check player start
                if (Phaser.Math.Distance.Between(bx, by, 48, 140) < 200) safeSpot = false;
                // Check platforms collision
                platforms.getChildren().forEach(p => {
                    if (Math.abs(p.x - bx) < 20 && Math.abs(p.y - by) < 20) safeSpot = false;
                });

                if (safeSpot) {
                    scene.barrels.add(new ExplosiveBarrel(scene, bx, by));
                    spawned = true;
                }
                attempts++;
            }
        }
    };

    spawnBarrels(levelBarrels, 400, levelData.length - 800, 240, 120);
    spawnBarrels(bossAreaBarrels, levelData.length - 750, levelData.length - 300, 150, 100);

    // Physics Collisions
    scene.physics.add.collider(player, platforms);
    scene.physics.add.collider(enemies, platforms);
    // Barrels are now solid blocks too
    scene.physics.add.collider(player, scene.barrels);
    scene.physics.add.collider(enemies, scene.barrels);
    scene.physics.add.collider(scene.barrels, platforms);

    if (difficulty === 'Impossible') scene.physics.world.setFPS(120);

    // Bullet Groups
    scene.enemyBullets = scene.physics.add.group();

    // 1. Barrels (Priority for ignition)
    // Use overlap instead of collider for bullets vs barrels to ensure ignition on bedrock
    scene.physics.add.overlap(player.bullets, scene.barrels, (b, barrel) => {
        if (!b.active || !barrel.active) return;
        b.destroy();
        if (barrel.takeDamage) barrel.takeDamage(10, 'player');
    });
    scene.physics.add.overlap(scene.enemyBullets, scene.barrels, (b, barrel) => {
        if (!b.active || !barrel.active) return;
        b.destroy();
        if (barrel.takeDamage) barrel.takeDamage(10, 'enemy');
    });

    // 2. Platforms
    scene.physics.add.collider(player.bullets, platforms, (b, block) => { b.destroy(); handleBlockHit(scene, block); });
    scene.physics.add.collider(scene.enemyBullets, platforms, (b, block) => { b.destroy(); handleBlockHit(scene, block); });

    // 3. Enemies
    scene.physics.add.overlap(player.bullets, enemies, (b, e) => { e.takeDamage(30); b.destroy(); });

    // 4. Player (Enemy Bullets)
    scene.physics.add.overlap(scene.enemyBullets, player, (arg1, arg2) => {
        let p = (arg1 instanceof Player) ? arg1 : arg2;
        let bullet = (p === arg1) ? arg2 : arg1;
        if (!p || !p.active || !bullet || !bullet.active) return;
        if (typeof p.takeDamage === 'function') p.takeDamage(12);
        bullet.destroy();
    });

    // Explosions


    scene.cameras.main.startFollow(player, true, 0.2, 0.2);
    scene.cameras.main.setBounds(0, 0, levelData.length, 225);
    scene.physics.world.setBounds(0, 0, levelData.length, 225);
    scene.bossTriggered = false;
}

class ExplosiveBarrel extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'explosive_barrel');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);

        // Bug Fix #2: Unignited barrels are completely immovable
        this.setImmovable(true);
        if (this.body) {
            this.body.allowGravity = false;
            this.body.velocity.set(0, 0);
            if (typeof this.setPushable === 'function') this.setPushable(false);
        }

        this.isTriggered = false;
        this.isExploding = false;
        this.isPendingExplosion = false;

        this.pushStartX = null;
        this.isBeingPushed = false;
        this.maxPushDistance = 72; // 3 blocks
    }

    update() {
        if (!this.active || !this.isTriggered || this.isExploding) return;

        // Bug Fix #2: Ignited Barrel movement logic
        let isTouchingPlayer = this.body.touching.left || this.body.touching.right || this.body.embedded;

        if (isTouchingPlayer) {
            if (!this.isBeingPushed) {
                this.isBeingPushed = true;
                this.pushStartX = this.x;
            }
        } else if (this.isBeingPushed) {
            // Once contact ends, track distance from pushStartX
            let distanceTraveled = Math.abs(this.x - this.pushStartX);

            // Artificial friction/drag
            if (this.body.velocity.x !== 0) {
                this.setVelocityX(this.body.velocity.x * 0.9); // Air resistance feel
            }

            if (distanceTraveled >= this.maxPushDistance || Math.abs(this.body.velocity.x) < 5) {
                this.setVelocityX(0);
                this.isBeingPushed = false;
                this.pushStartX = null;
            }
        }
    }

    takeDamage(amount, type) {
        if (!this.active || this.isExploding) return;

        if (type === 'super') {
            this.explode();
            return;
        }

        if (this.isPendingExplosion) return;
        if (!this.isTriggered) {
            this.isTriggered = true;

            // Bug Fix #2: Ignited state enables physics
            this.setImmovable(false);
            if (this.body) {
                this.body.allowGravity = true;
                if (typeof this.setPushable === 'function') this.setPushable(true);
            }
            this.setDrag(400); // Friction
            this.body.setVelocity(0, 0);

            // Only moveable by player collision - enforced by setting velocity to 0 in update if not touching player
            // But actually Phaser's collider will move it. We just need to stop it if hit by bullets.

            // Blink warning
            this.scene.tweens.add({
                targets: this,
                alpha: 0.2,
                duration: 100,
                yoyo: true,
                repeat: 18 // 2 seconds
            });

            this.scene.time.delayedCall(2000, () => {
                if (this.active && !this.isExploding) this.explode();
            });
        }
    }

    explode() {
        if (!this.active || this.isExploding) return;
        this.isExploding = true;
        this.body.enable = false;
        this.setVisible(false);

        // Remove self safely after effects
        this.scene.time.delayedCall(50, () => { if (this.active) this.destroy(); });

        let enemyBossRadius = 96; // 4 blocks
        let blockBarrelPlayerRadius = 72; // 3 blocks

        // 1. Damage Enemies (4-block radius)
        enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.takeDamage) {
                let dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (dist <= enemyBossRadius) enemy.takeDamage(90);
            }
        });

        // 2. Damage Player (3-block radius) - NO IMMUNITY AT ANY DISTANCE
        if (player && player.active) {
            let dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist <= blockBarrelPlayerRadius) player.takeDamage(90);
        }

        // 3. Damage Boss (4-block radius)
        if (this.scene.boss && this.scene.boss.active) {
            let dist = Phaser.Math.Distance.Between(this.x, this.y, this.scene.boss.x, this.scene.boss.y);
            if (dist <= enemyBossRadius) this.scene.boss.takeDamage(90);
        }

        // 4. Destroy ALL Blocks in 3-block radius - EXCEPT BEDROCK
        platforms.getChildren().forEach(block => {
            if (block.texture.key !== 'bedrock') {
                let dist = Phaser.Math.Distance.Between(this.x, this.y, block.x, block.y);
                if (dist <= blockBarrelPlayerRadius) block.destroy();
            }
        });

        // 5. Chain Reaction (Barrels) - 3-block radius, ignite them
        this.scene.barrels.getChildren().forEach(barrel => {
            if (barrel !== this && barrel.active && !barrel.isExploding && !barrel.isPendingExplosion) {
                let dist = Phaser.Math.Distance.Between(this.x, this.y, barrel.x, barrel.y);
                if (dist <= blockBarrelPlayerRadius) {
                    barrel.isPendingExplosion = true;
                    barrel.takeDamage(100, 'super'); // Trigger instant explosion
                }
            }
        });

        // --- VISUALS ---
        let visual = this.scene.add.circle(this.x, this.y, blockBarrelPlayerRadius, 0xff4400, 0.6);
        let inner = this.scene.add.circle(this.x, this.y, blockBarrelPlayerRadius / 2, 0xffff00, 0.8);

        this.scene.tweens.add({
            targets: [visual, inner],
            scale: 1.5,
            alpha: 0,
            duration: 300,
            onComplete: () => { visual.destroy(); inner.destroy(); }
        });

        this.scene.cameras.main.shake(300, 0.04);
        if (this.scene.sounds && soundEnabled) this.scene.sounds.boss.play();
    }
}

function spawnStoneMedikitStructure(scene, x, y) {
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            let px = x + c * 24 + 12; let py = y - r * 24 + 12;
            if (r === 1 && c === 1) scene.medikits.create(px, py, 'medikit');
            else { let s = platforms.create(px, py, 'stone'); s.hp = 3; }
        }
    }
}

function spawnStoneSpecialStructure(scene, x, y) {
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            let px = x + c * 24 + 12; let py = y - r * 24 + 12;
            if (r === 1 && c === 1) scene.specialCrates.create(px, py, 'special_crate');
            else { let s = platforms.create(px, py, 'stone'); s.hp = 3; }
        }
    }
}

function spawnBarrelCluster(scene, x, y) {
    // A 2x2 cluster of barrels
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            let px = x + c * 24 + 12;
            let py = y - r * 24 + 12;
            scene.barrels.add(new ExplosiveBarrel(scene, px, py));
        }
    }
}

function handleBlockHit(scene, block, damage = 1) {
    if (block.texture.key === 'bedrock') return;
    if (block.texture.key === 'stone') {
        if (block.hp === undefined) block.hp = 3;
        block.hp -= damage;
        if (block.hp <= 0) block.destroy();
        else { block.setTint(0x888888); scene.time.delayedCall(100, () => { if (block.active) block.clearTint(); }); }
    } else block.destroy();
}
