package com.swp1.backend.controller;

import com.swp1.backend.model.LogActividad;
import com.swp1.backend.model.Tramite;
import com.swp1.backend.repository.TramiteRepository;
import com.swp1.backend.service.WorkflowEngineService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

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
        return tramiteRepository.findAll();
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
            tramite.setPoliticaId(politicaId);
            tramite.setCliente(cliente);
            tramite.setEstado("EN_PROCESO");
            tramite.setFechaInicio(LocalDateTime.now());
            
            tramite = tramiteRepository.save(tramite);

            workflowEngineService.iniciarTramite(politicaId, tramite.getId());
            
            String nodoInicial = workflowEngineService.getNodoActual(tramite.getId());
            tramite.setNodoActualId(nodoInicial);
            return org.springframework.http.ResponseEntity.ok(tramiteRepository.save(tramite));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                .body(java.util.Map.of("error", "Error al iniciar trámite: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/completar")
    public org.springframework.http.ResponseEntity<?> completar(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        Map<String, Object> variables = null;
        try {
            Tramite tramite = tramiteRepository.findById(id).orElseThrow();
            
            Map<String, Object> extraData = (Map<String, Object>) payload.get("datos");
            variables = (Map<String, Object>) extraData.get("variables");
            String nodoId = (String) payload.get("nodoId");
            String nombreNodo = (String) extraData.get("nombreNodo");
            System.out.println("DEBUG VARIABLES RECIBIDAS: " + variables);
            workflowEngineService.completarTarea(id, variables);
        } catch (org.flowable.common.engine.api.FlowableException fe) {
            fe.printStackTrace();
            return org.springframework.http.ResponseEntity.status(400)
                .body(java.util.Map.of("error", "Error del motor de flujos: No se encontró un camino válido para la decisión '" + variables.get("outcome") + "'. Asegúrate de que las conexiones tengan exactamente ese texto en el lienzo o inicia un nuevo trámite."));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                .body(java.util.Map.of("error", "Error al completar tarea: " + e.getMessage()));
        }

        try {
            Tramite tramite = tramiteRepository.findById(id).orElseThrow();
            
            Map<String, Object> extraData = (Map<String, Object>) payload.get("datos");
            String nodoId = (String) payload.get("nodoId");
            String nombreNodo = (String) extraData.get("nombreNodo");
            String informeIA = (String) extraData.get("informeIA");
            List<Map<String, Object>> camposMap = (List<Map<String, Object>>) extraData.get("campos");
            
            LogActividad log = new LogActividad();
            log.setNodoId(nodoId);
            log.setNombreNodo(nombreNodo);
            log.setUsuario("Funcionario");
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
                for(Map<String, Object> cmap : camposMap) {
                    com.swp1.backend.model.CampoFormulario cf = new com.swp1.backend.model.CampoFormulario();
                    cf.setNombre((String) cmap.get("nombre"));
                    cf.setEtiqueta((String) cmap.get("etiqueta"));
                    cf.setTipo((String) cmap.get("tipo"));
                    Object valorObj = cmap.get("valor");
                    cf.setValor(valorObj != null ? String.valueOf(valorObj) : "");
                    campos.add(cf);
                }
            }
            log.setDatosFormulario(campos);

            if(tramite.getHistorial() == null) {
                tramite.setHistorial(new java.util.ArrayList<>());
            }
            tramite.getHistorial().add(log);

            String siguienteNodo = workflowEngineService.getNodoActual(id);
            tramite.setNodoActualId(siguienteNodo);
            
            if ("FIN".equals(siguienteNodo)) {
                tramite.setEstado("FINALIZADO");
            }

            return org.springframework.http.ResponseEntity.ok(tramiteRepository.save(tramite));
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(500)
                .body(java.util.Map.of("error", "Error al completar tarea: " + e.getMessage()));
        }
    }
}
