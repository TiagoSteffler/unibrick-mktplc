<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const deferredPrompt = ref(null)
const showPrompt = ref(false)

const handleBeforeInstallPrompt = (e) => {
  e.preventDefault()
  deferredPrompt.value = e
  showPrompt.value = true
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

const installApp = async () => {
  if (!deferredPrompt.value) return
  
  deferredPrompt.value.prompt()
  
  const { outcome } = await deferredPrompt.value.userChoice
  
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt')
  } else {
    console.log('User dismissed the install prompt')
  }
  
  deferredPrompt.value = null
  showPrompt.value = false
}

const dismissPrompt = () => {
  showPrompt.value = false
}
</script>

<template>
  <div v-if="showPrompt" class="install-prompt">
    <div class="install-content">
      <span class="install-text">Instale nosso app para uma melhor experiência!</span>
      <div class="install-actions">
        <button @click="installApp" class="install-btn">Baixar</button>
        <button @click="dismissPrompt" class="close-btn" aria-label="Fechar">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.install-prompt {
  background-color: var(--color-primary, #007bff);
  color: white;
  padding: 12px 16px;
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.install-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1200px;
  gap: 16px;
}

.install-text {
  font-size: 0.95rem;
  font-weight: 500;
}

.install-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.install-btn {
  background-color: white;
  color: var(--color-primary, #007bff);
  border: none;
  border-radius: 20px;
  padding: 6px 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
}

.install-btn:hover {
  background-color: #f0f0f0;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: white;
}

@media (max-width: 600px) {
  .install-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
}
</style>
