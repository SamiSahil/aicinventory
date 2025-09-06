import React, { useState, useEffect, useMemo } from 'react';
import { getRangeData, appendRow, updateRow, deleteRow } from '../../api/googleSheetsService';
import { useData } from '../../context/DataContext';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import '../../assets/styles/CrudPage.css';

const CUSTOMERS_SHEET_NAME = 'Customers';
const CUSTOMERS_RANGE = 'RANGECUSTOMERS';

const findRowIndex = (data, customerId) => {
    return data.findIndex(row => row['Customer ID'] === customerId) + 2;
};

const Customers = () => {
    const { dimensions, refreshData: refreshSharedData } = useData();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({});

    const { states, cities } = useMemo(() => {
        const stateSet = new Set();
        const citySet = new Set();
        dimensions.forEach(d => {
            if (d.State) stateSet.add(d.State);
            if (d.City) citySet.add(d.City);
        });
        return { states: [...stateSet].sort(), cities: [...citySet].sort() };
    }, [dimensions]);

    const fetchCustomers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getRangeData(CUSTOMERS_RANGE);
            setCustomers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleOpenModal = (customer = null) => {
        setEditingCustomer(customer);
        setFormData(customer ? { ...customer } : {
            'Customer ID': '', 'Customer Name': '', 'Customer Contact': '', 'Customer Email': '',
            'State': '', 'City': '', 'Customer Address': ''
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generateCustomerId = () => {
        const existingIds = new Set(customers.map(c => c['Customer ID']));
        let newId;
        do {
            newId = "C" + Math.floor(10000 + Math.random() * 90000);
        } while (existingIds.has(newId));
        setFormData(prev => ({ ...prev, 'Customer ID': newId }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { 'Customer ID': id, 'Customer Name': name, State, City } = formData;
        if (!id || !name || !State || !City) {
            alert('Please fill all required fields: ID, Name, State, and City.');
            return;
        }

        setLoading(true);
        try {
            const headers = ['Customer ID', 'Customer Name', 'Customer Contact', 'Customer Email', 'State', 'City', 'Customer Address', 'Total Sales', 'Total Receipts', 'Balance Receivable'];
            
            if (editingCustomer) {
                const rowIndex = findRowIndex(customers, editingCustomer['Customer ID']);
                if (rowIndex < 2) throw new Error("Could not find the customer to update.");
                
                const updatedValues = [
                    formData['Customer ID'], formData['Customer Name'], formData['Customer Contact'],
                    formData['Customer Email'], formData['State'], formData['City'], formData['Customer Address']
                ];
                const rangeToUpdate = `${CUSTOMERS_SHEET_NAME}!A${rowIndex}:G${rowIndex}`;
                await updateRow(rangeToUpdate, updatedValues);
            } else {
                const values = headers.map(header => {
                    if (['Total Sales', 'Total Receipts', 'Balance Receivable'].includes(header)) return 0;
                    return formData[header] || '';
                });
                await appendRow(CUSTOMERS_RANGE, values);
            }
            
            await fetchCustomers();
            await refreshSharedData();
            handleCloseModal();
        } catch (err) {
            setError(err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (customerId) => {
        const customerToDelete = customers.find(c => c['Customer ID'] === customerId);
        if (parseFloat(customerToDelete['Balance Receivable'] || 0) > 0) {
            alert('Cannot delete customer with an outstanding balance.');
            return;
        }

        if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            setLoading(true);
            try {
                const rowIndex = findRowIndex(customers, customerId);
                if (rowIndex < 2) throw new Error("Could not find customer to delete.");
                
                await deleteRow(CUSTOMERS_SHEET_NAME, rowIndex);
                await fetchCustomers();
                await refreshSharedData();
            } catch (err) {
                setError(err.message);
                alert(`Error: ${err.message}`);
            } finally {
                setLoading(false);
            }
        }
    };

    if (loading && !isModalOpen) return <Spinner />;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="crud-container">
            {loading && <Spinner />}
            <div className="crud-header">
                <h1>Customers</h1>
                <p>Add and manage your customers</p>
            </div>
            <div className="action-bar">
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <i className="fas fa-plus"></i> New Customer
                </button>
            </div>
            <div className="table-container">
                <table className="crud-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Name</th><th>Contact</th><th>Email</th><th>State</th>
                            <th>City</th><th>Total Sales</th><th>Balance Receivable</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.length > 0 ? customers.map((cust) => (
                            <tr key={cust['Customer ID'] || index}>
                                <td>{cust['Customer ID']}</td>
                                <td>{cust['Customer Name']}</td>
                                <td>{cust['Customer Contact']}</td>
                                <td>{cust['Customer Email']}</td>
                                <td>{cust['State']}</td>
                                <td>{cust['City']}</td>
                                <td>${parseFloat(cust['Total Sales'] || 0).toFixed(2)}</td>
                                <td>${parseFloat(cust['Balance Receivable'] || 0).toFixed(2)}</td>
                                <td className="action-cell">
                                    <button className="action-btn edit-btn" onClick={() => handleOpenModal(cust)}><i className="fas fa-edit"></i></button>
                                    <button className="action-btn delete-btn" onClick={() => handleDelete(cust['Customer ID'])}><i className="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="9" className="no-data">No customers found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal show={isModalOpen} onClose={handleCloseModal} title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="required">Customer ID</label>
                        <div className="id-generate">
                            <input type="text" name="Customer ID" className="form-control id-field" value={formData['Customer ID'] || ''} onChange={handleInputChange} readOnly={!!editingCustomer} required />
                            {!editingCustomer && <button type="button" className="btn btn-secondary" onClick={generateCustomerId}>Generate</button>}
                        </div>
                    </div>
                     <div className="form-group">
                        <label className="required">Customer Name</label>
                        <input type="text" name="Customer Name" className="form-control" value={formData['Customer Name'] || ''} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>Contact</label>
                        <input type="text" name="Customer Contact" className="form-control" value={formData['Customer Contact'] || ''} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" name="Customer Email" className="form-control" value={formData['Customer Email'] || ''} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                        <label className="required">State</label>
                        <select name="State" className="form-control" value={formData['State'] || ''} onChange={handleInputChange} required>
                            <option value="">Select a State</option>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="required">City</label>
                        <select name="City" className="form-control" value={formData['City'] || ''} onChange={handleInputChange} required>
                            <option value="">Select a City</option>
                            {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Address</label>
                        <textarea name="Customer Address" className="form-control" rows="3" value={formData['Customer Address'] || ''} onChange={handleInputChange}></textarea>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingCustomer ? 'Update' : 'Save'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Customers;
