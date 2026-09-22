package com.origem.repository;

import com.origem.model.Product;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, String> {

    /**
     * Consulta o produto aplicando bloqueio pessimista exclusivo a nível de banco de dados (SELECT ... FOR UPDATE).
     * Garante que transações concorrentes disputando o mesmo registro aguardem a liberação da transação corrente,
     * prevenindo race conditions e overselling diretamente no PostgreSQL.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") String id);
}
