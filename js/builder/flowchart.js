/**
 * FORMCRAFT - 2D Interactive Flowchart & Bezier Wiring Engine
 * Renders nodes for sections & branching logic with interactive curved wires and canvas panning.
 */

window.BuilderFlowchart = {
  currentZoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  startX: 0,
  startY: 0,
  initializedPan: false,

  render(builderInstance) {
    const nodesLayer = document.getElementById('flowchart-nodes-layer');
    const svgLayer = document.getElementById('flowchart-svg-layer');
    const canvas = document.getElementById('flowchart-graph-canvas');
    const viewport = document.getElementById('flowchart-graph-viewport');
    if (!nodesLayer || !svgLayer || !canvas || !viewport) return;

    // Reset pan & zoom
    this.currentZoom = 1;
    this.panX = 40;
    this.panY = 40;
    this.applyTransform();
    this.initPanning(viewport);

    nodesLayer.innerHTML = '';
    const defs = svgLayer.querySelector('defs');
    svgLayer.innerHTML = '';
    if (defs) svgLayer.appendChild(defs);

    const sections = builderInstance.sections || [];
    const questions = builderInstance.questions || [];

    if (sections.length === 0) {
      nodesLayer.innerHTML = `<div class="flowchart-empty-state"><i data-lucide="info"></i> Belum ada bagian/section untuk ditampilkan dalam peta alur.</div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Dynamic grid layout positioning
    const cardWidth = 330;
    const colGap = 90;
    const rowGap = 70;
    const cols = 3;

    // Track column heights to prevent vertical overlapping
    const colHeights = [40, 40, 40];

    sections.forEach((sec, idx) => {
      const col = idx % cols;
      const posX = 50 + col * (cardWidth + colGap);
      const posY = colHeights[col];

      const nodeEl = this.createSectionNode(sec, idx, questions, builderInstance, posX, posY);
      nodesLayer.appendChild(nodeEl);

      // Estimate card height based on branches + base height
      const secQuestions = questions.filter(q => q.sectionId === sec.id);
      const branchQuestions = secQuestions.filter(q => (q.type === 'choice' || q.type === 'checkbox') && Array.isArray(q.options) && q.options.some(opt => typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next'));
      let branchCount = 0;
      branchQuestions.forEach(q => {
        q.options.forEach(opt => {
          if (typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next') branchCount++;
        });
      });

      const estimatedHeight = 160 + (branchCount * 36);
      colHeights[col] += estimatedHeight + rowGap;
    });

    if (window.lucide) window.lucide.createIcons();

    // Adjust canvas size to fit all nodes
    const maxColHeight = Math.max(...colHeights, 1200);
    canvas.style.minHeight = `${maxColHeight + 300}px`;
    canvas.style.minWidth = `${50 + cols * (cardWidth + colGap) + 400}px`;

    // Draw wires after nodes are in DOM
    setTimeout(() => {
      this.drawWires(svgLayer, canvas, sections, questions);
    }, 60);
  },

  createSectionNode(sec, secIdx, questions, builderInstance, posX, posY) {
    const node = document.createElement('div');
    node.className = `graph-node-card ${secIdx === 0 ? 'start-node' : (sec.nextSectionId === 'submit' ? 'end-node' : '')}`;
    node.id = `graph-node-${sec.id}`;
    node.dataset.sectionId = sec.id;
    node.style.left = `${posX}px`;
    node.style.top = `${posY}px`;

    const secQuestions = questions.filter(q => q.sectionId === sec.id);
    const branchQuestions = secQuestions.filter(q => (q.type === 'choice' || q.type === 'checkbox') && Array.isArray(q.options) && q.options.some(opt => typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next'));

    let branchHtml = '';
    if (branchQuestions.length > 0) {
      branchHtml = `<div class="node-branches-list">`;
      branchQuestions.forEach(q => {
        branchHtml += `<div class="node-branch-item"><div class="branch-q-title"><i data-lucide="git-branch"></i> ${builderInstance.escapeHtml(q.title || 'Pilihan')}</div>`;
        q.options.forEach((opt, oIdx) => {
          if (typeof opt === 'object' && opt.nextSectionId && opt.nextSectionId !== 'inherit' && opt.nextSectionId !== 'next') {
            const targetSec = builderInstance.sections.find(s => s.id === opt.nextSectionId);
            const targetTitle = targetSec ? targetSec.title : (opt.nextSectionId === 'submit' ? 'Kirim Formulir' : opt.nextSectionId);
            branchHtml += `
              <div class="branch-opt-row" id="port-out-${sec.id}-${q.id}-${oIdx}">
                <span class="opt-label-text">"${builderInstance.escapeHtml(opt.text)}" &rarr; <strong>${builderInstance.escapeHtml(targetTitle)}</strong></span>
                <span class="graph-port-dot-out cyan"></span>
              </div>
            `;
          }
        });
        branchHtml += `</div>`;
      });
      branchHtml += `</div>`;
    }

    const defaultNext = sec.nextSectionId || 'inherit';
    let defaultNextLabel = 'Lanjut ke Bagian Berikutnya (Default)';
    if (defaultNext === 'submit') defaultNextLabel = 'Kirim / Selesai Formulir';
    else if (defaultNext !== 'inherit') {
      const ts = builderInstance.sections.find(s => s.id === defaultNext);
      if (ts) defaultNextLabel = `Lanjut ke: ${ts.title}`;
    }

    node.innerHTML = `
      <div class="graph-node-port-in"></div>
      <div class="graph-node-top">
        <span class="graph-node-badge">${secIdx === 0 ? 'Mulai' : `Bagian ${secIdx + 1}`}</span>
        <span class="graph-node-q-count"><i data-lucide="help-circle"></i> ${secQuestions.length} Soal</span>
      </div>
      <div class="graph-node-body">
        <h4 class="graph-node-title">${builderInstance.escapeHtml(sec.title || `Bagian ${secIdx + 1}`)}</h4>
        ${sec.description ? `<p class="graph-node-desc">${builderInstance.escapeHtml(sec.description)}</p>` : ''}
        ${branchHtml}
        <div class="node-default-flow" id="port-default-${sec.id}">
          <i data-lucide="corner-down-right"></i>
          <span>${builderInstance.escapeHtml(defaultNextLabel)}</span>
          <span class="graph-port-dot-out ${sec.nextSectionId === 'submit' ? 'green' : 'purple'}"></span>
        </div>
      </div>
    `;

    return node;
  },

  drawWires(svgLayer, canvas, sections, questions) {
    if (!svgLayer || !canvas) return;

    // Clear existing paths while preserving defs
    const defs = svgLayer.querySelector('defs');
    svgLayer.innerHTML = '';
    if (defs) svgLayer.appendChild(defs);

    sections.forEach((sec, idx) => {
      // 1. Branch wires (Cyan)
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

      // 2. Default flow wires (Purple / Green)
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

  connectNodesWithBezier(svgLayer, fromEl, toNode, colorType, canvas) {
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toNode.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const zoom = this.currentZoom || 1;

    // Convert screen coordinates to canvas coordinate space
    const x1 = (fromRect.right - canvasRect.left) / zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / zoom;
    const x2 = (toRect.left - canvasRect.left) / zoom;
    const y2 = (toRect.top + 32 - canvasRect.top) / zoom;

    const dx = Math.max(Math.abs(x2 - x1) * 0.55, 60);
    const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('class', `flow-wire wire-${colorType}`);
    path.setAttribute('marker-end', `url(#arrow-${colorType})`);
    svgLayer.appendChild(path);
  },

  initPanning(viewport) {
    if (this.initializedPan) return;
    this.initializedPan = true;

    viewport.addEventListener('mousedown', (e) => {
      // Pan only if clicked on empty canvas/viewport or middle click
      if (e.target.closest('.graph-node-card')) return;
      this.isPanning = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
      viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        viewport.style.cursor = 'grab';
      }
    });

    // Zoom on mouse wheel with ctrl/meta or normal wheel
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }, { passive: false });
  },

  zoomIn() {
    this.currentZoom = Math.min(this.currentZoom + 0.1, 1.8);
    this.applyTransform();
    this.updateZoomText();
  },

  zoomOut() {
    this.currentZoom = Math.max(this.currentZoom - 0.1, 0.4);
    this.applyTransform();
    this.updateZoomText();
  },

  resetZoom() {
    this.currentZoom = 1;
    this.panX = 40;
    this.panY = 40;
    this.applyTransform();
    this.updateZoomText();
  },

  applyTransform() {
    const canvas = document.getElementById('flowchart-graph-canvas');
    if (canvas) {
      canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.currentZoom})`;
      canvas.style.transformOrigin = '0 0';
    }
  },

  updateZoomText() {
    const zoomLevelText = document.getElementById('graph-zoom-level');
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
