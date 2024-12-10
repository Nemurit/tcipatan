(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let dataContainer; // Variabile per il container
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    // Funzione per caricare i dati
    function loadYardPageAndExtractData(callback) {
        const existingIframe = document.querySelector('iframe[data-yard="true"]');
        if (existingIframe) existingIframe.remove();

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.setAttribute('data-yard', 'true');
        iframe.src = "https://www.amazonlogistics.eu/yms/shipclerk";

        iframe.onload = function () {
            setTimeout(() => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (!iframeDoc) {
                    console.error("Impossibile accedere al contenuto dell'iframe.");
                    callback([]);
                    return;
                }

                const rows = iframeDoc.querySelectorAll('tr');
                const data = [];

                rows.forEach(row => {
                    const col1 = row.querySelector('td.col1');
                    const col8 = row.querySelector('td.col8');
                    const col9 = row.querySelector('td.col9');
                    const col11 = row.querySelector('td.col11');
                    const tractorIcon = row.querySelector('.yard-asset-icon.yard-asset-icon-TRACTOR');

                    if (col1 && col9 && col11) {
                        const location = col1.innerText.trim();
                        let note = col11.innerText.trim();
                        const isTractorPresent = tractorIcon !== null;

                        if (/TransfersCarts/i.test(col9?.innerText || '')) {
                            data.push([location, note, isTractorPresent, false]);
                        } else if (/Transfers/i.test(col9?.innerText || '') && /Ricarica/i.test(note)) {
                            data.push([location, note, isTractorPresent, false]);
                        } else if (!col9?.innerText.trim() && /Ricarica/i.test(note)) {
                            data.push([location, note, isTractorPresent, false]);
                        }

                        if (col8 && (/DSSMITH/i.test(col8.innerText) || /ZETAC/i.test(col8.innerText))) {
                            note = "Non Inventory";
                            data.push([location, note, isTractorPresent, true]);
                        }
                    }
                });

                callback(data);
                iframe.remove();
            }, 5000);
        };

        document.body.appendChild(iframe);
    }

    // Funzione per mostrare i dati nella tabella
    function displayData(data) {
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
                    dot.classList.add('blinking-dot');
                    dot.style.display = 'inline-block';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.borderRadius = '50%';
                    dot.style.backgroundColor = 'green';
                    dot.style.marginLeft = '10px';
                    firstTd.appendChild(dot);
                }

                const lastTd = row.insertCell();
                lastTd.textContent = rowData[1];

                [firstTd, lastTd].forEach(td => {
                    td.style.padding = '8px';
                    td.style.border = '1px solid #ddd';
                    td.style.whiteSpace = 'nowrap';
                });
            });
        }

        dataContainer.appendChild(dataTable);
        isDataLoaded = true;
        dataContainer.style.display = 'block';
    }

    // Funzione per alternare la visualizzazione dei dati
    function toggleDataDisplay() {
        if (tableVisible) {
            dataContainer.style.display = 'none';
            printButton.style.display = 'none';
            button.textContent = "Mostra Scarichi";
        } else {
            loadYardPageAndExtractData(function (data) {
                displayData(data);
                dataContainer.style.display = 'block';
                printButton.style.display = 'inline-block';
            });
            button.textContent = "Nascondi Scarichi";
        }
        tableVisible = !tableVisible;
    }

    // Aggiunta dei pulsanti
    const button = document.createElement('button');
    button.textContent = "Mostra Scarichi";
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.left = '10px';
    button.addEventListener('click', toggleDataDisplay);

    const printButton = document.createElement('button');
    printButton.textContent = "Stampa";
    printButton.addEventListener('click', function () {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
          <head>
            <style>
              .blinking-dot {
                animation: blink 1s infinite;
              }
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
              }
            </style>
          </head>
          <body>
            ${dataContainer.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
    });

    document.body.appendChild(button);
    document.body.appendChild(printButton);
})();
