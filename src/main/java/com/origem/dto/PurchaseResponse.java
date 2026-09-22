package com.origem.dto;

public class PurchaseResponse {

    private boolean success;
    private String message;
    private String productId;
    private String productName;
    private Integer remainingStock;
    private String orderId;
    private String notificationId;
    private String notificationStatus;

    public PurchaseResponse() {
    }

    public static PurchaseResponse success(String productId, String productName, Integer remainingStock,
                                           String orderId, String notificationId, String notificationStatus) {
        PurchaseResponse response = new PurchaseResponse();
        response.success = true;
        response.message = "Compra realizada com sucesso!";
        response.productId = productId;
        response.productName = productName;
        response.remainingStock = remainingStock;
        response.orderId = orderId;
        response.notificationId = notificationId;
        response.notificationStatus = notificationStatus;
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

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getNotificationId() {
        return notificationId;
    }

    public void setNotificationId(String notificationId) {
        this.notificationId = notificationId;
    }

    public String getNotificationStatus() {
        return notificationStatus;
    }

    public void setNotificationStatus(String notificationStatus) {
        this.notificationStatus = notificationStatus;
    }
}
