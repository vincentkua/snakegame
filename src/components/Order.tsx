import React from "react";
import type { MenuItem } from "./Menu";

interface OrderProps {
  order: MenuItem[];
  onRemoveFromOrder: (id: number) => void;
}

const Order: React.FC<OrderProps> = ({ order, onRemoveFromOrder }) => (
  <div>
    <h2>Order</h2>
    {order.length === 0 ? (
      <p>No items in order.</p>
    ) : (
      <ul>
        {order.map((item) => (
          <li key={item.id}>
            {item.name} - ${item.price.toFixed(2)}
            <button
              onClick={() => onRemoveFromOrder(item.id)}
              style={{ marginLeft: 8 }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    )}
    <p>
      <strong>Total:</strong> $
      {order.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
    </p>
  </div>
);

export default Order;
