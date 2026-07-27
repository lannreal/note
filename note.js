const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' }); // for API file uploads

const PORT = process.env.PORT || 3000;

// --- STATE ---
let TOKENS = ["duTfC7qSawIun1Imh9WVfnIDR2weCibjUIumAegcHQE"]; // Initial valid token
let currentTokenIndex = 0;

const availableModels = [
    "gpt-4o-mini",
    "gpt-4o",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "deepseek-chat",
    "deepseek-reasoner"
];
const visionModels = ["gpt-4o-mini", "gpt-4o", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-3-flash-preview"];
const reasoningModels = ["deepseek-chat", "deepseek-reasoner"];
let selectedModel = "gpt-4o";
let showReasoning = true;
let cliConversationId = `conv-${Date.now()}`;

// --- UTILS ---
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

// --- AUTO ACCOUNT ---
async function createNewNoteGPTAccount() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        const timestamp = Date.now();
        const username = `botgpt_${timestamp}`;
        const domain = 'binancepools.cloud';
        const email = `${username}@${domain}`;
        const password = 'BotPass123!@#';
        
        await page.goto(`https://generator.email/${domain}/${username}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);
        
        const regResult = await page.evaluate(async (data) => {
            try {
                const res = await fetch('https://notegpt.io/api/v1/auth/email/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: data.email, password: data.password })
                });
                return await res.json();
            } catch (e) { return { error: e.toString() }; }
        }, { email, password });
        
        if (regResult.code !== 0) throw new Error("Gagal registrasi");
        
        let foundLink = null;
        for (let i = 0; i < 30; i++) {
            await page.waitForTimeout(1000);
            const emails = await page.$$('#email-table .g8r');
            if (emails.length > 0) {
                await emails[0].click();
                await page.waitForTimeout(2000);
                let mailContent = '';
                try {
                    const msgFrame = await page.$('#email-table iframe');
                    if (msgFrame) {
                        const frameObj = await msgFrame.contentFrame();
                        mailContent = await frameObj.content();
                    } else {
                        mailContent = await page.content();
                    }
                } catch(e) {}
                const linkMatch = mailContent.match(/href="(https:\/\/notegpt\.io\/user\/verify-email\?token=[^"]+)"/);
                if (linkMatch) {
                    foundLink = linkMatch[1];
                    break;
                }
            }
        }
        
        if (!foundLink) throw new Error("Timeout: Email tidak masuk");
        
        const page2 = await context.newPage();
        await page2.goto(foundLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page2.waitForTimeout(3000);
        
        const loginResult = await page2.evaluate(async (data) => {
            const res = await fetch('https://notegpt.io/api/v1/auth/email/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email, password: data.password })
            });
            return await res.json();
        }, { email, password });
        
        if (loginResult.code !== 0) throw new Error("Gagal login");
        
        const cookies = await context.cookies();
        const ncCookie = cookies.find(c => c.name === 'nc_token');
        if (!ncCookie) throw new Error("nc_token tidak ditemukan");
        
        return ncCookie.value;
    } catch (error) {
        return null;
    } finally {
        await browser.close();
    }
}

// --- IMAGE UPLOAD ---
async function uploadToUguu(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    let body = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files[]"; filename="${fileName}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
    );
    body = Buffer.concat([body, fileBuffer, Buffer.from(`\r\n--${boundary}--\r\n`)]);

    const response = await fetch('https://uguu.se/upload.php', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: body
    });

    if (!response.ok) throw new Error(`Upload gagal HTTP ${response.status}`);
    const data = await response.json();
    if (data.success && data.files && data.files.length > 0) {
        return data.files[0].url;
    } else {
        throw new Error("Gagal mendapatkan URL gambar");
    }
}

// --- CORE AI ENGINE ---
async function askNoteGPT(prompt, modelStr, retryCount = 0, imageUrl = null, isAPI = false, convId = null) {
    const TOKEN = TOKENS[currentTokenIndex];
    let spinner;
    
    if (!isAPI) {
        spinner = new Spinner(retryCount > 0 ? "Retrying..." : "NoteGPT is thinking...");
        spinner.start();
    }
    
    const targetConvId = convId || cliConversationId;
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

    try {
        const response = await fetch('https://notegpt.io/api/v2/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `nc_token=${TOKEN}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Origin': 'https://notegpt.io',
                'Referer': 'https://notegpt.io/ai-chat',
                'Accept': '*/*'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (!isAPI) spinner.stop();
            return await handleLimitOrError(prompt, modelStr, retryCount, `HTTP ${response.status}`, imageUrl, isAPI);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        
        let hasOutput = false;
        let isExpired = false;
        let spinnerStopped = false;
        let isReasoning = false; 
        
        let fullText = "";
        let fullReasoning = "";

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                if (chunk.includes('"code":') && chunk.includes('164002')) {
                    isExpired = true;
                    break;
                }
                
                if (!isAPI && !spinnerStopped) {
                    spinner.stop();
                    spinnerStopped = true;
                    if (retryCount === 0) process.stdout.write(`${c.bold}${c.magenta}◼ NoteGPT:${c.reset} \n\n`);
                }
                
                const lines = chunk.split('\n');
                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6).trim();
                        if (jsonStr === '[DONE]' || !jsonStr) continue;
                        try {
                            const dataObj = JSON.parse(jsonStr);
                            
                            if (dataObj.reasoning) {
                                fullReasoning += dataObj.reasoning;
                                if (!isAPI && showReasoning) {
                                    if (!isReasoning) {
                                        process.stdout.write(`\n${c.dim}┌─ Thinking...${c.reset}\n`);
                                        isReasoning = true;
                                    }
                                    process.stdout.write(`${c.dim}${dataObj.reasoning}${c.reset}`);
                                }
                                hasOutput = true;
                            }
                            
                            if (dataObj.text) {
                                fullText += dataObj.text;
                                if (!isAPI) {
                                    if (isReasoning) {
                                        process.stdout.write(`\n${c.dim}└─ Thought complete${c.reset}\n\n`);
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
        
        if (!isAPI && !spinnerStopped) spinner.stop();
        
        if (isExpired) return await handleLimitOrError(prompt, modelStr, retryCount, "Token Kadaluarsa", imageUrl, isAPI, targetConvId);
        if (!hasOutput) return await handleLimitOrError(prompt, modelStr, retryCount, "Limit Internal", imageUrl, isAPI, targetConvId);
        
        if (!isAPI) console.log("\n"); 
        
        return { text: fullText, reasoning: fullReasoning, conversation_id: targetConvId };
        
    } catch (e) {
        if (!isAPI) spinner.stop();
        return await handleLimitOrError(prompt, modelStr, retryCount, "Koneksi Terputus", imageUrl, isAPI, targetConvId);
    }
}

async function handleLimitOrError(prompt, modelStr, retryCount, reason, imageUrl = null, isAPI = false, convId = null) {
    if (retryCount < TOKENS.length - 1) {
        currentTokenIndex = (currentTokenIndex + 1) % TOKENS.length;
        return await askNoteGPT(prompt, modelStr, retryCount + 1, imageUrl, isAPI, convId);
    } else {
        let spinner;
        if (!isAPI) {
            spinner = new Spinner("Limit tercapai. Membuat akun cadangan baru...");
            spinner.start();
        }
        
        const newToken = await createNewNoteGPTAccount();
        if (!isAPI) spinner.stop();
        
        if (newToken) {
            TOKENS.push(newToken);
            currentTokenIndex = TOKENS.length - 1;
            return await askNoteGPT(prompt, modelStr, 0, imageUrl, isAPI, convId);
        } else {
            if (!isAPI) console.error(`\n${c.red}❌ Gagal membuat akun baru.${c.reset}\n`);
            throw new Error("Gagal membuat akun baru secara otomatis.");
        }
    }
}

// --- REST API ROUTES ---
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model, image_url, conversation_id } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required" });
        const targetModel = model || "gpt-4o";
        const convId = conversation_id || `api-conv-${Date.now()}`;
        const result = await askNoteGPT(message, targetModel, 0, image_url || null, true, convId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for direct image upload via multipart/form-data
app.post('/api/chat/upload', upload.single('image'), async (req, res) => {
    try {
        const { message, model } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required" });
        
        let imageUrl = null;
        if (req.file) {
            imageUrl = await uploadToUguu(req.file.path);
            fs.unlinkSync(req.file.path); // cleanup
        }
        
        const targetModel = model || "gpt-4o";
        const convId = req.body.conversation_id || `api-conv-${Date.now()}`;
        const result = await askNoteGPT(message, targetModel, 0, imageUrl, true, convId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CLI LOGIC ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function startChat() {
    console.log(c.clear);
    console.log(`${c.bold}${c.cyan}NoteGPT CLI & API${c.reset} ${c.dim}v2.0${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.bold}Model     :${c.reset} ${c.green}${selectedModel}${c.reset}`);
    console.log(`${c.bold}DeepThink :${c.reset} ${showReasoning ? c.green + 'ON' : c.red + 'OFF'}${c.reset}`);
    console.log(`${c.bold}Auto-Akun :${c.reset} ${c.green}Aktif (${TOKENS.length} Standby)${c.reset}`);
    console.log(`${c.bold}REST API  :${c.reset} ${c.green}http://localhost:${PORT}${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.bold}Command List:${c.reset}`);
    console.log(`  ${c.cyan}/image <path> [prompt]${c.reset}  : Analisis gambar lokal (Bisa spasi)`);
    console.log(`  ${c.cyan}exit, /exit, /quit${c.reset}      : Keluar dari aplikasi`);
    console.log(`${c.dim}─────────────────────────────────────────────────${c.reset}\n`);
    
    const promptLoop = () => {
        rl.question(`${c.bold}${c.green}You:${c.reset} `, async (input) => {
            const lowInput = input.trim().toLowerCase();
            if (lowInput === 'exit' || lowInput === '/exit' || lowInput === '/quit') {
                console.log("Bye!");
                process.exit(0);
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
                    finalInput = remainingPrompt.trim() === '' ? 'Apa isi gambar ini?' : remainingPrompt;
                } catch (e) {
                    spinner.stop();
                    console.log(`${c.red}❌ Error: ${e.message}${c.reset}\n`);
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
    console.log(`${c.bold}${c.cyan}Welcome to NoteGPT CLI & API${c.reset}\n`);
    console.log(`${c.bold}Select AI Model:${c.reset}`);
    
    availableModels.forEach((model, index) => {
        let flags = [];
        if (visionModels.includes(model)) flags.push(`${c.green}[Vision]${c.reset}`);
        if (reasoningModels.includes(model)) flags.push(`${c.cyan}[Reasoning]${c.reset}`);
        if (flags.length === 0) flags.push(`${c.dim}[Text]${c.reset}`);
        
        console.log(`  ${c.cyan}${index + 1}.${c.reset} ${model.padEnd(28, ' ')} ${flags.join(' ')}`);
    });
    console.log("");
    
    rl.question(`${c.bold}${c.blue}?${c.reset} Choice (1-${availableModels.length}): `, (answer) => {
        const num = parseInt(answer.trim());
        if (!isNaN(num) && num >= 1 && num <= availableModels.length) {
            selectedModel = availableModels[num - 1];
        } else {
            selectedModel = "gpt-4o";
        }
        
        if (reasoningModels.includes(selectedModel)) {
            rl.question(`${c.bold}${c.blue}?${c.reset} Enable DeepThink reasoning? (Y/n): `, (ans2) => {
                showReasoning = ans2.trim().toLowerCase() !== 'n';
                app.listen(PORT, () => startChat());
            });
        } else {
            showReasoning = false;
            app.listen(PORT, () => startChat());
        }
    });
}

// --- BOOT ---
selectModel();
