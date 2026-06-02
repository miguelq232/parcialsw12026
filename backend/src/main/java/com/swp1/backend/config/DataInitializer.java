package com.swp1.backend.config;

import com.swp1.backend.model.CampoFormulario;
import com.swp1.backend.model.Conexion;
import com.swp1.backend.model.Departamento;
import com.swp1.backend.model.LogActividad;
import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.model.Tramite;
import com.swp1.backend.model.Usuario;
import com.swp1.backend.repository.DepartamentoRepository;
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

    @Value("${app.demo.bulk-tramites.count:45}")
    private int bulkDemoTramitesCount;

    @Bean
    CommandLineRunner initDatabase(
            DepartamentoRepository departamentoRepository,
            UsuarioRepository usuarioRepository,
            PoliticaRepository politicaRepository,
            TramiteRepository tramiteRepository,
            WorkflowEngineService workflowEngineService
    ) {
        return args -> {
            seedDepartamentos(departamentoRepository);
            seedUsuarios(usuarioRepository);
            seedDemoData(politicaRepository, tramiteRepository, workflowEngineService);
        };
    }

    private void seedDepartamentos(DepartamentoRepository repository) {
        if (repository.count() > 0) return;

        repository.save(departamento("Atencion al Cliente", "Recepcion, validacion inicial y contacto con clientes."));
        repository.save(departamento("Riesgos Crediticios", "Revision financiera, score y evaluacion de riesgo."));
        repository.save(departamento("Direccion General", "Aprobaciones finales y decisiones excepcionales."));
        repository.save(departamento("Revision Tecnica", "Inspecciones, peritajes y validaciones operativas."));
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

    private void seedDemoData(
            PoliticaRepository politicaRepository,
            TramiteRepository tramiteRepository,
            WorkflowEngineService workflowEngineService
    ) {
        PoliticaDeNegocio prestamo = politicaRepository.findById("demo-prestamo-personal")
                .orElseGet(() -> politicaRepository.save(buildPrestamoPersonalPolicy()));
        PoliticaDeNegocio reclamo = politicaRepository.findById("demo-reclamo-servicio")
                .orElseGet(() -> politicaRepository.save(buildReclamoServicioPolicy()));
        PoliticaDeNegocio licencia = politicaRepository.findById("demo-renovacion-licencia")
                .orElseGet(() -> politicaRepository.save(buildRenovacionLicenciaPolicy()));

        try {
            workflowEngineService.deployPolitica(prestamo);
            workflowEngineService.deployPolitica(reclamo);
            workflowEngineService.deployPolitica(licencia);
        } catch (Exception e) {
            System.err.println("No se pudieron desplegar las politicas demo: " + e.getMessage());
        }

        seedTramiteNuevoPrestamo(tramiteRepository, workflowEngineService);
        seedTramitePrestamoEnAprobacion(tramiteRepository, workflowEngineService);
        seedTramiteReclamoNuevo(tramiteRepository, workflowEngineService);
        seedTramiteReclamoFinalizado(tramiteRepository, workflowEngineService);
        seedTramiteLicenciaNuevo(tramiteRepository, workflowEngineService);

        if (bulkDemoTramitesEnabled) {
            seedBulkDemoTramites(tramiteRepository, workflowEngineService, Math.max(0, bulkDemoTramitesCount));
        }
    }

    private void seedTramiteNuevoPrestamo(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        if (repository.existsById("demo-tramite-prestamo-nuevo")) return;

        Tramite tramite = startTramite(repository, workflowEngineService,
                "demo-tramite-prestamo-nuevo",
                "demo-prestamo-personal",
                "Cliente Demo - Maria Lopez");
        tramite.setFechaInicio(LocalDateTime.now().minusHours(2));
        repository.save(tramite);
    }

    private void seedTramitePrestamoEnAprobacion(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        if (repository.existsById("demo-tramite-prestamo-aprobacion")) return;

        Tramite tramite = startTramite(repository, workflowEngineService,
                "demo-tramite-prestamo-aprobacion",
                "demo-prestamo-personal",
                "Cliente Demo - Carlos Rojas");

        completeStep(repository, workflowEngineService, tramite,
                "prestamo-solicitud",
                "Registro de solicitud",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Nombre completo", "TEXTO", "Carlos Rojas"),
                        fieldValue("ci", "Documento de identidad", "TEXTO", "7845123"),
                        fieldValue("monto", "Monto solicitado", "NUMERO", "25000")
                ),
                "Cliente registrado con documentacion completa.");

        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", "Aprobado");
        completeStep(repository, workflowEngineService, tramite,
                "prestamo-evaluacion",
                "Evaluacion de riesgo",
                "Funcionario 2",
                decision,
                List.of(
                        fieldValue("ingresos", "Ingresos mensuales", "NUMERO", "8400"),
                        fieldValue("riesgo", "Nivel de riesgo", "SELECCION", "Bajo")
                ),
                "Score suficiente para enviar a aprobacion final.");
    }

    private void seedTramiteReclamoNuevo(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        if (repository.existsById("demo-tramite-reclamo-nuevo")) return;

        Tramite tramite = startTramite(repository, workflowEngineService,
                "demo-tramite-reclamo-nuevo",
                "demo-reclamo-servicio",
                "Cliente Demo - Ana Vargas");
        tramite.setFechaInicio(LocalDateTime.now().minusMinutes(45));
        repository.save(tramite);
    }

    private void seedTramiteReclamoFinalizado(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        if (repository.existsById("demo-tramite-reclamo-finalizado")) return;

        Tramite tramite = startTramite(repository, workflowEngineService,
                "demo-tramite-reclamo-finalizado",
                "demo-reclamo-servicio",
                "Cliente Demo - Luis Perez");

        completeStep(repository, workflowEngineService, tramite,
                "reclamo-registro",
                "Registro del reclamo",
                "Funcionario",
                new HashMap<>(),
                List.of(
                        fieldValue("cliente", "Cliente", "TEXTO", "Luis Perez"),
                        fieldValue("motivo", "Motivo del reclamo", "TEXTO", "Demora en atencion")
                ),
                "Reclamo registrado con prioridad normal.");

        Map<String, Object> decision = new HashMap<>();
        decision.put("outcome", "No procede");
        completeStep(repository, workflowEngineService, tramite,
                "reclamo-inspeccion",
                "Revision tecnica",
                "Funcionario Tecnico",
                decision,
                List.of(
                        fieldValue("diagnostico", "Diagnostico", "TEXTO", "No se evidencia incumplimiento de SLA"),
                        fieldValue("resultado", "Resultado", "SELECCION", "No procede")
                ),
                "No corresponde compensacion segun condiciones del servicio.");

        completeStep(repository, workflowEngineService, tramite,
                "reclamo-cierre",
                "Comunicacion al cliente",
                "Funcionario 3",
                new HashMap<>(),
                List.of(fieldValue("respuesta", "Respuesta enviada", "TEXTO", "Se informo el resultado al cliente.")),
                "Caso cerrado y comunicado.");
    }

    private void seedTramiteLicenciaNuevo(TramiteRepository repository, WorkflowEngineService workflowEngineService) {
        if (repository.existsById("demo-tramite-licencia-nuevo")) return;

        Tramite tramite = startTramite(repository, workflowEngineService,
                "demo-tramite-licencia-nuevo",
                "demo-renovacion-licencia",
                "Cliente Demo - Sofia Medina");
        tramite.setFechaInicio(LocalDateTime.now().minusMinutes(25));
        repository.save(tramite);
    }

    private void seedBulkDemoTramites(TramiteRepository repository, WorkflowEngineService workflowEngineService, int count) {
        for (int index = 1; index <= count; index++) {
            try {
                int tipo = (index - 1) % 3;
                int avance = (index - 1) % 5;
                if (tipo == 0) {
                    seedBulkPrestamo(repository, workflowEngineService, index, avance);
                } else if (tipo == 1) {
                    seedBulkReclamo(repository, workflowEngineService, index, avance);
                } else {
                    seedBulkLicencia(repository, workflowEngineService, index, avance);
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
            int avance
    ) {
        String id = "demo-bulk-prestamo-" + String.format("%03d", index);
        if (repository.existsById(id)) return;

        String cliente = clienteDemo(index);
        LocalDateTime inicio = fechaDemo(index);
        Tramite tramite = startTramite(repository, workflowEngineService, id, "demo-prestamo-personal", cliente);
        tramite.setFechaInicio(inicio);
        repository.save(tramite);

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
                "Solicitud registrada con documentos iniciales completos.",
                inicio.plusHours(1),
                420L + index % 180);

        if (avance == 1) return;

        boolean aprobado = index % 4 != 0;
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
                aprobado ? "Score suficiente para revision final." : "El perfil no cumple los parametros minimos.",
                inicio.plusHours(5),
                900L + index % 360);

        if (avance == 2) return;

        if (aprobado) {
            completeStepAt(repository, workflowEngineService, tramite,
                    "prestamo-aprobacion",
                    "Aprobacion final",
                    "Funcionario 3",
                    new HashMap<>(),
                    List.of(fieldValue("dictamen", "Dictamen", "SELECCION", "Aprobar")),
                    "Prestamo aprobado y notificado para desembolso.",
                    inicio.plusDays(1),
                    600L + index % 240);
        } else {
            completeStepAt(repository, workflowEngineService, tramite,
                    "prestamo-rechazo",
                    "Notificar rechazo",
                    "Funcionario",
                    new HashMap<>(),
                    List.of(fieldValue("motivo", "Motivo comunicado", "TEXTO", "Ingresos insuficientes para el monto solicitado.")),
                    "Rechazo comunicado al cliente.",
                    inicio.plusDays(1),
                    360L + index % 120);
        }
    }

    private void seedBulkReclamo(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            int index,
            int avance
    ) {
        String id = "demo-bulk-reclamo-" + String.format("%03d", index);
        if (repository.existsById(id)) return;

        String cliente = clienteDemo(index + 50);
        LocalDateTime inicio = fechaDemo(index + 7);
        Tramite tramite = startTramite(repository, workflowEngineService, id, "demo-reclamo-servicio", cliente);
        tramite.setFechaInicio(inicio);
        repository.save(tramite);

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
                "Reclamo registrado y asignado a revision tecnica.",
                inicio.plusMinutes(50),
                300L + index % 150);

        if (avance == 1) return;

        boolean procede = index % 3 != 0;
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
                procede ? "Corresponde gestionar compensacion." : "Caso listo para comunicacion de cierre.",
                inicio.plusHours(4),
                780L + index % 240);

        if (avance == 2) return;

        if (procede) {
            completeStepAt(repository, workflowEngineService, tramite,
                    "reclamo-compensacion",
                    "Gestionar compensacion",
                    "Funcionario 3",
                    new HashMap<>(),
                    List.of(fieldValue("compensacion", "Compensacion propuesta", "TEXTO", "Descuento aplicado en el siguiente ciclo.")),
                    "Compensacion registrada y caso finalizado.",
                    inicio.plusDays(1),
                    520L + index % 180);
        } else {
            completeStepAt(repository, workflowEngineService, tramite,
                    "reclamo-cierre",
                    "Comunicacion al cliente",
                    "Funcionario 3",
                    new HashMap<>(),
                    List.of(fieldValue("respuesta", "Respuesta enviada", "TEXTO", "Se comunico el resultado de la revision.")),
                    "Cliente notificado y caso cerrado.",
                    inicio.plusDays(1),
                    410L + index % 160);
        }
    }

    private void seedBulkLicencia(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            int index,
            int avance
    ) {
        String id = "demo-bulk-licencia-" + String.format("%03d", index);
        if (repository.existsById(id)) return;

        String cliente = clienteDemo(index + 100);
        LocalDateTime inicio = fechaDemo(index + 14);
        Tramite tramite = startTramite(repository, workflowEngineService, id, "demo-renovacion-licencia", cliente);
        tramite.setFechaInicio(inicio);
        repository.save(tramite);

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
                "Documentos recibidos para validacion.",
                inicio.plusMinutes(35),
                260L + index % 120);

        if (avance == 1) return;

        boolean aprobado = index % 5 != 0;
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
                aprobado ? "Solicitud habilitada para pago y entrega." : "Se requiere subsanar documentos.",
                inicio.plusHours(3),
                640L + index % 210);

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
                    inicio.plusDays(1),
                    480L + index % 160);
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
                    "Observacion enviada al solicitante.",
                    inicio.plusDays(1),
                    360L + index % 140);
        }
    }

    private Tramite startTramite(
            TramiteRepository repository,
            WorkflowEngineService workflowEngineService,
            String id,
            String politicaId,
            String cliente
    ) {
        Tramite tramite = new Tramite();
        tramite.setId(id);
        tramite.setPoliticaId(politicaId);
        tramite.setCliente(cliente);
        tramite.setEstado("EN_PROCESO");
        tramite.setFechaInicio(LocalDateTime.now().minusMinutes(20));
        tramite.setHistorial(new ArrayList<>());
        tramite = repository.save(tramite);

        workflowEngineService.iniciarTramite(politicaId, tramite.getId());
        tramite.setNodoActualId(workflowEngineService.getNodoActual(tramite.getId()));
        return repository.save(tramite);
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
        tramite.setNodoActualId(workflowEngineService.getNodoActual(tramite.getId()));
        if ("FIN".equals(tramite.getNodoActualId())) {
            tramite.setEstado("FINALIZADO");
        }
        repository.save(tramite);
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
}
