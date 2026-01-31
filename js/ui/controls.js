/**
 * 播放/暂停/速度控件
 */

export class PlaybackControls {
    constructor(options = {}) {
        this.isPlaying = false;
        this.speed = 1;
        this.maxSpeed = 10;
        this.minSpeed = 0.1;

        // 回调函数
        this.onPlay = options.onPlay || (() => {});
        this.onPause = options.onPause || (() => {});
        this.onStep = options.onStep || (() => {});
        this.onSpeedChange = options.onSpeedChange || (() => {});
        this.onClear = options.onClear || (() => {});
        this.onReset = options.onReset || (() => {});

        this.container = null;
        this.elements = {};
    }

    /**
     * 创建控件 UI
     */
    createUI(container) {
        this.container = container;
        container.innerHTML = '';
        container.className = 'playback-controls';

        // 播放/暂停按钮
        const playBtn = this.createElement('button', 'play-btn', '▶ PLAY');
        playBtn.addEventListener('click', () => this.toggle());
        this.elements.playBtn = playBtn;

        // 步进按钮
        const stepBtn = this.createElement('button', 'step-btn', '⏭ STEP');
        stepBtn.addEventListener('click', () => {
            this.onStep();
        });
        this.elements.stepBtn = stepBtn;

        // 清空按钮
        const clearBtn = this.createElement('button', 'clear-btn', '🗑 CLEAR');
        clearBtn.addEventListener('click', () => {
            this.onClear();
        });
        this.elements.clearBtn = clearBtn;

        // 重置按钮
        const resetBtn = this.createElement('button', 'reset-btn', '↺ RESET');
        resetBtn.addEventListener('click', () => {
            this.onReset();
        });
        this.elements.resetBtn = resetBtn;

        // 速度控制
        const speedContainer = this.createElement('div', 'speed-container');
        const speedLabel = this.createElement('span', 'speed-label', 'SPEED:');
        const speedDown = this.createElement('button', 'speed-down', '−');
        const speedValue = this.createElement('span', 'speed-value', '1x');
        const speedUp = this.createElement('button', 'speed-up', '+');

        speedDown.addEventListener('click', () => this.decreaseSpeed());
        speedUp.addEventListener('click', () => this.increaseSpeed());

        speedContainer.appendChild(speedLabel);
        speedContainer.appendChild(speedDown);
        speedContainer.appendChild(speedValue);
        speedContainer.appendChild(speedUp);
        this.elements.speedValue = speedValue;

        // 添加所有元素
        container.appendChild(playBtn);
        container.appendChild(stepBtn);
        container.appendChild(clearBtn);
        container.appendChild(resetBtn);
        container.appendChild(speedContainer);

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
     * 播放/暂停切换
     */
    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * 播放
     */
    play() {
        this.isPlaying = true;
        this.updatePlayButton();
        this.onPlay();
    }

    /**
     * 暂停
     */
    pause() {
        this.isPlaying = false;
        this.updatePlayButton();
        this.onPause();
    }

    /**
     * 更新播放按钮状态
     */
    updatePlayButton() {
        if (this.elements.playBtn) {
            this.elements.playBtn.textContent = this.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
            this.elements.playBtn.classList.toggle('playing', this.isPlaying);
        }
    }

    /**
     * 增加速度
     */
    increaseSpeed() {
        if (this.speed < this.maxSpeed) {
            if (this.speed < 1) {
                this.speed = Math.min(1, this.speed * 2);
            } else {
                this.speed = Math.min(this.maxSpeed, this.speed + 1);
            }
            this.updateSpeedDisplay();
            this.onSpeedChange(this.speed);
        }
    }

    /**
     * 减少速度
     */
    decreaseSpeed() {
        if (this.speed > this.minSpeed) {
            if (this.speed <= 1) {
                this.speed = Math.max(this.minSpeed, this.speed / 2);
            } else {
                this.speed = Math.max(1, this.speed - 1);
            }
            this.updateSpeedDisplay();
            this.onSpeedChange(this.speed);
        }
    }

    /**
     * 设置速度
     */
    setSpeed(speed) {
        this.speed = Math.max(this.minSpeed, Math.min(this.maxSpeed, speed));
        this.updateSpeedDisplay();
    }

    /**
     * 更新速度显示
     */
    updateSpeedDisplay() {
        if (this.elements.speedValue) {
            if (this.speed < 1) {
                this.elements.speedValue.textContent = `${this.speed.toFixed(1)}x`;
            } else {
                this.elements.speedValue.textContent = `${Math.round(this.speed)}x`;
            }
        }
    }

    /**
     * 获取当前速度
     */
    getSpeed() {
        return this.speed;
    }

    /**
     * 获取播放状态
     */
    getIsPlaying() {
        return this.isPlaying;
    }

    /**
     * 禁用/启用控件
     */
    setEnabled(enabled) {
        Object.values(this.elements).forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.disabled = !enabled;
            }
        });
    }
}
