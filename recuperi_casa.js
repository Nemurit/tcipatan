function processAndDisplay(containers) {
    const filteredSummary = {};
    let totalPackages = 0; // Variabile per calcolare il totale dei pacchi

    containers.forEach(container => {
        const location = container.location || '';
        const stackingFilter = container.stackingFilter || 'N/A';
        const lane = stackingToLaneMap[stackingFilter] || 'N/A';
        const contentCount = container.contentCount || 0; // Ottieni il numero di pacchi

        // Incrementa il totale dei pacchi
        totalPackages += contentCount;

        if (
            location.toUpperCase().startsWith("BUFFER") &&
            (selectedBufferFilter === '' || location.toUpperCase().includes(selectedBufferFilter.toUpperCase())) &&
            (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
        ) {
            if (!filteredSummary[lane]) {
                filteredSummary[lane] = {};
            }

            if (!filteredSummary[lane][location]) {
                filteredSummary[lane][location] = { count: 0 };
            }

            filteredSummary[lane][location].count++;
        }
    });

    // Ordina e crea la struttura per la tabella
    const sortedSummary = {};
    Object.keys(filteredSummary).forEach(lane => {
        const laneSummary = filteredSummary[lane];
        sortedSummary[lane] = Object.keys(laneSummary)
            .sort((a, b) => {
                const numA = parseBufferNumber(a);
                const numB = parseBufferNumber(b);

                if (numA === numB) {
                    return a.localeCompare(b);
                }
                return numA - numB;
            })
            .reduce((acc, location) => {
                acc[location] = laneSummary[location];
                return acc;
            }, {});
    });

    if (isVisible) {
        displayTable(sortedSummary, totalPackages); // Passa il totale alla funzione displayTable
    }
}

function displayTable(sortedSummary, totalPackages) {
    $('#contentContainer').remove();

    const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; height: 90vh; width: 400px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: white; padding: 10px; border: 1px solid #ddd;"></div>');

    if (Object.keys(sortedSummary).length === 0) {
        return;
    }

    const table = $('<table id="bufferSummaryTable" class="performance"></table>');

    const thead = $('<thead></thead>');
    thead.append(`
        <tr>
            <th>
                <input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="width: 100%; padding: 5px; box-sizing: border-box;">
            </th>
            <th>
                <input id="laneFilterInput" type="text" placeholder="Filtro per LANE" style="width: 100%; padding: 5px; box-sizing: border-box;">
            </th>
        </tr>
    `);

    thead.append(`
        <tr>
            <th>Buffer</th>
            <th>Totale Container</th>
        </tr>
    `);

    const tbody = $('<tbody></tbody>');
    let totalContainers = 0;

    Object.entries(sortedSummary).forEach(([lane, laneSummary]) => {
        let laneTotal = 0;

        Object.entries(laneSummary).forEach(([location, data]) => {
            laneTotal += data.count;
        });

        let laneColor = '';
        if (laneTotal <= 10) {
            laneColor = 'green';
        } else if (laneTotal <= 30) {
            laneColor = 'orange';
        } else {
            laneColor = 'red';
        }

        const laneRow = $(`<tr class="laneRow" style="cursor: pointer;">
            <td colspan="2" style="font-weight: bold; text-align: left;">Lane: ${lane} - Totale: <span style="color: ${laneColor};">${laneTotal}</span></td>
        </tr>`);

        laneRow.on('click', function() {
            const nextRows = $(this).nextUntil('.laneRow');
            nextRows.toggle();
        });

        tbody.append(laneRow);

        Object.entries(laneSummary).forEach(([location, data]) => {
            const row = $('<tr class="locationRow"></tr>');
            const count = data.count;

            let color = '';
            if (count <= 10) {
                color = 'green';
            } else if (count <= 30) {
                color = 'orange';
            } else {
                color = 'red';
            }

            row.append(`<td>${location}</td>`);
            row.append(`<td style="color: ${color};">${count}</td>`);
            tbody.append(row);
        });

        totalContainers += laneTotal;
    });

    const tfoot = $('<tfoot></tfoot>');
    const globalTotalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale Globale: ' + totalContainers + '</td></tr>');
    tfoot.append(globalTotalRow);

    table.append(thead);
    table.append(tbody);
    table.append(tfoot);
    contentContainer.append(table);

    // Valutazione della congestione
    let congestionStatus = '';
    let color = '';

    if (totalPackages <= 125000) {
        congestionStatus = `DOCK CONGESTION OK (${totalPackages})`;
        color = 'green';
    } else if (totalPackages <= 150000) {
        congestionStatus = `DOCK CONGESTION IN CONTINGENCY (${totalPackages})`;
        color = 'orange';
    } else {
        congestionStatus = `DOCK CONGESTION SAFETY ISSUE (${totalPackages})`;
        color = 'red';
    }

    const congestionDiv = $(`<div style="text-align: center; font-size: 18px; font-weight: bold; color: ${color}; margin-bottom: 10px;">${congestionStatus}</div>`);
    contentContainer.prepend(congestionDiv);

    $('body').append(contentContainer);

    $('#bufferFilterInput').val(selectedBufferFilter).on('keydown', function(event) {
        if (event.key === "Enter") {
            selectedBufferFilter = $(this).val();
            fetchBufferSummary();
        }
    });

    $('#laneFilterInput').val(selectedLaneFilters.join(', ')).on('keydown', function(event) {
        if (event.key === "Enter") {
            selectedLaneFilters = $(this).val().split(',').map(filter => filter.trim());
            fetchBufferSummary();
        }
    });

    GM_addStyle(`
        #bufferSummaryTable {
            table-layout: auto;
            margin: 20px 0;
            border-collapse: collapse;
            width: 100%;
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
        #bufferSummaryTable tfoot {
            background-color: #f4f4f4;
        }
        #bufferSummaryTable input {
            font-size: 14px;
            padding: 5px;
            margin: 0;
        }
        .locationRow {
            display: none;
        }
    `);
}
