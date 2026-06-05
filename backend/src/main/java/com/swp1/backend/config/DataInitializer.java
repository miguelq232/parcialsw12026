package com.swp1.backend.config;

import com.swp1.backend.model.CampoFormulario;
import com.swp1.backend.model.Conexion;
import com.swp1.backend.model.Departamento;
import com.swp1.backend.model.Formulario;
import com.swp1.backend.model.LogActividad;
import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.model.Tramite;
import com.swp1.backend.model.Usuario;
import com.swp1.backend.repository.DepartamentoRepository;
import com.swp1.backend.repository.FormularioRepository;
import com.swp1.backend.repository.PoliticaRepository;
import com.swp1.backend.repository.TramiteRepository;
import com.swp1.backend.repository.UsuarioRepository;
import com.swp1.backend.service.WorkflowEngineService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Configuration
public class DataInitializer {

    @Value("${app.demo.bulk-tramites.enabled:true}")
    private boolean bulkDemoTramitesEnabled;

    @Value("${app.demo.bulk-tramites.count:240}")
    private int bulkDemoTramitesCount;

    @Value("${app.demo.reset-tramites.enabled:true}")
    private boolean resetDemoTramitesEnabled;

    @Bean
    CommandLineRunner initDatabase(
            DepartamentoRepository departamentoRepository,
            UsuarioRepository usuarioRepository,
            PoliticaRepository politicaRepository,
            FormularioRepository formularioRepository,
            TramiteRepository tramiteRepository,
            WorkflowEngineService workflowEngineService
    ) {
        return args -> {
            seedDepartamentos(departamentoRepository);
            seedUsuarios(usuarioRepository);
            seedDemoData(politicaRepository, tramiteRepository, workflowEngineService);
            seedFormulariosFromTramites(formularioRepository, tramiteRepository);
        };
    }

    private void seedDepartamentos(DepartamentoRepository repository) {
        removeLegacyDemoDepartamentos(repository);
        ensureDepartamento(repository, "d-atencion", "Atencion al Cliente", "Recepcion, validacion inicial y contacto con clientes.");
        ensureDepartamento(repository, "d-riesgos", "Riesgos Crediticios", "Revision financiera, score y evaluacion de riesgo.");
        ensureDepartamento(repository, "d-aprobacion", "Direccion General", "Aprobaciones finales y decisiones excepcionales.");
        ensureDepartamento(repository, "d-tecnico", "Revision Tecnica", "Inspecciones, peritajes y validaciones operativas.");
        ensureDepartamento(repository, "d-caja", "Caja", "Validacion de pagos, comprobantes y entrega de documentos.");
    }

    private void seedUsuarios(UsuarioRepository repository) {
        ensureUsuario(repository, "Admin 1", "admin@swp1.demo", "admin123", "ADMIN", null);
        ensureUsuario(repository, "Admin 2", "admin2@swp1.demo", "admin123", "ADMIN", null);
        ensureUsuario(repository, "Funcionario", "funcionario1@swp1.demo", "funcionario123", "FUNCIONARIO", "d-atencion");
        ensureUsuario(repository, "Funcionario 2", "funcionario2@swp1.demo", "funcionario123", "FUNCIONARIO", "d-riesgos");
        ensureUsuario(repository, "Funcionario 3", "funcionario3@swp1.demo", "funcionario123", "FUNCIONARIO", "d-aprobacion");
        ensureUsuario(repository, "Funcionario Tecnico", "tecnico@swp1.demo", "funcionario123", "FUNCIONARIO", "d-tecnico");
        ensureUsuario(repository, "Funcionario Caja", "caja@swp1.demo", "funcionario123", "FUNCIONARIO", "d-caja");
    }

    private void seedFormulariosFromTramites(FormularioRepository formularioRepository, TramiteRepository tramiteRepository) {
        if (resetDemoTramitesEnabled) {
            formularioRepository.findAll().stream()
                    .filter(formulario -> formulario.getId() != null && formulario.getId().startsWith("demo-form-"))
                    .forEach(formulario -> formularioRepository.deleteById(formulario.getId()));
        }

        for (Tramite tramite : tramiteRepository.findAll()) {
            if (tramite.getId() == null || !tramite.getId().startsWith("demo-") || tramite.getHistorial() == null) {
                continue;
            }

            int index = 1;
            for (LogActividad log : tramite.getHistorial()) {
                if (log.getDatosFormulario() == null || log.getDatosFormulario().isEmpty()) {
                    index++;
                    continue;
                }

                String id = "demo-form-" + tramite.getId() + "-" + String.format("%02d", index);
                if (!resetDemoTramitesEnabled && formularioRepository.existsById(id)) {
                    index++;
                    continue;
                }

                Formulario formulario = new Formulario();
                formulario.setId(id);
                formulario.setTramiteId(tramite.getId());
                formulario.setNodoId(log.getNodoId());
                formulario.setUsuarioId(log.getUsuario());
                formulario.setTiempoAtencion(log.getDuracionSegundos() != null ? log.getDuracionSegundos() : 0L);
                formulario.setFechaCreacion(log.getFechaCompletado());
                formulario.setContenido(formularioContenido(tramite, log));
                formularioRepository.save(formulario);
                index++;
            }
        }
    }

    private void seedDemoData(
            PoliticaRepository politicaRepository,
            TramiteRepository tramiteRepository,
            WorkflowEngineService workflowEngineService
    ) {
        PoliticaDeNegocio prestamo = politicaRepository.save(buildPrestamoPersonalPolicy());
        PoliticaDeNegocio reclamo = politicaRepository.save(buildReclamoServicioPolicy());
        PoliticaDeNegocio licencia = politicaRepository.save(buildRenovacionLicenciaPolicy());

        try {
            workflowEngineService.deployPolitica(prestamo);
            workflowEngineService.deployPolitica(reclamo);
            workflowEngineService.deployPolitica(licencia);
        } catch (Exception e) {
            System.err.println("No se pudieron desplegar las politicas demo: " + e.getMessage());
        }

        seedTramiteNuevoPrestamo(tramiteRepository, workflowEngineService);
        seedTramitePrestamoEnEvaluacion(tramiteRepository, workflowEngineService);
        seedTramitePrestamoEnAprobacion(tramiteRepository, workflowEngineService);
        seedTramitePrestamoFinalizado(tramiteRepository, workflowEngineService);
        seedTramiteReclamoNuevo(tramiteRepository, workflowEngineService);
        seedTramiteReclamoFinalizado(tramiteRepository, workflowEngineService);
        seedTramiteLicenciaNuevo(tramiteRepository, workflowEngineService);

        if (bulkDemoTramitesEnabled) {
            seedBulkDemoTramites(tramiteRepository, workflowEngineService, Math.max(0, bulkDemoTramitesCount));
        }
    }

    private void seedTramiteNuevoPrestamo(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-prestamo-nuevo";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        startTramite(repository, workflowEngineService,
                id,
                "demo-prestamo-personal",
                "Cliente Demo - Maria Lopez",
                LocalDateTime.now().minusHours(2));
    }

    private void seedTramitePrestamoEnEvaluacion(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-prestamo-evaluacion";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        LocalDateTime inicio = LocalDateTime.now().minusHours(1).minusMinutes(20);
        Tramite tramite = startTramite(repository, workflowEngineService,
                id,
                "demo-prestamo-personal",
                "Cliente Demo - Elena Suarez",
                inicio);

        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-solicitud",
                "Registro de solicitud",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Nombre completo", "TEXTO", "Elena Suarez"),
                        fieldValue("ci", "Documento de identidad", "TEXTO", "9123456"),
                        fieldValue("monto", "Monto solicitado", "NUMERO", "18000"),
                        fieldValue("plazo", "Plazo en meses", "NUMERO", "18")
                ),
                "Solicitud registrada y enviada a evaluacion de riesgo.",
                inicio.plusMinutes(7),
                420L);
    }

    private void seedTramitePrestamoEnAprobacion(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-prestamo-aprobacion";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        LocalDateTime inicio = LocalDateTime.now().minusHours(4);
        Tramite tramite = startTramite(repository, workflowEngineService,
                id,
                "demo-prestamo-personal",
                "Cliente Demo - Carlos Rojas",
                inicio);

        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-solicitud",
                "Registro de solicitud",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Nombre completo", "TEXTO", "Carlos Rojas"),
                        fieldValue("ci", "Documento de identidad", "TEXTO", "7845123"),
                        fieldValue("monto", "Monto solicitado", "NUMERO", "25000")
                ),
                "Cliente registrado con documentacion completa.",
                inicio.plusMinutes(7),
                420L);

        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", "Aprobado");
        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-evaluacion",
                "Evaluacion de riesgo",
                "Funcionario 2",
                decision,
                List.of(
                        fieldValue("ingresos", "Ingresos mensuales", "NUMERO", "8400"),
                        fieldValue("riesgo", "Nivel de riesgo", "SELECCION", "Bajo")
                ),
                "Score suficiente para enviar a aprobacion final.",
                inicio.plusMinutes(39),
                1920L);
    }

    private void seedTramitePrestamoFinalizado(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-prestamo-finalizado";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        LocalDateTime inicio = LocalDateTime.now().minusDays(1).minusHours(2);
        Tramite tramite = startTramite(repository, workflowEngineService,
                id,
                "demo-prestamo-personal",
                "Cliente Demo - Pablo Vargas",
                inicio);

        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-solicitud",
                "Registro de solicitud",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Nombre completo", "TEXTO", "Pablo Vargas"),
                        fieldValue("ci", "Documento de identidad", "TEXTO", "8066771"),
                        fieldValue("monto", "Monto solicitado", "NUMERO", "32000"),
                        fieldValue("plazo", "Plazo en meses", "NUMERO", "24")
                ),
                "Solicitud completa, documentos iniciales verificados.",
                inicio.plusMinutes(9),
                540L);

        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", "Aprobado");
        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-evaluacion",
                "Evaluacion de riesgo",
                "Funcionario 2",
                decision,
                List.of(
                        fieldValue("ingresos", "Ingresos mensuales", "NUMERO", "9700"),
                        fieldValue("riesgo", "Nivel de riesgo", "SELECCION", "Bajo")
                ),
                "Perfil aprobado por capacidad de pago y bajo riesgo.",
                inicio.plusHours(3),
                9600L);

        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-aprobacion",
                "Aprobacion final",
                "Funcionario 3",
                new HashMap<>(),
                List.of(fieldValue("dictamen", "Dictamen", "SELECCION", "Aprobar")),
                "Aprobacion gerencial emitida y credito cerrado.",
                inicio.plusHours(5),
                7200L);
    }

    private void seedTramiteReclamoNuevo(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-reclamo-nuevo";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        startTramite(repository, workflowEngineService,
                id,
                "demo-reclamo-servicio",
                "Cliente Demo - Ana Vargas",
                LocalDateTime.now().minusMinutes(45));
    }

    private void seedTramiteReclamoFinalizado(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-reclamo-finalizado";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        LocalDateTime inicio = LocalDateTime.now().minusDays(1).minusHours(3);
        Tramite tramite = startTramite(repository, workflowEngineService,
                id,
                "demo-reclamo-servicio",
                "Cliente Demo - Luis Perez",
                inicio);

        completeStepAt(repository, workflowEngineService, tramite,
                "reclamo-registro",
                "Registro del reclamo",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Cliente", "TEXTO", "Luis Perez"),
                        fieldValue("motivo", "Motivo del reclamo", "TEXTO", "Demora en atencion")
                ),
                "Reclamo registrado con prioridad normal.",
                inicio.plusMinutes(11),
                660L);

        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", "No procede");
        completeStepAt(repository, workflowEngineService, tramite,
                "reclamo-inspeccion",
                "Revision tecnica",
                "Funcionario Tecnico",
                decision,
                List.of(
                        fieldValue("diagnostico", "Diagnostico", "TEXTO", "No se evidencia incumplimiento de SLA"),
                        fieldValue("resultado", "Resultado", "SELECCION", "No procede")
                ),
                "No corresponde compensacion segun condiciones del servicio.",
                inicio.plusHours(2),
                6540L);

        completeStepAt(repository, workflowEngineService, tramite,
                "reclamo-cierre",
                "Comunicacion al cliente",
                "Funcionario 3",
                new HashMap<>(),
                List.of(fieldValue("respuesta", "Respuesta enviada", "TEXTO", "Se informo el resultado al cliente.")),
                "Caso cerrado y comunicado.",
                inicio.plusHours(3),
                3600L);
    }

    private void seedTramiteLicenciaNuevo(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        String id = "demo-tramite-licencia-nuevo";
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        startTramite(repository, workflowEngineService,
                id,
                "demo-renovacion-licencia",
                "Cliente Demo - Sofia Medina",
                LocalDateTime.now().minusMinutes(25));
    }

    private void seedBulkDemoTramites(TramiteRepository repository, WorkflowEngineService workflowEngineService, int count) {
        for (int index = 1; index <= count; index++) {
            try {
                int tipo = (index - 1) % 3;
                int scenario = (index - 1) % 8;
                int avance = avanceDemo(index, scenario);
                if (tipo == 0) {
                    seedBulkPrestamo(repository, workflowEngineService, index, avance, scenario);
                } else if (tipo == 1) {
                    seedBulkReclamo(repository, workflowEngineService, index, avance, scenario);
                } else {
                    seedBulkLicencia(repository, workflowEngineService, index, avance, scenario);
                }
            } catch (Exception e) {
                System.err.println("No se pudo crear tramite demo masivo #" + index + ": " + e.getMessage());
            }
        }
    }

    private void seedBulkPrestamo(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            int index,
            int avance,
            int scenario
    ) {
        String id = "demo-bulk-prestamo-" + String.format("%03d", index);
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        String cliente = clienteDemo(index);
        LocalDateTime inicio = fechaDemo(index, scenario);
        Tramite tramite = startTramite(repository, workflowEngineService, id, "demo-prestamo-personal", cliente, inicio);

        if (avance == 0) return;

        int monto = 8000 + (index * 1300 % 52000);
        int ingresos = 3500 + (index * 740 % 15000);
        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-solicitud",
                "Registro de solicitud",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Nombre completo", "TEXTO", cliente),
                        fieldValue("ci", "Documento de identidad", "TEXTO", String.valueOf(6000000 + index * 37)),
                        fieldValue("monto", "Monto solicitado", "NUMERO", String.valueOf(monto)),
                        fieldValue("plazo", "Plazo en meses", "NUMERO", String.valueOf(12 + (index % 5) * 6))
                ),
                informeSolicitud(scenario, "Solicitud registrada con documentos iniciales completos."),
                fechaPaso(inicio, scenario, 1),
                duracionDemo(index, scenario, 420L));

        if (avance == 1) return;

        boolean aprobado = scenario != 4 && index % 4 != 0;
        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", aprobado ? "Aprobado" : "Rechazado");
        completeStepAt(repository, workflowEngineService, tramite,
                "prestamo-evaluacion",
                "Evaluacion de riesgo",
                "Funcionario 2",
                decision,
                List.of(
                        fieldValue("ingresos", "Ingresos mensuales", "NUMERO", String.valueOf(ingresos)),
                        fieldValue("riesgo", "Nivel de riesgo", "SELECCION", aprobado ? nivelRiesgo(index) : "Alto")
                ),
                aprobado ? informeSolicitud(scenario, "Score suficiente para revision final.") : "Rechazo por ingresos insuficientes y capacidad de pago observada.",
                fechaPaso(inicio, scenario, 2),
                duracionDemo(index, scenario, 900L));

        if (avance == 2) return;

        if (aprobado) {
            completeStepAt(repository, workflowEngineService, tramite,
                    "prestamo-aprobacion",
                    "Aprobacion final",
                    "Funcionario 3",
                    new HashMap<>(),
                    List.of(fieldValue("dictamen", "Dictamen", "SELECCION", "Aprobar")),
                    "Prestamo aprobado y notificado para desembolso.",
                    fechaPaso(inicio, scenario, 3),
                    duracionDemo(index, scenario, 600L));
        } else {
            completeStepAt(repository, workflowEngineService, tramite,
                    "prestamo-rechazo",
                    "Notificar rechazo",
                    "Funcionario",
                    new HashMap<>(),
                    List.of(fieldValue("motivo", "Motivo comunicado", "TEXTO", "Ingresos insuficientes para el monto solicitado.")),
                    "Rechazo comunicado al cliente y tramite cerrado.",
                    fechaPaso(inicio, scenario, 3),
                    duracionDemo(index, scenario, 360L));
        }
    }

    private void seedBulkReclamo(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            int index,
            int avance,
            int scenario
    ) {
        String id = "demo-bulk-reclamo-" + String.format("%03d", index);
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        String cliente = clienteDemo(index + 50);
        LocalDateTime inicio = fechaDemo(index + 7, scenario);
        Tramite tramite = startTramite(repository, workflowEngineService, id, "demo-reclamo-servicio", cliente, inicio);

        if (avance == 0) return;

        completeStepAt(repository, workflowEngineService, tramite,
                "reclamo-registro",
                "Registro del reclamo",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Cliente", "TEXTO", cliente),
                        fieldValue("motivo", "Motivo del reclamo", "TEXTO", motivoReclamo(index))
                ),
                informeSolicitud(scenario, "Reclamo registrado y asignado a revision tecnica."),
                fechaPaso(inicio, scenario, 1),
                duracionDemo(index, scenario, 300L));

        if (avance == 1) return;

        boolean procede = scenario == 4 || index % 3 != 0;
        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", procede ? "Procede" : "No procede");
        completeStepAt(repository, workflowEngineService, tramite,
                "reclamo-inspeccion",
                "Revision tecnica",
                "Funcionario Tecnico",
                decision,
                List.of(
                        fieldValue("diagnostico", "Diagnostico", "TEXTO", procede ? "Se confirma incidencia en el servicio." : "No se evidencia incumplimiento."),
                        fieldValue("resultado", "Resultado", "SELECCION", procede ? "Procede" : "No procede")
                ),
                procede ? informeSolicitud(scenario, "Corresponde gestionar compensacion.") : "No procede; caso listo para comunicacion de cierre.",
                fechaPaso(inicio, scenario, 2),
                duracionDemo(index, scenario, 780L));

        if (avance == 2) return;

        if (procede) {
            completeStepAt(repository, workflowEngineService, tramite,
                    "reclamo-compensacion",
                    "Gestionar compensacion",
                    "Funcionario 3",
                    new HashMap<>(),
                    List.of(fieldValue("compensacion", "Compensacion propuesta", "TEXTO", "Descuento aplicado en el siguiente ciclo.")),
                    "Compensacion registrada y caso finalizado.",
                    fechaPaso(inicio, scenario, 3),
                    duracionDemo(index, scenario, 520L));
        } else {
            completeStepAt(repository, workflowEngineService, tramite,
                    "reclamo-cierre",
                    "Comunicacion al cliente",
                    "Funcionario 3",
                    new HashMap<>(),
                    List.of(fieldValue("respuesta", "Respuesta enviada", "TEXTO", "Se comunico el resultado de la revision.")),
                    "Cliente notificado y caso cerrado.",
                    fechaPaso(inicio, scenario, 3),
                    duracionDemo(index, scenario, 410L));
        }
    }

    private void seedBulkLicencia(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            int index,
            int avance,
            int scenario
    ) {
        String id = "demo-bulk-licencia-" + String.format("%03d", index);
        if (!prepareDemoTramite(repository, workflowEngineService, id)) return;

        String cliente = clienteDemo(index + 100);
        LocalDateTime inicio = fechaDemo(index + 14, scenario);
        Tramite tramite = startTramite(repository, workflowEngineService, id, "demo-renovacion-licencia", cliente, inicio);

        if (avance == 0) return;

        completeStepAt(repository, workflowEngineService, tramite,
                "licencia-recepcion",
                "Recepcion de solicitud",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Nombre del solicitante", "TEXTO", cliente),
                        fieldValue("licencia_antigua", "Foto de licencia antigua", "FOTO", "licencia-antigua-" + index + ".jpg"),
                        fieldValue("documento_identidad", "Documento de identidad", "FOTO", "ci-" + index + ".jpg"),
                        fieldValue("certificado_medico", "Certificado medico", "ARCHIVO", "certificado-medico-" + index + ".pdf")
                ),
                informeSolicitud(scenario, "Documentos recibidos para validacion."),
                fechaPaso(inicio, scenario, 1),
                duracionDemo(index, scenario, 260L));

        if (avance == 1) return;

        boolean aprobado = scenario != 4 && index % 5 != 0;
        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", aprobado ? "Aprobado" : "Observado");
        completeStepAt(repository, workflowEngineService, tramite,
                "licencia-validacion",
                "Validacion documental",
                "Funcionario Tecnico",
                decision,
                List.of(
                        fieldValue("observaciones", "Observaciones", "TEXTO", aprobado ? "Documentos correctos." : "Certificado medico requiere correccion."),
                        fieldValue("resultado", "Resultado", "SELECCION", aprobado ? "Aprobado" : "Observado")
                ),
                aprobado ? informeSolicitud(scenario, "Solicitud habilitada para pago y entrega.") : "Observacion documental: se requiere correccion del certificado medico.",
                fechaPaso(inicio, scenario, 2),
                duracionDemo(index, scenario, 640L));

        if (avance == 2) return;

        if (aprobado) {
            completeStepAt(repository, workflowEngineService, tramite,
                    "licencia-pago",
                    "Pago y entrega",
                    "Funcionario Caja",
                    new HashMap<>(),
                    List.of(
                            fieldValue("comprobante_pago", "Comprobante de pago", "ARCHIVO", "pago-" + index + ".pdf"),
                            fieldValue("numero_licencia", "Numero de licencia renovada", "TEXTO", "LIC-" + (2026000 + index))
                    ),
                    "Pago confirmado y licencia entregada.",
                    fechaPaso(inicio, scenario, 3),
                    duracionDemo(index, scenario, 480L));
        } else {
            completeStepAt(repository, workflowEngineService, tramite,
                    "licencia-observacion",
                    "Solicitar correccion",
                    "Funcionario",
                    new HashMap<>(),
                    List.of(
                            fieldValue("detalle_observacion", "Detalle de observacion", "TEXTO", "Actualizar certificado medico."),
                            fieldValue("documento_corregido", "Documento corregido", "ARCHIVO", "pendiente")
                    ),
                    "Observacion enviada al solicitante para correccion documental.",
                    fechaPaso(inicio, scenario, 3),
                    duracionDemo(index, scenario, 360L));
        }
    }

    private Tramite startTramite(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            String id,
            String politicaId,
            String cliente,
            LocalDateTime fechaInicio
    ) {
        Tramite tramite = new Tramite();
        tramite.setId(id);
        tramite.setNumeroTramite(demoNumeroTramite(id));
        tramite.setPoliticaId(politicaId);
        tramite.setCliente(cliente);
        tramite.setEstado("EN_PROCESO");
        tramite.setFechaInicio(fechaInicio);
        tramite.setHistorial(new ArrayList<>());
        tramite.getHistorial().add(buildInicioLog(politicaId, fechaInicio));
        tramite = repository.save(tramite);

        workflowEngineService.iniciarTramite(politicaId, tramite.getId());
        tramite.setNodoActualId(workflowEngineService.getNodoActual(tramite.getId()));
        return repository.save(tramite);
    }

    private boolean prepareDemoTramite(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            String id
    ) {
        if (resetDemoTramitesEnabled) {
            workflowEngineService.cancelarTramitesActivos(id);
            repository.deleteById(id);
            return true;
        }

        if (repository.existsById(id)) {
            return false;
        }

        workflowEngineService.cancelarTramitesActivos(id);
        return true;
    }

    private String demoNumeroTramite(String id) {
        if ("demo-tramite-prestamo-nuevo".equals(id)) return "TR-2026-000001";
        if ("demo-tramite-prestamo-evaluacion".equals(id)) return "TR-2026-000002";
        if ("demo-tramite-prestamo-aprobacion".equals(id)) return "TR-2026-000003";
        if ("demo-tramite-prestamo-finalizado".equals(id)) return "TR-2026-000004";
        if ("demo-tramite-reclamo-nuevo".equals(id)) return "TR-2026-000005";
        if ("demo-tramite-reclamo-finalizado".equals(id)) return "TR-2026-000006";
        if ("demo-tramite-licencia-nuevo".equals(id)) return "TR-2026-000007";

        int index = parseDemoIndex(id);
        if (id.startsWith("demo-bulk-prestamo-")) return String.format("TR-2026-%06d", 1000 + index);
        if (id.startsWith("demo-bulk-reclamo-")) return String.format("TR-2026-%06d", 2000 + index);
        if (id.startsWith("demo-bulk-licencia-")) return String.format("TR-2026-%06d", 3000 + index);

        return "TR-DEMO-" + Math.abs(id.hashCode());
    }

    private int parseDemoIndex(String id) {
        try {
            return Integer.parseInt(id.substring(id.lastIndexOf('-') + 1));
        } catch (Exception e) {
            return 0;
        }
    }

    private LogActividad buildInicioLog(String politicaId, LocalDateTime fechaInicio) {
        LogActividad log = new LogActividad();
        log.setNodoId(inicioNodeId(politicaId));
        log.setNombreNodo("Inicio");
        log.setUsuario("Funcionario");
        log.setFechaCompletado(fechaInicio);
        log.setDatosFormulario(List.of());
        log.setInformeIA("Tramite iniciado.");
        log.setDuracionSegundos(0L);
        return log;
    }

    private int avanceDemo(int index, int scenario) {
        if (scenario == 0) return 4;
        if (scenario == 1) return 2 + index % 2;
        if (scenario == 2) return 1 + index % 2;
        if (scenario == 3) return index % 3 == 0 ? 0 : 1;
        if (scenario == 4) return 2;
        if (scenario == 5) return 1 + index % 3;
        if (scenario == 6) return 4;
        return index % 5;
    }

    private LocalDateTime fechaDemo(int index, int scenario) {
        LocalDateTime now = LocalDateTime.now();
        if (scenario == 0) {
            return now.minusDays(index % 2).minusHours(1 + index % 5);
        }
        if (scenario == 1) {
            return now.minusDays(3L + index % 6).minusHours(index % 8);
        }
        if (scenario == 2) {
            return now.minusDays(14L + index % 22).minusHours(index % 12);
        }
        if (scenario == 3) {
            return now.minusDays(6L + index % 10).minusHours(index % 9);
        }
        if (scenario == 4) {
            return now.minusDays(8L + index % 18).minusHours(index % 7);
        }
        if (scenario == 5) {
            return now.minusDays(5L + index % 14).minusHours(index % 10);
        }
        if (scenario == 6) {
            return now.minusDays(1L + index % 12).minusHours(index % 6);
        }
        return fechaDemo(index);
    }

    private LocalDateTime fechaPaso(LocalDateTime inicio, int scenario, int step) {
        LocalDateTime fecha;
        if (scenario == 0) {
            fecha = inicio.plusHours(step * 2L);
        } else if (scenario == 1) {
            fecha = inicio.plusHours(step * 9L);
        } else if (scenario == 2) {
            fecha = inicio.plusDays(step);
        } else if (scenario == 3) {
            fecha = inicio.plusHours(step * 12L);
        } else if (scenario == 4) {
            fecha = inicio.plusDays(step * 2L);
        } else if (scenario == 5) {
            fecha = inicio.plusHours(step * 18L);
        } else if (scenario == 6) {
            fecha = inicio.plusHours(step * 5L);
        } else {
            fecha = inicio.plusHours(step * 4L);
        }

        LocalDateTime maxFecha = LocalDateTime.now().minusMinutes(10L + step);
        return fecha.isAfter(maxFecha) ? maxFecha : fecha;
    }

    private long duracionDemo(int index, int scenario, long baseSeconds) {
        long jitter = index % 240;
        if (scenario == 0) return baseSeconds + jitter;
        if (scenario == 1) return baseSeconds * 3 + jitter;
        if (scenario == 2) return baseSeconds * 8 + jitter;
        if (scenario == 3) return baseSeconds * 4 + jitter;
        if (scenario == 4) return baseSeconds * 5 + jitter;
        if (scenario == 5) return baseSeconds * 6 + jitter;
        return baseSeconds * 2 + jitter;
    }

    private String informeSolicitud(int scenario, String base) {
        if (scenario == 2) return base + " Caso estancado por cola operativa y seguimiento pendiente.";
        if (scenario == 3) return base + " Revisar documentos obligatorios antes de avanzar.";
        if (scenario == 4) return base + " Observacion registrada por retrabajo o correccion requerida.";
        if (scenario == 5) return base + " Area con alta carga de tramites activos.";
        return base;
    }

    private String inicioNodeId(String politicaId) {
        if ("demo-prestamo-personal".equals(politicaId)) return "prestamo-inicio";
        if ("demo-reclamo-servicio".equals(politicaId)) return "reclamo-inicio";
        if ("demo-renovacion-licencia".equals(politicaId)) return "licencia-inicio";
        return "inicio";
    }

    private void completeStep(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            Tramite tramite,
            String nodoId,
            String nombreNodo,
            String usuario,
            Map<String, Object> variables,
            List<CampoFormulario> campos,
            String informe
    ) {
        completeStepAt(repository, workflowEngineService, tramite, nodoId, nombreNodo, usuario, variables, campos,
                informe, LocalDateTime.now().minusMinutes(8), 720L);
    }

    private void completeStepAt(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            Tramite tramite,
            String nodoId,
            String nombreNodo,
            String usuario,
            Map<String, Object> variables,
            List<CampoFormulario> campos,
            String informe,
            LocalDateTime fechaCompletado,
            long duracionSegundos
    ) {
        workflowEngineService.completarTarea(tramite.getId(), variables);

        LogActividad log = new LogActividad();
        log.setNodoId(nodoId);
        log.setNombreNodo(nombreNodo);
        log.setUsuario(usuario);
        log.setFechaCompletado(fechaCompletado);
        log.setDatosFormulario(campos);
        log.setInformeIA(informe);
        log.setDuracionSegundos(duracionSegundos);

        if (tramite.getHistorial() == null) {
            tramite.setHistorial(new ArrayList<>());
        }
        tramite.getHistorial().add(log);
        appendAutomaticMovementLogs(tramite, nodoId, variables, usuario, fechaCompletado);
        tramite.setNodoActualId(workflowEngineService.getNodoActual(tramite.getId()));
        if ("FIN".equals(tramite.getNodoActualId())) {
            tramite.setEstado("FINALIZADO");
        }
        repository.save(tramite);
    }

    private void appendAutomaticMovementLogs(
            Tramite tramite,
            String completedNodeId,
            Map<String, Object> variables,
            String usuario,
            LocalDateTime fechaBase
    ) {
        PoliticaDeNegocio politica = buildDemoPolicyFor(tramite.getPoliticaId());
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

    private PoliticaDeNegocio buildDemoPolicyFor(String politicaId) {
        if ("demo-prestamo-personal".equals(politicaId)) return buildPrestamoPersonalPolicy();
        if ("demo-reclamo-servicio".equals(politicaId)) return buildReclamoServicioPolicy();
        if ("demo-renovacion-licencia".equals(politicaId)) return buildRenovacionLicenciaPolicy();
        return null;
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

    private LocalDateTime fechaDemo(int index) {
        return LocalDateTime.now()
                .minusDays(1L + index % 18)
                .minusHours(index % 9)
                .minusMinutes((index * 7L) % 50);
    }

    private String clienteDemo(int index) {
        List<String> nombres = List.of(
                "Laura Quiroga", "Miguel Salvatierra", "Valeria Mendoza", "Ruben Paredes",
                "Natalia Flores", "Jorge Arce", "Daniela Vargas", "Oscar Rojas",
                "Camila Medina", "Andres Choque", "Patricia Limachi", "Sergio Gutierrez"
        );
        return "Cliente Demo - " + nombres.get(index % nombres.size()) + " " + (1000 + index);
    }

    private String nivelRiesgo(int index) {
        if (index % 7 == 0) return "Medio";
        return "Bajo";
    }

    private String motivoReclamo(int index) {
        List<String> motivos = List.of(
                "Demora en atencion",
                "Cobro no reconocido",
                "Error en datos registrados",
                "Servicio incompleto",
                "Solicitud sin respuesta"
        );
        return motivos.get(index % motivos.size());
    }

    private PoliticaDeNegocio buildPrestamoPersonalPolicy() {
        PoliticaDeNegocio policy = new PoliticaDeNegocio();
        policy.setId("demo-prestamo-personal");
        policy.setNombre("Demo - Prestamo Personal");
        policy.setDescripcion("Flujo de ejemplo para solicitud, evaluacion de riesgo y aprobacion de prestamos.");
        policy.setDepartamentos(List.of(
                deptMap("d-atencion", "Atencion al Cliente", List.of("Funcionario")),
                deptMap("d-riesgos", "Riesgos Crediticios", List.of("Funcionario 2")),
                deptMap("d-aprobacion", "Aprobacion Gerencial", List.of("Funcionario 3"))
        ));
        policy.setNodos(List.of(
                node("prestamo-inicio", Nodo.TipoNodo.INICIO, "Inicio", "d-atencion", List.of(), List.of(), 80, 120),
                node("prestamo-solicitud", Nodo.TipoNodo.ACTIVIDAD, "Registro de solicitud", "d-atencion", List.of("Funcionario"), List.of(
                        field("cliente", "Nombre completo", "TEXTO", null),
                        field("ci", "Documento de identidad", "TEXTO", null),
                        field("monto", "Monto solicitado", "NUMERO", null),
                        field("plazo", "Plazo en meses", "NUMERO", null)
                ), 160, 300),
                node("prestamo-evaluacion", Nodo.TipoNodo.ACTIVIDAD, "Evaluacion de riesgo", "d-riesgos", List.of("Funcionario 2"), List.of(
                        field("ingresos", "Ingresos mensuales", "NUMERO", null),
                        field("riesgo", "Nivel de riesgo", "SELECCION", List.of("Bajo", "Medio", "Alto"))
                ), 520, 300),
                node("prestamo-decision", Nodo.TipoNodo.DECISION, "Resultado crediticio", "d-riesgos", List.of(), List.of(), 555, 500),
                node("prestamo-aprobacion", Nodo.TipoNodo.ACTIVIDAD, "Aprobacion final", "d-aprobacion", List.of("Funcionario 3"), List.of(
                        field("dictamen", "Dictamen", "SELECCION", List.of("Aprobar", "Observar"))
                ), 880, 260),
                node("prestamo-rechazo", Nodo.TipoNodo.ACTIVIDAD, "Notificar rechazo", "d-atencion", List.of("Funcionario"), List.of(
                        field("motivo", "Motivo comunicado", "TEXTO", null)
                ), 180, 560),
                node("prestamo-fin", Nodo.TipoNodo.FIN, "Fin", "d-aprobacion", List.of(), List.of(), 920, 560)
        ));
        policy.setConexiones(List.of(
                conn("prestamo-c1", "prestamo-inicio", "prestamo-solicitud", "DEFAULT"),
                conn("prestamo-c2", "prestamo-solicitud", "prestamo-evaluacion", "DEFAULT"),
                conn("prestamo-c3", "prestamo-evaluacion", "prestamo-decision", "DEFAULT"),
                conn("prestamo-c4", "prestamo-decision", "prestamo-aprobacion", "Aprobado"),
                conn("prestamo-c5", "prestamo-decision", "prestamo-rechazo", "Rechazado"),
                conn("prestamo-c6", "prestamo-aprobacion", "prestamo-fin", "DEFAULT"),
                conn("prestamo-c7", "prestamo-rechazo", "prestamo-fin", "DEFAULT")
        ));
        return policy;
    }

    private PoliticaDeNegocio buildReclamoServicioPolicy() {
        PoliticaDeNegocio policy = new PoliticaDeNegocio();
        policy.setId("demo-reclamo-servicio");
        policy.setNombre("Demo - Reclamo de Servicio");
        policy.setDescripcion("Flujo de ejemplo para reclamos, inspeccion tecnica, compensacion y cierre.");
        policy.setDepartamentos(List.of(
                deptMap("d-atencion", "Recepcion de Reclamos", List.of("Funcionario")),
                deptMap("d-tecnico", "Revision Tecnica", List.of("Funcionario Tecnico")),
                deptMap("d-aprobacion", "Comunicacion y Cierre", List.of("Funcionario 3"))
        ));
        policy.setNodos(List.of(
                node("reclamo-inicio", Nodo.TipoNodo.INICIO, "Inicio", "d-atencion", List.of(), List.of(), 80, 120),
                node("reclamo-registro", Nodo.TipoNodo.ACTIVIDAD, "Registro del reclamo", "d-atencion", List.of("Funcionario"), List.of(
                        field("cliente", "Cliente", "TEXTO", null),
                        field("motivo", "Motivo del reclamo", "TEXTO", null)
                ), 160, 300),
                node("reclamo-inspeccion", Nodo.TipoNodo.ACTIVIDAD, "Revision tecnica", "d-tecnico", List.of("Funcionario Tecnico"), List.of(
                        field("diagnostico", "Diagnostico", "TEXTO", null),
                        field("resultado", "Resultado", "SELECCION", List.of("Procede", "No procede"))
                ), 520, 300),
                node("reclamo-decision", Nodo.TipoNodo.DECISION, "El reclamo procede?", "d-tecnico", List.of(), List.of(), 555, 500),
                node("reclamo-compensacion", Nodo.TipoNodo.ACTIVIDAD, "Gestionar compensacion", "d-aprobacion", List.of("Funcionario 3"), List.of(
                        field("compensacion", "Compensacion propuesta", "TEXTO", null)
                ), 880, 260),
                node("reclamo-cierre", Nodo.TipoNodo.ACTIVIDAD, "Comunicacion al cliente", "d-aprobacion", List.of("Funcionario 3"), List.of(
                        field("respuesta", "Respuesta enviada", "TEXTO", null)
                ), 880, 560),
                node("reclamo-fin", Nodo.TipoNodo.FIN, "Fin", "d-aprobacion", List.of(), List.of(), 1180, 420)
        ));
        policy.setConexiones(List.of(
                conn("reclamo-c1", "reclamo-inicio", "reclamo-registro", "DEFAULT"),
                conn("reclamo-c2", "reclamo-registro", "reclamo-inspeccion", "DEFAULT"),
                conn("reclamo-c3", "reclamo-inspeccion", "reclamo-decision", "DEFAULT"),
                conn("reclamo-c4", "reclamo-decision", "reclamo-compensacion", "Procede"),
                conn("reclamo-c5", "reclamo-decision", "reclamo-cierre", "No procede"),
                conn("reclamo-c6", "reclamo-compensacion", "reclamo-fin", "DEFAULT"),
                conn("reclamo-c7", "reclamo-cierre", "reclamo-fin", "DEFAULT")
        ));
        return policy;
    }

    private PoliticaDeNegocio buildRenovacionLicenciaPolicy() {
        PoliticaDeNegocio policy = new PoliticaDeNegocio();
        policy.setId("demo-renovacion-licencia");
        policy.setNombre("Demo - Renovacion Licencia de Conducir");
        policy.setDescripcion("Flujo de ejemplo con carga de licencia antigua, foto, certificado medico y comprobantes.");
        policy.setDepartamentos(List.of(
                deptMap("d-atencion", "Recepcion de Documentos", List.of("Funcionario")),
                deptMap("d-tecnico", "Validacion Documental", List.of("Funcionario Tecnico")),
                deptMap("d-caja", "Caja y Entrega", List.of("Funcionario Caja"))
        ));
        policy.setNodos(List.of(
                node("licencia-inicio", Nodo.TipoNodo.INICIO, "Inicio", "d-atencion", List.of(), List.of(), 80, 120),
                node("licencia-recepcion", Nodo.TipoNodo.ACTIVIDAD, "Recepcion de solicitud", "d-atencion", List.of("Funcionario"), List.of(
                        field("cliente", "Nombre del solicitante", "TEXTO", null),
                        field("licencia_antigua", "Foto de licencia antigua", "FOTO", null),
                        field("documento_identidad", "Documento de identidad", "FOTO", null),
                        field("certificado_medico", "Certificado medico", "ARCHIVO", null)
                ), 160, 300),
                node("licencia-validacion", Nodo.TipoNodo.ACTIVIDAD, "Validacion documental", "d-tecnico", List.of("Funcionario Tecnico"), List.of(
                        field("observaciones", "Observaciones", "TEXTO", null),
                        field("resultado", "Resultado", "SELECCION", List.of("Aprobado", "Observado"))
                ), 520, 300),
                node("licencia-decision", Nodo.TipoNodo.DECISION, "Documentos correctos?", "d-tecnico", List.of(), List.of(), 555, 500),
                node("licencia-pago", Nodo.TipoNodo.ACTIVIDAD, "Pago y entrega", "d-caja", List.of("Funcionario Caja"), List.of(
                        field("comprobante_pago", "Comprobante de pago", "ARCHIVO", null),
                        field("numero_licencia", "Numero de licencia renovada", "TEXTO", null)
                ), 880, 260),
                node("licencia-observacion", Nodo.TipoNodo.ACTIVIDAD, "Solicitar correccion", "d-atencion", List.of("Funcionario"), List.of(
                        field("detalle_observacion", "Detalle de observacion", "TEXTO", null),
                        field("documento_corregido", "Documento corregido", "ARCHIVO", null)
                ), 180, 560),
                node("licencia-fin", Nodo.TipoNodo.FIN, "Fin", "d-caja", List.of(), List.of(), 1180, 420)
        ));
        policy.setConexiones(List.of(
                conn("licencia-c1", "licencia-inicio", "licencia-recepcion", "DEFAULT"),
                conn("licencia-c2", "licencia-recepcion", "licencia-validacion", "DEFAULT"),
                conn("licencia-c3", "licencia-validacion", "licencia-decision", "DEFAULT"),
                conn("licencia-c4", "licencia-decision", "licencia-pago", "Aprobado"),
                conn("licencia-c5", "licencia-decision", "licencia-observacion", "Observado"),
                conn("licencia-c6", "licencia-pago", "licencia-fin", "DEFAULT"),
                conn("licencia-c7", "licencia-observacion", "licencia-fin", "DEFAULT")
        ));
        return policy;
    }

    private Departamento departamento(String nombre, String descripcion) {
        Departamento departamento = new Departamento();
        departamento.setNombre(nombre);
        departamento.setDescripcion(descripcion);
        return departamento;
    }

    private void removeLegacyDemoDepartamentos(DepartamentoRepository repository) {
        List<String> fixedIds = List.of("d-atencion", "d-riesgos", "d-aprobacion", "d-tecnico", "d-caja");
        List<String> demoNames = List.of(
                "Atencion al Cliente",
                "Riesgos Crediticios",
                "Direccion General",
                "Revision Tecnica",
                "Caja"
        );
        repository.findAll().stream()
                .filter(departamento -> departamento.getId() != null && !fixedIds.contains(departamento.getId()))
                .filter(departamento -> demoNames.contains(departamento.getNombre()))
                .forEach(departamento -> repository.deleteById(departamento.getId()));
    }

    private void ensureDepartamento(DepartamentoRepository repository, String id, String nombre, String descripcion) {
        Departamento departamento = repository.findById(id).orElseGet(Departamento::new);
        departamento.setId(id);
        departamento.setNombre(nombre);
        departamento.setDescripcion(descripcion);
        repository.save(departamento);
    }

    private void ensureUsuario(UsuarioRepository repository, String username, String email, String password, String rol, String departamentoId) {
        Usuario usuario = repository.findByUsername(username).orElseGet(Usuario::new);
        usuario.setUsername(username);
        usuario.setEmail(email);
        usuario.setPassword(password);
        usuario.setRol(rol);
        usuario.setDepartamentoId(departamentoId);
        repository.save(usuario);
    }

    private Map<String, Object> deptMap(String id, String nombre, List<String> funcionarios) {
        Map<String, Object> dept = new LinkedHashMap<>();
        dept.put("id", id);
        dept.put("nombre", nombre);
        dept.put("funcionariosAsignados", funcionarios);
        return dept;
    }

    private Nodo node(
            String id,
            Nodo.TipoNodo tipo,
            String nombre,
            String departamentoId,
            List<String> funcionarios,
            List<CampoFormulario> campos,
            double x,
            double y
    ) {
        Nodo nodo = new Nodo();
        nodo.setId(id);
        nodo.setTipo(tipo);
        nodo.setNombre(nombre);
        nodo.setDepartamentoId(departamentoId);
        nodo.setFuncionariosAsignados(funcionarios);
        nodo.setCampos(campos);
        nodo.setX(x);
        nodo.setY(y);
        return nodo;
    }

    private CampoFormulario field(String nombre, String etiqueta, String tipo, List<String> opciones) {
        CampoFormulario field = new CampoFormulario();
        field.setNombre(nombre);
        field.setEtiqueta(etiqueta);
        field.setTipo(tipo);
        field.setOpciones(opciones);
        return field;
    }

    private CampoFormulario fieldValue(String nombre, String etiqueta, String tipo, String valor) {
        CampoFormulario field = field(nombre, etiqueta, tipo, null);
        field.setValor(valor);
        return field;
    }

    private Conexion conn(String id, String origenId, String destinoId, String condicion) {
        Conexion conexion = new Conexion();
        conexion.setId(id);
        conexion.setOrigenId(origenId);
        conexion.setDestinoId(destinoId);
        conexion.setCondicion(condicion);
        return conexion;
    }

    private String formularioContenido(Tramite tramite, LogActividad log) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        appendJsonField(json, "tramiteId", tramite.getId());
        json.append(",");
        appendJsonField(json, "cliente", tramite.getCliente());
        json.append(",");
        appendJsonField(json, "nodo", log.getNombreNodo());
        json.append(",");
        appendJsonField(json, "informeIA", log.getInformeIA());
        json.append(",\"campos\":{");
        for (int i = 0; i < log.getDatosFormulario().size(); i++) {
            CampoFormulario campo = log.getDatosFormulario().get(i);
            if (i > 0) {
                json.append(",");
            }
            appendJsonField(json, campo.getNombre(), campo.getValor());
        }
        json.append("}}");
        return json.toString();
    }

    private void appendJsonField(StringBuilder json, String key, String value) {
        json.append("\"").append(escapeJson(key)).append("\":");
        json.append("\"").append(escapeJson(value)).append("\"");
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
