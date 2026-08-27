/**
 * FORMCRAFT - 2D Interactive Flowchart & Bezier Wiring Engine
 * Accurately models form navigation: option branches, question flow, and section sequences.
 */

window.BuilderFlowchart = {
  currentZoom: 1,
  panX: 40,
  panY: 40,
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

    // Harvest latest DOM values to ensure 100% up-to-date section and option flow
    if (typeof builderInstance.harvestDomValues === 'function') {
      builderInstance.harvestDomValues();
    }

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

    // Layout configuration
    const cardWidth = 340;
    const colGap = 120;
    const rowGap = 60;
    const cols = 3;

    const colHeights = Array(cols).fill(40);

    // 1. Render Section Nodes
    sections.forEach((sec, idx) => {
      const col = idx % cols;
      const posX = 50 + col * (cardWidth + colGap);
      const posY = colHeights[col];

      const nodeEl = this.createSectionNode(sec, idx, sections, questions, builderInstance, posX, posY);
      nodesLayer.appendChild(nodeEl);

      // Estimate card height
      const secQuestions = questions.filter(q => q.sectionId === sec.id);
      const branchQuestions = secQuestions.filter(q => (q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') && Array.isArray(q.options) && q.options.some(opt => {
        const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
        return nextId && nextId !== 'inherit' && nextId !== 'next';
      }));

      let branchCount = 0;
      branchQuestions.forEach(q => {
        q.options.forEach(opt => {
          const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
          if (nextId && nextId !== 'inherit' && nextId !== 'next') branchCount++;
        });
      });

      const estimatedHeight = 160 + (branchCount * 42);
      colHeights[col] += estimatedHeight + rowGap;
    });

    // 2. Render Submit Terminal Node at bottom right
    const maxColHeight = Math.max(...colHeights, 600);
    const submitCol = (sections.length) % cols;
    const submitPosX = 50 + submitCol * (cardWidth + colGap);
    const submitPosY = colHeights[submitCol] + 20;

    const submitTerminal = document.createElement('div');
    submitTerminal.className = 'graph-node-card end-terminal-node';
    submitTerminal.id = 'graph-node-submit';
    submitTerminal.style.left = `${submitPosX}px`;
    submitTerminal.style.top = `${submitPosY}px`;
    submitTerminal.innerHTML = `
      <div class="graph-node-port-in green"></div>
      <div class="graph-node-top">
        <span class="graph-node-badge badge-green"><i data-lucide="check-circle-2"></i> Selesai</span>
      </div>
      <div class="graph-node-body">
        <h4 class="graph-node-title">🚀 Kirim & Simpan Formulir</h4>
        <p class="graph-node-desc">Titik akhir alur respon. Seluruh jawaban direkam ke database dan Google Drive.</p>
      </div>
    `;
    nodesLayer.appendChild(submitTerminal);

    if (window.lucide) window.lucide.createIcons();

    // Adjust canvas dimensions to contain everything comfortably
    canvas.style.minHeight = `${submitPosY + 350}px`;
    canvas.style.minWidth = `${50 + cols * (cardWidth + colGap) + 500}px`;

    // 3. Draw All Connecting Wires after DOM paints
    setTimeout(() => {
      this.drawWires(svgLayer, canvas, sections, questions);
    }, 80);
  },

  createSectionNode(sec, secIdx, sections, questions, builderInstance, posX, posY) {
    const node = document.createElement('div');
    node.className = `graph-node-card ${secIdx === 0 ? 'start-node' : ''}`;
    node.id = `graph-node-${sec.id}`;
    node.dataset.sectionId = sec.id;
    node.style.left = `${posX}px`;
    node.style.top = `${posY}px`;

    const secQuestions = questions.filter(q => q.sectionId === sec.id);
    const branchQuestions = secQuestions.filter(q => (q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') && Array.isArray(q.options) && q.options.some(opt => {
      const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
      return nextId && nextId !== 'inherit' && nextId !== 'next';
    }));

    let branchHtml = '';
    if (branchQuestions.length > 0) {
      branchHtml = `<div class="node-branches-list">`;
      branchQuestions.forEach(q => {
        branchHtml += `<div class="node-branch-item"><div class="branch-q-title"><i data-lucide="git-branch"></i> ${builderInstance.escapeHtml(q.title || 'Pilihan Percabangan')}</div>`;
        q.options.forEach((opt, oIdx) => {
          const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
          if (nextId && nextId !== 'inherit' && nextId !== 'next') {
            let targetLabel = '';
            if (nextId === 'submit') {
              targetLabel = 'Kirim Formulir';
            } else {
              const targetSec = sections.find(s => s.id === nextId);
              const targetSecIdx = sections.findIndex(s => s.id === nextId);
              targetLabel = targetSec ? `Bagian ${targetSecIdx + 1}: ${targetSec.title || 'Tanpa Judul'}` : nextId;
            }
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            branchHtml += `
              <div class="branch-opt-row" id="port-out-${sec.id}-${q.id}-${oIdx}">
                <span class="opt-label-text">"${builderInstance.escapeHtml(optText)}" &rarr; <strong>${builderInstance.escapeHtml(targetLabel)}</strong></span>
                <span class="graph-port-dot-out ${nextId === 'submit' ? 'green' : 'cyan'}"></span>
              </div>
            `;
          }
        });
        branchHtml += `</div>`;
      });
      branchHtml += `</div>`;
    }

    // Default flow calculation
    const rawNext = sec.nextSectionId || 'next';
    let defaultNextLabel = '';
    let portColor = 'purple';

    if (rawNext === 'submit') {
      defaultNextLabel = 'Kirim / Selesai Formulir';
      portColor = 'green';
    } else if (rawNext !== 'next' && rawNext !== 'inherit') {
      const targetSec = sections.find(s => s.id === rawNext);
      const targetSecIdx = sections.findIndex(s => s.id === rawNext);
      if (targetSec) {
        defaultNextLabel = `Lanjut ke Bagian ${targetSecIdx + 1}: ${targetSec.title || 'Tanpa Judul'}`;
      } else {
        defaultNextLabel = `Lanjut ke: ${rawNext}`;
      }
    } else {
      if (secIdx < sections.length - 1) {
        const nextSec = sections[secIdx + 1];
        defaultNextLabel = `Lanjut ke Bagian ${secIdx + 2}: ${nextSec.title || 'Tanpa Judul'} (Default)`;
      } else {
        defaultNextLabel = 'Kirim / Selesai Formulir (Bagian Terakhir)';
        portColor = 'green';
      }
    }

    node.innerHTML = `
      ${secIdx > 0 ? '<div class="graph-node-port-in"></div>' : ''}
      <div class="graph-node-top">
        <span class="graph-node-badge">${secIdx === 0 ? 'Mulai (Bagian 1)' : `Bagian ${secIdx + 1}`}</span>
        <span class="graph-node-q-count"><i data-lucide="help-circle"></i> ${secQuestions.length} Soal</span>
      </div>
      <div class="graph-node-body">
        <h4 class="graph-node-title">${builderInstance.escapeHtml(sec.title || `Bagian ${secIdx + 1}`)}</h4>
        ${sec.description ? `<p class="graph-node-desc">${builderInstance.escapeHtml(sec.description)}</p>` : ''}
        ${branchHtml}
        <div class="node-default-flow" id="port-default-${sec.id}">
          <i data-lucide="corner-down-right"></i>
          <span>${builderInstance.escapeHtml(defaultNextLabel)}</span>
          <span class="graph-port-dot-out ${portColor}"></span>
        </div>
      </div>
    `;

    return node;
  },

  drawWires(svgLayer, canvas, sections, questions) {
    if (!svgLayer || !canvas) return;

    const defs = svgLayer.querySelector('defs');
    svgLayer.innerHTML = '';
    if (defs) svgLayer.appendChild(defs);

    sections.forEach((sec, idx) => {
      // 1. Option-Level Branch Wires (Cyan / Green for Submit)
      const secQuestions = questions.filter(q => q.sectionId === sec.id);
      secQuestions.forEach(q => {
        if ((q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') && Array.isArray(q.options)) {
          q.options.forEach((opt, oIdx) => {
            const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
            if (nextId && nextId !== 'inherit' && nextId !== 'next') {
              const fromPort = document.getElementById(`port-out-${sec.id}-${q.id}-${oIdx}`);
              let toNode = null;
              let wireColor = 'cyan';

              if (nextId === 'submit') {
                toNode = document.getElementById('graph-node-submit');
                wireColor = 'green';
              } else {
                toNode = document.getElementById(`graph-node-${nextId}`);
              }

              if (fromPort && toNode) {
                this.connectNodesWithBezier(svgLayer, fromPort, toNode, wireColor, canvas);
              }
            }
          });
        }
      });

      // 2. Section-Level Default Navigation Wire
      const fromDefault = document.getElementById(`port-default-${sec.id}`);
      const rawNext = sec.nextSectionId || 'next';

      if (fromDefault) {
        if (rawNext === 'submit') {
          const submitNode = document.getElementById('graph-node-submit');
          if (submitNode) {
            this.connectNodesWithBezier(svgLayer, fromDefault, submitNode, 'green', canvas);
          }
        } else if (rawNext !== 'next' && rawNext !== 'inherit') {
          const targetNode = document.getElementById(`graph-node-${rawNext}`);
          if (targetNode) {
            this.connectNodesWithBezier(svgLayer, fromDefault, targetNode, 'purple', canvas);
          }
        } else {
          // Default sequential flow
          if (idx < sections.length - 1) {
            const nextSec = sections[idx + 1];
            const nextNode = document.getElementById(`graph-node-${nextSec.id}`);
            if (nextNode) {
              this.connectNodesWithBezier(svgLayer, fromDefault, nextNode, 'purple', canvas);
            }
          } else {
            // Last section naturally flows to submit
            const submitNode = document.getElementById('graph-node-submit');
            if (submitNode) {
              this.connectNodesWithBezier(svgLayer, fromDefault, submitNode, 'green', canvas);
            }
          }
        }
      }
    });
  },

  connectNodesWithBezier(svgLayer, fromEl, toNode, colorType, canvas) {
    const fromPortDot = fromEl.querySelector('.graph-port-dot-out') || fromEl;
    const toPortDot = toNode.querySelector('.graph-node-port-in') || toNode;

    const fromRect = fromPortDot.getBoundingClientRect();
    const toRect = toPortDot.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const zoom = this.currentZoom || 1;

    // Normalize coordinates to canvas coordinate space regardless of pan / zoom
    const x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / zoom;
    const x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / zoom;
    const y2 = (toRect.top + toRect.height / 2 - canvasRect.top) / zoom;

    // Smooth Bezier Curve with horizontal bias
    const dx = Math.max(Math.abs(x2 - x1) * 0.5, 80);
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
