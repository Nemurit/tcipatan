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
            }, 1000); // Aspetta 5 secondi
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
