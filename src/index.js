// Placeholder for index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Assuming you'll have a global CSS file
import App from './App';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);