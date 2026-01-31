/**
 * 工具栏（画笔/橡皮/放置工具）
 */

export class Toolbar {
    constructor(options = {}) {
        this.onToolChange = options.onToolChange || (() => {});
        this.onBrushSizeChange = options.onBrushSizeChange || (() => {});
        this.onPresetSelect = options.onPresetSelect || (() => {});
        this.onSave = options.onSave || (() => {});
        this.onLoad = options.onLoad || (() => {});
        this.onExport = options.onExport || (() => {});
        this.onImport = options.onImport || (() => {});
        this.onImageLoad = options.onImageLoad || (() => {});
        this.onAudioLoad = options.onAudioLoad || (() => {});

        this.currentTool = 'brush';
        this.brushSize = 5;
        this.container = null;
        this.elements = {};
    }

    /**
     * 创建工具栏 UI
     */
    createUI(container) {
        this.container = container;
        container.innerHTML = '';
        container.className = 'toolbar';

        // 工具按钮组
        const toolGroup = this.createElement('div', 'tool-group');
        const toolLabel = this.createElement('span', 'tool-label', 'TOOLS:');
        toolGroup.appendChild(toolLabel);

        // 画笔工具
        const brushBtn = this.createElement('button', 'tool-btn active', '✏ BRUSH');
        brushBtn.dataset.tool = 'brush';
        brushBtn.addEventListener('click', () => this.selectTool('brush'));
        this.elements.brushBtn = brushBtn;

        // 橡皮工具
        const eraserBtn = this.createElement('button', 'tool-btn', '🧹 ERASER');
        eraserBtn.dataset.tool = 'eraser';
        eraserBtn.addEventListener('click', () => this.selectTool('eraser'));
        this.elements.eraserBtn = eraserBtn;

        // 放置工具
        const placeBtn = this.createElement('button', 'tool-btn', '📍 PLACE');
        placeBtn.dataset.tool = 'place';
        placeBtn.addEventListener('click', () => this.selectTool('place'));
        this.elements.placeBtn = placeBtn;

        toolGroup.appendChild(brushBtn);
        toolGroup.appendChild(eraserBtn);
        toolGroup.appendChild(placeBtn);

        // 画笔大小控制
        const sizeGroup = this.createElement('div', 'size-group');
        const sizeLabel = this.createElement('span', 'size-label', 'SIZE:');
        const sizeDown = this.createElement('button', 'size-btn', '−');
        const sizeValue = this.createElement('span', 'size-value', '5');
        const sizeUp = this.createElement('button', 'size-btn', '+');

        sizeDown.addEventListener('click', () => this.decreaseBrushSize());
        sizeUp.addEventListener('click', () => this.increaseBrushSize());

        sizeGroup.appendChild(sizeLabel);
        sizeGroup.appendChild(sizeDown);
        sizeGroup.appendChild(sizeValue);
        sizeGroup.appendChild(sizeUp);
        this.elements.sizeValue = sizeValue;

        // 文件操作组
        const fileGroup = this.createElement('div', 'file-group');

        const saveBtn = this.createElement('button', 'file-btn', '💾 SAVE');
        saveBtn.addEventListener('click', () => this.onSave());

        const loadBtn = this.createElement('button', 'file-btn', '📂 LOAD');
        loadBtn.addEventListener('click', () => this.onLoad());

        const exportBtn = this.createElement('button', 'file-btn', '📤 EXPORT');
        exportBtn.addEventListener('click', () => this.onExport());

        const importBtn = this.createElement('button', 'file-btn', '📥 IMPORT');
        importBtn.addEventListener('click', () => this.triggerImport());

        const imageBtn = this.createElement('button', 'file-btn image-btn', '🖼 IMAGE');
        imageBtn.title = 'Load image as initial state';
        imageBtn.addEventListener('click', () => this.triggerImageLoad());
        this.elements.imageBtn = imageBtn;

        const audioBtn = this.createElement('button', 'file-btn audio-btn', '🎵 MUSIC');
        audioBtn.title = 'Generate pattern from music';
        audioBtn.addEventListener('click', () => this.triggerAudioLoad());
        this.elements.audioBtn = audioBtn;

        // 隐藏的文件输入（JSON）
        const fileInput = this.createElement('input', 'file-input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', (e) => this.handleFileImport(e));
        this.elements.fileInput = fileInput;

        // 隐藏的文件输入（图片）
        const imageInput = this.createElement('input', 'image-input');
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.style.display = 'none';
        imageInput.addEventListener('change', (e) => this.handleImageLoad(e));
        this.elements.imageInput = imageInput;

        // 隐藏的文件输入（音频）
        const audioInput = this.createElement('input', 'audio-input');
        audioInput.type = 'file';
        audioInput.accept = 'audio/*';
        audioInput.style.display = 'none';
        audioInput.addEventListener('change', (e) => this.handleAudioLoad(e));
        this.elements.audioInput = audioInput;

        fileGroup.appendChild(saveBtn);
        fileGroup.appendChild(loadBtn);
        fileGroup.appendChild(exportBtn);
        fileGroup.appendChild(importBtn);
        fileGroup.appendChild(imageBtn);
        fileGroup.appendChild(audioBtn);
        fileGroup.appendChild(fileInput);
        fileGroup.appendChild(imageInput);
        fileGroup.appendChild(audioInput);

        container.appendChild(toolGroup);
        container.appendChild(sizeGroup);
        container.appendChild(fileGroup);

        return container;
    }

    /**
     * 创建元素辅助函数
     */
    createElement(tag, className, text = '') {
        const el = document.createElement(tag);
        el.className = className;
        if (text) el.textContent = text;
        return el;
    }

    /**
     * 选择工具
     */
    selectTool(tool) {
        this.currentTool = tool;

        // 更新按钮状态
        const buttons = this.container.querySelectorAll('.tool-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        this.onToolChange(tool);
    }

    /**
     * 获取当前工具
     */
    getCurrentTool() {
        return this.currentTool;
    }

    /**
     * 增加画笔大小
     */
    increaseBrushSize() {
        if (this.brushSize < 50) {
            this.brushSize = Math.min(50, this.brushSize + 2);
            this.updateBrushSizeDisplay();
            this.onBrushSizeChange(this.brushSize);
        }
    }

    /**
     * 减少画笔大小
     */
    decreaseBrushSize() {
        if (this.brushSize > 1) {
            this.brushSize = Math.max(1, this.brushSize - 2);
            this.updateBrushSizeDisplay();
            this.onBrushSizeChange(this.brushSize);
        }
    }

    /**
     * 设置画笔大小
     */
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(50, size));
        this.updateBrushSizeDisplay();
    }

    /**
     * 更新画笔大小显示
     */
    updateBrushSizeDisplay() {
        if (this.elements.sizeValue) {
            this.elements.sizeValue.textContent = this.brushSize;
        }
    }

    /**
     * 获取画笔大小
     */
    getBrushSize() {
        return this.brushSize;
    }

    /**
     * 触发文件导入
     */
    triggerImport() {
        if (this.elements.fileInput) {
            this.elements.fileInput.click();
        }
    }

    /**
     * 触发图片加载
     */
    triggerImageLoad() {
        if (this.elements.imageInput) {
            this.elements.imageInput.click();
        }
    }

    /**
     * 处理图片加载
     */
    handleImageLoad(event) {
        const file = event.target.files[0];
        if (file) {
            this.onImageLoad(file);
        }
        // 重置 input 以允许再次选择相同文件
        event.target.value = '';
    }

    /**
     * 触发音频加载
     */
    triggerAudioLoad() {
        if (this.elements.audioInput) {
            this.elements.audioInput.click();
        }
    }

    /**
     * 处理音频加载
     */
    handleAudioLoad(event) {
        const file = event.target.files[0];
        if (file) {
            this.onAudioLoad(file);
        }
        event.target.value = '';
    }

    /**
     * 处理文件导入
     */
    handleFileImport(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    this.onImport(config);
                } catch (error) {
                    console.error('Import failed:', error);
                    alert('Failed to import configuration');
                }
            };
            reader.readAsText(file);
        }
        // 重置 input 以允许再次选择相同文件
        event.target.value = '';
    }

    /**
     * 禁用/启用工具栏
     */
    setEnabled(enabled) {
        const buttons = this.container.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = !enabled;
        });
    }

    /**
     * 设置放置模式选中的预设
     */
    setSelectedPreset(presetId) {
        this.selectedPreset = presetId;
        // 自动切换到放置工具
        if (presetId) {
            this.selectTool('place');
        }
    }

    /**
     * 获取选中的预设
     */
    getSelectedPreset() {
        return this.selectedPreset;
    }
}
