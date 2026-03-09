export interface MenuItem {
  id: number;
  name: string;
  nameZh?: string;
  brand: string;
  price: number;
  rating: number;       // 0-5 scale (converted from WeBox 0-10)
  reviewCount: number;
  salesCount: number;
  mealAvailability: ('lunch' | 'dinner')[];
  hasCustomization: boolean;
  portionCount: number;
  category?: string;
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
}

export interface BrowserConfig {
  dataDir: string;
  headless: boolean;
  addressId: string;
}
