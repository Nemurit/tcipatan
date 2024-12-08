(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
    let isVisible = false;
    let isChartVisible = false;
    let filteredSummary = {}; // Store filtered summary globally

    // Recupera la mappa di stacking
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

    // Recupera i dati dei buffer dall'API
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

    // Elabora e visualizza i container
    function processAndDisplay(containers) {
        const summary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || null;
            const contentCount = container.contentCount || 0;

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(filter => lane.toUpperCase().includes(filter.toUpperCase()))) &&
                (selectedCptFilter === '' || (cpt && filterCpt(cpt, selectedCptFilter)))
            ) {
                if (!summary[lane]) {
                    summary[lane] = {};
                }
                if (!summary[lane][location]) {
                    summary[lane][location] = { count: 0, contentCountTotal: 0, cpt: cpt };
                }

                summary[lane][location].count++;
                summary[lane][location].contentCountTotal += contentCount;
            }
        });

        filteredSummary = summary;
        if (isVisible) displayTable(summary);
        if (isChartVisible) generatePieChart(summary);
    }

    // Visualizza la tabella
    function displayTable(summary) {
        $('#contentContainer').remove();

        const container = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; background: white; border: 1px solid #ddd; max-height: 90vh; overflow-y: auto;"></div>');
        const table = $('<table style="width: 100%; border-collapse: collapse;"></table>');
        const thead = $('<thead><tr><th>Buffer</th><th>Containers</th><th>Content Count</th><th>CPT</th></tr></thead>');
        const tbody = $('<tbody></tbody>');

        Object.entries(summary).forEach(([lane, locations]) => {
            tbody.append(`<tr style="background: #f4f4f4;"><td colspan="4">Lane: ${lane}</td></tr>`);
            Object.entries(locations).forEach(([location, data]) => {
                tbody.append(`
                    <tr>
                        <td>${location}</td>
                        <td>${data.count}</td>
                        <td>${data.contentCountTotal}</td>
                        <td>${data.cpt ? convertTimestampToLocalTime(data.cpt) : 'N/A'}</td>
                    </tr>
                `);
            });
        });

        table.append(thead).append(tbody);
        container.append(table);
        $('body').append(container);
    }

    // Genera il grafico a torta
    function generatePieChart(summary) {
        const bufferCounts = {};

        Object.entries(summary).forEach(([lane, locations]) => {
            Object.entries(locations).forEach(([location, data]) => {
                bufferCounts[location] = (bufferCounts[location] || 0) + data.count;
            });
        });

        const labels = Object.keys(bufferCounts);
        const data = labels.map(location => bufferCounts[location]);

        let chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.id = 'chartContainer';
            chartContainer.style.cssText = `
                position: fixed; top: 50px; left: 50%; transform: translateX(-50%);
                background: white; padding: 10px; border: 1px solid #ddd;
            `;
            const canvas = document.createElement('canvas');
            canvas.id = 'chartCanvas';
            chartContainer.appendChild(canvas);
            document.body.appendChild(chartContainer);
        }

        const ctx = document.getElementById('chartCanvas').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00', '#0000ff', '#8a2be2'],
                }]
            }
        });
    }

    // Altri helper
    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/);
        if (match) {
            return match[0] === filter;
        }
        return false;
    }

    function convertTimestampToLocalTime(timestamp) {
        return new Date(timestamp).toLocaleString('it-IT', {
            hour: '2-digit', minute: '2-digit', hour12: false,
            day: '2-digit', month: '2-digit', year: '2-digit'
        });
    }

    // Pulsante per mostrare/nascondere la tabella dei recuperi
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

    // Pulsante per mostrare/nascondere il grafico
    function addChartToggleButton() {
        const chartButton = $('<button id="toggleChartButton" style="position: fixed; top: 35px; left: calc(50% - 22px); padding: 10px; background: rgb(0, 123, 255); color: white; border: none; cursor: pointer; border-radius: 5px; font-size: 14px;">Mostra Grafico</button>');
        
        chartButton.on('click', function() {
            const chartContainer = document.getElementById('chartContainer');
            if (chartContainer.style.display === 'none') {
                chartContainer.style.display = 'block';
                generatePieChart(filteredSummary);
                $(this).text('Nascondi Grafico');
            } else {
                chartContainer.style.display = 'none';
                $(this).text('Mostra Grafico');
            }
        });

        $('body').append(chartButton);
    }

    fetchStackingFilterMap(() => {
        addToggleButton();
        addChartToggleButton();
        fetchBufferSummary();
    });

    // Aggiorna i dati ogni 3 minuti
    setInterval(fetchBufferSummary, 180000);

})();
