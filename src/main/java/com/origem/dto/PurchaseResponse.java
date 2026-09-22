package com.origem.dto;

public class PurchaseResponse {

    private boolean success;
    private String message;
    private String productId;
    private String productName;
    private Integer remainingStock;

    public PurchaseResponse() {
    }

    public static PurchaseResponse success(String productId, String productName, Integer remainingStock) {
        PurchaseResponse response = new PurchaseResponse();
        response.success = true;
        response.message = "Compra realizada com sucesso!";
        response.productId = productId;
        response.productName = productName;
        response.remainingStock = remainingStock;
        return response;
    }

    public static PurchaseResponse failure(String productId, String message) {
        PurchaseResponse response = new PurchaseResponse();
        response.success = false;
        response.message = message;
        response.productId = productId;
        return response;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public Integer getRemainingStock() {
        return remainingStock;
    }

    public void setRemainingStock(Integer remainingStock) {
        this.remainingStock = remainingStock;
    }
}
