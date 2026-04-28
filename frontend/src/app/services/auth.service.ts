import { Injectable, signal } from '@angular/core';

export type UserRole = 'ADMIN' | 'FUNCIONARIO' | null;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _currentUser = signal<{ username: string, role: UserRole, color?: string } | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  
  currentUser = this._currentUser.asReadonly();

  login(role: UserRole, customUsername?: string) {
    const colors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    let username = customUsername;
    if (!username) {
      username = role === 'ADMIN' ? 'Administrador' : 'Funcionario';
    }
    
    const user = { username, role, color: randomColor };
    
    this._currentUser.set(user as any);
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
