/**
 * FORMCRAFT - Main Application Controller & Hash Router
 * Orchestrates navigation, dashboard rendering, modal dialogues, and theme toggling.
 */

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.initControllers();
    this.initModals();
    this.initTheme();
    this.bindEvents();
    this.handleRoute();
  }

  initControllers() {
    try {
      this.builder = typeof FormBuilder !== 'undefined' ? new FormBuilder() : null;
    } catch (e) {
      console.error('[App] Error initializing FormBuilder:', e);
      this.builder = null;
    }

    try {
      this.viewer = typeof FormViewer !== 'undefined' ? new FormViewer() : null;
    } catch (e) {
      console.error('[App] Error initializing FormViewer:', e);
      this.viewer = null;
    }

    try {
      this.responsesDashboard = typeof ResponsesDashboard !== 'undefined' ? new ResponsesDashboard() : null;
    } catch (e) {
      console.error('[App] Error initializing ResponsesDashboard:', e);
      this.responsesDashboard = null;
    }
  }

  bindEvents() {
    // Hash Routing Listener
    window.addEventListener('hashchange', () => this.handleRoute());

    // Nav Builder Link (Create Blank Form)
    const navBuilder = document.getElementById('nav-builder');
    if (navBuilder) {
      navBuilder.addEventListener('click', (e) => {
        e.preventDefault();
        this.createNewForm();
      });
    }

    // Search on Dashboard
    const searchInput = document.getElementById('dashboard-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterDashboardForms(e.target.value.toLowerCase().trim());
      });
    }
  }

  createNewForm() {
    if (window.location.hash === '#/builder' || window.location.hash === '#/builder/') {
      this.showSection('view-builder');
      const navBuilder = document.getElementById('nav-builder');
      if (navBuilder) navBuilder.classList.add('active');
      if (this.builder) this.builder.loadForm(null);
    } else {
      window.location.hash = '#/builder';
    }
  }

  createWhatsAppSurveyTemplate() {
    window.location.hash = '#/builder/template-whatsapp-pendataan';
  }

  createStudentBioTemplate() {
    window.location.hash = '#/builder/template-biodata';
  }

  // --- SPA HASH ROUTING ---

  handleRoute() {
    // 0. Auto-detect respondent query parameters (e.g. form.html?id=... or ?form=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('id') || urlParams.get('form') || urlParams.get('view') || urlParams.get('formId') || urlParams.get('formid');
      if (queryId && (!window.location.hash || !window.location.hash.toLowerCase().includes('view/'))) {
        window.location.hash = `#/view/${encodeURIComponent(queryId.trim())}`;
        return;
      }
    } catch (e) {
      console.warn('URL search params parse notice:', e);
    }

    const rawHash = (window.location.hash || '').trim();
    let decodedHash = rawHash;
    try {
      decodedHash = decodeURIComponent(rawHash);
    } catch (e) {
      decodedHash = rawHash;
    }

    // Default to dashboard only if hash is completely empty
    const hashToParse = decodedHash || '#/dashboard';
    const parts = hashToParse.replace(/^#\/?/, '').split('/');
    const route = (parts[0] || 'dashboard').toLowerCase();
    
    // Clean and sanitize param: remove query strings (?utm=...), fragments (#), and trailing slashes
    let param = parts.slice(1).join('/');
    if (param) {
      param = param.split('?')[0].split('&')[0].split('#')[0].replace(/\/+$/, '').trim();
    } else {
      param = null;
    }

    const mainNav = document.getElementById('main-nav');
    const previewAdminBar = document.getElementById('preview-admin-bar');
    const navDashboard = document.getElementById('nav-dashboard');
    const navBuilder = document.getElementById('nav-builder');

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    // Reset body route mode classes
    document.body.classList.remove('mode-dashboard', 'mode-builder', 'mode-responses', 'responder-mode');

    if (route === 'dashboard' || route === '') {
      document.body.classList.add('mode-dashboard');
      // Auto-save form if currently open in builder
      if (this.builder && this.builder.currentForm) {
        try { this.builder.saveCurrentForm(true); } catch (e) {}
      }
      if (mainNav) mainNav.style.display = '';
      if (previewAdminBar) previewAdminBar.classList.add('hidden');

      this.showSection('view-dashboard');
      if (navDashboard) navDashboard.classList.add('active');
      this.loadDashboard();
    } else if (route === 'builder') {
      document.body.classList.add('mode-builder');
      if (mainNav) mainNav.style.display = '';
      if (previewAdminBar) previewAdminBar.classList.add('hidden');

      this.showSection('view-builder');
      if (navBuilder) navBuilder.classList.add('active');
      if (this.builder) {
        if (param === 'template-biodata') {
          this.builder.loadStudentBioTemplate();
        } else if (param === 'template-whatsapp-pendataan' || param === 'template-wa') {
          this.builder.loadWhatsAppSurveyTemplate();
        } else {
          this.builder.loadForm(param);
        }
      }
    } else if (route === 'view' || route === 'form') {
      document.body.classList.add('responder-mode');
      if (mainNav) mainNav.style.display = 'none';

      // If viewing user is the logged in admin, show subtle floating preview bar
      const isOwner = window.authManager && window.authManager.isLoggedIn();
      if (previewAdminBar) {
        if (isOwner) {
          previewAdminBar.classList.remove('hidden');
          const btnBackEdit = document.getElementById('btn-preview-back-editor');
          if (btnBackEdit) {
            btnBackEdit.onclick = () => {
              window.location.hash = `#/builder/${param || ''}`;
            };
          }
        } else {
          previewAdminBar.classList.add('hidden');
        }
      }

      this.showSection('view-form');
      if (this.viewer) this.viewer.loadForm(param);
    } else if (route === 'responses') {
      document.body.classList.add('mode-responses');
      if (mainNav) mainNav.style.display = '';
      if (previewAdminBar) previewAdminBar.classList.add('hidden');

      this.showSection('view-responses');
      if (this.responsesDashboard) {
        if (typeof this.responsesDashboard.loadDashboard === 'function') {
          this.responsesDashboard.loadDashboard(param);
        } else if (typeof this.responsesDashboard.loadResponses === 'function') {
          this.responsesDashboard.loadResponses(param);
        }
      }
    } else {
      // For unauthenticated respondents, NEVER bounce to #/dashboard (which forces login redirect)
      const isAuthUser = window.authManager && window.authManager.isLoggedIn();
      if (!isAuthUser) {
        this.showSection('view-form');
        if (this.viewer) {
          this.viewer.renderFormNotFound('Halaman atau tautan formulir yang Anda tuju tidak valid.');
        }
      } else {
        window.location.hash = '#/dashboard';
      }
    }

    // Re-initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  showSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- DASHBOARD LOGIC ---

  async loadDashboard() {
    const forms = await window.formStorage.getAllForms();
    this.allDashboardForms = forms;
    this.renderDashboardStats(forms);
    this.renderDashboardForms(forms);
  }

  renderDashboardStats(forms) {
    const statForms = document.getElementById('stat-total-forms');
    const statResp = document.getElementById('stat-total-responses');

    const totalForms = forms.length;
    let totalResponses = 0;
    forms.forEach(f => {
      totalResponses += (f.responseCount || 0);
    });

    if (statForms) statForms.textContent = totalForms;
    if (statResp) statResp.textContent = totalResponses;
  }

  renderDashboardForms(forms) {
    const grid = document.getElementById('forms-grid');
    const emptyState = document.getElementById('forms-empty-state');
    const countLabel = document.getElementById('dashboard-forms-count-label');

    if (!grid || !emptyState) return;

    if (countLabel) {
      countLabel.textContent = forms.length > 0 ? (forms.length + ' Formulir Tersimpan') : 'Belum ada formulir';
    }

    if (forms.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    forms.forEach(form => {
      const card = document.createElement('div');
      card.className = 'form-item-card glass-card';
      const color = form.themeColor || '#6366f1';

      const dateStr = form.updatedAt ? new Date(form.updatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : 'Baru saja';

      const isQuiz = form.isQuizMode === true;
      const hasDeadline = !!form.deadline;
      const isActive = form.isActive !== false;
      const isPublished = form.isPublished !== false;

      card.innerHTML = `
        <div class="form-card-top-accent" style="background: ${color};"></div>
        
        <div>
          <div class="form-card-badge-row">
            ${isQuiz ? '<span class="card-feature-pill quiz"><i data-lucide="award" style="width:12px;height:12px;"></i> Mode Kuis</span>' : ''}
            ${hasDeadline ? '<span class="card-feature-pill deadline"><i data-lucide="clock" style="width:12px;height:12px;"></i> Batas Waktu</span>' : ''}
            <div class="card-status-tag" style="color: ${!isPublished ? '#fbbf24' : (isActive ? '#10b981' : '#94a3b8')};">
              <span class="status-dot ${!isPublished ? 'draft' : (isActive ? 'active' : 'inactive')}"></span>
              <span>${!isPublished ? 'Draft' : (isActive ? 'Published' : 'Nonaktif')}</span>
            </div>
          </div>

          <h3 class="form-item-title">${this.escapeHtml(form.title || 'Formulir Tanpa Judul')}</h3>
          <p class="form-item-desc">${this.escapeHtml(form.description || 'Tidak ada deskripsi formulir.')}</p>
        </div>

        <div class="form-item-meta">
          <div class="meta-responses-badge" title="Jumlah Tanggapan Responden">
            <i data-lucide="users" style="width: 14px; height: 14px;"></i>
            <span>${form.responseCount || 0} Respon</span>
          </div>
          <div class="meta-date">
            ${dateStr}
          </div>
        </div>

        <div class="form-item-actions">
          <div class="form-item-main-btns">
            <button class="btn btn-secondary btn-sm btn-action-view" title="Isi Formulir">
              <i data-lucide="eye"></i>
              <span>Isi Form</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-action-resp" title="Lihat Data Respon & Excel">
              <i data-lucide="bar-chart-2"></i>
              <span>Respon</span>
            </button>
          </div>
          <div class="card-icon-actions">
            <button class="btn btn-ghost btn-sm btn-action-copy" title="Duplikat / Salin Formulir Ini">
              <i data-lucide="copy"></i>
            </button>
            <button class="btn btn-ghost btn-sm btn-action-edit" title="Edit Pertanyaan">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn btn-ghost btn-sm btn-action-share" title="Bagikan & QR Code">
              <i data-lucide="share-2"></i>
            </button>
            <button class="btn btn-ghost btn-sm text-danger btn-action-del" title="Hapus Form">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;

      // Card event listeners
      const btnCopy = card.querySelector('.btn-action-copy');
      if (btnCopy) {
        btnCopy.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.duplicateForm(form.id);
        });
      }

      card.querySelector('.btn-action-view').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = '#/view/' + form.id;
      });

      card.querySelector('.btn-action-resp').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = '#/responses/' + form.id;
      });

      card.querySelector('.btn-action-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = '#/builder/' + form.id;
      });

      card.querySelector('.btn-action-share').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openShareModal(form.id);
      });

      card.querySelector('.btn-action-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Apakah Anda yakin ingin menghapus formulir "' + form.title + '" beserta seluruh responnya?')) {
          await window.formStorage.deleteForm(form.id);
          this.showToast('Formulir berhasil dihapus', 'info');
          this.loadDashboard();
        }
      });

      // Clicking the card body opens builder
      card.addEventListener('click', () => {
        window.location.hash = '#/builder/' + form.id;
      });

      grid.appendChild(card);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  filterDashboardForms(query) {
    if (!this.allDashboardForms) return;
    if (!query) {
      this.renderDashboardForms(this.allDashboardForms);
      return;
    }
    const filtered = this.allDashboardForms.filter(f => {
      const titleMatch = f.title && f.title.toLowerCase().includes(query);
      const descMatch = f.description && f.description.toLowerCase().includes(query);
      return titleMatch || descMatch;
    });
    this.renderDashboardForms(filtered);
  }

  async duplicateForm(formId) {
    try {
      this.showToast('Sedang menduplikasi formulir...', 'info');
      const form = await window.formStorage.getFormById(formId);
      if (!form) {
        this.showToast('Formulir sumber tidak ditemukan', 'error');
        return;
      }

      // Deep clone form structure
      const newForm = JSON.parse(JSON.stringify(form));
      delete newForm.id;
      delete newForm._id;
      
      // Clean metadata and counter
      newForm.title = (newForm.title || 'Formulir') + ' (Salinan)';
      newForm.responseCount = 0;
      delete newForm.lastResponseAt;
      newForm.createdAt = new Date().toISOString();
      newForm.updatedAt = new Date().toISOString();

      // Ensure fresh unique IDs for sections and questions while strictly preserving branching logic
      const idMap = {};
      if (Array.isArray(newForm.sections)) {
        newForm.sections.forEach((sec, idx) => {
          const oldId = sec.id;
          const newId = 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) + '_' + (idx + 1);
          idMap[oldId] = newId;
          sec.id = newId;
        });

        newForm.sections.forEach(sec => {
          if (sec.nextSectionId && idMap[sec.nextSectionId]) {
            sec.nextSectionId = idMap[sec.nextSectionId];
          }
        });
      }

      if (Array.isArray(newForm.questions)) {
        newForm.questions.forEach((q, idx) => {
          q.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) + '_' + (idx + 1);
          if (q.sectionId && idMap[q.sectionId]) {
            q.sectionId = idMap[q.sectionId];
          }
          if (Array.isArray(q.options)) {
            q.options.forEach(opt => {
              if (opt && opt.nextSectionId && idMap[opt.nextSectionId]) {
                opt.nextSectionId = idMap[opt.nextSectionId];
              }
            });
          }
        });
      }

      const saved = await window.formStorage.saveForm(newForm);
      this.showToast('Formulir berhasil disalin!', 'success');
      await this.loadDashboard();
    } catch (err) {
      console.error('Gagal menduplikasi form:', err);
      this.showToast('Gagal menyalin formulir: ' + (err.message || 'Terjadi kesalahan'), 'error');
    }
  }

  // --- MODALS & SHARE ---

  initModals() {
    const modalShare = document.getElementById('modal-share');

    // Close share
    const btnCloseShare = document.getElementById('btn-close-share');
    if (btnCloseShare) {
      btnCloseShare.addEventListener('click', () => {
        if (modalShare) modalShare.classList.add('hidden');
      });
    }

    // Share Modal Copy URL Button
    const btnCopyShare = document.getElementById('btn-copy-share-url');
    if (btnCopyShare) {
      btnCopyShare.addEventListener('click', () => {
        const input = document.getElementById('share-link-input');
        if (input) {
          input.select();
          navigator.clipboard.writeText(input.value);
          this.showToast('Tautan formulir disalin ke clipboard!', 'success');
        }
      });
    }

    // Download QR Code Button
    const btnDownloadQr = document.getElementById('btn-download-qrcode');
    if (btnDownloadQr) {
      btnDownloadQr.addEventListener('click', () => {
        const qrContainer = document.getElementById('share-qrcode-container');
        const img = qrContainer ? qrContainer.querySelector('img, canvas') : null;
        if (img) {
          let dataUrl = '';
          if (img.tagName.toLowerCase() === 'canvas') {
            dataUrl = img.toDataURL('image/png');
          } else {
            dataUrl = img.src;
          }
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `qrcode_form_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          this.showToast('QR Code berhasil diunduh!', 'success');
        }
      });
    }
  }

  openShareModal(formId) {
    const modal = document.getElementById('modal-share');
    const input = document.getElementById('share-link-input');
    const openLink = document.getElementById('share-open-link');
    const btnWhatsApp = document.getElementById('btn-share-whatsapp');
    const qrContainer = document.getElementById('share-qrcode-container');

    // Clean and validate formId
    const cleanId = String(formId || '').trim();

    // Build URL ensuring it accurately targets form.html without admin query params or index.html
    const loc = window.location;
    let pathname = loc.pathname;
    if (!pathname.toLowerCase().endsWith('form.html')) {
      pathname = pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '') + '/form.html';
    }
    const fullShareUrl = `${loc.origin}${pathname}#/view/${encodeURIComponent(cleanId)}`;

    if (input) input.value = fullShareUrl;
    if (openLink) openLink.href = fullShareUrl;

    // WhatsApp text
    const formTitle = (this.dashboardForms && this.dashboardForms.find(f => f.id === cleanId)?.title) || 'Formulir Online';
    const waText = `Halo! Silakan mengisi *${formTitle}* melalui tautan berikut:\n\n${fullShareUrl}`;
    if (btnWhatsApp) {
      btnWhatsApp.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    }

    // Render QR Code
    if (qrContainer) {
      qrContainer.innerHTML = '';
      if (window.QRCode) {
        try {
          new QRCode(qrContainer, {
            text: fullShareUrl,
            width: 140,
            height: 140,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        } catch (e) {
          console.warn('QRCode error, fallback to SVG:', e);
          qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(fullShareUrl)}" width="140" height="140" alt="QR Code">`;
        }
      } else {
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(fullShareUrl)}" width="140" height="140" alt="QR Code">`;
      }
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // --- THEME TOGGLING ---

  initTheme() {
    const savedTheme = localStorage.getItem('formcraft_theme') || 'dark';
    document.body.className = savedTheme === 'light' ? 'theme-light' : 'theme-dark';
    this.updateThemeIcon(savedTheme);

    const btnToggle = document.getElementById('btn-theme-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('theme-dark');
        const nextTheme = isDark ? 'light' : 'dark';
        document.body.className = nextTheme === 'light' ? 'theme-light' : 'theme-dark';
        localStorage.setItem('formcraft_theme', nextTheme);
        this.updateThemeIcon(nextTheme);
      });
    }
  }

  updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // --- TOAST NOTIFICATIONS ---

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
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

// Robust Bootstrap Application
function initFormcraftApp() {
  if (!window.app) {
    window.app = new App();
    console.log('[Formcraft] Application initialized successfully.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFormcraftApp);
} else {
  initFormcraftApp();
}
