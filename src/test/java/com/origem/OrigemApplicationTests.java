package com.origem;

import com.origem.repository.NotificationRepository;
import com.origem.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class OrigemApplicationTests {

	@Autowired
	private ProductRepository productRepository;

	@Autowired
	private NotificationRepository notificationRepository;

	@Test
	void contextLoads() {
	}

	@Test
	void testDatabaseConnectionAndRepositories() {
		try {
			long productCount = productRepository.count();
			System.out.println(">>> Product table count: " + productCount);
			productRepository.findAll().forEach(p -> System.out.println(">>> Found product: ID=" + p.getId() + ", Name=" + p.getName() + ", Stock=" + p.getStock()));
		} catch (Exception e) {
			System.err.println(">>> Notice on product table: " + e.getMessage());
		}

		try {
			long notificationCount = notificationRepository.count();
			System.out.println(">>> Notification table count: " + notificationCount);
		} catch (Exception e) {
			System.err.println(">>> Notice on notification table: " + e.getMessage());
		}
	}

}

