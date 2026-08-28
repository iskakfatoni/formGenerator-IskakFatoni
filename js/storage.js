/**
 * FORMCRAFT - Unified Storage & Data Layer with Multi-User Isolation
 * Provides CRUD operations for Forms and Responses across Firestore & LocalStorage fallback.
 */

class FormStorage {
  constructor() {
    this.LOCAL_FORMS_KEY = 'formcraft_local_forms';
    this.LOCAL_RESPONSES_KEY = 'formcraft_local_responses';
    this.ensureSeedData();
  }

  // Check if Firebase is active
  get isCloud() {
    return window.firebaseManager && window.firebaseManager.isConfigured && window.firebaseManager.db;
  }

  get db() {
    return window.firebaseManager.db;
  }

  getCurrentUser() {
    return window.authManager ? window.authManager.getCurrentUser() : null;
  }

  // --- FORMS CRUD ---

  async getAllForms() {
    const user = this.getCurrentUser();
    const userUid = user ? user.uid : null;
    const isSuperAdmin = user && window.authManager && window.authManager.isAdmin(user.email);

    if (this.isCloud && userUid) {
      try {
        let forms = [];

        // 1. Fetch user's own forms
        const snapshot = await this.db.collection('forms')
          .where('ownerUid', '==', userUid)
          .get();

        snapshot.forEach(doc => {
          forms.push({ id: doc.id, ...doc.data() });
        });

        // 2. If Super Admin (iskakfatoni@gmail.com), also load legacy forms without ownerUid
        if (isSuperAdmin) {
          try {
            const allSnap = await this.db.collection('forms').get();
            allSnap.forEach(doc => {
              const data = doc.data();
              if (!data.ownerUid && !forms.some(f => f.id === doc.id)) {
                forms.push({ id: doc.id, ...data });
              }
            });
          } catch (legacyErr) {
            console.warn('Superadmin legacy fetch note:', legacyErr);
          }
        }

        // Sort descending by updatedAt
        forms.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        return forms;
      } catch (err) {
        console.warn('Firestore fetch failed, fallback to local:', err);
      }
    }

    // Local fallback
    const allLocal = this.getLocalForms();
    if (userUid) {
      return allLocal.filter(f => f.ownerUid === userUid || (!f.ownerUid && isSuperAdmin));
    }
    return allLocal;
  }

  async getForm(id) {
    return this.getFormById(id);
  }

  async getFormById(id) {
    if (this.isCloud) {
      try {
        const doc = await this.db.collection('forms').doc(id).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (err) {
        console.warn('Firestore getFormById failed, fallback to local:', err);
      }
    }
    const forms = this.getLocalForms();
    return forms.find(f => f.id === id) || null;
  }

  async saveForm(formData) {
    const timestamp = new Date().toISOString();
    const id = formData.id || 'form_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const user = this.getCurrentUser();
    
    const record = {
      ...formData,
      id,
      ownerUid: formData.ownerUid || (user ? user.uid : 'anonymous'),
      ownerEmail: formData.ownerEmail || (user ? user.email : ''),
      ownerName: formData.ownerName || (user ? user.name : ''),
      updatedAt: timestamp,
      createdAt: formData.createdAt || timestamp
    };

    if (this.isCloud) {
      try {
        await this.db.collection('forms').doc(id).set(record, { merge: true });
      } catch (err) {
        console.error('Gagal menyimpan ke Firestore:', err);
      }
    }

    // Always keep a local copy as well
    const forms = this.getLocalForms();
    const index = forms.findIndex(f => f.id === id);
    if (index >= 0) {
      forms[index] = record;
    } else {
      forms.unshift(record);
    }
    localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));
    return record;
  }

  async deleteForm(id) {
    if (this.isCloud) {
      try {
        await this.db.collection('forms').doc(id).delete();
        // Also delete associated responses
        const respSnap = await this.db.collection('responses').where('formId', '==', id).get();
        const batch = this.db.batch();
        respSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error('Gagal menghapus form dari Firestore:', err);
      }
    }

    let forms = this.getLocalForms();
    forms = forms.filter(f => f.id !== id);
    localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));

    let responses = this.getLocalResponses();
    responses = responses.filter(r => r.formId !== id);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));
    return true;
  }

  // --- RESPONSES CRUD ---

  async submitResponse(formId, answers, respondentEmail = null) {
    const timestamp = new Date().toISOString();
    const responseId = 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const email = respondentEmail || (answers && answers._respondent_email ? answers._respondent_email : null);

    const responseRecord = {
      id: responseId,
      formId,
      respondentEmail: email,
      answers,
      submittedAt: timestamp
    };

    if (this.isCloud) {
      try {
        await this.db.collection('responses').doc(responseId).set(responseRecord);
        // Increment responseCount on form doc (non-blocking for public responders)
        try {
          const formRef = this.db.collection('forms').doc(formId);
          await formRef.update({
            responseCount: firebase.firestore.FieldValue.increment(1),
            lastResponseAt: timestamp
          });
        } catch (updateCountErr) {
          console.warn('Notice: Form counter update skipped for public submission:', updateCountErr.message);
        }
      } catch (err) {
        console.error('Gagal mengirim respon ke Firestore:', err);
      }
    }

    // Local copy
    const responses = this.getLocalResponses();
    responses.push(responseRecord);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));

    // Update local form response count
    const forms = this.getLocalForms();
    const form = forms.find(f => f.id === formId);
    if (form) {
      form.responseCount = (form.responseCount || 0) + 1;
      form.lastResponseAt = timestamp;
      localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));
    }

    return responseRecord;
  }

  async getResponsesByFormId(formId) {
    if (this.isCloud) {
      try {
        const snapshot = await this.db.collection('responses')
          .where('formId', '==', formId)
          .get();
        const results = [];
        snapshot.forEach(doc => {
          results.push({ id: doc.id, ...doc.data() });
        });
        // Sort descending by submittedAt
        results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        return results;
      } catch (err) {
        console.warn('Gagal mengambil respon dari Firestore:', err);
      }
    }
    const responses = this.getLocalResponses();
    return responses
      .filter(r => r.formId === formId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  async deleteResponse(responseId) {
    if (this.isCloud) {
      try {
        await this.db.collection('responses').doc(responseId).delete();
      } catch (err) {
        console.error('Error delete response di Firestore:', err);
      }
    }
    let responses = this.getLocalResponses();
    responses = responses.filter(r => r.id !== responseId);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));
    return true;
  }

  async clearResponsesByFormId(formId) {
    if (this.isCloud) {
      try {
        const snapshot = await this.db.collection('responses').where('formId', '==', formId).get();
        const batch = this.db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        await this.db.collection('forms').doc(formId).update({
          responseCount: 0,
          lastResponseAt: null
        });
      } catch (err) {
        console.error('Error clear responses di Firestore:', err);
      }
    }

    let responses = this.getLocalResponses();
    responses = responses.filter(r => r.formId !== formId);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));

    const forms = this.getLocalForms();
    const form = forms.find(f => f.id === formId);
    if (form) {
      form.responseCount = 0;
      form.lastResponseAt = null;
      localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));
    }
    return true;
  }

  // --- LOCAL HELPERS ---

  getLocalForms() {
    try {
      const data = localStorage.getItem(this.LOCAL_FORMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  getLocalResponses() {
    try {
      const data = localStorage.getItem(this.LOCAL_RESPONSES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  // Initial template/seed form for fresh user experience
  ensureSeedData() {
    const existing = this.getLocalForms();
    const existingResponses = this.getLocalResponses();

    const sampleBioForm = {
      id: 'sample_biodata_siswa',
      ownerUid: 'sample_seed',
      title: 'Formulir Biodata & Titik Lokasi Rumah Siswa',
      description: 'Mohon lengkapi biodata siswa berikut dengan benar. Pastikan fitur GPS / Lokasi di HP Anda sudah aktif saat menekan tombol ambil titik lokasi rumah.',
      themeColor: '#06b6d4',
      bannerUrl: '',
      submitMessage: 'Terima kasih! Biodata dan titik lokasi rumah siswa telah berhasil direkam.',
      collectEmail: false,
      allowMultiple: false,
      isActive: true,
      responseCount: 2,
      lastResponseAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      sections: [
        {
          id: 'sec_bio_1',
          title: 'Bagian 1: Data Pokok Siswa',
          description: 'Isikan identitas lengkap peserta didik sesuai dokumen resmi (Akta / KK).'
        },
        {
          id: 'sec_bio_2',
          title: 'Bagian 2: Alamat & Perekaman Titik Rumah (GPS)',
          description: 'Pastikan pengisian dilakukan di rumah atau gunakan GPS akurat dari HP Anda.'
        }
      ],
      questions: [
        {
          id: 'q_bio_nama',
          sectionId: 'sec_bio_1',
          type: 'text',
          title: 'Nama Lengkap Siswa',
          required: true
        },
        {
          id: 'q_bio_nisn',
          sectionId: 'sec_bio_1',
          type: 'number',
          title: 'Nomor Induk Siswa Nasional (NISN)',
          required: true
        },
        {
          id: 'q_bio_jk',
          sectionId: 'sec_bio_1',
          type: 'choice',
          title: 'Jenis Kelamin',
          required: true,
          options: ['Laki-laki', 'Perempuan']
        },
        {
          id: 'q_bio_ttl',
          sectionId: 'sec_bio_1',
          type: 'text',
          title: 'Tempat, Tanggal Lahir (Contoh: Surabaya, 12 Mei 2010)',
          required: true
        },
        {
          id: 'q_bio_foto',
          sectionId: 'sec_bio_1',
          type: 'file',
          title: 'Pas Foto Diri Siswa (3x4 / Foto Resmi)',
          required: true
        },
        {
          id: 'q_bio_ortu',
          sectionId: 'sec_bio_1',
          type: 'text',
          title: 'Nama Orang Tua / Wali',
          required: true
        },
        {
          id: 'q_bio_wa',
          sectionId: 'sec_bio_1',
          type: 'text',
          title: 'Nomor WhatsApp / HP Orang Tua (Aktif)',
          required: true
        },
        {
          id: 'q_bio_alamat',
          sectionId: 'sec_bio_2',
          type: 'paragraph',
          title: 'Alamat Lengkap Rumah (Jalan, RT/RW, Dusun/Desa, Kelurahan, Kecamatan, Kab/Kota)',
          required: true
        },
        {
          id: 'q_bio_gps',
          sectionId: 'sec_bio_2',
          type: 'location',
          title: 'Titik Lokasi GPS Rumah Siswa (Klik Ambil Titik Lokasi)',
          required: true
        },
        {
          id: 'q_bio_foto_rumah',
          sectionId: 'sec_bio_2',
          type: 'file',
          title: 'Foto Tampak Depan Rumah Siswa',
          required: false
        },
        {
          id: 'q_bio_patokan',
          sectionId: 'sec_bio_2',
          type: 'paragraph',
          title: 'Patokan / Petunjuk Arah Menuju Rumah (Contoh: Sebelah barat Masjid, pagar hijau)',
          required: false
        },
        {
          id: 'q_bio_ttd',
          sectionId: 'sec_bio_2',
          type: 'signature',
          title: 'Tanda Tangan Digital Orang Tua / Wali Siswa',
          required: true
        }
      ]
    };

    const sampleBioResponses = [
      {
        id: 'resp_bio_1',
        formId: 'sample_biodata_siswa',
        submittedAt: new Date(Date.now() - 86400000).toISOString(),
        answers: {
          'q_bio_nama': 'Muhammad Rizky Pratama',
          'q_bio_nisn': '0089472615',
          'q_bio_jk': 'Laki-laki',
          'q_bio_ttl': 'Surabaya, 14 Februari 2010',
          'q_bio_foto': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
          'q_bio_ortu': 'Bambang Supriyanto',
          'q_bio_wa': '081234567890',
          'q_bio_alamat': 'Jl. Mawar No. 18 RT 03/RW 04, Kel. Sukolilo, Kec. Sukolilo, Kota Surabaya',
          'q_bio_gps': { latitude: -7.2891, longitude: 112.7983, accuracy: 8.5 },
          'q_bio_foto_rumah': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80',
          'q_bio_patokan': 'Sebelah timur Masjid Al-Ikhlas, rumah tingkat cat abu-abu.',
          'q_bio_ttd': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20,50 Q60,10 100,50 T180,40" stroke="%233b82f6" stroke-width="3" fill="none"/></svg>'
        }
      },
      {
        id: 'resp_bio_2',
        formId: 'sample_biodata_siswa',
        submittedAt: new Date(Date.now() - 7200000).toISOString(),
        answers: {
          'q_bio_nama': 'Annisa Putri Maharani',
          'q_bio_nisn': '0091827364',
          'q_bio_jk': 'Perempuan',
          'q_bio_ttl': 'Sidoarjo, 22 Agustus 2010',
          'q_bio_foto': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
          'q_bio_ortu': 'Hadi Wijaya',
          'q_bio_wa': '085712349988',
          'q_bio_alamat': 'Perum Griya Asri Blok C2 No. 15, Waru, Sidoarjo',
          'q_bio_gps': { latitude: -7.3562, longitude: 112.7214, accuracy: 6.2 },
          'q_bio_foto_rumah': 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&auto=format&fit=crop&q=80',
          'q_bio_patokan': 'Masuk gerbang utama perumahan belok kanan lorong ke-2.',
          'q_bio_ttd': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M20,60 Q50,20 120,40 T170,30" stroke="%233b82f6" stroke-width="3" fill="none"/></svg>'
        }
      }
    ];

    if (!existing || existing.length === 0) {
      const sampleForm = {
        id: 'sample_customer_feedback',
        ownerUid: 'sample_seed',
        title: 'Survei Kepuasan Pengguna & Layanan',
        description: 'Mohon luangkan waktu 2 menit untuk mengisi survei ini guna meningkatkan kualitas produk kami.',
        themeColor: '#6366f1',
        bannerUrl: '',
        submitMessage: 'Terima kasih atas masukan berharga Anda!',
        allowMultiple: true,
        isActive: true,
        responseCount: 3,
        lastResponseAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        questions: [
          {
            id: 'q_1',
            type: 'text',
            title: 'Nama Lengkap Anda',
            required: true
          },
          {
            id: 'q_2',
            type: 'choice',
            title: 'Seberapa sering Anda menggunakan aplikasi kami?',
            required: true,
            options: ['Setiap Hari', 'Beberapa Kali Seminggu', 'Jarang', 'Pertama Kali']
          },
          {
            id: 'q_3',
            type: 'rating',
            title: 'Beri nilai kepuasan Anda terhadap kecepatan & kemudahan sistem',
            required: true
          },
          {
            id: 'q_4',
            type: 'checkbox',
            title: 'Fitur apa saja yang paling sering Anda gunakan?',
            required: false,
            options: ['Form Builder', 'Export Excel', 'Realtime Sync Firebase', 'Tema Kustom']
          },
          {
            id: 'q_5',
            type: 'paragraph',
            title: 'Saran dan masukan untuk pengembangan fitur selanjutnya',
            required: false
          }
        ]
      };

      const sampleResponses = [
        {
          id: 'resp_demo_1',
          formId: 'sample_customer_feedback',
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
          answers: {
            'q_1': 'Budi Santoso',
            'q_2': 'Setiap Hari',
            'q_3': 5,
            'q_4': ['Form Builder', 'Export Excel'],
            'q_5': 'Sangat bagus, fitur export excel-nya sangat membantu pelaporan bulanan!'
          }
        },
        {
          id: 'resp_demo_2',
          formId: 'sample_customer_feedback',
          submittedAt: new Date(Date.now() - 43200000).toISOString(),
          answers: {
            'q_1': 'Siti Rahmawati',
            'q_2': 'Beberapa Kali Seminggu',
            'q_3': 4,
            'q_4': ['Export Excel', 'Realtime Sync Firebase'],
            'q_5': 'Tampilan antarmukanya sangat modern dan mudah digunakan dari HP.'
          }
        },
        {
          id: 'resp_demo_3',
          formId: 'sample_customer_feedback',
          submittedAt: new Date(Date.now() - 3600000).toISOString(),
          answers: {
            'q_1': 'Ahmad Fauzi',
            'q_2': 'Setiap Hari',
            'q_3': 5,
            'q_4': ['Form Builder', 'Export Excel', 'Tema Kustom'],
            'q_5': 'Proses submit cepat dan data langsung tersimpan aman.'
          }
        }
      ];

      localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify([sampleBioForm, sampleForm]));
      localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify([...sampleBioResponses, ...sampleResponses]));
    } else {
      // Check if sample_biodata_siswa already exists, if not prepend it
      const hasBio = existing.some(f => f.id === 'sample_biodata_siswa');
      if (!hasBio) {
        existing.unshift(sampleBioForm);
        localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(existing));
        const updatedResponses = [...(existingResponses || []), ...sampleBioResponses];
        localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(updatedResponses));
      }
    }
  }
}

// Global instance
window.formStorage = new FormStorage();
