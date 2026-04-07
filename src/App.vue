<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
} from 'naive-ui'
import { RouterView, useRoute, useRouter } from 'vue-router'

import AppFooter from '@/components/AppFooter.vue'
import DebugConsoleDrawer from '@/components/DebugConsoleDrawer.vue'

const route = useRoute()
const router = useRouter()
const appReady = ref(false)
const routeLoading = ref(false)
const showFooter = computed(() => route.name !== 'login' && route.meta.hideFooter !== true)
const showDebugDrawer = computed(
  () => route.name !== 'login' && route.meta.hideDebugDrawer !== true
)
const pageLoadingText = computed(() => {
  if (!appReady.value) {
    return '正在准备工作台...'
  }

  return routeLoading.value ? '页面加载中...' : '正在同步数据...'
})

onMounted(async () => {
  await router.isReady()
  requestAnimationFrame(() => {
    appReady.value = true
  })
})
</script>

<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <div class="h-screen flex flex-col overflow-hidden">
            <div class="flex-1 overflow-auto">
              <div v-if="!appReady" class="app-loader-shell">
                <div class="app-loader-card">
                  <div class="app-loader-orbit">
                    <span class="app-loader-orbit__ring"></span>
                    <span class="app-loader-orbit__dot"></span>
                  </div>
                  <p class="app-loader-card__title">{{ pageLoadingText }}</p>
                  <p class="app-loader-card__desc">正在同步页面资源和当前会话</p>
                </div>
              </div>
              <RouterView v-else v-slot="{ Component }">
                <Suspense @pending="routeLoading = true" @resolve="routeLoading = false">
                  <component :is="Component" :key="route.fullPath" />
                  <template #fallback>
                    <div class="app-loader-shell">
                      <div class="app-loader-card">
                        <div class="app-loader-orbit">
                          <span class="app-loader-orbit__ring"></span>
                          <span class="app-loader-orbit__dot"></span>
                        </div>
                        <p class="app-loader-card__title">{{ pageLoadingText }}</p>
                        <p class="app-loader-card__desc">正在同步页面资源和当前会话</p>
                      </div>
                    </div>
                  </template>
                </Suspense>
              </RouterView>
            </div>
            <AppFooter v-if="showFooter" />
            <DebugConsoleDrawer v-if="showDebugDrawer" />
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

.app-loader-shell {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background:
    radial-gradient(circle at top, rgba(244, 173, 96, 0.18), transparent 32%),
    linear-gradient(180deg, #f8f4eb 0%, #f3efe6 100%);
}

.app-loader-card {
  width: min(420px, 100%);
  padding: 32px 28px;
  border: 1px solid rgba(133, 92, 56, 0.14);
  border-radius: 24px;
  background: rgba(255, 252, 247, 0.9);
  box-shadow: 0 20px 60px rgba(91, 64, 35, 0.12);
  text-align: center;
  backdrop-filter: blur(14px);
}

.app-loader-orbit {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
}

.app-loader-orbit__ring,
.app-loader-orbit__dot {
  position: absolute;
  inset: 0;
  border-radius: 999px;
}

.app-loader-orbit__ring {
  border: 3px solid rgba(174, 121, 67, 0.18);
  border-top-color: #ae7943;
  animation: app-loader-spin 1s linear infinite;
}

.app-loader-orbit__dot {
  inset: 12px;
  border: 1px dashed rgba(107, 77, 47, 0.22);
  animation: app-loader-pulse 1.8s ease-in-out infinite;
}

.app-loader-card__title {
  margin: 0;
  color: #4d351e;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
}

.app-loader-card__desc {
  margin: 10px 0 0;
  color: #8b6b49;
  font-size: 14px;
  line-height: 1.7;
}

@keyframes app-loader-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes app-loader-pulse {
  0%,
  100% {
    transform: scale(0.92);
    opacity: 0.45;
  }

  50% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .app-loader-card {
    padding: 28px 20px;
    border-radius: 20px;
  }

  .app-loader-card__title {
    font-size: 18px;
  }
}
</style>
