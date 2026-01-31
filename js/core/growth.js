/**
 * 生长函数
 * 生长函数 G 决定了细胞的生死规则
 * 输出范围 [-1, 1]，正值表示生长，负值表示死亡
 */

/**
 * 标准高斯生长函数
 * G(u) = 2 * exp(-((u-μ)²)/(2σ²)) - 1
 * @param {number} u - 邻域密度 (卷积结果)
 * @param {number} mu - 最优密度
 * @param {number} sigma - 容忍度
 * @returns {number} 生长率 [-1, 1]
 */
export function gaussianGrowth(u, mu, sigma) {
    return 2 * Math.exp(-((u - mu) ** 2) / (2 * sigma ** 2)) - 1;
}

/**
 * 多峰生长函数（高级）
 */
export function multiPeakGrowth(u, peaks) {
    let maxGrowth = -1;
    for (const peak of peaks) {
        const g = 2 * Math.exp(-((u - peak.mu) ** 2) / (2 * peak.sigma ** 2)) - 1;
        maxGrowth = Math.max(maxGrowth, g * (peak.weight || 1));
    }
    return maxGrowth;
}

/**
 * 阶梯生长函数（类 Game of Life）
 */
export function stepGrowth(u, birthLow, birthHigh, survivalLow, survivalHigh) {
    if (u >= birthLow && u <= birthHigh) return 1;
    if (u >= survivalLow && u <= survivalHigh) return 0;
    return -1;
}

/**
 * 创建生长函数表（用于快速查找）
 * @param {number} mu - 最优密度
 * @param {number} sigma - 容忍度
 * @param {number} resolution - 表分辨率
 * @returns {Float64Array} 生长函数查找表
 */
export function createGrowthTable(mu, sigma, resolution = 1024) {
    const table = new Float64Array(resolution);
    for (let i = 0; i < resolution; i++) {
        const u = i / (resolution - 1);  // 0 到 1
        table[i] = gaussianGrowth(u, mu, sigma);
    }
    return table;
}

/**
 * 使用查找表获取生长值
 */
export function lookupGrowth(table, u) {
    const resolution = table.length;
    const index = Math.min(Math.max(Math.floor(u * (resolution - 1)), 0), resolution - 1);
    return table[index];
}

/**
 * 应用生长函数到整个网格
 * @param {Float64Array} potential - 卷积后的势能场
 * @param {Float64Array} state - 当前状态
 * @param {Float64Array} output - 输出状态
 * @param {number} mu - 生长函数均值
 * @param {number} sigma - 生长函数标准差
 * @param {number} dt - 时间步长
 */
export function applyGrowth(potential, state, output, mu, sigma, dt) {
    const n = potential.length;
    for (let i = 0; i < n; i++) {
        const growth = gaussianGrowth(potential[i], mu, sigma);
        output[i] = Math.min(1, Math.max(0, state[i] + dt * growth));
    }
}

/**
 * 使用查找表应用生长函数（更快）
 */
export function applyGrowthWithTable(potential, state, output, growthTable, dt) {
    const n = potential.length;
    const resolution = growthTable.length;

    for (let i = 0; i < n; i++) {
        const u = potential[i];
        const index = Math.min(Math.max(Math.floor(u * (resolution - 1)), 0), resolution - 1);
        const growth = growthTable[index];
        output[i] = Math.min(1, Math.max(0, state[i] + dt * growth));
    }
}
