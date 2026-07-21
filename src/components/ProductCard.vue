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

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <article class="card product-card">
    <RouterLink :to="`/product/${product.id}`" class="product-link">
      <img :src="product.photos[0] || 'https://placehold.co/800x500?text=Sem+Foto'" :alt="product.title" class="cover" />

      <div class="content">
        <h3>{{ product.title }}</h3>
        <p v-if="product.isAdminPost" class="admin-badge">Publicado pela administração</p>
        <p v-if="showModerationLabel && getModerationLabel(product)" class="moderation-badge" :class="{ 'pending': product.moderationStatus === 'pending', 'reported': product.moderationStatus === 'reported', 'rejected': product.moderationStatus === 'rejected', 'approved': product.moderationStatus === 'approved' }">{{ getModerationLabel(product) }}</p>
        <p class="muted category-text">{{ product.category }}</p>
        <p class="price">R$ {{ product.price.toFixed(2) }}</p>
        <div class="product-footer">
          <p class="muted condition-text">Estado: {{ product.condition === 'novo' ? 'Novo' : 'Usado' }}</p>
          <p class="muted timestamp-text" v-if="product.createdAt">{{ formatTimestamp(product.createdAt) }}</p>
        </div>
      </div>
    </RouterLink>
    
    <div v-if="$slots.actions" class="product-actions">
      <slot name="actions"></slot>
    </div>
  </article>
</template>

<style scoped>
.product-card {
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  overflow: hidden;
}

.product-link {
  display: grid;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  flex: 1;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12);
}

.product-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px;
  padding-bottom: 0px;
  border-top: 1px solid #e2e8f0;
}

.cover {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 12px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content h3 {
  margin: 0;
  font-size: 18px;
}

.price {
  margin: 4px 0 0;
  font-weight: 700;
  font-size: 18px;
  color: #0f172a;
}

.muted {
  margin: 0;
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
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

@media (max-width: 768px) {
  .product-card {
    border-radius: 0;
    border: none;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: none;
    padding: 12px 16px;
    margin: 0;
  }

  .product-link {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 12px;
  }

  .cover {
    width: 110px;
    height: 110px;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .content {
    justify-content: flex-start;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .content h3 {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .price {
    font-size: 16px;
    margin: 2px 0 0;
  }

  .product-footer {
    margin-top: auto;
  }

  .muted.category-text,
  .muted.condition-text {
    font-size: 12px;
    line-height: 1.2;
  }

  .admin-badge,
  .moderation-badge {
    font-size: 10px;
    padding: 2px 6px;
  }
}
</style>
