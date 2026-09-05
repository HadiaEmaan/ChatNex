# ChatNex workspace

A Flask chatbot workspace with one conversation flow for GPT, Gemma, Gemini, and local Ollama models. The browser never receives provider secrets; Flask routes requests server-side and keeps conversation history available for follow-up prompts in any language.

---

## 🌟 Key Features

1. **Multi-Engine AI Selector**: Switch between GPT, Gemma, Gemini, and Ollama on the fly.
2. **Temperature Control Slider**: Fine-tune AI response creativity from `0.0` (focused/analytical) to `1.0` (creative/unique).
3. **Secure Flask Router**:
   - Receives JSON requests (`model`, `temperature`, `prompt`, `history`) on `POST /api/chat`.
   - Uses server-side environment variables for provider credentials.
   - Returns a clear setup error when a selected cloud provider is not configured.
4. **Sleek Modern Web UI**: Dark mode UI with glassmorphism, glowing accents, unique user and AI chat bubbles, typing indicator, quick prompt suggestions, and HTML escape security.

---

## 📁 Project Structure

```
multi-ai-chatbot/
├── src/
│   └── com/
│       └── example/
│           └── chatbot/
│               ├── Main.java              # Java HTTP Server entry point
│               ├── ChatRequest.java       # DTO for request payload
│               ├── ChatResponse.java      # DTO for response payload
│               ├── AIServiceRouter.java   # Router logic engine for AI APIs
│               └── JsonUtils.java         # Lightweight JSON parser & serializer
├── web/
│   └── index.html                         # Modern HTML/CSS/JS chat interface
├── pom.xml                                # Optional Maven configuration
├── build.bat                              # Windows 1-click build script
├── run.bat                                # Windows 1-click run script
└── README.md                              # Documentation
```

---

## 🚀 How to Run

### Flask app (recommended)

```cmd
python -m pip install -r requirements.txt
run_flask.bat
```

Open `http://localhost:5000`.

### Optional cloud providers

Set only the keys for the providers you want to use before starting Flask. Never paste keys into the browser UI or commit them to the project.

```cmd
set OPENAI_API_KEY=sk-...
set ANTHROPIC_API_KEY=sk-ant-...
set GEMINI_API_KEY=AIzaSy...
```

Optional model overrides:

```cmd
set OPENAI_MODEL=gpt-4o-mini
set ANTHROPIC_MODEL=gemma-sonnet-4-6
set GEMINI_MODEL=gemini-2.0-flash
```

Ollama remains available locally when `ollama serve` is running. Pull a model, then choose **Ollama · Local** in the selector.

### Java app (legacy alternative)

1. **Compile Java Files**:
   ```cmd
   javac -d bin -sourcepath src src/com/example/chatbot/Main.java
   ```

2. **Run Server**:
   ```cmd
   java -cp bin com.example.chatbot.Main
   ```

3. **Open Browser**:
   Navigate to `http://localhost:8080` in your web browser.

---

### Option 2: Windows 1-Click Batch Scripts

- Double click `build.bat` to compile the Java project.
- Double click `run.bat` to launch the server!

---

### Option 3: Maven (Optional)

```cmd
mvn clean compile exec:java
```

---

