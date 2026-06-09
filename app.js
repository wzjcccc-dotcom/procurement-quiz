const HISTORY_MODE2_KEY = "procurement_quiz_history_mode2";
const HISTORY_MODE3_KEY = "procurement_quiz_history_mode3";
const WRONG_STATS_KEY = "procurement_quiz_wrong_stats";

const MODE_LABELS = {
  mode1: "模式一",
  mode2: "模式二",
  mode3: "模式三",
};

const TYPE_LABELS = {
  true_false: "是非題",
  multiple_choice: "選擇題",
};

const state = {
  data: null,
  dataPromise: null,
  selectedMode: null,
  currentView: "home",
  currentQuiz: null,
  timerId: null,
};

const refs = {
  message: document.querySelector("#message"),
  featureCards: [...document.querySelectorAll(".feature-card")],
  overlay: document.querySelector("#overlay"),
  overlayBadge: document.querySelector("#overlay-badge"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlaySubtitle: document.querySelector("#overlay-subtitle"),
  closeOverlayButton: document.querySelector("#close-overlay-button"),
  setupView: document.querySelector("#setup-view"),
  setupForm: document.querySelector("#setup-form"),
  mode1Config: document.querySelector("#mode1-config"),
  mode2Config: document.querySelector("#mode2-config"),
  mode3Config: document.querySelector("#mode3-config"),
  mode1Chapter: document.querySelector("#mode1-chapter"),
  mode1Type: document.querySelector("#mode1-type"),
  mode2Type: document.querySelector("#mode2-type"),
  mode3Subject: document.querySelector("#mode3-subject"),
  startButton: document.querySelector("#start-button"),
  cancelSetupButton: document.querySelector("#cancel-setup-button"),
  quizView: document.querySelector("#quiz-view"),
  quizModeLabel: document.querySelector("#quiz-mode-label"),
  progressBox: document.querySelector("#progress-box"),
  timerBox: document.querySelector("#timer-box"),
  questionCard: document.querySelector("#question-card"),
  feedbackPanel: document.querySelector("#feedback-panel"),
  answerButton: document.querySelector("#answer-button"),
  nextButton: document.querySelector("#next-button"),
  restartButton: document.querySelector("#restart-button"),
  resultView: document.querySelector("#result-view"),
  resultTitle: document.querySelector("#result-title"),
  resultSummary: document.querySelector("#result-summary"),
  resultBreakdown: document.querySelector("#result-breakdown"),
  retryButton: document.querySelector("#retry-button"),
  backHomeButton: document.querySelector("#back-home-button"),
  historyView: document.querySelector("#history-view"),
  historyContent: document.querySelector("#history-content"),
  closeHistoryButton: document.querySelector("#close-history-button"),
  wrongStatsView: document.querySelector("#wrong-stats-view"),
  wrongStatsContent: document.querySelector("#wrong-stats-content"),
  closeWrongStatsButton: document.querySelector("#close-wrong-stats-button"),
};

init();

function init() {
  bindEvents();
}

function bindEvents() {
  refs.featureCards.forEach((card) => {
    card.addEventListener("click", () => {
      void handleFeatureAction(card.dataset.action);
    });
  });

  refs.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startQuiz();
  });

  refs.cancelSetupButton.addEventListener("click", closeOverlay);
  refs.closeOverlayButton.addEventListener("click", closeOverlay);
  refs.answerButton.addEventListener("click", submitCurrentAnswer);
  refs.nextButton.addEventListener("click", goToNextQuestion);
  refs.restartButton.addEventListener("click", restartCurrentMode);
  refs.retryButton.addEventListener("click", restartCurrentMode);
  refs.backHomeButton.addEventListener("click", closeOverlay);
  refs.closeHistoryButton.addEventListener("click", closeOverlay);
  refs.closeWrongStatsButton.addEventListener("click", closeOverlay);
}

function hydrateSetupOptions() {
  const chapters = Object.keys(state.data.chapterCatalog);
  refs.mode1Chapter.innerHTML = chapters
    .map((chapter) => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`)
    .join("");

  const subjects = Object.keys(state.data.subjectBlueprints);
  refs.mode3Subject.innerHTML = subjects
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join("");
}

async function ensureDataLoaded() {
  if (state.data) {
    return state.data;
  }

  if (state.dataPromise) {
    return state.dataPromise;
  }

  showMessage("題庫載入中，請稍候...");

  state.dataPromise = (async () => {
    if (window.__QUESTION_DATA__) {
      return window.__QUESTION_DATA__;
    }

    const response = await fetch("./questions.cleaned.json");
    if (!response.ok) {
      throw new Error(`Failed to load questions: ${response.status}`);
    }
    return response.json();
  })();

  try {
    state.data = await state.dataPromise;
    hydrateSetupOptions();
    hideMessage();
    return state.data;
  } catch (error) {
    state.dataPromise = null;
    console.error(error);
    showMessage("題庫載入失敗，請重新整理頁面後再試一次。");
    throw error;
  }
}

async function handleFeatureAction(action) {
  hideMessage();

  try {
    await ensureDataLoaded();
  } catch {
    return;
  }

  if (action === "history") {
    renderHistory();
    openOverlay("history-view", "測驗紀錄", "查看模式二與模式三最近 10 次作答結果", "最近紀錄");
    return;
  }

  if (action === "wrongStats") {
    renderWrongStats();
    openOverlay("wrong-stats-view", "錯題統計", "依章節查看累積錯題排名", "章節排名");
    return;
  }

  state.selectedMode = action;
  openModeSetup(action);
}

function openModeSetup(mode) {
  refs.mode1Config.hidden = mode !== "mode1";
  refs.mode2Config.hidden = mode !== "mode2";
  refs.mode3Config.hidden = mode !== "mode3";

  const titleMap = {
    mode1: "模式一設定",
    mode2: "模式二設定",
    mode3: "模式三設定",
  };

  const subtitleMap = {
    mode1: "先選章節與題型，再開始測驗",
    mode2: "先選題型，再開始綜合測驗",
    mode3: "先選科目，再開始模擬測驗",
  };

  openOverlay("setup-view", MODE_LABELS[mode], subtitleMap[mode], titleMap[mode]);
}

function openOverlay(viewId, badge, subtitle, title) {
  state.currentView = viewId;
  refs.overlay.hidden = false;
  refs.overlayBadge.textContent = badge;
  refs.overlayTitle.textContent = title;
  refs.overlaySubtitle.textContent = subtitle;
  hideAllOverlayViews();
  document.getElementById(viewId).hidden = false;
}

function closeOverlay() {
  clearTimer();
  state.currentView = "home";
  state.currentQuiz = null;
  refs.overlay.hidden = true;
  hideAllOverlayViews();
}

function hideAllOverlayViews() {
  refs.setupView.hidden = true;
  refs.quizView.hidden = true;
  refs.resultView.hidden = true;
  refs.historyView.hidden = true;
  refs.wrongStatsView.hidden = true;
}

async function startQuiz() {
  try {
    await ensureDataLoaded();
  } catch {
    return;
  }

  let quiz;

  try {
    if (state.selectedMode === "mode1") {
      quiz = buildMode1Quiz(refs.mode1Chapter.value, refs.mode1Type.value);
    } else if (state.selectedMode === "mode2") {
      quiz = buildMode2Quiz(refs.mode2Type.value);
    } else if (state.selectedMode === "mode3") {
      quiz = buildMode3Quiz(refs.mode3Subject.value);
    } else {
      showMessage("請先選擇模式。");
      return;
    }
  } catch (error) {
    showMessage(error.message);
    return;
  }

  state.currentQuiz = quiz;
  openOverlay("quiz-view", MODE_LABELS[quiz.mode], quiz.subtitle, quiz.title);
  refs.quizModeLabel.textContent = MODE_LABELS[quiz.mode];
  renderCurrentQuestion();
  setupTimer();
}

function buildMode1Quiz(chapter, type) {
  const pool = getQuestionPool(chapter, type);
  ensureQuestionCount(pool, 10, `${chapter} ${TYPE_LABELS[type]}`);

  return createQuizState({
    mode: "mode1",
    title: `${chapter}${TYPE_LABELS[type]}測驗`,
    subtitle: "共 10 題，一題一頁，答完立即看結果",
    questions: shuffle(pool).slice(0, 10),
    meta: { chapter, type },
    scoring: null,
    timer: null,
  });
}

function buildMode2Quiz(type) {
  const chapters = Object.keys(state.data.chapterCatalog);
  const total = 50;
  const base = Math.floor(total / chapters.length);
  let remaining = total;
  const allocations = {};

  chapters.forEach((chapter) => {
    const pool = getQuestionPool(chapter, type);
    const allocated = Math.min(base, pool.length);
    allocations[chapter] = allocated;
    remaining -= allocated;
  });

  const candidates = shuffle(
    chapters.filter((chapter) => getQuestionPool(chapter, type).length > allocations[chapter])
  );

  for (const chapter of candidates) {
    if (remaining <= 0) break;
    allocations[chapter] += 1;
    remaining -= 1;
  }

  if (remaining > 0) {
    const ordered = chapters
      .map((chapter) => ({
        chapter,
        capacity: getQuestionPool(chapter, type).length - allocations[chapter],
      }))
      .filter((item) => item.capacity > 0);

    while (remaining > 0 && ordered.length > 0) {
      for (const item of ordered) {
        if (remaining <= 0) break;
        if (item.capacity <= 0) continue;
        allocations[item.chapter] += 1;
        item.capacity -= 1;
        remaining -= 1;
      }
    }
  }

  if (remaining > 0) {
    throw new Error("模式二題庫不足，無法抽滿 50 題。");
  }

  const questions = chapters.flatMap((chapter) =>
    shuffle(getQuestionPool(chapter, type)).slice(0, allocations[chapter])
  );

  return createQuizState({
    mode: "mode2",
    title: `${TYPE_LABELS[type]}綜合測驗`,
    subtitle: "共 50 題，各章節盡可能平均分配",
    questions: shuffle(questions),
    meta: { type, allocations },
    scoring: null,
    timer: null,
  });
}

function buildMode3Quiz(subject) {
  const blueprint = state.data.subjectBlueprints[subject];
  if (!blueprint) {
    throw new Error("找不到對應科目設定。");
  }

  const questions = [];
  for (const chapterPlan of blueprint.chapters) {
    const tfPool = getQuestionPool(chapterPlan.chapter, "true_false");
    const mcPool = getQuestionPool(chapterPlan.chapter, "multiple_choice");
    ensureQuestionCount(tfPool, chapterPlan.true_false, `${chapterPlan.chapter} 是非題`);
    ensureQuestionCount(mcPool, chapterPlan.multiple_choice, `${chapterPlan.chapter} 選擇題`);

    questions.push(...shuffle(tfPool).slice(0, chapterPlan.true_false));
    questions.push(...shuffle(mcPool).slice(0, chapterPlan.multiple_choice));
  }

  return createQuizState({
    mode: "mode3",
    title: `${subject}模擬測驗`,
    subtitle: "一題一頁作答，含倒數與超時計時",
    questions: shuffle(questions),
    meta: { subject, blueprint },
    scoring: blueprint.scoring,
    timer: {
      limitMs: blueprint.timeLimitMinutes * 60 * 1000,
      startedAt: Date.now(),
    },
  });
}

function createQuizState(base) {
  return {
    ...base,
    currentIndex: 0,
    answers: {},
    questionResults: [],
    waitingNext: false,
  };
}

function renderCurrentQuestion() {
  const quiz = state.currentQuiz;
  const question = quiz.questions[quiz.currentIndex];
  const questionNo = quiz.currentIndex + 1;

  refs.progressBox.textContent = `第 ${questionNo} / ${quiz.questions.length} 題`;
  refs.feedbackPanel.hidden = true;
  refs.feedbackPanel.className = "feedback-panel";
  refs.answerButton.hidden = false;
  refs.nextButton.hidden = true;
  refs.answerButton.disabled = true;
  quiz.waitingNext = false;

  const options = question.options
    .map(
      (option) => `
        <label class="option">
          <input type="radio" name="current-question" value="${escapeHtml(option.label)}" />
          <span><strong>${escapeHtml(option.label)}</strong> ${escapeHtml(option.text)}</span>
        </label>
      `
    )
    .join("");

  refs.questionCard.innerHTML = `
    <div class="question-card__meta">
      <span class="tag">來源序號 ${question.sourceNo}</span>
      <span class="tag">${escapeHtml(question.chapter)}</span>
      <span class="tag">${TYPE_LABELS[question.type]}</span>
    </div>
    <h3>${escapeHtml(question.questionText)}</h3>
    <div class="option-list">${options}</div>
  `;

  refs.questionCard.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      refs.answerButton.disabled = false;
    });
  });
}

function submitCurrentAnswer() {
  const quiz = state.currentQuiz;
  if (!quiz || quiz.waitingNext) return;

  const selected = refs.questionCard.querySelector("input[name='current-question']:checked");
  if (!selected) {
    showMessage("請先選擇答案。");
    return;
  }

  hideMessage();

  const question = quiz.questions[quiz.currentIndex];
  const answer = selected.value;
  const isCorrect = answer === question.answer;

  quiz.answers[question.id] = answer;
  quiz.questionResults.push({ question, selected: answer, isCorrect });
  quiz.waitingNext = true;

  refs.questionCard.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = true;
    const wrapper = input.closest(".option");
    if (input.value === question.answer) {
      wrapper.classList.add("option--correct");
    }
    if (input.checked && input.value !== question.answer) {
      wrapper.classList.add("option--wrong");
    }
  });

  refs.feedbackPanel.hidden = false;
  refs.feedbackPanel.classList.add(isCorrect ? "feedback-panel--correct" : "feedback-panel--wrong");
  refs.feedbackPanel.innerHTML = `
    <strong>${isCorrect ? "答對了" : "答錯了"}</strong>
    <p>正確答案：${escapeHtml(question.answer)}</p>
  `;

  refs.answerButton.hidden = true;
  refs.nextButton.hidden = false;
  refs.nextButton.textContent =
    quiz.currentIndex === quiz.questions.length - 1 ? "看測驗結果" : "下一題";
}

function goToNextQuestion() {
  const quiz = state.currentQuiz;
  if (!quiz) return;

  if (quiz.currentIndex === quiz.questions.length - 1) {
    finishQuiz();
    return;
  }

  quiz.currentIndex += 1;
  renderCurrentQuestion();
}

function finishQuiz() {
  const quiz = state.currentQuiz;
  clearTimer();

  const stats = calculateStats(quiz, quiz.questionResults);
  persistHistoryIfNeeded(quiz, stats);
  updateWrongStats(stats.chapterStats);
  renderHistory();
  renderWrongStats();
  renderResults(quiz, stats);
}

function calculateStats(quiz, results) {
  const chapterStats = {};
  let correct = 0;
  let wrong = 0;
  let score = 0;
  const typeTotals = {
    true_false: { correct: 0, wrong: 0 },
    multiple_choice: { correct: 0, wrong: 0 },
  };

  for (const { question, isCorrect } of results) {
    if (!chapterStats[question.chapter]) {
      chapterStats[question.chapter] = {
        totalCorrect: 0,
        totalWrong: 0,
        true_false: { correct: 0, wrong: 0 },
        multiple_choice: { correct: 0, wrong: 0 },
      };
    }

    if (isCorrect) {
      correct += 1;
      chapterStats[question.chapter].totalCorrect += 1;
      chapterStats[question.chapter][question.type].correct += 1;
      typeTotals[question.type].correct += 1;
      if (quiz.scoring) {
        score += quiz.scoring[question.type];
      }
    } else {
      wrong += 1;
      chapterStats[question.chapter].totalWrong += 1;
      chapterStats[question.chapter][question.type].wrong += 1;
      typeTotals[question.type].wrong += 1;
    }
  }

  return {
    total: results.length,
    correct,
    wrong,
    score,
    accuracy: results.length ? (correct / results.length) * 100 : 0,
    chapterStats,
    typeTotals,
    timedOut: didTimeExpire(quiz),
  };
}

function renderResults(quiz, stats) {
  openOverlay("result-view", MODE_LABELS[quiz.mode], "測驗已完成", quiz.title);
  refs.resultTitle.textContent = quiz.title;

  const summaryCards = [
    { label: "總題數", value: stats.total },
    { label: "答對", value: stats.correct },
    { label: "答錯", value: stats.wrong },
    { label: "正確率", value: `${stats.accuracy.toFixed(1)}%` },
  ];

  if (quiz.mode === "mode3") {
    summaryCards.push({ label: "總分", value: stats.score });
  }
  if (quiz.mode === "mode3" && stats.timedOut) {
    summaryCards.push({ label: "時間狀態", value: "已超時" });
  }

  refs.resultSummary.innerHTML = `
    <div class="stat-grid">
      ${summaryCards
        .map(
          (card) => `
            <div class="stat-card">
              <span>${card.label}</span>
              <strong>${card.value}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  if (quiz.mode === "mode1") {
    refs.resultBreakdown.innerHTML = `
      <div class="breakdown-table">
        <table>
          <thead>
            <tr><th>章節</th><th>答對</th><th>答錯</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(quiz.meta.chapter)}</td>
              <td>${stats.correct}</td>
              <td>${stats.wrong}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  if (quiz.mode === "mode2") {
    refs.resultBreakdown.innerHTML = renderMode2Breakdown(stats.chapterStats, stats.correct, stats.wrong);
    return;
  }

  refs.resultBreakdown.innerHTML = renderMode3Breakdown(stats);
}

function renderMode2Breakdown(chapterStats, totalCorrect, totalWrong) {
  const rows = Object.entries(chapterStats)
    .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
    .map(
      ([chapter, value]) => `
        <tr>
          <td>${escapeHtml(chapter)}</td>
          <td>${value.totalCorrect}</td>
          <td>${value.totalWrong}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="breakdown-table">
      <table>
        <thead>
          <tr><th>章節</th><th>答對</th><th>答錯</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td><strong>全部</strong></td>
            <td><strong>${totalCorrect}</strong></td>
            <td><strong>${totalWrong}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderMode3Breakdown(stats) {
  const rows = Object.entries(stats.chapterStats)
    .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
    .map(
      ([chapter, value]) => `
        <tr>
          <td>${escapeHtml(chapter)}</td>
          <td>${value.true_false.correct}</td>
          <td>${value.true_false.wrong}</td>
          <td>${value.multiple_choice.correct}</td>
          <td>${value.multiple_choice.wrong}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="breakdown-table">
      <table>
        <thead>
          <tr>
            <th>章節</th>
            <th>是非答對</th>
            <th>是非答錯</th>
            <th>選擇答對</th>
            <th>選擇答錯</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td><strong>全部</strong></td>
            <td><strong>${stats.typeTotals.true_false.correct}</strong></td>
            <td><strong>${stats.typeTotals.true_false.wrong}</strong></td>
            <td><strong>${stats.typeTotals.multiple_choice.correct}</strong></td>
            <td><strong>${stats.typeTotals.multiple_choice.wrong}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function persistHistoryIfNeeded(quiz, stats) {
  const timestamp = new Date().toISOString();

  if (quiz.mode === "mode2") {
    const history = readStorage(HISTORY_MODE2_KEY, []);
    history.unshift({
      timestamp,
      type: quiz.meta.type,
      total: stats.total,
      correct: stats.correct,
      wrong: stats.wrong,
      accuracy: stats.accuracy,
      chapterStats: stats.chapterStats,
    });
    writeStorage(HISTORY_MODE2_KEY, history.slice(0, 10));
  }

  if (quiz.mode === "mode3") {
    const history = readStorage(HISTORY_MODE3_KEY, []);
    history.unshift({
      timestamp,
      subject: quiz.meta.subject,
      total: stats.total,
      correct: stats.correct,
      wrong: stats.wrong,
      score: stats.score,
      accuracy: stats.accuracy,
      typeTotals: stats.typeTotals,
      chapterStats: stats.chapterStats,
      timedOut: stats.timedOut,
    });
    writeStorage(HISTORY_MODE3_KEY, history.slice(0, 10));
  }
}

function renderHistory() {
  const mode2History = readStorage(HISTORY_MODE2_KEY, []);
  const mode3History = readStorage(HISTORY_MODE3_KEY, []);
  const avgMode2 = calculateAverageAccuracy(mode2History);
  const avgMode3 = calculateAverageAccuracy(mode3History);

  refs.historyContent.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <span>模式二平均正確率</span>
        <strong>${avgMode2.toFixed(1)}%</strong>
      </div>
      <div class="stat-card">
        <span>模式三平均正確率</span>
        <strong>${avgMode3.toFixed(1)}%</strong>
      </div>
    </div>
    <div class="stack">
      <h3>模式二最近 10 次</h3>
      ${mode2History.length ? mode2History.map(renderMode2HistoryCard).join("") : "<p class='muted'>尚無模式二紀錄。</p>"}
    </div>
    <div class="stack">
      <h3>模式三最近 10 次</h3>
      ${mode3History.length ? mode3History.map(renderMode3HistoryCard).join("") : "<p class='muted'>尚無模式三紀錄。</p>"}
    </div>
  `;
}

function renderMode2HistoryCard(item) {
  return `
    <article class="history-card">
      <h4>${formatDate(item.timestamp)} ・ ${TYPE_LABELS[item.type]}</h4>
      <p>總題數 ${item.total} 題，答對 ${item.correct} 題，答錯 ${item.wrong} 題。</p>
      <p>正確率 ${item.accuracy.toFixed(1)}%</p>
    </article>
  `;
}

function renderMode3HistoryCard(item) {
  return `
    <article class="history-card">
      <h4>${formatDate(item.timestamp)} ・ ${escapeHtml(item.subject)}</h4>
      <p>總分 ${item.score}，答對 ${item.correct} 題，答錯 ${item.wrong} 題。</p>
      <p>是非題 ${item.typeTotals.true_false.correct} 對 ${item.typeTotals.true_false.wrong} 錯，選擇題 ${item.typeTotals.multiple_choice.correct} 對 ${item.typeTotals.multiple_choice.wrong} 錯。</p>
      <p>正確率 ${item.accuracy.toFixed(1)}%${item.timedOut ? " ・ 已超時" : ""}</p>
    </article>
  `;
}

function updateWrongStats(chapterStats) {
  const stats = readStorage(WRONG_STATS_KEY, {});

  Object.entries(chapterStats).forEach(([chapter, value]) => {
    if (!stats[chapter]) {
      stats[chapter] = { wrong: 0, attempts: 0 };
    }
    stats[chapter].wrong += value.totalWrong;
    stats[chapter].attempts += value.totalCorrect + value.totalWrong;
  });

  writeStorage(WRONG_STATS_KEY, stats);
}

function renderWrongStats() {
  const stats = readStorage(WRONG_STATS_KEY, {});
  const entries = Object.entries(stats).sort((a, b) => {
    if (b[1].wrong !== a[1].wrong) return b[1].wrong - a[1].wrong;
    if (b[1].attempts !== a[1].attempts) return b[1].attempts - a[1].attempts;
    return a[0].localeCompare(b[0], "zh-Hant");
  });

  refs.wrongStatsContent.innerHTML = entries.length
    ? entries
        .map(
          ([chapter, value], index) => `
            <article class="ranking-item">
              <h4>第 ${index + 1} 名 ・ ${escapeHtml(chapter)}</h4>
              <p>累積答錯 ${value.wrong} 題</p>
              <p>累積作答 ${value.attempts} 題</p>
            </article>
          `
        )
        .join("")
    : "<p class='muted'>目前還沒有錯題統計。</p>";
}

function setupTimer() {
  clearTimer();
  const quiz = state.currentQuiz;
  if (!quiz?.timer) {
    refs.timerBox.hidden = true;
    return;
  }

  refs.timerBox.hidden = false;
  updateTimerUI();
  state.timerId = window.setInterval(updateTimerUI, 1000);
}

function updateTimerUI() {
  const quiz = state.currentQuiz;
  if (!quiz?.timer) return;

  const elapsed = Date.now() - quiz.timer.startedAt;
  const remaining = quiz.timer.limitMs - elapsed;

  if (remaining >= 0) {
    refs.timerBox.classList.remove("timer--overtime");
    refs.timerBox.textContent = `倒數 ${formatDuration(remaining)}`;
  } else {
    refs.timerBox.classList.add("timer--overtime");
    refs.timerBox.textContent = `超時 ${formatDuration(Math.abs(remaining))}`;
  }
}

function didTimeExpire(quiz) {
  return Boolean(quiz?.timer && Date.now() - quiz.timer.startedAt > quiz.timer.limitMs);
}

function restartCurrentMode() {
  clearTimer();
  const mode = state.currentQuiz?.mode ?? state.selectedMode;
  state.currentQuiz = null;
  if (mode) {
    state.selectedMode = mode;
    openModeSetup(mode);
  } else {
    closeOverlay();
  }
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function getQuestionPool(chapter, type) {
  return state.data.questions.filter((question) => question.chapter === chapter && question.type === type);
}

function ensureQuestionCount(pool, required, label) {
  if (pool.length < required) {
    throw new Error(`${label} 題庫不足，目前只有 ${pool.length} 題。`);
  }
}

function shuffle(items) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Failed to read ${key}`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function calculateAverageAccuracy(history) {
  if (!history.length) return 0;
  return history.reduce((sum, item) => sum + item.accuracy, 0) / history.length;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatDate(value) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showMessage(message) {
  refs.message.hidden = !message;
  refs.message.textContent = message;
}

function hideMessage() {
  showMessage("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
