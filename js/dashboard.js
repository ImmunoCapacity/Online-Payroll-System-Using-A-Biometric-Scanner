(function () {
    PayrollProLayout.init({
        activeNav: 'dashboard',
        user: {
            name: 'Maria Elena Reyes',
            role: 'Payroll Master',
            initials: 'MR'
        },
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    var labels = ['Jun 30', 'Jul 1', 'Jul 2', 'Jul 3', 'Jul 4', 'Jul 5', 'Jul 6'];
    var present = [225, 228, 231, 229, 218, 234, 231];
    var late = [14, 12, 11, 13, 19, 9, 12];
    var absent = [9, 8, 6, 8, 11, 5, 5];

    var ctx = document.getElementById('attendanceChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Present',
                    data: present,
                    backgroundColor: 'rgba(34, 197, 94, 0.85)',
                    borderRadius: 4,
                    barPercentage: 0.7
                },
                {
                    label: 'Late',
                    data: late,
                    backgroundColor: 'rgba(245, 158, 11, 0.85)',
                    borderRadius: 4,
                    barPercentage: 0.7
                },
                {
                    label: 'Absent',
                    data: absent,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderRadius: 4,
                    barPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 10,
                    cornerRadius: 6,
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { font: { size: 11 }, color: '#64748b' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        stepSize: 50
                    }
                }
            }
        }
    });
})();
