import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../../services/auth.service';
import { Usuario, WorkflowService } from '../../services/workflow.service';

function getSpeechRecognitionCtor(): any {
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

interface ReportRow {
  funcionario: string;
  tipo: 'Completada' | 'Pendiente actual';
  cliente: string;
  tramiteId: string;
  politica: string;
  etapa: string;
  estadoTramite: string;
  fecha: Date | null;
  fechaTexto: string;
  duracionSegundos: number;
  duracion: string;
  datos: string;
  informe: string;
}

interface ChartRow {
  label: string;
  value: number;
  percent: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports-shell">
      <section class="reports-header">
        <div>
          <span class="eyebrow">Reportes</span>
          <h1>{{ auth.isAdmin() ? 'Control por funcionario' : 'Mi actividad' }}</h1>
          <p>{{ auth.isAdmin() ? 'Filtra, revisa rendimiento y descarga el detalle de actividades.' : 'Consulta las tareas que completaste y las que tienes pendientes.' }}</p>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="voice-action"
            [class.listening]="isListening"
            [disabled]="!voiceSupported"
            (click)="toggleVoiceFilter()"
          >
            {{ isListening ? 'Detener voz' : 'Filtrar por voz' }}
          </button>
          <button type="button" class="ghost-action" [disabled]="reportRows.length === 0" (click)="downloadPdf()">Descargar PDF</button>
          <button type="button" class="primary-action" [disabled]="reportRows.length === 0" (click)="downloadReport()">Descargar CSV</button>
        </div>
      </section>

      <section class="voice-panel">
        <textarea
          [(ngModel)]="voiceTranscript"
          placeholder="Ej: funcionario Funcionario 2, completadas, desde 2026-05-01 hasta 2026-05-30, descargar pdf"
        ></textarea>
        <div class="voice-tools">
          <button type="button" class="ghost-action" [disabled]="!voiceTranscript.trim()" (click)="applyVoiceFilter(voiceTranscript)">Aplicar voz/texto</button>
          <small>{{ voiceStatus || 'Puedes dictar filtros y pedir descargar PDF.' }}</small>
        </div>
      </section>

      <section class="filters-panel">
        <label *ngIf="auth.isAdmin()">
          <span>Funcionario</span>
          <select [(ngModel)]="selectedFuncionario">
            <option value="">Todos los funcionarios</option>
            <option *ngFor="let funcionario of funcionarios" [value]="funcionario.username">{{ funcionario.username }}</option>
          </select>
        </label>

        <label>
          <span>Desde</span>
          <input type="date" [(ngModel)]="reportFromDate" />
        </label>

        <label>
          <span>Hasta</span>
          <input type="date" [(ngModel)]="reportToDate" />
        </label>

        <label>
          <span>Tipo</span>
          <select [(ngModel)]="selectedType">
            <option value="">Todo</option>
            <option value="Completada">Completadas</option>
            <option value="Pendiente actual">Pendientes actuales</option>
          </select>
        </label>
      </section>

      <section class="kpi-grid">
        <article class="kpi-card">
          <span>Filas</span>
          <strong>{{ reportRows.length }}</strong>
          <small>segun filtros</small>
        </article>
        <article class="kpi-card">
          <span>Completadas</span>
          <strong>{{ completedRows.length }}</strong>
          <small>actividades cerradas</small>
        </article>
        <article class="kpi-card">
          <span>Pendientes</span>
          <strong>{{ pendingRows.length }}</strong>
          <small>asignadas ahora</small>
        </article>
        <article class="kpi-card accent">
          <span>Promedio</span>
          <strong>{{ averageDuration }}</strong>
          <small>por actividad</small>
        </article>
      </section>

      <section class="charts-grid">
        <article class="chart-card">
          <div class="card-head">
            <div>
              <span class="eyebrow">{{ auth.isAdmin() ? 'Funcionarios' : 'Etapas' }}</span>
              <h2>{{ auth.isAdmin() ? 'Actividades completadas' : 'Mis etapas completadas' }}</h2>
            </div>
            <span class="pill">{{ mainChartRows.length }}</span>
          </div>

          <div class="bar-list" *ngIf="mainChartRows.length; else emptyChart">
            <div class="bar-row" *ngFor="let row of mainChartRows">
              <div class="bar-meta">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
              <div class="bar-track">
                <div class="bar-fill" [style.width.%]="row.percent"></div>
              </div>
            </div>
          </div>
        </article>

        <article class="chart-card">
          <div class="card-head">
            <div>
              <span class="eyebrow">Estado</span>
              <h2>Completadas vs pendientes</h2>
            </div>
            <span class="pill">{{ reportRows.length }} total</span>
          </div>

          <div class="donut-wrap">
            <div class="donut" [style.background]="donutBackground">
              <div class="donut-hole">
                <strong>{{ completionPercent }}%</strong>
                <span>cerrado</span>
              </div>
            </div>
            <div class="legend">
              <span><i class="done"></i> Completadas: {{ completedRows.length }}</span>
              <span><i class="todo"></i> Pendientes: {{ pendingRows.length }}</span>
            </div>
          </div>
        </article>

        <article class="chart-card wide">
          <div class="card-head">
            <div>
              <span class="eyebrow">Politicas</span>
              <h2>Volumen por flujo</h2>
            </div>
            <span class="pill">{{ policyChartRows.length }}</span>
          </div>

          <div class="bar-list compact" *ngIf="policyChartRows.length; else emptyChart">
            <div class="bar-row" *ngFor="let row of policyChartRows">
              <div class="bar-meta">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
              <div class="bar-track">
                <div class="bar-fill secondary" [style.width.%]="row.percent"></div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="table-panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Detalle</span>
            <h2>Actividades del reporte</h2>
          </div>
          <span class="pill">{{ reportRows.length }} registros</span>
        </div>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Politica</th>
                <th>Etapa</th>
                <th>Fecha</th>
                <th>Duracion</th>
                <th>Datos</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of reportRows">
                <td>{{ row.funcionario }}</td>
                <td><span class="status" [class.pending]="row.tipo === 'Pendiente actual'">{{ row.tipo }}</span></td>
                <td>{{ row.cliente }}</td>
                <td>{{ row.politica }}</td>
                <td>{{ row.etapa }}</td>
                <td>{{ row.fechaTexto || '-' }}</td>
                <td>{{ row.duracion || '-' }}</td>
                <td class="data-cell">{{ row.datos || '-' }}</td>
              </tr>
              <tr *ngIf="reportRows.length === 0">
                <td colspan="8" class="empty-table">No hay datos para los filtros seleccionados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ng-template #emptyChart>
        <div class="empty-chart">Sin datos suficientes para graficar.</div>
      </ng-template>
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

    .reports-shell {
      height: 100%;
      overflow-y: auto;
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .reports-header,
    .filters-panel,
    .kpi-card,
    .chart-card,
    .table-panel {
      background: rgba(23, 23, 26, 0.94);
      border: 1px solid #2b2b31;
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }

    .reports-header {
      padding: 22px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .eyebrow {
      display: block;
      color: #f97316;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    h1, h2, p {
      margin: 0;
    }

    h1 {
      color: #f9fafb;
      font-size: 1.55rem;
    }

    h2 {
      color: #f9fafb;
      font-size: 1rem;
    }

    p {
      color: #9ca3af;
      margin-top: 8px;
    }

    .primary-action {
      min-height: 38px;
      border: 1px solid #fb923c;
      border-radius: 6px;
      color: #111113;
      background: #f97316;
      font-weight: 800;
      padding: 0 14px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .voice-action,
    .ghost-action {
      min-height: 38px;
      border: 1px solid #33343a;
      border-radius: 6px;
      background: #202126;
      color: #e5e7eb;
      font-weight: 800;
      padding: 0 12px;
    }

    .voice-action.listening {
      border-color: #fb923c;
      background: #f97316;
      color: #111113;
      box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.16);
    }

    .voice-action:disabled,
    .ghost-action:disabled {
      background: #3a3a42;
      border-color: #3a3a42;
      color: #6b7280;
      cursor: not-allowed;
      box-shadow: none;
    }

    .primary-action:disabled {
      background: #3a3a42;
      border-color: #3a3a42;
      color: #6b7280;
      cursor: not-allowed;
    }

    .voice-panel {
      background: rgba(23, 23, 26, 0.94);
      border: 1px solid #2b2b31;
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
      padding: 14px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: stretch;
    }

    .voice-panel textarea {
      min-height: 72px;
      resize: vertical;
      border: 1px solid #33343a;
      border-radius: 6px;
      background: #202126;
      color: #e5e7eb;
      padding: 10px;
      outline: none;
    }

    .voice-tools {
      min-width: 220px;
      display: grid;
      align-content: start;
      gap: 8px;
    }

    .voice-tools small {
      color: #fdba74;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .filters-panel {
      padding: 16px;
      display: grid;
      grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(150px, 1fr));
      gap: 12px;
    }

    .filters-panel label {
      display: grid;
      gap: 6px;
      color: #9ca3af;
      font-size: 0.76rem;
      font-weight: 800;
    }

    select,
    input {
      min-height: 38px;
      border: 1px solid #33343a;
      border-radius: 6px;
      background: #202126;
      color: #e5e7eb;
      padding: 0 10px;
      outline: none;
    }

    select:focus,
    input:focus {
      border-color: #f97316;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.16);
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
      gap: 14px;
    }

    .kpi-card {
      padding: 16px;
      display: grid;
      gap: 6px;
    }

    .kpi-card span,
    .kpi-card small {
      color: #9ca3af;
      font-size: 0.78rem;
    }

    .kpi-card strong {
      color: #f9fafb;
      font-size: 1.65rem;
      line-height: 1;
    }

    .kpi-card.accent {
      border-color: rgba(249, 115, 22, 0.5);
    }

    .charts-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
      gap: 14px;
    }

    .chart-card,
    .table-panel {
      overflow: hidden;
    }

    .chart-card.wide {
      grid-column: 1 / -1;
    }

    .card-head {
      min-height: 70px;
      border-bottom: 1px solid #2b2b31;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
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

    .bar-list {
      padding: 16px;
      display: grid;
      gap: 14px;
    }

    .bar-list.compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .bar-row {
      display: grid;
      gap: 8px;
    }

    .bar-meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.83rem;
      color: #d1d5db;
    }

    .bar-meta span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-meta strong {
      color: #f9fafb;
    }

    .bar-track {
      height: 10px;
      border-radius: 999px;
      background: #25262c;
      overflow: hidden;
      border: 1px solid #33343a;
    }

    .bar-fill {
      height: 100%;
      min-width: 3px;
      border-radius: 999px;
      background: linear-gradient(90deg, #f97316, #fbbf24);
    }

    .bar-fill.secondary {
      background: linear-gradient(90deg, #22c55e, #38bdf8);
    }

    .donut-wrap {
      min-height: 250px;
      display: grid;
      place-items: center;
      gap: 16px;
      padding: 18px;
    }

    .donut {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 1px #33343a;
    }

    .donut-hole {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: #17171a;
      border: 1px solid #33343a;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 2px;
    }

    .donut-hole strong {
      color: #f9fafb;
      font-size: 1.35rem;
    }

    .donut-hole span,
    .legend {
      color: #9ca3af;
      font-size: 0.78rem;
    }

    .legend {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .legend i {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      margin-right: 5px;
    }

    .legend .done {
      background: #f97316;
    }

    .legend .todo {
      background: #34353c;
    }

    .table-scroll {
      overflow: auto;
    }

    table {
      width: 100%;
      min-width: 1040px;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid #2b2b31;
      padding: 12px 14px;
      text-align: left;
      font-size: 0.8rem;
      vertical-align: top;
    }

    th {
      color: #9ca3af;
      background: #18191d;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.7rem;
    }

    td {
      color: #e5e7eb;
    }

    .status {
      display: inline-flex;
      border: 1px solid rgba(34, 197, 94, 0.32);
      background: rgba(34, 197, 94, 0.12);
      color: #86efac;
      border-radius: 999px;
      padding: 4px 8px;
      white-space: nowrap;
    }

    .status.pending {
      border-color: rgba(249, 115, 22, 0.32);
      background: rgba(249, 115, 22, 0.12);
      color: #fb923c;
    }

    .data-cell {
      max-width: 320px;
      color: #cbd5e1;
    }

    .empty-chart,
    .empty-table {
      color: #9ca3af;
      text-align: center;
      padding: 28px;
    }

    @media (max-width: 1100px) {
      .kpi-grid,
      .charts-grid {
        grid-template-columns: 1fr 1fr;
      }

      .filters-panel,
      .bar-list.compact {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 760px) {
      .reports-shell {
        padding: 16px;
      }

      .reports-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .header-actions {
        width: 100%;
        justify-content: stretch;
      }

      .header-actions button {
        flex: 1;
      }

      .voice-panel {
        grid-template-columns: 1fr;
      }

      .filters-panel,
      .kpi-grid,
      .charts-grid,
      .bar-list.compact {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ReportsComponent implements OnInit, OnDestroy {
  public auth = inject(AuthService);
  private workflowService = inject(WorkflowService);

  policies: any[] = [];
  tramites: any[] = [];
  usuarios: Usuario[] = [];
  selectedFuncionario = '';
  selectedType = '';
  reportFromDate = '';
  reportToDate = '';
  voiceSupported = getSpeechRecognitionCtor() !== null;
  isListening = false;
  voiceTranscript = '';
  voiceStatus = '';
  private speechRecognition: any = null;

  ngOnInit(): void {
    if (this.auth.isFuncionario()) {
      this.selectedFuncionario = this.auth.currentUser()?.username || '';
    }

    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.speechRecognition) {
      this.speechRecognition.abort();
    }
  }

  loadData(): void {
    this.workflowService.getPolicies().subscribe(data => this.policies = data);
    this.workflowService.getTramites().subscribe(data => this.tramites = data);
    this.workflowService.getUsuarios().subscribe(data => this.usuarios = data);
  }

  get funcionarios(): Usuario[] {
    return this.usuarios.filter(usuario => usuario.rol === 'FUNCIONARIO');
  }

  get allRows(): ReportRow[] {
    const rows: ReportRow[] = [];

    this.tramites.forEach(tramite => {
      const policy = this.getPolicy(tramite);
      const policyName = policy?.nombre || tramite.politicaId || 'Sin politica';

      (tramite.historial || []).forEach((log: any) => {
        const node = this.getNodeById(policy, log.nodoId);
        if (!this.isReportableCompletedLog(log, node)) {
          return;
        }

        const date = log.fechaCompletado ? new Date(log.fechaCompletado) : null;
        rows.push({
          funcionario: log.usuario || 'Sin funcionario',
          tipo: 'Completada',
          cliente: tramite.cliente,
          tramiteId: tramite.id,
          politica: policyName,
          etapa: log.nombreNodo || log.nodoId,
          estadoTramite: tramite.estado,
          fecha: date,
          fechaTexto: date ? this.formatDateTime(date) : '',
          duracionSegundos: Number(log.duracionSegundos || 0),
          duracion: this.formatDuration(log.duracionSegundos),
          datos: this.summarizeFields(log.datosFormulario || []),
          informe: log.informeIA || ''
        });
      });

      if (tramite.estado !== 'FINALIZADO') {
        const node = this.getCurrentNode(tramite);
        const assignees = this.getAssigneesForNode(node, policy);
        const pendingAssignees = assignees.length ? assignees : ['Sin funcionario'];
        const pendingSince = this.getPendingSinceDate(tramite);
        const pendingSeconds = pendingSince
          ? Math.max(0, Math.floor((Date.now() - pendingSince.getTime()) / 1000))
          : 0;
        pendingAssignees.forEach(username => {
          rows.push({
            funcionario: username,
            tipo: 'Pendiente actual',
            cliente: tramite.cliente,
            tramiteId: tramite.id,
            politica: policyName,
            etapa: node?.nombre || 'Sin etapa',
            estadoTramite: tramite.estado,
            fecha: pendingSince,
            fechaTexto: pendingSince ? this.formatDateTime(pendingSince) : '',
            duracionSegundos: pendingSeconds,
            duracion: pendingSeconds ? this.formatDuration(pendingSeconds) : '',
            datos: '',
            informe: ''
          });
        });
      }
    });

    return rows;
  }

  get reportRows(): ReportRow[] {
    return this.allRows.filter(row => this.matchesFilters(row));
  }

  get completedRows(): ReportRow[] {
    return this.reportRows.filter(row => row.tipo === 'Completada');
  }

  get pendingRows(): ReportRow[] {
    return this.reportRows.filter(row => row.tipo === 'Pendiente actual');
  }

  get completionPercent(): number {
    if (this.reportRows.length === 0) return 0;
    return Math.round((this.completedRows.length / this.reportRows.length) * 100);
  }

  get donutBackground(): string {
    const done = this.completionPercent;
    return `conic-gradient(#f97316 0 ${done}%, #34353c ${done}% 100%)`;
  }

  get averageDuration(): string {
    if (this.completedRows.length === 0) return '0 seg';
    const total = this.completedRows.reduce((sum, row) => sum + row.duracionSegundos, 0);
    return this.formatDuration(Math.round(total / this.completedRows.length));
  }

  get mainChartRows(): ChartRow[] {
    const key = this.auth.isAdmin() ? 'funcionario' : 'etapa';
    return this.buildChartRows(this.completedRows, key);
  }

  get policyChartRows(): ChartRow[] {
    return this.buildChartRows(this.reportRows, 'politica');
  }

  downloadReport(): void {
    const headers = [
      'Funcionario',
      'Tipo',
      'Cliente',
      'Tramite ID',
      'Politica',
      'Etapa',
      'Estado tramite',
      'Fecha',
      'Duracion',
      'Datos',
      'Informe'
    ];

    const csvRows = [
      headers,
      ...this.reportRows.map(row => [
        row.funcionario,
        row.tipo,
        row.cliente,
        row.tramiteId,
        row.politica,
        row.etapa,
        row.estadoTramite,
        row.fechaTexto,
        row.duracion,
        row.datos,
        row.informe
      ])
    ];

    const csv = csvRows.map(row => row.map(value => this.csvCell(value)).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.reportFileName('csv');
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadPdf(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const generatedAt = this.formatDateTime(new Date());
    const title = this.auth.isAdmin() ? 'Reporte por funcionario' : 'Mi reporte de actividades';

    doc.setFillColor(17, 17, 19);
    doc.rect(0, 0, 297, 28, 'F');
    doc.setTextColor(249, 250, 251);
    doc.setFontSize(16);
    doc.text(title, 14, 13);
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Generado: ${generatedAt}`, 14, 21);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    const filterText = [
      `Funcionario: ${this.auth.isFuncionario() ? this.auth.currentUser()?.username : (this.selectedFuncionario || 'Todos')}`,
      `Tipo: ${this.selectedType || 'Todo'}`,
      `Desde: ${this.reportFromDate || '-'}`,
      `Hasta: ${this.reportToDate || '-'}`,
      `Registros: ${this.reportRows.length}`
    ].join('   |   ');
    doc.text(filterText, 14, 38);

    autoTable(doc, {
      startY: 46,
      head: [['Indicador', 'Valor']],
      body: [
        ['Filas', String(this.reportRows.length)],
        ['Completadas', String(this.completedRows.length)],
        ['Pendientes', String(this.pendingRows.length)],
        ['Promedio por actividad', this.averageDuration],
        ['Cierre', `${this.completionPercent}%`]
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22], textColor: [17, 17, 19] },
      margin: { left: 14, right: 14 },
      tableWidth: 82
    });

    autoTable(doc, {
      startY: 46,
      head: [['Grafico', 'Detalle']],
      body: [
        ['Principal', this.mainChartRows.map(row => `${row.label}: ${row.value}`).join(' | ') || 'Sin datos'],
        ['Politicas', this.policyChartRows.map(row => `${row.label}: ${row.value}`).join(' | ') || 'Sin datos']
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 41, 55], textColor: [249, 250, 251] },
      margin: { left: 104, right: 14 },
      tableWidth: 179
    });

    autoTable(doc, {
      startY: 88,
      head: [['Funcionario', 'Tipo', 'Cliente', 'Politica', 'Etapa', 'Fecha', 'Duracion', 'Datos']],
      body: this.reportRows.map(row => [
        row.funcionario,
        row.tipo,
        row.cliente,
        row.politica,
        row.etapa,
        row.fechaTexto || '-',
        row.duracion || '-',
        row.datos || '-'
      ]),
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [249, 115, 22], textColor: [17, 17, 19] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 24 },
        2: { cellWidth: 28 },
        3: { cellWidth: 36 },
        4: { cellWidth: 34 },
        5: { cellWidth: 27 },
        6: { cellWidth: 20 },
        7: { cellWidth: 82 }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(this.reportFileName('pdf'));
  }

  toggleVoiceFilter(): void {
    if (this.isListening) {
      this.stopVoiceFilter();
      return;
    }

    this.startVoiceFilter();
  }

  startVoiceFilter(): void {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      this.voiceSupported = false;
      this.voiceStatus = 'Tu navegador no soporta filtros por voz. Usa Chrome o Edge.';
      return;
    }

    if (this.speechRecognition) {
      this.speechRecognition.abort();
      this.speechRecognition = null;
    }

    const recognition = new SpeechRecognitionCtor();
    let finalTranscript = '';
    recognition.lang = 'es-BO';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isListening = true;
      this.voiceStatus = 'Escuchando filtro...';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      this.voiceTranscript = (finalTranscript || interim).trim();
    };

    recognition.onerror = (event: any) => {
      this.isListening = false;
      this.voiceStatus = event.error === 'not-allowed'
        ? 'Permite el microfono para filtrar por voz.'
        : 'No pude entender el filtro. Intenta otra vez.';
    };

    recognition.onend = () => {
      this.isListening = false;
      this.speechRecognition = null;
      const command = finalTranscript.trim() || this.voiceTranscript.trim();
      if (command) {
        this.voiceTranscript = command;
        this.applyVoiceFilter(command);
      } else if (!this.voiceStatus.includes('Permite')) {
        this.voiceStatus = 'No detecte audio.';
      }
    };

    this.speechRecognition = recognition;
    recognition.start();
  }

  stopVoiceFilter(): void {
    if (!this.speechRecognition) return;
    this.speechRecognition.stop();
  }

  applyVoiceFilter(command: string): void {
    const text = this.normalizeText(command);
    let shouldDownloadPdf = false;

    if (!this.auth.isFuncionario()) {
      const funcionario = this.funcionarios.find(user => text.includes(this.normalizeText(user.username)));
      if (funcionario) {
        this.selectedFuncionario = funcionario.username;
      } else {
        const funcionarioByNumber = this.resolveFuncionarioFromVoice(text);
        if (funcionarioByNumber) {
          this.selectedFuncionario = funcionarioByNumber.username;
        }
      }

      if (/\b(todos|todo|general)\b/.test(text)) {
        this.selectedFuncionario = '';
      }
    }

    if (/\b(completadas|completada|cerradas|terminadas|finalizadas)\b/.test(text)) {
      this.selectedType = 'Completada';
    } else if (/\b(pendientes|pendiente|actuales|asignadas)\b/.test(text)) {
      this.selectedType = 'Pendiente actual';
    } else if (/\b(todo|todos|todas)\b/.test(text)) {
      this.selectedType = '';
    }

    const dates = this.extractVoiceDates(text);
    if (dates.from) this.reportFromDate = dates.from;
    if (dates.to) this.reportToDate = dates.to;
    if (/\b(sin fecha|limpiar fechas|quitar fechas)\b/.test(text)) {
      this.reportFromDate = '';
      this.reportToDate = '';
    }

    shouldDownloadPdf = /\b(pdf|descarga|descargar|bajar|exportar)\b/.test(text);
    this.voiceStatus = `Filtro aplicado. Registros: ${this.reportRows.length}.`;

    if (shouldDownloadPdf && this.reportRows.length > 0) {
      this.downloadPdf();
      this.voiceStatus = `Filtro aplicado y PDF descargado. Registros: ${this.reportRows.length}.`;
    }
  }

  private matchesFilters(row: ReportRow): boolean {
    const forcedUser = this.auth.isFuncionario() ? this.auth.currentUser()?.username || '' : this.selectedFuncionario;
    if (forcedUser && row.funcionario !== forcedUser) return false;
    if (this.selectedType && row.tipo !== this.selectedType) return false;

    if (!row.fecha) {
      return !this.reportFromDate && !this.reportToDate;
    }

    if (this.reportFromDate) {
      const from = new Date(this.reportFromDate + 'T00:00:00');
      if (row.fecha < from) return false;
    }

    if (this.reportToDate) {
      const to = new Date(this.reportToDate + 'T23:59:59');
      if (row.fecha > to) return false;
    }

    return true;
  }

  private extractVoiceDates(text: string): { from?: string; to?: string } {
    const result: { from?: string; to?: string } = {};
    const today = this.startOfDay(new Date());

    if (/\b(hoy|dia de hoy)\b/.test(text)) {
      result.to = this.dateToInput(today);
      if (/\b(solo hoy|de hoy)\b/.test(text) && !/\b(desde|hasta)\b/.test(text)) {
        result.from = this.dateToInput(today);
      }
    }

    if (/\bayer\b/.test(text)) {
      const yesterday = this.addDays(today, -1);
      if (/\b(hasta hoy)\b/.test(text)) {
        result.from = this.dateToInput(yesterday);
        result.to = this.dateToInput(today);
      } else {
        result.from = this.dateToInput(yesterday);
        result.to = this.dateToInput(yesterday);
      }
    }

    if (/\b(semana pasada|semana pasado|semana anterior|la semana pasado)\b/.test(text)) {
      const previousWeekStart = this.startOfWeek(this.addDays(today, -7));
      const previousWeekEnd = this.addDays(previousWeekStart, 6);
      result.from = this.dateToInput(previousWeekStart);
      result.to = /\b(hasta hoy|al dia de hoy|a hoy)\b/.test(text)
        ? this.dateToInput(today)
        : this.dateToInput(previousWeekEnd);
    } else if (/\b(esta semana|semana actual)\b/.test(text)) {
      result.from = this.dateToInput(this.startOfWeek(today));
      result.to = this.dateToInput(today);
    }

    if (/\b(mes pasado|mes anterior)\b/.test(text)) {
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      result.from = this.dateToInput(previousMonth);
      result.to = /\b(hasta hoy|a hoy)\b/.test(text)
        ? this.dateToInput(today)
        : this.dateToInput(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (/\b(este mes|mes actual)\b/.test(text)) {
      result.from = this.dateToInput(new Date(today.getFullYear(), today.getMonth(), 1));
      result.to = this.dateToInput(today);
    }

    const isoDates = Array.from(text.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g))
      .map(match => this.toInputDate(Number(match[1]), Number(match[2]), Number(match[3])));

    if (isoDates.length === 1) {
      if (/\b(hasta|a|al)\b/.test(text)) {
        result.to = isoDates[0];
      } else {
        result.from = isoDates[0];
      }
    } else if (isoDates.length >= 2) {
      result.from = isoDates[0];
      result.to = isoDates[1];
    }

    const dayMonthDates = Array.from(text.matchAll(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(20\d{2}))?\b/g))
      .map(match => {
        const year = match[3] ? Number(match[3]) : new Date().getFullYear();
        const month = this.monthNumber(match[2]);
        return month ? this.toInputDate(year, month, Number(match[1])) : '';
      })
      .filter(Boolean);

    if (!result.from && !result.to) {
      if (dayMonthDates.length === 1) {
        if (/\b(hasta|a|al)\b/.test(text)) {
          result.to = dayMonthDates[0];
        } else {
          result.from = dayMonthDates[0];
        }
      } else if (dayMonthDates.length >= 2) {
        result.from = dayMonthDates[0];
        result.to = dayMonthDates[1];
      }
    }

    return result;
  }

  private resolveFuncionarioFromVoice(text: string): Usuario | null {
    const match = /\bfuncionario\s+(\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/.exec(text);
    if (!match) return null;

    const number = this.voiceNumber(match[1]);
    if (!number) return null;

    const normalizedTarget = number === 1 ? 'funcionario' : `funcionario ${number}`;
    return this.funcionarios.find(user => this.normalizeText(user.username) === normalizedTarget)
      || this.funcionarios[number - 1]
      || null;
  }

  private voiceNumber(value: string): number {
    const words: Record<string, number> = {
      uno: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10
    };
    return Number(value) || words[value] || 0;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private startOfWeek(date: Date): Date {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return this.addDays(this.startOfDay(date), mondayOffset);
  }

  private dateToInput(date: Date): string {
    return this.toInputDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  private monthNumber(month: string): number {
    const months: Record<string, number> = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      setiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12
    };
    return months[this.normalizeText(month)] || 0;
  }

  private toInputDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private buildChartRows(rows: ReportRow[], key: keyof ReportRow): ChartRow[] {
    const counts = new Map<string, number>();
    rows.forEach(row => {
      const label = String(row[key] || 'Sin dato');
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    const max = Math.max(1, ...Array.from(counts.values()));
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, percent: Math.max(4, Math.round((value / max) * 100)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }

  private getPolicy(tramite: any): any {
    return this.policies.find(policy => policy.id === tramite.politicaId);
  }

  private getCurrentNode(tramite: any): any {
    const policy = this.getPolicy(tramite);
    return policy?.nodos?.find((node: any) => node.id === tramite.nodoActualId);
  }

  private getNodeById(policy: any, nodeId: string): any {
    return policy?.nodos?.find((node: any) => node.id === nodeId);
  }

  private isReportableCompletedLog(log: any, node: any): boolean {
    const type = String(node?.tipo || '').toUpperCase();
    if (['INICIO', 'START', 'DECISION', 'FIN', 'END'].includes(type)) {
      return false;
    }

    if (type === 'ACTIVIDAD' || type === 'ACTIVITY') {
      return true;
    }

    return Boolean((log.datosFormulario || []).length || Number(log.duracionSegundos || 0) > 0);
  }

  private getPendingSinceDate(tramite: any): Date | null {
    const historial = tramite.historial || [];
    const lastLog = historial.length ? historial[historial.length - 1] : null;
    const value = lastLog?.fechaCompletado || tramite.fechaInicio;
    return value ? new Date(value) : null;
  }

  private getAssigneesForNode(node: any, policy?: any): string[] {
    if (!node) return [];
    if (node.funcionariosAsignados?.length) return node.funcionariosAsignados;

    const dept = policy?.departamentos?.find((item: any) => item.id === node.departamentoId);
    return dept?.funcionariosAsignados || [];
  }

  private summarizeFields(fields: any[]): string {
    return fields
      .map(field => {
        const value = field.archivoNombre || field.valor || '';
        return `${field.etiqueta || field.nombre}: ${value}`;
      })
      .filter(Boolean)
      .join(' | ');
  }

  private formatDuration(seconds?: number): string {
    if (seconds == null) return '';
    if (seconds < 60) return `${seconds} seg`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${minutes % 60} min`;
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('es-BO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private csvCell(value: any): string {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    return `"${text.replace(/"/g, '""')}"`;
  }

  private reportFileName(extension: 'csv' | 'pdf' = 'csv'): string {
    const user = this.auth.isFuncionario()
      ? this.auth.currentUser()?.username || 'mi-reporte'
      : this.selectedFuncionario || 'todos';
    const date = new Date().toISOString().slice(0, 10);
    return `reporte-funcionario-${user}-${date}.${extension}`;
  }
}
