package com.swp1.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "formularios")
public class Formulario {
    @Id
    private String id;
    private String tramiteId;
    private String nodoId;
    private String usuarioId;
    private String contenido; // JSON o texto del informe
    private long tiempoAtencion; // en segundos o minutos
    private LocalDateTime fechaCreacion;

    public Formulario() {
        this.fechaCreacion = LocalDateTime.now();
    }

    public Formulario(String tramiteId, String nodoId, String usuarioId, String contenido) {
        this();
        this.tramiteId = tramiteId;
        this.nodoId = nodoId;
        this.usuarioId = usuarioId;
        this.contenido = contenido;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTramiteId() { return tramiteId; }
    public void setTramiteId(String tramiteId) { this.tramiteId = tramiteId; }
    public String getNodoId() { return nodoId; }
    public void setNodoId(String nodoId) { this.nodoId = nodoId; }
    public String getUsuarioId() { return usuarioId; }
    public void setUsuarioId(String usuarioId) { this.usuarioId = usuarioId; }
    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }
    public long getTiempoAtencion() { return tiempoAtencion; }
    public void setTiempoAtencion(long tiempoAtencion) { this.tiempoAtencion = tiempoAtencion; }
    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
}
