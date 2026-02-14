// PDF generation and export modal for Calendar10
// Depends on state for tasks, and provides UI hooks for export modal
/**
 * @typedef {import('./types').Task} Task
 */

import { state, getTasks } from './state.js';
import { showToast } from './utils/UIFeedback.js';
import { openModal, closeModal } from './utils/modal.js';

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

/** @returns {void} */
export function generatePDF() {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('La librería jsPDF no está disponible. Verifica tu conexión e inténtalo de nuevo.', {
        type: 'error',
        duration: 4200
      });
      return;
    }
    const { jsPDF } = window.jspdf;
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
 * @param {any} doc
 * @param {Task[]} tasks
 * @param {string} exportType
 * @returns {void}
 */
function generatePDFContent(doc, tasks, exportType) {
  doc.setFont('helvetica');
  doc.setFontSize(20);
  doc.setTextColor(237, 174, 73);
  doc.text('Calendar10 - Reporte de Tareas', 20, 25);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  let subtitle = '';
  if (exportType === 'all') subtitle = 'Todas las tareas ordenadas por fecha';
  if (exportType === 'month') {
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-month-select'));
    const yearSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('pdf-year-select'));
    const m = parseInt(monthSelect?.value || '0', 10);
    const y = parseInt(yearSelect?.value || String(new Date().getFullYear()), 10);
    subtitle = `Tareas de ${names[m]} ${y}`;
  }
  if (exportType === 'custom') {
    const startDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('start-date'));
    const endDateInput = /** @type {HTMLInputElement | null} */ (document.getElementById('end-date'));
    const s = startDateInput?.value || '';
    const e = endDateInput?.value || '';
    subtitle = `Tareas del ${formatDateForDisplay(s)} al ${formatDateForDisplay(e)}`;
  }
  doc.text(subtitle, 20, 35);
  const now = new Date();
  doc.text(`Generado el: ${now.toLocaleDateString('es-ES')} a las ${now.toLocaleTimeString('es-ES')}`, 20, 45);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');

  let y = 60; const left = 20; const widths = [80, 35, 25, 30];
  const pos = [left, left + widths[0], left + widths[0] + widths[1], left + widths[0] + widths[1] + widths[2]];
  doc.rect(left, y - 5, widths.reduce((a, b) => a + b, 0), 10);
  doc.text('Título de la Tarea', pos[0] + 2, y);
  doc.text('Fecha', pos[1] + 2, y);
  doc.text('Hora', pos[2] + 2, y);
  doc.text('Estado', pos[3] + 2, y);
  y += 10; doc.setFont('helvetica', 'normal');

  tasks.forEach((task, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20; doc.setFont('helvetica', 'bold');
      doc.rect(left, y - 5, widths.reduce((a, b) => a + b, 0), 10);
      doc.text('Título de la Tarea', pos[0] + 2, y);
      doc.text('Fecha', pos[1] + 2, y);
      doc.text('Hora', pos[2] + 2, y);
      doc.text('Estado', pos[3] + 2, y);
      y += 10; doc.setFont('helvetica', 'normal');
    }
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(left, y - 5, widths.reduce((a, b) => a + b, 0), 8, 'F');
    }
    let title = task.title; if (title.length > 35) title = title.substring(0, 32) + '...';
    doc.text(title, pos[0] + 2, y);
    const dateText = task.date ? formatDateForDisplay(task.date) : 'Sin fecha';
    doc.text(dateText, pos[1] + 2, y);
    doc.text(task.time || '-', pos[2] + 2, y);
    const statusText = task.completed ? '✓ Completada' : '○ Pendiente';
    doc.setTextColor(task.completed ? 76 : 255, task.completed ? 175 : 152, task.completed ? 80 : 0);
    doc.text(statusText, pos[3] + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  });

  y += 10; if (y > 260) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.text('Resumen:', left, y); y += 8;
  doc.setFont('helvetica', 'normal');
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.filter(t => !t.completed).length;
  doc.text(`Total de tareas: ${tasks.length}`, left, y); y += 6;
  doc.setTextColor(76, 175, 80); doc.text(`Tareas completadas: ${completedCount}`, left, y); y += 6;
  doc.setTextColor(255, 152, 0); doc.text(`Tareas pendientes: ${pendingCount}`, left, y);
  doc.setTextColor(100, 100, 100); doc.setFontSize(8);
  doc.text('Generado por Calendar10 - skillparty', left, 285);
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
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
