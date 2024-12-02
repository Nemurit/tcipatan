(function () {
    'use strict';

    // ** Variabili Globali **
    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;

    const DEFAULT_HOURS = 1;
    const MAX_HOURS = 24;
    const REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minuti

    // ** Creazione del bottone principale **
    function createMainButton() {
        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '8px 12px';
        button.style.backgroundColor = '#007BFF';
        button.style.color = '#FFF';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
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
                if (!tableContainer) {
                    loadIframeAndWait(DEFAULT_HOURS);
                } else {
                    tableContainer.style.display = 'block';
                }
                button.innerHTML = 'Nascondi TRUCKS';
                isTableVisible = true;
            }
        });

        return button;
    }

    // ** Funzione per il caricamento dell'iframe e l'estrazione dei dati **
    function loadIframeAndWait(hours) {
        let iframe = document.getElementById('pageIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pageIframe';
            iframe.style.display = 'none';
            iframe.src = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?'; // URL della tabella
            document.body.appendChild(iframe);
        }

        iframe.onload = function () {
            setTimeout(() => {
                extractDataFromIframe(iframe, hours);
                setupMutationObserver(iframe);
            }, 1000);
        };
    }

    // ** Estrarre dati dalla tabella iframe **
    function extractDataFromIframe(iframe, hours) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const targetTable = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL');

        if (targetTable) {
            const rows = Array.from(targetTable.querySelectorAll('tbody tr'));

            allRows = rows.map((row) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 15) {
                    const lane = cells[5].textContent.trim();
                    const sdt = cells[13].textContent.trim();
                    const cpt = cells[14].textContent.trim();
                    const vrId = cells[7].textContent.trim();

                    const rowDate = parseDate(sdt);

                    let status = 'COLLECTION';
                    let highlightColor = 'orange';
                    if (sdt === cpt) {
                        status = 'CPT';
                        highlightColor = 'green';
                    }
                    if (lane.startsWith('WT')) {
                        status = 'TRANSFER';
                        highlightColor = 'purple';
                    }

                    return {
                        lane,
                        sdt,
                        cpt,
                        vrId,
                        date: rowDate,
                        status,
                        highlightColor
                    };
                }
                return null;
            }).filter(Boolean);

            filterAndShowData(hours);
        } else {
            console.error('Tabella non trovata nell\'iframe.');
        }
    }

    // ** Parsing della data **
    function parseDate(dateString) {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    // ** Filtraggio dei dati **
    function filterAndShowData(hours) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const statusFilter = dropdown ? dropdown.value : 'Tutti';
        const vrIdFilter = vrIdInputBox ? vrIdInputBox.value.trim().toLowerCase() : '';

        let filteredRows = allRows.filter(row => 
            row.date >= now && row.date <= maxDate
        );

        if (statusFilter !== 'Tutti') {
            filteredRows = filteredRows.filter(row => row.status === statusFilter);
        }

        if (vrIdFilter) {
            filteredRows = filteredRows.filter(row => 
                row.vrId.toLowerCase().includes(vrIdFilter)
            );
        }

        showDataInTable(filteredRows);
    }

    // ** Creazione della tabella visualizzabile **
    function showDataInTable(filteredRows) {
        if (tableContainer) {
            tableContainer.remove();
        }

        tableContainer = document.createElement('div');
        tableContainer.style.position = 'fixed';
        tableContainer.style.top = '90px';
        tableContainer.style.left = '10px';
        tableContainer.style.zIndex = '10001';
        tableContainer.style.backgroundColor = '#FFF';
        tableContainer.style.border = '1px solid #CCC';
        tableContainer.style.borderRadius = '5px';
        tableContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        tableContainer.style.padding = '10px';
        tableContainer.style.maxHeight = '400px';
        tableContainer.style.overflowY = 'auto';
        tableContainer.style.width = '30%';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        table.innerHTML = `
            <thead>
                <tr>
                    <th style="border-bottom: 1px solid #CCC; padding: 8px;">LANE</th>
                    <th style="border-bottom: 1px solid #CCC; padding: 8px;">SDT</th>
                    <th style="border-bottom: 1px solid #CCC; padding: 8px;">CPT</th>
                    <th style="border-bottom: 1px solid #CCC; padding: 8px;">STATUS</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRows.map(row => `
                    <tr style="background-color: ${row.highlightColor}; color: white;">
                        <td style="padding: 8px;">${row.lane}</td>
                        <td style="padding: 8px;">${row.sdt}</td>
                        <td style="padding: 8px;">${row.cpt}</td>
                        <td style="padding: 8px;">${row.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    // ** Funzione per il setup del MutationObserver **
    function setupMutationObserver(iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const tableBody = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL tbody');

        if (tableBody) {
            const observer = new MutationObserver(() => {
                console.log('Modifiche rilevate nella tabella, aggiornamento dati...');
                extractDataFromIframe(iframe, DEFAULT_HOURS);
            });

            observer.observe(tableBody, { childList: true, subtree: true });
            console.log('Osservatore di mutazioni attivo.');
        } else {
            console.error('Tabella non trovata per l\'osservazione.');
        }
    }

    // ** Auto-refresh dati **
    function autoRefresh() {
        setInterval(() => {
            console.log('Aggiornamento automatico...');
            loadIframeAndWait(DEFAULT_HOURS);
        }, REFRESH_INTERVAL);
    }

    // ** Inizializzazione dello script **
    const mainButton = createMainButton();
    document.body.appendChild(mainButton);
    autoRefresh();
})();
