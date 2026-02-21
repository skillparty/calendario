// PDF generation and export modal for Calendar10
// Depends on state for tasks, and provides UI hooks for export modal
/**
 * @typedef {import('../types').Task} Task
 */

import { state, getTasks } from '../store/state';
import { showToast } from '../utils/UIFeedback';
import { openModal, closeModal } from '../utils/modal.js';

/** @returns {void} */
export function showPdfExportModal() {
  const modal = document.getElementById('pdf-export-modal');
  if (!modal) return;
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-month-select'));
  const yearSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-year-select'));
  if (monthSel) monthSel.value = String(now.getMonth());
  // Populate year selector dynamically
  if (yearSel) {
    yearSel.innerHTML = '';
    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === currentYear) opt.selected = true;
      yearSel.appendChild(opt);
    }
  }
  toggleExportOptions();

  const closeBtn = /** @type {HTMLElement | null} */ (modal.querySelector('.close-btn'));
  const cancelBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('cancel-pdf-btn'));
  const generateBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('generate-pdf-btn'));

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.addEventListener('click', closePdfExportModal);
    closeBtn.dataset.bound = 'true';
  }

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', closePdfExportModal);
    cancelBtn.dataset.bound = 'true';
  }

  if (generateBtn && !generateBtn.dataset.bound) {
    generateBtn.addEventListener('click', generatePDF);
    generateBtn.dataset.bound = 'true';
  }

  openModal(modal, {
    initialFocusSelector: 'input[name="export-type"]:checked'
  });
}

/** @returns {void} */
export function closePdfExportModal() {
  const modal = document.getElementById('pdf-export-modal');
  if (!modal) return;
  closeModal(modal);
}

/** @returns {void} */
export function toggleExportOptions() {
  const selectedTypeEl = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="export-type"]:checked'));
  const selectedType = selectedTypeEl?.value || 'all';
  const monthSelection = document.getElementById('month-selection');
  const customRange = document.getElementById('custom-range');
  if (monthSelection) monthSelection.classList.add('hidden');
  if (customRange) customRange.classList.add('hidden');
  if (selectedType === 'month' && monthSelection) monthSelection.classList.remove('hidden');
  if (selectedType === 'custom' && customRange) customRange.classList.remove('hidden');
}

/** @returns {Promise<any>} */
async function loadJsPDF() {
  if (window.jspdf) return window.jspdf;

  showToast('Cargando librería PDF...', { type: 'info', duration: 2000 });

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf) resolve(window.jspdf);
      else reject(new Error('jsPDF loaded but window.jspdf is undefined'));
    };
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });
}

/** @returns {Promise<void>} */
export async function generatePDF() {
  try {
    let jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) {
      try {
        jsPDFLib = await loadJsPDF();
      } catch (err) {
        showToast('La librería jsPDF no está disponible. Verifica tu conexión e inténtalo de nuevo.', {
          type: 'error',
          duration: 4200
        });
        return;
      }
    }

    if (!jsPDFLib || !jsPDFLib.jsPDF) {
      throw new Error('jsPDF library invalid');
    }

    const { jsPDF } = jsPDFLib;
    const doc = new jsPDF();

    const exportTypeEl = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="export-type"]:checked'));
    const includeCompletedEl = /** @type {HTMLInputElement | null} */ (document.getElementById('include-completed'));
    const includePendingEl = /** @type {HTMLInputElement | null} */ (document.getElementById('include-pending'));
    const exportType = exportTypeEl?.value || 'all';
    const includeCompleted = includeCompletedEl?.checked ?? true;
    const includePending = includePendingEl?.checked ?? true;

    const tasks = getFilteredTasksForPDF(exportType, includeCompleted, includePending);
    if (tasks.length === 0) {
      showToast('No hay tareas que coincidan con los criterios seleccionados.', {
        type: 'warning'
      });
      return;
    }

    generatePDFContent(doc, tasks, exportType);
    const filename = generatePDFFilename(exportType);
    doc.save(filename);
    closePdfExportModal();
    showToast(`PDF generado exitosamente: ${filename}`, {
      type: 'success',
      duration: 3600
    });
  } catch (e) {
    console.error('Error generating PDF:', e);
    showToast('Error al generar el PDF. Por favor, inténtalo de nuevo.', {
      type: 'error',
      duration: 4200
    });
  }
}

/**
 * @param {string} exportType
 * @param {boolean} includeCompleted
 * @param {boolean} includePending
 * @returns {Task[]}
 */
export function getFilteredTasksForPDF(exportType, includeCompleted, includePending) {
  const allTasks = Object.entries(getTasks()).flatMap(([date, list]) => (list || []).map(t => ({ ...t, date: date === 'undated' ? null : date })));
  if (exportType === 'month') {
    const monthSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-month-select'));
    const yearSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-year-select'));
    const selectedMonth = parseInt(monthSelect?.value || '0', 10);
    const selectedYear = parseInt(yearSelect?.value || String(new Date().getFullYear()), 10);
    return pureFilterTasksForPDF(allTasks, { exportType, includeCompleted, includePending, month: selectedMonth, year: selectedYear });
  }
  if (exportType === 'custom') {
    const startDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('start-date'));
    const endDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('end-date'));
    const startDate = startDateInput?.value || '';
    const endDate = endDateInput?.value || '';
    return pureFilterTasksForPDF(allTasks, { exportType, includeCompleted, includePending, startDate, endDate });
  }
  return pureFilterTasksForPDF(allTasks, { exportType, includeCompleted, includePending });
}

/**
 * Pure filtering used by tests and by getFilteredTasksForPDF.
 * @param {Task[]} allTasks
 * @param {{exportType: string, includeCompleted: boolean, includePending: boolean, month?: number, year?: number, startDate?: string, endDate?: string}} opts
 * @returns {Task[]}
 */
export function pureFilterTasksForPDF(allTasks, opts) {
  const { exportType, includeCompleted, includePending, month, year, startDate, endDate } = opts;
  let tasks = [...allTasks];
  tasks = tasks.filter(task => {
    if (task.completed && !includeCompleted) return false;
    if (!task.completed && !includePending) return false;
    return true;
  });

  if (exportType === 'month') {
    if (typeof month !== 'number' || typeof year !== 'number') return [];
    tasks = tasks.filter(task => {
      if (!task.date) return false;
      const d = new Date(task.date + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
  } else if (exportType === 'custom') {
    if (!startDate || !endDate) return [];
    if (new Date(startDate) > new Date(endDate)) return [];
    tasks = tasks.filter(task => {
      if (!task.date) return false;
      const d = new Date(task.date + 'T00:00:00');
      const s = new Date(startDate + 'T00:00:00');
      const e = new Date(endDate + 'T23:59:59');
      return d >= s && d <= e;
    });
  }

  tasks.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return -1;
    if (!b.date) return 1;
    const da = new Date(a.date + 'T00:00:00');
    const db = new Date(b.date + 'T00:00:00');
    if (da.getTime() === db.getTime()) {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return 0;
    }
    return da.getTime() - db.getTime();
  });

  return tasks;
}

/**
 * Truncate text to fit a given width in mm at the current font size.
 * Uses the doc's getStringUnitWidth to measure.
 * @param {any} doc
 * @param {string} text
 * @param {number} maxWidth - max width in mm
 * @returns {string}
 */
function truncateText(doc, text, maxWidth) {
  if (!text) return '';
  const fontSize = doc.getFontSize();
  const ellipsis = '...';
  const fullWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
  if (fullWidth <= maxWidth) return text;
  // Binary search for max chars that fit
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const w = doc.getStringUnitWidth(text.substring(0, mid) + ellipsis) * fontSize / doc.internal.scaleFactor;
    if (w <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return text.substring(0, lo) + ellipsis;
}

/**
 * Short date format for PDF table cells (DD/MM/YYYY)
 * @param {string} dateString
 * @returns {string}
 */
function shortDate(dateString) {
  if (!dateString) return 'Sin fecha';
  const d = new Date(dateString + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * @param {any} doc
 * @param {Task[]} tasks
 * @param {string} exportType
 * @returns {void}
 */
function generatePDFContent(doc, tasks, exportType) {
  const pageWidth = doc.internal.pageSize.getWidth(); // 210 for A4
  const left = 14;
  const tableWidth = pageWidth - left * 2; // ~182

  // Column definitions: Title, Fecha, Hora, Prioridad, Estado
  const colRatios = [0.36, 0.18, 0.12, 0.14, 0.20];
  const widths = colRatios.map(r => r * tableWidth);
  const pos = [];
  let cx = left;
  for (const w of widths) { pos.push(cx); cx += w; }
  const headers = ['Tarea', 'Fecha', 'Hora', 'Prioridad', 'Estado'];
  const rowH = 8;
  const headerH = 10;

  // ── Title & subtitle ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(237, 174, 73);
  doc.text('Calendar10 - Reporte de Tareas', left, 22);
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');

  let subtitle = '';
  if (exportType === 'all') subtitle = 'Todas las tareas ordenadas por fecha';
  if (exportType === 'month') {
    const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-month-select'));
    const yearSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-year-select'));
    const m = parseInt(monthSelect?.value || '0', 10);
    const yr = parseInt(yearSelect?.value || String(new Date().getFullYear()), 10);
    subtitle = `Tareas de ${names[m]} ${yr}`;
  }
  if (exportType === 'custom') {
    const startDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('start-date'));
    const endDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('end-date'));
    const s = startDateInput?.value || '';
    const e = endDateInput?.value || '';
    subtitle = `Tareas del ${formatDateForDisplay(s)} al ${formatDateForDisplay(e)}`;
  }
  doc.text(subtitle, left, 31);
  const now = new Date();
  doc.setFontSize(9);
  doc.text(`Generado: ${now.toLocaleDateString('es-ES')} – ${now.toLocaleTimeString('es-ES')}`, left, 38);

  let y = 48;

  // ── Helper to draw header row ──
  function drawHeader() {
    doc.setFillColor(50, 50, 60);
    doc.rect(left, y - 5, tableWidth, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => doc.text(h, pos[i] + 2, y + 1));
    y += headerH;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  }

  drawHeader();

  const priorityLabels = { 1: 'Alta', 2: 'Media', 3: 'Baja' };
  const priorityColors = { 1: [220, 53, 69], 2: [255, 193, 7], 3: [40, 167, 69] };

  doc.setFontSize(9);

  tasks.forEach((task, index) => {
    if (y > 272) {
      doc.addPage();
      y = 20;
      drawHeader();
      doc.setFontSize(9);
    }

    // Zebra striping
    if (index % 2 === 0) {
      doc.setFillColor(245, 246, 250);
      doc.rect(left, y - 5, tableWidth, rowH, 'F');
    }

    // Title (clipped to column width)
    doc.setTextColor(30, 30, 30);
    const titleText = truncateText(doc, task.title || '', widths[0] - 4);
    doc.text(titleText, pos[0] + 2, y);

    // Date (short format)
    doc.setTextColor(80, 80, 80);
    doc.text(shortDate(task.date), pos[1] + 2, y);

    // Time
    doc.text(task.time || '—', pos[2] + 2, y);

    // Priority
    const prio = task.priority || 3;
    const pColor = priorityColors[prio] || [80, 80, 80];
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text(priorityLabels[prio] || 'Baja', pos[3] + 2, y);

    // Status
    const statusText = task.completed ? 'Completada' : 'Pendiente';
    doc.setTextColor(task.completed ? 40 : 200, task.completed ? 167 : 120, task.completed ? 69 : 0);
    doc.setFont('helvetica', task.completed ? 'bold' : 'normal');
    doc.text(statusText, pos[4] + 2, y);
    doc.setFont('helvetica', 'normal');

    doc.setTextColor(0, 0, 0);
    y += rowH;
  });

  // ── Summary ──
  y += 12;
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 60);
  doc.text('Resumen', left, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.filter(t => !t.completed).length;
  doc.setTextColor(60, 60, 60);
  doc.text(`Total de tareas: ${tasks.length}`, left, y); y += 7;
  doc.setTextColor(40, 167, 69);
  doc.text(`Completadas: ${completedCount}`, left, y); y += 7;
  doc.setTextColor(255, 152, 0);
  doc.text(`Pendientes: ${pendingCount}`, left, y);

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text('Generado por Calendar10 – skillparty', left, 285);
}

/** @param {string} dateString @returns {string} */
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  /** @type {Intl.DateTimeFormatOptions} */
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

/**
 * Generates the PDF filename based on export type
 * @param {string} exportType - 'all', 'month', or 'custom'
 * @returns {string}
 */
function generatePDFFilename(exportType) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format

  if (exportType === 'all') {
    return `Calendar10_Todas_las_Tareas_${dateStr}.pdf`;
  }

  if (exportType === 'month') {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-month-select'));
    const yearSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-year-select'));
    if (monthSelect && yearSelect) {
      const month = parseInt(monthSelect.value, 10);
      const year = parseInt(yearSelect.value, 10);
      return `Calendar10_${monthNames[month]}_${year}_${dateStr}.pdf`;
    }
  }

  if (exportType === 'custom') {
    const startDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('start-date'));
    const endDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('end-date'));
    if (startDateInput && endDateInput) {
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      return `Calendar10_${startDate}_a_${endDate}_${dateStr}.pdf`;
    }
  }

  // Fallback
  return `Calendar10_Export_${dateStr}.pdf`;
}

// Attach one-time delegation for export type change
if (typeof document !== 'undefined') {
  (function attachExportTypeDelegation() {
    const modal = /** @type {HTMLElement | null} */ (document.getElementById('pdf-export-modal'));
    if (!modal) return; // will be attached again when app starts if not present yet
    if (!modal.dataset.listenersAttached) {
      modal.addEventListener('change', (e) => {
        const target = /** @type {HTMLInputElement | null} */ (e.target instanceof HTMLInputElement ? e.target : null);
        if (target && target.name === 'export-type') toggleExportOptions();
      });
      modal.dataset.listenersAttached = 'true';
    }
  })();
}

// Expose for inline handlers (browser only)
if (typeof window !== 'undefined') {
  window.showPdfExportModal = showPdfExportModal;
  window.closePdfExportModal = closePdfExportModal;
  window.generatePDF = generatePDF;
  window.toggleExportOptions = toggleExportOptions;
}
