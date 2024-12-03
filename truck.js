(function () {
    'use strict';

    // Costanti
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;

    // Variabili globali
    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;
    let containermain = null;

    // Funzione principale per fetch dei dati
    async function fetchTruckData(hours) {
        const url = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob';
        const params = new URLSearchParams({
            hours: hours || DEFAULT_HOURS,
        });

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include', // Necessario se il server richiede autenticazione tramite cookie
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json(); // Supponendo che il server restituisca JSON
            console.log('Dati ricevuti:', data);

            // Trasformare i dati nel formato atteso
            allRows = data.map((row, index) => ({
                index: index + 1,
                lane: row.lane || '',
                sdt: row.sdt || '',
                cpt: row.cpt || '',
                vrId: row.vrId || '',
                date: parseDate(row.sdt),
                extraText: determineStatus(row),
                highlightColor: determineColor(row),
            }));

            filterAndShowData(hours);
        } catch (error) {
            console.error('Errore durante il fetch dei dati:', error);
        }
    }

    // Funzioni di supporto
    function parseDate(dateString) {
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
        console.error(`Impossibile convertire la data: ${dateString}`);
        return null;
    }

    function determineStatus(row) {
        if (row.sdt === row.cpt) {
            return 'CPT';
        } else if (row.lane.startsWith('WT')) {
            return 'TRANSFER';
        }
        return 'COLLECTION';
    }

    function determineColor(row) {
        if (row.sdt === row.cpt) {
            return 'green';
        } else if (row.lane.startsWith('WT')) {
            return 'violet';
        }
        return 'orange';
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
        tableContainer.id = 'tableContainer';

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
                    <tr style="background-color: ${row.highlightColor}; color: white;">
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
        containermain.style.flexDirection = 'row';

        const loadButton = document.createElement('button');
        loadButton.innerHTML = 'Carica Dati';
        loadButton.addEventListener('click', () => fetchTruckData(DEFAULT_HOURS));
        containermain.appendChild(loadButton);

        dropdown = document.createElement('select');
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
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtro VR ID';
        vrIdInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : INITIAL_HOURS);
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.addEventListener('click', function () {
            if (tableContainer) {
                const printWindow = window.open('', '_blank');
                printWindow.document.write(tableContainer.innerHTML);
                printWindow.document.close();
                printWindow.print();
            }
        });

        rowCountDisplay = document.createElement('span');

        containermain.appendChild(dropdown);
        containermain.appendChild(timeInputBox);
        containermain.appendChild(vrIdInputBox);
        containermain.appendChild(printButton);
        containermain.appendChild(rowCountDisplay);

        document.body.appendChild(containermain);
    }

    createButtons();
})();
