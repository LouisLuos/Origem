package com.origem.dto;

import com.origem.model.Notification;
import com.origem.model.Product;

public class PurchaseResult {

    private final Product product;
    private final Notification notification;

    public PurchaseResult(Product product, Notification notification) {
        this.product = product;
        this.notification = notification;
    }

    public Product getProduct() {
        return product;
    }

    public Notification getNotification() {
        return notification;
    }
}
