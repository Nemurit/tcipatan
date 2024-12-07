(function () {
    'use strict';

    const nodeId = 'MXP6'; // Nodo configurabile
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
    let isVisible = false;

    // Funzione per caricare la mappa Lane/Stacking
    function fetchStackingFilterMap(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: stackingFilterMapUrl,
            onload: function (response) {
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
            onerror: function (error) {
                console.error("Errore nel caricamento del file JSON:", error);
            }
        });
    }

    // Funzione per ottenere i dati dal server
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
            onload: function (response) {
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
            onerror: function (error) {
                console.error("Errore nella chiamata API:", error);
            }
        });
    }

    // Elaborazione dei dati e filtro
    function processAndDisplay(containers) {
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || 'N/A';

            if (
                location.toUpperCase().startsWith('BUFFER') &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()))) &&
                (selectedCptFilter === '' || cpt.toUpperCase().includes(selectedCptFilter.toUpperCase()))
            ) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = { cpts: new Set(), locations: {}, totalContainers: 0 };
                }

                filteredSummary[lane].cpts.add(cpt);

                if (!filteredSummary[lane].locations[location]) {
                    filteredSummary[lane].locations[location] = { count: 0, cpt: new Set() };
                }

                filteredSummary[lane].locations[location].count++;
                filteredSummary[lane].locations[location].cpt.add(cpt);

                // Incrementa il totale dei container per lane
                filteredSummary[lane].totalContainers++;
            }
        });

        const sortedSummary = {};
        Object.keys(filteredSummary).forEach(lane => {
            const laneSummary = filteredSummary[lane].locations;
            sortedSummary[lane] = {
                cpts: Array.from(filteredSummary[lane].cpts).join(', '),
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
                    }, {}),
                totalContainers: filteredSummary[lane].totalContainers
            };
        });

        if (isVisible) {
            displayTable(sortedSummary);
        }
    }

    // Estrai il numero dal nome del buffer
    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/);
        if (match) {
            const bufferNumber = match[1];
            return bufferNumber === filter;
        }
        return false;
    }

    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/BUFFER\s*[A-Za-z](\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    // Funzione per formattare la data e ora CPT in UTC+1
    function formatCptDate(cpt) {
        const date = new Date(cpt);
        const options = {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Europe/Rome',
            timeZoneName: 'short'
        };
        return date.toLocaleString('it-IT', options);
    }

    // Visualizza la tabella con i risultati
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
                <th>
                    <input id="cptFilterInput" type="text" placeholder="Filtro per CPT" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </th>
            </tr>
        `);

        thead.append(`
            <tr>
                <th>Lane</th>
                <th>Totale Container</th>
                <th>CPT</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        Object.entries(sortedSummary).forEach(([lane, { cpts, locations, totalContainers }]) => {
            Object.entries(locations).forEach(([location, data]) => {
                const row = $('<tr class="locationRow"></tr>');
                row.append(`<td>${lane}</td>`);
                row.append(`<td>${data.count}</td>`);
                row.append(`<td>${cpts}</td>`);
                tbody.append(row);
            });
        });

        table.append(thead);
        table.append(tbody);
        contentContainer.append(table);

        $('body').append(contentContainer);

        $('#bufferFilterInput').val(selectedBufferFilter).on('keydown', function (event) {
            if (event.key === "Enter") {
                selectedBufferFilter = $(this).val();
                fetchBufferSummary();
            }
        });

        $('#laneFilterInput').val(selectedLaneFilters.join(', ')).on('keydown', function (event) {
            if (event.key === "Enter") {
                selectedLaneFilters = $(this).val().split(',').map(filter => filter.trim());
                fetchBufferSummary();
            }
        });

        $('#cptFilterInput').val(selectedCptFilter).on('keydown', function (event) {
            if (event.key === "Enter") {
                selectedCptFilter = $(this).val();
                fetchBufferSummary();
            }
        });
    }

    // Mostra/Nascondi contenitore
    function toggleVisibility() {
        isVisible = !isVisible;
        if (isVisible) {
            fetchBufferSummary();
        } else {
            $('#contentContainer').remove();
        }
    }

    GM_registerMenuCommand("Mostra/Nascondi Sommario Buffer", toggleVisibility);

    fetchStackingFilterMap();
})();
