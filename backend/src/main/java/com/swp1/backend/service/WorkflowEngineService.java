package com.swp1.backend.service;

import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.Conexion;
import com.swp1.backend.model.CampoFormulario;
import com.swp1.backend.model.LogActividad;
import com.swp1.backend.model.Tramite;
import org.flowable.bpmn.model.*;
import org.flowable.bpmn.model.Process;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class WorkflowEngineService {

    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private RuntimeService runtimeService;

    @Autowired
    private TaskService taskService;

    public void deployPolitica(PoliticaDeNegocio politica) {
        if (politica.getNodos() == null || politica.getNodos().isEmpty()) {
            throw new RuntimeException("El flujo debe tener al menos una etapa para poder ser desplegado.");
        }
        BpmnModel model = new BpmnModel();
        Process process = new Process();
        process.setId("process_" + politica.getId());
        process.setName(politica.getNombre());
        model.addProcess(process);

        for (Nodo nodo : politica.getNodos()) {
            if (nodo.getTipo() == Nodo.TipoNodo.START || nodo.getTipo() == Nodo.TipoNodo.INICIO) {
                StartEvent startEvent = new StartEvent();
                startEvent.setId(nodo.getId());
                process.addFlowElement(startEvent);
            } else if (nodo.getTipo() == Nodo.TipoNodo.END || nodo.getTipo() == Nodo.TipoNodo.FIN) {
                EndEvent endEvent = new EndEvent();
                endEvent.setId(nodo.getId());
                process.addFlowElement(endEvent);
            } else if (nodo.getTipo() == Nodo.TipoNodo.ACTIVITY || nodo.getTipo() == Nodo.TipoNodo.ACTIVIDAD) {
                UserTask userTask = new UserTask();
                userTask.setId(nodo.getId());
                userTask.setName(nodo.getNombre());
                List<String> candidatos = getFuncionariosAsignados(nodo, politica);
                if (!candidatos.isEmpty()) {
                    userTask.setCandidateUsers(candidatos);
                }
                process.addFlowElement(userTask);
            } else if (nodo.getTipo() == Nodo.TipoNodo.DECISION) {
                ExclusiveGateway gateway = new ExclusiveGateway();
                gateway.setId(nodo.getId());
                process.addFlowElement(gateway);
            } else if (nodo.getTipo() == Nodo.TipoNodo.FORK || nodo.getTipo() == Nodo.TipoNodo.JOIN) {
                ParallelGateway gateway = new ParallelGateway();
                gateway.setId(nodo.getId());
                process.addFlowElement(gateway);
            }
        }

        for (Conexion conexion : politica.getConexiones()) {
            SequenceFlow flow = new SequenceFlow();
            flow.setId("flow_" + conexion.getId());
            flow.setSourceRef(conexion.getOrigenId());
            flow.setTargetRef(conexion.getDestinoId());
            
            // Verificar si el origen es un nodo de decisión
            boolean isFromDecision = politica.getNodos().stream()
                .anyMatch(n -> n.getId().equals(conexion.getOrigenId()) && 
                               (n.getTipo() == com.swp1.backend.model.Nodo.TipoNodo.DECISION));

            if (isFromDecision && conexion.getCondicion() != null && !conexion.getCondicion().isEmpty()) {
                flow.setConditionExpression("${outcome == '" + conexion.getCondicion() + "'}");
            } else if (isFromDecision) {
                org.flowable.bpmn.model.FlowElement element = process.getFlowElement(conexion.getOrigenId());
                if (element instanceof ExclusiveGateway) {
                    ExclusiveGateway gateway = (ExclusiveGateway) element;
                    if (gateway.getDefaultFlow() == null) {
                        gateway.setDefaultFlow(flow.getId());
                    } else {
                        flow.setConditionExpression("${outcome == 'AUTO_" + conexion.getId() + "'}");
                    }
                } else {
                    flow.setConditionExpression("${outcome == 'AUTO_" + conexion.getId() + "'}");
                }
            }
            
            process.addFlowElement(flow);
        }

        try {
            org.flowable.bpmn.converter.BpmnXMLConverter converter = new org.flowable.bpmn.converter.BpmnXMLConverter();
            byte[] xmlBytes = converter.convertToXML(model);
            System.out.println("DEBUG BPMN XML GENERADO:\n" + new String(xmlBytes, java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            e.printStackTrace();
        }

        repositoryService.createDeployment()
                .addBpmnModel(process.getId() + ".bpmn", model)
                .name(politica.getNombre())
                .deploy();
    }

    public void iniciarTramite(String politicaId, String tramiteId) {
        java.util.Map<String, Object> variables = new java.util.HashMap<>();
        variables.put("outcome", "DEFAULT");
        runtimeService.startProcessInstanceByKey("process_" + politicaId, tramiteId, variables);
    }

    public void completarTarea(String tramiteId, Map<String, Object> variables) {
        completarTarea(tramiteId, null, variables);
    }

    public void completarTarea(String tramiteId, String expectedNodoId, Map<String, Object> variables) {
        org.flowable.task.api.Task task = taskService.createTaskQuery()
                .processInstanceBusinessKey(tramiteId)
                .singleResult();

        if (task == null) {
            throw new IllegalStateException("No hay una tarea activa para este tramite.");
        }

        if (expectedNodoId != null && !expectedNodoId.isBlank() && !expectedNodoId.equals(task.getTaskDefinitionKey())) {
            throw new IllegalStateException("El tramite esta en la etapa " + task.getTaskDefinitionKey() + ", no en " + expectedNodoId + ".");
        }

        taskService.complete(task.getId(), variables != null ? variables : Map.of());
    }

    public String getNodoActual(String tramiteId) {
        String nodoActivo = getNodoActivo(tramiteId);
        return nodoActivo != null ? nodoActivo : "FIN";
    }

    public String getNodoActivo(String tramiteId) {
        org.flowable.task.api.Task task = taskService.createTaskQuery()
                .processInstanceBusinessKey(tramiteId)
                .singleResult();
        return task != null ? task.getTaskDefinitionKey() : null;
    }

    public void sincronizarConHistorial(PoliticaDeNegocio politica, Tramite tramite) {
        if (politica == null || tramite == null || tramite.getId() == null) {
            return;
        }

        cancelarTramitesActivos(tramite.getId());
        deployPolitica(politica);
        iniciarTramite(politica.getId(), tramite.getId());

        if (tramite.getHistorial() == null || tramite.getHistorial().isEmpty()) {
            return;
        }

        List<LogActividad> historial = new ArrayList<>(tramite.getHistorial());
        historial.sort(Comparator.comparing(
                LogActividad::getFechaCompletado,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));

        for (int i = 0; i < historial.size(); i++) {
            String nodoActivo = getNodoActivo(tramite.getId());
            if (nodoActivo == null) {
                return;
            }

            LogActividad log = historial.get(i);
            if (log.getNodoId() == null || !nodoActivo.equals(log.getNodoId())) {
                continue;
            }

            Map<String, Object> variables = variablesFromLog(log);
            String outcome = findNextDecisionOutcome(historial, i);
            if (outcome != null && !outcome.isBlank()) {
                variables.put("outcome", outcome);
            }

            completarTarea(tramite.getId(), nodoActivo, variables);
        }
    }

    public void cancelarTramitesActivos(String tramiteId) {
        List<ProcessInstance> instances = runtimeService.createProcessInstanceQuery()
                .processInstanceBusinessKey(tramiteId)
                .list();

        for (ProcessInstance instance : instances) {
            runtimeService.deleteProcessInstance(instance.getId(), "Reinicializacion de datos demo");
        }
    }

    private List<String> getFuncionariosAsignados(Nodo nodo, PoliticaDeNegocio politica) {
        if (nodo.getFuncionariosAsignados() != null && !nodo.getFuncionariosAsignados().isEmpty()) {
            return nodo.getFuncionariosAsignados();
        }

        if (politica.getDepartamentos() == null) {
            return List.of();
        }

        for (Map<String, Object> departamento : politica.getDepartamentos()) {
            Object id = departamento.get("id");
            if (id != null && id.toString().equals(nodo.getDepartamentoId())) {
                Object asignados = departamento.get("funcionariosAsignados");
                if (asignados instanceof List<?> lista) {
                    List<String> candidatos = new ArrayList<>();
                    for (Object item : lista) {
                        if (item != null && !item.toString().isBlank()) {
                            candidatos.add(item.toString());
                        }
                    }
                    return candidatos;
                }
            }
        }

        return List.of();
    }

    private Map<String, Object> variablesFromLog(LogActividad log) {
        Map<String, Object> variables = new HashMap<>();
        if (log.getDatosFormulario() == null) {
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

    private String findNextDecisionOutcome(List<LogActividad> historial, int currentIndex) {
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
}
