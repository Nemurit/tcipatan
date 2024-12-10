(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let dataContainer; // Variabile per il container
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    function loadYardPageAndExtractData(callback) {
        console.log("Caricamento dati dall'iframe...");
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
            console.log("Iframe caricato. Estrazione dati...");
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

                    if (col1 && col9 && col11) {
                        const location = col1.innerText.trim(); // Testo della colonna Location
                        let note = col11.innerText.trim(); // Testo della colonna Note (col11)
                        const isTractorPresent = tractorIcon !== null; // Verifica se l'icona Tractor è presente

                        // Filtraggio dei dati
                        if (/TransfersCarts/i.test(col9?.innerText || '')) {
                            data.push([location, note, isTractorPresent, false]);
                        } else if (/Transfers/i.test(col9?.innerText || '') && /Ricarica/i.test(note)) {
                            data.push([location, note, isTractorPresent, false]);
                        } else if (!col9?.innerText.trim() && /Ricarica/i.test(note)) {
                            data.push([location, note, isTractorPresent, false]);
                        }

                        if (col8 && (/DSSMITH/i.test(col8.innerText) || /ZETAC/i.test(col8.innerText))) {
                            note = "Non Inventory"; // Cambia le note in "Non Inventory"
                            data.push([location, note, isTractorPresent, true]);
                        }
                    }
                });

                console.log("Dati estratti:", data);
                callback(data);

                // Rimuove l'iframe dopo l'elaborazione
                iframe.remove();
            }, 5000); // Aspetta 5 secondi
        };

        document.body.appendChild(iframe);
    }

    function displayData(data) {
        console.log("Visualizzazione dati nel container...");
        // Pulisci il contenuto del container
        dataContainer.innerHTML = "";

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
        ["Location", "Note"].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.padding = '8px';
            th.style.border = '1px solid #ddd';
            th.style.backgroundColor = '#f4f4f4';
            th.style.color = '#333';
            headerRow.appendChild(th);
        });

        if (data.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2;
            cell.textContent = "ATTENZIONE, NON CI SONO JP CARTS SUL FLOOR E NEMMENO NELLO YARD!!!";
            cell.style.color = 'red';
            cell.style.fontWeight = 'bold';
            cell.style.textAlign = 'center';
            cell.style.padding = '8px';
            cell.style.border = '1px solid #ddd';
        } else {
            data.forEach(rowData => {
                const row = tbody.insertRow();
                const firstTd = row.insertCell();
                firstTd.textContent = rowData[0];

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

                const lastTd = row.insertCell();
                lastTd.textContent = rowData[1];

                [firstTd, lastTd].forEach(td => {
                    td.style.padding = '8px';
                    td.style.border = '1px solid #ddd';
                });
            });
        }

        dataContainer.appendChild(dataTable);
        dataContainer.style.display = 'block';
        printButton.style.display = 'block';
    }

    function toggleDataDisplay() {
        if (tableVisible) {
            dataContainer.style.display = 'none';
            printButton.style.display = 'none';
            button.textContent = "Mostra Scarichi";
        } else {
            loadYardPageAndExtractData(function (data) {
                displayData(data);
            });
            button.textContent = "Nascondi Scarichi";
        }
        tableVisible = !tableVisible;
    }

    function printContainerContent() {
        const printWindow = window.open('', '_blank');
        const containerHTML = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial; }
                        table { border-collapse: collapse; }
                        td, th { border: 1px solid black; padding: 5px; }
                        span { width: 10px; height: 10px; background: green; display: inline-block; border-radius: 50%; }
                    </style>
                </head>
                <body>${dataContainer.outerHTML}</body>
            </html>`;
        printWindow.document.write(containerHTML);
        printWindow.document.close();
        printWindow.print();
    }

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
    button.addEventListener('click', toggleDataDisplay);

    const printButton = document.createElement('button');
    printButton.textContent = "Stampa";
    printButton.style.position = 'fixed';
    printButton.style.top = '600px';
    printButton.style.left = '10px';
    printButton.style.padding = '10px';
    printButton.style.backgroundColor = '#28a745';
    printButton.style.color = 'white';
    printButton.style.border = 'none';
    printButton.style.borderRadius = '5px';
    printButton.style.cursor = 'pointer';
    printButton.style.zIndex = '1000';
    printButton.style.display = 'none';
    printButton.addEventListener('click', printContainerContent);

    dataContainer = document.createElement('div');
    dataContainer.style.position = 'fixed';
    dataContainer.style.top = '650px';
    dataContainer.style.left = '10px';
    dataContainer.style.backgroundColor = 'white';
    dataContainer.style.border = '1px solid #ddd';
    dataContainer.style.borderRadius = '5px';
    dataContainer.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    dataContainer.style.padding = '10px';
    dataContainer.style.display = 'none';
    dataContainer.style.zIndex = '999';
    dataContainer.style.overflow = 'auto';
    dataContainer.style.maxHeight = '300px';

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.2; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(button);
    document.body.appendChild(printButton);
    document.body.appendChild(dataContainer);
})();
