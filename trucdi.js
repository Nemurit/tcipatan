(function () {
    'use strict';

    const url = "https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ob/fetchdata?";
    const entityName = "getDefaultOutboundDockView";
    const payload = `entity=${entityName}&nodeId=MXP6&startDate=1733700600000&endDate=1733873400000&loadCategories=outboundScheduled,outboundInProgress,outboundReadyToDepart,outboundDeparted,outboundCancelled`;

    let allRows = [];
    let tableContainer = null;
    let dropdown = null;
    let timeInputBox = null;
    let vrIdInputBox = null;
    let laneInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let filtersContainer = null;
    let isDataFetched = false;
    let isTableVisible = false;

    // Funzione per recuperare i dati
    function fetchData(hours) {
        GM_xmlhttpRequest({
            method: "POST",
            url: url,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ob",
                "Cookie": document.cookie
            },
            data: payload,
            onload: function (response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.ret && Array.isArray(data.ret.aaData)) {
                            processFetchedData(data.ret.aaData, hours);
                        } else {
                            console.error("La risposta dell'API non contiene 'ret' o 'aaData'.");
                        }
                    } catch (error) {
                        console.error("Errore nel parsing dei dati:", error);
                    }
                } else {
                    console.error("Errore nella richiesta:", response.status, response.statusText);
                }
            },
            onerror: function (error) {
                console.error("Richiesta fallita:", error);
            },
        });
    }

    function processFetchedData(apiData, hours) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        allRows = apiData.map(item => {
            const load = item.load || {};

            // Verifica il formato della lane
            const isLaneValid = load.route && /^MXP6->\w{4}$/.test(load.route);

            // Determina il tipo di truck
            const truckType = isLaneValid
                ? (load.scheduledDepartureTime === load.criticalPullTime ? "CPT" : "TRANSFER")
                : "COLLECTION";

            return {
                lane: load.route || "N/A",
                sdt: load.scheduledDepartureTime || "N/A",
                cpt: load.criticalPullTime || "N/A",
                vrId: load.vrId || "N/A",
                date: new Date(load.scheduledDepartureTime),
                extraText: truckType,
                highlightColor: truckType === "TRANSFER" ? "violet" : truckType === "CPT" ? "green" : "orange",
            };
        });

        // Ordina i dati per SDT (Scheduled Departure Time)
        allRows.sort((a, b) => a.date - b.date);

        filterAndShowData(hours);
    }

    function filterAndShowData(hours) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const status = dropdown ? dropdown.value : 'Tutti';
        const vrIdFilter = vrIdInputBox.value.trim().toLowerCase();
        const laneFilter = laneInputBox ? laneInputBox.value.trim().toLowerCase() : '';

        let filteredRows = allRows;

        if (vrIdFilter) {
            filteredRows = filteredRows.filter(row => row.vrId.toLowerCase().includes(vrIdFilter));
        }

        if (status !== 'Tutti') {
            filteredRows = filteredRows.filter(row => row.extraText === status);
        }

        if (laneFilter) {
            filteredRows = filteredRows.filter(row => row.lane.toLowerCase().includes(laneFilter));
        }

        if (!vrIdFilter && !laneFilter) {
            filteredRows = filteredRows.filter(row => row.date >= now && row.date <= maxDate);
        }

        showDataInTable(filteredRows);
        updateRowCount(filteredRows.length);
    }

    function showDataInTable(filteredRows) {
        if (tableContainer) {
            tableContainer.remove();
        }

        tableContainer = document.createElement('div');
        tableContainer.style.position = 'fixed';
        tableContainer.style.top = '90px';
        tableContainer.style.left = '10px';
        tableContainer.style.zIndex = '10001';
        tableContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        tableContainer.style.padding = '15px';
        tableContainer.style.maxHeight = '400px';
        tableContainer.style.overflowY = 'scroll';
        tableContainer.style.width = '25%';
        tableContainer.style.border = '1px solid #ccc';
        tableContainer.style.borderRadius = '5px';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'Arial, sans-serif';
        table.style.fontSize = '14px';
        table.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        table.innerHTML = `
            <thead style="background-color: #f4f4f4; border-bottom: 2px solid #ccc;">
                <tr>
                    <th style="padding: 10px; text-align: left;">LANE</th>
                    <th style="padding: 10px; text-align: left;">SDT</th>
                    <th style="padding: 10px; text-align: left;">CPT</th>
                    <th style="padding: 10px; text-align: left;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRows.map(row => `
                    <tr style="background-color: ${row.highlightColor}; color: white; text-align: left;">
                        <td style="padding: 10px;">${row.lane}</td>
                        <td style="padding: 10px;">${row.sdt}</td>
                        <td style="padding: 10px;">${row.cpt}</td>
                        <td style="padding: 10px;">${row.extraText}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    function updateRowCount(count) {
        if (!rowCountDisplay) return;
        rowCountDisplay.innerHTML = `NUMERO TRUCKS: ${count}`;
    }

    function createButtons() {
        const containermain = document.createElement('div');
        containermain.style.position = 'fixed';
        containermain.style.top = '10px';
        containermain.style.left = '10px';
        containermain.style.zIndex = '10001';
        containermain.style.padding = '10px';
        containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        containermain.style.borderRadius = '5px';
        containermain.style.display = 'flex';
        containermain.style.flexDirection = 'row';

        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '3px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', function () {
            const hours = timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1;

            if (isTableVisible) {
                tableContainer.style.display = 'none';
                filtersContainer.style.display = 'none';
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                filtersContainer.style.display = 'block';

                if (!isDataFetched) {
                    fetchData(hours);
                    isDataFetched = true;
                }

                button.innerHTML = 'Nascondi TRUCKS';
                tableContainer.style.display = 'block';
                filtersContainer.style.display = 'block';
                isTableVisible = true;
            }
        });

        filtersContainer = document.createElement('div');
        filtersContainer.style.display = 'none';
        filtersContainer.style.marginTop = '10px';

        dropdown = document.createElement('select');
        dropdown.style.marginRight = '5px';
        dropdown.style.padding = '3px';
        ['Tutti', 'CPT', 'COLLECTION', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });
        dropdown.addEventListener('change', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.padding = '3px';
        timeInputBox.style.marginRight = '5px';
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtro VR ID';
        vrIdInputBox.style.padding = '3px';
        vrIdInputBox.style.marginRight = '5px';
        vrIdInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        laneInputBox = document.createElement('input');
        laneInputBox.type = 'text';
        laneInputBox.placeholder = 'Filtro Lane';
        laneInputBox.style.padding = '3px';
        laneInputBox.style.marginRight = '5px';
        laneInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.padding = '3px';
        printButton.style.marginRight = '5px';
        printButton.addEventListener('click', function () {
            if (tableContainer) {
                const printWindow = window.open('', '_blank');
                const printDocument = printWindow.document;
                printDocument.open();
                printDocument.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Stampa Tabella</title>
                        <style>
                            table {
                                width: 100%;
                                border-collapse = collapse;
                                margin-bottom: 20px;
                                font-family: Arial, sans-serif;
                            }
                        </style>
                    </head>
                    <body>
                        ${tableContainer.innerHTML}
                    </body>
                    </html>
                `);
                printDocument.close();
                printWindow.print();
            } else {
                alert('Nessuna tabella disponibile per la stampa.');
            }
        });

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.marginLeft = '5px';

        filtersContainer.appendChild(dropdown);
        filtersContainer.appendChild(timeInputBox);
        filtersContainer.appendChild(vrIdInputBox);
        filtersContainer.appendChild(laneInputBox);
        filtersContainer.appendChild(printButton);
        filtersContainer.appendChild(rowCountDisplay);

        containermain.appendChild(button);
        containermain.appendChild(filtersContainer);
        document.body.appendChild(containermain);
    }

    setInterval(function() {
        if (isDataFetched) {
            fetchData(1);
        }
    }, 300000);

    createButtons();
})();
