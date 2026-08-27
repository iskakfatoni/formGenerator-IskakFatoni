/**
 * FORMCRAFT - Form Builder Logic
 * Handles dynamic question card creation, Section management, Drag and Drop reordering,
 * type switching, options editor, and saving to Firestore/LocalStorage.
 */

class FormBuilder {

  getTypeMeta(type) {
    const meta = {
      text: { icon: 'type', label: 'Teks Singkat' },
      paragraph: { icon: 'align-left', label: 'Paragraf' },
      choice: { icon: 'circle-dot', label: 'Pilihan Ganda' },
      checkbox: { icon: 'check-square', label: 'Kotak Centang' },
      dropdown: { icon: 'chevron-down-circle', label: 'Dropdown' },
      file_gdrive: { icon: 'hard-drive', label: 'Google Drive' },
      file: { icon: 'camera', label: 'Upload Foto' },
      location: { icon: 'map-pin', label: 'Lokasi GPS' },
      signature: { icon: 'pen-tool', label: 'Tanda Tangan' },
      rating: { icon: 'star', label: 'Rating Bintang' },
      date: { icon: 'calendar', label: 'Tanggal' },
      time: { icon: 'clock', label: 'Waktu' },
      number: { icon: 'hash', label: 'Angka' }
    };
    return meta[type] || { icon: 'help-circle', label: 'Pertanyaan' };
  }

  constructor() {
    this.currentForm = null;
    this.sections = [];
    this.collapsedSections = new Set();
    this.collapsedQuestions = new Set();
    this.questions = [];
    this.draggedQuestionId = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.titleInput = document.getElementById('form-title-input');
    this.descInput = document.getElementById('form-desc-input');
    this.accentStripe = document.getElementById('form-accent-stripe');
    this.questionsContainer = document.getElementById('questions-container');
    this.statusBadge = document.getElementById('builder-status-badge');
    this.responseCountBadge = document.getElementById('builder-response-count');
    this.responsesTabLink = document.getElementById('tab-btn-responses-link');

    // Settings fields & Banner uploader
    this.themeColorSwatches = document.querySelectorAll('.color-swatch');
    this.headerImgInput = document.getElementById('form-header-img');
    this.submitMsgInput = document.getElementById('form-submit-msg');
    this.collectEmailCheck = document.getElementById('form-collect-email');
    this.allowMultipleCheck = document.getElementById('form-allow-multiple');
    this.isActiveCheck = document.getElementById('form-is-active');

    // Google Drive Integration fields in Settings
    this.gdriveScriptUrlInput = document.getElementById('form-gdrive-script-url');
    this.gdriveFolderIdInput = document.getElementById('form-gdrive-folder-id');
    this.btnOpenGdriveGuide = document.getElementById('btn-open-gdrive-guide');
    this.modalGdriveGuide = document.getElementById('modal-gdrive-guide');
    this.btnCloseGdriveGuide = document.getElementById('btn-close-gdrive-guide');
    this.btnDoneGdriveGuide = document.getElementById('btn-done-gdrive-guide');
    this.btnCopyGdriveScript = document.getElementById('btn-copy-gdrive-script');
    this.btnTestGdriveUrl = document.getElementById('btn-test-gdrive-url');

    // Banner elements in Settings panel
    this.bannerDropzone = document.getElementById('banner-dropzone');
    this.bannerPreviewBox = document.getElementById('banner-preview-box');
    this.bannerPreviewImg = document.getElementById('banner-preview-img');
    this.inputBannerFile = document.getElementById('input-banner-file');
    this.btnBrowseBanner = document.getElementById('btn-browse-banner');
    this.btnChangeBanner = document.getElementById('btn-change-banner');
    this.btnRemoveBanner = document.getElementById('btn-remove-banner');

    // Quick Banner controls in Questions Header card
    this.btnAddHeaderBanner = document.getElementById('btn-add-header-banner');
    this.headerBannerPreview = document.getElementById('form-header-banner-preview');
    this.headerBannerImg = document.getElementById('form-header-banner-img');
    this.btnQuickChangeBanner = document.getElementById('btn-quick-change-banner');
    this.btnQuickRemoveBanner = document.getElementById('btn-quick-remove-banner');
  }

  bindEvents() {

    // Toolbar Collapse / Expand All Buttons
    const btnToggleAllQ = document.getElementById('btn-toggle-all-questions');
    const txtToggleAllQ = document.getElementById('btn-toggle-all-q-text');
    if (btnToggleAllQ) {
      btnToggleAllQ.addEventListener('click', () => {
        if (this.collapsedQuestions.size > 0) {
          this.collapsedQuestions.clear();
          if (txtToggleAllQ) txtToggleAllQ.textContent = 'Lipat Semua Soal';
        } else {
          this.questions.forEach(q => this.collapsedQuestions.add(q.id));
          if (txtToggleAllQ) txtToggleAllQ.textContent = 'Buka Semua Soal';
        }
        this.renderQuestions();
      });
    }

    const btnToggleAllSec = document.getElementById('btn-toggle-all-sections');
    const txtToggleAllSec = document.getElementById('btn-toggle-all-sec-text');
    if (btnToggleAllSec) {
      btnToggleAllSec.addEventListener('click', () => {
        if (this.collapsedSections.size > 0) {
          this.collapsedSections.clear();
          if (txtToggleAllSec) txtToggleAllSec.textContent = 'Lipat Semua Bagian';
        } else {
          this.sections.forEach(s => this.collapsedSections.add(s.id));
          if (txtToggleAllSec) txtToggleAllSec.textContent = 'Buka Semua Bagian';
        }
        this.renderQuestions();
      });
    }

    // Add Question Main Button
    const btnAddQ = document.getElementById('btn-add-question');
    if (btnAddQ) {
      btnAddQ.addEventListener('click', () => {
        this.addQuestion('text');
      });
    }

    // Add Section Button
    const btnAddSection = document.getElementById('btn-add-section');
    if (btnAddSection) {
      btnAddSection.addEventListener('click', () => {
        this.addSection();
      });
    }

    // Quick Type Pills
    document.querySelectorAll('.type-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const type = pill.dataset.type;
        this.addQuestion(type);
      });
    });

    // Color Swatches
    if (this.themeColorSwatches) {
      this.themeColorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
          this.themeColorSwatches.forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          const color = swatch.dataset.color;
          this.setThemeColor(color);
        });
      });
    }

    // Banner Upload Events
    if (this.btnBrowseBanner && this.inputBannerFile) {
      this.btnBrowseBanner.addEventListener('click', (e) => {
        e.stopPropagation();
        this.inputBannerFile.click();
      });
    }

    if (this.bannerDropzone && this.inputBannerFile) {
      this.bannerDropzone.addEventListener('click', () => {
        this.inputBannerFile.click();
      });

      this.bannerDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.bannerDropzone.classList.add('drag-over');
      });

      this.bannerDropzone.addEventListener('dragleave', () => {
        this.bannerDropzone.classList.remove('drag-over');
      });

      this.bannerDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.bannerDropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleBannerUpload(e.dataTransfer.files[0]);
        }
      });
    }

    if (this.inputBannerFile) {
      this.inputBannerFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleBannerUpload(e.target.files[0]);
        }
      });
    }

    if (this.btnChangeBanner && this.inputBannerFile) {
      this.btnChangeBanner.addEventListener('click', () => {
        this.inputBannerFile.click();
      });
    }

    if (this.btnRemoveBanner) {
      this.btnRemoveBanner.addEventListener('click', () => {
        this.removeBanner();
      });
    }

    // Quick Banner Buttons on Header Card
    if (this.btnAddHeaderBanner && this.inputBannerFile) {
      this.btnAddHeaderBanner.addEventListener('click', () => {
        this.inputBannerFile.click();
      });
    }

    if (this.btnQuickChangeBanner && this.inputBannerFile) {
      this.btnQuickChangeBanner.addEventListener('click', () => {
        this.inputBannerFile.click();
      });
    }

    if (this.btnQuickRemoveBanner) {
      this.btnQuickRemoveBanner.addEventListener('click', () => {
        this.removeBanner();
      });
    }

    // External URL Banner Input manual change
    if (this.headerImgInput) {
      this.headerImgInput.addEventListener('input', (e) => {
        if (this.currentForm) {
          this.currentForm.bannerUrl = e.target.value.trim();
          this.updateBannerUI();
        }
      });
    }

    // Save Form Button
    const btnSave = document.getElementById('btn-save-form');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.saveCurrentForm();
      });
    }

    // Preview Button
    const btnPreview = document.getElementById('btn-preview-form');
    if (btnPreview) {
      btnPreview.addEventListener('click', () => {
        if (this.currentForm && this.currentForm.id) {
          window.location.hash = `#/view/${this.currentForm.id}`;
        } else {
          this.saveCurrentForm().then(saved => {
            if (saved) window.location.hash = `#/view/${saved.id}`;
          });
        }
      });
    }

    // Responses Tab Link inside builder
    if (this.responsesTabLink) {
      this.responsesTabLink.addEventListener('click', () => {
        if (this.currentForm && this.currentForm.id) {
          window.location.hash = `#/responses/${this.currentForm.id}`;
        }
      });
    }

    // Builder Tabs (Questions vs Settings)
    const tabQuestions = document.getElementById('tab-btn-questions');
    if (tabQuestions) {
      tabQuestions.addEventListener('click', () => {
        this.switchTab('questions');
      });
    }
    const tabSettings = document.getElementById('tab-btn-settings');
    if (tabSettings) {
      tabSettings.addEventListener('click', () => {
        this.switchTab('settings');
      });
    }

    // Google Drive Guide Modal Events
    if (this.btnOpenGdriveGuide && this.modalGdriveGuide) {
      this.btnOpenGdriveGuide.addEventListener('click', () => {
        const codeDisplay = document.getElementById('gdrive-script-code-display');
        if (codeDisplay && window.gdriveUploader) {
          codeDisplay.textContent = window.gdriveUploader.getScriptTemplate();
        }
        this.modalGdriveGuide.classList.remove('hidden');
      });
    }

    if (this.btnCloseGdriveGuide && this.modalGdriveGuide) {
      this.btnCloseGdriveGuide.addEventListener('click', () => {
        this.modalGdriveGuide.classList.add('hidden');
      });
    }

    if (this.btnDoneGdriveGuide && this.modalGdriveGuide) {
      this.btnDoneGdriveGuide.addEventListener('click', () => {
        this.modalGdriveGuide.classList.add('hidden');
      });
    }

    if (this.btnCopyGdriveScript) {
      this.btnCopyGdriveScript.addEventListener('click', () => {
        if (window.gdriveUploader) {
          const scriptText = window.gdriveUploader.getScriptTemplate();
          navigator.clipboard.writeText(scriptText).then(() => {
            const txt = document.getElementById('txt-copy-gdrive-script');
            if (txt) txt.textContent = 'Tersalin!';
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast('Kode Google Apps Script berhasil disalin ke clipboard!', 'success');
            }
            setTimeout(() => {
              if (txt) txt.textContent = 'Salin Kode Skrip';
            }, 2500);
          }).catch(err => {
            console.error('Clipboard copy error:', err);
          });
        }
      });
    }

    // Test Google Drive Webhook URL Button
    if (this.btnTestGdriveUrl && this.gdriveScriptUrlInput) {
      // Auto-format input when pasting deployment ID
      this.gdriveScriptUrlInput.addEventListener('blur', () => {
        let val = this.gdriveScriptUrlInput.value.trim();
        if (val && !val.startsWith('http')) {
          this.gdriveScriptUrlInput.value = `https://script.google.com/macros/s/${val}/exec`;
        }
      });

      this.btnTestGdriveUrl.addEventListener('click', async () => {
        let url = this.gdriveScriptUrlInput.value.trim();
        if (!url) {
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Harap masukkan URL Google Apps Script Web App terlebih dahulu', 'error');
          }
          return;
        }

        if (!url.startsWith('http')) {
          url = `https://script.google.com/macros/s/${url}/exec`;
          this.gdriveScriptUrlInput.value = url;
        }

        if (!url.startsWith('https://script.google.com/macros/s/')) {
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Format URL tidak valid! Harus berawalan https://script.google.com/macros/s/.../exec', 'error');
          }
          return;
        }

        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Menguji sambungan webhook Google Drive...', 'info');
        }

        try {
          // Send test GET ping
          const res = await fetch(url, { method: 'GET', mode: 'no-cors' });
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Sambungan Google Drive Webhook berhasil terhubung!', 'success');
          }
        } catch (err) {
          console.error('Test GDrive error:', err);
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Webhook terdaftar. Pastikan izin Web App diatur ke "Anyone" (Siapa saja).', 'info');
          }
        }
      });
    }
  }

  switchTab(tab) {
    const tabQuestions = document.getElementById('tab-btn-questions');
    const tabSettings = document.getElementById('tab-btn-settings');
    const panelQuestions = document.getElementById('builder-panel-questions');
    const panelSettings = document.getElementById('builder-panel-settings');

    if (tabQuestions) tabQuestions.classList.toggle('active', tab === 'questions');
    if (tabSettings) tabSettings.classList.toggle('active', tab === 'settings');
    if (panelQuestions) panelQuestions.classList.toggle('active', tab === 'questions');
    if (panelSettings) panelSettings.classList.toggle('active', tab === 'settings');
  }

  setThemeColor(color) {
    if (this.accentStripe) {
      this.accentStripe.style.background = color;
    }
  }

  loadForm(formId) {
    this.switchTab('questions');
    if (!formId) {
      // Create new blank form
      const defaultSecId = 'sec_' + Date.now();
      this.currentForm = {
        id: null,
        title: 'Formulir Tanpa Judul',
        description: '',
        themeColor: '#6366f1',
        bannerUrl: '',
        submitMessage: 'Terima kasih! Tanggapan Anda telah berhasil direkam.',
        collectEmail: false,
        allowMultiple: true,
        isActive: true,
        responseCount: 0,
        sections: [
          {
            id: defaultSecId,
            title: 'Bagian 1',
            description: ''
          }
        ],
        questions: []
      };
      this.sections = this.currentForm.sections;
      this.questions = [
        {
          id: 'q_' + Date.now(),
          sectionId: defaultSecId,
          type: 'text',
          title: 'Pertanyaan Tanpa Judul',
          required: false
        }
      ];
      this.renderForm();
      if (this.statusBadge) this.statusBadge.textContent = 'Formulir Baru';
      if (this.responsesTabLink) this.responsesTabLink.style.display = 'none';
      return;
    }

    // Load existing form from storage
    window.formStorage.getFormById(formId).then(form => {
      if (form) {
        this.currentForm = form;
        
        // Ensure sections array exists
        if (!form.sections || form.sections.length === 0) {
          const defaultSecId = 'sec_1';
          this.sections = [
            {
              id: defaultSecId,
              title: form.title || 'Bagian 1',
              description: form.description || ''
            }
          ];
        } else {
          this.sections = form.sections;
        }

        const firstSecId = this.sections[0].id;
        this.questions = (form.questions || []).map(q => {
          if (!q.sectionId) q.sectionId = firstSecId;
          return q;
        });

        this.renderForm();
        if (this.statusBadge) this.statusBadge.textContent = 'Edit Formulir';
        if (this.responsesTabLink) this.responsesTabLink.style.display = 'inline-flex';
        if (this.responseCountBadge) this.responseCountBadge.textContent = form.responseCount || 0;
      } else {
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Formulir tidak ditemukan', 'error');
        }
        window.location.hash = '#/dashboard';
      }
    });
  }

  renderForm() {
    if (this.titleInput) this.titleInput.value = this.currentForm.title || '';
    if (this.descInput) this.descInput.value = this.currentForm.description || '';
    this.setThemeColor(this.currentForm.themeColor || '#6366f1');

    // Update settings tab
    if (this.headerImgInput) this.headerImgInput.value = this.currentForm.bannerUrl || '';
    if (this.submitMsgInput) this.submitMsgInput.value = this.currentForm.submitMessage || 'Terima kasih! Tanggapan Anda telah berhasil direkam.';
    if (this.collectEmailCheck) this.collectEmailCheck.checked = this.currentForm.collectEmail === true;
    if (this.allowMultipleCheck) this.allowMultipleCheck.checked = this.currentForm.allowMultiple !== false;
    if (this.gdriveScriptUrlInput) {
      this.gdriveScriptUrlInput.value = this.currentForm.gdriveScriptUrl || (window.gdriveUploader ? window.gdriveUploader.defaultGlobalScriptUrl : '');
    }
    if (this.gdriveFolderIdInput) this.gdriveFolderIdInput.value = this.currentForm.gdriveFolderId || '';

    // Update active color swatch
    if (this.themeColorSwatches) {
      this.themeColorSwatches.forEach(s => {
        s.classList.toggle('active', s.dataset.color === (this.currentForm.themeColor || '#6366f1'));
      });
    }

    // Update banner UI state
    this.updateBannerUI();

    this.renderQuestions();
  }

  updateBannerUI() {
    const bannerUrl = (this.currentForm && this.currentForm.bannerUrl) ? this.currentForm.bannerUrl.trim() : '';

    // 1. Settings Tab Banner UI
    if (this.bannerDropzone && this.bannerPreviewBox && this.bannerPreviewImg) {
      if (bannerUrl) {
        this.bannerDropzone.classList.add('hidden');
        this.bannerPreviewBox.classList.remove('hidden');
        this.bannerPreviewImg.src = bannerUrl;
      } else {
        this.bannerDropzone.classList.remove('hidden');
        this.bannerPreviewBox.classList.add('hidden');
        this.bannerPreviewImg.src = '';
      }
    }

    // 2. Header Card in Questions Tab
    if (this.headerBannerPreview && this.headerBannerImg) {
      if (bannerUrl) {
        this.headerBannerPreview.classList.remove('hidden');
        this.headerBannerImg.src = bannerUrl;
        if (this.btnAddHeaderBanner) this.btnAddHeaderBanner.classList.add('hidden');
      } else {
        this.headerBannerPreview.classList.add('hidden');
        this.headerBannerImg.src = '';
        if (this.btnAddHeaderBanner) this.btnAddHeaderBanner.classList.remove('hidden');
      }
    }

    // 3. Sync text input
    if (this.headerImgInput) {
      this.headerImgInput.value = bannerUrl;
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async handleBannerUpload(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Harap pilih file gambar (JPG, PNG, WEBP)', 'error');
      }
      return;
    }

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('Mengompresi & mengunggah gambar banner...', 'info');
    }

    try {
      const formId = this.currentForm ? (this.currentForm.id || 'form_' + Date.now()) : 'form_' + Date.now();
      const result = await window.imageUploader.processAndUpload(file, {
        formId,
        context: 'banner',
        maxWidth: 1600,
        quality: 0.85
      });

      if (!this.currentForm) {
        this.currentForm = {};
      }
      this.currentForm.bannerUrl = result.url;
      this.updateBannerUI();

      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Gambar banner berhasil diunggah!', 'success');
      }
    } catch (err) {
      console.error('Error upload banner:', err);
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Gagal memproses gambar banner: ' + err.message, 'error');
      }
    }
  }

  removeBanner() {
    if (this.currentForm) {
      this.currentForm.bannerUrl = '';
    }
    this.updateBannerUI();
    if (this.inputBannerFile) {
      this.inputBannerFile.value = '';
    }
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('Gambar banner telah dihapus', 'info');
    }
  }

  renderQuestions() {
    this.questionsContainer.innerHTML = '';
    const totalSections = this.sections.length;

    // Update Toolbar Summary Text
    const summaryText = document.getElementById('builder-stats-count-text');
    if (summaryText) {
      summaryText.textContent = totalSections + ' Bagian • ' + this.questions.length + ' Pertanyaan';
    }

    const txtToggleAllQ = document.getElementById('btn-toggle-all-q-text');
    if (txtToggleAllQ) {
      txtToggleAllQ.textContent = this.collapsedQuestions.size > 0 ? 'Buka Semua Soal' : 'Lipat Semua Soal';
    }

    const txtToggleAllSec = document.getElementById('btn-toggle-all-sec-text');
    if (txtToggleAllSec) {
      txtToggleAllSec.textContent = this.collapsedSections.size > 0 ? 'Buka Semua Bagian' : 'Lipat Semua Bagian';
    }

    this.sections.forEach((sec, secIdx) => {
      const sectionQuestions = this.questions.filter(q => q.sectionId === sec.id);
      const isSecCollapsed = this.collapsedSections.has(sec.id);

      // If there are multiple sections, render section header card
      if (totalSections > 1) {
        const secCard = this.createSectionCardElement(sec, secIdx, totalSections, sectionQuestions.length, isSecCollapsed);
        this.questionsContainer.appendChild(secCard);
      }

      // Render questions for this section (if section is not collapsed)
      if (!isSecCollapsed) {
        sectionQuestions.forEach(q => {
          const globalIndex = this.questions.findIndex(item => item.id === q.id);
          const card = this.createQuestionCardElement(q, globalIndex, sectionQuestions.length);
          this.questionsContainer.appendChild(card);
        });
      }
    });

    // Refresh icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  createSectionCardElement(sec, secIdx, totalSections, questionCount, isCollapsed) {
    const card = document.createElement('div');
    card.className = 'form-card section-card glass-card' + (isCollapsed ? ' is-collapsed' : '');
    card.dataset.sectionId = sec.id;

    card.innerHTML = `
      <div class="section-header-top">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <button type="button" class="btn-q-icon sec-toggle-collapse" title="${isCollapsed ? 'Buka Bagian Ini' : 'Lipat Bagian Ini'}">
            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}"></i>
          </button>
          <div class="section-tag-badge">
            <i data-lucide="layers"></i>
            <span>Bagian ${secIdx + 1} dari ${totalSections}</span>
          </div>
          ${isCollapsed ? `
            <div class="sec-collapsed-preview" title="Klik untuk membuka bagian ini">
              <span>${this.escapeHtml(sec.title || 'Bagian Tanpa Judul')}</span>
              <span class="sec-count-badge">${questionCount} Pertanyaan</span>
            </div>
          ` : ''}
        </div>
        <div class="section-actions">
          ${secIdx > 0 ? `
            <button type="button" class="btn-q-icon sec-move-up" title="Pindah Bagian ke Atas">
              <i data-lucide="chevron-up"></i>
            </button>
          ` : ''}
          ${secIdx < totalSections - 1 ? `
            <button type="button" class="btn-q-icon sec-move-down" title="Pindah Bagian ke Bawah">
              <i data-lucide="chevron-down"></i>
            </button>
          ` : ''}
          <button type="button" class="btn-q-icon sec-delete" title="Hapus Bagian Ini">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
      <div class="section-body">
        <input type="text" class="input-section-title" value="${this.escapeHtml(sec.title || '')}" placeholder="Judul Bagian/Halaman...">
        <textarea class="input-section-desc" placeholder="Deskripsi bagian ini (opsional)..." rows="1">${this.escapeHtml(sec.description || '')}</textarea>
      </div>
    `;

    // Toggle Section Collapse
    const btnToggleCollapse = card.querySelector('.sec-toggle-collapse');
    if (btnToggleCollapse) {
      btnToggleCollapse.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.collapsedSections.has(sec.id)) {
          this.collapsedSections.delete(sec.id);
        } else {
          this.collapsedSections.add(sec.id);
        }
        this.renderQuestions();
      });
    }

    const previewRow = card.querySelector('.sec-collapsed-preview');
    if (previewRow) {
      previewRow.addEventListener('click', () => {
        this.collapsedSections.delete(sec.id);
        this.renderQuestions();
      });
    }

    // Bind section input events
    const titleInput = card.querySelector('.input-section-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        sec.title = e.target.value;
      });
    }

    const descInput = card.querySelector('.input-section-desc');
    if (descInput) {
      descInput.addEventListener('input', (e) => {
        sec.description = e.target.value;
      });
    }

    // Move Section Up
    const btnMoveUp = card.querySelector('.sec-move-up');
    if (btnMoveUp) {
      btnMoveUp.addEventListener('click', () => {
        const temp = this.sections[secIdx];
        this.sections[secIdx] = this.sections[secIdx - 1];
        this.sections[secIdx - 1] = temp;
        this.renderQuestions();
      });
    }

    // Move Section Down
    const btnMoveDown = card.querySelector('.sec-move-down');
    if (btnMoveDown) {
      btnMoveDown.addEventListener('click', () => {
        const temp = this.sections[secIdx];
        this.sections[secIdx] = this.sections[secIdx + 1];
        this.sections[secIdx + 1] = temp;
        this.renderQuestions();
      });
    }

    // Delete Section
    const btnDelete = card.querySelector('.sec-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (this.sections.length <= 1) {
          window.app.showToast('Formulir harus memiliki minimal satu bagian', 'error');
          return;
        }

        const targetSecId = secIdx > 0 ? this.sections[secIdx - 1].id : this.sections[1].id;
        this.questions.forEach(q => {
          if (q.sectionId === sec.id) {
            q.sectionId = targetSecId;
          }
        });

        this.sections.splice(secIdx, 1);
        this.collapsedSections.delete(sec.id);
        this.renderQuestions();
        window.app.showToast('Bagian berhasil dihapus', 'info');
      });
    }

    
    // Quiz Points and Answer Key Event Listeners
    const pointsInput = card.querySelector('.input-q-points');
    if (pointsInput) {
      pointsInput.addEventListener('input', (e) => {
        q.points = parseInt(e.target.value) || 0;
      });
    }

    const correctTextInput = card.querySelector('.input-q-correct-text');
    if (correctTextInput) {
      correctTextInput.addEventListener('input', (e) => {
        q.correctAnswer = e.target.value.trim();
      });
    }

    card.querySelectorAll('.btn-set-correct-answer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const optRow = btn.closest('.option-row');
        const optText = optRow ? optRow.querySelector('.input-option-text').value.trim() : '';
        if (!optText) {
          if (window.app) window.app.showToast('Isi teks opsi terlebih dahulu sebelum dijadikan kunci jawaban', 'error');
          return;
        }

        if (q.type === 'checkbox') {
          if (!Array.isArray(q.correctAnswers)) q.correctAnswers = [];
          const idx = q.correctAnswers.indexOf(optText);
          if (idx >= 0) {
            q.correctAnswers.splice(idx, 1);
          } else {
            q.correctAnswers.push(optText);
          }
        } else {
          q.correctAnswer = optText;
        }
        this.renderQuestions();
      });
    });

    return card;
  }

  createQuestionCardElement(q, globalIndex, totalQuestionsInSec) {
    const isCollapsed = this.collapsedQuestions.has(q.id);
    const isQuiz = this.currentForm && this.currentForm.isQuizMode === true;
    const typeMeta = this.getTypeMeta(q.type);
    const card = document.createElement('div');
    card.className = 'form-card question-card glass-card' + (isCollapsed ? ' is-collapsed' : '');
    card.dataset.questionId = q.id;
    card.setAttribute('draggable', 'false');

    // Build question body based on type
    let optionsHtml = '';
    if (q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') {
      const icon = q.type === 'choice' ? 'circle' : (q.type === 'checkbox' ? 'square' : 'chevron-down');
      const options = q.options || ['Opsi 1'];
      const canBranch = (q.type === 'choice' || q.type === 'dropdown') && this.sections && this.sections.length > 1;

      optionsHtml = `
        <div class="question-options-container">
          ${options.map((opt, optIdx) => {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            const optImg = typeof opt === 'object' ? (opt.imageUrl || '') : '';
            const optNext = typeof opt === 'object' ? (opt.nextSectionId || 'next') : 'next';

            const isQuiz = this.currentForm && this.currentForm.isQuizMode === true;
            let isCorrect = false;
            if (isQuiz) {
              if (q.type === 'checkbox') {
                isCorrect = Array.isArray(q.correctAnswers) && q.correctAnswers.includes(optText);
              } else {
                isCorrect = q.correctAnswer === optText;
              }
            }

            return `
              <div class="option-row ${isCorrect ? 'correct-answer-row' : ''}" data-opt-index="${optIdx}">
                <i data-lucide="${icon}" class="option-type-icon"></i>
                <input type="text" class="input-option-text" value="${this.escapeHtml(optText)}" placeholder="Nama opsi (Bisa paste list Excel/Sheets)...">
                
                ${isQuiz ? `
                  <button type="button" class="btn-set-correct-answer ${isCorrect ? 'is-correct' : ''}" data-opt-val="${this.escapeHtml(optText)}" title="Tentukan sebagai kunci jawaban benar">
                    <i data-lucide="${isCorrect ? 'check-circle' : 'circle'}"></i>
                    <span>${isCorrect ? 'Kunci Benar' : 'Jadikan Kunci'}</span>
                  </button>
                ` : ''}
                
                ${canBranch ? `
                  <div class="opt-branch-wrap" title="Aksi lanjut setelah opsi ini dipilih">
                    <i data-lucide="corner-down-right" class="branch-icon"></i>
                    <select class="select-opt-branch">
                      <option value="next" ${(!optNext || optNext === 'next') ? 'selected' : ''}>Lanjut bagian berikutnya</option>
                      ${this.sections.map((s, sIdx) => `
                        <option value="${s.id}" ${optNext === s.id ? 'selected' : ''}>Buka Bagian ${sIdx + 1}: ${this.escapeHtml(s.title || 'Tanpa Judul')}</option>
                      `).join('')}
                      <option value="submit" ${optNext === 'submit' ? 'selected' : ''}>Kirim formulir</option>
                    </select>
                  </div>
                ` : ''}

                <button type="button" class="btn-opt-image ${optImg ? 'has-image' : ''}" title="Upload Gambar Pilihan Jawaban">
                  <i data-lucide="image"></i>
                </button>
                <input type="file" class="input-opt-image-file" accept="image/*" style="display:none;">

                ${optImg ? `
                  <div class="opt-image-preview-chip">
                    <img src="${this.escapeHtml(optImg)}" class="opt-thumb-img" alt="Thumbnail Opsi">
                    <button type="button" class="btn-remove-opt-image" title="Hapus Gambar Opsi">
                      <i data-lucide="x"></i>
                    </button>
                  </div>
                ` : ''}

                ${options.length > 1 ? `
                  <button type="button" class="btn-remove-option" title="Hapus Opsi">
                    <i data-lucide="x"></i>
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}
          <button type="button" class="btn-add-option-row">
            <i data-lucide="plus"></i>
            <span>Tambah Opsi</span>
          </button>
          ${isQuiz ? `
            <div class="q-quiz-config-bar">
              <div class="q-quiz-points-wrap">
                <i data-lucide="award"></i>
                <span>Poin Soal:</span>
                <input type="number" class="input-q-points" value="${q.points !== undefined ? q.points : 10}" min="0" max="100">
              </div>
              <div class="q-quiz-answer-hint">
                <i data-lucide="check-circle-2"></i>
                <span>Kunci: <strong>${this.escapeHtml(q.type === 'checkbox' ? (Array.isArray(q.correctAnswers) ? q.correctAnswers.join(', ') : 'Belum ditentukan') : (q.correctAnswer || 'Belum ditentukan'))}</strong></span>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    } else if (q.type === 'rating') {
      optionsHtml = `
        <div class="rating-preview-box">
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <span style="margin-left: 8px; font-size: 0.85rem;">(Skala 1 - 5 Bintang)</span>
        </div>
      `;
    } else if (q.type === 'location') {
      optionsHtml = `
        <div class="gps-preview-box">
          <i data-lucide="map-pin"></i>
          <div>
            <strong>Perekaman Titik Lokasi GPS & Peta</strong>
            <span>Responden akan menekan tombol untuk mengambil koordinat GPS (Latitude, Longitude) dari perangkat mereka.</span>
          </div>
        </div>
      `;
    } else if (q.type === 'file') {
      optionsHtml = `
        <div class="file-preview-box">
          <i data-lucide="camera"></i>
          <div>
            <strong>Upload Foto / Berkas (Kamera & Galeri)</strong>
            <span>Responden dapat mengambil foto langsung dari kamera HP atau memilih file dari galeri.</span>
          </div>
        </div>
      `;
    } else if (q.type === 'signature') {
      optionsHtml = `
        <div class="signature-preview-box">
          <i data-lucide="pen-tool"></i>
          <div>
            <strong>Tanda Tangan Digital</strong>
            <span>Responden dapat membubuhkan tanda tangan langsung dengan jari di layar sentuh HP atau mouse.</span>
          </div>
        </div>
      `;
    } else if (q.type === 'file_gdrive') {
      const allowed = q.allowedTypes || 'all';
      const maxSize = q.maxSizeMB || 10;
      optionsHtml = `
        <div class="gdrive-preview-box">
          <div class="gdrive-box-header">
            <div class="gdrive-box-title">
              <i data-lucide="hard-drive" style="color: #10b981;"></i>
              <strong>Upload Berkas ke Google Drive</strong>
            </div>
            <button type="button" class="btn btn-ghost btn-xs btn-card-gdrive-guide" style="color: #10b981;">
              <i data-lucide="help-circle"></i>
              <span>Panduan Webhook</span>
            </button>
          </div>
          <div class="gdrive-box-desc">
            Responden dapat mengunggah berkas apa saja (PDF, Dokumen Word/Excel, Gambar, Video, Arsip ZIP) yang otomatis tersimpan ke Google Drive Anda.
          </div>
          <div class="gdrive-box-config">
            <div class="gdrive-config-item">
              <label><i data-lucide="file-check"></i> Jenis Berkas Diizinkan:</label>
              <select class="select-gdrive-allowed input-select-sm">
                <option value="all" ${allowed === 'all' ? 'selected' : ''}>Semua Jenis Berkas (Bebas)</option>
                <option value="document" ${allowed === 'document' ? 'selected' : ''}>Dokumen & PDF (.pdf, .docx, .xlsx, .pptx, .txt)</option>
                <option value="pdf" ${allowed === 'pdf' ? 'selected' : ''}>Hanya Dokumen PDF (.pdf)</option>
                <option value="image" ${allowed === 'image' ? 'selected' : ''}>Gambar / Foto (.jpg, .png, .webp, .jpeg)</option>
                <option value="archive" ${allowed === 'archive' ? 'selected' : ''}>Berkas Arsip / ZIP (.zip, .rar, .7z)</option>
                <option value="media" ${allowed === 'media' ? 'selected' : ''}>Audio & Video (.mp3, .mp4, .wav, .mov)</option>
              </select>
            </div>
            <div class="gdrive-config-item">
              <label><i data-lucide="database"></i> Batas Ukuran Maksimum:</label>
              <select class="select-gdrive-size input-select-sm">
                <option value="5" ${maxSize == 5 ? 'selected' : ''}>5 MB</option>
                <option value="10" ${maxSize == 10 ? 'selected' : ''}>10 MB (Rekomendasi / Bawaan)</option>
                <option value="20" ${maxSize == 20 ? 'selected' : ''}>20 MB</option>
                <option value="50" ${maxSize == 50 ? 'selected' : ''}>50 MB (Maksimum)</option>
              </select>
            </div>
          </div>
        </div>
      `;
    } else if (q.type === 'paragraph') {
      optionsHtml = `<div class="text-preview-box">Teks jawaban panjang / paragraf responden...</div>`;
    } else if (q.type === 'date') {
      optionsHtml = `<div class="text-preview-box">Pilihan Tanggal (DD/MM/YYYY)...</div>`;
    } else if (q.type === 'time') {
      optionsHtml = `<div class="text-preview-box">Pilihan Waktu (HH:MM)...</div>`;
    } else if (q.type === 'number') {
      optionsHtml = `<div class="text-preview-box">Input Angka / Nomor...</div>`;
    } else {
      const isQuiz = this.currentForm && this.currentForm.isQuizMode === true;
      optionsHtml = `
        <div class="text-preview-box">Teks jawaban singkat responden...</div>
        ${isQuiz ? `
          <div class="q-quiz-config-bar">
            <div class="q-quiz-points-wrap">
              <i data-lucide="award"></i>
              <span>Poin Soal:</span>
              <input type="number" class="input-q-points" value="${q.points !== undefined ? q.points : 10}" min="0" max="100">
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
              <span style="font-size: 0.8rem; color: #34d399; font-weight: 500;">Kunci Teks:</span>
              <input type="text" class="input-q-correct-text input-text" value="${this.escapeHtml(q.correctAnswer || '')}" placeholder="Kunci jawaban teks/angka yang benar..." style="padding: 4px 8px; font-size: 0.85rem;">
            </div>
          </div>
        ` : ''}
      `;
    }

    card.innerHTML = `
      <!-- Collapsed Compact Strip (Google Forms style) -->
      <div class="q-collapsed-strip">
        <div class="q-collapsed-left">
          <div class="q-collapsed-handle" title="Tahan & geser urutan"><i data-lucide="grip-vertical"></i></div>
          <span class="q-collapsed-num">${globalIndex + 1}.</span>
          <span class="q-collapsed-title">${this.escapeHtml(q.title || 'Pertanyaan Tanpa Judul')}</span>
          ${q.required ? '<span class="q-collapsed-star" title="Wajib diisi">*</span>' : ''}
          <span class="q-type-badge ${q.type}"><i data-lucide="${typeMeta.icon}"></i> ${typeMeta.label}</span>
          ${(q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') ? `<span class="q-options-badge">${(q.options || []).length} opsi</span>` : ''}
        </div>
        <div class="q-collapsed-actions">
          <button type="button" class="btn-q-icon q-toggle-collapse" title="Buka / Edit Pertanyaan">
            <i data-lucide="chevron-down"></i>
          </button>
          <button type="button" class="btn-q-icon duplicate" title="Duplikat">
            <i data-lucide="copy"></i>
          </button>
          <button type="button" class="btn-q-icon delete" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>

      <!-- Top Drag Handle -->
      <div class="card-drag-handle" title="Tahan & geser untuk mengubah urutan pertanyaan">
        <i data-lucide="grip-horizontal"></i>
      </div>

      <div class="question-card-top">
        <div class="q-title-wrap">
          <input type="text" class="input-q-title" value="${this.escapeHtml(q.title || '')}" placeholder="Ketik pertanyaan / soal di sini...">
          <button type="button" class="btn-q-image ${q.imageUrl ? 'has-image' : ''}" title="Tambahkan / Ganti Gambar Soal">
            <i data-lucide="image"></i>
          </button>
          <input type="file" class="input-q-image-file" accept="image/*" style="display:none;">
        </div>
        <div class="q-type-select-wrap">
          <button type="button" class="btn-q-icon q-toggle-collapse" title="Lipat Pertanyaan Ini">
            <i data-lucide="chevron-up"></i>
          </button>
          <select class="select-q-type">
            <option value="text" ${q.type === 'text' ? 'selected' : ''}>Teks Singkat</option>
            <option value="paragraph" ${q.type === 'paragraph' ? 'selected' : ''}>Paragraf</option>
            <option value="choice" ${q.type === 'choice' ? 'selected' : ''}>Pilihan Ganda</option>
            <option value="checkbox" ${q.type === 'checkbox' ? 'selected' : ''}>Kotak Centang</option>
            <option value="dropdown" ${q.type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
            <option value="file_gdrive" ${q.type === 'file_gdrive' ? 'selected' : ''}>📁 Upload Berkas (Google Drive)</option>
            <option value="file" ${q.type === 'file' ? 'selected' : ''}>📸 Upload Foto / Kamera</option>
            <option value="location" ${q.type === 'location' ? 'selected' : ''}>📍 Lokasi GPS / Koordinat</option>
            <option value="signature" ${q.type === 'signature' ? 'selected' : ''}>✍️ Tanda Tangan Digital</option>
            <option value="rating" ${q.type === 'rating' ? 'selected' : ''}>Rating Bintang</option>
            <option value="date" ${q.type === 'date' ? 'selected' : ''}>Tanggal</option>
            <option value="time" ${q.type === 'time' ? 'selected' : ''}>Waktu</option>
            <option value="number" ${q.type === 'number' ? 'selected' : ''}>Angka</option>
          </select>
        </div>
      </div>

      ${q.imageUrl ? `
        <div class="q-image-preview-card">
          <img src="${this.escapeHtml(q.imageUrl)}" alt="Gambar Soal" class="q-preview-img">
          <div class="q-image-actions">
            <button type="button" class="btn-replace-q-image btn btn-secondary btn-xs">
              <i data-lucide="refresh-cw"></i>
              <span>Ganti Gambar</span>
            </button>
            <button type="button" class="btn-remove-q-image btn btn-ghost btn-xs" style="color: var(--accent-rose);">
              <i data-lucide="trash-2"></i>
              <span>Hapus Gambar</span>
            </button>
          </div>
        </div>
      ` : ''}

      <div class="question-card-middle">
        ${optionsHtml}
      </div>

      <div class="question-card-bottom">
        <label class="q-required-toggle">
          <span>Wajib diisi</span>
          <label class="switch">
            <input type="checkbox" class="q-required-check" ${q.required ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </label>

        <div class="q-actions-group">
          ${globalIndex > 0 ? `
            <button type="button" class="btn-q-icon move-up" title="Pindah ke Atas">
              <i data-lucide="chevron-up"></i>
            </button>
          ` : ''}
          ${globalIndex < this.questions.length - 1 ? `
            <button type="button" class="btn-q-icon move-down" title="Pindah ke Bawah">
              <i data-lucide="chevron-down"></i>
            </button>
          ` : ''}
          <button type="button" class="btn-q-icon duplicate" title="Duplikat Pertanyaan">
            <i data-lucide="copy"></i>
          </button>
          <button type="button" class="btn-q-icon delete" title="Hapus Pertanyaan">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;

    // Attach Drag and Drop handlers
    this.attachDragEvents(card, q.id);

    
    // Question Collapse / Expand Events
    card.querySelectorAll('.q-toggle-collapse').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.collapsedQuestions.has(q.id)) {
          this.collapsedQuestions.delete(q.id);
        } else {
          this.collapsedQuestions.add(q.id);
        }
        this.renderQuestions();
      });
    });

    // Clicking anywhere on collapsed card expands it
    card.addEventListener('click', (e) => {
      if (this.collapsedQuestions.has(q.id)) {
        if (!e.target.closest('.delete') && !e.target.closest('.duplicate') && !e.target.closest('.card-drag-handle-mini')) {
          this.collapsedQuestions.delete(q.id);
          this.renderQuestions();
        }
      }
    });

    // Attach local card event listeners
    const titleInput = card.querySelector('.input-q-title');
    titleInput.addEventListener('input', (e) => {
      q.title = e.target.value;
    });

    // Question Image Upload
    const btnQImage = card.querySelector('.btn-q-image');
    const inputQImageFile = card.querySelector('.input-q-image-file');
    if (btnQImage && inputQImageFile) {
      btnQImage.addEventListener('click', () => {
        inputQImageFile.click();
      });

      inputQImageFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Mengompresi & mengunggah gambar soal...', 'info');
        }

        try {
          const formId = this.currentForm ? this.currentForm.id : 'form_' + Date.now();
          const result = await window.imageUploader.processAndUpload(file, { formId, context: 'question' });
          q.imageUrl = result.url;
          this.renderQuestions();
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Gambar soal berhasil ditambahkan!', 'success');
          }
        } catch (err) {
          console.error(err);
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Gagal memproses gambar: ' + err.message, 'error');
          }
        }
      });
    }

    // Replace & Remove Question Image
    const btnReplaceQImg = card.querySelector('.btn-replace-q-image');
    if (btnReplaceQImg && inputQImageFile) {
      btnReplaceQImg.addEventListener('click', () => {
        inputQImageFile.click();
      });
    }

    const btnRemoveQImg = card.querySelector('.btn-remove-q-image');
    if (btnRemoveQImg) {
      btnRemoveQImg.addEventListener('click', () => {
        delete q.imageUrl;
        this.renderQuestions();
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Gambar soal telah dihapus', 'info');
        }
      });
    }

    const typeSelect = card.querySelector('.select-q-type');
    typeSelect.addEventListener('change', (e) => {
      q.type = e.target.value;
      if (['choice', 'checkbox', 'dropdown'].includes(q.type) && (!q.options || q.options.length === 0)) {
        q.options = ['Opsi 1', 'Opsi 2'];
      }
      if (q.type === 'file_gdrive') {
        if (!q.allowedTypes) q.allowedTypes = 'all';
        if (!q.maxSizeMB) q.maxSizeMB = 10;
      }
      this.renderQuestions();
    });

    // Google Drive Question Configuration Listeners
    const selectGdriveAllowed = card.querySelector('.select-gdrive-allowed');
    if (selectGdriveAllowed) {
      selectGdriveAllowed.addEventListener('change', (e) => {
        q.allowedTypes = e.target.value;
      });
    }

    const selectGdriveSize = card.querySelector('.select-gdrive-size');
    if (selectGdriveSize) {
      selectGdriveSize.addEventListener('change', (e) => {
        q.maxSizeMB = parseInt(e.target.value, 10) || 10;
      });
    }

    const btnCardGdriveGuide = card.querySelector('.btn-card-gdrive-guide');
    if (btnCardGdriveGuide) {
      btnCardGdriveGuide.addEventListener('click', () => {
        if (this.btnOpenGdriveGuide) {
          this.btnOpenGdriveGuide.click();
        }
      });
    }

    const requiredCheck = card.querySelector('.q-required-check');
    requiredCheck.addEventListener('change', (e) => {
      q.required = e.target.checked;
    });

    // Options row modifications (with Excel / Google Sheets multi-line paste support & Option Image Upload)
    const optRows = card.querySelectorAll('.option-row');
    optRows.forEach((row, optIdx) => {
      const input = row.querySelector('.input-option-text');
      const btnOptImg = row.querySelector('.btn-opt-image');
      const inputOptImgFile = row.querySelector('.input-opt-image-file');
      const btnRemoveOptImg = row.querySelector('.btn-remove-opt-image');

      if (input) {
        input.addEventListener('input', (e) => {
          if (!q.options) q.options = [];
          if (typeof q.options[optIdx] === 'object') {
            q.options[optIdx].text = e.target.value;
          } else {
            q.options[optIdx] = e.target.value;
          }
        });

        // Paste multiple items from Excel / Google Sheets
        input.addEventListener('paste', (e) => {
          const pasteData = (e.clipboardData || window.clipboardData).getData('text');
          if (pasteData && (pasteData.includes('\n') || pasteData.includes('\r'))) {
            e.preventDefault();
            const lines = pasteData
              .split(/\r?\n/)
              .map(l => l.trim())
              .filter(l => l.length > 0);

            if (lines.length > 0) {
              if (!q.options) q.options = [];
              // Replace current option with first line, and insert remaining lines
              q.options.splice(optIdx, 1, ...lines);
              this.renderQuestions();
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast(`Berhasil menempelkan ${lines.length} opsi dari Excel/Sheets!`, 'success');
              }
            }
          }
        });

        // Press Enter to create a new option row below and focus it
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!q.options) q.options = [];
            q.options.splice(optIdx + 1, 0, `Opsi ${q.options.length + 1}`);
            this.renderQuestions();

            // Focus the next option input
            setTimeout(() => {
              const currentCard = document.querySelector(`[data-question-id="${q.id}"]`);
              if (currentCard) {
                const inputs = currentCard.querySelectorAll('.input-option-text');
                if (inputs[optIdx + 1]) {
                  inputs[optIdx + 1].focus();
                  inputs[optIdx + 1].select();
                }
              }
            }, 60);
          }
        });
      }

      // Branch / Logic Jump Select
      const branchSelect = row.querySelector('.select-opt-branch');
      if (branchSelect) {
        branchSelect.addEventListener('change', (e) => {
          if (!q.options) q.options = [];
          if (typeof q.options[optIdx] === 'object') {
            q.options[optIdx].nextSectionId = e.target.value;
          } else {
            q.options[optIdx] = {
              text: q.options[optIdx] || `Opsi ${optIdx + 1}`,
              nextSectionId: e.target.value
            };
          }
        });
      }

      // Option Image Upload
      if (btnOptImg && inputOptImgFile) {
        btnOptImg.addEventListener('click', () => {
          inputOptImgFile.click();
        });

        inputOptImgFile.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Mengompresi & mengunggah gambar opsi...', 'info');
          }

          try {
            const formId = this.currentForm ? this.currentForm.id : 'form_' + Date.now();
            const result = await window.imageUploader.processAndUpload(file, { formId, context: 'option' });
            
            if (!q.options) q.options = [];
            const currentOpt = q.options[optIdx];
            const optText = typeof currentOpt === 'object' ? (currentOpt.text || '') : (currentOpt || `Opsi ${optIdx + 1}`);

            q.options[optIdx] = {
              text: optText,
              imageUrl: result.url
            };

            this.renderQuestions();
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast('Gambar opsi berhasil ditambahkan!', 'success');
            }
          } catch (err) {
            console.error(err);
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast('Gagal memproses gambar opsi: ' + err.message, 'error');
            }
          }
        });
      }

      // Remove Option Image
      if (btnRemoveOptImg) {
        btnRemoveOptImg.addEventListener('click', () => {
          if (typeof q.options[optIdx] === 'object') {
            q.options[optIdx] = q.options[optIdx].text || '';
          }
          this.renderQuestions();
        });
      }
    });

    const btnRemoveOpts = card.querySelectorAll('.btn-remove-option');
    btnRemoveOpts.forEach((btn, optIdx) => {
      btn.addEventListener('click', () => {
        q.options.splice(optIdx, 1);
        this.renderQuestions();
      });
    });

    const btnAddOption = card.querySelector('.btn-add-option-row');
    if (btnAddOption) {
      btnAddOption.addEventListener('click', () => {
        if (!q.options) q.options = [];
        q.options.push(`Opsi ${q.options.length + 1}`);
        this.renderQuestions();
      });
    }

    // Card Actions (Duplicate, Delete, Move)
    const btnDuplicate = card.querySelector('.btn-q-icon.duplicate');
    btnDuplicate.addEventListener('click', () => {
      const cloned = JSON.parse(JSON.stringify(q));
      cloned.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      this.questions.splice(globalIndex + 1, 0, cloned);
      this.renderQuestions();
    });

    const btnDelete = card.querySelector('.btn-q-icon.delete');
    btnDelete.addEventListener('click', () => {
      if (this.questions.length <= 1) {
        window.app.showToast('Formulir harus memiliki minimal satu pertanyaan', 'error');
        return;
      }
      this.questions.splice(globalIndex, 1);
      this.renderQuestions();
    });

    const btnMoveUp = card.querySelector('.btn-q-icon.move-up');
    if (btnMoveUp) {
      btnMoveUp.addEventListener('click', () => {
        const temp = this.questions[globalIndex];
        this.questions[globalIndex] = this.questions[globalIndex - 1];
        this.questions[globalIndex - 1] = temp;
        this.renderQuestions();
      });
    }

    const btnMoveDown = card.querySelector('.btn-q-icon.move-down');
    if (btnMoveDown) {
      btnMoveDown.addEventListener('click', () => {
        const temp = this.questions[globalIndex];
        this.questions[globalIndex] = this.questions[globalIndex + 1];
        this.questions[globalIndex + 1] = temp;
        this.renderQuestions();
      });
    }

    return card;
  }

  attachDragEvents(card, questionId) {
    const handle = card.querySelector('.card-drag-handle');

    handle.addEventListener('mousedown', () => {
      card.setAttribute('draggable', 'true');
    });

    document.addEventListener('mouseup', () => {
      card.setAttribute('draggable', 'false');
    });

    card.addEventListener('dragstart', (e) => {
      this.draggedQuestionId = questionId;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', questionId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      card.setAttribute('draggable', 'false');
      this.draggedQuestionId = null;
      document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.draggedQuestionId || this.draggedQuestionId === questionId) return;

      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      card.classList.remove('drag-over-top', 'drag-over-bottom');
      if (e.clientY < midY) {
        card.classList.add('drag-over-top');
      } else {
        card.classList.add('drag-over-bottom');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over-top', 'drag-over-bottom');

      if (!this.draggedQuestionId || this.draggedQuestionId === questionId) return;

      const sourceIndex = this.questions.findIndex(item => item.id === this.draggedQuestionId);
      const targetIndex = this.questions.findIndex(item => item.id === questionId);

      if (sourceIndex < 0 || targetIndex < 0) return;

      const rect = card.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      const [draggedItem] = this.questions.splice(sourceIndex, 1);
      
      // Update sectionId to target section
      const targetItem = this.questions.find(item => item.id === questionId);
      if (targetItem) {
        draggedItem.sectionId = targetItem.sectionId;
      }

      let newIndex = this.questions.findIndex(item => item.id === questionId);
      if (!insertBefore) {
        newIndex += 1;
      }

      this.questions.splice(newIndex, 0, draggedItem);
      this.renderQuestions();
      window.app.showToast('Urutan pertanyaan berhasil diubah', 'info');
    });
  }

  addQuestion(type = 'text', targetSectionId = null) {
    const secId = targetSectionId || (this.sections[this.sections.length - 1] ? this.sections[this.sections.length - 1].id : 'sec_1');
    const newQ = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sectionId: secId,
      type,
      title: '',
      required: false
    };

    if (['choice', 'checkbox', 'dropdown'].includes(type)) {
      newQ.options = ['Opsi 1', 'Opsi 2'];
    }

    this.questions.push(newQ);
    this.renderQuestions();

    // Scroll to new question
    setTimeout(() => {
      const cards = this.questionsContainer.querySelectorAll('.question-card');
      const lastCard = cards[cards.length - 1];
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = lastCard.querySelector('.input-q-title');
        if (input) input.focus();
      }
    }, 50);
  }

  addSection() {
    const secNum = this.sections.length + 1;
    const newSec = {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: `Bagian ${secNum}`,
      description: ''
    };

    this.sections.push(newSec);

    // Also add a new default question in this section
    const newQ = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sectionId: newSec.id,
      type: 'text',
      title: '',
      required: false
    };
    this.questions.push(newQ);

    this.renderQuestions();
    window.app.showToast(`Bagian ${secNum} berhasil ditambahkan!`, 'success');

    // Scroll to the new section card
    setTimeout(() => {
      const secCards = this.questionsContainer.querySelectorAll('.section-card');
      const lastSecCard = secCards[secCards.length - 1];
      if (lastSecCard) {
        lastSecCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = lastSecCard.querySelector('.input-section-title');
        if (input) input.focus();
      }
    }, 60);
  }

  async saveCurrentForm() {
    const title = (this.titleInput ? this.titleInput.value.trim() : '') || 'Formulir Tanpa Judul';
    const description = this.descInput ? this.descInput.value.trim() : '';

    // Active theme color
    let themeColor = '#6366f1';
    const activeSwatch = document.querySelector('.color-swatch.active');
    if (activeSwatch) {
      themeColor = activeSwatch.dataset.color;
    }

    const formData = {
      ...this.currentForm,
      title,
      description,
      themeColor,
      bannerUrl: this.headerImgInput ? this.headerImgInput.value.trim() : '',
      submitMessage: this.submitMsgInput ? this.submitMsgInput.value.trim() : 'Terima kasih! Tanggapan Anda telah berhasil direkam.',
      collectEmail: this.collectEmailCheck ? this.collectEmailCheck.checked : false,
      allowMultiple: this.allowMultipleCheck ? this.allowMultipleCheck.checked : true,
      isActive: this.isActiveCheck ? this.isActiveCheck.checked : true,
      gdriveScriptUrl: this.gdriveScriptUrlInput ? this.gdriveScriptUrlInput.value.trim() : '',
      gdriveFolderId: this.gdriveFolderIdInput ? this.gdriveFolderIdInput.value.trim() : '',
      sections: this.sections,
      questions: this.questions
    };

    try {
      const saved = await window.formStorage.saveForm(formData);
      this.currentForm = saved;
      if (this.statusBadge) this.statusBadge.textContent = 'Tersimpan';
      if (this.responsesTabLink) this.responsesTabLink.style.display = 'inline-flex';
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Formulir berhasil disimpan!', 'success');
      }
      return saved;
    } catch (err) {
      console.error(err);
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Gagal menyimpan formulir: ' + err.message, 'error');
      }
      return null;
    }
  }

  
  loadWhatsAppSurveyTemplate() {
    this.switchTab('questions');
    const ts = Date.now();
    const secSekolahId = 'sec_' + ts + '_sekolah';
    const secKelasJetisId = 'sec_' + ts + '_kls_jetis';
    const secKelasMutuId = 'sec_' + ts + '_kls_mutu';
    const secNamaJetis1Id = 'sec_' + ts + '_nama_jetis1';
    const secNamaJetis2Id = 'sec_' + ts + '_nama_jetis2';
    const secNamaMutu1Id = 'sec_' + ts + '_nama_mutu1';
    const secNamaMutu2Id = 'sec_' + ts + '_nama_mutu2';
    const secKontakId = 'sec_' + ts + '_kontak';

    const listJetis1 = [
      'ACHMAD HAMDHANI', 'ADINKA AULIA ERNATA', 'AHMAD RIDLOL MAHBUB', 'ALFATHIH KHARISMA',
      'ALFIAN ABDI RAMADHANI PUTRA', 'ALIF SETIYA RAMADHANI', 'ANGEL CLEODYA ARETA AZARIA HAFA',
      'BIMA DWI BINTANG AGUSTINO', 'CHANTIKA FASHESHA SALVA SALSA BELLA', 'CHEIZA ADHITYA PUTRI PERMANA',
      'CHIKITA FACHECHA SALWA SALSA BELLA', 'CIKA OKTAVIA', 'DAFFA HANNAFI PRATAMA',
      'DEVINA WAHYU NUR FADILLA', 'DEWI SILA', 'DIMAS ERVAN HARDIANSYAH',
      'DINDA PUTRI WISDIANINGSIH', 'DJOHAN ADAM ADINATA', 'ERINA AYU ANGGRAENI',
      'ERLIN FELICIA ELVARETTA', 'EVAN ADI SAPUTRA', 'FADHIL RASSA MAULIDI UBAIDILLAH',
      'FAHREZA AFIF FANANI', 'FARIDATUS SHOLIHAH', 'GADIS RAHMADANI YUDIARTI',
      'GHULAM NADIYUL KAFI', 'INDRI WIDYANTI AULIAH', 'IQBAL ARIZONA',
      'IRZAQI AZIZ RIZALDI', 'KAFKA NAFISA KEVIN ZAINUL PRATAMA', 'KHANZA AURELYA PUTRI',
      'KHUSNUL AMEL FEBRIYANINGSIH', 'LAUDYA DEVIRA NAURA ZALFARIMBI', 'LIA AMANDA RAHMAWATI',
      'MELATI PUTRI KHAMIDDA', 'MOCH FUAD BURHANUDDIN'
    ];

    const listJetis2 = [
      'MOCHAMAD HAFIS ALFARIDZI', 'MOH ABIL DINEYJAD', 'MOH ARIF RAHMAN HAKIM',
      'MOKHAMMAD AINUR HAQIQI', 'MUCHAMMAD GALIH IMANUDDIN', 'MUHAMMAD ABDUR ROFIQ',
      'MUHAMMAD ANDIKA SAPUTRA', 'MUHAMMAD ARDIKA PUTRA PRATAMA', 'MUHAMMAD FARELINO ABDULNANI',
      'MUHAMMAD IRSADIL IBAD BY HAKI', 'MUHAMMAD KHOIRUL AZAM', 'MUHAMMAD NUR QAISHA AL AZZAM',
      'MUHAMMAD REYHAN BRAMANTYO', 'MUHAMMAD REYHAN FARRIANSYAH', 'MUHAMMAD SYIHABUDDIN ZAKKI',
      'NAILA FAIRUZ TSAQILA', 'NATASYA ADELIA PUTRI', 'NOVIANTI ISNATUL ARAFA',
      'RAFFI AHYAR ABDILLAH', 'RAFLIANO TRI AL HABSY', 'RAHMAD AGENG BUNTARAN',
      'RAKA DITYA SAPUTRA', 'REHAN ARIL ALVINO', 'RIFALDO ADITYA CHAFIDZ',
      'RIFAN YUNI ERMAWAN', 'RINFI LAILATUL FAJRI NIHAYATUDDIYANAH', 'ROKHMAD SWARDANA',
      'SHAVYRA HANUM RAHMADANI', 'SHELVYA LAILA ARDANNA', 'TANIA OKTAVIANI DWI AGUSTIN',
      'VELLA ARDIANTI', 'VERONIKA ADELIA TKELA', 'VIRLY NAZWA AINUN PUTRI',
      'WILDAN GAISAN FAHLAVI VIPUTRO', 'ZORA WIDYANATA AGUSTIN'
    ];

    const listMutu1 = [
      'Afreyza Nurul Dwi Putra', 'Ahmad Bayhaqy Yulianto', 'Alfian Cahyo', 'Alridho Fitrah Ramadhani',
      'Anandah Cahaya Puspita', 'Andini Ziadatul Husnah', 'Andreano Gilang Pratama Daryanto',
      'Aurellia Putri Margaretta', 'Bisma Tirta Fachrudin', 'Davinesta Abelino Priyaka',
      'Dimas Aditya Pratama', 'Dinda Lupita Sari', 'Edra Syifa\' Gian Agta', 'Egik Andika Pratama',
      'Erlangga Zaelani Revandi Pratama', 'Fahreza Septian Ramadhani', 'Fhadil Alfino Wahyudi',
      'Hanafi Wisnu Kholilullah', 'Intan Rohmatun Muntahana', 'Izzana Zahrothul Zahwa',
      'Khafidz Azka Saputra', 'Muhammad Zakka Khamalulloh', 'Muhammad Zakki Khamilulloh',
      'Muhammad Kevin Ulumul Fu\'adi'
    ];

    const listMutu2 = [
      'Maulidus Diyon Safaat', 'Mecha Dea Olivia', 'Mohammad Rizal Ardiansyah',
      'Mohammad Indra Wahyu Jati Ababil', 'Muhammad Hafiz Zulfikri', 'Muhammad Deva Julianda',
      'Muhammad Fadel Roby Assiddiqy', 'Muhammad Ilham Ulinnuha', 'Nafisah Dwi Nur Ibadillah',
      'Nanda Dwi Bagus Rahmadani', 'Natasya Mei Madinah', 'Nur Yana Putri Olivia',
      'Rahayu Puwanti', 'Rani Artalita', 'Reyhan Dwi Ramadhani', 'Reynata Putra Ardiansyah',
      'Robiht Afthon Maulana', 'Sifa Nur Aini', 'Siti Alfiah Intan Ramadani', 'Sony Abdila Rafi',
      'Tri Setyo Wicaksono', 'Uzlifatil Jannah', 'Zaidanil Akhmal Subhqi', 'Anggun Latifa', 'Andrian'
    ];

    this.currentForm = {
      id: null,
      title: 'FORM PENDATAAN NO WHATSAPP AKTIF',
      description: 'Formulir pendataan nomor WhatsApp aktif siswa jurusan Teknik Elektronika Industri (TEI). Mohon pilih sekolah, kelas, nama lengkap Anda, dan masukkan nomor WhatsApp aktif.',
      themeColor: '#6366f1',
      bannerUrl: '',
      submitMessage: 'Terima kasih! Nomor WhatsApp Anda telah berhasil direkam ke dalam database.',
      collectEmail: false,
      allowMultiple: false,
      isActive: true,
      responseCount: 0,
      sections: [
        {
          id: secSekolahId,
          title: 'Bagian 1: Pilih Sekolah',
          description: 'Pilih sekolah asal Anda untuk diarahkan ke kelas yang sesuai.'
        },
        {
          id: secKelasJetisId,
          title: 'Bagian 2: Pilih Kelas (SMK Negeri 1 Jetis)',
          description: 'Pilih kelas Anda di SMK Negeri 1 Jetis.'
        },
        {
          id: secKelasMutuId,
          title: 'Bagian 3: Pilih Kelas (SMK Mutu Kemlagi)',
          description: 'Pilih kelas Anda di SMK Mutu Kemlagi.'
        },
        {
          id: secNamaJetis1Id,
          title: 'Bagian 4: Data Siswa XI TEI 1 (SMKN 1 Jetis)',
          description: 'Pilih nama lengkap Anda dari daftar siswa berikut.'
        },
        {
          id: secNamaJetis2Id,
          title: 'Bagian 5: Data Siswa XI TEI 2 (SMKN 1 Jetis)',
          description: 'Pilih nama lengkap Anda dari daftar siswa berikut.'
        },
        {
          id: secNamaMutu1Id,
          title: 'Bagian 6: Data Siswa XI TEI 1 (SMK Mutu Kemlagi)',
          description: 'Pilih nama lengkap Anda dari daftar siswa berikut.'
        },
        {
          id: secNamaMutu2Id,
          title: 'Bagian 7: Data Siswa XI TEI 2 (SMK Mutu Kemlagi)',
          description: 'Pilih nama lengkap Anda dari daftar siswa berikut.'
        },
        {
          id: secKontakId,
          title: 'Bagian 8: Nomor WhatsApp Aktif',
          description: 'Isikan nomor WhatsApp aktif yang dapat dihubungi.'
        }
      ],
      questions: [
        // 1. Pilih Sekolah
        {
          id: 'q_' + ts + '_sekolah',
          sectionId: secSekolahId,
          type: 'dropdown',
          title: 'SEKOLAH',
          required: true,
          options: [
            { text: 'SMK NEGERI 1 JETIS', nextSectionId: secKelasJetisId },
            { text: 'SMK MUTU KEMLAGI', nextSectionId: secKelasMutuId }
          ]
        },
        // 2. Kelas Jetis
        {
          id: 'q_' + ts + '_kls_jetis',
          sectionId: secKelasJetisId,
          type: 'dropdown',
          title: 'KELAS',
          required: true,
          options: [
            { text: 'XI TEI 1', nextSectionId: secNamaJetis1Id },
            { text: 'XI TEI 2', nextSectionId: secNamaJetis2Id }
          ]
        },
        // 3. Kelas Mutu
        {
          id: 'q_' + ts + '_kls_mutu',
          sectionId: secKelasMutuId,
          type: 'dropdown',
          title: 'KELAS',
          required: true,
          options: [
            { text: 'XI TEI 1', nextSectionId: secNamaMutu1Id },
            { text: 'XI TEI 2', nextSectionId: secNamaMutu2Id }
          ]
        },
        // 4. Nama Siswa Jetis 1
        {
          id: 'q_' + ts + '_nama_jetis1',
          sectionId: secNamaJetis1Id,
          type: 'dropdown',
          title: 'NAMA LENGKAP',
          required: true,
          options: listJetis1.map(name => ({ text: name, nextSectionId: secKontakId }))
        },
        // 5. Nama Siswa Jetis 2
        {
          id: 'q_' + ts + '_nama_jetis2',
          sectionId: secNamaJetis2Id,
          type: 'dropdown',
          title: 'NAMA LENGKAP',
          required: true,
          options: listJetis2.map(name => ({ text: name, nextSectionId: secKontakId }))
        },
        // 6. Nama Siswa Mutu 1
        {
          id: 'q_' + ts + '_nama_mutu1',
          sectionId: secNamaMutu1Id,
          type: 'dropdown',
          title: 'NAMA LENGKAP',
          required: true,
          options: listMutu1.map(name => ({ text: name, nextSectionId: secKontakId }))
        },
        // 7. Nama Siswa Mutu 2
        {
          id: 'q_' + ts + '_nama_mutu2',
          sectionId: secNamaMutu2Id,
          type: 'dropdown',
          title: 'NAMA LENGKAP',
          required: true,
          options: listMutu2.map(name => ({ text: name, nextSectionId: secKontakId }))
        },
        // 8. No WhatsApp Utama
        {
          id: 'q_' + ts + '_wa_utama',
          sectionId: secKontakId,
          type: 'text',
          title: 'NO WHATSAPP UTAMA',
          required: true,
          placeholder: 'Contoh: 081234567890'
        }
      ]
    };

    this.sections = this.currentForm.sections;
    this.questions = this.currentForm.questions;
    this.renderForm();

    if (this.statusBadge) this.statusBadge.textContent = 'Template Pendataan No WhatsApp';
    if (this.responsesTabLink) this.responsesTabLink.style.display = 'none';

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('Template Pendataan No WhatsApp aktif berhasil dimuat! Anda dapat langsung menyimpannya atau menyesuaikan pertanyaan.', 'success');
    }
  }

  loadStudentBioTemplate() {
    this.switchTab('questions');
    const sec1Id = 'sec_' + Date.now() + '_1';
    const sec2Id = 'sec_' + Date.now() + '_2';

    this.currentForm = {
      id: null,
      title: 'Formulir Biodata & Titik Lokasi Rumah Siswa',
      description: 'Mohon lengkapi biodata siswa berikut dengan benar. Pastikan fitur GPS / Lokasi di HP Anda sudah aktif saat menekan tombol ambil titik lokasi rumah.',
      themeColor: '#06b6d4',
      bannerUrl: '',
      submitMessage: 'Terima kasih! Biodata dan titik lokasi rumah siswa telah berhasil direkam.',
      collectEmail: false,
      allowMultiple: false,
      isActive: true,
      responseCount: 0,
      sections: [
        {
          id: sec1Id,
          title: 'Bagian 1: Data Pokok Siswa',
          description: 'Isikan identitas lengkap peserta didik sesuai dokumen resmi (Akta / KK).'
        },
        {
          id: sec2Id,
          title: 'Bagian 2: Alamat & Perekaman Titik Rumah (GPS)',
          description: 'Pastikan pengisian dilakukan di rumah atau gunakan GPS akurat dari HP Anda.'
        }
      ],
      questions: [
        {
          id: 'q_' + Date.now() + '_nama',
          sectionId: sec1Id,
          type: 'text',
          title: 'Nama Lengkap Siswa',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_nisn',
          sectionId: sec1Id,
          type: 'number',
          title: 'Nomor Induk Siswa Nasional (NISN)',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_jk',
          sectionId: sec1Id,
          type: 'choice',
          title: 'Jenis Kelamin',
          required: true,
          options: ['Laki-laki', 'Perempuan']
        },
        {
          id: 'q_' + Date.now() + '_ttl',
          sectionId: sec1Id,
          type: 'text',
          title: 'Tempat, Tanggal Lahir (Contoh: Surabaya, 12 Mei 2010)',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_foto_siswa',
          sectionId: sec1Id,
          type: 'file',
          title: 'Pas Foto Siswa (3x4 / Bebas Rapi)',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_ortu',
          sectionId: sec1Id,
          type: 'text',
          title: 'Nama Orang Tua / Wali',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_wa',
          sectionId: sec1Id,
          type: 'text',
          title: 'Nomor WhatsApp / HP Orang Tua (Aktif)',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_alamat',
          sectionId: sec2Id,
          type: 'paragraph',
          title: 'Alamat Lengkap Rumah (Jalan, RT/RW, Dusun/Desa, Kelurahan, Kecamatan, Kab/Kota)',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_gps',
          sectionId: sec2Id,
          type: 'location',
          title: 'Titik Lokasi GPS Rumah Siswa (Klik Ambil Titik Lokasi)',
          required: true
        },
        {
          id: 'q_' + Date.now() + '_foto_rumah',
          sectionId: sec2Id,
          type: 'file',
          title: 'Foto Tampak Depan Rumah Siswa',
          required: false
        },
        {
          id: 'q_' + Date.now() + '_patokan',
          sectionId: sec2Id,
          type: 'paragraph',
          title: 'Patokan / Petunjuk Arah Menuju Rumah (Contoh: Sebelah utara Masjid Al-Ikhlas, pagar hijau)',
          required: false
        },
        {
          id: 'q_' + Date.now() + '_ttd',
          sectionId: sec2Id,
          type: 'signature',
          title: 'Tanda Tangan Digital Orang Tua / Wali Siswa',
          required: true
        }
      ]
    };

    this.sections = this.currentForm.sections;
    this.questions = this.currentForm.questions;
    this.renderForm();

    if (this.statusBadge) this.statusBadge.textContent = 'Template Biodata Siswa';
    if (this.responsesTabLink) this.responsesTabLink.style.display = 'none';

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('Template Biodata Siswa & GPS berhasil dimuat! Anda dapat menyesuaikan atau langsung menyimpannya.', 'success');
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.FormBuilder = FormBuilder;
