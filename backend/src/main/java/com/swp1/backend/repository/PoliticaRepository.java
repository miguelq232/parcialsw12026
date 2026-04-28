package com.swp1.backend.repository;

import com.swp1.backend.model.PoliticaDeNegocio;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PoliticaRepository extends MongoRepository<PoliticaDeNegocio, String> {
}
