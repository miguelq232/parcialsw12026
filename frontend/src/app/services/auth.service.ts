import { Injectable, signal } from '@angular/core';

export type UserRole = 'ADMIN' | 'FUNCIONARIO' | null;
export interface AuthUser {
  username: string;
  role: UserRole;
  email?: string;
  color?: string;
  departamentoId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _currentUser = signal<AuthUser | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  
  currentUser = this._currentUser.asReadonly();

  login(role: UserRole, customUsername?: string, email?: string, departamentoId?: string) {
    const colors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    let username = customUsername;
    if (!username) {
      username = role === 'ADMIN' ? 'Administrador' : 'Funcionario';
    }
    
    const user = { username, role, email, color: randomColor, departamentoId };
    
    this._currentUser.set(user);
    localStorage.setItem('user', JSON.stringify(user));
  }

  logout() {
    this._currentUser.set(null);
    localStorage.removeItem('user');
  }

  isAdmin() {
    return this._currentUser()?.role === 'ADMIN';
  }

  isFuncionario() {
    return this._currentUser()?.role === 'FUNCIONARIO';
  }

  isAuthenticated() {
    return this._currentUser() !== null;
  }
}
