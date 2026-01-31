/**
 * 环境音乐合成器 v2
 * 更有音乐性的生成式音乐
 */

export class AmbientSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isEnabled = false;
        this.isInitialized = false;

        // 效果器
        this.reverbNode = null;
        this.reverbGain = null;
        this.delayNode = null;
        this.delayGain = null;
        this.filterNode = null;

        // 音色参数
        this.params = {
            tempo: 0.5,         // 节奏密度
            reverb: 0.4,        // 混响量
            warmth: 0.5,        // 温暖度
            volume: 0.3         // 总音量
        };

        // Lenia 状态
        this.stats = { mass: 0, centerX: 128, centerY: 128, velocity: 0 };
        this.prevMass = 0;

        // 音乐状态
        this.lastNoteTime = 0;
        this.noteInterval = 300; // ms
        this.currentChordIndex = 0;
        this.arpIndex = 0;

        // 不同调式的音阶 (会根据 seed 选择)
        this.scales = [
            [261.63, 293.66, 329.63, 392.00, 440.00],           // C 五声 (明亮)
            [220.00, 246.94, 261.63, 329.63, 369.99],           // A 小调五声 (忧郁)
            [293.66, 329.63, 369.99, 440.00, 493.88],           // D 五声 (温暖)
            [196.00, 220.00, 261.63, 293.66, 329.63],           // G 五声 (平静)
            [174.61, 196.00, 220.00, 261.63, 293.66],           // F 五声 (柔和)
            [246.94, 277.18, 329.63, 369.99, 415.30],           // B 五声 (神秘)
        ];

        // 不同的和弦进行模式
        this.progressionPatterns = [
            [[0,2,4], [3,0,2], [4,1,3], [3,0,2]],               // 流行
            [[0,2,4], [4,1,3], [3,0,2], [4,1,3]],               // 民谣
            [[0,2,4], [1,3,0], [2,4,1], [0,2,4]],               // 上行
            [[4,1,3], [3,0,2], [2,4,1], [0,2,4]],               // 下行
            [[0,2,4], [2,4,1], [4,1,3], [2,4,1]],               // 跳跃
            [[0,4,2], [3,2,0], [4,3,1], [0,4,2]],               // 开放
        ];

        // 节奏模式 (音符间隔的变化)
        this.rhythmPatterns = [
            [1, 1, 1, 1],           // 均匀
            [1.5, 0.5, 1, 1],       // 摇摆
            [1, 0.5, 0.5, 2],       // 切分
            [0.5, 0.5, 1, 2],       // 加速
            [2, 1, 0.5, 0.5],       // 减速
            [1, 1, 2, 1],           // 停顿
        ];

        // 当前使用的音乐参数 (由 seed 决定)
        this.currentScale = this.scales[0];
        this.currentProgression = this.progressionPatterns[0];
        this.currentRhythm = this.rhythmPatterns[0];
        this.rhythmIndex = 0;
        this.baseOctaveShift = 0;
        this.oscType1 = 'sine';
        this.oscType2 = 'triangle';

        // 活跃的音符
        this.activeNotes = [];
        this.currentSeed = 0;
    }

    /**
     * 初始化
     */
    async init() {
        if (this.isInitialized) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // 主增益
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0;
            this.masterGain.connect(this.ctx.destination);

            // 创建效果链
            await this.createEffects();

            this.isInitialized = true;
        } catch (e) {
            console.error('AmbientSynth init failed:', e);
        }
    }

    /**
     * 创建效果器
     */
    async createEffects() {
        // 低通滤波器
        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 2000;
        this.filterNode.Q.value = 1;
        this.filterNode.connect(this.masterGain);

        // 延迟
        this.delayNode = this.ctx.createDelay(1);
        this.delayNode.delayTime.value = 0.3;
        this.delayGain = this.ctx.createGain();
        this.delayGain.gain.value = 0.25;
        this.delayNode.connect(this.delayGain);
        this.delayGain.connect(this.filterNode);
        // 反馈
        this.delayGain.connect(this.delayNode);

        // 混响
        this.reverbNode = this.ctx.createConvolver();
        this.reverbNode.buffer = this.createReverbImpulse();
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = this.params.reverb;
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
    }

    /**
     * 创建混响脉冲
     */
    createReverbImpulse() {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * 2.5;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const decay = Math.pow(1 - i / length, 1.5);
            left[i] = (Math.random() * 2 - 1) * decay;
            right[i] = (Math.random() * 2 - 1) * decay;
        }

        return impulse;
    }

    /**
     * 根据 seed 设置音乐风格
     */
    setSeed(seed) {
        this.currentSeed = seed;

        // 用 seed 的不同位选择不同参数
        const scaleIdx = seed % this.scales.length;
        const progIdx = (seed >> 4) % this.progressionPatterns.length;
        const rhythmIdx = (seed >> 8) % this.rhythmPatterns.length;
        const octaveShift = ((seed >> 12) % 3) - 1; // -1, 0, 1

        this.currentScale = this.scales[scaleIdx];
        this.currentProgression = this.progressionPatterns[progIdx];
        this.currentRhythm = this.rhythmPatterns[rhythmIdx];
        this.baseOctaveShift = octaveShift;

        // 振荡器类型
        const oscTypes = ['sine', 'triangle', 'square'];
        this.oscType1 = oscTypes[(seed >> 2) % 2]; // sine 或 triangle
        this.oscType2 = oscTypes[((seed >> 6) % 2) + 1]; // triangle 或 square

        // 重置节奏索引
        this.rhythmIndex = 0;
        this.arpIndex = 0;

        console.log(`Audio seed ${seed.toString(16)}: scale=${scaleIdx}, prog=${progIdx}, rhythm=${rhythmIdx}, octave=${octaveShift}`);
    }

    /**
     * 播放单个音符
     */
    playNote(freq, duration = 0.8, velocity = 0.3) {
        if (!this.ctx || !this.isEnabled) return;

        const now = this.ctx.currentTime;

        // 振荡器
        const osc = this.ctx.createOscillator();
        osc.type = this.oscType1;
        osc.frequency.setValueAtTime(freq, now);

        // 第二个振荡器（微微走调，增加厚度）
        const osc2 = this.ctx.createOscillator();
        osc2.type = this.oscType2;
        osc2.frequency.setValueAtTime(freq * 1.003, now);

        // 包络
        const envelope = this.ctx.createGain();
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(velocity, now + 0.02);
        envelope.gain.exponentialRampToValueAtTime(velocity * 0.3, now + duration * 0.3);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // 连接
        osc.connect(envelope);
        osc2.connect(envelope);
        envelope.connect(this.filterNode);
        envelope.connect(this.delayNode);
        envelope.connect(this.reverbNode);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + duration + 0.1);
        osc2.stop(now + duration + 0.1);
    }

    /**
     * 播放和弦琶音
     */
    playArpeggio(chordNotes, octave = 0, velocity = 0.2) {
        const baseOctave = 1 + octave + this.baseOctaveShift;
        const noteIdx = chordNotes[this.arpIndex % chordNotes.length];
        const freq = this.currentScale[noteIdx % this.currentScale.length];
        const finalFreq = freq * Math.pow(2, Math.max(0, baseOctave - 1));

        // 节奏变化
        const rhythmMult = this.currentRhythm[this.rhythmIndex % this.currentRhythm.length];
        const duration = 0.5 * rhythmMult;

        this.playNote(finalFreq, duration, velocity);
        this.arpIndex++;
        this.rhythmIndex++;
    }

    /**
     * 启用
     */
    async enable() {
        if (!this.isInitialized) {
            await this.init();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.isEnabled = true;
        this.fadeIn();
    }

    /**
     * 禁用
     */
    disable() {
        this.isEnabled = false;
        this.fadeOut();
    }

    /**
     * 切换
     */
    async toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            await this.enable();
        }
        return this.isEnabled;
    }

    /**
     * 淡入
     */
    fadeIn() {
        if (!this.masterGain) return;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(this.params.volume, now + 1);
    }

    /**
     * 淡出
     */
    fadeOut() {
        if (!this.masterGain) return;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + 1);
    }

    /**
     * 更新状态
     */
    updateStats(stats) {
        this.prevMass = this.stats.mass;
        this.stats = stats;
    }

    /**
     * 每帧更新
     */
    update() {
        if (!this.isEnabled || !this.isInitialized) return;

        const now = performance.now();
        const stats = this.stats;

        // 归一化
        const normMass = Math.min(1, stats.mass / 3000);
        const normVelocity = Math.min(1, stats.velocity / 1.5);
        const normX = stats.centerX / 256;
        const normY = stats.centerY / 256;

        // 质量变化检测
        const massDelta = Math.abs(stats.mass - this.prevMass);
        const massChanging = massDelta > 10;

        // 动态调整音符间隔
        // 质量大、速度快 = 音符更密集
        const baseInterval = 400 - this.params.tempo * 200;
        this.noteInterval = baseInterval - normMass * 150 - normVelocity * 100;
        this.noteInterval = Math.max(150, Math.min(600, this.noteInterval));

        // 更新滤波器（基于质量）
        const filterFreq = 800 + normMass * 3000 * this.params.warmth;
        this.filterNode.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.3);

        // 延迟时间（基于速度）
        const delayTime = 0.15 + (1 - normVelocity) * 0.25;
        this.delayNode.delayTime.setTargetAtTime(delayTime, this.ctx.currentTime, 0.5);

        // 和弦选择（基于位置）
        const chordIndex = Math.floor(normX * this.currentProgression.length);
        if (chordIndex !== this.currentChordIndex) {
            this.currentChordIndex = chordIndex;
            this.arpIndex = 0; // 重置琶音
        }

        // 播放音符
        if (now - this.lastNoteTime > this.noteInterval && normMass > 0.01) {
            const chord = this.currentProgression[this.currentChordIndex % this.currentProgression.length];

            // 八度基于 Y 位置
            const octave = Math.floor((1 - normY) * 2);

            // 力度基于质量和速度
            const velocity = 0.1 + normMass * 0.15 + normVelocity * 0.1;

            this.playArpeggio(chord, octave, Math.min(0.35, velocity));

            // 偶尔加个低音
            if (this.arpIndex % 4 === 0 && normMass > 0.3) {
                const bassIdx = chord[0] % this.currentScale.length;
                const bassNote = this.currentScale[bassIdx] * 0.5;
                this.playNote(bassNote, 1.2, velocity * 0.6);
            }

            // 速度快时加装饰音
            if (normVelocity > 0.5 && Math.random() < 0.3) {
                setTimeout(() => {
                    const highIdx = chord[2 % chord.length] % this.currentScale.length;
                    const highNote = this.currentScale[highIdx] * 4;
                    this.playNote(highNote, 0.3, velocity * 0.4);
                }, 50);
            }

            this.lastNoteTime = now;
        }

        // 质量剧烈变化时触发特殊音效
        if (massChanging && massDelta > 50) {
            const sparkleFreq = 800 + Math.random() * 400;
            this.playNote(sparkleFreq, 0.2, 0.15);
        }
    }

    /**
     * 设置参数
     */
    setParam(key, value) {
        if (key in this.params) {
            this.params[key] = value;

            if (key === 'volume' && this.isEnabled && this.masterGain) {
                this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.3);
            }
            if (key === 'reverb' && this.reverbGain) {
                this.reverbGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.3);
            }
        }
    }

    /**
     * 获取参数
     */
    getParams() {
        return { ...this.params };
    }

    /**
     * 获取启用状态
     */
    getIsEnabled() {
        return this.isEnabled;
    }

    /**
     * 销毁
     */
    destroy() {
        this.disable();
        if (this.ctx) {
            this.ctx.close();
        }
    }
}
