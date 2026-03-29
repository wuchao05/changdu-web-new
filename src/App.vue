<script setup lang="ts">
import { computed } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
} from 'naive-ui'
import { RouterView, useRoute } from 'vue-router'

import AppFooter from '@/components/AppFooter.vue'
import DebugConsoleDrawer from '@/components/DebugConsoleDrawer.vue'

const route = useRoute()
const showFooter = computed(() => route.name !== 'login')
</script>

<template>
  <n-config-provider :theme="null" :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <div class="h-screen flex flex-col overflow-hidden">
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
