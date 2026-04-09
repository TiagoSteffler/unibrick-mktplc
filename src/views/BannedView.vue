<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  authState,
  blockedLoginReason,
  signOutUser,
} from '../services/authService'
import { resolveUserAccess } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const banReason = ref('Não informado')

const fullMessage = computed(() => {
  const reason = String(banReason.value || '').trim() || 'Não informado'

  return `Esta conta foi suspensa pela administração por infringir as políticas e diretrizes da plataforma. O motivo de banimento é: ${reason}. Entre em contato com a administração para recorrer da decisão pelo email: unibrikmarketplace@gmail.com.`
})

async function loadBanReason() {
  const fallback = String(blockedLoginReason.value || '').trim()

  if (fallback) {
    const marker = 'Motivo:'
    const index = fallback.indexOf(marker)

    if (index >= 0) {
      banReason.value = fallback.slice(index + marker.length).trim() || 'Não informado'
      return
    }
  }

  if (!user.value) {
    banReason.value = 'Não informado'
    return
  }

  try {
    const access = await resolveUserAccess(user.value, { force: true })
    banReason.value = String(access?.blacklistEntry?.reason || '').trim() || 'Não informado'
  } catch {
    banReason.value = 'Não informado'
  }
}

async function handleSignOut() {
  await signOutUser()
  router.replace({ name: 'login' })
}

onMounted(() => {
  loadBanReason()
})
</script>

<template>
  <section class="auth-layout">
    <article class="card auth-card banned-card">
      <h1>Conta suspensa</h1>
      <p class="muted banned-text">{{ fullMessage }}</p>

      <div class="action-row">
        <button class="btn secondary" type="button" @click="handleSignOut">Sair da conta</button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.banned-card {
  border: 1px solid #fecaca;
  background:
    radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.14), transparent 42%),
    #fff;
}

.banned-text {
  color: #7f1d1d;
  line-height: 1.6;
  white-space: pre-line;
}
</style>
