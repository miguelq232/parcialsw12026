package com.swp1.backend.config;

import com.swp1.backend.model.Departamento;
import com.swp1.backend.repository.DepartamentoRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(DepartamentoRepository repository) {
        return args -> {
            if (repository.count() == 0) {
                Departamento d1 = new Departamento();
                d1.setNombre("Atención al Cliente");
                repository.save(d1);

                Departamento d2 = new Departamento();
                d2.setNombre("Dirección General");
                repository.save(d2);

                Departamento d3 = new Departamento();
                d3.setNombre("Técnico");
                repository.save(d3);
            }
        };
    }
}
