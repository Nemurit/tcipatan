(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let selectedTimeFilter = ''; // Variabile per il filtro dell'ora
    let isVisible = false;


    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/BUFFER\s*[A-Za-z](\d+)/);
        return match ? parseInt(match[1], 10) : 0;  // Estrae solo il numero, o restituisce 0 se non corrisponde
    }
    function fetchStackingFilterMap(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: stackingFilterMapUrl,
            onload: function(response) {
                try {
                    const laneData = JSON.parse(response.responseText);

                    for (const [lane, stackingFilters] of Object.entries(laneData)) {
                        stackingFilters.forEach(filter => {
                            stackingToLaneMap[filter] = lane.split('[')[0];
                        });
                    }

                    if (callback) callback();
                } catch (error) {
                    console.error("Errore nel parsing della mappa JSON:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nel caricamento del file JSON:", error);
            }
        });
    }

    function fetchBufferSummary() {
        const endTime = new Date().getTime();
        const startTime = endTime - 24 * 60 * 60 * 1000;

        const apiUrl = `https://www.amazonlogistics.eu/sortcenter/vista/controller/getContainersDetailByCriteria`;
        const payload = {
            entity: "getContainersDetailByCriteria",
            nodeId: nodeId,
            timeBucket: {
                fieldName: "physicalLocationMoveTimestamp",
                startTime: startTime,
                endTime: endTime
            },
            filterBy: {
                state: ["Stacked"],
                isClosed: [true],
                isMissing: [false]
            },
            containerTypes: ["PALLET", "GAYLORD", "CART"]
        };

        GM_xmlhttpRequest({
            method: "GET",
            url: `${apiUrl}?${new URLSearchParams({ jsonObj: JSON.stringify(payload) })}`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails[0].containerDetails;
                        processAndDisplay(containers);
                    } else {
                        console.warn("Nessun dato trovato nella risposta API.");
                    }
                } catch (error) {
                    console.error("Errore nella risposta API:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nella chiamata API:", error);
            }
        });
    }

        function processAndDisplay(containers) {
        const filteredSummary = {};

            containers.forEach(container => {
        const location = container.location || '';
        const stackingFilter = container.stackingFilter || 'N/A';
        const lane = stackingToLaneMap[stackingFilter] || 'N/A';
        const cpt = container.cpt ? new Date(container.cpt) : null; // Recupera il CPT come oggetto Date

        // Filtra solo i buffer che contengono "BUFFER"
        if (
            location.toUpperCase().startsWith("BUFFER") &&
            (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
            (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()))) &&
            (selectedTimeFilter === '' || matchesTimeFilter(cpt, selectedTimeFilter))
        ) {
            if (!filteredSummary[lane]) {
                filteredSummary[lane] = { locations: {}, cpt: cpt };
            }

            if (!filteredSummary[lane].locations[location]) {
                filteredSummary[lane].locations[location] = { count: 0 };
            }

            filteredSummary[lane].locations[location].count++;
        }
    });

    const sortedSummary = {};
    Object.keys(filteredSummary).forEach(lane => {
        const laneSummary = filteredSummary[lane].locations;
        sortedSummary[lane] = {
            cpt: filteredSummary[lane].cpt,
            locations: Object.keys(laneSummary)
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
                }, {})
        };
    });

    if (isVisible) {
        displayTable(sortedSummary);
    }
}

// Funzione per confrontare un buffer con il filtro numerico
function matchesExactBufferNumber(location, filter) {
    const match = location.match(/BUFFER\s*[A-Za-z]?(\d+)/); // Trova il numero associato al buffer
    if (match) {
        const bufferNumber = match[1]; // Estrae il numero
        return bufferNumber === filter; // Verifica che corrisponda esattamente al filtro
    }
    return false;
}

// Funzione per confrontare l'ora del CPT con il filtro dell'ora
function matchesTimeFilter(cpt, timeFilter) {
    if (!cpt) return false; // Se non c'è un CPT, non corrisponde
    const cptTime = cpt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return cptTime === timeFilter;
}

// Funzione per convertire una data in formato HH:mm:ss DD/MM/YYYY
function formatCPT(date) {
    if (!date) return 'N/A';
    const optionsTime = { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const optionsDate = { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' };
    const time = date.toLocaleTimeString('it-IT', optionsTime);
    const dateStr = date.toLocaleDateString('it-IT', optionsDate);
    return `${time} ${dateStr}`;
}

function displayTable(sortedSummary) {
    $('#contentContainer').remove();

    if (Object.keys(sortedSummary).length === 0) {
        return; // Evita di mostrare la tabella se non ci sono dati
    }

    const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; height: 90vh; width: 400px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: white; padding: 10px; border: 1px solid #ddd;"></div>');
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
        <tr>
            <th colspan="2">
                <input id="timeFilterInput" type="text" placeholder="Filtro per ORA (es. HH:mm)" style="width: 100%; padding: 5px; box-sizing: border-box;">
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

    Object.entries(sortedSummary).forEach(([lane, data]) => {
        const laneCPT = formatCPT(data.cpt);
        const laneSummary = data.locations;

        let laneTotal = 0;
        Object.entries(laneSummary).forEach(([location, locData]) => {
            laneTotal += locData.count;
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
            <td colspan="2" style="font-weight: bold; text-align: left;">
                Lane: ${lane} - CPT: <span>${laneCPT}</span> - Totale: <span style="color: ${laneColor};">${laneTotal}</span>
            </td>
        </tr>`);

        laneRow.on('click', function() {
            const nextRows = $(this).nextUntil('.laneRow');
            nextRows.toggle();
        });

        tbody.append(laneRow);

        Object.entries(laneSummary).forEach(([location, locData]) => {
            const row = $('<tr class="locationRow"></tr>');
            const count = locData.count;

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

    $('#timeFilterInput').val(selectedTimeFilter).on('keydown', function(event) {
        if (event.key === "Enter") {
            selectedTimeFilter = $(this).val();
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



   function addToggleButton() {
    const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 10px; left: calc(50% - 20px); padding: 4px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 10000;">Mostra Recuperi</button>');

    toggleButton.on('click', function() {
        isVisible = !isVisible;
        if (isVisible) {
            fetchBufferSummary();
            $(this).text("Nascondi Recuperi");
        } else {
            $('#contentContainer').remove();
            $(this).text("Mostra Recuperi");
        }
    });

    $('body').append(toggleButton);
}


  fetchStackingFilterMap(function () {
    addToggleButton(); // Mostra il pulsante
    fetchBufferSummary(); // Esegue il primo caricamento dei dati
});


    // Aggiorna i dati ogni 5 minuti
    setInterval(fetchBufferSummary, 200000); // 200,000 ms = 3 minuti

})();
