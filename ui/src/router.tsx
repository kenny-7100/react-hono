import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('./pages/Home'),
  },
  {
    path: '/about',
    lazy: () => import('./pages/About'),
  },
  {
    path: '/xp',
    lazy: () => import('./pages/XpDesktop'),
  },
  {
    path: '*',
    lazy: () => import('./pages/NotFound'),
  },
])
