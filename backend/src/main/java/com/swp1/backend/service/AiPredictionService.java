package com.swp1.backend.service;

import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.model.Tramite;
import com.swp1.backend.repository.PoliticaRepository;
import com.swp1.backend.repository.TramiteRepository;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

@Service
public class AiPredictionService {

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private PoliticaRepository politicaRepository;

    @Value("${ai.prediction.url:http://localhost:8001/predict}")
    private String predictionUrl;

    private final RestTemplate restTemplate;

    public AiPredictionService(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplate = restTemplateBuilder.build();
    }

    public Map<String, Object> predictTramite(String tramiteId) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new NoSuchElementException("Tramite no encontrado"));

        PoliticaDeNegocio politica = politicaRepository.findById(tramite.getPoliticaId()).orElse(null);
        Nodo currentNode = findNode(politica, tramite.getNodoActualId()).orElse(null);

        Map<String, Object> context = new HashMap<>();
        context.put("tramite", tramite);
        context.put("politica", politica != null ? politica : Map.of());
        context.put("currentNode", currentNode);
        context.put("currentAssignees", getAssigneesForNode(currentNode, politica));
        context.put("workloadByFuncionario", buildWorkloadByFuncionario());

        try {
            Map<String, Object> response = restTemplate.postForObject(predictionUrl, context, Map.class);
            if (response != null) {
                return response;
            }
        } catch (RestClientException ex) {
            return fallbackPrediction(tramite, politica, currentNode, ex.getMessage());
        }

        return fallbackPrediction(tramite, politica, currentNode, "El servicio Python no devolvio respuesta.");
    }

    private Map<String, Integer> buildWorkloadByFuncionario() {
        Map<String, Integer> workload = new HashMap<>();
        List<Tramite> activeTramites = tramiteRepository.findAll().stream()
                .filter(item -> !"FINALIZADO".equalsIgnoreCase(String.valueOf(item.getEstado())))
                .toList();

        for (Tramite active : activeTramites) {
            PoliticaDeNegocio politica = politicaRepository.findById(active.getPoliticaId()).orElse(null);
            Nodo node = findNode(politica, active.getNodoActualId()).orElse(null);
            for (String assignee : getAssigneesForNode(node, politica)) {
                workload.put(assignee, workload.getOrDefault(assignee, 0) + 1);
            }
        }

        return workload;
    }

    private Optional<Nodo> findNode(PoliticaDeNegocio politica, String nodeId) {
        if (politica == null || politica.getNodos() == null || nodeId == null) {
            return Optional.empty();
        }
        return politica.getNodos().stream()
                .filter(node -> nodeId.equals(node.getId()))
                .findFirst();
    }

    private List<String> getAssigneesForNode(Nodo node, PoliticaDeNegocio politica) {
        if (node == null) {
            return List.of();
        }

        if (node.getFuncionariosAsignados() != null && !node.getFuncionariosAsignados().isEmpty()) {
            return node.getFuncionariosAsignados();
        }

        if (politica == null || politica.getDepartamentos() == null || node.getDepartamentoId() == null) {
            return List.of();
        }

        for (Map<String, Object> departamento : politica.getDepartamentos()) {
            if (!node.getDepartamentoId().equals(String.valueOf(departamento.get("id")))) {
                continue;
            }

            Object asignados = departamento.get("funcionariosAsignados");
            if (asignados instanceof List<?> values) {
                List<String> result = new ArrayList<>();
                for (Object value : values) {
                    result.add(String.valueOf(value));
                }
                return result;
            }
        }

        return List.of();
    }

    private Map<String, Object> fallbackPrediction(
            Tramite tramite,
            PoliticaDeNegocio politica,
            Nodo currentNode,
            String reason
    ) {
        long currentStageHours = estimateCurrentStageHours(tramite);
        int pendingSteps = estimatePendingSteps(tramite, politica);
        int riskScore = Math.min(95, Math.max(10, (int) currentStageHours * 8 + pendingSteps * 7));

        Map<String, Object> result = new HashMap<>();
        result.put("source", "java-fallback");
        result.put("engine", "spring-rules");
        result.put("riskLevel", riskScore >= 70 ? "ALTO" : (riskScore >= 40 ? "MEDIO" : "BAJO"));
        result.put("riskScore", riskScore);
        result.put("estimatedDays", Math.max(1, pendingSteps + (riskScore / 35)));
        result.put("recommendedRoute", Map.of(
                "targetNodeName", currentNode != null ? currentNode.getNombre() : "Ruta actual",
                "reason", "Prediccion local porque Python no esta disponible"
        ));
        result.put("routeOptions", List.of());
        result.put("motives", List.of(
                "No se pudo conectar al servicio Python de IA.",
                "Motivo tecnico: " + reason
        ));
        result.put("improvements", List.of(
                "Levanta el servicio Python en http://localhost:8001 para activar la prediccion principal.",
                "Mientras tanto se usa una estimacion basica con tiempo y etapas pendientes."
        ));
        return result;
    }

    private long estimateCurrentStageHours(Tramite tramite) {
        if (tramite.getEstado() != null && "FINALIZADO".equalsIgnoreCase(tramite.getEstado())) {
            return 0;
        }

        LocalDateTime start = tramite.getFechaInicio();
        if (tramite.getHistorial() != null && !tramite.getHistorial().isEmpty()) {
            start = tramite.getHistorial().get(tramite.getHistorial().size() - 1).getFechaCompletado();
        }

        if (start == null) {
            return 0;
        }

        return Math.max(Duration.between(start, LocalDateTime.now()).toHours(), 0);
    }

    private int estimatePendingSteps(Tramite tramite, PoliticaDeNegocio politica) {
        if (politica == null || politica.getNodos() == null) {
            return 1;
        }

        int totalActivities = (int) politica.getNodos().stream()
                .filter(node -> node.getTipo() != null)
                .filter(node -> {
                    String type = node.getTipo().name();
                    return "ACTIVITY".equals(type) || "ACTIVIDAD".equals(type);
                })
                .count();
        int completed = tramite.getHistorial() != null ? tramite.getHistorial().size() : 0;
        return Math.max(totalActivities - completed, 0);
    }
}
