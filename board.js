(function () {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    const bufferJsonUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/buffer.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let bufferMacroAreas = {};
    let isVisible = false;

    // Funzione per caricare le macro aree
    function fetchBufferData(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: bufferJsonUrl,
            onload: function (response) {
                try {
                    bufferMacroAreas = JSON.parse(response.responseText);
                    console.log("Macro aree buffer caricate:", bufferMacroAreas);
                    if (callback) callback();
                } catch (error) {
                    console.error("Errore nel parsing del file buffer.json:", error);
                }
            },
            onerror: function (error) {
                console.error("Errore nel caricamento del file buffer.json:", error);
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
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails[0].containerDetails;
                        console.log("Dati ricevuti dai contenitori:", containers);
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

    // Processa i dati e genera la tabella e il grafico
    function processAndDisplay(containers) {
        const filteredSummary = {};

        try {
            containers.forEach(container => {
                const location = container.location || '';
                const stackingFilter = container.stackingFilter || 'N/A';
                const lane = stackingToLaneMap[stackingFilter] || 'N/A';

                if (location.toUpperCase().startsWith("BUFFER")) {
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

            console.log("Dati per macroaree:", macroAreaData);

            if (isVisible) {
                displayChart(macroAreaData);
            }
        } catch (error) {
            console.error("Errore durante il processamento dei dati:", error);
        }
    }

    // Mostra il grafico
    function displayChart(macroAreaData) {
        try {
            const canvas = document.getElementById('chartCanvas');
            if (!canvas) {
                console.error("Canvas per il grafico non trovato!");
                return;
            }

            const ctx = canvas.getContext('2d');
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
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Errore durante la creazione del grafico:", error);
        }
    }

    // Inizializza il sistema
    function init() {
        fetchBufferData(function () {
            fetchBufferSummary();
        });
    }

    init();

})();
