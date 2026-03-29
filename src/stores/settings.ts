import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AppSettings {
  pageSize: number
  defaultDateRange: 'today' | '3days' | '7days' | '30days' | 'all' // 默认查询天数
  autoRefresh: boolean
  refreshInterval: number // 自动刷新间隔（秒）
  autoUploadEnabled: boolean
  autoUploadInterval: number // 自动上传轮询间隔（秒）
}

const DEFAULT_SETTINGS: AppSettings = {
  pageSize: 10,
  defaultDateRange: 'today',
  autoRefresh: false,
  refreshInterval: 60,
  autoUploadEnabled: false,
  autoUploadInterval: 300,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  function updateSettings(newSettings: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...newSettings }
    saveToStorage()
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    saveToStorage()
  }

  function saveToStorage() {
    try {
      localStorage.setItem('appSettings', JSON.stringify(settings.value))
    } catch (error) {
      console.warn('保存设置失败:', error)
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('appSettings')
      if (saved) {
        const savedSettings = JSON.parse(saved) as AppSettings
        settings.value = { ...DEFAULT_SETTINGS, ...savedSettings }
      }
    } catch (error) {
      console.warn('加载设置失败:', error)
      settings.value = { ...DEFAULT_SETTINGS }
    }
  }

  return {
    settings,
    updateSettings,
    resetSettings,
    saveToStorage,
    loadFromStorage,
  }
})
