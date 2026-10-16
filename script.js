
const API_URL = "https://opentdb.com/api.php";

const $ = id => document.getElementById(id);

const el = {
  start: $("start-screen"),
  quiz: $("quiz-screen"),
  result: $("result-screen"),
  loading: $("loading-screen"),
  error: $("error-screen"),
  difficulty: $("difficulty"),
  amount: $("amount"),
  startBtn: $("start-btn"),
  counter: $("question-counter"),
  score: $("score"),
  progress: $("progress-bar"),
  category: $("category"),
  difficultyLabel: $("difficulty-label"),
  question: $("question"),
  answers: $("answers"),
  feedback: $("feedback"),
  next: $("next-btn"),
  resultIcon: $("result-icon"),
  resultTitle: $("result-title"),
  resultMessage: $("result-message"),
  finalScore: $("final-score"),
  scoreDetail: $("score-detail"),
  correctCount: $("correct-count"),
  wrongCount: $("wrong-count"),
  accuracy: $("accuracy"),
  restart: $("restart-btn"),
  home: $("home-btn"),
  retry: $("retry-btn"),
  errorHome: $("error-home-btn"),
  errorMessage: $("error-message")
};

let questions = [];
let currentQuestion = 0;
let score = 0;
let correctAnswers = 0;
let answered = false;
let gameToken = 0;

const difficultyNames = {
  easy: "Fácil",
  medium: "Intermedio",
  hard: "Difícil"
};

// Verificar que el HTML tiene los elementos necesarios.
function validarHTML() {
  const missing = Object.entries(el)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missing.length) {
    console.error("Faltan elementos HTML:", missing);
    alert(
      "Faltan elementos en index.html: " +
      missing.join(", ") +
      ". Comprueba que estás usando el HTML de Trivia Quest."
    );
    return false;
  }

  return true;
}

// Convertir entidades HTML a texto normal.
function decodeHTML(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

// Traducción opcional. Si falla, devuelve el original.
async function traducir(texto) {
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=en&tl=es&dt=t&q=" +
      encodeURIComponent(texto);

    const response = await fetch(url);

    if (!response.ok) return texto;

    const data = await response.json();

    return data[0]
      .map(part => part[0] || "")
      .join("") || texto;
  } catch {
    return texto;
  }
}

// Mezclar respuestas.
function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// Cambiar de pantalla.
function showScreen(screen) {
  [
    el.start,
    el.quiz,
    el.result,
    el.loading,
    el.error
  ].forEach(item => {
    item.hidden = item !== screen;
  });
}

// Cargar las preguntas y comenzar.
async function startGame() {
  const token = ++gameToken;

  showScreen(el.loading);
  el.startBtn.disabled = true;

  try {
    const url = new URL(API_URL);

    url.searchParams.set("amount", el.amount.value);
    url.searchParams.set("difficulty", el.difficulty.value);
    url.searchParams.set("type", "multiple");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "No se pudo conectar con Open Trivia DB. Comprueba Internet."
      );
    }

    const data = await response.json();

    if (token !== gameToken) return;

    if (data.response_code !== 0 || !data.results?.length) {
      throw new Error(
        "No hay preguntas para esta dificultad. Prueba otra cantidad."
      );
    }

    // Primero cargar las preguntas originales para que el juego
    // pueda empezar incluso si el servicio de traducción falla.
    questions = data.results.map(item => {
      const correct = decodeHTML(item.correct_answer);
      const incorrect = item.incorrect_answers.map(decodeHTML);

      return {
        category: decodeHTML(item.category),
        difficulty: item.difficulty,
        question: decodeHTML(item.question),
        correct,
        answers: shuffle([correct, ...incorrect])
      };
    });

    currentQuestion = 0;
    score = 0;
    correctAnswers = 0;
    answered = false;

    el.score.textContent = "0";

    // Mostrar la primera pregunta inmediatamente.
    showScreen(el.quiz);
    showQuestion();

    // Traducir solamente pregunta y categoría en segundo plano.
    // Las respuestas no se traducen ni se modifican.
    traducirPreguntas(token);

  } catch (error) {
    if (token !== gameToken) return;

    console.error("Error al iniciar:", error);
    el.errorMessage.textContent = error.message;
    showScreen(el.error);

  } finally {
    if (token === gameToken) {
      el.startBtn.disabled = false;
    }
  }
}

// Traducir las preguntas después de iniciar la partida.
async function traducirPreguntas(token) {
  const traducciones = await Promise.all(
    questions.map(async q => {
      const [category, question] = await Promise.all([
        traducir(q.category),
        traducir(q.question)
      ]);

      return { category, question };
    })
  );

  if (token !== gameToken) return;

  questions = questions.map((q, index) => ({
    ...q,
    category: traducciones[index].category,
    question: traducciones[index].question
  }));

  // Actualizar la pregunta visible solo si todavía no se respondió.
  if (!answered && questions[currentQuestion]) {
    el.category.textContent = questions[currentQuestion].category;
    el.question.textContent = questions[currentQuestion].question;
  }
}

// Mostrar la pregunta actual.
function showQuestion() {
  answered = false;

  const q = questions[currentQuestion];
  const total = questions.length;

  el.counter.textContent =
    `PREGUNTA ${currentQuestion + 1} DE ${total}`;

  el.progress.style.width =
    `${(currentQuestion / total) * 100}%`;

  el.category.textContent = q.category;
  el.difficultyLabel.textContent =
    difficultyNames[q.difficulty] || q.difficulty;

  el.question.textContent = q.question;
  el.feedback.textContent = "";
  el.feedback.className = "feedback";
  el.next.hidden = true;
  el.answers.innerHTML = "";

  q.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";

    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");
    text.textContent = answer;

    button.append(letter, text);

    button.addEventListener("click", () => {
      checkAnswer(answer, button);
    });

    el.answers.appendChild(button);
  });
}

// Comprobar respuesta y sumar puntos.
function checkAnswer(answer, selectedButton) {
  if (answered) return;

  answered = true;

  const q = questions[currentQuestion];
  const buttons = [...el.answers.querySelectorAll(".answer-btn")];

  buttons.forEach(button => {
    button.disabled = true;

    const text = button.querySelector("span:last-child").textContent;

    if (text === q.correct) {
      button.classList.add("correct");
    }
  });

  if (answer === q.correct) {
    score += 10;
    correctAnswers++;

    el.score.textContent = score;
    el.feedback.textContent = "¡Correcto! +10 puntos 🎉";
    el.feedback.className = "feedback success";
  } else {
    selectedButton.classList.add("incorrect");
    el.feedback.textContent =
      "Respuesta incorrecta. La correcta era: " + q.correct;
    el.feedback.className = "feedback failure";
  }

  el.progress.style.width =
    `${((currentQuestion + 1) / questions.length) * 100}%`;

  el.next.textContent =
    currentQuestion === questions.length - 1
      ? "VER RESULTADOS 🏆"
      : "SIGUIENTE PREGUNTA →";

  el.next.hidden = false;
}

// Avanzar.
function nextQuestion() {
  if (!answered) return;

  currentQuestion++;

  if (currentQuestion < questions.length) {
    showQuestion();
  } else {
    showResults();
  }
}

// Mostrar resultados.
function showResults() {
  const total = questions.length;
  const incorrect = total - correctAnswers;
  const percentage = Math.round(correctAnswers / total * 100);

  el.finalScore.textContent = score;
  el.scoreDetail.textContent =
    `${correctAnswers} de ${total} respuestas correctas`;

  el.correctCount.textContent = correctAnswers;
  el.wrongCount.textContent = incorrect;
  el.accuracy.textContent = percentage + "%";

  if (percentage === 100) {
    el.resultIcon.textContent = "🏆";
    el.resultTitle.textContent = "¡Perfecto!";
    el.resultMessage.textContent =
      "¡Increíble! Respondiste todo correctamente.";
  } else if (percentage >= 70) {
    el.resultIcon.textContent = "🎉";
    el.resultTitle.textContent = "¡Excelente trabajo!";
    el.resultMessage.textContent =
      "Tienes grandes conocimientos. ¡Sigue así!";
  } else if (percentage >= 40) {
    el.resultIcon.textContent = "💪";
    el.resultTitle.textContent = "¡Buen intento!";
    el.resultMessage.textContent =
      "¡Sigue practicando para mejorar!";
  } else {
    el.resultIcon.textContent = "📚";
    el.resultTitle.textContent = "¡Sigue practicando!";
    el.resultMessage.textContent =
      "Cada partida es una oportunidad para aprender.";
  }

  el.progress.style.width = "100%";
  showScreen(el.result);
}

// Volver al inicio e invalidar traducciones pendientes.
function goHome() {
  gameToken++;
  showScreen(el.start);
}

// Inicializar solo si el HTML es correcto.
if (validarHTML()) {
  el.startBtn.addEventListener("click", startGame);
  el.next.addEventListener("click", nextQuestion);
  el.restart.addEventListener("click", startGame);
  el.home.addEventListener("click", goHome);
  el.errorHome.addEventListener("click", goHome);
  el.retry.addEventListener("click", startGame);
}
