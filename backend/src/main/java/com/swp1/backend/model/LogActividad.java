package com.swp1.backend.model;

import java.time.LocalDateTime;
import java.util.List;

public class LogActividad {
    private String nodoId;
    private String nombreNodo;
    private String usuario;
    private LocalDateTime fechaCompletado;
    private List<CampoFormulario> datosFormulario;
    private String informeIA;
    private Long duracionSegundos;

    // Getters and Setters
    public Long getDuracionSegundos() { return duracionSegundos; }
    public void setDuracionSegundos(Long duracionSegundos) { this.duracionSegundos = duracionSegundos; }
    
    public String getNodoId() { return nodoId; }
    public void setNodoId(String nodoId) { this.nodoId = nodoId; }
    public String getNombreNodo() { return nombreNodo; }
    public void setNombreNodo(String nombreNodo) { this.nombreNodo = nombreNodo; }
    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }
    public LocalDateTime getFechaCompletado() { return fechaCompletado; }
    public void setFechaCompletado(LocalDateTime fechaCompletado) { this.fechaCompletado = fechaCompletado; }
    public List<CampoFormulario> getDatosFormulario() { return datosFormulario; }
    public void setDatosFormulario(List<CampoFormulario> datosFormulario) { this.datosFormulario = datosFormulario; }
    public String getInformeIA() { return informeIA; }
    public void setInformeIA(String informeIA) { this.informeIA = informeIA; }
}
