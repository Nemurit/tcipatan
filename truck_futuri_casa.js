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
    let containermain = null;

    // Constants
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;

    // Function to create the data load button with toggle functionality
    function createButtonForPageLoadAndDataExtraction() {
        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.className = 'custom-button';

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
        let filteredRows = allRows.filter(row => row.date >= now && row.date <= maxDate);

        if (status !== 'Tutti') {
            filteredRows = filteredRows.filter(row => row.extraText === status);
        }

        showDataInTable(filteredRows);
        updateRowCount(filteredRows.length);
    }

    function showDataInTable(filteredRows) {
        if (tableContainer) {
            tableContainer.remove();
        }

        tableContainer = document.createElement('div');
        tableContainer.className = 'custom-table-container';

        const table = document.createElement('table');
        table.className = 'custom-table';
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
                    <tr style="background-color: ${row.highlightColor};">
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
        if (!rowCountDisplay) return;
        rowCountDisplay.innerHTML = `NUMERO TRUCKS: ${count}`;
    }

    function showButtonsAndInputs() {
        dropdown.style.display = 'inline-block';
        timeInputBox.style.display = 'inline-block';
        printButton.style.display = 'inline-block';
        rowCountDisplay.style.display = 'inline-block';
    }

    function createButtons() {
        containermain = document.createElement('div');
        containermain.className = 'custom-button-container';

        containermain.appendChild(createButtonForPageLoadAndDataExtraction());

        dropdown = document.createElement('select');
        dropdown.style.display = 'none';
        ['Tutti', 'CPT', 'COLLECTION', 'TRANSFER'].forEach(option => {
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
        timeInputBox.style.display = 'none';
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.display = 'none';

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.display = 'none';

        containermain.appendChild(dropdown);
        containermain.appendChild(timeInputBox);
        containermain.appendChild(printButton);
        containermain.appendChild(rowCountDisplay);

        document.body.appendChild(containermain);
    }

    createButtons();

    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .custom-button {
            padding: 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-right: 10px;
        }
        .custom-button-container {
            position: fixed;
            top: 10px;
            left: 10px;
            background-color: rgba(255, 255, 255, 0.9);
            padding: 15px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            z-index: 10001;
        }
        .custom-table-container {
            position: fixed;
            top: 90px;
            left: 10px;
            background-color: rgba(255, 255, 255, 0.9);
            padding: 15px;
            border-radius: 10px;
            overflow-y: auto;
            max-height: 400px;
            z-index: 10001;
            width: 30%;
        }
        .custom-table {
            width: 100%;
            border-collapse: collapse;
        }
        .custom-table th, .custom-table td {
            padding: 10px;
            border: 1px solid #ddd;
        }
        .custom-table th {
            background-color: #f4f4f4;
            text-align: left;
        }
    `;
    document.head.appendChild(style);
})();
