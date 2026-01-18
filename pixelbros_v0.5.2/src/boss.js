function spawnBoss(scene) {
    gameState = 'BOSS';
    let bossX = LEVELS[currentLevelIndex]?.length - 200 || 1800;
    let bossY = 100;

    scene.boss = new Boss(scene, bossX, bossY, difficulty);
    scene.physics.add.collider(scene.boss, platforms);

    // Add overlap once
    // Check for player overlap safely
    scene.physics.add.overlap(scene.boss.bullets, player, (arg1, arg2) => {
        let p = (arg1.texture.key === 'player') ? arg1 : arg2;
        let bullet = (p === arg1) ? arg2 : arg1;

        if (!p || !p.active || !bullet || !bullet.active) return;
        if (typeof p.takeDamage === 'function') {
            p.takeDamage(25);
        }
        bullet.destroy();
    });

    // Bullets vs World
    scene.physics.add.collider(scene.boss.bullets, platforms, (bullet, block) => {
        bullet.destroy();
        if (typeof handleBlockHit === 'function') {
            handleBlockHit(scene, block);
        }
    });

    // Player Bullets vs Boss
    scene.physics.add.overlap(player.bullets, scene.boss, (boss, bullet) => {
        if (boss && boss.active && bullet && bullet.active) {
            boss.takeDamage(30); // Player bullet damage
            bullet.destroy();
            boss.setTint(0xff0000);
            scene.time.delayedCall(50, () => { if (boss && boss.active) boss.clearTint(); });
        }
    });

    scene.bossTitle = scene.add.text(bossX, 100, 'FINAL BOSS', { fontSize: '64px', fill: '#f00' }).setOrigin(0.5);
}

class Boss extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, difficulty) {
        super(scene, x, y, 'boss');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.difficulty = difficulty;

        const stats = {
            'Easy': { hp: 1000, shootRate: 4000 },
            'Normal': { hp: 1200, shootRate: 3000 },
            'Hard': { hp: 1500, shootRate: 2000 },
            'Impossible': { hp: 2000, shootRate: 800 }
        };

        const currentStats = stats[difficulty] || stats['Easy'];
        this.hp = currentStats.hp;
        this.maxHp = this.hp;
        this.shootRate = stats[difficulty].shootRate;
        this.lastFired = 0;
        this.phase = 1;

        // Ground slam ability properties
        this.lastSlamTime = 0;
        this.slamTimer = 0;
        this.slamCooldown = 10000; // 10 seconds between slam rolls
        this.isSlamming = false;
        this.slamPhase = 0; // 0: None, 1: Up, 2: Horizontal, 3: Down, 4: Stun
        this.groundY = y;
        this.slamTargetY = Math.max(40, y - 100);

        this.bullets = scene.physics.add.group({
            defaultKey: 'bullet'
        });

        // Health Bar
        this.healthBar = scene.add.graphics().setScrollFactor(0);
        this.updateHealthBar();
    }

    update() {
        if (!this || !this.active || !this.scene) return;

        // Handle slam phases
        if (this.slamPhase === 1) { // Phase 1: Move Up (0.8s)
            let elapsed = this.scene.time.now - this.lastSlamTime;
            if (elapsed < 800) {
                this.setVelocityY(-150);
                this.setVelocityX(0);
            } else {
                this.slamPhase = 2;
                this.lastSlamTime = this.scene.time.now;
                this.phaseDuration = Phaser.Math.Between(500, 1000); // 0.5 - 1s
            }
        } else if (this.slamPhase === 2) { // Phase 2: Move to Player X (0.5-1s)
            let elapsed = this.scene.time.now - this.lastSlamTime;
            if (elapsed < this.phaseDuration) {
                this.setVelocityY(0);
                // Move towards player X
                let speed = 200;
                if (Math.abs(this.x - player.x) > 10) {
                    this.setVelocityX(this.x < player.x ? speed : -speed);
                } else {
                    this.setVelocityX(0);
                }
            } else {
                this.slamPhase = 3;
                this.lastSlamTime = this.scene.time.now;
                this.setVelocityX(0);
            }
        } else if (this.slamPhase === 3) { // Phase 3: Slam Down (0.5s)
            let elapsed = this.scene.time.now - this.lastSlamTime;
            if (elapsed < 500 && this.y < this.groundY) {
                this.setVelocityY(800); // Fast slam
            } else {
                this.setVelocityY(0);
                this.y = this.groundY;
                this.slamPhase = 4;
                this.lastSlamTime = this.scene.time.now;

                // Hit ground effects
                if (player && player.active && Math.abs(player.x - this.x) < 60) {
                    player.takeDamage(60);
                }
                this.scene.cameras.main.shake(400, 0.05);
            }
        } else if (this.slamPhase === 4) { // Phase 4: Stun (2.5s)
            let elapsed = this.scene.time.now - this.lastSlamTime;
            if (elapsed < 2500) {
                this.setVelocityX(0);
                this.setVelocityY(0);
                this.setTint(0xffaa00); // Visual indicator for stun
            } else {
                this.clearTint();
                this.slamPhase = 0;
            }
        } else {
            // Normal boss movement
            this.setVelocityY(Math.sin(this.scene.time.now / 500) * 100);

            if (this.x - player.x > 200) {
                this.setVelocityX(-50);
            } else if (this.x - player.x < 100) {
                this.setVelocityX(50);
            } else {
                this.setVelocityX(0);
            }

            // Shooting with randomized intervals
            if (this.scene.time.now > this.lastFired) {
                this.shoot();
                let randomDelay = Phaser.Math.Between(1000, 5000);
                this.lastFired = this.scene.time.now + randomDelay;
            }

            // Slam trigger logic: Every 10s, 35% chance
            if (this.scene.time.now > this.slamTimer + this.slamCooldown) {
                this.slamTimer = this.scene.time.now;
                if (Math.random() < 0.35) {
                    this.slamPhase = 1;
                    this.lastSlamTime = this.scene.time.now;
                }
            }
        }

        this.updateHealthBar();
    }

    shoot() {
        // Multi-shot
        if (soundEnabled && this.scene.sounds) this.scene.sounds.boss.play();
        for (let i = -1; i <= 1; i++) {
            let bullet = this.bullets.get(this.x, this.y);
            if (!bullet) continue;

            bullet.setActive(true).setVisible(true);
            bullet.setTint(0xff00ff);
            bullet.setScale(2);
            bullet.body.allowGravity = false;

            let angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) + (i * 0.2);
            this.scene.physics.velocityFromRotation(angle, 225, bullet.body.velocity);

            // Range: Player is ~266px. 266/225 = ~1.18s
            this.scene.time.delayedCall(1180, () => { if (bullet.active) bullet.destroy(); });
        }
    }


    updateHealthBar() {
        this.healthBar.clear();
        this.healthBar.fillStyle(0x000000);
        this.healthBar.fillRect(100, 20, 200, 10);
        this.healthBar.fillStyle(0xff0000);
        this.healthBar.fillRect(100, 20, 200 * (this.hp / this.maxHp), 10);
    }

    takeDamage(amount) {
        if (!this || !this.active) return;
        this.hp -= amount;
        this.setTint(0xffffff);

        if (this.scene && this.scene.time) {
            this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        gameState = 'WIN';

        // Fade out boss text
        if (this.scene.bossTitle) {
            this.scene.tweens.add({
                targets: this.scene.bossTitle,
                alpha: 0,
                duration: 1000
            });
        }

        this.scene.add.text(200, 100, 'MISSION ACCOMPLISHED', {
            fontSize: '32px',
            fill: '#0f0',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        // Back to Menu Button
        let menuBtn = this.scene.add.text(200, 160, 'Back to Menu', {
            fontSize: '20px',
            fill: '#fff',
            backgroundColor: '#333'
        }).setOrigin(0.5).setScrollFactor(0).setInteractive();

        menuBtn.on('pointerdown', () => {
            location.reload();
        });

        menuBtn.on('pointerover', () => menuBtn.setStyle({ fill: '#ffff00', backgroundColor: '#555' }));
        menuBtn.on('pointerout', () => menuBtn.setStyle({ fill: '#fff', backgroundColor: '#333' }));

        this.healthBar.clear();
        this.destroy();
    }
}
