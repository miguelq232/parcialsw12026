package com.swp1.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "tramites")
public class Tramite {
    @Id
    private String id;
    private String politicaId;
    private String nodoActualId;
    private String estado; // PENDIENTE, EN_PROCESO, FINALIZADO
    private String cliente;
    private LocalDateTime fechaInicio;
    private List<LogActividad> historial;

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPoliticaId() { return politicaId; }
    public void setPoliticaId(String politicaId) { this.politicaId = politicaId; }
    public String getNodoActualId() { return nodoActualId; }
    public void setNodoActualId(String nodoActualId) { this.nodoActualId = nodoActualId; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }
    public LocalDateTime getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(LocalDateTime fechaInicio) { this.fechaInicio = fechaInicio; }
    public List<LogActividad> getHistorial() { return historial; }
    public void setHistorial(List<LogActividad> historial) { this.historial = historial; }
}
