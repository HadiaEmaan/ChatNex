package com.example.chatbot;

public class ChatRequest {
    private String model;
    private double temperature;
    private String prompt;

    public ChatRequest() {}

    public ChatRequest(String model, double temperature, String prompt) {
        this.model = model;
        this.temperature = temperature;
        this.prompt = prompt;
    }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }
}
