/**
 * 配置导出/导入功能
 */

/**
 * 导出配置为 JSON 文件
 */
export function exportConfig(config, filename = 'lenia-config.json') {
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        ...config
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * 从文件导入配置
 */
export function importConfig(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                resolve(config);
            } catch (error) {
                reject(new Error('Invalid JSON file'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * 验证配置格式
 */
export function validateConfig(config) {
    const errors = [];

    // 检查必需字段
    if (!config.params) {
        errors.push('Missing params');
    } else {
        if (typeof config.params.R !== 'number') errors.push('Invalid R');
        if (typeof config.params.mu !== 'number') errors.push('Invalid mu');
        if (typeof config.params.sigma !== 'number') errors.push('Invalid sigma');
    }

    // 检查状态数组
    if (config.state) {
        if (!Array.isArray(config.state)) {
            errors.push('State must be an array');
        } else {
            const expectedSize = config.size * config.size;
            if (config.state.length !== expectedSize) {
                errors.push(`State size mismatch: expected ${expectedSize}, got ${config.state.length}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 生成配置摘要
 */
export function generateConfigSummary(config) {
    const summary = [];

    if (config.params) {
        summary.push(`R=${config.params.R}`);
        summary.push(`μ=${config.params.mu}`);
        summary.push(`σ=${config.params.sigma}`);
    }

    if (config.stats) {
        summary.push(`Steps: ${config.stats.step}`);
        summary.push(`Mass: ${config.stats.mass.toFixed(0)}`);
    }

    return summary.join(' | ');
}

/**
 * 压缩状态数据（使用 RLE）
 */
export function compressState(state, threshold = 0.001) {
    const compressed = [];
    let currentValue = null;
    let count = 0;

    for (let i = 0; i < state.length; i++) {
        const value = state[i] < threshold ? 0 : Math.round(state[i] * 1000) / 1000;

        if (value === currentValue) {
            count++;
        } else {
            if (currentValue !== null) {
                compressed.push([currentValue, count]);
            }
            currentValue = value;
            count = 1;
        }
    }

    if (currentValue !== null) {
        compressed.push([currentValue, count]);
    }

    return compressed;
}

/**
 * 解压状态数据
 */
export function decompressState(compressed) {
    const state = [];

    for (const [value, count] of compressed) {
        for (let i = 0; i < count; i++) {
            state.push(value);
        }
    }

    return new Float64Array(state);
}

/**
 * 导出为紧凑格式
 */
export function exportCompact(config) {
    return {
        v: '1.0',
        s: config.size,
        p: config.params,
        d: compressState(config.state)
    };
}

/**
 * 从紧凑格式导入
 */
export function importCompact(compact) {
    return {
        version: compact.v,
        size: compact.s,
        params: compact.p,
        state: Array.from(decompressState(compact.d))
    };
}

/**
 * 复制配置到剪贴板
 */
export async function copyToClipboard(config) {
    const compact = exportCompact(config);
    const json = JSON.stringify(compact);
    const base64 = btoa(json);

    try {
        await navigator.clipboard.writeText(base64);
        return true;
    } catch (error) {
        console.error('Clipboard copy failed:', error);
        return false;
    }
}

/**
 * 从剪贴板粘贴配置
 */
export async function pasteFromClipboard() {
    try {
        const base64 = await navigator.clipboard.readText();
        const json = atob(base64);
        const compact = JSON.parse(json);
        return importCompact(compact);
    } catch (error) {
        console.error('Clipboard paste failed:', error);
        return null;
    }
}
