<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOffline = ref(!navigator.onLine)

const updateOnlineStatus = () => {
  isOffline.value = !navigator.onLine
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})
</script>

<template>
  <div v-if="isOffline" class="offline-overlay">
    <div class="offline-content">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wifi-off">
        <line x1="2" y1="2" x2="22" y2="22"></line>
        <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
        <path d="M2 8.82a15 15 0 0 1 4.17-2.65"></path>
        <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.82"></path>
        <path d="M5 12.859a10 10 0 0 1 2.18-1.57"></path>
        <path d="M13.25 9.75a10 10 0 0 1 5.75 3.1"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
      <h2>Você parece estar sem internet</h2>
      <p>Aguardando reconexão para continuar o uso seguro da plataforma.</p>
    </div>
  </div>
</template>

<style scoped>
.offline-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .offline-overlay {
    background-color: rgba(15, 23, 42, 0.95);
    color: white;
  }
}

.offline-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  max-width: 400px;
}

.lucide-wifi-off {
  color: var(--color-primary, #007bff);
  animation: pulse 2s infinite ease-in-out;
}

h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

p {
  margin: 0;
  color: #64748b;
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  p {
    color: #94a3b8;
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
