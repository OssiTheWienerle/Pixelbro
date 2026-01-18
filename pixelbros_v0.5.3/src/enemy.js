class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, difficulty) {
        super(scene, x, y, 'enemy');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.difficulty = difficulty;

        const stats = {
            'Easy': { hp: 90, shootRate: 3000, speed: 25 },
            'Normal': { hp: 90, shootRate: 2000, speed: 50 },
            'Hard': { hp: 90, shootRate: 1500, speed: 75 },
            'Impossible': { hp: 90, shootRate: 1000, speed: 100 }
        };

        const currentStats = stats[difficulty] || stats['Easy'];
        this.hp = currentStats.hp;
        this.shootRate = currentStats.shootRate;
        this.speed = currentStats.speed;
        this.lastFired = 0;
        this.loSCheckTimer = Phaser.Math.Between(0, 10); // Offset for staggered LoS checks

        // Patrol properties
        this.spawnX = x;
        this.patrolRange = 84; // 3.5 blocks (3.5 * 24px)
        this.patrolDirection = (Math.random() < 0.5) ? -1 : 1;
        this.isAlerted = false;
        this.alertTimer = null;

        this.firstSeenTime = 0;
    }

    handleAlert() {
        if (!this.isAlerted) {
            this.isAlerted = true;
        }

        // Handle alert duration based on difficulty
        if (this.difficulty === 'Easy' || this.difficulty === 'Normal') {
            if (this.alertTimer) this.alertTimer.remove();

            let duration = (this.difficulty === 'Easy') ? 10000 : 20000;
            this.alertTimer = this.scene.time.delayedCall(duration, () => {
                if (this.active) {
                    this.isAlerted = false;
                    this.alertTimer = null;
                }
            });
        }
        // Hard and Impossible stay aggressive permanently
    }

    update() {
        if (!this || !this.active || !this.scene || !player || !player.active) return;

        this.loSCheckTimer++;

        let dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (dist < 400) {
            // Only check LoS once every 10 frames to save CPU
            if (this.loSCheckTimer % 10 === 0) {
                this.lastCanSee = this.canSeePlayer();
            }

            if (this.lastCanSee) {
                this.isAlerted = true; // Alerted if sees player
                if (this.alertTimer) {
                    this.alertTimer.remove();
                    this.alertTimer = null;
                }

                // If this is the first frame we see the player, or we are resetting
                if (this.firstSeenTime === 0) {
                    this.firstSeenTime = this.scene.time.now;
                }

                // Turn towards player
                if (this.x < player.x) {
                    this.setFlipX(false);
                } else {
                    this.setFlipX(true);
                }

                const reactionTimeLimit = 1000; // 1 second delay
                if (this.scene.time.now > this.firstSeenTime + reactionTimeLimit && this.scene.time.now > this.lastFired) {
                    this.shoot();

                    // Shooting Rate Adjustments
                    let minRate, maxRate;
                    if (this.difficulty === 'Easy') { minRate = 2000; maxRate = 4000; }
                    else if (this.difficulty === 'Normal') { minRate = 1500; maxRate = 3500; }
                    else if (this.difficulty === 'Hard') { minRate = 900; maxRate = 2700; }
                    else { minRate = 750; maxRate = 2400; } // Impossible

                    let delay = Phaser.Math.Between(minRate, maxRate);
                    this.lastFired = this.scene.time.now + delay;
                }
            } else {
                // Reset first seen time if LoS is lost
                this.firstSeenTime = 0;
            }
        } else {
            // Reset first seen time if player is too far
            this.firstSeenTime = 0;
        }

        // Patrol logic if not alerted
        if (!this.isAlerted) {
            this.setVelocityX(this.speed * this.patrolDirection);
            this.setFlipX(this.patrolDirection === 1 ? false : true); // Face direction (assuming original is facing right)

            // Check patrol bounds
            if (this.x > this.spawnX + this.patrolRange) {
                this.patrolDirection = -1;
            } else if (this.x < this.spawnX - this.patrolRange) {
                this.patrolDirection = 1;
            }
        } else {
            this.setVelocityX(0); // Stay at their point when alerted
        }

        this.angle = 0;
    }

    canSeePlayer() {
        if (!this || !this.active || !this.scene || !player || !player.active) return false;

        // Bug Fix #1: Horizontal-only detection
        let distH = Math.abs(player.x - this.x);
        let distV = Math.abs(player.y - this.y);
        let detectionRange = 267; // 2/3 of 400px screen width

        // Vertical tolerance check (±20px)
        if (distV > 20) return false;

        // Range check
        if (distH > detectionRange) return false;

        // Check if player is in front of the enemy (direction they are facing)
        let isFacingRight = !this.flipX;
        let isPlayerToRight = player.x > this.x;

        if (isFacingRight && !isPlayerToRight) return false;
        if (!isFacingRight && isPlayerToRight) return false;

        // Raycast LoS check
        let startX = this.x; let startY = this.y;
        let endX = player.x; let endY = player.y;

        let line = new Phaser.Geom.Line(startX, startY, endX, endY);
        let blocks = platforms.getChildren();

        let minX = Math.min(startX, endX);
        let maxX = Math.max(startX, endX);
        let minY = Math.min(startY, endY);
        let maxY = Math.max(startY, endY);

        for (let block of blocks) {
            let bx = block.x;
            let by = block.y;
            if (bx >= minX - 24 && bx <= maxX + 24 && by >= minY - 24 && by <= maxY + 24) {
                if (Phaser.Geom.Intersects.LineToRectangle(line, block.getBounds())) {
                    return false;
                }
            }
        }
        return true;
    }

    shoot() {
        if (!this.scene.enemyBullets) return;

        if (soundEnabled && this.scene.sounds) this.scene.sounds.enemy.play();

        let bullet = this.scene.enemyBullets.create(this.x, this.y, 'enemy_bullet');
        bullet.body.allowGravity = false;

        let angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.scene.physics.velocityFromRotation(angle, 225, bullet.body.velocity);
        bullet.setRotation(angle);

        // Range 266px. 266/225 = ~1.18s
        this.scene.time.delayedCall(1180, () => { if (bullet.active) bullet.destroy(); });
    }

    takeDamage(amount) {
        if (!this || !this.active) return;
        this.hp -= amount;

        // Alerted: turn towards player and activate aggressive state
        if (player && player.active) {
            this.handleAlert();
            this.setFlipX(player.x < this.x);
        }

        this.setTint(0xffffff);

        if (this.scene && this.scene.time) {
            this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
        }

        // Particles
        if (this.scene && this.scene.particles && typeof this.scene.particles.explode === 'function') {
            this.scene.particles.explode(5, this.x, this.y);
        }

        if (this.hp <= 0) {
            if (this.scene && this.scene.cameras && this.scene.cameras.main) {
                this.scene.cameras.main.shake(200, 0.02);
            }
            this.destroy();
        }
    }
}
