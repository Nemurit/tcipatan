(function () {
    'use strict';

    // Cambia il titolo della pagina
    document.title = "CLERK HANDOVER";

    let allRows = [];
    let tableContainer = null;

    // Crea i pulsanti e li posiziona sulla pagina
    function createButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '10px';
        buttonContainer.style.left = '10px';
        buttonContainer.style.zIndex = '10001';
        buttonContainer.style.display = 'flex';

        // Pulsante "Visualizza TRUCKS"
        const trucksButton = document.createElement('button');
        trucksButton.innerHTML = 'Visualizza TRUCKS';
        trucksButton.style.padding = '8px';
        trucksButton.style.backgroundColor = '#4CAF50';
        trucksButton.style.color = 'white';
        trucksButton.style.border = 'none';
        trucksButton.style.borderRadius = '5px';
        trucksButton.style.marginRight = '10px';
        trucksButton.addEventListener('click', function () {
            console.log('Pulsante Visualizza TRUCKS cliccato.');
            loadIframeAndExtractData();
        });

        // Pulsante "Visualizza Recuperi"
        const recoveriesButton = document.createElement('button');
        recoveriesButton.innerHTML = 'Visualizza Recuperi';
        recoveriesButton.style.padding = '8px';
        recoveriesButton.style.backgroundColor = '#007bff';
        recoveriesButton.style.color = 'white';
        recoveriesButton.style.border = 'none';
        recoveriesButton.style.borderRadius = '5px';
        recoveriesButton.addEventListener('click', function () {
            console.log('Pulsante Visualizza Recuperi cliccato.');
            alert('Funzionalità Recuperi in fase di implementazione.');
        });

        // Aggiungi i pulsanti al contenitore
        buttonContainer.appendChild(trucksButton);
        buttonContainer.appendChild(recoveriesButton);

        // Aggiungi il contenitore al corpo della pagina
        document.body.appendChild(buttonContainer);
    }

    // Funzione per creare un iframe e caricarlo
    function loadIframeAndExtractData() {
        let iframe = document.getElementById('pageIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pageIframe';
            iframe.style.display = 'none'; // Nascondi iframe per ora
            iframe.src = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?'; // URL dell'iframe
            document.body.appendChild(iframe);
        }

        iframe.onload = function () {
            console.log('Iframe caricato.');
            // Controlla se è possibile accedere ai dati
            try {
                const iframeDoc = iframe.contentWindow.document;
                if (!iframeDoc) {
                    console.error('Impossibile accedere al documento dell\'iframe.');
                    return;
                }
                console.log('Documento dell\'iframe accessibile.');
                // Qui puoi continuare con l'estrazione dati.
            } catch (error) {
                console.error('Errore nell\'accesso all\'iframe:', error);
            }
        };
    }

    // Inizializza i pulsanti
    createButtons();
})();
