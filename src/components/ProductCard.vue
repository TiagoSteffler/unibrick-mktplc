<script setup>
defineProps({
  product: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <RouterLink :to="`/product/${product.id}`" class="card product-card">
    <img :src="product.photos[0] || 'https://placehold.co/800x500?text=Sem+Foto'" :alt="product.title" class="cover" />

    <div class="content">
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
</style>
