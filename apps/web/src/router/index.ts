import { createRouter, createWebHistory, type RouterHistory, type RouteRecordRaw } from 'vue-router';
import { hasAnyDevDemoQueryParam } from '../dev/dev-demos';

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
    // 1. Redirección DEV automática cuando se accede a '/' o '/dev-tools' con query params de demo (ej. ?battle-demo=1)
    if (import.meta.env.DEV && (to.name === 'home' || to.name === 'dev-tools')) {
      const q = to.query;
      const isSfxLab = q['sfx-lab'] !== undefined;
      const isBattle = q['battle-demo'] !== undefined || q['warning-demo'] === '1';

      if (hasAnyDevDemoQueryParam(q as Record<string, unknown>)) {
        if (isSfxLab) {
          return { name: 'sfx-lab', query: to.query, replace: true };
        }
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
