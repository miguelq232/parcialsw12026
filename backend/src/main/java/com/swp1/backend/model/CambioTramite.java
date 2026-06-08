package com.swp1.backend.model;

import java.time.LocalDateTime;

public class CambioTramite {
    private LocalDateTime fechaCambio;
    private String usuario;
    private String nodoId;
    private String nombreNodo;
    private String campoNombre;
    private String etiqueta;
    private String tipo;
    private String valorAnterior;
    private String valorNuevo;
    private String archivoNombreAnterior;
    private String archivoNombreNuevo;
    private String archivoUrlAnterior;
    private String archivoUrlNuevo;

    public LocalDateTime getFechaCambio() { return fechaCambio; }
    public void setFechaCambio(LocalDateTime fechaCambio) { this.fechaCambio = fechaCambio; }
    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }
    public String getNodoId() { return nodoId; }
    public void setNodoId(String nodoId) { this.nodoId = nodoId; }
    public String getNombreNodo() { return nombreNodo; }
    public void setNombreNodo(String nombreNodo) { this.nombreNodo = nombreNodo; }
    public String getCampoNombre() { return campoNombre; }
    public void setCampoNombre(String campoNombre) { this.campoNombre = campoNombre; }
    public String getEtiqueta() { return etiqueta; }
    public void setEtiqueta(String etiqueta) { this.etiqueta = etiqueta; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getValorAnterior() { return valorAnterior; }
    public void setValorAnterior(String valorAnterior) { this.valorAnterior = valorAnterior; }
    public String getValorNuevo() { return valorNuevo; }
    public void setValorNuevo(String valorNuevo) { this.valorNuevo = valorNuevo; }
    public String getArchivoNombreAnterior() { return archivoNombreAnterior; }
    public void setArchivoNombreAnterior(String archivoNombreAnterior) { this.archivoNombreAnterior = archivoNombreAnterior; }
    public String getArchivoNombreNuevo() { return archivoNombreNuevo; }
    public void setArchivoNombreNuevo(String archivoNombreNuevo) { this.archivoNombreNuevo = archivoNombreNuevo; }
    public String getArchivoUrlAnterior() { return archivoUrlAnterior; }
    public void setArchivoUrlAnterior(String archivoUrlAnterior) { this.archivoUrlAnterior = archivoUrlAnterior; }
    public String getArchivoUrlNuevo() { return archivoUrlNuevo; }
    public void setArchivoUrlNuevo(String archivoUrlNuevo) { this.archivoUrlNuevo = archivoUrlNuevo; }
}
