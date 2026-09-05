document.addEventListener('DOMContentLoaded', () => {
    initParticlesCanvas();

    // DOM Elements
    const heroView = document.getElementById('heroView');
    const messagesView = document.getElementById('messagesView');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');
    const modelSelect = document.getElementById('modelSelect');
    const newChatBtn = document.getElementById('newChatBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn'); // Delete All Chats button
    const settingsBtn = document.getElementById('settingsBtn');
    const backHomeBtn = document.getElementById('backHomeBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeModal = document.getElementById('closeModal');
    const saveSettings = document.getElementById('saveSettings');
    const tempSlider = document.getElementById('tempSlider');
    const tempValDisplay = document.getElementById('tempValDisplay');
    const systemPromptInput = document.getElementById('systemPromptInput');
    const chatHistoryList = document.getElementById('chatHistoryList');
    const continueConversationBtn = document.getElementById('continueConversationBtn');
    const isSharedPreview = document.body.dataset.sharedPreview === 'true';
    const isSharedAuthenticated = document.body.dataset.sharedAuthenticated === 'true';
    let conversationUnlocked = !isSharedPreview;

    if (isSharedPreview) {
        userInput.disabled = true;
        sendBtn.disabled = true;
        micBtn.disabled = true;
        userInput.placeholder = 'Click Continue conversation to reply';
        continueConversationBtn.style.display = 'inline-flex';
    } else {
        continueConversationBtn.style.display = 'none';
    }

    continueConversationBtn.addEventListener('click', () => {
        if (!isSharedAuthenticated) {
            const next = `${window.location.pathname}${window.location.search}`;
            window.location.href = `/login?next=${encodeURIComponent(next)}`;
            return;
        }
        conversationUnlocked = true;
        userInput.disabled = false;
        sendBtn.disabled = false;
        micBtn.disabled = false;
        userInput.placeholder = 'Ask anything...';
        continueConversationBtn.remove();
        userInput.focus();
    });

    let currentTemperature = 0.7;
    let currentSystemPrompt = "You are a helpful AI assistant.";
    
    // Multi-session chat management
    let chats = JSON.parse(localStorage.getItem('NEURO_AI_CHATS') || '[]');
    let currentChatId = null;

    // Render initial sidebar chat sessions
    renderChatHistory();
    loadSharedChatFromLink();

    async function loadSharedChatFromLink() {
        const token = new URLSearchParams(window.location.search).get('share');
        if (!token) return;
        try {
            const response = await fetch(`/api/shares/${encodeURIComponent(token)}`);
            const shared = await response.json();
            if (!response.ok) throw new Error(shared.error || 'Shared chat not found.');
            const chatId = `shared_${token}`;
            const sharedChat = { id: chatId, title: shared.title, messages: shared.messages, createdAt: new Date().toISOString() };
            chats = [sharedChat, ...chats.filter(chat => chat.id !== chatId)];
            saveChatsToStorage();
            loadChatSession(chatId);
        } catch (error) {
            showToast(error.message);
        }
    }

    // Temperature Slider Listener
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            currentTemperature = parseFloat(e.target.value);
            tempValDisplay.textContent = currentTemperature.toFixed(1);
        });
    }

    // Modal Controls
    if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.classList.add('open'));
    if (backHomeBtn) backHomeBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
    if (closeModal) closeModal.addEventListener('click', () => settingsModal.classList.remove('open'));
    if (saveSettings) saveSettings.addEventListener('click', () => {
        currentSystemPrompt = systemPromptInput.value.trim();
        showToast("Settings saved!");
        settingsModal.classList.remove('open');
    });

    // Close any open 3-dots dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-item-wrapper')) {
            document.querySelectorAll('.chat-dropdown-menu').forEach(m => m.classList.remove('show'));
        }
    });

    // Auto-expand textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    });

    // Keydown listener
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    sendBtn.addEventListener('click', handleSend);

    // + New Chat Action
    newChatBtn.addEventListener('click', startNewChat);

    function startNewChat() {
        currentChatId = null;
        messagesView.innerHTML = '';
        messagesView.style.display = 'none';
        heroView.style.display = 'flex';
        userInput.value = '';
        document.querySelectorAll('.chat-item-wrapper').forEach(el => el.classList.remove('active'));
    }

    // Delete All Chats Action
    clearBtn.addEventListener('click', () => {
        if (chats.length === 0) {
            showToast("No chat history to delete!");
            return;
        }
        if (confirm("Are you sure you want to delete ALL chat conversations?")) {
            chats = [];
            localStorage.removeItem('NEURO_AI_CHATS');
            startNewChat();
            renderChatHistory();
            showToast("All chats deleted!");
        }
    });

    // Export menu for the active chat
    exportBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const activeChat = chats.find(c => c.id === currentChatId);
        if (!activeChat || activeChat.messages.length === 0) {
            showToast("No active chat history to export!");
            return;
        }

        const existingMenu = document.querySelector('.export-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = '<button type="button" data-export-action="copy">Copy link</button><button type="button" data-export-action="whatsapp">Share on WhatsApp</button><button type="button" data-export-action="download">Download PDF</button><button type="button" data-export-action="print">Print conversation</button>';
        document.querySelector('.sidebar-footer').appendChild(menu);

        const transcript = buildTranscript(activeChat);
        menu.querySelector('[data-export-action="copy"]').addEventListener('click', async () => {
            try {
                const shareLink = await createShareLink(activeChat, transcript);
                await navigator.clipboard.writeText(shareLink);
                showToast('Chat link copied!');
            } catch (error) {
                showToast('Unable to copy chat link.');
            }
            menu.remove();
        });
        menu.querySelector('[data-export-action="whatsapp"]').addEventListener('click', async () => {
            try {
                const shareLink = await createShareLink(activeChat, transcript);
                const text = ` ${shareLink}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
            } catch (error) {
                showToast(error.message);
            }
            menu.remove();
        });
        menu.querySelector('[data-export-action="download"]').addEventListener('click', async () => {
            await downloadPdf(activeChat, transcript);
            menu.remove();
        });
        menu.querySelector('[data-export-action="print"]').addEventListener('click', () => {
            printTranscript(activeChat, transcript);
            menu.remove();
        });
    });

    function buildTranscript(chat) {
        const userName = localStorage.getItem('chatnex_user') || 'User';
        let content = `CHATNEX CONVERSATION\n${chat.title}\n\n`;
        content += `USER: ${userName}\n`;
        content += `${'='.repeat(72)}\n\n`;

        chat.messages.forEach((message, index) => {
            if (message.sender !== 'user') return;
            const response = chat.messages[index + 1]?.sender === 'ai' ? chat.messages[index + 1] : null;
            content += `PROMPT\n${message.text}\n\n`;
            content += `MODEL\n${response?.model || 'AI Assistant'}\n\n`;
            content += `RESPONSE\n${response?.text || 'No response recorded.'}\n\n`;
            content += `${'-'.repeat(72)}\n\n`;
        });
        return content;
    }

    async function downloadPdf(chat, content) {
        const coverResponse = await fetch('/chatnex.jpg');
        const coverBytes = new Uint8Array(await coverResponse.arrayBuffer());
        const coverSize = readJpegSize(coverBytes);
        const lines = content.split('\n').flatMap(line => {
            const safeLine = line.replace(/[^\x20-\x7E]/g, '?');
            const chunks = safeLine.match(/.{1,92}/g);
            return chunks && chunks.length ? chunks : [''];
        });
        const linesPerPage = 36;
        const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
        const objects = [];
        const pageIds = [];
        const contentIds = [];
        const imageId = 3;
        const fontId = 4;

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            pageIds.push(5 + pageIndex * 2);
            contentIds.push(6 + pageIndex * 2);
        }

        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`;
        objects[imageId] = { dictionary: `<< /Type /XObject /Subtype /Image /Width ${coverSize.width} /Height ${coverSize.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${coverBytes.length} >>`, bytes: coverBytes };
        objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            const pageLines = lines.slice(pageIndex * linesPerPage, (pageIndex + 1) * linesPerPage);
            const commands = ['q', '612 0 0 792 0 0 cm', '/Im1 Do', 'Q', 'BT', '/F1 10 Tf', '50 690 Td', '14 TL'];
            pageLines.forEach(line => {
                const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
                commands.push(`(${escaped}) Tj`, 'T*');
            });
            commands.push('ET');
            const stream = commands.join('\n');
            objects[pageIds[pageIndex]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentIds[pageIndex]} 0 R >>`;
            objects[contentIds[pageIndex]] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
        }

        const encoder = new TextEncoder();
        const chunks = [];
        const offsets = [0];
        let byteLength = 0;
        const addText = text => { const bytes = encoder.encode(text); chunks.push(bytes); byteLength += bytes.length; };
        const addBytes = bytes => { chunks.push(bytes); byteLength += bytes.length; };
        addText('%PDF-1.4\n');
        for (let id = 1; id < objects.length; id += 1) {
            offsets[id] = byteLength;
            const object = objects[id];
            if (object && object.bytes) {
                addText(`${id} 0 obj\n${object.dictionary}\nstream\n`);
                addBytes(object.bytes);
                addText('\nendstream\nendobj\n');
            } else {
                addText(`${id} 0 obj\n${object}\nendobj\n`);
            }
        }
        const xrefOffset = byteLength;
        let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
        for (let id = 1; id < objects.length; id += 1) {
            xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
        }
        xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        addText(xref);

        const blob = new Blob(chunks, { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ChatNex.pdf';
        a.click();
        URL.revokeObjectURL(url);
    }

    function readJpegSize(bytes) {
        for (let index = 2; index < bytes.length;) {
            if (bytes[index] !== 0xff) { index += 1; continue; }
            const marker = bytes[index + 1];
            const length = (bytes[index + 2] << 8) + bytes[index + 3];
            if (marker >= 0xc0 && marker <= 0xc3) {
                return { height: (bytes[index + 5] << 8) + bytes[index + 6], width: (bytes[index + 7] << 8) + bytes[index + 8] };
            }
            index += 2 + length;
        }
        return { width: 1200, height: 700 };
    }

    function printTranscript(chat, content) {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            showToast('Please allow pop-ups to print the conversation.');
            return;
        }
        const lines = content.split('\n');
        const pages = [];
        for (let index = 0; index < lines.length; index += 36) {
            pages.push(lines.slice(index, index + 36).join('\n'));
        }
        const pageMarkup = pages.map(page => `<section class="letter-page"><pre>${escapeHtml(page)}</pre></section>`).join('');
        printWindow.document.write(`<!doctype html><html><head><title>ChatNex - ${escapeHtml(chat.title)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#e9eef5;color:#152238;font:14px/1.7 Arial,sans-serif}.letter-page{width:210mm;height:297mm;margin:0 auto 14px;padding:58mm 18mm 18mm;background:#fff url('/chatnex.jpg') center/100% 100% no-repeat;page-break-after:always}.letter-page pre{margin:0;white-space:pre-wrap;word-wrap:break-word;font:10px/1.55 Arial,sans-serif}@media print{body{background:#fff}.letter-page{margin:0;width:210mm;height:297mm;break-after:page}}</style></head><body>${pageMarkup}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);
        printWindow.document.close();
    }

    async function createShareLink(chat, transcript) {
        const response = await fetch('/api/shares', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: chat.title, transcript, messages: chat.messages })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Unable to create a share link.');
        }
        return result.url;
    }

    // Voice Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                recognition.start();
                micBtn.classList.add('recording');
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            micBtn.classList.remove('recording');
        };

        recognition.onerror = () => micBtn.classList.remove('recording');
        recognition.onend = () => micBtn.classList.remove('recording');
    } else {
        micBtn.style.opacity = '0.4';
        micBtn.title = 'Speech recognition not supported in this browser.';
    }

    // Main Send Handler
    async function handleSend() {
        if (!conversationUnlocked) return;
        const text = userInput.value.trim();
        if (!text) return;

        // Ensure active chat session
        if (!currentChatId) {
            currentChatId = 'chat_' + Date.now();
            const newChat = {
                id: currentChatId,
                title: text.length > 25 ? text.substring(0, 25) + '...' : text,
                messages: [],
                createdAt: new Date().toISOString()
            };
            chats.unshift(newChat);
        }

        const activeChat = chats.find(c => c.id === currentChatId);

        // Hide Hero, Show Messages View
        heroView.style.display = 'none';
        messagesView.style.display = 'flex';

        // 1. Add User Message
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        appendUserMessage(text, timeStr);
        activeChat.messages.push({ sender: 'user', text: text, time: timeStr });
        saveChatsToStorage();

        userInput.value = '';
        userInput.style.height = '24px';
        setLoading(true);

        const selectedModel = modelSelect.value;
        const modelName = modelSelect.options[modelSelect.selectedIndex].text;

        // 2. Append AI Thinking Row
        const aiRow = createAiMessageRow(modelName);
        const bubble = aiRow.querySelector('.msg-bubble');
        bubble.innerHTML = `<span style="color: var(--text-muted);">Thinking...</span>`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    temperature: currentTemperature,
                    prompt: text,
                    system_prompt: currentSystemPrompt,
                    history: activeChat.messages
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Request failed (HTTP ${response.status})`);
            }

            const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            bubble.innerHTML = formatMarkdown(data.response);
            if (data.notice) {
                bubble.insertAdjacentHTML('afterbegin', `<div class="fallback-notice">${escapeHtml(data.notice)}</div>`);
            }
            activeChat.messages.push({ sender: 'ai', text: data.response, time: aiTime, model: modelName });
            saveChatsToStorage();
            syncConversation(activeChat);

        } catch (err) {
            bubble.innerHTML = `<span style="color: #ef4444;">⚠️ Error: ${escapeHtml(err.message)}</span>`;
        } finally {
            setLoading(false);
            messagesView.scrollTop = messagesView.scrollHeight;
            renderChatHistory();
        }
    }

    function appendUserMessage(text, timeStr) {
        const row = document.createElement('div');
        row.className = 'msg-row user-msg';
        row.innerHTML = `
            <div class="msg-header">You • ${timeStr}</div>
            <div class="msg-bubble">${escapeHtml(text)}</div>
        `;
        messagesView.appendChild(row);
        messagesView.scrollTop = messagesView.scrollHeight;
    }

    function createAiMessageRow(modelName) {
        const row = document.createElement('div');
        row.className = 'msg-row ai-msg';
        row.innerHTML = `
            <div class="msg-header"> ${escapeHtml(modelName)}</div>
            <div class="msg-bubble"></div>
        `;
        messagesView.appendChild(row);
        return row;
    }

    // Render Sidebar History Items with 3-Dots Menu
    function renderChatHistory() {
        chatHistoryList.innerHTML = '';
        chats.forEach(chat => {
            const wrapper = document.createElement('div');
            wrapper.className = `chat-item-wrapper ${chat.id === currentChatId ? 'active' : ''}`;
            wrapper.dataset.id = chat.id;

            wrapper.innerHTML = `
                <span class="chat-item-title">${escapeHtml(chat.title)}</span>
                <div class="chat-item-dots" title="Options">⋮</div>
                <div class="chat-dropdown-menu">
                    <div class="dropdown-option share-opt">📤 Share Chat</div>
                    <div class="dropdown-option delete-opt">🗑️ Delete Chat</div>
                </div>
            `;

            // Click wrapper to load chat
            wrapper.addEventListener('click', (e) => {
                if (e.target.closest('.chat-item-dots') || e.target.closest('.chat-dropdown-menu')) return;
                loadChatSession(chat.id);
            });

            // Click 3 dots to toggle dropdown
            const dotsBtn = wrapper.querySelector('.chat-item-dots');
            const dropdown = wrapper.querySelector('.chat-dropdown-menu');

            dotsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.chat-dropdown-menu').forEach(m => {
                    if (m !== dropdown) m.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            });

            // Share Chat Option
            const shareOpt = wrapper.querySelector('.share-opt');
            shareOpt.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                shareChatSession(chat);
            });

            // Delete Specific Chat Option
            const deleteOpt = wrapper.querySelector('.delete-opt');
            deleteOpt.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                deleteSingleChatSession(chat.id);
            });

            chatHistoryList.appendChild(wrapper);
        });
    }

    function loadChatSession(id) {
        currentChatId = id;
        const targetChat = chats.find(c => c.id === id);
        if (!targetChat) return;

        heroView.style.display = 'none';
        messagesView.style.display = 'flex';
        messagesView.innerHTML = '';

        targetChat.messages.forEach(msg => {
            if (msg.sender === 'user') {
                appendUserMessage(msg.text, msg.time || '');
            } else {
                const row = createAiMessageRow(msg.model || 'AI Assistant');
                row.querySelector('.msg-bubble').innerHTML = formatMarkdown(msg.text);
            }
        });

        messagesView.scrollTop = messagesView.scrollHeight;
        renderChatHistory();
    }

    function deleteSingleChatSession(id) {
        chats = chats.filter(c => c.id !== id);
        saveChatsToStorage();

        if (currentChatId === id) {
            startNewChat();
        }
        renderChatHistory();
        showToast("Chat session deleted!");
    }

    function shareChatSession(chat) {
        if (!chat || !chat.messages.length) {
            showToast("No message history to share!");
            return;
        }
        let transcript = `=== Shared Chat: ${chat.title} ===\n\n`;
        chat.messages.forEach(m => {
            transcript += `[${m.sender.toUpperCase()}]: ${m.text}\n\n`;
        });
        
        navigator.clipboard.writeText(transcript).then(() => {
            showToast("📋 Chat copied to clipboard!");
        }).catch(() => {
            showToast("Failed to copy transcript.");
        });
    }

    function saveChatsToStorage() {
        localStorage.setItem('NEURO_AI_CHATS', JSON.stringify(chats));
    }

    async function syncConversation(chat) {
        try {
            await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: chat.id,
                    title: chat.title,
                    messages: chat.messages
                })
            });
        } catch (error) {
            console.warn('Conversation sync failed:', error);
        }
    }

    function showToast(text) {
        const existing = document.querySelector('.toast-msg');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.textContent = text;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2500);
    }

    function setLoading(isLoading) {
        userInput.disabled = isLoading;
        sendBtn.disabled = isLoading;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[s]));
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let html = escapeHtml(text);
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    window.selectPrompt = function(promptText) {
        userInput.value = promptText;
        handleSend();
    };
});

// Interactive Particle Constellation Background
function initParticlesCanvas() {
    const canvas = document.getElementById('particlesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const numParticles = 60;
    const particles = [];

    for (let i = 0; i < numParticles; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            radius: Math.random() * 2 + 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < numParticles; i++) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
            ctx.fill();

            for (let j = i + 1; j < numParticles; j++) {
                let p2 = particles[j];
                let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (dist < 130) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(0, 194, 255, ${0.25 * (1 - dist / 130)})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}
