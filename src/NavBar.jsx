import React from 'react';
import NavBarBrand from "./NavBarBrand"
import 'bootstrap/dist/css/bootstrap.min.css';

export default function NavBar({ onSelect }) {
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light px-3">
      <div className="container-fluid">
        <NavBarBrand />
          <div className="navbar-collapse collapse justify-content-end">
          <ul className="navbar-nav mb-2 mb-lg-0">
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => onSelect('directions')}>Directions</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => onSelect('about')}>About</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => onSelect('legal')}>Legal</button>
            </li>
          </ul>

        </div>
      </div>
    </nav>
  );
}
