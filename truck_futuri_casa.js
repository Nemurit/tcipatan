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

    // Constants
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;

    // Function to create the button to toggle the visibility of the data table
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

        let isTableVisible = false; // Toggle state for table visibility

        button.addEventListener('click', function () {
            if (isTableVisible) {
                // Hide the table and reset state
                if (tableContainer) {
                    tableContainer.style.display = 'none';
                }
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                // Show the table and load data
                if (tableContainer) {
                    tableContainer.style.display = 'block';
                } else {
                    loadIframeAndWait(INITIAL_HOURS); // Load data for a maximum of 1 hour
                }
                button.innerHTML = 'Nascondi TRUCKS';
                isTableVisible = true;
            }
        });

        return button;
    }

    function loadIframeAndWait(hours) {
        let iframe = document.getElementById('pageIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pageIframe';
            iframe.style.display = 'none';
            iframe.src = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?'; // Update the URL as needed
            document.body.appendChild(iframe);
        }

        iframe.onload = function () {
            setTimeout(() => {
                extractDataFromIframe(iframe, hours);
                observeIframeChanges(iframe);
            }, 1000);
        };
    }

    // Auto-Update using MutationObserver
    function observeIframeChanges(iframe) {
        const iframeDoc = iframe.contentWindow.document;
        const targetTable = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL');

        if (!targetTable) {
            console.log("Tabella non trovata nell'iframe.");
            return;
        }

        // Create MutationObserver to detect changes in the table
        const observer = new MutationObserver(() => {
            console.log("Modifica rilevata nella tabella dell'iframe.");
            extractDataFromIframe(iframe, parseInt(timeInputBox.value || DEFAULT_HOURS, 10));
        });

        // Monitor changes in the table's children (e.g., rows added or removed)
        observer.observe(targetTable, { childList: true, subtree: true });
        console.log("Osservatore configurato per la tabella dell'iframe.");
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
                    </tr>`).join('')}
            </tbody>
        `;

        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    function updateRowCount(count) {
        if (!rowCountDisplay) {
            rowCountDisplay = document.createElement('div');
            rowCountDisplay.style.position = 'fixed';
            rowCountDisplay.style.top = '90px';
            rowCountDisplay.style.right = '10px';
            rowCountDisplay.style.zIndex = '10002';
            rowCountDisplay.style.backgroundColor = '#fff';
            rowCountDisplay.style.padding = '5px 10px';
            rowCountDisplay.style.border = '1px solid #ccc';
            rowCountDisplay.style.borderRadius = '5px';
            rowCountDisplay.style.fontSize = '14px';
            document.body.appendChild(rowCountDisplay);
        }
        rowCountDisplay.textContent = `Results: ${count}`;
    }

    function showButtonsAndInputs() {
        if (!dropdown) {
            dropdown = document.createElement('select');
            dropdown.innerHTML = `
                <option value="Tutti">Tutti</option>
                <option value="SWEEPER">SWEEPER</option>
                <option value="TRANSFER">TRANSFER</option>
                <option value="CPT">CPT</option>
            `;
            document.body.appendChild(dropdown);
        }

        if (!timeInputBox) {
            timeInputBox = document.createElement('input');
            timeInputBox.type = 'number';
            timeInputBox.value = DEFAULT_HOURS;
            timeInputBox.min = 1;
            timeInputBox.max = MAX_HOURS;
            document.body.appendChild(timeInputBox);
        }

        if (!vrIdInputBox) {
            vrIdInputBox = document.createElement('input');
            vrIdInputBox.type = 'text';
            document.body.appendChild(vrIdInputBox);
        }
    }

    // Set up auto-update interval (every 10 minutes)
    setInterval(() => {
        if (tableContainer && tableContainer.style.display !== 'none') {
            loadIframeAndWait(parseInt(timeInputBox.value || DEFAULT_HOURS, 10)); // Refresh every time window
        }
    }, 10 * 60 * 1000); // Refresh every 10 minutes

    // Add button for initial loading
    const button = createButtonForPageLoadAndDataExtraction();
    document.body.appendChild(button);
})();
