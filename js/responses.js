/**
 * FORMCRAFT - Responses Dashboard & Table Engine
 * Handles data presentation, search/filter, and individual response detail viewer.
 * Automatically consolidates questions with the same field name into a single column.
 */

class ResponsesDashboard {
  constructor() {
    this.currentForm = null;
    this.responses = [];
    this.filteredResponses = [];

    // DOM Elements
    this.titleEl = document.getElementById('responses-form-title');
    this.subtitleEl = document.getElementById('responses-subtitle');
    this.statTotal = document.getElementById('stat-resp-total');
    this.statLatest = document.getElementById('stat-resp-latest');
    this.statRate = document.getElementById('stat-resp-rate');

    this.searchInput = document.getElementById('input-search-responses');
    this.tableHead = document.getElementById('responses-table-head');
    this.tableBody = document.getElementById('responses-table-body');
    this.emptyTable = document.getElementById('table-empty-state');

    this.btnExportExcel = document.getElementById('btn-export-excel');
    this.btnExportCsv = document.getElementById('btn-export-csv');

    this.initEvents();
  }

  getConsolidatedColumns(rawQuestions) {
    const consolidated = [];
    const map = new Map();

    (rawQuestions || []).forEach((q, idx) => {
      const rawTitle = (q.title || ('Pertanyaan ' + (idx + 1))).trim();
      const key = rawTitle.toLowerCase();

      if (map.has(key)) {
        const existing = consolidated[map.get(key)];
        existing.questionIds.push(q.id);
        if (!existing.types.includes(q.type)) {
          existing.types.push(q.type);
        }
        existing.questions.push(q);
      } else {
        const entry = {
          title: rawTitle,
          type: q.type,
          types: [q.type],
          questionIds: [q.id],
          questions: [q],
          required: q.required
        };
        map.set(key, consolidated.length);
        consolidated.push(entry);
      }
    });

    return consolidated;
  }

  initEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          this.filteredResponses = [...this.responses];
        } else {
          this.filteredResponses = this.responses.filter(resp => {
            const dateStr = resp.submittedAt ? new Date(resp.submittedAt).toLocaleDateString('id-ID') : '';
            const emailStr = (resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || '').toLowerCase();
            const answersStr = resp.answers ? JSON.stringify(Object.values(resp.answers)).toLowerCase() : '';
            return dateStr.includes(query) || emailStr.includes(query) || answersStr.includes(query);
          });
        }
        this.renderTableRows();
      });
    }

    if (this.btnExportExcel) {
      this.btnExportExcel.addEventListener('click', () => {
        if (!this.currentForm || this.responses.length === 0) {
          if (window.app) window.app.showToast('Tidak ada data respon untuk diekspor ke Excel', 'error');
          return;
        }
        window.ExcelExporter.exportFormResponses(this.currentForm, this.responses);
      });
    }

    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        this.exportToCsv();
      });
    }
  }

  async loadResponses(formId) {
    if (!formId) {
      window.location.hash = '#/dashboard';
      return;
    }

    const form = await window.formStorage.getForm(formId);
    if (!form) {
      window.app.showToast('Formulir tidak ditemukan', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentForm = form;
    this.titleEl.textContent = form.title || 'Ringkasan Respon';

    // Load responses
    this.responses = await window.formStorage.getResponsesByFormId(formId);
    this.filteredResponses = [...this.responses];

    this.renderStats();
    this.renderTable();
  }

  renderStats() {
    const count = this.responses.length;
    this.subtitleEl.textContent = `${count} Tanggapan`;
    this.statTotal.textContent = count;

    if (count > 0 && this.responses[0].submittedAt) {
      const date = new Date(this.responses[0].submittedAt);
      this.statLatest.textContent = date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      this.statLatest.textContent = '-';
    }

    this.statRate.textContent = this.currentForm.isActive !== false ? 'Aktif' : 'Nonaktif';
  }

  renderTable() {
    const form = this.currentForm;
    const questions = form.questions || [];
    const columns = this.getConsolidatedColumns(questions);
    const hasEmail = form.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));

    // 1. Render Table Headers
    let headHtml = `
      <tr>
        <th style="width: 50px;">#</th>
        <th style="min-width: 150px;">Waktu Kirim</th>
        ${hasEmail ? '<th style="min-width: 180px;">Email Responden</th>' : ''}
    `;

    columns.forEach(col => {
      headHtml += `<th title="${this.escapeHtml(col.title)}">${this.escapeHtml(col.title)}</th>`;
    });

    headHtml += `</tr>`;
    this.tableHead.innerHTML = headHtml;

    // 2. Render Rows
    this.renderTableRows();
  }

  renderTableRows() {
    const questions = this.currentForm.questions || [];
    const columns = this.getConsolidatedColumns(questions);
    const count = this.filteredResponses.length;
    const hasEmail = this.currentForm.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));

    if (count === 0) {
      this.tableBody.innerHTML = '';
      this.emptyTable.classList.remove('hidden');
      return;
    }

    this.emptyTable.classList.add('hidden');
    let bodyHtml = '';

    this.filteredResponses.forEach((resp, index) => {
      const dateStr = resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-';

      const emailStr = resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || '-';

      bodyHtml += `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td style="color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</td>
          ${hasEmail ? `<td style="font-weight: 500; color: #818cf8;">${this.escapeHtml(emailStr)}</td>` : ''}
      `;

      columns.forEach(col => {
        let ans = null;
        let activeQ = col.questions[0];

        for (const q of col.questions) {
          const val = resp.answers ? resp.answers[q.id] : null;
          if (val !== null && val !== undefined && val !== '') {
            ans = val;
            activeQ = q;
            break;
          }
        }

        let displayVal = '-';

        if (Array.isArray(ans)) {
          displayVal = this.escapeHtml(ans.join(', '));
        } else if (ans !== null && ans !== undefined && ans !== '') {
          if (activeQ.type === 'location') {
            let locObj = ans;
            if (typeof locObj === 'string' && locObj.startsWith('{')) {
              try { locObj = JSON.parse(locObj); } catch(e){}
            }
            if (locObj && typeof locObj === 'object' && locObj.lat) {
              const mapsUrl = locObj.mapsUrl || `https://www.google.com/maps?q=${locObj.lat},${locObj.lng}`;
              displayVal = `
                <a href="${mapsUrl}" target="_blank" class="table-gps-link" title="Buka Titik Rumah di Google Maps">
                  <i data-lucide="map-pin"></i>
                  <span>${locObj.lat.toFixed(5)}, ${locObj.lng.toFixed(5)}</span>
                </a>
              `;
            } else {
              displayVal = this.escapeHtml(String(ans));
            }
          } else if (activeQ.type === 'file_gdrive') {
            let fileObj = ans;
            if (typeof fileObj === 'string' && fileObj.startsWith('{')) {
              try { fileObj = JSON.parse(fileObj); } catch(e){}
            }
            let url = typeof fileObj === 'object' ? (fileObj.url || fileObj.viewUrl || '') : (String(fileObj).startsWith('http') ? fileObj : '');
            let name = typeof fileObj === 'object' ? (fileObj.name || fileObj.fileName || 'Berkas Google Drive') : String(fileObj);
            
            if (url) {
              displayVal = `
                <a href="${this.escapeHtml(url)}" target="_blank" class="btn btn-secondary btn-xs" style="color: #10b981; border-color: rgba(16, 185, 129, 0.3); font-weight: 500;" title="Buka berkas di Google Drive (${this.escapeHtml(name)})">
                  <i data-lucide="hard-drive" style="width:13px; height:13px;"></i>
                  <span>${this.escapeHtml(name.length > 20 ? name.substring(0, 18) + '...' : name)}</span>
                </a>
              `;
            } else {
              displayVal = `📁 ${this.escapeHtml(name)}`;
            }
          } else if (activeQ.type === 'file') {
            displayVal = `
              <a href="${this.escapeHtml(String(ans))}" target="_blank" class="btn btn-ghost btn-xs" style="color: var(--primary); text-decoration: underline;" title="Buka / Unduh Foto">
                <i data-lucide="image" style="width:13px; height:13px;"></i>
                <span>Lihat Foto</span>
              </a>
            `;
          } else if (activeQ.type === 'signature') {
            displayVal = `
              <a href="${this.escapeHtml(String(ans))}" target="_blank" class="btn btn-ghost btn-xs" style="color: var(--primary); text-decoration: underline;" title="Lihat Gambar Tanda Tangan">
                <i data-lucide="pen-tool" style="width:13px; height:13px;"></i>
                <span>Lihat TTD</span>
              </a>
            `;
          } else if (activeQ.type === 'rating') {
            displayVal = `⭐ ${ans} / 5`;
          } else {
            displayVal = this.escapeHtml(String(ans));
          }
        }

        bodyHtml += `<td title="${this.escapeHtml(typeof ans === 'object' ? JSON.stringify(ans) : String(ans || ''))}">${displayVal}</td>`;
      });

      bodyHtml += `</tr>`;
    });

    this.tableBody.innerHTML = bodyHtml;
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  exportToCsv() {
    if (!this.currentForm || this.responses.length === 0) {
      if (window.app) window.app.showToast('Tidak ada data respon untuk diekspor', 'error');
      return;
    }

    const hasEmail = this.currentForm.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));
    const columns = this.getConsolidatedColumns(this.currentForm.questions || []);

    const headers = ['No', 'ID Respon', 'Waktu Pengisian'];
    if (hasEmail) headers.push('Email Responden');
    columns.forEach(col => headers.push(col.title));

    const rows = [];
    rows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    this.responses.forEach((resp, idx) => {
      const row = [];
      row.push(idx + 1);
      row.push(resp.id || '-');
      row.push(resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('id-ID') : '-');
      if (hasEmail) {
        row.push(resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || '-');
      }

      columns.forEach(col => {
        let ans = null;
        for (const q of col.questions) {
          const val = resp.answers ? resp.answers[q.id] : null;
          if (val !== null && val !== undefined && val !== '') {
            ans = val;
            break;
          }
        }

        if (Array.isArray(ans)) {
          row.push(ans.join('; '));
        } else if (ans && typeof ans === 'object') {
          row.push(JSON.stringify(ans));
        } else {
          row.push(ans !== null && ans !== undefined ? String(ans) : '-');
        }
      });

      rows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filename = (this.currentForm.title || 'Respon_Form').toLowerCase().replace(/[^a-z0-9]/g, '_') + '_responses.csv';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.app) window.app.showToast('Data respon berhasil diexport ke CSV!', 'success');
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

window.ResponsesDashboard = ResponsesDashboard;
