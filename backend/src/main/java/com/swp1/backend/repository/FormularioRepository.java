package com.swp1.backend.repository;

import com.swp1.backend.model.Formulario;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FormularioRepository extends MongoRepository<Formulario, String> {
    List<Formulario> findByTramiteId(String tramiteId);
    List<Formulario> findByUsuarioId(String usuarioId);
}
