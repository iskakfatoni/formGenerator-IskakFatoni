/**
 * FORMCRAFT - Form Viewer / Respondent Logic
 * Handles multi-step Section wizard, live validation, progress bar,
 * and submitting responses to Firestore / LocalStorage.
 */

class FormViewer {

  interpolateText(text) {
    if (!text || typeof text !== 'string') return text || '';
    
    // Replace {{...}} or @{...} tags with previous answers
    return text.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, tag) => {
      const cleanTag = tag.trim().toLowerCase();
      
      // 1. Match by question ID directly
      if (this.answers && this.answers[tag] !== undefined && this.answers[tag] !== null && this.answers[tag] !== '') {
        const val = this.answers[tag];
        const valStr = Array.isArray(val) ? val.join(', ') : (typeof val === 'object' && val.name ? val.name : String(val));
        return '<span class="piped-val">' + this.escapeHtml(valStr) + '</span>';
      }

      // 2. Match by question title
      if (this.currentForm && this.currentForm.questions) {
        // Try exact match
        let foundQ = this.currentForm.questions.find(q => q.title && q.title.trim().toLowerCase() === cleanTag);
        
        // Try partial match or index
        if (!foundQ) {
          foundQ = this.currentForm.questions.find(q => q.title && (
            cleanTag.includes(q.title.trim().toLowerCase()) ||
            q.title.trim().toLowerCase().includes(cleanTag)
          ));
        }

        if (!foundQ) {
          const numMatch = cleanTag.match(/\d+/);
          if (numMatch) {
            const idx = parseInt(numMatch[0]) - 1;
            if (idx >= 0 && idx < this.currentForm.questions.length) {
              foundQ = this.currentForm.questions[idx];
            }
          }
        }

        if (foundQ && this.answers && this.answers[foundQ.id] !== undefined && this.answers[foundQ.id] !== null && this.answers[foundQ.id] !== '') {
          const val = this.answers[foundQ.id];
          const valStr = Array.isArray(val) ? val.join(', ') : (typeof val === 'object' && val.name ? val.name : String(val));
          return '<span class="piped-val">' + this.escapeHtml(valStr) + '</span>';
        }
      }

      // 3. Match Email {{email}}
      if (cleanTag === 'email' && this.respondentEmail) {
        return '<span class="piped-val">' + this.escapeHtml(this.respondentEmail) + '</span>';
      }

      // Fallback: return empty string or keep tag if no answer yet
      return '<span class="piped-val">...</span>';
    });
  }


  renderFormClosed(title, message) {
    if (this.formElement) this.formElement.classList.add('hidden');
    if (this.successCard) this.successCard.classList.add('hidden');
    
    let closedWrap = document.getElementById('form-closed-notice-wrap');
    if (!closedWrap) {
      closedWrap = document.createElement('div');
      closedWrap.id = 'form-closed-notice-wrap';
      const container = document.querySelector('.form-viewer-container') || document.body;
      container.appendChild(closedWrap);
    }
    
    closedWrap.innerHTML = `
      <div class="form-closed-notice-card glass-card">
        <i data-lucide="lock" class="closed-icon"></i>
        <h2>${this.escapeHtml(title)}</h2>
        <p>${this.escapeHtml(message)}</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.location.hash = '#/dashboard'">
          <i data-lucide="arrow-left"></i>
          <span>Kembali ke Beranda</span>
        </button>
      </div>
    `;
    closedWrap.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  constructor() {
    this.currentForm = null;
    this.sections = [];
    this.currentStep = 0;
    this.answers = {};
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.titleEl = document.getElementById('form-view-title');
    this.descEl = document.getElementById('form-view-desc');
    this.bannerEl = document.getElementById('form-view-banner-img');
    this.accentBar = document.getElementById('form-view-accent-bar');
    this.questionsContainer = document.getElementById('form-view-questions');
    this.formElement = document.getElementById('form-live-element');
    this.successCard = document.getElementById('form-view-success');
    this.successMsgEl = document.getElementById('form-view-success-message');
    this.btnSubmitAnother = document.getElementById('btn-submit-another');

    // Section progress elements
    this.progressWrap = document.getElementById('form-section-progress-wrap');
    this.progressText = document.getElementById('section-progress-text');
    this.progressPct = document.getElementById('section-progress-percent');
    this.progressBar = document.getElementById('section-progress-bar');

    // Step Nav Buttons
    this.btnPrevStep = document.getElementById('btn-prev-step');
    this.btnNextStep = document.getElementById('btn-next-step');
    this.btnSubmitResponse = document.getElementById('btn-submit-response');
  }

  bindEvents() {
    if (this.formElement) {
      this.formElement.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }

    if (this.btnNextStep) {
      this.btnNextStep.addEventListener('click', () => {
        this.handleNextStep();
      });
    }

    if (this.btnPrevStep) {
      this.btnPrevStep.addEventListener('click', () => {
        this.handlePrevStep();
      });
    }

    const btnReset = document.getElementById('btn-reset-form');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin mengosongkan seluruh jawaban?')) {
          this.resetAnswers();
        }
      });
    }

    if (this.btnSubmitAnother) {
      this.btnSubmitAnother.addEventListener('click', () => {
        this.resetAnswers();
        if (this.successCard) this.successCard.classList.add('hidden');
        if (this.formElement) this.formElement.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const btnPrint = document.getElementById('btn-print-receipt');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        this.printSubmissionReceipt();
      });
    }
  }

  async loadForm(formId) {
    this.answers = {};
    this.currentStep = 0;
    this.historyStack = [0];
    this.successCard.classList.add('hidden');
    this.formElement.classList.remove('hidden');

    if (!formId) {
      window.app.showToast('ID Formulir tidak valid', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    const form = await window.formStorage.getFormById(formId);
    if (!form) {
      window.app.showToast('Formulir tidak ditemukan atau telah dihapus', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentForm = form;

    const closedNotice = document.getElementById('form-closed-notice-wrap');
    if (closedNotice) closedNotice.classList.add('hidden');

    // 1. Check Deadline Limit
    if (form.deadline) {
      const deadlineDate = new Date(form.deadline);
      if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
        this.renderFormClosed('Batas Waktu Pengisian Telah Berakhir', 'Formulir ini telah ditutup karena telah melewati batas waktu pengisian (' + deadlineDate.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) + ').');
        return;
      }
    }

    // 2. Check Quota / Max Responses Limit
    if (form.maxResponses && form.responseCount >= form.maxResponses) {
      this.renderFormClosed('Batas Kuota Responden Terpenuhi', 'Formulir ini telah ditutup karena telah mencapai batas kuota maksimal (' + form.maxResponses + ' responden).');
      return;
    }


    // Standardize sections
    if (!form.sections || form.sections.length === 0) {
      this.sections = [{ id: 'sec_1', title: form.title || 'Bagian 1', description: form.description || '' }];
    } else {
      this.sections = form.sections;
    }

    // Standardize questions sectionId
    const firstSecId = this.sections[0].id;
    (this.currentForm.questions || []).forEach(q => {
      if (!q.sectionId) q.sectionId = firstSecId;
    });

    this.renderForm();
  }

  renderForm() {
    const form = this.currentForm;
    this.titleEl.textContent = form.title || 'Formulir Tanpa Judul';
    this.descEl.textContent = form.description || '';
    
    // Theme color
    const color = form.themeColor || '#6366f1';
    this.accentBar.style.background = color;

    // Header banner
    if (form.bannerUrl) {
      this.bannerEl.style.backgroundImage = `url('${form.bannerUrl}')`;
      this.bannerEl.classList.remove('hidden');
    } else {
      this.bannerEl.classList.add('hidden');
    }

    
    // Deadline Banner in header
    let deadlineBanner = document.getElementById('form-view-deadline-banner');
    if (form.deadline) {
      const deadlineDate = new Date(form.deadline);
      if (!deadlineBanner) {
        deadlineBanner = document.createElement('div');
        deadlineBanner.id = 'form-view-deadline-banner';
        deadlineBanner.className = 'form-deadline-banner';
        const headerCard = document.getElementById('form-view-header-card');
        if (headerCard) headerCard.insertBefore(deadlineBanner, headerCard.querySelector('.live-header-text'));
      }
      deadlineBanner.innerHTML = '<i data-lucide="clock"></i> <span>Batas Waktu Pengisian: <strong>' + deadlineDate.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) + '</strong></span>';
      deadlineBanner.classList.remove('hidden');
    } else if (deadlineBanner) {
      deadlineBanner.classList.add('hidden');
    }

    // Success message text
    this.successMsgEl.textContent = form.submitMessage || 'Terima kasih! Tanggapan Anda telah berhasil disimpan.';

    // Allow multiple
    this.btnSubmitAnother.style.display = form.allowMultiple !== false ? 'inline-flex' : 'none';

    this.renderCurrentStep();
  }

  renderCurrentStep() {
    const totalSteps = this.sections.length;
    const isMultiStep = totalSteps > 1;
    const currentSec = this.sections[this.currentStep] || this.sections[0];

    // Progress Bar
    if (isMultiStep) {
      this.progressWrap.classList.remove('hidden');
      const pct = Math.round(((this.currentStep + 1) / totalSteps) * 100);
      this.progressText.textContent = `Bagian ${this.currentStep + 1} dari ${totalSteps}`;
      this.progressPct.textContent = `${pct}%`;
      this.progressBar.style.width = `${pct}%`;
    } else {
      this.progressWrap.classList.add('hidden');
    }

    // Buttons Visibility
    if (isMultiStep) {
      if (this.currentStep === 0) {
        this.btnPrevStep.classList.add('hidden');
        this.btnNextStep.classList.remove('hidden');
        this.btnSubmitResponse.classList.add('hidden');
      } else if (this.currentStep < totalSteps - 1) {
        this.btnPrevStep.classList.remove('hidden');
        this.btnNextStep.classList.remove('hidden');
        this.btnSubmitResponse.classList.add('hidden');
      } else {
        // Last step
        this.btnPrevStep.classList.remove('hidden');
        this.btnNextStep.classList.add('hidden');
        this.btnSubmitResponse.classList.remove('hidden');
      }
    } else {
      this.btnPrevStep.classList.add('hidden');
      this.btnNextStep.classList.add('hidden');
      this.btnSubmitResponse.classList.remove('hidden');
    }

    // Render questions for current section
    this.questionsContainer.innerHTML = '';

    // If step > 0 in multi-step form, render Section Header Card
    if (isMultiStep && this.currentStep > 0 && currentSec) {
      const secHeaderCard = document.createElement('div');
      secHeaderCard.className = 'glass-card live-section-header-card';
      secHeaderCard.innerHTML = `
        <div class="live-sec-badge">
          <i data-lucide="layers"></i>
          <span>Bagian ${this.currentStep + 1} dari ${totalSteps}</span>
        </div>
        <h2 class="live-sec-title">${this.interpolateText(currentSec.title || `Bagian ${this.currentStep + 1}`)}</h2>
        ${currentSec.description ? `<p class="live-sec-desc">${this.interpolateText(currentSec.description)}</p>` : ''}
      `;
      this.questionsContainer.appendChild(secHeaderCard);
    }

    // If collectEmail is enabled and we are on step 0 (Section 1), render standard Email Collector card at top
    if (this.currentForm.collectEmail && this.currentStep === 0) {
      const emailCard = document.createElement('div');
      emailCard.className = 'live-question-card glass-card live-email-card';
      emailCard.id = 'live-email-card';
      emailCard.innerHTML = `
        <div class="live-q-header">
          <div class="live-q-title">
            Email <span class="live-q-required-mark">*</span>
          </div>
          <div class="live-email-hint">Alamat email pengisi formulir</div>
        </div>
        <div class="live-email-input-wrap">
          <input type="email" id="live-respondent-email" class="input-text live-input-text" placeholder="nama@email.com" autocomplete="email" required value="${this.escapeHtml(this.respondentEmail || '')}">
        </div>
      `;
      this.questionsContainer.appendChild(emailCard);
    }

    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    if (stepQuestions.length === 0 && !(this.currentForm.collectEmail && this.currentStep === 0)) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'glass-card';
      emptyNotice.style.padding = '24px';
      emptyNotice.style.textAlign = 'center';
      emptyNotice.style.color = 'var(--text-muted)';
      emptyNotice.innerHTML = '<p>Tidak ada pertanyaan pada bagian ini.</p>';
      this.questionsContainer.appendChild(emptyNotice);
    } else {
      stepQuestions.forEach((q, index) => {
        const card = this.renderQuestionItem(q, index);
        this.questionsContainer.appendChild(card);
      });
    }

    // Restore previously saved answers for this step
    this.restoreAnswersForCurrentStep(stepQuestions);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderQuestionItem(q, index) {
    const card = document.createElement('div');
    card.className = 'live-question-card glass-card';
    card.dataset.questionId = q.id;

    let inputHtml = '';
    const qName = `q_${q.id}`;

    if (q.type === 'paragraph') {
      inputHtml = `
        <textarea class="live-input-textarea" name="${qName}" placeholder="Ketik jawaban Anda..." rows="3"></textarea>
      `;
    } else if (q.type === 'choice') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <div class="live-options-group">
          ${options.map(opt => {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            const optImg = typeof opt === 'object' ? (opt.imageUrl || '') : '';
            return `
              <label class="live-choice-label ${optImg ? 'has-opt-img' : ''}">
                <input type="radio" name="${qName}" value="${this.escapeHtml(optText)}">
                <span class="custom-radio"></span>
                <div class="choice-content-wrap">
                  ${optImg ? `
                    <div class="live-opt-img-box">
                      <img src="${this.escapeHtml(optImg)}" alt="${this.escapeHtml(optText)}" class="live-opt-img" loading="lazy">
                    </div>
                  ` : ''}
                  <span class="choice-text">${this.escapeHtml(optText)}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'checkbox') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <div class="live-options-group">
          ${options.map(opt => {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            const optImg = typeof opt === 'object' ? (opt.imageUrl || '') : '';
            return `
              <label class="live-choice-label custom-checkbox-label ${optImg ? 'has-opt-img' : ''}">
                <input type="checkbox" name="${qName}" value="${this.escapeHtml(optText)}">
                <span class="custom-box"></span>
                <div class="choice-content-wrap">
                  ${optImg ? `
                    <div class="live-opt-img-box">
                      <img src="${this.escapeHtml(optImg)}" alt="${this.escapeHtml(optText)}" class="live-opt-img" loading="lazy">
                    </div>
                  ` : ''}
                  <span class="choice-text">${this.escapeHtml(optText)}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'dropdown') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <div class="searchable-select-wrap" data-question-id="${q.id}">
          <div class="searchable-select-trigger" tabindex="0">
            <span class="trigger-text is-placeholder">-- Cari / Pilih Jawaban --</span>
            <i data-lucide="chevron-down" class="trigger-icon"></i>
          </div>
          <div class="searchable-dropdown-menu">
            <div class="searchable-search-box">
              <i data-lucide="search"></i>
              <input type="text" class="searchable-search-input" placeholder="Ketik 2-3 huruf untuk mencari...">
            </div>
            <div class="searchable-options-list">
              ${options.map((opt, optIdx) => {
                const optText = typeof opt === 'object' ? (opt.text || '') : opt;
                return `<div class="searchable-option-item" data-value="${this.escapeHtml(optText)}">${this.escapeHtml(optText)}</div>`;
              }).join('')}
              <div class="searchable-empty-hint hidden">Tidak ada opsi yang cocok</div>
            </div>
          </div>
          <select class="live-select hidden" name="${qName}" style="display:none;">
            <option value="">-- Pilih Jawaban --</option>
            ${options.map(opt => {
              const optText = typeof opt === 'object' ? (opt.text || '') : opt;
              return `<option value="${this.escapeHtml(optText)}">${this.escapeHtml(optText)}</option>`;
            }).join('')}
          </select>
        </div>
      `;
    } else if (q.type === 'rating') {
      inputHtml = `
        <div class="live-rating-group" data-name="${qName}">
          ${[1, 2, 3, 4, 5].map(val => `
            <button type="button" class="rating-star-btn" data-value="${val}" title="${val} Bintang">
              <i data-lucide="star"></i>
            </button>
          `).join('')}
          <input type="hidden" name="${qName}" value="">
        </div>
      `;
    } else if (q.type === 'date') {
      inputHtml = `
        <input type="date" class="live-input-text" name="${qName}">
      `;
    } else if (q.type === 'location') {
      inputHtml = `
        <div class="live-location-picker" data-question-id="${q.id}">
          <div class="location-action-bar">
            <button type="button" class="btn btn-secondary btn-detect-gps" id="btn-gps-${q.id}">
              <i data-lucide="navigation"></i>
              <span class="btn-gps-text">Ambil Titik Lokasi GPS Rumah</span>
            </button>
            <div class="gps-searching-indicator hidden">
              <span class="pulse-dot"></span>
              <span>Mencari sinyal satelit GPS...</span>
            </div>
          </div>

          <div class="location-result-card hidden" id="gps-result-${q.id}">
            <div class="location-coords-badge">
              <div class="coords-icon-wrap">
                <i data-lucide="map-pin"></i>
              </div>
              <div class="coords-info">
                <div class="coords-title">Titik Koordinat Terekam</div>
                <strong class="coords-latlng">-</strong>
                <div class="coords-accuracy-tag">Akurasi: ± - m</div>
              </div>
            </div>
            <div class="location-map-actions">
              <a href="#" target="_blank" class="btn btn-secondary btn-xs btn-open-gmaps" title="Buka Titik Koordinat di Google Maps">
                <i data-lucide="external-link"></i>
                <span>Lihat di Google Maps</span>
              </a>
              <button type="button" class="btn btn-ghost btn-xs text-danger btn-reset-gps" title="Ulangi Deteksi Lokasi">
                <i data-lucide="rotate-ccw"></i>
                <span>Ulangi Ambil Lokasi</span>
              </button>
            </div>
          </div>
          <input type="hidden" name="${qName}" class="input-gps-hidden" value="">
        </div>
      `;
    } else if (q.type === 'file_gdrive') {
      const allowed = q.allowedTypes || 'all';
      const maxSizeMB = q.maxSizeMB || 10;
      
      let typeLabel = 'Semua Jenis Berkas';
      let acceptAttr = '';
      if (allowed === 'document') {
        typeLabel = 'Dokumen & PDF (.pdf, .docx, .xlsx, .pptx, .txt)';
        acceptAttr = 'accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"';
      } else if (allowed === 'pdf') {
        typeLabel = 'Dokumen PDF (.pdf)';
        acceptAttr = 'accept=".pdf,application/pdf"';
      } else if (allowed === 'image') {
        typeLabel = 'Gambar / Foto (.jpg, .png, .webp, .jpeg)';
        acceptAttr = 'accept="image/*"';
      } else if (allowed === 'archive') {
        typeLabel = 'Berkas Arsip / ZIP (.zip, .rar, .7z)';
        acceptAttr = 'accept=".zip,.rar,.7z,.tar,.gz"';
      } else if (allowed === 'media') {
        typeLabel = 'Audio & Video (.mp3, .mp4, .wav, .mov)';
        acceptAttr = 'accept="audio/*,video/*"';
      }

      inputHtml = `
        <div class="live-gdrive-uploader" data-question-id="${q.id}">
          <div class="gdrive-dropzone-box" id="gdrive-dropzone-${q.id}">
            <div class="gdrive-dropzone-icon-wrap">
              <i data-lucide="hard-drive" class="gdrive-dropzone-icon"></i>
            </div>
            <div class="gdrive-dropzone-label">Pilih atau Tarik Berkas ke Sini</div>
            <div class="gdrive-dropzone-sub">
              <span class="gdrive-type-badge">${this.escapeHtml(typeLabel)}</span>
              <span class="gdrive-size-badge">Maks ${maxSizeMB} MB</span>
            </div>
            <input type="file" class="input-gdrive-file" ${acceptAttr} style="display:none;">
          </div>

          <div class="gdrive-file-preview hidden" id="gdrive-preview-${q.id}">
            <div class="gdrive-preview-left">
              <div class="gdrive-file-icon">
                <i data-lucide="file-check"></i>
              </div>
              <div class="gdrive-file-meta">
                <strong class="gdrive-file-name">-</strong>
                <span class="gdrive-file-size">-</span>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-xs text-danger btn-remove-gdrive-file" title="Hapus Berkas">
              <i data-lucide="trash-2"></i>
              <span>Hapus</span>
            </button>
          </div>
          <input type="hidden" name="${qName}" class="input-gdrive-hidden" value="">
        </div>
      `;
    } else if (q.type === 'file') {
      inputHtml = `
        <div class="live-file-uploader" data-question-id="${q.id}">
          <div class="file-dropzone-box" id="dropzone-${q.id}">
            <i data-lucide="camera" class="file-dropzone-icon"></i>
            <div class="file-dropzone-label">Ambil Foto / Pilih File Berkas</div>
            <div class="file-dropzone-sub">Format JPG, PNG, WEBP (Otomatis dikompresi)</div>
            <input type="file" class="input-file-element" accept="image/*" style="display:none;">
          </div>
          <div class="file-preview-card hidden" id="file-preview-${q.id}">
            <div class="file-preview-left">
              <img src="" alt="Thumbnail File" class="file-thumb-img">
              <div class="file-meta-info">
                <span class="file-meta-name">Foto Terlampir</span>
                <span class="file-meta-size">Tersimpan</span>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-xs text-danger btn-remove-file" title="Hapus Foto">
              <i data-lucide="trash-2"></i>
              <span>Hapus</span>
            </button>
          </div>
          <input type="hidden" name="${qName}" class="input-file-hidden" value="">
        </div>
      `;
    } else if (q.type === 'signature') {
      inputHtml = `
        <div class="live-signature-wrap" data-question-id="${q.id}">
          <div class="signature-pad-box" id="signature-box-${q.id}">
            <canvas class="signature-canvas" width="480" height="160"></canvas>
            <div class="signature-placeholder">
              <i data-lucide="pen-tool"></i>
              <span>Bubuhkan tanda tangan di sini...</span>
            </div>
          </div>
          <div class="signature-actions-row">
            <span class="signature-status-tag">Gunakan jari di layar sentuh HP atau mouse</span>
            <button type="button" class="btn btn-ghost btn-xs btn-clear-signature" title="Hapus dan ulangi tanda tangan">
              <i data-lucide="rotate-ccw"></i>
              <span>Hapus / Ulangi Tanda Tangan</span>
            </button>
          </div>
          <input type="hidden" name="${qName}" class="input-signature-hidden" value="">
        </div>
      `;
    } else if (q.type === 'time') {
      inputHtml = `
        <input type="time" class="live-input-text" name="${qName}">
      `;
    } else if (q.type === 'number') {
      inputHtml = `
        <input type="number" class="live-input-text" name="${qName}" placeholder="Ketik angka...">
      `;
    } else {
      // Default: text
      inputHtml = `
        <input type="text" class="live-input-text" name="${qName}" placeholder="Ketik jawaban singkat...">
      `;
    }

    card.innerHTML = `
      <div class="live-q-header">
        <label class="live-q-title">
          ${this.interpolateText(q.title || `Pertanyaan ${index + 1}`)}
          ${q.required ? '<span class="live-q-required-mark">*</span>' : ''}
        </label>
      </div>
      ${q.imageUrl ? `
        <div class="live-q-image-container">
          <img src="${this.escapeHtml(q.imageUrl)}" alt="${this.escapeHtml(q.title || 'Ilustrasi Soal')}" class="live-q-image" loading="lazy">
        </div>
      ` : ''}
      <div class="live-q-body">
        ${inputHtml}
      </div>
      <div class="error-msg">Pertanyaan ini wajib diisi.</div>
    `;

    // Google Drive File Uploader Handler
    if (q.type === 'file_gdrive') {
      const dropzone = card.querySelector('.gdrive-dropzone-box');
      const fileInput = card.querySelector('.input-gdrive-file');
      const previewCard = card.querySelector('.gdrive-file-preview');
      const fileNameEl = card.querySelector('.gdrive-file-name');
      const fileSizeEl = card.querySelector('.gdrive-file-size');
      const btnRemove = card.querySelector('.btn-remove-gdrive-file');
      const hiddenInput = card.querySelector('.input-gdrive-hidden');
      const maxSizeMB = q.maxSizeMB || 10;

      const processSelectedFile = (file) => {
        if (!file) return;

        // 1. Validate file size
        const maxBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
          if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(`Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimum ${maxSizeMB} MB!`, 'error');
          }
          if (fileInput) fileInput.value = '';
          return;
        }

        // 2. Validate file type if specified
        const allowed = q.allowedTypes || 'all';
        if (allowed === 'pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          window.app.showToast('Hanya berkas format PDF (.pdf) yang diizinkan!', 'error');
          if (fileInput) fileInput.value = '';
          return;
        }

        // Store file object in memory ready for upload
        if (!this.pendingGdriveFiles) this.pendingGdriveFiles = {};
        this.pendingGdriveFiles[q.id] = file;
        this.answers[q.id] = {
          name: file.name,
          size: file.size,
          type: file.type,
          pending: true
        };

        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) {
          const sizeStr = file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            : `${(file.size / 1024).toFixed(0)} KB`;
          fileSizeEl.textContent = `${sizeStr} • Siap diunggah`;
        }
        if (hiddenInput) hiddenInput.value = file.name;

        if (dropzone) dropzone.classList.add('hidden');
        if (previewCard) previewCard.classList.remove('hidden');
        card.classList.remove('has-error');

        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast(`Berkas "${file.name}" berhasil dipilih!`, 'success');
        }
        if (window.lucide) window.lucide.createIcons();
      };

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => {
          dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-over');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processSelectedFile(e.dataTransfer.files[0]);
          }
        });

        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            processSelectedFile(e.target.files[0]);
          }
        });
      }

      if (btnRemove) {
        btnRemove.addEventListener('click', () => {
          if (this.pendingGdriveFiles) delete this.pendingGdriveFiles[q.id];
          delete this.answers[q.id];
          if (hiddenInput) hiddenInput.value = '';
          if (fileInput) fileInput.value = '';
          if (previewCard) previewCard.classList.add('hidden');
          if (dropzone) dropzone.classList.remove('hidden');
        });
      }
    }

    // File / Photo Upload Handler
    if (q.type === 'file') {
      const dropzone = card.querySelector('.file-dropzone-box');
      const fileInput = card.querySelector('.input-file-element');
      const previewCard = card.querySelector('.file-preview-card');
      const thumbImg = card.querySelector('.file-thumb-img');
      const metaSize = card.querySelector('.file-meta-size');
      const btnRemove = card.querySelector('.btn-remove-file');
      const hiddenInput = card.querySelector('.input-file-hidden');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast('Mengompresi & mengunggah foto...', 'info');
            }
            try {
              const formId = this.currentForm ? this.currentForm.id : 'form_upload';
              const result = await window.imageUploader.processAndUpload(file, {
                formId,
                context: 'submission',
                maxWidth: 1200,
                quality: 0.85
              });
              this.answers[q.id] = result.url;
              hiddenInput.value = result.url;
              thumbImg.src = result.url;
              metaSize.textContent = `${(result.size / 1024).toFixed(0)} KB (Tersimpan)`;
              previewCard.classList.remove('hidden');
              dropzone.classList.add('hidden');
              card.classList.remove('has-error');
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast('Foto berhasil dilampirkan!', 'success');
              }
              if (window.lucide) window.lucide.createIcons();
            } catch (uploadErr) {
              console.error(uploadErr);
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast('Gagal memproses foto: ' + uploadErr.message, 'error');
              }
            }
          }
        });
      }

      if (btnRemove) {
        btnRemove.addEventListener('click', () => {
          delete this.answers[q.id];
          hiddenInput.value = '';
          if (fileInput) fileInput.value = '';
          thumbImg.src = '';
          previewCard.classList.add('hidden');
          dropzone.classList.remove('hidden');
        });
      }
    }

    // Digital Signature Canvas Handler
    if (q.type === 'signature') {
      const canvas = card.querySelector('.signature-canvas');
      const placeholder = card.querySelector('.signature-placeholder');
      const btnClear = card.querySelector('.btn-clear-signature');
      const hiddenInput = card.querySelector('.input-signature-hidden');

      if (canvas) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let hasDrawn = false;

        // Set high-DPI scaling
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = (rect.width || 480) * dpr;
        canvas.height = (rect.height || 160) * dpr;
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getPos = (e) => {
          const bcr = canvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          return {
            x: clientX - bcr.left,
            y: clientY - bcr.top
          };
        };

        const startDraw = (e) => {
          isDrawing = true;
          hasDrawn = true;
          if (placeholder) placeholder.style.display = 'none';
          card.classList.remove('has-error');
          const p = getPos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        };

        const draw = (e) => {
          if (!isDrawing) return;
          const p = getPos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        };

        const endDraw = () => {
          if (isDrawing && hasDrawn) {
            isDrawing = false;
            const sigData = canvas.toDataURL('image/png');
            this.answers[q.id] = sigData;
            hiddenInput.value = sigData;
          }
        };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', endDraw);

        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', endDraw);

        if (btnClear) {
          btnClear.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasDrawn = false;
            delete this.answers[q.id];
            hiddenInput.value = '';
            if (placeholder) placeholder.style.display = 'flex';
          });
        }
      }
    }

    // Location / GPS Capture Handler
    if (q.type === 'location') {
      const btnDetect = card.querySelector('.btn-detect-gps');
      const btnGpsText = card.querySelector('.btn-gps-text');
      const indicator = card.querySelector('.gps-searching-indicator');
      const resultCard = card.querySelector('.location-result-card');
      const coordsText = card.querySelector('.coords-latlng');
      const accuracyTag = card.querySelector('.coords-accuracy-tag');
      const btnGmaps = card.querySelector('.btn-open-gmaps');
      const btnResetGps = card.querySelector('.btn-reset-gps');
      const hiddenInput = card.querySelector('.input-gps-hidden');

      const applyLocationData = (locData) => {
        if (!locData || !locData.lat) return;
        this.answers[q.id] = locData;
        hiddenInput.value = JSON.stringify(locData);
        coordsText.textContent = `${locData.lat.toFixed(6)}, ${locData.lng.toFixed(6)}`;
        accuracyTag.textContent = `Akurasi GPS: ± ${Math.round(locData.accuracy || 0)} meter`;
        btnGmaps.href = locData.mapsUrl || `https://www.google.com/maps?q=${locData.lat},${locData.lng}`;
        resultCard.classList.remove('hidden');
        btnDetect.classList.add('hidden');
        card.classList.remove('has-error');
        if (window.lucide) window.lucide.createIcons();
      };

      if (btnDetect) {
        btnDetect.addEventListener('click', () => {
          if (!navigator.geolocation) {
            alert('Perangkat atau browser Anda tidak mendukung fitur Geolocation GPS.');
            return;
          }

          btnDetect.disabled = true;
          if (btnGpsText) btnGpsText.textContent = 'Mendeteksi koordinat...';
          if (indicator) indicator.classList.remove('hidden');

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              btnDetect.disabled = false;
              if (btnGpsText) btnGpsText.textContent = 'Ambil Titik Lokasi GPS Rumah';
              if (indicator) indicator.classList.add('hidden');

              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const accuracy = pos.coords.accuracy;
              const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

              const locData = {
                lat,
                lng,
                accuracy,
                mapsUrl,
                capturedAt: new Date().toISOString()
              };

              applyLocationData(locData);
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast(`Lokasi GPS berhasil terekam (Akurasi: ±${Math.round(accuracy)}m)`, 'success');
              }
            },
            (err) => {
              btnDetect.disabled = false;
              if (btnGpsText) btnGpsText.textContent = 'Ambil Titik Lokasi GPS Rumah';
              if (indicator) indicator.classList.add('hidden');

              let errorMsg = 'Gagal mengakses GPS.';
              switch (err.code) {
                case err.PERMISSION_DENIED:
                  errorMsg = 'Izin akses lokasi ditolak. Silakan izinkan akses lokasi/GPS pada pengaturan browser atau HP Anda.';
                  break;
                case err.POSITION_UNAVAILABLE:
                  errorMsg = 'Informasi lokasi GPS tidak tersedia. Pastikan fitur Lokasi di HP Anda telah aktif.';
                  break;
                case err.TIMEOUT:
                  errorMsg = 'Waktu permintaan GPS habis. Silakan coba tekan tombol ambil lokasi kembali.';
                  break;
              }
              alert(errorMsg);
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast(errorMsg, 'error');
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0
            }
          );
        });
      }

      if (btnResetGps) {
        btnResetGps.addEventListener('click', () => {
          delete this.answers[q.id];
          hiddenInput.value = '';
          resultCard.classList.add('hidden');
          btnDetect.classList.remove('hidden');
        });
      }
    }

    // Handle Rating click
    if (q.type === 'rating') {
      const ratingGroup = card.querySelector('.live-rating-group');
      const starBtns = ratingGroup.querySelectorAll('.rating-star-btn');
      const hiddenInput = ratingGroup.querySelector('input[type="hidden"]');

      starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.value, 10);
          hiddenInput.value = val;
          this.answers[q.id] = val;

          starBtns.forEach(s => {
            const sVal = parseInt(s.dataset.value, 10);
            s.classList.toggle('active', sVal <= val);
          });
          card.classList.remove('has-error');
        });
      });
    }

    // Input listeners to clear error state and sync answers
    card.querySelectorAll('input, select, textarea').forEach(input => {
      input.addEventListener('change', () => {
        card.classList.remove('has-error');
      });
      input.addEventListener('input', () => {
        card.classList.remove('has-error');
      });
    });

    
    // Searchable Select Interactive Binding
    if (q.type === 'dropdown') {
      const wrap = card.querySelector('.searchable-select-wrap');
      if (wrap) {
        const trigger = wrap.querySelector('.searchable-select-trigger');
        const triggerText = wrap.querySelector('.trigger-text');
        const searchInput = wrap.querySelector('.searchable-search-input');
        const optionsList = wrap.querySelector('.searchable-options-list');
        const optionItems = wrap.querySelectorAll('.searchable-option-item');
        const emptyHint = wrap.querySelector('.searchable-empty-hint');
        const hiddenSelect = wrap.querySelector('select.live-select');

        // Preload answer if already answered
        if (this.answers[q.id]) {
          triggerText.textContent = this.answers[q.id];
          triggerText.classList.remove('is-placeholder');
          optionItems.forEach(item => {
            if (item.dataset.value === this.answers[q.id]) {
              item.classList.add('is-selected');
            }
          });
        }

        // Toggle open/close
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = wrap.classList.contains('is-open');
          document.querySelectorAll('.searchable-select-wrap').forEach(w => w.classList.remove('is-open'));
          if (!isOpen) {
            wrap.classList.add('is-open');
            searchInput.value = '';
            optionItems.forEach(item => item.style.display = '');
            if (emptyHint) emptyHint.classList.add('hidden');
            setTimeout(() => {
              searchInput.focus();
              wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 60);
          }
        });

        // Search live filter
        searchInput.addEventListener('input', (e) => {
          const keyword = e.target.value.toLowerCase().trim();
          let matchCount = 0;
          optionItems.forEach(item => {
            const text = (item.dataset.value || '').toLowerCase();
            if (text.includes(keyword)) {
              item.style.display = '';
              matchCount++;
            } else {
              item.style.display = 'none';
            }
          });
          if (emptyHint) {
            emptyHint.classList.toggle('hidden', matchCount > 0);
          }
        });

        searchInput.addEventListener('click', (e) => e.stopPropagation());

        // Option click
        optionItems.forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = item.dataset.value;
            triggerText.textContent = val;
            triggerText.classList.remove('is-placeholder');
            optionItems.forEach(i => i.classList.remove('is-selected'));
            item.classList.add('is-selected');
            if (hiddenSelect) {
              hiddenSelect.value = val;
            }
            this.answers[q.id] = val;
            wrap.classList.remove('is-open');
            card.classList.remove('has-error');
          });
        });

        // Close on outside click
        document.addEventListener('click', () => {
          wrap.classList.remove('is-open');
        });
      }
    }

    return card;
  }

  restoreAnswersForCurrentStep(questions) {
    questions.forEach(q => {
      const savedVal = this.answers[q.id];
      if (savedVal === undefined || savedVal === null) return;

      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      if (!qCard) return;
      const qName = `q_${q.id}`;

      if (q.type === 'location') {
        const coordsText = qCard.querySelector('.coords-latlng');
        const accuracyTag = qCard.querySelector('.coords-accuracy-tag');
        const btnGmaps = qCard.querySelector('.btn-open-gmaps');
        const resultCard = qCard.querySelector('.location-result-card');
        const btnDetect = qCard.querySelector('.btn-detect-gps');
        const hiddenInput = qCard.querySelector('.input-gps-hidden');

        if (coordsText && typeof savedVal === 'object' && savedVal.lat) {
          coordsText.textContent = `${savedVal.lat.toFixed(6)}, ${savedVal.lng.toFixed(6)}`;
          if (accuracyTag) accuracyTag.textContent = `Akurasi GPS: ± ${Math.round(savedVal.accuracy || 0)} meter`;
          if (btnGmaps) btnGmaps.href = savedVal.mapsUrl || `https://www.google.com/maps?q=${savedVal.lat},${savedVal.lng}`;
          if (hiddenInput) hiddenInput.value = JSON.stringify(savedVal);
          if (resultCard) resultCard.classList.remove('hidden');
          if (btnDetect) btnDetect.classList.add('hidden');
          if (window.lucide) window.lucide.createIcons();
        }
      } else if (q.type === 'file_gdrive') {
        const previewCard = qCard.querySelector('.gdrive-file-preview');
        const dropzone = qCard.querySelector('.gdrive-dropzone-box');
        const fileNameEl = qCard.querySelector('.gdrive-file-name');
        const fileSizeEl = qCard.querySelector('.gdrive-file-size');
        const hiddenInput = qCard.querySelector('.input-gdrive-hidden');

        if (savedVal) {
          const name = typeof savedVal === 'object' ? (savedVal.name || savedVal.fileName || 'Berkas Terlampir') : String(savedVal);
          const size = typeof savedVal === 'object' && savedVal.size ? `${(savedVal.size / 1024).toFixed(0)} KB` : 'Siap';
          if (fileNameEl) fileNameEl.textContent = name;
          if (fileSizeEl) fileSizeEl.textContent = `${size} • Terlampir`;
          if (hiddenInput) hiddenInput.value = name;
          if (previewCard) previewCard.classList.remove('hidden');
          if (dropzone) dropzone.classList.add('hidden');
          if (window.lucide) window.lucide.createIcons();
        }
      } else if (q.type === 'file') {
        const previewCard = qCard.querySelector('.file-preview-card');
        const dropzone = qCard.querySelector('.file-dropzone-box');
        const thumbImg = qCard.querySelector('.file-thumb-img');
        const hiddenInput = qCard.querySelector('.input-file-hidden');
        if (savedVal && typeof savedVal === 'string') {
          if (thumbImg) thumbImg.src = savedVal;
          if (hiddenInput) hiddenInput.value = savedVal;
          if (previewCard) previewCard.classList.remove('hidden');
          if (dropzone) dropzone.classList.add('hidden');
        }
      } else if (q.type === 'signature') {
        const canvas = qCard.querySelector('.signature-canvas');
        const placeholder = qCard.querySelector('.signature-placeholder');
        const hiddenInput = qCard.querySelector('.input-signature-hidden');
        if (savedVal && typeof savedVal === 'string' && canvas) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = savedVal;
          if (placeholder) placeholder.style.display = 'none';
          if (hiddenInput) hiddenInput.value = savedVal;
        }
      } else if (q.type === 'choice') {
        const radio = qCard.querySelector(`input[name="${qName}"][value="${CSS.escape(savedVal)}"]`);
        if (radio) radio.checked = true;
      } else if (q.type === 'checkbox' && Array.isArray(savedVal)) {
        savedVal.forEach(v => {
          const cb = qCard.querySelector(`input[name="${qName}"][value="${CSS.escape(v)}"]`);
          if (cb) cb.checked = true;
        });
      } else if (q.type === 'rating') {
        const hiddenInput = qCard.querySelector(`input[name="${qName}"]`);
        if (hiddenInput) hiddenInput.value = savedVal;
        const starBtns = qCard.querySelectorAll('.rating-star-btn');
        starBtns.forEach(s => {
          const sVal = parseInt(s.dataset.value, 10);
          s.classList.toggle('active', sVal <= savedVal);
        });
      } else {
        const input = qCard.querySelector(`[name="${qName}"]`);
        if (input) input.value = savedVal;
      }
    });
  }

  collectCurrentStepAnswers() {
    let isValid = true;
    let firstErrorElement = null;
    const currentSec = this.sections[this.currentStep] || this.sections[0];
    const isMultiStep = this.sections.length > 1;
    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    // Validate email if collectEmail is true on step 0
    if (this.currentForm.collectEmail && this.currentStep === 0) {
      const emailInput = document.getElementById('live-respondent-email');
      const emailCard = document.getElementById('live-email-card');
      const emailVal = emailInput ? emailInput.value.trim() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailVal || !emailRegex.test(emailVal)) {
        isValid = false;
        if (emailCard) {
          emailCard.classList.add('has-error');
          if (!firstErrorElement) firstErrorElement = emailCard;
        }
      } else {
        if (emailCard) emailCard.classList.remove('has-error');
        this.respondentEmail = emailVal;
        this.answers._respondent_email = emailVal;
      }
    }

    stepQuestions.forEach(q => {
      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      if (!qCard) return;
      const qName = `q_${q.id}`;
      let val = null;

      if (q.type === 'choice') {
        const checked = qCard.querySelector(`input[name="${qName}"]:checked`);
        val = checked ? checked.value : '';
      } else if (q.type === 'checkbox') {
        const checkedList = qCard.querySelectorAll(`input[name="${qName}"]:checked`);
        val = Array.from(checkedList).map(el => el.value);
        if (val.length === 0) val = [];
      } else if (q.type === 'location' || q.type === 'rating' || q.type === 'file' || q.type === 'signature') {
        val = this.answers[q.id] || null;
      } else {
        const input = qCard.querySelector(`[name="${qName}"]`);
        val = input ? input.value.trim() : '';
      }

      // Validate required
      let isEmpty = false;
      if (q.required) {
        if (q.type === 'location' && (!val || !val.lat)) {
          isEmpty = true;
        } else if (q.type === 'checkbox' && (!val || val.length === 0)) {
          isEmpty = true;
        } else if ((q.type === 'file' || q.type === 'signature' || q.type === 'rating') && !val) {
          isEmpty = true;
        } else if (!val || val === '') {
          isEmpty = true;
        }
      }

      if (isEmpty) {
        isValid = false;
        qCard.classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = qCard;
      } else {
        qCard.classList.remove('has-error');
      }

      this.answers[q.id] = val;
    });

    if (!isValid && firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (firstErrorElement.id === 'live-email-card') {
        window.app.showToast('Harap masukkan alamat email yang valid', 'error');
        const emailInput = document.getElementById('live-respondent-email');
        if (emailInput) emailInput.focus();
      } else {
        window.app.showToast('Harap lengkapi semua pertanyaan wajib pada bagian ini', 'error');
      }
      return false;
    }

    return true;
  }

  handleNextStep() {
    if (!this.collectCurrentStepAnswers()) return;

    const currentSec = this.sections[this.currentStep] || this.sections[0];
    const isMultiStep = this.sections.length > 1;
    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    let branchAction = 'next';

    // Check questions in current step for choice / dropdown logic jumps
    for (const q of stepQuestions) {
      if ((q.type === 'choice' || q.type === 'dropdown') && q.options && q.options.length > 0) {
        const ansVal = this.answers[q.id];
        if (ansVal) {
          const matchedOpt = q.options.find(opt => {
            const text = typeof opt === 'object' ? opt.text : opt;
            return text === ansVal;
          });

          if (matchedOpt && typeof matchedOpt === 'object' && matchedOpt.nextSectionId && matchedOpt.nextSectionId !== 'next') {
            branchAction = matchedOpt.nextSectionId;
            break;
          }
        }
      }
    }

    if (branchAction === 'submit') {
      this.handleSubmit();
      return;
    }

    let nextStepIndex = this.currentStep + 1;
    if (branchAction !== 'next') {
      const targetIdx = this.sections.findIndex(s => s.id === branchAction);
      if (targetIdx !== -1) {
        nextStepIndex = targetIdx;
      }
    }

    if (nextStepIndex < this.sections.length) {
      if (!this.historyStack) this.historyStack = [0];
      this.historyStack.push(nextStepIndex);
      this.currentStep = nextStepIndex;
      this.renderCurrentStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Reached the end
      this.handleSubmit();
    }
  }

  handlePrevStep() {
    // Save current step data without strict required validation when navigating back
    const currentSec = this.sections[this.currentStep] || this.sections[0];
    const isMultiStep = this.sections.length > 1;
    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    stepQuestions.forEach(q => {
      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      if (!qCard) return;
      const qName = `q_${q.id}`;
      if (q.type === 'choice') {
        const checked = qCard.querySelector(`input[name="${qName}"]:checked`);
        if (checked) this.answers[q.id] = checked.value;
      } else if (q.type === 'checkbox') {
        const checkedList = qCard.querySelectorAll(`input[name="${qName}"]:checked`);
        this.answers[q.id] = Array.from(checkedList).map(el => el.value);
      } else if (q.type !== 'rating') {
        const input = qCard.querySelector(`[name="${qName}"]`);
        if (input) this.answers[q.id] = input.value.trim();
      }
    });

    if (!this.historyStack) this.historyStack = [0];

    if (this.historyStack.length > 1) {
      this.historyStack.pop();
      this.currentStep = this.historyStack[this.historyStack.length - 1];
      this.renderCurrentStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (this.currentStep > 0) {
      this.currentStep--;
      this.renderCurrentStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async handleSubmit() {
    if (!this.collectCurrentStepAnswers()) return;

    const btnSubmit = document.getElementById('btn-submit-response');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Mengirim tanggapan...</span>';

    try {
      // 1. Upload any pending Google Drive files
      if (this.pendingGdriveFiles && Object.keys(this.pendingGdriveFiles).length > 0) {
        const gdriveKeys = Object.keys(this.pendingGdriveFiles);
        btnSubmit.innerHTML = `<span class="pulse-dot" style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%; margin-right:6px;"></span><span>Mengunggah berkas ke Google Drive (${gdriveKeys.length} berkas)...</span>`;
        
        for (const qId of gdriveKeys) {
          const file = this.pendingGdriveFiles[qId];
          if (file) {
            try {
              const qObj = (this.currentForm.questions || []).find(item => item.id === qId);
              const result = await window.gdriveUploader.uploadToGoogleDrive(file, {
                scriptUrl: this.currentForm.gdriveScriptUrl || '',
                folderId: this.currentForm.gdriveFolderId || '',
                formId: this.currentForm.id,
                formTitle: this.currentForm.title || 'Formulir Respon',
                questionTitle: qObj ? qObj.title : 'File'
              });
              this.answers[qId] = {
                name: result.name || file.name,
                size: result.size || file.size,
                type: result.type || file.type,
                url: result.url,
                storage: result.storage
              };
            } catch (errUpload) {
              console.error('GDrive upload error:', errUpload);
            }
          }
        }
      }

      
      // Auto-Grading for Quiz Mode
      if (this.currentForm.isQuizMode === true) {
        let earnedScore = 0;
        let totalPossible = 0;
        const questionResults = [];

        (this.currentForm.questions || []).forEach(q => {
          const points = q.points !== undefined ? q.points : 10;
          totalPossible += points;
          const userAns = this.answers[q.id];
          let isCorrect = false;

          if (q.type === 'checkbox') {
            const correctArr = Array.isArray(q.correctAnswers) ? q.correctAnswers : (q.correctAnswer ? [q.correctAnswer] : []);
            const userArr = Array.isArray(userAns) ? userAns : (userAns ? [userAns] : []);
            isCorrect = correctArr.length > 0 && correctArr.length === userArr.length && correctArr.every(v => userArr.includes(v));
          } else if (q.type === 'choice' || q.type === 'dropdown' || q.type === 'text' || q.type === 'number') {
            isCorrect = q.correctAnswer && userAns && (String(userAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase());
          }

          if (isCorrect) {
            earnedScore += points;
          }

          questionResults.push({
            qId: q.id,
            title: q.title || 'Soal',
            type: q.type,
            userAns: Array.isArray(userAns) ? userAns.join(', ') : (userAns || '-'),
            correctAns: Array.isArray(q.correctAnswers) ? q.correctAnswers.join(', ') : (q.correctAnswer || '-'),
            isCorrect,
            points,
            earned: isCorrect ? points : 0
          });
        });

        const percentage = totalPossible > 0 ? Math.round((earnedScore / totalPossible) * 100) : 0;
        this.answers._quiz_score = earnedScore;
        this.answers._quiz_total = totalPossible;
        this.answers._quiz_percentage = percentage;

        // Render Quiz Scorecard on Success screen
        let scoreCard = document.getElementById('quiz-result-score-card');
        if (!scoreCard) {
          scoreCard = document.createElement('div');
          scoreCard.id = 'quiz-result-score-card';
          const successContent = this.successCard.querySelector('.success-card-content') || this.successCard;
          successContent.insertBefore(scoreCard, this.successCard.querySelector('.success-actions') || null);
        }

        const showScore = this.currentForm.showQuizScore !== false;
        const showAnswers = this.currentForm.showQuizAnswers !== false;

        if (showScore) {
          let scoreMsg = '🎉 Luar Biasa! Nilai Anda Sangat Baik.';
          if (percentage < 50) scoreMsg = '📝 Teruslah Belajar & Berlatih!';
          else if (percentage < 75) scoreMsg = '👍 Bagus! Nilai Anda Cukup Baik.';

          scoreCard.innerHTML = `
            <div class="quiz-results-card">
              <div class="quiz-score-header"><i data-lucide="award"></i> Hasil Nilai Kuis Anda</div>
              <div class="quiz-score-circle">
                <span class="quiz-score-num">${earnedScore}</span>
                <span class="quiz-score-max">dari ${totalPossible} poin</span>
              </div>
              <div class="quiz-score-msg">${scoreMsg} (Persentase: ${percentage}%)</div>
              
              ${showAnswers ? `
                <div class="quiz-review-list">
                  ${questionResults.map(r => `
                    <div class="quiz-review-item ${r.isCorrect ? 'is-correct' : 'is-wrong'}">
                      <div class="quiz-review-q-title">${this.escapeHtml(r.title)} (${r.earned}/${r.points} Poin)</div>
                      <div class="quiz-review-ans-row user-ans">Jawaban Anda: <strong>${this.escapeHtml(r.userAns)}</strong> ${r.isCorrect ? '✅ Benar' : '❌ Salah'}</div>
                      ${!r.isCorrect ? `<div class="quiz-review-ans-row correct-ans">Kunci Jawaban Benar: <strong>${this.escapeHtml(r.correctAns)}</strong></div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
          scoreCard.classList.remove('hidden');
          if (window.lucide) window.lucide.createIcons();
        }
      }

      // 2. Submit to Firebase / Storage
      await window.formStorage.submitResponse(this.currentForm.id, this.answers, this.respondentEmail);
      
      // Clear pending files
      this.pendingGdriveFiles = {};

      // Show success screen
      this.formElement.classList.add('hidden');
      this.successCard.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.app.showToast('Tanggapan berhasil dikirim!', 'success');
    } catch (err) {
      console.error(err);
      window.app.showToast('Gagal mengirim tanggapan: ' + err.message, 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  }

  resetAnswers() {
    this.formElement.reset();
    this.answers = {};
    this.respondentEmail = '';
    this.currentStep = 0;
    this.historyStack = [0];
    this.renderCurrentStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  printSubmissionReceipt() {
    if (!this.currentForm) return;

    const receiptNo = 'REG-' + Date.now().toString().slice(-6);
    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const questions = this.currentForm.questions || [];

    let rowsHtml = '';
    let photoHtml = '';
    let signatureHtml = '';
    let gpsHtml = '';

    questions.forEach(q => {
      const val = this.answers[q.id];
      if (val === undefined || val === null || val === '') return;

      if (q.type === 'file' && typeof val === 'string') {
        photoHtml += `
          <div style="margin-top: 10px; text-align: center;">
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">${this.escapeHtml(q.title)}</div>
            <img src="${this.escapeHtml(val)}" style="width: 120px; height: 150px; object-fit: cover; border: 1px solid #cbd5e1; border-radius: 4px;">
          </div>
        `;
      } else if (q.type === 'signature' && typeof val === 'string') {
        signatureHtml = `
          <div style="text-align: center; width: 200px;">
            <div style="font-size: 12px; margin-bottom: 4px; color: #475569;">Tanda Tangan Pengisi:</div>
            <img src="${this.escapeHtml(val)}" style="max-width: 180px; max-height: 70px; border-bottom: 1px solid #0f172a;">
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">( ${this.answers._respondent_email || 'Wali Siswa / Responden'} )</div>
          </div>
        `;
      } else if (q.type === 'location' && typeof val === 'object' && val.lat) {
        gpsHtml = `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%; background: #f8fafc;">${this.escapeHtml(q.title)}</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">
              <div><strong>Koordinat GPS:</strong> ${val.lat.toFixed(6)}, ${val.lng.toFixed(6)}</div>
              <div style="font-size: 12px; color: #10b981;">Akurasi Satelit: ± ${Math.round(val.accuracy || 0)} meter</div>
              <div style="font-size: 11px; color: #3b82f6; margin-top: 2px;">Tautan Peta: https://www.google.com/maps?q=${val.lat},${val.lng}</div>
            </td>
          </tr>
        `;
      } else if (q.type === 'file_gdrive') {
        let fileObj = val;
        if (typeof fileObj === 'string' && fileObj.startsWith('{')) {
          try { fileObj = JSON.parse(fileObj); } catch(e){}
        }
        let url = typeof fileObj === 'object' ? (fileObj.url || fileObj.viewUrl || '') : (String(fileObj).startsWith('http') ? fileObj : '');
        let name = typeof fileObj === 'object' ? (fileObj.name || fileObj.fileName || 'Lihat Dokumen di Google Drive') : fileObj;
        
        rowsHtml += `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%; background: #f8fafc;">${this.escapeHtml(q.title)}</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">
              <div>📁 <strong>${this.escapeHtml(name)}</strong></div>
              ${url ? `<div style="font-size: 11px; color: #2563eb; margin-top: 2px; word-break: break-all;">Link Google Drive: ${this.escapeHtml(url)}</div>` : ''}
            </td>
          </tr>
        `;
      } else {
        let display = '';
        if (Array.isArray(val)) {
          display = val.join(', ');
        } else {
          display = String(val);
        }
        rowsHtml += `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%; background: #f8fafc;">${this.escapeHtml(q.title)}</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${this.escapeHtml(display)}</td>
          </tr>
        `;
      }
    });

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Bukti Pengisian - ${this.escapeHtml(this.currentForm.title)}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 13px; }
          .receipt-box { border: 2px solid #0f172a; padding: 20px; border-radius: 8px; max-width: 800px; margin: auto; }
          .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title-area { text-align: center; }
          .title-area h2 { margin: 0 0 4px 0; font-size: 18px; text-transform: uppercase; }
          .title-area p { margin: 0; font-size: 12px; color: #475569; }
          .meta-bar { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 14px; background: #f1f5f9; padding: 8px 12px; border-radius: 4px; }
          table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12.5px; }
          .footer-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 12px; }
          .stamp-box { border: 1px dashed #94a3b8; padding: 8px 16px; font-size: 11px; color: #64748b; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header-table">
            <div class="title-area">
              <h2>${this.escapeHtml(this.currentForm.title || 'LEMBAR BUKTI PENGISIAN BIODATA')}</h2>
              <p>Sistem Formulir Online & Perekaman Data Resmi • FormCraft</p>
            </div>
          </div>

          <div class="meta-bar">
            <div><strong>No. Registrasi:</strong> ${receiptNo}</div>
            <div><strong>Waktu Pengisian:</strong> ${today}</div>
            <div><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">TERVERIFIKASI SISTEM</span></div>
          </div>

          <div style="display: flex; gap: 20px; align-items: flex-start;">
            <div style="flex: 1;">
              <table class="data-table">
                <tbody>
                  ${rowsHtml}
                  ${gpsHtml}
                </tbody>
              </table>
            </div>
            ${photoHtml ? `<div style="width: 130px; flex-shrink: 0;">${photoHtml}</div>` : ''}
          </div>

          <div class="footer-section">
            <div class="stamp-box">
              <strong>Tanda Bukti Sah Elektronik</strong><br>
              Dokumen ini dicetak otomatis dan diakui secara sah oleh pihak sekolah/penyelenggara.
            </div>
            ${signatureHtml}
          </div>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 300);
          };
        <\/script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    } else {
      alert('Mohon izinkan popup browser untuk membuka lembar cetak bukti pengisian.');
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

window.FormViewer = FormViewer;
