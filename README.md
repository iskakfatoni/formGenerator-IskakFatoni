# formGenerator-IskakFatoni 🚀

> **Aplikasi Pembuat Formulir Modern (Google Forms Clone) dengan Hosting di GitHub Pages, Database Firebase Cloud Firestore, dan Fitur Export ke Excel (.xlsx).**

---

## ✨ Fitur Utama

- **🎨 Modern & Responsive UI**: Antarmuka berbasis *Glassmorphism* dengan tema Gelap (Dark Mode) dan Terang (Light Mode), tipografi modern (*Inter & Outfit*), serta animasi mikro yang halus.
- **🛠️ Form Builder Dinamis & Canggih**:
  - Tipe pertanyaan lengkap: **Teks Singkat, Paragraf, Pilihan Ganda (Radio), Kotak Centang (Checkboxes), Dropdown, Rating Bintang (1-5), Skala Linier (1-5 / 1-10), Tanggal, Waktu, dan Angka**.
  - **📁 Upload Berkas ke Google Drive**: Responden dapat mengunggah file (PDF, Word, Excel, ZIP, Media, Foto) langsung ke folder Google Drive pemilik form via Google Apps Script Webhook tanpa login akun Google.
  - **📸 Kamera & Upload Foto**: Ambil foto langsung dari kamera perangkat atau unggah berkas dengan auto-kompresi gambar.
  - **✍️ Tanda Tangan Digital (Signature Pad)**: Kanvas tanda tangan digital interaktif langsung di peramban.
  - **📍 Perekam Lokasi GPS**: Mengambil koordinat GPS presisi tinggi dengan tombol pratinjau peta.
  - **🔀 Conditional Section Branching**: Logika lompat ke bagian tertentu atau langsung kirim berdasarkan opsi jawaban responden.
  - **🖼️ Custom Banner Header**: Unggah banner kustom dengan kompresi otomatis dan *live preview*.
  - Atur pertanyaan wajib (*Required*), duplikasi pertanyaan, pindah posisi (*reorder*), dan hapus.
  - Pengaturan formulir: Batas waktu penutupan (*deadline*), batasan kuota respon, password akses, dan toggle terima respon.
- **📋 Form Viewer / Responden**:
  - Tampilan pengisian *multi-step section* responsif untuk desktop dan smartphone.
  - Validasi formulir realtime.
  - **Cetak Bukti Registrasi / Struk Resmi (PDF & Print)**: Cetak tanda terima resmi setelah mengirim formulir.
  - **Modal Share**: Generator QR Code & tombol berbagi langsung ke WhatsApp.
  - Halaman konfirmasi terkirim (*Thank You screen*) yang dapat dikustomisasi.
- **📊 Responses Dashboard & Analitik**:
  - Ringkasan total responden, statistik interaktif, dan status formulir.
  - Tabel data respon interaktif dengan fitur pencarian dan tampilan detail responden.
- **📥 Export ke Excel (.xlsx) & CSV**:
  - Ekspor seluruh respon formulir langsung ke berkas Excel `.xlsx` dalam satu klik menggunakan SheetJS dan format CSV.
  - Penyesuaian otomatis lebar kolom dan format tanggal Indonesia.
- **🔥 Firebase Cloud Firestore & Storage Realtime**:
  - Data formulir dan respon tersimpan di cloud secara aman dengan fallback otomatis ke *LocalStorage* & kompresi *Base64 dataURL* jika offline/timeout.
- **🌐 100% Siap untuk GitHub Pages**:
  - Arsitektur Single Page Application (SPA) dengan otomatisasi CI/CD deploy & *cache-busting* otomatis.

> 💡 *Detail dokumentasi arsitektur dan riwayat progres lengkap dapat dilihat di [PROJECT_MEMORY.md](PROJECT_MEMORY.md).*

---

## 📂 Struktur Berkas

```
formGenerator-IskakFatoni/
├── index.html                   # Halaman utama SPA
├── css/
│   ├── main.css                 # Desain sistem, tema gelap/terang, modal, toast
│   ├── builder.css              # Styling halaman pembuat form
│   ├── form-view.css            # Styling halaman pengisian form untuk responden
│   └── responses.css            # Styling dashboard data tabel respon
├── js/
│   ├── app.js                   # Router utama SPA, controller modal & tema
│   ├── firebase-config.js       # Inisialisasi Firebase Cloud Firestore
│   ├── storage.js               # Data Access Layer (Firestore + fallback LocalStorage)
│   ├── builder.js               # Logika Form Builder (editor pertanyaan & opsi)
│   ├── form-view.js             # Logika Form Viewer (validasi & submit respon)
│   ├── responses.js             # Logika Dashboard Respon & tabel
│   └── export-excel.js          # Engine konversi data ke file Excel (.xlsx)
├── .github/
│   └── workflows/
│       └── deploy.yml           # Otomatisasi deploy ke GitHub Pages
└── README.md                    # Dokumentasi lengkap
```

---

## 🚀 Panduan Setup Firebase Firestore

Untuk menghubungkan Firebase ke formGenerator-IskakFatoni:

1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru.
2. Buat database **Cloud Firestore** dalam mode *Test mode* atau atur Security Rules berikut:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Izinkan membaca dan membuat formulir
    match /forms/{formId} {
      allow read, write: if true;
    }
    // Izinkan publik mengirimkan respon dan pemilik membaca respon
    match /responses/{responseId} {
      allow read, write: if true;
    }
  }
}
```

3. Daftarkan aplikasi Web di Project Settings Firebase untuk mendapatkan kredensial:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

4. **Masukkan Konfigurasi**:
   - **Cara 1 (Visual via Web)**: Klik ikon database / badge di pojok kanan atas aplikasi formGenerator-IskakFatoni, lalu masukkan config Firebase Anda.
   - **Cara 2 (Permanen di Kode)**: Edit variabel `DEFAULT_FIREBASE_CONFIG` di berkas `js/firebase-config.js`.

---

### 🌐 Link Publikasi & Repository
- **Repository GitHub**: [https://github.com/iskakfatoni/formGenerator-IskakFatoni](https://github.com/iskakfatoni/formGenerator-IskakFatoni)
- **Live Demo di GitHub Pages**: [https://iskakfatoni.github.io/formGenerator-IskakFatoni/](https://iskakfatoni.github.io/formGenerator-IskakFatoni/)

### Langkah Mengaktifkan GitHub Pages di Repository Ini:
1. Buka repository [https://github.com/iskakfatoni/formGenerator-IskakFatoni](https://github.com/iskakfatoni/formGenerator-IskakFatoni).
2. Klik menu **Settings** > **Pages** di sidebar kiri.
3. Di bagian **Build and deployment**:
   - **Source**: Pilih **Deploy from a branch**.
   - **Branch**: Pilih `main` (atau `master`) dan folder `/ (root)`.
   - Klik **Save**.
4. Dalam 1-2 menit, aplikasi Anda akan live di:
   👉 **https://iskakfatoni.github.io/formGenerator-IskakFatoni/**

### Metode 2: Otomatis via GitHub Actions
Berkas `.github/workflows/deploy.yml` sudah disediakan di proyek ini. Anda cukup memilih **Source: GitHub Actions** di menu **Settings > Pages**.

---

## 📊 Cara Menggunakan Fitur Export Excel

1. Buka formulir dari Dashboard dengan mengklik tombol **Respon**.
2. Klik tombol hijau **"Export ke Excel (.xlsx)"** di pojok kanan atas.
3. Berkas `.xlsx` akan otomatis terunduh ke komputer Anda dengan nama `[nama_form]_responses_[tanggal].xlsx` yang langsung dapat dibuka di Microsoft Excel, Google Sheets, atau LibreOffice.

---

## 💡 Lisensi & Bebas Dikembangkan
Proyek ini bersifat open-source dan bebas dimodifikasi sesuai kebutuhan Anda.
