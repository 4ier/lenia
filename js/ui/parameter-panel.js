/**
 * 参数滑块面板
 */

export class ParameterPanel {
    constructor(options = {}) {
        this.onChange = options.onChange || (() => {});
        this.container = null;
        this.sliders = {};

        // 参数配置
        this.paramConfig = {
            R: { label: 'R (Radius)', min: 5, max: 30, step: 1, default: 8 },
            mu: { label: 'μ (Growth Center)', min: 0.01, max: 0.5, step: 0.01, default: 0.2 },
            sigma: { label: 'σ (Growth Width)', min: 0.001, max: 0.2, step: 0.001, default: 0.1 },
            dt: { label: 'dt (Time Step)', min: 0.01, max: 0.5, step: 0.01, default: 0.05 },
            kernelMu: { label: 'Kernel μ', min: 0.1, max: 0.9, step: 0.05, default: 0.5 },
            kernelSigma: { label: 'Kernel σ', min: 0.05, max: 0.5, step: 0.01, default: 0.2 }
        };
    }

    /**
     * 创建面板 UI
     */
    createUI(container) {
        this.container = container;
        container.innerHTML = '';
        container.className = 'panel parameter-panel';

        // 面板标题
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = '<span class="terminal-prompt">&gt;</span> PARAMETERS';
        container.appendChild(header);

        // 参数滑块容器
        const slidersContainer = document.createElement('div');
        slidersContainer.className = 'sliders-container';

        // 创建每个参数的滑块
        for (const [key, config] of Object.entries(this.paramConfig)) {
            const sliderRow = this.createSliderRow(key, config);
            slidersContainer.appendChild(sliderRow);
        }

        container.appendChild(slidersContainer);

        return container;
    }

    /**
     * 创建单个滑块行
     */
    createSliderRow(key, config) {
        const row = document.createElement('div');
        row.className = 'slider-row';

        // 参数标签
        const label = document.createElement('span');
        label.className = 'param-label';
        label.textContent = config.label;

        // 滑块容器
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';

        // 滑块
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'param-slider';
        slider.min = config.min;
        slider.max = config.max;
        slider.step = config.step;
        slider.value = config.default;

        // 数值显示
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'param-value';
        valueDisplay.textContent = this.formatValue(config.default, config);

        // 事件监听
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            valueDisplay.textContent = this.formatValue(value, config);
            this.onChange(key, value);
        });

        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);

        row.appendChild(label);
        row.appendChild(sliderContainer);

        this.sliders[key] = { slider, valueDisplay, config };

        return row;
    }

    /**
     * 格式化数值显示
     */
    formatValue(value, config) {
        if (config.step >= 1) {
            return Math.round(value).toString();
        } else if (config.step >= 0.01) {
            return value.toFixed(2);
        } else {
            return value.toFixed(3);
        }
    }

    /**
     * 设置参数值
     */
    setValue(key, value) {
        if (this.sliders[key]) {
            const { slider, valueDisplay, config } = this.sliders[key];
            slider.value = value;
            valueDisplay.textContent = this.formatValue(value, config);
        }
    }

    /**
     * 设置所有参数
     */
    setValues(params) {
        for (const [key, value] of Object.entries(params)) {
            this.setValue(key, value);
        }
    }

    /**
     * 获取所有参数值
     */
    getValues() {
        const values = {};
        for (const [key, { slider }] of Object.entries(this.sliders)) {
            values[key] = parseFloat(slider.value);
        }
        return values;
    }

    /**
     * 重置为默认值
     */
    reset() {
        for (const [key, config] of Object.entries(this.paramConfig)) {
            this.setValue(key, config.default);
        }
    }

    /**
     * 禁用/启用面板
     */
    setEnabled(enabled) {
        for (const { slider } of Object.values(this.sliders)) {
            slider.disabled = !enabled;
        }
    }

    /**
     * 添加自定义参数
     */
    addParameter(key, config) {
        this.paramConfig[key] = config;
        if (this.container) {
            const slidersContainer = this.container.querySelector('.sliders-container');
            const sliderRow = this.createSliderRow(key, config);
            slidersContainer.appendChild(sliderRow);
        }
    }

    /**
     * 高亮显示参数
     */
    highlightParam(key) {
        // 移除所有高亮
        for (const { slider } of Object.values(this.sliders)) {
            slider.parentElement.parentElement.classList.remove('highlighted');
        }
        // 添加新高亮
        if (this.sliders[key]) {
            this.sliders[key].slider.parentElement.parentElement.classList.add('highlighted');
        }
    }
}
