class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, difficulty) {
        super(scene, x, y, 'player');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        // Hitbox width 8px (1/3 of 24px) to allow standing on edges as requested
        this.body.setSize(8, 24);
        this.body.setOffset(8, 0);
        this.difficulty = difficulty;

        // Stats based on difficulty
        const stats = {
            'Easy': { hp: 200, specialCharges: 5 },
            'Normal': { hp: 170, specialCharges: 3 },
            'Hard': { hp: 140, specialCharges: 2 },
            'Impossible': { hp: 90, specialCharges: 1 }
        };

        const currentStats = stats[difficulty] || stats['Easy'];
        this.hp = currentStats.hp;
        this.maxHp = this.hp;
        this.specialCharges = stats[difficulty].specialCharges;

        this.speed = 150;
        this.jumpForce = -350;

        // Controls
        // Use global keybinds
        this.keys = scene.input.keyboard.addKeys({
            up: keybinds.UP,
            left: keybinds.LEFT,
            down: keybinds.DOWN,
            right: keybinds.RIGHT,
            attack: keybinds.ATTACK,
            special: keybinds.SPECIAL,
            melee: keybinds.MELEE,
            heal: keybinds.HEAL
        });

        this.bullets = scene.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 20
        });

        this.lastFired = 0;
        this.lastMelee = 0;
        this.facing = 1; // 1 for right, -1 for left

        // Inventory
        this.medikitCount = 0;

        // UI
        this.hpText = scene.add.text(10, 10, `HP: ${this.hp}`, { fontSize: '12px', fill: '#fff' }).setScrollFactor(0);
        this.specialText = scene.add.text(10, 25, `Specials: ${this.specialCharges}`, { fontSize: '12px', fill: '#fff' }).setScrollFactor(0);
        this.medikitUI = scene.add.text(390, 10, `Meds: 0`, { fontSize: '12px', fill: '#fff' }).setOrigin(1, 0).setScrollFactor(0);

        this.lastOnGroundTime = 0;

        // New Mechanics
        this.shotCount = 0;
        this.isReloading = false;
        this.lastSpecialTime = -6000; // Ready immediately
        this.reloadText = scene.add.text(this.x, this.y - 30, '', { fontSize: '10px', fill: '#ffff00' }).setOrigin(0.5);
    }

    update() {
        if (this.hp <= 0 || gameState === 'GAMEOVER') return;

        // Crouch (S)
        this.isCrouching = this.keys.down.isDown && this.body.touching.down;
        if (this.isCrouching) {
            this.body.setSize(12, 12);
            this.body.setOffset(6, 12);
            this.setScale(1, 0.5); // Pronounced kneel
            this.setVelocityX(this.keys.left.isDown ? -this.speed * 0.5 : (this.keys.right.isDown ? this.speed * 0.5 : 0));
        } else {
            this.body.setSize(12, 24);
            this.body.setOffset(6, 0);
            this.setScale(1, 1);

            // Movement
            if (this.keys.left.isDown) {
                this.setVelocityX(-this.speed);
                this.facing = -1;
                this.setFlipX(true);
                this.angle = -10;
            } else if (this.keys.right.isDown) {
                this.setVelocityX(this.speed);
                this.facing = 1;
                this.setFlipX(false);
                this.angle = 10;
            } else {
                this.setVelocityX(0);
                this.angle = 0;
            }
        }

        if (this.body.touching.down) {
            this.lastOnGroundTime = this.scene.time.now;
        }

        const canJump = this.body.touching.down || (this.scene.time.now - this.lastOnGroundTime < 150);
        if (Phaser.Input.Keyboard.JustDown(this.keys.up) && canJump) {
            this.setVelocityY(this.jumpForce);
            this.lastOnGroundTime = 0; // Prevent mid-air jump immediately after
        }

        // Wall Climbing logic
        // Use touching checks which are more reliable during frame updates
        this.isOnWall = (this.body.blocked.left || this.body.blocked.right || this.body.touching.left || this.body.touching.right) && !this.body.touching.down;

        if (this.isOnWall) {
            // Slide down slower
            if (this.body.velocity.y > 0) {
                this.setVelocityY(50);
            }

            // Wall Climb: Hold direction INTO wall and press W
            if (this.keys.up.isDown) { // W held
                if ((this.body.blocked.left || this.body.touching.left) && this.keys.left.isDown) {
                    this.setVelocityY(-150); // Climb up
                } else if ((this.body.blocked.right || this.body.touching.right) && this.keys.right.isDown) {
                    this.setVelocityY(-150); // Climb up
                }
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
                // Wall Jump kick
                this.setVelocityY(this.jumpForce);
                if (this.body.blocked.left || this.body.touching.left) this.setVelocityX(this.speed);
                if (this.body.blocked.right || this.body.touching.right) this.setVelocityX(-this.speed);
            }
        }

        // Bouncing animation
        if (this.body.velocity.x !== 0 && this.body.touching.down) {
            this.setScale(1, 0.9 + Math.sin(this.scene.time.now / 50) * 0.1);
        } else {
            this.setScale(1, 1);
        }

        // Attack (J) - Disable while crouching
        if (this.keys.attack.isDown && this.scene.time.now > this.lastFired && !this.isCrouching) {
            this.fireBullet();
            this.lastFired = this.scene.time.now + 200;
        }

        // Special (K) - Airstrike
        if (Phaser.Input.Keyboard.JustDown(this.keys.special) && this.specialCharges > 0) {
            this.useSpecial();
        }

        // Melee (L)
        if (Phaser.Input.Keyboard.JustDown(this.keys.melee) && this.scene.time.now > this.lastMelee) {
            this.meleeAttack();
            this.lastMelee = this.scene.time.now + 500;
        }

        // Pickup items (automatic)
        this.checkPickups();

        // Heal (H)
        if (Phaser.Input.Keyboard.JustDown(this.keys.heal)) {
            this.tryHeal();
        }

        // Reload Text Follow
        this.reloadText.setPosition(this.x, this.y - 30);

        // Check if player reached the end
        if (this.x > (LEVELS[currentLevelIndex]?.length - 200 || 1800) && !this.scene.bossTriggered) {
            this.scene.bossTriggered = true;
            spawnBoss(this.scene);
        }
    }

    tryHeal() {
        if (this.medikitCount > 0 && this.hp < this.maxHp) {
            this.medikitCount--;
            this.hp = Math.min(this.maxHp, this.hp + 50);
            this.medikitUI.setText(`Meds: ${this.medikitCount}`);
            if (this.hpText) this.hpText.setText(`HP: ${this.hp}`);
            this.playHealEffect();
        }
    }

    fireBullet() {
        if (this.isReloading) return;

        if (this.scene.sounds && soundEnabled) this.scene.sounds.shoot.play();
        // Shoot lower when crouching
        let spawnY = this.isCrouching ? this.y + 6 : this.y - 6;
        let bullet = this.bullets.get(this.x + (this.facing * 12), spawnY);
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            bullet.body.velocity.x = this.facing * 225; // Even faster
            bullet.body.allowGravity = false;
            this.x -= this.facing * 1;
            // Range 266px. 266/225 = ~1.18s
            this.scene.time.delayedCall(1180, () => { if (bullet.active) bullet.destroy(); });
        }

        // Reload Logic
        this.shotCount++;
        if (this.shotCount >= 20) {
            this.isReloading = true;
            this.reloadText.setText("RELOADING...");
            this.scene.time.delayedCall(2000, () => {
                this.shotCount = 0;
                this.isReloading = false;
                this.reloadText.setText("");
            });
        }
    }

    useSpecial() {
        if (this.specialCharges <= 0) return;
        if (this.scene.time.now < this.lastSpecialTime + 6000) return; // 6s cooldown

        this.lastSpecialTime = this.scene.time.now;
        if (this.scene.sounds && soundEnabled) this.scene.sounds.special.play();
        this.specialCharges--;
        this.specialText.setText(`Specials: ${this.specialCharges}`);

        // Mega Bullet Special Attack
        let mega = this.scene.physics.add.sprite(this.x + (this.facing * 30), this.y, 'mega_bullet');
        mega.body.allowGravity = false;
        mega.setVelocityX(this.facing * 300);
        this.scene.cameras.main.shake(500, 0.03);

        // Mega Bullet Destroys Everything
        this.scene.physics.add.overlap(mega, enemies, (m, enemy) => {
            if (enemy && enemy.active) enemy.takeDamage(150);
        });

        // Destroy Enemy Bullets
        if (this.scene.enemyBullets) {
            this.scene.physics.add.overlap(mega, this.scene.enemyBullets, (m, b) => b.destroy());
        }

        this.scene.physics.add.overlap(mega, platforms, (m, block) => {
            if (block.texture.key !== 'bedrock') {
                block.destroy();
            }
        });

        // Boss Interaction
        if (this.scene.boss) {
            // Destroy boss bullets
            if (this.scene.boss.bullets) {
                this.scene.physics.add.overlap(mega, this.scene.boss.bullets, (m, b) => {
                    if (b && b.active) b.destroy();
                });
            }

            mega.hitBoss = false;
            this.scene.physics.add.overlap(mega, this.scene.boss, (arg1, arg2) => {
                if (!arg1 || !arg2 || !arg1.active || !arg2.active) return;

                // Safe identification using existence check, not assuming texture presence
                let boss = (arg1 === this.scene.boss) ? arg1 : arg2;
                let m = (boss === arg1) ? arg2 : arg1;

                if (boss && boss.active && !m.hitBoss) {
                    m.hitBoss = true; // Mark immediately to prevent recursion/multi-hit
                    if (typeof boss.takeDamage === 'function') {
                        try {
                            boss.takeDamage(150);
                        } catch (err) {
                            console.error("Error damaging boss:", err);
                        }
                    }
                }
            });
        }

        // Range: 65% of Normal Bullet (264px) = ~172px. Speed 300. Time = 570ms.
        this.scene.time.delayedCall(570, () => { if (mega.active) mega.destroy(); });
    }

    createExplosion(x, y) {
        let explosion = this.scene.explosions.create(x, y, null);
        explosion.setVisible(false);
        explosion.setCircle(32);
        explosion.body.allowGravity = false;

        let visual = this.scene.add.circle(x, y, 16, 0xffa500, 0.8);
        this.scene.cameras.main.shake(200, 0.02);

        this.scene.tweens.add({
            targets: visual,
            scale: 2,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                visual.destroy();
                explosion.destroy();
            }
        });
    }

    checkPickups() {
        // Medikits
        if (this.scene.medikits) {
            let kits = this.scene.medikits.getChildren();
            let playerBounds = this.getBounds();
            for (let kit of kits) {
                let kitBounds = kit.getBounds();
                // "Lightly smaller than a block" -> Shrink bounds by 4px each side
                Phaser.Geom.Rectangle.Inflate(kitBounds, -8, -8);

                if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, kitBounds)) {
                    if (this.medikitCount < 2) {
                        this.medikitCount++;
                        this.medikitUI.setText(`Meds: ${this.medikitCount}`);
                        kit.destroy();
                    }
                    return;
                }
            }
        }
        // Ammo
        if (this.scene.specialCrates) {
            let crates = this.scene.specialCrates.getChildren();
            let playerBounds = this.getBounds();
            for (let crate of crates) {
                let crateBounds = crate.getBounds();
                Phaser.Geom.Rectangle.Inflate(crateBounds, -8, -8);

                if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, crateBounds)) {
                    const settings = DIFFICULTY_SETTINGS[this.difficulty];
                    this.specialCharges = Math.min(settings.specialCharges, this.specialCharges + 2);
                    this.specialText.setText(`Specials: ${this.specialCharges}`);
                    crate.destroy();
                    this.playAmmoEffect();
                    return;
                }
            }
        }
    }

    playHealEffect() {
        let flash = this.scene.add.circle(this.x, this.y, 30, 0x00ff00, 0.5);
        this.scene.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    }

    playAmmoEffect() {
        let flash = this.scene.add.circle(this.x, this.y, 30, 0x0000ff, 0.5);
        this.scene.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    }

    meleeAttack() {
        let meleeRange = this.scene.add.rectangle(this.x + (this.facing * 15), this.y, 20, 20, 0xffffff, 0.3);
        this.scene.physics.add.existing(meleeRange);
        meleeRange.body.allowGravity = false;

        this.scene.physics.add.overlap(meleeRange, enemies, (m, enemy) => {
            enemy.takeDamage(60);
        });

        this.scene.time.delayedCall(100, () => meleeRange.destroy());
    }

    takeDamage(amount) {
        if (!this || !this.active || this.hp <= 0 || !this.scene) return;

        this.hp -= amount;
        console.log(`Player took ${amount} damage. Current HP: ${this.hp}`);

        // Update UI safely
        if (this.hpText && this.hpText.scene && this.hpText.active) {
            try {
                this.hpText.setText(`HP: ${Math.max(0, this.hp)}`);
            } catch (e) { console.warn("Could not update HP text", e); }
        }

        // Shake camera safely
        if (this.scene && this.scene.cameras && this.scene.cameras.main) {
            try {
                const cam = this.scene.cameras.main;
                if (cam) cam.shake(100, 0.01);
            } catch (e) { console.warn("Could not shake camera", e); }
        }

        if (this.hp <= 0) {
            console.log("Player HP reached 0. Dying...");
            this.die();
        }
    }

    destroy() {
        if (this.hpText) this.hpText.destroy();
        if (this.specialText) this.specialText.destroy();
        if (this.medikitUI) this.medikitUI.destroy();
        if (this.reloadText) this.reloadText.destroy();
        super.destroy();
    }

    die() {
        if (gameState === 'GAMEOVER') return;
        this.setTint(0xff0000);
        gameState = 'GAMEOVER';
        if (this.body) this.body.enable = false;

        // Full screen black background
        let bg = this.scene.add.rectangle(200, 112, 400, 225, 0x000000).setScrollFactor(0).setDepth(100);

        // Large Mission Failed text
        let text = this.scene.add.text(200, 112, 'MISSION FAILED', {
            fontSize: '32px',
            fill: '#f00',
            fontStyle: 'bold',
            stroke: '#fff',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        this.scene.time.delayedCall(3000, () => {
            location.reload();
        });
    }
}
