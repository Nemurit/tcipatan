function addFilters() {
    $('#filterContainer').remove();

    const filterContainer = $('<div id="filterContainer" style="margin-bottom: 20px; text-align: center; position: absolute; right: 10px; top: 10px;"></div>'); // Adjusted top to 10px

    const bufferFilterInput = $('<input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="padding: 8px 12px; margin-right: 10px; width: 250px; border-radius: 5px; border: 1px solid #ccc;"/>');
    bufferFilterInput.val(selectedBufferFilter);
    bufferFilterInput.on('input', function() {
        selectedBufferFilter = this.value;  // Non causa un aggiornamento automatico
    });

    const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtro per Lane (separati da virgola)" style="padding: 8px 12px; margin-right: 10px; width: 250px; border-radius: 5px; border: 1px solid #ccc;"/>');
    laneFilterInput.val(selectedLaneFilters.join(', '));

    // Rileva il tasto Invio per il filtro Lane
    laneFilterInput.on('keydown', function(event) {
        if (event.key === "Enter") {
            selectedLaneFilters = this.value.split(',').map(lane => lane.trim()).filter(lane => lane);  // Aggiungi le lane selezionate
            fetchBufferSummary();  // Carica i dati quando l'utente preme Invio
        }
    });

    filterContainer.append(bufferFilterInput);
    filterContainer.append(laneFilterInput);
    $('body').append(filterContainer);
}

function displayTable(filteredSummary) {
    $('#bufferSummaryTable').remove();

    if (Object.keys(filteredSummary).length === 0) {
        return;
    }

    const table = $('<table id="bufferSummaryTable" class="performance"></table>');
    table.append('<thead><tr><th>Buffer</th><th>Lane</th><th>Numero di Container</th></tr></thead>');

    const tbody = $('<tbody></tbody>');
    let rowCount = 0;
    let totalContainers = 0;

    // Limita le righe a 5 se non ci sono filtri impostati
    const rowsToShow = (selectedBufferFilter === '' && selectedLaneFilters.length === 0) ? 5 : Infinity;

    Object.entries(filteredSummary).forEach(([location, lanes]) => {
        Object.entries(lanes).forEach(([lane, data]) => {
            if (rowCount < rowsToShow) {
                const row = $('<tr></tr>');
                row.append(`<td>${location}</td>`);
                row.append(`<td>${lane}</td>`);
                row.append(`<td>${data.count}</td>`);
                tbody.append(row);
                rowCount++;
                totalContainers += data.count;
            }
        });
    });

    const totalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale</td><td>' + totalContainers + '</td></tr>');
    tbody.append(totalRow);

    table.append(tbody);
    $('body').append(table);

    GM_addStyle(`
        #bufferSummaryTable {
            width: 50%;
            margin: 20px 0;
            border-collapse: collapse;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            position: absolute;
            right: 10px;
            top: 70px; /* Adjusted top to 70px */
        }
        #bufferSummaryTable th, #bufferSummaryTable td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }
        #bufferSummaryTable th {
            background-color: #f4f4f4;
            font-weight: bold;
        }
        #bufferSummaryTable tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        #bufferSummaryTable tr:hover {
            background-color: #f1f1f1;
        }
    `);

    addFilters();
}
