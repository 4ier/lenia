/**
 * 旋钮控件
 * 用于控制音色参数
 */

export class Knob {
    constructor(options = {}) {
        this.value = options.value || 0.5;
        this.min = options.min || 0;
        this.max = options.max || 1;
        this.step = options.step || 0.01;
        this.label = options.label || '';
        this.size = options.size || 48;
        this.onChange = options.onChange || (() => {});

        this.element = null;
        this.canvas = null;
        this.ctx = null;

        this.isDragging = false;
        this.startY = 0;
        this.startValue = 0;

        // 绑定方法
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
    }

    /**
     * 创建 UI
     */
    createUI(container) {
        this.element = document.createElement('div');
        this.element.className = 'knob-container';

        // 标签
        const label = document.createElement('div');
        label.className = 'knob-label';
        label.textContent = this.label;

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size * 2; // 高 DPI
        this.canvas.height = this.size * 2;
        this.canvas.style.width = this.size + 'px';
        this.canvas.style.height = this.size + 'px';
        this.canvas.className = 'knob-canvas';
        this.ctx = this.canvas.getContext('2d');

        // 数值显示
        this.valueDisplay = document.createElement('div');
        this.valueDisplay.className = 'knob-value';

        this.element.appendChild(label);
        this.element.appendChild(this.canvas);
        this.element.appendChild(this.valueDisplay);

        container.appendChild(this.element);

        // 事件监听
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

        // 触摸支持
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseDown({ clientY: touch.clientY, preventDefault: () => {} });
        });

        // 初始绘制
        this.render();

        return this.element;
    }

    /**
     * 鼠标按下
     */
    handleMouseDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this.startY = e.clientY;
        this.startValue = this.value;

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // 触摸
        document.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.handleMouseMove({ clientY: touch.clientY });
        }, { passive: false });
        document.addEventListener('touchend', this.handleMouseUp);

        this.element.classList.add('active');
    }

    /**
     * 鼠标移动
     */
    handleMouseMove(e) {
        if (!this.isDragging) return;

        const deltaY = this.startY - e.clientY;
        const range = this.max - this.min;
        const sensitivity = 200; // 拖动 200px = 全范围

        const delta = (deltaY / sensitivity) * range;
        this.setValue(this.startValue + delta);
    }

    /**
     * 鼠标释放
     */
    handleMouseUp() {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        this.element.classList.remove('active');
    }

    /**
     * 滚轮
     */
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -this.step : this.step;
        this.setValue(this.value + delta * 5);
    }

    /**
     * 设置值
     */
    setValue(value) {
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));

        // 步进对齐
        this.value = Math.round(this.value / this.step) * this.step;

        if (this.value !== oldValue) {
            this.render();
            this.onChange(this.value);
        }
    }

    /**
     * 获取值
     */
    getValue() {
        return this.value;
    }

    /**
     * 渲染旋钮
     */
    render() {
        const ctx = this.ctx;
        const size = this.size * 2;
        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.35;

        // 清空
        ctx.clearRect(0, 0, size, size);

        // 获取主题色
        const style = getComputedStyle(document.documentElement);
        const primaryColor = style.getPropertyValue('--terminal-color').trim() || '#33ff33';
        const dimColor = style.getPropertyValue('--text-dim').trim() || '#228822';
        const bgColor = style.getPropertyValue('--panel-bg').trim() || '#0d0d0d';

        // 归一化值
        const normalizedValue = (this.value - this.min) / (this.max - this.min);

        // 角度范围: -135° 到 135° (总共 270°)
        const startAngle = (135 * Math.PI) / 180;
        const endAngle = (405 * Math.PI) / 180;
        const currentAngle = startAngle + normalizedValue * (endAngle - startAngle);

        // 背景轨道
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = dimColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 值轨道
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, currentAngle);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 中心圆
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.strokeStyle = dimColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 指示线
        const indicatorLength = radius * 0.45;
        const indicatorX = cx + Math.cos(currentAngle) * indicatorLength;
        const indicatorY = cy + Math.sin(currentAngle) * indicatorLength;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(indicatorX, indicatorY);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 中心点
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = primaryColor;
        ctx.fill();

        // 更新数值显示
        if (this.valueDisplay) {
            this.valueDisplay.textContent = this.value.toFixed(2);
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('wheel', this.handleWheel);
        }
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

/**
 * 创建旋钮组
 */
export function createKnobGroup(container, knobConfigs, onChange) {
    const knobs = {};

    const group = document.createElement('div');
    group.className = 'knob-group';

    for (const config of knobConfigs) {
        const knob = new Knob({
            ...config,
            onChange: (value) => {
                onChange(config.key, value);
            }
        });
        knob.createUI(group);
        knobs[config.key] = knob;
    }

    container.appendChild(group);

    return {
        knobs,
        setValue: (key, value) => {
            if (knobs[key]) {
                knobs[key].setValue(value);
            }
        },
        getValue: (key) => {
            return knobs[key] ? knobs[key].getValue() : null;
        },
        destroy: () => {
            Object.values(knobs).forEach(k => k.destroy());
        }
    };
}
