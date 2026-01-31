/**
 * 多通道 Lenia 引擎
 * 每个单元格有 RGB 三个独立通道，产生丰富的颜色效果
 */

import { FFT2D, complexMultiply } from './fft.js';
import { generateKernel, precomputeKernelFFT } from './kernel.js';
import { createGrowthTable, applyGrowthWithTable } from './growth.js';

export class MultiChannelLenia {
    constructor(size = 256, params = {}) {
        this.size = size;
        this.totalCells = size * size;
        this.numChannels = 3; // RGB

        // 默认参数（每个通道可以有不同参数）
        this.channelParams = [
            { R: 10, mu: 0.18, sigma: 0.08, dt: 0.05, kernelMu: 0.5, kernelSigma: 0.18 },  // Red
            { R: 12, mu: 0.15, sigma: 0.06, dt: 0.05, kernelMu: 0.5, kernelSigma: 0.15 },  // Green
            { R: 8,  mu: 0.20, sigma: 0.10, dt: 0.05, kernelMu: 0.5, kernelSigma: 0.20 },  // Blue
        ];

        // 应用传入的参数
        if (params.channelParams) {
            for (let i = 0; i < this.numChannels; i++) {
                Object.assign(this.channelParams[i], params.channelParams[i] || {});
            }
        }

        // 每个通道的状态
        this.states = [];
        this.nextStates = [];
        this.fft = new FFT2D(size);

        // FFT 工作数组
        this.stateReal = new Float64Array(this.totalCells);
        this.stateImag = new Float64Array(this.totalCells);
        this.potentialReal = new Float64Array(this.totalCells);
        this.potentialImag = new Float64Array(this.totalCells);

        // 每个通道的核函数和生长表
        this.kernelFFTs = [];
        this.growthTables = [];

        for (let i = 0; i < this.numChannels; i++) {
            this.states.push(new Float64Array(this.totalCells));
            this.nextStates.push(new Float64Array(this.totalCells));
            this.updateChannelKernel(i);
            this.updateChannelGrowthTable(i);
        }

        // 统计信息
        this.stats = {
            step: 0,
            mass: 0,
            centerX: size / 2,
            centerY: size / 2,
            velocity: 0
        };

        this.prevCenterX = size / 2;
        this.prevCenterY = size / 2;
    }

    updateChannelKernel(channelIndex) {
        const params = this.channelParams[channelIndex];
        const kernel = generateKernel(this.size, params.R, {
            kernelMu: params.kernelMu,
            kernelSigma: params.kernelSigma
        });
        this.kernelFFTs[channelIndex] = precomputeKernelFFT(this.fft, kernel, this.size);
    }

    updateChannelGrowthTable(channelIndex) {
        const params = this.channelParams[channelIndex];
        this.growthTables[channelIndex] = createGrowthTable(params.mu, params.sigma, 2048);
    }

    setParams(newParams) {
        // 更新全部通道的公共参数
        for (let i = 0; i < this.numChannels; i++) {
            const oldParams = { ...this.channelParams[i] };

            // 应用通用参数到所有通道（带偏移）
            if (newParams.R !== undefined) {
                this.channelParams[i].R = newParams.R + (i - 1) * 2;
            }
            if (newParams.mu !== undefined) {
                this.channelParams[i].mu = newParams.mu + (i - 1) * 0.02;
            }
            if (newParams.sigma !== undefined) {
                this.channelParams[i].sigma = newParams.sigma + (i - 1) * 0.01;
            }
            if (newParams.dt !== undefined) {
                this.channelParams[i].dt = newParams.dt;
            }

            // 检查是否需要重新计算
            const p = this.channelParams[i];
            if (p.R !== oldParams.R || p.kernelMu !== oldParams.kernelMu || p.kernelSigma !== oldParams.kernelSigma) {
                this.updateChannelKernel(i);
            }
            if (p.mu !== oldParams.mu || p.sigma !== oldParams.sigma) {
                this.updateChannelGrowthTable(i);
            }
        }
    }

    getParams() {
        // 返回中间通道（绿色）的参数作为代表
        return { ...this.channelParams[1] };
    }

    clear() {
        for (let i = 0; i < this.numChannels; i++) {
            this.states[i].fill(0);
            this.nextStates[i].fill(0);
        }
        this.stats.step = 0;
        this.stats.mass = 0;
    }

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
                    const idx = y * this.size + x;
                    // 每个通道独立随机
                    for (let c = 0; c < this.numChannels; c++) {
                        this.states[c][idx] = Math.random();
                    }
                }
            }
        }
    }

    placePattern(pattern, x, y, scale = 1) {
        let width, height, data;

        if (pattern instanceof Float64Array) {
            const size = Math.sqrt(pattern.length);
            width = height = size;
            data = pattern;
        } else {
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

                const destX = ((startX + px) % this.size + this.size) % this.size;
                const destY = ((startY + py) % this.size + this.size) % this.size;
                const idx = destY * this.size + destX;

                // 放置到所有通道，但带微小偏移产生颜色差异
                for (let c = 0; c < this.numChannels; c++) {
                    const offset = (c - 1) * 2;
                    const ox = ((destX + offset) % this.size + this.size) % this.size;
                    const oy = ((destY + offset) % this.size + this.size) % this.size;
                    const oidx = oy * this.size + ox;
                    this.states[c][oidx] = Math.min(1, this.states[c][oidx] + value);
                }
            }
        }
    }

    drawCircle(x, y, radius, value = 1) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    // 为每个通道添加不同偏移的颜色
                    for (let c = 0; c < this.numChannels; c++) {
                        const offset = (c - 1) * 1;
                        const px = ((x + dx + offset) % this.size + this.size) % this.size;
                        const py = ((y + dy + offset) % this.size + this.size) % this.size;
                        this.states[c][py * this.size + px] = value;
                    }
                }
            }
        }
    }

    step() {
        // 每个通道独立更新
        for (let c = 0; c < this.numChannels; c++) {
            this.stepChannel(c);
        }

        this.updateStats();
        this.stats.step++;
    }

    run(steps) {
        for (let i = 0; i < steps; i++) {
            this.step();
        }
    }

    stepChannel(channelIndex) {
        const state = this.states[channelIndex];
        const nextState = this.nextStates[channelIndex];
        const kernelFFT = this.kernelFFTs[channelIndex];
        const growthTable = this.growthTables[channelIndex];
        const dt = this.channelParams[channelIndex].dt;

        // 复制到工作数组
        this.stateReal.set(state);
        this.stateImag.fill(0);

        // FFT 前向
        this.fft.forward(this.stateReal, this.stateImag);

        // 频域卷积
        complexMultiply(
            this.stateReal, this.stateImag,
            kernelFFT.real, kernelFFT.imag,
            this.potentialReal, this.potentialImag
        );

        // FFT 逆变换
        this.fft.inverse(this.potentialReal, this.potentialImag);

        // 应用生长函数
        applyGrowthWithTable(
            this.potentialReal,
            state,
            nextState,
            growthTable,
            dt
        );

        // 交换缓冲区
        [this.states[channelIndex], this.nextStates[channelIndex]] =
            [this.nextStates[channelIndex], this.states[channelIndex]];
    }

    updateStats() {
        let totalMass = 0;
        let sumX = 0;
        let sumY = 0;

        // 合并所有通道计算统计
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const idx = y * this.size + x;
                let value = 0;
                for (let c = 0; c < this.numChannels; c++) {
                    value += this.states[c][idx];
                }
                value /= this.numChannels;
                totalMass += value;
                sumX += x * value;
                sumY += y * value;
            }
        }

        this.stats.mass = totalMass;

        if (totalMass > 0) {
            const centerX = sumX / totalMass;
            const centerY = sumY / totalMass;

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
        }
    }

    /**
     * 获取 RGB 状态（用于渲染）
     */
    getState() {
        return this.states;
    }

    /**
     * 设置状态（单通道兼容）
     */
    setState(newState) {
        if (Array.isArray(newState) && newState.length === this.numChannels) {
            // 多通道输入
            for (let c = 0; c < this.numChannels; c++) {
                this.states[c].set(newState[c]);
            }
        } else {
            // 单通道输入，复制到所有通道
            for (let c = 0; c < this.numChannels; c++) {
                this.states[c].set(newState);
            }
        }
    }

    getStats() {
        return { ...this.stats };
    }

    exportConfig() {
        return {
            size: this.size,
            channelParams: this.channelParams.map(p => ({ ...p })),
            states: this.states.map(s => Array.from(s)),
            stats: { ...this.stats }
        };
    }

    importConfig(config) {
        if (config.size !== this.size) {
            throw new Error(`Size mismatch`);
        }
        for (let i = 0; i < this.numChannels; i++) {
            if (config.channelParams && config.channelParams[i]) {
                Object.assign(this.channelParams[i], config.channelParams[i]);
                this.updateChannelKernel(i);
                this.updateChannelGrowthTable(i);
            }
            if (config.states && config.states[i]) {
                this.states[i].set(config.states[i]);
            }
        }
        this.stats = { ...config.stats };
    }
}
