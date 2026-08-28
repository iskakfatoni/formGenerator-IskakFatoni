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

    // DOM Elements with fallback support & null-safety
    this.titleEl = document.getElementById('resp-page-title') || document.getElementById('responses-form-title');
    this.subtitleEl = document.getElementById('resp-page-subtitle') || document.getElementById('responses-subtitle');
    this.statTotal = document.getElementById('resp-stat-total') || document.getElementById('stat-resp-total');
    this.statLatest = document.getElementById('resp-stat-latest') || document.getElementById('stat-resp-latest');
    this.statRate = document.getElementById('resp-stat-rate') || document.getElementById('stat-resp-rate');

    this.searchInput = document.getElementById('resp-search-input') || document.getElementById('input-search-responses');
    this.tableHead = document.getElementById('responses-table-head');
    this.tableBody = document.getElementById('responses-table-body');
    this.emptyTable = document.getElementById('responses-empty-table') || document.getElementById('table-empty-state');

    this.btnExportExcel = document.getElementById('btn-export-excel');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnClearAll = document.getElementById('btn-clear-all-responses');
    this.btnShare = document.getElementById('btn-copy-form-share');
    this.btnEditForm = document.getElementById('btn-edit-form-from-resp');

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

    if (this.btnClearAll) {
      this.btnClearAll.addEventListener('click', async () => {
        if (!this.currentForm || this.responses.length === 0) {
          if (window.app) window.app.showToast('Tidak ada respon untuk dihapus', 'info');
          return;
        }
        if (confirm('Apakah Anda yakin ingin menghapus seluruh data respon pada formulir ini? Tindakan ini tidak dapat dibatalkan.')) {
          try {
            if (window.formStorage && typeof window.formStorage.clearResponsesByFormId === 'function') {
              await window.formStorage.clearResponsesByFormId(this.currentForm.id);
            } else {
              for (const resp of this.responses) {
                if (resp.id && window.formStorage) {
                  await window.formStorage.deleteResponse(resp.id);
                }
              }
            }
            this.responses = [];
            this.filteredResponses = [];
            this.renderStats();
            this.renderTable();
            if (window.app) window.app.showToast('Seluruh respon berhasil dibersihkan', 'success');
          } catch(err) {
            console.error('Clear responses error:', err);
            if (window.app) window.app.showToast('Gagal menghapus respon: ' + err.message, 'error');
          }
        }
      });
    }

    if (this.btnShare) {
      this.btnShare.addEventListener('click', () => {
        if (this.currentForm && window.app && typeof window.app.openShareModal === 'function') {
          window.app.openShareModal(this.currentForm.id, this.currentForm.title);
        }
      });
    }

    if (this.btnEditForm) {
      this.btnEditForm.addEventListener('click', () => {
        if (this.currentForm && this.currentForm.id) {
          window.location.hash = '#/builder/' + this.currentForm.id;
        }
      });
    }
  }

  async loadDashboard(formId) {
    return this.loadResponses(formId);
  }

  async loadResponses(formId) {
    if (!formId) {
      window.location.hash = '#/dashboard';
      return;
    }

    // Refresh DOM element bindings when view opens
    this.titleEl = document.getElementById('resp-page-title') || document.getElementById('responses-form-title');
    this.subtitleEl = document.getElementById('resp-page-subtitle') || document.getElementById('responses-subtitle');
    this.statTotal = document.getElementById('resp-stat-total') || document.getElementById('stat-resp-total');
    this.statLatest = document.getElementById('resp-stat-latest') || document.getElementById('stat-resp-latest');
    this.statRate = document.getElementById('resp-stat-rate') || document.getElementById('stat-resp-rate');
    this.tableHead = document.getElementById('responses-table-head');
    this.tableBody = document.getElementById('responses-table-body');
    this.emptyTable = document.getElementById('responses-empty-table') || document.getElementById('table-empty-state');

    const form = window.formStorage.getFormById ? await window.formStorage.getFormById(formId) : await window.formStorage.getForm(formId);
    if (!form) {
      if (window.app) window.app.showToast('Formulir tidak ditemukan', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentForm = form;
    if (this.titleEl) this.titleEl.textContent = form.title || 'Ringkasan Respon';

    // Load responses
    this.responses = await window.formStorage.getResponsesByFormId(formId);
    this.filteredResponses = [...this.responses];

    this.renderStats();
    this.renderTable();
  }

  renderStats() {
    const count = this.responses.length;
    if (this.subtitleEl) this.subtitleEl.textContent = count + ' Tanggapan';
    if (this.statTotal) this.statTotal.textContent = count;

    if (count > 0 && this.responses[0].submittedAt) {
      const date = new Date(this.responses[0].submittedAt);
      if (this.statLatest) {
        this.statLatest.textContent = date.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } else {
      if (this.statLatest) this.statLatest.textContent = '-';
    }

    if (this.statRate) {
      this.statRate.textContent = (this.currentForm && this.currentForm.isActive !== false) ? 'Aktif' : 'Nonaktif';
    }
  }

  renderTable() {
    const form = this.currentForm;
    if (!form) return;

    if (!this.tableHead) this.tableHead = document.getElementById('responses-table-head');
    if (!this.tableBody) this.tableBody = document.getElementById('responses-table-body');
    if (!this.emptyTable) this.emptyTable = document.getElementById('responses-empty-table') || document.getElementById('table-empty-state');

    const questions = form.questions || [];
    const columns = this.getConsolidatedColumns(questions);
    const hasEmail = form.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));

    // 1. Render Table Headers
    const isQuiz = form.isQuizMode === true;
    let headHtml = '<tr><th style="width: 75px; text-align: center;">#</th><th style="min-width: 140px;">Waktu Kirim</th>' + (isQuiz ? '<th style="min-width: 130px; color: #818cf8;"><i data-lucide="award"></i> Nilai Kuis</th>' : '') + (hasEmail ? '<th style="min-width: 180px;">Email Responden</th>' : '');

    columns.forEach(col => {
      headHtml += '<th title="' + this.escapeHtml(col.title) + '">' + this.escapeHtml(col.title) + '</th>';
    });

    headHtml += '</tr>';
    if (this.tableHead) {
      this.tableHead.innerHTML = headHtml;
    }

    // 2. Render Rows
    this.renderTableRows();
  }

  renderTableRows() {
    const form = this.currentForm;
    if (!form) return;

    if (!this.tableBody) this.tableBody = document.getElementById('responses-table-body');
    if (!this.emptyTable) this.emptyTable = document.getElementById('responses-empty-table') || document.getElementById('table-empty-state');

    const questions = form.questions || [];
    const columns = this.getConsolidatedColumns(questions);
    const count = this.filteredResponses.length;
    const hasEmail = form.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));

    if (count === 0) {
      if (this.tableBody) this.tableBody.innerHTML = '';
      if (this.emptyTable) this.emptyTable.classList.remove('hidden');
      return;
    }

    if (this.emptyTable) this.emptyTable.classList.add('hidden');
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

      const isQuiz = this.currentForm.isQuizMode === true;
      let quizScoreBadge = '';
      if (isQuiz) {
        if (resp.answers && resp.answers._quiz_score !== undefined) {
          const score = resp.answers._quiz_score;
          const total = resp.answers._quiz_total || 100;
          const pct = resp.answers._quiz_percentage || Math.round((score / total) * 100);
          quizScoreBadge = '<td style="font-weight: 700; color: #818cf8;"><span style="background: rgba(99, 102, 241, 0.15); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.3);">' + score + ' / ' + total + ' (' + pct + '%)</span></td>';
        } else {
          quizScoreBadge = '<td style="color: var(--text-muted);">-</td>';
        }
      }

      const numWithPrintBtn = '<div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">' +
        '<span style="font-weight: 700; font-size: 0.9rem; min-width: 16px; text-align: right;">' + (index + 1) + '</span>' +
        '<button type="button" class="btn btn-secondary btn-icon-xs btn-print-pdf-receipt" data-index="' + index + '" title="Cetak Lembar Bukti PDF Responden #' + (index + 1) + '" style="padding: 3px 6px; border-radius: 6px; border-color: rgba(99, 102, 241, 0.35); color: #818cf8; background: rgba(99, 102, 241, 0.1); cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">' +
          '<i data-lucide="printer" style="width: 13px; height: 13px;"></i>' +
        '</button>' +
      '</div>';

      bodyHtml += '<tr><td style="text-align: center; white-space: nowrap;">' + numWithPrintBtn + '</td><td style="color: var(--text-secondary); font-size: 0.85rem;">' + dateStr + '</td>' + quizScoreBadge + (hasEmail ? '<td style="font-weight: 500; color: #818cf8;">' + this.escapeHtml(emailStr) + '</td>' : '');

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
              const mapsUrl = locObj.mapsUrl || ('https://www.google.com/maps?q=' + locObj.lat + ',' + locObj.lng);
              displayVal = '<a href="' + mapsUrl + '" target="_blank" class="table-gps-link" title="Buka Titik Rumah di Google Maps"><i data-lucide="map-pin"></i><span>' + locObj.lat.toFixed(5) + ', ' + locObj.lng.toFixed(5) + '</span></a>';
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
              displayVal = '<a href="' + this.escapeHtml(url) + '" target="_blank" class="btn btn-secondary btn-xs" style="color: #10b981; border-color: rgba(16, 185, 129, 0.3); font-weight: 500;" title="Buka berkas di Google Drive (' + this.escapeHtml(name) + ')"><i data-lucide="hard-drive" style="width:13px; height:13px;"></i><span>' + this.escapeHtml(name.length > 20 ? name.substring(0, 18) + '...' : name) + '</span></a>';
            } else {
              displayVal = '📁 ' + this.escapeHtml(name);
            }
          } else if (activeQ.type === 'file') {
            const rawUrl = String(ans);
            const previewSrc = this.escapeHtml(rawUrl);
            const qTitle = this.escapeHtml(activeQ.title || 'Foto Lampiran');
            displayVal = '<div class="table-img-cell" style="display: inline-flex; align-items: center; gap: 8px;">' +
              '<img src="' + previewSrc + '" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; background: rgba(0,0,0,0.1); flex-shrink: 0;" class="table-thumb-preview" data-src="' + previewSrc + '" data-title="' + qTitle + '" title="Klik untuk perbesar foto">' +
              '<button type="button" class="btn btn-secondary btn-xs btn-open-img-lightbox" data-src="' + previewSrc + '" data-title="' + qTitle + '" style="white-space: nowrap; gap: 4px; padding: 4px 8px; font-size: 0.78rem;">' +
                '<i data-lucide="eye" style="width:13px; height:13px;"></i><span>Lihat Foto</span>' +
              '</button>' +
            '</div>';
          } else if (activeQ.type === 'signature') {
            const rawUrl = String(ans);
            const previewSrc = this.escapeHtml(rawUrl);
            const qTitle = this.escapeHtml(activeQ.title || 'Tanda Tangan');
            displayVal = '<div class="table-img-cell" style="display: inline-flex; align-items: center; gap: 8px;">' +
              '<img src="' + previewSrc + '" style="width: 50px; height: 28px; object-fit: contain; background: #ffffff; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer; flex-shrink: 0;" class="table-thumb-preview" data-src="' + previewSrc + '" data-title="' + qTitle + '" title="Klik untuk perbesar tanda tangan">' +
              '<button type="button" class="btn btn-ghost btn-xs btn-open-img-lightbox" data-src="' + previewSrc + '" data-title="' + qTitle + '" style="white-space: nowrap; gap: 4px; padding: 4px 8px; font-size: 0.78rem; color: var(--primary);">' +
                '<i data-lucide="pen-tool" style="width:13px; height:13px;"></i><span>Lihat TTD</span>' +
              '</button>' +
            '</div>';
          } else if (activeQ.type === 'rating') {
            displayVal = '⭐ ' + ans + ' / 5';
          } else {
            displayVal = this.escapeHtml(String(ans));
          }
        }

        bodyHtml += '<td title="' + this.escapeHtml(typeof ans === 'object' ? JSON.stringify(ans) : String(ans || '')) + '">' + displayVal + '</td>';
      });

      bodyHtml += '</tr>';
    });

    if (this.tableBody) {
      this.tableBody.innerHTML = bodyHtml;

      // Bind Lightbox click events to avoid Chrome data: URL top-level block
      this.tableBody.querySelectorAll('.btn-open-img-lightbox, .table-thumb-preview').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const src = el.getAttribute('data-src');
          const title = el.getAttribute('data-title') || 'Pratinjau Foto';
          if (src) {
            this.showImageModal(src, title);
          }
        });
      });

      // Bind Print PDF Receipt buttons
      this.tableBody.querySelectorAll('.btn-print-pdf-receipt').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          if (!isNaN(idx) && this.filteredResponses[idx]) {
            this.printSubmissionReceipt(this.filteredResponses[idx]);
          }
        });
      });
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  printSubmissionReceipt(resp) {
    if (!this.currentForm || !resp) return;

    const receiptNo = 'REG-' + (resp.id ? resp.id.replace('resp_', '').slice(-6) : Date.now().toString().slice(-6)).toUpperCase();
    const today = resp.submittedAt ? new Date(resp.submittedAt).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleDateString('id-ID', { dateStyle: 'full', timeStyle: 'short' });

    const questions = this.currentForm.questions || [];
    const columns = this.getConsolidatedColumns(questions);

    let rowsHtml = '';
    let photoHtml = '';
    let signatureHtml = '';
    let gpsHtml = '';

    columns.forEach(col => {
      let val = null;
      let activeQ = col.questions[0];

      for (const q of col.questions) {
        const v = resp.answers ? resp.answers[q.id] : null;
        if (v !== null && v !== undefined && v !== '') {
          val = v;
          activeQ = q;
          break;
        }
      }

      if (val === undefined || val === null || val === '') return;

      if (activeQ.type === 'file' && typeof val === 'string') {
        photoHtml += `
          <div style="margin-top: 10px; text-align: center;">
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">${this.escapeHtml(col.title)}</div>
            <img src="${this.escapeHtml(val)}" style="width: 120px; height: 150px; object-fit: cover; border: 1px solid #cbd5e1; border-radius: 4px;">
          </div>
        `;
      } else if (activeQ.type === 'signature' && typeof val === 'string') {
        const respondentName = resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || 'Wali Siswa / Responden';
        signatureHtml = `
          <div style="text-align: center; width: 200px;">
            <div style="font-size: 12px; margin-bottom: 4px; color: #475569;">Tanda Tangan Pengisi:</div>
            <img src="${this.escapeHtml(val)}" style="max-width: 180px; max-height: 70px; border-bottom: 1px solid #0f172a;">
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">( ${this.escapeHtml(respondentName)} )</div>
          </div>
        `;
      } else if (activeQ.type === 'location') {
        let locObj = val;
        if (typeof locObj === 'string' && locObj.startsWith('{')) {
          try { locObj = JSON.parse(locObj); } catch(e){}
        }
        if (locObj && typeof locObj === 'object' && locObj.lat) {
          gpsHtml = `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%; background: #f8fafc;">${this.escapeHtml(col.title)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">
                <div><strong>Koordinat GPS:</strong> ${locObj.lat.toFixed(6)}, ${locObj.lng.toFixed(6)}</div>
                <div style="font-size: 12px; color: #10b981;">Akurasi Satelit: ± ${Math.round(locObj.accuracy || 0)} meter</div>
                <div style="font-size: 11px; color: #3b82f6; margin-top: 2px;">Tautan Peta: https://www.google.com/maps?q=${locObj.lat},${locObj.lng}</div>
              </td>
            </tr>
          `;
        }
      } else if (activeQ.type === 'file_gdrive') {
        let fileObj = val;
        if (typeof fileObj === 'string' && fileObj.startsWith('{')) {
          try { fileObj = JSON.parse(fileObj); } catch(e){}
        }
        let url = typeof fileObj === 'object' ? (fileObj.url || fileObj.viewUrl || '') : (String(fileObj).startsWith('http') ? fileObj : '');
        let name = typeof fileObj === 'object' ? (fileObj.name || fileObj.fileName || 'Lihat Dokumen di Google Drive') : fileObj;
        
        rowsHtml += `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%; background: #f8fafc;">${this.escapeHtml(col.title)}</td>
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
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 35%; background: #f8fafc;">${this.escapeHtml(col.title)}</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${this.escapeHtml(display)}</td>
          </tr>
        `;
      }
    });

    const isQuiz = this.currentForm.isQuizMode === true;
    let quizScoreBanner = '';
    if (isQuiz && resp.answers && resp.answers._quiz_score !== undefined) {
      const score = resp.answers._quiz_score;
      const total = resp.answers._quiz_total || 100;
      const pct = resp.answers._quiz_percentage || Math.round((score / total) * 100);
      quizScoreBanner = `
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 10px 16px; border-radius: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #4338ca;">HASIL EVALUASI / SKOR KUIS:</span>
          <span style="font-size: 16px; font-weight: 700; color: #4338ca;">${score} / ${total} (${pct}%)</span>
        </div>
      `;
    }

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
              <h2>${this.escapeHtml(this.currentForm.title || 'LEMBAR BUKTI PENGISIAN FORMULIR')}</h2>
              <p>Sistem Formulir Online & Perekaman Data Resmi • FormCraft</p>
            </div>
          </div>

          <div class="meta-bar">
            <div><strong>No. Registrasi:</strong> ${receiptNo}</div>
            <div><strong>Waktu Pengisian:</strong> ${today}</div>
            <div><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">TERVERIFIKASI SISTEM</span></div>
          </div>

          ${quizScoreBanner}

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
    }
  }

  showImageModal(imgSrc, title = 'Pratinjau Foto') {
    // Remove existing modal if any
    const existing = document.getElementById('modal-image-preview-global');
    if (existing) existing.remove();

    const isDataUrl = typeof imgSrc === 'string' && imgSrc.startsWith('data:image/');
    const isGdrive = typeof imgSrc === 'string' && imgSrc.includes('drive.google.com');

    const modal = document.createElement('div');
    modal.id = 'modal-image-preview-global';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal-card glass-card" style="max-width: 600px; width: 92%; padding: 20px; text-align: center;">
        <div class="modal-header" style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <div class="modal-title" style="font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="image" style="width: 18px; height: 18px; color: var(--primary);"></i>
            <span>${this.escapeHtml(title)}</span>
          </div>
          <button type="button" class="btn-close-modal btn-close-img-modal" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <div style="background: rgba(0,0,0,0.25); border-radius: 12px; padding: 10px; margin-bottom: 16px; max-height: 65vh; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border-color);">
          <img src="${this.escapeHtml(imgSrc)}" alt="Pratinjau Foto" style="max-width: 100%; max-height: 55vh; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm btn-download-img">
            <i data-lucide="download"></i>
            <span>Unduh Foto</span>
          </button>
          ${isGdrive ? `
            <a href="${this.escapeHtml(imgSrc)}" target="_blank" class="btn btn-secondary btn-sm" style="color:#10b981;">
              <i data-lucide="external-link"></i>
              <span>Buka di Google Drive</span>
            </a>
          ` : ''}
          <button type="button" class="btn btn-primary btn-sm btn-close-img-modal">
            <span>Tutup</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();

    // Close logic
    const closeModal = () => modal.remove();
    modal.querySelectorAll('.btn-close-img-modal').forEach(btn => btn.addEventListener('click', closeModal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Download logic
    const btnDownload = modal.querySelector('.btn-download-img');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = imgSrc;
        const ext = isDataUrl && imgSrc.includes('webp') ? 'webp' : 'jpg';
        link.download = `foto_respon_${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  }

  exportToCsv() {
    if (!this.currentForm || this.responses.length === 0) {
      if (window.app) window.app.showToast('Tidak ada data respon untuk diekspor', 'error');
      return;
    }

    const hasEmail = this.currentForm.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));
    const columns = this.getConsolidatedColumns(this.currentForm.questions || []);

    const isQuiz = this.currentForm.isQuizMode === true;
    const headers = ['No', 'ID Respon', 'Waktu Pengisian'];
    if (isQuiz) headers.push('Nilai Kuis', 'Total Poin', 'Persentase (%)');
    if (hasEmail) headers.push('Email Responden');
    columns.forEach(col => headers.push(col.title));

    const rows = [];
    rows.push(headers.map(h => '"' + h.replace(/"/g, '""') + '"').join(','));

    this.responses.forEach((resp, idx) => {
      const row = [];
      row.push(idx + 1);
      row.push(resp.id || '-');
      row.push(resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('id-ID') : '-');
      if (isQuiz) {
        row.push(resp.answers && resp.answers._quiz_score !== undefined ? resp.answers._quiz_score : '-');
        row.push(resp.answers && resp.answers._quiz_total !== undefined ? resp.answers._quiz_total : '-');
        row.push(resp.answers && resp.answers._quiz_percentage !== undefined ? resp.answers._quiz_percentage + '%' : '-');
      }
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

      rows.push(row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,﻿' + rows.join(String.fromCharCode(10));
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
