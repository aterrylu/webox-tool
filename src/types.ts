export interface MenuItem {
  id: number;
  name: string;
  nameZh?: string;
  brand: string;
  price: number;
  rating: number;       // 0-5 scale
  reviewCount: number;
  salesCount: number;
  mealAvailability: ('lunch' | 'dinner')[];
  hasCustomization: boolean;
  portionCount: number;
  category?: string;
  soldOut?: boolean;
  dietary?: string[];   // e.g. ['vegetarian', 'mild', 'spicy']
}

export interface CartItem {
  index: number;
  name: string;
  price: number;
  quantity: number;
  date: string;
  meal: 'lunch' | 'dinner';
  customization?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  budget: number;
  remaining: number;
  budgetKnown: boolean;
}

export interface Brand {
  id: number;
  name: string;
  itemCount: number;
}

export interface ProductDetail extends MenuItem {
  description?: string;
  portions: {
    id: number;
    name: string;
    price: number;
    isDefault: boolean;
  }[];
  dietary: string[];
  ingredients?: string;
  allergens?: string[];
}

export interface ConnectionConfig {
  /** CDP endpoint URL (e.g. http://localhost:9222) */
  cdpEndpoint?: string;
  /** CDP port — shorthand for http://localhost:<port> */
  cdpPort?: number;
}
