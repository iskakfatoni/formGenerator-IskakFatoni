/**
 * FORMCRAFT - Client-side Image Compression & Google Drive Uploader Engine
 * Automatically compresses high-resolution images via HTML5 Canvas (WebP/JPEG, ~60-100KB)
 * and uploads them directly to Google Drive folders via Google Apps Script Webhook (Zero Firebase Storage).
 */

class ImageUploaderEngine {
  constructor() {
    this.DEFAULT_MAX_WIDTH_QUESTION = 1200;
    this.DEFAULT_MAX_WIDTH_OPTION = 600;
    this.DEFAULT_QUALITY = 0.82;
  }

  /**
   * Compresses a file using HTML5 Canvas downsampling and WebP/JPEG conversion.
   * @param {File} file - Original user image file
   * @param {Object} options - { maxWidth, quality }
   * @returns {Promise<{ blob: Blob, dataUrl: string, originalSize: number, compressedSize: number, width: number, height: number }>}
   */
  compressImage(file, options = {}) {
    const maxWidth = options.maxWidth || this.DEFAULT_MAX_WIDTH_QUESTION;
    const quality = options.quality || this.DEFAULT_QUALITY;

    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('File yang dipilih bukan gambar yang valid.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Proportional Downscaling
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          // Max height limit
          const maxHeight = maxWidth * 1.5;
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = Math.round(maxHeight);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP encoding first, fallback to JPEG
          let mimeType = 'image/webp';
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            mimeType = 'image/jpeg';
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          canvas.toBlob((blob) => {
            if (!blob) {
              const byteString = atob(dataUrl.split(',')[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const fallbackBlob = new Blob([ab], { type: mimeType });
              resolve({
                blob: fallbackBlob,
                dataUrl,
                originalSize: file.size,
                compressedSize: fallbackBlob.size,
                width,
                height
              });
              return;
            }

            resolve({
              blob,
              dataUrl,
              originalSize: file.size,
              compressedSize: blob.size,
              width,
              height
            });
          }, mimeType, quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compresses an image and uploads directly to Google Drive (Zero Firebase Storage dependency)
   * with compressed Base64 fallback.
   * @param {File} file
   * @param {Object} options - { formId, formTitle, scriptUrl, folderId, questionTitle, context: 'submission'|'question'|'banner', maxWidth, quality }
   * @returns {Promise<{ url: string, downloadUrl?: string, previewUrl: string, size: number, type: 'gdrive'|'base64' }>}
   */
  async processAndUpload(file, options = {}) {
    const context = options.context || 'question';
    const maxWidth = options.maxWidth || (context === 'option' ? this.DEFAULT_MAX_WIDTH_OPTION : this.DEFAULT_MAX_WIDTH_QUESTION);
    const formId = options.formId || 'form_' + Date.now();

    // 1. Compress Image via HTML5 Canvas (High efficiency WebP/JPEG)
    const compressed = await this.compressImage(file, { maxWidth, quality: options.quality });
    console.log(`[ImageEngine] Foto berhasil dikompres: ${(compressed.originalSize / 1024).toFixed(1)} KB -> ${(compressed.compressedSize / 1024).toFixed(1)} KB (${compressed.width}x${compressed.height}px)`);

    // 2. Upload to Google Drive via Apps Script Webhook
    if (window.gdriveUploader && typeof window.gdriveUploader.uploadBase64 === 'function') {
      try {
        const fileExt = compressed.blob.type === 'image/webp' ? 'webp' : 'jpg';
        const safeFormName = (options.formTitle || formId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeFormName}_foto_${Date.now()}.${fileExt}`;
        
        // Strip data:mime/type;base64, prefix
        const base64Data = compressed.dataUrl.substring(compressed.dataUrl.indexOf(',') + 1);
        
        const gdriveRes = await window.gdriveUploader.uploadBase64(base64Data, fileName, compressed.blob.type, {
          scriptUrl: options.scriptUrl,
          folderId: options.folderId,
          formId: formId,
          formTitle: options.formTitle || 'Formulir Respon',
          questionTitle: options.questionTitle || 'Foto'
        });

        if (gdriveRes && (gdriveRes.url || gdriveRes.fileId)) {
          // Convert Google Drive view URL to direct high-res image thumbnail URL for browser display
          const displayUrl = gdriveRes.fileId 
            ? `https://drive.google.com/thumbnail?id=${gdriveRes.fileId}&sz=w1600` 
            : (compressed.dataUrl || gdriveRes.url);

          console.log(`[ImageEngine] Foto terunggah ke Google Drive: ${displayUrl}`);
          return {
            url: (options.context === 'banner') ? (compressed.dataUrl || displayUrl) : displayUrl,
            viewUrl: gdriveRes.url,
            downloadUrl: gdriveRes.downloadUrl,
            previewUrl: compressed.dataUrl,
            size: compressed.compressedSize,
            type: 'gdrive',
            fileId: gdriveRes.fileId
          };
        }
      } catch (gdriveErr) {
        console.warn('[ImageEngine] Upload Google Drive gagal/timeout, fallback ke base64 data URL:', gdriveErr);
      }
    }

    // 3. Fallback to compressed Data URL if offline / Google Drive not responding
    return {
      url: compressed.dataUrl,
      previewUrl: compressed.dataUrl,
      size: compressed.compressedSize,
      type: 'base64'
    };
  }
}

// Global instance
window.imageUploader = new ImageUploaderEngine();
