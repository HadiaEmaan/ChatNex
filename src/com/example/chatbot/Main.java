package com.example.chatbot;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class Main {

    private static final AIServiceRouter router = new AIServiceRouter();

    public static void main(String[] args) throws IOException {
        int port = 8080;
        String portEnv = System.getenv("PORT");
        if (portEnv != null && !portEnv.isEmpty()) {
            try {
                port = Integer.parseInt(portEnv);
            } catch (NumberFormatException ignored) {}
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Register REST API handler
        server.createContext("/api/chat", new ChatApiHandler());

        // Register static files handler for web frontend
        server.createContext("/", new StaticFileHandler());

        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();

        System.out.println("=================================================");
        System.out.println(" 🚀 Multi-AI Hub Chatbot Server is RUNNING!");
        System.out.println(" 🌐 Open your browser at: http://localhost:" + port);
        System.out.println(" =================================================");
    }

    static class ChatApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Set CORS Headers
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
                return;
            }

            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes(), StandardCharsets.UTF_8);

                ChatRequest request = JsonUtils.parseChatRequest(body);
                ChatResponse response = router.processRequest(request);

                String jsonResponse = JsonUtils.toJson(response);
                sendJsonResponse(exchange, 200, jsonResponse);
            } catch (Exception e) {
                e.printStackTrace();
                sendJsonResponse(exchange, 500, "{\"error\":\"Internal Server Error: " + JsonUtils.escapeJson(e.getMessage()) + "\"}");
            }
        }

        private void sendJsonResponse(HttpExchange exchange, int statusCode, String responseJson) throws IOException {
            byte[] bytes = responseJson.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(statusCode, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) {
                path = "/index.html";
            }

            // Look up static files in ./web directory or classpath
            File webDir = new File("web");
            File file = new File(webDir, path.substring(1));

            if (!file.exists() || file.isDirectory()) {
                file = new File(webDir, "index.html");
            }

            if (!file.exists()) {
                String error404 = "<h1>404 Not Found</h1><p>Web resources directory not found. Make sure 'web/index.html' exists.</p>";
                exchange.sendResponseHeaders(404, error404.length());
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(error404.getBytes(StandardCharsets.UTF_8));
                }
                return;
            }

            String contentType = getContentType(file.getName());
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, file.length());

            try (FileInputStream fis = new FileInputStream(file);
                 OutputStream os = exchange.getResponseBody()) {
                fis.transferTo(os);
            }
        }

        private String getContentType(String fileName) {
            if (fileName.endsWith(".html")) return "text/html; charset=UTF-8";
            if (fileName.endsWith(".css")) return "text/css";
            if (fileName.endsWith(".js")) return "text/javascript";
            if (fileName.endsWith(".png")) return "image/png";
            if (fileName.endsWith(".jpg")) return "image/jpeg";
            if (fileName.endsWith(".svg")) return "image/svg+xml";
            if (fileName.endsWith(".json")) return "application/json";
            return "text/plain";
        }
    }
}
