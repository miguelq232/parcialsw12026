# Bitácora de Avances - SWP1 (Metodología PUDS)

Este documento registra el progreso del desarrollo del Sistema de Gestión de Workflow (SWP1) siguiendo las fases del **Proceso Unificado de Desarrollo de Software (PUDS)**.

---

## 🚀 Estado Actual del Sistema
- **Infraestructura**: Dockerizada y orquestada.
- **Base de Datos**: MongoDB (Persistencia de Negocio) + H2 (Motor Interno).
- **Backend**: Spring Boot 3.2 + Flowable Engine.
- **Frontend**: Angular 17.
- **IA Service**: FastAPI (Skeleton funcional).

---

## 🛠 Stack Tecnológico (Línea Base)
- **Core**: Spring Boot, Flowable, MongoDB, FastAPI, Angular.
- **Documentación**: Swagger/OpenAPI, Mermaid.js.
- **Infraestructura**: Docker, Docker Compose.

---

## 🔄 Ciclos de Desarrollo (Fases PUDS)

### 1. Fase de Inicio (Inception)
*Enfoque: Alcance, viabilidad y definición técnica.*

#### Ciclo 1: Definición de Base y Requerimientos [FINALIZADO]
- **Requerimientos**:
    - [x] Identificación de componentes core: Backend, Frontend, IA-Service.
    - [x] Selección de stack open-source (Flowable para BPMN, FastAPI para IA).
- **Análisis y Diseño**:
    - [x] Definición de la arquitectura de microservicios.
    - [x] Diseño del esquema de contenedores.

---

### 2. Fase de Elaboración (Elaboration)
*Enfoque: Arquitectura base, mitigación de riesgos y preparación del entorno.*

#### Ciclo 2: Infraestructura y Línea Base Arquitectónica [FINALIZADO]
- **Implementación**:
    - [x] Estructura de carpetas del proyecto.
    - [x] Configuración de `docker-compose.yml`.
    - [x] Dockerización individual de servicios (`backend`, `frontend`, `ia-service`).
- **Pruebas**:
    - [x] Verificación de conectividad entre servicios en entorno aislado.
    - [x] Validación de despliegue inicial.

---

### 3. Fase de Construcción (Construction)
*Enfoque: Implementación iterativa de funcionalidades y lógica de negocio.*

#### Ciclo 3: Modelo de Negocio y Lógica de Workflow [EN PROGRESO]
- **Requerimientos**:
    - [ ] Definir modelo de datos para **Políticas de Negocio** en MongoDB.
- **Análisis y Diseño**:
    - [ ] Diseñar el primer flujo de proceso BPMN.
    - [ ] Definir interfaz del **Diseñador Visual** en Angular.
- **Implementación**:
    - [ ] Implementar motor Flowable en el backend.
    - [ ] Conectar **IA-Service** con LangChain para análisis de diagramas.
- **Pruebas**:
    - [ ] Pruebas unitarias de la lógica de flujo.

#### Ciclo 3.5: Autenticación y Roles (Hardcoded para Examen) [FINALIZADO]
- **Implementación**:
    - [x] Implementación de `AuthService` para manejo de estados de usuario.
    - [x] Creación de página de **Login** premium con acceso rápido para Admin y Funcionario.
    - [x] Adaptación del **Sidebar** para navegación condicional.
    - [x] Implementación de flujo de cierre de sesión.
- **Análisis**:
    - [x] Definición de accesos: Admin (Diseñador) vs Funcionario (Monitor).

---

### 4. Fase de Transición (Transition)
*Enfoque: Despliegue, capacitación y entrega final.*

#### Ciclo 4: Despliegue y Beta [PENDIENTE]
- **Implementación**:
    - [ ] Configuración de entorno de staging/producción.
- **Pruebas**:
    - [ ] Pruebas de usuario (UAT).
- **Documentación**:
    - [ ] Generación de sitio con MkDocs.

---

## 🎯 Próximos Pasos Inmediatos
1. Modelado de datos en MongoDB.
2. Implementación de Flowable.
3. Desarrollo del esqueleto del Frontend.

