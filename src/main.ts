import './styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'

import App from './App.vue'
import router from './router'
import { useSettingsStore } from './stores/settings'
import { useApiConfigStore } from './stores/apiConfig'
import { useSessionStore } from './stores/session'

const pinia = createPinia()

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(naive)

// 初始化所有stores
const settingsStore = useSettingsStore()
const apiConfigStore = useApiConfigStore()
const sessionStore = useSessionStore()

// 加载持久化数据（不使用顶层 await，改用 Promise.then）
settingsStore.loadFromStorage()

Promise.resolve()
  .then(() => sessionStore.loadSession())
  .then(() => apiConfigStore.loadFromStorage())
  .then(() => {
    app.mount('#app')
  })
  .catch(err => {
    console.error('初始化失败:', err)
    // 即使配置加载失败，也挂载应用
    app.mount('#app')
  })
