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
        let totalContainers = 0; // Totale complessivo dei container

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
                    filteredSummary[lane] = { cpt: formatDateCPT(cpt), buffers: [], total: 0 }; // Aggiungiamo la data formattata per CPT e un campo per il totale
                }

                filteredSummary[lane].buffers.push({ location: location });
                filteredSummary[lane].total += 1; // Incrementa il totale per la lane
                totalContainers += 1; // Incrementa il totale complessivo
            }
        });

        const sortedSummary = {};
        Object.keys(filteredSummary).forEach(lane => {
            const laneSummary = filteredSummary[lane];
            sortedSummary[lane] = laneSummary;
        });

        if (isVisible) {
            displayTable(sortedSummary, totalContainers);
        }
    }

    // Funzione per formattare la data CPT in UTC +1
    function formatDateCPT(cpt) {
        if (cpt === 'N/A') {
            return 'N/A';
        }

        // Assumiamo che cpt sia in formato stringa ISO (e.g. '2024-12-06T15:30:00Z')
        const date = new Date(cpt);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Rome',  // Impostiamo il fuso orario su UTC +1
            hour12: false
        };

        return new Intl.DateTimeFormat('it-IT', options).format(date);
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
    function displayTable(sortedSummary, totalContainers) {
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
                    <input id="laneFilterInput" type="text" placeholder="Filtro per LANE (es. LANE1, LANE2)" style="width: 100%; padding: 5px; box-sizing: border-box;">
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
                <td colspan="3" style="font-weight: bold; text-align: left;">${lane} (Totale: ${laneSummary.total} containers)</td>
            </tr>`);

            tbody.append(laneRow);

            laneSummary.buffers.forEach(buffer => {
                const bufferRow = $(`<tr class="bufferRow">
                    <td></td>
                    <td>${laneSummary.cpt}</td>
                    <td>${buffer.location}</td>
                </tr>`);
                tbody.append(bufferRow);
            });
        });

        tbody.append(`
            <tr>
                <td colspan="3" style="font-weight: bold; text-align: right;">Totale complessivo: ${totalContainers} containers</td>
            </tr>
        `);

        table.append(thead).append(tbody);
        contentContainer.append(table);
        $('body').append(contentContainer);

        setupFilters();
    }

    // Funzione per attivare i filtri al tasto "Enter"
    function setupFilters() {
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

        $('#cptFilterInput').val(selectedCptFilter).on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedCptFilter = $(this).val();
                fetchBufferSummary();
            }
        });
    }

    // Aggiungi il pulsante per mostrare/nascondere i recuperi
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

    // Aggiorna i dati ogni 3 minuti
    setInterval(fetchBufferSummary, 180000); // 180,000 ms = 3 minuti
})();
