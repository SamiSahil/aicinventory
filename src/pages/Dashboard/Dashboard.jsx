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
                const [sales, purchases, customers, suppliers] = await Promise.all([
                    getRangeData('RANGESD'),
                    getRangeData('RANGEPD'),
                    getRangeData('RANGECUSTOMERS'),
                    getRangeData('RANGESUPPLIERS')
                ]);
                const processedData = processDashboardData(sales, purchases, customers, suppliers);
                setData(processedData);
            } catch (err) {
                setError(err.message);
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
                <div className="dash-kpi-card"><h3>Total Sales</h3><h2>{data.kpis.totalSales}</h2></div>
                <div className="dash-kpi-card"><h3>Total Purchases</h3><h2>{data.kpis.totalPurchases}</h2></div>
                <div className="dash-kpi-card" style={{borderColor: '#dc3545'}}><h3>Net Profit</h3><h2>{data.kpis.netProfit}</h2></div>
                <div className="dash-kpi-card"><h3>Total Receivable</h3><h2>{data.kpis.totalReceivable}</h2></div>
                <div className="dash-kpi-card"><h3>Total Payable</h3><h2>{data.kpis.totalPayable}</h2></div>
                <div className="dash-kpi-card"><h3>Top Sales Location</h3><h2>{data.kpis.topLocation}</h2></div>
                <div className="dash-kpi-card"><h3>Top Selling Item</h3><h2>{data.kpis.topItem}</h2></div>
            </div>
            
             <div className="dash-charts-row">
                <div className="dash-chart-card grid-col-8">
                    <h3>Sales Trend</h3>
                    <Chart options={data.charts.salesTrend.options} series={data.charts.salesTrend.series} type="area" height={350} />
                </div>
                <div className="dash-chart-card grid-col-4">
                    <h3>Top 10 Customers</h3>
                    <Chart options={data.charts.topCustomers.options} series={data.charts.topCustomers.series} type="bar" height={350} />
                </div>
                <div className="dash-chart-card grid-col-4">
                    <h3>Purchase By Location</h3>
                    <Chart options={data.charts.purchaseByLocation.options} series={data.charts.purchaseByLocation.series} type="donut" height={300} />
                </div>
                 <div className="dash-chart-card grid-col-4">
                    <h3>Purchase By Category</h3>
                    <Chart options={data.charts.purchaseByCategory.options} series={data.charts.purchaseByCategory.series} type="bar" height={300} />
                </div>
                <div className="dash-chart-card grid-col-4">
                    <h3>Sales By Category</h3>
                    <Chart options={data.charts.salesByCategory.options} series={data.charts.salesByCategory.series} type="pie" height={300} />
                </div>
                <div className="dash-chart-card grid-col-12">
                     <h3>Sales By City</h3>
                     <Chart options={data.charts.salesByCity.options} series={data.charts.salesByCity.series} type="treemap" height={400} />
                </div>
            </div>
        </div>
    );
};

// --- Data Processing Logic ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
};

const processDashboardData = (sales, purchases, customers, suppliers) => {
    const totalSales = sales.reduce((sum, r) => sum + Number(r['Total Sales Price'] || 0), 0);
    const totalPurchases = purchases.reduce((sum, r) => sum + Number(r['Total Purchase Price'] || 0), 0);
    const totalReceivable = customers.reduce((sum, r) => sum + Number(r['Balance Receivable'] || 0), 0);
    const totalPayable = suppliers.reduce((sum, r) => sum + Number(r['Balance Payable'] || 0), 0);

    const salesByCity = sales.reduce((acc, r) => {
        const city = r['City'] || 'Unknown';
        acc[city] = (acc[city] || 0) + Number(r['Total Sales Price'] || 0);
        return acc;
    }, {});
    const topLocation = Object.entries(salesByCity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    const salesByItem = sales.reduce((acc, r) => {
        const item = r['Item Category'] || 'Unknown';
        acc[item] = (acc[item] || 0) + Number(r['Total Sales Price'] || 0);
        return acc;
    }, {});
    const topItem = Object.entries(salesByItem).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Chart Data
    const trendMap = sales.reduce((acc, r) => {
        const d = new Date(r['SO Date']);
        if (!isNaN(d)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            acc[key] = (acc[key] || 0) + Number(r['Total Sales Price'] || 0);
        }
        return acc;
    }, {});
    const sortedDates = Object.keys(trendMap).sort();

    const salesCatMap = sales.reduce((acc, r) => {
        const c = r['Item Category'] || 'Unknown';
        acc[c] = (acc[c] || 0) + Number(r['Total Sales Price'] || 0);
        return acc;
    }, {});

    const custMap = sales.reduce((acc, r) => {
        const c = r['Customer Name'] || 'Unknown';
        acc[c] = (acc[c] || 0) + Number(r['Total Sales Price'] || 0);
        return acc;
    }, {});
    const topCustArr = Object.entries(custMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    const purCatMap = purchases.reduce((acc, r) => {
        const c = r['Item Category'] || 'Unknown';
        acc[c] = (acc[c] || 0) + Number(r['Total Purchase Price'] || 0);
        return acc;
    }, {});

    const purLocMap = purchases.reduce((acc, r) => {
        const s = r['State'] || 'Unknown';
        acc[s] = (acc[s] || 0) + Number(r['Total Purchase Price'] || 0);
        return acc;
    }, {});
    
    const salesByCityData = Object.entries(salesByCity).map(([city, sales]) => ({ x: city, y: sales }));

    return {
        kpis: {
            totalSales: formatCurrency(totalSales),
            totalPurchases: formatCurrency(totalPurchases),
            netProfit: formatCurrency(totalSales - totalPurchases),
            totalReceivable: formatCurrency(totalReceivable),
            totalPayable: formatCurrency(totalPayable),
            topLocation,
            topItem,
        },
        charts: {
            salesTrend: {
                series: [{ name: 'Sales', data: sortedDates.map(date => trendMap[date]) }],
                options: { chart: { type: 'area', toolbar: { show: false } }, dataLabels: { enabled: false }, stroke: { curve: 'smooth' }, xaxis: { type: 'datetime', categories: sortedDates }, tooltip: { x: { format: 'MMM yyyy' } } }
            },
            salesByCategory: {
                series: Object.values(salesCatMap),
                options: { chart: { type: 'pie' }, labels: Object.keys(salesCatMap), legend: { position: 'bottom' } }
            },
            topCustomers: {
                series: [{ name: 'Total Sales', data: topCustArr.map(a => a[1]) }],
                options: { chart: { type: 'bar' }, plotOptions: { bar: { horizontal: true, borderRadius: 4 } }, xaxis: { categories: topCustArr.map(a => a[0]) }, dataLabels: { enabled: false }, tooltip: { y: { formatter: val => formatCurrency(val) } } }
            },
            purchaseByCategory: {
                series: [{ name: 'Purchases', data: Object.values(purCatMap) }],
                options: { chart: { type: 'bar' }, plotOptions: { bar: { borderRadius: 4, horizontal: true } }, xaxis: { categories: Object.keys(purCatMap) } }
            },
            purchaseByLocation: {
                series: Object.values(purLocMap),
                options: { chart: { type: 'donut' }, labels: Object.keys(purLocMap), legend: { position: 'bottom' }}
            },
            salesByCity: {
                series: [{ data: salesByCityData }],
                options: { chart: { type: 'treemap' }, legend: { show: false }, plotOptions: { treemap: { distributed: true, enableShades: false }}}
            }
        }
    };
};

export default Dashboard;