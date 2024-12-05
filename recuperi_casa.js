(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let isVisible = false;

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

        // Filtra solo i buffer che contengono "BUFFER" e gestisce correttamente il filtro numerico
        if (
            location.toUpperCase().startsWith("BUFFER") &&
            (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
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
        displayTable(sortedSummary);
    }
}

// Funzione che confronta il numero esatto nel nome del buffer con il filtro
function matchesExactBufferNumber(location, filter) {
    const match = location.match(/BUFFER\s*([A-Za-z])(\d+)/); // Trova la lettera seguita dal numero
    if (match) {
        const letter = match[1];  // Estrae la lettera
        const number = match[2];  // Estrae il numero
        
        // Caso 1: Se il filtro è una singola lettera, confronta solo la lettera
        if (/^[A-Za-z]$/.test(filter)) {
            return letter.toUpperCase() === filter.toUpperCase();
        }
        
        // Caso 2: Se il filtro è un numero, confronta solo il numero
        if (/^\d+$/.test(filter)) {
            return number === filter;
        }
        
        // Caso 3: Se il filtro è la stringa completa, confronta sia la lettera che il numero
        return location.toUpperCase() === filter.toUpperCase();
    }
    return false;
}


// Funzione che estrae il numero dal nome del buffer per ordinarlo
function parseBufferNumber(bufferName) {
    const match = bufferName.match(/BUFFER\s*[A-Za-z](\d+)/);
    return match ? parseInt(match[1], 10) : 0;  // Estrae solo il numero
}



    function displayTable(sortedSummary) {
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

    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 10px; left: calc(50% - 20px); padding: 4px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Recuperi</button>');

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

    fetchStackingFilterMap(function() {
        addToggleButton();
        fetchBufferSummary();
    });

    // Aggiorna i dati ogni 5 minuti
    setInterval(fetchBufferSummary, 200000); // 200,000 ms = 3 minuti

})();
