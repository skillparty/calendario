// PDF generation and export modal for Calendar10
// Depends on state for tasks, and provides UI hooks for export modal
/**
 * @typedef {import('./types').Task} Task
 */

import { state, getTasks } from './state.js';

/** @returns {void} */
export function showPdfExportModal() {
  const modal = document.getElementById('pdf-export-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const now = new Date();
  const monthSel = document.getElementById('pdf-month-select');
  const yearSel = document.getElementById('pdf-year-select');
  if (monthSel) monthSel.value = now.getMonth();
  if (yearSel) yearSel.value = now.getFullYear();
  toggleExportOptions();

  const closeBtn = modal.querySelector('.close-btn');
  if (closeBtn) closeBtn.onclick = closePdfExportModal;
  modal.onclick = (e) => { if (e.target === modal) closePdfExportModal(); };
}

/** @returns {void} */
export function closePdfExportModal() {
  const modal = document.getElementById('pdf-export-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

/** @returns {void} */
export function toggleExportOptions() {
  const selectedType = document.querySelector('input[name="export-type"]:checked')?.value || 'all';
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
      alert('La librería jsPDF no está disponible. Verifica tu conexión e inténtalo de nuevo.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const exportType = document.querySelector('input[name="export-type"]:checked')?.value || 'all';
    const includeCompleted = document.getElementById('include-completed')?.checked ?? true;
    const includePending = document.getElementById('include-pending')?.checked ?? true;

    const tasks = getFilteredTasksForPDF(exportType, includeCompleted, includePending);
    if (tasks.length === 0) {
      alert('No hay tareas que coincidan con los criterios seleccionados.');
      return;
    }

    generatePDFContent(doc, tasks, exportType);
    const filename = generatePDFFilename(exportType);
    doc.save(filename);
    closePdfExportModal();
    alert(`PDF generado exitosamente: ${filename}`);
  } catch (e) {
    console.error('Error generating PDF:', e);
    alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
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
    const selectedMonth = parseInt(document.getElementById('pdf-month-select').value);
    const selectedYear = parseInt(document.getElementById('pdf-year-select').value);
    return pureFilterTasksForPDF(allTasks, { exportType, includeCompleted, includePending, month: selectedMonth, year: selectedYear });
  }
  if (exportType === 'custom') {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
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
    return da - db;
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
    const m = parseInt(document.getElementById('pdf-month-select').value);
    const y = parseInt(document.getElementById('pdf-year-select').value);
    subtitle = `Tareas de ${names[m]} ${y}`;
  }
  if (exportType === 'custom') {
    const s = document.getElementById('start-date').value;
    const e = document.getElementById('end-date').value;
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
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

// Attach one-time delegation for export type change
if (typeof document !== 'undefined') {
  (function attachExportTypeDelegation() {
    const modal = document.getElementById('pdf-export-modal');
    if (!modal) return; // will be attached again when app starts if not present yet
    if (!modal.dataset.listenersAttached) {
      modal.addEventListener('change', (e) => {
        if (e.target && e.target.name === 'export-type') toggleExportOptions();
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
