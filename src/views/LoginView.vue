<template>
  <div class="login-page min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
    <div class="login-page__backdrop">
      <div class="login-page__orb login-page__orb--left"></div>
      <div class="login-page__orb login-page__orb--right"></div>
      <div class="login-page__orb login-page__orb--bottom"></div>
      <div class="login-page__mesh"></div>
      <div class="login-page__grid"></div>
    </div>

    <div class="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
      <section class="login-shell w-full max-w-[520px]">
        <div class="login-shell__halo"></div>
        <n-card :bordered="false" class="login-card">
          <div class="login-brand">
            <div class="login-brand__badge">CHANGDU WEB STUDIO</div>
            <div class="login-brand__mark">CD</div>
          </div>

          <div class="mt-7">
            <p class="text-sm font-semibold tracking-[0.18em] text-sky-600/90">账号登录</p>
            <h1 class="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-[2.75rem]">
              欢迎回来
            </h1>
            <p class="mt-3 text-sm leading-7 text-slate-500">
              输入账号和密码后即可进入工作台。
            </p>
          </div>

          <n-form :model="form" :rules="rules" ref="formRef" label-placement="top" class="mt-8">
            <n-form-item label="账号" path="account">
              <n-input v-model:value="form.account" placeholder="请输入账号" size="large" />
            </n-form-item>
            <n-form-item label="密码" path="password">
              <n-input
                v-model:value="form.password"
                type="password"
                show-password-on="click"
                placeholder="请输入密码"
                size="large"
                @keyup.enter="handleSubmit"
              />
            </n-form-item>
          </n-form>

          <n-alert v-if="errorMessage" type="error" :bordered="false" class="mb-4">
            {{ errorMessage }}
          </n-alert>

          <n-button
            type="primary"
            size="large"
            block
            :loading="submitting"
            class="login-submit"
            @click="handleSubmit"
          >
            登录
          </n-button>

          <div class="login-footer">
            <span class="login-footer__line"></span>
            <p>渠道工作台统一登录入口</p>
            <span class="login-footer__line"></span>
          </div>
        </n-card>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NForm, NFormItem, NInput, type FormInst } from 'naive-ui'
import { useSessionStore } from '@/stores/session'
import { useApiConfigStore } from '@/stores/apiConfig'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()
const apiConfigStore = useApiConfigStore()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const errorMessage = ref('')

const form = reactive({
  account: '',
  password: '',
})

const rules = {
  account: {
    required: true,
    message: '请输入账号',
    trigger: ['blur', 'input'],
  },
  password: {
    required: true,
    message: '请输入密码',
    trigger: ['blur', 'input'],
  },
}

async function handleSubmit() {
  errorMessage.value = ''
  try {
    await formRef.value?.validate()
    submitting.value = true
    await sessionStore.login(form.account.trim(), form.password.trim())
    await apiConfigStore.loadFromStorage()

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (sessionStore.isAdmin && !redirect) {
      await router.replace('/admin')
      return
    }

    await router.replace(redirect || '/')
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = '登录失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 24%),
    linear-gradient(135deg, #f6f9ff 0%, #eef4ff 42%, #f8fbff 100%);
}

:global(html.theme-dark) .login-page {
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 26%),
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 24%),
    linear-gradient(135deg, #07111f 0%, #0f172a 42%, #111827 100%);
}

.login-page__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.login-page__orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(18px);
  opacity: 0.9;
}

.login-page__orb--left {
  top: 8%;
  left: -4rem;
  width: 18rem;
  height: 18rem;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.2), rgba(37, 99, 235, 0));
}

.login-page__orb--right {
  top: 14%;
  right: -2rem;
  width: 22rem;
  height: 22rem;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.18), rgba(14, 165, 233, 0));
}

.login-page__orb--bottom {
  right: 10%;
  bottom: -5rem;
  width: 20rem;
  height: 20rem;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.14), rgba(99, 102, 241, 0));
}

.login-page__mesh {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.75), transparent 18%),
    radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.68), transparent 16%),
    radial-gradient(circle at 50% 82%, rgba(255, 255, 255, 0.72), transparent 14%);
}

.login-page__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.07) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: linear-gradient(180deg, rgba(15, 23, 42, 0.26), transparent 82%);
}

.login-shell {
  position: relative;
}

.login-shell__halo {
  position: absolute;
  inset: -2.25rem;
  border-radius: 2.5rem;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.95), transparent 54%),
    radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.18), transparent 38%);
  filter: blur(10px);
}

:global(html.theme-dark) .login-shell__halo {
  background:
    radial-gradient(circle at top, rgba(30, 41, 59, 0.92), transparent 52%),
    radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.14), transparent 36%);
}

.login-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 2rem;
  padding: 1.9rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.82)),
    rgba(255, 255, 255, 0.86);
  box-shadow:
    0 40px 80px -48px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(18px);
}

:global(html.theme-dark) .login-card {
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.88)),
    rgba(15, 23, 42, 0.9);
  box-shadow:
    0 24px 80px rgba(2, 6, 23, 0.45),
    0 10px 30px rgba(15, 23, 42, 0.35);
}

.login-card::before {
  content: '';
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: 0.4rem;
  background: linear-gradient(90deg, #2563eb, #0ea5e9, #38bdf8);
}

.login-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.login-brand__badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.4rem 0.85rem;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.login-brand__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.15rem;
  height: 3.15rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  color: white;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  box-shadow: 0 22px 36px -24px rgba(37, 99, 235, 0.9);
}

.login-submit {
  box-shadow: 0 22px 36px -24px rgba(37, 99, 235, 0.7);
}

.login-footer {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 1.3rem;
  color: #64748b;
  font-size: 0.76rem;
}

.login-footer__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.45), transparent);
}

:deep(.login-card .n-card__content) {
  padding: 0;
}

:deep(.login-card .n-form-item-label) {
  font-weight: 600;
  color: #334155;
}

:deep(.login-card .n-input) {
  --n-border-hover: rgba(37, 99, 235, 0.42) !important;
}

@media (max-width: 640px) {
  .login-card {
    padding: 1.5rem;
    border-radius: 1.6rem;
  }

  .login-shell__halo {
    inset: -1rem;
  }

  .login-brand {
    align-items: flex-start;
  }
}
</style>
