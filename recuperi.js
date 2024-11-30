(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};

    // Fetch stacking filter map
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

    // Fetch buffer summary
    function fetchBufferSummary() {
        const endTime = new Date().getTime();
        const startTime = endTime - 24 * 60 * 60 * 1000;

        const apiUrl = 'https://www.amazonlogistics.eu/sortcenter/vista/controller/getContainersDetailByCriteria';
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

    // Process data and create the summary
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
                acc[key] = filteredSummary[key];
                return acc;
            }, {});

        displayTable(sortedSummary);
    }

    // Natural sort function
    function naturalSort(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }

    // Display the table
    function displayTable(filteredSummary) {
        $('#bufferSummaryTable').remove();
        $('#totalCount').remove();

        if (Object.keys(filteredSummary).length === 0) {
            $('body').append('<div id="totalCount" style="text-align: center;">Nessun dato trovato</div>');
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        table.append('<thead><tr><th>Buffer</th><th>Lane</th><th>Numero di Container</th></tr></thead>');

        const tbody = $('<tbody></tbody>');
        let rowCount = 0;
        let totalContainers = 0;

        // Display a maximum of 4 rows initially
        const rowsToDisplay = Object.entries(filteredSummary).slice(0, 4);

        rowsToDisplay.forEach(([location, lanes]) => {
            Object.entries(lanes).forEach(([lane, data]) => {
                const row = $('<tr></tr>');
                row.append(`<td>${location}</td>`);
                row.append(`<td>${lane}</td>`);
                row.append(`<td>${data.count}</td>`);
                tbody.append(row);
                rowCount++;
                totalContainers += data.count;
            });
        });

        // Add the "Show All" button if there are more than 4 rows
        if (Object.entries(filteredSummary).length > 4) {
            const showAllButton = $('<button id="showAllButton" style="margin-top: 10px;">Mostra Tutte le Righe</button>');
            showAllButton.on('click', function() {
                // Display all rows
                Object.entries(filteredSummary).forEach(([location, lanes]) => {
                    Object.entries(lanes).forEach(([lane, data]) => {
                        const row = $('<tr></tr>');
                        row.append(`<td>${location}</td>`);
                        row.append(`<td>${lane}</td>`);
                        row.append(`<td>${data.count}</td>`);
                        tbody.append(row);
                    });
                });
                showAllButton.remove(); // Remove "Show All" button after showing all rows
            });
            table.append(tbody);
            table.append(showAllButton);
        } else {
            const totalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale</td><td>' + totalContainers + '</td></tr>');
            tbody.append(totalRow);
            table.append(tbody);
        }

        // Wrap the tbody in a scrollable wrapper
        const tableWrapper = $('<div id="bufferSummaryTableWrapper"></div>');
        tableWrapper.append(table);
        $('#mainContainer').append(tableWrapper);
    }

    // Add filters
    function addFilters() {
        const mainContainer = $('<div id="mainContainer"></div>');
        const filterContainer = $('<div id="filterContainer"></div>');

        const filterButton = $('<button id="filterButton" style="padding: 8px 15px; background-color: #007bff; color: #fff; border: none; border-radius: 5px; margin-bottom: 10px;">Visualizza Filtri</button>');
        filterButton.on('click', function() {
            $('#filterContainer').toggle(); // Toggle visibility of filters
        });

        const bufferFilterInput = $('<input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="padding: 8px 12px; margin-right: 10px; width: 100%; margin-bottom: 10px;"/>');
        bufferFilterInput.val(selectedBufferFilter);
        bufferFilterInput.on('input', function() {
            selectedBufferFilter = this.value;
        });

        const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtro per Lane (separati da virgola)" style="padding: 8px 12px; margin-top: 10px; width: 100%; margin-bottom: 10px;"/>');
        laneFilterInput.val(selectedLaneFilters.join(', '));
        laneFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = this.value.split(',').map(lane => lane.trim()).filter(lane => lane);
                fetchBufferSummary();
            }
        });

        const viewDataButton = $('<button style="padding: 8px 15px; margin-top: 10px; background-color: #007bff; color: #fff; border: none; border-radius: 5px; width: 100%;">Visualizza Recuperi</button>');
        viewDataButton.on('click', fetchBufferSummary);

        filterContainer.append('<h3>Filtri</h3>');
        filterContainer.append(bufferFilterInput);
        filterContainer.append(laneFilterInput);
        filterContainer.append(viewDataButton);

        mainContainer.append(filterButton);
        mainContainer.append(filterContainer);
        $('body').append(mainContainer);

        // Set styles for fixed layout
        GM_addStyle(`
            #mainContainer {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 400px;
                background-color: white;
                padding: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                max-height: 90vh;
                overflow-y: auto;
            }

            #filterContainer {
                display: none;
            }

            #bufferSummaryTableWrapper {
                max-height: 300px;
                overflow-y: auto;
            }

            #bufferSummaryTable {
                width: 100%;
                border-collapse: collapse;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }

            #bufferSummaryTable th, #bufferSummaryTable td {
                border: 1px solid #ddd;
                padding: 8px;
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

            button {
                cursor: pointer;
                width: 100%;
                padding: 10px;
                margin-top: 10px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
            }
        `);

        fetchStackingFilterMap(() => {
            addFilters();
        });
    }

    // Initialize
    addFilters();
})();
