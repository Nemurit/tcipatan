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

        displayTable(sortedSummary);
    }

    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 0;
    }

    function displayTable(sortedSummary) {
        if (!isVisible) return;

        $('#bufferSummaryTable').remove();

        if (Object.keys(sortedSummary).length === 0) {
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        table.append('<thead><tr><th>Buffer</th><th>Totale Container</th></tr></thead>');

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

            tbody.append(`<tr><td colspan="2" style="font-weight: bold; text-align: left;">Lane: ${lane} - Totale: <span style="color: ${laneColor};">${laneTotal}</span></td></tr>`);

            Object.entries(laneSummary).forEach(([location, data]) => {
                const row = $('<tr></tr>');
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

        const globalTotalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale Globale</td><td>' + totalContainers + '</td></tr>');
        tbody.append(globalTotalRow);

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

        addFilters();
    }

    function addFilters() {
        if (!isVisible) return;

        $('#filterContainer').remove();

        const filterContainer = $('<div id="filterContainer" style="margin-bottom: 20px; text-align: center; position: fixed; top: 10px; right: 10px; z-index: 9999;"></div>');

        const bufferFilterInput = $('<input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="padding: 10px; font-size: 16px; width: 200px; margin-top: 10px;">');
        bufferFilterInput.val(selectedBufferFilter);

        bufferFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedBufferFilter = bufferFilterInput.val();
                fetchBufferSummary();
            }
        });

        const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtro per LANE" style="padding: 10px; font-size: 16px; width: 200px; margin-top: 10px;">');
        laneFilterInput.val(selectedLaneFilters.join(', '));

        laneFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = laneFilterInput.val().split(',').map(filter => filter.trim());
                fetchBufferSummary();
            }
        });

        filterContainer.append(bufferFilterInput);
        filterContainer.append(laneFilterInput);
        $('body').append(filterContainer);
    }

    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 18px; left: 950px; padding: 4px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Recuperi</button>');

        toggleButton.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();
                $(this).text("Nascondi Recuperi");
            } else {
                $('#filterContainer').remove();
                $('#bufferSummaryTable').remove();
                $(this).text("Mostra Recuperi");
            }
        });

        $('body').append(toggleButton);
    }

    fetchStackingFilterMap(function() {
        addToggleButton();
        fetchBufferSummary();
    });

})();