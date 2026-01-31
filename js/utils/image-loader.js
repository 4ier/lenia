/**
 * 图片加载器
 * 将上传的图片转换为 Lenia 初始状态
 */

/**
 * 从 File 对象加载图片并转换为状态数组
 * @param {File} file - 图片文件
 * @param {number} targetSize - 目标网格大小
 * @param {boolean} rgb - 是否保留 RGB 通道
 * @returns {Promise<Float64Array|Float64Array[]>} 归一化的状态数组
 */
export async function loadImageAsState(file, targetSize, rgb = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                try {
                    const state = rgb
                        ? imageToRGBState(img, targetSize)
                        : imageToState(img, targetSize);
                    resolve(state);
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * 将 Image 对象转换为 RGB 状态数组
 * @param {HTMLImageElement} img - 图片元素
 * @param {number} targetSize - 目标网格大小
 * @returns {Float64Array[]} RGB 三通道数组
 */
function imageToRGBState(img, targetSize) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const scale = Math.min(targetSize / img.width, targetSize / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = (targetSize - scaledWidth) / 2;
    const offsetY = (targetSize - scaledHeight) / 2;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetSize, targetSize);
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const pixels = imageData.data;

    const rState = new Float64Array(targetSize * targetSize);
    const gState = new Float64Array(targetSize * targetSize);
    const bState = new Float64Array(targetSize * targetSize);

    for (let i = 0; i < rState.length; i++) {
        const pixelIndex = i * 4;
        const a = pixels[pixelIndex + 3] / 255;

        rState[i] = (pixels[pixelIndex] / 255) * a;
        gState[i] = (pixels[pixelIndex + 1] / 255) * a;
        bState[i] = (pixels[pixelIndex + 2] / 255) * a;
    }

    return [rState, gState, bState];
}

/**
 * 将 Image 对象转换为灰度状态数组
 * @param {HTMLImageElement} img - 图片元素
 * @param {number} targetSize - 目标网格大小
 * @returns {Float64Array} 归一化的灰度值数组
 */
function imageToState(img, targetSize) {
    // 创建临时 canvas 进行缩放和处理
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    // 计算缩放，保持宽高比并居中
    const scale = Math.min(targetSize / img.width, targetSize / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = (targetSize - scaledWidth) / 2;
    const offsetY = (targetSize - scaledHeight) / 2;

    // 填充黑色背景
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetSize, targetSize);

    // 绘制缩放后的图片
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

    // 获取像素数据
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const pixels = imageData.data;

    // 转换为灰度值 (0-1)
    const state = new Float64Array(targetSize * targetSize);

    for (let i = 0; i < state.length; i++) {
        const pixelIndex = i * 4;
        const r = pixels[pixelIndex];
        const g = pixels[pixelIndex + 1];
        const b = pixels[pixelIndex + 2];
        const a = pixels[pixelIndex + 3];

        // 使用感知亮度公式
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // 考虑 alpha 通道
        const alphaFactor = a / 255;

        state[i] = luminance * alphaFactor;
    }

    return state;
}

/**
 * 从 URL 加载图片作为状态
 * @param {string} url - 图片 URL
 * @param {number} targetSize - 目标网格大小
 * @returns {Promise<Float64Array>} 归一化的灰度值数组
 */
export async function loadImageFromURL(url, targetSize) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const state = imageToState(img, targetSize);
                resolve(state);
            } catch (err) {
                reject(err);
            }
        };

        img.onerror = () => reject(new Error('Failed to load image from URL'));
        img.src = url;
    });
}

/**
 * 应用阈值处理，使图案更清晰
 * @param {Float64Array} state - 状态数组
 * @param {number} threshold - 阈值 (0-1)
 * @returns {Float64Array} 处理后的数组
 */
export function applyThreshold(state, threshold = 0.3) {
    const result = new Float64Array(state.length);
    for (let i = 0; i < state.length; i++) {
        result[i] = state[i] > threshold ? state[i] : 0;
    }
    return result;
}

/**
 * 应用高斯模糊，使图案更平滑
 * @param {Float64Array} state - 状态数组
 * @param {number} size - 网格大小
 * @param {number} radius - 模糊半径
 * @returns {Float64Array} 模糊后的数组
 */
export function applyBlur(state, size, radius = 1) {
    const result = new Float64Array(state.length);
    const kernel = createGaussianKernel(radius);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let sum = 0;
            let weightSum = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const px = x + kx - halfKernel;
                    const py = y + ky - halfKernel;

                    if (px >= 0 && px < size && py >= 0 && py < size) {
                        const weight = kernel[ky][kx];
                        sum += state[py * size + px] * weight;
                        weightSum += weight;
                    }
                }
            }

            result[y * size + x] = sum / weightSum;
        }
    }

    return result;
}

/**
 * 创建高斯核
 */
function createGaussianKernel(radius) {
    const size = radius * 2 + 1;
    const kernel = [];
    const sigma = radius / 2;

    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            const dx = x - radius;
            const dy = y - radius;
            const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
            row.push(weight);
        }
        kernel.push(row);
    }

    return kernel;
}

/**
 * 反转图像（适用于白底黑图）
 * @param {Float64Array} state - 状态数组
 * @returns {Float64Array} 反转后的数组
 */
export function invertState(state) {
    const result = new Float64Array(state.length);
    for (let i = 0; i < state.length; i++) {
        result[i] = 1 - state[i];
    }
    return result;
}
