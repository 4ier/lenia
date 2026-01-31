/**
 * 沙盒模式
 * 自由探索 Lenia 世界
 */

import { LeniaEngine } from '../core/lenia.js';
import { MultiChannelLenia } from '../core/multi-channel-lenia.js';
import { CanvasRenderer } from '../render/canvas-renderer.js';
import { PlaybackControls } from '../ui/controls.js';
import { ParameterPanel } from '../ui/parameter-panel.js';
import { Toolbar } from '../ui/toolbar.js';
import { getPreset, getPresetList } from '../data/presets.js';
import { Storage } from '../utils/storage.js';
import { exportConfig } from '../utils/export-import.js';
import { AmbientSynth } from '../audio/ambient-synth.js';
import { createKnobGroup } from '../ui/knob.js';
import { generateSeed, generatePatternFromSeed, seedToString } from '../utils/seed.js';
import { copyShareURL, loadFromURL } from '../utils/share.js';
import { loadImageAsState, applyThreshold, applyBlur } from '../utils/image-loader.js';
import { audioToState, suggestParamsFromAudio } from '../utils/audio-to-seed.js';

export class SandboxMode {
    constructor(options = {}) {
        this.gridSize = options.gridSize || 256;
        this.canvas = options.canvas;

        // 多通道模式
        this.isMultiChannel = options.multiChannel || false;

        // 音频自动启用
        this.autoEnableAudio = options.autoEnableAudio !== false;

        // 核心引擎
        this.engine = this.isMultiChannel
            ? new MultiChannelLenia(this.gridSize)
            : new LeniaEngine(this.gridSize);

        // 渲染器
        this.renderer = new CanvasRenderer(this.canvas, this.gridSize);

        // UI 组件
        this.controls = null;
        this.parameterPanel = null;
        this.toolbar = null;
        this.presetPanel = null;

        // 状态
        this.isRunning = false;
        this.animationId = null;
        this.lastTime = 0;
        this.accumulator = 0;
        this.targetFPS = 60;
        this.stepsPerFrame = 1;

        // 绘制状态
        this.isDrawing = false;
        this.lastDrawPos = null;

        // 选中的预设
        this.selectedPreset = null;

        // 音频合成器
        this.synth = new AmbientSynth();
        this.audioKnobs = null;

        // 种子
        this.currentSeed = generateSeed();

        // 事件回调
        this.onStatsUpdate = options.onStatsUpdate || (() => {});
    }

    /**
     * 初始化
     */
    init() {
        this.setupControls();
        this.setupCanvas();
        this.setupAudioPanel();
        this.setupSharePanel();
        this.loadFromURLIfPresent();
        // 确保音频系统知道当前 seed
        this.synth.setSeed(this.currentSeed);
        this.render();

        // 自动启用音频（需要用户交互后才能真正启动）
        if (this.autoEnableAudio) {
            this.pendingAudioEnable = true;
        }
    }

    /**
     * 尝试启用音频（在用户交互后调用）
     */
    async tryEnableAudio() {
        if (this.pendingAudioEnable && !this.synth.getIsEnabled()) {
            this.pendingAudioEnable = false;
            await this.synth.enable();
            if (this.audioToggleBtn) {
                this.audioToggleBtn.textContent = 'ON';
                this.audioToggleBtn.classList.add('active');
            }
        }
    }

    /**
     * 从 URL 加载分享配置
     */
    loadFromURLIfPresent() {
        const shared = loadFromURL();
        if (shared) {
            this.currentSeed = shared.seed;
            this.engine.setParams(shared.params);
            if (this.parameterPanel) {
                this.parameterPanel.setValues(shared.params);
            }
            // 使用种子生成图案
            const pattern = generatePatternFromSeed(this.gridSize, shared.seed);
            this.engine.setState(pattern);
            this.updateSeedDisplay();
        }
    }

    /**
     * 设置音频面板
     */
    setupAudioPanel() {
        const audioContainer = document.getElementById('audio-panel');
        if (!audioContainer) return;

        audioContainer.innerHTML = '';
        audioContainer.className = 'panel audio-panel';

        // 头部
        const header = document.createElement('div');
        header.className = 'panel-header';

        const title = document.createElement('span');
        title.innerHTML = '<span class="terminal-prompt">&gt;</span> AUDIO';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'audio-toggle-btn';
        toggleBtn.textContent = 'OFF';
        toggleBtn.addEventListener('click', async () => {
            const enabled = await this.synth.toggle();
            toggleBtn.textContent = enabled ? 'ON' : 'OFF';
            toggleBtn.classList.toggle('active', enabled);
        });
        this.audioToggleBtn = toggleBtn;

        header.appendChild(title);
        header.appendChild(toggleBtn);
        audioContainer.appendChild(header);

        // 旋钮组
        const knobContainer = document.createElement('div');
        knobContainer.id = 'audio-knobs';
        audioContainer.appendChild(knobContainer);

        this.audioKnobs = createKnobGroup(knobContainer, [
            { key: 'tempo', label: 'Tempo', value: 0.5, min: 0, max: 1 },
            { key: 'warmth', label: 'Warmth', value: 0.5, min: 0, max: 1 },
            { key: 'reverb', label: 'Reverb', value: 0.4, min: 0, max: 1 },
            { key: 'volume', label: 'Volume', value: 0.3, min: 0, max: 0.5 }
        ], (key, value) => {
            this.synth.setParam(key, value);
        });
    }

    /**
     * 设置分享面板
     */
    setupSharePanel() {
        const shareContainer = document.getElementById('share-panel');
        if (!shareContainer) return;

        shareContainer.innerHTML = '';
        shareContainer.className = 'share-panel';

        // 种子显示
        const seedDisplay = document.createElement('div');
        seedDisplay.className = 'seed-display';

        const seedLabel = document.createElement('span');
        seedLabel.className = 'seed-label';
        seedLabel.textContent = 'SEED:';

        this.seedValueEl = document.createElement('span');
        this.seedValueEl.className = 'seed-value';
        this.seedValueEl.textContent = seedToString(this.currentSeed);

        const newSeedBtn = document.createElement('button');
        newSeedBtn.className = 'seed-btn';
        newSeedBtn.textContent = '🎲';
        newSeedBtn.title = 'New random seed';
        newSeedBtn.addEventListener('click', () => this.randomizeWithNewSeed());

        seedDisplay.appendChild(seedLabel);
        seedDisplay.appendChild(this.seedValueEl);
        seedDisplay.appendChild(newSeedBtn);

        // 分享按钮
        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-btn';
        shareBtn.textContent = '🔗 SHARE';
        shareBtn.addEventListener('click', () => this.shareConfig());

        // 状态显示
        this.shareStatus = document.createElement('span');
        this.shareStatus.className = 'share-status';

        shareContainer.appendChild(seedDisplay);
        shareContainer.appendChild(shareBtn);
        shareContainer.appendChild(this.shareStatus);
    }

    /**
     * 更新种子显示
     */
    updateSeedDisplay() {
        if (this.seedValueEl) {
            this.seedValueEl.textContent = seedToString(this.currentSeed);
        }
        // 同步到音频系统
        this.synth.setSeed(this.currentSeed);
    }

    /**
     * 使用新种子随机化
     */
    randomizeWithNewSeed() {
        this.currentSeed = generateSeed();
        const pattern = generatePatternFromSeed(this.gridSize, this.currentSeed);
        this.engine.setState(pattern);
        this.updateSeedDisplay();
        this.render();
        this.updateStats();
    }

    /**
     * 分享配置
     */
    async shareConfig() {
        const params = this.engine.getParams();
        const result = await copyShareURL(params, this.currentSeed);

        if (this.shareStatus) {
            this.shareStatus.textContent = result.success ? '✓ Link copied!' : result.url;
            // 清除状态
            setTimeout(() => {
                if (this.shareStatus) this.shareStatus.textContent = '';
            }, 3000);
        }
    }

    /**
     * 设置控件
     */
    setupControls() {
        // 播放控件
        const controlsContainer = document.getElementById('playback-controls');
        if (controlsContainer) {
            this.controls = new PlaybackControls({
                onPlay: () => this.start(),
                onPause: () => this.stop(),
                onStep: () => this.step(),
                onClear: () => this.clear(),
                onReset: () => this.reset(),
                onSpeedChange: (speed) => this.setSpeed(speed)
            });
            this.controls.createUI(controlsContainer);
        }

        // 参数面板
        const paramContainer = document.getElementById('parameter-panel');
        if (paramContainer) {
            this.parameterPanel = new ParameterPanel({
                onChange: (key, value) => this.setParam(key, value)
            });
            this.parameterPanel.createUI(paramContainer);
            this.parameterPanel.setValues(this.engine.getParams());
        }

        // 工具栏
        const toolbarContainer = document.getElementById('toolbar');
        if (toolbarContainer) {
            this.toolbar = new Toolbar({
                onToolChange: (tool) => this.setTool(tool),
                onBrushSizeChange: (size) => this.setBrushSize(size),
                onSave: () => this.saveConfig(),
                onLoad: () => this.showLoadDialog(),
                onExport: () => this.exportToFile(),
                onImport: (config) => this.importConfig(config),
                onImageLoad: (file) => this.loadImageAsInitialState(file),
                onAudioLoad: (file) => this.loadAudioAsInitialState(file)
            });
            this.toolbar.createUI(toolbarContainer);
        }

        // 预设面板
        this.setupPresetPanel();
    }

    /**
     * 设置预设面板
     */
    setupPresetPanel() {
        const presetContainer = document.getElementById('preset-panel');
        if (!presetContainer) return;

        presetContainer.innerHTML = '';
        presetContainer.className = 'panel preset-panel';

        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = '<span class="terminal-prompt">&gt;</span> PRESETS';
        presetContainer.appendChild(header);

        const presetList = document.createElement('div');
        presetList.className = 'preset-list';

        for (const preset of getPresetList()) {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.dataset.presetId = preset.id;

            const radio = document.createElement('span');
            radio.className = 'preset-radio';
            radio.textContent = '○';

            const name = document.createElement('span');
            name.className = 'preset-name';
            name.textContent = preset.name;

            item.appendChild(radio);
            item.appendChild(name);

            item.addEventListener('click', () => this.selectPreset(preset.id));
            item.title = preset.description;

            presetList.appendChild(item);
        }

        presetContainer.appendChild(presetList);
        this.presetPanel = presetContainer;
    }

    /**
     * 选择预设
     */
    selectPreset(presetId) {
        this.selectedPreset = presetId;

        // 更新 UI
        const items = this.presetPanel.querySelectorAll('.preset-item');
        items.forEach(item => {
            const isSelected = item.dataset.presetId === presetId;
            item.classList.toggle('selected', isSelected);
            item.querySelector('.preset-radio').textContent = isSelected ? '●' : '○';
        });

        // 切换到放置工具
        if (this.toolbar) {
            this.toolbar.selectTool('place');
        }

        // 加载预设参数
        const preset = getPreset(presetId);
        if (preset && this.parameterPanel) {
            this.engine.setParams(preset.params);
            this.parameterPanel.setValues(preset.params);
        }
    }

    /**
     * 设置画布事件
     */
    setupCanvas() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

        // 触摸支持
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        });
        this.canvas.addEventListener('touchend', () => this.handleMouseUp());

        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.renderer.resize();
            this.render();
        });
    }

    /**
     * 鼠标按下
     */
    handleMouseDown(e) {
        const tool = this.toolbar ? this.toolbar.getCurrentTool() : 'brush';
        const pos = this.renderer.canvasToGrid(e.clientX, e.clientY);

        if (tool === 'place' && this.selectedPreset) {
            // 放置预设
            const preset = getPreset(this.selectedPreset);
            if (preset) {
                this.engine.placePattern(preset.pattern, pos.x, pos.y);
                this.render();
            }
        } else {
            // 开始绘制
            this.isDrawing = true;
            this.lastDrawPos = pos;
            this.draw(pos);
        }
    }

    /**
     * 鼠标移动
     */
    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const pos = this.renderer.canvasToGrid(e.clientX, e.clientY);

        // 插值绘制（避免快速移动时出现间隙）
        if (this.lastDrawPos) {
            const dx = pos.x - this.lastDrawPos.x;
            const dy = pos.y - this.lastDrawPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.max(1, Math.floor(dist));

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = Math.floor(this.lastDrawPos.x + dx * t);
                const y = Math.floor(this.lastDrawPos.y + dy * t);
                this.draw({ x, y });
            }
        }

        this.lastDrawPos = pos;
        this.render();
    }

    /**
     * 鼠标释放
     */
    handleMouseUp() {
        this.isDrawing = false;
        this.lastDrawPos = null;
    }

    /**
     * 绘制
     */
    draw(pos) {
        const tool = this.toolbar ? this.toolbar.getCurrentTool() : 'brush';
        const size = this.toolbar ? this.toolbar.getBrushSize() : 5;
        const value = tool === 'eraser' ? 0 : 1;

        this.engine.drawCircle(pos.x, pos.y, size, value);
    }

    /**
     * 设置参数
     */
    setParam(key, value) {
        this.engine.setParams({ [key]: value });
    }

    /**
     * 设置工具
     */
    setTool(tool) {
        // 如果不是放置工具，清除预设选择
        if (tool !== 'place') {
            this.selectedPreset = null;
            if (this.presetPanel) {
                const items = this.presetPanel.querySelectorAll('.preset-item');
                items.forEach(item => {
                    item.classList.remove('selected');
                    item.querySelector('.preset-radio').textContent = '○';
                });
            }
        }
    }

    /**
     * 设置画笔大小
     */
    setBrushSize(size) {
        // 画笔大小已存储在 toolbar 中
    }

    /**
     * 设置速度
     */
    setSpeed(speed) {
        this.stepsPerFrame = Math.round(speed);
    }

    /**
     * 开始模拟
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();

        // 尝试启用音频（用户已交互）
        this.tryEnableAudio();
    }

    /**
     * 停止模拟
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 单步执行
     */
    step() {
        this.engine.step();
        this.render();
        this.updateStats();
    }

    /**
     * 清空
     */
    clear() {
        this.engine.clear();
        this.render();
        this.updateStats();
    }

    /**
     * 重置
     */
    reset() {
        this.randomizeWithNewSeed();
    }

    /**
     * 主循环
     */
    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        // 执行步进
        for (let i = 0; i < this.stepsPerFrame; i++) {
            this.engine.step();
        }

        // 更新音频
        const stats = this.engine.getStats();
        this.synth.updateStats(stats);
        this.synth.update();

        // 渲染
        this.render();
        this.updateStats();

        this.animationId = requestAnimationFrame(() => this.loop());
    }

    /**
     * 渲染
     */
    render() {
        this.renderer.render(this.engine.getState());
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        const stats = this.engine.getStats();
        stats.fps = this.renderer.getFPS();
        this.onStatsUpdate(stats);
    }

    /**
     * 保存配置
     */
    saveConfig() {
        const name = prompt('Enter save name:', `save_${Date.now()}`);
        if (name) {
            const config = this.engine.exportConfig();
            Storage.saveConfig(name, config);
            alert(`Saved as "${name}"`);
        }
    }

    /**
     * 显示加载对话框
     */
    showLoadDialog() {
        const configs = Storage.getSavedConfigs();
        if (configs.length === 0) {
            alert('No saved configurations');
            return;
        }

        const name = prompt(`Available saves:\n${configs.join('\n')}\n\nEnter name to load:`);
        if (name) {
            const config = Storage.loadConfig(name);
            if (config) {
                this.engine.importConfig(config);
                if (this.parameterPanel) {
                    this.parameterPanel.setValues(config.params);
                }
                this.render();
                this.updateStats();
            } else {
                alert('Configuration not found');
            }
        }
    }

    /**
     * 导出到文件
     */
    exportToFile() {
        const config = this.engine.exportConfig();
        exportConfig(config, `lenia_${Date.now()}.json`);
    }

    /**
     * 导入配置
     */
    importConfig(config) {
        try {
            if (config.size !== this.gridSize) {
                alert(`Grid size mismatch: expected ${this.gridSize}, got ${config.size}`);
                return;
            }
            this.engine.importConfig(config);
            if (this.parameterPanel) {
                this.parameterPanel.setValues(config.params);
            }
            this.render();
            this.updateStats();
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    }

    /**
     * 从图片加载初始状态
     */
    async loadImageAsInitialState(file) {
        try {
            // 根据是否为多通道模式选择加载方式
            if (this.isMultiChannel) {
                // RGB 模式：保留彩色
                let states = await loadImageAsState(file, this.gridSize, true);

                // 对每个通道应用模糊和阈值
                states = states.map(channel => {
                    let processed = applyBlur(channel, this.gridSize, 1);
                    processed = applyThreshold(processed, 0.1);
                    return processed;
                });

                this.engine.setState(states);
            } else {
                // 单通道模式：灰度
                let state = await loadImageAsState(file, this.gridSize, false);
                state = applyBlur(state, this.gridSize, 1);
                state = applyThreshold(state, 0.15);
                this.engine.setState(state);
            }

            // 更新显示
            this.render();
            this.updateStats();

            // 更新种子显示为图片名称
            if (this.seedValueEl) {
                const shortName = file.name.length > 12
                    ? file.name.substring(0, 9) + '...'
                    : file.name;
                this.seedValueEl.textContent = `📷 ${shortName}`;
            }
        } catch (error) {
            console.error('Failed to load image:', error);
            alert('Failed to load image: ' + error.message);
        }
    }

    /**
     * 从音频文件生成初始状态
     */
    async loadAudioAsInitialState(file) {
        try {
            // 显示加载中
            if (this.seedValueEl) {
                this.seedValueEl.textContent = '🎵 Analyzing...';
            }

            // 分析音频并生成状态
            const { state, seed, features } = await audioToState(
                file,
                this.gridSize,
                this.isMultiChannel
            );

            // 设置引擎状态
            this.engine.setState(state);

            // 更新种子（用于音乐风格）
            this.currentSeed = seed;
            this.synth.setSeed(seed);

            // 根据音频特征调整 Lenia 参数
            const suggestedParams = suggestParamsFromAudio(features);
            this.engine.setParams(suggestedParams);
            if (this.parameterPanel) {
                this.parameterPanel.setValues(this.engine.getParams());
            }

            // 更新显示
            this.render();
            this.updateStats();

            // 显示音乐名称
            if (this.seedValueEl) {
                const shortName = file.name.length > 10
                    ? file.name.substring(0, 7) + '...'
                    : file.name.replace(/\.[^/.]+$/, '');
                this.seedValueEl.textContent = `🎵 ${shortName}`;
            }
        } catch (error) {
            console.error('Failed to load audio:', error);
            alert('Failed to analyze audio: ' + error.message);
            if (this.seedValueEl) {
                this.seedValueEl.textContent = seedToString(this.currentSeed);
            }
        }
    }

    /**
     * 设置颜色主题
     */
    setTheme(theme) {
        this.renderer.setTheme(theme);
        this.render();
    }

    /**
     * 切换多通道模式
     */
    setMultiChannel(enabled) {
        if (this.isMultiChannel === enabled) return;

        const wasRunning = this.isRunning;
        if (wasRunning) this.stop();

        // 保存当前参数
        const params = this.engine.getParams();

        // 重新创建引擎
        this.isMultiChannel = enabled;
        this.engine = enabled
            ? new MultiChannelLenia(this.gridSize)
            : new LeniaEngine(this.gridSize);

        // 恢复参数
        this.engine.setParams(params);

        // 重新初始化
        this.randomizeWithNewSeed();

        if (wasRunning) this.start();
    }

    /**
     * 获取是否为多通道模式
     */
    getIsMultiChannel() {
        return this.isMultiChannel;
    }

    /**
     * 设置 CRT 效果
     */
    setCRTEnabled(enabled) {
        this.renderer.setCRTEnabled(enabled);
        this.render();
    }

    /**
     * 获取引擎实例
     */
    getEngine() {
        return this.engine;
    }

    /**
     * 获取渲染器实例
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * 重新渲染旋钮（主题变化时调用）
     */
    rerenderKnobs() {
        if (this.audioKnobs && this.audioKnobs.knobs) {
            for (const knob of Object.values(this.audioKnobs.knobs)) {
                knob.render();
            }
        }
    }

    /**
     * 销毁
     */
    destroy() {
        this.stop();
        this.synth.destroy();
        if (this.audioKnobs) {
            this.audioKnobs.destroy();
        }
    }

    /**
     * 获取音频合成器
     */
    getSynth() {
        return this.synth;
    }

    /**
     * 获取当前种子
     */
    getSeed() {
        return this.currentSeed;
    }
}
