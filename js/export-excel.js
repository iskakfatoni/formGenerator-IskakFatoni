/**
 * FORMCRAFT - Excel Export Engine
 * Converts Form Responses to structured, formatted Microsoft Excel (.xlsx) files using SheetJS.
 * Automatically consolidates questions with the same field name into a single column.
 */

class ExcelExporter {
  static getConsolidatedColumns(rawQuestions) {
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

  static exportFormResponses(form, responses) {
    if (!window.XLSX) {
      alert('Library SheetJS belum termuat. Periksa koneksi internet Anda.');
      return false;
    }

    if (!form || !responses || responses.length === 0) {
      if (window.app) window.app.showToast('Tidak ada data respon untuk diekspor ke Excel', 'error');
      return false;
    }

    try {
      // 1. Prepare Header Row mapping with consolidated columns
      const hasEmail = form.collectEmail || responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));
      const isQuiz = form.isQuizMode === true;
      const headers = ['No', 'ID Respon', 'Waktu Pengisian (WIB/Lokal)'];
      if (isQuiz) {
        headers.push('Nilai Kuis (Poin)', 'Total Poin Maksimal', 'Persentase (%)');
      }
      if (hasEmail) {
        headers.push('Email Responden');
      }

      const columns = this.getConsolidatedColumns(form.questions || []);
      columns.forEach(col => {
        headers.push(col.title);
      });

      // 2. Prepare Data Rows
      const rows = [];
      responses.forEach((resp, index) => {
        const row = [];
        row.push(index + 1);
        row.push(resp.id || '-');
        
        // Format Date
        const dateStr = resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'medium'
        }) : '-';
        row.push(dateStr);

        // Quiz Scores in Excel
        if (isQuiz) {
          row.push(resp.answers && resp.answers._quiz_score !== undefined ? resp.answers._quiz_score : '-');
          row.push(resp.answers && resp.answers._quiz_total !== undefined ? resp.answers._quiz_total : '-');
          row.push(resp.answers && resp.answers._quiz_percentage !== undefined ? resp.answers._quiz_percentage + '%' : '-');
        }

        // Email
        if (hasEmail) {
          const emailVal = resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || '-';
          row.push(emailVal);
        }

        // Answers across consolidated columns
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

          if (activeQ.type === 'location' || (ans && typeof ans === 'object' && ans.lat)) {
            let locObj = ans;
            if (typeof locObj === 'string' && locObj.startsWith('{')) {
              try { locObj = JSON.parse(locObj); } catch(e){}
            }
            if (locObj && typeof locObj === 'object' && locObj.lat) {
              ans = `${locObj.lat}, ${locObj.lng} (https://www.google.com/maps?q=${locObj.lat},${locObj.lng})`;
            }
          } else if (activeQ.type === 'file_gdrive' || (ans && typeof ans === 'object' && ans.url)) {
            let fileObj = ans;
            if (typeof fileObj === 'string' && fileObj.startsWith('{')) {
              try { fileObj = JSON.parse(fileObj); } catch(e){}
            }
            if (typeof fileObj === 'object' && fileObj.url) {
              ans = `${fileObj.name || 'Berkas'}: ${fileObj.url}`;
            } else {
              ans = String(ans || '-');
            }
          } else if (activeQ.type === 'signature' && typeof ans === 'string' && ans.startsWith('data:image')) {
            ans = '[Tanda Tangan Digital Terverifikasi]';
          } else if (Array.isArray(ans)) {
            ans = ans.join(', ');
          } else if (ans === undefined || ans === null || ans === '') {
            ans = '-';
          }
          row.push(ans);
        });

        rows.push(row);
      });

      // 3. Create Worksheet and Workbook
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // 4. Auto-calculate Column Widths for professional look
      const colWidths = headers.map((header, colIdx) => {
        let maxLen = header.length;
        rows.forEach(r => {
          const val = r[colIdx] ? String(r[colIdx]) : '';
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
      });
      worksheet['!cols'] = colWidths;

      // 5. Append sheet to Workbook
      const workbook = XLSX.utils.book_new();
      const sheetName = (form.title || 'Respon Form').substring(0, 30).replace(/[:\\/\?\*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // 6. Generate filename with date
      const safeTitle = (form.title || 'Form_Responses')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      const today = new Date().toISOString().split('T')[0];
      const filename = `${safeTitle}_responses_${today}.xlsx`;

      // 7. Trigger download
      XLSX.writeFile(workbook, filename);

      if (window.app) window.app.showToast('Data respon berhasil diexport ke Excel (.xlsx)!', 'success');
      return true;
    } catch (err) {
      console.error('Export Excel Error:', err);
      if (window.app) window.app.showToast('Gagal mengekspor data ke Excel: ' + err.message, 'error');
      return false;
    }
  }
}

window.ExcelExporter = ExcelExporter;
