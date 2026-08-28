/**
 * FORMCRAFT - 2D Interactive Flowchart & Bezier Wiring Engine
 * Left-to-Right Stage Columns (Mulai paling kiri -> Tahap 2 -> Tahap 3 -> Selesai paling kanan).
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

    if (typeof builderInstance.harvestDomValues === 'function') {
      builderInstance.harvestDomValues();
    }

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

    // 1. Calculate Left-to-Right Stages topologically (BFS from Start)
    const { stageMap, maxStage } = this.calculateStages(sections, questions);
    const totalColumns = maxStage + 2; // +1 for sections, +1 for Final Submit Column

    // Layout configuration
    const cardWidth = 340;
    const colGap = 110;
    const rowGap = 55;
    const stageHeaderHeight = 65;

    const colHeights = Array(totalColumns).fill(stageHeaderHeight + 20);

    // Dynamic Stage Column Titles
    const getStageTitleInfo = (colIndex) => {
      if (colIndex === 0) {
        return { num: 1, icon: 'play', title: 'Mulai / Tahap 1: Awal Formulir', pillClass: 'stage-pill-1' };
      } else if (colIndex === totalColumns - 1) {
        return { num: colIndex + 1, icon: 'check-circle-2', title: 'Tahap Selesai: Kirim Formulir', pillClass: 'stage-pill-finish' };
      } else if (colIndex === 1) {
        return { num: 2, icon: 'git-branch', title: 'Tahap 2: Percabangan & Pilihan', pillClass: 'stage-pill-2' };
      } else {
        return { num: colIndex + 1, icon: 'layers', title: `Tahap ${colIndex + 1}: Data Lanjutan`, pillClass: 'stage-pill-3' };
      }
    };

    // 2. Render Stage Column Header Lanes across top of canvas
    for (let c = 0; c < totalColumns; c++) {
      const info = getStageTitleInfo(c);
      const stageHeader = document.createElement('div');
      stageHeader.className = 'flowchart-stage-header';
      stageHeader.style.left = `${50 + c * (cardWidth + colGap)}px`;
      stageHeader.style.width = `${cardWidth}px`;
      stageHeader.innerHTML = `
        <div class="stage-header-pill ${info.pillClass}">
          <i data-lucide="${info.icon}"></i>
          <span>${info.title}</span>
        </div>
      `;
      nodesLayer.appendChild(stageHeader);

      // Render Vertical Divider between columns (except before col 0)
      if (c > 0) {
        const divider = document.createElement('div');
        divider.className = 'flowchart-stage-divider';
        divider.style.left = `${50 + c * (cardWidth + colGap) - colGap / 2}px`;
        nodesLayer.appendChild(divider);
      }
    }

    // 3. Render Section Nodes placed in their respective Stage Columns
    sections.forEach((sec, idx) => {
      const stageIndex = stageMap[sec.id] || 0;
      const stageNum = stageIndex + 1;
      const posX = 50 + stageIndex * (cardWidth + colGap);
      const posY = colHeights[stageIndex];

      const nodeEl = this.createSectionNode(sec, idx, sections, questions, builderInstance, posX, posY, stageNum);
      nodesLayer.appendChild(nodeEl);

      const secQuestions = questions.filter(q => q.sectionId === sec.id);
      const uniqueTargets = this.getSectionUniqueBranches(sec, secQuestions);
      const branchCount = uniqueTargets.length;

      const estimatedHeight = 160 + (branchCount * 38);
      colHeights[stageIndex] += estimatedHeight + rowGap;
    });

    // 4. Render Submit Terminal Node in the Final Column (Paling Kanan)
    const submitCol = totalColumns - 1;
    const submitPosX = 50 + submitCol * (cardWidth + colGap);
    const submitPosY = colHeights[submitCol];

    const submitTerminal = document.createElement('div');
    submitTerminal.className = 'graph-node-card end-terminal-node';
    submitTerminal.id = 'graph-node-submit';
    submitTerminal.style.left = `${submitPosX}px`;
    submitTerminal.style.top = `${submitPosY}px`;
    submitTerminal.innerHTML = `
      <div class="graph-node-port-in green"></div>
      <div class="graph-node-top">
        <span class="graph-node-badge stage-finish"><i data-lucide="check-circle-2"></i> Tahap Selesai</span>
      </div>
      <div class="graph-node-body">
        <h4 class="graph-node-title">🚀 Kirim & Simpan Formulir</h4>
        <p class="graph-node-desc">Titik akhir alur respon. Seluruh jawaban direkam ke database dan Google Drive.</p>
      </div>
    `;
    nodesLayer.appendChild(submitTerminal);

    if (window.lucide) window.lucide.createIcons();

    // Adjust canvas height and width to fit all stages from left to right
    const maxColHeight = Math.max(...colHeights, 600);
    canvas.style.minHeight = `${maxColHeight + 350}px`;
    canvas.style.minWidth = `${50 + totalColumns * (cardWidth + colGap) + 400}px`;

    // 5. Draw All Connecting Wires (Flowing from Left to Right)
    setTimeout(() => {
      this.drawWires(svgLayer, canvas, sections, questions);
    }, 80);
  },

  /**
   * Topological Stage Calculation (Assigns Left-to-Right columns from Start -> Branches -> End)
   * Ensures sibling/parallel branches (e.g., classes branched from the same parent) stay in the same column/stage.
   */
  calculateStages(sections, questions) {
    const stageMap = {};
    if (!sections || sections.length === 0) return { stageMap, maxStage: 0 };

    const startSecId = sections[0].id;
    stageMap[startSecId] = 0;

    // 1. Collect all explicit branch targets from questions across all sections
    const branchTargetSet = new Set();
    const explicitBranchMap = {}; // fromSectionId -> Set of targetSectionIds

    sections.forEach(sec => {
      explicitBranchMap[sec.id] = new Set();
      const secQuestions = (questions || []).filter(q => q.sectionId === sec.id);
      secQuestions.forEach(q => {
        if (Array.isArray(q.options)) {
          q.options.forEach(opt => {
            const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
            if (nextId && nextId !== 'inherit' && nextId !== 'next' && nextId !== 'submit' && nextId !== 'disabled' && sections.some(s => s.id === nextId)) {
              explicitBranchMap[sec.id].add(nextId);
              branchTargetSet.add(nextId);
            }
          });
        }
      });
    });

    // 2. Build graph adjacency list
    const graph = {};
    sections.forEach((sec, idx) => {
      graph[sec.id] = new Set();

      // Add question branches
      explicitBranchMap[sec.id].forEach(targetId => {
        graph[sec.id].add(targetId);
      });

      // Add section-level explicit nextSectionId
      if (sec.nextSectionId && sec.nextSectionId !== 'inherit' && sec.nextSectionId !== 'next' && sec.nextSectionId !== 'submit' && sec.nextSectionId !== 'disabled' && sections.some(s => s.id === sec.nextSectionId)) {
        graph[sec.id].add(sec.nextSectionId);
      } else if (sec.nextSectionId !== 'submit' && sec.nextSectionId !== 'disabled') {
        // Fallback sequential flow: only add next section in array IF next section is NOT an explicit branch target from elsewhere
        if (idx < sections.length - 1) {
          const nextSec = sections[idx + 1];
          if (!branchTargetSet.has(nextSec.id)) {
            graph[sec.id].add(nextSec.id);
          }
        }
      }
    });

    // 3. BFS traversal to compute topological stage/depth from startSecId
    const queue = [startSecId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      const currentStage = stageMap[currentId] || 0;

      graph[currentId].forEach(targetId => {
        const nextStage = currentStage + 1;
        if (stageMap[targetId] === undefined || nextStage > stageMap[targetId]) {
          stageMap[targetId] = nextStage;
        }
        if (!queue.includes(targetId)) {
          queue.push(targetId);
        }
      });
    }

    // 4. Handle any unvisited or disconnected sections gracefully
    sections.forEach((sec, idx) => {
      if (stageMap[sec.id] === undefined) {
        let assigned = false;
        for (const parentId of Object.keys(explicitBranchMap)) {
          if (explicitBranchMap[parentId].has(sec.id) && stageMap[parentId] !== undefined) {
            stageMap[sec.id] = stageMap[parentId] + 1;
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          stageMap[sec.id] = idx > 0 ? 1 : 0;
        }
      }
    });

    const maxStage = Math.max(0, ...Object.values(stageMap));
    return { stageMap, maxStage };
  },

  getSectionUniqueBranches(sec, secQuestions) {
    const branches = [];
    secQuestions.forEach(q => {
      if ((q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') && Array.isArray(q.options)) {
        const targetMap = {};
        q.options.forEach((opt) => {
          const nextId = typeof opt === 'object' ? (opt.nextSectionId || '') : '';
          if (nextId && nextId !== 'inherit' && nextId !== 'next') {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            if (!targetMap[nextId]) targetMap[nextId] = [];
            targetMap[nextId].push(optText);
          }
        });

        Object.keys(targetMap).forEach(targetId => {
          branches.push({
            questionId: q.id,
            questionTitle: q.title || 'Pilihan',
            targetId: targetId,
            optionCount: targetMap[targetId].length,
            sampleText: targetMap[targetId][0]
          });
        });
      }
    });
    return branches;
  },

  createSectionNode(sec, secIdx, sections, questions, builderInstance, posX, posY, stageNum) {
    const node = document.createElement('div');
    node.className = `graph-node-card ${secIdx === 0 ? 'start-node' : ''}`;
    node.id = `graph-node-${sec.id}`;
    node.dataset.sectionId = sec.id;
    node.style.left = `${posX}px`;
    node.style.top = `${posY}px`;

    const secQuestions = questions.filter(q => q.sectionId === sec.id);
    const uniqueBranches = this.getSectionUniqueBranches(sec, secQuestions);

    let branchHtml = '';
    if (uniqueBranches.length > 0) {
      branchHtml = `<div class="node-branches-list">`;
      uniqueBranches.forEach((b) => {
        let targetLabel = '';
        let dotColor = 'cyan';
        if (b.targetId === 'disabled') {
          targetLabel = '🚫 Alur Dimatikan';
          dotColor = 'red';
        } else if (b.targetId === 'submit') {
          targetLabel = 'Kirim Formulir';
          dotColor = 'green';
        } else {
          const targetSec = sections.find(s => s.id === b.targetId);
          const targetSecIdx = sections.findIndex(s => s.id === b.targetId);
          targetLabel = targetSec ? `Bagian ${targetSecIdx + 1}: ${targetSec.title || 'Tanpa Judul'}` : b.targetId;
        }

        let displayText = '';
        if (b.optionCount > 1) {
          displayText = `${b.optionCount} Opsi Pilihan &rarr; <strong>${builderInstance.escapeHtml(targetLabel)}</strong>`;
        } else {
          displayText = `"${builderInstance.escapeHtml(b.sampleText)}" &rarr; <strong>${builderInstance.escapeHtml(targetLabel)}</strong>`;
        }

        branchHtml += `
          <div class="branch-opt-row ${b.targetId === 'disabled' ? 'branch-disabled-row' : ''}" id="port-out-${sec.id}-${b.questionId}-${b.targetId}">
            <span class="opt-label-text">${displayText}</span>
            <span class="graph-port-dot-out ${dotColor}"></span>
          </div>
        `;
      });
      branchHtml += `</div>`;
    }

    // Default flow calculation
    const rawNext = sec.nextSectionId || 'next';
    let defaultNextLabel = '';
    let portColor = 'purple';
    let isFlowDisabled = false;

    if (rawNext === 'disabled') {
      defaultNextLabel = '🚫 Alur Dimatikan (Berhenti / Nonaktif)';
      portColor = 'red';
      isFlowDisabled = true;
    } else if (rawNext === 'submit') {
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

    let stageBadgeText = '';
    let stageClass = `stage-${stageNum}`;
    if (secIdx === 0) {
      stageBadgeText = 'Mulai (Tahap 1)';
    } else {
      stageBadgeText = `Tahap ${stageNum} • Bagian ${secIdx + 1}`;
    }

    node.innerHTML = `
      ${secIdx > 0 ? '<div class="graph-node-port-in"></div>' : ''}
      <div class="graph-node-top">
        <span class="graph-node-badge ${stageClass}">${stageBadgeText}</span>
        <span class="graph-node-q-count"><i data-lucide="help-circle"></i> ${secQuestions.length} Soal</span>
      </div>
      <div class="graph-node-body">
        <h4 class="graph-node-title">${builderInstance.escapeHtml(sec.title || `Bagian ${secIdx + 1}`)}</h4>
        ${sec.description ? `<p class="graph-node-desc">${builderInstance.escapeHtml(sec.description)}</p>` : ''}
        ${branchHtml}
        <div class="node-default-flow ${isFlowDisabled ? 'disabled' : ''}" id="port-default-${sec.id}">
          <i data-lucide="${isFlowDisabled ? 'slash' : 'corner-down-right'}"></i>
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
      const secQuestions = questions.filter(q => q.sectionId === sec.id);
      const uniqueBranches = this.getSectionUniqueBranches(sec, secQuestions);

      // 1. Option-Level Branch Wires (Cyan / Green)
      uniqueBranches.forEach((b) => {
        if (b.targetId === 'disabled') return; // Do not draw wire for disabled branch

        const fromPort = document.getElementById(`port-out-${sec.id}-${b.questionId}-${b.targetId}`);
        let toNode = null;
        let wireColor = 'cyan';

        if (b.targetId === 'submit') {
          toNode = document.getElementById('graph-node-submit');
          wireColor = 'green';
        } else {
          toNode = document.getElementById(`graph-node-${b.targetId}`);
        }

        if (fromPort && toNode) {
          this.connectNodesWithBezier(svgLayer, fromPort, toNode, wireColor, canvas);
        }
      });

      // 2. Section Default Navigation Wire (Purple / Green)
      const fromDefault = document.getElementById(`port-default-${sec.id}`);
      const rawNext = sec.nextSectionId || 'next';

      if (fromDefault && rawNext !== 'disabled') {
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
          if (idx < sections.length - 1) {
            const nextSec = sections[idx + 1];
            const nextNode = document.getElementById(`graph-node-${nextSec.id}`);
            if (nextNode) {
              this.connectNodesWithBezier(svgLayer, fromDefault, nextNode, 'purple', canvas);
            }
          } else {
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

    const x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / zoom;
    const y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / zoom;
    const x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / zoom;
    const y2 = (toRect.top + toRect.height / 2 - canvasRect.top) / zoom;

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
