// ==UserScript==
// @name         Yard Overview
// @namespace    https://example.com/
// @version      1.0
// @description  Recupera i dati dalla pagina YMS e li visualizza in una tabella
// @author       Tuo Nome
// @match        https://www.amazonlogistics.eu/yms/shipclerk/#/yard
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let isVisible = false;

    function fetchYardData() {
        const apiUrl = `https://www.amazonlogistics.eu/sortcenter/vista/controller/getContainersDetailByCriteria`; // Adatta se necessario
        const payload = {
            entity: "getYardDetailsByCriteria", // Nome entità specifico per l'endpoint
            filterBy: {
                state: ["In Yard"], // Specifica i criteri, personalizzali se necessario
            },
        };

        GM_xmlhttpRequest({
            method: "GET",
            url: `${apiUrl}?${new URLSearchParams({ jsonObj: JSON.stringify(payload) })}`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getYardDetailsByCriteriaOutput) {
                        const yardDetails = data.ret.getYardDetailsByCriteriaOutput.yardDetails;
                        processAndDisplay(yardDetails);
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

    function processAndDisplay(yardDetails) {
        if (!isVisible) return;

        $('#yardTable').remove();

        if (!yardDetails || yardDetails.length === 0) {
            console.warn("Nessun dettaglio da visualizzare.");
            return;
        }

        const table = $('<table id="yardTable" class="performance"></table>');
        table.append('<thead><tr><th>Location</th><th>Vehicle</th><th>Load Identifier(s)</th><th>Notes</th></tr></thead>');

        const tbody = $('<tbody></tbody>');

        yardDetails.forEach(detail => {
            const row = $('<tr></tr>');

            row.append(`<td>${detail.location || 'N/A'}</td>`);
            row.append(`<td>${detail.vehicle || 'N/A'}</td>`);
            row.append(`<td>${(detail.loadIdentifiers || []).join(', ') || 'N/A'}</td>`);
            row.append(`<td>${detail.notes || 'N/A'}</td>`);

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
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 500px; right: 10px; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Dati Yard</button>');

        toggleButton.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchYardData();
                $(this).text("Nascondi Dati Yard");
            } else {
                $('#yardTable').remove();
                $(this).text("Mostra Dati Yard");
            }
        });

        $('body').append(toggleButton);
    }

    // Aggiunge il pulsante per attivare/disattivare la tabella
    addToggleButton();

})();
