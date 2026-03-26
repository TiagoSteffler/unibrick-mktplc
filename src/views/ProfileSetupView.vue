<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppModal from '../components/AppModal.vue'
import { authState, updateAuthenticatedUserProfile } from '../services/authService'
import { getUserProfile, saveUserProfile } from '../services/marketplaceService'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)

const isEditMode = computed(() => route.name === 'profile-edit')
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const showSuccessModal = ref(false)
const successModalTitle = ref('')
const successModalMessage = ref('')
const redirectAfterSave = ref('/profile')

const form = reactive({
  fullName: '',
  gender: '',
  neighborhood: '',
  hometown: '',
  aboutMe: '',
  photoURL: '',
  email: '',
})

function fillForm() {
  if (!user.value) {
    return
  }

  const profile = getUserProfile(user.value)
  form.fullName = profile?.fullName || ''
  form.gender = profile?.gender || ''
  form.neighborhood = profile?.neighborhood || ''
  form.hometown = profile?.hometown || ''
  form.aboutMe = profile?.aboutMe || ''
  form.photoURL = profile?.photoURL || ''
  form.email = user.value.email || ''
}

const isBusy = computed(() => isLoading.value || isSaving.value)

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'))
    reader.readAsDataURL(file)
  })
}

async function handlePhotoUpload(event) {
  const [file] = event.target.files || []

  if (!file) {
    return
  }

  error.value = ''

  try {
    form.photoURL = await readFileAsDataURL(file)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao enviar imagem.'
  }
}

function removePhoto() {
  form.photoURL = ''
}

function handleUseGooglePhoto() {
  if (!user.value?.photoURL) {
    error.value = 'Nenhuma foto disponivel no Google.'
    return
  }
  form.photoURL = user.value.photoURL
}

function handleCancel() {
  if (isEditMode.value) {
    router.back()
  } else {
    router.replace('/profile')
  }
}

function handleProfileSuccessConfirm() {
  router.replace(redirectAfterSave.value)
}

async function handleSubmit() {
  error.value = ''

  if (!user.value) {
    router.replace('/login')
    return
  }

  if (!form.fullName.trim() || !form.gender || !form.neighborhood.trim() || !form.hometown.trim()) {
    error.value = 'Preencha nome completo, sexo, bairro e cidade natal para continuar.'
    return
  }

  form.aboutMe = form.aboutMe.slice(0, 300)

  isSaving.value = true

  try {
    const saved = await saveUserProfile(user.value, {
      fullName: form.fullName,
      gender: form.gender,
      neighborhood: form.neighborhood,
      hometown: form.hometown,
      aboutMe: form.aboutMe,
      photoURL: form.photoURL,
    })

    updateAuthenticatedUserProfile({
      displayName: saved.fullName,
      photoURL: saved.photoURL,
    })

    redirectAfterSave.value = String(route.query.redirect || '/profile')
    successModalTitle.value = isEditMode.value ? 'Perfil atualizado' : 'Cadastro concluido'
    successModalMessage.value = isEditMode.value
      ? 'Suas alteracoes de perfil foram salvas com sucesso.'
      : 'Seu cadastro foi concluido com sucesso. Sua conta esta pronta para uso.'
    showSuccessModal.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao salvar cadastro.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  if (!user.value) {
    router.replace('/login')
    return
  }

  isLoading.value = true

  try {
    fillForm()
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <section class="card loading-section">
    <div v-if="isBusy" class="section-loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p v-if="isSaving">Salvando perfil...</p>
      <p v-else>Carregando perfil...</p>
    </div>

    <h1>{{ isEditMode ? 'Editar cadastro' : 'Complete seu cadastro' }}</h1>
    <p class="muted" style="margin-top: 8px">
      Informe seus dados para liberar as funcoes de perfil e anuncios.
      <span v-if="!isEditMode"> Concluir este cadastro e obrigatorio para continuar.</span>
    </p>

    <form class="grid profile-form" @submit.prevent="handleSubmit" :aria-busy="isBusy">
      <label class="field">
        <span>Nome completo</span>
        <input
          v-model="form.fullName"
          type="text"
          required
          placeholder="Nome completo"
          autocomplete="name"
        />
      </label>

      <label class="field">
        <span>Sexo</span>
        <select v-model="form.gender" required>
          <option disabled value="">Selecione</option>
          <option value="masc">Masculino</option>
          <option value="fem">Feminino</option>
          <option value="outro">Outro</option>
        </select>
      </label>

      <label class="field">
        <span>Bairro de residencia para retirada</span>
        <input
          v-model="form.neighborhood"
          type="text"
          required
          placeholder="Ex.: Camobi"
          autocomplete="address-level3"
        />
      </label>

      <label class="field">
        <span>Cidade natal</span>
        <input
          v-model="form.hometown"
          type="text"
          required
          placeholder="Santa Maria/RS"
          autocomplete="address-level2"
        />
      </label>

      <label class="field">
        <span>Sobre mim</span>
        <textarea
          v-model="form.aboutMe"
          rows="4"
          maxlength="300"
          placeholder="Conte um pouco sobre voce"
        ></textarea>
        <small class="muted">{{ form.aboutMe.length }}/300</small>
      </label>

      <label class="field">
        <span>Email Google</span>
        <input v-model="form.email" type="email" readonly disabled />
      </label>

      <div class="field">
        <span>Foto de perfil</span>

        <div class="profile-photo-section">
          <div class="photo-preview-container">
            <div v-if="form.photoURL" class="photo-preview-wrap">
              <img :src="form.photoURL" alt="Foto de perfil" class="photo-preview" />
            </div>
            <div v-else class="photo-preview-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
          </div>

          <div class="photo-button-actions">
            <button type="button" class="btn secondary" @click="handleUseGooglePhoto">
              Usar foto Google
            </button>
            <label class="btn secondary" style="cursor: pointer; margin: 0;">
              Escolher foto
              <input
                type="file"
                accept="image/*"
                @change="handlePhotoUpload"
                style="display: none;"
              />
            </label>
            <button
              v-if="form.photoURL"
              type="button"
              class="btn secondary"
              @click="removePhoto"
            >
              Remover foto
            </button>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button v-if="isEditMode" type="button" class="btn secondary" @click="handleCancel">
          Cancelar
        </button>
        <button class="btn" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Salvando...' : isEditMode ? 'Salvar alteracoes' : 'Concluir cadastro' }}
        </button>
      </div>
    </form>

    <p v-if="error" style="color: #b91c1c; margin-top: 10px">{{ error }}</p>

    <AppModal
      v-model="showSuccessModal"
      variant="info"
      :title="successModalTitle"
      :message="successModalMessage"
      :details="['Voce sera redirecionado para a proxima etapa ao confirmar.']"
      confirm-text="Continuar"
      :show-cancel="false"
      @confirm="handleProfileSuccessConfirm"
    />
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}

.profile-form {
  gap: 12px;
  margin-top: 14px;
}

.field {
  display: grid;
  gap: 6px;
}

.field > span {
  font-size: 14px;
  color: #334155;
}

.profile-photo-section {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 24px;
  align-items: center;
}

.photo-preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  width: 100%;
}

.photo-preview-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.photo-preview {
  height: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e2e8f0;
}

.photo-preview-empty {
  display: grid;
  place-items: center;
  height: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  background: #f1f5f9;
  color: #94a3b8;
}

.photo-preview-empty svg {
  width: 60px;
  height: 60px;
}

.photo-button-actions {
  display: grid;
  gap: 10px;
}

.photo-button-actions .btn {
  width: 100%;
}

.form-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
}

.form-actions .btn {
  width: 100%;
}

@media (max-width: 768px) {
  .profile-photo-section {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .photo-preview-container {
    height: 150px;
  }

  .form-actions {
    grid-template-columns: 1fr;
  }
}
</style>
