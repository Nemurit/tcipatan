(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];  // Ora permette un array di lane
    let stackingToLaneMap = {};

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

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || location.toUpperCase().includes(selectedBufferFilter.toUpperCase())) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
            ) {
                if (!filteredSummary[location]) {
                    filteredSummary[location] = {};
                }
                if (!filteredSummary[location][lane]) {
                    filteredSummary[location][lane] = { count: 0 };
                }
                filteredSummary[location][lane].count++;
            }
        });

        // Ordina i buffer in ordine numerico basato sui numeri nel nome (es. "BUFFER E3-F3", "BUFFER B4-C4")
        const sortedSummary = Object.keys(filteredSummary)
            .sort((a, b) => parseBufferNumber(a) - parseBufferNumber(b))
            .reduce((acc, key) => {
                acc[key] = filteredSummary[key];
                return acc;
            }, {});

        displayTable(sortedSummary);
    }

    // Funzione per estrarre i numeri dal nome del buffer
    function parseBufferNumber(bufferName) {
        // Estrae il numero dal nome del buffer (es. "BUFFER E3-F3" -> "3")
        const match = bufferName.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 0;
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
                top: 100px;
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

    function addFilters() {
        $('#filterContainer').remove();

        const filterContainer = $('<div id="filterContainer" style="margin-bottom: 20px; text-align: center; position: absolute; right: 10px; top: 40px;"></div>');

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

    fetchStackingFilterMap(fetchBufferSummary);
})();
