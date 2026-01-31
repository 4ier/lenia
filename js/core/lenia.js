/**
 * Lenia 核心引擎
 * 连续细胞自动机模拟器
 *
 * 更新公式: A(t+dt) = clip(A(t) + dt * G(K * A), 0, 1)
 */

import { FFT2D, complexMultiply } from './fft.js';
import { generateKernel, precomputeKernelFFT } from './kernel.js';
import { createGrowthTable, applyGrowthWithTable } from './growth.js';

export class LeniaEngine {
    /**
     * @param {number} size - 网格大小 (必须是 2 的幂)
     * @param {Object} params - Lenia 参数
     */
    constructor(size = 256, params = {}) {
        this.size = size;
        this.totalCells = size * size;

        // 默认参数 (超级宽松模式)
        this.params = {
            R: 8,            // 核半径
            mu: 0.2,         // 生长函数均值 (提高一点)
            sigma: 0.1,      // 生长函数标准差 (超级宽松!)
            dt: 0.05,        // 时间步长 (慢一点)
            kernelMu: 0.5,   // 核峰值位置
            kernelSigma: 0.2, // 核宽度 (宽一点)
            ...params
        };

        // 状态数组
        this.state = new Float64Array(this.totalCells);
        this.nextState = new Float64Array(this.totalCells);

        // FFT 相关数组
        this.fft = new FFT2D(size);
        this.stateReal = new Float64Array(this.totalCells);
        this.stateImag = new Float64Array(this.totalCells);
        this.potentialReal = new Float64Array(this.totalCells);
        this.potentialImag = new Float64Array(this.totalCells);

        // 核函数 FFT
        this.kernelFFT = null;

        // 生长函数查找表
        this.growthTable = null;

        // 统计信息
        this.stats = {
            step: 0,
            mass: 0,
            centerX: 0,
            centerY: 0,
            velocity: 0
        };

        // 历史记录（用于速度计算）
        this.prevCenterX = size / 2;
        this.prevCenterY = size / 2;

        // 初始化核和生长函数
        this.updateKernel();
        this.updateGrowthTable();
    }

    /**
     * 更新核函数
     */
    updateKernel() {
        const kernel = generateKernel(this.size, this.params.R, {
            kernelMu: this.params.kernelMu,
            kernelSigma: this.params.kernelSigma
        });
        this.kernelFFT = precomputeKernelFFT(this.fft, kernel, this.size);
    }

    /**
     * 更新生长函数查找表
     */
    updateGrowthTable() {
        this.growthTable = createGrowthTable(this.params.mu, this.params.sigma, 2048);
    }

    /**
     * 设置参数
     */
    setParams(newParams) {
        const oldR = this.params.R;
        const oldKernelMu = this.params.kernelMu;
        const oldKernelSigma = this.params.kernelSigma;
        const oldMu = this.params.mu;
        const oldSigma = this.params.sigma;

        Object.assign(this.params, newParams);

        // 核参数变化时重新计算核
        if (this.params.R !== oldR ||
            this.params.kernelMu !== oldKernelMu ||
            this.params.kernelSigma !== oldKernelSigma) {
            this.updateKernel();
        }

        // 生长函数参数变化时重新计算查找表
        if (this.params.mu !== oldMu || this.params.sigma !== oldSigma) {
            this.updateGrowthTable();
        }
    }

    /**
     * 获取当前参数
     */
    getParams() {
        return { ...this.params };
    }

    /**
     * 清空状态
     */
    clear() {
        this.state.fill(0);
        this.nextState.fill(0);
        this.stats.step = 0;
        this.stats.mass = 0;
    }

    /**
     * 随机初始化
     */
    randomize(density = 0.3, radius = 0.3) {
        this.clear();
        const center = this.size / 2;
        const r = radius * this.size;

        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < r && Math.random() < density) {
                    this.state[y * this.size + x] = Math.random();
                }
            }
        }
    }

    /**
     * 在指定位置放置图案
     * @param {Float64Array|number[][]} pattern - 图案数据
     * @param {number} x - 中心 X 坐标
     * @param {number} y - 中心 Y 坐标
     * @param {number} scale - 缩放因子
     */
    placePattern(pattern, x, y, scale = 1) {
        let width, height, data;

        if (pattern instanceof Float64Array) {
            // 假设是正方形
            const size = Math.sqrt(pattern.length);
            width = height = size;
            data = pattern;
        } else {
            // 2D 数组
            height = pattern.length;
            width = pattern[0].length;
            data = pattern;
        }

        const scaledWidth = Math.floor(width * scale);
        const scaledHeight = Math.floor(height * scale);
        const startX = Math.floor(x - scaledWidth / 2);
        const startY = Math.floor(y - scaledHeight / 2);

        for (let py = 0; py < scaledHeight; py++) {
            for (let px = 0; px < scaledWidth; px++) {
                const srcX = Math.floor(px / scale);
                const srcY = Math.floor(py / scale);

                let value;
                if (data instanceof Float64Array) {
                    value = data[srcY * width + srcX];
                } else {
                    value = data[srcY][srcX];
                }

                // 周期边界
                const destX = ((startX + px) % this.size + this.size) % this.size;
                const destY = ((startY + py) % this.size + this.size) % this.size;

                // 叠加模式
                const idx = destY * this.size + destX;
                this.state[idx] = Math.min(1, this.state[idx] + value);
            }
        }
    }

    /**
     * 绘制圆形
     */
    drawCircle(x, y, radius, value = 1) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const px = ((x + dx) % this.size + this.size) % this.size;
                    const py = ((y + dy) % this.size + this.size) % this.size;
                    this.state[py * this.size + px] = value;
                }
            }
        }
    }

    /**
     * 执行一步模拟
     */
    step() {
        // 复制状态到实部
        this.stateReal.set(this.state);
        this.stateImag.fill(0);

        // FFT 前向变换
        this.fft.forward(this.stateReal, this.stateImag);

        // 频域卷积
        complexMultiply(
            this.stateReal, this.stateImag,
            this.kernelFFT.real, this.kernelFFT.imag,
            this.potentialReal, this.potentialImag
        );

        // FFT 逆变换
        this.fft.inverse(this.potentialReal, this.potentialImag);

        // 应用生长函数
        applyGrowthWithTable(
            this.potentialReal,
            this.state,
            this.nextState,
            this.growthTable,
            this.params.dt
        );

        // 交换状态
        [this.state, this.nextState] = [this.nextState, this.state];

        // 更新统计
        this.updateStats();
        this.stats.step++;
    }

    /**
     * 执行多步模拟
     */
    run(steps) {
        for (let i = 0; i < steps; i++) {
            this.step();
        }
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        let mass = 0;
        let sumX = 0;
        let sumY = 0;

        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const value = this.state[y * this.size + x];
                mass += value;
                sumX += x * value;
                sumY += y * value;
            }
        }

        this.stats.mass = mass;

        if (mass > 0) {
            const centerX = sumX / mass;
            const centerY = sumY / mass;

            // 计算速度（考虑周期边界）
            let dx = centerX - this.prevCenterX;
            let dy = centerY - this.prevCenterY;

            if (dx > this.size / 2) dx -= this.size;
            if (dx < -this.size / 2) dx += this.size;
            if (dy > this.size / 2) dy -= this.size;
            if (dy < -this.size / 2) dy += this.size;

            this.stats.velocity = Math.sqrt(dx * dx + dy * dy);
            this.stats.centerX = centerX;
            this.stats.centerY = centerY;

            this.prevCenterX = centerX;
            this.prevCenterY = centerY;
        } else {
            this.stats.velocity = 0;
        }
    }

    /**
     * 获取状态
     */
    getState() {
        return this.state;
    }

    /**
     * 设置状态
     */
    setState(newState) {
        this.state.set(newState);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 导出配置
     */
    exportConfig() {
        return {
            size: this.size,
            params: { ...this.params },
            state: Array.from(this.state),
            stats: { ...this.stats }
        };
    }

    /**
     * 导入配置
     */
    importConfig(config) {
        if (config.size !== this.size) {
            throw new Error(`Size mismatch: expected ${this.size}, got ${config.size}`);
        }

        this.setParams(config.params);
        this.state.set(config.state);
        this.stats = { ...config.stats };
    }

    /**
     * 获取指定位置的值
     */
    getValue(x, y) {
        const px = ((x % this.size) + this.size) % this.size;
        const py = ((y % this.size) + this.size) % this.size;
        return this.state[py * this.size + px];
    }

    /**
     * 设置指定位置的值
     */
    setValue(x, y, value) {
        const px = ((x % this.size) + this.size) % this.size;
        const py = ((y % this.size) + this.size) % this.size;
        this.state[py * this.size + px] = Math.min(1, Math.max(0, value));
    }
}
