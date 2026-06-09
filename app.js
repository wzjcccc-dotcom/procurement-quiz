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
  selectedMode: null,
  currentQuiz: null,
  timerId: null,
};

const refs = {
  message: document.querySelector("#message"),
  modeCards: [...document.querySelectorAll(".mode-card")],
  setupForm: document.querySelector("#setup-form"),
  startButton: document.querySelector("#start-button"),
  resetSetupButton: document.querySelector("#reset-setup-button"),
  mode1Config: document.querySelector("#mode1-config"),
  mode2Config: document.querySelector("#mode2-config"),
  mode3Config: document.querySelector("#mode3-config"),
  mode1Chapter: document.querySelector("#mode1-chapter"),
  mode1Type: document.querySelector("#mode1-type"),
  mode2Type: document.querySelector("#mode2-type"),
  mode3Subject: document.querySelector("#mode3-subject"),
  setupView: document.querySelector("#setup-view"),
  quizView: document.querySelector("#quiz-view"),
  resultView: document.querySelector("#result-view"),
  quizModeLabel: document.querySelector("#quiz-mode-label"),
  quizTitle: document.querySelector("#quiz-title"),
  quizSubtitle: document.querySelector("#quiz-subtitle"),
  timerBox: document.querySelector("#timer-box"),
  progressBox: document.querySelector("#progress-box"),
  quizForm: document.querySelector("#quiz-form"),
  submitButton: document.querySelector("#submit-button"),
  restartButton: document.querySelector("#restart-button"),
  resultTitle: document.querySelector("#result-title"),
  resultSummary: document.querySelector("#result-summary"),
  resultBreakdown: document.querySelector("#result-breakdown"),
  retryButton: document.querySelector("#retry-button"),
  backHomeButton: document.querySelector("#back-home-button"),
  historyContent: document.querySelector("#history-content"),
  wrongStatsContent: document.querySelector("#wrong-stats-content"),
  collapseToggles: [...document.querySelectorAll(".collapse-toggle")],
};

init().catch((error) => {
  console.error(error);
  showMessage("題庫載入失敗，請確認 questions.cleaned.json 存在且格式正確。");
});

async function init() {
  if (window.__QUESTION_DATA__) {
    state.data = window.__QUESTION_DATA__;
  } else {
    const response = await fetch("./questions.cleaned.json");
    if (!response.ok) {
      throw new Error(`Failed to load questions: ${response.status}`);
    }

    state.data = await response.json();
  }
  hydrateSetupOptions();
  bindEvents();
  renderHistory();
  renderWrongStats();
}

function bindEvents() {
  refs.modeCards.forEach((card) => {
    card.addEventListener("click", () => selectMode(card.dataset.mode));
  });

  refs.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startQuiz();
  });

  refs.resetSetupButton.addEventListener("click", () => {
    selectMode(null);
    showMessage("");
  });

  refs.submitButton.addEventListener("click", submitQuiz);
  refs.restartButton.addEventListener("click", restartCurrentMode);
  refs.retryButton.addEventListener("click", restartCurrentMode);
  refs.backHomeButton.addEventListener("click", goHome);

  refs.collapseToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      const isHidden = target.hidden;
      target.hidden = !isHidden;
      button.querySelector("strong").textContent = isHidden ? "點我收合" : "點我展開";
      if (button.dataset.target === "history-panel") {
        renderHistory();
      } else {
        renderWrongStats();
      }
    });
  });
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

function selectMode(mode) {
  state.selectedMode = mode;
  refs.modeCards.forEach((card) => card.classList.toggle("is-active", card.dataset.mode === mode));
  refs.mode1Config.hidden = mode !== "mode1";
  refs.mode2Config.hidden = mode !== "mode2";
  refs.mode3Config.hidden = mode !== "mode3";
  refs.startButton.disabled = !mode;
}

function startQuiz() {
  hideMessage();

  let quiz;
  try {
    if (state.selectedMode === "mode1") {
      quiz = buildMode1Quiz(refs.mode1Chapter.value, refs.mode1Type.value);
    } else if (state.selectedMode === "mode2") {
      quiz = buildMode2Quiz(refs.mode2Type.value);
    } else if (state.selectedMode === "mode3") {
      quiz = buildMode3Quiz(refs.mode3Subject.value);
    } else {
      showMessage("請先選擇測驗模式。");
      return;
    }
  } catch (error) {
    showMessage(error.message);
    return;
  }

  state.currentQuiz = quiz;
  showQuizView();
  renderQuiz();
  setupTimer();
}

function buildMode1Quiz(chapter, type) {
  const pool = getQuestionPool(chapter, type);
  ensureQuestionCount(pool, 10, `${chapter} ${TYPE_LABELS[type]}`);

  return {
    mode: "mode1",
    title: `${chapter} ${TYPE_LABELS[type]}測驗`,
    subtitle: `隨機抽取 10 題，共 ${pool.length} 題可用`,
    questions: shuffle(pool).slice(0, 10),
    meta: { chapter, type },
    scoring: null,
    timer: null,
    answers: {},
  };
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
      .map((chapter) => ({ chapter, capacity: getQuestionPool(chapter, type).length - allocations[chapter] }))
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

  return {
    mode: "mode2",
    title: `${TYPE_LABELS[type]}綜合測驗`,
    subtitle: "50 題平均分配到各章節",
    questions: shuffle(questions),
    meta: { type, allocations },
    scoring: null,
    timer: null,
    answers: {},
  };
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

  return {
    mode: "mode3",
    title: `${subject}模擬測驗`,
    subtitle: "依指定章節配額抽題，含倒數與超時計時",
    questions: shuffle(questions),
    meta: { subject, blueprint },
    scoring: blueprint.scoring,
    timer: {
      limitMs: blueprint.timeLimitMinutes * 60 * 1000,
      startedAt: Date.now(),
    },
    answers: {},
  };
}

function renderQuiz() {
  const quiz = state.currentQuiz;
  refs.quizModeLabel.textContent = MODE_LABELS[quiz.mode];
  refs.quizTitle.textContent = quiz.title;
  refs.quizSubtitle.textContent = quiz.subtitle;
  refs.progressBox.textContent = `共 ${quiz.questions.length} 題`;
  refs.quizForm.innerHTML = quiz.questions
    .map((question, index) => renderQuestionCard(question, index + 1))
    .join("");
  refs.quizForm.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", handleAnswerChange);
  });
}

function renderQuestionCard(question, number) {
  const options = question.options
    .map(
      (option) => `
        <label class="option">
          <input
            type="radio"
            name="${escapeHtml(question.id)}"
            value="${escapeHtml(option.label)}"
            ${state.currentQuiz.answers[question.id] === option.label ? "checked" : ""}
          />
          <span><strong>${escapeHtml(option.label)}</strong> ${escapeHtml(option.text)}</span>
        </label>
      `
    )
    .join("");

  return `
    <article class="question-card">
      <div class="question-card__meta">
        <span class="tag">第 ${number} 題</span>
        <span class="tag">來源序號 ${question.sourceNo}</span>
        <span class="tag">${escapeHtml(question.chapter)}</span>
        <span class="tag">${TYPE_LABELS[question.type]}</span>
      </div>
      <h3>${escapeHtml(question.questionText)}</h3>
      <div class="option-list">${options}</div>
    </article>
  `;
}

function handleAnswerChange(event) {
  state.currentQuiz.answers[event.target.name] = event.target.value;
  const answered = Object.keys(state.currentQuiz.answers).length;
  refs.progressBox.textContent = `已作答 ${answered} / ${state.currentQuiz.questions.length} 題`;
}

function submitQuiz() {
  const quiz = state.currentQuiz;
  if (!quiz) return;

  clearTimer();

  const results = quiz.questions.map((question) => {
    const selected = quiz.answers[question.id] ?? null;
    const isCorrect = selected === question.answer;
    return { question, selected, isCorrect };
  });

  const stats = calculateStats(quiz, results);
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
  hideAllViews();
  refs.resultView.hidden = false;
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
  if (stats.timedOut && quiz.mode === "mode3") {
    summaryCards.push({ label: "時間狀態", value: "已超時" });
  }

  refs.resultSummary.innerHTML = `<div class="stat-grid">${summaryCards
    .map(
      (card) => `
        <div class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `
    )
    .join("")}</div>`;

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

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function restartCurrentMode() {
  const lastMode = state.currentQuiz?.mode ?? state.selectedMode;
  state.currentQuiz = null;
  clearTimer();
  goHome();
  selectMode(lastMode ?? null);
}

function goHome() {
  state.currentQuiz = null;
  clearTimer();
  hideAllViews();
  refs.setupView.hidden = false;
}

function showQuizView() {
  hideAllViews();
  refs.quizView.hidden = false;
}

function hideAllViews() {
  refs.setupView.hidden = true;
  refs.quizView.hidden = true;
  refs.resultView.hidden = true;
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
