/**
 * 挑战关卡定义
 */

export const CHALLENGE_TYPES = {
    TUTORIAL: 'tutorial',
    REACH_TARGET: 'reach_target',
    SURVIVAL: 'survival',
    PARAMETER_TUNE: 'parameter_tune',
    MAZE: 'maze'
};

/**
 * 挑战关卡数据
 */
export const CHALLENGES = [
    // === 教程关卡 ===
    {
        id: 'tutorial_1',
        type: CHALLENGE_TYPES.TUTORIAL,
        name: 'Welcome to Lenia',
        description: 'Learn the basics: Click PLAY to start the simulation.',
        objectives: [
            { type: 'action', action: 'play', description: 'Press the PLAY button' }
        ],
        hints: ['The PLAY button is at the bottom of the screen'],
        locked: false,
        nextChallenge: 'tutorial_2'
    },
    {
        id: 'tutorial_2',
        type: CHALLENGE_TYPES.TUTORIAL,
        name: 'Drawing Life',
        description: 'Use the brush tool to draw some cells on the canvas.',
        objectives: [
            { type: 'draw', minCells: 100, description: 'Draw at least 100 cells' }
        ],
        hints: ['Select the BRUSH tool and draw on the canvas', 'Hold mouse button to draw continuously'],
        locked: true,
        requires: ['tutorial_1'],
        nextChallenge: 'tutorial_3'
    },
    {
        id: 'tutorial_3',
        type: CHALLENGE_TYPES.TUTORIAL,
        name: 'Meet Orbium',
        description: 'Place an Orbium creature and watch it move!',
        objectives: [
            { type: 'place_preset', preset: 'orbium', description: 'Place an Orbium' },
            { type: 'observe', steps: 100, description: 'Watch it for 100 steps' }
        ],
        hints: ['Select Orbium from the PRESETS panel', 'Click on the canvas to place it'],
        locked: true,
        requires: ['tutorial_2'],
        nextChallenge: 'tutorial_4'
    },
    {
        id: 'tutorial_4',
        type: CHALLENGE_TYPES.TUTORIAL,
        name: 'Adjusting Parameters',
        description: 'Learn how parameters affect the simulation.',
        objectives: [
            { type: 'adjust_param', param: 'mu', description: 'Adjust the μ parameter' },
            { type: 'adjust_param', param: 'sigma', description: 'Adjust the σ parameter' }
        ],
        hints: ['Parameters are on the right panel', 'Try small adjustments to see effects'],
        locked: true,
        requires: ['tutorial_3'],
        nextChallenge: 'reach_1'
    },

    // === 到达目标关卡 ===
    {
        id: 'reach_1',
        type: CHALLENGE_TYPES.REACH_TARGET,
        name: 'First Journey',
        description: 'Guide an Orbium to reach the target zone.',
        gridSize: 256,
        startPosition: { x: 64, y: 128 },
        targetZone: { x: 192, y: 128, radius: 20 },
        preset: 'orbium',
        timeLimit: 500,
        objectives: [
            { type: 'reach_target', description: 'Reach the green target zone' }
        ],
        hints: ['Orbium moves in a specific direction', 'Place it facing the target'],
        locked: true,
        requires: ['tutorial_4'],
        nextChallenge: 'reach_2',
        scoring: {
            time: { max: 500, perfect: 200 },
            bonus: { noParameterChange: 100 }
        }
    },
    {
        id: 'reach_2',
        type: CHALLENGE_TYPES.REACH_TARGET,
        name: 'Around the Corner',
        description: 'The target is not straight ahead...',
        gridSize: 256,
        startPosition: { x: 64, y: 64 },
        targetZone: { x: 192, y: 192, radius: 20 },
        preset: 'orbium',
        timeLimit: 800,
        objectives: [
            { type: 'reach_target', description: 'Reach the target zone' }
        ],
        hints: ['You might need to adjust parameters', 'Try changing the μ value slightly'],
        locked: true,
        requires: ['reach_1'],
        nextChallenge: 'survival_1'
    },

    // === 存活挑战 ===
    {
        id: 'survival_1',
        type: CHALLENGE_TYPES.SURVIVAL,
        name: 'Stay Alive',
        description: 'Keep the organism alive for 1000 steps.',
        gridSize: 256,
        preset: 'simple',
        survivalTime: 1000,
        minMass: 10,
        objectives: [
            { type: 'survive', steps: 1000, description: 'Survive for 1000 steps' }
        ],
        hints: ['The simple blob is unstable', 'Find parameters that keep it alive'],
        locked: true,
        requires: ['reach_2'],
        nextChallenge: 'survival_2',
        allowParameterChange: true
    },
    {
        id: 'survival_2',
        type: CHALLENGE_TYPES.SURVIVAL,
        name: 'Long Life',
        description: 'Keep any organism alive for 2000 steps.',
        gridSize: 256,
        survivalTime: 2000,
        minMass: 10,
        objectives: [
            { type: 'survive', steps: 2000, description: 'Survive for 2000 steps' }
        ],
        hints: ['Try different presets', 'Orbium is naturally stable'],
        locked: true,
        requires: ['survival_1'],
        nextChallenge: 'param_1',
        allowParameterChange: true,
        allowPresetChange: true
    },

    // === 参数调优 ===
    {
        id: 'param_1',
        type: CHALLENGE_TYPES.PARAMETER_TUNE,
        name: 'Parameter Detective',
        description: 'Find the right parameters to stabilize this dying blob.',
        gridSize: 256,
        initialPattern: 'unstable_blob',
        targetParams: { mu: 0.15, sigma: 0.015 },
        tolerance: { mu: 0.02, sigma: 0.005 },
        objectives: [
            { type: 'stabilize', steps: 500, description: 'Stabilize the organism' }
        ],
        hints: ['Start with μ around 0.14-0.16', 'σ should be about 1/10 of μ'],
        locked: true,
        requires: ['survival_2'],
        nextChallenge: 'maze_1'
    },

    // === 迷宫挑战 ===
    {
        id: 'maze_1',
        type: CHALLENGE_TYPES.MAZE,
        name: 'Simple Maze',
        description: 'Navigate through the obstacles to reach the goal.',
        gridSize: 256,
        startPosition: { x: 32, y: 128 },
        targetZone: { x: 224, y: 128, radius: 15 },
        obstacles: [
            { x: 128, y: 64, width: 10, height: 80 },
            { x: 128, y: 176, width: 10, height: 80 }
        ],
        preset: 'orbium',
        timeLimit: 1000,
        objectives: [
            { type: 'reach_target', description: 'Reach the target' },
            { type: 'avoid_obstacles', description: 'Don\'t touch obstacles' }
        ],
        hints: ['There\'s a gap in the middle', 'Time your placement carefully'],
        locked: true,
        requires: ['param_1'],
        nextChallenge: null
    }
];

/**
 * 获取所有挑战
 */
export function getAllChallenges() {
    return CHALLENGES;
}

/**
 * 获取挑战
 */
export function getChallenge(id) {
    return CHALLENGES.find(c => c.id === id) || null;
}

/**
 * 获取按类型分组的挑战
 */
export function getChallengesByType() {
    const grouped = {};
    for (const challenge of CHALLENGES) {
        if (!grouped[challenge.type]) {
            grouped[challenge.type] = [];
        }
        grouped[challenge.type].push(challenge);
    }
    return grouped;
}

/**
 * 检查挑战是否解锁
 */
export function isChallengeUnlocked(challengeId, completedChallenges) {
    const challenge = getChallenge(challengeId);
    if (!challenge) return false;
    if (!challenge.locked) return true;
    if (!challenge.requires) return true;

    return challenge.requires.every(reqId => completedChallenges.includes(reqId));
}

/**
 * 获取下一个可用挑战
 */
export function getNextAvailableChallenge(completedChallenges) {
    for (const challenge of CHALLENGES) {
        if (!completedChallenges.includes(challenge.id) &&
            isChallengeUnlocked(challenge.id, completedChallenges)) {
            return challenge;
        }
    }
    return null;
}
