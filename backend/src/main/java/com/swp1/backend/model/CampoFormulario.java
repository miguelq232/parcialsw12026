package com.swp1.backend.model;

import java.util.List;

public class CampoFormulario {
    private String nombre;
    private String etiqueta;
    private String tipo; // TEXTO, NUMERO, FECHA, AREA_TEXTO, SELECCION, FOTO
    private String valor;
    private List<String> opciones; // Para SELECCION

    // Getters and Setters
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getEtiqueta() { return etiqueta; }
    public void setEtiqueta(String etiqueta) { this.etiqueta = etiqueta; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getValor() { return valor; }
    public void setValor(String valor) { this.valor = valor; }
    public List<String> getOpciones() { return opciones; }
    public void setOpciones(List<String> opciones) { this.opciones = opciones; }
}
