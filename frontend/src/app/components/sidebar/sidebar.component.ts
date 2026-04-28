import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="app-menu" *ngIf="auth.isAuthenticated()">
      <div class="brand">
        <div class="dot"></div>
        <span>SWP1</span>
      </div>

      <nav>
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a *ngIf="auth.isAdmin()" routerLink="/designer" routerLinkActive="active">Disenador</a>
        <a *ngIf="auth.isFuncionario()" routerLink="/monitor" routerLinkActive="active">Monitor</a>
      </nav>

      <div class="user-profile">
        <div class="user-meta">
          <p class="name">{{ auth.currentUser()?.username }}</p>
          <p class="role">{{ auth.currentUser()?.role }}</p>
        </div>
        <button (click)="logout()" class="logout-btn">Salir</button>
      </div>
    </header>
  `,
  styles: [`
    .app-menu {
      min-height: 64px;
      background: rgba(17, 17, 19, 0.96);
      border-bottom: 1px solid #2b2b31;
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 0 22px;
      color: #e5e7eb;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: 1.1rem;
      color: #f9fafb;
      flex: 0 0 auto;
    }

    .dot {
      width: 12px;
      height: 12px;
      background: #f97316;
      border-radius: 4px;
      box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.14);
    }

    nav {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }

    nav a {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      padding: 0 14px;
      text-decoration: none;
      color: #9ca3af;
      font-size: 0.875rem;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: all 0.2s;
      white-space: nowrap;
    }

    nav a:hover {
      background: #202126;
      color: #f3f4f6;
      border-color: #33343a;
    }

    nav a.active {
      background: rgba(249, 115, 22, 0.12);
      border-color: rgba(249, 115, 22, 0.36);
      color: #fb923c;
      font-weight: 600;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 0 0 auto;
    }

    .user-meta {
      text-align: right;
      min-width: 0;
    }

    .name {
      color: #f3f4f6;
      font-size: 0.875rem;
      font-weight: 600;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .role {
      font-size: 0.72rem;
      color: #9ca3af;
      text-transform: uppercase;
    }

    .logout-btn {
      min-height: 34px;
      background: #202126;
      border: 1px solid #3a3a42;
      color: #f3f4f6;
      padding: 0 12px;
      font-size: 0.8rem;
      border-radius: 6px;
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.38);
      color: #fca5a5;
    }

    @media (max-width: 760px) {
      .app-menu {
        min-height: auto;
        align-items: stretch;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
      }

      nav {
        width: 100%;
        overflow-x: auto;
      }

      .user-profile {
        justify-content: space-between;
      }

      .user-meta {
        text-align: left;
      }
    }
  `]
})
export class SidebarComponent {
  public auth = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
