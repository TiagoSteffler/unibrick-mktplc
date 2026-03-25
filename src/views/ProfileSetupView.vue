<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, updateAuthenticatedUserProfile } from '../services/authService'
import { getUserProfile, saveUserProfile } from '../services/marketplaceService'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)

const isEditMode = computed(() => route.name === 'profile-edit')
const isSaving = ref(false)
const success = ref('')
const error = ref('')

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

async function handleSubmit() {
  error.value = ''
  success.value = ''

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

    success.value = isEditMode.value
      ? 'Perfil atualizado com sucesso.'
      : 'Cadastro concluido com sucesso.'

    const redirectTo = String(route.query.redirect || '/profile')
    router.replace(redirectTo)
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

  fillForm()
})
</script>

<template>
  <section class="card">
    <h1>{{ isEditMode ? 'Editar cadastro' : 'Complete seu cadastro' }}</h1>
    <p class="muted" style="margin-top: 8px">
      Informe seus dados para liberar as funcoes de perfil e anuncios.
    </p>

    <form class="grid profile-form" @submit.prevent="handleSubmit">
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
        <p class="muted">A foto da conta Google e carregada automaticamente e pode ser trocada.</p>

        <div v-if="form.photoURL" class="photo-preview-wrap">
          <img :src="form.photoURL" alt="Foto de perfil" class="photo-preview" />
        </div>

        <div class="photo-actions">
          <input type="file" accept="image/*" @change="handlePhotoUpload" />
          <button v-if="form.photoURL" type="button" class="btn secondary" @click="removePhoto">
            Remover foto
          </button>
        </div>
      </div>

      <button class="btn" type="submit" :disabled="isSaving">
        {{ isSaving ? 'Salvando...' : isEditMode ? 'Salvar alteracoes' : 'Concluir cadastro' }}
      </button>
    </form>

    <p v-if="success" style="color: #15803d; margin-top: 10px">{{ success }}</p>
    <p v-if="error" style="color: #b91c1c; margin-top: 10px">{{ error }}</p>
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

.photo-preview-wrap {
  margin-top: 6px;
}

.photo-preview {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

.photo-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
