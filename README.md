<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
  <br/>
  <br/>
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=36&pause=1000&color=10B981&center=true&vCenter=true&width=600&height=60&lines=NoteGPT+CLI+%26+REST+API;Unlimited+AI+Access;Auto-Account+Generation;Vision+%26+Reasoning+Ready" alt="Typing SVG" />
  </a>
  <p><strong>Ultimate Reverse-Engineered AI Client & API Server</strong></p>
</div>

---

## 🌟 Tentang Proyek Ini

**NoteGPT CLI & API** adalah sebuah mesin (engine) cerdas yang membungkus layanan NoteGPT ke dalam antarmuka *Command Line* (CLI) yang elegan dan sebuah *REST API Server* yang kuat. 

Proyek ini dilengkapi dengan teknologi **Auto-Rotation** dan **Headless Account Generation**. Artinya, ketika akun AI Anda mencapai limit (*rate-limited*), sistem akan secara otomatis memutar akun cadangan, dan jika habis, ia akan memerintahkan robot *Playwright* untuk mendaftarkan akun baru secara diam-diam di latar belakang menggunakan *temporary email* tanpa campur tangan Anda!

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
| :--- | :--- |
| 💻 **Interactive CLI** | Antarmuka terminal interaktif dengan indikator visual dan animasi *spinner*. |
| 🌐 **Dual Engine** | Berjalan sebagai CLI interaktif dan REST API server secara bersamaan. |
| 🔄 **Auto-Create Account** | Menembus limit harian dengan mendaftarkan akun baru secara otomatis (*headless*). |
| 👁️ **Vision AI** | Mendukung analisis gambar lokal (*upload file*) maupun dari URL publik. |
| 🧠 **DeepThink Reasoning** | Mendukung model *reasoning* dengan proses analitis (seperti DeepSeek R1). |
| 🔗 **Context Awareness** | AI mampu mengingat percakapan sebelumnya menggunakan sistem `conversation_id`. |

---

## 🧠 Model AI yang Didukung

Sistem ini mendukung berbagai model mutakhir dengan kapabilitas yang berbeda-beda:

| No | Model (Internal Payload) | Kapabilitas | Deskripsi Singkat |
|:---|:---|:---:|:---|
| 1 | `gpt-4o-mini` | `[Vision]` | Model ringan dan super cepat dari OpenAI. |
| 2 | `gpt-4o` | `[Vision]` | Model paling cerdas dan multimodial dari OpenAI. |
| 3 | `gemini-3.1-flash-lite` | `[Vision]` | Model Gemini efisien untuk respons kilat. |
| 4 | `gemini-2.5-flash` | `[Vision]` | Model Gemini standar dengan analisis gambar tinggi. |
| 5 | `gemini-3-flash-preview` | `[Vision]` | Model Gemini eksperimental versi terbaru. |
| 6 | `deepseek-chat` | `[Reasoning]` | Model AI DeepSeek dengan nalar logika. |
| 7 | `deepseek-reasoner` | `[Reasoning]` | Model analitis DeepSeek (mirip dengan o1/R1). |

---

## ⚙️ Instalasi

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

3. **Jalankan Aplikasi:**
   ```bash
   node note.js
   ```

---

## 💻 Penggunaan: Mode CLI

Setelah aplikasi berjalan, Anda akan disambut oleh antarmuka pemilihan model.

**Contoh Tampilan Menu:**
```text
Welcome to NoteGPT CLI & API

Select AI Model:
  1. gpt-4o-mini                  [Vision]
  2. gpt-4o                       [Vision]
  ...
? Choice (1-7): 2
```

**Daftar Perintah (Commands) di CLI:**
- `/image <path_ke_file_gambar> [pertanyaan]` : Mengunggah dan menganalisis gambar lokal.
  *Contoh:* `/image C:\Users\lann\foto.png Tolong jelaskan isi gambar ini!`
- `exit` atau `/quit` : Untuk keluar dari aplikasi.

---

## 🌐 Penggunaan: Mode REST API

Secara *default*, *server* REST API akan otomatis berjalan di **`http://localhost:3000`** bersamaan dengan CLI. Anda bisa menembaknya menggunakan aplikasi *frontend*, Postman, maupun cURL.

### 1. Chat Teks / Gambar URL
**Endpoint:** `POST /api/chat`  
**Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "message": "Halo, siapa namamu?",
  "model": "gpt-4o",
  "image_url": "https://contoh.com/gambar.png", 
  "conversation_id": "api-conv-12345" 
}
```
*(Catatan: `image_url` dan `conversation_id` bersifat opsional)*

**Response (200 OK):**
```json
{
  "text": "Halo! Saya adalah asisten AI...",
  "reasoning": "",
  "conversation_id": "api-conv-12345"
}
```

### 2. Upload Gambar Lokal (Multipart)
Jika Anda memiliki file fisik, Anda bisa langsung mengunggahnya ke API ini, dan sistem akan mengurus *hosting* sementaranya untuk Anda.

**Endpoint:** `POST /api/chat/upload`  
**Headers:** `Content-Type: multipart/form-data`

**Form-Data:**
- `message` (Text) : Pertanyaan Anda.
- `model` (Text) : `gpt-4o`
- `image` (File) : *(Pilih file gambar Anda di sini)*

---

## ⚠️ Disclaimer (Peringatan)

Proyek ini dibuat untuk tujuan **Eksperimental & Edukasi** semata. Segala bentuk penyalahgunaan, beban *request* yang terlalu berat, atau pelanggaran *Terms of Service* dari pihak ketiga (NoteGPT) berada di luar tanggung jawab pengembang proyek ini. Harap gunakan dengan bijak.

---

## 🤝 Penutup & Kontribusi

Terima kasih telah mengunjungi dan menggunakan repositori ini! Proyek ini mendemonstrasikan bagaimana kita bisa menghubungkan otomatisasi *headless browser*, manipulasi API, dan CLI interaktif menjadi satu ekosistem Node.js yang kuat.

Jika Anda menemukan kutu (*bug*), memiliki ide fitur gila lainnya, atau sekadar ingin memperbaiki kode, jangan ragu untuk membuka **Issues** atau mengirimkan **Pull Request**. Mari kita bangun dan kembangkan proyek ini bersama-sama! 🚀

Jika proyek ini bermanfaat bagi Anda, jangan lupa berikan bintang (⭐) di repositori ini. *Happy Coding!*

<br/>
<div align="center">
  <p>Dibuat oleh <a href="https://github.com/lannreal">Lann</a></p>
</div>
