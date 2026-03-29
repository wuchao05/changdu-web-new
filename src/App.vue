<script setup lang="ts">
import { computed, watchEffect } from 'vue'
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
const appTheme = computed(() => (settingsStore.settings.darkMode ? darkTheme : null))

watchEffect(() => {
  if (typeof document === 'undefined') return

  const isDarkMode = settingsStore.settings.darkMode
  document.documentElement.classList.toggle('theme-dark', isDarkMode)
  document.body.classList.toggle('theme-dark', isDarkMode)
})
</script>

<template>
  <n-config-provider :theme="appTheme" :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <div class="h-screen flex flex-col overflow-hidden" :class="{ 'theme-dark': settingsStore.settings.darkMode }">
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
