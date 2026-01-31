/**
 * localStorage 管理
 */

const STORAGE_PREFIX = 'lenia_';

export class Storage {
    /**
     * 保存数据
     */
    static save(key, data) {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(STORAGE_PREFIX + key, json);
            return true;
        } catch (e) {
            console.error('Storage save failed:', e);
            return false;
        }
    }

    /**
     * 加载数据
     */
    static load(key, defaultValue = null) {
        try {
            const json = localStorage.getItem(STORAGE_PREFIX + key);
            if (json === null) return defaultValue;
            return JSON.parse(json);
        } catch (e) {
            console.error('Storage load failed:', e);
            return defaultValue;
        }
    }

    /**
     * 删除数据
     */
    static remove(key) {
        try {
            localStorage.removeItem(STORAGE_PREFIX + key);
            return true;
        } catch (e) {
            console.error('Storage remove failed:', e);
            return false;
        }
    }

    /**
     * 检查是否存在
     */
    static exists(key) {
        return localStorage.getItem(STORAGE_PREFIX + key) !== null;
    }

    /**
     * 获取所有保存的配置名称
     */
    static getSavedConfigs() {
        const configs = [];
        const prefix = STORAGE_PREFIX + 'config_';
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                configs.push(key.substring(prefix.length));
            }
        }
        return configs;
    }

    /**
     * 保存配置
     */
    static saveConfig(name, config) {
        return this.save('config_' + name, {
            ...config,
            savedAt: Date.now()
        });
    }

    /**
     * 加载配置
     */
    static loadConfig(name) {
        return this.load('config_' + name);
    }

    /**
     * 删除配置
     */
    static deleteConfig(name) {
        return this.remove('config_' + name);
    }

    /**
     * 保存挑战进度
     */
    static saveChallengeProgress(progress) {
        return this.save('challenge_progress', progress);
    }

    /**
     * 加载挑战进度
     */
    static loadChallengeProgress() {
        return this.load('challenge_progress', {
            completed: [],
            scores: {},
            currentChallenge: null
        });
    }

    /**
     * 保存设置
     */
    static saveSettings(settings) {
        return this.save('settings', settings);
    }

    /**
     * 加载设置
     */
    static loadSettings() {
        return this.load('settings', {
            theme: 'green',
            crtEnabled: true,
            soundEnabled: true,
            multiChannel: true,
            audioEnabled: true,
            resolution: 128
        });
    }

    /**
     * 清除所有数据
     */
    static clearAll() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    /**
     * 获取存储使用情况
     */
    static getUsage() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                const value = localStorage.getItem(key);
                total += key.length + (value ? value.length : 0);
            }
        }
        return {
            bytes: total,
            kb: (total / 1024).toFixed(2)
        };
    }
}
