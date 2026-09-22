package com.origem.dto;

public class PurchaseRequest {

    private String productId;
    private int quantity;
    private String orderId;

    public PurchaseRequest() {
    }

    public PurchaseRequest(String productId, int quantity) {
        this.productId = productId;
        this.quantity = quantity;
    }

    public PurchaseRequest(String productId, int quantity, String orderId) {
        this.productId = productId;
        this.quantity = quantity;
        this.orderId = orderId;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }
}
