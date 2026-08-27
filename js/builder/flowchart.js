/**
 * FORMCRAFT - 2D Interactive Flowchart & Bezier Wiring Engine
 * Renders nodes for sections & branching logic with interactive curved wires.
 */

window.BuilderFlowchart = {
  currentZoom: 1,

  render(builderInstance) {
    const nodesLayer = document.getElementById('flowchart-nodes-layer');
    const svgLayer = document.getElementById('flowchart-svg-layer');
    const canvas = document.getElementById('flowchart-graph-canvas');
    if (!nodesLayer || !svgLayer || !canvas) return;

    nodesLayer.innerHTML = '';
    const defs = svgLayer.querySelector('defs');
    svgLayer.innerHTML = '';
    if (defs) svgLayer.appendChild(defs);

    const sections = builderInstance.sections || [];
    const questions = builderInstance.questions || [];

    if (sections.length === 0) {
      nodesLayer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:360px; color:var(--text-muted); font-size:0.95rem; width:100%;"><i data-lucide="info" style="margin-right:8px;"></i> Belum ada bagian/section untuk ditampilkan dalam peta alur.</div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    sections.forEach((sec, idx) => {
      const nodeEl = this.createSectionNode(sec, idx, questions, builderInstance);
      nodesLayer.appendChild(nodeEl);
    });

    if (window.lucide) window.lucide.createIcons();

    requestAnimationFrame(() => {
      this.drawWires(svgLayer, canvas, sections, questions);
    });
  },

  createSectionNode(sec, secIdx, questions, builderInstance) {
    const node = document.createElement('div');
    node.className = 'graph-node-card glass-card';
    node.id = `graph-node-${sec.id}`;
    node.dataset.sectionId = sec.id;

    const col = secIdx % 3;
    const row = Math.floor(secIdx / 3);
    node.style.left = `${60 + col * 360}px`;
    node.style.top = `${50 + row * 260}px`;

    const secQuestions = questions.filter(q => q.sectionId === sec.id);
    const branchQuestions = secQuestions.filter(q => (q.type === 'choice' || q.type === 'checkbox') && Array.isArray(q.options) && q.options.some(opt => typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next'));

    let branchHtml = '';
    if (branchQuestions.length > 0) {
      branchHtml = `<div class="node-branches-list">`;
      branchQuestions.forEach(q => {
        branchHtml += `<div class="node-branch-item"><div class="branch-q-title"><i data-lucide="git-commit"></i> ${builderInstance.escapeHtml(q.title || 'Pilihan')}</div>`;
        q.options.forEach((opt, oIdx) => {
          if (typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next') {
            const targetSec = builderInstance.sections.find(s => s.id === opt.nextSectionId);
            const targetTitle = targetSec ? targetSec.title : (opt.nextSectionId === 'submit' ? 'Kirim Formulir' : opt.nextSectionId);
            branchHtml += `<div class="branch-opt-row" id="port-out-${sec.id}-${q.id}-${oIdx}"><span class="opt-dot"></span><span>"${builderInstance.escapeHtml(opt.text)}" &rarr; <strong>${builderInstance.escapeHtml(targetTitle)}</strong></span></div>`;
          }
        });
        branchHtml += `</div>`;
      });
      branchHtml += `</div>`;
    }

    const defaultNext = sec.nextSectionId || 'inherit';
    let defaultNextLabel = 'Lanjut ke Bagian Berikutnya';
    if (defaultNext === 'submit') defaultNextLabel = 'Kirim / Selesai Formulir';
    else if (defaultNext !== 'inherit') {
      const ts = builderInstance.sections.find(s => s.id === defaultNext);
      if (ts) defaultNextLabel = `Lanjut ke: ${ts.title}`;
    }

    node.innerHTML = `
      <div class="node-header">
        <span class="node-badge"><i data-lucide="folder"></i> Bagian ${secIdx + 1}</span>
        <span class="node-q-count">${secQuestions.length} Soal</span>
      </div>
      <h4 class="node-title">${builderInstance.escapeHtml(sec.title || `Bagian ${secIdx + 1}`)}</h4>
      ${sec.description ? `<p class="node-desc">${builderInstance.escapeHtml(sec.description)}</p>` : ''}
      ${branchHtml}
      <div class="node-default-flow" id="port-default-${sec.id}">
        <i data-lucide="corner-down-right"></i>
        <span>${builderInstance.escapeHtml(defaultNextLabel)}</span>
      </div>
    `;

    return node;
  },

  drawWires(svgLayer, canvas, sections, questions) {
    if (!svgLayer || !canvas) return;

    sections.forEach((sec, idx) => {
      const secQuestions = questions.filter(q => q.sectionId === sec.id);
      secQuestions.forEach(q => {
        if ((q.type === 'choice' || q.type === 'checkbox') && Array.isArray(q.options)) {
          q.options.forEach((opt, oIdx) => {
            if (typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next' && opt.nextSectionId !== 'submit') {
              const fromPort = document.getElementById(`port-out-${sec.id}-${q.id}-${oIdx}`);
              const toNode = document.getElementById(`graph-node-${opt.nextSectionId}`);
              if (fromPort && toNode) {
                this.connectNodesWithBezier(svgLayer, fromPort, toNode, 'cyan', canvas);
              }
            }
          });
        }
      });

      if (sec.nextSectionId && sec.nextSectionId !== 'inherit' && sec.nextSectionId !== 'submit') {
        const fromDefault = document.getElementById(`port-default-${sec.id}`);
        const toNode = document.getElementById(`graph-node-${sec.nextSectionId}`);
        if (fromDefault && toNode) {
          this.connectNodesWithBezier(svgLayer, fromDefault, toNode, 'purple', canvas);
        }
      } else if (sec.nextSectionId === 'inherit' && idx < sections.length - 1) {
        const nextSec = sections[idx + 1];
        const fromDefault = document.getElementById(`port-default-${sec.id}`);
        const toNode = document.getElementById(`graph-node-${nextSec.id}`);
        if (fromDefault && toNode) {
          this.connectNodesWithBezier(svgLayer, fromDefault, toNode, 'green', canvas);
        }
      }
    });
  },

  connectNodesWithBezier(svgLayer, fromEl, toEl, colorType, canvas) {
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const x1 = fromRect.right - canvasRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
    const x2 = toRect.left - canvasRect.left;
    const y2 = toRect.top + 30 - canvasRect.top;

    const dx = Math.abs(x2 - x1) * 0.5;
    const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('class', `flow-wire wire-${colorType}`);
    path.setAttribute('marker-end', `url(#arrow-${colorType})`);
    svgLayer.appendChild(path);
  },

  zoomIn() {
    this.currentZoom = Math.min(this.currentZoom + 0.15, 2.0);
    this.applyZoom();
  },

  zoomOut() {
    this.currentZoom = Math.max(this.currentZoom - 0.15, 0.4);
    this.applyZoom();
  },

  resetZoom() {
    this.currentZoom = 1;
    this.applyZoom();
  },

  applyZoom() {
    const canvas = document.getElementById('flowchart-graph-canvas');
    const zoomLevelText = document.getElementById('graph-zoom-level');
    if (canvas) canvas.style.transform = `scale(${this.currentZoom})`;
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(this.currentZoom * 100)}%`;
  },

  toggleFullscreen() {
    const viewport = document.getElementById('flowchart-graph-viewport');
    if (!viewport) return;
    if (!document.fullscreenElement) {
      viewport.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
};
