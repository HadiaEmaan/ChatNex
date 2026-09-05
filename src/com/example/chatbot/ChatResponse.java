package com.example.chatbot;

public class ChatResponse {
    private String response;
    private String model;
    private double temperature;

    public ChatResponse() {}

    public ChatResponse(String response) {
        this.response = response;
    }

    public ChatResponse(String response, String model, double temperature) {
        this.response = response;
        this.model = model;
        this.temperature = temperature;
    }

    public String getResponse() { return response; }
    public void setResponse(String response) { this.response = response; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }
}
