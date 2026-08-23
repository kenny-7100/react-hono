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
    path: '/blog/:id',
    lazy: () => import('./pages/Blog'),
  },
  {
    path: '*',
    lazy: () => import('./pages/NotFound'),
  },
])
