// URL de tu flujo Power Automate (When an HTTP request is received)
const flowUrl = 'https://prod-50.japaneast.logic.azure.com:443/workflows/19f7484aae0d457390cfab1df96f21ae/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=veWyUpNEVJUeqCViLnjyowoJgYo6qx0NOj1564DKROU';

// Configuración: cuántos ciclos exige cada tipo
const cycleConfig = {
  Operacion:             1,
  Setup:                 1,
  Corte:                 15,
  'Cambio Aplicador':    1,
  'Cambio de Terminal':  1
};

// Referencias al DOM
const operatorModal     = document.getElementById('operatorModal');
const cycleTypeModal    = document.getElementById('cycleTypeModal');
const operatorSubmit    = document.getElementById('operatorSubmit');
const cycleTypeButton   = document.getElementById('cycleTypeButton');
const cycleTypeLabel    = document.getElementById('cycleTypeLabel');
const cycleOptions      = document.querySelectorAll('.btn-option');

const operatorInput     = document.getElementById('operatorNumber');
const operatorDisplay   = document.getElementById('operatorDisplay');
const errorMsg          = document.getElementById('errorMsg');
const errorMsgType      = document.getElementById('errorMsgType');

const resultModal       = document.getElementById('resultModal');
const operatorResult    = document.getElementById('operatorResult');
const cycleTypeResult   = document.getElementById('cycleTypeResult');
const averageTimeEl     = document.getElementById('averageTime');
const resultOk          = document.getElementById('resultOk');

const timerDisplay      = document.getElementById('timer');
const markButton        = document.getElementById('markButton');
const cycleCountEl      = document.getElementById('cycleCount');
const cycleTotalEl      = document.getElementById('cycleTotal');
const cyclesBody        = document.getElementById('cyclesBody');

let operatorNumber, cycleType, requiredCycles;
let cycleTimes = [];
let lastMarkTime = 0;
let timerInterval;

// 1. Inicialización al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  operatorModal.style.display = 'flex';
  cycleTypeModal.style.display = 'none';
  markButton.disabled = true;
  errorMsg.textContent = '';
  errorMsgType.textContent = '';
  cycleTotalEl.textContent = '0';
  cycleCountEl.textContent = '0';
});

// 2. Abrir modal de selección de tipo de ciclo
cycleTypeButton.addEventListener('click', () => {
  errorMsgType.textContent = '';
  cycleTypeModal.style.display = 'flex';
});

// 3. Seleccionar tipo y cerrar modal
cycleOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    cycleType = btn.dataset.value;
    cycleTypeLabel.textContent = btn.textContent;
    cycleTypeModal.style.display = 'none';
  });
});

// 4. Iniciar medición
operatorSubmit.addEventListener('click', () => {
  const val = operatorInput.value.trim();
  if (!/^\d{6}$/.test(val)) {
    errorMsg.textContent = 'El número debe tener 6 dígitos.';
    return;
  }
  if (!cycleConfig[cycleType]) {
    errorMsgType.textContent = 'Selecciona un tipo de ciclo.';
    return;
  }

  operatorNumber = val;
  requiredCycles = cycleConfig[cycleType];

  operatorDisplay.textContent   = `Operador: ${operatorNumber}`;
  cycleTotalEl.textContent      = requiredCycles;
  operatorResult.textContent    = `Operador: ${operatorNumber}`;
  cycleTypeResult.textContent   = `Tipo de ciclo: ${cycleType}`;

  operatorModal.style.display   = 'none';
  markButton.disabled           = false;

  startStopwatch();
});

// 5. Cronómetro
function startStopwatch() {
  lastMarkTime                  = Date.now();
  timerDisplay.textContent      = '00:00.00';
  cycleTimes                    = [];
  cyclesBody.innerHTML          = '';
  cycleCountEl.textContent      = '0';
  timerInterval                 = setInterval(updateStopwatch, 50);
}

function updateStopwatch() {
  const diff = Date.now() - lastMarkTime;
  const m    = String(Math.floor(diff/60000)).padStart(2,'0');
  const s    = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
  const c    = String(Math.floor((diff%1000)/10)).padStart(2,'0');
  timerDisplay.textContent = `${m}:${s}.${c}`;
}

// 6. Marcar fin de ciclo
markButton.addEventListener('click', () => {
  const now     = Date.now();
  const elapsed = now - lastMarkTime;
  cycleTimes.push(elapsed);
  cycleCountEl.textContent = cycleTimes.length;
  addCycleRow(cycleTimes.length, formatTime(elapsed));

  if (cycleTimes.length < requiredCycles) {
    lastMarkTime = now;
  } else {
    clearInterval(timerInterval);
    showAverageAndSend();
  }
});

// 7. Mostrar promedio y enviar datos
function showAverageAndSend() {
  const sum    = cycleTimes.reduce((a,b) => a + b, 0);
  const avgMs  = sum / cycleTimes.length;
  const avgSec = Math.round(avgMs / 1000);

  averageTimeEl.textContent = formatTime(avgMs);
  resultModal.style.display = 'flex';

  // Fecha en dd/MM/yyyy
  const now = new Date();

  // Fecha base Excel: 1899-12-30
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));

  // Diferencia en milisegundos
  const diffMs = now.getTime() - excelEpoch.getTime();

  // Convertir a días (1 día = 86400000 ms)
  const excelDateNum = diffMs / 86400000;

  // Construir payload con todas las columnas
  const payload = {
    fecha: excelDateNum,
    numeroReloj: operatorNumber,
    Operacion: '-',
    Setup: '-',
    Corte: '-',
    'Cambio Aplicador': '-',
    'Cambio de Terminal': '-'
  };
  payload[cycleType] = avgSec;

  // Enviar al flujo
  fetch(flowUrl, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) {
        return res.text().then(text => console.error('HTTP Error', res.status, text));
      }
      return res.json().then(data => console.log('Flow response', data));
    })
    .catch(err => console.error('Fetch error', err));
}

// 8. Botón Finalizar recarga
resultOk.addEventListener('click', () => location.reload());

// 9. Helpers
function addCycleRow(num, timeStr) {
  const row = cyclesBody.insertRow();
  row.insertCell(0).textContent = num;
  row.insertCell(1).textContent = timeStr;
}

function formatTime(ms) {
  const m = String(Math.floor(ms/60000)).padStart(2,'0');
  const s = String(Math.floor((ms%60000)/1000)).padStart(2,'0');
  const c = String(Math.floor((ms%1000)/10)).padStart(2,'0');
  return `${m}:${s}.${c}`;
}
