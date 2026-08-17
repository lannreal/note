<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Pure_HTTP-10B981?style=for-the-badge&logo=fastapi&logoColor=white" alt="Pure HTTP" />
  <img src="https://img.shields.io/badge/Termux_Ready-black?style=for-the-badge&logo=android&logoColor=white" alt="Termux Ready" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
  <br/>
  <br/>
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=36&pause=1000&color=10B981&center=true&vCenter=true&width=600&height=60&lines=NoteGPT+CLI+%26+REST+API;Unlimited+AI+Access;100%25+Pure+HTTP+(Zero+Browser);Termux+%26+Docker+Ready;Vision+%26+DeepThink+Reasoning" alt="Typing SVG" />
  </a>
  <p><strong>Ultimate Reverse-Engineered AI Client & API Server (100% Pure HTTP / Zero Browser / Termux Ready)</strong></p>
</div>

---

## 🌟 Tentang Proyek Ini

**NoteGPT CLI & API** adalah sebuah mesin (*engine*) cerdas yang membungkus layanan NoteGPT ke dalam antarmuka *Command Line* (CLI) yang elegan dan sebuah *REST API Server* yang kuat.

Proyek ini dibangun menggunakan arsitektur **100% Pure HTTP Reverse Engineering**. Tanpa bantuan browser headless (seperti Puppeteer/Playwright), aplikasi ini berinteraksi langsung dengan REST API NoteGPT dan Multi-Provider Temporary Email untuk registrasi, verifikasi token, login, hingga streaming respon AI. 

Hasilnya: **Sangat ringan (<30 MB RAM), instan (~2-3 detik per akun baru), 100% kompatibel di Android Termux, VPS, maupun Docker container tanpa membutuhkan Chromium binary!**

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
| :--- | :--- |
| ⚡ **100% Pure HTTP (Zero Browser)** | Seluruh proses (termasuk auto-create account) berjalan via direct API tanpa browser headless. |
| 📱 **Termux & Android Native** | Sangat ringan dan langsung berjalan mulus di aplikasi Termux tanpa PRoot/X11. |
| 💻 **Interactive CLI** | Antarmuka terminal interaktif dengan live streaming, spinner visual, dan perintah interaktif. |
| 🌐 **Dual Engine** | Berjalan sebagai CLI interaktif dan REST API server secara bersamaan. |
| 🔄 **Auto-Create Account & Rotation** | Menembus limit harian dengan mendaftarkan akun baru secara otomatis & instan via REST API. |
| 🛡️ **Multi-Provider Failover** | Dilengkapi sistem failover email sementara (`mail.tm` & `mail.gw`) dan Mutex concurrency lock. |
| 👁️ **Vision AI** | Mendukung analisis gambar lokal (*upload file*) maupun dari URL publik. |
| 🧠 **DeepThink Reasoning** | Mendukung model *reasoning* dengan proses analitis CoT (seperti DeepSeek Reasoner). |
| 🔗 **Context Awareness** | AI mampu mengingat percakapan sebelumnya menggunakan sistem `conversation_id`. |

---

## 🧠 Model AI yang Didukung

Sistem ini mendukung 8 model AI mutakhir yang telah diuji dan terverifikasi 100% aktif di backend NoteGPT:

| No | Model (Internal Payload) | Kapabilitas | Deskripsi Singkat |
|:---|:---|:---:|:---|
| 1 | `gpt-4o-mini` | `[Vision]` | Model ringan dan super cepat dari OpenAI. |
| 2 | `gpt-4o` | `[Vision]` | Model paling cerdas dan multimodal dari OpenAI. |
| 3 | `gpt-4.1-mini` | `[Vision]` | Varian ringkas GPT generasi terbaru dari OpenAI. |
| 4 | `gemini-3.1-flash-lite` | `[Vision]` | Model Gemini efisien untuk respons kilat. |
| 5 | `gemini-2.5-flash` | `[Vision]` | Model Gemini standar dengan analisis visual tinggi. |
| 6 | `gemini-3-flash-preview` | `[Vision]` | Model Gemini eksperimental versi preview. |
| 7 | `deepseek-chat` | `[Reasoning]` | Model AI DeepSeek dengan nalar logika. |
| 8 | `deepseek-reasoner` | `[Reasoning]` | Model analitis DeepSeek (CoT reasoning / DeepThink). |

---

## ⚙️ Instalasi & Penggunaan

### A. Di PC / Laptop / VPS (Windows, Linux, macOS)
Pastikan komputer Anda sudah terinstal **Node.js** (v18+).

1. **Clone repositori ini:**
   ```bash
   git clone https://github.com/lannreal/note.git
   cd note
   ```

2. **Instal seluruh *dependencies*:**
   ```bash
   npm install
   ```

3. **Jalankan Mode CLI (Interaktif):**
   ```bash
   node note.js
   ```

---

### B. Di Android (Termux) 📱
Aplikasi ini 100% didukung secara native di Termux:

1. **Update & install Node.js + Git:**
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs git -y
   ```

2. **Clone & Masuk ke folder project:**
   ```bash
   git clone https://github.com/lannreal/note.git
   cd note
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Jalankan:**
   ```bash
   node note.js
   ```

---

## 💻 Penggunaan: Mode CLI

Setelah aplikasi berjalan, Anda akan disambut oleh antarmuka pemilihan model.

**Contoh Tampilan Menu:**
```text
=== NoteGPT CLI & API ===

Pilih Model AI:
  1. gpt-4o-mini               [Vision]
  2. gpt-4o                    [Vision]
  3. gpt-4.1-mini              [Vision]
  4. gemini-3.1-flash-lite     [Vision]
  5. gemini-2.5-flash          [Vision]
  6. gemini-3-flash-preview    [Vision]
  7. deepseek-chat             [Reasoning]
  8. deepseek-reasoner         [Reasoning]

? Pilihan (1-8): 2
```

**Daftar Perintah (Commands) di CLI:**
| Perintah | Fungsi | Contoh |
| :--- | :--- | :--- |
| `/image <path> [prompt]` | Menganalisis file gambar lokal | `/image C:\foto.png Jelaskan gambar ini!` |
| `/models` atau `/model` | Mengganti model AI yang aktif | `/models` |
| `exit` atau `/quit` | Keluar dari aplikasi | `exit` |

---

## 🌐 Penggunaan: Mode REST API

Secara *default*, *server* REST API akan otomatis berjalan di **`http://localhost:3000`** bersamaan dengan CLI.

### 1. Chat Teks / Gambar via URL
**Endpoint:** `POST /api/chat`  
**Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "message": "Halo, siapa kamu?",
  "model": "gpt-4o",
  "image_url": "https://contoh.com/gambar.png", 
  "conversation_id": "api-conv-12345" 
}
```
*(Catatan: `model`, `image_url`, dan `conversation_id` bersifat opsional)*

**Response (200 OK):**
```json
{
  "text": "Halo! Saya adalah asisten AI...",
  "reasoning": "",
  "conversation_id": "api-conv-12345"
}
```

---

### 2. Upload Gambar Lokal (Multipart Form-Data)
Jika Anda memiliki file fisik di server/klien, kirim langsung via *multipart form-data*:

**Endpoint:** `POST /api/chat/upload`  
**Headers:** `Content-Type: multipart/form-data`

**Form-Data:**
- `message` (Text) : Pertanyaan atau instruksi Anda.
- `model` (Text) : `gpt-4o` (Opsional)
- `image` (File) : *(File gambar .png / .jpg / .webp)*

---

### 3. Cek Status Server & Pool Token
**Endpoint:** `GET /api/status`  

**Response (200 OK):**
```json
{
  "status": "online",
  "engine": "100% Pure HTTP (Zero Browser)",
  "activeTokensCount": 1,
  "defaultModel": "gpt-4o",
  "availableModels": [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "deepseek-chat",
    "deepseek-reasoner"
  ]
}
```

---

## 🚀 Menjalankan Sebagai Standalone Server (Docker / PM2)

Jika Anda ingin menjalankan aplikasi murni sebagai background REST API server tanpa antarmuka interaktif CLI:

```bash
node note.js --server
```

---

## ⚠️ Disclaimer (Peringatan)

Proyek ini dibuat untuk tujuan **Eksperimental & Edukasi** semata. Segala bentuk penyalahgunaan, beban *request* yang terlalu berat, atau pelanggaran *Terms of Service* dari pihak ketiga (NoteGPT) berada di luar tanggung jawab pengembang proyek ini. Harap gunakan dengan bijak.

---

## 🤝 Penutup & Kontribusi

Terima kasih telah mengunjungi repositori ini! Proyek ini mendemonstrasikan bagaimana kita bisa mereverse-engineer API, mengotomasi otentikasi murni lewat HTTP, dan menyajikan CLI interaktif serta REST API server menjadi satu ekosistem Node.js yang cepat, efisien, dan ramah untuk berbagai platform (termasuk Termux) tanpa ketergantungan pada browser headless.

Jika Anda menemukan kendala (*bug*), memiliki ide fitur, atau ingin berkontribusi, jangan ragu untuk membuka **Issues** atau mengirimkan **Pull Request**. 🚀

Jika proyek ini bermanfaat bagi Anda, jangan lupa berikan bintang (⭐) di repositori ini. *Happy Coding!*

<br/>
<div align="center">
  <p>Dibuat dengan ❤️ oleh <a href="https://github.com/lannreal">Lann</a></p>
</div>
