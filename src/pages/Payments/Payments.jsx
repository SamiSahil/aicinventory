import React, { useState, useEffect, useMemo } from 'react';
import { getRangeData, appendRow } from '../../api/googleSheetsService';
import { useData } from '../../context/DataContext';
import { formatDateForSheet } from '../../utils/helpers';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import Select from 'react-select';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/material_green.css';
import '../../assets/styles/CrudPage.css';
import './Payments.css'; // Correctly points to its own CSS file now

const PAYMENTS_RANGE = 'RANGEPAYMENTS';

// The component name is now correctly "Payments"
const Payments = () => { 
    const { suppliers, dimensions, refreshData } = useData();
    
    // The "payments" state variable is now correctly defined
    const [payments, setPayments] = useState([]); 
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({});

    const paymentModes = useMemo(() => {
        const pmtSet = new Set(dimensions.map(d => d['PMT Mode']).filter(Boolean));
        return [...pmtSet].map(p => ({ value: p, label: p }));
    }, [dimensions]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [paymentsData, poData] = await Promise.all([
                getRangeData(PAYMENTS_RANGE),
                getRangeData('RANGEPO')
            ]);
            setPayments(paymentsData); // Correctly sets the payments state
            setPurchaseOrders(poData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

     const handleOpenModal = () => {
        setNewPayment({ 'Trx Date': new Date(), 'Amount Paid': 0 });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const generateTrxId = () => {
        const newId = 'PT' + Math.floor(10000 + Math.random() * 90000);
        setNewPayment(prev => ({ ...prev, 'Trx ID': newId }));
    };

    const handleSupplierChange = (opt) => {
        const supplier = suppliers.find(s => s['Supplier ID'] === opt.value);
        setNewPayment(prev => ({
            ...prev,
            'Supplier ID': supplier['Supplier ID'],
            'Supplier Name': supplier['Supplier Name'],
            'State': supplier['State'],
            'City': supplier['City'],
            'PO ID': '', // Reset PO ID when supplier changes
        }));
    };
    
    const handlePOChange = (opt) => {
        const po = purchaseOrders.find(p => p['PO ID'] === opt.value);
        setNewPayment(prev => ({
            ...prev,
            'PO ID': po['PO ID'],
            'Bill Num': po['Bill Num'],
            'PO Balance': po['PO Balance']
        }));
    };
    
    const handleInputChange = (e) => {
        setNewPayment(p => ({...p, [e.target.name]: e.target.value}));
    }

    const handleSave = async () => {
        const amount = parseFloat(newPayment['Amount Paid']);
        const balance = parseFloat(newPayment['PO Balance']);

        if (!newPayment['Trx ID'] || !newPayment['PO ID'] || !(amount > 0)) {
            alert('Trx ID, PO, and a valid Amount are required.');
            return;
        }
        if (amount > balance) {
            alert('Amount paid cannot be greater than the PO Balance.');
            return;
        }

        setLoading(true);
        try {
            const rowData = [
                formatDateForSheet(newPayment['Trx Date']),
                newPayment['Trx ID'], newPayment['Supplier ID'], newPayment['Supplier Name'],
                newPayment['State'], newPayment['City'], newPayment['PO ID'], newPayment['Bill Num'],
                newPayment['PMT Mode'], amount
            ];
            await appendRow(PAYMENTS_RANGE, rowData);

            alert('Payment saved successfully! All related balances will now be recalculated.');
            await fetchData(); // Refetch payments
            await refreshData(); // Refetch shared data which will trigger balance updates
            handleCloseModal();
        } catch (err) {
            setError(err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const supplierOptions = suppliers.map(s => ({ value: s['Supplier ID'], label: s['Supplier Name'] }));
    const poOptions = purchaseOrders
        .filter(po => po['Supplier ID'] === newPayment['Supplier ID'])
        .map(po => ({ value: po['PO ID'], label: `${po['PO ID']} (Bal: $${parseFloat(po['PO Balance']||0).toFixed(2)})` }));

    if (loading && !isModalOpen) return <Spinner />;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="crud-container">
            {loading && <Spinner />}
            <div className="crud-header">
                <h1>Payments</h1>
                <p>Record supplier payments against Purchase Orders</p>
            </div>
             <div className="action-bar">
                <button className="btn btn-primary" onClick={handleOpenModal}><i className="fas fa-plus"></i> New Payment</button>
            </div>
            <div className="table-container">
                <table className="crud-table">
                     <thead>
                        <tr>
                            <th>Trx Date</th><th>Trx ID</th><th>Supplier</th><th>PO ID</th>
                            <th>Bill #</th><th>PMT Mode</th><th>Amount Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* This line is now correct, it uses the "payments" variable */}
                        {payments.length > 0 ? payments.map((p, index) => (
                            <tr key={p['Trx ID'] || index}>
                                <td>{p['Trx Date']}</td>
                                <td>{p['Trx ID']}</td>
                                <td>{p['Supplier Name']}</td>
                                <td>{p['PO ID']}</td>
                                <td>{p['Bill Num']}</td>
                                <td>{p['PMT Mode']}</td>
                                <td>${parseFloat(p['Amount Paid'] || 0).toFixed(2)}</td>
                            </tr>
                        )) : <tr><td colSpan="7" className="no-data">No payments found.</td></tr>}
                    </tbody>
                </table>
            </div>

             <Modal show={isModalOpen} onClose={handleCloseModal} title="New Payment" size="lg">
                 <div className="form-grid-2-col">
                     <div className="form-group">
                        <label className="required">Trx Date</label>
                        <Flatpickr value={newPayment['Trx Date']} className="form-control" onChange={([date]) => setNewPayment(p => ({ ...p, 'Trx Date': date }))} />
                    </div>
                     <div className="form-group">
                        <label className="required">Trx ID</label>
                        <div className="id-generate">
                            <input type="text" value={newPayment['Trx ID'] || ''} className="form-control" readOnly />
                            <button type="button" className="btn btn-secondary" onClick={generateTrxId}>Generate</button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="required">Supplier</label>
                        <Select options={supplierOptions} onChange={handleSupplierChange} />
                    </div>
                    <div className="form-group">
                        <label className="required">Purchase Order (PO)</label>
                        <Select options={poOptions} value={poOptions.find(o => o.value === newPayment['PO ID'])} onChange={handlePOChange} />
                    </div>
                     <div className="form-group">
                        <label>PO Balance</label>
                        <input type="text" value={`$${parseFloat(newPayment['PO Balance'] || 0).toFixed(2)}`} className="form-control" readOnly />
                    </div>
                     <div className="form-group">
                        <label className="required">Payment Mode</label>
                        <Select options={paymentModes} onChange={(opt) => setNewPayment(p => ({ ...p, 'PMT Mode': opt.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="required">Amount Paid</label>
                        <input type="number" name="Amount Paid" step="0.01" value={newPayment['Amount Paid'] || ''} className="form-control" onChange={handleInputChange} />
                    </div>
                </div>
                 <div className="modal-footer">
                    <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave}>Save Payment</button>
                </div>
            </Modal>
        </div>
    );
};

// The component export is now correctly "Payments"
export default Payments; 