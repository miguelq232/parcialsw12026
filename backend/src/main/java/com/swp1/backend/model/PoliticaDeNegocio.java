package com.swp1.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;

@Document(collection = "politicas")
public class PoliticaDeNegocio {
    @Id
    private String id;
    private String nombre;
    private String descripcion;
    private List<Nodo> nodos;
    private List<Conexion> conexiones;
    private List<java.util.Map<String, String>> departamentos;

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public List<Nodo> getNodos() { return nodos; }
    public void setNodos(List<Nodo> nodos) { this.nodos = nodos; }
    public List<Conexion> getConexiones() { return conexiones; }
    public void setConexiones(List<Conexion> conexiones) { this.conexiones = conexiones; }
    public List<java.util.Map<String, String>> getDepartamentos() { return departamentos; }
    public void setDepartamentos(List<java.util.Map<String, String>> departamentos) { this.departamentos = departamentos; }
}
