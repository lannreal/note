const express = require('express');
const multer = require('multer');
const cors = require('cors');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 3000;

// --- STATE & TOKEN POOL ---
let TOKENS = []; // Token pool
let currentTokenIndex = 0;
let accountCreationPromise = null; // Mutex lock for concurrent account creations

const availableModels = [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "deepseek-chat",
    "deepseek-reasoner"
];

const visionModels = [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview"
];

const reasoningModels = [
    "deepseek-chat",
    "deepseek-reasoner"
];

let selectedModel = "gpt-4o";
let showReasoning = true;
let cliConversationId = `conv-${Date.now()}`;

// --- CLI FORMATTING & UTILS ---
const c = {
    bold: '\x1b[1m', dim: '\x1b[90m', blue: '\x1b[34m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
    reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

class Spinner {
    constructor(text) {
        this.text = text;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.interval = null;
        this.frameIndex = 0;
    }
    start() {
        process.stdout.write('\x1B[?25l');
        this.interval = setInterval(() => {
            process.stdout.write(`\r${c.yellow}${this.frames[this.frameIndex]} ${this.text}${c.reset}`);
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        }, 80);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            process.stdout.write('\r\x1b[K');
            process.stdout.write('\x1B[?25h');
        }
    }
}

// --- MULTI-PROVIDER TEMP MAIL ENGINE ---
const MAIL_PROVIDERS = [
    'https://api.mail.tm',
    'https://api.mail.gw'
];

async function fetchWithTimeout(resource, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

async function createTempMailbox() {
    let lastError = null;

    for (const baseUrl of MAIL_PROVIDERS) {
        try {
            // 1. Get available domains
            const domainRes = await fetchWithTimeout(`${baseUrl}/domains`, {}, 10000);
            if (!domainRes.ok) continue;
            const domainData = await domainRes.json();
            const members = domainData['hydra:member'] || [];
            if (members.length === 0) continue;

            const domain = members[0].domain;
            const randomId = Math.random().toString(36).substring(2, 11);
            const address = `bot_${randomId}@${domain}`;
            const password = "NotePassword123!";

            // 2. Create account
            const accRes = await fetchWithTimeout(`${baseUrl}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            }, 10000);
            if (!accRes.ok) continue;

            // 3. Get Auth Token
            const tokenRes = await fetchWithTimeout(`${baseUrl}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            }, 10000);
            if (!tokenRes.ok) continue;
            const tokenData = await tokenRes.json();

            if (tokenData.token) {
                return {
                    baseUrl,
                    email: address,
                    password,
                    mailToken: tokenData.token
                };
            }
        } catch (err) {
            lastError = err;
        }
    }
    throw new Error(`Semua provider temporary mail gagal: ${lastError ? lastError.message : 'Unknown error'}`);
}

async function pollVerificationToken(mailbox, maxRetries = 25, delayMs = 1500) {
    const { baseUrl, mailToken } = mailbox;

    for (let i = 0; i < maxRetries; i++) {
        await new Promise(r => setTimeout(r, delayMs));
        try {
            const listRes = await fetchWithTimeout(`${baseUrl}/messages`, {
                headers: { 'Authorization': `Bearer ${mailToken}` }
            }, 8000);
            if (!listRes.ok) continue;

            const listData = await listRes.json();
            const messages = listData['hydra:member'] || [];
            if (messages.length > 0) {
                const msgRes = await fetchWithTimeout(`${baseUrl}/messages/${messages[0].id}`, {
                    headers: { 'Authorization': `Bearer ${mailToken}` }
                }, 8000);
                if (!msgRes.ok) continue;

                const msgData = await msgRes.json();
                const content = (msgData.text || "") + " " + (Array.isArray(msgData.html) ? msgData.html.join("") : (msgData.html || ""));
                const match = content.match(/token=([a-zA-Z0-9_\-\.]+)/i);
                if (match) {
                    return match[1];
                }
            }
        } catch (e) {}
    }
    return null;
}

// --- REVERSE-ENGINEERED NOTEGPT AUTO-ACCOUNT GENERATOR ---
async function generateFreshNoteGPTToken() {
    // If an account creation is already running, reuse the active promise (Mutex)
    if (accountCreationPromise) {
        return await accountCreationPromise;
    }

    accountCreationPromise = (async () => {
        try {
            // Step 1: Create Temp Mailbox
            const mailbox = await createTempMailbox();

            // Step 2: Register to NoteGPT
            const regRes = await fetchWithTimeout('https://notegpt.io/api/v1/auth/email/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                    'Origin': 'https://notegpt.io',
                    'Referer': 'https://notegpt.io/auth/register'
                },
                body: JSON.stringify({ email: mailbox.email, password: mailbox.password })
            }, 15000);

            const regJson = await regRes.json();
            if (regJson.code !== 100000 && regJson.code !== 0) {
                throw new Error(`Registrasi NoteGPT ditolak: ${regJson.message || 'Unknown error'}`);
            }

            // Step 3: Wait & Extract Confirmation Token
            const confirmToken = await pollVerificationToken(mailbox);
            if (!confirmToken) {
                throw new Error('Timeout: Email verifikasi dari NoteGPT tidak diterima.');
            }

            // Step 4: Confirm Verification Link via API
            const confirmRes = await fetchWithTimeout('https://notegpt.io/api/v1/auth/email/register/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                    'Origin': 'https://notegpt.io',
                    'Referer': `https://notegpt.io/auth/register-confirm?token=${confirmToken}&email=${encodeURIComponent(mailbox.email)}&lang=en`
                },
                body: JSON.stringify({ token: confirmToken })
            }, 15000);

            const confirmJson = await confirmRes.json();
            if (confirmJson.code !== 100000 && confirmJson.code !== 0) {
                throw new Error(`Konfirmasi verifikasi gagal: ${confirmJson.message || 'Unknown error'}`);
            }

            // Step 5: Login to get access token (nc_token)
            const loginRes = await fetchWithTimeout('https://notegpt.io/api/v1/auth/email/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                    'Origin': 'https://notegpt.io',
                    'Referer': 'https://notegpt.io/auth/login'
                },
                body: JSON.stringify({ email: mailbox.email, password: mailbox.password })
            }, 15000);

            const loginJson = await loginRes.json();
            let ncToken = loginJson?.data?.access_token || loginJson?.data?.token;

            if (!ncToken) {
                const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")];
                for (const sc of setCookies) {
                    if (!sc) continue;
                    const m = sc.match(/nc_token=([^;]+)/);
                    if (m) {
                        ncToken = m[1];
                        break;
                    }
                }
            }

            if (!ncToken) throw new Error('nc_token tidak ditemukan dalam response login.');

            // Add new fresh token to pool
            TOKENS.push(ncToken);
            currentTokenIndex = TOKENS.length - 1;
            return ncToken;
        } finally {
            accountCreationPromise = null;
        }
    })();

    return await accountCreationPromise;
}

// --- IMAGE UPLOAD SERVICE ---
async function uploadToUguu(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File gambar tidak ditemukan di path: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    let body = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files[]"; filename="${fileName}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
    );
    body = Buffer.concat([body, fileBuffer, Buffer.from(`\r\n--${boundary}--\r\n`)]);

    const response = await fetchWithTimeout('https://uguu.se/upload.php', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: body
    }, 20000);

    if (!response.ok) throw new Error(`Upload gambar gagal (HTTP ${response.status})`);
    const data = await response.json();
    if (data.success && data.files && data.files.length > 0) {
        return data.files[0].url;
    } else {
        throw new Error("Gagal mendapatkan URL gambar publik dari hosting.");
    }
}

// --- CORE AI STREAMING ENGINE ---
async function askNoteGPT(prompt, modelStr = "gpt-4o", retryCount = 0, imageUrl = null, isAPI = false, convId = null) {
    // Ensure we have at least one active token
    if (TOKENS.length === 0) {
        let spinner;
        if (!isAPI) {
            spinner = new Spinner("Menginisialisasi token NoteGPT pertama...");
            spinner.start();
        }
        await generateFreshNoteGPTToken();
        if (!isAPI && spinner) spinner.stop();
    }

    const activeToken = TOKENS[currentTokenIndex];
    const targetConvId = convId || cliConversationId;
    let spinner;
    
    if (!isAPI) {
        spinner = new Spinner(retryCount > 0 ? `Rotasi Akun (${retryCount}). NoteGPT berpikir...` : "NoteGPT is thinking...");
        spinner.start();
    }

    const payload = {
        message: prompt,
        language: "auto",
        model: modelStr,
        tone: "default",
        length: "moderate",
        conversation_id: targetConvId,
        image_urls: imageUrl ? [imageUrl] : [],
        chat_mode: "standard"
    };

    let reader = null;

    try {
        const response = await fetchWithTimeout('https://notegpt.io/api/v2/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `nc_token=${activeToken}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Origin': 'https://notegpt.io',
                'Referer': 'https://notegpt.io/ai-chat',
                'Accept': '*/*'
            },
            body: JSON.stringify(payload)
        }, 45000);

        if (!response.ok) {
            if (!isAPI && spinner) spinner.stop();
            return await handleLimitOrError(prompt, modelStr, retryCount, `HTTP ${response.status}`, imageUrl, isAPI, targetConvId);
        }

        reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        
        let hasOutput = false;
        let isExpired = false;
        let spinnerStopped = false;
        let isReasoning = false; 
        let sseBuffer = "";
        
        let fullText = "";
        let fullReasoning = "";

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop(); // Simpan baris yang belum selesai untuk iterasi chunk berikutnya

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':')) continue;
                    
                    if (trimmed.startsWith('data:')) {
                        const jsonStr = trimmed.replace(/^data:\s*/, '');
                        if (jsonStr === '[DONE]' || !jsonStr) continue;
                        
                        try {
                            const dataObj = JSON.parse(jsonStr);
                            
                            if (dataObj.code && (dataObj.code === 164002 || dataObj.code === 100001 || dataObj.code === 100020)) {
                                isExpired = true;
                                break;
                            }

                            if (dataObj.reasoning) {
                                fullReasoning += dataObj.reasoning;
                                if (!isAPI && showReasoning) {
                                    if (!spinnerStopped) {
                                        if (spinner) spinner.stop();
                                        spinnerStopped = true;
                                        if (retryCount === 0) process.stdout.write(`${c.bold}${c.magenta}◼ NoteGPT:${c.reset} \n\n`);
                                    }
                                    if (!isReasoning) {
                                        process.stdout.write(`\n${c.dim}┌─ DeepThink Reasoning...${c.reset}\n`);
                                        isReasoning = true;
                                    }
                                    process.stdout.write(`${c.dim}${dataObj.reasoning}${c.reset}`);
                                }
                                hasOutput = true;
                            }
                            
                            if (dataObj.text) {
                                fullText += dataObj.text;
                                if (!isAPI) {
                                    if (!spinnerStopped) {
                                        if (spinner) spinner.stop();
                                        spinnerStopped = true;
                                        if (retryCount === 0) process.stdout.write(`${c.bold}${c.magenta}◼ NoteGPT:${c.reset} \n\n`);
                                    }
                                    if (isReasoning) {
                                        process.stdout.write(`\n${c.dim}└─ Selesai Menalar${c.reset}\n\n`);
                                        isReasoning = false;
                                    }
                                    process.stdout.write(dataObj.text);
                                }
                                hasOutput = true;
                            }
                        } catch (err) {}
                    }
                }
            }
        }
        
        // Flush sisa buffer jika ada
        if (sseBuffer && sseBuffer.trim().startsWith('data:')) {
            try {
                const jsonStr = sseBuffer.trim().replace(/^data:\s*/, '');
                if (jsonStr && jsonStr !== '[DONE]') {
                    const dataObj = JSON.parse(jsonStr);
                    if (dataObj.text) {
                        fullText += dataObj.text;
                        if (!isAPI) process.stdout.write(dataObj.text);
                        hasOutput = true;
                    }
                }
            } catch (e) {}
        }
        
        if (!isAPI && isReasoning) {
            process.stdout.write(`\n${c.dim}└─ Selesai Menalar${c.reset}\n\n`);
        }
        
        if (!isAPI && !spinnerStopped && spinner) spinner.stop();
        
        if (isExpired) return await handleLimitOrError(prompt, modelStr, retryCount, "Token Kadaluarsa", imageUrl, isAPI, targetConvId);
        if (!hasOutput) return await handleLimitOrError(prompt, modelStr, retryCount, "Limit Tercapai / Output Kosong", imageUrl, isAPI, targetConvId);
        
        if (!isAPI) console.log("\n"); 
        
        return { text: fullText, reasoning: fullReasoning, conversation_id: targetConvId };
        
    } catch (e) {
        if (!isAPI && spinner) spinner.stop();
        if (reader) {
            try { await reader.cancel(); } catch (err) {}
        }
        return await handleLimitOrError(prompt, modelStr, retryCount, `Koneksi/Jaringan: ${e.message}`, imageUrl, isAPI, targetConvId);
    }
}

// --- RESILIENT TOKEN ROTATION & AUTO-RECOVERY ---
async function handleLimitOrError(prompt, modelStr, retryCount, reason, imageUrl = null, isAPI = false, convId = null) {
    if (retryCount >= 3) {
        throw new Error(`Maksimal percobaan rotasi (${retryCount}x) tercapai. Alasan: ${reason}`);
    }

    // Jika token saat ini expired/invalid, hapus dari pool
    if (TOKENS.length > 0) {
        TOKENS.splice(currentTokenIndex, 1);
        if (currentTokenIndex >= TOKENS.length) {
            currentTokenIndex = 0;
        }
    }

    // Jika masih ada token cadangan dalam pool, gunakan
    if (TOKENS.length > 0) {
        return await askNoteGPT(prompt, modelStr, retryCount + 1, imageUrl, isAPI, convId);
    }

    // Jika tidak ada token valid, generate token baru via Pure HTTP
    let spinner;
    if (!isAPI) {
        spinner = new Spinner(`Token limit/expired (${reason}). Membuat akun cadangan baru secara instan...`);
        spinner.start();
    }

    try {
        const newToken = await generateFreshNoteGPTToken();
        if (!isAPI && spinner) spinner.stop();
        if (newToken) {
            return await askNoteGPT(prompt, modelStr, retryCount + 1, imageUrl, isAPI, convId);
        }
    } catch (err) {
        if (!isAPI && spinner) spinner.stop();
        if (!isAPI) console.error(`\n${c.red}❌ Gagal membuat akun baru: ${err.message}${c.reset}\n`);
        throw new Error(`Gagal membuat akun NoteGPT baru: ${err.message}`);
    }
}

// --- REST API ROUTES ---
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model, image_url, conversation_id } = req.body;
        if (!message) return res.status(400).json({ error: "Parameter 'message' wajib diisi." });
        const targetModel = model || selectedModel || "gpt-4o";
        const convId = conversation_id || `api-conv-${Date.now()}`;
        const result = await askNoteGPT(message, targetModel, 0, image_url || null, true, convId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for multipart image upload & chat
app.post('/api/chat/upload', upload.single('image'), async (req, res) => {
    let tempFilePath = req.file ? req.file.path : null;
    try {
        const { message, model, conversation_id } = req.body;
        if (!message) return res.status(400).json({ error: "Parameter 'message' wajib diisi." });
        
        let imageUrl = null;
        if (tempFilePath) {
            imageUrl = await uploadToUguu(tempFilePath);
        }
        
        const targetModel = model || selectedModel || "gpt-4o";
        const convId = conversation_id || `api-conv-${Date.now()}`;
        const result = await askNoteGPT(message, targetModel, 0, imageUrl, true, convId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
    }
});

// Endpoint for checking server status & tokens
app.get('/api/status', (req, res) => {
    res.json({
        status: "online",
        engine: "100% Pure HTTP (Zero Browser)",
        activeTokensCount: TOKENS.length,
        defaultModel: selectedModel,
        availableModels: availableModels
    });
});

// --- CLI INTERACTION LOGIC ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function startChat() {
    console.log(c.clear);
    console.log(`${c.bold}${c.cyan}NoteGPT CLI & API${c.reset} ${c.dim}v2.1 [100% Pure HTTP / Zero Browser]${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.bold}Model     :${c.reset} ${c.green}${selectedModel}${c.reset}`);
    console.log(`${c.bold}DeepThink :${c.reset} ${showReasoning ? c.green + 'ON' : c.red + 'OFF'}${c.reset}`);
    console.log(`${c.bold}Engine    :${c.reset} ${c.green}100% Pure HTTP Direct REST API (Ultra-Fast)${c.reset}`);
    console.log(`${c.bold}REST API  :${c.reset} ${c.green}http://localhost:${PORT}${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.bold}Command List:${c.reset}`);
    console.log(`  ${c.cyan}/image <path> [prompt]${c.reset}  : Analisis gambar lokal`);
    console.log(`  ${c.cyan}/models${c.reset}                 : Ganti model AI`);
    console.log(`  ${c.cyan}exit, /exit, /quit${c.reset}      : Keluar dari aplikasi`);
    console.log(`${c.dim}─────────────────────────────────────────────────────────────${c.reset}\n`);
    
    const promptLoop = () => {
        rl.question(`${c.bold}${c.green}You:${c.reset} `, async (input) => {
            const lowInput = input.trim().toLowerCase();
            if (lowInput === 'exit' || lowInput === '/exit' || lowInput === '/quit') {
                console.log("Sampai jumpa!");
                process.exit(0);
            }
            if (lowInput === '/models' || lowInput === '/model') {
                selectModel();
                return;
            }
            if (input.trim() === '') {
                promptLoop();
                return;
            }
            
            let finalInput = input.trim();
            let currentImageUrl = null;
            
            if (finalInput.startsWith('/image ')) {
                const parts = finalInput.substring(7).trim().split(' ');
                let filePath = "";
                let remainingPrompt = "";
                let possiblePath = "";
                let foundIndex = -1;
                
                for (let i = 0; i < parts.length; i++) {
                    possiblePath = parts.slice(0, i + 1).join(' ');
                    let cleanPath = possiblePath.replace(/^["']|["']$/g, '');
                    try {
                        if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
                            filePath = cleanPath;
                            foundIndex = i;
                        }
                    } catch(e) {}
                }
                
                if (foundIndex !== -1) {
                    remainingPrompt = parts.slice(foundIndex + 1).join(' ').trim();
                } else {
                    filePath = parts[0].replace(/^["']|["']$/g, '');
                }
                
                if (!fs.existsSync(filePath)) {
                    console.log(`${c.red}❌ Error: File gambar tidak ditemukan di (${filePath})${c.reset}\n`);
                    promptLoop();
                    return;
                }
                
                const spinner = new Spinner("Mengunggah gambar...");
                spinner.start();
                try {
                    currentImageUrl = await uploadToUguu(filePath);
                    spinner.stop();
                    console.log(`${c.green}✅ Gambar terunggah! Memproses ke AI...${c.reset}\n`);
                    finalInput = remainingPrompt.trim() === '' ? 'Tolong jelaskan isi gambar ini.' : remainingPrompt;
                } catch (e) {
                    spinner.stop();
                    console.log(`${c.red}❌ Error Upload: ${e.message}${c.reset}\n`);
                    promptLoop();
                    return;
                }
            }
                
            try {
                await askNoteGPT(finalInput, selectedModel, 0, currentImageUrl, false);
            } catch (e) {
                console.log(`${c.red}❌ Error: ${e.message}${c.reset}\n`);
            }
            promptLoop();
        });
    };
    
    promptLoop();
}

function selectModel() {
    console.log(c.clear);
    console.log(`${c.bold}${c.cyan}=== NoteGPT CLI & API ===${c.reset}\n`);
    console.log(`${c.bold}Pilih Model AI:${c.reset}`);
    
    availableModels.forEach((model, index) => {
        let flags = [];
        if (visionModels.includes(model)) flags.push(`${c.green}[Vision]${c.reset}`);
        if (reasoningModels.includes(model)) flags.push(`${c.cyan}[Reasoning]${c.reset}`);
        if (flags.length === 0) flags.push(`${c.dim}[Text]${c.reset}`);
        
        console.log(`  ${c.cyan}${index + 1}.${c.reset} ${model.padEnd(25, ' ')} ${flags.join(' ')}`);
    });
    console.log("");
    
    rl.question(`${c.bold}${c.blue}?${c.reset} Pilihan (1-${availableModels.length}): `, (answer) => {
        const num = parseInt(answer.trim());
        if (!isNaN(num) && num >= 1 && num <= availableModels.length) {
            selectedModel = availableModels[num - 1];
        } else {
            selectedModel = "gpt-4o";
        }
        
        if (reasoningModels.includes(selectedModel)) {
            rl.question(`${c.bold}${c.blue}?${c.reset} Aktifkan DeepThink reasoning? (Y/n): `, (ans2) => {
                showReasoning = ans2.trim().toLowerCase() !== 'n';
                if (!app.listening) {
                    app.listen(PORT, () => startChat());
                } else {
                    startChat();
                }
            });
        } else {
            showReasoning = false;
            if (!app.listening) {
                app.listen(PORT, () => startChat());
            } else {
                startChat();
            }
        }
    });
}

// --- BOOT MODE (CLI or Standalone Headless Server) ---
const isServerMode = process.argv.includes('--server') || !process.stdin.isTTY;

if (isServerMode) {
    app.listen(PORT, () => {
        console.log(`[NoteGPT Server] Berjalan di port ${PORT} (100% Pure HTTP)`);
    });
} else {
    selectModel();
}
