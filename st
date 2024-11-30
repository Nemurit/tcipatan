/* General layout */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f4f4f9;
}

/* Table Styles */
table {
    width: 100%;
    border-collapse: collapse;
}

th, td {
    padding: 12px;
    text-align: left;
    border: 1px solid #ddd;
}

th {
    background-color: #f0f0f0;
    color: #333;
}

tr:nth-child(even) {
    background-color: #fafafa;
}

tr:hover {
    background-color: #f1f1f1;
}

/* Button Styles */
button {
    padding: 8px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:hover {
    background-color: #0056b3;
}

/* Input Fields */
input[type="text"], input[type="number"], select {
    padding: 8px 12px;
    width: 100%;
    margin: 5px 0;
    border-radius: 4px;
    border: 1px solid #ddd;
    font-size: 14px;
}

/* Container Styles */
#mainContainer {
    padding: 20px;
    background-color: #fff;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

#filterContainer {
    margin: 20px;
    width: 100%;
}

#filterContainer input,
#filterContainer select {
    margin-bottom: 10px;
}

/* Fixed Position Elements */
#tableContainer {
    position: fixed;
    top: 50px;
    left: 10px;
    max-width: 25%;
    z-index: 1000;
    background-color: #fff;
    padding: 15px;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-height: 400px;
    overflow-y: auto;
}
