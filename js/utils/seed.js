/**
 * 种子系统
 * 可复现的伪随机数生成器
 */

/**
 * Mulberry32 PRNG
 * 快速、质量好的 32 位 PRNG
 */
export function createRng(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 生成新种子
 */
export function generateSeed() {
    return Math.floor(Math.random() * 0xFFFF);
}

/**
 * 使用种子生成图案
 * @param {number} size - 网格大小
 * @param {number} seed - 种子
 * @param {Object} options - 选项
 * @returns {Float64Array} 状态数组
 */
export function generatePatternFromSeed(size, seed, options = {}) {
    const {
        density = 0.3,
        radius = 0.25,
        smooth = true,
        centerX = 0.5,
        centerY = 0.5
    } = options;

    const rng = createRng(seed);
    const state = new Float64Array(size * size);

    const cx = centerX * size;
    const cy = centerY * size;
    const r = radius * size;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < r) {
                // 在半径内按概率填充
                if (rng() < density) {
                    if (smooth) {
                        // 平滑边缘
                        const edgeFactor = 1 - Math.pow(dist / r, 2);
                        state[y * size + x] = edgeFactor * (0.5 + rng() * 0.5);
                    } else {
                        state[y * size + x] = rng();
                    }
                }
            }
        }
    }

    return state;
}

/**
 * 使用种子生成多斑块图案
 */
export function generateMultiBlobPattern(size, seed, blobCount = 3) {
    const rng = createRng(seed);
    const state = new Float64Array(size * size);

    for (let b = 0; b < blobCount; b++) {
        const cx = 0.2 + rng() * 0.6;
        const cy = 0.2 + rng() * 0.6;
        const radius = 0.1 + rng() * 0.15;
        const density = 0.3 + rng() * 0.4;

        const blob = generatePatternFromSeed(size, seed + b * 1000, {
            density,
            radius,
            centerX: cx,
            centerY: cy,
            smooth: true
        });

        // 叠加
        for (let i = 0; i < state.length; i++) {
            state[i] = Math.min(1, state[i] + blob[i]);
        }
    }

    return state;
}

/**
 * 种子转可读字符串 (用于显示)
 */
export function seedToString(seed) {
    return seed.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * 字符串转种子
 */
export function stringToSeed(str) {
    const parsed = parseInt(str, 16);
    return isNaN(parsed) ? generateSeed() : parsed & 0xFFFF;
}
