const DIFFICULTY_SETTINGS = {
    'Easy': {
        playerHp: 500, // Massive HP for 100% success
        specialCharges: 5,
        enemyHp: 30,
        enemyCount: 5,
        shootRate: 8000,
        doubleShotChance: 0
    },
    'Normal': {
        playerHp: 200,
        specialCharges: 3,
        enemyHp: 60,
        enemyCount: 10,
        shootRate: 6000,
        doubleShotChance: 0.05
    },
    'Hard': {
        playerHp: 150,
        specialCharges: 2,
        enemyHp: 100,
        enemyCount: 14,
        shootRate: 4000,
        doubleShotChance: 0.15
    },
    'Impossible': {
        playerHp: 100,
        specialCharges: 1,
        enemyHp: 150,
        enemyCount: 20,
        shootRate: 2500,
        doubleShotChance: 0.4
    }
};

const LEVELS = [
    {
        name: "Level 1: The Outskirts",
        length: 6000,
        structures: [
            { x: 900, type: 'barrel_cluster' },
            { x: 1200, type: 'bunker' },
            { x: 1800, type: 'barrel_cluster' },
            { x: 2400, type: 'special_bunker' },
            { x: 3000, type: 'barrel_cluster' },
            { x: 3600, type: 'bunker' },
            { x: 4500, type: 'barrel_cluster' }
        ]
    },
    {
        name: "Level 2: The Fortress",
        length: 9000,
        bossStats: {
            'Easy': { hp: 1000, shootRate: 4000 },
            'Normal': { hp: 1200, shootRate: 3000 },
            'Hard': { hp: 1500, shootRate: 2000 },
            'Impossible': { hp: 2000, shootRate: 1000 }
        },
        structures: [
            { x: 1200, type: 'barrel_cluster' },
            { x: 1500, type: 'bunker' },
            { x: 2400, type: 'barrel_cluster' },
            { x: 3000, type: 'bunker' },
            { x: 3900, type: 'barrel_cluster' },
            { x: 4500, type: 'bunker' },
            { x: 5400, type: 'barrel_cluster' },
            { x: 6000, type: 'bunker' },
            { x: 6900, type: 'barrel_cluster' }
        ]
    }
];
