// ============================================================================
// 한국 현대시 15선 감정 분석 연구실 — 핵심 분석 엔진, 시각화, 3D 파티클, AI 낭독
// ============================================================================

// ==================== 4. APP STATE & CHART INSTANCES ====================
    const state = {
      activeTab: 'inspector',
      selectedPoemId: POEMS[0].id,
      searchQuery: '',
      poetFilter: 'all',
      emotionFilter: 'all',
      highlightKeywords: true,
      lexiconWeight: 30, // 0~100%
      arcMode: 'line', // 'line' or 'stanza'
      compareA: POEMS[7].id,
      compareB: POEMS[10].id,
      kineticMode: 'breathe',
      kineticAmp: 1,
      ttsRate: 0.9,
      ttsVoiceURI: ''
    };
    let corpusPcaChart = null;

    let radarChart = null;
    let arcChart = null;
    let corpusStackedChart = null;
    let corpusEraChart = null;
    let compareRadarChart = null;
    let liveBarChart = null;
    let liveArcChart = null;

// ==================== 5. INITIALIZATION ====================

    const SAMPLE_POEM = {
      title: '겨울 창가의 봄',
      stanzas: [
        '차가운 밤바람이 창문을 두드리고\n멀리 떠난 그리움이 노을처럼 번질 때\n가슴 한켠은 서글프고 허전하지만',
        '어둠이 지나고 나면 새벽빛이 오듯이\n별빛 아래 홀로 서도 외롭지 않으리\n따스한 햇살을 품고 다시 피어나리라',
        '비록 가는 길이 힘들어도 걸어가겠네\n내일의 푸른 봄날을 기다리는 마음으로\n고요한 미소 지으며 평화로운 아침을 맞으리'
      ]
    };

    function renderSamplePoemPage() {
      document.getElementById('sample-poem-title').textContent = SAMPLE_POEM.title;
      document.getElementById('sample-poem-body').innerHTML = SAMPLE_POEM.stanzas.map((st, idx) => `
        <div class="flex gap-4 items-start">
          <span class="font-sans text-xs font-semibold text-stone-400 pt-1.5 w-7 shrink-0">${idx + 1}연</span>
          <p class="whitespace-pre-line">${escapeHtml(st)}</p>
        </div>
      `).join('');
    }

    function loadSampleIntoAnalyzer() {
      document.getElementById('my-poem-title').value = SAMPLE_POEM.title;
      runLiveAnalysis(SAMPLE_POEM.stanzas.join('\n\n'), true);
    }

    function init() {
      populateFilterDropdowns();
      populateCompareDropdowns();
      bindEvents();
      renderPoemList();
      renderPoemDetail();
      renderCorpusMetrics();
      renderSamplePoemPage();
      loadSampleIntoAnalyzer();
      initAmbientEngine();
      initVoiceAndKinetic();
    }

    function populateFilterDropdowns() {
      const poetSelect = document.getElementById('poet-filter');
      const uniquePoets = [...new Set(POEMS.map(p => p.poet))];
      uniquePoets.forEach(poet => {
        const opt = document.createElement('option');
        opt.value = poet;
        opt.textContent = `${poet} (${POEMS.filter(p => p.poet === poet).length}편)`;
        poetSelect.appendChild(opt);
      });

      const emotionSelect = document.getElementById('emotion-filter');
      EMOTION_KEYS.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = EMOTIONS[k].label;
        emotionSelect.appendChild(opt);
      });
    }

    function populateCompareDropdowns() {
      const selA = document.getElementById('compare-a');
      const selB = document.getElementById('compare-b');
      POEMS.forEach(p => {
        const label = `${p.poet} - 「${p.title}」`;
        const optA = new Option(label, p.id);
        const optB = new Option(label, p.id);
        selA.add(optA);
        selB.add(optB);
      });
      selA.value = state.compareA;
      selB.value = state.compareB;
    }

    function bindEvents() {
      // Tab switching
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
      });

      // Inspector filters
      document.getElementById('search-input').addEventListener('input', e => {
        state.searchQuery = e.target.value.trim();
        renderPoemList();
      });
      document.getElementById('poet-filter').addEventListener('change', e => {
        state.poetFilter = e.target.value;
        renderPoemList();
      });
      document.getElementById('emotion-filter').addEventListener('change', e => {
        state.emotionFilter = e.target.value;
        renderPoemList();
      });
      document.getElementById('highlight-toggle').addEventListener('change', e => {
        state.highlightKeywords = e.target.checked;
        renderPoemBodyOnly();
      });
      document.getElementById('reset-filters-btn').addEventListener('click', () => {
        state.searchQuery = '';
        state.poetFilter = 'all';
        state.emotionFilter = 'all';
        document.getElementById('search-input').value = '';
        document.getElementById('poet-filter').value = 'all';
        document.getElementById('emotion-filter').value = 'all';
        renderPoemList();
      });

      // Lexicon vs Interpretation weight slider
      document.getElementById('lexicon-weight-slider').addEventListener('input', e => {
        state.lexiconWeight = Number(e.target.value);
        document.getElementById('weight-lex-pct').textContent = `${state.lexiconWeight}%`;
        document.getElementById('weight-interp-pct').textContent = `${100 - state.lexiconWeight}%`;
        renderWeightedMetricsAndCharts();
      });

      // Arc mode toggle (line vs stanza)
      document.getElementById('arc-mode-line').addEventListener('click', () => {
        state.arcMode = 'line';
        updateArcToggleUI();
        renderDetailCharts();
      });
      document.getElementById('arc-mode-stanza').addEventListener('click', () => {
        state.arcMode = 'stanza';
        updateArcToggleUI();
        renderDetailCharts();
      });

      // Download generated emotion art PNG
      document.getElementById('download-art-btn').addEventListener('click', () => {
        const canvas = document.getElementById('emotion-art-canvas');
        const poem = POEMS.find(p => p.id === state.selectedPoemId);
        const link = document.createElement('a');
        link.download = `${poem ? poem.title : 'emotion-art'}_감정아트.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });

      // Comparison selectors
      document.getElementById('compare-a').addEventListener('change', e => {
        state.compareA = e.target.value;
        renderCompareView();
      });
      document.getElementById('compare-b').addEventListener('change', e => {
        state.compareB = e.target.value;
        renderCompareView();
      });

      // Live analyzer controls
      let liveTimer = null;
      document.getElementById('analyzer-input').addEventListener('input', () => {
        updateCharCount();
        clearTimeout(liveTimer);
        liveTimer = setTimeout(() => {
          runLiveAnalysis(document.getElementById('analyzer-input').value, false);
        }, 150);
      });
      document.getElementById('analyzer-run-btn').addEventListener('click', () => {
        const inputEl = document.getElementById('analyzer-input');
        const text = inputEl.value;
        if (!text.trim()) {
          showLiveNotice('amber', '분석할 시 본문을 먼저 입력해 주세요.');
          inputEl.focus();
          return;
        }
        runLiveAnalysis(text, false);
      });
      document.getElementById('live-download-art-btn').addEventListener('click', () => {
        const canvas = document.getElementById('live-emotion-art-canvas');
        const link = document.createElement('a');
        link.download = '내시_감정아트.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
      document.getElementById('analyzer-load-sample-btn').addEventListener('click', loadSampleIntoAnalyzer);
      document.getElementById('sample-to-analyzer-btn').addEventListener('click', () => {
        loadSampleIntoAnalyzer();
        switchTab('analyzer');
      });
      document.getElementById('analyzer-clear-btn').addEventListener('click', () => {
        document.getElementById('my-poem-title').value = '';
        document.getElementById('analyzer-input').value = '';
        updateCharCount();
        runLiveAnalysis('', false);
      });
    }

    function switchTab(tabName) {
      if (typeof stopPoemSpeech === 'function') stopPoemSpeech();
      state.activeTab = tabName;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        const active = btn.dataset.tab === tabName;
        btn.classList.toggle('bg-[#FAF5EB]', active);
        btn.classList.toggle('text-[#241E1B]', active);
        btn.classList.toggle('shadow-sm', active);
        btn.classList.toggle('text-[#E2D8C5]', !active);
      });

      document.getElementById('view-inspector').classList.toggle('hidden', tabName !== 'inspector');
      document.getElementById('view-corpus').classList.toggle('hidden', tabName !== 'corpus');
      document.getElementById('view-analyzer').classList.toggle('hidden', tabName !== 'analyzer');
      document.getElementById('view-rubric').classList.toggle('hidden', tabName !== 'rubric');
      const ambBtn = document.getElementById('ambient-toggle-btn');
      if (ambBtn) ambBtn.classList.toggle('hidden', tabName !== 'inspector');
      const ambCanvas = document.getElementById('ambient-particles-canvas');
      if (ambCanvas && tabName !== 'inspector') {
        ambCanvas.getContext('2d').clearRect(0, 0, ambCanvas.width, ambCanvas.height);
      }

      if (tabName === 'corpus') {
        renderCorpusCharts();
        renderCorpusPCAAndHeatmap();
        renderCompareView();
      } else if (tabName === 'inspector') {
        renderDetailCharts();
      } else if (tabName === 'analyzer') {
        runLiveAnalysis(document.getElementById('analyzer-input').value, false);
      } else if (tabName === 'rubric') {
        renderRubricView();
      }
    }

// ==================== 6. INSPECTOR RENDERING ====================
    function getFilteredPoems() {
      return POEMS.filter(p => {
        const matchPoet = state.poetFilter === 'all' || p.poet === state.poetFilter;
        const matchEmotion = state.emotionFilter === 'all' || p.dominantEmotion === state.emotionFilter;
        const q = state.searchQuery.toLowerCase();
        const matchQuery = !q ||
          p.title.toLowerCase().includes(q) ||
          p.poet.toLowerCase().includes(q) ||
          p.stanzas.join(' ').toLowerCase().includes(q);
        return matchPoet && matchEmotion && matchQuery;
      });
    }

    function renderPoemList() {
      const listEl = document.getElementById('poem-list');
      const filtered = getFilteredPoems();
      document.getElementById('poem-count-badge').textContent = `${filtered.length}편`;

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="p-8 text-center text-sm text-stone-500">조건에 맞는 작품이 없습니다.</div>`;
        return;
      }

      if (!filtered.some(p => p.id === state.selectedPoemId)) {
        state.selectedPoemId = filtered[0].id;
        renderPoemDetail();
      }

      listEl.innerHTML = filtered.map(p => {
        const em = EMOTIONS[p.dominantEmotion];
        const isSelected = p.id === state.selectedPoemId;
        return `
          <button data-poem-id="${p.id}"
            class="poem-item-btn w-full text-left px-4 py-3.5 transition flex items-start justify-between gap-3 ${isSelected ? 'bg-[#2C221E] text-[#FAF5EB] border-l-4 border-[#9E2A2B]' : 'hover:bg-stone-50 text-stone-800'}">
            <div class="min-w-0">
              <div class="font-serif-kr font-semibold text-sm truncate">${p.title}</div>
              <div class="text-xs mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}">${p.poet} · ${p.year}년</div>
            </div>
            <span class="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style="background-color: ${isSelected ? 'rgba(255,255,255,0.16)' : em.bg}; color: ${isSelected ? '#FFFFFF' : em.text};">
              ${em.label}
            </span>
          </button>
        `;
      }).join('');

      listEl.querySelectorAll('.poem-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selectedPoemId = btn.dataset.poemId;
          renderPoemList();
          renderPoemDetail();
        });
      });
    }


    function getNormalizedPercentages(emotionsObj) {
      const total = EMOTION_KEYS.reduce((acc, k) => acc + (emotionsObj[k] || 0), 0);
      if (total === 0) {
        return Object.fromEntries(EMOTION_KEYS.map(k => [k, 0]));
      }
      const raw = EMOTION_KEYS.map(k => {
        const exact = ((emotionsObj[k] || 0) / total) * 100;
        return { k, floor: Math.floor(exact), rem: exact - Math.floor(exact) };
      });
      let diff = 100 - raw.reduce((a, b) => a + b.floor, 0);
      raw.sort((a, b) => b.rem - a.rem);
      for (let i = 0; i < diff; i++) {
        raw[i].floor += 1;
      }
      return Object.fromEntries(raw.map(r => [r.k, r.floor]));
    }

    function analyzeLineEmotion(lineText) {
      const lineScores = { sorrow: 0, longing: 0, hope: 0, resistance: 0, solitude: 0, serenity: 0 };
      const matchedTerms = [];
      const matches = lineText.match(LEXICON_REGEX) || [];
      matches.forEach(term => {
        const entry = LEXICON_MAP.get(term);
        if (entry) {
          lineScores[entry.emotion] += 1;
          matchedTerms.push(entry.term);
        }
      });
      const top = [...EMOTION_KEYS].sort((a, b) => lineScores[b] - lineScores[a])[0];
      if (lineScores[top] === 0) {
        return { emotion: null, matchedTerms: [] };
      }
      return { emotion: top, matchedTerms: [...new Set(matchedTerms)] };
    }

    function renderPoemDetail() {
      if (typeof stopPoemSpeech === 'function') stopPoemSpeech();
      const poem = POEMS.find(p => p.id === state.selectedPoemId);
      if (!poem) return;
      if (typeof setAtmosphereForPoem === "function") setAtmosphereForPoem(poem.id);

      const em = EMOTIONS[poem.dominantEmotion];
      const badge = document.getElementById('detail-emotion-badge');
      badge.textContent = `주도 감정: ${em.label}`;
      badge.style.backgroundColor = em.bg;
      badge.style.color = em.text;

      document.getElementById('detail-year').textContent = `${poem.year}년`;
      const valPill = document.getElementById('detail-valence-pill');
      const valPct = Math.round(poem.valence * 100);
      valPill.textContent = `감정가 ${valPct > 0 ? '+' : ''}${valPct}`;
      valPill.style.backgroundColor = poem.valence >= 0 ? '#DCFCE7' : '#FEE2E2';
      valPill.style.color = poem.valence >= 0 ? '#166534' : '#991B1B';

      document.getElementById('detail-title').textContent = poem.title;
      document.getElementById('detail-poet').textContent = `${poem.poet} (${poem.poetYears}) · ${poem.sourceTitle}`;
      document.getElementById('detail-source-link').href = poem.sourceUrl;

      document.getElementById('detail-tone').textContent = poem.tone;
      document.getElementById('detail-imagery').textContent = poem.imagery;
      document.getElementById('detail-summary').textContent = poem.summary;
      document.getElementById('detail-theme-badge').textContent = poem.theme;

      renderWeightedMetricsAndCharts();
      renderKETDiagram(poem);

      // Render legend
      document.getElementById('emotion-legend').innerHTML = EMOTION_KEYS.map(k => `
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
          style="background-color: ${EMOTIONS[k].bg}; color: ${EMOTIONS[k].text};">
          <span class="w-2 h-2 rounded-full" style="background-color: ${EMOTIONS[k].color};"></span>
          ${EMOTIONS[k].label}
        </span>
      `).join('');

      document.getElementById('keyword-inspector').innerHTML = `
        <p class="text-stone-500 text-xs">
          💡 시 본문에서 색깔로 강조된 <strong>감정 시어</strong>를 클릭하면 해당 시어의 정서 기여도와 문학적 맥락을 확인할 수 있습니다.
        </p>
      `;

      renderPoemBodyOnly();
      renderDetailCharts();
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function splitTextToKineticSpans(text, startIdx) {
      let idx = startIdx;
      const out = [];
      for (const ch of text) {
        if (ch === ' ') {
          out.push(`<span class="k-space" aria-hidden="true">&nbsp;</span>`);
        } else {
          out.push(`<span class="k-char" data-gci="${idx}" style="--ci:${idx % 24};--gci:${idx};">${escapeHtml(ch)}</span>`);
          idx += 1;
        }
      }
      return { html: out.join(''), nextIdx: idx };
    }

    function renderKineticLine(rawLine, poem, globalCharCounter) {
      let gci = globalCharCounter.val;
      let lineHtml = '';
      if (state.highlightKeywords && poem && poem.keywords && poem.keywords.length > 0) {
        const sorted = [...poem.keywords].sort((a, b) => b.word.length - a.word.length);
        const pattern = new RegExp(`(${sorted.map(k => escapeRegExp(k.word)).join('|')})`, 'g');
        const parts = rawLine.split(pattern);
        lineHtml = parts.map(part => {
          if (!part) return '';
          const kwObj = sorted.find(k => k.word === part);
          if (kwObj) {
            const em = EMOTIONS[kwObj.emotion];
            const idx = poem.keywords.indexOf(kwObj);
            const res = splitTextToKineticSpans(part, gci);
            gci = res.nextIdx;
            return `<span class="kw-badge" data-kw-idx="${idx}" style="background-color:${em.bg}; color:${em.text}; border-bottom: 2px solid ${em.color};">${res.html}</span>`;
          } else {
            const res = splitTextToKineticSpans(part, gci);
            gci = res.nextIdx;
            return res.html;
          }
        }).join('');
      } else {
        const res = splitTextToKineticSpans(rawLine, gci);
        gci = res.nextIdx;
        lineHtml = res.html;
      }
      globalCharCounter.val = gci;
      return lineHtml;
    }

    function applyKineticClasses(containerEl) {
      if (!containerEl) return;
      containerEl.classList.remove('kinetic-breathe', 'kinetic-breeze', 'kinetic-bloom', 'kinetic-still');
      containerEl.style.setProperty('--k-amp', String(state.kineticAmp || 1));
      const modeClass = `kinetic-${state.kineticMode || 'breathe'}`;
      containerEl.classList.add(modeClass);
    }

    function renderPoemBodyOnly() {
      const poem = POEMS.find(p => p.id === state.selectedPoemId);
      if (!poem) return;

      const bodyEl = document.getElementById('detail-poem-body');
      applyKineticClasses(bodyEl);
      let globalLineNum = 0;
      const globalCharCounter = { val: 0 };

      bodyEl.innerHTML = poem.stanzas.map((stanza, sIdx) => {
        const lines = stanza.split('\n');
        const linesHtml = lines.map(rawLine => {
          const lineIdxZero = globalLineNum;
          globalLineNum += 1;
          const lineHtml = renderKineticLine(rawLine, poem, globalCharCounter);
          const lineRes = analyzeLineEmotion(rawLine);
          const emBadge = lineRes.emotion
            ? `<span class="shrink-0 w-20 text-center font-sans text-[11px] font-semibold px-2 py-0.5 rounded-full" style="background-color:${EMOTIONS[lineRes.emotion].bg}; color:${EMOTIONS[lineRes.emotion].text};" title="검출 시어: ${lineRes.matchedTerms.join(', ')}">${EMOTIONS[lineRes.emotion].label}</span>`
            : `<span class="shrink-0 w-20 text-center font-sans text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-400">중립·서술</span>`;
          return `
            <div class="poem-line-row flex items-center justify-between gap-2.5 py-1.5 border-b border-amber-900/10 last:border-b-0" data-line-idx="${lineIdxZero}" data-stanza-idx="${sIdx}">
              <div class="flex items-baseline gap-2.5 min-w-0 flex-1">
                <button type="button" class="line-play-btn font-sans text-[11px] text-stone-500 w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 select-none" data-play-line="${lineIdxZero}" title="${globalLineNum}행부터 낭독">▶</button>
                <span class="line-num-label font-sans text-[11px] text-stone-400 w-7 text-right tabular-nums shrink-0 select-none">${globalLineNum}행</span>
                <span class="poem-line leading-relaxed flex-1">${lineHtml}</span>
              </div>
              ${emBadge}
            </div>
          `;
        }).join('');
        return `
          <div class="flex gap-3 sm:gap-4 items-start py-1">
            <span class="stanza-seal text-[11px] font-serif-kr font-bold w-10 py-0.5 rounded text-center shrink-0 select-none mt-1.5">${sIdx + 1}연</span>
            <div class="flex-1 divide-y divide-amber-900/5">${linesHtml}</div>
          </div>
        `;
      }).join('');

      bodyEl.querySelectorAll('.kw-badge').forEach(el => {
        el.addEventListener('click', () => {
          const kw = poem.keywords[Number(el.dataset.kwIdx)];
          if (!kw) return;
          const em = EMOTIONS[kw.emotion];
          document.getElementById('keyword-inspector').innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div class="flex items-center gap-2">
                <span class="font-serif-kr font-bold text-base text-stone-900">「${kw.word}」</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background-color:${em.bg}; color:${em.text};">${em.label}</span>
              </div>
              <span class="text-xs font-semibold text-stone-600">정서 기여도 ${kw.weight} / 100</span>
            </div>
            <p class="text-xs sm:text-sm text-stone-700 leading-relaxed">${kw.note}</p>
          `;
        });
      });

      bodyEl.querySelectorAll('.line-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const startIdx = Number(btn.dataset.playLine);
          if (typeof startPoemSpeech === 'function') startPoemSpeech(startIdx);
        });
      });
    }

    function updateArcToggleUI() {
      const btnL = document.getElementById('arc-mode-line');
      const btnS = document.getElementById('arc-mode-stanza');
      const isLine = state.arcMode === 'line';
      btnL.className = isLine ? 'px-2 py-1 rounded-md bg-white text-stone-900 shadow-sm transition' : 'px-2 py-1 rounded-md text-stone-600 hover:text-stone-900 transition';
      btnS.className = !isLine ? 'px-2 py-1 rounded-md bg-white text-stone-900 shadow-sm transition' : 'px-2 py-1 rounded-md text-stone-600 hover:text-stone-900 transition';
    }

    function getLexiconRawScores(poem) {
      const text = poem.stanzas.join('\n');
      const scores = { sorrow: 0, longing: 0, hope: 0, resistance: 0, solitude: 0, serenity: 0 };
      const matches = text.match(LEXICON_REGEX) || [];
      matches.forEach(term => {
        const entry = LEXICON_MAP.get(term);
        if (entry) scores[entry.emotion] += 20;
      });
      return scores;
    }

    function getBlendedPercentages(poem) {
      const interpPcts = getNormalizedPercentages(poem.emotions);
      const lexRaw = getLexiconRawScores(poem);
      const lexTotal = EMOTION_KEYS.reduce((a, k) => a + lexRaw[k], 0);
      const lexPcts = lexTotal > 0 ? getNormalizedPercentages(lexRaw) : interpPcts;
      const wLex = state.lexiconWeight / 100;
      const wInterp = 1 - wLex;
      const blended = {};
      EMOTION_KEYS.forEach(k => {
        blended[k] = interpPcts[k] * wInterp + lexPcts[k] * wLex;
      });
      return getNormalizedPercentages(blended);
    }

    function getPoemLineValences(poem) {
      const lines = poem.stanzas.join('\n').split('\n').filter(l => l.trim().length > 0);
      return lines.map((line, idx) => {
        let sum = 0;
        let cnt = 0;
        const matches = line.match(LEXICON_REGEX) || [];
        matches.forEach(term => {
          const entry = LEXICON_MAP.get(term);
          if (entry) {
            sum += entry.val;
            cnt += 1;
          }
        });
        return { label: `${idx + 1}행`, val: cnt > 0 ? Number((sum / cnt).toFixed(2)) : 0 };
      });
    }

    function renderWeightedMetricsAndCharts() {
      const poem = POEMS.find(p => p.id === state.selectedPoemId);
      if (!poem) return;
      const pcts = getBlendedPercentages(poem);
      const topKey = [...EMOTION_KEYS].sort((a, b) => pcts[b] - pcts[a])[0];
      const domEm = EMOTIONS[topKey];
      const badge = document.getElementById('detail-emotion-badge');
      if (badge && domEm) {
        badge.textContent = `주도 감정: ${domEm.label} (${pcts[topKey]}%)`;
        badge.style.backgroundColor = domEm.bg;
        badge.style.color = domEm.text;
      }
      document.getElementById('detail-ratio-bar').innerHTML = EMOTION_KEYS.map(k => `
        <div style="width: ${pcts[k]}%; background-color: ${EMOTIONS[k].color};" title="${EMOTIONS[k].label}: ${pcts[k]}%"></div>
      `).join('');
      document.getElementById('detail-ratio-pills').innerHTML = EMOTION_KEYS.map(k => `
        <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-stone-100 bg-stone-50/70">
          <span class="inline-flex items-center gap-1.5 font-medium text-stone-700">
            <span class="w-2 h-2 rounded-full" style="background-color: ${EMOTIONS[k].color};"></span>
            ${EMOTIONS[k].label}
          </span>
          <span class="font-bold text-stone-900">${pcts[k]}%</span>
        </div>
      `).join('');
      renderDetailCharts();
      renderSimilarPoems(poem, pcts);
      renderEmotionArt(poem, pcts);
    }

    function renderKETDiagram(poem) {
      const container = document.getElementById('ket-diagram-container');
      const topKws = poem.keywords.slice(0, 5);
      const usedEmotions = [...new Set(topKws.map(k => k.emotion))];
      const w = 700, h = 230;
      const kwYs = topKws.map((_, i) => 28 + i * ((h - 56) / Math.max(topKws.length - 1, 1)));
      const emYs = usedEmotions.map((_, i) => 45 + i * ((h - 90) / Math.max(usedEmotions.length - 1, 1)));
      const themeY = h / 2;

      let paths = '';
      topKws.forEach((kw, i) => {
        const emIdx = usedEmotions.indexOf(kw.emotion);
        const y1 = kwYs[i];
        const y2 = emYs[emIdx];
        const c = EMOTIONS[kw.emotion].color;
        paths += `<path d="M 155 ${y1} C 235 ${y1}, 235 ${y2}, 315 ${y2}" fill="none" stroke="${c}" stroke-width="2" stroke-opacity="0.55" />`;
      });
      usedEmotions.forEach((ek, i) => {
        const y1 = emYs[i];
        const c = EMOTIONS[ek].color;
        paths += `<path d="M 435 ${y1} C 495 ${y1}, 495 ${themeY}, 545 ${themeY}" fill="none" stroke="${c}" stroke-width="2.5" stroke-opacity="0.7" />`;
      });

      const kwNodes = topKws.map((kw, i) => {
        const em = EMOTIONS[kw.emotion];
        return `
          <g transform="translate(10, ${kwYs[i] - 14})">
            <rect width="145" height="28" rx="8" fill="${em.bg}" stroke="${em.color}" stroke-width="1.2" />
            <text x="72.5" y="18" text-anchor="middle" font-size="11.5" font-weight="600" fill="${em.text}">${escapeHtml(kw.word.slice(0, 10))}</text>
          </g>
        `;
      }).join('');

      const emNodes = usedEmotions.map((ek, i) => {
        const em = EMOTIONS[ek];
        return `
          <g transform="translate(315, ${emYs[i] - 15})">
            <rect width="120" height="30" rx="15" fill="${em.color}" />
            <text x="60" y="19" text-anchor="middle" font-size="11.5" font-weight="700" fill="#FFFFFF">${em.label}</text>
          </g>
        `;
      }).join('');

      const shortTheme = poem.theme.replace('주제: ', '');
      const themeChunks = shortTheme.length > 14 ? [shortTheme.slice(0, 14), shortTheme.slice(14, 28) + (shortTheme.length > 28 ? '…' : '')] : [shortTheme];
      const themeNode = `
        <g transform="translate(545, ${themeY - 34})">
          <rect width="145" height="68" rx="12" fill="#2C221E" stroke="#B08D57" stroke-width="1.5" />
          <text x="72.5" y="22" text-anchor="middle" font-size="10" font-weight="600" fill="#FDE68A">핵심 주제</text>
          <text x="72.5" y="40" text-anchor="middle" font-size="11" font-weight="600" fill="#FFFFFF">${escapeHtml(themeChunks[0])}</text>
          ${themeChunks[1] ? `<text x="72.5" y="56" text-anchor="middle" font-size="11" font-weight="600" fill="#FFFFFF">${escapeHtml(themeChunks[1])}</text>` : ''}
        </g>
      `;

      container.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" class="w-full min-w-[540px] h-auto select-none" style="font-family: 'Noto Sans KR', sans-serif;">
          ${paths}${kwNodes}${emNodes}${themeNode}
        </svg>
      `;
    }

    function cosineSim(vecA, vecB) {
      let dot = 0, normA = 0, normB = 0;
      EMOTION_KEYS.forEach(k => {
        dot += vecA[k] * vecB[k];
        normA += vecA[k] * vecA[k];
        normB += vecB[k] * vecB[k];
      });
      return (normA && normB) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    }

    function renderSimilarPoems(currentPoem, currentPcts) {
      const scored = POEMS.filter(p => p.id !== currentPoem.id).map(p => ({
        poem: p,
        sim: cosineSim(currentPcts, getBlendedPercentages(p))
      })).sort((a, b) => b.sim - a.sim).slice(0, 3);

      const listEl = document.getElementById('similar-poems-list');
      listEl.innerHTML = scored.map(({ poem, sim }) => {
        const em = EMOTIONS[poem.dominantEmotion];
        const simPct = Math.round(sim * 100);
        return `
          <button data-jump-id="${poem.id}" class="jump-poem-btn w-full text-left p-3 rounded-xl border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-serif-kr font-bold text-sm text-stone-900 truncate">${poem.title}</div>
              <div class="text-xs text-stone-500">${poem.poet} · <span style="color:${em.text};" class="font-medium">${em.label}</span></div>
            </div>
            <span class="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-stone-900 text-white">유사도 ${simPct}%</span>
          </button>
        `;
      }).join('');

      listEl.querySelectorAll('.jump-poem-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selectedPoemId = btn.dataset.jumpId;
          renderPoemList();
          renderPoemDetail();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }

    function renderEmotionArt(poem, pcts, canvasId = "emotion-art-canvas") {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Sort emotions by percentage descending so dominant emotion sets the base tone
      const totalPct = EMOTION_KEYS.reduce((a, k) => a + (pcts[k] || 0), 0);
      if (totalPct === 0) {
        ctx.fillStyle = '#F7F4EC';
        ctx.fillRect(0, 0, W, H);
        return;
      }
      const ranked = [...EMOTION_KEYS].sort((a, b) => pcts[b] - pcts[a]);
      const baseColor = EMOTIONS[ranked[0]].color;

      // Base soft color wash
      const baseGrad = ctx.createLinearGradient(0, 0, W, H);
      baseGrad.addColorStop(0, baseColor + '24');
      baseGrad.addColorStop(1, EMOTIONS[ranked[1]].color + '24');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, W, H);

      // Deterministic seed from poem id
      let seed = 0;
      for (let i = 0; i < poem.id.length; i++) seed = (seed * 31 + poem.id.charCodeAt(i)) % 9973;
      const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

      // Pure color-field washes proportional to each emotion's percentage (no text, no lines)
      ranked.forEach(k => {
        const pct = pcts[k];
        if (pct <= 0) return;
        const count = Math.max(1, Math.round(pct / 15));
        for (let c = 0; c < count; c++) {
          const radius = 55 + pct * 2.6 + rand() * 45;
          const cx = rand() * W;
          const cy = rand() * H;
          const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
          grad.addColorStop(0, EMOTIONS[k].color + 'CC');
          grad.addColorStop(0.55, EMOTIONS[k].color + '66');
          grad.addColorStop(1, EMOTIONS[k].color + '00');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        }
      });
    }

    function compute2DPCA() {
      const n = POEMS.length;
      const d = EMOTION_KEYS.length;
      const X = POEMS.map(p => EMOTION_KEYS.map(k => p.emotions[k]));
      const means = Array(d).fill(0);
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < n; i++) means[j] += X[i][j] / n;
      }
      const stds = Array(d).fill(0);
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < n; i++) stds[j] += Math.pow(X[i][j] - means[j], 2) / n;
        stds[j] = Math.sqrt(stds[j]) || 1;
      }
      const Z = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

      // Covariance matrix (d x d)
      const C = Array.from({ length: d }, () => Array(d).fill(0));
      for (let a = 0; a < d; a++) {
        for (let b = 0; b < d; b++) {
          for (let i = 0; i < n; i++) C[a][b] += (Z[i][a] * Z[i][b]) / n;
        }
      }

      function powerIter(mat, orthoVec = null) {
        let v = Array.from({ length: d }, (_, i) => (i + 1) * 0.37);
        for (let iter = 0; iter < 50; iter++) {
          let nv = Array(d).fill(0);
          for (let i = 0; i < d; i++) {
            for (let j = 0; j < d; j++) nv[i] += mat[i][j] * v[j];
          }
          if (orthoVec) {
            const proj = nv.reduce((s, x, i) => s + x * orthoVec[i], 0);
            nv = nv.map((x, i) => x - proj * orthoVec[i]);
          }
          const norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) || 1;
          v = nv.map(x => x / norm);
        }
        return v;
      }

      const pc1 = powerIter(C);
      const pc2 = powerIter(C, pc1);
      const eigenVal = (v) => {
        let num = 0;
        for (let i = 0; i < d; i++) {
          let rowSum = 0;
          for (let j = 0; j < d; j++) rowSum += C[i][j] * v[j];
          num += v[i] * rowSum;
        }
        return num;
      };
      const totalVar = C.reduce((s, row, i) => s + row[i], 0) || 1;
      const var1 = Math.round((eigenVal(pc1) / totalVar) * 100);
      const var2 = Math.round((eigenVal(pc2) / totalVar) * 100);

      return {
        coords: POEMS.map((p, i) => ({
          poem: p,
          x: Number(Z[i].reduce((s, v, j) => s + v * pc1[j], 0).toFixed(2)),
          y: Number(Z[i].reduce((s, v, j) => s + v * pc2[j], 0).toFixed(2))
        })),
        pc1, pc2, var1, var2
      };
    }

    function describePCAxis(vec) {
      const ranked = EMOTION_KEYS.map((k, i) => ({ k, label: EMOTIONS[k].label, w: vec[i] }));
      const pos = [...ranked].sort((a, b) => b.w - a.w)[0];
      const neg = [...ranked].sort((a, b) => a.w - b.w)[0];
      return { pos, neg };
    }

    function renderCorpusPCAAndHeatmap() {
      // 1. PCA Scatter
      const { coords, pc1, pc2, var1, var2 } = compute2DPCA();
      const ax1 = describePCAxis(pc1);
      const ax2 = describePCAxis(pc2);
      const expEl = document.getElementById('pca-axis-explanation');
      if (expEl) {
        expEl.innerHTML = `
          <div><strong>PC1 (${var1}% 설명):</strong> (+) ${ax1.pos.label} ↔ (-) ${ax1.neg.label}</div>
          <div><strong>PC2 (${var2}% 설명):</strong> (+) ${ax2.pos.label} ↔ (-) ${ax2.neg.label}</div>
        `;
      }
      if (corpusPcaChart) corpusPcaChart.destroy();
      corpusPcaChart = new Chart(document.getElementById('corpus-pca-chart'), {
        type: 'scatter',
        data: {
          datasets: EMOTION_KEYS.map(k => ({
            label: EMOTIONS[k].label,
            data: coords.filter(c => c.poem.dominantEmotion === k).map(c => ({
              x: c.x, y: c.y, id: c.poem.id, title: `${c.poem.poet} 「${c.poem.title}」`
            })),
            backgroundColor: EMOTIONS[k].color,
            pointRadius: 7,
            pointHoverRadius: 10
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt, elems) => {
            if (elems.length > 0) {
              const dsIdx = elems[0].datasetIndex;
              const ptIdx = elems[0].index;
              const clicked = corpusPcaChart.data.datasets[dsIdx].data[ptIdx];
              if (clicked && clicked.id) {
                state.selectedPoemId = clicked.id;
                switchTab('inspector');
                renderPoemList();
                renderPoemDetail();
              }
            }
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: {
              callbacks: { label: ctx => `${ctx.raw.title} (PC1: ${ctx.raw.x}, PC2: ${ctx.raw.y})` }
            }
          },
          scales: {
            x: { title: { display: true, text: `PC1 (${ax1.neg.label} ↔ ${ax1.pos.label})` } },
            y: { title: { display: true, text: `PC2 (${ax2.neg.label} ↔ ${ax2.pos.label})` } }
          }
        }
      });

      // 2. Heatmap Table
      const hmEl = document.getElementById('corpus-heatmap-container');
      hmEl.innerHTML = `
        <table class="w-full text-xs border-collapse">
          <thead class="sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
            <tr>
              <th class="py-2 px-2.5 text-left font-semibold text-stone-600">작품 (시인)</th>
              ${EMOTION_KEYS.map(k => `<th class="py-2 px-2 text-center font-semibold" style="color:${EMOTIONS[k].text};">${EMOTIONS[k].label.split('·')[0]}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            ${POEMS.map(p => {
              const pcts = getNormalizedPercentages(p.emotions);
              return `
                <tr data-hm-id="${p.id}" class="hm-row cursor-pointer hover:bg-stone-50 transition">
                  <td class="py-2 px-2.5 font-medium text-stone-800 whitespace-nowrap">${p.title} <span class="text-stone-400">(${p.poet})</span></td>
                  ${EMOTION_KEYS.map(k => {
                    const val = pcts[k];
                    const alpha = Math.min(0.88, 0.08 + (val / 45) * 0.8).toFixed(2);
                    const textCol = val >= 24 ? '#FFFFFF' : '#1C1917';
                    return `<td class="py-2 px-2 text-center font-semibold rounded-sm" style="background-color: ${EMOTIONS[k].color}${Math.round(Number(alpha)*255).toString(16).padStart(2,'0')}; color:${textCol};">${val}%</td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      hmEl.querySelectorAll('.hm-row').forEach(row => {
        row.addEventListener('click', () => {
          state.selectedPoemId = row.dataset.hmId;
          switchTab('inspector');
          renderPoemList();
          renderPoemDetail();
        });
      });
    }

    function renderDetailCharts() {
      const poem = POEMS.find(p => p.id === state.selectedPoemId);
      if (!poem) return;

      const labels = EMOTION_KEYS.map(k => EMOTIONS[k].label);
      const pcts = getBlendedPercentages(poem);
      const data = EMOTION_KEYS.map(k => pcts[k]);
      const domColor = EMOTIONS[poem.dominantEmotion].color;

      if (radarChart) radarChart.destroy();
      radarChart = new Chart(document.getElementById('radar-chart'), {
        type: 'radar',
        data: {
          labels,
          datasets: [{
            label: poem.title,
            data,
            backgroundColor: domColor + '28',
            borderColor: domColor,
            pointBackgroundColor: domColor,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0,
              max: Math.max(40, Math.ceil(Math.max(...data) / 10) * 10),
              ticks: { stepSize: 10, display: true, callback: v => v + '%', backdropColor: 'transparent', font: { size: 9 } },
              pointLabels: { font: { size: 11, family: 'Noto Sans KR' } }
            }
          }
        }
      });

      const lineSeries = getPoemLineValences(poem);
      const arcLabels = state.arcMode === 'line' ? lineSeries.map(x => x.label) : poem.stanzaValence.map((_, i) => `${i + 1}연`);
      const arcValues = state.arcMode === 'line' ? lineSeries.map(x => x.val) : poem.stanzaValence;
      if (arcChart) arcChart.destroy();
      arcChart = new Chart(document.getElementById('arc-chart'), {
        type: 'line',
        data: {
          labels: arcLabels,
          datasets: [{
            label: state.arcMode === 'line' ? '행별 감정가' : '연별 감정가',
            data: arcValues,
            borderColor: domColor,
            backgroundColor: domColor + '20',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: domColor
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: -1,
              max: 1,
              ticks: { stepSize: 0.5 },
              grid: { color: '#F3EFE6' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }

// ==================== 7. CORPUS COMPARISON ====================
    function renderCorpusMetrics() {
      const avgVal = POEMS.reduce((acc, p) => acc + p.valence, 0) / POEMS.length;
      const avgPct = Math.round(avgVal * 100);
      document.getElementById('kpi-avg-valence').textContent = `${avgPct > 0 ? '+' : ''}${avgPct} / 100`;

      const counts = {};
      POEMS.forEach(p => { counts[p.dominantEmotion] = (counts[p.dominantEmotion] || 0) + 1; });
      const topKey = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      document.getElementById('kpi-top-emotion').textContent = EMOTIONS[topKey].label;
      document.getElementById('kpi-top-emotion-count').textContent = `15편 중 ${counts[topKey]}편`;
    }

    function renderCorpusCharts() {
      const labels = POEMS.map(p => `${p.poet}·${p.title.slice(0, 7)}${p.title.length > 7 ? '…' : ''}`);
      const datasets = EMOTION_KEYS.map(k => ({
        label: EMOTIONS[k].label,
        data: POEMS.map(p => getNormalizedPercentages(p.emotions)[k]),
        backgroundColor: EMOTIONS[k].color
      }));

      if (corpusStackedChart) corpusStackedChart.destroy();
      corpusStackedChart = new Chart(document.getElementById('corpus-stacked-chart'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          },
          scales: {
            x: { stacked: true, max: 100, ticks: { callback: v => v + '%' } },
            y: { stacked: true, ticks: { font: { size: 11 } } }
          }
        }
      });

      const sortedByYear = [...POEMS].sort((a, b) => a.year - b.year);
      if (corpusEraChart) corpusEraChart.destroy();
      corpusEraChart = new Chart(document.getElementById('corpus-era-chart'), {
        type: 'scatter',
        data: {
          datasets: EMOTION_KEYS.map(k => ({
            label: EMOTIONS[k].label,
            data: sortedByYear
              .filter(p => p.dominantEmotion === k)
              .map(p => ({ x: p.year, y: p.valence, title: `${p.poet} 「${p.title}」` })),
            backgroundColor: EMOTIONS[k].color,
            pointRadius: 7,
            pointHoverRadius: 9
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.raw.title} (${ctx.raw.x}년, 감정가 ${ctx.raw.y})`
              }
            }
          },
          scales: {
            x: { min: 1923, max: 1946, ticks: { stepSize: 3, callback: v => `${v}년` } },
            y: { min: -1, max: 1, title: { display: true, text: '감정가 (부정 ↔ 긍정)' } }
          }
        }
      });
    }

    function renderCompareView() {
      const pA = POEMS.find(p => p.id === state.compareA);
      const pB = POEMS.find(p => p.id === state.compareB);
      if (!pA || !pB) return;

      if (compareRadarChart) compareRadarChart.destroy();
      compareRadarChart = new Chart(document.getElementById('compare-radar-chart'), {
        type: 'radar',
        data: {
          labels: EMOTION_KEYS.map(k => EMOTIONS[k].label),
          datasets: [
            {
              label: `${pA.poet} 「${pA.title}」`,
              data: EMOTION_KEYS.map(k => pA.emotions[k]),
              borderColor: '#1E3A8A',
              backgroundColor: 'rgba(30, 58, 138, 0.18)',
              borderWidth: 2
            },
            {
              label: `${pB.poet} 「${pB.title}」`,
              data: EMOTION_KEYS.map(k => pB.emotions[k]),
              borderColor: '#B91C1C',
              backgroundColor: 'rgba(185, 28, 28, 0.18)',
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: { r: { min: 0, max: 100, ticks: { display: false } } }
        }
      });

      const tableEl = document.getElementById('compare-table-container');
      tableEl.innerHTML = `
        <table class="w-full text-xs sm:text-sm text-left border-collapse">
          <thead>
            <tr class="border-b border-stone-200 text-stone-500">
              <th class="py-2 pr-3 font-medium">비교 항목</th>
              <th class="py-2 px-3 font-semibold text-blue-900">${pA.poet} 「${pA.title}」</th>
              <th class="py-2 pl-3 font-semibold text-red-800">${pB.poet} 「${pB.title}」</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr>
              <td class="py-2.5 pr-3 text-stone-500">발표 연도</td>
              <td class="py-2.5 px-3 font-medium">${pA.year}년</td>
              <td class="py-2.5 pl-3 font-medium">${pB.year}년</td>
            </tr>
            <tr>
              <td class="py-2.5 pr-3 text-stone-500">주도 감정</td>
              <td class="py-2.5 px-3 font-semibold">${EMOTIONS[pA.dominantEmotion].label}</td>
              <td class="py-2.5 pl-3 font-semibold">${EMOTIONS[pB.dominantEmotion].label}</td>
            </tr>
            <tr>
              <td class="py-2.5 pr-3 text-stone-500">감정가</td>
              <td class="py-2.5 px-3 font-semibold">${Math.round(pA.valence * 100)}</td>
              <td class="py-2.5 pl-3 font-semibold">${Math.round(pB.valence * 100)}</td>
            </tr>
            <tr>
              <td class="py-2.5 pr-3 text-stone-500">어조</td>
              <td class="py-2.5 px-3">${pA.tone}</td>
              <td class="py-2.5 pl-3">${pB.tone}</td>
            </tr>
            <tr>
              <td class="py-2.5 pr-3 text-stone-500">핵심 심상</td>
              <td class="py-2.5 px-3">${pA.imagery}</td>
              <td class="py-2.5 pl-3">${pB.imagery}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

// ==================== 8. LIVE KOREAN POEM ANALYZER ====================
    function updateCharCount() {
      const text = document.getElementById('analyzer-input').value;
      const lines = text.trim() ? text.trim().split(/\n+/).length : 0;
      document.getElementById('analyzer-char-count').textContent = `${text.length}자 · ${lines}행`;
    }

    function showLiveNotice(tone, msg) {
      const box = document.getElementById('live-notice-box');
      if (!box) return;
      if (!msg) {
        box.classList.add('hidden');
        box.textContent = '';
        return;
      }
      box.classList.remove('hidden', 'bg-amber-50', 'border-amber-200', 'text-amber-900', 'bg-stone-100', 'border-stone-200', 'text-stone-700');
      if (tone === 'amber') {
        box.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-900');
      } else {
        box.classList.add('bg-stone-100', 'border-stone-200', 'text-stone-700');
      }
      box.textContent = msg;
    }

    function runLiveAnalysis(text, setTextarea) {
      if (setTextarea) {
        document.getElementById('analyzer-input').value = text;
        updateCharCount();
      }

      const trimmed = text.trim();
      const scores = { sorrow: 0, longing: 0, hope: 0, resistance: 0, solitude: 0, serenity: 0 };
      let totalHits = 0;
      let valSum = 0;

      if (!trimmed) {
        updateLiveUI(scores, 0, 0, [], [], []);
        return;
      }

      const lines = trimmed.split(/\n+/).filter(l => l.trim().length > 0);
      const contextNotes = [];
      const lineValences = lines.map(line => {
        let lSum = 0;
        let lCount = 0;
        // 1) Context phrase & negation/concessive rules first
        CONTEXT_RULES.forEach(rule => {
          const cm = line.match(rule.regex);
          if (cm) {
            scores[rule.emotion] += cm.length * rule.weight;
            totalHits += cm.length;
            valSum += rule.val * cm.length;
            lSum += rule.val * cm.length;
            lCount += cm.length;
            if (!contextNotes.includes(rule.label)) contextNotes.push(rule.label);
          }
        });
        // 2) Lexicon word matching (longest-first single regex)
        const matches = line.match(LEXICON_REGEX) || [];
        matches.forEach(term => {
          const entry = LEXICON_MAP.get(term);
          if (entry) {
            scores[entry.emotion] += 18;
            totalHits += 1;
            valSum += entry.val;
            lSum += entry.val;
            lCount += 1;
          }
        });
        return lCount > 0 ? Number((lSum / lCount).toFixed(2)) : 0;
      });

      // Normalize scores so total sum = 100%
      const normScores = getNormalizedPercentages(scores);

      const avgVal = totalHits > 0 ? valSum / totalHits : 0;
      updateLiveUI(normScores, totalHits, avgVal, lines, lineValences, contextNotes);
    }

    function updateLiveUI(scores, totalHits, avgVal, lines, lineValences, contextNotes = []) {
      const ctxEl = document.getElementById('live-context-notes');
      if (ctxEl) {
        if (contextNotes.length > 0) {
          ctxEl.classList.remove('hidden');
          ctxEl.classList.add('flex');
          ctxEl.innerHTML = contextNotes.map(n => `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-medium">맥락 판독: ${n}</span>`).join('');
        } else {
          ctxEl.classList.add('hidden');
          ctxEl.classList.remove('flex');
          ctxEl.innerHTML = '';
        }
      }
      const domBadge = document.getElementById('live-dominant-badge');
      const valText = document.getElementById('live-valence-text');
      document.getElementById('live-hit-count').textContent = `${totalHits}개`;

      if (lines.length === 0) {
        showLiveNotice(null, '');
      } else if (totalHits === 0) {
        showLiveNotice('stone', '감정 사전에 등록된 시어가 감지되지 않았습니다. 감정을 드러내는 시어를 추가해 보세요.');
      } else {
        showLiveNotice(null, '');
      }

      if (totalHits === 0) {
        domBadge.textContent = '분석 대기 / 중립';
        domBadge.style.backgroundColor = '#F5F5F4';
        domBadge.style.color = '#57534E';
        valText.textContent = '';
      } else {
        const topKey = [...EMOTION_KEYS].sort((a, b) => scores[b] - scores[a])[0];
        const em = EMOTIONS[topKey];
        domBadge.textContent = em.label;
        domBadge.style.backgroundColor = em.bg;
        domBadge.style.color = em.text;
        const pct = Math.round(avgVal * 100);
        valText.textContent = `감정가 ${pct > 0 ? '+' : ''}${pct}`;
      }

      // Live Bar Chart
      if (liveBarChart) liveBarChart.destroy();
      liveBarChart = new Chart(document.getElementById('live-bar-chart'), {
        type: 'bar',
        data: {
          labels: EMOTION_KEYS.map(k => EMOTIONS[k].label),
          datasets: [{
            data: EMOTION_KEYS.map(k => scores[k]),
            backgroundColor: EMOTION_KEYS.map(k => EMOTIONS[k].color),
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 100 } }
        }
      });

      // Live Arc Chart
      if (liveArcChart) liveArcChart.destroy();
      liveArcChart = new Chart(document.getElementById('live-arc-chart'), {
        type: 'line',
        data: {
          labels: lines.map((_, i) => `${i + 1}행`),
          datasets: [{
            data: lineValences,
            borderColor: '#1C1917',
            backgroundColor: 'rgba(28, 25, 23, 0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: -1, max: 1 } }
        }
      });

      // Highlighted output
      const outEl = document.getElementById('live-highlighted-output');
      if (lines.length === 0) {
        outEl.innerHTML = `<span class="text-stone-400">텍스트를 입력하면 검출된 감성 시어가 색상으로 표시됩니다.</span>`;
        renderEmotionArt({ id: 'live-empty' }, scores, 'live-emotion-art-canvas');
        return;
      }

      const sortedLex = [...LIVE_LEXICON].sort((a, b) => b.term.length - a.term.length);
      const pattern = new RegExp(`(${sortedLex.map(l => escapeRegExp(l.term)).join('|')})`, 'g');
      applyKineticClasses(outEl);
      let liveGci = 0;
      outEl.innerHTML = lines.map((line, lIdx) => {
        const parts = line.split(pattern);
        const lineHtml = parts.map(part => {
          if (!part) return '';
          const hit = sortedLex.find(l => l.term === part);
          const res = splitTextToKineticSpans(part, liveGci);
          liveGci = res.nextIdx;
          if (hit) {
            const em = EMOTIONS[hit.emotion];
            return `<span class="px-1 rounded font-semibold" style="background-color:${em.bg}; color:${em.text};">${res.html}</span>`;
          }
          return res.html;
        }).join('');
        return `<div class="live-poem-line py-0.5 rounded px-1.5 transition" data-live-line="${lIdx}">${lineHtml}</div>`;
      }).join('');

      const simBox = document.getElementById('live-similar-poems');
      if (simBox) {
        if (totalHits === 0) {
          simBox.innerHTML = `<p class="text-xs text-stone-500">감지된 감정 시어가 없어 유사한 수록 시를 계산할 수 없습니다.</p>`;
        } else {
          const ranked = POEMS.map(p => ({
            poem: p,
            sim: cosineSim(scores, getBlendedPercentages(p))
          })).sort((a, b) => b.sim - a.sim).slice(0, 3);
          simBox.innerHTML = ranked.map(({ poem, sim }) => {
            const em = EMOTIONS[poem.dominantEmotion];
            const simPct = Math.round(sim * 100);
            return `
              <button type="button" data-live-jump="${poem.id}" class="live-jump-btn w-full text-left p-2.5 rounded-xl border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-serif-kr font-bold text-xs sm:text-sm text-stone-900 truncate">${poem.title}</div>
                  <div class="text-[11px] text-stone-500">${poem.poet} · <span style="color:${em.text};" class="font-medium">${em.label}</span></div>
                </div>
                <span class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-900 text-white">유사도 ${simPct}%</span>
              </button>
            `;
          }).join('');
          simBox.querySelectorAll('.live-jump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              state.selectedPoemId = btn.dataset.liveJump;
              switchTab('inspector');
              renderPoemList();
              renderPoemDetail();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          });
        }
      }

      const liveSeedId = 'live-' + lines.join('').slice(0, 16);
      renderEmotionArt({ id: liveSeedId }, scores, 'live-emotion-art-canvas');
    }

// ==================== 9. RUBRIC VIEW (CATEGORIES, LEXICON, VALIDATION) ====================
    const VALIDATION_CASES = [
      {
        poem: '김소월 「진달래꽃」',
        computed: '슬픔·애상과 함께 "고이 보내드리오리다", "진달래꽃" 등이 긍정/서정으로 분산됨',
        actual: '이별의 극한 고통을 반어법("죽어도 아니 눈물 흘리오리다")으로 승화한 슬픔·애상(한)',
        cause: '단어 단위 사전 매칭이 "아니 ~ 흘리오리다"와 같은 부정·반어 문법 구조와 문맥적 역설을 인식하지 못함.',
        improvement: '부정어("아니", "못") 및 종결어미 결합 규칙을 추가하고, 반어 구문에 슬픔 가중치를 부여하는 바이그램(2-gram) 규칙을 적용합니다.'
      },
      {
        poem: '김영랑 「모란이 피기까지는」',
        computed: '"찬란한(희망)", "봄(희망)"과 "설움(슬픔)", "우옵내다(슬픔)"가 상충하여 정서가 양분됨',
        actual: '아름다움에 대한 기다림과 낙화의 상실감이 결합된 역설적 비애("찬란한 슬픔의 봄")',
        cause: '수식어("찬란한")와 피수식어("슬픔")가 독립적으로 점수화되어 옥시모론(모순형용)의 복합 정서를 포착하지 못함.',
        improvement: '"찬란한 슬픔"과 같은 문학적 구(phrase) 단위 복합 감성 사전을 별도 등록해 단일 어휘보다 우선 매칭합니다.'
      },
      {
        poem: '이상 「거울」',
        computed: '"거울", "조용" 외 다수 행이 중립·서술로 판별되어 고독 점수가 실제보다 낮게 산출됨',
        actual: '거울 속 자아와의 단절을 통해 근대인의 실존적 분열과 깊은 고독·소외를 그린 모더니즘 시',
        cause: '"왼손잡이", "악수를 모르는", "외로된 사업" 등 추상적·비유적 상징어가 전통 서정시 위주의 사전에 충분히 반영되지 않음.',
        improvement: '작가·사조별 확장 시어 사전을 구축하고, 부정 서술어("못 알아듣는", "모르는", "없소")의 소외 가중치를 보완합니다.'
      },
      {
        poem: '심훈 「그날이 오면」',
        computed: '"두개골은 깨어져", "가죽이라도 벗겨서" 등 신체 훼손 어휘가 부정(슬픔/공포)으로 편향됨',
        actual: '광복의 기쁨과 민족 독립을 향한 숭고한 저항 의지 및 희생정신',
        cause: '양보절("-아도/-어도") 뒤에 이어지는 화자의 의지적 서술("무슨 한이 남으오리까", "앞장을 서오리다")과 구별하지 못함.',
        improvement: '문장 내 양보/조건 연결어미 뒤의 주절 극성에 더 높은 가중치를 부여하는 절 단위 분석 규칙을 도입합니다.'
      }
    ];

    function renderRubricView() {
      // 1. Categories
      document.getElementById('rubric-categories-grid').innerHTML = EMOTION_KEYS.map((k, idx) => {
        const em = EMOTIONS[k];
        return `
          <div class="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold px-2.5 py-1 rounded-full" style="background-color:${em.bg}; color:${em.text};">
                ${idx + 1}. ${em.label}
              </span>
            </div>
            <p class="text-xs sm:text-sm text-stone-700 leading-relaxed pt-1">${em.def}</p>
          </div>
        `;
      }).join('');

      // 2. Lexicon
      document.getElementById('rubric-lexicon-total').textContent = `총 ${LIVE_LEXICON.length}개 시어 등록`;
      document.getElementById('rubric-lexicon-grid').innerHTML = EMOTION_KEYS.map(k => {
        const em = EMOTIONS[k];
        const terms = LIVE_LEXICON.filter(l => l.emotion === k).map(l => l.term);
        return `
          <div class="p-4 rounded-xl border border-stone-200 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full" style="background-color:${em.bg}; color:${em.text};">${em.label}</span>
              <span class="text-xs font-semibold text-stone-600">${terms.length}개</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              ${terms.map(t => `<span class="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">${t}</span>`).join('')}
            </div>
          </div>
        `;
      }).join('');

      // 3. Validation Cases
      document.getElementById('rubric-validation-list').innerHTML = VALIDATION_CASES.map((c, idx) => `
        <div class="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-2 text-xs sm:text-sm">
          <div class="flex items-center justify-between border-b border-stone-200 pb-2">
            <span class="font-bold text-stone-900 font-serif-kr">사례 ${idx + 1}. ${c.poem}</span>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">오분류·불일치</span>
          </div>
          <p><strong class="text-stone-700">계산 결과:</strong> <span class="text-stone-600">${c.computed}</span></p>
          <p><strong class="text-stone-700">실제 해석:</strong> <span class="text-stone-600">${c.actual}</span></p>
          <p><strong class="text-stone-700">원인:</strong> <span class="text-stone-600">${c.cause}</span></p>
          <p><strong class="text-emerald-800">개선 방법:</strong> <span class="text-stone-700">${c.improvement}</span></p>
        </div>
      `).join('');
    }

// ==================== 10. 3D SEASONAL & POETIC AMBIENT PARTICLE ENGINE ====================
    const BG_PHOTOS = {
      spring: "./assets/bg/spring.jpg",
      night: "./assets/bg/night.jpg",
      winter: "./assets/bg/winter.jpg",
      sea: "./assets/bg/sea.jpg",
      autumn: "./assets/bg/autumn.jpg"
    };

    const POEM_ATMOSPHERE = {
      'sanghwa-spring':       { type: 'petals',  icon: '🌸', label: '봄 꽃잎 흩날림',   bg: BG_PHOTOS.spring, colors: ['#F4B4C4', '#FCE0E8', '#E98FA7'] },
      'leejanghee-cat':       { type: 'petals',  icon: '🌸', label: '따스한 봄 햇살',   bg: BG_PHOTOS.spring, colors: ['#FAD0C4', '#FFE5B4', '#F7B7C5'] },
      'yeongrang-peony':      { type: 'peony',   icon: '🌺', label: '모란 꽃잎 낙화',   bg: BG_PHOTOS.spring, colors: ['#D95B72', '#F08FA1', '#B83B53'] },
      'yeongrang-stonewall':  { type: 'petals',  icon: '🌼', label: '봄길 꽃바람',     bg: BG_PHOTOS.spring, colors: ['#FDE68A', '#FBCFE8', '#A7F3D0'] },
      'sowol-azalea':         { type: 'peony',   icon: '🌺', label: '진달래 꽃비',     bg: BG_PHOTOS.spring, colors: ['#E06C9F', '#F3A6C8', '#C4457B'] },
      'sowol-mountainflower': { type: 'petals',  icon: '🍃', label: '산꽃과 바람',     bg: BG_PHOTOS.autumn, colors: ['#A7C9A2', '#F4C2C2', '#D8E2DC'] },
      'yiyuksa-wilderness':   { type: 'snow',    icon: '❄️', label: '광야의 눈발',     bg: BG_PHOTOS.winter, colors: ['#FFFFFF', '#E2E8F0', '#CBD5E1'] },
      'simhun-thatday':       { type: 'embers',  icon: '✨', label: '뜨거운 여명',     bg: BG_PHOTOS.winter, colors: ['#FBBF24', '#F87171', '#FDE68A'] },
      'dongju-prologue':      { type: 'stars',   icon: '⭐', label: '밤하늘 별빛',     bg: BG_PHOTOS.night,  colors: ['#FEF08A', '#FDE047', '#E0F2FE'] },
      'dongju-stars':         { type: 'stars',   icon: '✨', label: '가을 밤 별빛',    bg: BG_PHOTOS.night,  colors: ['#FEF08A', '#FDBA74', '#E2E8F0'] },
      'yisang-mirror':        { type: 'dust',    icon: '🪞', label: '고요한 은빛',     bg: BG_PHOTOS.night,  colors: ['#CBD5E1', '#94A3B8', '#E2E8F0'] },
      'hanyongun-silence':    { type: 'autumn',  icon: '🍁', label: '단풍 숲 바람',    bg: BG_PHOTOS.autumn, colors: ['#C2410C', '#EA580C', '#D97706'] },
      'parkyongcheol-boat':   { type: 'mist',    icon: '🌊', label: '항구 안개빛',     bg: BG_PHOTOS.sea,    colors: ['#93C5FD', '#BFDBFE', '#CBD5E1'] },
      'yiyuksa-grapes':       { type: 'leaves',  icon: '🍇', label: '칠월 청포도빛',   bg: BG_PHOTOS.sea,    colors: ['#86EFAC', '#4ADE80', '#BAE6FD'] },
      'jeongjiyong-nostalgia':{ type: 'firefly', icon: '🌾', label: '황금 들녘 반딧불', bg: BG_PHOTOS.autumn, colors: ['#FDE047', '#FBBF24', '#FEF9C3'] }
    };

    let ambientEnabled = true;
    let ambientParticles = [];
    let currentAtmosphere = POEM_ATMOSPHERE['sanghwa-spring'];
    let ambientAnimId = null;

    function initAmbientEngine() {
      const canvas = document.getElementById('ambient-particles-canvas');
      if (!canvas) return;
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resize();
      window.addEventListener('resize', resize);

      document.getElementById('ambient-toggle-btn').addEventListener('click', () => {
        ambientEnabled = !ambientEnabled;
        const btn = document.getElementById('ambient-toggle-btn');
        btn.style.opacity = ambientEnabled ? '1' : '0.55';
        if (!ambientEnabled) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      });

      setAtmosphereForPoem(state.selectedPoemId);
      animateAmbient();
    }

    function setAtmosphereForPoem(poemId) {
      currentAtmosphere = POEM_ATMOSPHERE[poemId] || POEM_ATMOSPHERE['sanghwa-spring'];
      document.getElementById('ambient-icon').textContent = currentAtmosphere.icon;
      document.getElementById('ambient-label').textContent = currentAtmosphere.label;
      const bgImgEl = document.getElementById('poem-bg-photo');
      if (bgImgEl && currentAtmosphere.bg) {
        bgImgEl.src = currentAtmosphere.bg;
      }

      const count = 34;
      ambientParticles = Array.from({ length: count }, (_, i) => {
        // 3 depth layers (0: far/small, 1: mid, 2: near/large) for 3D perspective
        const depth = i % 3;
        const scale = depth === 0 ? 0.55 : depth === 1 ? 0.9 : 1.35;
        return {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          depth,
          size: (6 + Math.random() * 6) * scale,
          speedY: (0.45 + Math.random() * 0.85) * scale * (currentAtmosphere.type === 'embers' || currentAtmosphere.type === 'firefly' ? -0.7 : 1),
          speedX: (Math.random() - 0.35) * 0.8 * scale,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.035,
          flip: Math.random() * Math.PI,
          flipSpeed: 0.02 + Math.random() * 0.03,
          swayPhase: Math.random() * Math.PI * 2,
          color: currentAtmosphere.colors[i % currentAtmosphere.colors.length],
          alpha: depth === 0 ? 0.38 : depth === 1 ? 0.62 : 0.85
        };
      });
    }

    function animateAmbient() {
      const canvas = document.getElementById('ambient-particles-canvas');
      if (canvas && ambientEnabled && state.activeTab === 'inspector') {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        const type = currentAtmosphere.type;

        ambientParticles.forEach(p => {
          p.swayPhase += 0.02;
          p.x += p.speedX + Math.sin(p.swayPhase) * 0.55;
          p.y += p.speedY;
          p.angle += p.spin;
          p.flip += p.flipSpeed;

          if (p.y > H + 30) { p.y = -20; p.x = Math.random() * W; }
          if (p.y < -30) { p.y = H + 20; p.x = Math.random() * W; }
          if (p.x > W + 30) p.x = -20;
          if (p.x < -30) p.x = W + 20;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          // 3D tumble effect via scaleX/scaleY cosine
          const scaleX = type === 'snow' || type === 'stars' ? 1 : Math.cos(p.flip);
          ctx.scale(scaleX, 1);
          ctx.globalAlpha = type === 'stars' || type === 'firefly'
            ? p.alpha * (0.45 + 0.55 * Math.abs(Math.sin(p.flip)))
            : p.alpha;
          ctx.fillStyle = p.color;

          if (type === 'petals' || type === 'peony' || type === 'autumn' || type === 'leaves') {
            // 3D curved petal silhouette
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.bezierCurveTo(p.size * 0.9, -p.size * 0.6, p.size * 0.8, p.size * 0.7, 0, p.size);
            ctx.bezierCurveTo(-p.size * 0.8, p.size * 0.7, -p.size * 0.9, -p.size * 0.6, 0, -p.size);
            ctx.fill();
          } else if (type === 'stars') {
            // Twinkling 4-point star
            const r = p.size * 0.65;
            ctx.beginPath();
            for (let k = 0; k < 4; k++) {
              const a = (k * Math.PI) / 2;
              ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
              ctx.lineTo(Math.cos(a + Math.PI / 4) * (r * 0.3), Math.sin(a + Math.PI / 4) * (r * 0.3));
            }
            ctx.closePath();
            ctx.fill();
          } else {
            // Soft glowing orb (snow / embers / firefly / mist / dust)
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });
      }
      ambientAnimId = requestAnimationFrame(animateAmbient);
    }

    window.addEventListener('DOMContentLoaded', init);

// ==================== 11. VOICE NARRATION (HUGGING FACE SUPERTONIC 2 ONNX) & KINETIC CONTROLLER ====================
    const HF_MODEL_ID = 'onnx-community/Supertonic-TTS-2-ONNX';
    const HF_VOICES_BASE = 'https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices';
    const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm';

    const SUPERTONIC_VOICES = [
      { id: 'F1', label: '차분한 여성 1 (Supertonic F1)' },
      { id: 'F2', label: '부드러운 여성 2 (Supertonic F2)' },
      { id: 'F3', label: '맑은 여성 3 (Supertonic F3)' },
      { id: 'F4', label: '따뜻한 여성 4 (Supertonic F4)' },
      { id: 'F5', label: '섬세한 여성 5 (Supertonic F5)' },
      { id: 'M1', label: '차분한 남성 1 (Supertonic M1)' },
      { id: 'M2', label: '깊은 남성 2 (Supertonic M2)' },
      { id: 'M3', label: '담백한 남성 3 (Supertonic M3)' },
      { id: 'M4', label: '온화한 남성 4 (Supertonic M4)' },
      { id: 'M5', label: '낭랑한 남성 5 (Supertonic M5)' }
    ];

    const ttsState = {
      supported: true,
      speechSupported: typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
      isPlaying: false,
      isPaused: false,
      isLoadingModel: false,
      isSynthesizing: false,
      mode: 'detail', // 'detail' | 'live'
      queue: [],
      queuePos: 0,
      voices: [],
      charTimer: null,
      pauseTimer: null,
      sessionToken: 0,
      hfPipe: null,
      hfLoadPromise: null,
      hfFailed: false,
      currentAudio: null,
      currentAudioUrl: null,
      prefetchCache: new Map(), // cacheKey -> Promise<Blob>
      audioCache: new Map()     // cacheKey -> Blob
    };

    function loadPreferredSettings() {
      try {
        const savedMode = localStorage.getItem('kp_kinetic_mode');
        if (savedMode && ['breathe', 'breeze', 'bloom', 'still'].includes(savedMode)) {
          state.kineticMode = savedMode;
        }
        const savedRate = parseFloat(localStorage.getItem('kp_tts_rate'));
        if (!Number.isNaN(savedRate) && savedRate >= 0.7 && savedRate <= 1.4) {
          state.ttsRate = savedRate;
        }
        const savedVoice = localStorage.getItem('kp_tts_voice');
        if (savedVoice) {
          state.ttsVoiceURI = savedVoice;
        }
      } catch (_) {}
    }

    function savePreferredSetting(key, val) {
      try { localStorage.setItem(key, String(val)); } catch (_) {}
    }

    function populateVoices() {
      const sel = document.getElementById('tts-voice-select');
      if (!sel) return;
      const prevVal = state.ttsVoiceURI || sel.value || 'F1';
      sel.innerHTML = '';

      SUPERTONIC_VOICES.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.label;
        sel.appendChild(opt);
      });

      if (ttsState.speechSupported) {
        const allVoices = window.speechSynthesis.getVoices() || [];
        ttsState.voices = allVoices;
        const koVoices = allVoices.filter(v => (v.lang || '').toLowerCase().startsWith('ko'));
        if (koVoices.length > 0) {
          koVoices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = `sys:${v.voiceURI}`;
            opt.textContent = `[브라우저] ${v.name}`;
            sel.appendChild(opt);
          });
        } else {
          const opt = document.createElement('option');
          opt.value = 'sys:default';
          opt.textContent = '[브라우저] 기본 음성 (오프라인 대체)';
          sel.appendChild(opt);
        }
      }

      const validValues = Array.from(sel.options).map(o => o.value);
      if (prevVal && validValues.includes(prevVal)) {
        sel.value = prevVal;
        state.ttsVoiceURI = prevVal;
      } else {
        state.ttsVoiceURI = 'F1';
        sel.value = 'F1';
      }
    }

    function setTtsStatus(msg) {
      const statusEl = document.getElementById('tts-status-text');
      if (statusEl) statusEl.textContent = msg;
    }

    function clearLineAndCharHighlights() {
      document.querySelectorAll('.poem-line-row.is-speaking').forEach(el => el.classList.remove('is-speaking'));
      document.querySelectorAll('.live-poem-line.is-speaking').forEach(el => {
        el.classList.remove('is-speaking');
        el.style.backgroundColor = '';
      });
      document.querySelectorAll('.k-char.is-char-active, .k-char.is-char-spoken').forEach(el => {
        el.classList.remove('is-char-active', 'is-char-spoken');
      });
    }

    function updateTtsUI() {
      const playBtn = document.getElementById('tts-play-btn');
      const playIcon = document.getElementById('tts-play-icon');
      const playLabel = document.getElementById('tts-play-label');
      const stopBtn = document.getElementById('tts-stop-btn');
      const eq = document.getElementById('tts-eq');
      const livePlayBtn = document.getElementById('live-tts-play-btn');
      const liveStopBtn = document.getElementById('live-tts-stop-btn');

      if (livePlayBtn) {
        if (ttsState.isPlaying && ttsState.mode === 'live') {
          livePlayBtn.textContent = ttsState.isLoadingModel ? '⏳ 음성 모델 준비 중...' : (ttsState.isPaused ? '▶ 이어 듣기' : '⏸ 일시정지');
        } else {
          livePlayBtn.textContent = '▶ 내 시 낭독';
        }
      }
      if (liveStopBtn) {
        liveStopBtn.disabled = !(ttsState.isPlaying && ttsState.mode === 'live');
      }

      if (!playBtn) return;

      if (ttsState.isPlaying && ttsState.mode === 'detail' && ttsState.isLoadingModel) {
        playIcon.textContent = '⏳';
        playLabel.textContent = 'AI 모델 준비 중...';
        stopBtn.disabled = false;
        eq.classList.remove('playing');
      } else if (ttsState.isPlaying && !ttsState.isPaused && ttsState.mode === 'detail') {
        playIcon.textContent = '⏸';
        playLabel.textContent = '일시정지';
        stopBtn.disabled = false;
        eq.classList.add('playing');
      } else if (ttsState.isPlaying && ttsState.isPaused && ttsState.mode === 'detail') {
        playIcon.textContent = '▶';
        playLabel.textContent = '이어 듣기';
        stopBtn.disabled = false;
        eq.classList.remove('playing');
      } else {
        playIcon.textContent = '▶';
        playLabel.textContent = '시 낭독 듣기';
        stopBtn.disabled = true;
        eq.classList.remove('playing');
      }
    }

    function cleanupCurrentAudio() {
      if (ttsState.currentAudio) {
        try {
          ttsState.currentAudio.pause();
          ttsState.currentAudio.onended = null;
          ttsState.currentAudio.onerror = null;
          ttsState.currentAudio.src = '';
        } catch (_) {}
        ttsState.currentAudio = null;
      }
      if (ttsState.currentAudioUrl) {
        try { URL.revokeObjectURL(ttsState.currentAudioUrl); } catch (_) {}
        ttsState.currentAudioUrl = null;
      }
    }

    function stopPoemSpeech() {
      ttsState.sessionToken += 1;
      if (ttsState.charTimer) { clearInterval(ttsState.charTimer); ttsState.charTimer = null; }
      if (ttsState.pauseTimer) { clearTimeout(ttsState.pauseTimer); ttsState.pauseTimer = null; }
      cleanupCurrentAudio();
      if (ttsState.speechSupported) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      ttsState.isPlaying = false;
      ttsState.isPaused = false;
      ttsState.isLoadingModel = false;
      ttsState.isSynthesizing = false;
      ttsState.queue = [];
      ttsState.queuePos = 0;
      clearLineAndCharHighlights();
      setTtsStatus('각 행 옆의 ▶ 버튼을 누르면 AI 한국어 음성(Supertonic 2)으로 낭독이 시작됩니다.');
      updateTtsUI();
    }

    function float32ToWavBlob(samples, sampleRate) {
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, samples.length * 2, true);
      let offset = 44;
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
      return new Blob([buffer], { type: 'audio/wav' });
    }

    async function ensureSupertonicPipeline() {
      if (ttsState.hfPipe) return ttsState.hfPipe;
      if (ttsState.hfLoadPromise) return ttsState.hfLoadPromise;

      ttsState.isLoadingModel = true;
      updateTtsUI();
      setTtsStatus('Hugging Face에서 한국어 AI 음성 모델(Supertonic 2)을 불러오는 중...');

      ttsState.hfLoadPromise = (async () => {
        try {
          const { pipeline, env } = await import(TRANSFORMERS_CDN);
          if (env) {
            env.allowLocalModels = false;
          }
          const fileProgress = new Map();
          const progressCallback = (info) => {
            if (!info) return;
            if (info.status === 'progress' && info.file) {
              fileProgress.set(info.file, { loaded: info.loaded || 0, total: info.total || 0 });
              let totalLoaded = 0;
              let totalSize = 0;
              fileProgress.forEach(v => {
                totalLoaded += v.loaded;
                totalSize += v.total;
              });
              if (totalSize > 0) {
                const pct = Math.min(99, Math.round((totalLoaded / totalSize) * 100));
                if (ttsState.isPlaying) {
                  setTtsStatus(`한국어 AI 음성 모델(Supertonic 2) 다운로드 중... ${pct}% (최초 1회만 저장됩니다)`);
                }
              }
            } else if (info.status === 'ready' && ttsState.isPlaying) {
              setTtsStatus('한국어 AI 음성 모델 준비 완료! 첫 구절을 생성하고 있습니다...');
            }
          };

          let pipe = null;
          const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
          if (hasWebGPU) {
            try {
              pipe = await pipeline('text-to-speech', HF_MODEL_ID, {
                device: 'webgpu',
                progress_callback: progressCallback
              });
            } catch (_) {
              pipe = null;
            }
          }
          if (!pipe) {
            pipe = await pipeline('text-to-speech', HF_MODEL_ID, {
              progress_callback: progressCallback
            });
          }

          ttsState.hfPipe = pipe;
          ttsState.hfFailed = false;
          return pipe;
        } catch (err) {
          ttsState.hfFailed = true;
          ttsState.hfLoadPromise = null;
          throw err;
        } finally {
          ttsState.isLoadingModel = false;
          updateTtsUI();
        }
      })();

      return ttsState.hfLoadPromise;
    }

    function getSelectedVoiceId() {
      const val = state.ttsVoiceURI || 'F1';
      if (val.startsWith('sys:')) return { isSystem: true, id: val.slice(4) };
      const valid = SUPERTONIC_VOICES.some(v => v.id === val);
      return { isSystem: false, id: valid ? val : 'F1' };
    }

    async function synthesizeSupertonicBlob(text, voiceId, rate) {
      const safeSpeed = Math.min(1.35, Math.max(0.75, Number(rate) || 0.9));
      const cacheKey = `${voiceId}|${safeSpeed.toFixed(2)}|${text}`;
      if (ttsState.audioCache.has(cacheKey)) {
        return ttsState.audioCache.get(cacheKey);
      }
      if (ttsState.prefetchCache.has(cacheKey)) {
        return ttsState.prefetchCache.get(cacheKey);
      }

      const job = (async () => {
        const pipe = await ensureSupertonicPipeline();
        const wrapped = `<ko>${text}</ko>`;
        const speakerUrl = `${HF_VOICES_BASE}/${voiceId}.bin`;
        const output = await pipe(wrapped, {
          speaker_embeddings: speakerUrl,
          num_inference_steps: 7,
          speed: safeSpeed
        });
        let blob = null;
        if (output && typeof output.toBlob === 'function') {
          blob = output.toBlob();
        } else if (output && output.audio) {
          blob = float32ToWavBlob(output.audio, output.sampling_rate || 44100);
        } else {
          throw new Error('음성 데이터를 생성하지 못했습니다.');
        }
        if (ttsState.audioCache.size > 40) {
          const firstKey = ttsState.audioCache.keys().next().value;
          ttsState.audioCache.delete(firstKey);
        }
        ttsState.audioCache.set(cacheKey, blob);
        ttsState.prefetchCache.delete(cacheKey);
        return blob;
      })().catch(err => {
        ttsState.prefetchCache.delete(cacheKey);
        throw err;
      });

      ttsState.prefetchCache.set(cacheKey, job);
      return job;
    }

    function prefetchNextLine(nextIdx, voiceId, rate, token) {
      if (token !== ttsState.sessionToken || !ttsState.isPlaying) return;
      if (nextIdx >= ttsState.queue.length) return;
      const nextItem = ttsState.queue[nextIdx];
      if (!nextItem || !nextItem.text) return;
      synthesizeSupertonicBlob(nextItem.text, voiceId, rate).catch(() => {});
    }

    function buildDetailQueue(startLineIdx = 0) {
      const poem = POEMS.find(p => p.id === state.selectedPoemId);
      if (!poem) return [];
      const queue = [];
      if (startLineIdx === 0) {
        queue.push({
          text: `${poem.title}. ${poem.poet}.`,
          lineIdx: -1,
          label: `제목 소개 · 「${poem.title}」`,
          pauseAfter: 500
        });
      }
      let gLine = 0;
      poem.stanzas.forEach((stanza, sIdx) => {
        const lines = stanza.split('\n');
        lines.forEach((rawLine, lInStanza) => {
          const clean = rawLine.trim();
          if (gLine >= startLineIdx && clean.length > 0) {
            queue.push({
              text: clean,
              lineIdx: gLine,
              label: `${sIdx + 1}연 ${gLine + 1}행 낭독 중`,
              pauseAfter: lInStanza === lines.length - 1 ? 560 : 220
            });
          }
          gLine += 1;
        });
      });
      return queue;
    }

    function animateLineCharactersDuringSpeech(lineEl, textLen, rate, token, durationMsOverride = 0) {
      if (ttsState.charTimer) { clearInterval(ttsState.charTimer); ttsState.charTimer = null; }
      if (!lineEl) return;
      const chars = Array.from(lineEl.querySelectorAll('.k-char'));
      if (chars.length === 0) return;

      const msPerChar = durationMsOverride > 0
        ? Math.max(45, durationMsOverride / chars.length)
        : Math.max(65, (145 / (rate || 0.9)));
      let activePos = 0;

      const markPos = (pos) => {
        chars.forEach((ch, idx) => {
          ch.classList.toggle('is-char-active', idx === pos);
          ch.classList.toggle('is-char-spoken', idx < pos);
        });
      };
      markPos(0);

      ttsState.charTimer = setInterval(() => {
        if (token !== ttsState.sessionToken || !ttsState.isPlaying) {
          clearInterval(ttsState.charTimer);
          ttsState.charTimer = null;
          return;
        }
        if (ttsState.isPaused) return;
        activePos += 1;
        if (activePos < chars.length) {
          markPos(activePos);
        } else {
          clearInterval(ttsState.charTimer);
          ttsState.charTimer = null;
        }
      }, msPerChar);
    }

    function speakWithBrowserFallback(item, activeLineEl, token, sysVoiceURI) {
      if (!ttsState.speechSupported) {
        stopPoemSpeech();
        setTtsStatus('이 브라우저에서는 대체 음성을 재생할 수 없습니다.');
        return;
      }
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = 'ko-KR';
      utter.rate = state.ttsRate || 0.9;
      utter.pitch = 1.0;

      if (sysVoiceURI && sysVoiceURI !== 'default' && ttsState.voices.length > 0) {
        const matched = ttsState.voices.find(v => v.voiceURI === sysVoiceURI);
        if (matched) utter.voice = matched;
      }

      utter.onstart = () => {
        if (token !== ttsState.sessionToken) return;
        if (activeLineEl) animateLineCharactersDuringSpeech(activeLineEl, item.text.length, utter.rate, token);
      };
      utter.onend = () => {
        if (token !== ttsState.sessionToken) return;
        if (ttsState.charTimer) { clearInterval(ttsState.charTimer); ttsState.charTimer = null; }
        ttsState.queuePos += 1;
        ttsState.pauseTimer = setTimeout(() => speakNextInQueue(token), item.pauseAfter || 250);
      };
      utter.onerror = () => {
        if (token !== ttsState.sessionToken) return;
        if (ttsState.charTimer) { clearInterval(ttsState.charTimer); ttsState.charTimer = null; }
        ttsState.queuePos += 1;
        ttsState.pauseTimer = setTimeout(() => speakNextInQueue(token), 120);
      };

      try {
        window.speechSynthesis.speak(utter);
      } catch (_) {
        stopPoemSpeech();
      }
    }

    async function speakNextInQueue(token) {
      if (token !== ttsState.sessionToken || !ttsState.isPlaying) return;
      if (ttsState.queuePos >= ttsState.queue.length) {
        stopPoemSpeech();
        setTtsStatus('낭독을 마쳤습니다.');
        return;
      }

      const item = ttsState.queue[ttsState.queuePos];
      clearLineAndCharHighlights();

      let activeLineEl = null;
      if (item.lineIdx >= 0) {
        if (ttsState.mode === 'detail') {
          activeLineEl = document.querySelector(`.poem-line-row[data-line-idx="${item.lineIdx}"]`);
        } else {
          activeLineEl = document.querySelector(`.live-poem-line[data-live-line="${item.lineIdx}"]`);
        }
        if (activeLineEl) {
          activeLineEl.classList.add('is-speaking');
          if (ttsState.mode === 'live') activeLineEl.style.backgroundColor = 'rgba(31, 94, 91, 0.12)';
          activeLineEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      const voiceChoice = getSelectedVoiceId();
      if (voiceChoice.isSystem || ttsState.hfFailed) {
        if (ttsState.mode === 'detail') {
          setTtsStatus(ttsState.hfFailed ? `${item.label} (브라우저 기본 음성 대체)` : item.label);
        }
        speakWithBrowserFallback(item, activeLineEl, token, voiceChoice.id);
        return;
      }

      const rate = state.ttsRate || 0.9;
      ttsState.isSynthesizing = true;
      if (ttsState.mode === 'detail' && ttsState.hfPipe) {
        setTtsStatus(`${item.label} · 음성 생성 중...`);
      }

      try {
        const blob = await synthesizeSupertonicBlob(item.text, voiceChoice.id, rate);
        if (token !== ttsState.sessionToken || !ttsState.isPlaying) return;
        ttsState.isSynthesizing = false;

        // Pre-synthesize the next line while this one plays
        prefetchNextLine(ttsState.queuePos + 1, voiceChoice.id, rate, token);

        cleanupCurrentAudio();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        ttsState.currentAudio = audio;
        ttsState.currentAudioUrl = url;

        if (ttsState.mode === 'detail') {
          setTtsStatus(`${item.label} (Supertonic 2 · ${voiceChoice.id})`);
        }
        updateTtsUI();

        audio.onloadedmetadata = () => {
          if (token !== ttsState.sessionToken || !ttsState.isPlaying) return;
          const durMs = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : 0;
          if (activeLineEl) {
            animateLineCharactersDuringSpeech(activeLineEl, item.text.length, rate, token, durMs);
          }
        };

        audio.onended = () => {
          if (token !== ttsState.sessionToken) return;
          if (ttsState.charTimer) { clearInterval(ttsState.charTimer); ttsState.charTimer = null; }
          cleanupCurrentAudio();
          ttsState.queuePos += 1;
          ttsState.pauseTimer = setTimeout(() => speakNextInQueue(token), item.pauseAfter || 220);
        };

        audio.onerror = () => {
          if (token !== ttsState.sessionToken) return;
          if (ttsState.charTimer) { clearInterval(ttsState.charTimer); ttsState.charTimer = null; }
          cleanupCurrentAudio();
          ttsState.queuePos += 1;
          ttsState.pauseTimer = setTimeout(() => speakNextInQueue(token), 120);
        };

        if (ttsState.isPaused) return;
        await audio.play();
      } catch (err) {
        ttsState.isSynthesizing = false;
        if (token !== ttsState.sessionToken || !ttsState.isPlaying) return;
        setTtsStatus('AI 음성 모델 연결에 실패하여 브라우저 기본 음성으로 전환합니다.');
        speakWithBrowserFallback(item, activeLineEl, token, 'default');
      }
    }

    function startPoemSpeech(startLineIdx = 0) {
      stopPoemSpeech();
      const queue = buildDetailQueue(startLineIdx);
      if (queue.length === 0) return;

      ttsState.mode = 'detail';
      ttsState.queue = queue;
      ttsState.queuePos = 0;
      ttsState.isPlaying = true;
      ttsState.isPaused = false;
      const token = ttsState.sessionToken;
      updateTtsUI();
      speakNextInQueue(token);
    }

    function startLivePoemSpeech() {
      const raw = (document.getElementById('analyzer-input')?.value || '').trim();
      if (!raw) return;
      stopPoemSpeech();

      const lines = raw.split(/\n+/).filter(l => l.trim().length > 0);
      const title = (document.getElementById('my-poem-title')?.value || '').trim();
      const queue = [];
      if (title) {
        queue.push({ text: title, lineIdx: -1, label: title, pauseAfter: 500 });
      }
      lines.forEach((line, idx) => {
        queue.push({ text: line.trim(), lineIdx: idx, label: `${idx + 1}행`, pauseAfter: 260 });
      });

      ttsState.mode = 'live';
      ttsState.queue = queue;
      ttsState.queuePos = 0;
      ttsState.isPlaying = true;
      ttsState.isPaused = false;
      const token = ttsState.sessionToken;
      updateTtsUI();
      speakNextInQueue(token);
    }

    function updateKineticModeButtons() {
      document.querySelectorAll('.kmode-btn').forEach(btn => {
        const active = btn.dataset.kmode === state.kineticMode;
        btn.className = active
          ? 'kmode-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#9E2A2B] text-[#FAF5EB] transition'
          : 'kmode-btn px-2.5 py-1 rounded-lg text-[11px] font-medium text-stone-700 hover:bg-stone-100 transition';
      });
    }

    function replayKineticAnimation() {
      const prevMode = state.kineticMode;
      state.kineticMode = 'bloom';
      updateKineticModeButtons();
      renderPoemBodyOnly();
      if (prevMode === 'still') return;
    }

    function togglePlayPauseForMode(targetMode) {
      if (ttsState.isPlaying && ttsState.mode === targetMode) {
        if (ttsState.isPaused) {
          ttsState.isPaused = false;
          if (ttsState.currentAudio) {
            ttsState.currentAudio.play().catch(() => {});
          } else if (ttsState.speechSupported && !ttsState.isLoadingModel && !ttsState.isSynthesizing) {
            try { window.speechSynthesis.resume(); } catch (_) {}
          }
        } else {
          ttsState.isPaused = true;
          if (ttsState.currentAudio) {
            try { ttsState.currentAudio.pause(); } catch (_) {}
          } else if (ttsState.speechSupported) {
            try { window.speechSynthesis.pause(); } catch (_) {}
          }
        }
        updateTtsUI();
        return true;
      }
      return false;
    }

    function initVoiceAndKinetic() {
      loadPreferredSettings();
      updateKineticModeButtons();

      const rateSlider = document.getElementById('tts-rate-slider');
      const rateVal = document.getElementById('tts-rate-val');
      if (rateSlider && rateVal) {
        rateSlider.value = String(state.ttsRate);
        rateVal.textContent = `${state.ttsRate.toFixed(2).replace(/0$/, '')}x`;
        rateSlider.addEventListener('input', (e) => {
          state.ttsRate = Number(e.target.value);
          rateVal.textContent = `${state.ttsRate.toFixed(2).replace(/0$/, '')}x`;
          savePreferredSetting('kp_tts_rate', state.ttsRate);
        });
      }

      const ampSlider = document.getElementById('kinetic-amp-slider');
      if (ampSlider) {
        ampSlider.addEventListener('input', (e) => {
          state.kineticAmp = Number(e.target.value);
          applyKineticClasses(document.getElementById('detail-poem-body'));
          applyKineticClasses(document.getElementById('live-highlighted-output'));
        });
      }

      document.querySelectorAll('.kmode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.kineticMode = btn.dataset.kmode;
          savePreferredSetting('kp_kinetic_mode', state.kineticMode);
          updateKineticModeButtons();
          if (state.kineticMode === 'bloom') {
            renderPoemBodyOnly();
          } else {
            applyKineticClasses(document.getElementById('detail-poem-body'));
          }
          applyKineticClasses(document.getElementById('live-highlighted-output'));
        });
      });

      const replayBtn = document.getElementById('kinetic-replay-btn');
      if (replayBtn) {
        replayBtn.addEventListener('click', replayKineticAnimation);
      }

      const playBtn = document.getElementById('tts-play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (!togglePlayPauseForMode('detail')) {
            startPoemSpeech(0);
          }
        });
      }

      const stopBtn = document.getElementById('tts-stop-btn');
      if (stopBtn) stopBtn.addEventListener('click', stopPoemSpeech);

      const voiceSel = document.getElementById('tts-voice-select');
      if (voiceSel) {
        voiceSel.addEventListener('change', (e) => {
          state.ttsVoiceURI = e.target.value;
          savePreferredSetting('kp_tts_voice', state.ttsVoiceURI);
        });
      }

      const livePlayBtn = document.getElementById('live-tts-play-btn');
      if (livePlayBtn) {
        livePlayBtn.addEventListener('click', () => {
          if (!togglePlayPauseForMode('live')) {
            startLivePoemSpeech();
          }
        });
      }
      const liveStopBtn = document.getElementById('live-tts-stop-btn');
      if (liveStopBtn) liveStopBtn.addEventListener('click', stopPoemSpeech);

      populateVoices();
      if (ttsState.speechSupported && typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = populateVoices;
      }
      updateTtsUI();
      applyKineticClasses(document.getElementById('detail-poem-body'));
    }
