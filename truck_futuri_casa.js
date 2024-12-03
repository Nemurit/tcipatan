(function () {
    'use strict';

    // Change the title of the page
    document.title = "CLERK";

    let tableContainer = null;
    let allRows = [];
    let lastExtractedRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;
    let containermain = null;

    // Constants
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;
    const AUTO_REFRESH_DELAY = 30000; // 30 seconds
    let autoRefreshInterval = null;

    // Create the button for data load with toggle function
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

        let isTableVisible = false;

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

                const newRows = rows.map((row, index) => {
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

                if (JSON.stringify(newRows) !== JSON.stringify(lastExtractedRows)) {
                    console.log('Dati modificati. Aggiorno la tabella...');
                    lastExtractedRows = newRows;
                    allRows = newRows;
                    showButtonsAndInputs();
                    filterAndShowData(hours);
                } else {
                    console.log('Nessun cambiamento nei dati.');
                }
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
        if (!rowCountDisplay) return;
        rowCountDisplay.innerHTML = `NUMERO TRUCKS: ${count}`;
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
        containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        containermain.style.padding = '10px';
        containermain.style.borderRadius = '5px';
        containermain.style.border = '1px solid #ccc';

        const viewButton = createButtonForPageLoadAndDataExtraction();
        const refreshButton = document.createElement('button');
        refreshButton.innerHTML = 'Refresh Data';
        refreshButton.style.padding = '3px';
        refreshButton.style.backgroundColor = '#FF9800';
        refreshButton.style.color = 'white';
        refreshButton.style.border = 'none';
        refreshButton.style.borderRadius = '3px';
        refreshButton.style.marginRight = '5px';
        refreshButton.style.cursor = 'pointer';
        refreshButton.addEventListener('click', refreshData);

        dropdown = document.createElement('select');
        dropdown.style.marginRight = '10px';
        dropdown.style.display = 'none';
        ['Tutti', 'COLLECTION', 'CPT', 'TRANSFER'].forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            dropdown.appendChild(option);
        });
        dropdown.addEventListener('change', () => filterAndShowData(timeInputBox.value || DEFAULT_HOURS));

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.min = 1;
        timeInputBox.max = MAX_HOURS;
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.marginRight = '10px';
        timeInputBox.style.display = 'none';
        timeInputBox.addEventListener('input', () => filterAndShowData(timeInputBox.value || DEFAULT_HOURS));

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtra VR ID';
        vrIdInputBox.style.marginRight = '10px';
        vrIdInputBox.style.display = 'none';
        vrIdInputBox.addEventListener('input', () => filterAndShowData(timeInputBox.value || DEFAULT_HOURS));

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.padding = '3px';
        printButton.style.backgroundColor = '#2196F3';
        printButton.style.color = 'white';
        printButton.style.border = 'none';
        printButton.style.borderRadius = '3px';
        printButton.style.marginRight = '5px';
        printButton.style.cursor = 'pointer';
        printButton.style.display = 'none';
        printButton.addEventListener('click', () => window.print());

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.marginLeft = '10px';
        rowCountDisplay.style.fontWeight = 'bold';
        rowCountDisplay.style.color = 'black';
        rowCountDisplay.style.display = 'none';

        containermain.appendChild(viewButton);
        containermain.appendChild(refreshButton);
        containermain.appendChild(dropdown);
        containermain.appendChild(timeInputBox);
        containermain.appendChild(vrIdInputBox);
        containermain.appendChild(printButton);
        containermain.appendChild(rowCountDisplay);

        document.body.appendChild(containermain);
    }

    function startAutoRefresh(hours) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }

        autoRefreshInterval = setInterval(() => {
            const iframe = document.getElementById('pageIframe');
            if (iframe) {
                extractDataFromIframe(iframe, hours);
            }
        }, AUTO_REFRESH_DELAY);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    function createAutoRefreshButton() {
        const button = document.createElement('button');
        button.innerHTML = 'Auto-refresh ON';
        button.style.padding = '3px';
        button.style.backgroundColor = '#007BFF';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        let isAutoRefreshEnabled = true;

        button.addEventListener('click', function () {
            if (isAutoRefreshEnabled) {
                stopAutoRefresh();
                button.innerHTML = 'Auto-refresh OFF';
                button.style.backgroundColor = '#6c757d';
                isAutoRefreshEnabled = false;
            } else {
                startAutoRefresh(DEFAULT_HOURS);
                button.innerHTML = 'Auto-refresh ON';
                button.style.backgroundColor = '#007BFF';
                isAutoRefreshEnabled = true;
            }
        });

        containermain.appendChild(button);
    }

    document.addEventListener('DOMContentLoaded', function () {
        createButtons();
        createAutoRefreshButton();
        startAutoRefresh(DEFAULT_HOURS);
    });
})();
