import { createRouter, createWebHistory, type RouterHistory, type RouteRecordRaw } from 'vue-router';

export type RouteName =
  | 'home'
  | 'training'
  | 'battle'
  | 'settings'
  | 'history'
  | 'ranking'
  | 'results'
  | 'dev-tools'
  | 'sfx-lab'
  | 'not-found';

export interface AppRouterOptions {
  history?: RouterHistory;
  hasActiveResult?: (() => boolean) | undefined;
}

// Dummy component para satisfacer el contrato de RouteRecordRaw cuando App.vue
// orquesta la vista activada según route.name.
const DummyComponent = { template: '<div data-testid="route-placeholder"></div>' };

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: DummyComponent,
  },
  {
    path: '/training',
    name: 'training',
    component: DummyComponent,
  },
  {
    path: '/battle',
    name: 'battle',
    component: DummyComponent,
  },
  {
    path: '/settings',
    name: 'settings',
    component: DummyComponent,
  },
  {
    path: '/history',
    name: 'history',
    component: DummyComponent,
  },
  {
    path: '/ranking',
    name: 'ranking',
    component: DummyComponent,
  },
  {
    path: '/results',
    name: 'results',
    component: DummyComponent,
  },
  {
    path: '/dev-tools',
    name: 'dev-tools',
    component: DummyComponent,
  },
  {
    path: '/sfx-lab',
    name: 'sfx-lab',
    component: DummyComponent,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
];

let activeResultHandler: (() => boolean) | undefined = undefined;

export function setActiveResultHandler(handler: () => boolean): void {
  activeResultHandler = handler;
}

export function createAppRouter(options: AppRouterOptions = {}) {
  const router = createRouter({
    history: options.history ?? createWebHistory(),
    routes,
  });

  router.beforeEach((to) => {
    // 1. Redirección DEV automática cuando se accede a '/' con query params de demo (ej. ?battle-demo=1)
    if (import.meta.env.DEV && to.name === 'home') {
      const q = to.query;
      const isBattle = q['battle-demo'] !== undefined || q['warning-demo'] === '1';
      const isDevDemo =
        q['battle-demo'] !== undefined ||
        q['garbage-demo'] !== undefined ||
        q['polarity-demo'] !== undefined ||
        q['warning-demo'] !== undefined ||
        q['overload-demo'] !== undefined ||
        q['tspin-demo'] !== undefined ||
        q['sabotage-demo'] !== undefined ||
        q['level-demo'] !== undefined;

      if (isDevDemo) {
        return { name: isBattle ? 'battle' : 'training', query: to.query, replace: true };
      }
    }

    // 2. Guard de rutas DEV en producción
    if (!import.meta.env.DEV && (to.name === 'dev-tools' || to.name === 'sfx-lab')) {
      return { name: 'home', replace: true };
    }

    // 3. Guard de /results sin resultado de partida activo en memoria
    if (to.name === 'results') {
      const check = options.hasActiveResult ?? activeResultHandler;
      if (!check || !check()) {
        return { name: 'home', replace: true };
      }
    }
  });

  return router;
}
