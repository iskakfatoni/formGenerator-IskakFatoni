/**
 * FORMCRAFT - Builder Preset Form Templates
 * Provides predefined ready-to-use form structure templates.
 */

window.BuilderTemplates = {
  getWhatsAppSurveyTemplate() {
    return {
      title: 'Pendataan Nomor WhatsApp Siswa & Orang Tua',
      description: 'Silakan pilih kelas dan nomor absen Anda untuk mengisi formulir pendataan kontak WhatsApp aktif.',
      themeColor: '#10b981',
      sectionTheme: '#10b981',
      fontFamily: "'Inter', sans-serif",
      isQuizMode: false,
      sections: [
        { id: 'sec_start', title: 'Pemilihan Kelas Siswa', description: 'Pilih kelas Anda saat ini untuk diarahkan ke daftar nama siswa yang sesuai.', nextSectionId: 'inherit' },
        { id: 'sec_7a', title: 'Daftar Siswa Kelas 7-A', description: 'Pilih nomor absen dan nama Anda untuk Kelas 7-A.', nextSectionId: 'sec_kontak' },
        { id: 'sec_7b', title: 'Daftar Siswa Kelas 7-B', description: 'Pilih nomor absen dan nama Anda untuk Kelas 7-B.', nextSectionId: 'sec_kontak' },
        { id: 'sec_8a', title: 'Daftar Siswa Kelas 8-A', description: 'Pilih nomor absen dan nama Anda untuk Kelas 8-A.', nextSectionId: 'sec_kontak' },
        { id: 'sec_8b', title: 'Daftar Siswa Kelas 8-B', description: 'Pilih nomor absen dan nama Anda untuk Kelas 8-B.', nextSectionId: 'sec_kontak' },
        { id: 'sec_9a', title: 'Daftar Siswa Kelas 9-A', description: 'Pilih nomor absen dan nama Anda untuk Kelas 9-A.', nextSectionId: 'sec_kontak' },
        { id: 'sec_9b', title: 'Daftar Siswa Kelas 9-B', description: 'Pilih nomor absen dan nama Anda untuk Kelas 9-B.', nextSectionId: 'sec_kontak' },
        { id: 'sec_kontak', title: 'Pengisian Nomor WhatsApp & Kontak', description: 'Lengkapi nomor WhatsApp aktif Anda dan orang tua/wali untuk keperluan komunikasi sekolah.', nextSectionId: 'submit' }
      ],
      questions: [
        {
          id: 'q_kelas',
          sectionId: 'sec_start',
          type: 'choice',
          title: 'Pilih Kelas Anda',
          description: 'Pilih kelas Anda untuk diarahkan langsung ke daftar siswa yang relevan.',
          required: true,
          options: [
            { text: 'Kelas 7-A (20 Siswa)', nextSectionId: 'sec_7a' },
            { text: 'Kelas 7-B (20 Siswa)', nextSectionId: 'sec_7b' },
            { text: 'Kelas 8-A (20 Siswa)', nextSectionId: 'sec_8a' },
            { text: 'Kelas 8-B (20 Siswa)', nextSectionId: 'sec_8b' },
            { text: 'Kelas 9-A (20 Siswa)', nextSectionId: 'sec_9a' },
            { text: 'Kelas 9-B (20 Siswa)', nextSectionId: 'sec_9b' }
          ]
        },
        ...['7a', '7b', '8a', '8b', '9a', '9b'].map((cls, cIdx) => {
          const classNames = ['7-A', '7-B', '8-A', '8-B', '9-A', '9-B'];
          const sampleNames = [
            'Ahmad Fauzi', 'Anisa Rahmawati', 'Bagus Pratama', 'Bima Sakti', 'Cantika Dewi',
            'Dimas Anggara', 'Dwi Lestari', 'Fajar Ramadhan', 'Fitri Handayani', 'Galih Permana',
            'Hana Safitri', 'Irfan Hakim', 'Indah Permatasari', 'Joko Susilo', 'Kevin Sanjaya',
            'Lestari Putri', 'Muhammad Rizky', 'Nabila Syakieb', 'Putra Pratama', 'Zahra Amelia'
          ];
          return {
            id: `q_siswa_${cls}`,
            sectionId: `sec_${cls}`,
            type: 'choice',
            title: `Pilih Nama Siswa (${classNames[cIdx]})`,
            description: 'Pilih nama lengkap Anda sesuai daftar presensi kelas.',
            required: true,
            options: Array.from({ length: 20 }, (_, i) => {
              const num = String(i + 1).padStart(2, '0');
              return `${num}. ${sampleNames[i]} (${classNames[cIdx]})`;
            })
          };
        }),
        { id: 'q_wa_siswa', sectionId: 'sec_kontak', type: 'text', title: 'Nomor WhatsApp Siswa Aktif', description: 'Contoh: 081234567890 (Pastikan aktif menerima pesan dan telepon WA)', required: true },
        { id: 'q_wa_ortu', sectionId: 'sec_kontak', type: 'text', title: 'Nomor WhatsApp Orang Tua / Wali', description: 'Nomor kontak aktif orang tua/wali untuk informasi resmi sekolah.', required: true },
        { id: 'q_nama_ortu', sectionId: 'sec_kontak', type: 'text', title: 'Nama Lengkap Orang Tua / Wali', description: 'Nama Bapak/Ibu wali siswa.', required: true },
        { id: 'q_catatan', sectionId: 'sec_kontak', type: 'text', title: 'Catatan Tambahan (Opsional)', description: 'Tuliskan jika ada kendala koneksi atau nomor cadangan lainnya.', required: false }
      ]
    };
  },

  getStudentBioTemplate() {
    return {
      title: 'Formulir Biodata Lengkap Siswa Baru',
      description: 'Silakan isi seluruh formulir biodata, unggah foto resmi, tentukan titik lokasi rumah (GPS), dan bubuhkan tanda tangan digital.',
      themeColor: '#06b6d4',
      sectionTheme: '#06b6d4',
      fontFamily: "'Inter', sans-serif",
      isQuizMode: false,
      sections: [
        { id: 'sec_bio', title: 'Bagian 1: Biodata & Identitas Diri', description: 'Data pribadi siswa baru.', nextSectionId: 'inherit' },
        { id: 'sec_lokasi', title: 'Bagian 2: Titik Koordinat Rumah & Verifikasi', description: 'Penentuan lokasi tempat tinggal dan tanda tangan digital.', nextSectionId: 'submit' }
      ],
      questions: [
        { id: 'q_nisn', sectionId: 'sec_bio', type: 'text', title: 'Nomor Induk Siswa Nasional (NISN)', description: '10 digit NISN resmi dari Kemdikbud.', required: true },
        { id: 'q_nama', sectionId: 'sec_bio', type: 'text', title: 'Nama Lengkap Siswa (Sesuai Ijazah)', description: 'Gunakan huruf kapital pada awal kata.', required: true },
        { id: 'q_jk', sectionId: 'sec_bio', type: 'choice', title: 'Jenis Kelamin', required: true, options: ['Laki-laki', 'Perempuan'] },
        { id: 'q_tgl', sectionId: 'sec_bio', type: 'date', title: 'Tanggal Lahir', description: 'Pilih tanggal lahir Anda.', required: true },
        { id: 'q_foto', sectionId: 'sec_bio', type: 'file', photoSource: 'all', title: 'Foto Resmi Siswa (3x4)', description: 'Upload atau ambil foto langsung mengenakan seragam rapi.', required: true },
        { id: 'q_gps', sectionId: 'sec_lokasi', type: 'location', title: 'Titik Koordinat Rumah (GPS)', description: 'Tekan tombol untuk mendeteksi akurasi lokasi tempat tinggal saat ini.', required: true },
        { id: 'q_alamat', sectionId: 'sec_lokasi', type: 'text', title: 'Alamat Rumah Lengkap (RT/RW/Desa/Kecamatan)', description: 'Sesuai Kartu Keluarga (KK).', required: true },
        { id: 'q_ttd', sectionId: 'sec_lokasi', type: 'signature', title: 'Tanda Tangan Digital Siswa / Wali', description: 'Goreskan tanda tangan Anda pada kotak kanvas di bawah.', required: true }
      ]
    };
  }
};
