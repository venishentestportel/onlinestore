// Global Application Script
// Manages Dark/Light mode theme, Toast alerts, Cart Drawer, and shared Navbar/Footer component rendering

// Theme Initialization
(function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();

// Dynamic currency price formatting helper
function formatPrice(price, currency = 'USD') {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'CAD': 'CA$',
    'AUD': 'A$',
    'JPY': '¥'
  };
  const symbol = symbols[currency.toUpperCase()] || (currency.toUpperCase() + ' ');
  return `${symbol}${Number(price).toFixed(2)}`;
}
window.formatPrice = formatPrice;

// Toast Notifications
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `animate-slide-in-right glass-panel flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm max-w-sm transition-all duration-300`;
  
  // Custom Icon & Theme by Type
  let icon = '';
  if (type === 'success') {
    toast.classList.add('border-emerald-500/20', 'text-emerald-800', 'dark:text-emerald-400');
    icon = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  } else if (type === 'error') {
    toast.classList.add('border-rose-500/20', 'text-rose-800', 'dark:text-rose-400');
    icon = `<svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  } else {
    toast.classList.add('border-indigo-500/20', 'text-indigo-800', 'dark:text-indigo-400');
    icon = `<svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  toast.innerHTML = `
    ${icon}
    <div class="flex-1 font-medium">${message}</div>
    <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  `;

  toastContainer.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.classList.replace('animate-slide-in-right', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Theme Toggle Handler
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    showToast('Switched to Light Mode', 'info');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    showToast('Switched to Dark Mode', 'info');
  }
}

// --- Cart Logic ---
const cartHelper = {
  getCart() {
    try {
      return JSON.parse(localStorage.getItem('cart')) || [];
    } catch {
      return [];
    }
  },
  
  saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart }));
  },

  addToCart(item, notify = true) {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(i => i.product_id === item.product_id && i.variant_id === item.variant_id);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += item.quantity || 1;
    } else {
      cart.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        product_title: item.product_title,
        price: parseFloat(item.price),
        currency: item.currency || 'USD',
        quantity: item.quantity || 1,
        image_url: item.image_url || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=400&q=80',
        store_id: item.store_id
      });
    }

    this.saveCart(cart);
    if (notify) showToast(`Added ${item.product_title} to cart!`, 'success');
  },

  removeFromCart(productId, variantId = null) {
    let cart = this.getCart();
    cart = cart.filter(i => !(i.product_id === productId && i.variant_id === variantId));
    this.saveCart(cart);
    showToast('Item removed from cart', 'info');
  },

  updateQty(productId, variantId, qty) {
    if (qty <= 0) {
      this.removeFromCart(productId, variantId);
      return;
    }
    const cart = this.getCart();
    const item = cart.find(i => i.product_id === productId && i.variant_id === variantId);
    if (item) {
      item.quantity = parseInt(qty);
      this.saveCart(cart);
    }
  },

  clearCart() {
    this.saveCart([]);
  },

  getSubtotal() {
    return this.getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getCartCount() {
    return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
  }
};

// --- Navbar & Footer Rendering ---
function renderHeader(activePage = '') {
  const headerElem = document.getElementById('main-header');
  if (!headerElem) return;

  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const cartCount = cartHelper.getCartCount();

  let userSection = `
    <a href="/login.html" class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium text-sm text-gray-700 dark:text-slate-200 transition">
      Sign In
    </a>
  `;

  if (user) {
    let dashboardLink = '/customer/index.html';
    let showDashboard = true;
    if (user.role === 'seller') dashboardLink = '/seller/index.html';
    if (user.role === 'admin' || user.role === 'super_admin') {
      showDashboard = false;
    }

    userSection = `
      <div class="relative group">
        <button class="flex items-center gap-2 focus:outline-none">
          <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=User'}" class="w-9 h-9 rounded-full border border-indigo-500/30 object-cover" alt="User avatar">
          <span class="hidden md:inline text-sm font-semibold text-gray-700 dark:text-slate-200">${user.full_name.split(' ')[0]}</span>
        </button>
        <div class="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl py-2 hidden group-hover:block z-50">
          <div class="px-4 py-2 border-b border-gray-50 dark:border-slate-800">
            <p class="text-xs text-gray-400">Signed in as</p>
            <p class="text-xs font-bold text-gray-700 dark:text-slate-200 truncate">${user.email}</p>
          </div>
          ${showDashboard ? `
          <a href="${dashboardLink}" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400">
            My Dashboard
          </a>
          ` : ''}
          <button onclick="logoutUser()" class="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20">
            Sign Out
          </button>
        </div>
      </div>
    `;
  }

  headerElem.innerHTML = `
    <!-- Announcement Bar -->
    <div id="announcement-bar" class="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white text-xs py-2 text-center font-semibold relative overflow-hidden">
      <span>⚡ Welcome Offer: Get 10% Off on your first order! Use Coupon WELCOME10 ⚡</span>
    </div>

    <!-- Main Header Bar -->
    <nav class="glass-panel sticky top-0 z-40 w-full border-b border-gray-200/50 dark:border-slate-800/40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-20 gap-4">
          <!-- Logo -->
          <a href="/index.html" class="flex-shrink-0 flex items-center gap-2">
            <img src="/images/logo.png" class="w-10 h-10 object-cover object-[center_35%] rounded-xl shadow-lg border border-gray-100 dark:border-slate-800" alt="OpenCarta Logo">
            <span class="font-bold text-lg md:text-xl tracking-tight text-slate-800 dark:text-white">Open<span class="text-indigo-600 dark:text-indigo-400 font-extrabold">Carta</span></span>
          </a>

          <!-- Live Search Bar -->
          <div class="hidden md:flex flex-1 max-w-lg relative">
            <input id="nav-search-input" type="text" placeholder="Search products, brands, or categories..." class="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-800 dark:text-slate-100 transition duration-300">
            <span class="absolute left-3 top-3 text-gray-400">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </span>
            <div id="nav-search-suggestions" class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl hidden z-50 overflow-hidden"></div>
          </div>

          <!-- Utility Icons -->
          <div class="flex items-center gap-4">
            <!-- Theme Toggle -->
            <button onclick="toggleTheme()" class="p-2.5 rounded-xl border border-gray-200/60 dark:border-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition" aria-label="Toggle Light/Dark Theme">
              <svg class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
              <svg class="w-5 h-5 hidden dark:block text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z"></path></svg>
            </button>

            <!-- Wishlist -->
            <a href="/customer/index.html?tab=wishlist" class="p-2.5 rounded-xl border border-gray-200/60 dark:border-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition relative">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            </a>

            <!-- Cart Trigger -->
            <button onclick="toggleCartDrawer(true)" class="p-2.5 rounded-xl border border-gray-200/60 dark:border-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition relative">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              <span id="nav-cart-badge" class="${cartCount > 0 ? 'flex' : 'hidden'} absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-950">${cartCount}</span>
            </button>

            <!-- User -->
            ${userSection}
          </div>
        </div>
      </div>
      
      <!-- Sub-menu Navigation Links -->
      <div class="border-t border-gray-100 dark:border-slate-800/50 py-2.5 bg-gray-50/50 dark:bg-slate-900/20">
        <div class="max-w-7xl mx-auto px-4 flex gap-6 text-sm font-semibold text-gray-600 dark:text-slate-300 no-scrollbar overflow-x-auto">
          <a href="/index.html" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Home</a>
          <a href="/search.html" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Explore Products</a>
          <a href="/search.html?category=electronics" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Electronics</a>
          <a href="/search.html?category=fashion" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Fashion</a>
          <a href="/search.html?category=home-living" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Home & Living</a>
          <a href="/seller/store.html?id=usr-seller1" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Apex Store</a>
          <a href="/seller/store.html?id=usr-seller2" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">Vogue Boutique</a>
        </div>
      </div>
    </nav>

    <!-- Slide-out Cart Drawer -->
    <div id="cart-drawer-overlay" onclick="toggleCartDrawer(false)" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 hidden transition-opacity duration-300"></div>
    <div id="cart-drawer" class="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-white dark:bg-slate-900 shadow-2xl border-l border-gray-100 dark:border-slate-800 z-50 translate-x-full transition-transform duration-300 ease-out flex flex-col">
      <div class="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <h3 class="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          Shopping Cart
        </h3>
        <button onclick="toggleCartDrawer(false)" class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Cart list -->
      <div id="drawer-cart-list" class="flex-1 overflow-y-auto p-6 space-y-4"></div>

      <!-- Summary & Actions -->
      <div class="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/20 space-y-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Subtotal</span>
          <span id="drawer-subtotal" class="font-bold text-slate-800 dark:text-white">$0.00</span>
        </div>
        <div class="text-xs text-gray-400">Shipping and taxes calculated at checkout. Free shipping on orders over $150.</div>
        <div class="grid grid-cols-2 gap-3">
          <a href="/cart.html" class="w-full text-center py-3 rounded-xl border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold text-gray-700 dark:text-slate-200 transition">
            View Cart Page
          </a>
          <a href="/checkout.html" class="w-full text-center py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition">
            Checkout
          </a>
        </div>
      </div>
    </div>
  `;

  // Search Live Suggestions Logic
  const searchInput = document.getElementById('nav-search-input');
  const suggestionsBox = document.getElementById('nav-search-suggestions');

  if (searchInput && suggestionsBox) {
    searchInput.addEventListener('input', async (e) => {
      const val = e.target.value.trim();
      if (val.length < 2) {
        suggestionsBox.classList.add('hidden');
        return;
      }

      try {
        const matches = await apiClient.products.getSuggestions(val);
        if (matches.length === 0) {
          suggestionsBox.innerHTML = `<div class="p-4 text-xs text-gray-400 text-center">No matches found</div>`;
        } else {
          suggestionsBox.innerHTML = matches.map(item => `
            <a href="/product.html?id=${item.id}" class="flex items-center gap-3 p-3 hover:bg-indigo-50 dark:hover:bg-slate-800 border-b border-gray-50 dark:border-slate-800 transition">
              <img src="${item.image}" class="w-10 h-10 object-cover rounded-lg border border-gray-100 dark:border-slate-800" alt="">
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-gray-700 dark:text-slate-200 truncate">${item.title}</p>
                <p class="text-[10px] text-indigo-500 font-bold">$${item.price.toFixed(2)}</p>
              </div>
            </a>
          `).join('');
        }
        suggestionsBox.classList.remove('hidden');
      } catch (err) {
        console.error('Suggestions loading failed');
      }
    });

    // Hide suggestions on click outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
      }
    });
  }
  loadAnnouncementsBar();
}

async function loadAnnouncementsBar() {
  const bar = document.getElementById('announcement-bar');
  if (!bar) return;
  try {
    const list = await apiClient.announcements.list();
    const active = list.find(a => a.is_active);
    if (active) {
      bar.innerHTML = `<span>${active.text}</span>`;
      bar.style.display = 'block';
    } else {
      bar.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load announcements', err);
    bar.style.display = 'none';
  }
}

function renderFooter() {
  const footerElem = document.getElementById('main-footer');
  if (!footerElem) return;

  footerElem.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <img src="/images/logo.png" class="w-8 h-8 object-cover object-[center_35%] rounded-lg shadow border border-gray-100 dark:border-slate-800" alt="OpenCarta Logo">
          <span class="font-bold text-lg tracking-tight text-slate-800 dark:text-white">OpenCarta</span>
        </div>
        <p class="text-xs text-gray-400 leading-relaxed">
          Premium multi-vendor eCommerce ecosystem. Supporting direct interactions between top quality sellers and retail buyers. Secured transactions and global coverage.
        </p>
      </div>
      <div>
        <h4 class="font-bold text-sm text-slate-800 dark:text-white mb-4">Shop Categories</h4>
        <ul class="space-y-2 text-xs text-gray-400">
          <li><a href="/search.html?category=electronics" class="hover:text-indigo-500 transition">Electronics & Computers</a></li>
          <li><a href="/search.html?category=fashion" class="hover:text-indigo-500 transition">Fashion & Footwear</a></li>
          <li><a href="/search.html?category=home-living" class="hover:text-indigo-500 transition">Home & Furniture</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-bold text-sm text-slate-800 dark:text-white mb-4">Account & Support</h4>
        <ul class="space-y-2 text-xs text-gray-400">
          <li><a href="/customer/index.html" class="hover:text-indigo-500 transition">Customer Dashboard</a></li>
          <li><a href="/seller/index.html" class="hover:text-indigo-500 transition">Seller Control Panel</a></li>
          <li><a href="/login.html" class="hover:text-indigo-500 transition">Create Account</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-bold text-sm text-slate-800 dark:text-white mb-4">Newsletter</h4>
        <p class="text-xs text-gray-400 mb-3">Subscribe to get alerts on new product arrivals and discounts.</p>
        <div class="flex gap-2">
          <input type="email" placeholder="Your email..." class="flex-1 px-3 py-2 text-xs border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none dark:bg-slate-900 text-slate-200">
          <button onclick="showToast('Thank you for subscribing!', 'success')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold">Join</button>
        </div>
      </div>
    </div>
    <div class="border-t border-gray-100 dark:border-slate-800/50 py-6 text-center text-xs text-gray-400">
      &copy; 2026 OpenCarta Marketplace. Built for high performance global trade. All rights reserved.
    </div>
  `;
}

// Global Drawer Actions
function toggleCartDrawer(open) {
  const overlay = document.getElementById('cart-drawer-overlay');
  const drawer = document.getElementById('cart-drawer');
  if (!overlay || !drawer) return;

  if (open) {
    overlay.classList.remove('hidden');
    drawer.classList.remove('translate-x-full');
    renderDrawerCartList();
  } else {
    overlay.classList.add('hidden');
    drawer.classList.add('translate-x-full');
  }
}

function renderDrawerCartList() {
  const list = document.getElementById('drawer-cart-list');
  const subtotalText = document.getElementById('drawer-subtotal');
  if (!list) return;

  const cart = cartHelper.getCart();
  const subtotalCurrency = cart.length > 0 ? (cart[0].currency || 'USD') : 'USD';
  subtotalText.innerText = formatPrice(cartHelper.getSubtotal(), subtotalCurrency);

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-center text-gray-400">
        <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
        <p class="text-sm font-semibold">Your cart is empty</p>
        <p class="text-xs">Browse products to add items here.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = cart.map(item => `
    <div class="flex gap-4 p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
      <img src="${item.image_url}" class="w-16 h-16 object-cover rounded-lg border border-gray-100 dark:border-slate-800">
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-bold text-gray-800 dark:text-slate-200 truncate">${item.product_title}</h4>
        ${item.variant_id ? `<p class="text-[10px] text-gray-400">Variant ID: ${item.variant_id.substring(0, 6)}</p>` : ''}
        <p class="text-xs font-bold text-indigo-500 mt-1">${formatPrice(item.price, item.currency)}</p>
        
        <!-- Quantity Adjuster -->
        <div class="flex items-center gap-2 mt-2">
          <button onclick="adjustDrawerQty('${item.product_id}', '${item.variant_id}', -1)" class="w-6 h-6 border border-gray-200 dark:border-slate-800 rounded flex items-center justify-center text-xs dark:text-slate-300">-</button>
          <span class="text-xs font-semibold dark:text-slate-200">${item.quantity}</span>
          <button onclick="adjustDrawerQty('${item.product_id}', '${item.variant_id}', 1)" class="w-6 h-6 border border-gray-200 dark:border-slate-800 rounded flex items-center justify-center text-xs dark:text-slate-300">+</button>
        </div>
      </div>
      <button onclick="removeDrawerItem('${item.product_id}', '${item.variant_id}')" class="text-gray-400 hover:text-rose-500 align-top">
        <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `).join('');
}

function adjustDrawerQty(prodId, varId, dir) {
  const cart = cartHelper.getCart();
  const item = cart.find(i => i.product_id === prodId && i.variant_id === (varId === 'null' ? null : varId));
  if (item) {
    cartHelper.updateQty(prodId, item.variant_id, item.quantity + dir);
    renderDrawerCartList();
  }
}

function removeDrawerItem(prodId, varId) {
  cartHelper.removeFromCart(prodId, varId === 'null' ? null : varId);
  renderDrawerCartList();
}

function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => window.location.href = '/login.html', 1000);
}

// Listen for global cart updates to sync header badges
window.addEventListener('cart-updated', (e) => {
  const badge = document.getElementById('nav-cart-badge');
  const count = cartHelper.getCartCount();
  if (badge) {
    badge.innerText = count;
    if (count > 0) {
      badge.classList.replace('hidden', 'flex');
    } else {
      badge.classList.replace('flex', 'hidden');
    }
  }
  // If drawer is open, re-render list
  const drawer = document.getElementById('cart-drawer');
  if (drawer && !drawer.classList.contains('translate-x-full')) {
    renderDrawerCartList();
  }
});

// Auto Mount on Dom Load
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
});
