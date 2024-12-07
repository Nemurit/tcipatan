function generatePieChart(filteredSummary) {
    if (!filteredSummary || Object.keys(filteredSummary).length === 0) return;

    // Create the canvas element dynamically if it doesn't exist
    let chartCanvas = document.getElementById('myChart');
    if (!chartCanvas) {
        chartCanvas = document.createElement('canvas');
        chartCanvas.id = 'myChart';
        chartCanvas.style.width = '100%';
        chartCanvas.style.height = '300px';
        document.body.appendChild(chartCanvas);
    }

    const labels = Object.keys(filteredSummary);
    const data = labels.map(location => {
        return Object.values(filteredSummary[location]).reduce((acc, locData) => acc + locData.count, 0);
    });

    const chartData = {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: ['#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00', '#0000ff', '#8a2be2'],
            borderColor: '#ffffff',
            borderWidth: 1
        }]
    };

    // Get the canvas context and create the chart
    const ctx = chartCanvas.getContext('2d');
    if (ctx) {
        new Chart(ctx, {
            type: 'pie',
            data: chartData
        });
    } else {
        console.error("Canvas context could not be found.");
    }
}
