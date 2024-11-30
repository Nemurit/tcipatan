(function () {
    'use strict';

    // Change the title of the page
    document.title = "CLERK HANDOVER";

    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null; // Contatore dei truck visibili
    let containermain = null; // Main container to hold all UI elements

    // Costanti
    const DEFAULT_HOURS = 1; // Valore del filtro iniziale per Refresh
    const INITIAL_HOURS = 1; // Valore del filtro iniziale per Visualizza Trucks
    const MAX_HOURS = 24; // Filtro massimo: 24 ore

    // Funzione per creare il pulsante di caricamento dati
    function createButtonForPageLoadAndDataExtraction() {
        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '3px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';

        button.addEventListener('click', function () {
            loadIframeAndWait(INITIAL_HOURS); // Carica dati per il massimo di 1 ora
        });

        return button;
    }

    // Funzione per aggiornare i dati come il pulsante Visualizza Trucks
    function refreshData() {
        dropdown.value = 'Tutti';
        timeInputBox.value = DEFAULT_HOURS; // Ripristina l'ora a 1h
        loadIframeAndWait(DEFAULT_HOURS); // Ricarica i dati con i filtri iniziali
    }

    // Carica iframe e posizionalo visibilmente a destra della pagina
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
                adjustTableRowSelection(iframe); // Imposta la selezione su 100
                extractDataFromIframe(iframe, hours);
            }, 1000);
        };
    }

    // Imposta la selezione su "100" righe nella tabella dell'iframe
    function adjustTableRowSelection(iframe) {
        const iframeDoc = iframe.contentWindow.document;
        const dropdown = iframeDoc.querySelector('#dashboard_length select');

        if (dropdown) {
            dropdown.value = '100';
            const event = new Event('change', { bubbles: true });
            dropdown.dispatchEvent(event); // Simula l'evento di modifica
            console.log('Selezione righe impostata a 100.');
        } else {
            console.log('Dropdown per la selezione righe non trovato.');
        }
    }

    // Estrai dati dalla tabella nell'iframe
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
                        const sdt = tds[13].textContent.trim(); // SDT
                        const cpt = tds[14].textContent.trim(); // CPT
                        const lane = tds[5].textContent.trim();

                        // Parsing delle date
                        const rowDate = parseDate(sdt);

                        if (!rowDate) {
                            console.error(`Errore nel parsing della data: ${sdt}`);
                            return null; // Salta la riga se la data è invalida
                        }

                        // Determinazione dello stato e colore
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
                            date: rowDate,
                            extraText: extraText,
                            highlightColor: highlightColor,
                        };
                    }
                }).filter(Boolean);

                showButtonsAndInputs();
                filterAndShowData(hours); // Filtro iniziale
            } else {
                console.log('Il <tbody> non è stato trovato nella tabella.');
            }
        } else {
            console.log('La tabella non è stata trovata.');
        }
    }

    // Funzione per il parsing della data
    function parseDate(dateString) {
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
        console.error(`Impossibile convertire la data: ${dateString}`);
        return null;
    }

    // Filtro e visualizzazione dati
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
        updateRowCount(filteredRows.length); // Aggiorna il contatore
    }

    // Mostra i dati filtrati in una tabella
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

    // Aggiorna il contatore di righe visibili
    function updateRowCount(count) {
        if (!rowCountDisplay) return;
        rowCountDisplay.innerHTML = `NUMERO TRUCKS: ${count}`;
    }

    // Funzione per mostrare pulsanti e input
    function showButtonsAndInputs() {
        dropdown.style.display = 'inline-block';
        timeInputBox.style.display = 'inline-block';
        printButton.style.display = 'inline-block';
        rowCountDisplay.style.display = 'inline-block'; // Mostra il contatore
    }

    // Funzione per creare pulsanti e input
    function createButtons() {
        // Create main container for UI elements
        containermain = document.createElement('div');
        containermain.style.position = 'fixed';
        containermain.style.top = '10px';
        containermain.style.left = '10px';
        containermain.style.zIndex = '10001';
        containermain.style.padding = '10px';
        containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        containermain.style.borderRadius = '5px';
        containermain.style.display = 'flex';
        containermain.style.flexDirection = 'row'; // Pulsanti orizzontali

        containermain.appendChild(createButtonForPageLoadAndDataExtraction());

        dropdown = document.createElement('select');
        dropdown.style.display = 'none';
        dropdown.style.marginRight = '5px';
        dropdown.style.padding = '3px';
        ['Tutti', 'CPT', 'SWEEPER', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });

       
