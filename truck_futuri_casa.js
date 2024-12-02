(function () {
    'use strict';

    // Variabili globali
    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;
    let containermain = null;
    let autoRefreshInterval = null; // Variabile per gestire l'intervallo di autorefresh

    // Costanti
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;

    // Funzione per creare il pulsante di caricamento dati con funzione toggle
    function createButtonForPageLoadAndDataExtraction() {
        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '3px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        let isTableVisible = false; // Stato toggle per la visibilità della tabella

        button.addEventListener('click', function () {
            if (isTableVisible) {
                if (tableContainer) {
                    tableContainer.style.display = 'none';
                }
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                if (tableContainer) {
                    tableContainer.style.display = 'block';
                } else {
                    loadIframeAndWait(INITIAL_HOURS);
                }
                button.innerHTML = 'Nascondi TRUCKS';
                isTableVisible = true;
            }
        });

        return button;
    }

    function refreshData() {
        dropdown.value = 'Tutti';
        timeInputBox.value = DEFAULT_HOURS;
        vrIdInputBox.value = '';
        loadIframeAndWait(DEFAULT_HOURS);
    }

    function loadIframeAndWait(hours) {
        let iframe = document.getElementById('pageIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pageIframe';
            iframe.style.display = 'none';
            iframe.src = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?';
            document.body.appendChild(iframe);
        }

        iframe.onload = function () {
            setTimeout(() => {
                adjustTableRowSelection(iframe);
                extractDataFromIframe(iframe, hours);
            }, 1000);
        };
    }

    function adjustTableRowSelection(iframe) {
        const iframeDoc = iframe.contentWindow.document;
        const dropdown = iframeDoc.querySelector('#dashboard_length select');

        if (dropdown) {
            dropdown.value = '100';
            const event = new Event('change', { bubbles: true });
            dropdown.dispatchEvent(event);
        }
    }

    function extractDataFromIframe(iframe, hours) {
        const iframeDoc = iframe.contentWindow.document;
        const targetTable = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL');

        if (targetTable) {
            const tbody = targetTable.querySelector('tbody');
            if (tbody) {
                const rows = Array.from(tbody.querySelectorAll('tr'));

                allRows = rows.map((row, index) => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length >= 15) {
                        const sdt = tds[13].textContent.trim();
                        const cpt = tds[14].textContent.trim();
                        const lane = tds[5].textContent.trim();
                        const vrId = tds[7].textContent.trim();

                        const rowDate = parseDate(sdt);

                        if (!rowDate) {
                            return null;
                        }

                        let extraText = 'COLLECTION';
                        let highlightColor = 'orange';
                        if (sdt === cpt) {
                            extraText = 'CPT';
                            highlightColor = 'green';
                        }
                        if (lane.startsWith('WT')) {
                            extraText = 'TRANSFER';
                            highlightColor = 'violet';
                        }

                        return {
                            index: index + 1,
                            lane: lane,
                            sdt: sdt,
                            cpt: cpt,
                            vrId: vrId,
                            date: rowDate,
                            extraText: extraText,
                            highlightColor: highlightColor,
                        };
                    }
                }).filter(Boolean);

                showButtonsAndInputs();
                filterAndShowData(hours);
            }
        }
    }

    function parseDate(dateString) {
        const parsedDate = new Date(dateString);
        return !isNaN(parsedDate.getTime()) ? parsedDate : null;
    }

    function filterAndShowData(hours) {
        const now = new Date();
        const effectiveHours = Math.min(hours, MAX_HOURS);
        const maxDate = new Date(now.getTime() + effectiveHours * 60 * 60 * 1000);

        const status = dropdown ? dropdown.value : 'Tutti';
        const vrIdFilter = vrIdInputBox.value.trim().toLowerCase();

        let filteredRows;

        if (vrIdFilter) {
            filteredRows = allRows.filter(row =>
                row.vrId.toLowerCase().includes(vrIdFilter)
            );
        } else {
            filteredRows = allRows.filter(row =>
                row.date >= now && row.date <= maxDate
            );

            if (status !== 'Tutti') {
                filteredRows = filteredRows.filter(row => row.extraText === status);
            }
        }

        showDataInTable(filteredRows);
        updateRowCount(filteredRows.length);
    }

    function showDataInTable(filteredRows) {
        if (tableContainer) {
            tableContainer.remove();
        }

        tableContainer = document.createElement('div');
        tableContainer.style.position = 'fixed';
        tableContainer.style.top = '90px';
        tableContainer.style.left = '10px';
        tableContainer.style.zIndex = '10001';
        tableContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        tableContainer.style.padding = '15px';
        tableContainer.style.maxHeight = '400px';
        tableContainer.style.overflowY = 'scroll';
        tableContainer.style.width = '25%';
        tableContainer.style.border = '1px solid #ccc';
        tableContainer.style.borderRadius = '5px';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'Arial, sans-serif';
        table.style.fontSize = '14px';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>LANE</th>
                    <th>SDT</th>
                    <th>CPT</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRows.map(row => `
                    <tr style="background-color: ${row.highlightColor}; color: white;">
                        <td>${row.lane}</td>
                        <td>${row.sdt}</td>
                        <td>${row.cpt}</td>
                        <td>${row.extraText}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    function updateRowCount(count) {
        if (rowCountDisplay) {
            rowCountDisplay.innerHTML = `NUMERO TRUCKS: ${count}`;
        }
    }

    function showButtonsAndInputs() {
        dropdown.style.display = 'inline-block';
        timeInputBox.style.display = 'inline-block';
        vrIdInputBox.style.display = 'inline-block';
        printButton.style.display = 'inline-block';
        rowCountDisplay.style.display = 'inline-block';
    }

    function createButtons() {
        containermain = document.createElement('div');
        containermain.style.position = 'fixed';
        containermain.style.top = '10px';
        containermain.style.left = '10px';
        containermain.style.zIndex = '10001';
        containermain.style.display = 'flex';

        containermain.appendChild(createButtonForPageLoadAndDataExtraction());

        dropdown = document.createElement('select');
        dropdown.style.marginRight = '5px';
        dropdown.style.display = 'none';
        ['Tutti', 'CPT', 'COLLECTION', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });

        dropdown.addEventListener('change', () => filterAndShowData(parseInt(timeInputBox.value, 10) || INITIAL_HOURS));

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.marginRight = '5px';
        timeInputBox.style.display = 'none';
        timeInputBox.addEventListener('input', () => filterAndShowData(parseInt(timeInputBox.value, 10)));

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtro VR ID';
        vrIdInputBox.style.marginRight = '5px';
        vrIdInputBox.style.display = 'none';
        vrIdInputBox.addEventListener('input', () => filterAndShowData(parseInt(timeInputBox.value, 10) || INITIAL_HOURS));

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.display = 'none';
        printButton.addEventListener('click', () => window.print());

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.marginLeft = '10px';
        rowCountDisplay.style.fontSize = '16px';
        rowCountDisplay.style.display = 'none';

        containermain.appendChild(dropdown);
        containermain.appendChild(timeInputBox);
        containermain.appendChild(vrIdInputBox);
        containermain.appendChild(printButton);
        containermain.appendChild(rowCountDisplay);

        document.body.appendChild(containermain);
    }

    // Funzione per avviare l'autorefresh
    function startAutoRefresh() {
        stopAutoRefresh();

        autoRefreshInterval = setInterval(() => {
            if (tableContainer && tableContainer.style.display !== 'none') {
                refreshData();
            }
        }, 600000); // Ogni 10 minuti
    }

    // Funzione per fermare l'autorefresh
    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // Inizializzazione
    document.addEventListener('DOMContentLoaded', () => {
        createButtons();
        startAutoRefresh();
    });
})();
