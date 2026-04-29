<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
} from 'naive-ui'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

import AppFooter from '@/components/AppFooter.vue'
import DebugConsoleDrawer from '@/components/DebugConsoleDrawer.vue'
import FeishuBoardDrawer from '@/components/FeishuBoardDrawer.vue'

const globalFontFamily =
  "'Maple Mono NF CN', 'Maple Mono', 'Maple Mono CN', 'SFMono-Regular', 'Cascadia Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei UI', 'Noto Sans CJK SC', monospace"

const themeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily: globalFontFamily,
    fontFamilyMono: globalFontFamily,
  },
}

const route = useRoute()
const router = useRouter()
const appReady = ref(false)
const routeLoading = ref(false)
const pageScrollContainerRef = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)
const showFooter = computed(() => route.name !== 'login' && route.meta.hideFooter !== true)
const showDebugDrawer = computed(
  () => route.name !== 'login' && route.meta.hideDebugDrawer !== true
)
const showFeishuBoard = computed(
  () => route.name !== 'login' && route.meta.hideFeishuBoard !== true
)
const pageLoadingText = computed(() => {
  if (!appReady.value) {
    return '正在准备工作台...'
  }

  return routeLoading.value ? '页面加载中...' : '正在同步数据...'
})

function updateBackToTopVisibility() {
  showBackToTop.value = (pageScrollContainerRef.value?.scrollTop || 0) > 360
}

function scrollToPageTop() {
  pageScrollContainerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  await router.isReady()
  requestAnimationFrame(() => {
    appReady.value = true
  })
})

onBeforeUnmount(() => {
  pageScrollContainerRef.value?.removeEventListener('scroll', updateBackToTopVisibility)
})

watch(appReady, ready => {
  if (!ready) return

  requestAnimationFrame(() => {
    pageScrollContainerRef.value?.addEventListener('scroll', updateBackToTopVisibility, {
      passive: true,
    })
    updateBackToTopVisibility()
  })
})

watch(
  () => route.fullPath,
  () => {
    pageScrollContainerRef.value?.scrollTo({ top: 0 })
    updateBackToTopVisibility()
  }
)
</script>

<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <div class="h-screen flex flex-col overflow-hidden">
            <div ref="pageScrollContainerRef" class="flex-1 overflow-auto">
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
                  <component :is="Component" :key="route.path" />
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
            <FeishuBoardDrawer v-if="showFeishuBoard" />
            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="translate-y-3 scale-95 opacity-0"
              enter-to-class="translate-y-0 scale-100 opacity-100"
              leave-active-class="transition duration-200 ease-in"
              leave-from-class="translate-y-0 scale-100 opacity-100"
              leave-to-class="translate-y-3 scale-95 opacity-0"
            >
              <button
                v-if="showBackToTop"
                type="button"
                class="global-back-to-top-button"
                title="回到顶部"
                @click="scrollToPageTop"
              >
                <Icon icon="mdi:arrow-up" class="global-back-to-top-icon" />
              </button>
            </Transition>
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

.global-back-to-top-button {
  position: fixed;
  right: 52px;
  bottom: 76px;
  z-index: 2200;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  overflow: hidden;
  border: 1px solid rgba(186, 230, 253, 0.88);
  border-radius: 20px;
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.96), transparent 34%),
    linear-gradient(
      145deg,
      rgba(240, 249, 255, 0.96) 0%,
      rgba(224, 242, 254, 0.96) 52%,
      rgba(186, 230, 253, 0.92) 100%
    );
  color: #0284c7;
  cursor: pointer;
  box-shadow:
    0 22px 46px -22px rgba(14, 165, 233, 0.78),
    0 10px 24px -20px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px);
  animation: global-back-to-top-float 3.2s ease-in-out infinite;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.global-back-to-top-button::before {
  content: '';
  position: absolute;
  inset: -48% auto auto -42%;
  width: 76px;
  height: 76px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.16);
  filter: blur(12px);
  animation: global-back-to-top-shimmer 3.8s ease-in-out infinite;
}

.global-back-to-top-button::after {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 16px;
  box-shadow: inset 0 0 18px rgba(14, 165, 233, 0.1);
}

.global-back-to-top-button:hover {
  animation-play-state: paused;
  transform: translateY(-4px) scale(1.04);
  filter: saturate(1.08);
  box-shadow:
    0 28px 58px -22px rgba(14, 165, 233, 0.9),
    0 14px 30px -20px rgba(15, 23, 42, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.global-back-to-top-icon {
  position: relative;
  z-index: 1;
  width: 23px;
  height: 23px;
  filter: drop-shadow(0 5px 10px rgba(14, 165, 233, 0.26));
}

@keyframes global-back-to-top-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

@keyframes global-back-to-top-shimmer {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
    opacity: 0.78;
  }

  50% {
    transform: translate3d(18px, 16px, 0);
    opacity: 0.36;
  }
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
  .global-back-to-top-button {
    right: 28px;
    bottom: 64px;
    width: 48px;
    height: 48px;
    border-radius: 18px;
  }

  .app-loader-card {
    padding: 28px 20px;
    border-radius: 20px;
  }

  .app-loader-card__title {
    font-size: 18px;
  }
}
</style>
