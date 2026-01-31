/**
 * 实验室模式
 * 参数空间探索和统计分析
 */

import { LeniaEngine } from '../core/lenia.js';
import { CanvasRenderer } from '../render/canvas-renderer.js';
import { getPreset } from '../data/presets.js';

export class LaboratoryMode {
    constructor(options = {}) {
        this.gridSize = options.gridSize || 256;
        this.canvas = options.canvas;

        // 引擎和渲染器
        this.engine = new LeniaEngine(this.gridSize);
        this.renderer = new CanvasRenderer(this.canvas, this.gridSize);

        // 实验状态
        this.experiments = [];
        this.currentExperiment = null;
        this.isRunning = false;
        this.animationId = null;

        // 统计历史
        this.statsHistory = [];
        this.maxHistoryLength = 1000;

        // 回调
        this.onStatsUpdate = options.onStatsUpdate || (() => {});
        this.onExperimentComplete = options.onExperimentComplete || (() => {});
    }

    /**
     * 初始化
     */
    init() {
        this.setupStatsPanel();
    }

    /**
     * 设置统计面板
     */
    setupStatsPanel() {
        const statsContainer = document.getElementById('lab-stats');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
            <div class="panel-header">
                <span class="terminal-prompt">&gt;</span> STATISTICS
            </div>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Mass:</span>
                    <span class="stat-value" id="stat-mass">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Velocity:</span>
                    <span class="stat-value" id="stat-velocity">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Center X:</span>
                    <span class="stat-value" id="stat-center-x">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Center Y:</span>
                    <span class="stat-value" id="stat-center-y">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Steps:</span>
                    <span class="stat-value" id="stat-steps">0</span>
                </div>
            </div>
        `;

        this.statsElements = {
            mass: document.getElementById('stat-mass'),
            velocity: document.getElementById('stat-velocity'),
            centerX: document.getElementById('stat-center-x'),
            centerY: document.getElementById('stat-center-y'),
            steps: document.getElementById('stat-steps')
        };
    }

    /**
     * 创建参数扫描实验
     */
    createParameterSweep(param, start, end, steps, basePreset = 'orbium') {
        const experiments = [];
        const step = (end - start) / steps;

        for (let i = 0; i <= steps; i++) {
            const value = start + step * i;
            experiments.push({
                id: `sweep_${param}_${i}`,
                name: `${param}=${value.toFixed(4)}`,
                params: { [param]: value },
                preset: basePreset,
                maxSteps: 500
            });
        }

        return experiments;
    }

    /**
     * 运行实验批次
     */
    async runBatch(experiments, onProgress) {
        const results = [];

        for (let i = 0; i < experiments.length; i++) {
            const exp = experiments[i];
            const result = await this.runExperiment(exp);
            results.push(result);

            if (onProgress) {
                onProgress(i + 1, experiments.length, result);
            }
        }

        return results;
    }

    /**
     * 运行单个实验
     */
    runExperiment(experiment) {
        return new Promise(resolve => {
            // 重置引擎
            this.engine.clear();

            // 加载预设
            const preset = getPreset(experiment.preset);
            if (preset) {
                this.engine.setParams({ ...preset.params, ...experiment.params });
                this.engine.placePattern(preset.pattern, this.gridSize / 2, this.gridSize / 2);
            }

            // 初始状态
            const initialMass = this.engine.getStats().mass;

            // 运行模拟
            let step = 0;
            const maxSteps = experiment.maxSteps || 500;
            const history = [];

            const runStep = () => {
                this.engine.step();
                step++;

                const stats = this.engine.getStats();
                history.push({ ...stats });

                // 检查是否死亡
                if (stats.mass < 1) {
                    resolve({
                        experiment,
                        success: false,
                        deathStep: step,
                        history
                    });
                    return;
                }

                if (step >= maxSteps) {
                    // 分析结果
                    const analysis = this.analyzeHistory(history);
                    resolve({
                        experiment,
                        success: true,
                        finalStats: stats,
                        analysis,
                        history
                    });
                    return;
                }

                // 继续（使用 setTimeout 避免阻塞）
                if (step % 100 === 0) {
                    setTimeout(runStep, 0);
                } else {
                    runStep();
                }
            };

            runStep();
        });
    }

    /**
     * 分析历史数据
     */
    analyzeHistory(history) {
        if (history.length === 0) return null;

        const masses = history.map(h => h.mass);
        const velocities = history.map(h => h.velocity);

        return {
            avgMass: this.average(masses),
            stdMass: this.standardDeviation(masses),
            minMass: Math.min(...masses),
            maxMass: Math.max(...masses),
            avgVelocity: this.average(velocities),
            stdVelocity: this.standardDeviation(velocities),
            isStable: this.standardDeviation(masses.slice(-100)) < masses[masses.length - 1] * 0.1,
            isMoving: this.average(velocities.slice(-100)) > 0.1
        };
    }

    /**
     * 计算平均值
     */
    average(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    /**
     * 计算标准差
     */
    standardDeviation(arr) {
        const avg = this.average(arr);
        const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
        return Math.sqrt(this.average(squareDiffs));
    }

    /**
     * 开始实时监控
     */
    startMonitoring() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.statsHistory = [];
        this.monitorLoop();
    }

    /**
     * 停止监控
     */
    stopMonitoring() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 监控循环
     */
    monitorLoop() {
        if (!this.isRunning) return;

        this.engine.step();
        const stats = this.engine.getStats();

        // 记录历史
        this.statsHistory.push({ ...stats, time: Date.now() });
        if (this.statsHistory.length > this.maxHistoryLength) {
            this.statsHistory.shift();
        }

        // 更新显示
        this.updateStatsDisplay(stats);
        this.render();

        this.animationId = requestAnimationFrame(() => this.monitorLoop());
    }

    /**
     * 更新统计显示
     */
    updateStatsDisplay(stats) {
        if (!this.statsElements) return;

        if (this.statsElements.mass) {
            this.statsElements.mass.textContent = stats.mass.toFixed(1);
        }
        if (this.statsElements.velocity) {
            this.statsElements.velocity.textContent = stats.velocity.toFixed(3);
        }
        if (this.statsElements.centerX) {
            this.statsElements.centerX.textContent = stats.centerX.toFixed(1);
        }
        if (this.statsElements.centerY) {
            this.statsElements.centerY.textContent = stats.centerY.toFixed(1);
        }
        if (this.statsElements.steps) {
            this.statsElements.steps.textContent = stats.step;
        }

        this.onStatsUpdate(stats);
    }

    /**
     * 渲染
     */
    render() {
        this.renderer.render(this.engine.getState());
    }

    /**
     * 获取引擎
     */
    getEngine() {
        return this.engine;
    }

    /**
     * 获取渲染器
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * 获取统计历史
     */
    getStatsHistory() {
        return [...this.statsHistory];
    }

    /**
     * 导出实验结果
     */
    exportResults(results) {
        const data = {
            exportedAt: new Date().toISOString(),
            gridSize: this.gridSize,
            results: results.map(r => ({
                experiment: r.experiment,
                success: r.success,
                deathStep: r.deathStep,
                finalStats: r.finalStats,
                analysis: r.analysis
            }))
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `lenia-experiment-${Date.now()}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * 销毁
     */
    destroy() {
        this.stopMonitoring();
    }
}
