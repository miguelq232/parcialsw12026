import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../services/workflow.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="monitor-container">
      <header class="page-header">
        <h1>Seguimiento de Trámites</h1>
        <p>Listado de procesos en ejecución</p>
      </header>

      <div class="layout">
        <!-- Kanban Board (Sistema de Calles) -->
        <div class="list-panel kanban-board" style="display: flex; gap: 16px; width: 100%; overflow-x: auto; padding-bottom: 16px;">
          
          <div *ngFor="let lane of lanes" class="kanban-lane glass-card" style="flex: 1; min-width: 250px; background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(8px); padding: 16px; border-radius: 12px; border: 1px solid rgba(226, 232, 240, 0.8); display: flex; flex-direction: column; gap: 12px;">
            <div class="lane-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
              <h3 style="font-size: 0.875rem; font-weight: 700; color: #334155; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">{{ lane }}</h3>
              <span class="lane-count" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 2px 8px; border-radius: 9999px; font-weight: 600;">{{ getTramitesByLane(lane).length }}</span>
            </div>
            
            <div class="lane-cards" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; max-height: calc(100vh - 250px);">
              <div *ngIf="getTramitesByLane(lane).length === 0" style="text-align: center; color: #94a3b8; font-size: 0.75rem; padding: 16px 0;">
                No hay trámites
              </div>
              
              <div *ngFor="let t of getTramitesByLane(lane)" 
                   (click)="seleccionarTramite(t)" 
                   class="kanban-card" 
                   [class.active]="selectedTramite?.id === t.id"
                   style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 6px;">
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="id-text" style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: var(--primary);">#{{ t.id.substring(0,6) }}</span>
                  <span style="font-size: 0.65rem; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">{{ getTiempoTotalTramite(t) }}</span>
                </div>
                
                <div style="font-size: 0.875rem; font-weight: 600; color: #1e293b;">{{ t.cliente }}</div>
                
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                  <span class="status-dot" [class]="t.estado?.toLowerCase()" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%;"></span>
                  <span style="font-size: 0.7rem; color: #64748b; font-weight: 500;">{{ t.estado }}</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>

      <!-- Modal de Avance y Detalles -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-content glass-card animate-pop" (click)="$event.stopPropagation()" style="width: 1000px; max-width: 95vw; height: 85vh; display: flex; flex-direction: column;">
          <header class="modal-header">
            <div>
              <h3 style="margin: 0; font-size: 1.25rem;">Trámite de {{ selectedTramite?.cliente }}</h3>
              <p style="margin: 4px 0 0 0; font-size: 0.813rem; color: var(--text-muted);">ID: #{{ selectedTramite?.id }}</p>
            </div>
            <button class="close-btn" (click)="closeModal()">×</button>
          </header>

          <div class="modal-body-scroll" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; height: calc(85vh - 70px); overflow: hidden; padding: 24px;">
            
            <!-- COLUMNA 1: Acciones del Funcionario -->
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 100%; overflow-y: auto;">
              
              <!-- Si el trámite no ha finalizado -->
              <ng-container *ngIf="selectedTramite?.estado !== 'FINALIZADO' && currentNode">
                <div style="margin-bottom: 16px;">
                  <h4 style="margin: 0; color: var(--primary); text-transform: uppercase; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em;">Etapa Actual</h4>
                  <h3 style="margin: 4px 0 0 0; font-size: 1.125rem; color: #1e293b;">{{ currentNode?.nombre }}</h3>
                  <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: var(--text-muted);">Asignado a: {{ getDeptoName(currentNode?.departamentoId) }}</p>
                </div>

                <div class="form-body" style="padding: 0; display: flex; flex-direction: column; gap: 16px; flex: 1;">
                  <div *ngFor="let campo of currentNode?.campos" class="form-field" style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 0.813rem; font-weight: 600; color: #475569;">{{ campo.etiqueta }}</label>
                    
                    <ng-container [ngSwitch]="campo.tipo">
                      <select *ngSwitchCase="'SELECCION'" [(ngModel)]="campo.valor" class="minimal-input">
                        <option *ngFor="let opt of campo.opciones" [value]="opt">{{ opt }}</option>
                      </select>
                      
                      <input *ngSwitchCase="'FOTO'" type="file" class="minimal-input">
                      <input *ngSwitchCase="'NUMERO'" type="number" [(ngModel)]="campo.valor" class="minimal-input">
                      <input *ngSwitchDefault type="text" [(ngModel)]="campo.valor" class="minimal-input">
                    </ng-container>
                  </div>

                  <!-- Decisiones -->
                  <div class="form-field" *ngIf="getAvailableOutcomes().length > 0">
                    <label style="font-weight: 600; color: var(--primary); font-size: 0.875rem;">Tomar Decisión / Ruta:</label>
                    <div class="decision-radios" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                      <label *ngFor="let opt of getAvailableOutcomes()" class="radio-card" [class.selected]="selectedOutcome === opt">
                        <input type="radio" [(ngModel)]="selectedOutcome" [value]="opt" name="decisionOutcome" style="display: none;">
                        <div class="radio-content">
                          <span class="radio-circle"></span>
                          <span style="font-weight: 600; color: #1e293b;">{{ opt }}</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div class="report-area" style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 0.813rem; font-weight: 600; color: #475569;">Informe/Observaciones:</label>
                    <textarea [(ngModel)]="iaReport" placeholder="Escribe aquí el informe del funcionario..." style="height: 100px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;"></textarea>
                  </div>
                </div>

                <div style="margin-top: 20px;">
                  <button class="btn-primary" (click)="completar()" [disabled]="getAvailableOutcomes().length > 0 && !selectedOutcome" style="width: 100%; padding: 12px; font-weight: 600;">
                    {{ getAvailableOutcomes().length > 0 ? 'Finalizar y Enviar' : 'Finalizar Tarea' }}
                  </button>
                </div>
              </ng-container>

              <!-- Si ya finalizó -->
              <ng-container *ngIf="selectedTramite?.estado === 'FINALIZADO'">
                <div style="text-align: center; margin: auto 0;">
                  <span style="font-size: 3rem;">🎉</span>
                  <h3 style="color: #22c55e; margin: 12px 0 4px 0;">¡Trámite Completado!</h3>
                  <p style="color: var(--text-muted); font-size: 0.813rem; margin: 0;">Este proceso ha finalizado correctamente.</p>
                </div>
              </ng-container>
            </div>

            <!-- COLUMNA 2: Historial y Progreso -->
            <div style="display: flex; flex-direction: column; gap: 20px; height: 100%; overflow-y: auto; padding-right: 8px;">
              
              <!-- Ruta del Proceso -->
              <div class="modal-section">
                <h4 class="section-title" style="border-bottom: 2px solid var(--primary);">Línea de Tiempo del Trámite</h4>
                <div class="flow-steps" style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
                  <div *ngFor="let node of policyNodes" class="flow-step" 
                       [class.completed]="isNodeCompleted(node.id)"
                       [class.current]="selectedTramite.nodoActualId === node.id"
                       style="display: flex; gap: 12px; align-items: flex-start; padding: 10px; border-radius: 8px; background: #f8fafc; border-left: 4px solid #cbd5e1;">
                    
                    <div class="step-icon" style="font-size: 1.25rem;">
                      <span *ngIf="node.tipo === 'INICIO'">⭕</span>
                      <span *ngIf="node.tipo === 'ACTIVIDAD'">⏹️</span>
                      <span *ngIf="node.tipo === 'DECISION'">🔶</span>
                      <span *ngIf="node.tipo === 'FIN'">🏁</span>
                    </div>
                    
                    <div class="step-info" style="flex: 1; display: flex; flex-direction: column;">
                      <span class="step-name" style="font-weight: 600; color: #1e293b; font-size: 0.875rem;">{{ node.nombre }}</span>
                      <span class="step-dept" style="font-size: 0.75rem; color: #64748b;">{{ getDeptoName(node.departamentoId) }}</span>
                      <span class="step-duration" *ngIf="isNodeCompleted(node.id)" style="font-size: 0.75rem; color: #0ea5e9; font-weight: 500; margin-top: 2px;">⏱️ {{ getDuracionNodo(node.id) }}</span>
                    </div>

                    <span class="step-status" style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; background: #e2e8f0; color: #475569;">
                      {{ isNodeCompleted(node.id) ? 'Completado' : (selectedTramite.nodoActualId === node.id ? 'En Proceso' : 'Pendiente') }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Datos Registrados -->
              <div class="modal-section">
                <h4 class="section-title">Datos Registrados</h4>
                <div *ngIf="!selectedTramite.historial || selectedTramite.historial.length === 0" style="text-align: center; color: #94a3b8; font-size: 0.813rem; padding: 24px 0;">
                  No hay datos registrados aún.
                </div>
                <div *ngFor="let log of selectedTramite.historial" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 8px;">
                    <h4 style="margin: 0; font-size: 0.875rem; color: #1e293b;">{{ log.nombreNodo }}</h4>
                    <span style="font-size: 0.75rem; color: #64748b;">{{ log.fechaCompletado | date:'dd/MM HH:mm' }}</span>
                  </div>
                  <div *ngIf="log.datosFormulario?.length" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div *ngFor="let c of log.datosFormulario" style="background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                      <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block;">{{ c.etiqueta }}:</span>
                      <span style="font-size: 0.813rem; color: #1e293b;">{{ c.valor || 'N/A' }}</span>
                    </div>
                  </div>
                  <div *ngIf="log.informeIA" style="margin-top: 8px; padding: 8px; background: #fffbeb; border: 1px dashed #fcd34d; border-radius: 6px;">
                    <span style="font-size: 0.75rem; font-weight: 700; color: #d97706;">Informe:</span>
                    <p style="font-size: 0.813rem; color: #451a03; margin: 4px 0 0 0; font-style: italic;">{{ log.informeIA }}</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>

    </div>
  `,

  styles: [`
    .monitor-container { padding: 32px; height: 100%; display: flex; flex-direction: column; gap: 24px; }
    .page-header h1 { font-size: 1.5rem; }
    .page-header p { color: var(--text-muted); font-size: 0.875rem; }
    .layout { display: flex; gap: 24px; flex: 1; overflow: hidden; }
    .list-panel { flex: 1; overflow-y: auto; }
    .form-panel { width: 400px; display: flex; flex-direction: column; flex-shrink: 0; }
    .kanban-card:hover { border-color: #cbd5e1 !important; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1) !important; }
    .kanban-card.active { border-color: var(--primary) !important; background: #eff6ff !important; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2) !important; }
    .minimal-table { width: 100%; border-collapse: collapse; }
    .minimal-table th { text-align: left; padding: 12px 24px; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border-color); text-transform: uppercase; }
    .minimal-table td { padding: 16px 24px; border-bottom: 1px solid var(--border-color); font-size: 0.875rem; cursor: pointer; }
    .minimal-table tr:hover { background: #f8fafc; }
    .minimal-table tr.active { background: #eff6ff; }
    .id-text { font-family: monospace; font-weight: 600; color: var(--primary); }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; background: #cbd5e1; }
    .status-dot.en_proceso { background: #eab308; }
    .status-dot.finalizado { background: #22c55e; }
    .panel-header { padding: 24px; border-bottom: 1px solid var(--border-color); }
    .panel-header h3 { font-size: 1.1rem; }
    .panel-header p { font-size: 0.75rem; color: var(--text-muted); }
    .form-body { padding: 24px; flex: 1; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 0.75rem; color: var(--text-muted); }
    .minimal-input { padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; }
    .report-area { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .report-area label { font-size: 0.75rem; color: var(--text-muted); }
    textarea { padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; height: 120px; resize: none; }
    .panel-footer { padding: 24px; border-top: 1px solid var(--border-color); }
    .panel-footer .btn-primary { width: 100%; }
    .panel-footer .btn-primary:disabled { background: #cbd5e1; cursor: not-allowed; }
    
    .radio-card { display: block; border: 2px solid #e2e8f0; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s; background: white; }
    .radio-card:hover { border-color: #cbd5e1; background: #f8fafc; }
    .radio-card.selected { border-color: var(--primary); background: #eff6ff; }
    .radio-content { display: flex; align-items: center; gap: 12px; }
    .radio-circle { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd5e1; display: inline-block; position: relative; }
    .radio-card.selected .radio-circle { border-color: var(--primary); }
    .radio-card.selected .radio-circle::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
    
    /* Modal Styles */
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 999; }
    .modal-content { background: white; width: 650px; max-height: 85vh; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color); }
    .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--text-main); }
    .close-btn { background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer; line-height: 1; }
    .close-btn:hover { color: #ef4444; }
    .modal-body-scroll { padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
    .section-title { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.05em; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }

    /* Modal Process Tracker Steps */
    .flow-steps { display: flex; flex-direction: column; gap: 12px; }
    .flow-step { display: flex; align-items: center; gap: 16px; background: #f8fafc; border: 1px solid var(--border-color); padding: 10px 16px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
    .flow-step.completed { border-left-color: #22c55e; background: #f0fdf4; }
    .flow-step.current { border-left-color: #eab308; background: #fefce8; }
    .step-icon { font-size: 1.25rem; }
    .step-info { display: flex; flex-direction: column; flex: 1; }
    .step-name { font-size: 0.875rem; font-weight: 600; color: var(--text-main); }
    .step-dept { font-size: 0.75rem; color: var(--text-muted); }
    .step-duration { font-size: 0.7rem; font-weight: 600; color: var(--primary); margin-top: 2px; }
    .step-status { font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 12px; background: #e2e8f0; color: #64748b; }
    .completed .step-status { background: #dcfce7; color: #166534; }
    .current .step-status { background: #fef9c3; color: #713f12; }
    
    /* History Styles */
    .history-item { background: #f8fafc; border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; border-left: 3px solid var(--primary); }
    .history-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .history-header h4 { font-size: 0.9rem; margin: 0; color: var(--text-main); }
    .history-header .date { font-size: 0.7rem; color: var(--text-muted); }
    .history-fields { display: flex; flex-direction: column; gap: 4px; font-size: 0.813rem; }
    .hist-field { background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .lbl { font-weight: 600; color: var(--text-muted); margin-right: 6px; font-size: 0.75rem; }
    .val { color: var(--text-main); }
    .history-report { background: white; padding: 10px; border-radius: 4px; border: 1px dashed #cbd5e1; }
    .history-report p { font-size: 0.813rem; color: var(--text-main); margin-top: 4px; font-style: italic; }
    .empty-history { font-size: 0.875rem; color: var(--text-muted); text-align: center; margin-top: 24px; }

    /* Dark operational monitor */
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

    .monitor-container {
      padding: 24px !important;
      background: transparent !important;
      gap: 18px !important;
    }

    .page-header {
      background: rgba(23, 23, 26, 0.96);
      border: 1px solid #2b2b31;
      border-radius: 8px;
      padding: 18px 20px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }

    .page-header h1 {
      color: #f9fafb !important;
      font-size: 1.35rem !important;
      margin: 0 0 6px 0;
    }

    .page-header p {
      color: #9ca3af !important;
      margin: 0;
    }

    .kanban-board {
      gap: 14px !important;
      padding-bottom: 10px !important;
    }

    .kanban-lane {
      background: rgba(23, 23, 26, 0.96) !important;
      border: 1px solid #2b2b31 !important;
      border-radius: 8px !important;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24) !important;
    }

    .lane-header {
      border-bottom: 1px solid #33343a !important;
    }

    .lane-header h3 {
      color: #f3f4f6 !important;
      letter-spacing: 0.08em !important;
    }

    .lane-count {
      background: rgba(249, 115, 22, 0.14) !important;
      border: 1px solid rgba(249, 115, 22, 0.32);
      color: #fb923c !important;
    }

    .lane-cards {
      scrollbar-color: #3a3a42 transparent;
    }

    .kanban-card {
      background: #18191d !important;
      border: 1px solid #34353c !important;
      border-radius: 8px !important;
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22) !important;
    }

    .kanban-card:hover {
      border-color: rgba(249, 115, 22, 0.55) !important;
      background: #202126 !important;
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.32) !important;
    }

    .kanban-card.active {
      border-color: #f97316 !important;
      background: rgba(249, 115, 22, 0.1) !important;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.22), 0 16px 34px rgba(0, 0, 0, 0.32) !important;
    }

    .kanban-card .id-text {
      color: #fb923c !important;
    }

    .kanban-card div,
    .kanban-card span {
      color: #e5e7eb !important;
    }

    .kanban-card span[style*="background"] {
      background: #202126 !important;
      border: 1px solid #33343a;
      color: #9ca3af !important;
      border-radius: 999px !important;
    }

    .status-dot {
      box-shadow: 0 0 0 4px rgba(156, 163, 175, 0.11);
    }

    .status-dot.en_proceso {
      background: #f59e0b !important;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.14);
    }

    .status-dot.finalizado {
      background: #22c55e !important;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
    }

    .modal-overlay {
      background: rgba(0, 0, 0, 0.68) !important;
      backdrop-filter: blur(8px) !important;
    }

    .modal-content {
      background: #17171a !important;
      border: 1px solid #34353c !important;
      border-radius: 8px !important;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55) !important;
      color: #e5e7eb !important;
    }

    .modal-header {
      background: #18191d !important;
      border-bottom-color: #33343a !important;
    }

    .modal-header h3,
    .modal-content h3,
    .modal-content h4,
    .modal-content label,
    .modal-content span,
    .modal-content p {
      color: #e5e7eb !important;
    }

    .close-btn {
      width: 34px;
      height: 34px;
      border-radius: 6px !important;
      color: #9ca3af !important;
      transition: background 0.16s ease, color 0.16s ease;
    }

    .close-btn:hover {
      background: rgba(248, 113, 113, 0.12) !important;
      color: #f87171 !important;
    }

    .modal-body-scroll > div,
    .modal-section,
    .flow-step,
    .history-item,
    .hist-field {
      background: #18191d !important;
      border-color: #34353c !important;
    }

    .modal-body-scroll > div:first-child {
      background: #18191d !important;
      border: 1px solid #34353c !important;
      border-radius: 8px !important;
    }

    .section-title {
      color: #fb923c !important;
      border-bottom-color: rgba(249, 115, 22, 0.55) !important;
    }

    .minimal-input,
    textarea,
    select {
      background: #202126 !important;
      border: 1px solid #33343a !important;
      color: #e5e7eb !important;
      border-radius: 6px !important;
    }

    .minimal-input:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: #f97316 !important;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.16);
    }

    option {
      background: #18191d;
      color: #e5e7eb;
    }

    .radio-card {
      background: #202126 !important;
      border-color: #33343a !important;
    }

    .radio-card:hover {
      border-color: rgba(249, 115, 22, 0.55) !important;
      background: rgba(249, 115, 22, 0.08) !important;
    }

    .radio-card.selected {
      border-color: #f97316 !important;
      background: rgba(249, 115, 22, 0.13) !important;
    }

    .radio-circle {
      border-color: #6b7280 !important;
    }

    .radio-card.selected .radio-circle {
      border-color: #f97316 !important;
    }

    .radio-card.selected .radio-circle::after {
      background: #f97316 !important;
    }

    .btn-primary {
      min-height: 40px;
      background: #f97316 !important;
      border: 1px solid #fb923c !important;
      color: #111113 !important;
      border-radius: 6px !important;
      font-weight: 800 !important;
      box-shadow: 0 12px 28px rgba(249, 115, 22, 0.26);
      transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: #fb923c !important;
      box-shadow: 0 16px 34px rgba(249, 115, 22, 0.34);
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      background: #3a3a42 !important;
      border-color: #3a3a42 !important;
      color: #6b7280 !important;
      box-shadow: none;
      cursor: not-allowed;
    }

    .flow-step {
      border-left-color: #3a3a42 !important;
    }

    .flow-step.completed {
      border-left-color: #22c55e !important;
      background: rgba(34, 197, 94, 0.08) !important;
    }

    .flow-step.current {
      border-left-color: #f97316 !important;
      background: rgba(249, 115, 22, 0.1) !important;
    }

    .step-status {
      background: #202126 !important;
      border: 1px solid #33343a;
      color: #9ca3af !important;
      border-radius: 999px !important;
    }

    .completed .step-status {
      background: rgba(34, 197, 94, 0.14) !important;
      border-color: rgba(34, 197, 94, 0.32);
      color: #86efac !important;
    }

    .current .step-status {
      background: rgba(249, 115, 22, 0.14) !important;
      border-color: rgba(249, 115, 22, 0.32);
      color: #fb923c !important;
    }

    .history-report,
    .modal-content div[style*="background: white"],
    .modal-content div[style*="background: #f8fafc"],
    .modal-content div[style*="background: #fffbeb"] {
      background: #202126 !important;
      border-color: #33343a !important;
    }

    @media (max-width: 900px) {
      .monitor-container {
        padding: 16px !important;
      }

      .modal-body-scroll {
        grid-template-columns: 1fr !important;
        overflow-y: auto !important;
      }
    }
  `]
})
export class MonitorComponent implements OnInit {
  private workflowService = inject(WorkflowService);
  tramites: any[] = [];
  selectedTramite: any = null;
  currentNode: any = null;
  policyNodes: any[] = [];
  policyConnections: any[] = [];
  selectedOutcome: string = '';
  iaReport: string = '';
  showModal: boolean = false;

  openModal() {
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  policies: any[] = [];
  lanes: string[] = ['Atención al Cliente', 'Técnico', 'Dirección', 'Finalizados'];

  ngOnInit() { 
    this.workflowService.getPolicies().subscribe(policies => {
      this.policies = policies;
      this.loadTramites(); 
    }); 
  }

  getTramiteLane(t: any): string {
    if (t.estado === 'FINALIZADO') return 'Finalizados';
    
    const pol = this.policies.find(p => p.id === t.politicaId);
    if (!pol) return 'Sin Asignar';
    
    const node = pol.nodos.find((n: any) => n.id === t.nodoActualId);
    if (!node) return 'Sin Asignar';
    
    return this.getDeptoName(node.departamentoId);
  }

  getTramitesByLane(lane: string): any[] {
    return this.tramites.filter(t => this.getTramiteLane(t) === lane);
  }

  loadTramites() {
    this.workflowService.getTramites().subscribe(data => {
      this.tramites = data;
      // Refresh selected tramite if it exists
      if (this.selectedTramite) {
        const updated = this.tramites.find(t => t.id === this.selectedTramite.id);
        if (updated) {
          this.seleccionarTramite(updated);
        }
      }
    });
  }

  seleccionarTramite(t: any) {
    this.selectedTramite = t;
    this.iaReport = '';
    this.policyNodes = [];
    
    this.workflowService.getPolicies().subscribe(policies => {
      const p = policies.find(pol => pol.id === t.politicaId);
      this.policyNodes = p?.nodos || [];
      this.policyConnections = p?.conexiones || [];
      this.selectedOutcome = '';
      
      if (t.estado !== 'FINALIZADO') {
        this.currentNode = this.policyNodes.find((n: any) => n.id === t.nodoActualId);
      } else {
        this.currentNode = null;
      }
      this.showModal = true;
    });
  }

  getDeptoName(id: string): string {
    const deptos: any = { '1': 'Atención al Cliente', '2': 'Técnico', '3': 'Dirección' };
    return deptos[id] || 'General';
  }

  isNodeCompleted(nodeId: string): boolean {
    if (!this.selectedTramite || !this.selectedTramite.historial) return false;
    return this.selectedTramite.historial.some((h: any) => h.nodoId === nodeId);
  }

  getDuracionNodo(nodeId: string): string {
    if (!this.selectedTramite || !this.selectedTramite.historial) return '';
    const log = this.selectedTramite.historial.find((h: any) => h.nodoId === nodeId);
    if (!log || log.duracionSegundos == null) return '';
    
    const seg = log.duracionSegundos;
    if (seg < 60) return seg + ' seg';
    const min = Math.floor(seg / 60);
    if (min < 60) return min + ' min';
    const hrs = Math.floor(min / 60);
    return hrs + ' hrs';
  }

  getTiempoTotalTramite(t: any): string {
    if (!t.fechaInicio) return 'N/A';
    const start = new Date(t.fechaInicio).getTime();
    
    let end: number;
    if (t.estado === 'FINALIZADO' && t.historial && t.historial.length > 0) {
      const ultimoLog = t.historial[t.historial.length - 1];
      end = new Date(ultimoLog.fechaCompletado).getTime();
    } else {
      end = new Date().getTime();
    }
    
    const diffSecs = Math.floor((end - start) / 1000);
    if (diffSecs < 60) return diffSecs + ' seg';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return diffMins + ' min';
    const diffHrs = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return diffHrs + ' h ' + remainingMins + ' m';
  }

  getAvailableOutcomes(): string[] {
    if (!this.currentNode || !this.policyConnections) return [];
    
    // 1. Ver si este nodo se conecta directamente a un nodo DECISION
    const decisionNodes = this.policyNodes.filter(n => n.tipo === 'DECISION');
    const connToDecision = this.policyConnections.find(c => c.origenId === this.currentNode.id && decisionNodes.some(dn => dn.id === c.destinoId));
    
    let sourceNodeId = this.currentNode.id;
    if (connToDecision) {
      sourceNodeId = connToDecision.destinoId;
    }
    
    // 2. Buscar conexiones que salgan de sourceNodeId
    const outgoing = this.policyConnections.filter(c => c.origenId === sourceNodeId && c.condicion && c.condicion !== 'DEFAULT');
    return outgoing.map(c => c.condicion);
  }

  completar(outcomeFromBtn?: string) {
    if (outcomeFromBtn) {
      this.selectedOutcome = outcomeFromBtn;
    }

    const variables = this.currentNode.campos ? this.currentNode.campos.reduce((acc: any, curr: any) => {
      acc[curr.nombre] = curr.valor;
      return acc;
    }, {}) : {};

    if (this.selectedOutcome) {
      variables['outcome'] = this.selectedOutcome;
    }

    const extraData = {
      variables: variables,
      nombreNodo: this.currentNode.nombre,
      campos: this.currentNode.campos || [],
      informeIA: this.iaReport
    };

    this.workflowService.completarActividad(this.selectedTramite.id, this.currentNode.id, extraData).subscribe({
      next: () => {
        alert('¡Etapa completada con éxito!');
        this.closeModal();
        this.loadTramites();
      },
      error: (err) => {
        const errorMsg = err.error?.error || 'No se pudo avanzar de etapa. Si cambiaste el lienzo recientemente, inicia un nuevo trámite para aplicar los cambios.';
        alert(errorMsg);
      }
    });
  }
}
