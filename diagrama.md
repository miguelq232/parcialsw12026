


cd backend
mvn spring-boot:run

cd frontend
ng serve

cd mobile
flutter devices
flutter run -d R9TN8090ABJ

cd ia-service
venv\Scripts\activate
python main.py

git add .
git commit -m "ia service fast api conectado a spring boot"
git push origin main




Es especialmente útil para visualizar procesos de negocio, flujos de trabajo (workflows) o la lógica de un algoritmo complejo.

Componentes Principales

Para construir uno, se utilizan varios elementos gráficos estandarizados:

- Nodo Inicial: Un círculo sólido (**) que indica dónde comienza el proceso.

- Actividad/Estado de Acción: Representado por un rectángulo con puntas redondeadas. Describe una acción específica que se realiza.

- Flujo de Control: Flechas que muestran el orden en que se ejecutan las actividades.

- Nodo de Decisión: Un diamante ($\diamond$). De él salen dos o más flechas con condiciones (guardas) entre corchetes, como [si] o [no].

- Barras de Sincronización (Fork & Join): Líneas gruesas horizontales o verticales.

   * Fork (Bifurcación): Una entrada y varias salidas (tareas en paralelo).

   * Join (Unión): Varias entradas y una salida (espera a que terminen las tareas paralelas).

- Nodo Final: Un círculo sólido dentro de otro círculo (similar a un ojo de buey) que marca el fin del flujo.



Premisa.-  usuario solicitan un tramite ( ejemplo: CRE, instalacion de medidor)
Se requiere un workclow para el seguimiento de tramites. Enrutacion de departamento seguna la politica de negocios.
 Se identifican:
 - cuellos de botella
 - tiempos de atencion
 - secuencia, alternativa, iterativo, paralelo

Lo desafiante es para quien o que va ser el sw
se debe tener un motor para el workflow 
diagram de actividades en calles
editor similar a architect 

carga de actividades, departamentos, politicas de negocio, facilidad de uso para seguimientos de actividades 


1ER PARCIAL - INGENIERIA DE SOFTWARE 1 

el ambito es en politica de negocio, donde un usuario pueda generara tramites, poder realizar o armar politicas de negocio entre el cliente y atencion al cliente, estariamos a la necesidad de un workflow, el encargado tendra un papel donde tenga tarea pendientes, procesadas.

el sistema deb soportar muchas politicas de negocios, puede ser secuencial, lineal o multilineal.
Ejemplo: 
  que 2 procesos den 1 proceso


cada nodo es un departamento o persona: el sistema debe soportar muchos negocios

flujo:
  - secuencial
  - alternativo
  - iterativo
  - paralelo

diseñar para que cada politica haga un flujo o una combinacion

entregar al usuario que puede diseñar politicas de negocio
  1. actividades
  2. los responsables de esas actividades
  3. flujo

Diseñador de politicas de negocio
  * carga departamentos de empresas
  * carga actividades 
  * hacer asociacion

el usuario debe ver ele monito: 
  hay estan las actividades que me competen 

  verde: atendido
  rojo: debo atender
  amarillo: estoy atendiendo

// SE VALORARA DEMACIADO LA FACILIDAD DE USO

Critico: el usuario no conoce el diagrama de actividad


Usuario2: administradores

Funcionalidades: 
  - crear politicas de negocio
  - diseñar 
  - guardar, dejar pendiente
  - el define el flujo a seguir 

ejemplo ("banco")

1. departamento de atencion al cliente, el decide cual es la politica de negocio adecuada para el cliente
2. almacenar o debemos registrar 
  - politica de negocio: si no no van saber cual es el proveso que deben seguir
  - trabajo que hace cada funcionario

# INNOVACION

1. 
 - edicion del diagrama natural o colaborativo
 - escribir pront a la ia en texto o audio
 ejemplo:
   * colocar una actividad dentro del departamente o conecta la linea A y b
   * concectar manual o pront (texto "pront" o audio) 
   * la ia no generar diagramas si no que diseña el diagrama con ia 

2. cuando la politica dice viene aca, despues alla y alla en el proceso cada uno teine que hacer su trabajo la herramienta debe construir un formulario para que sea llamado cargando como un informe de cada funcionario cuando realize su trabajo 

el funcionario deberia poder cargar la informacion a ese formulario ya sea un informe textual o lo que el hablo lo entiende y lo llena el formulario automaticamente o manualmente 
 - la herramienta debe ser un formulario al que un funcionario le puede
   cargar informacion

3. encontrar el cuello de botella mediante analisis
en la atencion al cliente en una determinada politica 

# extras
1. Admin pide análisis de una política
    ↓
FastAPI recibe los datos de tiempos
    ↓
LangChain analiza los patrones
    ↓
Devuelve recomendaciones en lenguaje natural:
"La actividad Aprobación tiene 3x más demora
que el promedio. Recomiendo dividir la carga
entre 2 funcionarios de Dirección."


# posibles preguntas de examen 
1. ¿Cómo funciona el sistema? → explicar arquitectura
2. ¿Qué innovaciones tiene? → editor, IA, voz, paralelo
3. ¿Cómo funciona el WorkflowEngine? → explicar motor
4. Demostrar algo en vivo → mostrar flujo completo
5. ¿Qué tecnologías usaron? → stack completo


PRE-REQUISITO
  └── Cargar departamentos y sus actividades

FLUJO ASISTIDO

Click en nodo de inicio
        ↓
¿Qué querés agregar?
  ○ Actividad
  ○ Decisión

        ↓ si elige Actividad
  ¿Nombre de la actividad?       
  ¿A qué departamento pertenece?
        ↓
  ¿Cómo continúa?
    ○ Directo
        → crea 1 actividad y la conecta

    ○ Paralelo
        → ¿cuántas ramas? 2 / 3 / 4
        → crea N actividades + Fork/Join automática
paso 2
    ○ Actividad + aprobación  
    paso 3 solo hay eso 
        → Si OK  → ¿a dónde va?
                     ○ Nueva actividad
                         → ¿Nombre? + ¿Departamento? 
                     ○ Actividad existente
                         → elige Actividad
                     ○ Fin

        → Si NO OK → ¿qué pasa?
                    ○ Vuelve a esta misma actividad    
                    ○ Vuelve a la actividad anterior   
                    ○ Va a otra actividad existente   
                           ↓ elige Actividad
                    ○ Nueva actividad
                        → ¿Nombre? + ¿Departamento? 
                    ○ Fin del trámite                 
                          → aplicar al diagrama






    ○ Ir a actividad existente
        → elegir de la lista

    ○ Fin del trámite

        ↓ si elige Decisión
  ¿Cuál es la pregunta?
  ¿Quién decide? [selector departamento]

  Rama Sí → ¿qué pasa?
    ○ Nueva actividad
        → ¿Nombre? + ¿Departamento?  
    ○ Actividad existente
    ○ Fin del trámite

  Rama No → ¿qué pasa?
    ○ Nueva actividad
        → ¿Nombre? + ¿Departamento?  
    ○ Actividad existente
         ○ Vuelve a esta misma actividad
         ○ Vuelve a la actividad anterior
         ○ Va a otra actividad existente
    ○ Fin del trámite

COMPORTAMIENTO POR DEFECTO DEL SISTEMA

1. Al crear una nueva política, el sistema genera
   automáticamente el nodo Inicio
   └── Se puede editar o mover
   └── Pero no se puede eliminar si es el único
   └── No se puede agregar un segundo Inicio
       └── El botón/opción de Inicio desaparece
           una vez que ya existe uno en el flujo

2. El nodo Inicio no tiene departamento asignado
   └── Representa el momento en que el cliente
       genera el trámite
   └── La primera actividad real es la que
       define el primer responsable

NODO FIN
1. No se genera automáticamente
   └── El admin lo agrega cuando un camino termina
   └── Puede haber múltiples nodos Fin en un flujo

2. Cada Fin puede tener una etiqueta
   └── Ej: "Aprobado", "Rechazado", "Derivado"
   └── Así en el monitor se sabe cómo terminó
       el trámite






Reglas:
  1. Todo flujo empieza con un único nodo Inicio
  2. Todo flujo debe tener al menos un nodo Fin
  3. Toda actividad debe tener nombre y departamento
  4. Una decisión siempre tiene exactamente 2 salidas (Sí/No)
  5. En paralelo todas las ramas deben sincronizarse en un Join
  6. Todo camino posible debe terminar en un Fin
  7. Una actividad pertenece a un solo departamento
  8. En un bloque paralelo si una rama falla
     todas las demás quedan suspendidas
     hasta que la rama fallida se resuelva
  9. Un departamento no puede eliminarse
         si tiene actividades asignadas
         en políticas activas
         └── Primero desactivar la política
             o reasignar las actividades


Prohibiciones estructurales:
1. No puede haber dos nodos de inicio
   └── El flujo siempre empieza en un solo punto

2. No puede haber un nodo sin salida (excepto Fin)
   └── Toda actividad debe conectar a algo

3. No puede haber un nodo sin entrada (excepto Inicio)
   └── Toda actividad debe venir de algún lado

4. Todo camino posible del flujo debe
   terminar en un nodo Fin
   └── Si hay una rama sin Fin → advertencia
   └── Si ningún camino tiene Fin → bloquea guardar

5. En paralelo todas las ramas deben llegar al Join
   └── No podés dejar una rama suelta sin sincronizar

Prohibiciones de negocio:
6. No puede haber dos actividades del mismo nombre
   └── Genera confusión en el historial y el monitor

7. Una actividad no puede apuntar a sí misma en Directo
   └── Eso solo es válido en Con validación (iterativo)

8. No puede haber ciclos infinitos sin salida
   └── Si A → B → A, debe existir una condición de salida

9. No puede conectar una actividad a una que ya pasó
   en el flujo principal (excepto en Con validación)
   └── Ej: Actividad 5 → apunta a Actividad 2
       Eso crea un ciclo que traba el motor
       Solo es válido si hay una condición de salida

10. En paralelo no puede haber una rama vacía
    └── Si elegís 3 ramas, las 3 deben tener
        al menos una actividad definida
        No podés dejar una rama sin nada

11. En paralelo todas las ramas deben
    terminar en el Join — ninguna puede
    saltarse la sincronización e ir directo a Fin

12. No puede haber una decisión sin actividad previa
    └── Una decisión necesita contexto
        No tiene sentido preguntar "¿Aprobado?"
        si nadie hizo nada antes

Advertencias (no bloquean pero avisan):
⚠ El mismo departamento tiene 3+ actividades seguidas
  → ¿Seguro que no se puede simplificar?

⚠ Una rama de decisión no tiene Fin definido
  → Puede quedar el trámite colgado

⚠ El flujo tiene más de 10 nodos
  → Considerá dividirlo en sub-políticas

⚠ Dos ramas de una decisión van al mismo destino
  └── Ej: Sí → Elabora contrato
           No → Elabora contrato

⚠ Si una rama del paralelo tiene Con validación
  → considerar qué pasa con las otras ramas
    si esa validación falla

⚠ Una actividad no tiene responsable asignado
  → El motor no sabrá a quién notificar
  → Puede quedar el trámite sin atención

⚠ El flujo tiene ramas de decisión muy largas
  → Si Sí tiene 5+ actividades y No tiene 1
    considerar si el diseño tiene sentido


⚠ Si ambas van al mismo lado la decisión
  no tiene sentido — podría ser un Directo











1. usuario_router.py – Gestión de Usuarios
POST /crear_usuario – Crear un usuario con contraseña hasheada y rol.
GET /listar_usuarios – Listar todos los usuarios.
GET /usuario/{id} – Obtener detalle de un usuario específico. ✅
PATCH /editar_usuario/{id} – Modificar datos del usuario.
DELETE /eliminar_usuario/{id} – Desactivar o eliminar usuario.


2. politica_negocio_router.py – Gestión de Políticas de Negocio
POST /crear_politica – Crear una política de negocio con nombre y descripción.
GET /listar_politicas – Listar todas las políticas de negocio.
GET /politica/{id} – Obtener detalle de una política específica.
POST /configurar_nodos – Guardar actividades y decisiones (cuadros y rombos) asociadas a la política.
POST /configurar_flujo – Definir los flujos (flechas que conectan los nodos).
PATCH /editar_politica/{id} – Modificar nombre o descripción de la política (opcional).
DELETE /eliminar_politica/{id} – Borrar o desactivar una política.


3. actividad_router.py – Gestión de Actividades
POST /crear_actividad – Crear una actividad vinculada a una política y un usuario.
GET /listar_actividades/{politica_id} – Listar todas las actividades de una política.
GET /actividad/{id} – Obtener detalle de una actividad específica.
PATCH /editar_actividad/{id} – Modificar nombre, descripción, orden o posición.
DELETE /eliminar_actividad/{id} – Borrar o desactivar una actividad.


4. decision_router.py – Gestión de Decisiones
POST /crear_decision – Crear una nueva decisión vinculada a una política. ✅
GET /listar_decisiones/{politica_id} – Listar decisiones por política.
GET /decision/{id} – Obtener detalle de una decisión específica. ✅
PATCH /editar_decision/{id} – Cambiar lógica o pregunta de decisión.
DELETE /eliminar_decision/{id} – Borrar una decisión.


5. tramite_router.py – Gestión del Expediente
POST /iniciar_tramite – Crear un nuevo trámite basado en una política (genera un ID único). 
GET /ver_estado_tramite/{id} – Ver en qué actividad se encuentra un trámite y quién lo tiene. 
GET /historial_tramite/{id} – Recupera todos los formularios y evidencias del trámite. 
GET /listar_tramites_pendientes/{usuario_id} – Muestra los trámites pendientes de un funcionario. 


6. formulario_router.py – La ejecución del Funcionario
POST /llenar_formulario – Crear un formulario nuevo con texto, tiempo tardado y estado. 
POST /subir_evidencia – Subir evidencia (foto, PDF, escaneo) vinculada a un formulario. 
PATCH /observar_formulario/{id} – Cambiar el estado del formulario a “OBSERVADO” si hay error. 
GET /ver_formulario/{id} – Obtener el detalle completo de un formulario específico. 
GET /listar_formularios/{usuario_id} – (opcional) Listar todos los formularios de un funcionario.
PATCH /editar_formulario/{id} – (opcional) Modificar campos de un formulario existente.
DELETE /eliminar_formulario/{id} – (opcional) Borrar o desactivar un formulario.


7. evidencia_router.py – Gestión de Evidencias
POST /subir_evidencia – Subir un archivo o contenido de evidencia vinculado a un formulario.
GET /listar_evidencias/{formulario_id} – Listar todas las evidencias de un formulario.
GET /evidencia/{id} – Ver detalle de una evidencia específica.
DELETE /eliminar_evidencia/{id} – Eliminar evidencia si es incorrecta o no necesaria.


8. flujo_router.py – Gestión de Flujos
POST /crear_flujo – Crear un nuevo flujo (con nodo origen, nodo destino, condición, tipo y orden). 
GET /listar_flujos/{politica_id} – Listar todos los flujos de una política.
GET /flujo/{id} – Obtener detalle de un flujo específico. 
PATCH /editar_flujo/{id} – Modificar condiciones o conexiones del flujo.
DELETE /eliminar_flujo/{id} – Borrar un flujo específico.





1. tareas secuenciales
2. tareas paralelas
3. tareas de acoplamiento o bluque
4. tareas condiciones "ramificadas"



