(function () {
    'use strict';

    // Change the title of the page
    document.title = "CLERK HANDOVER";

    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;
    let containermain = null;

    // Costanti
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;
    const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minuti in millisecondi

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
                // Nascondi la tabella e resetta lo stato
                if (tableContainer) {
                    tableContainer.style.display = 'none';
                }
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                // Mostra la tabella e carica i dati
                if (tableContainer) {
                    tableContainer.style.display = 'block';
                } else {
                    loadIframeAndWait(INITIAL_HOURS); // Carica dati per il massimo di 1 ora
                }
                refreshData(); // Ricarica i dati anche quando si visualizza la tabella
                button.innerHTML = 'Nascondi TRUCKS';
                isTableVisible = true;
            }
        });

        return button;
    }

    // Funzione per il refresh automatico dei dati
    function autoRefresh() {
        setInterval(() => {
            console.log('Eseguendo refresh automatico...');
            refreshData();
        }, REFRESH_INTERVAL); // Intervallo di 10 minuti
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
            console.log('Selezione righe impostata a 100.');
        } else {
            console.log('Dropdown per la selezione righe non trovato.');
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
                        const vrId = tds[7].textContent.trim(); // Ottieni VR ID

                        const rowDate = parseDate(sdt);

                        if (!rowDate) {
                            console.error(`Errore nel parsing della data: ${sdt}`);
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
            } else {
                console.log('Il <tbody> non è stato trovato nella tabella.');
            }
        } else {
            console.log('La tabella non è stata trovata.');
        }
    }

    function parseDate(dateString) {
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
        console.error(`Impossibile convertire la data: ${dateString}`);
        return null;
    }

    function filterAndShowData(hours) {
        const now = new Date();
        const effectiveHours = Math.min(hours, MAX_HOURS);
        const maxDate = new Date(now.getTime() + effectiveHours * 60 * 60 * 1000);

        const status = dropdown ? dropdown.value : 'Tutti';
        const vrIdFilter = vrIdInputBox.value.trim().toLowerCase();

        let filteredRows;

        if (vrIdFilter) {
            // Se c'è un filtro VR ID, ignora il filtro delle ore
            filteredRows = allRows.filter(row => 
                row.vrId.toLowerCase().includes(vrIdFilter)
            );
        } else {
            // Applica il filtro delle ore e dello stato
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
        table.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        table.innerHTML = `
            <thead style="background-color: #f4f4f4; border-bottom: 2px solid #ccc;">
                <tr>
                    <th style="padding: 10px; text-align: left;">LANE</th>
                    <th style="padding: 10px; text-align: left;">SDT</th>
                    <th style="padding: 10px; text-align: left;">CPT</th>
                    <th style="padding: 10px; text-align: left;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRows.map(row => `
                    <tr style="background-color: ${row.highlightColor};">
                        <td style="padding: 8px;">${row.lane}</td>
                        <td style="padding: 8px;">${row.sdt}</td>
                        <td style="padding: 8px;">${row.cpt}</td>
                        <td style="padding: 8px;">${row.extraText}</td>
                    </tr>`).join('')}
            </tbody>
        `;

        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    function showButtonsAndInputs() {
        const elementsContainer = document.getElementById('elements-container');
        if (elementsContainer) {
            elementsContainer.style.display = 'block';
        }
    }

    function updateRowCount(count) {
        if (rowCountDisplay) {
            rowCountDisplay.innerHTML = `Numero di righe: ${count}`;
        }
    }

    function createRowCountDisplay() {
        const display = document.createElement('div');
        display.id = 'rowCountDisplay';
        display.style.padding = '5px 10px';
        display.style.fontSize = '14px';
        display.style.color = '#333';
        display.style.fontWeight = 'bold';
        return display;
    }

    function createVrIdInputBox() {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Filtro VR ID';
        input.id = 'vrIdInputBox';
        input.style.padding = '5px';
        input.style.margin = '5px 0';
        input.style.width = '90%';
        return input;
    }

    // Esegui il refresh automatico all'avvio
    autoRefresh();

})();
