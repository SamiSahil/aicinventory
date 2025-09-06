import React, { useState, useEffect, useMemo } from 'react';
import { getRangeData, appendRow, updateRow, deleteRow } from '../../api/googleSheetsService';
import { useData } from '../../context/DataContext';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import '../../assets/styles/CrudPage.css';

const INVENTORY_SHEET_NAME = 'InventoryItems';
const INVENTORY_RANGE = 'RANGEINVENTORYITEMS';

// Helper to find the 1-based row index in the sheet
const findRowIndex = (data, itemId) => {
    // +2 because sheet is 1-indexed and we have a header row
    return data.findIndex(row => row['Item ID'] === itemId) + 2;
};

const Inventory = () => {
    const { dimensions, refreshData: refreshSharedData } = useData();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    // Memoize dimensions to prevent re-calculating on every render
    const { types, categories, subcategories } = useMemo(() => {
        const typeSet = new Set();
        const catSet = new Set();
        const subcatSet = new Set();
        dimensions.forEach(d => {
            if (d['Item Type']) typeSet.add(d['Item Type']);
            if (d['Item Category']) catSet.add(d['Item Category']);
            if (d['Item Subcategory']) subcatSet.add(d['Item Subcategory']);
        });
        return {
            types: [...typeSet].sort(),
            categories: [...catSet].sort(),
            subcategories: [...subcatSet].sort()
        };
    }, [dimensions]);

    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getRangeData(INVENTORY_RANGE);
            setItems(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleOpenModal = (item = null) => {
        setEditingItem(item);
        setFormData(item ? { ...item } : {
            'Item ID': '',
            'Item Name': '',
            'Item Type': '',
            'Item Category': '',
            'Item Subcategory': '',
            'Reorder Level': 0
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const generateItemId = () => {
        const existingIds = new Set(items.map(i => i['Item ID']));
        let newId;
        do {
            newId = "P" + Math.floor(10000 + Math.random() * 90000);
        } while (existingIds.has(newId));
        setFormData(prev => ({ ...prev, 'Item ID': newId }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { 'Item ID': id, 'Item Name': name, 'Item Type': type, 'Item Category': cat, 'Item Subcategory': subcat } = formData;
        if (!id || !name || !type || !cat || !subcat) {
            alert('All fields except Reorder Level are required.');
            return;
        }

        setLoading(true);
        try {
            if (editingItem) {
                const rowIndex = findRowIndex(items, editingItem['Item ID']);
                if (rowIndex < 2) throw new Error("Could not find the item to update.");
                
                // Update only the editable fields
                const rangeToUpdate = `${INVENTORY_SHEET_NAME}!A${rowIndex}:I${rowIndex}`;
                const values = [
                    formData['Item ID'],
                    formData['Item Type'],
                    formData['Item Category'],
                    formData['Item Subcategory'],
                    formData['Item Name'],
                    editingItem['QTY Purchased'], // These fields are not editable in this form
                    editingItem['QTY Sold'],
                    editingItem['Remaining QTY'],
                    formData['Reorder Level'] || 0
                ];

                await updateRow(rangeToUpdate, values);
            } else {
                const headers = ['Item ID', 'Item Type', 'Item Category', 'Item Subcategory', 'Item Name', 'QTY Purchased', 'QTY Sold', 'Remaining QTY', 'Reorder Level', 'Reorder Required'];
                const values = headers.map(h => {
                    if (['QTY Purchased', 'QTY Sold', 'Remaining QTY'].includes(h)) return 0;
                    if (h === 'Reorder Required') return 'No';
                    return formData[h] || '';
                });
                await appendRow(INVENTORY_RANGE, values);
            }
            await fetchItems();
            await refreshSharedData(); // Refresh context data as well
            handleCloseModal();
        } catch (err) {
            setError(err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

const handleDelete = async (itemId) => {
    const itemToDelete = items.find(i => i['Item ID'] === itemId);
    if (parseFloat(itemToDelete['Remaining QTY'] || 0) > 0) {
        alert('Cannot delete an item that has stock on hand.');
        return; 
    }
    if (window.confirm('Are you sure you want to delete this item? This action is permanent.')) {
            setLoading(true);
            try {
                const rowIndex = findRowIndex(items, itemId);
                if (rowIndex < 2) throw new Error("Could not find item to delete.");
                
                await deleteRow(INVENTORY_SHEET_NAME, rowIndex);
                await fetchItems();
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
                <h1>Inventory Items</h1>
                <p>Add and manage your inventory items</p>
            </div>
            <div className="action-bar">
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <i className="fas fa-plus"></i> Add Inventory Item
                </button>
            </div>
            <div className="table-container">
                <table className="crud-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Name</th><th>Type</th><th>Category</th><th>Purchased</th>
                            <th>Sold</th><th>Remaining</th><th>Reorder Lvl</th><th>Reorder?</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 ? items.map(item => (
                           <tr key={item['Item ID'] || index}>
                                <td>{item['Item ID']}</td><td>{item['Item Name']}</td><td>{item['Item Type']}</td><td>{item['Item Category']}</td>
                                <td>{item['QTY Purchased']}</td><td>{item['QTY Sold']}</td><td>{item['Remaining QTY']}</td><td>{item['Reorder Level']}</td>
                                <td><span className={`status ${item['Reorder Required'] === 'Yes' ? 'status-yes' : 'status-no'}`}>{item['Reorder Required']}</span></td>
                                <td className="action-cell">
                                    <button className="action-btn edit-btn" onClick={() => handleOpenModal(item)}><i className="fas fa-edit"></i></button>
                                    <button className="action-btn delete-btn" onClick={() => handleDelete(item['Item ID'])}><i className="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="10" className="no-data">No inventory items found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal show={isModalOpen} onClose={handleCloseModal} title={editingItem ? 'Edit Item' : 'Add New Item'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="required">Item ID</label>
                        <div className="id-generate">
                            <input type="text" name="Item ID" className="form-control id-field" value={formData['Item ID'] || ''} onChange={handleInputChange} readOnly={!!editingItem} required />
                            {/* THIS IS THE CORRECTED LINE */}
                            {!editingItem && (
                                <button type="button" className="btn btn-secondary" onClick={generateItemId}>Generate</button>
                            )}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="required">Item Name</label>
                        <input type="text" name="Item Name" className="form-control" value={formData['Item Name'] || ''} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label className="required">Item Type</label>
                        <select name="Item Type" className="form-control" value={formData['Item Type'] || ''} onChange={handleInputChange} required>
                            <option value="">Select Type</option>
                            {types.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="required">Item Category</label>
                        <select name="Item Category" className="form-control" value={formData['Item Category'] || ''} onChange={handleInputChange} required>
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="required">Item Subcategory</label>
                        <select name="Item Subcategory" className="form-control" value={formData['Item Subcategory'] || ''} onChange={handleInputChange} required>
                            <option value="">Select Subcategory</option>
                            {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="required">Reorder Level</label>
                        <input type="number" name="Reorder Level" className="form-control" value={formData['Reorder Level'] || '0'} onChange={handleInputChange} required />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingItem ? 'Update' : 'Save'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
export default Inventory;