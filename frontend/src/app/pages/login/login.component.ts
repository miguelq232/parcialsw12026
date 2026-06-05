import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type DemoRole = 'ADMIN' | 'FUNCIONARIO';

interface DemoAccount {
  name: string;
  email: string;
  password: string;
  role: DemoRole;
  area: string;
  departamentoId?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <section class="login-card">
        <div class="logo-section">
          <div class="logo-icon">SW</div>
          <div>
            <h1>SWP1 Workflow</h1>
            <p>Acceso a cuentas demo del sistema</p>
          </div>
        </div>

        <form (submit)="onSubmit($event)">
          <div class="form-grid">
            <label class="form-group">
              <span>Correo</span>
              <input type="email" [(ngModel)]="username" name="username" placeholder="funcionario1@swp1.demo">
            </label>

            <label class="form-group">
              <span>Contrasena</span>
              <input type="password" [(ngModel)]="password" name="password" placeholder="funcionario123">
            </label>
          </div>

          <button type="submit" class="primary-action">Iniciar sesion</button>
        </form>

        <div class="quick-roles">
          <div class="section-head">
            <strong>Cuentas rapidas</strong>
            <span>{{ demoAccounts.length }} usuarios demo</span>
          </div>

          <div class="account-list">
            <button *ngFor="let account of demoAccounts" type="button" class="account-card" (click)="loginAs(account)">
              <span class="account-role">{{ account.role === 'ADMIN' ? 'Administrador' : account.area }}</span>
              <strong>{{ account.name }}</strong>
              <small>{{ account.email }}</small>
              <code>{{ account.password }}</code>
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      color: #e5e7eb;
      background:
        linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        #111113;
      background-size: 28px 28px;
    }

    .login-container {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .login-card {
      width: min(860px, 100%);
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 24px;
      padding: 24px;
      border: 1px solid #2b2b31;
      border-radius: 8px;
      background: rgba(23, 23, 26, 0.96);
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.44);
    }

    .logo-section {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 100%;
      padding: 8px 6px;
    }

    .logo-icon {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: 8px;
      background: #f97316;
      color: #111113;
      font-weight: 900;
      letter-spacing: 0;
      margin-bottom: 18px;
    }

    h1, p {
      margin: 0;
    }

    h1 {
      color: #f9fafb;
      font-size: 1.55rem;
      line-height: 1.15;
    }

    p {
      margin-top: 8px;
      color: #9ca3af;
      font-size: 0.88rem;
      line-height: 1.45;
    }

    form {
      display: grid;
      gap: 14px;
      align-self: start;
    }

    .form-grid {
      display: grid;
      gap: 12px;
    }

    .form-group {
      display: grid;
      gap: 7px;
    }

    .form-group span {
      color: #9ca3af;
      font-size: 0.76rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    input {
      width: 100%;
      min-height: 40px;
      border: 1px solid #33343a;
      border-radius: 7px;
      padding: 0 12px;
      color: #f3f4f6;
      background: #202126;
      outline: none;
    }

    input:focus {
      border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.14);
    }

    .primary-action {
      min-height: 40px;
      border: 1px solid #fb923c;
      border-radius: 7px;
      color: #111113;
      background: #f97316;
      font-weight: 850;
    }

    .primary-action:hover {
      background: #fb923c;
      transform: translateY(-1px);
    }

    .quick-roles {
      grid-column: 2;
      display: grid;
      gap: 12px;
      padding-top: 4px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .section-head strong {
      color: #f8fafc;
      font-size: 0.9rem;
    }

    .section-head span {
      color: #9ca3af;
      font-size: 0.76rem;
    }

    .account-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .account-card {
      display: grid;
      gap: 5px;
      min-height: 122px;
      border: 1px solid #33343a;
      border-radius: 8px;
      padding: 12px;
      text-align: left;
      color: #e5e7eb;
      background: #18191d;
      cursor: pointer;
    }

    .account-card:hover {
      border-color: rgba(249, 115, 22, 0.65);
      background: #202126;
      transform: translateY(-1px);
    }

    .account-card strong {
      color: #f9fafb;
      font-size: 0.9rem;
    }

    .account-role,
    .account-card small,
    .account-card code {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .account-role {
      color: #fb923c;
      font-size: 0.68rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .account-card small {
      color: #cbd5e1;
      font-size: 0.76rem;
    }

    .account-card code {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      min-height: 24px;
      padding: 0 7px;
      border: 1px solid rgba(249, 115, 22, 0.24);
      border-radius: 6px;
      color: #fed7aa;
      background: rgba(249, 115, 22, 0.12);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.72rem;
    }

    @media (max-width: 760px) {
      .login-card {
        grid-template-columns: 1fr;
      }

      .logo-section,
      .quick-roles {
        grid-column: auto;
      }

      .account-list {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';

  demoAccounts: DemoAccount[] = [
    { name: 'Admin 1', email: 'admin@swp1.demo', password: 'admin123', role: 'ADMIN', area: 'Administracion' },
    { name: 'Funcionario', email: 'funcionario1@swp1.demo', password: 'funcionario123', role: 'FUNCIONARIO', area: 'Atencion', departamentoId: 'd-atencion' },
    { name: 'Funcionario 2', email: 'funcionario2@swp1.demo', password: 'funcionario123', role: 'FUNCIONARIO', area: 'Riesgos', departamentoId: 'd-riesgos' },
    { name: 'Funcionario 3', email: 'funcionario3@swp1.demo', password: 'funcionario123', role: 'FUNCIONARIO', area: 'Aprobacion', departamentoId: 'd-aprobacion' },
    { name: 'Funcionario Tecnico', email: 'tecnico@swp1.demo', password: 'funcionario123', role: 'FUNCIONARIO', area: 'Tecnico', departamentoId: 'd-tecnico' },
    { name: 'Funcionario Caja', email: 'caja@swp1.demo', password: 'funcionario123', role: 'FUNCIONARIO', area: 'Caja', departamentoId: 'd-caja' }
  ];

  private auth = inject(AuthService);
  private router = inject(Router);

  onSubmit(event: Event) {
    event.preventDefault();

    const email = this.username.trim().toLowerCase();
    const account = this.demoAccounts.find(item => item.email === email && item.password === this.password);

    if (!account) {
      alert('Correo o contrasena demo incorrectos.');
      return;
    }

    this.loginAs(account);
  }

  loginAs(account: DemoAccount) {
    this.auth.login(account.role, account.name, account.email, account.departamentoId);
    this.router.navigate(['/dashboard']);
  }
}
