import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface Nodo {
  id: string;
  tipo: 'START' | 'ACTIVITY' | 'DECISION' | 'FORK' | 'JOIN' | 'END' | 'INICIO' | 'ACTIVIDAD' | 'FIN';
  nombre: string;
  departamentoId?: string;
  funcionariosAsignados?: string[];
  campos?: any[];
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface Conexion {
  id: string;
  origenId: string;
  destinoId: string;
  condicion?: string;
}

export interface Usuario {
  id?: string;
  username: string;
  email?: string;
  password?: string;
  rol: 'ADMIN' | 'FUNCIONARIO' | string;
  departamentoId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private http = inject(HttpClient);
  private apiUrl = '/api';

  getPolicies(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/politicas`);
  }

  getPolicyById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/politicas/${id}`);
  }

  savePolicy(policy: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/politicas`, policy);
  }

  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/usuarios`);
  }

  getTramites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tramites`);
  }

  iniciarTramite(politicaId: string, cliente: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tramites/iniciar`, { politicaId, cliente });
  }

  completarActividad(tramiteId: string, nodoId: string, datos: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tramites/${tramiteId}/completar`, { nodoId, datos });
  }

  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/files/upload`, formData);
  }

  sendAiCommand(prompt: string, currentState: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ai/command`, { prompt, currentState });
  }

  sendFormFillCommand(transcript: string, formContext: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ai/form-fill`, { transcript, formContext });
  }

  getTramitePrediction(tramiteId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/ai/tramites/${tramiteId}/prediction`);
  }
}
