<script setup>
defineProps({
  product: {
    type: Object,
    required: true,
  },
  showModerationLabel: {
    type: Boolean,
    default: false,
  },
})

function getModerationLabel(product) {
  const status = String(product?.moderationStatus || 'approved').toLowerCase()

  if (status === 'pending') {
    return 'Aguardando aprovação'
  }

  if (status === 'reported') {
    return 'Reportado para revisão'
  }

  if (status === 'rejected') {
    return 'Rejeitado'
  }

  return 'Publicado'
}
</script>

<template>
  <RouterLink :to="`/product/${product.id}`" class="card product-card">
    <img :src="product.photos[0] || 'https://placehold.co/800x500?text=Sem+Foto'" :alt="product.title" class="cover" />

    <div class="content">
      <p v-if="product.isAdminPost" class="admin-badge">Publicado pela administração</p>
      <p v-if="showModerationLabel && getModerationLabel(product)" class="moderation-badge" :class="{ 'pending': product.moderationStatus === 'pending', 'reported': product.moderationStatus === 'reported', 'rejected': product.moderationStatus === 'rejected', 'approved': product.moderationStatus === 'approved' }">{{ getModerationLabel(product) }}</p>
      <p class="muted">{{ product.category }}</p>
      <h3>{{ product.title }}</h3>
      <p class="price">R$ {{ product.price.toFixed(2) }}</p>
      <p class="muted">Estado: {{ product.condition === 'novo' ? 'Novo' : 'Usado' }}</p>
    </div>
  </RouterLink>
</template>

<style scoped>
.product-card {
  display: grid;
  gap: 12px;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12);
}

.cover {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 12px;
}

.content h3 {
  margin: 4px 0;
  font-size: 18px;
}

.price {
  margin: 0;
  font-weight: 700;
  font-size: 18px;
  color: #0f172a;
}

.admin-badge,
.moderation-badge,
.approved-badge,
.rejected-badge {
  margin: 0;
  width: fit-content;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.admin-badge {
  background: #cffafe;
  color: #155e75;
}

.moderation-badge.pending,
.moderation-badge.reported {
  background: #fff7ed;
  color: #9a6f12;
}

.moderation-badge.approved {
  background: #dcfce7;
  color: #166534;
}

.moderation-badge.rejected {
  background: #fee2e2;
  color: #b91c1c;
}

</style>
