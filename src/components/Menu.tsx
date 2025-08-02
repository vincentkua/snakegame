import React from "react";

export interface MenuItem {
  id: number;
  name: string;
  price: number;
}

interface MenuProps {
  items: MenuItem[];
  onAddToOrder: (item: MenuItem) => void;
}

const Menu: React.FC<MenuProps> = ({ items, onAddToOrder }) => (
  <div>
    <h2>Menu</h2>
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.name} - ${item.price.toFixed(2)}
          <button onClick={() => onAddToOrder(item)} style={{ marginLeft: 8 }}>
            Add
          </button>
        </li>
      ))}
    </ul>
  </div>
);

export default Menu;
