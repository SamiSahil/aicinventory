// src/components/layout/Sidebar.jsx

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
    { path: '/dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { path: '/inventory', icon: 'fa-boxes', label: 'Inventory' },
    { path: '/suppliers', icon: 'fa-truck-loading', label: 'Suppliers' },
    { path: '/customers', icon: 'fa-user-friends', label: 'Customers' },
    { path: '/purchases', icon: 'fa-file-invoice-dollar', label: 'Purchases' },
    { path: '/sales', icon: 'fa-chart-line', label: 'Sales' },
    { path: '/receipts', icon: 'fa-receipt', label: 'Receipts' },
    { path: '/payments', icon: 'fa-credit-card', label: 'Payments' },
];

const Sidebar = ({ isOpen, onLinkClick }) => {
    const { logout } = useAuth();

    const handleLogoutClick = () => {
        logout();
        onLinkClick(); // Close the sidebar after logging out
    };

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            <h1 className="app-title">
                <i className="fas fa-warehouse"></i> <span>AIC Inventory App</span>
            </h1>
            <nav className="nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        onClick={onLinkClick}
                    >
                        <i className={`fas ${item.icon}`}></i> <span>{item.label}</span>
                    </NavLink>
                ))}
                 <a href="#" onClick={handleLogoutClick} className="nav-item">
                    <i className="fas fa-sign-out-alt"></i> <span>Logout</span>
                </a>
            </nav>
        </div>
    );
};

export default Sidebar;