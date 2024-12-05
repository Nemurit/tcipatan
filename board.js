(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    const bufferJsonUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/buffer.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let bufferMacroAreas = {};
    let isVisible = false;

    // Carica la mappa dei buffer e la mappa delle macro aree
    function fetchBufferData(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: bufferJsonUrl,
            onload: function(response) {
                try {
                    bufferMacroAreas = JSON.parse(response.responseText);
                    console.log("Macro aree buffer caricate:", bufferMacroAreas);
                    if (callback) callback();
                } catch (error) {
                    console.error("Errore nel parsing del file buffer.json:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nel caricamento del file buffer.json:", error);
            }
        });
    }

    // Funzione per caricare la mappa dei filtri di stacking
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

    // Funzione per ottenere i dati dei contenitori
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

    // Funzione per processare e visualizzare i dati
    function processAndDisplay(containers) {
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';

            // Filtra solo i buffer
            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
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

        const macroAreaData = {};

        // Mappiamo i buffer nelle macro aree
        Object.entries(filteredSummary).forEach(([lane, laneSummary]) => {
            Object.entries(laneSummary).forEach(([location, data]) => {
                const macroArea = getMacroAreaForBuffer(location);
                if (macroArea) {
                    if (!macroAreaData[macroArea]) {
                        macroAreaData[macroArea] = 0;
                    }
                    macroAreaData[macroArea] += data.count;
                }
            });
        });

        // Ora possiamo visualizzare il grafico
        displayChart(macroAreaData);
    }

    // Funzione per ottenere la macro area del buffer
    function getMacroAreaForBuffer(location) {
        for (const [macroArea, buffers] of Object.entries(bufferMacroAreas)) {
            if (buffers.includes(location)) {
                return macroArea;
            }
        }
        return null; // Se non troviamo la macro area, restituiamo null
    }

    // Funzione per visualizzare il grafico a torta
    function displayChart(macroAreaData) {
        const ctx = document.getElementById('chartContainer').getContext('2d');
        const data = {
            labels: Object.keys(macroAreaData),
            datasets: [{
                label: 'Numero di Container per Macro Area',
                data: Object.values(macroAreaData),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#F7464A'],
                hoverBackgroundColor: ['#FF4384', '#36A2EB', '#FFCE56', '#4BC0C0', '#F7464A']
            }]
        };

        new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                return `${tooltipItem.label}: ${tooltipItem.raw} container(s)`;
                            }
                        }
                    }
                }
            });
    }

    // Aggiungi il contenitore per il grafico
    function addChartContainer() {
        const chartContainer = $('<div id="chartContainer" style="position: fixed; top: 100px; right: 10px; width: 300px; height: 300px; background: white; padding: 10px; border: 1px solid #ddd;"></div>');
        chartContainer.append('<canvas id="chartCanvas" width="300" height="300"></canvas>');
        $('body').append(chartContainer);
    }

    // Funzione per aggiungere il pulsante per attivare i recuperi
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

    // Inizializzazione
    fetchBufferData(function() {
        fetchStackingFilterMap(function() {
            addToggleButton();
            addChartContainer();
            fetchBufferSummary();
        });
    });

    // Aggiorna i dati ogni 5 minuti
    setInterval(fetchBufferSummary, 5 * 60 * 1000);
})();
