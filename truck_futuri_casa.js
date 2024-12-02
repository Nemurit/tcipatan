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

                // Configura l'osservatore per aggiornamenti in tempo reale
                observeIframeChanges(iframe);
            }, 1000);
        };
    }

    function observeIframeChanges(iframe) {
        const iframeDoc = iframe.contentWindow.document;
        const targetTable = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL');

        if (!targetTable) {
            console.log("Tabella non trovata nell'iframe.");
            return;
        }

        // Crea un osservatore per rilevare le modifiche nella tabella
        const observer = new MutationObserver(() => {
            console.log("Modifica rilevata nella tabella dell'iframe.");
            extractDataFromIframe(iframe, parseInt(timeInputBox.value || DEFAULT_HOURS, 10));
        });

        // Configura l'osservatore per monitorare cambiamenti nei figli del DOM
        observer.observe(targetTable, { childList: true, subtree: true });

        console.log("Osservatore configurato per la tabella dell'iframe.");
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
                        const vrId = tds[7].textContent.trim();

                        const rowDate = parseDate(sdt);

                        if (!rowDate) {
                            console.error(`Errore nel parsing della data: ${sdt}`);
                            return null;
                        }

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
                    <tr style="background-color: ${row.highlightColor}; color: white; text-align: left;">
                        <td style="padding: 10px;">${row.lane}</td>
                        <td style="padding: 10px;">${row.sdt}</td>
                        <td style="padding: 10px;">${row.cpt}</td>
                        <td style="padding: 10px;">${row.extraText}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    function updateRowCount(count) {
        if (rowCountDisplay) {
            rowCountDisplay.textContent = `Righe visibili: ${count}`;
        }
    }

    function showButtonsAndInputs() {
        if (!dropdown) {
            dropdown = document.createElement('select');
            dropdown.id = 'statusFilter';
            dropdown.style.marginLeft = '10px';
            dropdown.innerHTML = `
                <option value="Tutti">Tutti</option>
                <option value="CPT">CPT</option>
                <option value="SWEEPER">SWEEPER</option>
                <option value="TRANSFER">TRANSFER</option>
            `;
            dropdown.addEventListener('change', () => {
                filterAndShowData(parseInt(timeInputBox.value || DEFAULT_HOURS, 10));
            });
            document.body.appendChild(dropdown);
        }

        if (!timeInputBox) {
            timeInputBox = document.createElement('input');
            timeInputBox.type = 'number';
            timeInputBox.min = '1';
            timeInputBox.max = MAX_HOURS;
            timeInputBox.placeholder = 'Ore';
            timeInputBox.style.marginLeft = '10px';
            timeInputBox.addEventListener('change', () => {
                const hours = parseInt(timeInputBox.value || DEFAULT_HOURS, 10);
                filterAndShowData(hours);
            });
            document.body.appendChild(timeInputBox);
        }

        if (!rowCountDisplay) {
            rowCountDisplay = document.createElement('div');
            rowCountDisplay.id = 'rowCountDisplay';
            rowCountDisplay.style.marginTop = '10px';
            document.body.appendChild(rowCountDisplay);
        }

        if (!vrIdInputBox) {
            vrIdInputBox = document.createElement('input');
            vrIdInputBox.type = 'text';
            vrIdInputBox.placeholder = 'Filtra VR ID';
            vrIdInputBox.style.marginLeft = '10px';
            vrIdInputBox.addEventListener('input', () => {
                filterAndShowData(parseInt(timeInputBox.value || DEFAULT_HOURS, 10));
            });
            document.body.appendChild(vrIdInputBox);
        }

        if (!printButton) {
            printButton = document.createElement('button');
            printButton.innerHTML = 'Stampa';
            printButton.style.padding = '3px';
            printButton.style.backgroundColor = '#f5a623';
            printButton.style.color = 'white';
            printButton.style.border = 'none';
            printButton.style.borderRadius = '3px';
            printButton.style.marginLeft = '10px';
            printButton.style.cursor = 'pointer';
            printButton.addEventListener('click', () => {
                const hours = parseInt(timeInputBox.value || DEFAULT_HOURS, 10);
                const maxDate = new Date(new Date().getTime() + hours * 60 * 60 * 1000);

                const rowsForPrint = allRows.filter(row =>
                    row.date <= maxDate &&
                    (dropdown.value === 'Tutti' || row.extraText === dropdown.value)
                );

                let printContent = `
                    <html>
                        <head>
                            <style>
                                table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    font-family: Arial, sans-serif;
                                }
                                th, td {
                                    border: 1px solid black;
                                    padding: 8px;
                                    text-align: left;
                                }
                                th {
                                    background-color: #f2f2f2;
                                }
                            </style>
                        </head>
                        <body>
                            <table>
                                <thead>
                                    <tr>
                                        <th>LANE</th>
                                        <th>SDT</th>
                                        <th>CPT</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsForPrint.map(row => `
                                        <tr>
                                            <td>${row.lane}</td>
                                            <td>${row.sdt}</td>
                                            <td>${row.cpt}</td>
                                            <td>${row.extraText}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </body>
                    </html>
                `;

                const printWindow = window.open('', '_blank');
                printWindow.document.open();
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.print();
            });
            document.body.appendChild(printButton);
        }
    }

    // Creazione del pulsante iniziale
    const buttonForPageLoadAndDataExtraction = createButtonForPageLoadAndDataExtraction();
    document.body.appendChild(buttonForPageLoadAndDataExtraction);
})();
