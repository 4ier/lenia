/**
 * 挑战模式
 */

import { LeniaEngine } from '../core/lenia.js';
import { CanvasRenderer } from '../render/canvas-renderer.js';
import { getChallenge, getAllChallenges, isChallengeUnlocked, CHALLENGE_TYPES } from '../data/challenges.js';
import { getPreset } from '../data/presets.js';
import { Storage } from '../utils/storage.js';

export class ChallengeMode {
    constructor(options = {}) {
        this.gridSize = options.gridSize || 256;
        this.canvas = options.canvas;
        this.overlayCanvas = options.overlayCanvas;

        // 引擎和渲染器
        this.engine = new LeniaEngine(this.gridSize);
        this.renderer = new CanvasRenderer(this.canvas, this.gridSize);

        // 当前挑战
        this.currentChallenge = null;
        this.challengeState = {
            started: false,
            completed: false,
            failed: false,
            objectives: {},
            score: 0,
            startTime: 0,
            steps: 0
        };

        // 进度
        this.progress = Storage.loadChallengeProgress();

        // 状态
        this.isRunning = false;
        this.animationId = null;

        // 控件代理（用于键盘快捷键兼容）
        this.controls = {
            toggle: () => this.toggle()
        };

        // 回调
        this.onChallengeComplete = options.onChallengeComplete || (() => {});
        this.onChallengeFail = options.onChallengeFail || (() => {});
        this.onObjectiveUpdate = options.onObjectiveUpdate || (() => {});
        this.onStatsUpdate = options.onStatsUpdate || (() => {});
    }

    /**
     * 初始化
     */
    init() {
        this.setupOverlay();
    }

    /**
     * 设置叠加画布（用于绘制目标区域等）
     */
    setupOverlay() {
        if (!this.overlayCanvas) return;

        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.overlayCanvas.width = this.canvas.width;
        this.overlayCanvas.height = this.canvas.height;
    }

    /**
     * 加载挑战
     */
    loadChallenge(challengeId) {
        const challenge = getChallenge(challengeId);
        if (!challenge) {
            console.error('Challenge not found:', challengeId);
            return false;
        }

        // 检查是否解锁
        if (!isChallengeUnlocked(challengeId, this.progress.completed)) {
            console.error('Challenge locked:', challengeId);
            return false;
        }

        this.currentChallenge = challenge;
        this.resetChallengeState();
        this.setupChallenge();

        return true;
    }

    /**
     * 重置挑战状态
     */
    resetChallengeState() {
        this.challengeState = {
            started: false,
            completed: false,
            failed: false,
            objectives: {},
            score: 0,
            startTime: 0,
            steps: 0,
            paramChanges: 0,
            presetChanges: 0
        };

        // 初始化目标状态（使用索引作为键，避免相同类型的目标冲突）
        if (this.currentChallenge.objectives) {
            for (let i = 0; i < this.currentChallenge.objectives.length; i++) {
                this.challengeState.objectives[i] = {
                    completed: false,
                    progress: 0
                };
            }
        }
    }

    /**
     * 设置挑战
     */
    setupChallenge() {
        const challenge = this.currentChallenge;
        if (!challenge) return;

        // 清空引擎
        this.engine.clear();

        // 设置网格大小（如果指定）
        if (challenge.gridSize && challenge.gridSize !== this.gridSize) {
            // 需要重新创建引擎
            this.gridSize = challenge.gridSize;
            this.engine = new LeniaEngine(this.gridSize);
            this.renderer = new CanvasRenderer(this.canvas, this.gridSize);
        }

        // 放置初始预设
        if (challenge.preset) {
            const preset = getPreset(challenge.preset);
            if (preset) {
                this.engine.setParams(preset.params);
                const startPos = challenge.startPosition || { x: this.gridSize / 2, y: this.gridSize / 2 };
                this.engine.placePattern(preset.pattern, startPos.x, startPos.y);
            }
        }

        // 设置障碍物
        if (challenge.obstacles) {
            this.setupObstacles(challenge.obstacles);
        }

        // 渲染初始状态
        this.render();
        this.drawOverlay();
    }

    /**
     * 设置障碍物
     */
    setupObstacles(obstacles) {
        // 障碍物作为负值区域（不可通过）
        // 实际实现可能需要修改引擎来支持障碍物
        this.obstacles = obstacles;
    }

    /**
     * 绘制叠加层
     */
    drawOverlay() {
        if (!this.overlayCtx) return;

        const ctx = this.overlayCtx;
        const challenge = this.currentChallenge;
        const scale = this.overlayCanvas.width / this.gridSize;

        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // 绘制目标区域
        if (challenge.targetZone) {
            const { x, y, radius } = challenge.targetZone;
            ctx.strokeStyle = '#33ff33';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(x * scale, y * scale, radius * scale, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(51, 255, 51, 0.1)';
            ctx.fill();
            ctx.setLineDash([]);
        }

        // 绘制障碍物
        if (challenge.obstacles) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.strokeStyle = '#ff3333';
            ctx.lineWidth = 2;

            for (const obs of challenge.obstacles) {
                ctx.fillRect(obs.x * scale, obs.y * scale, obs.width * scale, obs.height * scale);
                ctx.strokeRect(obs.x * scale, obs.y * scale, obs.width * scale, obs.height * scale);
            }
        }
    }

    /**
     * 开始挑战
     */
    start() {
        if (!this.currentChallenge) return;
        if (this.isRunning) return;

        this.challengeState.started = true;
        this.challengeState.startTime = performance.now();
        this.isRunning = true;

        // 触发 'play' 动作目标
        this.triggerAction('play');

        this.loop();
    }

    /**
     * 播放/暂停切换（供控件调用）
     */
    toggle() {
        if (this.isRunning) {
            this.stop();
            this.triggerAction('pause');
        } else {
            this.start();
        }
    }

    /**
     * 单步执行
     */
    step() {
        if (!this.currentChallenge) return;
        this.engine.step();
        this.challengeState.steps++;
        this.checkObjectives();
        this.render();
        this.updateStats();
        this.triggerAction('step');
    }

    /**
     * 清空画布
     */
    clear() {
        this.engine.clear();
        this.render();
        this.triggerAction('clear');
    }

    /**
     * 重置
     */
    reset() {
        this.retry();
    }

    /**
     * 停止
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 主循环
     */
    loop() {
        if (!this.isRunning) return;

        // 执行步进
        this.engine.step();
        this.challengeState.steps++;

        // 检查目标
        this.checkObjectives();

        // 检查失败条件
        this.checkFailConditions();

        // 渲染
        this.render();
        this.updateStats();

        // 检查是否完成或失败
        if (this.challengeState.completed || this.challengeState.failed) {
            this.stop();
            return;
        }

        this.animationId = requestAnimationFrame(() => this.loop());
    }

    /**
     * 检查目标完成情况
     */
    checkObjectives() {
        const challenge = this.currentChallenge;
        if (!challenge || !challenge.objectives) return;

        const stats = this.engine.getStats();

        for (let i = 0; i < challenge.objectives.length; i++) {
            const objective = challenge.objectives[i];
            const objState = this.challengeState.objectives[i];
            if (!objState || objState.completed) continue;

            switch (objective.type) {
                case 'reach_target':
                    if (challenge.targetZone) {
                        const { x, y, radius } = challenge.targetZone;
                        const dx = stats.centerX - x;
                        const dy = stats.centerY - y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        objState.progress = Math.max(0, 1 - dist / (this.gridSize / 2));

                        if (dist < radius && stats.mass > 10) {
                            objState.completed = true;
                            this.onObjectiveUpdate(objective, objState);
                        }
                    }
                    break;

                case 'survive':
                    objState.progress = this.challengeState.steps / objective.steps;
                    if (this.challengeState.steps >= objective.steps && stats.mass > (challenge.minMass || 10)) {
                        objState.completed = true;
                        this.onObjectiveUpdate(objective, objState);
                    }
                    break;

                case 'observe':
                    objState.progress = this.challengeState.steps / objective.steps;
                    if (this.challengeState.steps >= objective.steps) {
                        objState.completed = true;
                        this.onObjectiveUpdate(objective, objState);
                    }
                    break;

                case 'stabilize':
                    // 检查是否稳定（质量变化小）
                    objState.progress = this.challengeState.steps / objective.steps;
                    if (this.challengeState.steps >= objective.steps && stats.mass > 10) {
                        objState.completed = true;
                        this.onObjectiveUpdate(objective, objState);
                    }
                    break;

                case 'draw':
                    objState.progress = stats.mass / objective.minCells;
                    if (stats.mass >= objective.minCells) {
                        objState.completed = true;
                        this.onObjectiveUpdate(objective, objState);
                    }
                    break;

                case 'avoid_obstacles':
                    // 避开障碍物 - 只要生物存活且没撞到障碍物就持续进行
                    // 在失败检测中会检测碰撞，这里只追踪存活时间
                    objState.progress = this.challengeState.steps / (objective.steps || 500);
                    if (this.challengeState.steps >= (objective.steps || 500) && stats.mass > 10) {
                        objState.completed = true;
                        this.onObjectiveUpdate(objective, objState);
                    }
                    break;

                case 'action':
                    // 动作目标由外部触发
                    break;

                case 'place_preset':
                    // 由 placePreset 方法触发
                    break;

                case 'adjust_param':
                    // 由参数调整触发
                    break;
            }
        }

        // 检查是否所有目标都完成
        const allCompleted = Object.values(this.challengeState.objectives).every(o => o.completed);
        if (allCompleted) {
            this.completeChallenge();
        }
    }

    /**
     * 检查失败条件
     */
    checkFailConditions() {
        const challenge = this.currentChallenge;
        if (!challenge) return;

        const stats = this.engine.getStats();

        // 时间限制
        if (challenge.timeLimit && this.challengeState.steps > challenge.timeLimit) {
            this.failChallenge('Time limit exceeded');
            return;
        }

        // 生物死亡（存活挑战）
        if (challenge.type === CHALLENGE_TYPES.SURVIVAL && stats.mass < (challenge.minMass || 5)) {
            // 给一些缓冲时间
            if (this.challengeState.steps > 50) {
                this.failChallenge('Organism died');
            }
        }

        // 碰撞障碍物
        if (challenge.obstacles && challenge.type === CHALLENGE_TYPES.MAZE) {
            // 简化检测：检查质心是否在障碍物内
            for (const obs of challenge.obstacles) {
                if (stats.centerX >= obs.x && stats.centerX <= obs.x + obs.width &&
                    stats.centerY >= obs.y && stats.centerY <= obs.y + obs.height) {
                    this.failChallenge('Hit obstacle');
                    return;
                }
            }
        }
    }

    /**
     * 完成挑战
     */
    completeChallenge() {
        this.challengeState.completed = true;

        // 计算分数
        this.calculateScore();

        // 保存进度
        if (!this.progress.completed.includes(this.currentChallenge.id)) {
            this.progress.completed.push(this.currentChallenge.id);
        }
        this.progress.scores[this.currentChallenge.id] = Math.max(
            this.progress.scores[this.currentChallenge.id] || 0,
            this.challengeState.score
        );
        Storage.saveChallengeProgress(this.progress);

        this.onChallengeComplete(this.currentChallenge, this.challengeState);
    }

    /**
     * 挑战失败
     */
    failChallenge(reason) {
        this.challengeState.failed = true;
        this.challengeState.failReason = reason;
        this.onChallengeFail(this.currentChallenge, this.challengeState, reason);
    }

    /**
     * 计算分数
     */
    calculateScore() {
        const challenge = this.currentChallenge;
        let score = 100;

        // 时间奖励
        if (challenge.scoring && challenge.scoring.time) {
            const timeBonus = Math.max(0, challenge.scoring.time.max - this.challengeState.steps);
            score += Math.floor(timeBonus * 0.1);
        }

        // 完美奖励
        if (challenge.scoring && challenge.scoring.bonus) {
            if (challenge.scoring.bonus.noParameterChange && this.challengeState.paramChanges === 0) {
                score += challenge.scoring.bonus.noParameterChange;
            }
        }

        this.challengeState.score = score;
    }

    /**
     * 渲染
     */
    render() {
        this.renderer.render(this.engine.getState());
    }

    /**
     * 更新统计
     */
    updateStats() {
        const stats = this.engine.getStats();
        stats.fps = this.renderer.getFPS();
        stats.challengeSteps = this.challengeState.steps;
        this.onStatsUpdate(stats);
    }

    /**
     * 触发动作目标
     */
    triggerAction(action) {
        if (!this.currentChallenge) return;

        const objectives = this.currentChallenge.objectives || [];
        for (let i = 0; i < objectives.length; i++) {
            const objective = objectives[i];
            if (objective.type === 'action' && objective.action === action) {
                const objState = this.challengeState.objectives[i];
                if (objState && !objState.completed) {
                    objState.completed = true;
                    this.onObjectiveUpdate(objective, objState);
                }
            }
        }

        // 检查是否所有目标都完成
        this.checkAllObjectivesComplete();
    }

    /**
     * 触发预设放置目标
     */
    triggerPresetPlace(presetId) {
        if (!this.currentChallenge) return;

        const objectives = this.currentChallenge.objectives || [];
        for (let i = 0; i < objectives.length; i++) {
            const objective = objectives[i];
            if (objective.type === 'place_preset' && objective.preset === presetId) {
                const objState = this.challengeState.objectives[i];
                if (objState && !objState.completed) {
                    objState.completed = true;
                    this.onObjectiveUpdate(objective, objState);
                }
            }
        }

        // 检查是否所有目标都完成
        this.checkAllObjectivesComplete();
    }

    /**
     * 触发参数调整目标
     */
    triggerParamAdjust(param) {
        if (!this.currentChallenge) return;

        this.challengeState.paramChanges++;

        const objectives = this.currentChallenge.objectives || [];
        for (let i = 0; i < objectives.length; i++) {
            const objective = objectives[i];
            if (objective.type === 'adjust_param' && objective.param === param) {
                const objState = this.challengeState.objectives[i];
                if (objState && !objState.completed) {
                    objState.completed = true;
                    this.onObjectiveUpdate(objective, objState);
                }
            }
        }

        // 检查是否所有目标都完成
        this.checkAllObjectivesComplete();
    }

    /**
     * 检查是否所有目标都完成
     */
    checkAllObjectivesComplete() {
        const allCompleted = Object.values(this.challengeState.objectives).every(o => o.completed);
        if (allCompleted && !this.challengeState.completed) {
            this.completeChallenge();
        }
    }

    /**
     * 获取挑战列表
     */
    getChallengeList() {
        return getAllChallenges().map(c => ({
            ...c,
            unlocked: isChallengeUnlocked(c.id, this.progress.completed),
            completed: this.progress.completed.includes(c.id),
            score: this.progress.scores[c.id] || 0
        }));
    }

    /**
     * 获取当前挑战
     */
    getCurrentChallenge() {
        return this.currentChallenge;
    }

    /**
     * 获取挑战状态
     */
    getChallengeState() {
        return { ...this.challengeState };
    }

    /**
     * 重试当前挑战
     */
    retry() {
        if (this.currentChallenge) {
            this.loadChallenge(this.currentChallenge.id);
        }
    }

    /**
     * 获取渲染器
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * 销毁
     */
    destroy() {
        this.stop();
    }
}
