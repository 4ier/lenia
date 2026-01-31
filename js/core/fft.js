/**
 * FFT 2D - 快速傅里叶变换实现
 * 用于加速 Lenia 的卷积运算
 */

export class FFT2D {
    constructor(size) {
        this.size = size;
        this.log2n = Math.log2(size);

        // 预计算旋转因子
        this.cosTable = new Float64Array(size / 2);
        this.sinTable = new Float64Array(size / 2);

        for (let i = 0; i < size / 2; i++) {
            const angle = -2 * Math.PI * i / size;
            this.cosTable[i] = Math.cos(angle);
            this.sinTable[i] = Math.sin(angle);
        }

        // 位反转查找表
        this.bitReverse = new Uint32Array(size);
        for (let i = 0; i < size; i++) {
            this.bitReverse[i] = this.reverseBits(i, this.log2n);
        }
    }

    /**
     * 位反转
     */
    reverseBits(x, bits) {
        let result = 0;
        for (let i = 0; i < bits; i++) {
            result = (result << 1) | (x & 1);
            x >>= 1;
        }
        return result;
    }

    /**
     * 1D FFT (原地变换)
     * @param {Float64Array} real - 实部数组
     * @param {Float64Array} imag - 虚部数组
     * @param {boolean} inverse - 是否逆变换
     */
    fft1D(real, imag, inverse = false) {
        const n = this.size;
        const sign = inverse ? 1 : -1;

        // 位反转重排
        for (let i = 0; i < n; i++) {
            const j = this.bitReverse[i];
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }

        // Cooley-Tukey 蝶形运算
        for (let len = 2; len <= n; len *= 2) {
            const halfLen = len / 2;
            const tableStep = n / len;

            for (let i = 0; i < n; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const idx = j * tableStep;
                    const cos = this.cosTable[idx];
                    const sin = sign * this.sinTable[idx];

                    const evenIdx = i + j;
                    const oddIdx = i + j + halfLen;

                    const tReal = real[oddIdx] * cos - imag[oddIdx] * sin;
                    const tImag = real[oddIdx] * sin + imag[oddIdx] * cos;

                    real[oddIdx] = real[evenIdx] - tReal;
                    imag[oddIdx] = imag[evenIdx] - tImag;
                    real[evenIdx] = real[evenIdx] + tReal;
                    imag[evenIdx] = imag[evenIdx] + tImag;
                }
            }
        }

        // 逆变换需要归一化
        if (inverse) {
            for (let i = 0; i < n; i++) {
                real[i] /= n;
                imag[i] /= n;
            }
        }
    }

    /**
     * 2D FFT
     * @param {Float64Array} real - 实部 2D 数组（按行存储）
     * @param {Float64Array} imag - 虚部 2D 数组
     * @param {boolean} inverse - 是否逆变换
     */
    fft2D(real, imag, inverse = false) {
        const n = this.size;

        // 临时行/列缓冲区
        const tempReal = new Float64Array(n);
        const tempImag = new Float64Array(n);

        // 对每行进行 FFT
        for (let y = 0; y < n; y++) {
            const offset = y * n;
            for (let x = 0; x < n; x++) {
                tempReal[x] = real[offset + x];
                tempImag[x] = imag[offset + x];
            }
            this.fft1D(tempReal, tempImag, inverse);
            for (let x = 0; x < n; x++) {
                real[offset + x] = tempReal[x];
                imag[offset + x] = tempImag[x];
            }
        }

        // 对每列进行 FFT
        for (let x = 0; x < n; x++) {
            for (let y = 0; y < n; y++) {
                tempReal[y] = real[y * n + x];
                tempImag[y] = imag[y * n + x];
            }
            this.fft1D(tempReal, tempImag, inverse);
            for (let y = 0; y < n; y++) {
                real[y * n + x] = tempReal[y];
                imag[y * n + x] = tempImag[y];
            }
        }
    }

    /**
     * 前向 FFT
     */
    forward(real, imag) {
        this.fft2D(real, imag, false);
    }

    /**
     * 逆 FFT
     */
    inverse(real, imag) {
        this.fft2D(real, imag, true);
    }
}

/**
 * 复数乘法 (用于频域卷积)
 */
export function complexMultiply(aReal, aImag, bReal, bImag, outReal, outImag) {
    const n = aReal.length;
    for (let i = 0; i < n; i++) {
        outReal[i] = aReal[i] * bReal[i] - aImag[i] * bImag[i];
        outImag[i] = aReal[i] * bImag[i] + aImag[i] * bReal[i];
    }
}
