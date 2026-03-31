<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  allowedDomainsText: {
    type: String,
    default: '',
  },
  blockedDomain: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

function closeModal() {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.modelValue" class="domain-modal-overlay" role="presentation" @click="closeModal">
      <article class="domain-modal-card" role="dialog" aria-modal="true" aria-label="Dominio de email nao permitido" @click.stop>
        <header class="domain-modal-header">
          <span class="domain-modal-chip">Acesso restrito</span>
          <h2>Que pena!</h2>
        </header>

        <div class="domain-modal-content">
          <p>
            O email identificado nao faz parte dos dominios institucionais habilitados para esta plataforma.
          </p>
          <p>
            Esta ferramenta foi criada para apoiar estudantes e servidores da UFSM, por isso o cadastro fica
            disponivel apenas para contas com dominio valido da instituicao.
          </p>
          <p>
            Confira se voce entrou com o email correto e tente novamente.
          </p>

          <div class="domain-modal-domain-box">
            <p v-if="blockedDomain" class="domain-modal-domain-row">
              Dominio identificado: <strong>@{{ blockedDomain }}</strong>
            </p>
            <p class="domain-modal-domain-row">
              Dominios permitidos: <strong>{{ allowedDomainsText }}</strong>
            </p>
          </div>
        </div>

        <footer class="domain-modal-actions">
          <button type="button" class="btn" @click="closeModal">Voltar a pagina de Login</button>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
.domain-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background:
    radial-gradient(circle at 20% 20%, rgba(30, 64, 175, 0.22), transparent 42%),
    radial-gradient(circle at 80% 0%, rgba(220, 38, 38, 0.18), transparent 40%),
    rgba(2, 6, 23, 0.66);
  backdrop-filter: blur(4px);
}

.domain-modal-card {
  width: min(620px, 100%);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  background: linear-gradient(165deg, #ffffff, #f8fafc 48%, #eff6ff);
  box-shadow: 0 28px 64px rgba(15, 23, 42, 0.36);
}

.domain-modal-header {
  padding: 18px 20px 10px;
}

.domain-modal-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 6px 10px;
}

.domain-modal-header h2 {
  margin: 12px 0 0;
  color: #0f172a;
  font-size: 30px;
  line-height: 1.1;
}

.domain-modal-content {
  display: grid;
  gap: 12px;
  padding: 0 20px 18px;
  color: #1e293b;
}

.domain-modal-content p {
  margin: 0;
  line-height: 1.6;
}

.domain-modal-domain-box {
  margin-top: 4px;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbff, #eff6ff);
  padding: 12px;
  display: grid;
  gap: 6px;
}

.domain-modal-domain-row {
  color: #1e3a8a;
}

.domain-modal-actions {
  border-top: 1px solid #e2e8f0;
  padding: 14px 20px 18px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 620px) {
  .domain-modal-header h2 {
    font-size: 26px;
  }

  .domain-modal-actions .btn {
    width: 100%;
  }
}
</style>
