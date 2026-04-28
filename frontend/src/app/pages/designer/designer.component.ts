import { Component, inject, AfterViewChecked, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../services/workflow.service';
import { AuthService } from '../../services/auth.service';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="designer-container">
      <header class="top-bar">
        <div class="title-section">
          <h1>Diseñador de Flujos (Colaborativo & IA)</h1>
          <input [(ngModel)]="policyName" class="minimal-input" placeholder="Nombre de la política" (ngModelChange)="scheduleRedraw(); broadcastState()">
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div *ngIf="connectedUsers.length > 0" class="avatars-container">
            <div *ngFor="let u of connectedUsers" class="avatar" [style.background-color]="u.color" [title]="u.username">
              {{ u.username.charAt(0) | uppercase }}
            </div>
          </div>
          
          <button *ngIf="policyId" class="btn-secondary" (click)="copyShareLink()" title="Copiar enlace para otro admin">
            🔗 Compartir Enlace
          </button>
          <span *ngIf="!policyId" style="font-size: 0.8rem; color: #f59e0b; font-weight: 600;">
            ⚠️ Guarda el flujo primero para activar colaboración
          </span>
          <button class="btn-primary" (click)="savePolicy()">Guardar Política</button>
        </div>
      </header>
      
      <div class="workspace">
        
        <!-- Toolbar -->
        <aside class="toolbar glass-card">
          <p class="toolbar-label">Componentes</p>
          <div class="tool-buttons">
            <button (click)="addNode('START')" class="tool-btn">⭕ Inicio</button>
            <button (click)="addNode('ACTIVITY')" class="tool-btn">⏹️ Actividad</button>
            <button (click)="addNode('DECISION')" class="tool-btn">🔶 Decisión</button>
            <button (click)="addNode('FORK')" class="tool-btn">🔀 Fork</button>
            <button (click)="addNode('JOIN')" class="tool-btn">🔗 Join</button>
            <button (click)="addNode('END')" class="tool-btn">🏁 Fin</button>
          </div>
          
          <p class="toolbar-label mt-4">Conexiones</p>
          <div class="connection-mode">
            <button class="tool-btn" [class.active]="isConnecting" (click)="toggleConnectionMode()">
              {{ isConnecting ? 'Cancelar Conexión' : '🔗 Unir Nodos' }}
            </button>
            <small *ngIf="isConnecting" class="text-xs text-blue-500 mt-1 block">Selecciona origen y destino</small>
          </div>

          <p class="toolbar-label mt-4">Calles / Deptos</p>
          <div class="dept-manager">
            <input [(ngModel)]="newDeptName" placeholder="Nueva calle..." class="minimal-input" (keyup.enter)="addDepartamento()" style="border-bottom: 1px solid var(--border-color); width: 100%;">
            <button class="add-field-btn" (click)="addDepartamento()" style="width: 100%; margin-top: 8px;">+ Añadir Calle</button>
            
            <div class="depts-list" style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px;">
              <div *ngFor="let dept of departamentos" class="dept-item" style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 0.813rem;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px;">{{ dept.nombre }}</span>
                <button class="btn-remove" (click)="removeDepartamento(dept.id)" style="padding: 0 4px;">×</button>
              </div>
            </div>
          </div>
          <p class="toolbar-label mt-4">Condiciones</p>
          <div class="connections-manager" style="max-height: 150px; overflow-y: auto;">
            <small style="color: var(--text-muted); font-size: 0.65rem; margin-bottom: 4px; display: block;">Asigna el resultado (Ej: Si / No)</small>
            <div *ngFor="let conn of conexiones" class="dept-item" style="display: flex; flex-direction: column; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 0.75rem; margin-bottom: 6px;">
              <div style="font-weight: 600; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ getNodeName(conn.origenId) }} ➔ {{ getNodeName(conn.destinoId) }}
              </div>
              <input [(ngModel)]="conn.condicion" placeholder="Ej: Aprobado..." class="minimal-input" style="font-size: 0.75rem; border-bottom: 1px solid var(--border-color); padding: 2px; width: 100%;">
            </div>
          </div>
        </aside>
        
        <!-- Swimlanes Canvas -->
        <div class="canvas">
          <div class="swimlanes-grid" id="swimlanes-grid">
            
            <!-- SVG Layer for connections -->
            <svg class="connections-layer">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
                </marker>
              </defs>
              <path *ngFor="let p of svgPaths" [attr.d]="p.d" stroke="#f97316" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>
              <text *ngFor="let p of svgPaths" [attr.x]="p.x" [attr.y]="p.y - 10" fill="#fb923c" font-size="11" font-weight="700" text-anchor="middle" style="paint-order: stroke; stroke: #111113; stroke-width: 4px;">{{ p.condicion }}</text>
            </svg>

            <!-- Columns per Department -->
            <div class="swimlane" *ngFor="let dept of departamentos">
              <div class="swimlane-header">{{ dept.nombre }}</div>
              <div class="swimlane-body">
                
                <div *ngFor="let node of getNodesForDept(dept.id)" 
                     class="node-wrapper" 
                     [attr.id]="'node-' + node.id"
                     [class.selectable]="isConnecting"
                     [class.selected]="connectionOrigin?.id === node.id"
                     (click)="onNodeClick(node)"
                     style="position: relative;">
                     
                     <!-- Overlay de Co-edición -->
                     <div *ngIf="getUsersEditingNode(node.id).length > 0" class="coediting-overlay" style="position: absolute; top: -10px; right: -10px; z-index: 50; display: flex; gap: 4px;">
                       <div *ngFor="let u of getUsersEditingNode(node.id)" [style.background-color]="u.color" style="color: white; font-size: 0.65rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                         ✏️ {{ u.username }}
                       </div>
                     </div>
                     
                  <ng-container *ngIf="node.tipo !== 'DECISION'">
                    <div class="node-box glass-card animate-pop" [class.activity]="node.tipo === 'ACTIVIDAD'" [style.border-color]="getUsersEditingNode(node.id).length > 0 ? getUsersEditingNode(node.id)[0].color : ''">
                      <div class="node-header">
                        <span class="type">{{ node.tipo }}</span>
                        <button class="delete-btn" (click)="removeNode(node); $event.stopPropagation()">×</button>
                      </div>
                      
                      <input [(ngModel)]="node.nombre" class="node-name-input" placeholder="Nombre..." (ngModelChange)="scheduleRedraw(); broadcastState()" (focus)="publishPresence(node.id, 'nombre')" (blur)="publishPresence()" [style.outline]="isPropEditedByOther(node.id, 'nombre') ? '2px solid ' + getPropEditorColor(node.id, 'nombre') : ''">
                      
                      <div class="field-section">
                        <select [(ngModel)]="node.departamentoId" class="minimal-select" (ngModelChange)="scheduleRedraw(); broadcastState()" style="width: 100%; margin-bottom: 8px;">
                          <option *ngFor="let d of departamentos" [value]="d.id">{{d.nombre}}</option>
                        </select>
                      </div>

                      <div *ngIf="node.tipo === 'ACTIVIDAD'" class="field-section">
                        
                        <div class="fields-list">
                          <div *ngFor="let field of node.campos; let fIdx = index" class="field-row">
                            <input [(ngModel)]="field.etiqueta" class="minimal-input field-label" (ngModelChange)="broadcastState()" (focus)="publishPresence(node.id, 'field_' + fIdx)" (blur)="publishPresence()" [style.outline]="isPropEditedByOther(node.id, 'field_' + fIdx) ? '2px solid ' + getPropEditorColor(node.id, 'field_' + fIdx) : ''">
                            <select [(ngModel)]="field.tipo" class="minimal-select field-type" (ngModelChange)="scheduleRedraw(); broadcastState()">
                              <option value="TEXTO">Texto</option>
                              <option value="NUMERO">Número</option>
                              <option value="SELECCION">Opciones</option>
                              <option value="FOTO">Foto/Archivo</option>
                            </select>
                            <button (click)="removeField(node, field); scheduleRedraw()" class="btn-remove">×</button>
                            <div *ngIf="field.tipo === 'SELECCION'" class="options-config" style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px; width: 100%;">
                               <div style="display: flex; gap: 4px;">
                                 <input [(ngModel)]="field.tempOpcion" placeholder="Nueva opción..." (keyup.enter)="addOpcion(field); scheduleRedraw()" (blur)="addOpcion(field)" style="flex: 1; padding: 4px; font-size: 0.75rem; border: 1px solid #cbd5e1; border-radius: 4px;">
                                 <button (click)="addOpcion(field); scheduleRedraw()" style="padding: 0 8px; background: var(--primary); color: white; border-radius: 4px; border: none; font-weight: bold; cursor: pointer;">+</button>
                               </div>
                               <div class="tags" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
                                 <span *ngFor="let opt of field.opciones; let idx = index" class="tag" style="background: #e2e8f0; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px;">
                                   {{ opt }}
                                   <button (click)="field.opciones.splice(idx, 1); scheduleRedraw(); broadcastState()" style="border: none; background: transparent; color: #ef4444; cursor: pointer; font-size: 0.75rem; padding: 0; line-height: 1;">×</button>
                                 </span>
                               </div>
                             </div>
                          </div>
                        </div>
                        <button class="add-field-btn" (click)="addField(node); scheduleRedraw()">+ Campo</button>
                      </div>
                    </div>
                  </ng-container>

                  <ng-container *ngIf="node.tipo === 'DECISION'">
                    <div class="decision-container animate-pop">
                      <div class="diamond-wrapper">
                        <div class="diamond-shape"></div>
                        <div class="diamond-content">🔶</div>
                      </div>
                      
                        <div class="decision-config glass-card" [style.border-color]="getUsersEditingNode(node.id).length > 0 ? getUsersEditingNode(node.id)[0].color : ''">
                          <div class="node-header">
                            <span class="type">DECISIÓN</span>
                            <button class="delete-btn" (click)="removeNode(node); $event.stopPropagation()">×</button>
                          </div>
                          
                          <input [(ngModel)]="node.nombre" class="node-name-input" placeholder="Ej: ¿Aprobado?" (ngModelChange)="scheduleRedraw(); broadcastState()" style="text-align: center;" (focus)="publishPresence(node.id)" (blur)="publishPresence()">
                        
                        <div class="field-section" style="border-top: 1px solid #cbd5e1; padding-top: 8px;">
                          <small style="color: var(--text-muted); font-weight: 700; font-size: 0.7rem; display: block; margin-bottom: 2px;">BOTONES DE DECISIÓN PARA EL FUNCIONARIO:</small>
                          <small style="color: #64748b; font-size: 0.65rem; display: block; margin-bottom: 6px; line-height: 1.2;">Puedes dejar el nombre del destino, o escribir uno diferente para el botón.</small>
                          <div *ngFor="let conn of getOutgoingConnections(node.id); let cIdx = index" style="margin-top: 6px; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.7rem; font-weight: 600; color: var(--primary); margin-bottom: 2px;">
                              ➔ Va hacia: {{ getNodeName(conn.destinoId) }}
                            </div>
                            <input [(ngModel)]="conn.condicion" placeholder="Texto del botón" class="minimal-input" style="font-size: 0.75rem; padding: 4px; border-radius: 4px; width: 100%; border: 1px solid #93c5fd; background: white; font-weight: 600;" (ngModelChange)="scheduleRedraw(); broadcastState()" (focus)="publishPresence(node.id, 'conn_' + cIdx)" (blur)="publishPresence()" [style.outline]="isPropEditedByOther(node.id, 'conn_' + cIdx) ? '2px solid ' + getPropEditorColor(node.id, 'conn_' + cIdx) : ''">
                          </div>
                          <small *ngIf="getOutgoingConnections(node.id).length === 0" style="color: #f59e0b; font-size: 0.65rem;">Debes dibujar flechas desde este rombo hacia otras actividades para configurar las opciones.</small>
                        </div>
                      </div>
                    </div>
                  </ng-container>

                </div>

              </div>
            </div>

          </div>
        </div>
        
        <!-- Groq AI Chat Panel -->
        <aside class="ai-panel glass-card" [class.minimized]="isChatMinimized" (click)="isChatMinimized && (isChatMinimized = false)">
          <div class="ai-header" *ngIf="!isChatMinimized">
            <div class="ai-header-title">
              <h3>✨ Asistente IA (Groq)</h3>
              <p>Pídele a Groq que edite el flujo</p>
            </div>
            <button class="minimize-btn" (click)="isChatMinimized = true; $event.stopPropagation()">—</button>
          </div>
          
          <div class="ai-chat-body" *ngIf="!isChatMinimized">
            <div *ngFor="let msg of chatMessages" class="chat-msg" [class.user]="msg.role === 'user'" [class.bot]="msg.role === 'bot'">
              <span class="msg-bubble">{{ msg.content }}</span>
            </div>
          </div>
          
          <div class="ai-input-area" *ngIf="!isChatMinimized">
            <input [(ngModel)]="aiPrompt" placeholder="Ej: Añade una actividad..." (keyup.enter)="sendAiCommand()">
            <button (click)="sendAiCommand()">Enviar</button>
          </div>

          <div class="floating-ai-icon" *ngIf="isChatMinimized" title="Abrir Chat de IA">
            ✨
          </div>
        </aside>

      </div>
    </div>
  `,
  styles: [`
    .designer-container { height: 100%; display: flex; flex-direction: column; background: #f8fafc; }
    .top-bar { padding: 16px 32px; background: white; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
    .title-section h1 { font-size: 1.25rem; margin-bottom: 4px; }
    .minimal-input { border: none; border-bottom: 1px solid transparent; font-size: 0.875rem; color: var(--text-muted); width: 100%; padding: 4px; background: transparent; }
    .minimal-input:focus { outline: none; border-bottom-color: var(--primary); color: var(--text-main); }
    .btn-secondary { background: white; border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s; }
    .btn-secondary:hover { background: #f1f5f9; }
    
    .avatars-container { display: flex; align-items: center; gap: 4px; margin-right: 8px; border-right: 1px solid var(--border-color); padding-right: 12px; }
    .avatar { width: 32px; height: 32px; border-radius: 16px; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; box-shadow: 0 0 0 2px white; cursor: pointer; }
    
    .workspace { flex: 1; display: flex; padding: 10px; gap: 12px; overflow: hidden; position: relative; }
    
    .toolbar { width: 150px; padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 120px); overflow-y: auto; flex-shrink: 0; }
    .toolbar-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 4px; }
    .mt-4 { margin-top: 10px; }
    .tool-buttons { display: flex; flex-direction: column; gap: 6px; }
    .tool-btn { text-align: left; padding: 6px 10px; background: white; border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 0.813rem; }
    .tool-btn:hover { background: #f1f5f9; border-color: var(--primary); }
    .tool-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    
    /* Swimlanes Canvas */
    .canvas { flex: 1; background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; overflow: auto; position: relative; margin-right: 0px; }
    .swimlanes-grid { display: flex; min-width: max-content; min-height: 100%; position: relative; }
    
    .connections-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
    
    .swimlane { flex: 0 0 320px; width: 320px; border-right: 1px dashed var(--border-color); display: flex; flex-direction: column; }
    .swimlane:last-child { border-right: none; }
    .swimlane-header { padding: 16px; text-align: center; font-weight: 600; color: var(--text-main); border-bottom: 1px solid var(--border-color); background: #f8fafc; position: sticky; top: 0; z-index: 20; }
    .swimlane-body { padding: 24px 16px; display: flex; flex-direction: column; gap: 40px; align-items: center; min-height: 500px; }
    
    /* Nodes */
    .node-wrapper { width: 100%; position: relative; z-index: 15; transition: transform 0.2s; display: flex; justify-content: center; align-items: center; }
    .node-wrapper.selectable { cursor: crosshair; }
    .node-wrapper.selectable:hover { transform: scale(1.02); }
    .node-wrapper.selected .node-box, .node-wrapper.selected .decision-config, .node-wrapper.selected .diamond-shape { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3); }
    
    .node-box { width: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px; border-radius: 6px; background: white; border: 1px solid var(--border-color); }
    .node-box.activity { border-left: 4px solid var(--primary); }
    
    /* Decision Nodes Styles */
    .decision-container { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 12px; }
    .diamond-wrapper { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
    .diamond-shape { position: absolute; width: 100%; height: 100%; background: #fef3c7; border: 2px solid #f59e0b; transform: rotate(45deg); border-radius: 4px; transition: all 0.2s; }
    .diamond-wrapper:hover .diamond-shape { background: #fde68a; border-color: #d97706; transform: rotate(45deg) scale(1.05); }
    .diamond-content { position: relative; z-index: 2; font-size: 1.5rem; }
    .decision-config { width: 100%; padding: 12px; display: flex; flex-direction: column; gap: 8px; border-radius: 6px; background: white; border: 1px solid #f59e0b; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.1); }
    .decision-config .node-header .type { color: #d97706; }
    
    .node-header { display: flex; justify-content: space-between; align-items: center; }
    .type { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .delete-btn { background: none; border: none; color: #cbd5e1; font-size: 1.25rem; line-height: 1; cursor: pointer; }
    .delete-btn:hover { color: #ef4444; }
    .node-name-input { border: none; font-size: 0.938rem; font-weight: 500; width: 100%; }
    .node-name-input:focus { outline: none; color: var(--primary); }
    
    /* Fields */
    .field-section { border-top: 1px solid var(--border-color); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .minimal-select { width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.813rem; background: white; }
    .fields-list { display: flex; flex-direction: column; gap: 8px; }
    .field-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; background: #f8fafc; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .field-label { flex: 1; border-bottom: 1px solid #cbd5e1 !important; }
    .field-type { width: 90px; }
    .btn-remove { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; }
    
    .options-config { width: 100%; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; }
    .options-config input { font-size: 0.75rem; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; }
    .tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag { font-size: 0.7rem; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; }
    .add-field-btn { background: none; border: 1px dashed var(--border-color); color: var(--primary); padding: 6px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; }
    .add-field-btn:hover { background: #eff6ff; }
    
    /* AI Panel Flotante */
    .ai-panel { position: fixed; right: 48px; bottom: 48px; width: 320px; height: 450px; display: flex; flex-direction: column; z-index: 1000; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-radius: 12px; overflow: hidden; background: white; border: 1px solid var(--border-color); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .ai-panel.minimized { width: 56px; height: 56px; border-radius: 28px; padding: 0; background: linear-gradient(135deg, #1e1b4b, #312e81); cursor: pointer; justify-content: center; align-items: center; border: none; }
    .ai-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; }
    .ai-header-title h3 { font-size: 0.9rem; margin: 0; font-weight: 600; }
    .ai-header-title p { font-size: 0.7rem; margin: 2px 0 0 0; opacity: 0.8; }
    .minimize-btn { background: transparent; border: none; color: white; font-size: 1.25rem; cursor: pointer; padding: 0 4px; line-height: 1; }
    .minimize-btn:hover { opacity: 0.7; }
    
    .ai-chat-body { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #fafafa; }
    
    .chat-msg { display: flex; width: 100%; }
    .chat-msg.user { justify-content: flex-end; }
    .chat-msg.bot { justify-content: flex-start; }
    .msg-bubble { padding: 8px 12px; border-radius: 12px; font-size: 0.813rem; max-width: 85%; line-height: 1.4; }
    .chat-msg.user .msg-bubble { background: var(--primary); color: white; border-bottom-right-radius: 2px; }
    .chat-msg.bot .msg-bubble { background: #e2e8f0; color: #1e293b; border-bottom-left-radius: 2px; }
    
    .ai-input-area { padding: 12px; border-top: 1px solid var(--border-color); display: flex; gap: 8px; background: white; }
    .ai-input-area input { flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 20px; font-size: 0.813rem; }
    .ai-input-area input:focus { outline: none; border-color: var(--primary); }
    .ai-input-area button { background: var(--primary); color: white; border: none; border-radius: 20px; padding: 0 12px; font-size: 0.813rem; font-weight: 600; cursor: pointer; }
    .ai-input-area button:hover { background: #4f46e5; }
    
    /* Dark n8n-style skin */
    :host {
      display: block;
      height: 100%;
      color: #e5e7eb;
      background: #111113;
    }

    .designer-container {
      background:
        linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        #111113 !important;
      background-size: 28px 28px;
    }

    .top-bar {
      margin: 14px 16px 0;
      padding: 16px 18px !important;
      background: rgba(23, 23, 26, 0.96) !important;
      border: 1px solid #2b2b31 !important;
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }

    .title-section h1 {
      color: #f9fafb !important;
      font-size: 1.05rem !important;
    }

    .minimal-input, .node-name-input {
      color: #e5e7eb !important;
      background: transparent !important;
      border-bottom-color: #33343a !important;
    }

    .minimal-input:focus, .node-name-input:focus {
      border-bottom-color: #f97316 !important;
      color: #f9fafb !important;
    }

    .btn-primary {
      min-height: 38px;
      padding: 0 16px !important;
      background: #f97316 !important;
      border: 1px solid #fb923c !important;
      color: #111113 !important;
      font-weight: 800;
      border-radius: 6px !important;
      box-shadow: 0 10px 24px rgba(249, 115, 22, 0.24);
      transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }

    .btn-primary:hover {
      background: #fb923c !important;
      box-shadow: 0 14px 30px rgba(249, 115, 22, 0.32);
      transform: translateY(-1px);
    }

    .btn-secondary {
      min-height: 38px;
      padding: 0 14px !important;
      background: #202126 !important;
      border-color: #3a3a42 !important;
      color: #e5e7eb !important;
      border-radius: 6px !important;
      transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
    }

    .btn-secondary:hover {
      background: #2a2b31 !important;
      border-color: rgba(249, 115, 22, 0.55) !important;
      transform: translateY(-1px);
    }

    .avatars-container {
      border-right-color: #33343a !important;
    }

    .avatar {
      box-shadow: 0 0 0 2px #17171a !important;
    }

    .workspace {
      padding: 14px 16px 16px !important;
      gap: 14px !important;
    }

    .toolbar {
      width: 230px !important;
      padding: 14px !important;
      background: rgba(23, 23, 26, 0.96) !important;
      border: 1px solid #2b2b31 !important;
      border-radius: 8px !important;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24) !important;
    }

    .toolbar-label {
      color: #9ca3af !important;
      letter-spacing: 0.08em;
    }

    .tool-btn, .add-field-btn {
      min-height: 38px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      padding: 0 12px !important;
      background: #202126 !important;
      border: 1px solid #33343a !important;
      color: #e5e7eb !important;
      border-radius: 6px !important;
      font-weight: 650;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
      transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
    }

    .tool-btn:hover, .add-field-btn:hover {
      background: rgba(249, 115, 22, 0.12) !important;
      border-color: rgba(249, 115, 22, 0.55) !important;
      color: #fb923c !important;
      transform: translateX(2px);
    }

    .tool-btn.active {
      background: #f97316 !important;
      border-color: #fb923c !important;
      color: #111113 !important;
      font-weight: 800;
      box-shadow: 0 10px 24px rgba(249, 115, 22, 0.24);
    }

    .connection-mode .tool-btn {
      justify-content: center;
      border-style: dashed !important;
    }

    .connection-mode .tool-btn.active {
      border-style: solid !important;
      animation: activePulse 1.4s ease-in-out infinite;
    }

    .canvas {
      background:
        radial-gradient(circle at 16px 16px, rgba(249, 115, 22, 0.15) 1px, transparent 1px),
        #111113 !important;
      background-size: 24px 24px !important;
      border: 1px solid #2b2b31 !important;
      border-radius: 8px !important;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.015), 0 18px 50px rgba(0, 0, 0, 0.22) !important;
    }

    .swimlane {
      border-right-color: #2b2b31 !important;
    }

    .swimlane-header {
      background: rgba(23, 23, 26, 0.96) !important;
      border-bottom-color: #2b2b31 !important;
      color: #f3f4f6 !important;
    }

    .swimlane-body {
      min-height: 650px;
    }

    .node-box, .decision-config {
      background: #18191d !important;
      border: 1px solid #34353c !important;
      border-radius: 8px !important;
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28) !important;
    }

    .node-box.activity {
      border-left: 4px solid #f97316 !important;
    }

    .node-wrapper.selected .node-box,
    .node-wrapper.selected .decision-config,
    .node-wrapper.selected .diamond-shape {
      border-color: #f97316 !important;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.28), 0 18px 38px rgba(0, 0, 0, 0.32) !important;
    }

    .type {
      color: #fb923c !important;
    }

    .delete-btn {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      color: #6b7280 !important;
      border-radius: 6px !important;
      transition: background 0.16s ease, color 0.16s ease;
    }

    .delete-btn:hover, .btn-remove:hover {
      background: rgba(248, 113, 113, 0.12) !important;
      color: #f87171 !important;
    }

    .field-section {
      border-top-color: #2b2b31 !important;
    }

    .minimal-select,
    .field-row,
    .options-config input,
    .dept-item {
      background: #202126 !important;
      border-color: #33343a !important;
      color: #e5e7eb !important;
    }

    .minimal-select option {
      background: #18191d;
      color: #e5e7eb;
    }

    .field-label {
      border-bottom-color: #33343a !important;
    }

    .tag {
      background: rgba(249, 115, 22, 0.16) !important;
      color: #fed7aa !important;
      border: 1px solid rgba(249, 115, 22, 0.28);
      border-radius: 999px !important;
      min-height: 22px;
    }

    .tag button, .btn-remove {
      border-radius: 4px !important;
      transition: background 0.16s ease, color 0.16s ease;
    }

    .diamond-shape {
      background: #251a12 !important;
      border-color: #f97316 !important;
    }

    .diamond-wrapper:hover .diamond-shape {
      background: #3a2415 !important;
      border-color: #fb923c !important;
    }

    .decision-config .node-header .type {
      color: #fb923c !important;
    }

    .coediting-overlay > div {
      border: 1px solid rgba(255, 255, 255, 0.22);
      box-shadow: 0 12px 20px rgba(0, 0, 0, 0.35) !important;
    }

    .ai-panel {
      background: #18191d !important;
      border-color: #34353c !important;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42) !important;
    }

    .ai-panel.minimized {
      background: #f97316 !important;
      box-shadow: 0 14px 36px rgba(249, 115, 22, 0.28) !important;
    }

    .ai-header {
      background: #202126 !important;
      border-bottom-color: #34353c !important;
      color: #f9fafb !important;
    }

    .ai-chat-body {
      background: #111113 !important;
    }

    .chat-msg.user .msg-bubble {
      background: #f97316 !important;
      color: #111113 !important;
    }

    .chat-msg.bot .msg-bubble {
      background: #202126 !important;
      color: #e5e7eb !important;
      border: 1px solid #33343a;
    }

    .ai-input-area {
      background: #18191d !important;
      border-top-color: #34353c !important;
    }

    .ai-input-area input {
      background: #202126 !important;
      border-color: #33343a !important;
      color: #e5e7eb !important;
    }

    .ai-input-area button {
      min-height: 34px;
      background: #f97316 !important;
      color: #111113 !important;
      border-radius: 6px !important;
      font-weight: 800 !important;
    }

    @keyframes activePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.28); }
      50% { box-shadow: 0 0 0 5px rgba(249, 115, 22, 0.08); }
    }

    small, .text-xs {
      color: #9ca3af !important;
    }

    @media (max-width: 1100px) {
      .workspace {
        flex-direction: column;
        overflow: auto !important;
      }

      .toolbar {
        width: 100% !important;
        max-height: none !important;
      }

      .tool-buttons {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .floating-ai-icon { font-size: 1.5rem; color: white; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
  `]
})
export class DesignerComponent implements AfterViewChecked, OnInit, OnDestroy {
  private workflowService = inject(WorkflowService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  policyId: string | null = null;
  policyName = 'Flujo de Préstamo Avanzado';
  
  // Calles / Departamentos simulados (Idealmente vendrían del backend)
  departamentos = [
    { id: '1', nombre: 'Atención al Cliente' },
    { id: '2', nombre: 'Revisión Técnica / Riesgos' },
    { id: '3', nombre: 'Dirección / Aprobación' }
  ];

  newDeptName = '';

  nodes: any[] = [];
  conexiones: any[] = [];
  
  svgPaths: any[] = [];
  
  // Modo de conexión
  isConnecting = false;
  connectionOrigin: any = null;

  // AI Chat
  aiPrompt = '';
  isChatMinimized = true;
  chatMessages: {role: string, content: string}[] = [
    { role: 'bot', content: '¡Hola! Soy Grok. Dime qué necesitas modificar en tu diagrama y lo haré por ti.' }
  ];

  private needsRedraw = false;
  
  private stompClient?: Client;
  mySessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
  private isProcessingSync = false;
  
  connectedUsers: any[] = [];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.policyId = params.get('id');
      if (this.policyId) {
        this.workflowService.getPolicyById(this.policyId).subscribe(policy => {
          if (policy) {
            this.policyName = policy.nombre || 'Flujo sin nombre';
            this.nodes = policy.nodos || [];
            this.conexiones = policy.conexiones || [];
            if (policy.departamentos && policy.departamentos.length > 0) {
              this.departamentos = policy.departamentos;
            }
            this.scheduleRedraw();
            this.connectWebSocket();
          }
        });
      }
    });
  }

  connectWebSocket() {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws-designer`),
      debug: (str) => console.log(str),
      reconnectDelay: 5000,
    });

    this.stompClient.onConnect = (frame) => {
      console.log('Connected to WebSocket for Collaboration: ' + frame);
      
      this.stompClient?.subscribe('/topic/presence/' + this.policyId, (message) => {
        if (message.body) {
          this.connectedUsers = JSON.parse(message.body);
          this.cdr.detectChanges();
        }
      });
      
      setTimeout(() => {
        this.publishPresence();
      }, 500);

      this.stompClient?.subscribe('/topic/policy/' + this.policyId, (message) => {
        if (message.body) {
          const state = JSON.parse(message.body);
          if (state.senderId !== this.mySessionId) {
            this.isProcessingSync = true;
            this.nodes = state.nodos;
            this.conexiones = state.conexiones;
            if (state.departamentos) this.departamentos = state.departamentos;
            this.policyName = state.nombre;
            this.scheduleRedraw();
            this.cdr.detectChanges();
            setTimeout(() => this.isProcessingSync = false, 100);
          }
        }
      });
    };

    this.stompClient.activate();
  }

  publishPresence(editingNodeId: string | null = null, editingProp: string | null = null) {
    if (!this.stompClient || !this.stompClient.connected) return;
    
    let currentUser = this.authService.currentUser();
    const randomSuf = Math.floor(100 + Math.random() * 900);
    const randomColors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#ec4899'];
    
    const userToPublish = {
      username: currentUser?.username || ('Admin-' + randomSuf),
      color: currentUser?.color || randomColors[Math.floor(Math.random() * randomColors.length)],
      editingNodeId: editingNodeId,
      editingProp: editingProp,
      sessionId: this.mySessionId
    };
    
    this.stompClient.publish({
      destination: '/app/designer/presence/join/' + this.policyId,
      body: JSON.stringify(userToPublish)
    });
  }

  isPropEditedByOther(nodeId: string, prop: string): boolean {
    return this.connectedUsers.some(u => u.editingNodeId === nodeId && u.editingProp === prop && u.sessionId !== this.mySessionId);
  }
  
  getPropEditorColor(nodeId: string, prop: string): string {
    const user = this.connectedUsers.find(u => u.editingNodeId === nodeId && u.editingProp === prop && u.sessionId !== this.mySessionId);
    return user ? user.color : '';
  }

  getUsersEditingNode(nodeId: string): any[] {
    return this.connectedUsers.filter(u => u.editingNodeId === nodeId && u.sessionId !== this.mySessionId);
  }

  ngOnDestroy() {
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
  }

  broadcastState() {
    if (this.isProcessingSync || !this.stompClient || !this.stompClient.connected) return;
    
    const state = {
      senderId: this.mySessionId,
      nodos: this.nodes,
      conexiones: this.conexiones,
      departamentos: this.departamentos,
      nombre: this.policyName
    };
    
    this.stompClient.publish({
      destination: '/app/designer/sync/' + this.policyId,
      body: JSON.stringify(state)
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.scheduleRedraw();
  }

  ngAfterViewChecked() {
    if (this.needsRedraw) {
      this.drawLines();
      this.needsRedraw = false;
    }
  }

  scheduleRedraw() {
    this.needsRedraw = true;
  }

  getNodesForDept(deptId: string) {
    return this.nodes.filter(n => n.departamentoId === deptId);
  }

  addDepartamento() {
    if (!this.newDeptName.trim()) return;
    this.departamentos.push({
      id: 'dept-' + Date.now(),
      nombre: this.newDeptName.trim()
    });
    this.newDeptName = '';
    this.scheduleRedraw();
    this.broadcastState();
  }

  removeDepartamento(id: string) {
    if (this.departamentos.length <= 1) {
      alert('Debe haber al menos una calle.');
      return;
    }
    // Reasignar nodos de esa calle a la primera calle disponible
    const fallbackDept = this.departamentos.find(d => d.id !== id);
    if (fallbackDept) {
      this.nodes.forEach(n => {
        if (n.departamentoId === id) {
          n.departamentoId = fallbackDept.id;
        }
      });
    }
    this.departamentos = this.departamentos.filter(d => d.id !== id);
    this.scheduleRedraw();
    this.broadcastState();
  }

  getNodeName(id: string): string {
    const node = this.nodes.find(n => n.id === id);
    return node ? node.nombre : 'Nodo';
  }

  getOutgoingConnections(nodeId: string): any[] {
    return this.conexiones.filter(c => c.origenId === nodeId);
  }

  addNode(tipo: string) {
    const backendTipo = tipo === 'START' ? 'INICIO' : 
                       tipo === 'ACTIVITY' ? 'ACTIVIDAD' : 
                       tipo === 'END' ? 'FIN' : tipo;
                       
    if (backendTipo === 'INICIO' && this.nodes.some(n => n.tipo === 'INICIO')) {
      alert('Solo se permite un único nodo de Inicio por diagrama.');
      return;
    }

    const newNode = {
      id: 'n' + Date.now(),
      tipo: backendTipo,
      nombre: tipo === 'START' ? 'Inicio' : tipo === 'END' ? 'Fin' : 'Nueva Etapa',
      departamentoId: this.departamentos.length > 0 ? this.departamentos[0].id : '1',
      campos: []
    };
    this.nodes.push(newNode);
    this.scheduleRedraw();
    this.broadcastState();
  }

  removeNode(node: any) {
    this.nodes = this.nodes.filter(n => n.id !== node.id);
    this.conexiones = this.conexiones.filter(c => c.origenId !== node.id && c.destinoId !== node.id);
    this.scheduleRedraw();
    this.broadcastState();
  }

  // Lógica de conexión manual
  toggleConnectionMode() {
    this.isConnecting = !this.isConnecting;
    this.connectionOrigin = null;
  }

  onNodeClick(node: any) {
    if (!this.isConnecting) return;
    
    if (!this.connectionOrigin) {
      this.connectionOrigin = node;
    } else {
      if (this.connectionOrigin.id !== node.id) {
        // Verificar si ya existe
        const exists = this.conexiones.some(c => c.origenId === this.connectionOrigin.id && c.destinoId === node.id);
        if (!exists) {
          this.conexiones = [...this.conexiones, {
            id: 'c' + Date.now(),
            origenId: this.connectionOrigin.id,
            destinoId: node.id,
            condicion: this.connectionOrigin.tipo === 'DECISION' ? node.nombre : 'DEFAULT'
          }];
          this.scheduleRedraw();
          this.broadcastState();
        }
      }
      this.isConnecting = false;
      this.connectionOrigin = null;
    }
  }

  drawLines() {
    setTimeout(() => {
      this.svgPaths = [];
      const container = document.getElementById('swimlanes-grid');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      this.conexiones.forEach(conn => {
        const el1 = document.getElementById('node-' + conn.origenId);
        const el2 = document.getElementById('node-' + conn.destinoId);
        
        if (el1 && el2) {
          const rect1 = el1.getBoundingClientRect();
          const rect2 = el2.getBoundingClientRect();
          
          // Centro del origen
          const x1 = rect1.left + rect1.width / 2 - containerRect.left;
          const y1 = rect1.bottom - containerRect.top;
          
          // Centro del destino
          const x2 = rect2.left + rect2.width / 2 - containerRect.left;
          const y2 = rect2.top - containerRect.top;
          
          // Curva Bezier para la flecha
          const offset = Math.abs(y2 - y1) / 2;
          const path = 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + offset) + ', ' + x2 + ' ' + (y2 - offset) + ', ' + x2 + ' ' + (y2 - 10);
          
          // Guardar objeto con metadata para texto
          this.svgPaths.push({
            d: path,
            condicion: (conn.condicion && conn.condicion !== 'DEFAULT') ? conn.condicion : '',
            x: (x1 + x2) / 2,
            y: (y1 + y2) / 2
          });
        }
      });
    }, 50); // Pequeño delay para asegurar que el DOM se actualizó
  }

  // --- Campos de Formulario ---
  addField(node: any) {
    if (!node.campos) node.campos = [];
    node.campos.push({ nombre: 'campo_' + Date.now(), etiqueta: 'Nuevo Campo', tipo: 'TEXTO', opciones: [] });
    this.broadcastState();
  }

  removeField(node: any, field: any) {
    node.campos = node.campos.filter((f: any) => f !== field);
    this.broadcastState();
  }

  addOpcion(field: any) {
    if (field.tempOpcion) {
      if (!field.opciones) field.opciones = [];
      field.opciones.push(field.tempOpcion);
      field.tempOpcion = '';
      this.broadcastState();
    }
  }

  copyShareLink() {
    const url = window.location.origin + '/designer/' + this.policyId;
    navigator.clipboard.writeText(url).then(() => {
      alert('¡Enlace copiado al portapapeles! Envíalo a otro administrador para colaborar.');
    }).catch(err => {
      alert('Error al copiar el enlace. URL: ' + url);
    });
  }

  savePolicy() {
    const policy: any = { 
      nombre: this.policyName, 
      nodos: this.nodes, 
      conexiones: this.conexiones,
      departamentos: this.departamentos 
    };
    if (this.policyId) {
      policy.id = this.policyId;
    }
    this.workflowService.savePolicy(policy).subscribe({
      next: () => { alert('Flujo guardado con éxito'); },
      error: (err) => {
        const msg = err.error?.error || err.message;
        alert('Error al guardar el flujo: ' + msg);
        console.error(err);
      }
    });
  }

  // --- AI Chat Logic ---
  sendAiCommand() {
    if (!this.aiPrompt.trim()) return;
    
    const userMsg = this.aiPrompt;
    this.chatMessages.push({ role: 'user', content: userMsg });
    this.aiPrompt = '';

    this.chatMessages.push({ role: 'bot', content: 'Procesando tu solicitud con Groq...' });
    
    const currentState = {
      nodos: this.nodes,
      conexiones: this.conexiones
    };

    this.workflowService.sendAiCommand(userMsg, currentState).subscribe({
      next: (response) => {
        this.chatMessages.pop(); // quitar "Procesando..."
        
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
              const newNode = {
                id: 'n' + Date.now() + Math.floor(Math.random()*100),
                tipo: act.tipo || 'ACTIVIDAD',
                nombre: act.nombre || 'Nueva Etapa',
                departamentoId: act.departamentoId || '1',
                campos: []
              };
              this.nodes.push(newNode);
            } else if (act.action === 'ADD_CONNECTION') {
              const originNode = this.nodes.find(n => n.nombre.toLowerCase().includes(act.origenNombre?.toLowerCase()));
              const destNode = this.nodes.find(n => n.nombre.toLowerCase().includes(act.destinoNombre?.toLowerCase()));
              
              if (originNode && destNode) {
                this.conexiones.push({
                  id: 'c' + Date.now() + Math.floor(Math.random()*100),
                  origenId: originNode.id,
                  destinoId: destNode.id,
                  condicion: 'DEFAULT'
                });
              }
            } else if (act.action === 'ADD_FIELD') {
              const targetNode = this.nodes.find(n => n.nombre.toLowerCase().includes(act.nodeNombre?.toLowerCase()));
              if (targetNode) {
                if (!targetNode.campos) targetNode.campos = [];
                targetNode.campos.push({
                  nombre: 'campo_' + Date.now() + Math.floor(Math.random()*100),
                  etiqueta: act.etiqueta || 'Nuevo Campo',
                  tipo: act.tipo || 'TEXTO',
                  opciones: []
                });
              }
            }
          });
          this.scheduleRedraw();
          this.broadcastState();
        }
      },
      error: (err) => {
        this.chatMessages.pop();
        this.chatMessages.push({ role: 'bot', content: 'Hubo un error de conexión con el backend.' });
      }
    });
  }
}
