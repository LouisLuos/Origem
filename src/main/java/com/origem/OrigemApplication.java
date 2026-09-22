package com.origem;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class OrigemApplication {

	public static void main(String[] args) {
		SpringApplication.run(OrigemApplication.class, args);
	}

}
