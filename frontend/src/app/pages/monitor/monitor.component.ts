import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as tf from '@tensorflow/tfjs';
import { WorkflowService } from '../../services/workflow.service';
import { AuthService } from '../../services/auth.service';

function getSpeechRecognitionCtor(): any {
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

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

      <section class="search-panel">
        <label for="tramite-search">Buscar tramite</label>
        <input
          id="tramite-search"
          type="search"
          [(ngModel)]="searchTerm"
          placeholder="Numero de tramite, ID, cliente o funcionario"
          class="search-input"
        >
        <span>{{ filteredVisibleTramites.length }} resultado(s)</span>
      </section>

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
                  <span class="id-text" style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: var(--primary);">#{{ getTramiteNumber(t) }}</span>
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
              <p style="margin: 4px 0 0 0; font-size: 0.813rem; color: var(--text-muted);">Numero: #{{ getTramiteNumber(selectedTramite) }} / ID: #{{ selectedTramite?.id }}</p>
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
                  <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: var(--text-muted);">Calle: {{ getDeptoName(currentNode?.departamentoId, selectedPolicy) }}</p>
                  <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: var(--text-muted);">Funcionarios: {{ getAssignmentLabel(currentNode, selectedPolicy) }}</p>
                </div>

                <div class="voice-fill-panel">
                  <button
                    type="button"
                    class="voice-fill-button"
                    [class.listening]="isListeningToForm"
                    [disabled]="!voiceSupported || isFillingWithAi || !canCurrentUserWorkSelected()"
                    (click)="toggleFormVoice()"
                  >
                    {{ isListeningToForm ? 'Detener dictado' : 'Dictar datos con TensorFlow' }}
                  </button>
                  <button
                    type="button"
                    class="voice-fill-button secondary"
                    [disabled]="isFillingWithAi || !voiceTranscript.trim() || !canCurrentUserWorkSelected()"
                    (click)="fillCurrentFormFromTranscript(voiceTranscript)"
                  >
                    Aplicar texto
                  </button>
                  <textarea
                    class="voice-transcript"
                    [(ngModel)]="voiceTranscript"
                    placeholder="Tambien puedes escribir: nombre Juan Perez, carnet 778899, monto 25000, plazo 12 meses"
                  ></textarea>
                  <small *ngIf="voiceStatus">{{ voiceStatus }}</small>
                </div>

                <div class="form-body" style="padding: 0; display: flex; flex-direction: column; gap: 16px; flex: 1;">
                  <div *ngFor="let campo of currentNode?.campos" class="form-field" style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 0.813rem; font-weight: 600; color: #475569;">{{ campo.etiqueta }}</label>
                    
                    <ng-container [ngSwitch]="campo.tipo">
                      <select *ngSwitchCase="'SELECCION'" [(ngModel)]="campo.valor" class="minimal-input">
                        <option *ngFor="let opt of campo.opciones" [value]="opt">{{ opt }}</option>
                      </select>
                      
                      <div *ngSwitchCase="'FOTO'" class="file-field">
                        <input type="file" accept="image/*" class="minimal-input" (change)="uploadCampoFile(campo, $event)">
                        <a *ngIf="campo.archivoUrl" [href]="getFileUrl(campo.archivoUrl)" target="_blank">{{ campo.archivoNombre || 'Ver imagen cargada' }}</a>
                        <img *ngIf="isImageFile(campo)" class="upload-image-preview" [src]="getFileUrl(campo.archivoUrl)" [alt]="campo.archivoNombre || campo.etiqueta">
                        <small *ngIf="campo.uploading">Subiendo archivo...</small>
                      </div>
                      <div *ngSwitchCase="'ARCHIVO'" class="file-field">
                        <input type="file" [accept]="documentAccept" class="minimal-input" (change)="uploadCampoFile(campo, $event)">
                        <a *ngIf="campo.archivoUrl" [href]="getFileUrl(campo.archivoUrl)" target="_blank">{{ campo.archivoNombre || 'Ver documento cargado' }}</a>
                        <small *ngIf="campo.uploading">Subiendo archivo...</small>
                      </div>
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
                  <p *ngIf="!canCurrentUserWorkSelected()" style="font-size: 0.78rem; color: #fca5a5 !important; margin: 0 0 10px 0;">Esta tarea esta asignada a otro funcionario.</p>
                  <button class="btn-primary" (click)="completar()" [disabled]="!canCurrentUserWorkSelected() || hasPendingUploads() || missingRequiredFiles() || (getAvailableOutcomes().length > 0 && !selectedOutcome)" style="width: 100%; padding: 12px; font-weight: 600;">
                    {{ getAvailableOutcomes().length > 0 ? 'Finalizar y Enviar' : 'Finalizar Tarea' }}
                  </button>
                  <p *ngIf="missingRequiredFiles()" style="font-size: 0.78rem; color: #fca5a5 !important; margin: 10px 0 0 0;">Debes subir todos los documentos solicitados.</p>
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
              <div class="modal-section ai-prediction-panel">
                <div class="ai-prediction-header">
                  <div>
                    <h4 class="section-title">Prediccion IA</h4>
                    <p>Riesgo, ruta sugerida y mejoras del tramite.</p>
                  </div>
                  <button type="button" class="voice-fill-button" [disabled]="isLoadingPrediction" (click)="analizarRutaIA()">
                    {{ isLoadingPrediction ? 'Analizando...' : 'Analizar ruta IA' }}
                  </button>
                </div>

                <p *ngIf="predictionError" class="ai-error">{{ predictionError }}</p>

                <div *ngIf="aiPrediction" class="ai-prediction-body">
                  <div class="ai-metrics">
                    <div>
                      <span>Riesgo</span>
                      <strong [style.color]="getRiskColor(aiPrediction.riskLevel)">{{ aiPrediction.riskLevel || 'N/A' }}</strong>
                    </div>
                    <div>
                      <span>Score</span>
                      <strong>{{ formatRiskScore(aiPrediction.riskScore) }}</strong>
                    </div>
                    <div>
                      <span>Estimado</span>
                      <strong>{{ aiPrediction.estimatedDays || 0 }} dias</strong>
                    </div>
                  </div>

                  <div *ngIf="aiPrediction.recommendedRoute" class="ai-route">
                    <span>Ruta recomendada</span>
                    <strong>{{ aiPrediction.recommendedRoute.targetNodeName || 'Ruta actual' }}</strong>
                    <small>{{ aiPrediction.recommendedRoute.reason }}</small>
                  </div>

                  <div class="ai-list" *ngIf="asList(aiPrediction.motives).length">
                    <span>Motivos</span>
                    <p *ngFor="let item of asList(aiPrediction.motives)">{{ item }}</p>
                  </div>

                  <div class="ai-list" *ngIf="asList(aiPrediction.improvements).length">
                    <span>Mejoras</span>
                    <p *ngFor="let item of asList(aiPrediction.improvements)">{{ item }}</p>
                  </div>

                  <small class="ai-engine">Motor: {{ aiPrediction.engine }} / {{ aiPrediction.source }}</small>
                </div>
              </div>
              
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
                      <span class="step-dept" style="font-size: 0.75rem; color: #64748b;">{{ getDeptoName(node.departamentoId, selectedPolicy) }} / {{ getAssignmentLabel(node, selectedPolicy) }}</span>
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
                  <div class="history-meta">
                    <span>Funcionario: {{ log.usuario || 'Sin funcionario' }}</span>
                    <span>Tiempo: {{ formatDuration(log.duracionSegundos) }}</span>
                  </div>
                  <div *ngIf="log.datosFormulario?.length" class="history-fields">
                    <div *ngFor="let c of log.datosFormulario" class="history-field" [class.with-preview]="c.archivoUrl">
                      <span class="history-field-label">{{ c.etiqueta }}:</span>
                      <ng-container *ngIf="c.archivoUrl; else plainValue">
                        <div class="history-file-header">
                          <span class="history-file-type">{{ getFileTypeLabel(c) }}</span>
                          <a [href]="getFileUrl(c.archivoUrl)" target="_blank">{{ c.archivoNombre || 'Abrir archivo' }}</a>
                        </div>
                        <img *ngIf="isImageFile(c)" class="history-image-preview" [src]="getFileUrl(c.archivoUrl)" [alt]="c.archivoNombre || c.etiqueta">
                        <iframe *ngIf="isPdfFile(c)" class="history-pdf-preview" [src]="getSafeFileUrl(c)" title="Vista previa PDF"></iframe>
                        <div *ngIf="!isImageFile(c) && !isPdfFile(c)" class="history-document-preview">
                          <strong>{{ c.archivoNombre || c.valor || 'Documento adjunto' }}</strong>
                          <span>{{ c.archivoTipo || 'Archivo adjunto' }}</span>
                        </div>
                      </ng-container>
                      <ng-template #plainValue>
                        <span class="history-plain-value">{{ c.valor || 'N/A' }}</span>
                      </ng-template>
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
    .search-panel {
      display: grid;
      grid-template-columns: auto minmax(220px, 420px) auto;
      gap: 10px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid #2b2b31;
      border-radius: 8px;
      background: rgba(23, 23, 26, 0.94);
    }
    .search-panel label {
      color: #f9fafb;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .search-input {
      width: 100%;
      min-height: 38px;
      border: 1px solid #3f4652;
      border-radius: 6px;
      background: #111113;
      color: #f9fafb;
      padding: 0 10px;
      outline: none;
    }
    .search-input:focus {
      border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.16);
    }
    .search-panel span {
      color: #9ca3af;
      font-size: 0.78rem;
      white-space: nowrap;
    }
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
    .voice-fill-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; padding: 12px; border: 1px solid #34353c; border-radius: 8px; background: #202126; }
    .voice-fill-button { min-height: 36px; border: 1px solid #fb923c; border-radius: 6px; background: #f97316; color: #111113; font-weight: 800; cursor: pointer; }
    .voice-fill-button.secondary { border-color: #3f4652; background: #262a31; color: #e5e7eb; }
    .voice-fill-button.listening { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.18); }
    .voice-fill-button:disabled { border-color: #3a3a42; background: #3a3a42; color: #6b7280; cursor: not-allowed; box-shadow: none; }
    .voice-transcript { grid-column: 1 / -1; min-height: 64px; height: 64px; }
    .voice-fill-panel small { grid-column: 1 / -1; color: #fdba74; font-size: 0.74rem; line-height: 1.3; }
    .ai-prediction-panel { display: grid; gap: 12px; }
    .ai-prediction-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .ai-prediction-header p { margin: -6px 0 0 0; color: #9ca3af; font-size: 0.78rem; }
    .ai-prediction-header .voice-fill-button { min-width: 140px; padding: 0 12px; }
    .ai-error { color: #fca5a5 !important; font-size: 0.8rem; margin: 0; }
    .ai-prediction-body { display: grid; gap: 12px; }
    .ai-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .ai-metrics div, .ai-route, .ai-list { background: #202126; border: 1px solid #33343a; border-radius: 8px; padding: 10px; }
    .ai-metrics span, .ai-route span, .ai-list span { display: block; color: #9ca3af; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
    .ai-metrics strong, .ai-route strong { color: #f8fafc; font-size: 1rem; }
    .ai-route { display: grid; gap: 3px; }
    .ai-route small, .ai-engine { color: #9ca3af; font-size: 0.74rem; }
    .ai-list { display: grid; gap: 6px; }
    .ai-list p { margin: 0; color: #e5e7eb !important; font-size: 0.8rem; line-height: 1.35; }
    .file-field { display: grid; gap: 6px; }
    .file-field a { color: #2563eb; font-size: 0.8rem; font-weight: 600; text-decoration: none; }
    .file-field small { color: var(--text-muted); font-size: 0.74rem; }
    .upload-image-preview {
      width: 100%;
      max-height: 180px;
      object-fit: contain;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .history-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .history-field {
      background: #f8fafc;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      min-width: 0;
    }
    .history-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      color: #64748b;
      font-size: 0.74rem;
      font-weight: 700;
    }
    .history-meta span {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px 6px;
    }
    .history-field.with-preview {
      grid-column: span 2;
    }
    .history-field-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #64748b;
      display: block;
      margin-bottom: 4px;
    }
    .history-file-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .history-file-header a {
      color: #2563eb;
      font-size: 0.813rem;
      font-weight: 700;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .history-file-type {
      flex-shrink: 0;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .history-image-preview,
    .history-pdf-preview,
    .history-document-preview {
      width: 100%;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .history-image-preview {
      max-height: 280px;
      object-fit: contain;
      display: block;
    }
    .history-pdf-preview {
      height: 320px;
    }
    .history-document-preview {
      display: grid;
      gap: 4px;
      padding: 12px;
    }
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

    .history-meta span {
      background: #18191d !important;
      border-color: #33343a !important;
      color: #cbd5e1 !important;
    }

    .modal-content div[style*="border-bottom: 1px solid #f1f5f9"] {
      border-bottom-color: #33343a !important;
    }

    .modal-content div[style*="color: #94a3b8"],
    .modal-content p[style*="color: var(--text-muted)"],
    .modal-content span[style*="color: #64748b"],
    .step-dept {
      color: #a8b0bd !important;
    }

    .modal-content h3[style*="color: #1e293b"],
    .modal-content h4[style*="color: #1e293b"],
    .modal-content span[style*="color: #1e293b"],
    .step-name,
    .history-field-label,
    .history-plain-value,
    .history-document-preview strong {
      color: #f3f4f6 !important;
    }

    .history-field,
    .history-image-preview,
    .history-pdf-preview,
    .history-document-preview,
    .file-field,
    .voice-transcript {
      background: #18191d !important;
      border-color: #34353c !important;
      color: #e5e7eb !important;
    }

    .history-file-type,
    .history-document-preview span,
    .file-field small,
    .voice-fill-panel small {
      color: #a8b0bd !important;
    }

    .history-file-header a,
    .file-field a {
      color: #93c5fd !important;
    }

    .report-area textarea,
    .modal-content input[type="text"],
    .modal-content input[type="number"],
    .modal-content input[type="file"] {
      background: #111113 !important;
      border-color: #3f4652 !important;
      color: #f9fafb !important;
    }

    @media (max-width: 900px) {
      .monitor-container {
        padding: 16px !important;
      }

      .search-panel {
        grid-template-columns: 1fr !important;
      }

      .modal-body-scroll {
        grid-template-columns: 1fr !important;
        overflow-y: auto !important;
      }
    }
  `]
})
export class MonitorComponent implements OnInit, OnDestroy {
  private workflowService = inject(WorkflowService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  public auth = inject(AuthService);
  tramites: any[] = [];
  searchTerm = '';
  selectedTramite: any = null;
  selectedPolicy: any = null;
  currentNode: any = null;
  policyNodes: any[] = [];
  policyConnections: any[] = [];
  selectedOutcome: string = '';
  iaReport: string = '';
  showModal: boolean = false;
  documentAccept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt';
  voiceSupported = getSpeechRecognitionCtor() !== null;
  isListeningToForm = false;
  isFillingWithAi = false;
  voiceTranscript = '';
  voiceStatus = '';
  aiPrediction: any = null;
  isLoadingPrediction = false;
  predictionError = '';
  private speechRecognition: any = null;
  private voiceFinalTranscript = '';
  private shouldProcessVoiceOnEnd = false;
  private voiceRestartAttempts = 0;
  private safeFileUrlCache = new Map<string, SafeResourceUrl>();

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
      this.updateLanes();
      this.loadTramites(); 
    }); 
  }

  ngOnDestroy() {
    if (this.speechRecognition) {
      this.speechRecognition.abort();
    }
  }

  getTramiteLane(t: any): string {
    if (t.estado === 'FINALIZADO') return 'Finalizados';
    
    const pol = this.policies.find(p => p.id === t.politicaId);
    if (!pol) return 'Sin Asignar';
    
    const node = pol.nodos.find((n: any) => n.id === t.nodoActualId);
    if (!node) return 'Sin Asignar';
    
    return this.getDeptoName(node.departamentoId, pol);
  }

  getTramitesByLane(lane: string): any[] {
    return this.filteredVisibleTramites.filter(t => this.getTramiteLane(t) === lane);
  }

  get filteredVisibleTramites(): any[] {
    return this.tramites.filter(t => this.canCurrentUserSeeTramite(t) && this.matchesSearch(t));
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
    this.voiceTranscript = '';
    this.voiceStatus = '';
    this.aiPrediction = null;
    this.predictionError = '';
    this.isLoadingPrediction = false;
    this.policyNodes = [];
    
    this.workflowService.getPolicies().subscribe(policies => {
      this.policies = policies;
      this.updateLanes();
      const p = policies.find(pol => pol.id === t.politicaId);
      this.selectedPolicy = p || null;
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

  analizarRutaIA() {
    if (!this.selectedTramite?.id) return;

    this.isLoadingPrediction = true;
    this.predictionError = '';
    this.aiPrediction = null;

    this.workflowService.getTramitePrediction(this.selectedTramite.id).subscribe({
      next: response => {
        this.aiPrediction = response;
        this.isLoadingPrediction = false;
      },
      error: err => {
        this.isLoadingPrediction = false;
        this.predictionError = err.error?.error || 'No se pudo generar la prediccion del tramite.';
      }
    });
  }

  asList(value: any): string[] {
    return Array.isArray(value) ? value : [];
  }

  formatRiskScore(value: any): string {
    const number = Number(value);
    return Number.isFinite(number) ? `${Math.round(number)}%` : 'N/A';
  }

  getRiskColor(level: string): string {
    const normalized = this.normalizeText(level);
    if (normalized === 'alto') return '#f87171';
    if (normalized === 'medio') return '#fb923c';
    return '#86efac';
  }

  getDeptoName(id: string, policy?: any): string {
    const dept = policy?.departamentos?.find((d: any) => d.id === id);
    if (dept) return dept.nombre;

    for (const p of this.policies) {
      const found = p.departamentos?.find((d: any) => d.id === id);
      if (found) return found.nombre;
    }

    const deptos: any = { '1': 'Atención al Cliente', '2': 'Técnico', '3': 'Dirección' };
    return deptos[id] || 'General';
  }

  updateLanes() {
    const laneNames = new Set<string>();
    this.policies.forEach(policy => {
      (policy.departamentos || []).forEach((dept: any) => {
        if (dept.nombre) laneNames.add(dept.nombre);
      });
    });

    if (laneNames.size === 0) {
      ['Atencion al Cliente', 'Tecnico', 'Direccion'].forEach(name => laneNames.add(name));
    }

    laneNames.add('Finalizados');
    this.lanes = Array.from(laneNames);
  }

  canCurrentUserSeeTramite(t: any): boolean {
    if (this.auth.isAdmin()) return true;
    if (t.estado === 'FINALIZADO') return false;

    const policy = this.policies.find(p => p.id === t.politicaId);
    const node = policy?.nodos?.find((n: any) => n.id === t.nodoActualId);
    return this.canCurrentUserWorkOnNode(node, policy);
  }

  canCurrentUserWorkSelected(): boolean {
    return this.canCurrentUserWorkOnNode(this.currentNode, this.selectedPolicy);
  }

  canCurrentUserWorkOnNode(node: any, policy?: any): boolean {
    if (this.auth.isAdmin()) return true;
    if (!node) return false;

    const assignees = this.getAssigneesForNode(node, policy);
    const currentUser = this.auth.currentUser();
    const username = this.normalizeText(currentUser?.username || '');
    const userDepartamentoId = currentUser?.departamentoId || '';

    if (userDepartamentoId && node.departamentoId === userDepartamentoId) {
      return true;
    }

    return assignees.some(assignee => this.normalizeText(assignee) === username);
  }

  getAssignmentLabel(node: any, policy?: any): string {
    const assignees = this.getAssigneesForNode(node, policy);
    if (assignees.length === 0) return 'Sin funcionario asignado';
    return assignees.join(', ');
  }

  getAssigneesForNode(node: any, policy?: any): string[] {
    if (!node) return [];
    if (node.funcionariosAsignados?.length) return node.funcionariosAsignados;

    const dept = policy?.departamentos?.find((d: any) => d.id === node.departamentoId);
    return dept?.funcionariosAsignados || [];
  }

  getTramiteNumber(tramite: any): string {
    if (!tramite) return '';
    if (tramite.numeroTramite) return tramite.numeroTramite;
    if (tramite.id) return String(tramite.id).substring(0, 8).toUpperCase();
    return 'SIN-NUMERO';
  }

  matchesSearch(tramite: any): boolean {
    const query = this.normalizeText(this.searchTerm);
    if (!query) return true;

    const policy = this.policies.find(p => p.id === tramite.politicaId);
    const currentNode = policy?.nodos?.find((node: any) => node.id === tramite.nodoActualId);
    const historyText = (tramite.historial || [])
      .map((log: any) => [
        log.nombreNodo,
        log.usuario,
        log.informeIA,
        ...(log.datosFormulario || []).map((field: any) => `${field.etiqueta || ''} ${field.valor || ''} ${field.archivoNombre || ''}`)
      ].join(' '))
      .join(' ');

    const searchable = [
      this.getTramiteNumber(tramite),
      tramite.id,
      tramite.cliente,
      tramite.estado,
      policy?.nombre,
      currentNode?.nombre,
      this.getDeptoName(currentNode?.departamentoId, policy),
      this.getAssignmentLabel(currentNode, policy),
      historyText
    ].join(' ');

    return this.normalizeText(searchable).includes(query);
  }

  formatDuration(seconds: any): string {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return 'N/A';
    if (value < 60) return `${Math.floor(value)} seg`;
    const minutes = Math.floor(value / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours} h ${remainingMinutes} m` : `${hours} h`;
  }

  isNodeCompleted(nodeId: string): boolean {
    if (!this.selectedTramite || !this.selectedTramite.historial) return false;
    const node = this.policyNodes.find((item: any) => item.id === nodeId);
    if (node?.tipo === 'INICIO' || node?.tipo === 'START') {
      return Boolean(this.selectedTramite.fechaInicio);
    }
    if (node?.tipo === 'FIN' || node?.tipo === 'END') {
      return this.selectedTramite.estado === 'FINALIZADO'
        || this.selectedTramite.historial.some((h: any) => h.nodoId === nodeId);
    }
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

  toggleFormVoice() {
    if (this.isListeningToForm) {
      this.stopFormVoice();
      return;
    }

    this.startFormVoice();
  }

  startFormVoice() {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      this.voiceSupported = false;
      this.voiceStatus = 'Tu navegador no soporta dictado por voz. Usa Chrome o Edge.';
      return;
    }

    if (this.speechRecognition) {
      this.speechRecognition.abort();
      this.speechRecognition = null;
    }

    this.voiceFinalTranscript = '';
    this.shouldProcessVoiceOnEnd = false;
    this.voiceRestartAttempts = 0;
    this.voiceTranscript = '';
    this.createAndStartFormRecognition(SpeechRecognitionCtor);
  }

  createAndStartFormRecognition(SpeechRecognitionCtor: any) {
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-BO';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isListeningToForm = true;
      this.voiceStatus = 'Escuchando datos del formulario... presiona Detener dictado cuando termines.';
      this.cdr.detectChanges();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          this.voiceFinalTranscript = `${this.voiceFinalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript += transcript;
        }
      }

      const spokenText = `${this.voiceFinalTranscript} ${interimTranscript}`.trim();
      if (spokenText) {
        this.voiceTranscript = spokenText;
      }
      this.cdr.detectChanges();
    };

    recognition.onerror = (event: any) => {
      this.isListeningToForm = false;
      this.voiceStatus = event.error === 'not-allowed'
        ? 'Permite el microfono en el navegador para dictar datos.'
        : 'No pude escuchar bien. Intenta de nuevo.';
      this.cdr.detectChanges();
    };

    recognition.onend = () => {
      this.speechRecognition = null;
      const command = this.voiceFinalTranscript.trim() || this.voiceTranscript.trim();

      if (!this.shouldProcessVoiceOnEnd && this.isListeningToForm) {
        if (this.voiceRestartAttempts < 8) {
          this.voiceRestartAttempts++;
          setTimeout(() => this.createAndStartFormRecognition(SpeechRecognitionCtor), 250);
          return;
        }

        this.shouldProcessVoiceOnEnd = true;
      }

      this.isListeningToForm = false;

      if (command) {
        this.voiceTranscript = command;
        this.voiceStatus = 'Texto detectado. Llenando campos...';
        this.cdr.detectChanges();
        this.fillCurrentFormFromTranscript(command);
      } else if (!this.voiceStatus.includes('Permite')) {
        this.voiceStatus = 'No detecte audio. Intenta de nuevo.';
        this.cdr.detectChanges();
      }
    };

    this.speechRecognition = recognition;
    recognition.start();
  }

  stopFormVoice() {
    this.shouldProcessVoiceOnEnd = true;
    this.voiceStatus = 'Procesando dictado...';
    if (!this.speechRecognition) {
      const command = this.voiceFinalTranscript.trim() || this.voiceTranscript.trim();
      this.isListeningToForm = false;
      if (command) {
        this.fillCurrentFormFromTranscript(command);
      }
      return;
    }

    this.speechRecognition.stop();
  }

  fillCurrentFormFromTranscript(transcript: string) {
    if (!transcript.trim() || !this.currentNode) return;

    this.isFillingWithAi = true;
    this.voiceStatus = 'TensorFlow esta identificando los campos...';

    const formContext = {
      etapaActual: this.currentNode.nombre,
      calle: this.getDeptoName(this.currentNode.departamentoId, this.selectedPolicy),
      campos: (this.currentNode.campos || []).map((campo: any) => ({
        nombre: campo.nombre,
        etiqueta: campo.etiqueta,
        tipo: campo.tipo,
        opciones: campo.opciones || []
      })),
      rutasDisponibles: this.getAvailableOutcomes()
    };

    const tensorflowResponse = this.buildTensorFlowFormFillResponse(transcript, formContext);
    const tensorflowUpdated = this.applyAiFormFillResponse(tensorflowResponse);
    const totalFillable = this.getFillableFields().length;
    const filledAfterTensorFlow = this.countFilledFields();

    if (filledAfterTensorFlow >= totalFillable) {
      this.isFillingWithAi = false;
      this.voiceStatus = `TensorFlow lleno ${filledAfterTensorFlow} campo${filledAfterTensorFlow === 1 ? '' : 's'}.`;
      return;
    }

    this.voiceStatus = `TensorFlow lleno ${filledAfterTensorFlow} de ${totalFillable}. Completando con Groq...`;

    this.workflowService.sendFormFillCommand(transcript, formContext).subscribe({
      next: response => {
        this.isFillingWithAi = false;

        if (response.error) {
          this.voiceStatus = 'Error: ' + response.error;
          return;
        }

        const updated = this.applyAiFormFillResponse(response);
        const totalFilled = this.countFilledFields();
        this.voiceStatus = response.message || `Campos completados: ${totalFilled}. Groq ajusto ${updated}.`;
      },
      error: () => {
        this.isFillingWithAi = false;
        this.voiceStatus = 'No pude conectar con el backend para llenar el formulario.';
      }
    });
  }

  buildTensorFlowFormFillResponse(transcript: string, formContext: any): any {
    const fillableFields = this.getFillableFields();
    const candidates = this.extractTensorFlowCandidates(transcript, fillableFields);

    if (!fillableFields.length || !candidates.length) {
      return { message: 'TensorFlow no encontro campos para llenar.', fields: [] };
    }

    const fieldTexts = fillableFields.map(field => this.getFieldSemanticText(field));
    const candidateTexts = candidates.map(candidate => candidate.clue);
    const similarityMatrix = this.computeTensorFlowSimilarities(candidateTexts, fieldTexts);
    const fields: Array<{ nombre: string; valor: string }> = [];
    const usedFields = new Set<string>();

    candidates.forEach((candidate, candidateIndex) => {
      const scores = similarityMatrix[candidateIndex] || [];
      let bestIndex = -1;
      let bestScore = 0;

      scores.forEach((score, index) => {
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      const targetField = fillableFields[bestIndex];
      if (!targetField || usedFields.has(targetField.nombre) || bestScore < 0.12) return;

      const value = this.cleanTensorFlowValue(candidate.value, targetField);
      if (!value) return;

      fields.push({ nombre: targetField.nombre, valor: value });
      usedFields.add(targetField.nombre);
    });

    this.addHeuristicTensorFlowFields(transcript, fillableFields, fields, usedFields);

    return {
      message: fields.length ? 'TensorFlow completo campos desde el dictado.' : 'TensorFlow no encontro valores claros.',
      fields,
      engine: 'tensorflow-js',
      etapaActual: formContext.etapaActual
    };
  }

  getFillableFields(): any[] {
    return (this.currentNode?.campos || [])
      .filter((campo: any) => campo.tipo !== 'FOTO' && campo.tipo !== 'ARCHIVO');
  }

  countFilledFields(): number {
    return this.getFillableFields().filter((campo: any) => String(campo.valor || '').trim().length > 0).length;
  }

  addHeuristicTensorFlowFields(
    transcript: string,
    fields: any[],
    results: Array<{ nombre: string; valor: string }>,
    usedFields: Set<string>
  ): void {
    const normalizedTranscript = this.normalizeText(transcript);
    const allAliases = fields.flatMap(field => this.getFieldAliases(field).map(alias => this.normalizeText(alias)));
    const numbers = this.extractNumericValues(normalizedTranscript);
    const usedNumbers = new Set<string>(
      results
        .map(item => String(item.valor || '').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'))
        .filter((value): value is string => Boolean(value))
    );

    fields.forEach(field => {
      if (usedFields.has(field.nombre)) return;

      let value = this.extractValueNearFieldAlias(normalizedTranscript, field, allAliases);
      if (!value) {
        value = this.inferValueByFieldKind(normalizedTranscript, field, numbers, usedNumbers, allAliases);
      }

      value = this.cleanTensorFlowValue(value, field);
      if (!value) return;

      results.push({ nombre: field.nombre, valor: value });
      usedFields.add(field.nombre);
    });
  }

  extractValueNearFieldAlias(transcript: string, field: any, allAliases: string[]): string {
    const aliases = this.getFieldAliases(field)
      .map(alias => this.normalizeText(alias))
      .filter(alias => alias.length > 1)
      .sort((a, b) => b.length - a.length);

    for (const alias of aliases) {
      const match = new RegExp(`\\b${this.escapeRegExp(alias)}\\b`).exec(transcript);
      if (!match) continue;

      let value = transcript.slice(match.index + match[0].length).trim();
      value = value.replace(/^(es|son|sera|seria|de|del|numero|nro|no|con|por|para|el|la|los|las|mi|su)\s+/g, '');
      return this.trimAtNextAlias(value, allAliases);
    }

    return '';
  }

  trimAtNextAlias(value: string, aliases: string[]): string {
    let endIndex = value.length;
    aliases.forEach(alias => {
      if (!alias) return;
      const match = new RegExp(`\\b${this.escapeRegExp(alias)}\\b`).exec(value);
      if (match && match.index > 0 && match.index < endIndex) {
        endIndex = match.index;
      }
    });

    return value.slice(0, endIndex)
      .replace(/\b(y|tambien|ademas|luego|despues|mi|su|el|la|los|las)$/g, '')
      .trim();
  }

  inferValueByFieldKind(
    transcript: string,
    field: any,
    numbers: string[],
    usedNumbers: Set<string>,
    allAliases: string[]
  ): string {
    const kind = this.getFieldKind(field);

    if (kind === 'name') {
      const beforeFirstNumber = transcript.split(/\b\d+\b/)[0] || '';
      const beforeOtherField = this.trimAtNextAlias(beforeFirstNumber, allAliases.filter(alias =>
        !['nombre', 'nombre completo', 'cliente', 'solicitante'].includes(alias)
      ));
      const cleanedName = beforeOtherField
        .replace(/\b(nombre|completo|cliente|solicitante|es|mi|su|el|la|del|de|dato|datos)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanedName || this.isFieldMarkerOnly(cleanedName)) return '';
      return cleanedName;
    }

    if (kind === 'document') {
      return this.pickNumber(numbers, usedNumbers, number => number.length >= 5);
    }

    if (kind === 'amount') {
      if (!this.hasAnyAlias(transcript, ['monto', 'monto solicitado', 'importe', 'cantidad'])) return '';
      return this.pickNumber(numbers, usedNumbers, number => Number(number) > 120);
    }

    if (kind === 'term') {
      if (!this.hasAnyAlias(transcript, ['plazo', 'plazo en meses', 'plazo meses', 'mes', 'meses'])) return '';
      return this.pickNumber([...numbers].reverse(), usedNumbers, number => Number(number) > 0 && Number(number) <= 120);
    }

    if (field.tipo === 'NUMERO') {
      return this.pickNumber(numbers, usedNumbers, () => true);
    }

    return '';
  }

  hasAnyAlias(transcript: string, aliases: string[]): boolean {
    return aliases.some(alias => new RegExp(`\\b${this.escapeRegExp(this.normalizeText(alias))}\\b`).test(transcript));
  }

  isFieldMarkerOnly(value: string): boolean {
    const markerWords = new Set([
      'carnet', 'carne', 'ci', 'cedula', 'documento', 'identidad',
      'monto', 'importe', 'cantidad', 'plazo', 'mes', 'meses'
    ]);
    const words = this.tokenizeTensorText(value);
    return words.length > 0 && words.every(word => markerWords.has(word));
  }

  pickNumber(numbers: string[], usedNumbers: Set<string>, predicate: (number: string) => boolean): string {
    const number = numbers.find(item => !usedNumbers.has(item) && predicate(item));
    if (number) {
      usedNumbers.add(number);
    }
    return number || '';
  }

  extractNumericValues(transcript: string): string[] {
    const digitValues = Array.from(transcript.matchAll(/\b\d+(?:[.,]\d+)?\b/g))
      .map(match => match[0].replace(',', '.'));

    const wordNumbers: string[] = [];
    const tokens = transcript.split(/\s+/).filter(Boolean);
    let buffer: string[] = [];

    tokens.forEach(token => {
      if (this.isSpanishNumberToken(token)) {
        buffer.push(token);
        return;
      }

      if (buffer.length) {
        const parsed = this.parseSpanishNumber(buffer.join(' '));
        if (parsed > 0) {
          wordNumbers.push(String(parsed));
        }
        buffer = [];
      }
    });

    if (buffer.length) {
      const parsed = this.parseSpanishNumber(buffer.join(' '));
      if (parsed > 0) {
        wordNumbers.push(String(parsed));
      }
    }

    return Array.from(new Set([...digitValues, ...wordNumbers]));
  }

  isSpanishNumberToken(token: string): boolean {
    return [
      'cero', 'uno', 'una', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
      'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve',
      'veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve',
      'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento',
      'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
      'mil', 'millon', 'millones'
    ].includes(token);
  }

  parseSpanishNumber(text: string): number {
    const units: Record<string, number> = {
      cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
      diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
      veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
      treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
      cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900
    };

    let total = 0;
    let current = 0;

    this.normalizeText(text).split(/\s+/).forEach(token => {
      if (token === 'mil') {
        total += (current || 1) * 1000;
        current = 0;
      } else if (token === 'millon' || token === 'millones') {
        total += (current || 1) * 1000000;
        current = 0;
      } else if (units[token] != null) {
        current += units[token];
      }
    });

    return total + current;
  }

  getFieldKind(field: any): 'name' | 'document' | 'amount' | 'term' | 'generic' {
    const normalized = this.normalizeText(`${field.etiqueta || ''} ${field.nombre || ''}`);

    if (/(nombre|cliente|solicitante)/.test(normalized)) return 'name';
    if (/(documento|identidad|carnet|cedula|ci)/.test(normalized)) return 'document';
    if (/(monto|importe|cantidad)/.test(normalized)) return 'amount';
    if (/(plazo|mes)/.test(normalized)) return 'term';

    return 'generic';
  }

  extractTensorFlowCandidates(transcript: string, fields: any[]): Array<{ clue: string; value: string }> {
    const normalizedTranscript = this.normalizeText(transcript);
    const aliases = fields.flatMap((field: any) =>
      this.getFieldAliases(field).map(alias => this.normalizeText(alias)).filter(alias => alias.length > 1)
    );
    const uniqueAliases = Array.from(new Set(aliases)).sort((a, b) => b.length - a.length);
    const matches: Array<{ alias: string; start: number; end: number }> = [];

    uniqueAliases.forEach(alias => {
      const pattern = new RegExp(`\\b${this.escapeRegExp(alias)}\\b`, 'g');
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalizedTranscript)) !== null) {
        matches.push({ alias, start: match.index, end: match.index + match[0].length });
      }
    });

    const orderedMatches = matches
      .sort((a, b) => a.start - b.start || b.alias.length - a.alias.length)
      .filter((match, index, all) => {
        const previous = all[index - 1];
        return !previous || match.start >= previous.end;
      });

    if (!orderedMatches.length) {
      return this.extractFallbackCandidates(normalizedTranscript);
    }

    return orderedMatches
      .map((match, index) => {
        const next = orderedMatches[index + 1];
        return {
          clue: match.alias,
          value: normalizedTranscript.slice(match.end, next ? next.start : normalizedTranscript.length).trim()
        };
      })
      .filter(candidate => candidate.value.length > 0);
  }

  extractFallbackCandidates(normalizedTranscript: string): Array<{ clue: string; value: string }> {
    return normalizedTranscript
      .split(/[,;]+/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const words = part.split(/\s+/);
        return {
          clue: words.slice(0, Math.min(3, words.length)).join(' '),
          value: words.slice(Math.min(2, words.length)).join(' ')
        };
      })
      .filter(candidate => candidate.value.length > 0);
  }

  computeTensorFlowSimilarities(candidateTexts: string[], fieldTexts: string[]): number[][] {
    const vocabulary = this.buildTensorVocabulary([...candidateTexts, ...fieldTexts]);
    if (!vocabulary.length) {
      return candidateTexts.map(() => fieldTexts.map(() => 0));
    }

    const candidateVectors = candidateTexts.map(text => this.vectorizeText(text, vocabulary));
    const fieldVectors = fieldTexts.map(text => this.vectorizeText(text, vocabulary));

    return tf.tidy(() => {
      const candidateTensor = tf.tensor2d(candidateVectors);
      const fieldTensor = tf.tensor2d(fieldVectors);
      const candidateNorms = tf.sqrt(tf.sum(tf.square(candidateTensor), 1)).expandDims(1).add(1e-6);
      const fieldNorms = tf.sqrt(tf.sum(tf.square(fieldTensor), 1)).expandDims(1).add(1e-6);
      const normalizedCandidates = candidateTensor.div(candidateNorms);
      const normalizedFields = fieldTensor.div(fieldNorms);
      return normalizedCandidates.matMul(normalizedFields.transpose()).arraySync() as number[][];
    });
  }

  buildTensorVocabulary(texts: string[]): string[] {
    const stopWords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'por', 'para', 'con', 'un', 'una', 'y']);
    return Array.from(new Set(
      texts.flatMap(text => this.tokenizeTensorText(text)).filter(token => !stopWords.has(token))
    ));
  }

  vectorizeText(text: string, vocabulary: string[]): number[] {
    const tokens = this.tokenizeTensorText(text);
    return vocabulary.map(term => tokens.filter(token => token === term).length / Math.max(tokens.length, 1));
  }

  tokenizeTensorText(text: string): string[] {
    return this.normalizeText(text)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  getFieldSemanticText(field: any): string {
    return this.getFieldAliases(field).join(' ');
  }

  getFieldAliases(field: any): string[] {
    const label = `${field.etiqueta || ''} ${field.nombre || ''}`;
    const normalized = this.normalizeText(label);
    const aliases = [field.etiqueta, field.nombre];

    if (/(nombre|cliente|solicitante)/.test(normalized)) {
      aliases.push('nombre', 'nombre completo', 'cliente', 'solicitante');
    }

    if (/(documento|identidad|carnet|cedula|ci)/.test(normalized)) {
      aliases.push('documento', 'documento de identidad', 'carnet', 'carne', 'carnet de identidad', 'numero de carnet', 'cedula', 'ci');
    }

    if (/(monto|importe|cantidad)/.test(normalized)) {
      aliases.push('monto', 'monto solicitado', 'importe', 'cantidad');
    }

    if (/(plazo|mes)/.test(normalized)) {
      aliases.push('plazo', 'plazo en meses', 'plazo meses');
    }

    if (/(ingreso|salario)/.test(normalized)) {
      aliases.push('ingresos', 'ingresos mensuales', 'salario');
    }

    if (/(riesgo|resultado|dictamen|decision)/.test(normalized)) {
      aliases.push('resultado', 'dictamen', 'decision');
    }

    return Array.from(new Set(aliases.filter(Boolean).map(alias => String(alias))));
  }

  cleanTensorFlowValue(value: string, field: any): string {
    let cleaned = this.normalizeText(value)
      .replace(/^(es|son|de|del|el|la|los|las|numero|nro|no|con|por|en|para|solicitado|solicitada)\s+/g, '')
      .replace(/\b(bolivianos|bs|meses|mes)\b/g, '')
      .trim();

    if (field.tipo === 'NUMERO') {
      const numericValue = cleaned.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');
      if (numericValue) return numericValue;

      const parsed = this.parseSpanishNumber(cleaned);
      return parsed > 0 ? String(parsed) : '';
    }

    if (field.tipo === 'SELECCION') {
      const selected = (field.opciones || []).find((option: string) =>
        this.normalizeText(option) === cleaned || cleaned.includes(this.normalizeText(option))
      );
      return selected || '';
    }

    return cleaned
      .replace(/\b(y|tambien|ademas|luego|despues|mi|su|el|la|los|las)$/g, '')
      .trim();
  }

  escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  applyAiFormFillResponse(response: any): number {
    let updated = 0;
    const fields = Array.isArray(response.fields) ? response.fields : [];

    fields.forEach((item: any) => {
      const target = this.findCampoForAiValue(item);
      if (!target || target.tipo === 'FOTO' || target.tipo === 'ARCHIVO') return;

      target.valor = String(item.valor ?? '').trim();
      if (target.valor) {
        updated++;
      }
    });

    if (response.outcome && this.getAvailableOutcomes().includes(response.outcome)) {
      this.selectedOutcome = response.outcome;
    }

    if (response.informe) {
      this.iaReport = this.iaReport
        ? `${this.iaReport}\n${response.informe}`
        : response.informe;
    }

    return updated;
  }

  findCampoForAiValue(item: any): any {
    const fields = this.currentNode?.campos || [];
    const name = this.normalizeText(item.nombre || '');
    const label = this.normalizeText(item.etiqueta || '');

    return fields.find((campo: any) => this.normalizeText(campo.nombre) === name)
      || fields.find((campo: any) => this.normalizeText(campo.etiqueta) === label)
      || fields.find((campo: any) => this.normalizeText(campo.etiqueta).includes(name) && name.length > 2)
      || null;
  }

  uploadCampoFile(campo: any, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    campo.uploading = true;
    this.workflowService.uploadFile(file).subscribe({
      next: response => {
        campo.archivoNombre = response.archivoNombre;
        campo.archivoTipo = response.archivoTipo;
        campo.archivoUrl = response.archivoUrl;
        campo.valor = response.archivoNombre;
        campo.uploading = false;
      },
      error: err => {
        campo.uploading = false;
        input.value = '';
        alert(err.error?.error || 'No se pudo subir el archivo.');
      }
    });
  }

  getFileUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return path;
  }

  getSafeFileUrl(campo: any): SafeResourceUrl {
    const url = this.getFileUrl(campo?.archivoUrl || '');
    if (!this.safeFileUrlCache.has(url)) {
      this.safeFileUrlCache.set(url, this.sanitizer.bypassSecurityTrustResourceUrl(url));
    }
    return this.safeFileUrlCache.get(url) as SafeResourceUrl;
  }

  isImageFile(campo: any): boolean {
    if (!campo?.archivoUrl) return false;
    const type = String(campo.archivoTipo || '').toLowerCase();
    const name = String(campo.archivoNombre || campo.archivoUrl || '').toLowerCase();
    return campo.tipo === 'FOTO'
      || type.startsWith('image/')
      || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
  }

  isPdfFile(campo: any): boolean {
    if (!campo?.archivoUrl) return false;
    const type = String(campo.archivoTipo || '').toLowerCase();
    const name = String(campo.archivoNombre || campo.archivoUrl || '').toLowerCase();
    return type === 'application/pdf' || /\.pdf$/i.test(name);
  }

  getFileTypeLabel(campo: any): string {
    if (this.isImageFile(campo)) return 'Imagen';
    if (this.isPdfFile(campo)) return 'PDF';
    return 'Archivo';
  }

  hasPendingUploads(): boolean {
    return (this.currentNode?.campos || []).some((campo: any) => campo.uploading);
  }

  missingRequiredFiles(): boolean {
    return (this.currentNode?.campos || [])
      .filter((campo: any) => campo.tipo === 'FOTO' || campo.tipo === 'ARCHIVO')
      .some((campo: any) => !campo.archivoUrl);
  }

  normalizeText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  completar(outcomeFromBtn?: string) {
    if (!this.canCurrentUserWorkSelected()) {
      alert('Esta tarea esta asignada a otro funcionario.');
      return;
    }

    if (this.hasPendingUploads()) {
      alert('Espera a que terminen de subir los archivos.');
      return;
    }

    if (this.missingRequiredFiles()) {
      alert('Debes subir todos los documentos solicitados.');
      return;
    }

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
      informeIA: this.iaReport,
      usuario: this.auth.currentUser()?.username || 'Funcionario'
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
