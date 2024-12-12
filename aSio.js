
Tampermonkey® by Jan Biniok
v5.3.2
	
<Nuovo script>

699

                console.error("Richiesta fallita:", error);

700

            },

701

        });

702

    }

703

​

704

    function processFetchedData(apiData, hours) {

705

    const now = new Date();

706

    const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

707

​

708

    allRows = apiData.map(item => {

709

        const load = item.load || {};

710

        let truckType = "A"; // Default è "TUTTI"

711

        

712

        // Controllo se la lane è un TRANSSHIPMENT

713

       if (load.shippingPurposeType === "TRANSSHIPMENT" || 

714

    load.shippingPurposeType.startsWith("Transfer") || 

715

    load.shippingPurposeType.startsWith("Transfers")) {

716

    truckType = "TRANSFER"; // Imposta il truckType a TRANSFER

717

} else if (load.shippingPurposeType.startsWith("ATSWarehouseTransfers")) {

718

    truckType = "TSO"; // Imposta il truckType a TSO per ATSWarehouseTransfers

719

        }

720

        // Se la condizione del "TRANSFER" non è soddisfatta, verifica se è "CPT"

721

        else if (load.scheduledDepartureTime === load.criticalPullTime) {

722

            truckType = "CPT";

723

        }

724

​

725

        return {

726

            lane: load.route || "N/A",

727

            sdt: load.scheduledDepartureTime || "N/A",

728

            cpt: load.criticalPullTime || "N/A",

729

            vrId: load.vrId || "N/A",

730

            date: new Date(load.scheduledDepartureTime),

731

            extraText: truckType,

732

            highlightColor: truckType === "TRANSFER" ? "violet" : truckType === "CPT" ? "green" : truckType === "TSO" ? "blue" : "orange",

733

        };

734

    });

735

​

736

    // Ordina i dati per SDT (Scheduled Departure Time)

737

    allRows.sort((a, b) => a.date - b.date);

738

​

739

    filterAndShowData(hours);

740

}

741

​

742

​

743

    function filterAndShowData(hours) {

744

        const now = new Date();

745

        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

746

​

747

        // Ottieni i filtri

748

        const status = dropdown ? dropdown.value : 'TUTTI';

749

        const vrIdFilter = vrIdInputBox.value.trim().toLowerCase();

750

        const laneFilter = laneInputBox ? laneInputBox.value.trim().toLowerCase() : '';

751

​

752

        // Filtra prima tutti i dati, indipendentemente dalla finestra temporale

753

        let filteredRows = allRows;

754

​

755

        if (vrIdFilter) {

756

            filteredRows = filteredRows.filter(row => row.vrId.toLowerCase().includes(vrIdFilter));

757

        }

758

​

Cerca: .* Aa
