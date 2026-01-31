/**
 * 音频转种子
 * 从音乐文件中提取特征生成 Lenia 初始状态
 */

/**
 * 从音频文件生成 Lenia 状态
 * @param {File} file - 音频文件
 * @param {number} gridSize - 网格大小
 * @param {boolean} rgb - 是否生成 RGB 三通道
 * @returns {Promise<{state: Float64Array|Float64Array[], seed: number}>}
 */
export async function audioToState(file, gridSize, rgb = false) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 读取文件
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 获取音频数据
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // 分析音频特征
    const features = analyzeAudio(channelData, sampleRate, gridSize);

    // 生成数字种子（用于音乐风格）
    const seed = generateSeedFromFeatures(features);

    // 生成状态
    let state;
    if (rgb) {
        state = generateRGBStateFromAudio(features, gridSize);
    } else {
        state = generateStateFromAudio(features, gridSize);
    }

    audioContext.close();

    return { state, seed, features };
}

/**
 * 分析音频特征
 */
function analyzeAudio(channelData, sampleRate, gridSize) {
    const fftSize = 2048;
    const numSegments = gridSize;
    const segmentSize = Math.floor(channelData.length / numSegments);

    // 频谱数据
    const spectrum = new Float64Array(gridSize);
    // 节奏/能量包络
    const envelope = new Float64Array(gridSize);
    // 过零率（音色亮度）
    const zeroCrossing = new Float64Array(gridSize);

    for (let i = 0; i < numSegments; i++) {
        const start = i * segmentSize;
        const end = Math.min(start + segmentSize, channelData.length);
        const segment = channelData.slice(start, end);

        // RMS 能量
        let rms = 0;
        let zc = 0;
        for (let j = 0; j < segment.length; j++) {
            rms += segment[j] * segment[j];
            if (j > 0 && segment[j] * segment[j-1] < 0) zc++;
        }
        envelope[i] = Math.sqrt(rms / segment.length);
        zeroCrossing[i] = zc / segment.length;

        // 简单频谱估计（低频/高频比）
        let lowFreq = 0, highFreq = 0;
        const mid = Math.floor(segment.length / 2);
        for (let j = 0; j < mid; j++) {
            lowFreq += Math.abs(segment[j]);
            highFreq += Math.abs(segment[mid + j] || 0);
        }
        spectrum[i] = lowFreq / (highFreq + 0.001);
    }

    // 归一化
    normalize(envelope);
    normalize(zeroCrossing);
    normalize(spectrum);

    // 整体特征
    const avgEnergy = envelope.reduce((a, b) => a + b) / envelope.length;
    const avgBrightness = zeroCrossing.reduce((a, b) => a + b) / zeroCrossing.length;

    return {
        envelope,
        spectrum,
        zeroCrossing,
        avgEnergy,
        avgBrightness,
        duration: channelData.length / sampleRate
    };
}

/**
 * 归一化数组
 */
function normalize(arr) {
    let max = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > max) max = arr[i];
    }
    if (max > 0) {
        for (let i = 0; i < arr.length; i++) {
            arr[i] /= max;
        }
    }
}

/**
 * 从特征生成数字种子
 */
function generateSeedFromFeatures(features) {
    // 用音频特征的哈希生成种子
    let hash = 0;
    for (let i = 0; i < features.envelope.length; i += 10) {
        hash = ((hash << 5) - hash + Math.floor(features.envelope[i] * 1000)) | 0;
        hash = ((hash << 5) - hash + Math.floor(features.spectrum[i] * 1000)) | 0;
    }
    return Math.abs(hash);
}

/**
 * 从音频特征生成单通道状态
 */
function generateStateFromAudio(features, gridSize) {
    const state = new Float64Array(gridSize * gridSize);
    const { envelope, spectrum, zeroCrossing } = features;

    const centerX = gridSize / 2;
    const centerY = gridSize / 2;
    const maxRadius = gridSize * 0.4;

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) + Math.PI; // 0 to 2PI

            // 用角度索引音频特征
            const angleIndex = Math.floor((angle / (2 * Math.PI)) * gridSize);
            const radiusIndex = Math.floor((dist / maxRadius) * gridSize);

            if (dist < maxRadius && radiusIndex < gridSize) {
                // 混合多种特征
                const e = envelope[angleIndex] || 0;
                const s = spectrum[radiusIndex] || 0;
                const z = zeroCrossing[angleIndex] || 0;

                // 波浪形状
                const wave = Math.sin(angle * 3 + e * 5) * 0.5 + 0.5;
                const radialFade = 1 - (dist / maxRadius);

                state[y * gridSize + x] = e * s * wave * radialFade * 0.8 + z * 0.2;
            }
        }
    }

    return state;
}

/**
 * 从音频特征生成 RGB 三通道状态
 */
function generateRGBStateFromAudio(features, gridSize) {
    const rState = new Float64Array(gridSize * gridSize);
    const gState = new Float64Array(gridSize * gridSize);
    const bState = new Float64Array(gridSize * gridSize);

    const { envelope, spectrum, zeroCrossing } = features;

    const centerX = gridSize / 2;
    const centerY = gridSize / 2;
    const maxRadius = gridSize * 0.4;

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) + Math.PI;

            const angleIndex = Math.floor((angle / (2 * Math.PI)) * gridSize);
            const radiusIndex = Math.floor((dist / maxRadius) * gridSize);

            if (dist < maxRadius && radiusIndex < gridSize) {
                const e = envelope[angleIndex] || 0;
                const s = spectrum[radiusIndex] || 0;
                const z = zeroCrossing[angleIndex] || 0;
                const radialFade = 1 - (dist / maxRadius);

                // 红色通道：能量 + 低频
                const rWave = Math.sin(angle * 2 + e * 4) * 0.5 + 0.5;
                rState[y * gridSize + x] = e * rWave * radialFade;

                // 绿色通道：频谱 + 中频
                const gWave = Math.sin(angle * 3 + s * 5) * 0.5 + 0.5;
                gState[y * gridSize + x] = s * gWave * radialFade;

                // 蓝色通道：亮度 + 高频
                const bWave = Math.sin(angle * 4 + z * 6) * 0.5 + 0.5;
                bState[y * gridSize + x] = z * bWave * radialFade;
            }
        }
    }

    return [rState, gState, bState];
}

/**
 * 从音频特征推荐 Lenia 参数
 */
export function suggestParamsFromAudio(features) {
    const { avgEnergy, avgBrightness } = features;

    return {
        // 高能量 = 大半径
        R: Math.floor(8 + avgEnergy * 8),
        // 亮度影响生长点
        mu: 0.12 + avgBrightness * 0.1,
        sigma: 0.05 + avgEnergy * 0.05,
        dt: 0.05
    };
}
