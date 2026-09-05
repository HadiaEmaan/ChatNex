import os
import json
import time
import urllib.request
import urllib.error
import urllib.parse
import socket
import secrets
import sqlite3
import hashlib
import hmac
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, redirect, session, url_for, send_file
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _load_env_file():
    env_path = os.path.join(BASE_DIR, '.env')
    if not os.path.isfile(env_path):
        return
    with open(env_path, encoding='utf-8') as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)

_load_env_file()

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'chatnex-development-secret-change-me')

DATABASE_PATH = os.path.join(BASE_DIR, 'chatnex.db')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@chatnex.local')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'Admin@123')
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5000/auth/google/callback')

def _password_hash(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def _db_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def _init_database():
    with _db_connection() as connection:
        connection.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                blocked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS chat_shares (
                token TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                transcript TEXT NOT NULL,
                messages_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                client_id TEXT NOT NULL,
                title TEXT NOT NULL,
                messages_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_email, client_id)
            )
        ''')

_init_database()

OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'qwen2.5:3b')

PROVIDER_MODELS = {
    'gpt': 'openai/gpt-4o-mini',
    'gemma': 'google/gemma-4-26b-a4b-it',
    'gemini': 'google/gemini-3.8-flash',
}

KEEP_ALIVE = os.getenv('OLLAMA_KEEP_ALIVE', '30m')

CONNECT_TIMEOUT = 5
READ_TIMEOUT = 480
MAX_RETRIES = 0
RETRY_DELAY = 1.5

def _ollama_request(path, payload=None, method='GET', timeout=CONNECT_TIMEOUT):
    url = f'{OLLAMA_URL}{path}'
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    headers = {'Content-Type': 'application/json'} if payload is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))

def get_available_models():
    result = _ollama_request('/api/tags', method='GET', timeout=CONNECT_TIMEOUT)
    return [m.get('name') for m in result.get('models', [])]

def _messages(prompt, system_prompt, history):
    messages = [{'role': 'system', 'content': system_prompt}]
    for item in history[-12:]:
        sender = item.get('sender') or item.get('role')
        text = str(item.get('text') or item.get('content') or '').strip()
        if text and sender in ('user', 'human', 'ai', 'assistant', 'bot'):
            messages.append({'role': 'user' if sender in ('user', 'human') else 'assistant',
                           'content': text})
    messages.append({'role': 'user', 'content': prompt})
    return messages

def _cloud_request(provider, messages, temperature, max_tokens):
    if provider not in PROVIDER_MODELS:
        raise ValueError(f'Unknown provider: {provider}')
    
    api_key = os.getenv('OPENAI_API_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('OpenRouter API key is not configured on the server.')
        
    model_id = PROVIDER_MODELS[provider]
    
    payload = {
        'model': model_id,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens
    }
    
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': 'http://localhost:5000',
            'X-Title': 'MultiModel App'
        },
        method='POST'
    )
    
    with urllib.request.urlopen(req, timeout=READ_TIMEOUT) as response:
        result = json.loads(response.read().decode('utf-8'))
        
    content = result['choices'][0]['message']['content']
    return content, model_id

def _ollama_chat(messages, temperature, max_tokens, model=None):
    selected_model = model or DEFAULT_MODEL
    available = get_available_models()
    if available and selected_model not in available:
        selected_model = available[0]
    payload = {
        'model': selected_model,
        'messages': messages,
        'stream': False,
        'keep_alive': KEEP_ALIVE,
        'options': {
            'temperature': max(0.0, min(2.0, temperature)),
            'num_predict': max_tokens,
            'num_ctx': 2048,
            'num_thread': int(os.getenv('OLLAMA_NUM_THREAD', 4))
        }
    }
    result = _ollama_request('/api/chat', payload=payload, method='POST', timeout=READ_TIMEOUT)
    answer = ((result.get('message') or {}).get('content') or '').strip()
    if not answer:
        raise RuntimeError('Local Ollama model returned an empty response.')
    return answer, selected_model

@app.route('/')
def index():
    return render_template('landing.html')

@app.route('/chatnex.jpg')
def chatnex_cover():
    return send_file(os.path.join(BASE_DIR, 'chatnex.jpg'), mimetype='image/jpeg')

@app.route('/chatbot')
def chatbot():
    user_email = session.get('user_email')
    share_token = request.args.get('share', '').strip()
    if not user_email:
        if not share_token:
            return redirect(url_for('login'))
        with _db_connection() as connection:
            shared = connection.execute('SELECT 1 FROM chat_shares WHERE token = ?', (share_token,)).fetchone()
        if not shared:
            return redirect(url_for('login'))
        return render_template('index.html', shared_preview=True, shared_authenticated=False)
    with _db_connection() as connection:
        user = connection.execute('SELECT blocked FROM users WHERE email = ?', (user_email,)).fetchone()
    if not user or user['blocked']:
        session.pop('user_email', None)
        return redirect(url_for('login'))
    return render_template('index.html', shared_preview=bool(share_token), shared_authenticated=True)

@app.route('/login')
def login():
    next_url = request.args.get('next', '')
    if next_url.startswith('/') and not next_url.startswith('//'):
        session['next_after_login'] = next_url
    return render_template('login.html')

@app.route('/auth/google')
def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return render_template('login.html', error='Google login is not configured.'), 503
    state = secrets.token_urlsafe(24)
    session['google_oauth_state'] = state
    params = urllib.parse.urlencode({
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'access_type': 'offline',
        'prompt': 'select_account'
    })
    return redirect(f'https://accounts.google.com/o/oauth2/v2/auth?{params}')

@app.route('/auth/google/callback')
def google_callback():
    if request.args.get('state') != session.pop('google_oauth_state', None):
        return 'Invalid Google login state.', 400
    code = request.args.get('code')
    if not code:
        return redirect(url_for('login'))
    token_payload = urllib.parse.urlencode({
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code'
    }).encode('utf-8')
    token_request = urllib.request.Request(
        'https://oauth2.googleapis.com/token', data=token_payload,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'
    )
    try:
        with urllib.request.urlopen(token_request, timeout=CONNECT_TIMEOUT) as response:
            tokens = json.loads(response.read().decode('utf-8'))
        profile_request = urllib.request.Request(
            'https://openidconnect.googleapis.com/v1/userinfo',
            headers={'Authorization': f"Bearer {tokens['access_token']}"}
        )
        with urllib.request.urlopen(profile_request, timeout=CONNECT_TIMEOUT) as response:
            profile = json.loads(response.read().decode('utf-8'))
    except (urllib.error.HTTPError, urllib.error.URLError, KeyError, json.JSONDecodeError):
        return render_template('login.html', error='Google login could not be completed.'), 502

    email = str(profile.get('email', '')).strip().lower()
    if not email or not profile.get('email_verified', False):
        return render_template('login.html', error='Google email not verified.'), 400
    if email == ADMIN_EMAIL.lower():
        session['admin_authenticated'] = True
        return redirect(url_for('admin_dashboard'))

    first_name = str(profile.get('given_name') or profile.get('name') or 'Google').strip()
    last_name = str(profile.get('family_name') or '').strip()
    with _db_connection() as connection:
        user = connection.execute('SELECT blocked FROM users WHERE email = ?', (email,)).fetchone()
        if user and user['blocked']:
            return render_template('login.html', error='Account blocked.'), 403
        if not user:
            connection.execute(
                'INSERT INTO users (first_name, last_name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
                (first_name, last_name, email, _password_hash(secrets.token_urlsafe(32)), datetime.now(timezone.utc).isoformat())
            )
    session['user_email'] = email
    next_url = session.pop('next_after_login', None)
    return redirect(next_url or url_for('index'))

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/services')
def services():
    return render_template('services.html')

@app.route('/pricing')
def pricing():
    return render_template('pricing.html')

@app.route('/feedback')
def feedback():
    return render_template('feedback.html')

@app.route('/shared/<token>')
def shared_chat(token):
    with _db_connection() as connection:
        shared = connection.execute(
            'SELECT title, transcript, created_at FROM chat_shares WHERE token = ?', (token,)
        ).fetchone()
    if not shared:
        return render_template('shared_chat.html', shared=None), 404
    return render_template('shared_chat.html', shared=shared, token=token)

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    return redirect(url_for('login'))

@app.route('/admin')
def admin_dashboard():
    if not session.get('admin_authenticated'):
        return redirect(url_for('login'))
    return render_template('admin.html', user_folders=_admin_user_folders(), admin_email=ADMIN_EMAIL)

def _admin_user_folders():
    with _db_connection() as connection:
        users = connection.execute(
            'SELECT id, first_name, last_name, email, blocked, created_at FROM users ORDER BY id DESC'
        ).fetchall()
        conversations = connection.execute(
            'SELECT user_email, client_id, title, messages_json, updated_at FROM conversations ORDER BY updated_at DESC'
        ).fetchall()
    conversation_map = {}
    for conversation in conversations:
        conversation_map.setdefault(conversation['user_email'], []).append({
            'client_id': conversation['client_id'],
            'title': conversation['title'],
            'messages': json.loads(conversation['messages_json']),
            'updated_at': conversation['updated_at']
        })
    user_folders = []
    for user in users:
        user_folders.append({
            'user': user,
            'conversations': conversation_map.get(user['email'], [])
        })
    return user_folders

@app.route('/admin/users')
def admin_users():
    if not session.get('admin_authenticated'):
        return redirect(url_for('login'))
    return render_template('admin_users.html', user_folders=_admin_user_folders(), admin_email=ADMIN_EMAIL)

@app.route('/admin/conversations')
def admin_conversations():
    if not session.get('admin_authenticated'):
        return redirect(url_for('login'))
    folders = _admin_user_folders()
    return render_template('admin_conversations.html', user_folders=folders, admin_email=ADMIN_EMAIL)

@app.post('/admin/users/<int:user_id>/toggle-block')
def toggle_user_block(user_id):
    if not session.get('admin_authenticated'):
        return redirect(url_for('login'))
    with _db_connection() as connection:
        connection.execute('UPDATE users SET blocked = CASE blocked WHEN 1 THEN 0 ELSE 1 END WHERE id = ?', (user_id,))
    return redirect(url_for('admin_dashboard'))

@app.post('/admin/logout')
def admin_logout():
    session.pop('admin_authenticated', None)
    return redirect(url_for('login'))

@app.post('/api/auth/signup')
def signup_api():
    data = request.get_json(silent=True) or {}
    first_name = str(data.get('first_name', '')).strip()
    last_name = str(data.get('last_name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    if not first_name or not last_name or not email or len(password) < 8:
        return jsonify({'error': 'Please complete all fields. Password must be at least 8 characters.'}), 400
    if hmac.compare_digest(email, ADMIN_EMAIL.lower()):
        return jsonify({'error': 'Reserved for admin.'}), 409
    try:
        with _db_connection() as connection:
            connection.execute(
                'INSERT INTO users (first_name, last_name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
                (first_name, last_name, email, _password_hash(password), datetime.now(timezone.utc).isoformat())
            )
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already exists.'}), 409
    session['user_email'] = email
    return jsonify({'name': first_name, 'email': email})

@app.post('/api/auth/login')
def login_api():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    if hmac.compare_digest(email, ADMIN_EMAIL.lower()) and hmac.compare_digest(password, ADMIN_PASSWORD):
        session.pop('user_email', None)
        session['admin_authenticated'] = True
        session.pop('next_after_login', None)
        return jsonify({'name': 'Admin', 'email': email, 'role': 'admin'})

    session.pop('admin_authenticated', None)
    with _db_connection() as connection:
        user = connection.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not user or not hmac.compare_digest(user['password_hash'], _password_hash(password)):
        return jsonify({'error': 'Invalid email or password.'}), 401
    if user['blocked']:
        return jsonify({'error': 'Account blocked.'}), 403
    session['user_email'] = email
    next_url = session.pop('next_after_login', None)
    return jsonify({'name': user['first_name'], 'email': email, 'role': 'user', 'next': next_url})

@app.post('/api/auth/logout')
def logout_api():
    session.pop('user_email', None)
    session.pop('admin_authenticated', None)
    return jsonify({'ok': True})

@app.post('/api/conversations')
def save_conversation():
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json(silent=True) or {}
    client_id = str(data.get('client_id', '')).strip()
    title = str(data.get('title', 'Untitled conversation')).strip() or 'Untitled conversation'
    messages = data.get('messages') or []
    if not client_id or not messages:
        return jsonify({'error': 'Incomplete data'}), 400
    updated_at = datetime.now(timezone.utc).isoformat()
    with _db_connection() as connection:
        connection.execute('''
            INSERT INTO conversations (user_email, client_id, title, messages_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_email, client_id) DO UPDATE SET
                title = excluded.title,
                messages_json = excluded.messages_json,
                updated_at = excluded.updated_at
        ''', (user_email, client_id, title, json.dumps(messages), updated_at))
    return jsonify({'ok': True, 'updated_at': updated_at})

@app.post('/api/shares')
def create_share():
    if not session.get('user_email'):
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json(silent=True) or {}
    title = str(data.get('title', 'Shared Chat')).strip() or 'Shared Chat'
    transcript = str(data.get('transcript', '')).strip()
    messages = data.get('messages') or []
    if not transcript or not messages:
        return jsonify({'error': 'No content to share'}), 400
    token = secrets.token_urlsafe(16)
    with _db_connection() as connection:
        connection.execute(
            'INSERT INTO chat_shares (token, title, transcript, messages_json, created_at) VALUES (?, ?, ?, ?, ?)',
            (token, title, transcript, json.dumps(messages), datetime.now(timezone.utc).isoformat())
        )
    return jsonify({'url': url_for('shared_chat', token=token, _external=True), 'token': token})

@app.get('/api/shares/<token>')
def get_shared_chat(token):
    with _db_connection() as connection:
        shared = connection.execute(
            'SELECT title, messages_json FROM chat_shares WHERE token = ?', (token,)
        ).fetchone()
    if not shared:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'title': shared['title'], 'messages': json.loads(shared['messages_json'])})

@app.route('/api/health', methods=['GET'])
def health():
    try:
        models = get_available_models()
        return jsonify({'online': True, 'models': models})
    except Exception as e:
        return jsonify({'online': False, 'error': str(e)}), 503

@app.route('/api/models', methods=['GET'])
def models_list():
    try:
        models = [{'id': key, 'name': value, 'configured': bool(os.getenv('OPENAI_API_KEY') or os.getenv('GEMINI_API_KEY'))}
                  for key, value in PROVIDER_MODELS.items()]
        try:
            models.append({'id': 'ollama', 'name': DEFAULT_MODEL, 'configured': bool(get_available_models())})
        except Exception:
            pass
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'models': [], 'error': str(e)}), 503

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        prompt = str(data.get('prompt', '')).strip()
        temperature = float(data.get('temperature', 0.7))
        system_prompt = str(data.get('system_prompt') or 'You are a helpful, accurate AI assistant. Answer naturally and clearly.')
        history = data.get('history') or []
        model = str(data.get('model') or 'gpt').strip().lower()

        if not prompt:
            return jsonify({'error': 'Prompt cannot be empty'}), 400

        if model in ('gpt', 'gemma', 'gemini'):
            try:
                answer, resolved_model = _cloud_request(
                    model, _messages(prompt, system_prompt, history),
                    max(0.0, min(2.0, temperature)), int(data.get('max_tokens', 700)))
                return jsonify({'response': answer.strip(), 'model': resolved_model,
                                'provider': model, 'temperature': temperature})
            except RuntimeError as e:
                if 'API_KEY is not configured' not in str(e):
                    return jsonify({'error': str(e)}), 503
                try:
                    answer, resolved_model = _ollama_chat(
                        _messages(prompt, system_prompt, history),
                        temperature, int(data.get('max_tokens', 700)))
                    return jsonify({
                        'response': answer,
                        'model': resolved_model,
                        'provider': 'ollama-fallback',
                        'fallback_from': model,
                        'notice': f'{model} key missing; answered with local Ollama model.',
                        'temperature': temperature
                    })
                except Exception as fallback_error:
                    return jsonify({'error': f'{e} Local fallback unavailable: {fallback_error}'}), 503
            except urllib.error.HTTPError as e:
                detail = e.read().decode('utf-8', errors='replace')
                return jsonify({'error': f'{model} API error ({e.code}): {detail}'}), 502
            except Exception as e:
                return jsonify({'error': str(e)}), 503

        if model != 'ollama':
            return jsonify({'error': f'Unknown model provider: {model}'}), 400

        model = str(data.get('ollama_model') or DEFAULT_MODEL).strip()

        try:
            available = get_available_models()
        except Exception:
            available = None

        if available is not None and model not in available:
            return jsonify({
                'error': f"Model '{model}' Ollama mein pulled nahi hai.",
                'available_models': available,
                'fix': f'Terminal mein chalao: ollama pull {model}'
            }), 404

        messages = _messages(prompt, system_prompt, history)

        payload = {
            'model': model,
            'messages': messages,
            'stream': False,
            'keep_alive': KEEP_ALIVE,
            'options': {
                'temperature': max(0.0, min(2.0, temperature)),
                'num_predict': int(data.get('max_tokens', 256)),
                'num_ctx': int(data.get('num_ctx', 1024)),
                'num_thread': int(os.getenv('OLLAMA_NUM_THREAD', 4))
            }
        }

        result = _ollama_request('/api/chat', payload=payload, method='POST', timeout=READ_TIMEOUT)
        answer = ((result.get('message') or {}).get('content') or '').strip()
        if not answer:
            return jsonify({'error': 'Model ne khaali response diya.'}), 502

        return jsonify({
            'response': answer,
            'model': model,
            'temperature': temperature
        })

    except Exception as e:
        app.logger.exception('Chat error')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f'ChatNex admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}')
    print('ChatNex admin dashboard: http://127.0.0.1:5000/admin/login')
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=True, threaded=True, use_reloader=False)