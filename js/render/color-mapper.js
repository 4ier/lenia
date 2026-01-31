/**
 * 单色调映射器
 * 将 0-1 的值映射到复古终端风格的颜色
 */

export const COLOR_THEMES = {
    green: {
        name: 'Green Phosphor',
        background: [10, 10, 10],
        primary: [51, 255, 51],
        glow: [100, 255, 100],
        mode: 'mono'
    },
    amber: {
        name: 'Amber',
        background: [10, 8, 5],
        primary: [255, 176, 0],
        glow: [255, 200, 50],
        mode: 'mono'
    },
    blue: {
        name: 'Blue',
        background: [5, 8, 15],
        primary: [100, 180, 255],
        glow: [150, 200, 255],
        mode: 'mono'
    },
    white: {
        name: 'White',
        background: [10, 10, 10],
        primary: [200, 200, 200],
        glow: [255, 255, 255],
        mode: 'mono'
    },
    rainbow: {
        name: 'Rainbow',
        background: [5, 5, 15],
        primary: [255, 255, 255],
        glow: [255, 255, 255],
        mode: 'rainbow'
    },
    fire: {
        name: 'Fire',
        background: [10, 5, 5],
        primary: [255, 100, 50],
        glow: [255, 200, 100],
        mode: 'fire'
    },
    ocean: {
        name: 'Ocean',
        background: [5, 10, 20],
        primary: [50, 150, 255],
        glow: [100, 200, 255],
        mode: 'ocean'
    },
    neon: {
        name: 'Neon',
        background: [10, 5, 15],
        primary: [255, 50, 255],
        glow: [255, 150, 255],
        mode: 'neon'
    }
};

export class ColorMapper {
    constructor(theme = 'green') {
        this.setTheme(theme);
        this.gamma = 1.0;
        this.glowIntensity = 0.3;
    }

    /**
     * 设置颜色主题
     */
    setTheme(themeName) {
        this.theme = COLOR_THEMES[themeName] || COLOR_THEMES.green;
        this.themeName = themeName;
    }

    /**
     * 获取当前主题
     */
    getTheme() {
        return this.themeName;
    }

    /**
     * 设置伽马校正
     */
    setGamma(gamma) {
        this.gamma = gamma;
    }

    /**
     * 设置发光强度
     */
    setGlowIntensity(intensity) {
        this.glowIntensity = intensity;
    }

    /**
     * 将值映射到 RGB
     * @param {number} value - 0-1 之间的值
     * @returns {number[]} [r, g, b] 数组
     */
    mapValue(value) {
        // 应用伽马校正
        const v = Math.pow(Math.min(1, Math.max(0, value)), this.gamma);

        const bg = this.theme.background;
        const primary = this.theme.primary;
        const glow = this.theme.glow;

        // 基础颜色插值
        let r = bg[0] + v * (primary[0] - bg[0]);
        let g = bg[1] + v * (primary[1] - bg[1]);
        let b = bg[2] + v * (primary[2] - bg[2]);

        // 高亮发光效果
        if (v > 0.7) {
            const glowAmount = (v - 0.7) / 0.3 * this.glowIntensity;
            r += (glow[0] - r) * glowAmount;
            g += (glow[1] - g) * glowAmount;
            b += (glow[2] - b) * glowAmount;
        }

        return [Math.floor(r), Math.floor(g), Math.floor(b)];
    }

    /**
     * 批量映射到 ImageData
     * @param {Float64Array|Float64Array[]} state - 状态数组（单通道或多通道）
     * @param {ImageData} imageData - 目标 ImageData
     * @param {number} size - 网格大小
     */
    mapToImageData(state, imageData, size) {
        const data = imageData.data;
        const mode = this.theme.mode || 'mono';

        // 检测是否为多通道输入
        if (Array.isArray(state) && state.length === 3) {
            this.mapMultiChannel(state, data);
            return;
        }

        if (mode === 'mono') {
            this.mapMono(state, data);
        } else if (mode === 'rainbow') {
            this.mapRainbow(state, data);
        } else if (mode === 'fire') {
            this.mapFire(state, data);
        } else if (mode === 'ocean') {
            this.mapOcean(state, data);
        } else if (mode === 'neon') {
            this.mapNeon(state, data);
        }
    }

    /**
     * 多通道 RGB 直接映射
     */
    mapMultiChannel(states, data) {
        const bg = this.theme.background;
        const [rState, gState, bState] = states;
        const len = rState.length;

        for (let i = 0; i < len; i++) {
            const pixelIndex = i * 4;
            const r = Math.min(1, Math.max(0, rState[i]));
            const g = Math.min(1, Math.max(0, gState[i]));
            const b = Math.min(1, Math.max(0, bState[i]));

            // 混合背景色
            data[pixelIndex] = bg[0] + r * (255 - bg[0]);
            data[pixelIndex + 1] = bg[1] + g * (255 - bg[1]);
            data[pixelIndex + 2] = bg[2] + b * (255 - bg[2]);
            data[pixelIndex + 3] = 255;
        }
    }

    /**
     * 单色映射
     */
    mapMono(state, data) {
        const bg = this.theme.background;
        const primary = this.theme.primary;
        const glow = this.theme.glow;
        const gamma = this.gamma;
        const glowIntensity = this.glowIntensity;

        for (let i = 0; i < state.length; i++) {
            const v = Math.pow(Math.min(1, Math.max(0, state[i])), gamma);
            const pixelIndex = i * 4;

            let r = bg[0] + v * (primary[0] - bg[0]);
            let g = bg[1] + v * (primary[1] - bg[1]);
            let b = bg[2] + v * (primary[2] - bg[2]);

            if (v > 0.7) {
                const glowAmount = (v - 0.7) / 0.3 * glowIntensity;
                r += (glow[0] - r) * glowAmount;
                g += (glow[1] - g) * glowAmount;
                b += (glow[2] - b) * glowAmount;
            }

            data[pixelIndex] = r;
            data[pixelIndex + 1] = g;
            data[pixelIndex + 2] = b;
            data[pixelIndex + 3] = 255;
        }
    }

    /**
     * 彩虹映射
     */
    mapRainbow(state, data) {
        const bg = this.theme.background;

        for (let i = 0; i < state.length; i++) {
            const v = Math.min(1, Math.max(0, state[i]));
            const pixelIndex = i * 4;

            if (v < 0.01) {
                data[pixelIndex] = bg[0];
                data[pixelIndex + 1] = bg[1];
                data[pixelIndex + 2] = bg[2];
            } else {
                // HSL to RGB, H = v * 270 (紫到红)
                const h = (1 - v) * 270;
                const s = 0.8 + v * 0.2;
                const l = 0.3 + v * 0.4;
                const [r, g, b] = this.hslToRgb(h / 360, s, l);
                data[pixelIndex] = r;
                data[pixelIndex + 1] = g;
                data[pixelIndex + 2] = b;
            }
            data[pixelIndex + 3] = 255;
        }
    }

    /**
     * 火焰映射
     */
    mapFire(state, data) {
        const bg = this.theme.background;

        for (let i = 0; i < state.length; i++) {
            const v = Math.min(1, Math.max(0, state[i]));
            const pixelIndex = i * 4;

            if (v < 0.01) {
                data[pixelIndex] = bg[0];
                data[pixelIndex + 1] = bg[1];
                data[pixelIndex + 2] = bg[2];
            } else {
                // 黑 → 红 → 橙 → 黄 → 白
                let r, g, b;
                if (v < 0.33) {
                    const t = v / 0.33;
                    r = t * 200;
                    g = 0;
                    b = 0;
                } else if (v < 0.66) {
                    const t = (v - 0.33) / 0.33;
                    r = 200 + t * 55;
                    g = t * 150;
                    b = 0;
                } else {
                    const t = (v - 0.66) / 0.34;
                    r = 255;
                    g = 150 + t * 105;
                    b = t * 200;
                }
                data[pixelIndex] = r;
                data[pixelIndex + 1] = g;
                data[pixelIndex + 2] = b;
            }
            data[pixelIndex + 3] = 255;
        }
    }

    /**
     * 海洋映射
     */
    mapOcean(state, data) {
        const bg = this.theme.background;

        for (let i = 0; i < state.length; i++) {
            const v = Math.min(1, Math.max(0, state[i]));
            const pixelIndex = i * 4;

            if (v < 0.01) {
                data[pixelIndex] = bg[0];
                data[pixelIndex + 1] = bg[1];
                data[pixelIndex + 2] = bg[2];
            } else {
                // 深蓝 → 青 → 浅蓝 → 白
                let r, g, b;
                if (v < 0.5) {
                    const t = v / 0.5;
                    r = 10 + t * 30;
                    g = 30 + t * 150;
                    b = 80 + t * 120;
                } else {
                    const t = (v - 0.5) / 0.5;
                    r = 40 + t * 180;
                    g = 180 + t * 75;
                    b = 200 + t * 55;
                }
                data[pixelIndex] = r;
                data[pixelIndex + 1] = g;
                data[pixelIndex + 2] = b;
            }
            data[pixelIndex + 3] = 255;
        }
    }

    /**
     * 霓虹映射
     */
    mapNeon(state, data) {
        const bg = this.theme.background;

        for (let i = 0; i < state.length; i++) {
            const v = Math.min(1, Math.max(0, state[i]));
            const pixelIndex = i * 4;

            if (v < 0.01) {
                data[pixelIndex] = bg[0];
                data[pixelIndex + 1] = bg[1];
                data[pixelIndex + 2] = bg[2];
            } else {
                // 紫 → 粉 → 青 循环
                const h = (v * 2) % 1;  // 循环两次
                const s = 1;
                const l = 0.4 + v * 0.3;
                const hue = 0.75 + h * 0.5; // 紫色到青色范围
                const [r, g, b] = this.hslToRgb(hue % 1, s, l);
                data[pixelIndex] = r;
                data[pixelIndex + 1] = g;
                data[pixelIndex + 2] = b;
            }
            data[pixelIndex + 3] = 255;
        }
    }

    /**
     * HSL 转 RGB
     */
    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * 获取 CSS 颜色值
     */
    getPrimaryColor() {
        const p = this.theme.primary;
        return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
    }

    /**
     * 获取 CSS 背景色
     */
    getBackgroundColor() {
        const bg = this.theme.background;
        return `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
    }

    /**
     * 获取 CSS 发光色
     */
    getGlowColor() {
        const g = this.theme.glow;
        return `rgb(${g[0]}, ${g[1]}, ${g[2]})`;
    }
}
