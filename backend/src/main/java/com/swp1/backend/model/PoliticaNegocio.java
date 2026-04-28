package com.swp1.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;
import java.util.ArrayList;

@Document(collection = "politicas")
public class PoliticaNegocio {
    @Id
    private String id;
    private String nombre;
    private String descripcion;
    private List<Nodo> nodos = new ArrayList<>();
    private List<Flujo> flujos = new ArrayList<>();
    private String estado; // "ACTIVA", "INACTIVA"

    public PoliticaNegocio() {}

    public PoliticaNegocio(String nombre, String descripcion) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.estado = "ACTIVA";
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public List<Nodo> getNodos() { return nodos; }
    public void setNodos(List<Nodo> nodos) { this.nodos = nodos; }
    public List<Flujo> getFlujos() { return flujos; }
    public void setFlujos(List<Flujo> flujos) { this.flujos = flujos; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}