import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import HomeSearchView from '../views/HomeSearchView.vue'
import ProductView from '../views/ProductView.vue'
import SellerProfileView from '../views/SellerProfileView.vue'
import LoginView from '../views/LoginView.vue'
import MyProfileView from '../views/MyProfileView.vue'
import ProductCreateView from '../views/ProductCreateView.vue'
import ProductEditView from '../views/ProductEditView.vue'
import MyProductsView from '../views/MyProductsView.vue'
import FavoritesView from '../views/FavoritesView.vue'
import { getCurrentUser, initAuth, waitForAuthInit } from '../services/authService'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/search', name: 'search', component: HomeSearchView },
  { path: '/product/:id', name: 'product', component: ProductView },
  { path: '/seller/:sellerId', name: 'seller', component: SellerProfileView },
  { path: '/login', name: 'login', component: LoginView },
  {
    path: '/profile',
    name: 'profile',
    component: MyProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/product/new',
    name: 'product-create',
    component: ProductCreateView,
    meta: { requiresAuth: true },
  },
  {
    path: '/product/:id/edit',
    name: 'product-edit',
    component: ProductEditView,
    meta: { requiresAuth: true },
  },
  {
    path: '/my/products',
    name: 'my-products',
    component: MyProductsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: FavoritesView,
    meta: { requiresAuth: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  // Hash mode avoids direct URL 404 issues on static hosts like GitHub Pages.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

initAuth()

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true
  }

  await waitForAuthInit()

  if (getCurrentUser()) {
    return true
  }

  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
