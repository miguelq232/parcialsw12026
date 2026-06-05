import { AfterViewChecked, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from '../../services/auth.service';
import { Departamento as DepartamentoApi, Usuario, WorkflowService } from '../../services/workflow.service';

type NodeType = 'INICIO' | 'ACTIVIDAD' | 'DECISION' | 'FORK' | 'JOIN' | 'FIN' | 'START' | 'ACTIVITY' | 'END';
type FieldType = 'TEXTO' | 'NUMERO' | 'SELECCION' | 'FOTO' | 'ARCHIVO';

interface Departamento {
  id: string;
  nombre: string;
  funcionariosAsignados?: string[];
}

interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo: FieldType;
  opciones?: string[];
  tempOpcion?: string;
}

interface WorkflowNode {
  id: string;
  tipo: NodeType;
  nombre: string;
  departamentoId: string;
  funcionariosAsignados: string[];
  campos: CampoFormulario[];
  x: number;
  y: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface Conexion {
  id: string;
  origenId: string;
  destinoId: string;
  condicion?: string;
}

interface SvgPath {
  id: string;
  d: string;
  condicion: string;
  x: number;
  y: number;
}

interface ConnectedUser {
  username: string;
  color: string;
  editingNodeId?: string | null;
  editingProp?: string | null;
  sessionId?: string;
}

interface DragState {
  node: WorkflowNode;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

function getSpeechRecognitionCtor(): any {
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="designer-shell">
      <header class="designer-header">
        <div class="workflow-meta">
          <div class="status-pill">
            <span class="status-dot"></span>
            Editable
          </div>
          <input
            [(ngModel)]="policyName"
            class="workflow-title"
            placeholder="Nombre de la politica"
            (ngModelChange)="scheduleRedraw(); broadcastState()"
          />
          <span class="workflow-subtitle">{{ nodes.length }} nodos / {{ conexiones.length }} conexiones</span>
        </div>

        <div class="header-actions">
          <div *ngIf="connectedUsers.length > 0" class="avatars" aria-label="Usuarios conectados">
            <div
              *ngFor="let user of connectedUsers; trackBy: userTrackBy"
              class="avatar"
              [style.background]="user.color"
              [title]="user.username"
            >
              {{ user.username.charAt(0) | uppercase }}
            </div>
          </div>

          <button *ngIf="policyId" class="icon-button wide" type="button" (click)="copyShareLink()">
            Compartir
          </button>
          <span *ngIf="!policyId" class="save-hint">Guarda para activar colaboracion</span>
          <button class="primary-action" type="button" (click)="savePolicy()">Guardar flujo</button>
        </div>
      </header>

      <section class="designer-workbench">
        <aside class="node-library" aria-label="Componentes del flujo">
          <div class="panel-title">
            <span>Componentes</span>
            <small>Arrastra al canvas</small>
          </div>

          <div class="library-section sample-selector">
            <div class="section-heading">Muestras</div>
            <select class="compact-input" [(ngModel)]="selectedPolicyId">
              <option value="">Nuevo flujo con calles del sistema</option>
              <option *ngFor="let policy of policies; trackBy: policyTrackBy" [value]="policy.id">
                {{ policy.nombre }} - {{ policy.departamentos?.length || 0 }} calles
              </option>
            </select>
            <button class="connection-toggle" type="button" (click)="openSelectedPolicy()">
              {{ selectedPolicyId ? 'Abrir muestra' : 'Nuevo diseño' }}
            </button>
          </div>

          <div class="palette-list">
            <button
              *ngFor="let item of palette; trackBy: paletteTrackBy"
              class="palette-item"
              [class]="item.className"
              type="button"
              draggable="true"
              (dragstart)="onPaletteDragStart($event, item.type)"
              (click)="addNode(item.type)"
            >
              <span class="palette-icon">{{ item.icon }}</span>
              <span class="palette-copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
            </button>
          </div>

          <div class="library-section">
            <div class="section-heading">Conexiones</div>
            <button class="connection-toggle" type="button" [class.active]="isConnecting" (click)="toggleConnectionMode()">
              {{ isConnecting ? 'Selecciona destino' : 'Conectar nodos' }}
            </button>
            <p class="helper-text" *ngIf="isConnecting && !connectionOrigin">Haz click en el nodo de origen.</p>
            <p class="helper-text active" *ngIf="isConnecting && connectionOrigin">Origen: {{ connectionOrigin.nombre }}</p>
          </div>

          <div class="library-section">
            <div class="section-heading">Calles</div>
            <div class="add-row">
              <input
                [(ngModel)]="newDeptName"
                class="compact-input"
                placeholder="Nueva calle"
                (keyup.enter)="addDepartamento()"
              />
              <button class="square-button" type="button" (click)="addDepartamento()">+</button>
            </div>
            <div class="dept-list">
              <div *ngFor="let dept of departamentos; trackBy: deptTrackBy" class="dept-chip">
                <span>{{ dept.nombre }}</span>
                <small>{{ (dept.funcionariosAsignados || []).length }}</small>
                <button type="button" (click)="removeDepartamento(dept.id)" aria-label="Eliminar calle">x</button>
              </div>
            </div>
          </div>

          <div class="library-section">
            <div class="section-heading">Responsables por calle</div>
            <div *ngIf="availableFuncionarios.length === 0" class="empty-panel">No hay funcionarios registrados.</div>
            <div *ngFor="let dept of departamentos; trackBy: deptTrackBy" class="assignment-card">
              <strong>{{ dept.nombre }}</strong>
              <label *ngFor="let funcionario of availableFuncionarios; trackBy: funcionarioTrackBy" class="assignee-option">
                <input
                  type="checkbox"
                  [checked]="isFuncionarioAssignedToDept(dept, funcionario.username)"
                  (change)="toggleDeptFuncionario(dept, funcionario.username)"
                />
                <span>{{ funcionario.username }}</span>
              </label>
            </div>
          </div>
        </aside>

        <main class="canvas-shell">
          <div class="canvas-toolbar">
            <div class="toolbar-group">
              <button class="icon-button" type="button" title="Alejar" (click)="zoomOut()">-</button>
              <span class="zoom-readout">{{ (zoom * 100) | number:'1.0-0' }}%</span>
              <button class="icon-button" type="button" title="Acercar" (click)="zoomIn()">+</button>
              <button class="icon-button wide" type="button" title="Restablecer zoom" (click)="resetZoom()">Reset</button>
            </div>
            <div class="toolbar-group">
              <button class="icon-button wide" type="button" (click)="autoLayout()">Ordenar</button>
              <button class="icon-button wide" type="button" [class.active]="isConnecting" (click)="toggleConnectionMode()">Unir</button>
            </div>
          </div>

          <div
            id="canvas-viewport"
            class="canvas-viewport"
            (dragover)="onCanvasDragOver($event)"
            (drop)="onCanvasDrop($event)"
            (click)="clearSelection($event)"
          >
            <div
              id="workflow-canvas"
              class="canvas-stage"
              [style.width.px]="canvasWidth"
              [style.height.px]="canvasHeight"
              [style.transform]="'scale(' + zoom + ')'"
            >
              <div
                *ngFor="let dept of departamentos; let i = index; trackBy: deptTrackBy"
                class="lane-guide"
                [style.left.px]="laneLeft(i)"
                [style.width.px]="laneWidth"
              >
                <div class="lane-label">{{ dept.nombre }}</div>
              </div>

              <svg
                class="connections-layer"
                [attr.width]="canvasWidth"
                [attr.height]="canvasHeight"
                [attr.viewBox]="'0 0 ' + canvasWidth + ' ' + canvasHeight"
              >
                <defs>
                  <marker id="arrowhead" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto">
                    <path d="M 0 0 L 14 7 L 0 14 z" fill="#f97316"></path>
                  </marker>
                </defs>
                <path
                  *ngFor="let path of svgPaths; trackBy: pathTrackBy"
                  class="connection-path"
                  [attr.d]="path.d"
                  marker-end="url(#arrowhead)"
                ></path>
                <g *ngFor="let path of svgPaths; trackBy: pathTrackBy">
                  <rect
                    *ngIf="path.condicion"
                    class="connection-label-bg"
                    [attr.x]="path.x - 48"
                    [attr.y]="path.y - 18"
                    width="96"
                    height="24"
                    rx="6"
                  ></rect>
                  <text
                    *ngIf="path.condicion"
                    class="connection-label"
                    [attr.x]="path.x"
                    [attr.y]="path.y - 2"
                    text-anchor="middle"
                  >
                    {{ path.condicion }}
                  </text>
                </g>
              </svg>

              <div *ngIf="nodes.length === 0" class="empty-canvas">
                <div class="empty-orbit">+</div>
                <h2>Arrastra un componente para empezar</h2>
                <p>Construye el flujo como un mapa visual: nodos, ramas, condiciones y responsables.</p>
              </div>

              <article
                *ngFor="let node of nodes; trackBy: nodeTrackBy"
                class="workflow-node"
                [class.selected]="selectedNodeId === node.id"
                [class.connecting]="isConnecting"
                [class.has-editors]="getUsersEditingNode(node.id).length > 0"
                [ngClass]="nodeClass(node)"
                [style.left.px]="node.x"
                [style.top.px]="node.y"
                [attr.id]="'node-' + node.id"
                (pointerdown)="startNodeDrag($event, node)"
                (click)="handleNodeClick(node, $event)"
              >
                <button class="port input-port" type="button" title="Destino" (click)="finishConnection(node, $event)"></button>
                <button class="port output-port" type="button" title="Origen" (click)="startConnectionFrom(node, $event)"></button>

                <div class="coedit-badges" *ngIf="getUsersEditingNode(node.id).length > 0">
                  <span
                    *ngFor="let user of getUsersEditingNode(node.id); trackBy: userTrackBy"
                    [style.background]="user.color"
                  >
                    {{ user.username }}
                  </span>
                </div>

                <div class="node-topline">
                  <span class="node-icon">{{ getNodeSymbol(node.tipo) }}</span>
                  <span class="node-type">{{ getNodeTypeLabel(node.tipo) }}</span>
                  <button class="node-delete" type="button" title="Eliminar" (click)="removeNode(node); $event.stopPropagation()">x</button>
                </div>

                <h3>{{ node.nombre || 'Nodo sin nombre' }}</h3>
                <p>{{ getDepartamentoName(node.departamentoId) }}</p>
                <p class="node-assignees">{{ getNodeAssignmentLabel(node) }}</p>

                <div class="node-foot">
                  <span>{{ getOutgoingConnections(node.id).length }} salidas</span>
                  <span *ngIf="isActivity(node)">{{ node.campos.length }} campos</span>
                </div>
              </article>
            </div>
          </div>
        </main>

        <aside class="inspector">
          <ng-container *ngIf="selectedNode as node; else noNodeSelected">
            <div class="inspector-header">
              <span class="inspector-kicker">Inspector</span>
              <strong>{{ getNodeTypeLabel(node.tipo) }}</strong>
            </div>

            <label class="form-field">
              <span>Nombre</span>
              <input
                [(ngModel)]="node.nombre"
                (ngModelChange)="scheduleRedraw(); broadcastState()"
                (focus)="publishPresence(node.id, 'nombre')"
                (blur)="publishPresence()"
                [style.outline]="isPropEditedByOther(node.id, 'nombre') ? '2px solid ' + getPropEditorColor(node.id, 'nombre') : ''"
              />
            </label>

            <label class="form-field">
              <span>Calle responsable</span>
              <select [(ngModel)]="node.departamentoId" (ngModelChange)="snapNodeToLane(node); scheduleRedraw(); broadcastState()">
                <option *ngFor="let dept of departamentos; trackBy: deptTrackBy" [value]="dept.id">{{ dept.nombre }}</option>
              </select>
            </label>

            <div class="inspector-block" *ngIf="isActivity(node)">
              <div class="block-title">
                <span>Funcionarios asignados</span>
                <small>{{ getNodeEffectiveAssignees(node).length }}</small>
              </div>
              <p class="helper-text">Si no marcas funcionarios aqui, la actividad hereda los responsables de su calle.</p>
              <div *ngIf="availableFuncionarios.length === 0" class="empty-panel">No hay funcionarios para asignar.</div>
              <div class="assignee-list">
                <label *ngFor="let funcionario of availableFuncionarios; trackBy: funcionarioTrackBy" class="assignee-option">
                  <input
                    type="checkbox"
                    [checked]="isFuncionarioAssignedToNode(node, funcionario.username)"
                    (change)="toggleNodeFuncionario(node, funcionario.username)"
                  />
                  <span>{{ funcionario.username }}</span>
                </label>
              </div>
            </div>

            <div class="inspector-block" *ngIf="isActivity(node)">
              <div class="block-title">
                <span>Campos del formulario</span>
                <button type="button" (click)="addField(node)">+ Campo</button>
              </div>

              <div *ngIf="node.campos.length === 0" class="empty-panel">Sin campos configurados.</div>

              <div *ngFor="let field of node.campos; let i = index; trackBy: fieldTrackBy" class="field-card">
                <div class="field-row">
                  <input
                    [(ngModel)]="field.etiqueta"
                    placeholder="Etiqueta"
                    (ngModelChange)="broadcastState()"
                    (focus)="publishPresence(node.id, 'field_' + i)"
                    (blur)="publishPresence()"
                    [style.outline]="isPropEditedByOther(node.id, 'field_' + i) ? '2px solid ' + getPropEditorColor(node.id, 'field_' + i) : ''"
                  />
                  <button type="button" title="Eliminar campo" (click)="removeField(node, field)">x</button>
                </div>
                <select [(ngModel)]="field.tipo" (ngModelChange)="scheduleRedraw(); broadcastState()">
                  <option value="TEXTO">Texto</option>
                  <option value="NUMERO">Numero</option>
                  <option value="SELECCION">Opciones</option>
                  <option value="FOTO">Foto / imagen</option>
                  <option value="ARCHIVO">Documento</option>
                </select>

                <div *ngIf="field.tipo === 'SELECCION'" class="options-editor">
                  <div class="add-row">
                    <input
                      [(ngModel)]="field.tempOpcion"
                      placeholder="Nueva opcion"
                      (keyup.enter)="addOpcion(field)"
                      (blur)="addOpcion(field)"
                    />
                    <button type="button" (click)="addOpcion(field)">+</button>
                  </div>
                  <div class="option-tags">
                    <span *ngFor="let option of field.opciones || []; let optIndex = index">
                      {{ option }}
                      <button type="button" (click)="removeOpcion(field, optIndex)">x</button>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="inspector-block">
              <div class="block-title">
                <span>Salidas</span>
                <small>{{ getOutgoingConnections(node.id).length }}</small>
              </div>

              <div *ngIf="getOutgoingConnections(node.id).length === 0" class="empty-panel">
                Usa los puertos del nodo o el boton Unir para conectar.
              </div>

              <div *ngFor="let conn of getOutgoingConnections(node.id); let connIndex = index; trackBy: connTrackBy" class="connection-row">
                <span>{{ getNodeName(conn.destinoId) }}</span>
                <input
                  [(ngModel)]="conn.condicion"
                  placeholder="Condicion"
                  (ngModelChange)="scheduleRedraw(); broadcastState()"
                  (focus)="publishPresence(node.id, 'conn_' + connIndex)"
                  (blur)="publishPresence()"
                  [style.outline]="isPropEditedByOther(node.id, 'conn_' + connIndex) ? '2px solid ' + getPropEditorColor(node.id, 'conn_' + connIndex) : ''"
                />
                <button type="button" title="Eliminar conexion" (click)="removeConnection(conn)">x</button>
              </div>
            </div>
          </ng-container>

          <ng-template #noNodeSelected>
            <div class="no-selection">
              <span class="empty-orbit">i</span>
              <strong>Selecciona un nodo</strong>
              <p>Edita nombre, responsable, campos y condiciones desde este panel.</p>
            </div>
          </ng-template>

          <div class="ai-panel" [class.open]="!isChatMinimized">
            <button class="ai-toggle" type="button" (click)="isChatMinimized = !isChatMinimized">
              Asistente IA
              <span>{{ isChatMinimized ? '+' : '-' }}</span>
            </button>

            <div class="ai-content" *ngIf="!isChatMinimized">
              <div class="chat-scroll">
                <div *ngFor="let msg of chatMessages; trackBy: messageTrackBy" class="chat-msg" [class.user]="msg.role === 'user'">
                  {{ msg.content }}
                </div>
              </div>
              <div class="ai-input">
                <input [(ngModel)]="aiPrompt" placeholder="Ej: agrega una revision legal" (keyup.enter)="sendAiCommand()" />
                <button
                  class="voice-button"
                  type="button"
                  [class.listening]="isListening"
                  [disabled]="!voiceSupported"
                  [title]="voiceSupported ? (isListening ? 'Detener voz' : 'Dictar comando') : 'Tu navegador no soporta comandos de voz'"
                  (click)="toggleVoiceCommand()"
                >
                  {{ isListening ? 'Stop' : 'Mic' }}
                </button>
                <button type="button" (click)="sendAiCommand()">Enviar</button>
              </div>
              <small class="voice-status" *ngIf="voiceStatus">{{ voiceStatus }}</small>
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
      min-height: 0;
      color: #eef2f7;
      background: #0e0f12;
    }

    .designer-shell {
      display: grid;
      grid-template-rows: 64px minmax(0, 1fr);
      height: 100%;
      min-height: 0;
      background: #0e0f12;
    }

    .designer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 12px 18px;
      background: #15161a;
      border-bottom: 1px solid #282b31;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    .workflow-meta {
      display: grid;
      grid-template-columns: auto minmax(260px, 480px) auto;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid #2d3748;
      border-radius: 7px;
      color: #a7f3d0;
      background: #111827;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.12);
    }

    .workflow-title {
      width: 100%;
      min-width: 0;
      height: 36px;
      border: 1px solid transparent;
      border-radius: 7px;
      padding: 0 10px;
      background: transparent;
      color: #f8fafc;
      font-size: 1rem;
      font-weight: 750;
      outline: none;
    }

    .workflow-title:focus {
      background: #1a1c21;
      border-color: #3a3f49;
    }

    .workflow-subtitle,
    .save-hint {
      color: #8b95a7;
      font-size: 0.78rem;
      white-space: nowrap;
    }

    .header-actions,
    .toolbar-group,
    .avatars {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 2px solid #15161a;
      border-radius: 50%;
      color: white;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .primary-action,
    .icon-button,
    .connection-toggle,
    .square-button,
    .block-title button,
    .ai-input button {
      border: 1px solid #343943;
      border-radius: 7px;
      color: #e5e7eb;
      background: #1b1d23;
      min-height: 34px;
      padding: 0 11px;
      font-weight: 700;
    }

    .primary-action {
      color: #111113;
      background: #f97316;
      border-color: #fb923c;
      box-shadow: 0 12px 24px rgba(249, 115, 22, 0.18);
    }

    .primary-action:hover,
    .connection-toggle.active,
    .icon-button.active {
      background: #fb923c;
      border-color: #fdba74;
      color: #111113;
    }

    .icon-button {
      min-width: 34px;
      padding: 0;
    }

    .icon-button.wide {
      min-width: 66px;
      padding: 0 10px;
    }

    .designer-workbench {
      display: grid;
      grid-template-columns: 250px minmax(0, 1fr) 330px;
      gap: 0;
      min-height: 0;
      overflow: hidden;
    }

    .node-library,
    .inspector {
      min-height: 0;
      overflow: auto;
      background: #121317;
      border-right: 1px solid #282b31;
    }

    .inspector {
      border-right: 0;
      border-left: 1px solid #282b31;
      padding: 14px;
    }

    .node-library {
      padding: 14px;
    }

    .panel-title {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 14px;
    }

    .panel-title span,
    .section-heading,
    .inspector-kicker {
      color: #f8fafc;
      font-size: 0.72rem;
      font-weight: 850;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .panel-title small,
    .helper-text,
    .empty-panel,
    .no-selection p,
    .block-title small {
      color: #8b95a7;
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .palette-list,
    .library-section,
    .dept-list,
    .inspector-block,
    .ai-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .palette-item {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 62px;
      border: 1px solid #2b3038;
      border-radius: 8px;
      padding: 8px;
      background: #181a20;
      color: #e5e7eb;
      text-align: left;
      cursor: grab;
    }

    .palette-item:hover {
      border-color: #f97316;
      background: #202126;
      transform: translateY(-1px);
    }

    .palette-icon,
    .node-icon,
    .empty-orbit {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #252934;
      color: #f8fafc;
      font-size: 0.9rem;
      font-weight: 900;
    }

    .palette-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .palette-copy strong {
      color: #f8fafc;
      font-size: 0.86rem;
      line-height: 1.1;
    }

    .palette-copy small {
      color: #8b95a7;
      font-size: 0.73rem;
      line-height: 1.2;
    }

    .library-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #282b31;
    }

    .helper-text.active {
      color: #fdba74;
    }

    .add-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 34px;
      gap: 6px;
    }

    .compact-input,
    .form-field input,
    .form-field select,
    .field-card input,
    .field-card select,
    .connection-row input,
    .ai-input input {
      width: 100%;
      min-width: 0;
      min-height: 34px;
      border: 1px solid #323741;
      border-radius: 7px;
      padding: 0 10px;
      background: #191b21;
      color: #eef2f7;
      outline: none;
    }

    .compact-input:focus,
    .form-field input:focus,
    .form-field select:focus,
    .field-card input:focus,
    .field-card select:focus,
    .connection-row input:focus,
    .ai-input input:focus {
      border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
    }

    .square-button {
      min-width: 34px;
      padding: 0;
    }

    .dept-chip {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto 24px;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      padding: 0 6px 0 10px;
      border: 1px solid #2b3038;
      border-radius: 7px;
      background: #181a20;
      color: #dbe4f0;
      font-size: 0.78rem;
    }

    .dept-chip span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dept-chip small {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      border: 1px solid rgba(249, 115, 22, 0.28);
      border-radius: 999px;
      color: #fed7aa;
      background: rgba(249, 115, 22, 0.1);
      font-size: 0.68rem;
      font-weight: 850;
    }

    .dept-chip button,
    .node-delete,
    .field-row button,
    .connection-row button,
    .option-tags button {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 0;
      border-radius: 6px;
      color: #9ca3af;
      background: transparent;
      font-weight: 900;
    }

    .dept-chip button:hover,
    .node-delete:hover,
    .field-row button:hover,
    .connection-row button:hover,
    .option-tags button:hover {
      color: #fecaca;
      background: rgba(248, 113, 113, 0.12);
    }

    .canvas-shell {
      position: relative;
      display: grid;
      grid-template-rows: 50px minmax(0, 1fr);
      min-width: 0;
      min-height: 0;
      background: #0e0f12;
    }

    .canvas-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      background: #111216;
      border-bottom: 1px solid #282b31;
    }

    .zoom-readout {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 54px;
      height: 34px;
      color: #cbd5e1;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .canvas-viewport {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      background:
        linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px),
        radial-gradient(circle at 48px 48px, rgba(249, 115, 22, 0.18) 1px, transparent 1px),
        #0e0f12;
      background-size: 96px 96px, 96px 96px, 24px 24px;
    }

    .canvas-stage {
      position: relative;
      transform-origin: 0 0;
      isolation: isolate;
    }

    .lane-guide {
      position: absolute;
      top: 24px;
      bottom: 24px;
      z-index: 0;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.015);
      pointer-events: none;
    }

    .lane-label {
      position: sticky;
      top: 16px;
      margin: 10px;
      display: inline-flex;
      max-width: calc(100% - 20px);
      min-height: 26px;
      align-items: center;
      padding: 0 9px;
      border: 1px solid #303640;
      border-radius: 7px;
      background: rgba(18, 19, 23, 0.94);
      color: #cbd5e1;
      font-size: 0.72rem;
      font-weight: 800;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .connections-layer {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      overflow: visible;
    }

    .connection-path {
      fill: none;
      stroke: #f97316;
      stroke-width: 2.4;
      stroke-linecap: round;
      filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.18));
    }

    .connection-label-bg {
      fill: #111216;
      stroke: #323741;
      stroke-width: 1;
    }

    .connection-label {
      fill: #fed7aa;
      font-size: 11px;
      font-weight: 850;
    }

    .empty-canvas {
      position: absolute;
      left: 50%;
      top: 42%;
      z-index: 2;
      display: grid;
      justify-items: center;
      gap: 10px;
      width: min(420px, 80vw);
      transform: translate(-50%, -50%);
      color: #e5e7eb;
      text-align: center;
      pointer-events: none;
    }

    .empty-canvas h2 {
      color: #f8fafc;
      font-size: 1.1rem;
    }

    .empty-canvas p {
      color: #8b95a7;
      font-size: 0.86rem;
      line-height: 1.5;
    }

    .workflow-node {
      position: absolute;
      z-index: 3;
      width: 250px;
      min-height: 112px;
      padding: 12px;
      border: 1px solid #343943;
      border-radius: 8px;
      background: #181a20;
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.32);
      color: #e5e7eb;
      user-select: none;
      touch-action: none;
      cursor: grab;
    }

    .workflow-node:hover {
      border-color: #4b5563;
      box-shadow: 0 24px 58px rgba(0, 0, 0, 0.42);
    }

    .workflow-node.selected {
      border-color: #f97316;
      box-shadow:
        0 0 0 2px rgba(249, 115, 22, 0.28),
        0 24px 58px rgba(0, 0, 0, 0.42);
    }

    .workflow-node.connecting {
      cursor: crosshair;
    }

    .workflow-node.has-editors {
      border-color: #60a5fa;
    }

    .workflow-node.type-inicio .node-icon,
    .palette-item.start .palette-icon {
      background: #123326;
      color: #a7f3d0;
    }

    .workflow-node.type-actividad .node-icon,
    .palette-item.activity .palette-icon {
      background: #2c2115;
      color: #fed7aa;
    }

    .workflow-node.type-decision .node-icon,
    .palette-item.decision .palette-icon {
      background: #1b2a40;
      color: #bfdbfe;
    }

    .workflow-node.type-fork .node-icon,
    .workflow-node.type-join .node-icon,
    .palette-item.fork .palette-icon,
    .palette-item.join .palette-icon {
      background: #2a2138;
      color: #ddd6fe;
    }

    .workflow-node.type-fin .node-icon,
    .palette-item.end .palette-icon {
      background: #351c1f;
      color: #fecaca;
    }

    .node-topline {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 24px;
      align-items: center;
      gap: 9px;
    }

    .node-type {
      color: #9ca3af;
      font-size: 0.68rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .workflow-node h3 {
      margin: 12px 0 5px;
      color: #f8fafc;
      font-size: 0.98rem;
      line-height: 1.2;
      word-break: break-word;
    }

    .workflow-node p {
      color: #8b95a7;
      font-size: 0.78rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workflow-node .node-assignees {
      margin-top: 4px;
      color: #fed7aa;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .node-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #2b3038;
    }

    .node-foot span {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 7px;
      border-radius: 6px;
      color: #cbd5e1;
      background: #20232b;
      font-size: 0.68rem;
      font-weight: 800;
    }

    .port {
      position: absolute;
      top: 52px;
      z-index: 4;
      width: 14px;
      height: 14px;
      border: 2px solid #0e0f12;
      border-radius: 50%;
      background: #64748b;
      box-shadow: 0 0 0 1px #343943;
      cursor: crosshair;
    }

    .port:hover {
      background: #f97316;
      box-shadow: 0 0 0 5px rgba(249, 115, 22, 0.16);
    }

    .input-port {
      left: -7px;
    }

    .output-port {
      right: -7px;
    }

    .coedit-badges {
      position: absolute;
      top: -12px;
      right: 10px;
      display: flex;
      gap: 4px;
      max-width: 220px;
      overflow: hidden;
    }

    .coedit-badges span {
      min-height: 22px;
      padding: 0 7px;
      border-radius: 6px;
      color: white;
      font-size: 0.68rem;
      font-weight: 800;
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
    }

    .inspector-header {
      display: grid;
      gap: 4px;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid #282b31;
    }

    .inspector-header strong {
      color: #f8fafc;
      font-size: 1rem;
    }

    .form-field {
      display: grid;
      gap: 7px;
      margin-bottom: 12px;
    }

    .form-field span {
      color: #9ca3af;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .form-field select,
    .field-card select {
      color: #e5e7eb;
    }

    .form-field option,
    .field-card option {
      background: #181a20;
      color: #e5e7eb;
    }

    .inspector-block {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #282b31;
    }

    .block-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      color: #f8fafc;
      font-size: 0.82rem;
      font-weight: 850;
    }

    .block-title button {
      min-height: 28px;
      padding: 0 8px;
      font-size: 0.72rem;
    }

    .field-card {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid #2b3038;
      border-radius: 8px;
      background: #181a20;
    }

    .field-row,
    .connection-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 24px;
      align-items: center;
      gap: 6px;
    }

    .connection-row {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr) 24px;
      min-height: 38px;
      padding: 6px;
      border: 1px solid #2b3038;
      border-radius: 8px;
      background: #181a20;
    }

    .connection-row span {
      min-width: 0;
      overflow: hidden;
      color: #cbd5e1;
      font-size: 0.76rem;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .options-editor {
      display: grid;
      gap: 8px;
    }

    .assignment-card,
    .assignee-list {
      display: grid;
      gap: 6px;
    }

    .assignment-card {
      padding: 10px;
      border: 1px solid #2b3038;
      border-radius: 8px;
      background: #181a20;
    }

    .assignment-card strong {
      color: #f8fafc;
      font-size: 0.78rem;
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .assignee-option {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      min-height: 28px;
      color: #dbe4f0;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .assignee-option input {
      width: 16px;
      height: 16px;
      accent-color: #f97316;
    }

    .assignee-option span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .option-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .option-tags span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 24px;
      padding: 0 4px 0 8px;
      border: 1px solid rgba(249, 115, 22, 0.26);
      border-radius: 999px;
      color: #fed7aa;
      background: rgba(249, 115, 22, 0.12);
      font-size: 0.72rem;
      font-weight: 800;
    }

    .option-tags button {
      width: 18px;
      height: 18px;
    }

    .empty-panel {
      padding: 10px;
      border: 1px dashed #343943;
      border-radius: 8px;
      background: #16181d;
    }

    .no-selection {
      display: grid;
      justify-items: start;
      gap: 9px;
      padding: 16px;
      border: 1px dashed #343943;
      border-radius: 8px;
      background: #16181d;
    }

    .no-selection strong {
      color: #f8fafc;
    }

    .ai-panel {
      margin-top: 16px;
      border: 1px solid #282b31;
      border-radius: 8px;
      background: #15161a;
      overflow: hidden;
    }

    .ai-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 42px;
      border: 0;
      border-radius: 0;
      padding: 0 12px;
      color: #f8fafc;
      background: #1a1c21;
      font-weight: 850;
    }

    .ai-toggle span {
      color: #f97316;
      font-size: 1rem;
      font-weight: 900;
    }

    .ai-content {
      padding: 10px;
    }

    .chat-scroll {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 190px;
      overflow: auto;
      padding-right: 2px;
    }

    .chat-msg {
      align-self: flex-start;
      max-width: 92%;
      padding: 8px 10px;
      border: 1px solid #2b3038;
      border-radius: 8px;
      color: #cbd5e1;
      background: #111216;
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .chat-msg.user {
      align-self: flex-end;
      color: #111113;
      background: #f97316;
      border-color: #fb923c;
      font-weight: 700;
    }

    .ai-input {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 48px 62px;
      gap: 6px;
      margin-top: 10px;
    }

    .voice-button {
      min-width: 48px;
      padding: 0;
    }

    .voice-button.listening {
      color: #111113;
      background: #f97316;
      border-color: #fb923c;
      box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.16);
    }

    .voice-button:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }

    .voice-status {
      display: block;
      margin-top: 7px;
      color: #fdba74;
      font-size: 0.74rem;
      line-height: 1.3;
    }

    @media (max-width: 1220px) {
      .designer-workbench {
        grid-template-columns: 220px minmax(0, 1fr);
      }

      .inspector {
        position: absolute;
        right: 12px;
        top: 76px;
        bottom: 12px;
        z-index: 20;
        width: min(330px, calc(100vw - 260px));
        border: 1px solid #282b31;
        border-radius: 8px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
      }
    }

    @media (max-width: 860px) {
      .designer-header {
        align-items: flex-start;
        flex-direction: column;
        height: auto;
      }

      .designer-shell {
        grid-template-rows: auto minmax(0, 1fr);
      }

      .workflow-meta {
        width: 100%;
        grid-template-columns: 1fr;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .designer-workbench {
        grid-template-columns: 1fr;
      }

      .node-library {
        display: none;
      }

      .inspector {
        width: min(330px, calc(100vw - 24px));
      }
    }
  `]
})
export class DesignerComponent implements AfterViewChecked, OnInit, OnDestroy {
  private readonly workflowService = inject(WorkflowService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly nodeWidth = 250;
  readonly nodeMidY = 56;
  readonly laneWidth = 300;
  readonly laneGap = 60;
  readonly laneStart = 54;

  readonly palette: Array<{ type: string; label: string; description: string; icon: string; className: string }> = [
    { type: 'START', label: 'Inicio', description: 'Punto de entrada', icon: 'S', className: 'start' },
    { type: 'ACTIVITY', label: 'Actividad', description: 'Tarea o formulario', icon: 'A', className: 'activity' },
    { type: 'DECISION', label: 'Decision', description: 'Rama condicional', icon: '?', className: 'decision' },
    { type: 'FORK', label: 'Fork', description: 'Divide el flujo', icon: 'F', className: 'fork' },
    { type: 'JOIN', label: 'Join', description: 'Une ramas', icon: 'J', className: 'join' },
    { type: 'END', label: 'Fin', description: 'Cierre del proceso', icon: 'E', className: 'end' }
  ];

  policyId: string | null = null;
  policies: any[] = [];
  selectedPolicyId = '';
  policyName = 'Flujo de Prestamo Avanzado';

  departamentos: Departamento[] = [
    { id: 'd-atencion', nombre: 'Atencion al Cliente', funcionariosAsignados: ['Funcionario'] },
    { id: 'd-riesgos', nombre: 'Riesgos Crediticios', funcionariosAsignados: ['Funcionario 2'] },
    { id: 'd-aprobacion', nombre: 'Direccion General', funcionariosAsignados: ['Funcionario 3'] },
    { id: 'd-tecnico', nombre: 'Revision Tecnica', funcionariosAsignados: ['Funcionario Tecnico'] },
    { id: 'd-caja', nombre: 'Caja', funcionariosAsignados: ['Funcionario Caja'] }
  ];

  newDeptName = '';
  availableFuncionarios: Usuario[] = [];
  nodes: WorkflowNode[] = [];
  conexiones: Conexion[] = [];
  svgPaths: SvgPath[] = [];

  selectedNodeId: string | null = null;
  isConnecting = false;
  connectionOrigin: WorkflowNode | null = null;
  zoom = 1;

  aiPrompt = '';
  isChatMinimized = true;
  isListening = false;
  voiceSupported = getSpeechRecognitionCtor() !== null;
  voiceStatus = '';
  chatMessages: Array<{ role: string; content: string }> = [
    { role: 'bot', content: 'Hola. Puedo ayudarte a editar el flujo con instrucciones simples.' }
  ];

  mySessionId = 'session_' + Date.now() + Math.random().toString(36).slice(2, 11);
  connectedUsers: ConnectedUser[] = [];

  private needsRedraw = false;
  private stompClient?: Client;
  private isProcessingSync = false;
  private dragState: DragState | null = null;
  private didDrag = false;
  private paletteDragType = '';
  private speechRecognition: any = null;

  get canvasWidth(): number {
    return Math.max(1800, this.laneStart + this.departamentos.length * (this.laneWidth + this.laneGap) + 260);
  }

  get canvasHeight(): number {
    const maxNodeY = this.nodes.reduce((max, node) => Math.max(max, node.y), 0);
    return Math.max(1000, maxNodeY + 320);
  }

  get selectedNode(): WorkflowNode | null {
    return this.nodes.find(node => node.id === this.selectedNodeId) || null;
  }

  ngOnInit(): void {
    this.loadFuncionarios();
    this.loadPolicies();
    this.loadSystemDepartamentos();

    this.route.paramMap.subscribe(params => {
      this.policyId = params.get('id');
      this.selectedPolicyId = this.policyId || '';
      if (this.policyId) {
        this.loadPolicy(this.policyId);
      } else {
        this.policyName = 'Nuevo flujo de trabajo';
        this.nodes = [];
        this.conexiones = [];
        this.selectedNodeId = null;
        this.scheduleRedraw();
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.needsRedraw) {
      this.updateSvgPaths();
      this.needsRedraw = false;
    }
  }

  ngOnDestroy(): void {
    if (this.speechRecognition) {
      this.speechRecognition.abort();
    }

    if (this.stompClient) {
      this.stompClient.deactivate();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.scheduleRedraw();
  }

  loadPolicies(): void {
    this.workflowService.getPolicies().subscribe({
      next: policies => {
        this.policies = policies || [];
      },
      error: () => {
        this.policies = [];
      }
    });
  }

  loadSystemDepartamentos(): void {
    this.workflowService.getDepartamentos().subscribe({
      next: departamentos => {
        if (this.policyId || !departamentos?.length) return;
        this.departamentos = this.normalizeSystemDepartamentos(departamentos);
        this.scheduleRedraw();
      },
      error: () => {
        this.scheduleRedraw();
      }
    });
  }

  loadPolicy(policyId: string): void {
    this.workflowService.getPolicyById(policyId).subscribe(policy => {
      if (policy) {
        this.policyName = policy.nombre || 'Flujo sin nombre';
        if (policy.departamentos && policy.departamentos.length > 0) {
          this.departamentos = this.normalizeDepartamentos(policy.departamentos);
        }
        this.nodes = this.normalizeNodes(policy.nodos || []);
        this.conexiones = policy.conexiones || [];
        this.selectedNodeId = null;
        this.scheduleRedraw();
        this.connectWebSocket();
      }
    });
  }

  openSelectedPolicy(): void {
    if (this.selectedPolicyId) {
      this.router.navigate(['/designer', this.selectedPolicyId]);
      return;
    }

    this.router.navigate(['/designer']);
    this.policyId = null;
    this.policyName = 'Nuevo flujo de trabajo';
    this.nodes = [];
    this.conexiones = [];
    this.selectedNodeId = null;
    this.loadSystemDepartamentos();
    this.scheduleRedraw();
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;

    const dx = (event.clientX - this.dragState.startClientX) / this.zoom;
    const dy = (event.clientY - this.dragState.startClientY) / this.zoom;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.didDrag = true;
    }

    const nextX = this.clamp(this.dragState.startX + dx, 24, this.canvasWidth - this.nodeWidth - 24);
    const nextY = this.clamp(this.dragState.startY + dy, 48, this.canvasHeight - 180);
    this.dragState.node.x = Math.round(nextX);
    this.dragState.node.y = Math.round(nextY);
    this.scheduleRedraw();
  }

  @HostListener('document:pointerup')
  onPointerUp(): void {
    if (!this.dragState) return;

    const dragged = this.didDrag;
    this.dragState = null;
    if (dragged) {
      this.broadcastState();
      setTimeout(() => {
        this.didDrag = false;
      });
    }
  }

  connectWebSocket(): void {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws-designer'),
      debug: (str) => console.log(str),
      reconnectDelay: 5000
    });

    this.stompClient.onConnect = () => {
      this.stompClient?.subscribe('/topic/presence/' + this.policyId, message => {
        if (message.body) {
          this.connectedUsers = JSON.parse(message.body) as ConnectedUser[];
          this.cdr.detectChanges();
        }
      });

      setTimeout(() => {
        this.publishPresence();
      }, 500);

      this.stompClient?.subscribe('/topic/policy/' + this.policyId, message => {
        if (message.body) {
          const state = JSON.parse(message.body);
          if (state.senderId !== this.mySessionId) {
            this.isProcessingSync = true;
            this.nodes = this.normalizeNodes(state.nodos || []);
            this.conexiones = state.conexiones || [];
            if (state.departamentos) this.departamentos = this.normalizeDepartamentos(state.departamentos);
            this.policyName = state.nombre || this.policyName;
            this.scheduleRedraw();
            this.cdr.detectChanges();
            setTimeout(() => {
              this.isProcessingSync = false;
            }, 100);
          }
        }
      });
    };

    this.stompClient.activate();
  }

  publishPresence(editingNodeId: string | null = null, editingProp: string | null = null): void {
    if (!this.stompClient || !this.stompClient.connected) return;

    const currentUser = this.authService.currentUser();
    const randomSuf = Math.floor(100 + Math.random() * 900);
    const randomColors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#ec4899'];
    const userToPublish: ConnectedUser = {
      username: currentUser?.username || ('Admin-' + randomSuf),
      color: currentUser?.color || randomColors[Math.floor(Math.random() * randomColors.length)],
      editingNodeId,
      editingProp,
      sessionId: this.mySessionId
    };

    this.stompClient.publish({
      destination: '/app/designer/presence/join/' + this.policyId,
      body: JSON.stringify(userToPublish)
    });
  }

  broadcastState(): void {
    if (this.isProcessingSync || !this.stompClient || !this.stompClient.connected) return;

    this.stompClient.publish({
      destination: '/app/designer/sync/' + this.policyId,
      body: JSON.stringify({
        senderId: this.mySessionId,
        nodos: this.nodes,
        conexiones: this.conexiones,
        departamentos: this.departamentos,
        nombre: this.policyName
      })
    });
  }

  onPaletteDragStart(event: DragEvent, type: string): void {
    this.paletteDragType = type;
    event.dataTransfer?.setData('application/x-workflow-node', type);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const type = event.dataTransfer?.getData('application/x-workflow-node') || this.paletteDragType;
    if (!type) return;

    const point = this.getCanvasPoint(event);
    this.addNode(type, point.x - this.nodeWidth / 2, point.y - this.nodeMidY);
    this.paletteDragType = '';
  }

  startNodeDrag(event: PointerEvent, node: WorkflowNode): void {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea')) return;

    event.preventDefault();
    this.selectedNodeId = node.id;
    this.publishPresence(node.id);
    this.dragState = {
      node,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y
    };
    this.didDrag = false;
  }

  handleNodeClick(node: WorkflowNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.didDrag) return;

    if (this.isConnecting) {
      this.pickConnectionNode(node);
      return;
    }

    this.selectedNodeId = node.id;
    this.publishPresence(node.id);
  }

  clearSelection(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.selectedNodeId = null;
    this.publishPresence();
  }

  startConnectionFrom(node: WorkflowNode, event: MouseEvent): void {
    event.stopPropagation();
    this.isConnecting = true;
    this.connectionOrigin = node;
    this.selectedNodeId = node.id;
  }

  finishConnection(node: WorkflowNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.connectionOrigin) {
      this.isConnecting = true;
      return;
    }

    this.createConnection(this.connectionOrigin, node);
    this.isConnecting = false;
    this.connectionOrigin = null;
  }

  toggleConnectionMode(): void {
    this.isConnecting = !this.isConnecting;
    this.connectionOrigin = null;
  }

  pickConnectionNode(node: WorkflowNode): void {
    if (!this.connectionOrigin) {
      this.connectionOrigin = node;
      this.selectedNodeId = node.id;
      return;
    }

    this.createConnection(this.connectionOrigin, node);
    this.isConnecting = false;
    this.connectionOrigin = null;
  }

  createConnection(origin: WorkflowNode, target: WorkflowNode): void {
    if (origin.id === target.id) return;

    const exists = this.conexiones.some(conn => conn.origenId === origin.id && conn.destinoId === target.id);
    if (exists) return;

    this.conexiones = [
      ...this.conexiones,
      {
        id: 'c' + Date.now(),
        origenId: origin.id,
        destinoId: target.id,
        condicion: this.isDecision(origin) ? target.nombre : 'DEFAULT'
      }
    ];
    this.scheduleRedraw();
    this.broadcastState();
  }

  addNode(tipo: string, x?: number, y?: number): void {
    const backendTipo = this.toBackendType(tipo);

    if (backendTipo === 'INICIO' && this.nodes.some(node => this.isStart(node))) {
      alert('Solo se permite un nodo de inicio por diagrama.');
      return;
    }

    const position = this.resolveNodePosition(x, y);
    const dept = this.findDepartmentForX(position.x) || this.departamentos[0];
    const newNode: WorkflowNode = {
      id: 'n' + Date.now(),
      tipo: backendTipo,
      nombre: this.defaultNodeName(backendTipo),
      departamentoId: dept?.id || '1',
      funcionariosAsignados: [],
      campos: [],
      x: position.x,
      y: position.y
    };

    this.nodes = [...this.nodes, newNode];
    this.selectedNodeId = newNode.id;
    this.scheduleRedraw();
    this.broadcastState();
  }

  removeNode(node: WorkflowNode): void {
    this.nodes = this.nodes.filter(item => item.id !== node.id);
    this.conexiones = this.conexiones.filter(conn => conn.origenId !== node.id && conn.destinoId !== node.id);
    if (this.selectedNodeId === node.id) {
      this.selectedNodeId = null;
    }
    this.scheduleRedraw();
    this.broadcastState();
  }

  removeConnection(conn: Conexion): void {
    this.conexiones = this.conexiones.filter(item => item.id !== conn.id);
    this.scheduleRedraw();
    this.broadcastState();
  }

  addDepartamento(): void {
    const name = this.newDeptName.trim();
    if (!name) return;

    this.departamentos = [...this.departamentos, { id: 'dept-' + Date.now(), nombre: name, funcionariosAsignados: [] }];
    this.newDeptName = '';
    this.scheduleRedraw();
    this.broadcastState();
  }

  removeDepartamento(id: string): void {
    if (this.departamentos.length <= 1) {
      alert('Debe haber al menos una calle.');
      return;
    }

    const fallbackDept = this.departamentos.find(dept => dept.id !== id);
    if (fallbackDept) {
      this.nodes.forEach(node => {
        if (node.departamentoId === id) {
          node.departamentoId = fallbackDept.id;
          this.snapNodeToLane(node);
        }
      });
    }

    this.departamentos = this.departamentos.filter(dept => dept.id !== id);
    this.scheduleRedraw();
    this.broadcastState();
  }

  addField(node: WorkflowNode): void {
    node.campos = [
      ...(node.campos || []),
      {
        nombre: 'campo_' + Date.now(),
        etiqueta: 'Nuevo Campo',
        tipo: 'TEXTO',
        opciones: []
      }
    ];
    this.scheduleRedraw();
    this.broadcastState();
  }

  removeField(node: WorkflowNode, field: CampoFormulario): void {
    node.campos = node.campos.filter(item => item !== field);
    this.scheduleRedraw();
    this.broadcastState();
  }

  addOpcion(field: CampoFormulario): void {
    const option = field.tempOpcion?.trim();
    if (!option) return;

    field.opciones = [...(field.opciones || []), option];
    field.tempOpcion = '';
    this.broadcastState();
  }

  removeOpcion(field: CampoFormulario, index: number): void {
    field.opciones = (field.opciones || []).filter((_, itemIndex) => itemIndex !== index);
    this.broadcastState();
  }

  loadFuncionarios(): void {
    this.workflowService.getUsuarios().subscribe({
      next: usuarios => {
        const funcionarios = usuarios.filter(usuario => usuario.rol === 'FUNCIONARIO');
        this.availableFuncionarios = funcionarios.length > 0 ? funcionarios : this.defaultFuncionarios();
        if (!this.policyId) {
          this.departamentos = this.withSystemAssignees(this.departamentos);
        }
      },
      error: () => {
        this.availableFuncionarios = this.defaultFuncionarios();
        if (!this.policyId) {
          this.departamentos = this.withSystemAssignees(this.departamentos);
        }
      }
    });
  }

  isFuncionarioAssignedToNode(node: WorkflowNode, username: string): boolean {
    return (node.funcionariosAsignados || []).includes(username);
  }

  toggleNodeFuncionario(node: WorkflowNode, username: string): void {
    node.funcionariosAsignados = this.toggleUsername(node.funcionariosAsignados || [], username);
    this.broadcastState();
  }

  isFuncionarioAssignedToDept(dept: Departamento, username: string): boolean {
    return (dept.funcionariosAsignados || []).includes(username);
  }

  toggleDeptFuncionario(dept: Departamento, username: string): void {
    dept.funcionariosAsignados = this.toggleUsername(dept.funcionariosAsignados || [], username);
    this.broadcastState();
  }

  getNodeEffectiveAssignees(node: WorkflowNode): string[] {
    if (node.funcionariosAsignados && node.funcionariosAsignados.length > 0) {
      return node.funcionariosAsignados;
    }

    return this.departamentos.find(dept => dept.id === node.departamentoId)?.funcionariosAsignados || [];
  }

  getNodeAssignmentLabel(node: WorkflowNode): string {
    const assignees = this.getNodeEffectiveAssignees(node);
    if (assignees.length === 0) return 'Sin funcionario asignado';
    if (assignees.length === 1) return assignees[0];
    return assignees.slice(0, 2).join(', ') + (assignees.length > 2 ? ` +${assignees.length - 2}` : '');
  }

  copyShareLink(): void {
    const url = window.location.origin + '/designer/' + this.policyId;
    navigator.clipboard.writeText(url).then(() => {
      alert('Enlace copiado al portapapeles.');
    }).catch(() => {
      alert('No se pudo copiar. URL: ' + url);
    });
  }

  savePolicy(): void {
    const policy: {
      id?: string;
      nombre: string;
      nodos: WorkflowNode[];
      conexiones: Conexion[];
      departamentos: Departamento[];
    } = {
      nombre: this.policyName,
      nodos: this.nodes,
      conexiones: this.conexiones,
      departamentos: this.departamentos
    };

    if (this.policyId) {
      policy.id = this.policyId;
    }

    this.workflowService.savePolicy(policy).subscribe({
      next: () => {
        alert('Flujo guardado con exito.');
      },
      error: (err) => {
        const msg = err.error?.error || err.message;
        alert('Error al guardar el flujo: ' + msg);
        console.error(err);
      }
    });
  }

  toggleVoiceCommand(): void {
    if (this.isListening) {
      this.stopVoiceCommand();
      return;
    }

    this.startVoiceCommand();
  }

  startVoiceCommand(): void {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      this.voiceSupported = false;
      this.voiceStatus = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.';
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
      this.isChatMinimized = false;
      this.voiceStatus = 'Escuchando... habla tu instruccion.';
      this.cdr.detectChanges();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const spokenText = (finalTranscript || interimTranscript).trim();
      if (spokenText) {
        this.aiPrompt = spokenText;
      }
      this.cdr.detectChanges();
    };

    recognition.onerror = (event: any) => {
      this.isListening = false;
      this.voiceStatus = event.error === 'not-allowed'
        ? 'Permite el microfono en el navegador para usar comandos de voz.'
        : 'No pude escuchar bien. Intenta de nuevo.';
      this.cdr.detectChanges();
    };

    recognition.onend = () => {
      this.isListening = false;
      this.speechRecognition = null;
      const command = finalTranscript.trim() || this.aiPrompt.trim();

      if (command) {
        this.aiPrompt = command;
        this.voiceStatus = 'Comando detectado. Enviando...';
        this.cdr.detectChanges();
        this.sendAiCommand(command);
      } else if (!this.voiceStatus.includes('Permite')) {
        this.voiceStatus = 'No detecte audio. Intenta de nuevo.';
        this.cdr.detectChanges();
      }
    };

    this.speechRecognition = recognition;
    recognition.start();
  }

  stopVoiceCommand(): void {
    if (!this.speechRecognition) return;
    this.voiceStatus = 'Procesando voz...';
    this.speechRecognition.stop();
  }

  sendAiCommand(command?: string): void {
    if (command) {
      this.aiPrompt = command;
    }

    if (!this.aiPrompt.trim()) return;

    const userMsg = this.aiPrompt;
    this.chatMessages.push({ role: 'user', content: userMsg });
    this.aiPrompt = '';
    this.voiceStatus = '';
    this.chatMessages.push({ role: 'bot', content: 'Procesando la solicitud...' });

    this.workflowService.sendAiCommand(userMsg, {
      nodos: this.nodes,
      conexiones: this.conexiones,
      departamentos: this.departamentos
    }).subscribe({
      next: response => {
        this.chatMessages.pop();

        if (response.error) {
          this.chatMessages.push({ role: 'bot', content: 'Error: ' + response.error });
          return;
        }

        if (response.message) {
          this.chatMessages.push({ role: 'bot', content: response.message });
        }

        if (response.actions && Array.isArray(response.actions)) {
          response.actions.forEach((act: any) => {
            if (act.action === 'ADD_NODE') {
              const position = this.resolveNodePosition();
              const newNode: WorkflowNode = {
                id: 'n' + Date.now() + Math.floor(Math.random() * 100),
                tipo: this.toBackendType(act.tipo || 'ACTIVIDAD'),
                nombre: act.nombre || 'Nueva Etapa',
                departamentoId: act.departamentoId || this.departamentos[0]?.id || '1',
                funcionariosAsignados: [],
                campos: [],
                x: position.x,
                y: position.y
              };
              this.nodes.push(newNode);
            } else if (act.action === 'ADD_CONNECTION') {
              const originNode = this.nodes.find(node => node.nombre.toLowerCase().includes(String(act.origenNombre || '').toLowerCase()));
              const destNode = this.nodes.find(node => node.nombre.toLowerCase().includes(String(act.destinoNombre || '').toLowerCase()));
              if (originNode && destNode) {
                this.createConnection(originNode, destNode);
              }
            } else if (act.action === 'ADD_FIELD') {
              const targetNode = this.nodes.find(node => node.nombre.toLowerCase().includes(String(act.nodeNombre || '').toLowerCase()));
              if (targetNode) {
                targetNode.campos = [
                  ...(targetNode.campos || []),
                  {
                    nombre: 'campo_' + Date.now() + Math.floor(Math.random() * 100),
                    etiqueta: act.etiqueta || 'Nuevo Campo',
                    tipo: act.tipo || 'TEXTO',
                    opciones: []
                  }
                ];
              }
            }
          });
          this.nodes = this.normalizeNodes(this.nodes);
          this.scheduleRedraw();
          this.broadcastState();
        }
      },
      error: () => {
        this.chatMessages.pop();
        this.chatMessages.push({ role: 'bot', content: 'Hubo un error de conexion con el backend.' });
      }
    });
  }

  zoomIn(): void {
    this.zoom = Math.min(1.4, Math.round((this.zoom + 0.1) * 10) / 10);
  }

  zoomOut(): void {
    this.zoom = Math.max(0.5, Math.round((this.zoom - 0.1) * 10) / 10);
  }

  resetZoom(): void {
    this.zoom = 1;
  }

  autoLayout(): void {
    const counters = new Map<string, number>();
    this.nodes.forEach((node, index) => {
      const deptIndex = Math.max(0, this.departamentos.findIndex(dept => dept.id === node.departamentoId));
      const laneCount = counters.get(node.departamentoId) || 0;
      node.x = this.laneLeft(deptIndex) + 25;
      node.y = 96 + laneCount * 172 + (index % 2) * 12;
      counters.set(node.departamentoId, laneCount + 1);
    });
    this.scheduleRedraw();
    this.broadcastState();
  }

  snapNodeToLane(node: WorkflowNode): void {
    const deptIndex = Math.max(0, this.departamentos.findIndex(dept => dept.id === node.departamentoId));
    node.x = this.laneLeft(deptIndex) + 25;
  }

  laneLeft(index: number): number {
    return this.laneStart + index * (this.laneWidth + this.laneGap);
  }

  getOutgoingConnections(nodeId: string): Conexion[] {
    return this.conexiones.filter(conn => conn.origenId === nodeId);
  }

  getNodeName(id: string): string {
    const node = this.nodes.find(item => item.id === id);
    return node ? node.nombre : 'Nodo';
  }

  getDepartamentoName(id: string): string {
    return this.departamentos.find(dept => dept.id === id)?.nombre || 'Sin responsable';
  }

  getUsersEditingNode(nodeId: string): ConnectedUser[] {
    return this.connectedUsers.filter(user => user.editingNodeId === nodeId && user.sessionId !== this.mySessionId);
  }

  isPropEditedByOther(nodeId: string, prop: string): boolean {
    return this.connectedUsers.some(user => user.editingNodeId === nodeId && user.editingProp === prop && user.sessionId !== this.mySessionId);
  }

  getPropEditorColor(nodeId: string, prop: string): string {
    const user = this.connectedUsers.find(item => item.editingNodeId === nodeId && item.editingProp === prop && item.sessionId !== this.mySessionId);
    return user ? user.color : '';
  }

  isActivity(node: WorkflowNode): boolean {
    return node.tipo === 'ACTIVIDAD' || node.tipo === 'ACTIVITY';
  }

  isDecision(node: WorkflowNode): boolean {
    return node.tipo === 'DECISION';
  }

  isStart(node: WorkflowNode): boolean {
    return node.tipo === 'INICIO' || node.tipo === 'START';
  }

  nodeClass(node: WorkflowNode): string {
    const type = this.toBackendType(node.tipo).toLowerCase();
    return 'type-' + type;
  }

  getNodeTypeLabel(type: NodeType): string {
    const normalized = this.toBackendType(type);
    const labels: Record<string, string> = {
      INICIO: 'Inicio',
      ACTIVIDAD: 'Actividad',
      DECISION: 'Decision',
      FORK: 'Fork',
      JOIN: 'Join',
      FIN: 'Fin'
    };
    return labels[normalized] || normalized;
  }

  getNodeSymbol(type: NodeType): string {
    const normalized = this.toBackendType(type);
    const symbols: Record<string, string> = {
      INICIO: 'S',
      ACTIVIDAD: 'A',
      DECISION: '?',
      FORK: 'F',
      JOIN: 'J',
      FIN: 'E'
    };
    return symbols[normalized] || 'N';
  }

  scheduleRedraw(): void {
    this.needsRedraw = true;
  }

  updateSvgPaths(): void {
    this.svgPaths = this.conexiones
      .map(conn => {
        const origin = this.nodes.find(node => node.id === conn.origenId);
        const target = this.nodes.find(node => node.id === conn.destinoId);
        if (!origin || !target) return null;

        const x1 = origin.x + this.nodeWidth;
        const y1 = origin.y + this.nodeMidY;
        const x2 = target.x;
        const y2 = target.y + this.nodeMidY;
        const distance = Math.max(90, Math.abs(x2 - x1) * 0.45);
        const direction = x2 >= x1 ? 1 : -1;
        const c1x = x1 + distance * direction;
        const c2x = x2 - distance * direction;
        const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;

        return {
          id: conn.id,
          d,
          condicion: conn.condicion && conn.condicion !== 'DEFAULT' ? conn.condicion : '',
          x: (x1 + x2) / 2,
          y: (y1 + y2) / 2
        };
      })
      .filter((path): path is SvgPath => path !== null);
  }

  paletteTrackBy(_: number, item: { type: string }): string {
    return item.type;
  }

  deptTrackBy(_: number, dept: Departamento): string {
    return dept.id;
  }

  nodeTrackBy(_: number, node: WorkflowNode): string {
    return node.id;
  }

  connTrackBy(_: number, conn: Conexion): string {
    return conn.id;
  }

  pathTrackBy(_: number, path: SvgPath): string {
    return path.id;
  }

  fieldTrackBy(index: number, field: CampoFormulario): string {
    return field.nombre || String(index);
  }

  userTrackBy(_: number, user: ConnectedUser): string {
    return user.sessionId || user.username;
  }

  funcionarioTrackBy(_: number, usuario: Usuario): string {
    return usuario.id || usuario.username;
  }

  policyTrackBy(_: number, policy: any): string {
    return policy.id || policy.nombre;
  }

  messageTrackBy(index: number): number {
    return index;
  }

  private normalizeNodes(nodes: Array<Partial<WorkflowNode>>): WorkflowNode[] {
    const counters = new Map<string, number>();
    return nodes.map((node, index) => {
      const deptId = node.departamentoId || this.departamentos[0]?.id || '1';
      const deptIndex = Math.max(0, this.departamentos.findIndex(dept => dept.id === deptId));
      const laneCount = counters.get(deptId) || 0;
      counters.set(deptId, laneCount + 1);
      const hasPosition = typeof node.x === 'number' && typeof node.y === 'number' && !(node.x === 0 && node.y === 0);

      return {
        id: node.id || 'n' + Date.now() + index,
        tipo: this.toBackendType(node.tipo || 'ACTIVIDAD'),
        nombre: node.nombre || this.defaultNodeName(node.tipo || 'ACTIVIDAD'),
        departamentoId: deptId,
        funcionariosAsignados: node.funcionariosAsignados || [],
        campos: (node.campos || []).map(field => ({
          nombre: field.nombre || 'campo_' + Date.now() + index,
          etiqueta: field.etiqueta || 'Campo',
          tipo: field.tipo || 'TEXTO',
          opciones: field.opciones || []
        })),
        status: node.status,
        x: hasPosition ? Number(node.x) : this.laneLeft(deptIndex) + 25,
        y: hasPosition ? Number(node.y) : 96 + laneCount * 172
      };
    });
  }

  private normalizeDepartamentos(departamentos: Array<Partial<Departamento>>): Departamento[] {
    return departamentos.map((departamento, index) => ({
      id: departamento.id || 'dept-' + index,
      nombre: departamento.nombre || 'Calle sin nombre',
      funcionariosAsignados: departamento.funcionariosAsignados || []
    }));
  }

  private normalizeSystemDepartamentos(departamentos: DepartamentoApi[]): Departamento[] {
    return this.withSystemAssignees(
      departamentos.map((departamento, index) => ({
        id: departamento.id || 'dept-' + index,
        nombre: departamento.nombre || 'Calle sin nombre',
        funcionariosAsignados: []
      }))
    );
  }

  private withSystemAssignees(departamentos: Departamento[]): Departamento[] {
    return departamentos.map(departamento => {
      const assigned = this.availableFuncionarios
        .filter(funcionario => funcionario.departamentoId === departamento.id)
        .map(funcionario => funcionario.username);

      return {
        ...departamento,
        funcionariosAsignados: assigned.length ? assigned : (departamento.funcionariosAsignados || [])
      };
    });
  }

  private resolveNodePosition(x?: number, y?: number): { x: number; y: number } {
    if (typeof x === 'number' && typeof y === 'number') {
      return {
        x: Math.round(this.clamp(x, 24, this.canvasWidth - this.nodeWidth - 24)),
        y: Math.round(this.clamp(y, 48, this.canvasHeight - 180))
      };
    }

    const laneIndex = Math.min(this.departamentos.length - 1, Math.max(0, this.nodes.length % Math.max(1, this.departamentos.length)));
    const laneNodeCount = this.nodes.filter(node => node.departamentoId === this.departamentos[laneIndex]?.id).length;
    return {
      x: this.laneLeft(laneIndex) + 25,
      y: 96 + laneNodeCount * 172
    };
  }

  private findDepartmentForX(x: number): Departamento | undefined {
    return this.departamentos.find((dept, index) => {
      const left = this.laneLeft(index);
      return x >= left && x <= left + this.laneWidth;
    });
  }

  private getCanvasPoint(event: MouseEvent | DragEvent): { x: number; y: number } {
    const stage = document.getElementById('workflow-canvas');
    if (!stage) {
      return { x: 120, y: 120 };
    }

    const rect = stage.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / this.zoom,
      y: (event.clientY - rect.top) / this.zoom
    };
  }

  private toBackendType(type: string): NodeType {
    if (type === 'START') return 'INICIO';
    if (type === 'ACTIVITY') return 'ACTIVIDAD';
    if (type === 'END') return 'FIN';
    return type as NodeType;
  }

  private defaultNodeName(type: string): string {
    const backendType = this.toBackendType(type);
    const names: Record<string, string> = {
      INICIO: 'Inicio',
      ACTIVIDAD: 'Nueva actividad',
      DECISION: 'Nueva decision',
      FORK: 'Separar flujo',
      JOIN: 'Unir flujo',
      FIN: 'Fin'
    };
    return names[backendType] || 'Nuevo nodo';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private toggleUsername(current: string[], username: string): string[] {
    if (current.includes(username)) {
      return current.filter(item => item !== username);
    }
    return [...current, username];
  }

  private defaultFuncionarios(): Usuario[] {
    return [
      { username: 'Funcionario', rol: 'FUNCIONARIO', departamentoId: '1' },
      { username: 'Funcionario 2', rol: 'FUNCIONARIO', departamentoId: '2' },
      { username: 'Funcionario 3', rol: 'FUNCIONARIO', departamentoId: '3' }
    ];
  }
}
