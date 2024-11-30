(function () {
    'use strict';

    // Cambia il titolo della pagina
    document.title = "CLERK HANDOVER";

    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null; // Contatore dei truck visibili

    // Costanti
    const DEFAULT_HOURS = 1; // Valore del filtro iniziale per Refresh
    const INITIAL_HOURS = 1; // Valore del filtro iniziale per Visualizza Trucks
    const MAX_HOURS = 24; // Filtro massimo: 24 ore

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};

    // Crea la barra superiore con i pulsanti e i filtri
    function createButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '10px';
        buttonContainer.style.left = '10px';
        buttonContainer.style.zIndex = '10001';
        buttonContainer.style.display = 'flex';

        // Bottone "Visualizza TRUCKS"
        const trucksButton = createButtonForPageLoadAndDataExtraction();
        buttonContainer.appendChild(trucksButton);

        // Bottone "Visualizza Recuperi"
        const recoveriesButton = document.createElement('button');
        recoveriesButton.innerHTML = 'Visualizza Recuperi';
        recoveriesButton.style.padding = '8px';
        recoveriesButton.style.backgroundColor = '#007bff';
        recoveriesButton.style.color = 'white';
        recoveriesButton.style.border = 'none';
        recoveriesButton.style.borderRadius = '5px';
        recoveriesButton.style.marginRight = '10px';
        recoveriesButton.addEventListener('click', fetchBufferSummary);
        buttonContainer.appendChild(recoveriesButton);

        dropdown = document.createElement('select');
        dropdown.style.display = 'inline-block';
        dropdown.style.marginRight = '5px';
        dropdown.style.padding = '3px';
        ['Tutti', 'CPT', 'SWEEPER', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });

        dropdown.addEventListener('change', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : INITIAL_HOURS);
        });

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.padding = '3px';
        timeInputBox.style.marginRight = '5px';
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.padding = '3px';
        printButton.style.backgroundColor = '#2196F3';
        printButton.style.color = 'white';
        printButton.style.border = 'none';
        printButton.style.borderRadius = '3px';
        printButton.style.marginRight = '5px';
        printButton.addEventListener('click', function () {
            printTable(tableContainer);
        });

        rowCountDisplay = document.createElement('div');
        rowCountDisplay.style.marginLeft = '10px';
        rowCountDisplay.style.padding = '3px';
        rowCountDisplay.style.color = '#000';
        rowCountDisplay.style.fontWeight = 'bold';

        buttonContainer.appendChild(dropdown);
        buttonContainer.appendChild(timeInputBox);
        buttonContainer.appendChild(printButton);
        buttonContainer.appendChild(rowCountDisplay);

        document.body.appendChild(buttonContainer);
    }

    // Creazione del pulsante "Visualizza TRUCKS"
    function createButtonForPageLoadAndDataExtraction() {
        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '8px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.marginRight = '10px';

        button.addEventListener('click', function () {
            loadIframeAndWait(INITIAL_HOURS);
        });

        return button;
    }

    // Aggiorna dati per i TRUCKS
    function refreshData() {
        dropdown.value = 'Tutti';
        timeInputBox.value = DEFAULT_HOURS;
        loadIframeAndWait(DEFAULT_HOURS);
    }

    // Carica iframe e posizionalo per estrazione dati
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

                allRows = rows.map(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length >= 15) {
                        const sdt = tds[13].textContent.trim();
                        const cpt = tds[14].textContent.trim();
                        const lane = tds[5].textContent.trim();

                        const rowDate = parseDate(sdt);

                        let extraText = 'SWEEPER';
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
                            lane,
                            sdt,
                            cpt,
                            extraText,
                            highlightColor,
                        };
                    }
                }).filter(Boolean);

                filterAndShowData(hours);
            }
        }
    }

    function parseDate(dateString) {
        const parsedDate = new Date(dateString);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    function filterAndShowData(hours) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const filteredRows = allRows.filter(row => row.date <= maxDate);
        showDataInTable(filteredRows);
    }

    function showDataInTable(filteredRows) {
        if (tableContainer) tableContainer.remove();
        tableContainer = document.createElement('div');
        tableContainer.style.padding = '15px';

        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>LANE</th><th>SDT</th><th>CPT</th><th>Status</th></tr></thead>
            <tbody>${filteredRows.map(row => `<tr><td>${row.lane}</td><td>${row.sdt}</td><td>${row.cpt}</td><td>${row.extraText}</td></tr>`).join('')}</tbody>
        `;

        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    // Inizializza l'interfaccia
    createButtons();
})();
