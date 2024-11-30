(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let isRecoveryVisible = false; // Stato iniziale: nascosto

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
            containerTypes: ["PALLET", "GAYLORD", "BAG", "CART"]
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

        const sortedSummary = Object.keys(filteredSummary)
            .sort((a, b) => naturalSort(a, b))
            .reduce((acc, key) => {
                acc[key] = Object.keys(filteredSummary[key])
                    .sort((a, b) => naturalSort(a, b))
                    .reduce((accLanes, laneKey) => {
                        accLanes[laneKey] = filteredSummary[key][laneKey];
                        return accLanes;
                    }, {});
                return acc;
            }, {});

        displayTable(sortedSummary);
    }

    function naturalSort(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
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
                top: 70px;
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
    }

    function addFilters() {
        $('#filterContainer').remove();

        const filterContainer = $('<div id="filterContainer" style="margin-bottom: 20px; text-align: center; position: absolute; right: 10px; top: 10px; display: none;"></div>');

        const bufferFilterInput = $('<input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="padding: 8px 12px; margin-right: 10px; width: 250px; border-radius: 5px; border: 1px solid #ccc;"/>');
        bufferFilterInput.val(selectedBufferFilter);
        bufferFilterInput.on('input', function() {
            selectedBufferFilter = this.value;
        });

        const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtro per Lane (separati da virgola)" style="padding: 8px 12px; margin-right: 10px; width: 250px; border-radius: 5px; border: 1px solid #ccc;"/>');
        laneFilterInput.val(selectedLaneFilters.join(', '));
        laneFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = this.value.split(',').map(lane => lane.trim()).filter(lane => lane);
                fetchBufferSummary();
            }
        });

        filterContainer.append(bufferFilterInput);
        filterContainer.append(laneFilterInput);
        $('body').append(filterContainer);
    }

    function toggleRecovery() {
        isRecoveryVisible = !isRecoveryVisible;
        $('#filterContainer').toggle(isRecoveryVisible);
        $('#bufferSummaryTable').toggle(isRecoveryVisible);

        if (isRecoveryVisible) {
            fetchBufferSummary();
            $('#toggleButton').text('Nascondi Recuperi');
        } else {
            $('#toggleButton').text('Mostra Recuperi');
        }
    }

    function addToggleButton() {
        const button = $('<button id="toggleButton" style="position: fixed; top: 10px; left: 950px; z-index: 10001; padding: 10px; background-color: rgba(255, 255, 255, 0.9); border-radius: 5px; display: flex; flex-direction: row;"><button style="padding: 3px; background-color: rgb(76, 175, 80); color: white; border: none; border-radius: 3px; margin-right: 5px;">Mostra Recuperi</button>');
        button.on('click', toggleRecovery);
        $('body').append(button);
    }

    fetchStackingFilterMap(addFilters);
    addToggleButton();
})();
