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
        let totalPackageCount = 0; // Per calcolare il totale dei pacchi

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';

            const contentCount = container.contentCount || 0; // Numero pacchi da Content count

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || location.toUpperCase().includes(selectedBufferFilter.toUpperCase())) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
            ) {
                totalPackageCount += contentCount; // Somma totale pacchi

                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = {};
                }

                if (!filteredSummary[lane][location]) {
                    filteredSummary[lane][location] = { count: 0, packages: 0 };
                }

                filteredSummary[lane][location].count++;
                filteredSummary[lane][location].packages += contentCount; // Conteggio pacchi
            }
        });

        displayTable(filteredSummary, totalPackageCount);
    }

    function displayTable(sortedSummary, totalPackageCount) {
        $('#contentContainer').remove();

        const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; height: 90vh; width: 400px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: white; padding: 10px; border: 1px solid #ddd;"></div>');

        if (Object.keys(sortedSummary).length === 0) {
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');

        const thead = $('<thead></thead>');
        thead.append(`
            <tr>
                <th>Buffer</th>
                <th>Totale Container</th>
                <th>Totale Pacchi</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        let totalContainers = 0;

        Object.entries(sortedSummary).forEach(([lane, laneSummary]) => {
            let laneTotal = 0;
            let lanePackages = 0;

            Object.entries(laneSummary).forEach(([location, data]) => {
                laneTotal += data.count;
                lanePackages += data.packages;
            });

            const laneRow = $(`<tr class="laneRow" style="cursor: pointer;">
                <td colspan="3" style="font-weight: bold; text-align: left;">Lane: ${lane} - Totale: ${laneTotal} Container, ${lanePackages} Pacchi</td>
            </tr>`);

            laneRow.on('click', function() {
                const nextRows = $(this).nextUntil('.laneRow');
                nextRows.toggle();
            });

            tbody.append(laneRow);

            Object.entries(laneSummary).forEach(([location, data]) => {
                const row = $('<tr class="locationRow"></tr>');
                row.append(`<td>${location}</td>`);
                row.append(`<td>${data.count}</td>`);
                row.append(`<td>${data.packages}</td>`);
                tbody.append(row);
            });

            totalContainers += laneTotal;
        });

        const tfoot = $('<tfoot></tfoot>');
        const globalTotalRow = $(`<tr>
            <td colspan="2" style="font-weight: bold;">Totale Globale:</td>
            <td>${totalPackageCount} Pacchi</td>
        </tr>`);
        tfoot.append(globalTotalRow);

        table.append(thead);
        table.append(tbody);
        table.append(tfoot);
        contentContainer.append(table);

        $('body').append(contentContainer);
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
    setInterval(fetchBufferSummary, 300000); // 300,000 ms = 5 minuti

})();
