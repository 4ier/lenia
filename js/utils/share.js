/**
 * 紧凑分享链接
 * 将配置编码为短 URL 参数
 */

// Base64url 字符集
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * 数值转 base64url 字符串
 */
function toChars(value, length) {
    let num = BigInt(value);
    let out = '';
    for (let i = 0; i < length; i++) {
        const idx = Number(num & 63n);
        out += CHARSET[idx];
        num >>= 6n;
    }
    return out;
}

/**
 * base64url 字符串转数值
 */
function fromChars(str) {
    let value = 0n;
    for (let i = 0; i < str.length; i++) {
        const idx = CHARSET.indexOf(str[i]);
        if (idx < 0) return null;
        value |= BigInt(idx) << BigInt(6 * i);
    }
    return value;
}

/**
 * 编码配置到紧凑字符串
 *
 * 布局 (LSB first):
 * - 6 bits: R (5-66, offset by 5)
 * - 10 bits: mu * 1000 (0-1023)
 * - 8 bits: sigma * 1000 (0-255)
 * - 6 bits: dt * 100 (0-63)
 * - 16 bits: seed
 * 总共 46 bits → 8 chars
 */
export function encodeShare(params, seed) {
    let packed = 0n;
    let bits = 0n;

    const push = (val, numBits) => {
        const mask = (1n << BigInt(numBits)) - 1n;
        packed |= (BigInt(val) & mask) << bits;
        bits += BigInt(numBits);
    };

    // R: 5-66 → 0-61, 6 bits
    const R = Math.max(5, Math.min(66, Math.round(params.R))) - 5;
    push(R, 6);

    // mu: 0-1 → 0-1023, 10 bits
    const mu = Math.round(params.mu * 1000);
    push(mu, 10);

    // sigma: 0-0.255 → 0-255, 8 bits
    const sigma = Math.round(params.sigma * 1000);
    push(sigma, 8);

    // dt: 0-0.63 → 0-63, 6 bits
    const dt = Math.round(params.dt * 100);
    push(dt, 6);

    // seed: 0-65535, 16 bits
    push(seed & 0xFFFF, 16);

    return toChars(packed, 8);
}

/**
 * 解码紧凑字符串到配置
 */
export function decodeShare(code) {
    if (!code || code.length !== 8) return null;

    const value = fromChars(code);
    if (value === null) return null;

    let packed = value;

    const pull = (numBits) => {
        const mask = (1n << BigInt(numBits)) - 1n;
        const val = Number(packed & mask);
        packed >>= BigInt(numBits);
        return val;
    };

    const R = pull(6) + 5;
    const mu = pull(10) / 1000;
    const sigma = pull(8) / 1000;
    const dt = pull(6) / 100;
    const seed = pull(16);

    return {
        params: {
            R,
            mu,
            sigma,
            dt,
            kernelMu: 0.5,
            kernelSigma: 0.15
        },
        seed
    };
}

/**
 * 生成分享 URL
 */
export function generateShareURL(params, seed) {
    const code = encodeShare(params, seed);
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('s', code);
    return url.toString();
}

/**
 * 从 URL 加载分享配置
 */
export function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('s');
    if (!code) return null;
    return decodeShare(code);
}

/**
 * 复制到剪贴板
 */
export async function copyShareURL(params, seed) {
    const url = generateShareURL(params, seed);
    try {
        await navigator.clipboard.writeText(url);
        return { success: true, url };
    } catch (e) {
        return { success: false, url, error: e.message };
    }
}
