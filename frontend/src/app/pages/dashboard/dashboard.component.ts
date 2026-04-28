import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../services/workflow.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-shell">
      <section class="topbar">
        <div>
          <span class="eyebrow">Workspace</span>
          <h1>Automatizaciones SWP1</h1>
          <p>Hola, {{ auth.currentUser()?.username }}. Controla politicas, tramites y ejecuciones desde una vista operativa.</p>
        </div>

        <div class="top-actions">
          <button class="icon-btn" type="button" title="Refrescar" (click)="loadData()">↻</button>
          <button class="primary-action" type="button" *ngIf="auth.isAdmin()" (click)="crearPolitica()">Nuevo flujo</button>
        </div>
      </section>

      <section class="metrics">
        <article class="metric-card">
          <span class="metric-label">Politicas</span>
          <strong>{{ policies.length }}</strong>
          <small>flujos disponibles</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">Activos</span>
          <strong>{{ tramites.length }}</strong>
          <small>tramites en curso</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">Completados</span>
          <strong>14</strong>
          <small>procesos cerrados</small>
        </article>
        <article class="metric-card accent">
          <span class="metric-label">Estado API</span>
          <strong>Online</strong>
          <small>MongoDB remoto</small>
        </article>
      </section>

      <section class="workspace-grid">
        <div class="canvas-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">Editor visual</span>
              <h2>Politicas disponibles</h2>
            </div>
            <span class="pill">{{ policies.length }} workflows</span>
          </div>

          <div class="workflow-canvas" [class.empty]="policies.length === 0">
            <ng-container *ngIf="policies.length; else emptyState">
              <article *ngFor="let p of policies; let i = index" class="workflow-node animate-pop">
                <div class="node-port input"></div>
                <div class="node-header">
                  <span class="node-icon">{{ i + 1 }}</span>
                  <div>
                    <h3>{{ p.nombre }}</h3>
                    <p>{{ p.nodos?.length || 0 }} etapas definidas</p>
                  </div>
                </div>
                <div class="node-meta">
                  <span>Trigger manual</span>
                  <span>Activo</span>
                </div>
                <div class="node-actions">
                  <button type="button" class="run-btn" (click)="iniciar(p)">Iniciar</button>
                  <button type="button" class="ghost-btn" *ngIf="auth.isAdmin()" (click)="editar(p)">Editar</button>
                </div>
                <div class="node-port output"></div>
              </article>
            </ng-container>

            <ng-template #emptyState>
              <div class="empty-state">
                <h3>No hay politicas creadas</h3>
                <p>Abre el disenador para construir el primer flujo de trabajo.</p>
                <button type="button" class="primary-action" *ngIf="auth.isAdmin()" (click)="crearPolitica()">Ir al disenador</button>
              </div>
            </ng-template>
          </div>
        </div>

        <aside class="runs-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Ejecuciones</span>
              <h2>Tramites</h2>
            </div>
          </div>

          <div class="run-list">
            <article *ngFor="let t of tramites" class="run-item">
              <div class="run-dot"></div>
              <div class="run-copy">
                <strong>{{ t.cliente }}</strong>
                <span>#{{ t.id }}</span>
              </div>
              <span class="status">{{ t.estado }}</span>
            </article>

            <div *ngIf="tramites.length === 0" class="empty-runs">
              Sin tramites activos.
            </div>
          </div>
        </aside>
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

    .dashboard-shell {
      height: 100%;
      overflow-y: auto;
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .topbar, .canvas-panel, .runs-panel, .metric-card {
      background: rgba(23, 23, 26, 0.94);
      border: 1px solid #2b2b31;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }

    .topbar {
      border-radius: 8px;
      padding: 22px 24px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: center;
    }

    .eyebrow {
      display: block;
      color: #f97316;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    h1, h2, h3, p {
      margin: 0;
    }

    h1 {
      color: #f9fafb;
      font-size: 1.55rem;
      line-height: 1.2;
    }

    h2 {
      color: #f9fafb;
      font-size: 1rem;
    }

    .topbar p {
      color: #9ca3af;
      margin-top: 8px;
      max-width: 680px;
      line-height: 1.45;
    }

    .top-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-shrink: 0;
    }

    .icon-btn, .primary-action, .run-btn, .ghost-btn {
      border-radius: 6px;
      min-height: 36px;
      border: 1px solid #33343a;
    }

    .icon-btn {
      width: 38px;
      background: #1c1c20;
      color: #f3f4f6;
      font-size: 1rem;
    }

    .primary-action {
      padding: 0 14px;
      color: #111113;
      background: #f97316;
      border-color: #fb923c;
      font-weight: 700;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
      gap: 14px;
    }

    .metric-card {
      border-radius: 8px;
      padding: 16px;
      display: grid;
      gap: 6px;
    }

    .metric-card strong {
      color: #f9fafb;
      font-size: 1.7rem;
      line-height: 1;
    }

    .metric-label, .metric-card small {
      color: #9ca3af;
      font-size: 0.78rem;
    }

    .metric-card.accent {
      border-color: rgba(249, 115, 22, 0.5);
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 18px;
      min-height: 0;
      flex: 1;
    }

    .canvas-panel, .runs-panel {
      border-radius: 8px;
      min-height: 420px;
      overflow: hidden;
    }

    .panel-head {
      min-height: 72px;
      border-bottom: 1px solid #2b2b31;
      padding: 16px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .panel-head.compact {
      min-height: 72px;
    }

    .pill {
      border: 1px solid #3a3a42;
      background: #202126;
      color: #d1d5db;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 0.76rem;
      white-space: nowrap;
    }

    .workflow-canvas {
      min-height: 520px;
      padding: 28px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      align-content: start;
      gap: 28px 44px;
      position: relative;
    }

    .workflow-canvas::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 16px 16px, rgba(249, 115, 22, 0.16) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
      opacity: 0.65;
    }

    .workflow-node {
      position: relative;
      z-index: 1;
      background: #18191d;
      border: 1px solid #34353c;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 176px;
    }

    .workflow-node::after {
      content: "";
      position: absolute;
      top: 50%;
      right: -45px;
      width: 44px;
      height: 1px;
      background: linear-gradient(90deg, #f97316, transparent);
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .node-icon {
      width: 34px;
      height: 34px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      color: #111113;
      background: #f97316;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .node-header h3 {
      color: #f9fafb;
      font-size: 0.95rem;
      line-height: 1.25;
    }

    .node-header p, .node-meta {
      color: #9ca3af;
      font-size: 0.78rem;
    }

    .node-meta {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #2b2b31;
      border-bottom: 1px solid #2b2b31;
      padding: 10px 0;
    }

    .node-actions {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      margin-top: auto;
    }

    .run-btn {
      background: #f97316;
      color: #111113;
      border-color: #fb923c;
      font-weight: 700;
    }

    .ghost-btn {
      background: #202126;
      color: #e5e7eb;
      padding: 0 12px;
    }

    .node-port {
      position: absolute;
      top: calc(50% - 5px);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #111113;
      border: 2px solid #f97316;
    }

    .node-port.input {
      left: -6px;
    }

    .node-port.output {
      right: -6px;
    }

    .run-list {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .run-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #2b2b31;
      background: #18191d;
    }

    .run-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
    }

    .run-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .run-copy strong {
      color: #f3f4f6;
      font-size: 0.84rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .run-copy span, .empty-runs, .empty-state p {
      color: #9ca3af;
      font-size: 0.76rem;
    }

    .status {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.18);
      border-radius: 999px;
      padding: 5px 8px;
      font-size: 0.72rem;
      max-width: 112px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-state {
      position: relative;
      z-index: 1;
      grid-column: 1 / -1;
      align-self: center;
      justify-self: center;
      text-align: center;
      display: grid;
      justify-items: center;
      gap: 10px;
      max-width: 360px;
      padding: 28px;
      border: 1px dashed #3a3a42;
      border-radius: 8px;
      background: rgba(24, 25, 29, 0.82);
    }

    .empty-state h3 {
      color: #f9fafb;
      font-size: 1rem;
    }

    .empty-runs {
      padding: 16px;
      border: 1px dashed #34353c;
      border-radius: 8px;
      text-align: center;
    }

    .animate-pop {
      animation: pop 0.22s ease-out;
    }

    @keyframes pop {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @media (max-width: 1100px) {
      .metrics {
        grid-template-columns: repeat(2, minmax(150px, 1fr));
      }

      .workspace-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .dashboard-shell {
        padding: 16px;
      }

      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .metrics {
        grid-template-columns: 1fr;
      }

      .workflow-canvas {
        grid-template-columns: 1fr;
        padding: 18px;
      }

      .workflow-node::after {
        display: none;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  public auth = inject(AuthService);
  private workflowService = inject(WorkflowService);
  private router = inject(Router);

  policies: any[] = [];
  tramites: any[] = [];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.workflowService.getPolicies().subscribe(data => this.policies = data);
    this.workflowService.getTramites().subscribe(data => this.tramites = data);
  }

  iniciar(policy: any) {
    const cliente = prompt('Nombre del cliente para el tramite:');
    if (cliente) {
      this.workflowService.iniciarTramite(policy.id, cliente).subscribe(() => {
        alert('Tramite iniciado con exito.');
        this.loadData();
      });
    }
  }

  editar(policy: any) {
    this.router.navigate(['/designer', policy.id]);
  }

  crearPolitica() {
    this.router.navigate(['/designer']);
  }
}
