<div id="pdf-export-modal" class="modal hidden" aria-hidden="true">
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="pdf-export-title">
        <button type="button" class="close-btn" aria-label="Cerrar">&times;</button>

        <h3 id="pdf-export-title">Exportar PDF</h3>

        <div class="task-input-form-group">
            <p id="pdf-export-type-label">Tipo de exportación</p>
            <div role="radiogroup" aria-labelledby="pdf-export-type-label">
                <label><input type="radio" name="export-type" value="all" checked /> Todas las tareas</label>
                <label><input type="radio" name="export-type" value="month" /> Mes específico</label>
                <label><input type="radio" name="export-type" value="custom" /> Rango personalizado</label>
            </div>
        </div>

        <div id="month-selection" class="hidden">
            <div class="task-input-row">
                <div class="task-input-form-group">
                    <label for="pdf-month-select">Mes</label>
                    <select id="pdf-month-select" class="task-input-control">
                        <option value="0">Enero</option>
                        <option value="1">Febrero</option>
                        <option value="2">Marzo</option>
                        <option value="3">Abril</option>
                        <option value="4">Mayo</option>
                        <option value="5">Junio</option>
                        <option value="6">Julio</option>
                        <option value="7">Agosto</option>
                        <option value="8">Septiembre</option>
                        <option value="9">Octubre</option>
                        <option value="10">Noviembre</option>
                        <option value="11">Diciembre</option>
                    </select>
                </div>
                <div class="task-input-form-group">
                    <label for="pdf-year-select">Año</label>
                    <select id="pdf-year-select" class="task-input-control"></select>
                </div>
            </div>
        </div>

        <div id="custom-range" class="hidden">
            <div class="task-input-row">
                <div class="task-input-form-group">
                    <label for="start-date">Desde</label>
                    <input id="start-date" type="date" class="task-input-control" />
                </div>
                <div class="task-input-form-group">
                    <label for="end-date">Hasta</label>
                    <input id="end-date" type="date" class="task-input-control" />
                </div>
            </div>
        </div>

        <div class="task-input-form-group task-input-checkbox">
            <label><input id="include-completed" type="checkbox" checked /> Incluir completadas</label>
            <label><input id="include-pending" type="checkbox" checked /> Incluir pendientes</label>
        </div>

        <div class="task-input-actions">
            <button type="button" id="cancel-pdf-btn" class="task-input-cancel-btn">Cancelar</button>
            <button type="button" id="generate-pdf-btn" class="task-input-save-btn">Generar PDF</button>
        </div>
    </div>
</div>
