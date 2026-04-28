package com.swp1.backend.controller;

import com.swp1.backend.model.Departamento;
import com.swp1.backend.repository.DepartamentoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departamentos")
@CrossOrigin(origins = "*") // Para desarrollo con Frontend
public class DepartamentoController {

    @Autowired
    private DepartamentoRepository departamentoRepository;

    @GetMapping
    public List<Departamento> getAll() {
        return departamentoRepository.findAll();
    }

    @PostMapping
    public Departamento create(@RequestBody Departamento departamento) {
        return departamentoRepository.save(departamento);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Departamento> getById(@PathVariable String id) {
        return departamentoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        if (departamentoRepository.existsById(id)) {
            departamentoRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
