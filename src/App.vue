<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  darkTheme,
  zhCN,
  dateZhCN,
} from 'naive-ui'
import { RouterView, useRoute } from 'vue-router'

import AppFooter from '@/components/AppFooter.vue'
import DebugConsoleDrawer from '@/components/DebugConsoleDrawer.vue'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settingsStore = useSettingsStore()
const showFooter = computed(() => route.name !== 'login')
const isNightDarkMode = ref(false)
let darkModeTimer: ReturnType<typeof setTimeout> | null = null

function isWithinNightHours(date = new Date()) {
  const hour = date.getHours()
  return hour >= 21 || hour < 7
}

function clearDarkModeTimer() {
  if (!darkModeTimer) return
  clearTimeout(darkModeTimer)
  darkModeTimer = null
}

function scheduleAutoDarkModeCheck() {
  clearDarkModeTimer()

  const now = new Date()
  const next = new Date(now)

  if (isWithinNightHours(now)) {
    if (now.getHours() >= 21) {
      next.setDate(next.getDate() + 1)
    }
    next.setHours(7, 0, 0, 0)
  } else {
    next.setHours(21, 0, 0, 0)
  }

  const delay = Math.max(next.getTime() - now.getTime(), 1000)
  darkModeTimer = setTimeout(() => {
    isNightDarkMode.value = isWithinNightHours()
    scheduleAutoDarkModeCheck()
  }, delay)
}

const effectiveDarkMode = computed(() =>
  settingsStore.settings.autoDarkMode ? isNightDarkMode.value : settingsStore.settings.darkMode
)
const appTheme = computed(() => (effectiveDarkMode.value ? darkTheme : null))

watchEffect(() => {
  if (typeof document === 'undefined') return

  const isDarkMode = effectiveDarkMode.value
  document.documentElement.classList.toggle('theme-dark', isDarkMode)
  document.body.classList.toggle('theme-dark', isDarkMode)
})

onMounted(() => {
  isNightDarkMode.value = isWithinNightHours()
  scheduleAutoDarkModeCheck()
})

onBeforeUnmount(() => {
  clearDarkModeTimer()
})
</script>

<template>
  <n-config-provider :theme="appTheme" :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <div class="h-screen flex flex-col overflow-hidden" :class="{ 'theme-dark': effectiveDarkMode }">
            <div class="flex-1 overflow-auto">
              <RouterView v-slot="{ Component }">
                <component :is="Component" />
              </RouterView>
            </div>
            <AppFooter v-if="showFooter" />
            <DebugConsoleDrawer />
          </div>
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
#app {
  min-height: 100vh;
}
</style>
