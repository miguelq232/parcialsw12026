package com.swp1.backend;

import org.flowable.engine.RuntimeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
@RestController
public class BackendApplication {

	@Autowired
	private RuntimeService runtimeService;

	@Autowired
	private MongoTemplate mongoTemplate;

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

	@GetMapping("/")
	public Map<String, Object> hello() {
		return Map.of(
			"message", "SWP1 Backend is running!",
			"database", "MongoDB",
			"workflowEngine", "Flowable " + runtimeService.getClass().getSimpleName(),
			"mongoStatus", mongoTemplate.getDb().getName()
		);
	}
}
