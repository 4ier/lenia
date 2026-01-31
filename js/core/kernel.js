/**
 * 核函数生成器
 * Lenia 使用环形核函数，通常是高斯钟形
 */

/**
 * 高斯函数
 */
function gaussian(x, mu, sigma) {
    return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
}

/**
 * 生成环形核函数
 * @param {number} size - 网格大小 (必须是 2 的幂)
 * @param {number} R - 核半径 (以网格单位计)
 * @param {Object} options - 核参数
 * @param {number} options.kernelMu - 核心峰值位置 (0-1, 默认 0.5)
 * @param {number} options.kernelSigma - 核心宽度 (默认 0.15)
 * @returns {Float64Array} 归一化的核函数 (按行存储的 2D 数组)
 */
export function generateKernel(size, R, options = {}) {
    const {
        kernelMu = 0.5,
        kernelSigma = 0.15
    } = options;

    const kernel = new Float64Array(size * size);
    let sum = 0;

    const center = size / 2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // 计算到中心的距离（考虑周期边界）
            let dx = x - center;
            let dy = y - center;

            // 周期边界处理
            if (dx > size / 2) dx -= size;
            if (dx < -size / 2) dx += size;
            if (dy > size / 2) dy -= size;
            if (dy < -size / 2) dy += size;

            const dist = Math.sqrt(dx * dx + dy * dy);
            const r = dist / R;  // 归一化距离

            // 环形核：在 r=kernelMu 处有峰值
            let value = 0;
            if (r < 1) {
                value = gaussian(r, kernelMu, kernelSigma);
            }

            kernel[y * size + x] = value;
            sum += value;
        }
    }

    // 归一化
    if (sum > 0) {
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }
    }

    return kernel;
}

/**
 * 将核函数移动到 FFT 友好的布局（中心移到角落）
 */
export function fftShift(kernel, size) {
    const shifted = new Float64Array(size * size);
    const half = size / 2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const newX = (x + half) % size;
            const newY = (y + half) % size;
            shifted[y * size + x] = kernel[newY * size + newX];
        }
    }

    return shifted;
}

/**
 * 预计算核函数的 FFT
 */
export function precomputeKernelFFT(fft, kernel, size) {
    const kernelReal = fftShift(kernel, size);
    const kernelImag = new Float64Array(size * size);

    fft.forward(kernelReal, kernelImag);

    return { real: kernelReal, imag: kernelImag };
}

/**
 * 多核叠加（高级 Lenia 扩展）
 */
export function generateMultiKernel(size, R, kernelParams) {
    const kernel = new Float64Array(size * size);

    for (const params of kernelParams) {
        const singleKernel = generateKernel(size, R * (params.scale || 1), {
            kernelMu: params.mu || 0.5,
            kernelSigma: params.sigma || 0.15
        });

        const weight = params.weight || 1;
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] += singleKernel[i] * weight;
        }
    }

    // 归一化
    let sum = 0;
    for (let i = 0; i < kernel.length; i++) {
        sum += kernel[i];
    }
    if (sum > 0) {
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }
    }

    return kernel;
}
