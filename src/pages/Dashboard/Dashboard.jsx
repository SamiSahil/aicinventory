import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { getRangeData } from '../../api/googleSheetsService';
import Spinner from '../../components/common/Spinner';
import '../../assets/styles/Dashboard.css';

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch all required data in parallel
                const [sales, purchases, customers, suppliers] = await Promise.all([
                    getRangeData('RANGESD'),
                    getRangeData('RANGEPD'),
                    getRangeData('RANGECUSTOMERS'),
                    getRangeData('RANGESUPPLIERS')
                ]);

                // Process data (replicating logic from index.gs)
                const processedData = processDashboardData(sales, purchases, customers, suppliers);
                setData(processedData);
            } catch (err) {
                setError(err.message);
                console.error("Dashboard data fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) return <Spinner />;
    if (error) return <div className="error-message">Error loading dashboard: {error}</div>;
    if (!data) return <div>No data available.</div>;

    return (
        <div id="dash-container">
            <div className="dash-header">
                <h2>Dashboard</h2>
                <p>Key trends and business insights</p>
            </div>

            <div className="dash-kpi-row">
                {/* KPI Cards */}
                <div className="dash-kpi-card"><h3><i className="fas fa-chart-line"></i>Total Sales</h3><h2>{data.kpis.totalSales}</h2></div>
                <div className="dash-kpi-card"><h3><i className="fas fa-shopping-cart"></i>Total Purchases</h3><h2>{data.kpis.totalPurchases}</h2></div>
                <div className="dash-kpi-card"><h3><i className="fas fa-dollar-sign"></i>Net Profit</h3><h2>{data.kpis.netProfit}</h2></div>
                <div className="dash-kpi-card"><h3><i className="fas fa-receipt"></i>Total Receivable</h3><h2>{data.kpis.totalReceivable}</h2></div>
                <div className="dash-kpi-card"><h3><i className="fas fa-file-invoice-dollar"></i>Total Payable</h3><h2>{data.kpis.totalPayable}</h2></div>
                <div className="dash-kpi-card"><h3><i className="fas fa-map-marker-alt"></i>Top Sales Location</h3><h2>{data.kpis.topLocation}</h2></div>
                <div className="dash-kpi-card"><h3><i className="fas fa-box-open"></i>Top Selling Item</h3><h2>{data.kpis.topItem}</h2></div>
            </div>
            
             <div className="dash-charts-row">
                {/* Charts */}
                <div className="dash-col dash-col-1">
                    <div className="dash-chart-card dash-full">
                        <h3>Sales Trend</h3>
                        <Chart options={data.charts.salesTrend.options} series={data.charts.salesTrend.series} type="area" height={300} />
                    </div>
                     <div className="dash-row">
                        <div className="dash-chart-card dash-half">
                            <h3>Sales By Category</h3>
                             <Chart options={data.charts.salesByCategory.options} series={data.charts.salesByCategory.series} type="pie" height={300} />
                        </div>
                    </div>
                </div>
                <div className="dash-col dash-col-2">
                     <div className="dash-chart-card dash-full">
                        <h3>Top 10 Customers</h3>
                        <Chart options={data.charts.topCustomers.options} series={data.charts.topCustomers.series} type="bar" height={620} />
                    </div>
                </div>
                 <div className="dash-col dash-col-3">
                     <div className="dash-row">
                         <div className="dash-chart-card dash-half">
                            <h3>Purchase By Category</h3>
                            <Chart options={data.charts.purchaseByCategory.options} series={data.charts.purchaseByCategory.series} type="bar" height={300} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Data Processing Logic (moved outside the component for clarity)
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const processDashboardData = (sales, purchases, customers, suppliers) => {
    // --- KPIs ---
    const totalSales = sales.reduce((sum, r) => sum + Number(r['Total Sales Price'] || 0), 0);
    const totalPurchases = purchases.reduce((sum, r) => sum + Number(r['Total Purchase Price'] || 0), 0);
    const netProfit = totalSales - totalPurchases;
    const totalReceivable = customers.reduce((sum, r) => sum + Number(r['Balance Receivable'] || 0), 0);
    const totalPayable = suppliers.reduce((sum, r) => sum + Number(r['Balance Payable'] || 0), 0);

    const salesByCity = {};
    sales.forEach(r => {
        const city = r['City'] || 'Unknown';
        salesByCity[city] = (salesByCity[city] || 0) + Number(r['Total Sales Price'] || 0);
    });
    const topLocation = Object.entries(salesByCity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    const salesByItem = {};
    sales.forEach(r => {
        const item = r['Item Type'] || 'Unknown';
        salesByItem[item] = (salesByItem[item] || 0) + Number(r['Total Sales Price'] || 0);
    });
    const topItem = Object.entries(salesByItem).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // --- Chart Data ---

    // Sales Trend
    const trendMap = {};
    sales.forEach(r => {
        const d = new Date(r['SO Date']);
        if (!isNaN(d)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            trendMap[key] = (trendMap[key] || 0) + Number(r['Total Sales Price'] || 0);
        }
    });
    const sortedDates = Object.keys(trendMap).sort();
    const salesTrendValues = sortedDates.map(date => trendMap[date]);

    // Sales by Category
    const catMap = {};
    sales.forEach(r => {
        const c = r['Item Type'] || 'Unknown';
        catMap[c] = (catMap[c] || 0) + Number(r['Total Sales Price'] || 0);
    });

    // Top 10 Customers
    const custMap = {};
    sales.forEach(r => {
        const c = r['Customer Name'] || 'Unknown';
        custMap[c] = (custMap[c] || 0) + Number(r['Total Sales Price'] || 0);
    });
    const topCustArr = Object.entries(custMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    // Purchase By Category
    const purCatYear = {};
    purchases.forEach(r => {
        const d = new Date(r['Date']);
        if (!isNaN(d)) {
            const y = d.getFullYear();
            const c = r['Item Type'] || 'Unknown';
            purCatYear[y] = purCatYear[y] || {};
            purCatYear[y][c] = (purCatYear[y][c] || 0) + Number(r['Total Purchase Price'] || 0);
        }
    });
    const years = Object.keys(purCatYear).sort().filter(y => y === '2024' || y === '2025');
    const items = [...new Set(purchases.map(r => r['Item Type']))];
    const purchaseByCategorySeries = items.map(item => ({
        name: item,
        data: years.map(y => purCatYear[y]?.[item] || 0)
    }));


    return {
        kpis: {
            totalSales: formatCurrency(totalSales),
            totalPurchases: formatCurrency(totalPurchases),
            netProfit: formatCurrency(netProfit),
            totalReceivable: formatCurrency(totalReceivable),
            totalPayable: formatCurrency(totalPayable),
            topLocation,
            topItem,
        },
        charts: {
            salesTrend: {
                series: [{ name: 'Sales', data: salesTrendValues }],
                options: { chart: { type: 'area', toolbar: { show: false } }, dataLabels: { enabled: false }, stroke: { curve: 'smooth' }, xaxis: { type: 'datetime', categories: sortedDates }, tooltip: { x: { format: 'MMM yyyy' } } }
            },
            salesByCategory: {
                series: Object.values(catMap),
                options: { chart: { type: 'pie' }, labels: Object.keys(catMap), legend: { position: 'bottom' } }
            },
            topCustomers: {
                series: [{ name: 'Sales', data: topCustArr.map(a => a[1]) }],
                options: { chart: { type: 'bar' }, plotOptions: { bar: { horizontal: true } }, xaxis: { categories: topCustArr.map(a => a[0]) }, dataLabels: { enabled: false } }
            },
            purchaseByCategory: {
                series: purchaseByCategorySeries,
                options: { chart: { type: 'bar', stacked: true, toolbar: { show: false } }, plotOptions: { bar: { borderRadius: 4, columnWidth: '80%' } }, xaxis: { categories: years }, legend: { position: 'bottom' }, grid: { strokeDashArray: 4 }, dataLabels: { enabled: false } }
            }
        }
    };
};

export default Dashboard;
