function createButtons() {
    containermain = document.createElement('div');
    containermain.style.position = 'fixed';
    containermain.style.top = '10px';
    containermain.style.left = '10px';
    containermain.style.zIndex = '10001';
    containermain.style.padding = '10px';
    containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    containermain.style.borderRadius = '5px';
    containermain.style.display = 'flex';
    containermain.style.flexDirection = 'column'; // Cambiato a colonna per posizionare gli elementi in verticale

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.flexDirection = 'row';
    buttonRow.style.marginBottom = '10px';

    const filterRow = document.createElement('div');
    filterRow.style.display = 'flex';
    filterRow.style.flexDirection = 'column'; // Impostato per disporre il filtro verticalmente

    buttonRow.appendChild(createButtonForPageLoadAndDataExtraction());

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

    dropdown.addEventListener('change', function () {
        filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : INITIAL_HOURS);
    });

    timeInputBox = document.createElement('input');
    timeInputBox.type = 'number';
    timeInputBox.placeholder = 'Ore';
    timeInputBox.style.padding = '3px';
    timeInputBox.style.marginRight = '5px';
    timeInputBox.style.display = 'none';
    timeInputBox.addEventListener('input', function () {
        filterAndShowData(parseInt(timeInputBox.value, 10));
    });

    vrIdInputBox = document.createElement('input');
    vrIdInputBox.type = 'text';
    vrIdInputBox.placeholder = 'Filtro VR ID';
    vrIdInputBox.style.padding = '3px';
    vrIdInputBox.style.marginTop = '5px'; // Margine per separare dal pulsante
    vrIdInputBox.style.display = 'block'; // Mostrato di default
    vrIdInputBox.addEventListener('input', function () {
        filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : INITIAL_HOURS);
    });

    printButton = document.createElement('button');
    printButton.innerHTML = 'Stampa';
    printButton.style.padding = '3px';
    printButton.style.marginRight = '5px';
    printButton.style.display = 'none';
    printButton.addEventListener('click', function () {
        if (tableContainer) {
            const printWindow = window.open('', '_blank');
            const printDocument = printWindow.document;

            // Crea un contenuto minimale per la stampa
            printDocument.open();
            printDocument.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Stampa Tabella</title>
                    <style>
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                            font-family: Arial, sans-serif;
                            font-size: 14px;
                            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                        }
                        th, td {
                            border: 1px solid #ccc;
                            padding: 8px;
                            text-align: left;
                        }
                        th {
                            background-color: #f4f4f4;
                        }
                    </style>
                </head>
                <body>
                    ${tableContainer.innerHTML}
                </body>
                </html>
            `);
            printDocument.close();

            // Avvia il processo di stampa
            printWindow.print();

            // Chiudi la finestra di stampa dopo l'uso
            printWindow.onafterprint = function () {
                printWindow.close();
            };
        } else {
            alert('Nessuna tabella disponibile per la stampa.');
        }
    });

    rowCountDisplay = document.createElement('span');
    rowCountDisplay.style.marginLeft = '5px';
    rowCountDisplay.style.display = 'none';

    buttonRow.appendChild(dropdown);
    buttonRow.appendChild(timeInputBox);
    buttonRow.appendChild(printButton);
    buttonRow.appendChild(rowCountDisplay);

    containermain.appendChild(buttonRow);
    containermain.appendChild(filterRow); // Aggiunto contenitore per il filtro
    filterRow.appendChild(vrIdInputBox); // Posizionato sotto il pulsante

    document.body.appendChild(containermain);
}
