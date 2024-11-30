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

        Object.entries(filteredSummary).forEach(([location, lanes]) => {
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

        const totalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale</td><td>' + totalContainers + '</td></tr>');
        tbody.append(totalRow);
        table.append(tbody);
        $('#mainContainer').append(table);

        GM_addStyle(`
            #bufferSummaryTable {
                width: 60%;
                float: right;
                border-collapse: collapse;
                margin-right: 5%;
                margin-top: 20px;
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
        `);
    }

    // Add filters
    function addFilters() {
        $('#mainContainer').remove();

        const mainContainer = $('<div id="mainContainer" style="width: 100%;"></div>');
        const filterContainer = $('<div id="filterContainer" style="width: 35%; float: left; margin: 20px;"></div>');

        const bufferFilterInput = $('<input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="padding: 8px 12px; margin-right: 10px; width: 90%;"/>');
        bufferFilterInput.val(selectedBufferFilter);
        bufferFilterInput.on('input', function() {
            selectedBufferFilter = this.value;
        });

        const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtro per Lane (separati da virgola)" style="padding: 8px 12px; margin-top: 10px; width: 90%;"/>');
        laneFilterInput.val(selectedLaneFilters.join(', '));
        laneFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = this.value.split(',').map(lane => lane.trim()).filter(lane => lane);
                fetchBufferSummary();
            }
        });

        const viewDataButton = $('<button style="padding: 8px 15px; margin-top: 10px; background-color: #007bff; color: #fff; border: none; border-radius: 5px;">Visualizza Recuperi</button>');
        viewDataButton.on('click', fetchBufferSummary);

        filterContainer.append('<h3>Filtri</h3>');
        filterContainer.append(bufferFilterInput);
        filterContainer.append(laneFilterInput);
        filterContainer.append(viewDataButton);

        mainContainer.append(filterContainer);
        $('body').append(mainContainer);
    }

    fetchStackingFilterMap(() => {
        addFilters();
    });
})();
