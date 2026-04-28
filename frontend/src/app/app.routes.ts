import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'designer',
    loadComponent: () => import('./pages/designer/designer.component').then(m => m.DesignerComponent)
  },
  {
    path: 'designer/:id',
    loadComponent: () => import('./pages/designer/designer.component').then(m => m.DesignerComponent)
  },
  {
    path: 'monitor',
    loadComponent: () => import('./pages/monitor/monitor.component').then(m => m.MonitorComponent)
  }
];