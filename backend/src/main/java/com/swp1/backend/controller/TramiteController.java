package com.swp1.backend.controller;

import com.swp1.backend.model.CambioTramite;
import com.swp1.backend.model.LogActividad;
import com.swp1.backend.model.CampoFormulario;
import com.swp1.backend.model.Conexion;
import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.model.Tramite;
import com.swp1.backend.repository.TramiteRepository;
import com.swp1.backend.service.WorkflowEngineService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Objects;

@RestController
@RequestMapping("/api/tramites")
@CrossOrigin(origins = "*")
public class TramiteController {

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private com.swp1.backend.repository.PoliticaRepository politicaRepository;

    @Autowired
    private WorkflowEngineService workflowEngineService;

    @GetMapping
    public List<Tramite> getAll() {
        List<Tramite> tramites = tramiteRepository.findAll();
        for (Tramite tramite : tramites) {
            if (isBlank(tramite.getNumeroTramite())) {
                tramite.setNumeroTramite(generateTramiteNumber());
                tramiteRepository.save(tramite);
            }
            PoliticaDeNegocio politica = politicaRepository.findById(tramite.getPoliticaId()).orElse(null);
            if (repairStateFromHistory(tramite, politica)) {
                tramiteRepository.save(tramite);
            }
        }
        return tramites;
    }

    @PostMapping("/iniciar")
    public org.springframework.http.ResponseEntity<?> iniciar(@RequestBody Map<String, String> payload) {
        try {
            String politicaId = payload.get("politicaId");
            String cliente = payload.get("cliente");

            com.swp1.backend.model.PoliticaDeNegocio politica = politicaRepository.findById(politicaId).orElse(null);
            if (politica != null) {
                workflowEngineService.deployPolitica(politica);
            }

            Tramite tramite = new Tramite();
            tramite.setNumeroTramite(generateTramiteNumber());
            tramite.setPoliticaId(politicaId);
            tramite.setCliente(cliente);
            tramite.setEstado("EN_PROCESO");
            LocalDateTime fechaInicio = LocalDateTime.now();
            tramite.setFechaInicio(fechaInicio);
            tramite.setHistorial(new java.util.ArrayList<>());
            Nodo inicio = findStartNode(politica);
            if (inicio != null) {
                tramite.getHistorial().add(buildAutomaticLog(
                        inicio,
                        "Sistema",
                        fechaInicio,
                        "Tramite iniciado.",
                        List.of(),
                        0L
                ));
            }
            
            tramite = tramiteRepository.save(tramite);

            workflowEngineService.iniciarTramite(politicaId, tramite.getId());
            
            String nodoInicial = workflowEngineService.getNodoActual(tramite.getId());
            tramite.setNodoActualId(nodoInicial);
            return org.springframework.http.ResponseEntity.ok(tramiteRepository.save(tramite));
        } catch (IllegalStateException ise) {
            return org.springframework.http.ResponseEntity.status(400)
                    .body(java.util.Map.of("error", ise.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                .body(java.util.Map.of("error", "Error al iniciar trámite: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/completar")
    public org.springframework.http.ResponseEntity<?> completar(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        Map<String, Object> variables = new HashMap<>();
        String nodoId = null;
        try {
            Tramite tramite = tramiteRepository.findById(id).orElseThrow();
            PoliticaDeNegocio politica = politicaRepository.findById(tramite.getPoliticaId()).orElse(null);
            if (repairStateFromHistory(tramite, politica)) {
                tramite = tramiteRepository.save(tramite);
            }

            if ("FINALIZADO".equals(tramite.getEstado())) {
                return org.springframework.http.ResponseEntity.status(400)
                        .body(java.util.Map.of("error", "Este tramite ya esta finalizado y no tiene una tarea activa."));
            }
            
            Map<String, Object> extraData = (Map<String, Object>) payload.get("datos");
            variables = (Map<String, Object>) extraData.get("variables");
            if (variables == null) {
                variables = new HashMap<>();
            }
            nodoId = (String) payload.get("nodoId");
            String nombreNodo = (String) extraData.get("nombreNodo");
            System.out.println("DEBUG VARIABLES RECIBIDAS: " + variables);
            String nodoActivo = workflowEngineService.getNodoActivo(id);
            if (nodoActivo == null && politica != null) {
                workflowEngineService.sincronizarConHistorial(politica, tramite);
                nodoActivo = workflowEngineService.getNodoActivo(id);
            }

            if (nodoActivo == null) {
                return org.springframework.http.ResponseEntity.status(400)
                        .body(java.util.Map.of("error", "No hay una tarea activa para este tramite. Vuelve a abrir el seguimiento para refrescar el estado."));
            }

            if (nodoId != null && !nodoId.equals(nodoActivo)) {
                return org.springframework.http.ResponseEntity.status(400)
                        .body(java.util.Map.of("error", "El tramite esta actualmente en '" + nodoActivo + "', no en '" + nodoId + "'. Refresca la pantalla antes de completar."));
            }

            workflowEngineService.completarTarea(id, nodoId, variables);
        } catch (org.flowable.common.engine.api.FlowableException fe) {
            fe.printStackTrace();
            return org.springframework.http.ResponseEntity.status(400)
                .body(java.util.Map.of("error", "Error del motor de flujos: No se encontró un camino válido para la decisión '" + variables.get("outcome") + "'. Asegúrate de que las conexiones tengan exactamente ese texto en el lienzo o inicia un nuevo trámite."));
        } catch (IllegalStateException ise) {
            return org.springframework.http.ResponseEntity.status(400)
                    .body(java.util.Map.of("error", ise.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                .body(java.util.Map.of("error", "Error al completar tarea: " + e.getMessage()));
        }

        try {
            Tramite tramite = tramiteRepository.findById(id).orElseThrow();
            
            Map<String, Object> extraData = (Map<String, Object>) payload.get("datos");
            nodoId = (String) payload.get("nodoId");
            String nombreNodo = (String) extraData.get("nombreNodo");
            String informeIA = (String) extraData.get("informeIA");
            String usuario = (String) extraData.getOrDefault("usuario", "Funcionario");
            List<Map<String, Object>> camposMap = (List<Map<String, Object>>) extraData.get("campos");
            
            LogActividad log = new LogActividad();
            log.setNodoId(nodoId);
            log.setNombreNodo(nombreNodo);
            log.setUsuario(usuario);
            LocalDateTime now = LocalDateTime.now();
            log.setFechaCompletado(now);
            log.setInformeIA(informeIA);

            long duracion = 0;
            if (tramite.getHistorial() == null || tramite.getHistorial().isEmpty()) {
                duracion = java.time.Duration.between(tramite.getFechaInicio(), now).toSeconds();
            } else {
                LogActividad anterior = tramite.getHistorial().get(tramite.getHistorial().size() - 1);
                duracion = java.time.Duration.between(anterior.getFechaCompletado(), now).toSeconds();
            }
            log.setDuracionSegundos(duracion);

            List<com.swp1.backend.model.CampoFormulario> campos = new java.util.ArrayList<>();
            if(camposMap != null) {
                campos = buildCamposFromMaps(camposMap);
            }
            log.setDatosFormulario(campos);

            if(tramite.getHistorial() == null) {
                tramite.setHistorial(new java.util.ArrayList<>());
            }
            tramite.getHistorial().add(log);

            PoliticaDeNegocio politica = politicaRepository.findById(tramite.getPoliticaId()).orElse(null);
            appendAutomaticMovementLogs(tramite, politica, nodoId, variables, usuario, now);

            String siguienteNodo = workflowEngineService.getNodoActual(id);
            tramite.setNodoActualId(siguienteNodo);
            
            if ("FIN".equals(siguienteNodo)) {
                tramite.setEstado("FINALIZADO");
            } else {
                tramite.setEstado("EN_PROCESO");
            }

            return org.springframework.http.ResponseEntity.ok(tramiteRepository.save(tramite));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                .body(java.util.Map.of("error", "Error al completar tarea: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/historial/{index}")
    public org.springframework.http.ResponseEntity<?> editarHistorial(
            @PathVariable String id,
            @PathVariable int index,
            @RequestBody Map<String, Object> payload
    ) {
        try {
            Tramite tramite = tramiteRepository.findById(id).orElseThrow();
            if (tramite.getHistorial() == null || index < 0 || index >= tramite.getHistorial().size()) {
                return org.springframework.http.ResponseEntity.status(404)
                        .body(java.util.Map.of("error", "Registro de historial no encontrado."));
            }

            LogActividad log = tramite.getHistorial().get(index);
            PoliticaDeNegocio politica = politicaRepository.findById(tramite.getPoliticaId()).orElse(null);
            if (!canEditLog(politica, log, payload)) {
                return org.springframework.http.ResponseEntity.status(403)
                        .body(java.util.Map.of("error", "No puedes editar este registro. Solo el funcionario responsable, el funcionario que lo registro o un administrador pueden modificarlo."));
            }

            String usuario = stringValue(payload.getOrDefault("usuario", "Funcionario"));
            List<Map<String, Object>> camposMap = (List<Map<String, Object>>) payload.get("campos");
            List<CampoFormulario> nuevosCampos = camposMap != null
                    ? buildCamposFromMaps(camposMap)
                    : new java.util.ArrayList<>(log.getDatosFormulario() != null ? log.getDatosFormulario() : List.of());
            String nuevoInforme = stringValue(payload.get("informeIA"));

            List<CambioTramite> cambios = buildCambios(log, nuevosCampos, nuevoInforme, usuario);
            if (cambios.isEmpty()) {
                return org.springframework.http.ResponseEntity.ok(tramite);
            }

            log.setDatosFormulario(nuevosCampos);
            log.setInformeIA(nuevoInforme);

            if (tramite.getHistorialCambios() == null) {
                tramite.setHistorialCambios(new java.util.ArrayList<>());
            }
            tramite.getHistorialCambios().addAll(cambios);

            return org.springframework.http.ResponseEntity.ok(tramiteRepository.save(tramite));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                    .body(java.util.Map.of("error", "Error al editar historial: " + e.getMessage()));
        }
    }

    private List<CampoFormulario> buildCamposFromMaps(List<Map<String, Object>> camposMap) {
        List<CampoFormulario> campos = new java.util.ArrayList<>();
        for (Map<String, Object> cmap : camposMap) {
            CampoFormulario cf = new CampoFormulario();
            cf.setNombre(stringValue(cmap.get("nombre")));
            cf.setEtiqueta(stringValue(cmap.get("etiqueta")));
            cf.setTipo(stringValue(cmap.get("tipo")));
            Object valorObj = cmap.get("valor");
            cf.setValor(valorObj != null ? String.valueOf(valorObj) : "");
            cf.setArchivoNombre(stringValue(cmap.get("archivoNombre")));
            cf.setArchivoTipo(stringValue(cmap.get("archivoTipo")));
            cf.setArchivoUrl(stringValue(cmap.get("archivoUrl")));
            Object opcionesObj = cmap.get("opciones");
            if (opcionesObj instanceof List<?> opciones) {
                cf.setOpciones(opciones.stream().map(String::valueOf).toList());
            }
            campos.add(cf);
        }
        return campos;
    }

    private List<CambioTramite> buildCambios(
            LogActividad log,
            List<CampoFormulario> nuevosCampos,
            String nuevoInforme,
            String usuario
    ) {
        List<CambioTramite> cambios = new java.util.ArrayList<>();
        List<CampoFormulario> anteriores = log.getDatosFormulario() != null ? log.getDatosFormulario() : List.of();
        Map<String, CampoFormulario> anterioresPorClave = new LinkedHashMap<>();
        Map<String, CampoFormulario> nuevosPorClave = new LinkedHashMap<>();

        for (int i = 0; i < anteriores.size(); i++) {
            anterioresPorClave.put(fieldKey(anteriores.get(i), i), anteriores.get(i));
        }
        for (int i = 0; i < nuevosCampos.size(); i++) {
            nuevosPorClave.put(fieldKey(nuevosCampos.get(i), i), nuevosCampos.get(i));
        }

        java.util.LinkedHashSet<String> keys = new java.util.LinkedHashSet<>();
        keys.addAll(anterioresPorClave.keySet());
        keys.addAll(nuevosPorClave.keySet());

        for (String key : keys) {
            CampoFormulario anterior = anterioresPorClave.get(key);
            CampoFormulario nuevo = nuevosPorClave.get(key);
            if (!fieldChanged(anterior, nuevo)) {
                continue;
            }
            CampoFormulario ref = nuevo != null ? nuevo : anterior;
            CambioTramite cambio = baseCambio(log, usuario);
            cambio.setCampoNombre(ref != null ? ref.getNombre() : key);
            cambio.setEtiqueta(ref != null ? ref.getEtiqueta() : key);
            cambio.setTipo(ref != null ? ref.getTipo() : null);
            cambio.setValorAnterior(anterior != null ? anterior.getValor() : null);
            cambio.setValorNuevo(nuevo != null ? nuevo.getValor() : null);
            cambio.setArchivoNombreAnterior(anterior != null ? anterior.getArchivoNombre() : null);
            cambio.setArchivoNombreNuevo(nuevo != null ? nuevo.getArchivoNombre() : null);
            cambio.setArchivoUrlAnterior(anterior != null ? anterior.getArchivoUrl() : null);
            cambio.setArchivoUrlNuevo(nuevo != null ? nuevo.getArchivoUrl() : null);
            cambios.add(cambio);
        }

        if (!Objects.equals(emptyToNull(log.getInformeIA()), emptyToNull(nuevoInforme))) {
            CambioTramite cambio = baseCambio(log, usuario);
            cambio.setCampoNombre("informeIA");
            cambio.setEtiqueta("Informe/Observaciones");
            cambio.setTipo("AREA_TEXTO");
            cambio.setValorAnterior(log.getInformeIA());
            cambio.setValorNuevo(nuevoInforme);
            cambios.add(cambio);
        }

        return cambios;
    }

    private CambioTramite baseCambio(LogActividad log, String usuario) {
        CambioTramite cambio = new CambioTramite();
        cambio.setFechaCambio(LocalDateTime.now());
        cambio.setUsuario(usuario);
        cambio.setNodoId(log.getNodoId());
        cambio.setNombreNodo(log.getNombreNodo());
        return cambio;
    }

    private boolean fieldChanged(CampoFormulario anterior, CampoFormulario nuevo) {
        if (anterior == null || nuevo == null) {
            return anterior != nuevo;
        }

        return !Objects.equals(emptyToNull(anterior.getValor()), emptyToNull(nuevo.getValor()))
                || !Objects.equals(emptyToNull(anterior.getArchivoNombre()), emptyToNull(nuevo.getArchivoNombre()))
                || !Objects.equals(emptyToNull(anterior.getArchivoTipo()), emptyToNull(nuevo.getArchivoTipo()))
                || !Objects.equals(emptyToNull(anterior.getArchivoUrl()), emptyToNull(nuevo.getArchivoUrl()));
    }

    private String fieldKey(CampoFormulario campo, int index) {
        if (campo == null) {
            return "idx-" + index;
        }
        if (!isBlank(campo.getNombre())) {
            return "nombre:" + campo.getNombre();
        }
        if (!isBlank(campo.getEtiqueta())) {
            return "etiqueta:" + campo.getEtiqueta();
        }
        return "idx-" + index;
    }

    private boolean canEditLog(PoliticaDeNegocio politica, LogActividad log, Map<String, Object> payload) {
        String rol = stringValue(payload.get("rol"));
        if ("ADMIN".equalsIgnoreCase(rol)) {
            return true;
        }

        if (log == null || isBlank(log.getNodoId()) || "Sistema".equalsIgnoreCase(log.getUsuario())) {
            return false;
        }

        String usuario = normalize(stringValue(payload.get("usuario")));
        if (!isBlank(usuario) && usuario.equals(normalize(log.getUsuario()))) {
            return true;
        }

        Nodo node = politica != null && politica.getNodos() != null ? findNode(politica, log.getNodoId()) : null;
        if (!isActivityNode(node)) {
            return false;
        }

        String departamentoId = stringValue(payload.get("departamentoId"));
        if (!isBlank(departamentoId) && departamentoId.equals(node.getDepartamentoId())) {
            return true;
        }

        return getAssigneesForNode(politica, node).stream()
                .map(this::normalize)
                .anyMatch(assignee -> assignee.equals(usuario));
    }

    private List<String> getAssigneesForNode(PoliticaDeNegocio politica, Nodo node) {
        if (node == null) {
            return List.of();
        }
        if (node.getFuncionariosAsignados() != null && !node.getFuncionariosAsignados().isEmpty()) {
            return node.getFuncionariosAsignados();
        }
        if (politica == null || politica.getDepartamentos() == null) {
            return List.of();
        }
        return politica.getDepartamentos().stream()
                .filter(departamento -> Objects.equals(node.getDepartamentoId(), stringValue(departamento.get("id"))))
                .findFirst()
                .map(departamento -> {
                    Object asignados = departamento.get("funcionariosAsignados");
                    if (asignados instanceof List<?> list) {
                        return list.stream().map(String::valueOf).toList();
                    }
                    return List.<String>of();
                })
                .orElse(List.of());
    }

    private String normalize(String value) {
        String normalized = Normalizer.normalize(String.valueOf(value == null ? "" : value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.toLowerCase(Locale.ROOT).trim();
    }

    private String stringValue(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private void appendAutomaticMovementLogs(
            Tramite tramite,
            PoliticaDeNegocio politica,
            String completedNodeId,
            Map<String, Object> variables,
            String usuario,
            LocalDateTime fechaBase
    ) {
        if (politica == null || politica.getNodos() == null || politica.getConexiones() == null) {
            return;
        }

        Nodo nextNode = findNextNodeAfterCompletion(politica, completedNodeId, variables, usuario, fechaBase, tramite);
        if (isEndNode(nextNode)) {
            appendLogIfMissing(tramite, buildAutomaticLog(
                    nextNode,
                    usuario,
                    fechaBase.plusSeconds(2),
                    "Tramite finalizado.",
                    List.of(),
                    0L
            ));
        }
    }

    private Nodo findNextNodeAfterCompletion(
            PoliticaDeNegocio politica,
            String completedNodeId,
            Map<String, Object> variables,
            String usuario,
            LocalDateTime fechaBase,
            Tramite tramite
    ) {
        Conexion firstConnection = findFirstConnectionFrom(politica, completedNodeId);
        if (firstConnection == null) {
            return null;
        }

        Nodo firstTarget = findNode(politica, firstConnection.getDestinoId());
        if (firstTarget != null && firstTarget.getTipo() == Nodo.TipoNodo.DECISION) {
            String outcome = variables != null && variables.get("outcome") != null
                    ? variables.get("outcome").toString()
                    : "";

            appendLogIfMissing(tramite, buildAutomaticLog(
                    firstTarget,
                    usuario,
                    fechaBase.plusSeconds(1),
                    outcome.isBlank() ? "Decision evaluada." : "Ruta seleccionada: " + outcome,
                    outcome.isBlank() ? List.of() : List.of(fieldValue("outcome", "Resultado", "SELECCION", outcome)),
                    0L
            ));

            Conexion selected = findDecisionConnection(politica, firstTarget.getId(), outcome);
            return selected != null ? findNode(politica, selected.getDestinoId()) : null;
        }

        return firstTarget;
    }

    private Conexion findFirstConnectionFrom(PoliticaDeNegocio politica, String nodeId) {
        return politica.getConexiones().stream()
                .filter(connection -> nodeId != null && nodeId.equals(connection.getOrigenId()))
                .findFirst()
                .orElse(null);
    }

    private Conexion findDecisionConnection(PoliticaDeNegocio politica, String decisionNodeId, String outcome) {
        return politica.getConexiones().stream()
                .filter(connection -> decisionNodeId.equals(connection.getOrigenId()))
                .filter(connection -> {
                    String condicion = connection.getCondicion();
                    if (outcome != null && !outcome.isBlank()) {
                        return outcome.equals(condicion);
                    }
                    return condicion == null || condicion.isBlank() || "DEFAULT".equals(condicion);
                })
                .findFirst()
                .orElse(null);
    }

    private Nodo findNode(PoliticaDeNegocio politica, String nodeId) {
        return politica.getNodos().stream()
                .filter(node -> nodeId != null && nodeId.equals(node.getId()))
                .findFirst()
                .orElse(null);
    }

    private Nodo findStartNode(PoliticaDeNegocio politica) {
        if (politica == null || politica.getNodos() == null) {
            return null;
        }

        return politica.getNodos().stream()
                .filter(node -> node.getTipo() == Nodo.TipoNodo.INICIO || node.getTipo() == Nodo.TipoNodo.START)
                .findFirst()
                .orElse(null);
    }

    private boolean isEndNode(Nodo node) {
        return node != null && (node.getTipo() == Nodo.TipoNodo.FIN || node.getTipo() == Nodo.TipoNodo.END);
    }

    private LogActividad buildAutomaticLog(
            Nodo node,
            String usuario,
            LocalDateTime fechaCompletado,
            String informe,
            List<CampoFormulario> campos,
            Long duracionSegundos
    ) {
        LogActividad log = new LogActividad();
        log.setNodoId(node.getId());
        log.setNombreNodo(node.getNombre());
        log.setUsuario(usuario);
        log.setFechaCompletado(fechaCompletado);
        log.setInformeIA(informe);
        log.setDatosFormulario(campos);
        log.setDuracionSegundos(duracionSegundos);
        return log;
    }

    private void appendLogIfMissing(Tramite tramite, LogActividad log) {
        boolean exists = tramite.getHistorial().stream()
                .anyMatch(item -> log.getNodoId() != null && log.getNodoId().equals(item.getNodoId()));
        if (!exists) {
            tramite.getHistorial().add(log);
        }
    }

    private CampoFormulario fieldValue(String nombre, String etiqueta, String tipo, String valor) {
        CampoFormulario field = new CampoFormulario();
        field.setNombre(nombre);
        field.setEtiqueta(etiqueta);
        field.setTipo(tipo);
        field.setValor(valor);
        return field;
    }

    private boolean repairStateFromHistory(Tramite tramite, PoliticaDeNegocio politica) {
        Nodo expectedNode = resolveCurrentNodeFromHistory(tramite, politica);
        if (expectedNode == null) {
            return false;
        }

        String expectedNodeId = isEndNode(expectedNode) ? "FIN" : expectedNode.getId();
        String expectedEstado = isEndNode(expectedNode) ? "FINALIZADO" : "EN_PROCESO";

        boolean changed = !Objects.equals(tramite.getNodoActualId(), expectedNodeId)
                || !Objects.equals(tramite.getEstado(), expectedEstado);

        if (changed) {
            tramite.setNodoActualId(expectedNodeId);
            tramite.setEstado(expectedEstado);
        }

        return changed;
    }

    private Nodo resolveCurrentNodeFromHistory(Tramite tramite, PoliticaDeNegocio politica) {
        if (tramite == null || politica == null || politica.getNodos() == null || politica.getConexiones() == null) {
            return null;
        }

        List<LogActividad> historial = tramite.getHistorial() != null
                ? new java.util.ArrayList<>(tramite.getHistorial())
                : new java.util.ArrayList<>();

        historial.sort(java.util.Comparator.comparing(
                LogActividad::getFechaCompletado,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())
        ));

        LogActividad lastActivityLog = null;
        int lastActivityIndex = -1;
        for (int i = 0; i < historial.size(); i++) {
            LogActividad log = historial.get(i);
            Nodo node = findNode(politica, log.getNodoId());
            if (node != null && isActivityNode(node)) {
                lastActivityLog = log;
                lastActivityIndex = i;
            }
        }

        if (lastActivityLog == null) {
            Nodo start = findStartNode(politica);
            return start != null ? resolveNextNodeAfterCompletion(politica, start.getId(), Map.of()) : null;
        }

        Map<String, Object> variables = variablesFromLog(lastActivityLog);
        String decisionOutcome = findDecisionOutcome(historial, lastActivityIndex);
        if (decisionOutcome != null && !decisionOutcome.isBlank()) {
            variables.put("outcome", decisionOutcome);
        }

        return resolveNextNodeAfterCompletion(politica, lastActivityLog.getNodoId(), variables);
    }

    private Nodo resolveNextNodeAfterCompletion(
            PoliticaDeNegocio politica,
            String completedNodeId,
            Map<String, Object> variables
    ) {
        Conexion firstConnection = findFirstConnectionFrom(politica, completedNodeId);
        if (firstConnection == null) {
            return null;
        }

        Nodo firstTarget = findNode(politica, firstConnection.getDestinoId());
        if (firstTarget != null && firstTarget.getTipo() == Nodo.TipoNodo.DECISION) {
            String outcome = variables != null && variables.get("outcome") != null
                    ? variables.get("outcome").toString()
                    : "";
            Conexion selected = findDecisionConnection(politica, firstTarget.getId(), outcome);
            return selected != null ? findNode(politica, selected.getDestinoId()) : firstTarget;
        }

        return firstTarget;
    }

    private boolean isActivityNode(Nodo node) {
        return node != null && (node.getTipo() == Nodo.TipoNodo.ACTIVIDAD || node.getTipo() == Nodo.TipoNodo.ACTIVITY);
    }

    private Map<String, Object> variablesFromLog(LogActividad log) {
        Map<String, Object> variables = new HashMap<>();
        if (log == null || log.getDatosFormulario() == null) {
            return variables;
        }

        for (CampoFormulario campo : log.getDatosFormulario()) {
            if (campo == null || campo.getNombre() == null || campo.getNombre().isBlank()) {
                continue;
            }

            String value = campo.getValor() != null ? campo.getValor() : "";
            variables.put(campo.getNombre(), value);
            if ("outcome".equalsIgnoreCase(campo.getNombre()) || "resultado".equalsIgnoreCase(campo.getNombre())) {
                variables.put("outcome", value);
            }
        }

        return variables;
    }

    private String findDecisionOutcome(List<LogActividad> historial, int currentIndex) {
        for (int i = currentIndex + 1; i < historial.size(); i++) {
            LogActividad log = historial.get(i);
            if (log.getDatosFormulario() == null) {
                continue;
            }

            for (CampoFormulario campo : log.getDatosFormulario()) {
                if (campo == null || campo.getValor() == null) {
                    continue;
                }
                if ("outcome".equalsIgnoreCase(campo.getNombre()) || "Resultado".equalsIgnoreCase(campo.getEtiqueta())) {
                    return campo.getValor();
                }
            }
        }

        return null;
    }

    private String generateTramiteNumber() {
        int year = LocalDateTime.now().getYear();
        long sequence = tramiteRepository.count() + 1;
        String candidate;
        do {
            candidate = String.format("TR-%d-%06d", year, sequence++);
        } while (tramiteRepository.existsByNumeroTramite(candidate));
        return candidate;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
