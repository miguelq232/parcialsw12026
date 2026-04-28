package com.swp1.backend.service;

import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.Conexion;
import org.flowable.bpmn.model.*;
import org.flowable.bpmn.model.Process;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
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
        org.flowable.task.api.Task task = taskService.createTaskQuery()
                .processInstanceBusinessKey(tramiteId)
                .singleResult();
        if (task != null) {
            taskService.complete(task.getId(), variables);
        }
    }

    public String getNodoActual(String tramiteId) {
        org.flowable.task.api.Task task = taskService.createTaskQuery()
                .processInstanceBusinessKey(tramiteId)
                .singleResult();
        return task != null ? task.getTaskDefinitionKey() : "FIN";
    }
}
