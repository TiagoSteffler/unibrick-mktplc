<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const deferredPrompt = ref(null)
const showPrompt = ref(false)

const handleBeforeInstallPrompt = (e) => {
  e.preventDefault()
  if (sessionStorage.getItem('pwa-prompt-dismissed')) {
    return
  }
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
  
  if (outcome !== 'accepted') {
    // Optionally handle dismissal if needed in the future
  }
  
  sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  deferredPrompt.value = null
  showPrompt.value = false
}

const dismissPrompt = () => {
  sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  showPrompt.value = false
}
</script>

<template>
  <Transition name="slide-down">
    <div v-if="showPrompt" class="install-prompt-container">
      <div class="install-prompt">
        <button @click="dismissPrompt" class="close-btn" aria-label="Fechar">✕</button>
        <div class="install-content">
          <div class="text-container">
            <span class="install-text">Instale nosso app para uma melhor experiência!</span>
          </div>
          <div class="btn-container">
            <button @click="installApp" class="install-btn">Baixar</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.install-prompt-container {
  position: fixed;
  top: 16px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 9999;
  padding: 0 16px;
  pointer-events: none; /* Let clicks pass through the container */
}

.install-prompt {
  background-color: var(--color-primary, #007bff);
  color: white;
  padding: 16px 12px 16px 20px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  position: relative;
  width: 100%;
  max-width: 600px;
  pointer-events: auto; /* Enable clicks on the prompt itself */
}

.close-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  padding: 6px;
  transition: color 0.2s;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: white;
}

.install-content {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 2px; /* Slight offset to clear the close button if it overlaps */
}

.text-container {
  flex: 3; /* ~75% */
  padding-right: 12px;
}

.install-text {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.4;
  display: block;
}

.btn-container {
  flex: 1; /* ~25% */
  display: flex;
  justify-content: flex-end;
}

.install-btn {
  background-color: white;
  color: var(--color-primary, #007bff);
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s;
  font-size: 0.9rem;
  width: 100%;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.install-btn:hover {
  background-color: #f8f9fa;
  transform: scale(1.03);
}

.install-btn:active {
  transform: scale(0.97);
}

/* Vue Transition Classes */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-150%);
  opacity: 0;
}
</style>
