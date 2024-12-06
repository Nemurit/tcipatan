(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';  // Aggiungiamo il filtro per CPT
    let stackingToLaneMap = {};
    let isVisible = false;

    // Funzione per caricare la mappa di filtro di stacking
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

    // Funzione per ottenere il riepilogo dei buffer
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

    // Funzione per elaborare e visualizzare i dati dei container
    function processAndDisplay(containers) {
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || 'N/A';  // Aggiungiamo il campo CPT

            // Filtra i container in base ai criteri
            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()))) &&
                (selectedCptFilter === '' || cpt.toUpperCase().includes(selectedCptFilter.toUpperCase()))  // Aggiungiamo il filtro per CPT
            ) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = { cpt: cpt, buffers: [] }; // Aggiungiamo la lista di buffer per lane
                }

                filteredSummary[lane].buffers.push({ location: location, cpt: cpt });
            }
        });

        const sortedSummary = {};
        Object.keys(filteredSummary).forEach(lane => {
            const laneSummary = filteredSummary[lane];
            sortedSummary[lane] = laneSummary;
        });

        if (isVisible) {
            displayTable(sortedSummary);
        }
    }

    // Funzione che confronta il numero esatto nel nome del buffer con il filtro
    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/); // Trova la lettera seguita dal numero
        if (match) {
            const bufferNumber = match[1];  // Estrae il numero
            // Verifica che il numero estratto corrisponda esattamente al filtro
            return bufferNumber === filter;  
        }
        return false;
    }

    // Funzione per visualizzare la tabella
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
                <th>CPT</th>
                <th>Buffer</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');

        Object.entries(sortedSummary).forEach(([lane, laneSummary]) => {
            const laneRow = $(`<tr class="laneRow" style="cursor: pointer;">
                <td colspan="3" style="font-weight: bold; text-align: left;">Lane: ${lane} - CPT: ${laneSummary.cpt}</td>
            </tr>`);

            tbody.append(laneRow);

            // Aggiungi i buffer della lane
            laneSummary.buffers.forEach(buffer => {
                const bufferRow = $(`<tr class="containerRow" style="display: none;">
                    <td></td>
                    <td>${buffer.cpt}</td>
                    <td>${buffer.location}</td>
                </tr>`);
                tbody.append(bufferRow);
            });
        });

        table.append(thead);
        table.append(tbody);
        contentContainer.append(table);
        $('body').append(contentContainer);

        // Gestire l'espansione della lane
        $(".laneRow").on('click', function() {
            const bufferRows = $(this).nextUntil(".laneRow");
            bufferRows.toggle();
        });

        // Gestire i filtri
        $('#bufferFilterInput').on('input', function() {
            selectedBufferFilter = $(this).val();
            fetchBufferSummary();
        });

        $('#laneFilterInput').on('input', function() {
            selectedLaneFilters = $(this).val().split(',').map(item => item.trim()).filter(item => item.length > 0);
            fetchBufferSummary();
        });

        $('#cptFilterInput').on('input', function() {
            selectedCptFilter = $(this).val().trim();
            fetchBufferSummary();
        });
    }

    // Attiviamo la visualizzazione della tabella
    toggleTable();

})();
