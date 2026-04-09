import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import HomeSearchView from '../views/HomeSearchView.vue'
import ProductView from '../views/ProductView.vue'
import SellerProfileView from '../views/SellerProfileView.vue'
import LoginView from '../views/LoginView.vue'
import MyProfileView from '../views/MyProfileView.vue'
import ProfileSetupView from '../views/ProfileSetupView.vue'
import ProductCreateView from '../views/ProductCreateView.vue'
import ProductEditView from '../views/ProductEditView.vue'
import MyProductsView from '../views/MyProductsView.vue'
import FavoritesView from '../views/FavoritesView.vue'
import ChatView from '../views/ChatView.vue'
import AdminPanelView from '../views/AdminPanelView.vue'
import BannedView from '../views/BannedView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import {
  AUTH_ERROR_KIND_BLACKLISTED,
  AUTH_ERROR_KIND_DOMAIN_RESTRICTED,
  getCurrentUser,
  getLoginDomainRestrictionMessage,
  initAuth,
  isAdminSession,
  isLoginEmailAllowed,
  refreshCurrentUserAccess,
  setAuthErrorMessage,
  signOutUser,
  waitForAuthInit,
} from '../services/authService'
import { hasCompletedUserProfile } from '../services/marketplaceService'

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
    path: '/profile/setup',
    name: 'profile-setup',
    component: ProfileSetupView,
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/edit',
    name: 'profile-edit',
    component: ProfileSetupView,
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
  {
    path: '/chat',
    name: 'chat',
    component: ChatView,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'admin-panel',
    component: AdminPanelView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  { path: '/banned', name: 'banned', component: BannedView },
  { path: '/404', name: 'not-found', component: NotFoundView },
  { path: '/:pathMatch(.*)*', redirect: '/404' },
]

const router = createRouter({
  // Hash mode avoids direct URL 404 issues on static hosts like GitHub Pages.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

initAuth()

router.beforeEach(async (to) => {
  await waitForAuthInit()

  const user = getCurrentUser()

  if (user) {
    const access = await refreshCurrentUserAccess(user, { force: true })

    if (access.isBlacklisted) {
      const reason = String(access.blacklistEntry?.reason || '').trim()
      const message = reason
        ? `Sua conta foi bloqueada pela administração. Motivo: ${reason}`
        : 'Sua conta foi bloqueada pela administração e não pode acessar a plataforma.'

      setAuthErrorMessage(message, AUTH_ERROR_KIND_BLACKLISTED, user.email)

      if (to.name !== 'banned') {
        return { name: 'banned' }
      }

      return true
    }

    if (!isLoginEmailAllowed(user.email) && !access.isAdmin) {
      setAuthErrorMessage(
        getLoginDomainRestrictionMessage(user.email),
        AUTH_ERROR_KIND_DOMAIN_RESTRICTED,
        user.email,
      )

      try {
        await signOutUser()
      } catch {
        // No-op: route guard still blocks access when domain is not allowed.
      }

      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.name === 'banned') {
      return { name: 'home' }
    }
  }

  if (user) {
    const hasProfile = await hasCompletedUserProfile(user)

    if (!hasProfile && to.name !== 'profile-setup') {
      return { name: 'profile-setup', query: { redirect: to.fullPath } }
    }

    if (hasProfile && to.name === 'profile-setup') {
      return { name: 'profile' }
    }
  }

  if (!to.meta.requiresAuth) {
    return true
  }

  if (!user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && !isAdminSession.value) {
    return { name: 'home' }
  }

  return true
})

export default router
