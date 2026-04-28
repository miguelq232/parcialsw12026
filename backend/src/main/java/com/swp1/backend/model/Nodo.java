package com.swp1.backend.model;

import java.util.List;

public class Nodo {
    public enum TipoNodo {
        INICIO, START,
        ACTIVIDAD, ACTIVITY,
        DECISION,
        FORK,
        JOIN,
        FIN, END
    }

    private String id;
    private TipoNodo tipo;
    private String nombre;
    private String departamentoId;
    private List<CampoFormulario> campos;
    private double x;
    private double y;

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public TipoNodo getTipo() { return tipo; }
    public void setTipo(TipoNodo tipo) { this.tipo = tipo; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDepartamentoId() { return departamentoId; }
    public void setDepartamentoId(String departamentoId) { this.departamentoId = departamentoId; }
    public List<CampoFormulario> getCampos() { return campos; }
    public void setCampos(List<CampoFormulario> campos) { this.campos = campos; }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }
    public double getY() { return y; }
    public void setY(double y) { this.y = y; }
}
