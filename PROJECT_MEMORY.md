# 🧠 formGenerator-IskakFatoni - Project Memory & Knowledge Base

> **Dokumen ini menyimpan seluruh konteks arsitektur, histori perkembangan, keputusan desain, dan status fitur proyek formGenerator-IskakFatoni.**

---

## 📌 Ringkasan Proyek
* **Nama Proyek**: formGenerator-IskakFatoni (Multi-User Cloud Form Builder & Excel Export)
* **Arsitektur**: Single Page Application (Vanilla JavaScript ES6+, Vanilla CSS Glassmorphism, Semantic HTML5)
* **Backend / Database**: Google Firebase (Cloud Firestore, Firebase Authentication, & Firebase Storage) + Fallback LocalStorage & DataURL Compression
* **Hosting**: GitHub Pages (dengan GitHub Actions deployment & automatic cache-busting)
* **Repository**: [https://github.com/iskakfatoni/formGenerator-IskakFatoni](https://github.com/iskakfatoni/formGenerator-IskakFatoni)

---

## 🏗️ Struktur Arsitektur & Berkas Utama

```
formGenerator-IskakFatoni/
├── index.html                   # Dashboard & Landing Page (List Form, Search, Filter, Multi-User Auth Modal)
├── form.html                    # Form Builder, Form Responder/Viewer, & Response Dashboard
├── css/
│   ├── main.css                 # Design system tokens, Glassmorphism, Light/Dark mode, Auth tabs & UI modals
│   ├── builder.css              # Form builder editor, drag-n-drop, settings panel, conditional jumps
│   ├── form-view.css            # Responder view, signature canvas, camera preview, receipt print CSS
│   └── responses.css            # Responses summary, chart stats, interactive data tables
├── js/
│   ├── app.js                   # Dashboard logic, auth state listener, card actions & filtering
│   ├── auth.js                  # Multi-User Authentication Manager (Google Sign-In, Email Login/Register, Route Guard)
│   ├── firebase-config.js       # Firebase SDK initialization & credentials
│   ├── storage.js               # Data Access Layer with Multi-User Data Isolation (ownerUid) & fallback
│   ├── builder.js               # Core Form Builder engine, question types, logic jumps, templates
│   ├── form-view.js             # Form responder engine, multi-section stepper, validation, signature pad, camera/GPS
│   ├── responses.js             # Response table, analytics summary, detail viewer
│   ├── export-excel.js          # Export to Excel (.xlsx) via SheetJS & CSV exporter
│   ├── image-uploader.js        # Client-side image auto-compression, aspect-ratio handler, Cloud fallback
│   └── gdrive-uploader.js       # Google Drive upload engine via Apps Script Webhook & fallback
├── firestore.rules              # Multi-User Firestore Security Rules (ownerUid checks & open responder submissions)
├── firebase.json                # Firebase Hosting / Tools config
└── .github/workflows/deploy.yml # CI/CD deployment with automated cache-busting timestamp
```

---

## 🚀 Fitur yang Telah Diimplementasikan & Berfungsi Penuh

### 1. Multi-User & Manajemen Akun ([auth.js](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/js/auth.js) & [index.html](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/index.html))
- **Google Sign-In**: Masuk secara instan menggunakan akun Google apa pun.
- **Email & Password Login / Register**: Tab interaktif untuk Masuk atau Mendaftar akun baru dengan validasi kata sandi.
- **Isolasi Data Formulir (`ownerUid`)**: Setiap pengguna memiliki ruang kerja dan daftar formulir terpisah yang terproteksi secara aman di Firestore.
- **Akses Super-Admin**: Akun pemilik (`iskakfatoni@gmail.com`) memiliki role admin dengan akses kompatibilitas ke formulir warisan (*legacy*).

### 2. Dashboard & Landing Page ([index.html](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/index.html))
- Grid kartu form responsif dengan indikator status (*Active/Closed*), jumlah respons, tanggal dibuat.
- Action bar cepat: **Edit Form**, **Isi Form**, **Lihat Respon**, **Salin Link**, **Duplikasi**, dan **Hapus**.
- Fitur pencarian (*live search*) & filter berdasarkan status.
- Portal autentikasi akun terintegrasi.

### 3. Form Builder Canggih ([form.html](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/form.html) & [builder.js](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/js/builder.js))
- **Tipe Pertanyaan Lengkap**:
  - Teks Pendek, Paragraf, Angka.
  - Pilihan Ganda (Radio), Kotak Centang (Checkboxes), Dropdown.
  - Skala Linier (1-5 / 1-10), Rating Bintang (1-5), Tanggal, Waktu.
  - **Upload Berkas ke Google Drive (`file_gdrive`)**: Responden dapat mengunggah berkas format apa pun (PDF, Word, Excel, ZIP, Media) langsung ke folder Google Drive pemilik formulir tanpa perlu login Google.
  - **Upload Foto & Kamera**: Mendukung pengambilan foto langsung dari kamera HP/laptop atau file explorer.
  - **Tanda Tangan Digital (Signature Pad)**: Kanvas interaktif HTML5 dengan fungsi clear dan simpan resolusi tinggi.
  - **Perekam Lokasi GPS**: Mengambil koordinat Geolocation presisi tinggi dengan tombol preview Google Maps.
- **Integrasi Google Apps Script Webhook & Panduan 1-Klik**:
  - Modal panduan setup webhook Google Apps Script dengan tombol 1-klik salin kode skrip dan penguji koneksi webhook.
- **Conditional Section Branching (Logika Percabangan)**:
  - Opsi dropdown pada setiap opsi pilihan ganda/dropdown untuk menentukan arah navigasi: *Lanjut ke bagian berikutnya*, *Lompat ke Bagian X*, atau *Kirim formulir (Submit)*.
- **Banner Kustom**: Upload gambar banner kustom dengan kompresi cerdas di sisi klien dan *live preview*.
- **Pengaturan & Proteksi Formulir**:
  - Batas waktu pengisian (*Deadline / Schedule Closure*).
  - Batasan kuota respon (*Max Submissions Limit*).
  - Proteksi kata sandi (*Password Access*).
  - Saklar terima respon (*Accept Responses Toggle*).
  - Kustomisasi pesan terima kasih & pesan form ditutup.
- **Sistem Template**: Template bawaan seperti *Biodata Siswa*, *Survei Kepuasan*, *Pendaftaran Acara*.

### 4. Pengisian Formulir / Responder ([form-view.js](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/js/form-view.js))
- Akses publik bebas tanpa wajib mendaftar akun.
- Alur *Multi-Step Sections* dengan bilah progres (*Progress Bar*).
- Validasi input realtime (wajib diisi, format email/angka, validasi tanda tangan & file).
- **Mekanisme Cloud Fallback**: Pengunggahan file dilengkapi pelindung batas waktu (timeout guard). Jika Firebase Storage offline/gagal, file otomatis dikonversi menjadi dataURL terkompresi sehingga pengiriman tidak pernah macet.
- **Struk / Bukti Registrasi Resmi (Print & PDF)**: Cetak bukti pengisian otomatis yang rapi dengan nomor referensi unik dan format siap cetak.
- **Modal Berbagi (Share Modal)**:
  - Generator QR Code otomatis untuk form link.
  - Tombol bagikan sekali klik ke WhatsApp dengan teks pesan kustom.

### 5. Analisis Respons & Ekspor ([responses.js](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/js/responses.js), [export-excel.js](file:///c:/Users/iskak/Antigravity-Projetcs/formGenerator-IskakFatoni/js/export-excel.js))
- Tab ringkasan analitik dan tabel respons data lengkap.
- Tampilan detail respon per individu (termasuk pratinjau gambar, tanda tangan, dan peta GPS).
- Ekspor data lengkap ke **Microsoft Excel (.xlsx)** dan **CSV**.

### 6. Keamanan & Deployment
- `firestore.rules` terkonfigurasi untuk multi-user: proteksi CRUD pemilik berdasarkan `ownerUid` dan submit jawaban publik terbuka.
- GitHub Actions CI/CD workflow dengan otomatisasi *cache-busting* (`v=${{ github.sha }}`) untuk menghindari stale cache di browser.

---

## 📝 Catatan Konvensi Kode & Best Practices
1. **No External Heavy Frameworks**: Mempertahankan Vanilla JS & CSS murni untuk performa maksimal, waktu muat instan, dan kemudahan hosting di GitHub Pages.
2. **Null Safety & Resilience**: Selalu menggunakan pengecekan elemen DOM (`if (!el) return`) dan fallback data untuk mencegah error unhandled exception.
3. **Responsive Mobile First**: Semua komponen (tanda tangan, kamera, tabel, kartu) dirancang fleksibel untuk desktop maupun perangkat mobile.
