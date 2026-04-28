package com.swp1.backend.controller;

import com.swp1.backend.model.Formulario;
import com.swp1.backend.repository.FormularioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/formularios")
@CrossOrigin(origins = "*")
public class FormularioController {

    @Autowired
    private FormularioRepository formularioRepository;

    @GetMapping
    public List<Formulario> getAll() {
        return formularioRepository.findAll();
    }

    @PostMapping
    public Formulario create(@RequestBody Formulario formulario) {
        return formularioRepository.save(formulario);
    }

    @GetMapping("/tramite/{tramiteId}")
    public List<Formulario> getByTramite(@PathVariable String tramiteId) {
        return formularioRepository.findByTramiteId(tramiteId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Formulario> getById(@PathVariable String id) {
        return formularioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
