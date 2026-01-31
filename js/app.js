/**
 * Lenia 应用入口
 */

import { SandboxMode } from './modes/sandbox.js';
import { ChallengeMode } from './modes/challenge.js';
import { LaboratoryMode } from './modes/laboratory.js';
import { Storage } from './utils/storage.js';
import { COLOR_THEMES } from './render/color-mapper.js';

class LeniaApp {
    constructor() {
        this.currentMode = 'sandbox';
        this.modes = {};
        this.settings = Storage.loadSettings();

        // DOM 元素
        this.elements = {};
    }

    /**
     * 初始化应用
     */
    async init() {
        // 获取 DOM 元素
        this.elements = {
            canvas: document.getElementById('simulation-canvas'),
            overlayCanvas: document.getElementById('overlay-canvas'),
            modeButtons: document.querySelectorAll('.mode-btn'),
            statusBar: document.getElementById('status-bar'),
            themeSelector: document.getElementById('theme-selector'),
            resolutionSelector: document.getElementById('resolution-selector'),
            crtToggle: document.getElementById('crt-toggle'),
            multiChannelToggle: document.getElementById('multichannel-toggle'),
            helpBtn: document.getElementById('help-btn')
        };

        // 初始化画布
        this.setupCanvas();

        // 初始化模式
        this.initModes();

        // 设置事件监听
        this.setupEventListeners();

        // 应用保存的设置
        this.applySettings();

        // 播放开机动画
        await this.playBootAnimation();

        // 启动默认模式
        this.switchMode('sandbox');
    }

    /**
     * 设置画布
     */
    setupCanvas() {
        const canvas = this.elements.canvas;
        const container = canvas.parentElement;

        // 设置画布大小
        const size = Math.min(container.clientWidth, container.clientHeight);
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
    }

    /**
     * 初始化所有模式
     */
    initModes() {
        const canvas = this.elements.canvas;
        const isMultiChannel = this.settings.multiChannel !== false;
        // 使用保存的分辨率设置，默认 128（性能优先）
        const gridSize = this.settings.resolution || 128;

        // 沙盒模式
        this.modes.sandbox = new SandboxMode({
            canvas,
            gridSize,
            multiChannel: isMultiChannel,
            autoEnableAudio: this.settings.audioEnabled !== false,
            onStatsUpdate: (stats) => this.updateStatusBar(stats)
        });
        this.modes.sandbox.init();

        // 挑战模式
        this.modes.challenge = new ChallengeMode({
            canvas,
            overlayCanvas: this.elements.overlayCanvas,
            gridSize,
            onStatsUpdate: (stats) => this.updateStatusBar(stats),
            onChallengeComplete: (challenge, state) => this.showChallengeComplete(challenge, state),
            onChallengeFail: (challenge, state, reason) => this.showChallengeFail(challenge, state, reason)
        });
        this.modes.challenge.init();

        // 实验室模式
        this.modes.laboratory = new LaboratoryMode({
            canvas,
            gridSize,
            onStatsUpdate: (stats) => this.updateStatusBar(stats)
        });
        this.modes.laboratory.init();
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 模式切换按钮
        this.elements.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchMode(mode);
            });
        });

        // 主题选择
        if (this.elements.themeSelector) {
            this.elements.themeSelector.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }

        // CRT 效果切换
        if (this.elements.crtToggle) {
            this.elements.crtToggle.addEventListener('change', (e) => {
                this.setCRTEnabled(e.target.checked);
            });
        }

        // 多通道模式切换
        if (this.elements.multiChannelToggle) {
            this.elements.multiChannelToggle.addEventListener('change', (e) => {
                this.setMultiChannel(e.target.checked);
            });
        }

        // 分辨率切换
        if (this.elements.resolutionSelector) {
            this.elements.resolutionSelector.addEventListener('change', (e) => {
                this.setResolution(parseInt(e.target.value));
            });
        }

        // 帮助按钮
        if (this.elements.helpBtn) {
            this.elements.helpBtn.addEventListener('click', () => {
                this.showHelp();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.setupCanvas();
            if (this.currentModeInstance) {
                this.currentModeInstance.getRenderer().resize();
                this.currentModeInstance.render();
            }
        });
    }

    /**
     * 切换模式
     */
    switchMode(mode) {
        // 忽略无效模式
        if (!mode || !this.modes[mode]) return;

        // 停止当前模式
        if (this.currentModeInstance) {
            this.currentModeInstance.stop?.();
        }

        // 禁用沙盒画布交互（如果切换到其他模式）
        if (this.modes.sandbox) {
            if (mode === 'sandbox') {
                this.modes.sandbox.enableCanvas?.();
            } else {
                this.modes.sandbox.disableCanvas?.();
            }
        }

        // 更新按钮状态
        this.elements.modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // 更新 UI 显示
        document.querySelectorAll('.mode-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.mode !== mode);
        });

        // 切换模式
        this.currentMode = mode;
        this.currentModeInstance = this.modes[mode];

        // 渲染
        if (this.currentModeInstance) {
            this.currentModeInstance.render();
        }

        // 显示挑战列表（如果是挑战模式）
        if (mode === 'challenge') {
            this.showChallengeList();
        }
    }

    /**
     * 显示挑战列表
     */
    showChallengeList() {
        const listContainer = document.getElementById('challenge-list');
        if (!listContainer) return;

        const challenges = this.modes.challenge.getChallengeList();
        listContainer.innerHTML = '';

        for (const challenge of challenges) {
            const item = document.createElement('div');
            item.className = `challenge-item ${challenge.unlocked ? '' : 'locked'} ${challenge.completed ? 'completed' : ''}`;

            const status = challenge.completed ? '✓' : (challenge.unlocked ? '○' : '🔒');
            const score = challenge.completed ? ` [${challenge.score}]` : '';

            item.innerHTML = `
                <span class="challenge-status">${status}</span>
                <span class="challenge-name">${challenge.name}${score}</span>
            `;

            if (challenge.unlocked) {
                item.addEventListener('click', () => {
                    this.modes.challenge.loadChallenge(challenge.id);
                    this.showChallengeDetails(challenge);
                });
            }

            listContainer.appendChild(item);
        }
    }

    /**
     * 显示挑战详情
     */
    showChallengeDetails(challenge) {
        const detailsContainer = document.getElementById('challenge-details');
        if (!detailsContainer) return;

        detailsContainer.innerHTML = `
            <div class="challenge-header">
                <h3>${challenge.name}</h3>
            </div>
            <div class="challenge-description">${challenge.description}</div>
            <div class="challenge-objectives">
                <h4>Objectives:</h4>
                <ul>
                    ${challenge.objectives.map(o => `<li>${o.description}</li>`).join('')}
                </ul>
            </div>
            <div class="challenge-hints">
                <h4>Hints:</h4>
                <ul>
                    ${challenge.hints.map(h => `<li>${h}</li>`).join('')}
                </ul>
            </div>
            <button class="start-challenge-btn">START CHALLENGE</button>
        `;

        detailsContainer.querySelector('.start-challenge-btn').addEventListener('click', () => {
            this.modes.challenge.start();
        });
    }

    /**
     * 显示挑战完成
     */
    showChallengeComplete(challenge, state) {
        alert(`Challenge Complete!\n\nScore: ${state.score}\nSteps: ${state.steps}`);
        this.showChallengeList();
    }

    /**
     * 显示挑战失败
     */
    showChallengeFail(challenge, state, reason) {
        if (confirm(`Challenge Failed!\n\nReason: ${reason}\n\nRetry?`)) {
            this.modes.challenge.retry();
        }
    }

    /**
     * 更新状态栏
     */
    updateStatusBar(stats) {
        if (!this.elements.statusBar) return;

        const status = this.currentModeInstance?.isRunning ? 'Running' : 'Paused';
        const mode = this.currentMode.toUpperCase();

        this.elements.statusBar.innerHTML = `
            <span class="status-mode">[${mode}]</span>
            <span class="status-state">${status}</span>
            <span class="status-divider">|</span>
            <span class="status-steps">Steps: ${stats.step}</span>
            <span class="status-divider">|</span>
            <span class="status-mass">Mass: ${stats.mass.toFixed(0)}</span>
            <span class="status-divider">|</span>
            <span class="status-fps">${stats.fps || 0} FPS</span>
        `;
    }

    /**
     * 设置颜色主题
     */
    setTheme(theme) {
        this.settings.theme = theme;
        Storage.saveSettings(this.settings);

        // 更新所有模式的渲染器
        for (const mode of Object.values(this.modes)) {
            mode.getRenderer?.().setTheme(theme);
        }

        // 更新 CSS 变量
        const colors = COLOR_THEMES[theme];
        if (colors) {
            const [r, g, b] = colors.primary;
            const [gr, gg, gb] = colors.glow;
            const [bgr, bgg, bgb] = colors.background;

            // 主色调
            document.documentElement.style.setProperty('--terminal-color', `rgb(${r},${g},${b})`);
            document.documentElement.style.setProperty('--terminal-glow', `rgb(${gr},${gg},${gb})`);
            document.documentElement.style.setProperty('--terminal-bg', `rgb(${bgr},${bgg},${bgb})`);

            // 边框颜色（主色调的暗色版本）
            const borderR = Math.floor(r * 0.3);
            const borderG = Math.floor(g * 0.3);
            const borderB = Math.floor(b * 0.3);
            document.documentElement.style.setProperty('--border-color', `rgb(${borderR},${borderG},${borderB})`);

            // 暗色文字（主色调的中等暗度）
            const dimR = Math.floor(r * 0.5);
            const dimG = Math.floor(g * 0.5);
            const dimB = Math.floor(b * 0.5);
            document.documentElement.style.setProperty('--text-dim', `rgb(${dimR},${dimG},${dimB})`);

            // 暗色背景（主色调的暗色）
            const termDimR = Math.floor(r * 0.1);
            const termDimG = Math.floor(g * 0.1);
            const termDimB = Math.floor(b * 0.1);
            document.documentElement.style.setProperty('--terminal-dim', `rgb(${termDimR},${termDimG},${termDimB})`);

            // 高亮颜色（glow 颜色）
            document.documentElement.style.setProperty('--highlight-color', `rgb(${gr},${gg},${gb})`);
        }

        // 重新渲染旋钮
        this.modes.sandbox?.rerenderKnobs?.();

        // 重新渲染
        this.currentModeInstance?.render();
    }

    /**
     * 设置 CRT 效果
     */
    setCRTEnabled(enabled) {
        this.settings.crtEnabled = enabled;
        Storage.saveSettings(this.settings);

        for (const mode of Object.values(this.modes)) {
            mode.getRenderer?.().setCRTEnabled(enabled);
        }

        // 更新 CSS 类
        document.body.classList.toggle('crt-disabled', !enabled);

        this.currentModeInstance?.render();
    }

    /**
     * 设置多通道模式
     */
    setMultiChannel(enabled) {
        this.settings.multiChannel = enabled;
        Storage.saveSettings(this.settings);

        // 需要刷新页面以重新初始化引擎
        if (confirm('Switching mode requires page reload. Reload now?')) {
            location.reload();
        }
    }

    /**
     * 设置分辨率
     */
    setResolution(resolution) {
        this.settings.resolution = resolution;
        Storage.saveSettings(this.settings);

        // 需要刷新页面以应用新分辨率
        if (confirm('Changing resolution requires page reload. Reload now?')) {
            location.reload();
        }
    }

    /**
     * 应用保存的设置
     */
    applySettings() {
        // 主题
        if (this.settings.theme && this.elements.themeSelector) {
            this.elements.themeSelector.value = this.settings.theme;
            this.setTheme(this.settings.theme);
        }

        // CRT 效果
        if (this.elements.crtToggle) {
            this.elements.crtToggle.checked = this.settings.crtEnabled !== false;
            this.setCRTEnabled(this.settings.crtEnabled !== false);
        }

        // 多通道模式
        if (this.elements.multiChannelToggle) {
            this.elements.multiChannelToggle.checked = this.settings.multiChannel !== false;
        }

        // 分辨率
        if (this.elements.resolutionSelector) {
            this.elements.resolutionSelector.value = this.settings.resolution || 128;
        }
    }

    /**
     * 处理键盘事件
     */
    handleKeyboard(e) {
        // 忽略输入框中的按键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (this.currentModeInstance?.controls) {
                    this.currentModeInstance.controls.toggle();
                }
                break;
            case 's':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.currentModeInstance?.saveConfig?.();
                }
                break;
            case 'r':
                if (!e.ctrlKey) {
                    this.currentModeInstance?.reset?.();
                }
                break;
            case 'c':
                if (!e.ctrlKey) {
                    this.currentModeInstance?.clear?.();
                }
                break;
            case '.':
                this.currentModeInstance?.step?.();
                break;
            case '1':
                this.switchMode('sandbox');
                break;
            case '2':
                this.switchMode('challenge');
                break;
            case '3':
                this.switchMode('laboratory');
                break;
        }
    }

    /**
     * 显示帮助
     */
    showHelp() {
        const helpModal = document.getElementById('help-modal');
        if (helpModal) {
            helpModal.classList.add('visible');
        }
    }

    /**
     * 播放开机动画
     */
    async playBootAnimation() {
        const bootScreen = document.getElementById('boot-screen');
        if (!bootScreen) return;

        // 显示启动屏幕
        bootScreen.classList.add('visible');

        // 模拟启动文字
        const bootText = bootScreen.querySelector('.boot-text');
        if (bootText) {
            const lines = [
                'LENIA TERMINAL',
                'Copyright (c) 2026',
                '',
                'Initializing FFT engine...',
                'Loading kernel functions...',
                'Preparing growth tables...',
                '',
                'System ready.',
                ''
            ];

            for (const line of lines) {
                await this.typeText(bootText, line);
                await this.delay(100);
            }
        }

        // 渲染器开机动画
        if (this.modes.sandbox) {
            await this.modes.sandbox.getRenderer().playBootAnimation();
        }

        // 隐藏启动屏幕
        await this.delay(500);
        bootScreen.classList.remove('visible');
    }

    /**
     * 打字效果
     */
    async typeText(element, text) {
        const line = document.createElement('div');
        element.appendChild(line);

        for (const char of text) {
            line.textContent += char;
            await this.delay(20);
        }
    }

    /**
     * 延迟
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.leniaApp = new LeniaApp();
    window.leniaApp.init();
});
