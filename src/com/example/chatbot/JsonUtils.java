package com.example.chatbot;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class JsonUtils {

    /**
     * Extracts a String field value from a simple JSON string.
     */
    public static String getString(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*\"((?:\\\\\"|[^\"])*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return unescapeJson(matcher.group(1));
        }
        return null;
    }

    /**
     * Extracts a double field value from a simple JSON string.
     */
    public static double getDouble(String json, String key, double defaultValue) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try {
                return Double.parseDouble(matcher.group(1));
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    /**
     * Parses a ChatRequest object from simple JSON input.
     */
    public static ChatRequest parseChatRequest(String json) {
        String model = getString(json, "model");
        double temp = getDouble(json, "temperature", 0.7);
        String prompt = getString(json, "prompt");
        
        if (model == null) model = "chatgpt";
        if (prompt == null) prompt = "";

        return new ChatRequest(model, temp, prompt);
    }

    /**
     * Creates a simple JSON response string.
     */
    public static String toJson(ChatResponse response) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"response\":").append(escapeJson(response.getResponse()));
        if (response.getModel() != null) {
            sb.append(",\"model\":").append(escapeJson(response.getModel()));
        }
        sb.append(",\"temperature\":").append(response.getTemperature());
        sb.append("}");
        return sb.toString();
    }

    public static String escapeJson(String text) {
        if (text == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append("\"");
        return sb.toString();
    }

    public static String unescapeJson(String input) {
        if (input == null) return null;
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < input.length()) {
            char c = input.charAt(i);
            if (c == '\\' && i + 1 < input.length()) {
                char next = input.charAt(i + 1);
                switch (next) {
                    case '"': sb.append('"'); i += 2; break;
                    case '\\': sb.append('\\'); i += 2; break;
                    case 'n': sb.append('\n'); i += 2; break;
                    case 'r': sb.append('\r'); i += 2; break;
                    case 't': sb.append('\t'); i += 2; break;
                    case 'b': sb.append('\b'); i += 2; break;
                    case 'f': sb.append('\f'); i += 2; break;
                    case 'u':
                        if (i + 5 < input.length()) {
                            String hex = input.substring(i + 2, i + 6);
                            try {
                                sb.append((char) Integer.parseInt(hex, 16));
                                i += 6;
                            } catch (NumberFormatException e) {
                                sb.append(c);
                                i++;
                            }
                        } else {
                            sb.append(c);
                            i++;
                        }
                        break;
                    default:
                        sb.append(next);
                        i += 2;
                        break;
                }
            } else {
                sb.append(c);
                i++;
            }
        }
        return sb.toString();
    }
}
