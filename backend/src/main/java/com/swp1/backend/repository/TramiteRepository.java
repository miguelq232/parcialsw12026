package com.swp1.backend.repository;

import com.swp1.backend.model.Tramite;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TramiteRepository extends MongoRepository<Tramite, String> {
    List<Tramite> findByNodoActualIdIn(List<String> nodoIds);
}
