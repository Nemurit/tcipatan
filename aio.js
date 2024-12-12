// RECUPERI 

// @grant        GM_addElement
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_info
// @grant        GM_log
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setClipboard
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        GM_getTabs
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_webRequest
// @grant        GM_cookie
// @run-at       document-start

// TRUCK FUTURI
(function () {
    'use strict';
    
document.title = "Clerk Handover"
    
    const url = "https://www.amazonlogistics.eu/ssp/dock/hrz/ob/fetchdata?";
    const entityName = "getDefaultOutboundDockView";
    const payload = `entity=${entityName}&nodeId=MXP6&startDate=1733700600000&endDate=1733873400000&loadCategories=outboundScheduled,outboundInProgress,outboundReadyToDepart,outboundDeparted,outboundCancelled`;

    let allRows = [];
    let tableContainer = null;
    let dropdown = null;
    let timeInputBox = null;
    let vrIdInputBox = null;
    let laneInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let filtersContainer = null;
    let isDataFetched = false;  // Flag per sapere se i dati sono stati recuperati
    let isTableVisible = false; // Flag per sapere se la tabella è visibile

    // Funzione per recuperare i dati
    function fetchData(hours) {
        GM_xmlhttpRequest({
            method: "POST",
            url: url,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://www.amazonlogistics.eu/ssp/dock/hrz/ob",
                
            },
            data: payload,
            onload: function (response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.ret && Array.isArray(data.ret.aaData)) {
                            processFetchedData(data.ret.aaData, hours);
                        } else {
                            console.error("La risposta dell'API non contiene 'ret' o 'aaData'.");
                        }
                    } catch (error) {
                        console.error("Errore nel parsing dei dati:", error);
                    }
                } else {
                    console.error("Errore nella richiesta:", response.status, response.statusText);
                }
            },
            onerror: function (error) {
                console.error("Richiesta fallita:", error);
            },
        });
    }

    function processFetchedData(apiData, hours) {
    const now = new Date();
    const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

    allRows = apiData.map(item => {
        const load = item.load || {};
        const lane = load.route || "N/A";

        // Verifica la logica per determinare il tipo di truck
        let truckType = "COLLECTION"; // Default

        // Se la lane inizia con MXP6 -> e non contiene LH, CC, o AMZL, oppure se finisce con _PALLET
        if ((lane.startsWith("MXP6->") &&
            !lane.includes("LH") &&
            !lane.includes("CC") &&
            !lane.includes("AIR") &&
            !lane.includes("AMZL")) || lane.endsWith("_PALLET")) {

            // Se la lane finisce con _PALLET, rimane "TRANSFER" senza considerare scheduledDepartureTime e criticalPullTime
            if (lane.endsWith("_PALLET")) {
                truckType = "TRANSFER";
            } else {
                // Imposta "TRANSFER", ma se scheduledDepartureTime == criticalPullTime, imposta "TSO"
                truckType = (load.scheduledDepartureTime === load.criticalPullTime) ? "TSO" : "TRANSFER";
            }
        } else if (load.scheduledDepartureTime === load.criticalPullTime) {
            // Se scheduledDepartureTime == criticalPullTime, imposta "CPT"
            truckType = "CPT";
        }

        return {
            lane: lane,
            sdt: load.scheduledDepartureTime || "N/A",
            cpt: load.criticalPullTime || "N/A",
            vrId: load.vrId || "N/A",
            date: new Date(load.scheduledDepartureTime),
            extraText: truckType,
            highlightColor: truckType === "TRANSFER" ? "violet" : truckType === "CPT" ? "green" : truckType === "TSO" ? "brown" : "orange",
        };
    });

    // Ordina i dati per SDT (Scheduled Departure Time)
    allRows.sort((a, b) => a.date - b.date);

    filterAndShowData(hours);
}



    function filterAndShowData(hours) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        // Ottieni i filtri
        const status = dropdown ? dropdown.value : 'TUTTI';
        const vrIdFilter = vrIdInputBox.value.trim().toLowerCase();
        const laneFilter = laneInputBox ? laneInputBox.value.trim().toLowerCase() : '';

        // Filtra prima tutti i dati, indipendentemente dalla finestra temporale
        let filteredRows = allRows;

        if (vrIdFilter) {
            filteredRows = filteredRows.filter(row => row.vrId.toLowerCase().includes(vrIdFilter));
        }

        if (status !== 'TUTTI') {
            filteredRows = filteredRows.filter(row => row.extraText === status);
        }

        if (laneFilter) {
            filteredRows = filteredRows.filter(row => row.lane.toLowerCase().includes(laneFilter));
        }

        // Ora applica la finestra temporale, solo se non ci sono filtri VR ID o Lane
        if (!vrIdFilter && !laneFilter) {
            filteredRows = filteredRows.filter(row => row.date >= now && row.date <= maxDate);
        }

        // Mostra i dati filtrati nella tabella
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

    function createButtons() {
        const containermain = document.createElement('div');
        containermain.style.position = 'fixed';
        containermain.style.top = '10px';
        containermain.style.left = '10px';
        containermain.style.zIndex = '10001';
        containermain.style.padding = '10px';
        containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        containermain.style.borderRadius = '5px';
        containermain.style.display = 'flex';
        containermain.style.flexDirection = 'row';

        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '3px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', function () {
            const hours = timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1;

            if (isTableVisible) {
                // Nascondi la tabella e i filtri
                tableContainer.style.display = 'none';
                filtersContainer.style.display = 'none';
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                // Mostra i filtri
                filtersContainer.style.display = 'block';

                if (!isDataFetched) {
                    fetchData(hours); // Fetch i dati la prima volta
                    isDataFetched = true; // Impostiamo il flag su true
                }

                // Cambia il testo del pulsante in "Nascondi TRUCKS"
                button.innerHTML = 'Nascondi TRUCKS';

                // Mostra la tabella
                tableContainer.style.display = 'block';
                filtersContainer.style.display = 'block';
                isTableVisible = true;
            }
        });

        // Aggiungi i filtri
        filtersContainer = document.createElement('div');
        filtersContainer.style.display = 'none';  // I filtri sono inizialmente nascosti
        filtersContainer.style.marginTop = '10px';

        dropdown = document.createElement('select');
        dropdown.style.marginRight = '5px';
        dropdown.style.padding = '3px';
        ['TUTTI', 'CPT', 'COLLECTION', 'TSO', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });
        dropdown.addEventListener('change', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.padding = '3px';
        timeInputBox.style.marginRight = '5px';
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtro VR ID';
        vrIdInputBox.style.padding = '3px';
        vrIdInputBox.style.marginRight = '5px';
        vrIdInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        laneInputBox = document.createElement('input');
        laneInputBox.type = 'text';
        laneInputBox.placeholder = 'Filtro Lane';
        laneInputBox.style.padding = '3px';
        laneInputBox.style.marginRight = '5px';
        laneInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.padding = '3px';
        printButton.style.marginRight = '5px';
        printButton.addEventListener('click', function () {
            if (tableContainer) {
                const printWindow = window.open('', '_blank');
                const printDocument = printWindow.document;
                printDocument.open();
                printDocument.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Stampa Tabella</title>
                        <style>
                            table {
                                width: 100%;
                                border-collapse = collapse;
                                margin-bottom: 20px;
                                font-family: Arial, sans-serif;
                            }
                        </style>
                    </head>
                    <body>
                        ${tableContainer.innerHTML}
                    </body>
                    </html>
                `);
                printDocument.close();
                printWindow.print();
            } else {
                alert('Nessuna tabella disponibile per la stampa.');
            }
        });

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.marginLeft = '5px';

        filtersContainer.appendChild(dropdown);
        filtersContainer.appendChild(timeInputBox);
        filtersContainer.appendChild(vrIdInputBox);
        filtersContainer.appendChild(laneInputBox);
        filtersContainer.appendChild(printButton);
        filtersContainer.appendChild(rowCountDisplay);

        containermain.appendChild(button);
        containermain.appendChild(filtersContainer);
        document.body.appendChild(containermain);
    }

    // Funzione per aggiornare ogni 5 minuti
    setInterval(function() {
        if (isDataFetched) {
            fetchData(1); // Per esempio, recuperiamo i dati per l'ora corrente ogni 5 minuti
        }
    }, 300000); // 300000ms = 5 minuti

    createButtons();
})();


// SCARICHI
(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let dataContainer; // Variabile per il container
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    function loadYardPageAndExtractData(callback) {
        // Rimuovi eventuali iframe esistenti
        const existingIframe = document.querySelector('iframe[data-yard="true"]');
        if (existingIframe) {
            existingIframe.remove();
        }

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none'; // Nasconde l'iframe
        iframe.setAttribute('data-yard', 'true'); // Per identificare facilmente questo iframe
        iframe.src = "https://www.amazonlogistics.eu/yms/shipclerk";

        iframe.onload = function () {
            setTimeout(() => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (!iframeDoc) {
                    console.error("Impossibile accedere al contenuto dell'iframe.");
                    callback([]);
                    return;
                }

                // Seleziona tutte le righe
                const rows = iframeDoc.querySelectorAll('tr');
                const data = [];

                rows.forEach(row => {
                    const col1 = row.querySelector('td.col1'); // Location
                    const col8 = row.querySelector('td.col8'); // DSSMITH check
                    const col9 = row.querySelector('td.col9'); // Tipo di Transfer
                    const col11 = row.querySelector('td.col11'); // Note da mostrare
                    const tractorIcon = row.querySelector('.yard-asset-icon.yard-asset-icon-TRACTOR'); // Icona del Tractor

                    // Se col1, col9 e col11 esistono
                    if (col1 && col9 && col11) {
                         const location = col1.innerText.trim(); // Testo della colonna Location
    let note = col11.innerText.trim(); // Testo della colonna Note (col11)
    const isTractorPresent = tractorIcon !== null; // Verifica se l'icona Tractor è presente

    // Caso 1: Se col9 contiene "TransfersCarts", aggiungi la riga con la location e la nota
    if (/TransfersCarts/i.test(col9?.innerText || '')) {
        data.push([location, note, isTractorPresent, false]); // Aggiungi Location, Note, presenza del Tractor

    // Caso 2: Se col9 contiene "Transfer" ma non "TransfersCarts", aggiungi la riga solo se "Ricarica" è nelle note
    } else if (/Transfers/i.test(col9?.innerText || '') && /Ricarica/i.test(note)) {
        data.push([location, note, isTractorPresent, false]); // Aggiungi Location, Note, presenza del Tractor

    // Caso 3: Se col11 contiene "Ricarica" e col9 è vuoto
    } else if (!col9?.innerText.trim() && /Ricarica/i.test(note)) {
        data.push([location, note, isTractorPresent, false]); // Aggiungi Location, Note, presenza del Tractor
    }

    // Caso 4: Se col8 contiene "DSSMITH", cambia le note in "Non Inventory"
  if (col8 && (/DSSMITH/i.test(col8.innerText) || /ZETAC/i.test(col8.innerText))) {
    note = "Non Inventory"; // Cambia le note in "Non Inventory"
    data.push([location, note, isTractorPresent, true]); // Aggiungi Location e le nuove note, ignorando la col8
}
}
                });

                console.log("Dati filtrati:", data);
                callback(data);

                // Rimuove l'iframe dopo l'elaborazione
                iframe.remove();
            }, 5000); // Aspetta 5 secondi
        };

        document.body.appendChild(iframe);
    }

    function displayData(data) {
        // Pulisci il contenuto del container
        dataContainer.innerHTML = "";

        // Crea una tabella per visualizzare i dati
        const dataTable = document.createElement('table');
        dataTable.style.borderCollapse = 'collapse';
        dataTable.style.fontSize = '14px';
        dataTable.style.fontFamily = 'Arial, sans-serif';
        dataTable.style.textAlign = 'left';
        dataTable.style.border = '1px solid #ddd';
        dataTable.style.width = 'auto';

        const thead = dataTable.createTHead();
        const tbody = dataTable.createTBody();

        // Intestazione
        const headerRow = thead.insertRow();
        const th1 = document.createElement('th');
        th1.textContent = "Location";
        headerRow.appendChild(th1);

        const th2 = document.createElement('th');
        th2.textContent = "Note";
        headerRow.appendChild(th2);

        [th1, th2].forEach(th => {
            th.style.padding = '8px';
            th.style.border = '1px solid #ddd';
            th.style.backgroundColor = '#f4f4f4';
            th.style.color = '#333';
        });

        if (data.length === 0) {
            // Aggiungi una riga con il messaggio di avviso
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2; // Span su entrambe le colonne
            cell.textContent = "ATTENZIONE, NON CI SONO JP CARTS SUL FLOOR E NEMMENO NELLO YARD!!!";
            cell.style.color = 'red';
            cell.style.fontWeight = 'bold';
            cell.style.textAlign = 'center';
            cell.style.padding = '8px';
            cell.style.border = '1px solid #ddd';
        } else {
            // Aggiungi le righe dei dati
            data.forEach(rowData => {
                const row = tbody.insertRow();

                // Cella Location
                const firstTd = row.insertCell();
                firstTd.textContent = rowData[0]; // Location

                // Aggiungi il pallino verde accanto alla Location se il Tractor è presente
                if (rowData[2]) {
                    const dot = document.createElement('span');
                    dot.style.display = 'inline-block';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.borderRadius = '50%';
                    dot.style.backgroundColor = 'green';
                    dot.style.marginLeft = '10px';
                    dot.style.animation = 'blink 1s infinite';
                    firstTd.appendChild(dot);
                }

                // Cella Note
                const lastTd = row.insertCell();
                lastTd.textContent = rowData[1]; // Note (col11) o "Non Inventory" se DSSMITH

                [firstTd, lastTd].forEach(td => {
                    td.style.padding = '8px';
                    td.style.border = '1px solid #ddd';
                    td.style.whiteSpace = 'nowrap'; // Impedisce il wrapping
                });
            });
        }

        dataContainer.appendChild(dataTable); // Aggiungi la tabella al container

        // Impostiamo il flag che i dati sono stati caricati
        isDataLoaded = true;

        // Mostra il container
        dataContainer.style.display = 'block';
    }

    function toggleDataDisplay() {
        if (tableVisible) {
            dataContainer.style.display = 'none';
            button.textContent = "Mostra Scarichi";
        } else {
            loadYardPageAndExtractData(function (data) {
                displayData(data);
            });
            button.textContent = "Nascondi Scarichi";
        }
        tableVisible = !tableVisible;
    }

    setInterval(() => {
        if (tableVisible) {
            console.log("Esecuzione auto-refresh");
            loadYardPageAndExtractData(function (data) {
                displayData(data);
            });
        }
    }, 10 * 60 * 1000); // 10 minuti

    const button = document.createElement('button');
    button.textContent = "Mostra Scarichi";
    button.style.position = 'fixed';
    button.style.top = '550px';
    button.style.left = '10px';
    button.style.padding = '10px';
    button.style.backgroundColor = '#007bff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';

    dataContainer = document.createElement('div');
    dataContainer.style.position = 'fixed';
    dataContainer.style.top = '600px';
    dataContainer.style.left = '10px';
    dataContainer.style.backgroundColor = 'white';
    dataContainer.style.border = '1px solid #ddd';
    dataContainer.style.borderRadius = '5px';
    dataContainer.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    dataContainer.style.padding = '10px';
    dataContainer.style.display = 'none';
    dataContainer.style.zIndex = '999';

    // Aggiungi l'animazione per il lampeggio del pallino verde
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.2; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    button.addEventListener('click', toggleDataDisplay);

    document.body.appendChild(button);
    document.body.appendChild(dataContainer);
})();

// DOCK CONGESTION
(function () {
    'use strict';

    // Funzione per recuperare e visualizzare i dati
    function fetchAndDisplayData() {
        const apiUrl = "https://rodeo-dub.amazon.com/MXP6/ExSD;jsessionid=36226D8DA8CFCCE67C6E346CBE0E3BCB?yAxis=WORK_POOL&zAxis=NONE&shipmentTypes=CUSTOMER_SHIPMENTS&exSDRange.quickRange=PLUS_MINUS_1_DAY&exSDRange.dailyStart=00:00&exSDRange.dailyEnd=00:00&giftOption=ALL&fulfillmentServiceClass=ALL&fracs=NON_FRACS&isEulerExSDMiss=ALL&isEulerPromiseMiss=ALL&isEulerUpgraded=ALL&isReactiveTransfer=ALL&workPool=PredictedCharge&workPool=PlannedShipment&workPool=ReadyToPick&workPool=ReadyToPickHardCapped&workPool=ReadyToPickUnconstrained&workPool=PickingNotYetPicked&workPool=PickingNotYetPickedPrioritized&workPool=PickingNotYetPickedNotPrioritized&workPool=PickingNotYetPickedHardCapped&workPool=CrossdockNotYetPicked&workPool=PickingPicked&workPool=PickingPickedInProgress&workPool=PickingPickedInTransit&workPool=PickingPickedRouting&workPool=PickingPickedAtDestination&workPool=Inducted&workPool=RebinBuffered&workPool=Sorted&workPool=GiftWrap&workPool=Packing&workPool=Scanned&workPool=ProblemSolving&workPool=ProcessPartial&workPool=SoftwareException&workPool=Crossdock&workPool=PreSort&workPool=TransshipSorted&workPool=Palletized&workPool=ManifestPending&workPool=ManifestPendingVerification&workPool=Manifested&workPool=Loaded&workPool=TransshipManifested&_workPool=on&_workPool=on&_workPool=on&_workPool=on&processPath=&minPickPriority=MIN_PRIORITY&shipMethod=&shipOption=&sortCode=&fnSku=";

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    // Trova il <th> con class="row-label" e testo "ManifestPending"
                    const rowLabel = Array.from(doc.querySelectorAll('th.row-label'))
                        .find(th => th.textContent.trim() === "ManifestPending");

                    let manifestPendingValue = "N/A";
                    if (rowLabel) {
                        // Trova il <td class="subtotal"> corrispondente
                        const subtotalCell = rowLabel.parentElement.querySelector('td.subtotal');
                        if (subtotalCell) {
                            manifestPendingValue = subtotalCell.textContent.trim();
                        } else {
                            console.warn('TD con class="subtotal" non trovato!');
                        }
                    } else {
                        console.warn('TH con testo "ManifestPending" non trovato!');
                    }

                    // Aggiorna o crea la tabella per visualizzare i risultati
                    let tableContainer = document.getElementById('dockCongestionTable');
                    if (!tableContainer) {
                        tableContainer = document.createElement('div');
                        tableContainer.id = 'dockCongestionTable';
                        tableContainer.style.position = 'fixed';
                        tableContainer.style.top = '25%';
                        tableContainer.style.left = '40%';
                        tableContainer.style.transform = 'translate(-50%, -50%)';
                        tableContainer.style.backgroundColor = 'white';
                        tableContainer.style.border = '2px solid #ccc';
                        tableContainer.style.padding = '20px';
                        tableContainer.style.boxShadow = '0px 4px 8px rgba(0,0,0,0.1)';
                        tableContainer.style.zIndex = '9999';
                        tableContainer.style.textAlign = 'center';

                        const table = document.createElement('table');
                        table.style.margin = '0 auto';
                        table.style.borderCollapse = 'collapse';

                        const header = document.createElement('thead');
                        const headerRow = document.createElement('tr');
                        headerRow.innerHTML = '<th colspan="2">DOCK CONGESTION</th>';
                        header.appendChild(headerRow);
                        table.appendChild(header);

                        const tbody = document.createElement('tbody');

                        // Riga per lo stato
                        const row = document.createElement('tr');
                        const statusCell = document.createElement('td');
                        statusCell.setAttribute('colspan', '2');
                        statusCell.style.fontSize = '18px';
                        row.appendChild(statusCell);
                        tbody.appendChild(row);

                        table.appendChild(tbody);
                        tableContainer.appendChild(table);
                        document.body.appendChild(tableContainer);
                    }

                    // Aggiorna le celle
                    const statusCell = tableContainer.querySelector('td[colspan="2"]');

                    // Calcola lo stato basato sul totale
                    const totalResults = parseInt(manifestPendingValue.replace(/[^0-9]/g, '')) || 0;
                    let statusText = '';
                    if (totalResults <= 125000) {
                        statusCell.style.color = 'green';
                        statusText = `Dock OK: ${totalResults.toLocaleString()}`; // Aggiunge le virgole per leggibilità
                    } else if (totalResults <= 150000) {
                        statusCell.style.color = 'orange';
                        statusText = `Contingency: ${totalResults.toLocaleString()}`;
                    } else {
                        statusCell.style.color = 'red';
                        statusCell.style.fontWeight = 'bold';
                        statusText = `Safety Issue: ${totalResults.toLocaleString()}`;
                    }

                    statusCell.textContent = statusText;
                } else {
                    console.error(`Errore HTTP! Stato: ${response.status}`);
                }
            },
            onerror: function (error) {
                console.error('Errore durante il recupero dei dati:', error);
            }
        });
    }

    // Recupera e visualizza i dati inizialmente
    fetchAndDisplayData();

    // Aggiorna i dati ogni 5 minuti (300000 ms)
    setInterval(fetchAndDisplayData, 300000);
})();
