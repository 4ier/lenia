/**
 * Canvas 渲染器
 * 负责将 Lenia 状态渲染到 Canvas 上，并应用 CRT 效果
 */

import { ColorMapper } from './color-mapper.js';

export class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas - 目标画布
     * @param {number} gridSize - 网格大小
     */
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.gridSize = gridSize;

        // 色彩映射器
        this.colorMapper = new ColorMapper('green');

        // 离屏画布（用于网格渲染）
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = gridSize;
        this.offscreenCanvas.height = gridSize;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        this.imageData = this.offscreenCtx.createImageData(gridSize, gridSize);

        // CRT 效果参数
        this.crtEnabled = true;
        this.scanlineIntensity = 0.15;
        this.curvature = 0.03;
        this.vignetteIntensity = 0.3;
        this.flickerIntensity = 0.02;
        this.glowEnabled = true;
        this.glowAmount = 0.5;

        // 性能统计
        this.lastFrameTime = 0;
        this.fps = 0;

        // 初始化
        this.resize();
    }

    /**
     * 调整画布大小
     */
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.displayWidth = rect.width;
        this.displayHeight = rect.height;

        this.ctx.imageSmoothingEnabled = false;
    }

    /**
     * 设置颜色主题
     */
    setTheme(theme) {
        this.colorMapper.setTheme(theme);
    }

    /**
     * 启用/禁用 CRT 效果
     */
    setCRTEnabled(enabled) {
        this.crtEnabled = enabled;
    }

    /**
     * 设置 CRT 效果参数
     */
    setCRTParams(params) {
        if (params.scanlineIntensity !== undefined) {
            this.scanlineIntensity = params.scanlineIntensity;
        }
        if (params.curvature !== undefined) {
            this.curvature = params.curvature;
        }
        if (params.vignetteIntensity !== undefined) {
            this.vignetteIntensity = params.vignetteIntensity;
        }
        if (params.flickerIntensity !== undefined) {
            this.flickerIntensity = params.flickerIntensity;
        }
        if (params.glowEnabled !== undefined) {
            this.glowEnabled = params.glowEnabled;
        }
        if (params.glowAmount !== undefined) {
            this.glowAmount = params.glowAmount;
        }
    }

    /**
     * 渲染状态
     * @param {Float64Array} state - Lenia 状态数组
     */
    render(state) {
        const now = performance.now();
        if (this.lastFrameTime) {
            this.fps = 1000 / (now - this.lastFrameTime);
        }
        this.lastFrameTime = now;

        // 1. 将状态映射到颜色
        this.colorMapper.mapToImageData(state, this.imageData, this.gridSize);

        // 2. 绘制到离屏画布
        this.offscreenCtx.putImageData(this.imageData, 0, 0);

        // 3. 清空主画布
        this.ctx.fillStyle = this.colorMapper.getBackgroundColor();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 4. 绘制到主画布（放大）
        if (this.crtEnabled) {
            this.renderWithCRT();
        } else {
            this.renderSimple();
        }
    }

    /**
     * 简单渲染（无 CRT 效果）
     */
    renderSimple() {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(
            this.offscreenCanvas,
            0, 0, this.gridSize, this.gridSize,
            0, 0, this.canvas.width, this.canvas.height
        );
    }

    /**
     * CRT 效果渲染
     */
    renderWithCRT() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 应用轻微闪烁
        if (this.flickerIntensity > 0) {
            const flicker = 1 - this.flickerIntensity * Math.random();
            ctx.globalAlpha = flicker;
        }

        // 发光效果
        if (this.glowEnabled && this.glowAmount > 0) {
            ctx.shadowColor = this.colorMapper.getGlowColor();
            ctx.shadowBlur = this.glowAmount * 20;
        }

        // 绘制主图像
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            this.offscreenCanvas,
            0, 0, this.gridSize, this.gridSize,
            0, 0, w, h
        );

        // 重置阴影
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // 扫描线效果
        if (this.scanlineIntensity > 0) {
            this.drawScanlines();
        }

        // 暗角效果
        if (this.vignetteIntensity > 0) {
            this.drawVignette();
        }
    }

    /**
     * 绘制扫描线
     */
    drawScanlines() {
        const ctx = this.ctx;
        const h = this.canvas.height;
        const w = this.canvas.width;

        ctx.fillStyle = `rgba(0, 0, 0, ${this.scanlineIntensity})`;

        // 每隔一行绘制暗线
        const lineHeight = Math.max(2, Math.floor(h / this.gridSize));
        for (let y = 0; y < h; y += lineHeight * 2) {
            ctx.fillRect(0, y, w, lineHeight);
        }
    }

    /**
     * 绘制暗角效果
     */
    drawVignette() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.max(w, h) * 0.7;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.vignetteIntensity})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * 获取画布坐标对应的网格坐标
     */
    canvasToGrid(canvasX, canvasY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (canvasX - rect.left) / rect.width * this.gridSize;
        const y = (canvasY - rect.top) / rect.height * this.gridSize;
        return {
            x: Math.floor(x),
            y: Math.floor(y)
        };
    }

    /**
     * 获取网格坐标对应的画布坐标
     */
    gridToCanvas(gridX, gridY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = gridX / this.gridSize * rect.width + rect.left;
        const y = gridY / this.gridSize * rect.height + rect.top;
        return { x, y };
    }

    /**
     * 获取 FPS
     */
    getFPS() {
        return Math.round(this.fps);
    }

    /**
     * 获取颜色映射器
     */
    getColorMapper() {
        return this.colorMapper;
    }

    /**
     * CRT 开机动画
     */
    async playBootAnimation() {
        return new Promise(resolve => {
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            const primary = this.colorMapper.getPrimaryColor();

            let frame = 0;
            const totalFrames = 30;

            const animate = () => {
                frame++;
                const progress = frame / totalFrames;

                // 清空
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, w, h);

                if (progress < 0.3) {
                    // 白色闪光
                    const intensity = Math.sin(progress / 0.3 * Math.PI);
                    ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.5})`;
                    ctx.fillRect(0, 0, w, h);
                } else if (progress < 0.6) {
                    // 水平线展开
                    const lineProgress = (progress - 0.3) / 0.3;
                    const lineHeight = lineProgress * h;
                    ctx.fillStyle = primary;
                    ctx.fillRect(0, h / 2 - lineHeight / 2, w, lineHeight);
                } else {
                    // 正常显示
                    const fadeIn = (progress - 0.6) / 0.4;
                    ctx.globalAlpha = fadeIn;
                }

                if (frame < totalFrames) {
                    requestAnimationFrame(animate);
                } else {
                    ctx.globalAlpha = 1;
                    resolve();
                }
            };

            animate();
        });
    }
}
