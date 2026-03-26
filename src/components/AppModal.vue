<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Confirmacao',
  },
  message: {
    type: String,
    default: '',
  },
  details: {
    type: Array,
    default: () => [],
  },
  variant: {
    type: String,
    default: 'info',
  },
  confirmText: {
    type: String,
    default: 'Confirmar',
  },
  confirmTextBusy: {
    type: String,
    default: 'Processando...',
  },
  cancelText: {
    type: String,
    default: 'Cancelar',
  },
  showCancel: {
    type: Boolean,
    default: true,
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true,
  },
  requireText: {
    type: String,
    default: '',
  },
  requireTextLabel: {
    type: String,
    default: 'Digite para confirmar',
  },
  requireTextPlaceholder: {
    type: String,
    default: '',
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const typedValue = ref('')

const isConfirmDisabled = computed(() => {
  if (props.busy) {
    return true
  }

  if (!props.requireText) {
    return false
  }

  return typedValue.value.trim() !== props.requireText
})

function closeModal() {
  if (props.busy) {
    return
  }

  emit('update:modelValue', false)
}

function handleBackdropClick() {
  if (!props.closeOnBackdrop) {
    return
  }

  closeModal()
}

function handleCancel() {
  if (props.busy) {
    return
  }

  emit('cancel')
  emit('update:modelValue', false)
}

function handleConfirm() {
  if (isConfirmDisabled.value) {
    return
  }

  emit('confirm')
}

watch(
  () => props.modelValue,
  (opened) => {
    if (!opened) {
      typedValue.value = ''
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="app-modal-overlay" role="presentation" @click="handleBackdropClick">
      <article
        class="app-modal-card"
        :class="`app-modal-${variant}`"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.stop
      >
        <header class="app-modal-header">
          <h2>{{ title }}</h2>
          <button type="button" class="app-modal-close" :disabled="busy" @click="closeModal" aria-label="Fechar modal">
            x
          </button>
        </header>

        <div class="app-modal-content">
          <p v-if="message" class="app-modal-message">{{ message }}</p>

          <ul v-if="details.length" class="app-modal-list">
            <li v-for="(item, index) in details" :key="`${item}-${index}`">{{ item }}</li>
          </ul>

          <label v-if="requireText" class="app-modal-field">
            <span>{{ requireTextLabel }}: <strong>{{ requireText }}</strong></span>
            <input
              v-model="typedValue"
              type="text"
              :placeholder="requireTextPlaceholder || requireText"
              :disabled="busy"
            />
          </label>
        </div>

        <footer class="app-modal-actions">
          <button v-if="showCancel" type="button" class="btn secondary" :disabled="busy" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="btn"
            :class="{ danger: variant === 'danger' }"
            :disabled="isConfirmDisabled"
            @click="handleConfirm"
          >
            {{ busy ? confirmTextBusy : confirmText }}
          </button>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 60;
  padding: 20px;
}

.app-modal-card {
  width: min(560px, 100%);
  background: #ffffff;
  border: 1px solid #dbe4ee;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
  overflow: hidden;
}

.app-modal-info {
  border-top: 5px solid #1d4ed8;
}

.app-modal-danger {
  border-top: 5px solid #dc2626;
}

.app-modal-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.app-modal-close {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  color: #334155;
  width: 32px;
  height: 32px;
  cursor: pointer;
}

.app-modal-content {
  padding: 2px 16px 14px;
  display: grid;
  gap: 10px;
}

.app-modal-message {
  margin: 0;
  color: #1e293b;
  line-height: 1.5;
}

.app-modal-list {
  margin: 0;
  padding-left: 20px;
  color: #1e293b;
  line-height: 1.5;
}

.app-modal-field {
  display: grid;
  gap: 6px;
}

.app-modal-field span {
  font-size: 14px;
  color: #334155;
}

.app-modal-actions {
  border-top: 1px solid #e2e8f0;
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .app-modal-card {
    width: 100%;
  }

  .app-modal-actions {
    justify-content: stretch;
  }

  .app-modal-actions .btn {
    width: 100%;
  }
}
</style>
