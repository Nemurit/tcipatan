// ==UserScript==
// @name         VSM
// @namespace    MXP6
// @version      1.0
// @description  Adds VSM in ssp table
// @author       tcipatan
// @match        https://trans-logistics-eu.amazon.com/ssp/dock/*
// @match        https://www.amazonlogistics.eu/ssp/dock/*
// @require      http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.5/xlsx.full.min.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/vsm.js
// @downloadURL  https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/vsm.js
// ==/UserScript==


(function() {
    'use strict';

    // Funzione che cambia il nome della colonna e la rende visibile
    function changeColumn() {
        const thElement = document.querySelector('table#tblContainers th.sdtColumn.hidden');

        if (thElement) {
            // Rimuovi la classe 'hidden' per renderla visibile
            thElement.classList.remove('hidden');

            // Cambia il nome della colonna in "VSM"
            thElement.textContent = 'VSM';
        }
    }

    // Mappatura manuale (puoi aggiungere tutte le righe necessarie)
    const mapping = {
        "LH-LYS8-MIX-ALL":	"LY01",
"AMZL-DVN3-ND-F-VCRI":	"AVN3",
"LH-LIN8-AMZL-DVN1-XD-F-VCRI":	"LI04",
"LH-LYS8-AMZL-DBW1-BAG":	"LY97",
"CC-POIT-VENETO37-H2":	"PO37",
"LH-MUC7-AMZL-DBY3-XD":	"MUC3",
"LH-CGN9-MIX-MERGE":	"CGN1",
"DMXP6_TOTO01391_ALESSAN_ALL":	"LSN1",
"LH-MRS9-AMZL-DAR9-XD":	"MR09",
"CC-POIT-TRENTI71-H2-ALL":	"PO71",
"AMZL-DER3-ND-MERGE":	"AER3",
"DMXP6_TOTO23373_CUNEO_RE-F-VCRI":	"CNR1",
"DMXP6_GEGE50121_SANREMOR":	"SAN1",
"LH-FCO9-AMZL-ORE2-BAG":	"FC95",
"AIR-MXPA-EBLG-2-DHH2-BAG":	"EB51",
"AMZL-DPI3-ND-XPT-ALL":	"XPI3",
"LH-MUC7-AMZL-DBY3-XD-F-VCRI":	"MUC3",
"AMZL-DER3-ND-ALL":	"AER3",
"LH-MRS9-CC-LP-XD-F-VCRI":	"MR07",
"AMZL-DLO4-ND":	"ALO4",
"LH-MRS9-BCN8-XD-ALL":	"MR18",
"CC-NXV-VENETO-H2-F-VCRI":	"NVN1",
"CC-POIT-UMBTOS12-H2-F-VCRI":	"PO12",
"LH-HHN9-AMZL-DNW4-XD-ALL":	"HH40",
"AMZL-DLO2-ND-F-VCRI":	"ALO2",
"CC-POIT-SARDEG1-H2-F-VCRI":	"POS1",
"LH-LYS8-AMZL-DNM1-XD-F-VCRI":	"LY05",
"AIR-MXPA-HAJA-MHG9-XD":	"HA04",
"LH-MXP8-AMZL-DVI1-XD":	"MX02",
"LH-BLQ8-AMZL-DRU1-XD":	"BQ07",
"LH-MRS9-BCN8-XD":	"MR18",
"LH-LIN8-MIX-MERGE":	"LI01",
"LH-CDG8-MIX-ALL":	"CD01",
"LH-LIN8-AMZL-DFV2-XD":	"LI09",
"LH-LYS8-AMZL-DMU1-BAG":	"LY92",
"CC-POIT-SARSIC50-H2-ALL":	"PO50",
"AMZL-DNP1-ND":	"DNP1",
"AMZL-DNP1-ND":	"NPI1",
"CC-POIT-UMBTOS39-H2-ALL":	"PO39",
"AMZL-DTT1-ND-ALL":	"ATT1",
"LH-CDG8-AMZL-DWV9-XD-ALL":	"CD02",
"LH-LYS8-MIX-MERGE":	"LY01",
"LH-MUC7-AMZL-DRP4-XD":	"MUC4",
"CC-NXV-FRIULI-H2-ALL":	"NFR1",
"CC-DHLX-INTL-H1-F-VCRI":	"DH01",
"AMZL-DNP1-ND-ALL":	"DNP1",
"AIR-MXPA-LEBL-DCT4-BAG":	"LB99",
"LH-MRS9-AMZL-DLP5-XD":	"MR12",
"AMZL-DLG1-SD-ALL":	"SLG1",
"AMZL-DLO2-SD":	"SLO2",
"CC-UPS-INTL-H1-F-VCRI":	"UP01",
"LH-MRS9-AMZL-DWP1-XPT-XD":	"MR06",
"CC-POIT-CALABR10-H2-ALL":	"PO10",
"DMXP6_MRMR20417_MENAGGI-F-VCRI":	"POM1",
"LH-CDG8-AMZL-DNC1-BAG":	"CD97",
"LH-LIN8-AMZL-DLZ3-BAG":	"LI90",
"CC-POIT-TOSCAN4-H2-F-VCRI":	"POT4",
"AMZL-DVN1-ND-F-VCRI":	"AVN1",
"AMZL-DLZ3-ND-F-VCRI":	"DLZ3",
"AIR-MXPA-HAJA-BER8-XD-ALL":	"HA03",
"LH-MRS9-CC-LP-XD-ALL":	"MR07",
"CC-POIT-LOMVEN72-H2-ALL":	"PO72",
"LH-LYS8-DTM9-XD":	"LY07",
"AMZL-DLG1-SD":	"SLG1",
"AMZL-DTC2-ND-F-VCRI":	"ATC2",
"CC-POIT-LAZIO29-H2-F-VCRI":	"PO29",
"AMZL-DNP1-ND-F-VCRI":	"DNP1",
"AMZL-DNP1-ND-F-VCRI":	"NPI1",
"LH-LYS8-AMZL-DBF1-XD-F-VCRI":	"LY03",
"CC-NXV-EMILIA-H2-ALL":	"NEM1",
"LH-BLQ8-AMZL-DPU1-XPT-XD-ALL":	"BQ06",
"AIR-MXPA-HAJA-NUE9-XD-F-VCRI":	"HA02",
"LH-MRS9-AMZL-DGA1-BAG":	"MR91",
"AIR-MXPA-HAJA-DNX5-BAG":	"HA78",
"LH-CDG8-AMZL-DWV9-XD":	"CD02",
"AMZL-DLZ3-ND-ALL":	"DLZ3",
"LH-LIN8-AMZL-DFV1-XD-ALL":	"LI10",
"LH-MRS9-PXD-AMZL-DLP5-XD":	"MR15",
"LH-MXP8-AMZL-DVI1-XD-ALL":	"MX02",
"AMZL-DLO4-ND-F-VCRI":	"ALO4",
"CC-POIT-PIEMON8-H2-F-VCRI":	"POP8",
"AMZL-DLO7-ND-XPT":	"XLO7",
"AIR-MXPA-LEBL-BCN8-XD-F-VCRI":	"LEB8",
"LH-BLQ8-AMZL-DUM1-XD-ALL":	"BQ08",
"CC-POIT-LIGURI17-H2":	"PO17",
"AIR-MXPA-EBLG-DNX2-BAG":	"EB90",
"CC-NXV-TOSCANA-H2-ALL":	"NTS1",
"LH-MXP8-AMZL-DVI3-XD-F-VCRI":	"MX03",
"AMZL-DPI3-ND-F-VCRI":	"API3",
"LH-MRS9-AMZL-DAC9-XD-F-VCRI":	"MR19",
"CC-POIT-TOSCAN13-H2":	"PO13",
"AIR-MXPA-EBLG-DHE6-BAG":	"EB98",
"LH-LP-ALPES-H2-F-VCRI":	"ALP2",
"AMZL-DLO5-ND-MERGE":	"ALO5",
"AMZL-DFV1-ND-MERGE":	"AFV1",
"LH-MUC7-MHG9-XD-ALL":	"MUC7",
"CC-POIT-UMBTOS39-H2":	"PO39",
"LH-CDG8-AMZL-DIF4-XD-ALL":	"CD04",
"AIR-MXPA-LEBL-DMA3-BAG":	"LB93",
"CC-POIT-BIBBIENA-DDU-XD-ALL":	"POB1",
"AMZL-DLO5-ND-ALL":	"ALO5",
"AMZL-DFV2-ND-MR":	"MFV2",
"AMZL-DPI2-ND-ALL":	"API2",
"AMZL-DWP1-ND-ALL":	"DWP1",
"CC-POIT-EMILIA19-H2":	"PO19",
"AMZL-DLO3-ND":	"ALO3",
"LH-LIN8-AMZL-DVN5-XD-F-VCRI":	"LI15",
"DMXP6_TOTO63574_RECTAZZO":	"RTZ1",
"AMZL-DLO2-ND-ALL":	"ALO2",
"LH-MRS9-CDG8-XD-ALL":	"MR08",
"LH-LYS8-AMZL-DHH2-XD":	"LY04",
"LH-ORY8-MIX":	"ORY1",
"AMZL-DLG1-ND-XPT":	"XLG1",
"LH-LYS8-LPCL-XD":	"LY08",
"AMZL-DER3-ND-XPT-F-VCRI":	"XER3",
"DMXP6_TOTO01391_ALESSAN":	"LSN1",
"LH-MRS9-AMZL-DLP5-XD-ALL":	"MR12",
"LH-MRS9-AMZL-DLP4-XD-ALL":	"MR04",
"AMZL-DVN1-ND-MERGE":	"AVN1",
"LH-MRS9-AMZL-DLP4-XD":	"MR04",
"AMZL-DLO1-SD":	"SLO1",
"LH-MRS9-MIX":	"MR01",
"LH-BLQ8-AMZL-DMR1-XD-F-VCRI":	"BQ03",
"CC-POIT-LAZIO3-H2-ALL":	"POL3",
"CC-DHLX-INTL-H1-ALL":	"DH01",
"LH-LIN8-AMZL-DTC2-XD":	"LI06",
"AMZL-DWP1-ND-F-VCRI":	"DWP1",
"LH-FCO9-MIX-ALL":	"FC01",
"LH-MRS9-AMZL-DAC2-BAG":	"MR89",
"LH-MUC7-AMZL-DMU2-XD-ALL":	"MUC2",
"LH-LYS8-ORY8-XD-F-VCRI":	"LY02",
"LH-LYS8-AMZL-DBF1-XD":	"LY03",
"LH-BLQ8-AMZL-DPU1-XPT-XD":	"BQ06",
"LH-LYS8-LP-LPCL-XD":	"LY11",
"AIR-MXPA-EBLG-2-F-VCRI":	"EB01",
"AIR-MXPA-EBLG-DNW5-BAG":	"EB93",
"CC-POIT-LAZIO29-H2":	"PO29",
"AMZL-DAR2-ND-ALL":	"DAR2",
"LH-MUC7-BER8-XD-F-VCRI":	"MUC8",
"LH-CDG8-AMZL-DIF2-BAG":	"CD98",
"LH-MRS9-AMZL-DAC9-XD":	"MR19",
"CC-POIT-EMILIA19-H2-ALL":	"PO19",
"CC-NXV-PIEMONTE-H2":	"NPM1",
"DMXP6_TOTO23373_CUNEO_RE_ALL":	"CNR1",
"AIR-MXPA-HAJA-F-VCRI":	"HA01",
"AIR-MXPA-HAJA-DHB1-BAG":	"HA95",
"CC-POIT-UMBTOS39-H2-F-VCRI":	"PO39",
"AIR-MXPA-LEBL-BCN8-XD-ALL":	"LEB8",
"AIR-MXPA-HAJA-DNX6-BAG":	"HA77",
"AMZL-DER1-ND":	"AER1",
"AIR-MXPA-LEBL-DMZ4-BAG":	"LB90",
"CC-NXV-FRIULI-H2-F-VCRI":	"NFR1",
"AMZL-DLO1-SD-F-VCRI":	"SLO1",
"LH-CDG8-AMZL-DWV1-BAG":	"CD91",
"CC-POIT-LIGURI18-H2":	"PO18",
"LH-LYS8-ORY8-XD":	"LY02",
"LH-MRS9-AMZL-DRQ5-XD":	"MR05",
"CC-POIT-SICILI9-H2":	"POS9",
"CC-POIT-EMILIA5-H2-F-VCRI":	"POE5",
"AMZL-DAR1-ND-MERGE":	"DAR1",
"LH-MXP8-DTM9-XD-ALL":	"MX09",
"AMZL-DVN2-ND-XPT-F-VCRI":	"XVN2",
"AIR-MXPA-LEBL-DQV2-BAG":	"LB89",
"CC-POIT-PIEMON6-H2-F-VCRI":	"POP6",
"AMZL-DER1-ND-MR-ALL":	"MER1",
"CC-BRT-IT-VR":	"BR02",
"LH-CDG8-MIX-F-VCRI":	"CD01",
"LH-MXP8-MIX-F-VCRI":	"MX01",
"LH-MRS9-AMZL-DRQ5-XD-ALL":	"MR05",
"LH-BLQ8-AMZL-DPU1-XD-F-VCRI":	"BQ04",
"AMZL-DER2-ND-XPT-ALL":	"XER2",
"AMZL-DLO2-ND":	"ALO2",
"CC-DHLX-EU-VR":	"DHVR",
"DMXP6_GEGE50121_SANREMOR-F-VCRI":	"SAN1",
"LH-CDG8-AMZL-DNC2-BAG":	"CD96",
"LH-FCO9-MIX-F-VCRI":	"FC01",
"AMZL-DTT1-ND":	"ATT1",
"AMZL-DER1-ND-MR":	"MER1",
"LH-LYS8-AMZL-DIF6-BAG":	"LY96",
"LH-MUC7-MIX-MERGE":	"MUC1",
"AIR-MXPA-EBLG-CDG8-XD":	"BE03",
"LH-BLQ8-AMZL-DAP5-XD-F-VCRI":	"BQ02",
"LH-MRS9-AMZL-DMA4-BAG":	"MR94",
"LH-MUC7-AMZL-DRP4-XD-ALL":	"MUC4",
"LH-LIN8-AMZL-DVN5-XD-ALL":	"LI15",
"CC-POIT-EMILIA14-H2-ALL":	"PO14",
"LH-BLQ8-AMZL-DRU1-XD-F-VCRI":	"BQ07",
"AMZL-DLO7-ND":	"ALO7",
"LH-LP-ARCS-H2-ALL":	"ARC1",
"AIR-MXPA-LEBL-DCT9-BAG":	"LB97",
"CC-POIT-LIGURI18-H2-F-VCRI":	"PO18",
"LH-MRS9-BCN8-XD-F-VCRI":	"MR18",
"AMZL-DER2-ND-F-VCRI":	"AER2",
"CC-POIT-BIBBIENA-DDU-XD-F-VCRI":	"POB1",
"AMZL-DAR1-ND":	"DAR1",
"LH-LYS8-AMZL-DMU3-BAG":	"LY91",
"LH-LP-FR-H1":	"LPF1",
"CC-POIT-VENFRI27-H2-F-VCRI":	"PO27",
"LH-LYS8-LP-LPCL-XD-F-VCRI":	"LY11",
"LH-MXP8-DTM9-XD":	"MX09",
"CC-POIT-LIGURI17-H2-F-VCRI":	"PO17",
"LH-BLQ8-AMZL-DMR1-XD":	"BQ03",
"CC-POIT-PUGBAS23-H2-ALL":	"PO23",
"LH-CDG8-AMZL-DWB9-XD-F-VCRI":	"CD03",
"LH-MRS9-CDG8-XD":	"MR08",
"AMZL-DER2-ND-ALL":	"AER2",
"LH-CGN9-MIX":	"CGN1",
"AMZL-DLZ2-ND-XPT-ALL":	"XLZ2",
"AMZL-DVN3-ND-MERGE":	"AVN3",
"LH-CDG8-AMZL-DND1-BAG":	"CD94",
"LH-CDG8-AMZL-DWB9-XD":	"CD03",
"CC-POIT-VENFRI27-H2-ALL":	"PO27",
"CC-POIT-LOMBAR28-H2-ALL":	"PO28",
"AIR-MXPA-HAJA-DNM6-BAG":	"HA96",
"LH-BLQ8-MIX":	"BQ01",
"CC-POIT-LOMBAR381-H2":	"PO81",
"LH-BLQ8-AMZL-DUM1-XD":	"BQ08",
"LH-LYS8-DTM9-XD-F-VCRI":	"LY07",
"LH-LP-ARCS-H2-F-VCRI":	"ARC1",
"LH-BLQ8-AMZL-DAP5-XD-ALL":	"BQ02",
"LH-CDG8-AMZL-DWB9-XD-ALL":	"CD03",
"CC-NXV-LAZIO-H2-ALL":	"NLZ1",
"LH-MRS9-AMZL-DLP4-XD-F-VCRI":	"MR04",
"AMZL-DAR2-ND-F-VCRI":	"DAR2",
"AMZL-DLZ1-ND-MR-ALL":	"MLZ1",
"AIR-MXPA-EBLG-DNW6-BAG":	"EB92",
"AIR-MXPA-EBLG-DHG1-BAG":	"BE79",
"AIR-MXPA-LEBL-DCZ4-BAG":	"LB95",
"CC-UPS-INTL-H1-ALL":	"UP01",
"AIR-MXPA-HAJA-NUE9-XD":	"HA02",
"LH-LYS8-AMZL-DAR9-XD-F-VCRI":	"LY19",
"CC-NXV-LAZIO-H2":	"NLZ1",
"AMZL-DFV1-ND-MR-F-VCRI":	"MFV1",
"AIR-MXPA-EBLG-DNX4-BAG":	"EB87",
"CC-POIT-CALABR10-H2":	"PO10",
"CC-POIT-LOMBAR381-H2-F-VCRI":	"PO81",
"LH-CDG8-AMZL-DIF1-BAG":	"CD99",
"LH-MUC7-AMZL-DVI2-XD":	"MUC5",
"LH-MXP8-MIX":	"MX01",
"CC-POIT-EMILIA14-H2-F-VCRI":	"PO14",
"LH-LYS8-AMZL-DAO3-XD-ALL":	"LY13",
"LH-LP-ALPES-H2-ALL":	"ALP2",
"AMZL-DPI2-ND-XPT-F-VCRI":	"XPI2",
"AMZL-DAR1-ND-F-VCRI":	"DAR1",
"LH-LIN8-AMZL-DFV2-XD-ALL":	"LI09",
"LH-LYS8-AMZL-DAR9-BAG":	"LY99",
"AMZL-DTT1-ND-MERGE":	"ATT1",
"LH-CDG8-AMZL-DNC3-BAG":	"CD95",
"LH-LIN8-AMZL-DUM1-BAG":	"LI91",
"LH-BCN8-MIX":	"BC01",
"LH-LYS8-AMZL-DHE6-BAG":	"LY93",
"CC-POIT-VENFRI27-H2":	"PO27",
"CC-POIT-SARSIC50-H2":	"PO50",
"LH-BLQ8-AMZL-DVN5-BAG":	"BQ95",
"LH-MUC7-MHG9-XD":	"MUC7",
"AIR-MXPA-HAJA-BER8-XD":	"HA03",
"AMZL-DLO2-SD-ALL":	"SLO2",
"AMZL-DER1-ND-MR-F-VCRI":	"MER1",
"LH-LIN8-AMZL-DTC2-XD-F-VCRI":	"LI06",
"AMZL-DLZ2-ND-XPT-F-VCRI":	"XLZ2",
"AIR-MXPA-HAJA-DHH2-BAG":	"HA93",
"LH-LIN8-AMZL-DVN6-XD":	"LI16",
"AIR-MXPA-HAJA-DNW4-BAG":	"HA94",
"CC-POIT-IT-H2-ALL":	"PO02",
"LH-LIN8-MIX-F-VCRI":	"LI01",
"AMZL-DVN3-ND-ALL":	"AVN3",
"LH-MRS9-AMZL-DWP1-XD-F-VCRI":	"MR03",
"AMZL-DPI2-SD":	"SPI2",
"LH-BLQ8-AMZL-DRU1-XD-ALL":	"BQ07",
"AMZL-DER3-ND-XPT":	"XER3",
"LH-BCN8-AMZL-DQA7-XPT-BAG":	"BC99",
"LH-MRS9-AMZL-DLP2-XD":	"MR02",
"LH-LIN8-AMZL-DLZ2-XPT-XD-ALL":	"LI13",
"AMZL-DTC1-ND-MR-ALL":	"ATC1",
"AMZL-DWP2-ND-F-VCRI":	"AWP2",
"AMZL-DER3-ND-XPT-ALL":	"XER3",
"LH-LYS8-BCN8-XD-F-VCRI":	"LY18",
"AMZL-DTC2-ND-MERGE":	"ATC2",
"LH-FCO9-MIX":	"FC01",
"AMZL-DWP2-ND-ALL":	"AWP2",
"AMZL-DPI3-ND-ALL":	"API3",
"AMZL-DLY1-ND-MR-ALL":	"MDL1",
"CC-NXV-EMILIA-H2":	"NEM1",
"CC-POIT-LOMBAR381-H2-ALL":	"PO81",
"AMZL-DLO1-ND-ALL":	"ALO1",
"AMZL-DLZ1-ND-MR":	"MLZ1",
"LH-LYS8-AMZL-DBF1-BAG":	"LY98",
"LH-MRS9-AMZL-DWP1-XD-ALL":	"MR03",
"LH-BLQ8-AMZL-DPU1-XPT-XD-F-VCRI":	"BQ06",
"LH-MUC7-AMZL-DBX9-XD-ALL":	"MUC9",
"LH-MRS9-AMZL-DAC9-XD-ALL":	"MR19",
"CC-POIT-PORTOFE-DDU-XD":	"POP1",
"LH-LIN8-AMZL-DLZ2-XPT-BAG":	"LI99",
"LH-MUC7-BER8-XD-ALL":	"MUC8",
"AMZL-DLO8-ND-MERGE":	"ALO8",
"LH-CDG8-AMZL-DIF5-XD-F-VCRI":	"CD05",
"LH-BLQ8-AMZL-DMR1-XD-ALL":	"BQ03",
"LH-CDG8-AMZL-DWL1-BAG":	"CD92",
"LH-BCN8-MIX-MERGE":	"BC01",
"LH-LP-STLAUREN-H2-F-VCRI":	"STL1",
"AMZL-DPI3-ND-XPT-F-VCRI":	"XPI3",
"AMZL-DWP1-ND":	"DWP1",
"DMXP6_TOTO63574_RECTAZZO_ALL":	"RTZ1",
"AMZL-DLZ2-ND-XPT":	"XLZ2",
"LH-LIN8-AMZL-DVN6-XD-ALL":	"LI16",
"AMZL-DLO5-ND":	"ALO5",
"AMZL-DTC2-ND-XPT":	"XTC2",
"LH-LYS8-AMZL-DBY2-BAG":	"LY95",
"LH-LIN8-AMZL-DLZ2-BAG":	"LI92",
"LH-LYS8-AMZL-DNM1-XD":	"LY05",
"CC-POIT-TOSCAN13-H2-F-VCRI":	"PO13",
"AIR-MXPA-EBLG-CDG8-XD-F-VCRI":	"BE03",
"CC-POIT-SARDEG1-H2-ALL":	"POS1",
"AMZL-DTC2-ND-XPT-ALL":	"XTC2",
"AIR-MXPA-LEBL-DCZ3-BAG":	"LB96",
"LH-LYS8-MHG9-XD":	"LY09",
"LH-BLQ8-FRAX-XD-ALL":	"BQ09",
"DMXP6_MRMR38707_ROZZANO-ALL":	"ROZ1",
"AIR-MXPA-HAJA-DNM4-BAG":	"HA81",
"AIR-MXPA-LEBL-BCN8-XD":	"LEB8",
"LH-LIN8-AMZL-DVN5-XD":	"LI15",
"CC-POIT-EMILIA5-H2-ALL":	"POE5",
"AMZL-DLO3-ND-F-VCRI":	"ALO3",
"LH-LIN8-MIX":	"LI01",
"LH-MXP8-AMZL-DVI3-XD-ALL":	"MX03",
"AMZL-DLG1-ND-F-VCRI":	"ALG1",
"AIR-MXPA-HAJA-MHG9-XD-F-VCRI":	"HA04",
"AIR-MXPA-HAJA-DHH3-BAG":	"HA80",
"LH-MXP8-AMZL-DVI3-XD":	"MX03",
"AMZL-DWP2-ND":	"AWP2",
"LH-LYS8-MHG9-XD-F-VCRI":	"LY09",
"AMZL-DER3-ND-F-VCRI":	"AER3",
"LH-BLQ8-MIX-MERGE":	"BQ01",
"LH-MXP8-DTM9-XD-F-VCRI":	"MX09",
"LH-MRS9-AMZL-DLP2-XD-F-VCRI":	"MR02",
"AMZL-DLZ2-ND-F-VCRI":	"ALZ2",
"LH-LYS8-AMZL-DNL1-BAG":	"LY90",
"LH-CDG8-MIX":	"CD01",
"LH-MRS9-AMZL-DMZ2-BAG":	"MR92",
"DMXP6_MRMR38707_ROZZANO-F-VCRI":	"ROZ1",
"LH-FCO9-AMZL-DNP1-XPT-BAG":	"FC96",
"AIR-MXPA-EBLG-DNX3-BAG":	"EB89",
"LH-MRS9-PXD-AMZL-DLP5-XD-F-VCRI":	"MR15",
"LH-ORY8-MIX-MERGE":	"ORY1",
"CC-POIT-TRENTI71-H2":	"PO71",
"CC-POIT-IT-H1-ALL":	"PO01",
"AMZL-DAR2-ND":	"DAR2",
"LH-LIN8-AMZL-DVN1-XD-ALL":	"LI04",
"LH-MRS9-AMZL-DCZ4-BAG":	"MR84",
"DMXP6_GEGE50121_SANREMOR-ALL":	"SAN1",
"AIR-MXPA-LEBL-DIC1-BAG":	"LB94",
"LH-LIN8-ATPO-VILLACH-XD-F-VCRI":	"LI07",
"CC-UPS-INTL-H1":	"UP01",
"AMZL-DLO1-ND-F-VCRI":	"ALO1",
"LH-BLQ8-FRAX-XD":	"BQ09",
"CC-POIT-GUBBIO-DDU-XD-F-VCRI":	"POG1",
"CC-SDA-IT-H1":	"SD01",
"AMZL-DPI2-SD-ALL":	"SPI2",
"LH-ORY8-MIX-F-VCRI":	"ORY1",
"AIR-MXPA-HAJA-MHG9-XD-ALL":	"HA04",
"LH-CDG8-AMZL-DWB2-BAG":	"CD93",
"AIR-MXPA-HAJA-DNM8-BAG":	"HA98",
"LH-LIN8-MIX-ALL":	"LI01",
"AMZL-DER5-ND-ALL":	"AER5",
"AIR-MXPA-LEBL-DCT7-BAG":	"LB98",
"LH-MRS9-AMZL-DQA4-BAG":	"MR82",
"CC-POIT-UMBTOS12-H2":	"PO12",
"AMZL-DPI2-ND":	"API2",
"CC-BRT-IT-H1":	"BR01",
"LH-LIN8-AMZL-DSG1-XD-ALL":	"LI05",
"LH-LIN8-AMZL-DLZ2-XD-F-VCRI":	"LI12",
"LH-LP-FR-H1-F-VCRI":	"LPF1",
"CC-NXV-PIEMONTE-H2-ALL":	"NPM1",
"AMZL-DER1-ND-ALL":	"AER1",
"LH-BCN8-MIX-ALL":	"BC01",
"AMZL-DMU2-ND-F-VCRI":	"DMU2",
"CC-NXV-LOMBARDI-H2-ALL":	"NLO1",
"CC-POIT-SARDEG1-H2":	"POS1",
"LH-LIN8-AMZL-DSG1-XD":	"LI05",
"LH-MUC7-AMZL-DMU2-XD":	"MUC2",
"CC-KN-EU-VR":	"KN01",
"AMZL-DFV1-ND-MR":	"MFV1",
"AIR-MXPA-LEBL-DMZ2-BAG":	"LB91",
"AMZL-DLO1-SD-ALL":	"SLO1",
"AMZL-DVN2-ND-F-VCRI":	"AVN2",
"LH-MRS9-MIX-MERGE":	"MR01",
"AMZL-DVN2-ND-ALL":	"AVN2",
"AIR-MXPA-EBLG-2-ALL":	"EB01",
"AMZL-DMU2-ND-MERGE":	"DMU2",
"AMZL-DER2-ND-XPT":	"XER2",
"LH-LIN8-BER8-XD-ALL":	"LI08",
"LH-LIN8-ATPO-VILLACH-XD":	"LI07",
"AIR-MXPA-EBLG-FRAX-XD":	"EB02",
"AMZL-DNP1-ND-MERGE":	"NPI1",
"AMZL-DLY1-ND-MR-F-VCRI":	"MDL1",
"LH-LYS8-LPCL-XD-F-VCRI":	"LY08",
"CC-NXV-LOMBARDI-H2":	"NLO1",
"AMZL-DER5-ND":	"AER5",
"AMZL-DPI2-ND-XPT-ALL":	"XPI2",
"AMZL-DLO3-ND-MERGE":	"ALO3",
"LH-CGN9-MIX-F-VCRI":	"CGN1",
"AMZL-DWP2-ND-MERGE":	"AWP2",
"LH-MUC7-BER8-XD":	"MUC8",
"LH-MRS9-AMZL-DQV6-BAG":	"MR81",
"AMZL-DLG1-SD-F-VCRI":	"SLG1",
"AMZL-DFV1-ND-ALL":	"AFV1",
"AMZL-DLZ2-ND-MERGE":	"ALZ2",
"CC-POIT-LIGURI18-H2-ALL":	"PO18",
"CC-POIT-LOMVEN72-H2":	"PO72",
"AMZL-DPI2-SD-MERGE":	"SPI2",
"DMXP6_MRMR20417_MENAGGI":	"POM1",
"AIR-MXPA-EBLG-CDG8-XD-ALL":	"BE03",
"AIR-MXPA-EBLG-DNW8-BAG":	"EB91",
"AMZL-DLO2-SD-F-VCRI":	"SLO2",
"CC-POIT-GUBBIO-DDU-XD":	"POG1",
"LH-MRS9-AMZL-DAR9-XD-F-VCRI":	"MR09",
"LH-LP-ARCS-H2":	"ARC1",
"AIR-MXPA-EBLG-NDHZ-BAG":	"BE75",
"LH-HHN9-AMZL-DBW1-XD":	"HH81",
"AIR-MXPA-HAJA-DNM1-BAG":	"HA91",
"AMZL-DLZ1-ND-MR-F-VCRI":	"MLZ1",
"LH-LP-STLAUREN-H2":	"STL1",
"LH-BLQ8-AMZL-DPU1-XD":	"BQ04",
"CC-POIT-LOMBAR38-H2-ALL":	"PO38",
"CC-POIT-PUGBAS23-H2":	"PO23",
"CC-SDA-IT-H1-F-VCRI":	"SD01",
"LH-HHN9-AMZL-DNW4-XD":	"HH40",
"LH-MUC7-MIX-ALL":	"MUC1",
"CC-POIT-VENFRI11-H2-ALL":	"PO11",
"CC-POIT-SARSIC50-H2-F-VCRI":	"PO50",
"DMXP6_MRMR20417_MENAGGI_ALL":	"POM1",
"CC-POIT-SICILI9-H2-F-VCRI":	"POS9",
"LH-LIN8-BER8-XD":	"LI08",
"AMZL-DLO4-ND-XPT-ALL":	"XLO4",
"LH-LIN8-AMZL-DER3-XD-ALL":	"LI03",
"LH-MRS9-AMZL-DWP1-XPT-XD-ALL":	"MR06",
"AMZL-DLO8-ND-ALL":	"ALO8",
"AIR-MXPA-EBLG-DNW1-BAG":	"EB95",
"AMZL-DLO5-ND-F-VCRI":	"ALO5",
"AIR-MXPA-HAJA-DTH1-BAG":	"HA90",
"AIR-MXPA-EBLG-2-DNM6-BAG":	"EB53",
"CC-POIT-TOSCAN4-H2-ALL":	"POT4",
"AMZL-DLO7-ND-ALL":	"ALO7",
"LH-MRS9-AMZL-DMZ4-BAG":	"MR94",
"AIR-MXPA-EBLG-DNL1-BAG":	"EB96",
"AIR-MXPA-HAJA-DSH4-BAG":	"HA94",
"AMZL-DFV2-ND-MR-F-VCRI":	"MFV2",
"LH-CDG8-AMZL-DIF4-XD-F-VCRI":	"CD04",
"CC-NXV-VENETO-H2":	"NVN1",
"LH-BLQ8-MIX-F-VCRI":	"BQ01",
"AMZL-DLY1-ND-MR":	"MDL1",
"AIR-MXPA-EBLG-2-DNZ2-BAG":	"EB55",
"LH-LIN8-AMZL-DER3-XD-F-VCRI":	"LI03",
"AIR-MXPA-LEBL-DQV6-BAG":	"LB88",
"LH-MRS9-AMZL-DBZ6-BAG":	"MR87",
"LH-LYS8-AMZL-DNM1-XD-ALL":	"LY05",
"CC-POIT-TOSCAN4-H2":	"POT4",
"LH-LYS8-LPCL-XD-ALL":	"LY08",
"LH-MRS9-AMZL-DLP2-XD-ALL":	"MR02",
"LH-CDG8-AMZL-DIF5-XD":	"CD05",
"LH-LIN8-AMZL-DFV1-XD-F-VCRI":	"LI10",
"AIR-MXPA-HAJA-DNM7-BAG":	"HA97",
"LH-LYS8-AMZL-DAR9-XD-ALL":	"LY19",
"AMZL-DER1-ND-MERGE":	"AER1",
"CC-POIT-EMILIA14-H2":	"PO14",
"CC-POIT-CENTER16-H2-ALL":	"PO16",
"CC-SDA-ITNORTH-H1-ALL":	"SD02",
"AMZL-DLO8-ND":	"ALO8",
"AMZL-DLO2-ND-MERGE":	"ALO2",
"AMZL-DLO4-ND-XPT":	"XLO4",
"LH-MUC7-AMZL-DBY3-XD-ALL":	"MUC3",
"LH-LIN8-AMZL-DTC2-XPT-XD-F-VCRI":	"LI02",
"AMZL-DTC1-ND-MR":	"ATC1",
"AMZL-DLG1-ND-MERGE":	"ALG1",
"AIR-MXPA-EBLG-CB01-BAG":	"BE80",
"AMZL-DLZ3-ND-MERGE":	"DLZ3",
"LH-LYS8-AMZL-DBF1-XD-ALL":	"LY03",
"LH-MUC7-AMZL-DRP4-XD-F-VCRI":	"MUC4",
"LH-MRS9-AMZL-DWP1-XPT-XD-F-VCRI":	"MR06",
"CC-POIT-BIBBIENA-DDU-XD":	"POB1",
"CC-POIT-PIEMON8-H2":	"POP8",
"LH-CDG8-MIX-MERGE":	"CD01",
"AMZL-DLG1-ND-XPT-ALL":	"XLG1",
"AMZL-DPI3-ND":	"API3",
"LH-LYS8-AMZL-DHE1-BAG":	"LY94",
"AIR-MXPA-HAJA-DNW9-BAG":	"HA99",
"AMZL-DER5-ND-F-VCRI":	"AER5",
"CC-POIT-VENFRI11-H2-F-VCRI":	"PO11",
"CC-POIT-LOMVEN72-H2-F-VCRI":	"PO72",
"AIR-MXPA-HAJA-ALL":	"HA01",
"AIR-MXPA-EBLG-PANT-BAG":	"BE74",
"CC-POIT-VENFRI11-H2":	"PO11",
"CC-POIT-CENTER16-H2":	"PO16",
"AIR-MXPA-HAJA-DHH1-BAG":	"HA89",
"CC-POIT-PIEMON8-H2-ALL":	"POP8",
"LH-MRS9-AMZL-DGA1-XPT-BAG":	"MR83",
"LH-FCO9-AMZL-OTC3-BAG":	"FC99",
"AMZL-DPI3-ND-MERGE":	"API3",
"DMXP6_MRMB38633_MIISOLA":	"MIS1",
"AIR-MXPA-EBLG-DHE3-BAG":	"EB99",
"LH-MRS9-AMZL-DLP5-XD-F-VCRI":	"MR12",
"AIR-MXPA-EBLG-2":	"EB01",
"AIR-MXPA-EBLG-DNZ2-BAG":	"BE77",
"AMZL-DLZ2-ND-ALL":	"ALZ2",
"LH-LIN8-AMZL-DVN6-XD-F-VCRI":	"LI16",
"AIR-MXPA-EBLG-DNX5-BAG":	"EB88",
"CC-POIT-PORTOFE-DDU-XD-F-VCRI":	"POP1",
"AIR-MXPA-HAJA-DNM2-BAG":	"HA92",
"LH-BLQ8-MIX-ALL":	"BQ01",
"DMXP6_MRMR38707_ROZZANO":	"ROZ1",
"LH-HHN9-AMZL-DBW1-XD-F-VCRI":	"HH81",
"AMZL-DTC2-ND-ALL":	"ATC2",
"CC-SDA-IT-H1-ALL":	"SD01",
"AIR-MXPA-EBLG-FRAX-XD-F-VCRI":	"EB02",
"LH-LIN8-AMZL-DLZ2-XPT-XD-F-VCRI":	"LI13",
"DMXP6_TOTO63574_RECTAZZO-F-VCRI":	"RTZ1",
"AMZL-DVN1-ND-ALL":	"AVN1",
"AIR-MXPA-EBLG-2-DNX1-BAG":	"EB54",
"CC-NXV-VENETO-H2-ALL":	"NVN1",
"CC-POIT-SICILI9-H2-ALL":	"POS9",
"AMZL-DLO2-SD-MERGE":	"SLO2",
"LH-LP-FR-H1-ALL":	"LPF1",
"AMZL-DER5-ND-MERGE":	"AER5",
"AMZL-DVN3-ND":	"AVN3",
"LH-LYS8-AMZL-DNX3-BAG":	"LY89",
"LH-CDG8-AMZL-DIF4-XD":	"CD04",
"LH-MXP8-MIX-ALL":	"MX01",
"CC-POIT-LOMBAR28-H2":	"PO28",
"LH-FCO9-MIX-MERGE":	"FC01",
"LH-MRS9-MIX-F-VCRI":	"MR01",
"LH-LIN8-AMZL-DTC2-XPT-XD-ALL":	"LI02",
"CC-POIT-PIEMON6-H2":	"POP6",
"LH-LIN8-AMZL-DTC2-XD-ALL":	"LI06",
"LH-MUC7-MIX-F-VCRI":	"MUC1",
"LH-MUC7-MHG9-XD-F-VCRI":	"MUC7",
"AMZL-DVN2-ND-XPT":	"XVN2",
"AMZL-DLO8-ND-F-VCRI":	"ALO8",
"CC-SDA-ITNORTH-H1":	"SD02",
"AMZL-DLZ2-ND":	"ALZ2",
"AIR-MXPA-EBLG-2-DHB1-BAG":	"EB50",
"AMZL-DLO4-ND-MERGE":	"ALO4",
"AMZL-DPI2-ND-MERGE":	"API2",
"AMZL-DTC2-ND":	"ATC2",
"LH-LYS8-LP-LPCL-XD-ALL":	"LY11",
"LH-HHN9-AMZL-DNW4-XD-F-VCRI":	"HH40",
"AMZL-DER2-ND-XPT-F-VCRI":	"XER2",
"LH-MUC7-MIX":	"MUC1",
"AMZL-DER2-ND":	"AER2",
"AIR-MXPA-HAJA-BER8-XD-F-VCRI":	"HA03",
"LH-MUC7-HAJ8-XD":	"MUC6",
"AMZL-DER2-ND-MERGE":	"AER2",
"CC-POIT-VENETO37-H2-ALL":	"PO37",
"CC-POIT-LOMBAR28-H2-F-VCRI":	"PO28",
"AMZL-DMU2-ND":	"DMU2",
"CC-POIT-CENTER16-H2-F-VCRI":	"PO16",
"DMXP6_MRMB38633_MIISOLA-F-VCRI":	"MIS1",
"LH-LIN8-AMZL-DVN1-XD":	"LI04",
"CC-POIT-PIEMON6-H2-ALL":	"POP6",
"AMZL-DLO7-ND-F-VCRI":	"ALO7",
"LH-LYS8-AMZL-DRP2-BAG":	"LY88",
"AMZL-DLO4-ND-XPT-MERGE":	"XLO4",
"AMZL-DTC2-ND-XPT-F-VCRI":	"XTC2",
"AMZL-DVN2-ND-XPT-ALL":	"XVN2",
"AMZL-DLO1-ND":	"ALO1",
"LH-MRS9-AMZL-DMA3-BAG":	"MR93",
"CC-POIT-LOMBAR38-H2-F-VCRI":	"PO38",
"LH-LYS8-MIX-F-VCRI":	"LY01",
"LH-LYS8-MHG9-XD-ALL":	"LY09",
"LH-LIN8-AMZL-DLZ2-XD":	"LI12",
"AMZL-DVN2-ND":	"AVN2",
"AIR-MXPA-EBLG-FRAX-XD-ALL":	"EB02",
"AIR-MXPA-EBLG-2-DNM1-BAG":	"EB52",
"LH-MRS9-AMZL-DCT7-BAG":	"MR86",
"CC-POIT-CALABR10-H2-F-VCRI":	"PO10",
"LH-MRS9-CC-LP-XD":	"MR07",
"LH-HHN9-AMZL-DBW1-XD-ALL":	"HH81",
"CC-POIT-TOSCAN13-H2-ALL":	"PO13",
"LH-LYS8-AMZL-DHH2-XD-F-VCRI":	"LY04",
"LH-LIN8-AMZL-DLZ2-XPT-XD":	"LI13",
"LH-MRS9-MIX-ALL":	"MR01",
"LH-LIN8-AMZL-DTC2-XPT-XD":	"LI02",
"LH-LYS8-AMZL-DHH2-XD-ALL":	"LY04",
"LH-MRS9-PXD-AMZL-DLP5-XD-ALL":	"MR15",
"CC-NXV-EMILIA-H2-F-VCRI":	"NEM1",
"LH-LYS8-AMZL-DAR9-XD":	"LY19",
"LH-MXP8-MIX-MERGE":	"MX01",
"LH-BCN8-MIX-F-VCRI":	"BC01",
"LH-MRS9-AMZL-DAR9-XD-ALL":	"MR09",
"AMZL-DLZ3-ND":	"DLZ3",
"LH-MRS9-CDG8-XD-F-VCRI":	"MR08",
"LH-BLQ8-AMZL-DUM1-XD-F-VCRI":	"BQ08",
"AMZL-DPI3-ND-XPT":	"XPI3",
"LH-LIN8-AMZL-DFV2-XD-F-VCRI":	"LI09",
"AMZL-DTC1-ND-MR-F-VCRI":	"ATC1",
"LH-LYS8-AMZL-DAO3-XD-F-VCRI":	"LY13",
"AMZL-DAR2-ND-MERGE":	"DAR2",
"AMZL-DFV1-ND":	"AFV1",
"AMZL-DAR1-ND-ALL":	"DAR1",
"LH-MUC7-AMZL-DVI2-XD-F-VCRI":	"MUC5",
"CC-POIT-TRENTI71-H2-F-VCRI":	"PO71",
"LH-CDG8-AMZL-DIF5-XD-ALL":	"CD05",
"CC-DHLX-INTL-H1":	"DH01",
"LH-LYS8-DTM9-XD-ALL":	"LY07",
"CC-NXV-TOSCANA-H2-F-VCRI":	"NTS1",
"CC-NXV-LOMBARDI-H2-F-VCRI":	"NLO1",
"AMZL-DLO7-ND-MERGE":	"ALO7",
"LH-MUC7-HAJ8-XD-F-VCRI":	"MUC6",
"LH-CDG8-AMZL-DWV9-XD-F-VCRI":	"CD02",
"AMZL-DER3-ND":	"AER3",
"CC-NXV-LAZIO-H2-F-VCRI":	"NLZ1",
"AIR-MXPA-EBLG-DHG1-1-BAG":	"EB97",
"AMZL-DLO3-ND-ALL":	"ALO3",
"AMZL-DLO4-ND-ALL":	"ALO4",
"LH-LP-ALPES-H2":	"ALP2",
"LH-MRS9-AMZL-DCZ3-BAG":	"MR85",
"CC-POIT-LAZIO29-H2-ALL":	"PO29",
"AMZL-DLO4-ND-XPT-F-VCRI":	"XLO4",
"LH-MXP8-AMZL-DVI1-XD-F-VCRI":	"MX02",
"LH-LP-STLAUREN-H2-ALL":	"STL1",
"CC-POIT-GUBBIO-DDU-XD-ALL":	"POG1",
"AMZL-DLO1-ND-MERGE":	"ALO1",
"LH-FCO9-AMZL-DLZ2-XPT-BAG":	"FC97",
"LH-LYS8-AMZL-DAO3-XD":	"LY13",
"CC-NXV-TOSCANA-H2":	"NTS1",
"AMZL-DLO1-SD-MERGE":	"SLO1",
"CC-POIT-LAZIO3-H2-F-VCRI":	"POL3",
"CC-POIT-LIGURI17-H2-ALL":	"PO17",
"CC-POIT-EMILIA19-H2-F-VCRI":	"PO19",
"DMXP6_TOTO23373_CUNEO_RE":	"CNR1",
"CC-POIT-EMILIA5-H2":	"POE5",
"AIR-MXPA-EBLG-DNW3-BAG":	"EB94",
"AIR-MXPA-HAJA-DNX4-BAG":	"HA79",
"AMZL-DLO7-ND-XPT-F-VCRI":	"XLO7",
"LH-BLQ8-AMZL-DAP5-XD":	"BQ02",
"LH-BLQ8-AMZL-DPU1-XD-ALL":	"BQ04",
"LH-MUC7-HAJ8-XD-ALL":	"MUC6",
"LH-LIN8-BER8-XD-F-VCRI":	"LI08",
"CC-POIT-LOMBAR38-H2":	"PO38",
"LH-MRS9-AMZL-DWP1-XD":	"MR03",
"LH-MUC7-AMZL-DVI2-XD-ALL":	"MUC5",
"LH-LIN8-ATPO-VILLACH-XD-ALL":	"LI07",
"AMZL-DPI2-ND-XPT":	"XPI2",
"AMZL-DVN2-ND-MERGE":	"AVN2",
"CC-POIT-PORTOFE-DDU-XD-ALL":	"POP1",
"AMZL-DVN1-ND":	"AVN1",
"AMZL-DLO7-ND-XPT-ALL":	"XLO7",
"AMZL-DPI2-SD-F-VCRI":	"SPI2",
"LH-LIN8-AMZL-DLZ2-XD-ALL":	"LI12",
"CC-SDA-ITNORTH-H1-F-VCRI":	"SD02",
"AIR-MXPA-LEBL-DMA6-BAG":	"LB92",
"LH-LIN8-AMZL-DFV1-XD":	"LI10",
"AMZL-DLG1-ND":	"ALG1",
"AIR-MXPA-EBLG-DNW2-1-BAG":	"BE78",
"LH-MXP8-AMZL-DQA7-BAG":	"MX99",
"AMZL-DPI2-ND-F-VCRI":	"API2",
"AIR-MXPA-HAJA":	"HA01",
"CC-BRT-IT-H1-F-VCRI":	"BR01",
"CC-POIT-PUGBAS23-H2-F-VCRI":	"PO23",
"LH-LYS8-ORY8-XD-ALL":	"LY02",
"CC-POIT-VENETO37-H2-F-VCRI":	"PO37",
"CC-NXV-PIEMONTE-H2-F-VCRI":	"NPM1",
"LH-MUC7-AMZL-DBX9-XD":	"MUC9",
"DMXP6_TOTO01391_ALESSAN-F-VCRI":	"LSN1",
"AMZL-DTT1-ND-F-VCRI":	"ATT1",
"CC-POIT-UMBTOS12-H2-ALL":	"PO12",
"CC-POIT-LAZIO3-H2":	"POL3",
"LH-MRS9-AMZL-DBW5-BAG":	"MR88",
"AMZL-DFV1-ND-F-VCRI":	"AFV1",
"LH-FCO9-AMZL-OTC5-BAG":	"FC98",
"DMXP6_MRMB38633_MIISOLA_ALL":	"MIS1",
"LH-BLQ8-FRAX-XD-F-VCRI":	"BQ09",
"LH-MRS9-AMZL-DRQ5-XD-F-VCRI":	"MR05",
"CC-POIT-IT-H1":	"PO01",
"CC-POIT-IT-H1-F-VCRI":	"PO01",
"AMZL-DLG1-ND-XPT-F-VCRI":	"XLG1",
"AMZL-DMU2-ND-ALL":	"DMU2",
"CC-BRT-IT-H1-ALL":	"BR01",
"AIR-MXPA-HAJA-NUE9-XD-ALL":	"HA02",
"LH-LYS8-MIX":	"LY01",
"AIR-MXPA-EBLG-DRP3-BAG":	"BE76",
"LH-LIN8-AMZL-DER3-XD":	"LI03",
"AMZL-DLG1-ND-ALL":	"ALG1",
"CC-NXV-FRIULI-H2":	"NFR1"
    };

    // Funzione che aggiunge <span class="colVsm"> all'interno della classe 'childTree'
    function addColVsm(mapping) {
        const childTreeElements = document.querySelectorAll('.childTree'); // Trova tutti gli elementi con la classe 'childTree'

        // Per ogni elemento childTree
        childTreeElements.forEach(childTree => {
            // Trova ogni <li> dentro il 'childTree'
            const listItems = childTree.querySelectorAll('li');

            // Per ogni <li> all'interno di childTree
            listItems.forEach(li => {
                const colSFilter = li.querySelector('.colSFilter');

                if (colSFilter) {
                    // Verifica che non esista già un <span class="colVsm"> per evitare duplicati
                    if (!li.querySelector('.colVsm')) {
                        // Crea un nuovo elemento <span> con la classe 'colVsm'
                        const colVsm = document.createElement('span');
                        colVsm.classList.add('colVsm');

                        // Recupera il testo di colSFilter
                        const colSFilterText = colSFilter.textContent.trim();

                        // Aggiungi la mappatura solo se la chiave esiste
                        colVsm.textContent = mapping[colSFilterText] || '-';

                        // Inserisce colVsm dopo colSFilter all'interno di ogni <li>
                        colSFilter.parentNode.insertBefore(colVsm, colSFilter.nextSibling);

                        // Aggiungi 4 spazi dopo colVsm (tabulazione)
                        for (let i = 0; i < 4; i++) {
                            const space = document.createTextNode(' ');  // Crea un nodo di testo con uno spazio
                            colVsm.parentNode.insertBefore(space, colVsm.nextSibling);
                        }
                    }
                }
            });
        });
    }

    // Funzione principale che gestisce le modifiche
    function applyChanges(mapping) {
        changeColumn();
        addColVsm(mapping);  // Aggiunge colVsm con i valori mappati
    }

    // Funzione che esegue la logica solo quando la tabella è pronta (caricamento completo della pagina)
    function initialize(mapping) {
        const table = document.querySelector('table#tblContainers');

        if (table) {
            applyChanges(mapping);
        } else {
            console.log("Tabella non trovata.");
        }
    }

    // Esegui l'inizializzazione al caricamento della pagina
    window.addEventListener('load', () => initialize(mapping));

    // Crea un MutationObserver per monitorare i cambiamenti nel DOM
    const observer = new MutationObserver(function(mutationsList) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                // Applica solo quando vengono aggiunte nuove righe o modificate le classi
                applyChanges(mapping);
            }
        }
    });

    // Configura l'osservatore per monitorare i cambiamenti nella tabella
    const config = { childList: true, attributes: true, subtree: true };
    const table = document.querySelector('table#tblContainers');

    if (table) {
        observer.observe(table, config);
    }
})();


