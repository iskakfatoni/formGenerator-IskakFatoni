/**
 * FORMCRAFT - Builder DOM Component Renderers
 * Builds HTML elements for section cards, question cards, options editor, and variable piping.
 */

window.BuilderRenderer = {
  getTypeMeta(type) {
    const map = {
      text: { label: 'Jawaban Singkat / Teks', icon: 'type', color: '#6366f1' },
      choice: { label: 'Pilihan Ganda (Radio)', icon: 'check-circle-2', color: '#3b82f6' },
      checkbox: { label: 'Kotak Centang (Banyak Pilihan)', icon: 'check-square', color: '#8b5cf6' },
      file_gdrive: { label: 'Upload ke Google Drive', icon: 'hard-drive', color: '#10b981' },
      file: { label: 'Upload Berkas / Foto Kamera', icon: 'camera', color: '#06b6d4' },
      location: { label: 'Titik Lokasi GPS', icon: 'map-pin', color: '#f59e0b' },
      signature: { label: 'Tanda Tangan Digital', icon: 'pen-tool', color: '#ec4899' },
      rating: { label: 'Rating Skala Bintang', icon: 'star', color: '#eab308' },
      date: { label: 'Pilih Tanggal', icon: 'calendar', color: '#14b8a6' }
    };
    return map[type] || { label: 'Teks', icon: 'type', color: '#6366f1' };
  },

  openPipingPicker(targetInput, secIdx, questions, sections) {
    document.querySelectorAll('.piping-picker-modal').forEach(m => m.remove());

    const availableQuestions = questions.filter(q => {
      const qSecIdx = sections.findIndex(s => s.id === q.sectionId);
      return qSecIdx >= 0 && qSecIdx < secIdx && q.title && q.title.trim();
    });

    if (availableQuestions.length === 0) {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Belum ada pertanyaan di bagian sebelumnya yang dapat dijadikan variabel', 'warning');
      }
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'piping-picker-modal glass-card';
    modal.innerHTML = `
      <div class="piping-picker-header">
        <div class="piping-picker-title">
          <i data-lucide="variable"></i>
          <strong>Sisipkan Jawaban Responden</strong>
        </div>
        <button type="button" class="btn-close-piping">&times;</button>
      </div>
      <p class="piping-picker-desc">Pilih pertanyaan dari bagian sebelumnya untuk menyisipkan jawabannya secara dinamis:</p>
      <div class="piping-list">
        ${availableQuestions.map(q => `
          <button type="button" class="piping-item-btn" data-tag="{{${q.title.trim()}}}">
            <span class="piping-tag">{{${q.title.trim()}}}</span>
            <small class="piping-sec-name">${sections.find(s => s.id === q.sectionId)?.title || 'Bagian'}</small>
          </button>
        `).join('')}
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();

    modal.querySelector('.btn-close-piping').onclick = () => modal.remove();
    modal.querySelectorAll('.piping-item-btn').forEach(btn => {
      btn.onclick = () => {
        const tag = btn.dataset.tag;
        const start = targetInput.selectionStart || 0;
        const end = targetInput.selectionEnd || 0;
        const text = targetInput.value;
        targetInput.value = text.substring(0, start) + tag + text.substring(end);
        targetInput.selectionStart = targetInput.selectionEnd = start + tag.length;
        targetInput.focus();
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        modal.remove();
      };
    });
  }
};
