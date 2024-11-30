(function () {
    'use strict';

    let isVisible = false;

    function fetchYardVehicles() {
        const apiUrl = `https://www.amazonlogistics.eu/yms/shipclerk/#/yard?yardAssetStatus=FULL`;

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data && data.yardAssets) {
                        const yardAssets = data.yardAssets;
                        processAndDisplay(yardAssets);
                    } else {
                        console.warn("Nessun dato trovato nella risposta API.");
                    }
                } catch (error) {
                    console.error("Errore nella risposta API:", error);
                }
            },
            onerror: function (error) {
                console.error("Errore nella chiamata API:", error);
            },
        });
    }

    function processAndDisplay(yardAssets) {
        if (!isVisible) return;

        $('#yardTable').remove();

        if (!yardAssets || yardAssets.length === 0) {
            console.warn("Nessun veicolo da visualizzare.");
            return;
        }

        const table = $('<table id="yardTable" class="performance"></table>');
        table.append('<thead><tr><th>Location</th><th>Vehicle</th><th>Load Identifier(s)</th><th>Notes</th></tr></thead>');

        const tbody = $('<tbody></tbody>');

        yardAssets.forEach(asset => {
            const row = $('<tr></tr>');

            row.append(`<td>${asset.location || 'N/A'}</td>`);
            row.append(`<td>${asset.vehicle || 'N/A'}</td>`);
            row.append(`<td>${(asset.loadIdentifiers || []).join(', ') || 'N/A'}</td>`);
            row.append(`<td>${asset.notes || 'N/A'}</td>`);

            tbody.append(row);
        });

        table.append(tbody);
        $('body').append(table);

        GM_addStyle(`
            #yardTable {
                width: 80%;
                margin: 20px auto;
                border-collapse: collapse;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            #yardTable th, #yardTable td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            #yardTable th {
                background-color: #f4f4f4;
                font-weight: bold;
            }
            #yardTable tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            #yardTable tr:hover {
                background-color: #f1f1f1;
            }
        `);
    }

    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 550px; left: 10px; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Dati Veicoli</button>');

        toggleButton.on('click', function () {
            isVisible = !isVisible;
            if (isVisible) {
                fetchYardVehicles();
                $(this).text("Nascondi Dati Veicoli");
            } else {
                $('#yardTable').remove();
                $(this).text("Mostra Dati Veicoli");
            }
        });

        $('body').append(toggleButton);
    }

    // Aggiunge il pulsante per attivare/disattivare la tabella
    addToggleButton();
})();
