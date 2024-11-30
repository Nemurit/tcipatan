(function() {
    'use strict';

    // Costanti e variabili condivise
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    const nodeId = 'MXP6';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};

    let allRows = []; // Dati dei truck per il secondo script
    let tableContainer = null;
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;

    const MAX_HOURS = 24;

    // === Funzioni comuni ===
    function fetchJSON(url, callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?',
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    callback(data);
                } catch (error) {
                    console.error("Errore nel parsing JSON:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nel caricamento del file:", error);
            }
        });
    }

    function naturalSort(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }

    // === Script 1: Stacking Filter Map e Buffer Summary ===
    function fetchStackingFilterMap(callback) {
        fetchJSON(stackingFilterMapUrl, (laneData) => {
            for (const [lane, stackingFilters] of Object.entries(laneData)) {
                stackingFilters.forEach(filter => {
                    stackingToLaneMap[filter] = lane.split('[')[0];
                });
            }
            if (callback) callback();
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
                    const containers = data.ret?.getContainersDetailByCriteriaOutput?.containerDetails[0]?.containerDetails || [];
                    processAndDisplay(containers);
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
                if (!filteredSummary[location]) filteredSummary[location] = {};
                if (!filteredSummary[location][lane]) filteredSummary[location][lane] = { count: 0 };
                filteredSummary[location][lane].count++;
            }
        });

        displayTable(filteredSummary);
    }

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

        Object.entries(filteredSummary).forEach(([location, lanes]) => {
            Object.entries(lanes).forEach(([lane, data]) => {
                const row = $('<tr></tr>');
                row.append(`<td>${location}</td>`);
                row.append(`<td>${lane}</td>`);
                row.append(`<td>${data.count}</td>`);
                tbody.append(row);
            });
        });

        table.append(tbody);
        $('#mainContainer').append(table);
    }

    // === Script 2: Truck Data e Visualizzazione ===
    function fetchTruckData(hours, callback) {
        const url = `https://www.amazonlogistics.eu/ssp/dock/hrz/ob?hours=${hours}`;
        fetchJSON(url, (data) => {
            allRows = parseTruckData(data);
            callback(allRows);
        });
    }

    function parseTruckData(data) {
        // Parsing data for truck
        return []; // Implement parsing logic
    }

    function displayTruckData(rows) {
        // Logic for displaying truck data in a table
    }

    // === Inizializzazione ===
    function initialize() {
        fetchStackingFilterMap(() => {
            fetchBufferSummary();
        });

        fetchTruckData(MAX_HOURS, (rows) => {
            displayTruckData(rows);
        });
    }

    initialize();

})();
