<template>
  <div class="unauthorized-guide">
    <!-- 背景装饰 -->
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <!-- 主内容 -->
    <div class="content-container">
      <n-card class="guide-card" :bordered="false">
        <!-- 图标 -->
        <div class="icon-wrapper">
          <Icon icon="mdi:shield-lock-outline" class="main-icon" />
        </div>

        <!-- 标题 -->
        <h1 class="title">访问受限</h1>
        <p class="subtitle">您暂时没有权限访问此系统</p>

        <!-- 信息卡片 -->
        <div class="info-section">
          <n-alert type="info" :bordered="false" class="info-alert">
            <template #icon>
              <Icon icon="mdi:information-outline" class="alert-icon" />
            </template>
            <div class="alert-content">
              <p class="alert-title">关于访问权限</p>
              <p class="alert-text">本系统仅对授权用户开放。如需访问，请联系管理员申请合作权限。</p>
            </div>
          </n-alert>
        </div>

        <!-- 当前状态 -->
        <div class="status-section">
          <div class="status-item">
            <Icon icon="mdi:account-outline" class="status-icon" />
            <div class="status-info">
              <span class="status-label">当前身份</span>
              <span class="status-value">{{ userStatus }}</span>
            </div>
          </div>
          <div v-if="currentUserId" class="status-item">
            <Icon icon="mdi:identifier" class="status-icon" />
            <div class="status-info">
              <span class="status-label">用户ID</span>
              <span class="status-value">{{ currentUserId }}</span>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <n-button type="primary" size="large" class="action-button" @click="handleContact">
            <template #icon>
              <Icon icon="mdi:email-outline" />
            </template>
            联系管理员
          </n-button>
          <n-button text class="help-button" @click="showHelp = true">
            <template #icon>
              <Icon icon="mdi:help-circle-outline" />
            </template>
            如何获取访问权限？
          </n-button>
        </div>

        <!-- 帮助提示 -->
        <div v-if="showHelp" class="help-section">
          <n-card class="help-card" :bordered="false">
            <template #header>
              <div class="flex items-center gap-2">
                <Icon icon="mdi:lightbulb-outline" class="text-yellow-500" />
                <span>获取访问权限的步骤</span>
              </div>
            </template>
            <ol class="help-list">
              <li>联系系统管理员，说明您的合作需求</li>
              <li>管理员将为您创建专属的用户账号</li>
              <li>获取您的专属访问链接（包含用户ID）</li>
              <li>使用专属链接访问系统，即可正常使用</li>
            </ol>
          </n-card>
        </div>
      </n-card>

      <!-- 页脚 -->
      <div class="footer">
        <p class="footer-text">
          <Icon icon="mdi:shield-check" class="footer-icon" />
          本系统采用严格的权限管理，确保数据安全
        </p>
      </div>
    </div>

    <!-- 联系弹窗 -->
    <n-modal v-model:show="showContactModal" preset="card" title="联系管理员" class="contact-modal">
      <div class="contact-content">
        <n-alert type="success" :bordered="false">
          <template #icon>
            <Icon icon="mdi:email-check-outline" />
          </template>
          <div class="space-y-3">
            <p class="font-semibold">请通过以下方式联系管理员：</p>
            <div class="contact-info">
              <div class="contact-item">
                <Icon icon="mdi:email" class="contact-item-icon" />
                <span>邮箱：admin@example.com</span>
              </div>
              <div class="contact-item">
                <Icon icon="mdi:wechat" class="contact-item-icon" />
                <span>微信：请扫描二维码或添加客服微信</span>
              </div>
            </div>
            <p class="text-sm text-gray-600">
              请在联系时说明您的姓名、所在机构以及合作需求，管理员会尽快为您处理。
            </p>
          </div>
        </n-alert>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { NCard, NButton, NAlert, NModal } from 'naive-ui'
import { useUserAuth } from '@/composables/useUserAuth'

const { currentUserId, isAdmin } = useUserAuth()

const showHelp = ref(false)
const showContactModal = ref(false)

// 用户状态描述
const userStatus = computed(() => {
  if (!currentUserId.value) {
    return '未登录/未识别'
  }
  if (isAdmin.value) {
    return '管理员（已授权）'
  }
  return '未授权用户'
})

// 联系管理员
function handleContact() {
  showContactModal.value = true
}
</script>

<style scoped>
.unauthorized-guide {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 背景装饰 */
.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 20s infinite ease-in-out;
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.circle-2 {
  width: 400px;
  height: 400px;
  bottom: -150px;
  right: -150px;
  animation-delay: 5s;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  right: 10%;
  animation-delay: 10s;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-20px) scale(1.05);
  }
}

/* 主内容 */
.content-container {
  position: relative;
  z-index: 1;
  max-width: 600px;
  width: 100%;
}

.guide-card {
  background: white;
  border-radius: 24px;
  padding: 3rem 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

/* 图标 */
.icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

.main-icon {
  width: 80px;
  height: 80px;
  color: #667eea;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

/* 标题 */
.title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.125rem;
  color: #6b7280;
  margin-bottom: 2rem;
}

/* 信息区域 */
.info-section {
  margin-bottom: 2rem;
}

.info-alert {
  text-align: left;
  background: #eff6ff;
  border-radius: 12px;
  padding: 1rem;
}

.alert-icon {
  position: relative;
  top: 18px;
}

.alert-content {
  margin-left: 0.5rem;
}

.alert-title {
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.5rem;
}

.alert-text {
  color: #3b82f6;
  line-height: 1.6;
}

/* 状态区域 */
.status-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-icon {
  width: 24px;
  height: 24px;
  color: #667eea;
  flex-shrink: 0;
}

.status-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
}

.status-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.status-value {
  font-weight: 600;
  color: #1f2937;
  word-break: break-all;
}

/* 操作按钮 */
.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.action-button {
  width: 100%;
  height: 48px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.help-button {
  color: #667eea;
  font-weight: 500;
}

/* 帮助区域 */
.help-section {
  margin-top: 1.5rem;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.help-card {
  background: #fef3c7;
  border-radius: 12px;
  text-align: left;
}

.help-list {
  list-style: decimal;
  padding-left: 1.5rem;
  color: #92400e;
  line-height: 1.8;
}

.help-list li {
  margin-bottom: 0.5rem;
}

/* 页脚 */
.footer {
  margin-top: 2rem;
  text-align: center;
}

.footer-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
}

.footer-icon {
  width: 16px;
  height: 16px;
}

/* 联系弹窗 */
.contact-content {
  padding: 1rem 0;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  font-size: 0.875rem;
}

.contact-item-icon {
  width: 20px;
  height: 20px;
  color: #10b981;
  flex-shrink: 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .unauthorized-guide {
    padding: 1rem;
  }

  .guide-card {
    padding: 2rem 1.5rem;
    border-radius: 16px;
  }

  .title {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .main-icon {
    width: 60px;
    height: 60px;
  }
}
</style>
