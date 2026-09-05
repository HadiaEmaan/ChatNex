# ChatNex workspace

A production-ready Flask AI platform engineered to unify high-performance local Ollama models and top-tier cloud intelligence into a single seamless workspace with secure enterprise administration.

---

## 🌟 Key Features

1. **Multi-Engine AI Selector**: Switch between local Ollama models and cloud gateways (GPT, Gemma, Gemini) seamlessly.
2. **Temperature Control Slider**: Fine-tune AI response creativity from `0.0` (focused/analytical) to `2.0` (creative/unique).
3. **Secure Enterprise Architecture**:
* Server-side routing with Flask backend handling authentication and API credentials.
* Comprehensive admin dashboard for monitoring user accounts, access blocks, and saved chat conversations.


4. **Interactive Community Feedback Pipeline**: Dynamic submission form and admin-synchronized feedback review interface powered by client-side persistence and a unified design system.

---

## 📁 Project Structure

```
ChatNex/
├── static/
│   ├── css/                 # Admin, authentication, contact, and marketing stylesheets
│   └── js/                  # App interaction, authentication, and marketing scripts
├── templates/               # Jinja2 HTML templates (Landing, Login, Signup, Chatbot, Contact, Feedback, Admin panels)
├── app.py                   # Main Flask server application with database orchestration
├── chatnex.db               # SQLite database persistence layer
├── chatnex.jpg              # Asset cover image
├── requirements.txt         # Python project dependencies
└── README.md                # Documentation

```

---

## 🚀 How to Run

### Flask application

```cmd
python -m pip install -r requirements.txt
python app.py

```

Open `http://localhost:5000` or log in to the admin panel using environment credentials.

### Configuration

Set up your `.env` or environment variables for server credentials and cloud APIs:

```cmd
set FLASK_SECRET_KEY=your-secret-key
set ADMIN_EMAIL=admin@chatnex.local
set ADMIN_PASSWORD=Admin@123
set OPENAI_API_KEY=sk-...
set GEMINI_API_KEY=AIzaSy...

```

---

## 📄 Copyright & Licensing

Copyright (c) 2026 Zain Qamar. All rights reserved.

Unauthorized copying, distribution, modification, public display, or public performance of this software, or any portion of it, is strictly prohibited without prior written permission from the copyright holder.
