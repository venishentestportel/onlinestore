const API_BASE_URL = localStorage.getItem('custom_backend_url') || (window.location.port === '5000' ? 'http://localhost:3000' : window.location.origin);

async function apiRequest(endpoint, method = 'GET', body = null, isMultipart = false) {
  const token = localStorage.getItem('token');
  const headers = {};

  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = isMultipart ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await res.json();
    
    if (!res.ok) {
      const msg = data.error ? (data.details ? `${data.error} (${data.details})` : data.error) : 'Something went wrong';
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err.message);
    throw err;
  }
}

const apiClient = {
  // Authentication services
  auth: {
    async register(userData) {
      return apiRequest('/api/auth/register', 'POST', userData);
    },
    async login(email, password) {
      return apiRequest('/api/auth/login', 'POST', { email, password });
    },
    async getMe() {
      return apiRequest('/api/auth/me', 'GET');
    },
    async sendOtp(email) {
      return apiRequest('/api/auth/otp-send', 'POST', { email });
    },
    async verifyOtp(email, code) {
      return apiRequest('/api/auth/otp-verify', 'POST', { email, code });
    },
    async resetPassword(email) {
      return apiRequest('/api/auth/reset-password', 'POST', { email });
    }
  },

  // Products services
  products: {
    async list(filters = {}) {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          queryParams.append(k, v);
        }
      });
      return apiRequest(`/api/products?${queryParams.toString()}`);
    },
    async get(id) {
      return apiRequest(`/api/products/${id}`);
    },
    async create(productData) {
      return apiRequest('/api/products', 'POST', productData);
    },
    async update(id, productData) {
      return apiRequest(`/api/products/${id}`, 'PUT', productData);
    },
    async delete(id) {
      return apiRequest(`/api/products/${id}`, 'DELETE');
    },
    async addReview(productId, reviewData) {
      return apiRequest(`/api/products/${productId}/reviews`, 'POST', reviewData);
    },
    async getSuggestions(query) {
      return apiRequest(`/api/products/suggestions?query=${encodeURIComponent(query)}`);
    },
    async bulkCsvUpload(formData) {
      return apiRequest('/api/products/bulk-csv', 'POST', formData, true);
    },
    async uploadImage(formData) {
      return apiRequest('/api/upload', 'POST', formData, true);
    }
  },

  // Orders services
  orders: {
    async list() {
      return apiRequest('/api/orders');
    },
    async get(id) {
      return apiRequest(`/api/orders/${id}`);
    },
    async create(orderData) {
      return apiRequest('/api/orders', 'POST', orderData);
    },
    async updateStatus(orderId, status, details = '') {
      return apiRequest(`/api/orders/${orderId}/status`, 'PUT', { status, details });
    },
    async getDeliveryEstimate(zip) {
      return apiRequest(`/api/orders/delivery/estimate?zip=${encodeURIComponent(zip)}`);
    }
  },

  // Chat services
  chat: {
    async getThreads() {
      return apiRequest('/api/chat/threads');
    },
    async getHistory(userId) {
      return apiRequest(`/api/chat/history/${userId}`);
    },
    async sendMessage(receiver_id, message, file_url = null, file_type = null) {
      return apiRequest('/api/chat/send', 'POST', { receiver_id, message, file_url, file_type });
    },
    async triggerTyping(receiver_id, is_typing) {
      return apiRequest('/api/chat/typing', 'POST', { receiver_id, is_typing });
    }
  },

  // Payments services
  payments: {
    async createStripeIntent(amount) {
      return apiRequest('/api/payments/stripe/create-intent', 'POST', { amount });
    },
    async createRazorpayOrder(amount) {
      return apiRequest('/api/payments/razorpay/create-order', 'POST', { amount });
    },
    async capturePaypalOrder(orderId) {
      return apiRequest('/api/payments/paypal/capture-order', 'POST', { orderId });
    },
    async generateUpiQr(amount, orderId) {
      return apiRequest('/api/payments/upi/generate-qr', 'POST', { amount, orderId });
    },
    async payWithWallet(amount) {
      return apiRequest('/api/payments/wallet/pay', 'POST', { amount });
    }
  },

  // Analytics services
  analytics: {
    async getDashboard() {
      return apiRequest('/api/analytics/dashboard');
    },
    getExportCsvUrl(type) {
      const token = localStorage.getItem('token');
      return `${API_BASE_URL}/api/analytics/export/csv?type=${type}&token=${token}`;
    }
  },

  // AI Content services
  ai: {
    async generateDescription(title, category, attributes) {
      return apiRequest('/api/ai/description', 'POST', { title, category, attributes });
    },
    async generateSeo(title, description, keywords) {
      return apiRequest('/api/ai/seo', 'POST', { title, description, keywords });
    }
  },

  // Categories management
  categories: {
    async list() {
      return apiRequest('/api/categories');
    },
    async create(data) {
      return apiRequest('/api/categories', 'POST', data);
    },
    async delete(id) {
      return apiRequest(`/api/categories/${id}`, 'DELETE');
    }
  },

  // Brands management
  brands: {
    async list() {
      return apiRequest('/api/brands');
    },
    async create(data) {
      return apiRequest('/api/brands', 'POST', data);
    },
    async delete(id) {
      return apiRequest(`/api/brands/${id}`, 'DELETE');
    }
  },

  // Coupons management
  coupons: {
    async list() {
      return apiRequest('/api/coupons');
    },
    async create(data) {
      return apiRequest('/api/coupons', 'POST', data);
    },
    async delete(id) {
      return apiRequest(`/api/coupons/${id}`, 'DELETE');
    }
  },

  // Announcements management
  announcements: {
    async list() {
      return apiRequest('/api/announcements');
    },
    async create(data) {
      return apiRequest('/api/announcements', 'POST', data);
    },
    async delete(id) {
      return apiRequest(`/api/announcements/${id}`, 'DELETE');
    }
  },

  // Stores management
  stores: {
    async list() {
      return apiRequest('/api/stores');
    },
    async approve(id) {
      return apiRequest(`/api/stores/${id}/approve`, 'PUT');
    }
  }
};

window.apiClient = apiClient;
