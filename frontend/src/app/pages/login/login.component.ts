import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card glass-card animate-fade-in">
        <div class="logo-section">
          <div class="logo-icon"></div>
          <h1>SWP1 Workflow</h1>
          <p>Gestión Inteligente de Políticas de Negocio</p>
        </div>

        <form (submit)="onSubmit($event)">
          <div class="form-group">
            <label>Usuario</label>
            <input type="text" [(ngModel)]="username" name="username" placeholder="admin / funcionario">
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" [(ngModel)]="password" name="password" placeholder="••••••••">
          </div>

          <button type="submit" class="btn-primary">Iniciar Sesión</button>
        </form>

        <div class="quick-roles">
          <p>O inicia rápido como:</p>
          <div class="role-buttons">
            <button (click)="quickLogin('ADMIN', 'Admin 1')" class="btn-outline">Admin 1</button>
            <button (click)="quickLogin('ADMIN', 'Admin 2')" class="btn-outline">Admin 2</button>
            <button (click)="quickLogin('FUNCIONARIO', 'Funcionario')" class="btn-outline">Func. 1</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top right, #1e1b4b, #0f172a);
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .logo-section {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 16px;
      box-shadow: 0 0 30px var(--primary-glow);
    }

    h1 {
      font-size: 1.75rem;
      color: var(--text-main);
    }

    p {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    input {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 12px 16px;
      color: white;
      transition: all 0.2s;
    }

    input:focus {
      outline: none;
      border-color: var(--primary);
      background: rgba(0, 0, 0, 0.4);
    }

    .btn-primary {
      margin-top: 12px;
      width: 100%;
    }

    .quick-roles {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid var(--glass-border);
    }

    .role-buttons {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }

    .btn-outline {
      flex: 1;
      background: transparent;
      border: 1px solid var(--glass-border);
      color: var(--text-main);
      padding: 8px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.813rem;
      transition: all 0.2s;
    }

    .btn-outline:hover {
      background: var(--glass);
      border-color: var(--text-muted);
    }

    .animate-fade-in {
      animation: fadeIn 0.6s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  
  private auth = inject(AuthService);
  private router = inject(Router);

  onSubmit(event: Event) {
    event.preventDefault();
    if (this.username.toLowerCase().includes('admin')) {
      this.quickLogin('ADMIN', this.username);
    } else {
      this.quickLogin('FUNCIONARIO', this.username);
    }
  }

  quickLogin(role: 'ADMIN' | 'FUNCIONARIO', customUsername?: string) {
    this.auth.login(role, customUsername);
    this.router.navigate(['/dashboard']);
  }
}
